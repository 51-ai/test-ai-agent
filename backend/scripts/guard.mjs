#!/usr/bin/env node
/**
 * 防退化护栏（Anti-regression guard）
 *
 * 检查本项目是否出现以下"看起来能用但其实是假的"问题：
 *   1. 伪实现特征：用 hash + Math.sin/cos 伪造向量、硬编码返回、TODO/FIXME mock 占位
 *   2. 僵尸依赖：package.json 里声明但源码从未引用
 *   3. 假测试：测试/脚本文件里没有任何断言
 *   4. 同步阻塞式向量化：是否在同步函数里调用异步 embed
 *   5. 密钥硬编码：源码中出现疑似 API Key 的字面量
 *
 * 运行：node scripts/guard.mjs  （退出码非 0 表示发现问题，可接入 CI）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const warnings = [];

function walk(dir, filter = () => true, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const TEST_EXT = /\.(test|spec)\.(ts|tsx|js)$|\/scripts\/.*\.(ts|mjs|js)$/;

const srcDir = fs.existsSync(path.join(root, 'backend/src')) ? 'backend/src' : 'src';
const backendSrc = walk(path.join(root, srcDir), (f) => SOURCE_EXT.test(f));
const frontDir = fs.existsSync(path.join(root, 'frontend/src')) ? 'frontend/src' : '../frontend/src';
const frontendSrc = walk(path.resolve(root, frontDir), (f) => SOURCE_EXT.test(f));
const backendScripts = walk(path.join(root, 'backend/scripts'), (f) => SOURCE_EXT.test(f));
const allSource = [...backendSrc, ...frontendSrc, ...backendScripts];

/** 剥离注释，避免把"说明文字"误判为真实代码 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

// ---------- 1. 伪实现特征 ----------
const FAKE_PATTERNS = [
  { re: /Math\.(sin|cos)\s*\([^)]*(hash|seed|i\s*\*)/i, desc: '用 hash + 三角函数伪造向量（无语义能力）' },
  { re: /generateEmbedding[\s\S]{0,400}Math\.(sin|cos)/, desc: 'embedding 生成使用了三角函数造假' },
  { re: /return\s+\[?\s*(0\.\d+|1)\s*[,;]?\s*\]?\s*;?\s*\/\/\s*(mock|fake|stub|假的|占位)/i, desc: '硬编码伪返回值' },
  { re: /TODO[:：]?\s*(mock|fake|假的|占位|模拟数据)/i, desc: '标记为 mock/占位的未实现逻辑' },
];

for (const file of allSource) {
  const content = stripComments(fs.readFileSync(file, 'utf8'));
  for (const p of FAKE_PATTERNS) {
    if (p.re.test(content)) problems.push(`[伪实现] ${path.relative(root, file)}：${p.desc}`);
  }
}

// ---------- 2. 僵尸依赖 ----------
/**
 * 允许"声明但不直接 import"的依赖：
 *  - 构建工具链（vite/tailwind/postcss 等由配置文件而非源码引用）
 *  - 运行时原生依赖（被上游包 require，如 sharp）
 *  - 类型/运行器
 */
const DEP_ALLOWLIST = new Set([
  'typescript', 'ts-node', 'ts-node-dev', 'nodemon', 'jest', 'ts-jest',
  'vite', '@vitejs/plugin-react', 'tailwindcss', 'postcss', 'autoprefixer',
  'esbuild', 'rollup', 'sharp',
  '@esbuild/win32-x64', '@rollup/rollup-win32-x64-msvc',
]);

