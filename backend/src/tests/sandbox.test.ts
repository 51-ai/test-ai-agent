import { describe, it, expect, beforeEach } from '@jest/globals';
import { SandboxManager, type SandboxConfig, type SandboxExecutionRequest } from '../core/security/SandboxManager';

describe('SandboxManager', () => {
  let sandbox: SandboxManager;

  beforeEach(() => {
    // 使用 disabled 环境，避免真实执行
    sandbox = new SandboxManager({
      environment: 'disabled',
      allowedLanguages: ['python', 'javascript']
    });
  });

  describe('executeCode - 输入验证', () => {
    it('应拒绝空代码', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: ''
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('VALIDATION_ERROR');
    });

    it('应拒绝不支持的语言', async () => {
      const result = await sandbox.executeCode({
        language: 'typescript' as any,
        code: 'console.log("test")'
      });
      expect(result.success).toBe(false);
    });

    it('应拒绝过长的超时时间', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'print("hello")',
        timeout: 999999
      });
      expect(result.success).toBe(false);
    });

    it('disabled环境不应执行', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'print("hello")'
      });
      expect(result.error).toBe('SANDBOX_DISABLED');
    });
  });

  describe('executeCode - 安全检查', () => {
    it('应拦截Python危险代码 (os.system)', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'import os\nos.system("rm -rf /")'
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('SECURITY_BLOCKED');
      expect(result.stderr).toContain('危险操作');
    });

    it('应拦截Python eval', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'eval("1+1")'
      });
      expect(result.success).toBe(false);
    });

    it('应拦截Python无限循环', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'while True:\n    print("loop")'
      });
      expect(result.success).toBe(false);
    });

    it('应拦截JavaScript require(child_process)', async () => {
      const result = await sandbox.executeCode({
        language: 'javascript',
        code: 'require("child_process").exec("rm -rf /")'
      });
      expect(result.success).toBe(false);
    });

    it('应拦截JavaScript process.exit', async () => {
      const result = await sandbox.executeCode({
        language: 'javascript',
        code: 'process.exit(1)'
      });
      expect(result.success).toBe(false);
    });

    it('应拦截JavaScript无限循环', async () => {
      const result = await sandbox.executeCode({
        language: 'javascript',
        code: 'while(true) { console.log("loop"); }'
      });
      expect(result.success).toBe(false);
    });

    it('应拦截代码中的URL（网络禁用时）', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'print("https://evil.com/data")'
      });
      expect(result.success).toBe(false);
    });

    it('应拦截超过10000字符的代码', async () => {
      const longCode = 'print("a");'.repeat(2000);
      const result = await sandbox.executeCode({
        language: 'python',
        code: longCode
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('SIZE_LIMIT_EXCEEDED');
    });

    it('安全代码应通过检查（但环境disabled不执行）', async () => {
      const result = await sandbox.executeCode({
        language: 'python',
        code: 'x = 1 + 2\nresult = x * 3\nprint(result)'
      });
      // 安全检查通过，但环境disabled
      expect(result.error).toBe('SANDBOX_DISABLED');
    });
  });

  describe('审计日志', () => {
    it('应记录所有执行请求', async () => {
      await sandbox.executeCode({
        language: 'python',
        code: 'print("test")'
      }, 'test_user');
      await sandbox.executeCode({
        language: 'python',
        code: 'import os\nos.system("ls")'
      }, 'test_user');

      const log = sandbox.getAuditLog();
      expect(log.length).toBe(2);
    });

    it('应支持按用户过滤审计日志', async () => {
      await sandbox.executeCode({ language: 'python', code: 'a=1' }, 'user_a');
      await sandbox.executeCode({ language: 'python', code: 'b=2' }, 'user_b');

      const userALog = sandbox.getAuditLog({ userId: 'user_a' });
      expect(userALog.length).toBe(1);
      expect(userALog[0].userId).toBe('user_a');
    });

    it('应支持按拦截状态过滤', async () => {
      await sandbox.executeCode({ language: 'python', code: 'print(1)' });
      await sandbox.executeCode({ language: 'python', code: 'eval("1+1")' });

      const blockedLog = sandbox.getAuditLog({ blocked: true });
      expect(blockedLog.length).toBe(1);
    });
  });

  describe('配置管理', () => {
    it('应能获取配置', () => {
      const config = sandbox.getConfig();
      expect(config).toBeDefined();
      expect(config.maxExecutionTimeMs).toBe(30000);
    });

    it('应能更新配置', () => {
      sandbox.updateConfig({ maxExecutionTimeMs: 60000 });
      expect(sandbox.getConfig().maxExecutionTimeMs).toBe(60000);
    });

    it('自定义配置应覆盖默认值', () => {
      const custom = new SandboxManager({ maxExecutionTimeMs: 10000, maxMemoryMB: 256 });
      expect(custom.getConfig().maxExecutionTimeMs).toBe(10000);
      expect(custom.getConfig().maxMemoryMB).toBe(256);
    });
  });

  describe('统计信息', () => {
    it('应提供执行统计', async () => {
      await sandbox.executeCode({ language: 'python', code: 'print("safe")' });
      await sandbox.executeCode({ language: 'python', code: 'eval("1+1")' });

      const stats = sandbox.getStats();
      expect(stats.totalExecutions).toBe(2);
      expect(stats.blockedExecutions).toBe(1);
      expect(stats.byLanguage).toBeDefined();
    });
  });
});
