/**
 * A/B 测试引擎
 * 支持流量分组（5%/10%/50%/100%）、统计显著性分析、结果可视化
 */

import { v4 as uuidv4 } from 'uuid';

// === A/B 测试相关类型 ===
export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'rolled_back';
export type TrafficSplit = 5 | 10 | 25 | 50 | 75 | 100;

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  status: ABTestStatus;
  variants: ABTestVariant[];
  metrics: string[];            // 要追踪的指标
  trafficSplit: TrafficSplit;   // 实验组流量百分比
  minSampleSize: number;        // 最小样本量
  maxDurationHours: number;     // 最大运行时间
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface ABTestVariant {
  id: string;
  name: string;         // 'control' | 'variant_a' | 'variant_b'
  description: string;
  config: Record<string, unknown>;  // 变体特定配置
  isControl: boolean;
  trafficWeight: number;  // 0-1，该变体在实验组中的权重
}

export interface ABTestAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: Date;
}

export interface ABTestMetrics {
  testId: string;
  variantId: string;
  sampleSize: number;
  metrics: Record<string, {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    p95: number;
  }>;
  lastUpdated: Date;
}

export interface ABTestResult {
  testId: string;
  controlVariantId: string;
  comparisonResults: Array<{
    variantId: string;
    metricName: string;
    controlMean: number;
    variantMean: number;
    relativeChange: number;     // 相对变化百分比
    pValue: number;             // 统计显著性
    isSignificant: boolean;     // p < 0.05
    confidenceInterval: [number, number];  // 95% CI
    effectSize: number;         // Cohen's d
    recommendation: 'adopt' | 'investigate' | 'reject';
  }>;
  overallRecommendation: string;
  generatedAt: Date;
}

const LOG_PREFIX = '[ABTestEngine]';

/**
 * A/B 测试引擎
 */
export class ABTestEngine {
  private tests = new Map<string, ABTestConfig>();
  private assignments = new Map<string, ABTestAssignment[]>(); // userId -> assignments
  private metrics = new Map<string, Map<string, number[]>>(); // testId:variantId -> values
  private metricObservations = new Map<string, Map<string, Array<{ value: number; timestamp: Date }>>>();

