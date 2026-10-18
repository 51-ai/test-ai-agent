import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock LLMService：让 getLLMService 返回 null，使 processInput 走意图分发分支
// （否则 new Agent() 会初始化真实 LLM，优先走 LLM 分支，execute_code 等意图不可达）
jest.mock('../services/LLMService', () => ({
  LLMService: class MockLLMService {},
  getLLMService: () => null,
  createLLMService: () => null,
  DEFAULT_SYSTEM_PROMPT: 'mock system prompt',
}));

import { Agent } from '../core/Agent';
import { probeSandboxCapability } from '../core/tools/external/CodeExecutorTool';

describe('Agent', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent();
  });

  describe('processInput', () => {
    it('should handle greeting intent', async () => {
      // "早上好" 触发 greeting 意图（"你好" 会被 FAQ 知识库拦截，返回 "我很好"）
      const response = await agent.processInput('早上好', 'user1');
      expect(response.content).toContain('您好');
    });

    it('should handle help intent', async () => {
      const response = await agent.processInput('帮助', 'user1');
      expect(response.content).toContain('帮助');
    });

    it('should handle calculate intent', async () => {
      const response = await agent.processInput('计算 2 + 3', 'user1');
      // handleCalculate 输出表达式（去空格）后经情感层可能重排为 "2 + 3 = 5"
      expect(response.content).toContain('= 5');
    });

    it('should detect language correctly', async () => {
      const response = await agent.processInput('Hello', 'user1');
      expect(response.content).toContain('Hello');
    });

    it('should handle japanese input', async () => {
      const response = await agent.processInput('こんにちは', 'user1');
      expect(response.content).toContain('こんにちは');
    });
  });

  describe('memory system', () => {
    it('should track memory stats', () => {
      const stats = agent.getMemoryStats('user1');
      expect(stats).toHaveProperty('shortTermMessages');
      expect(stats).toHaveProperty('longTermMemories');
      expect(stats).toHaveProperty('mediumTermTasks');
    });

    it('should consolidate memory', () => {
      expect(() => agent.consolidateMemory('user1')).not.toThrow();
    });
  });

  describe('execute_code 权限校验（第十一轮新增）', () => {
    const codeInput = '执行 javascript: 42';

    it('非 admin 用户（不传角色）应被拒绝', async () => {
      const response = await agent.processInput(codeInput, 'user1');
      expect(response.content).toContain('仅限管理员');
    });

    it('非 admin 用户（显式传 user）应被拒绝', async () => {
      const response = await agent.processInput(codeInput, 'user1', 'user');
      expect(response.content).toContain('仅限管理员');
    });

    it('admin 用户：具备隔离能力时正常执行；否则因无网络隔离 fail closed（第十二轮 P0#1）', async () => {
      const response = await agent.processInput(codeInput, 'user1', 'admin');

      const capability = await probeSandboxCapability();
      if (capability !== 'none') {
        // 具备网络隔离能力（unshare netns），应真实执行
        expect(response.content).toContain('执行结果');
        expect(response.content).toContain('42');
      } else {
        // 无网络隔离能力（Windows、macOS、或 CI runner 禁用 user namespace），
        // CodeExecutorTool fail closed，Agent 捕获后返回"执行错误：…网络隔离…"，
        // 绝不退化到裸 node --permission
        expect(response.content).toContain('执行错误');
        expect(response.content).toContain('网络隔离');
      }
    });
  });
});
