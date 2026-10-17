import { describe, it, expect, beforeEach } from '@jest/globals';
import { DialogueEvaluator } from '../core/agent-core/DialogueEvaluator';

describe('DialogueEvaluator', () => {
  let evaluator: DialogueEvaluator;

  beforeEach(() => {
    evaluator = new DialogueEvaluator();
  });

  describe('evaluateDialogueQuality', () => {
    it('应为高相关性回答打高分', () => {
      const score = evaluator.evaluateDialogueQuality(
        'user1',
        '如何学习Python编程',
        '学习Python可以从基础语法开始，建议先掌握变量、循环、函数等核心概念，然后通过实际项目练习。可以参考官方文档和在线教程。',
        'search'
      );
      expect(score.overall).toBeGreaterThan(5);
      expect(score.relevance).toBeGreaterThan(5);
      expect(score.usefulness).toBeGreaterThanOrEqual(1);
    });

    it('应为低质量回答打低分', () => {
      const score = evaluator.evaluateDialogueQuality(
        'user1',
        '帮我计算圆的面积',
        '嗯，可能大概这个我不太清楚，不确定。',
        'calculate'
      );
      expect(score.accuracy).toBeLessThan(7);
    });

    it('应根据意图识别相关性', () => {
      const score = evaluator.evaluateDialogueQuality(
        'user1',
        '今天天气怎么样',
        '根据最新天气预报，今天天气晴朗，温度适宜，适合外出活动。',
        'weather'
      );
      expect(score.overall).toBeGreaterThanOrEqual(1);
      expect(score.relevance).toBeGreaterThanOrEqual(1);
    });

    it('应检测不完整回答', () => {
      const score = evaluator.evaluateDialogueQuality(
        'user1',
        '什么是机器学习？深度学习呢？',
        '机器学习是AI的一个分支。',
        'explain'
      );
      // 有两个问号但回答较短，completeness 应较低
      expect(score.completeness).toBeLessThanOrEqual(8);
    });

    it('应生成评分理由', () => {
      const score = evaluator.evaluateDialogueQuality(
        'user1',
        '帮我写一封邮件',
        '好的，这里是一封专业邮件的模板，您可以根据需要修改。根据您的需求，建议使用正式语气。例如：尊敬的XX，您好！...',
        'write'
      );
      expect(score.reasoning.length).toBeGreaterThan(0);
      expect(score.improvementSuggestions).toBeDefined();
    });

    it('应处理空意图参数', () => {
      const score = evaluator.evaluateDialogueQuality(
        'user1',
        '随便聊聊',
        '当然可以，你想聊什么呢？'
      );
      expect(score.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeDialogueFlow', () => {
    it('应检测话题切换', () => {
      const analysis = evaluator.analyzeDialogueFlow(
        'user1',
        '帮我写一段代码',
        'technology'
      );
      expect(analysis.topicSwitchDetected).toBeDefined();
      expect(analysis.dialoguePhase).toBeDefined();
    });

    it('应识别不同对话阶段', () => {
      const greeting = evaluator.analyzeDialogueFlow('user1', '你好');
      expect(greeting.dialoguePhase).toBe('greeting');

      const question = evaluator.analyzeDialogueFlow('user1', '怎么使用这个功能？');
      expect(question.dialoguePhase).toBe('problem_understanding');

      const closing = evaluator.analyzeDialogueFlow('user1', '再见');
      expect(closing.dialoguePhase).toBe('closing');
    });

    it('应为不同阶段推荐不同策略', () => {
      const greeting = evaluator.analyzeDialogueFlow('user1', '你好');
      expect(greeting.recommendedResponseStrategy).toBe('warm_welcome');

      const problem = evaluator.analyzeDialogueFlow('user1', '怎么解决这个问题？');
      expect(problem.recommendedResponseStrategy).toBe('clarify_and_confirm');
    });

    it('应有流畅度评分', () => {
      const analysis = evaluator.analyzeDialogueFlow('user1', '继续说');
      expect(analysis.flowCoherenceScore).toBeGreaterThanOrEqual(1);
      expect(analysis.flowCoherenceScore).toBeLessThanOrEqual(10);
    });
  });

  describe('getAverageQualityScore', () => {
    it('无历史时应返回null', () => {
      const avg = evaluator.getAverageQualityScore('new_user');
      expect(avg).toBeNull();
    });

    it('有历史时应返回平均值', () => {
      evaluator.evaluateDialogueQuality('user1', '问题1', '回答1');
      evaluator.evaluateDialogueQuality('user1', '问题2', '回答2');
      const avg = evaluator.getAverageQualityScore('user1');
      expect(avg).not.toBeNull();
      expect(avg!.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getQualityTrend', () => {
    it('应返回质量趋势', () => {
      evaluator.evaluateDialogueQuality('user1', 'Q1', 'A1');
      const trend = evaluator.getQualityTrend('user1', 'daily');
      expect(trend.userId).toBe('user1');
      expect(['improving', 'stable', 'declining']).toContain(trend.trend);
    });
  });

  describe('getStats', () => {
    it('应统计评估数量', () => {
      evaluator.evaluateDialogueQuality('user1', 'Q', 'A');
      evaluator.evaluateDialogueQuality('user2', 'Q', 'A');
      const stats = evaluator.getStats();
      expect(stats.usersTracked).toBeGreaterThanOrEqual(1);
      expect(stats.totalEvaluations).toBeGreaterThanOrEqual(2);
    });
  });
});
