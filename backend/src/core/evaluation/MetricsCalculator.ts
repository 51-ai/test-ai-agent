import { TestCase, EvaluationMetrics, EvaluationResult, DetailedEvaluationMetrics } from './types';

export interface AdvancedMetrics {
  auc?: number;
  rmse?: number;
  mae?: number;
  bleu?: number;
  rougeL?: number;
  rouge1?: number;
  rouge2?: number;
  meteor?: number;
  cider?: number;
  bertScore?: number;
}

export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

export interface StatisticalSignificance {
  metricName: string;
  controlValue: number;
  treatmentValue: number;
  zScore: number;
  pValue: number;
  significant: boolean;
  confidenceLevel: number;
}

export interface EvaluationBatch {
  id: string;
  testCases: TestCase[];
  results: EvaluationResult[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
}

export interface CrossValidationResult {
  folds: Array<{
    foldIndex: number;
    metrics: EvaluationMetrics;
    testCases: TestCase[];
  }>;
  averageMetrics: EvaluationMetrics;
  varianceMetrics: Record<string, number>;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number;
  };
}

export interface ABTestResult {
  controlMetrics: EvaluationMetrics;
  treatmentMetrics: EvaluationMetrics;
  improvement: Record<string, number>;
  statisticalSignificance: StatisticalSignificance[];
  recommendation: string;
  sampleSize: { control: number; treatment: number };
}

export class MetricsCalculator {
  calculateMetrics(
    input: string,
    actualOutput: string,
    expectedOutput: string,
    executionTime: number
  ): EvaluationMetrics {
    const accuracy = this.calculateAccuracy(actualOutput, expectedOutput);
    const passed = this.isPassing(actualOutput, expectedOutput);

    return {
      taskCompletionRate: passed ? 1 : 0,
      accuracy,
      recallRate: this.calculateRecall(actualOutput, expectedOutput),
      precision: this.calculatePrecision(actualOutput, expectedOutput),
      f1Score: this.calculateF1Score(actualOutput, expectedOutput),
      responseTime: executionTime,
      hallucinationRate: this.detectHallucination(actualOutput, expectedOutput)
    };
  }

  calculateDetailedMetrics(
    input: string,
    actualOutput: string,
    expectedOutput: string,
    executionTime: number
  ): DetailedEvaluationMetrics {
    const baseMetrics = this.calculateMetrics(input, actualOutput, expectedOutput, executionTime);
    
    return {
      ...baseMetrics,
      relevanceScore: this.calculateRelevance(input, actualOutput),
      coherenceScore: this.calculateCoherence(actualOutput),
      safetyScore: this.calculateSafetyScore(actualOutput),
      creativityScore: this.calculateCreativityScore(actualOutput),
      helpfulnessScore: this.calculateHelpfulnessScore(actualOutput),
      clarityScore: this.calculateClarityScore(actualOutput)
    };
  }

  calculateRelevance(input: string, actualOutput: string): number {
    const inputKeywords = input.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const outputLower = actualOutput.toLowerCase();
    
    if (inputKeywords.length === 0) return 0.5;
    
    const relevantKeywords = inputKeywords.filter(keyword => 
      outputLower.includes(keyword)
    );
    
    return relevantKeywords.length / inputKeywords.length;
  }

  calculateCoherence(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    let coherenceScore = 0;
    const connectors = ['and', 'but', 'so', 'because', 'however', 'therefore', 'thus', 'then', 'next', 'finally', 'also', '此外', '而且', '但是', '因此', '所以', '然后'];
    
    for (const sentence of sentences) {
      const hasConnector = connectors.some(connector => 
        sentence.toLowerCase().includes(connector.toLowerCase())
      );
      if (hasConnector) coherenceScore += 0.1;
    }
    
    const sentenceLengthScore = Math.min(sentences.length / 5, 1) * 0.3;
    const flowScore = Math.min(coherenceScore, 0.7);
    
    return Math.min(sentenceLengthScore + flowScore, 1);
  }

