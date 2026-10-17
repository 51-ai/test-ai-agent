import { TestCase, EvaluationResult, OnlineEvaluationData, ABTestConfig, ABTestResult } from './types';
import { MetricsCalculator } from './MetricsCalculator';
import { OfflineEvaluator } from './OfflineEvaluator';
import { OnlineEvaluator } from './OnlineEvaluator';

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  history: number[];
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  createdAt: Date;
  lastRunAt?: Date;
  results?: EvaluationResult[];
}

export interface VisualizationData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
}

export class EvaluationSystem {
  private offlineEvaluator: OfflineEvaluator;
  private onlineEvaluator: OnlineEvaluator;
  private metricsCalculator: MetricsCalculator;
  private benchmarkSuites: Map<string, BenchmarkSuite> = new Map();
  private evaluationHistory: Array<{ timestamp: number; metrics: any }> = [];
  private performanceTrends: Map<string, PerformanceTrend> = new Map();

  constructor() {
    this.offlineEvaluator = new OfflineEvaluator();
    this.onlineEvaluator = new OnlineEvaluator();
    this.metricsCalculator = new MetricsCalculator();
  }

  async runOfflineEvaluation(
    testCases: TestCase[],
    executeFn: (input: string) => Promise<string>
  ): Promise<EvaluationResult[]> {
    this.offlineEvaluator.addTestCases(testCases);
    const results = await this.offlineEvaluator.evaluate(executeFn);
    this.trackEvaluationHistory(results);
    return results;
  }

  getOfflineResults(): EvaluationResult[] {
    return this.offlineEvaluator.getResults();
  }

  getOfflineMetrics() {
    return this.offlineEvaluator.getAggregatedMetrics();
  }

  recordOnlineEvaluation(data: OnlineEvaluationData): void {
    this.onlineEvaluator.recordEvaluation(data);
    this.trackEvaluationHistory([data as any]);
  }

  getOnlineStats() {
    return this.onlineEvaluator.getOnlineStats();
  }

  createABTest(config: ABTestConfig): void {
    this.onlineEvaluator.createABTest(config);
  }

  assignVariant(testId: string, userId: string): string {
    return this.onlineEvaluator.assignVariant(testId, userId);
  }

  recordABTestResult(
    testId: string,
    variantName: string,
    metrics: Record<string, number>
  ): void {
    this.onlineEvaluator.recordABTestResult(testId, variantName, metrics);
  }

  getABTestResults(testId: string): ABTestResult[] {
    return this.onlineEvaluator.getABTestResults(testId);
  }

  getABTestWinner(testId: string): string | null {
    return this.onlineEvaluator.getABTestWinner(testId);
  }

