import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExecutionEngine } from '../core/execution/ExecutionEngine';

describe('ExecutionEngine', () => {
  let executionEngine: ExecutionEngine;

  beforeEach(() => {
    executionEngine = new ExecutionEngine();
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const executor = {
        execute: async (toolId: string, parameters: Record<string, any>) => ({ success: true })
      };
      executionEngine.registerTool('test_tool', executor);
      expect(() => executionEngine.getToolSuccessRate('test_tool')).not.toThrow();
    });
  });

  describe('execute', () => {
    it('should execute registered tool', async () => {
      const executor = {
        execute: async (toolId: string, parameters: Record<string, any>) => ({ result: parameters })
      };
      executionEngine.registerTool('test_tool', executor);
      
      const result = await executionEngine.execute({ toolName: 'test_tool', parameters: { test: 'value' } }, 'task1');
      expect(result.success).toBe(true);
    });

    it('should fail for unknown tool', async () => {
      const result = await executionEngine.execute({ toolName: 'unknown_tool', parameters: {} }, 'task1');
      expect(result.success).toBe(false);
    });
  });

  describe('getToolSuccessRate', () => {
    it('should return success rate', () => {
      const executor = {
        execute: async (toolId: string, parameters: Record<string, any>) => ({ success: true })
      };
      executionEngine.registerTool('test_tool', executor);
      expect(executionEngine.getToolSuccessRate('test_tool')).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for unknown tool', () => {
      expect(executionEngine.getToolSuccessRate('unknown')).toBe(0);
    });
  });

  describe('getAllToolSuccessRates — 仪表盘聚合', () => {
    it('按工具聚合真实成败分布并按调用数排序', async () => {
      const okExecutor = {
        execute: async () => ({ success: true })
      };
      // execute() 以"是否抛异常"判定成败，返回 {success:false} 不算失败，必须真抛
      const badExecutor = {
        execute: async () => { throw new Error('boom'); }
      };
      executionEngine.registerTool('good_tool', okExecutor);
      executionEngine.registerTool('bad_tool', badExecutor);

      await executionEngine.execute({ toolName: 'good_tool', parameters: {} }, 't1');
      await executionEngine.execute({ toolName: 'good_tool', parameters: {} }, 't2');
      // 显式 retries: 0，跳过默认 3 次重试的指数退避延迟
      await executionEngine.execute({ toolName: 'bad_tool', parameters: {}, retries: 0 }, 't3');

      const stats = executionEngine.getAllToolSuccessRates();
      expect(stats).toHaveLength(2);

      // 按调用数降序：good_tool(2) 在前
      expect(stats[0].toolName).toBe('good_tool');
      expect(stats[0].total).toBe(2);
      expect(stats[0].completed).toBe(2);
      expect(stats[0].successRate).toBe(1);

      expect(stats[1].toolName).toBe('bad_tool');
      expect(stats[1].failed).toBe(1);
      expect(stats[1].successRate).toBe(0);
    });

    it('无执行记录时返回空数组', () => {
      expect(new ExecutionEngine().getAllToolSuccessRates()).toEqual([]);
    });
  });
});