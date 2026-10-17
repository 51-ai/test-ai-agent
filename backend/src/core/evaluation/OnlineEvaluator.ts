import { OnlineEvaluationData, ABTestConfig, ABTestResult } from './types';
import { MetricsCalculator } from './MetricsCalculator';

export class OnlineEvaluator {
  private evaluations: Map<string, OnlineEvaluationData> = new Map();
  private abTests: Map<string, ABTestConfig> = new Map();
  private abTestResults: Map<string, ABTestResult[]> = new Map();
  private metricsCalculator: MetricsCalculator;

  constructor() {
    this.metricsCalculator = new MetricsCalculator();
  }

  recordEvaluation(data: OnlineEvaluationData): void {
    this.evaluations.set(data.conversationId, data);
  }

  getOnlineEvaluations(): OnlineEvaluationData[] {
    return Array.from(this.evaluations.values());
  }

  getOnlineStats() {
    const evaluations = this.getOnlineEvaluations();
    const total = evaluations.length;

    if (total === 0) {
      return {
        totalConversations: 0,
        taskCompletionRate: 0,
        averageSatisfaction: 0,
        averageResponseTime: 0
      };
    }

    const taskCompletedCount = evaluations.filter(e => e.taskCompleted).length;
    const satisfactions = evaluations
      .filter(e => e.userFeedback?.rating !== undefined)
      .map(e => e.userFeedback!.rating!);

    const averageSatisfaction = satisfactions.length > 0
      ? satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length
      : 0;

    const averageResponseTime = evaluations
      .map(e => e.responseTime)
      .reduce((a, b) => a + b, 0) / total;

    return {
      totalConversations: total,
      taskCompletionRate: taskCompletedCount / total,
      averageSatisfaction,
      averageResponseTime
    };
  }

  createABTest(config: ABTestConfig): void {
    this.abTests.set(config.id, config);
    this.abTestResults.set(config.id, []);
  }

  assignVariant(testId: string, userId: string): string {
    const config = this.abTests.get(testId);
    if (!config) throw new Error(`A/B Test ${testId} not found`);

    const hash = this.hashUserId(userId);
    let cumulative = 0;

    for (const variant of config.variants) {
      cumulative += variant.percentage;
      if (hash < cumulative) {
        return variant.name;
      }
    }

    return config.variants[0].name;
  }

  recordABTestResult(
    testId: string,
    variantName: string,
    metrics: Record<string, number>
  ): void {
    const results = this.abTestResults.get(testId);
    if (!results) return;

    let variantResult = results.find(r => r.variantName === variantName);
    
    if (!variantResult) {
      variantResult = {
        testId,
        variantName,
        traffic: 0,
        metrics: {},
        sampleSize: 0
      };
      results.push(variantResult);
    }

    variantResult.sampleSize++;
    variantResult.traffic += 1;

    for (const [key, value] of Object.entries(metrics)) {
      if (variantResult.metrics[key] === undefined) {
        variantResult.metrics[key] = 0;
      }
      variantResult.metrics[key] = (
        variantResult.metrics[key] * (variantResult.sampleSize - 1) + value
      ) / variantResult.sampleSize;
    }
  }

  getABTestResults(testId: string): ABTestResult[] {
    return this.abTestResults.get(testId) || [];
  }

  getABTestWinner(testId: string): string | null {
    const results = this.abTestResults.get(testId);
    if (!results || results.length < 2) return null;

    const mainMetric = 'taskCompletionRate';
    let bestVariant: ABTestResult | null = null;

    for (const result of results) {
      if (result.sampleSize < 100) continue;

      if (!bestVariant || 
          (result.metrics[mainMetric] || 0) > (bestVariant.metrics[mainMetric] || 0)) {
        bestVariant = result;
      }
    }

    if (bestVariant) {
      bestVariant.winner = true;
    }

    return bestVariant?.variantName || null;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  clearOnlineEvaluations(): void {
    this.evaluations.clear();
  }
}