  createBenchmarkSuite(name: string, description: string, testCases: TestCase[]): BenchmarkSuite {
    const suite: BenchmarkSuite = {
      id: `benchmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      testCases,
      createdAt: new Date()
    };
    this.benchmarkSuites.set(suite.id, suite);
    return suite;
  }

  runBenchmarkSuite(suiteId: string, executeFn: (input: string) => Promise<string>): Promise<EvaluationResult[]> {
    const suite = this.benchmarkSuites.get(suiteId);
    if (!suite) {
      return Promise.reject(new Error(`Benchmark suite ${suiteId} not found`));
    }

    return this.runOfflineEvaluation(suite.testCases, executeFn).then(results => {
      suite.results = results;
      suite.lastRunAt = new Date();
      return results;
    });
  }

  getBenchmarkSuites(): BenchmarkSuite[] {
    return Array.from(this.benchmarkSuites.values());
  }

  getBenchmarkSuite(id: string): BenchmarkSuite | undefined {
    return this.benchmarkSuites.get(id);
  }

  compareBenchmarks(suiteId1: string, suiteId2: string): any {
    const suite1 = this.benchmarkSuites.get(suiteId1);
    const suite2 = this.benchmarkSuites.get(suiteId2);

    if (!suite1?.results || !suite2?.results) {
      throw new Error('One or both benchmark suites have not been run');
    }

    const metrics1 = this.metricsCalculator.aggregateResults(suite1.results);
    const metrics2 = this.metricsCalculator.aggregateResults(suite2.results);

    return {
      suite1: { name: suite1.name, metrics: metrics1 },
      suite2: { name: suite2.name, metrics: metrics2 },
      comparison: {
        accuracyDiff: metrics2.accuracy - metrics1.accuracy,
        f1Diff: metrics2.f1Score - metrics1.f1Score,
        responseTimeDiff: metrics2.responseTime - metrics1.responseTime
      }
    };
  }

  private trackEvaluationHistory(results: EvaluationResult[]): void {
    const aggregated = this.metricsCalculator.aggregateResults(results);
    this.evaluationHistory.push({
      timestamp: Date.now(),
      metrics: aggregated
    });

    if (this.evaluationHistory.length > 100) {
      this.evaluationHistory = this.evaluationHistory.slice(-100);
    }

    this.updatePerformanceTrends(aggregated);
  }

  private updatePerformanceTrends(currentMetrics: any): void {
    const metricKeys = Object.keys(currentMetrics).filter(k => typeof currentMetrics[k] === 'number');

    for (const key of metricKeys) {
      const history = this.evaluationHistory.map(h => h.metrics[key] as number);
      const current = currentMetrics[key];
      const previous = history.length > 1 ? history[history.length - 2] : current;

      const changePercent = previous !== 0
        ? ((current - previous) / previous) * 100
        : 0;

      let direction: 'improving' | 'declining' | 'stable' = 'stable';
      if (changePercent > 5) direction = 'improving';
      else if (changePercent < -5) direction = 'declining';

      this.performanceTrends.set(key, {
        metric: key,
        direction,
        changePercent: Math.round(changePercent * 100) / 100,
        history
      });
    }
  }

  getPerformanceTrends(): PerformanceTrend[] {
    return Array.from(this.performanceTrends.values());
  }

  getTrendForMetric(metricName: string): PerformanceTrend | undefined {
    return this.performanceTrends.get(metricName);
  }

  getEvaluationHistory(limit: number = 10): Array<{ timestamp: number; metrics: any }> {
    return this.evaluationHistory.slice(-limit);
  }

  generateTrendAnalysis(): {
    overallTrend: 'improving' | 'declining' | 'stable';
    improvingMetrics: string[];
    decliningMetrics: string[];
    stableMetrics: string[];
    recommendations: string[];
  } {
    const trends = this.getPerformanceTrends();
    const improvingMetrics = trends.filter(t => t.direction === 'improving').map(t => t.metric);
    const decliningMetrics = trends.filter(t => t.direction === 'declining').map(t => t.metric);
    const stableMetrics = trends.filter(t => t.direction === 'stable').map(t => t.metric);

    const recommendations: string[] = [];
    if (decliningMetrics.length > 0) {
      recommendations.push(`关注以下指标下降: ${decliningMetrics.join(', ')}`);
    }
    if (improvingMetrics.length > 0) {
      recommendations.push(`继续保持: ${improvingMetrics.join(', ')}`);
    }

    const overallTrend: 'improving' | 'declining' | 'stable' =
      improvingMetrics.length > decliningMetrics.length ? 'improving' :
      decliningMetrics.length > improvingMetrics.length ? 'declining' : 'stable';

    return {
      overallTrend,
      improvingMetrics,
      decliningMetrics,
      stableMetrics,
      recommendations
    };
  }

  generateVisualizationData(metricNames: string[]): VisualizationData {
    const labels = this.evaluationHistory.slice(-20).map((_, i) => `Eval ${i + 1}`);
    const datasets = metricNames.map(name => ({
      label: name,
      data: this.evaluationHistory.slice(-20).map(h => h.metrics[name] as number || 0),
      borderColor: this.getRandomColor(),
      backgroundColor: this.getRandomColor(0.1)
    }));

    return { labels, datasets };
  }

  private getRandomColor(alpha: number = 1): string {
    const r = Math.floor(Math.random() * 200);
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  generateDetailedReport(): {
    summary: any;
    trends: any;
    benchmarkComparison: any[];
    recommendations: string[];
    visualization: VisualizationData;
  } {
    const trends = this.generateTrendAnalysis();
    const benchmarkSuites = this.getBenchmarkSuites();
    const benchmarkComparison: any[] = [];

    if (benchmarkSuites.length >= 2) {
      for (let i = 0; i < benchmarkSuites.length - 1; i++) {
        if (benchmarkSuites[i].results && benchmarkSuites[i + 1].results) {
          benchmarkComparison.push(this.compareBenchmarks(
            benchmarkSuites[i].id,
            benchmarkSuites[i + 1].id
          ));
        }
      }
    }

    return {
      summary: {
        totalEvaluations: this.evaluationHistory.length,
        offlineResults: this.getOfflineResults().length,
        benchmarkSuites: benchmarkSuites.length
      },
      trends,
      benchmarkComparison,
      recommendations: trends.recommendations,
      visualization: this.generateVisualizationData(['accuracy', 'f1Score', 'taskCompletionRate'])
    };
  }

  generateReport() {
    const offlineMetrics = this.getOfflineMetrics();
    const onlineStats = this.getOnlineStats();

    return {
      offline: {
        results: this.getOfflineResults().length,
        metrics: offlineMetrics
      },
      online: onlineStats,
      abTests: Array.from(this.onlineEvaluator['abTests'].keys()),
      trends: this.generateTrendAnalysis()
    };
  }

  clearAllData(): void {
    this.offlineEvaluator.clearResults();
    this.offlineEvaluator.clearTestCases();
    this.onlineEvaluator.clearOnlineEvaluations();
    this.evaluationHistory = [];
    this.performanceTrends.clear();
  }
}
