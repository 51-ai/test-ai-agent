import { TestCase, EvaluationResult, OnlineEvaluationData } from './types';
import { MetricsCalculator, StatisticalSignificance } from './MetricsCalculator';

export interface CrossValidationResult {
  fold: number;
  metrics: ReturnType<MetricsCalculator['aggregateResults']>;
  passed: boolean;
}

export interface BatchEvaluationConfig {
  batchSize: number;
  parallel: boolean;
  stopOnFirstFailure: boolean;
}

export interface OfflineEvaluationReport {
  totalTestCases: number;
  passed: number;
  failed: number;
  successRate: number;
  metrics: ReturnType<MetricsCalculator['aggregateResults']>;
  advancedMetrics: ReturnType<MetricsCalculator['calculateAdvancedMetrics']>;
  confidenceInterval: { lower: number; upper: number; mean: number };
  duration: number;
  timestamp: Date;
}

export class OfflineEvaluator {
  private testCases: Map<string, TestCase> = new Map();
  private results: EvaluationResult[] = [];
  private metricsCalculator: MetricsCalculator;
  private evaluationReports: OfflineEvaluationReport[] = [];

  constructor() {
    this.metricsCalculator = new MetricsCalculator();
  }

  addTestCase(testCase: TestCase): void {
    this.testCases.set(testCase.id, testCase);
  }

  addTestCases(testCases: TestCase[]): void {
    for (const testCase of testCases) {
      this.testCases.set(testCase.id, testCase);
    }
  }

  async evaluate(
    executeFn: (input: string) => Promise<string>
  ): Promise<EvaluationResult[]> {
    const evaluationResults: EvaluationResult[] = [];

    for (const testCase of this.testCases.values()) {
      const startTime = Date.now();

      try {
        const actualOutput = await executeFn(testCase.input);
        const executionTime = (Date.now() - startTime) / 1000;

        const metrics = this.metricsCalculator.calculateMetrics(
          testCase.input,
          actualOutput,
          testCase.expectedOutput,
          executionTime
        );

        const passed = this.metricsCalculator.isPassing(actualOutput, testCase.expectedOutput);

        const result: EvaluationResult = {
          testCaseId: testCase.id,
          input: testCase.input,
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          passed,
          metrics,
          timestamp: new Date(),
          executionTime
        };

        evaluationResults.push(result);
        this.results.push(result);
      } catch (error) {
        const executionTime = (Date.now() - startTime) / 1000;

        const result: EvaluationResult = {
          testCaseId: testCase.id,
          input: testCase.input,
          actualOutput: '',
          expectedOutput: testCase.expectedOutput,
          passed: false,
          metrics: {
            taskCompletionRate: 0,
            accuracy: 0,
            recallRate: 0,
            precision: 0,
            f1Score: 0,
            responseTime: executionTime,
            hallucinationRate: 1
          },
          timestamp: new Date(),
          executionTime,
          errors: [error instanceof Error ? error.message : String(error)]
        };

        evaluationResults.push(result);
        this.results.push(result);
      }
    }

    return evaluationResults;
  }

  getResults(): EvaluationResult[] {
    return [...this.results];
  }

  getAggregatedMetrics() {
    return this.metricsCalculator.aggregateResults(this.results);
  }

  getTestCases(): TestCase[] {
    return Array.from(this.testCases.values());
  }

  clearResults(): void {
    this.results = [];
  }

  clearTestCases(): void {
    this.testCases.clear();
  }
}
