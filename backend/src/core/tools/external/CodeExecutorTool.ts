import { ToolCallResult } from '../../tool-enhance';
import { spawn } from 'child_process';

/**
 * 沙箱网络隔离能力。
 *
 * 安全模型（第十二轮审查后确立）：
 * - **唯一真实防线是网络隔离**（Linux netns），而不是黑名单正则。
 *   黑名单只是纵深防御，绝不能作为边界——`(()=>{}).constructor` 等链可绕过任意正则。
 * - 无网络隔离能力时（Windows / 无 unshare 权限）必须 fail closed，直接拒绝执行，
 *   绝不退化到裸 `node --permission`（其不拦网络/DNS，SSRF + 外带全开）。
 */
type SandboxCapability = 'unshare-n' | 'unshare-urn' | 'none';

let cachedCapability: SandboxCapability | null = null;

/** 运行一个探测命令，返回是否以退出码 0 结束（带超时，避免挂起）。 */
function runProbe(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };

    let child;
    try {
      child = spawn(command, args, { stdio: 'ignore', shell: false });
    } catch {
      return done(false);
    }

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* noop */ }
      done(false);
    }, 3000);
    if (typeof timer.unref === 'function') timer.unref();

    child.on('error', () => {
      clearTimeout(timer);
      done(false);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done(code === 0);
    });
  });
}

/**
 * 探测当前环境的网络隔离能力（结果缓存）。
 * - `unshare -n`：需要 root / CAP_SYS_ADMIN（裸 Linux 或特权容器）。
 * - `unshare -Urn`：非特权用户命名空间 + 网络命名空间，Docker 非 root（appuser）可用，
 *   用于修复第十二轮 P1：非 root 下 `unshare -n` 直接 Operation not permitted 的功能回归。
 * - 两者都不可用 → 'none'，调用方必须 fail closed。
 */
export async function probeSandboxCapability(): Promise<SandboxCapability> {
  if (cachedCapability !== null) return cachedCapability;

  if (process.platform !== 'linux') {
    cachedCapability = 'none';
    return cachedCapability;
  }

  // 用 node 自身做探测目标，确保目标二进制必然存在
  if (await runProbe('unshare', ['-n', 'node', '-e', 'process.exit(0)'])) {
    cachedCapability = 'unshare-n';
    return cachedCapability;
  }

  if (await runProbe('unshare', ['-Urn', 'node', '-e', 'process.exit(0)'])) {
    cachedCapability = 'unshare-urn';
    return cachedCapability;
  }

  cachedCapability = 'none';
  return cachedCapability;
}

export class CodeExecutorTool {
  private usageCount = 0;
  private successCount = 0;

