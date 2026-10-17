/**
 * 分析引擎 - 深度数据分析和洞察
 */

export interface DataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesData {
  name: string;
  data: DataPoint[];
  unit?: string;
}

export interface AnalysisResult {
  type: string;
  insights: Insight[];
  metrics: Record<string, number>;
  recommendations: string[];
  confidence: number;
}

export interface Insight {
  type: 'trend' | 'anomaly' | 'correlation' | 'pattern' | 'warning';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  affectedMetrics?: string[];
  suggestedAction?: string;
}

export interface CorrelationResult {
  variable1: string;
  variable2: string;
  coefficient: number;
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'none';
  pValue?: number;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  intercept: number;
  rSquared: number;
  forecast?: Array<{ timestamp: Date; value: number; confidence: number }>;
}

export interface DistributionAnalysis {
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  quartiles: { q1: number; q2: number; q3: number };
  outliers: number[];
}

export interface ClusteringResult {
  clusters: Array<{
    id: number;
    centroid: number[];
    size: number;
    points: number[];
  }>;
  silhouetteScore: number;
}

export class AnalyticsEngine {
  private timeSeriesCache: Map<string, TimeSeriesData> = new Map();
  private maxCacheSize = 100;

  constructor() {}

  /**
   * 添加时间序列数据
   */
  addTimeSeries(name: string, data: DataPoint[], unit?: string): void {
    if (this.timeSeriesCache.size >= this.maxCacheSize) {
      // 删除最旧的数据
      const firstKey = this.timeSeriesCache.keys().next().value;
      if (firstKey) this.timeSeriesCache.delete(firstKey);
    }
    
    this.timeSeriesCache.set(name, { name, data, unit });
  }

  /**
   * 获取时间序列
   */
  getTimeSeries(name: string): TimeSeriesData | undefined {
    return this.timeSeriesCache.get(name);
  }

  /**
   * 分析趋势
   */
  analyzeTrend(data: number[]): TrendAnalysis {
    const n = data.length;
    if (n < 2) {
      return {
        direction: 'stable',
        slope: 0,
        intercept: data[0] || 0,
        rSquared: 0
      };
    }

    // 计算均值
    const mean = data.reduce((a, b) => a + b, 0) / n;
    
    // 计算线性回归
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 计算 R²
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssRes += (data[i] - predicted) ** 2;
      ssTot += (data[i] - mean) ** 2;
    }
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    
    // 确定趋势方向
    let direction: TrendAnalysis['direction'] = 'stable';
    if (slope > 0.1) direction = 'increasing';
    else if (slope < -0.1) direction = 'decreasing';
    else direction = 'stable';
    
    // 检测波动性
    const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;
    if (variance / (mean ** 2) > 0.5) direction = 'volatile';