function checkDeps(pkgDir, srcFiles, label) {
  const pkgPath = path.join(root, pkgDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const corpus = srcFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  // 动态加载（importEsm('pkg') / new Function('s','return import(s)')）以字符串形式出现也算引用
  const configCorpus = walk(path.join(root, pkgDir), (f) => /\.(json|js|cjs|mjs|ts)$/.test(f) && !f.includes('node_modules'))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  for (const dep of deps) {
    if (dep.startsWith('@types/') || DEP_ALLOWLIST.has(dep) || dep.startsWith('@esbuild/') || dep.startsWith('@rollup/')) continue;
    const esc = dep.replace(/[/\\]/g, '[/\\\\]');
    const used =
      new RegExp(`(from\\s+['"]${esc}|require\\(['"]${esc}|import\\(['"]${esc})`).test(corpus) ||
      new RegExp(`['"\`]${esc}['"\`]`).test(corpus) ||
      new RegExp(`['"\`]${esc}['"\`]`).test(configCorpus);
    if (!used) warnings.push(`[僵尸依赖] ${pkgDir} 声明了 "${dep}" 但源码未引用 —— 要么接入，要么移除`);
  }
}
checkDeps('backend', [...backendSrc, ...backendScripts], 'backend');
checkDeps('frontend', frontendSrc, 'frontend');

// ---------- 3. 假测试（无断言） ----------
const testFiles = [...backendSrc, ...backendScripts, ...frontendSrc].filter((f) => TEST_EXT.test(f));
const ASSERT_RE = /\b(expect\(|assert\(|assert\w*\(|node:assert|throw new Error|process\.exit\(1\))\b/;
for (const file of testFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (!ASSERT_RE.test(content)) {
    warnings.push(`[可疑测试] ${path.relative(root, file)}：未发现任何断言，可能是"打印式脚本"`);
  }
}

// ---------- 4. 同步函数里调用异步向量化/检索 ----------
// 只检测真正需要异步的调用，且按函数体块范围判断，避免误报
const ASYNC_CALL_RE =
  /\b(embed|semanticRecall|fusedMultiRecall|hybridSearch|getContextForQuery|multiVectorSearch|multiStrategyRetrieve|buildSmartContext|buildPromptWithContext)\s*\(|vectorStore\.search\s*\(|this\.search\s*\(/;

function findSyncAsyncCalls(file, content) {
  const code = stripComments(content);
  const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'return', 'get', 'set', 'constructor', 'function', 'else', 'do']);
  const declRe = /(?:^|\n)(\s{2,4})(?:public\s+|private\s+|protected\s+)?(async\s+)?([A-Za-z_]\w*)\s*\([^)]*\)[^{]*\{/g;
  let m;
  const found = [];
  while ((m = declRe.exec(code)) !== null) {
    const isAsync = Boolean(m[2]);
    const name = m[3];
    if (KEYWORDS.has(name)) continue;
    // 找到函数体的配对右括号
    let depth = 0;
    let i = declRe.lastIndex - 1;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = code.slice(declRe.lastIndex, i);
    if (!isAsync && ASYNC_CALL_RE.test(body)) {
      const lineNo = code.slice(0, m.index).split('\n').length;
      found.push(`[同步风险] ${path.relative(root, file)}:${lineNo} ${name}() 非 async 却调用了异步的向量化/检索`);
    }
  }
  return found;
}

for (const file of [...backendSrc, ...backendScripts]) {
  const content = fs.readFileSync(file, 'utf8');
  problems.push(...findSyncAsyncCalls(file, content));
}

// ---------- 5. 硬编码密钥 ----------
const KEY_RE = /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,})/;
for (const file of allSource) {
  if (file.includes('scripts/guard')) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (KEY_RE.test(content)) problems.push(`[密钥泄漏] ${path.relative(root, file)} 中出现疑似 API Key 字面量`);
}

// ---------- 输出 ----------
console.log('=== 防退化护栏检查结果 ===\n');
if (problems.length) {
  console.log('❌ 必须修复：');
  problems.forEach((p) => console.log('  ' + p));
} else {
  console.log('✅ 未发现伪实现 / 同步风险 / 密钥泄漏');
}
if (warnings.length) {
  console.log('\n⚠️  建议处理：');
  warnings.forEach((w) => console.log('  ' + w));
}
console.log(`\n扫描文件 ${allSource.length} 个`);
process.exit(problems.length ? 1 : 0);