  async execute(toolId: string, parameters: Record<string, any>): Promise<ToolCallResult> {
    this.usageCount++;
    
    const code = parameters.code as string;
    const language = (parameters.language as string) || 'javascript';
    const timeout = (parameters.timeout as number) || 5000;

    if (!code || typeof code !== 'string') {
      return {
        success: false,
        error: 'Code parameter is required and must be a string',
        duration: 0
      };
    }

    if (code.length > 10000) {
      return {
        success: false,
        error: 'Code length exceeds maximum limit (10000 characters)',
        duration: 0
      };
    }

    // 纵深防御层（非安全边界）：拦截最常见的危险模式。
    // 注意：黑名单可被 `(()=>{}).constructor('return this["pro"+"cess"]')()` 等链绕过，
    // 真正的边界是 executeJavaScript 内的网络隔离 + fail closed 策略。
    const dangerousPatterns = [
      /require\s*\(\s*['"]fs['"]\s*\)/i,
      /require\s*\(\s*['"]child_process['"]\s*\)/i,
      /require\s*\(\s*['"]net['"]\s*\)/i,
      /require\s*\(\s*['"]http['"]\s*\)/i,
      /require\s*\(\s*['"]dns['"]\s*\)/i,
      /process\.exit/i,
      /process\.kill/i,
      /execSync/i,
      /spawnSync/i,
      /\beval\b/i,
      /new\s+Function/i,
      /Function\s*\(/i,
      /globalThis\b/i,
      /\bprocess\b/i,
      /\b__proto__\b/i,
      /\bconstructor\b.*prototype/i,
      /getBuiltinModule/i,
      /\.binding\s*\(/i,
      /AsyncFunction/i,
      /GeneratorFunction/i,
      /WebAssembly\b/i,
      /\bglobal\b/i,        // global === globalThis in Node，可绕过 globalThis 正则
      /\bfetch\s*\(/i,      // fetch 不受 --permission 限制
      /\bdns\b/i,            // dns.lookup 可外带数据
      /\bnet\.connect\b/i,   // 内网端口探测
      /http\.get\s*\(/i,     // SSRF 打内网
      /http\.request\s*\(/i,
      /\bhttps\b/i,          // 外网请求
      // 第十二轮新增：函数构造器链（`()=>{}`.constructor 可构造任意函数拿 globalThis）
      /\.constructor\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          success: false,
          error: `Dangerous operation detected: ${pattern.source}`,
          duration: 0
        };
      }
    }

    try {
      let result: unknown;
      const startTime = Date.now();

      if (language.toLowerCase() === 'python') {
        result = await executePython(code, timeout);
      } else {
        result = await executeJavaScript(code, timeout);
      }

      const executionTime = Date.now() - startTime;
      this.successCount++;

      return {
        success: true,
        result: {
          result,
          language,
          code: code.substring(0, 200),
          executionTime,
          timestamp: new Date().toISOString()
        },
        duration: executionTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage,
        duration: 0
      };
    }
  }

  getStats() {
    return {
      usageCount: this.usageCount,
      successCount: this.successCount,
      successRate: this.usageCount > 0 ? this.successCount / this.usageCount : 0
    };
  }
}

async function executeJavaScript(code: string, timeout: number): Promise<unknown> {
  // Fail closed：无网络隔离能力时直接拒绝执行（第十二轮 P0#1）。
  // Windows 无 unshare 等价物；裸 `node --permission` 不拦网络/DNS，
  // SSRF + DNS 外带 + 内网探测全开，因此绝不作为兜底。
  const capability = await probeSandboxCapability();
  if (capability === 'none') {
    throw new Error(
      '代码执行仅支持具备网络隔离能力的 Linux/容器环境（unshare netns 或 Docker --network=none）。' +
      '当前环境无网络隔离能力，已拒绝执行。'
    );
  }

  // 包装代码：捕获表达式返回值并输出到 stdout
  const wrappedCode = `console.log(JSON.stringify((function(){"use strict"; return (${code})})()))`;

  // 网络隔离策略（唯一真实防线）：
  // - unshare -n：root/CAP_SYS_ADMIN 环境
  // - unshare -Urn：非特权环境（Docker 非 root appuser），用户命名空间 + 网络命名空间
  // --permission 保留作为文件系统纵深防御，但不再被视为安全边界。
  const unshareFlags = capability === 'unshare-n' ? ['-n'] : ['-Urn'];
  const command = 'unshare';
  const args = [...unshareFlags, 'node', '--permission', '--eval', wrappedCode];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      // 关键：不继承 process.env，防止 DEEPSEEK_API_KEY / JWT_SECRET 等泄露
      env: {
        NODE_ENV: 'production',
        PATH: process.env.PATH || '/usr/bin:/bin:/usr/local/bin',
        HOME: '/tmp/sandbox',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    // 超时兜底：SIGKILL 不可捕获，恶意代码无法赖着不走
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeout);
    // 不阻塞进程退出，避免测试/进程结束时因 pending timer 造成 open handle 泄漏
    if (typeof timer.unref === 'function') timer.unref();

    // 统一收尾：防止 error + close 双路径重复 settle，并确保 timer 被清理
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn();
      }
    };

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > 1024 * 1024) { // 1MB 上限
        child.kill('SIGKILL');
      }
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      settle(() => reject(new Error(`Sandbox spawn error: ${err.message}`)));
    });

    child.on('close', (code, signal) => {
      // 移除流监听，释放 stdio socket，避免 open handle 泄漏
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      settle(() => {
        if (signal === 'SIGKILL') {
          reject(new Error('Code execution timed out after ' + timeout + 'ms'));
        } else if (code !== 0) {
          // 隔离能力在运行期失效（如权限被回收）时同样视为拒绝，不回退裸执行
          reject(new Error(stderr.trim() || `Sandbox exited with code ${code}`));
        } else {
          try {
            resolve(JSON.parse(stdout.trim() || 'null'));
          } catch {
            resolve(stdout.trim() || null);
          }
        }
      });
    });
  });
}

async function executePython(code: string, timeout: number): Promise<unknown> {
  const pythonPath = process.env.PYTHON_PATH || 'python3';
  
  if (!process.env.PYTHON_PATH && process.env.NODE_ENV === 'development') {
    return {
      note: 'Python execution requires Python to be installed. Please set PYTHON_PATH environment variable.',
      suggestion: 'For production, consider using Docker containers or cloud functions for safer Python execution.'
    };
  }

  return {
    note: 'Python execution is not fully implemented in this version.',
    suggestion: 'Please use JavaScript for code execution, or configure a secure Python execution environment.'
  };
}

export const codeExecutorTool = new CodeExecutorTool();