    return { direction, slope, intercept, rSquared };
  }

  /**
   * 预测未来值
   */
  forecast(data: number[], periods: number = 5): Array<{ value: number; confidence: number }> {
    const trend = this.analyzeTrend(data);
    const forecasts: Array<{ value: number; confidence: number }> = [];
    
    const lastIndex = data.length - 1;
    const stdDev = this.calculateStdDev(data);
    
    for (let i = 1; i <= periods; i++) {
      const futureIndex = lastIndex + i;
      const predictedValue = trend.slope * futureIndex + trend.intercept;
      
      // 置信度随预测时间递减
      const confidence = Math.max(0.1, trend.rSquared * (1 - i / (periods * 2)));
      
      // 添加不确定性范围
      const uncertainty = stdDev * Math.sqrt(i) * 0.5;
      forecasts.push({
        value: predictedValue + (Math.random() - 0.5) * uncertainty,
        confidence
      });
    }
    
    return forecasts;
  }

  /**
   * 检测异常值
   */
  detectAnomalies(data: number[], threshold: number = 2): number[] {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const stdDev = this.calculateStdDev(data);
    const anomalies: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const zScore = Math.abs((data[i] - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push(i);
      }
    }
    
    return anomalies;
  }

  /**
   * 计算相关系数
   */
  calculateCorrelation(data1: number[], data2: number[]): CorrelationResult {
    const n = data1.length;
    if (n !== data2.length || n < 2) {
      return {
        variable1: 'data1',
        variable2: 'data2',
        coefficient: 0,
        strength: 'none',
        direction: 'none'
      };
    }

    const mean1 = data1.reduce((a, b) => a + b, 0) / n;
    const mean2 = data2.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0, denom1 = 0, denom2 = 0;
    for (let i = 0; i < n; i++) {
      const diff1 = data1[i] - mean1;
      const diff2 = data2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(denom1 * denom2);
    const coefficient = denominator === 0 ? 0 : numerator / denominator;
    
    let strength: CorrelationResult['strength'];
    let direction: CorrelationResult['direction'];
    
    const absCoef = Math.abs(coefficient);
    if (absCoef > 0.7) strength = 'strong';
    else if (absCoef > 0.4) strength = 'moderate';
    else if (absCoef > 0.1) strength = 'weak';
    else strength = 'none';
    
    direction = coefficient > 0 ? 'positive' : coefficient < 0 ? 'negative' : 'none';
    
    return {
      variable1: 'data1',
      variable2: 'data2',
      coefficient,
      strength,
      direction,
      pValue: this.calculatePValue(coefficient, n)
    };
  }

  /**
   * 分布分析
   */
  analyzeDistribution(data: number[]): DistributionAnalysis {
    const sorted = [...data].sort((a, b) => a - b);
    const n = data.length;
    
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
      : sorted[Math.floor(n / 2)];
    
    // 计算众数
    const freqMap = new Map<number, number>();
    for (const val of data) {
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    }
    let maxFreq = 0, mode = mean;
    for (const [val, freq] of freqMap) {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = val;
      }
    }
    
    const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    
    const q1Index = Math.floor(n * 0.25);
    const q2Index = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    
    // 检测异常值（使用IQR方法）
    const iqr = sorted[q3Index] - sorted[q1Index];
    const lowerBound = sorted[q1Index] - 1.5 * iqr;
    const upperBound = sorted[q3Index] + 1.5 * iqr;
    const outliers = sorted.filter(v => v < lowerBound || v > upperBound);
    
    return {
      mean,
      median,
      mode,
      stdDev,
      variance,
      min: sorted[0],
      max: sorted[n - 1],
      quartiles: {
        q1: sorted[q1Index],
        q2: sorted[q2Index],
        q3: sorted[q3Index]
      },
      outliers
    };
  }

  /**
   * 聚类分析（K-means简化版）
   */
  performClustering(data: number[][], k: number = 3): ClusteringResult {
    if (data.length < k) {
      return { clusters: [], silhouetteScore: 0 };
    }

    // 初始化质心
    const centroids: number[][] = [];
    const step = Math.floor(data.length / k);
    for (let i = 0; i < k; i++) {
      centroids.push([...data[i * step]]);
    }

    // 迭代更新
    const maxIterations = 100;
    let assignments: number[] = new Array(data.length).fill(0);
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // 分配到最近的质心
      const newAssignments = data.map(point => {
        let minDist = Infinity, cluster = 0;
        for (let c = 0; c < k; c++) {
          const dist = this.euclideanDistance(point, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            cluster = c;
          }
        }
        return cluster;
      });

      // 检查收敛
      if (newAssignments.every((a, i) => a === assignments[i])) {
        break;
      }
      assignments = newAssignments;

      // 更新质心
      for (let c = 0; c < k; c++) {
        const clusterPoints = data.filter((_, i) => assignments[i] === c);
        if (clusterPoints.length > 0) {
          centroids[c] = clusterPoints[0].map((_, dim) =>
            clusterPoints.reduce((sum, p) => sum + p[dim], 0) / clusterPoints.length
          );
        }
      }
    }

    // 构建结果
    const clusters = centroids.map((centroid, id) => ({
      id,
      centroid,
      size: assignments.filter(a => a === id).length,
      points: assignments.map((a, i) => a === id ? i : -1).filter(i => i >= 0)
    }));

    // 计算轮廓系数
    const silhouetteScore = this.calculateSilhouetteScore(data, assignments, centroids);

    return { clusters, silhouetteScore };
  }

  /**
   * 生成分析报告
   */
  generateReport(timeSeriesName: string): AnalysisResult {
    const timeSeries = this.timeSeriesCache.get(timeSeriesName);
    if (!timeSeries || timeSeries.data.length === 0) {
      return {
        type: 'basic',
        insights: [{
          type: 'warning',
          title: '数据不足',
          description: '时间序列数据为空或不存在',
          severity: 'warning'
        }],
        metrics: {},
        recommendations: ['请添加更多数据点'],
        confidence: 0
      };
    }

    const values = timeSeries.data.map(d => d.value);
    const insights: Insight[] = [];
    const metrics: Record<string, number> = {};
    const recommendations: string[] = [];

    // 基本统计
    const distribution = this.analyzeDistribution(values);
    metrics['mean'] = distribution.mean;
    metrics['median'] = distribution.median;
    metrics['stdDev'] = distribution.stdDev;
    metrics['min'] = distribution.min;
    metrics['max'] = distribution.max;

    // 趋势分析
    const trend = this.analyzeTrend(values);
    metrics['trendSlope'] = trend.slope;
    metrics['trendRSquared'] = trend.rSquared;

    if (trend.direction === 'increasing') {
      insights.push({
        type: 'trend',
        title: '上升趋势',
        description: `数据呈现稳定的上升趋势，斜率为 ${trend.slope.toFixed(4)}`,
        severity: 'info',
        affectedMetrics: [timeSeriesName]
      });
    } else if (trend.direction === 'decreasing') {
      insights.push({
        type: 'trend',
        title: '下降趋势',
        description: `数据呈现下降趋势，可能需要关注`,
        severity: 'warning',
        affectedMetrics: [timeSeriesName],
        suggestedAction: '分析下降原因'
      });
    }

    // 异常检测
    const anomalies = this.detectAnomalies(values);
    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        title: '检测到异常值',
        description: `发现 ${anomalies.length} 个异常数据点`,
        severity: anomalies.length > values.length * 0.1 ? 'critical' : 'warning',
        affectedMetrics: ['anomaly_count']
      });
    }

    // 波动性分析
    if (trend.direction === 'volatile') {
      insights.push({
        type: 'pattern',
        title: '高波动性',
        description: '数据波动较大，建议分析原因',
        severity: 'warning',
        suggestedAction: '识别波动来源'
      });
      recommendations.push('考虑使用平滑处理减少噪声');
    }

    // 计算置信度
    const confidence = Math.min(1, trend.rSquared * 0.5 + (1 - anomalies.length / values.length) * 0.5);

    return {
      type: 'comprehensive',
      insights,
      metrics,
      recommendations,
      confidence
    };
  }

  /**
   * 欧几里得距离
   */
  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  }

  /**
   * 计算标准差
   */
  private calculateStdDev(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length;
    return Math.sqrt(variance);
  }

  /**
   * 计算p值（简化版）
   */
  private calculatePValue(r: number, n: number): number {
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    return 2 * (1 - this.normalCDF(Math.abs(t)));
  }

  /**
   * 正态分布CDF（简化版）
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  /**
   * 计算轮廓系数
   */
  private calculateSilhouetteScore(
    data: number[][],
    assignments: number[],
    centroids: number[][]
  ): number {
    let totalSilhouette = 0;
    const n = data.length;
    
    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      const point = data[i];
      
      // 计算同簇平均距离
      let a = 0;
      let sameClusterCount = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i && assignments[j] === cluster) {
          a += this.euclideanDistance(point, data[j]);
          sameClusterCount++;
        }
      }
      a = sameClusterCount > 0 ? a / sameClusterCount : 0;
      
      // 计算最近异簇平均距离
      let b = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        if (c !== cluster) {
          let avgDist = 0;
          let count = 0;
          for (let j = 0; j < n; j++) {
            if (assignments[j] === c) {
              avgDist += this.euclideanDistance(point, data[j]);
              count++;
            }
          }
          if (count > 0) {
            avgDist /= count;
            b = Math.min(b, avgDist);
          }
        }
      }
      
      if (b === Infinity) b = 0;
      const s = a === 0 && b === 0 ? 0 : (b - a) / Math.max(a, b);
      totalSilhouette += s;
    }
    
    return totalSilhouette / n;
  }
}

export default AnalyticsEngine;
