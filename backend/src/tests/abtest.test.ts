import { describe, it, expect, beforeEach } from '@jest/globals';
import { ABTestEngine, type ABTestConfig } from '../core/evaluation/ABTestEngine';

describe('ABTestEngine', () => {
  let engine: ABTestEngine;

  beforeEach(() => {
    engine = new ABTestEngine();
  });

  function createTestConfig(name: string = '测试实验'): Omit<ABTestConfig, 'id' | 'status' | 'createdAt'> {
    return {
      name,
      description: '测试用A/B实验',
      variants: [
        {
          id: 'control_v1',
          name: 'control',
          description: '对照组',
          config: { model: 'base' },
          isControl: true,
          trafficWeight: 0.5
        },
        {
          id: 'variant_a',
          name: '实验组A',
          description: '实验组（优化版）',
          config: { model: 'enhanced' },
          isControl: false,
          trafficWeight: 0.5
        }
      ],
      metrics: ['conversion_rate', 'response_time'],
      trafficSplit: 50,
      minSampleSize: 100,
      maxDurationHours: 72,
      createdBy: 'test_user'
    };
  }

  describe('createTest', () => {
    it('应成功创建测试', () => {
      const config = createTestConfig();
      const test = engine.createTest(config);
      expect(test.id).toContain('abtest_');
      expect(test.status).toBe('draft');
      expect(test.variants.length).toBe(2);
    });
  });

  describe('startTest', () => {
    it('应从draft状态启动', () => {
      const test = engine.createTest(createTestConfig());
      const started = engine.startTest(test.id);
      expect(started).toBe(true);
      const updated = engine.getTest(test.id);
      expect(updated?.status).toBe('running');
    });

    it('不应启动非draft状态的测试', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      const restarted = engine.startTest(test.id);
      expect(restarted).toBe(false);
    });
  });

  describe('pauseTest / completeTest / rollbackTest', () => {
    it('应暂停运行中的测试', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      const paused = engine.pauseTest(test.id);
      expect(paused).toBe(true);
      expect(engine.getTest(test.id)?.status).toBe('paused');
    });

    it('应完成测试并生成结果', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      // 需要一些数据才能生成结果
      const result = engine.completeTest(test.id);
      expect(engine.getTest(test.id)?.status).toBe('completed');
    });

    it('应回滚测试', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      const rolled = engine.rollbackTest(test.id);
      expect(rolled).toBe(true);
      expect(engine.getTest(test.id)?.status).toBe('rolled_back');
    });
  });

  describe('assignVariant', () => {
    it('应为用户分配变体', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      const variant = engine.assignVariant(test.id, 'user123');
      expect(variant).not.toBeNull();
      expect(variant!.id).toBeDefined();
    });

    it('同用户重复分配应返回相同变体', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      const first = engine.assignVariant(test.id, 'user123');
      const second = engine.assignVariant(test.id, 'user123');
      expect(first?.id).toBe(second?.id);
    });

    it('应返回用户的所有分配记录', () => {
      const test1 = engine.createTest(createTestConfig('实验1'));
      const test2 = engine.createTest(createTestConfig('实验2'));
      engine.startTest(test1.id);
      engine.startTest(test2.id);
      engine.assignVariant(test1.id, 'user1');
      engine.assignVariant(test2.id, 'user1');
      const assignments = engine.getUserAssignments('user1');
      expect(assignments.length).toBe(2);
    });
  });

  describe('recordMetric / getTestMetrics', () => {
    it('应记录和检索指标数据', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);

      // 记录一些数据
      for (let i = 0; i < 100; i++) {
        engine.recordMetric(test.id, 'control_v1', 'conversion_rate', Math.random());
        engine.recordMetric(test.id, 'variant_a', 'conversion_rate', Math.random() * 1.1);
      }

      const metrics = engine.getTestMetrics(test.id);
      expect(metrics.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateResults (via completeTest)', () => {
    it('应包含统计显著性分析', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);

      // 对照组: 均值0.5, 实验组: 均值0.6 (有提升)
      for (let i = 0; i < 50; i++) {
        engine.recordMetric(test.id, 'control_v1', 'conversion_rate', 0.5 + (Math.random() - 0.5) * 0.2);
        engine.recordMetric(test.id, 'variant_a', 'conversion_rate', 0.6 + (Math.random() - 0.5) * 0.2);
      }

      const result = engine.completeTest(test.id);
      expect(result).not.toBeNull();
      expect(result!.comparisonResults.length).toBeGreaterThan(0);

      const firstComparison = result!.comparisonResults[0];
      expect(firstComparison.pValue).toBeDefined();
      expect(firstComparison.effectSize).toBeDefined();
      expect(firstComparison.confidenceInterval).toHaveLength(2);
    });
  });

  describe('getStats / getAllTests / getActiveTests', () => {
    it('应返回统计信息', () => {
      engine.createTest(createTestConfig('测试A'));
      engine.createTest(createTestConfig('测试B'));
      const stats = engine.getStats();
      expect(stats.totalTests).toBe(2);
      expect(stats.activeTests).toBe(0);
    });

    it('应列出所有测试', () => {
      engine.createTest(createTestConfig());
      expect(engine.getAllTests().length).toBe(1);
    });

    it('应列出活跃测试', () => {
      const test = engine.createTest(createTestConfig());
      engine.startTest(test.id);
      expect(engine.getActiveTests().length).toBe(1);
    });
  });

  describe('traffic split 边界测试', () => {
    it('5%流量分配应有大部分用户入对照组', () => {
      const config = { ...createTestConfig(), trafficSplit: 5 as const };
      const test = engine.createTest(config);
      engine.startTest(test.id);

      let controlCount = 0;
      const total = 200;
      for (let i = 0; i < total; i++) {
        const v = engine.assignVariant(test.id, `user_${i}`);
        if (v?.isControl) controlCount++;
      }
      // 大部分应在对照组 (约95%)
      expect(controlCount).toBeGreaterThan(total * 0.5);
    });
  });
});