  calculateSafetyScore(text: string): number {
    const unsafeKeywords = [
      'kill', 'murder', 'suicide', 'attack', 'bomb', 'terrorist',
      'hate', 'racist', 'discriminate', 'violence', 'harm',
      '杀死', '谋杀', '自杀', '攻击', '炸弹', '恐怖分子',
      '仇恨', '种族主义', '歧视', '暴力', '伤害'
    ];
    
    const textLower = text.toLowerCase();
    let unsafeCount = 0;
    
    for (const keyword of unsafeKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        unsafeCount++;
      }
    }
    
    return Math.max(1 - unsafeCount * 0.2, 0);
  }

  calculateCreativityScore(text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = new Set(words);
    
    const diversityScore = words.length > 0 ? uniqueWords.size / words.length : 0;
    const lengthScore = Math.min(text.length / 200, 1);
    
    return (diversityScore * 0.6 + lengthScore * 0.4);
  }

  calculateHelpfulnessScore(text: string): number {
    const helpfulKeywords = [
      'help', 'guide', 'step', 'how to', 'you can', 'try',
      'recommend', 'suggest', 'example', 'important', 'note',
      '帮助', '指南', '步骤', '如何', '你可以', '尝试',
      '推荐', '建议', '示例', '重要', '注意'
    ];
    
    const textLower = text.toLowerCase();
    let helpfulCount = 0;
    
    for (const keyword of helpfulKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        helpfulCount++;
      }
    }
    
    return Math.min(helpfulCount * 0.15 + 0.3, 1);
  }

  calculateClarityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let clarityScore = 0.5;
    
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length >= 3 && words.length <= 20) {
        clarityScore += 0.1;
      }
    }
    
    const hasStructure = text.includes('\n') || text.includes('- ') || text.includes('1.');
    if (hasStructure) clarityScore += 0.2;
    
    return Math.min(clarityScore, 1);
  }

  calculateAccuracy(actual: string, expected: string): number {
    const actualLower = actual.toLowerCase();
    const expectedLower = expected.toLowerCase();

    if (actualLower === expectedLower) return 1.0;

    const expectedKeywords = expectedLower.split(/\s+/).filter(w => w.length > 2);
    const matchingKeywords = expectedKeywords.filter(keyword => 
      actualLower.includes(keyword)
    );

    return matchingKeywords.length / Math.max(expectedKeywords.length, 1);
  }

  calculateRecall(actual: string, expected: string): number {
    const expectedKeywords = expected.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const actualLower = actual.toLowerCase();

    const foundKeywords = expectedKeywords.filter(keyword => 
      actualLower.includes(keyword)
    );

    return foundKeywords.length / Math.max(expectedKeywords.length, 1);
  }

  calculatePrecision(actual: string, expected: string): number {
    const actualKeywords = actual.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const expectedLower = expected.toLowerCase();

    const relevantKeywords = actualKeywords.filter(keyword => 
      expectedLower.includes(keyword)
    );

    return actualKeywords.length > 0 ? relevantKeywords.length / actualKeywords.length : 0;
  }

  calculateF1Score(actual: string, expected: string): number {
    const precision = this.calculatePrecision(actual, expected);
    const recall = this.calculateRecall(actual, expected);

    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  isPassing(actual: string, expected: string): boolean {
    const accuracy = this.calculateAccuracy(actual, expected);
    return accuracy >= 0.6;
  }

  detectHallucination(actual: string, expected: string): number {
    const actualKeywords = actual.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const expectedLower = expected.toLowerCase();

    const hallucinatedKeywords = actualKeywords.filter(keyword => 
      !expectedLower.includes(keyword)
    );

    return actualKeywords.length > 0 ? hallucinatedKeywords.length / actualKeywords.length : 0;
  }

  aggregateResults(results: EvaluationResult[]): EvaluationMetrics {
    if (results.length === 0) {
      return {
        taskCompletionRate: 0,
        accuracy: 0,
        recallRate: 0,
        precision: 0,
        f1Score: 0,
        responseTime: 0,
        hallucinationRate: 0
      };
    }

    const total = results.length;
    const metricsSums: Omit<EvaluationMetrics, 'userSatisfaction'> = {
      taskCompletionRate: 0,
      accuracy: 0,
      recallRate: 0,
      precision: 0,
      f1Score: 0,
      responseTime: 0,
      hallucinationRate: 0
    };

    for (const result of results) {
      metricsSums.taskCompletionRate += result.metrics.taskCompletionRate;
      metricsSums.accuracy += result.metrics.accuracy;
      metricsSums.recallRate += result.metrics.recallRate;
      metricsSums.precision += result.metrics.precision;
      metricsSums.f1Score += result.metrics.f1Score;
      metricsSums.responseTime += result.metrics.responseTime;
      metricsSums.hallucinationRate += result.metrics.hallucinationRate;
    }

    return {
      taskCompletionRate: metricsSums.taskCompletionRate / total,
      accuracy: metricsSums.accuracy / total,
      recallRate: metricsSums.recallRate / total,
      precision: metricsSums.precision / total,
      f1Score: metricsSums.f1Score / total,
      responseTime: metricsSums.responseTime / total,
      hallucinationRate: metricsSums.hallucinationRate / total
    };
  }

  aggregateDetailedMetrics(results: Array<{ metrics: DetailedEvaluationMetrics }>): DetailedEvaluationMetrics {
    if (results.length === 0) {
      return {
        taskCompletionRate: 0,
        accuracy: 0,
        recallRate: 0,
        precision: 0,
        f1Score: 0,
        responseTime: 0,
        hallucinationRate: 0,
        relevanceScore: 0,
        coherenceScore: 0,
        safetyScore: 0,
        creativityScore: 0,
        helpfulnessScore: 0,
        clarityScore: 0
      };
    }

    const total = results.length;
    const sums: any = {};
    
    const firstResult = results[0].metrics;
    for (const key of Object.keys(firstResult)) {
      sums[key] = 0;
    }

    for (const result of results) {
      for (const [key, value] of Object.entries(result.metrics)) {
        if (typeof value === 'number') {
          sums[key] = (sums[key] || 0) + value;
        }
      }
    }

    const aggregated: any = {};
    for (const key of Object.keys(sums)) {
      aggregated[key] = sums[key] / total;
    }

    return aggregated as DetailedEvaluationMetrics;
  }

  // ==================== 高级指标计算 ====================

  calculateRMSE(predictions: number[], actuals: number[]): number {
    if (predictions.length !== actuals.length || predictions.length === 0) {
      return 0;
    }
    const squaredDiffs = predictions.map((pred, i) => Math.pow(pred - actuals[i], 2));
    const meanSquaredError = squaredDiffs.reduce((a, b) => a + b, 0) / predictions.length;
    return Math.sqrt(meanSquaredError);
  }

  calculateMAE(predictions: number[], actuals: number[]): number {
    if (predictions.length !== actuals.length || predictions.length === 0) {
      return 0;
    }
    const absoluteDiffs = predictions.map((pred, i) => Math.abs(pred - actuals[i]));
    return absoluteDiffs.reduce((a, b) => a + b, 0) / predictions.length;
  }

  calculateAUC(predictions: number[], labels: number[]): number {
    if (predictions.length !== labels.length || predictions.length === 0) {
      return 0;
    }

    const pairs: Array<{ score: number; label: number }> = predictions.map((score, i) => ({
      score,
      label: labels[i]
    }));

    pairs.sort((a, b) => b.score - a.score);

    let positiveCount = 0;
    for (const pair of pairs) {
      if (pair.label === 1) positiveCount++;
    }

    if (positiveCount === 0 || positiveCount === pairs.length) {
      return 1.0;
    }

    let truePositives = 0;
    let falsePositives = 0;
    let auc = 0;

    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].label === 1) {
        truePositives++;
      } else {
        falsePositives++;
        auc += truePositives;
      }
    }

    const totalNegatives = pairs.length - positiveCount;
    return totalNegatives > 0 ? auc / (positiveCount * totalNegatives) : 0;
  }

  calculateBLEU(reference: string, candidate: string, nGram: number = 4): number {
    const referenceTokens = reference.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const candidateTokens = candidate.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    if (candidateTokens.length === 0) return 0;

    const referenceNGrams = this.getNGrams(referenceTokens, nGram);
    const candidateNGramsMap = this.getNGrams(candidateTokens, nGram);

    let matches = 0;
    let totalCandidateNGrams = candidateNGramsMap.size;

    for (const [ngramKey, count] of candidateNGramsMap) {
      if (referenceNGrams.has(ngramKey)) {
        matches++;
        const refCount = referenceNGrams.get(ngramKey);
        if (refCount !== undefined && refCount > 0) {
          referenceNGrams.set(ngramKey, refCount - 1);
          if (refCount - 1 <= 0) {
            referenceNGrams.delete(ngramKey);
          }
        }
      }
    }

    const precision = totalCandidateNGrams > 0 ? matches / totalCandidateNGrams : 0;
    if (precision === 0) return 0;

    const referenceLength = referenceTokens.length;
    const candidateLength = candidateTokens.length;
    let brevityPenalty = 1;

    if (candidateLength < referenceLength) {
      brevityPenalty = Math.exp(1 - referenceLength / candidateLength);
    }

    return brevityPenalty * Math.exp(precision);
  }

  private getNGrams(tokens: string[], n: number): Map<string, number> {
    const nGrams = new Map<string, number>();
    for (let i = 0; i <= tokens.length - n; i++) {
      const nGram = tokens.slice(i, i + n).join(' ');
      nGrams.set(nGram, (nGrams.get(nGram) || 0) + 1);
    }
    return nGrams;
  }

  calculateROUGE(reference: string, candidate: string, type: 'rouge1' | 'rouge2' | 'rougeL' = 'rougeL'): number {
    const referenceTokens = reference.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const candidateTokens = candidate.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    if (candidateTokens.length === 0 || referenceTokens.length === 0) {
      return 0;
    }

    if (type === 'rouge1') {
      return this.calculateRougeN(referenceTokens, candidateTokens, 1);
    } else if (type === 'rouge2') {
      return this.calculateRougeN(referenceTokens, candidateTokens, 2);
    } else {
      return this.calculateRougeL(referenceTokens, candidateTokens);
    }
  }

  private calculateRougeN(referenceTokens: string[], candidateTokens: string[], n: number): number {
    const referenceNGrams = this.getNGrams(referenceTokens, n);
    const candidateNGrams = this.getNGrams(candidateTokens, n);

    let matches = 0;
    for (const [nGram, count] of candidateNGrams) {
      const refCount = referenceNGrams.get(nGram) || 0;
      matches += Math.min(count, refCount);
    }

    const totalCandidateNGrams = candidateNGrams.size;
    return totalCandidateNGrams > 0 ? matches / totalCandidateNGrams : 0;
  }

  private calculateRougeL(referenceTokens: string[], candidateTokens: string[]): number {
    const m = referenceTokens.length;
    const n = candidateTokens.length;

    if (m === 0 || n === 0) return 0;

    const lcsMatrix: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (referenceTokens[i - 1] === candidateTokens[j - 1]) {
          lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1;
        } else {
          lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1]);
        }
      }
    }

    const lcsLength = lcsMatrix[m][n];
    const precision = lcsLength / n;
    const recall = lcsLength / m;

    return (2 * precision * recall) / (precision + recall) || 0;
  }

  calculateConfusionMatrix(predictions: boolean[], actuals: boolean[]): ConfusionMatrix {
    if (predictions.length !== actuals.length || predictions.length === 0) {
      return { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0 };
    }

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] && actuals[i]) truePositives++;
      else if (predictions[i] && !actuals[i]) falsePositives++;
      else if (!predictions[i] && !actuals[i]) trueNegatives++;
      else falseNegatives++;
    }

    return { truePositives, falsePositives, trueNegatives, falseNegatives };
  }

  calculateAdvancedMetrics(results: EvaluationResult[]): AdvancedMetrics {
    const predictions = results.map(r => r.passed ? 1 : 0);
    const actuals = results.map(r => this.isCorrect(r) ? 1 : 0);

    const scores = results.map(r => r.metrics.f1Score);
    const avgScores = results.map(() => 0.8);

    let bleuSum = 0;
    let rougeLSum = 0;
    for (const result of results) {
      bleuSum += this.calculateBLEU(result.expectedOutput, result.actualOutput);
      rougeLSum += this.calculateROUGE(result.expectedOutput, result.actualOutput, 'rougeL');
    }

    return {
      auc: this.calculateAUC(scores, actuals),
      rmse: this.calculateRMSE(scores, avgScores),
      mae: this.calculateMAE(scores, avgScores),
      bleu: bleuSum / results.length,
      rougeL: rougeLSum / results.length,
      rouge1: this.calculateROUGE(results[0]?.expectedOutput || '', results[0]?.actualOutput || '', 'rouge1'),
      rouge2: this.calculateROUGE(results[0]?.expectedOutput || '', results[0]?.actualOutput || '', 'rouge2')
    };
  }

  private isCorrect(result: EvaluationResult): boolean {
    return result.passed;
  }

  // ==================== 统计显著性检验 ====================

  statisticalSignificanceTest(
    controlResults: number[],
    treatmentResults: number[],
    metricName: string,
    confidenceLevel: number = 0.95
  ): StatisticalSignificance {
    const controlMean = controlResults.reduce((a, b) => a + b, 0) / controlResults.length;
    const treatmentMean = treatmentResults.reduce((a, b) => a + b, 0) / treatmentResults.length;

    const controlVariance = this.calculateVariance(controlResults, controlMean);
    const treatmentVariance = this.calculateVariance(treatmentResults, treatmentMean);

    const n1 = controlResults.length;
    const n2 = treatmentResults.length;

    const pooledStdError = Math.sqrt((controlVariance / n1) + (treatmentVariance / n2));

    let zScore = 0;
    if (pooledStdError > 0) {
      zScore = (treatmentMean - controlMean) / pooledStdError;
    }

    const pValue = this.normalCDF(Math.abs(zScore));

    return {
      metricName,
      controlValue: controlMean,
      treatmentValue: treatmentMean,
      zScore,
      pValue: 2 * (1 - pValue),
      significant: pValue < (1 - confidenceLevel),
      confidenceLevel
    };
  }

  private calculateVariance(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

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

  calculateConfidenceInterval(values: number[], confidenceLevel: number = 0.95): { lower: number; upper: number; mean: number } {
    if (values.length === 0) {
      return { lower: 0, upper: 0, mean: 0 };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = this.calculateVariance(values, mean);
    const stdError = Math.sqrt(variance / values.length);

    const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;

    return {
      lower: mean - zScore * stdError,
      upper: mean + zScore * stdError,
      mean
    };
  }

  calculatePercentiles(values: number[], percentiles: number[] = [25, 50, 75, 90, 95, 99]): Map<number, number> {
    const sorted = [...values].sort((a, b) => a - b);
    const result = new Map<number, number>();

    for (const p of percentiles) {
      const index = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);

      if (lower === upper) {
        result.set(p, sorted[lower]);
      } else {
        const fraction = index - lower;
        result.set(p, sorted[lower] + fraction * (sorted[upper] - sorted[lower]));
      }
    }

    return result;
  }
}