  /**
   * 创建 A/B 测试
   */
  createTest(config: Omit<ABTestConfig, 'id' | 'status' | 'createdAt'>): ABTestConfig {
    const test: ABTestConfig = {
      ...config,
      id: `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      status: 'draft',
      createdAt: new Date()
    };

    this.tests.set(test.id, test);
    console.log(`${LOG_PREFIX} [TEST_CREATED] id=${test.id}, name=${test.name}`);
    return test;
  }

  /**
   * 启动测试
   */
  startTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'draft') return false;

    test.status = 'running';
    test.startTime = new Date();
    this.tests.set(testId, test);

    console.log(`${LOG_PREFIX} [TEST_STARTED] id=${testId}, split=${test.trafficSplit}%`);
    return true;
  }

  /**
   * 暂停测试
   */
  pauseTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return false;
    test.status = 'paused';
    this.tests.set(testId, test);
    return true;
  }

  /**
   * 完成测试
   */
  completeTest(testId: string): ABTestResult | null {
    const test = this.tests.get(testId);
    if (!test) return null;

    test.status = 'completed';
    test.endTime = new Date();
    this.tests.set(testId, test);

    const result = this.generateResults(testId);
    console.log(`${LOG_PREFIX} [TEST_COMPLETED] id=${testId}`);
    return result;
  }

  /**
   * 回滚测试
   */
  rollbackTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test) return false;
    test.status = 'rolled_back';
    test.endTime = new Date();
    this.tests.set(testId, test);
    return true;
  }

  /**
   * 为用户分配变体
   */
  assignVariant(testId: string, userId: string): ABTestVariant | null {
    const test = this.tests.get(testId);
    if (!test || (test.status !== 'running' && test.status !== 'draft')) return null;

    // 检查是否已分配
    const userAssignments = this.assignments.get(userId) || [];
    const existing = userAssignments.find(a => a.testId === testId);
    if (existing) {
      const variant = test.variants.find(v => v.id === existing.variantId);
      if (variant) return variant;
    }

    // 流量分配：trafficSplit% 的用户进入实验组
    const inExperiment = Math.random() * 100 < test.trafficSplit;

    let selectedVariant: ABTestVariant;
    if (inExperiment) {
      // 按权重随机选择实验变体
      const nonControlVariants = test.variants.filter(v => !v.isControl);
      if (nonControlVariants.length === 0) {
        selectedVariant = test.variants.find(v => v.isControl) || test.variants[0];
      } else {
        const totalWeight = nonControlVariants.reduce((s, v) => s + v.trafficWeight, 0);
        let r = Math.random() * totalWeight;
        selectedVariant = nonControlVariants[0];
        for (const variant of nonControlVariants) {
          r -= variant.trafficWeight;
          if (r <= 0) {
            selectedVariant = variant;
            break;
          }
        }
      }
    } else {
      // 对照组
      selectedVariant = test.variants.find(v => v.isControl) || test.variants[0];
    }

    // 记录分配
    const assignment: ABTestAssignment = {
      userId,
      testId,
      variantId: selectedVariant.id,
      assignedAt: new Date()
    };

    const currentAssignments = this.assignments.get(userId) || [];
    currentAssignments.push(assignment);
    this.assignments.set(userId, currentAssignments);

    console.log(`${LOG_PREFIX} [ASSIGNED] test=${testId}, user=${userId}, variant=${selectedVariant.name}`);
    return selectedVariant;
  }

  /**
   * 记录指标数据
   */
  recordMetric(testId: string, variantId: string, metricName: string, value: number): void {
    // 存储原始值
    const key = `${testId}:${variantId}`;
    let variantMetrics = this.metrics.get(key);
    if (!variantMetrics) {
      variantMetrics = new Map();
      this.metrics.set(key, variantMetrics);
    }
    let values = variantMetrics.get(metricName) || [];
    values.push(value);
    variantMetrics.set(metricName, values);

    // 存储带时间戳的观测
    let observations = this.metricObservations.get(testId);
    if (!observations) {
      observations = new Map();
      this.metricObservations.set(testId, observations);
    }
    let variantObservations = observations.get(variantId);
    if (!variantObservations) {
      variantObservations = [];
      observations.set(variantId, variantObservations);
    }
    variantObservations.push({ value, timestamp: new Date() });
  }

  /**
   * 获取测试指标
   */
  getTestMetrics(testId: string): ABTestMetrics[] {
    const test = this.tests.get(testId);
    if (!test) return [];

    const results: ABTestMetrics[] = [];

    for (const variant of test.variants) {
      const key = `${testId}:${variant.id}`;
      const variantMetrics = this.metrics.get(key);
      if (!variantMetrics) continue;

      const metricsResult: ABTestMetrics['metrics'] = {};

      for (const [metricName, values] of variantMetrics.entries()) {
        if (values.length === 0) continue;
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const p95Index = Math.ceil(values.length * 0.95) - 1;

        metricsResult[metricName] = {
          mean: Math.round(mean * 1000) / 1000,
          stdDev: Math.round(Math.sqrt(variance) * 1000) / 1000,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p95: sorted[Math.max(0, p95Index)]
        };
      }

      results.push({
        testId,
        variantId: variant.id,
        sampleSize: variantMetrics.values().next().value?.length || 0,
        metrics: metricsResult,
        lastUpdated: new Date()
      });
    }

    return results;
  }

  /**
   * 生成测试结果（含统计显著性分析）
   */
  private generateResults(testId: string): ABTestResult | null {
    const test = this.tests.get(testId);
    if (!test) return null;

    const controlVariant = test.variants.find(v => v.isControl);
    if (!controlVariant) return null;

    const comparisonResults: ABTestResult['comparisonResults'] = [];

    for (const variant of test.variants) {
      if (variant.id === controlVariant.id) continue;

      for (const metricName of test.metrics) {
        const controlKey = `${testId}:${controlVariant.id}`;
        const variantKey = `${testId}:${variant.id}`;

        const controlValues = this.metrics.get(controlKey)?.get(metricName) || [];
        const variantValues = this.metrics.get(variantKey)?.get(metricName) || [];

        if (controlValues.length < 2 || variantValues.length < 2) continue;

        const controlMean = controlValues.reduce((s, v) => s + v, 0) / controlValues.length;
        const variantMean = variantValues.reduce((s, v) => s + v, 0) / variantValues.length;

        // 相对变化
        const relativeChange = controlMean !== 0
          ? ((variantMean - controlMean) / Math.abs(controlMean)) * 100
          : 0;

        // Welch's t-test（不等方差 t 检验）
        const { pValue, effectSize } = this.welchTTest(controlValues, variantValues);

        // 95% 置信区间
        const confidenceInterval = this.calculateConfidenceInterval(
          variantMean, variantValues, 0.95
        );

        const isSignificant = pValue < 0.05;
        let recommendation: ABTestResult['comparisonResults'][0]['recommendation'];

        if (isSignificant && relativeChange > 2) {
          recommendation = 'adopt';
        } else if (isSignificant && relativeChange > 0) {
          recommendation = 'investigate';
        } else if (isSignificant && relativeChange < -2) {
          recommendation = 'reject';
        } else {
          recommendation = 'investigate';
        }

        comparisonResults.push({
          variantId: variant.id,
          metricName,
          controlMean: Math.round(controlMean * 1000) / 1000,
          variantMean: Math.round(variantMean * 1000) / 1000,
          relativeChange: Math.round(relativeChange * 100) / 100,
          pValue: Math.round(pValue * 10000) / 10000,
          isSignificant,
          confidenceInterval: [
            Math.round(confidenceInterval[0] * 1000) / 1000,
            Math.round(confidenceInterval[1] * 1000) / 1000
          ],
          effectSize: Math.round(effectSize * 1000) / 1000,
          recommendation
        });
      }
    }

    // 生成总体建议
    const significantImprovements = comparisonResults.filter(r => r.recommendation === 'adopt').length;
    const significantDeclines = comparisonResults.filter(r => r.recommendation === 'reject').length;

    let overallRecommendation: string;
    if (significantImprovements > significantDeclines) {
      overallRecommendation = '推荐采用实验变体，多个指标有显著提升';
    } else if (significantDeclines > significantImprovements) {
      overallRecommendation = '不推荐采用，实验变体在多个指标上表现更差';
    } else if (comparisonResults.length === 0) {
      overallRecommendation = '样本量不足，需要继续收集数据';
    } else {
      overallRecommendation = '实验变体与对照组无显著差异，建议增加样本量或调整实验方案';
    }

    return {
      testId,
      controlVariantId: controlVariant.id,
      comparisonResults,
      overallRecommendation,
      generatedAt: new Date()
    };
  }

  /**
   * Welch's t-test（不等方差）
   */
  private welchTTest(
    sample1: number[],
    sample2: number[]
  ): { tStatistic: number; pValue: number; effectSize: number } {
    const n1 = sample1.length;
    const n2 = sample2.length;

    const mean1 = sample1.reduce((s, v) => s + v, 0) / n1;
    const mean2 = sample2.reduce((s, v) => s + v, 0) / n2;

    const var1 = sample1.reduce((s, v) => s + (v - mean1) ** 2, 0) / (n1 - 1);
    const var2 = sample2.reduce((s, v) => s + (v - mean2) ** 2, 0) / (n2 - 1);

    const se = Math.sqrt(var1 / n1 + var2 / n2);
    const tStatistic = (mean1 - mean2) / (se || 1e-10);

    // Welch-Satterthwaite 自由度
    const dfNum = (var1 / n1 + var2 / n2) ** 2;
    const dfDen = (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1);
    const df = dfDen > 0 ? dfNum / dfDen : n1 + n2 - 2;

    // 简化 p-value 计算（使用正态近似）
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStatistic)));

    // Cohen's d 效应量
    const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
    const effectSize = Math.abs(mean1 - mean2) / (pooledStd || 1e-10);

    return { tStatistic, pValue, effectSize };
  }

  /**
   * 标准正态分布 CDF（近似）
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * 计算置信区间
   */
  private calculateConfidenceInterval(
    mean: number,
    values: number[],
    confidence: number = 0.95
  ): [number, number] {
    const n = values.length;
    if (n < 2) return [mean, mean];

    const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
    const zScore = 1.96; // 95% confidence

    const margin = zScore * stdDev / Math.sqrt(n);
    return [mean - margin, mean + margin];
  }

  // ==================== 查询接口 ====================

  getAllTests(): ABTestConfig[] {
    return Array.from(this.tests.values());
  }

  getTest(testId: string): ABTestConfig | undefined {
    return this.tests.get(testId);
  }

  getUserAssignments(userId: string): ABTestAssignment[] {
    return this.assignments.get(userId) || [];
  }

  getActiveTests(): ABTestConfig[] {
    return Array.from(this.tests.values()).filter(t => t.status === 'running');
  }

  // ==================== 统计 ====================

  getStats() {
    const allTests = Array.from(this.tests.values());
    return {
      totalTests: allTests.length,
      activeTests: allTests.filter(t => t.status === 'running').length,
      completedTests: allTests.filter(t => t.status === 'completed').length,
      totalAssignments: Array.from(this.assignments.values()).reduce((s, a) => s + a.length, 0),
      uniqueUsers: this.assignments.size
    };
  }
}
