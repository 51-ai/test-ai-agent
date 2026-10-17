/**
 * 数据分析模块 - Data Analysis Module
 * 
 * 功能：
 * 1. 数据管道处理
 * 2. 统计分析和聚合
 * 3. 图表数据生成
 * 4. 报表导出
 * 
 * @module core/analysis
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
  category?: string;
  tags?: Record<string, string>;
}

export interface TimeRange {
  start: number;
  end: number;
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

export interface ChartData {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'histogram';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
    borderColor?: string;
    backgroundColor?: string | string[];
  }>;
  options?: Record<string, any>;
}

export interface StatisticsResult {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  variance: number;
  stdDev: number;
  p25: number;
  p75: number;
}

export interface CorrelationResult {
  correlation: number;
  pValue: number;
  significant: boolean;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  score: number;
  threshold: number;
  explanation?: string;
}

export interface TrendAnalysisResult {
  trend: 'up' | 'down' | 'stable';
  slope: number;
  r2: number;
  forecast?: number[];
}

export interface FilterCondition {
  field: string;
  operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'contains' | 'in';
  value: any;
}

export interface DataQuery {
  source: string;
  filters?: FilterCondition[];
  timeRange?: TimeRange;
  groupBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  limit?: number;
  offset?: number;
}

// ==================== 数据管道处理器 ====================

export class DataPipeline extends EventEmitter {
  private stages: Array<(data: any[]) => Promise<any[]>> = [];

  use(stage: (data: any[]) => Promise<any[]>): this {
    this.stages.push(stage);
    return this;
  }

  async process(data: any[]): Promise<any[]> {
    let result = [...data];
    
    for (const stage of this.stages) {
      result = await stage(result);
      this.emit('stage:complete', { length: result.length });
    }
    
    this.emit('pipeline:complete', { length: result.length });
    return result;
  }

  clear(): void {
    this.stages = [];
  }
}

// ==================== 数据分析器 ====================

export class DataAnalyzer {
  /**
   * 计算统计指标
   */
  calculateStatistics(data: number[]): StatisticsResult {
    if (data.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        variance: 0,
        stdDev: 0,
        p25: 0,
        p75: 0
      };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const count = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const median = count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

    const p25 = sorted[Math.floor(count * 0.25)];
    const p75 = sorted[Math.floor(count * 0.75)];

    const variance = data.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return { count, sum, min, max, avg, median, variance, stdDev, p25, p75 };
  }

  /**
   * 计算相关系数
   */
  calculateCorrelation(x: number[], y: number[]): CorrelationResult {
    if (x.length !== y.length || x.length < 2) {
      return { correlation: 0, pValue: 1, significant: false };
    }

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denominatorX += dx * dx;
      denominatorY += dy * dy;
    }

    const correlation = numerator / (Math.sqrt(denominatorX) * Math.sqrt(denominatorY));
    
    const df = n - 2;
    const t = correlation * Math.sqrt(df / (1 - correlation * correlation));
    const pValue = this.calculatePValue(t, df);

    return {
      correlation,
      pValue,
      significant: pValue < 0.05
    };
  }

  private calculatePValue(t: number, df: number): number {
    const absT = Math.abs(t);
    let pValue = 0;
    
    if (df > 0) {
      const t2 = t * t;
      const term = 1 + t2 / df;
      const power = -(df + 1) / 2;
      pValue = Math.pow(term, power);
    }
    
    return Math.min(pValue * 2, 1);
  }

  /**
   * 异常检测
   */
  detectAnomaly(data: number[], value: number, threshold: number = 3): AnomalyDetectionResult {
    const stats = this.calculateStatistics(data);
    
    if (stats.stdDev === 0) {
      return { isAnomaly: false, score: 0, threshold };
    }

    const zScore = Math.abs((value - stats.avg) / stats.stdDev);
    const isAnomaly = zScore > threshold;

    return {
      isAnomaly,
      score: zScore,
      threshold,
      explanation: isAnomaly 
        ? `值偏离均值 ${zScore.toFixed(2)} 个标准差`
        : undefined
    };
  }

  /**
   * 趋势分析
   */
  analyzeTrend(data: number[], timestamps?: number[]): TrendAnalysisResult {
    if (data.length < 2) {
      return { trend: 'stable', slope: 0, r2: 0 };
    }

    const n = data.length;
    const x = timestamps ? timestamps : Array.from({ length: n }, (_, i) => i);
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = data.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      numerator += dx * (data[i] - meanY);
      denominator += dx * dx;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    let ssTotal = 0;
    let ssResidual = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      ssTotal += Math.pow(data[i] - meanY, 2);
      ssResidual += Math.pow(data[i] - predicted, 2);
    }

    const r2 = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

    const trend: 'up' | 'down' | 'stable' = 
      slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'stable';

    const forecast = this.forecast(data, slope, intercept, 5);

    return { trend, slope, r2, forecast };
  }

  private forecast(data: number[], slope: number, intercept: number, steps: number): number[] {
    const result: number[] = [];
    const lastIndex = data.length - 1;
    
    for (let i = 1; i <= steps; i++) {
      result.push(slope * (lastIndex + i) + intercept);
    }
    
    return result;
  }

  /**
   * 数据分组聚合
   */
  groupBy(data: any[], key: string, aggregation: (values: any[]) => any): Record<string, any> {
    return data.reduce((acc, item) => {
      const groupKey = item[key];
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * 数据过滤
   */
  filter(data: any[], conditions: FilterCondition[]): any[] {
    return data.filter(item => {
      return conditions.every(condition => {
        const fieldValue = item[condition.field];
        
        switch (condition.operator) {
          case '=': return fieldValue === condition.value;
          case '!=': return fieldValue !== condition.value;
          case '<': return fieldValue < condition.value;
          case '>': return fieldValue > condition.value;
          case '<=': return fieldValue <= condition.value;
          case '>=': return fieldValue >= condition.value;
          case 'contains': 
            return String(fieldValue).includes(String(condition.value));
          case 'in':
            return Array.isArray(condition.value) && condition.value.includes(fieldValue);
          default: return true;
        }
      });
    });
  }
}

// ==================== 图表生成器 ====================

export class ChartGenerator {
  private colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  /**
   * 生成折线图数据
   */
  generateLineChart(title: string, datasets: Array<{ label: string; data: number[] }>): ChartData {
    return {
      title,
      type: 'line',
      labels: datasets[0]?.data.map((_, i) => `点 ${i + 1}`) || [],
      datasets: datasets.map((ds, i) => ({
        ...ds,
        color: this.colors[i % this.colors.length],
        borderColor: this.colors[i % this.colors.length],
        backgroundColor: this.hexToRgba(this.colors[i % this.colors.length], 0.1)
      })),
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' as const },
          tooltip: { mode: 'index' as const, intersect: false }
        }
      }
    };
  }

  /**
   * 生成柱状图数据
   */
  generateBarChart(title: string, labels: string[], datasets: Array<{ label: string; data: number[] }>): ChartData {
    return {
      title,
      type: 'bar',
      labels,
      datasets: datasets.map((ds, i) => ({
        ...ds,
        color: this.colors[i % this.colors.length],
        backgroundColor: this.colors[i % this.colors.length]
      })),
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' as const } }
      }
    };
  }

  /**
   * 生成饼图数据
   */
  generatePieChart(title: string, labels: string[], values: number[]): ChartData {
    return {
      title,
      type: 'pie',
      labels,
      datasets: [{
        label: '数据',
        data: values,
        backgroundColor: this.colors.slice(0, labels.length)
      }],
      options: {
        responsive: true,
        plugins: { legend: { position: 'right' as const } }
      }
    };
  }

  /**
   * 生成面积图数据
   */
  generateAreaChart(title: string, datasets: Array<{ label: string; data: number[] }>): ChartData {
    return {
      title,
      type: 'area',
      labels: datasets[0]?.data.map((_, i) => `点 ${i + 1}`) || [],
      datasets: datasets.map((ds, i) => ({
        ...ds,
        color: this.colors[i % this.colors.length],
        borderColor: this.colors[i % this.colors.length],
        backgroundColor: this.hexToRgba(this.colors[i % this.colors.length], 0.2)
      }))
    };
  }

  /**
   * 生成直方图数据
   */
  generateHistogram(title: string, data: number[], bins: number = 10): ChartData {
    if (data.length === 0) {
      return { title, type: 'histogram', labels: [], datasets: [] };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const binWidth = range / bins || 1;

    const counts: number[] = new Array(bins).fill(0);
    const labels: string[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      labels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
      
      data.forEach(value => {
        if (value >= binStart && value < binEnd) {
          counts[i]++;
        }
      });
    }

    return {
      title,
      type: 'histogram',
      labels,
      datasets: [{
        label: '频率',
        data: counts,
        backgroundColor: '#3B82F6'
      }]
    };
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

// ==================== 报表生成器 ====================

export class ReportGenerator {
  async generateReport(data: any[], options?: {
    title?: string;
    format?: 'json' | 'csv' | 'markdown';
    includeStatistics?: boolean;
  }): Promise<string> {
    const { title = '数据分析报告', format = 'json', includeStatistics = true } = options || {};
    const timestamp = new Date().toISOString();

    const report: any = {
      title,
      generatedAt: timestamp,
      totalRecords: data.length,
      data
    };

    if (includeStatistics && data.length > 0 && typeof data[0] === 'number') {
      const analyzer = new DataAnalyzer();
      report.statistics = analyzer.calculateStatistics(data);
    }

    switch (format) {
      case 'csv':
        return this.toCSV(report);
      case 'markdown':
        return this.toMarkdown(report);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  private toCSV(report: any): string {
    const headers = ['字段1', '字段2', '字段3'];
    const rows = report.data.map((row: any) => 
      Array.isArray(row) ? row.join(',') : Object.values(row).join(','));
    
    return [headers.join(','), ...rows].join('\n');
  }

  private toMarkdown(report: any): string {
    let md = `# ${report.title}\n\n`;
    md += `生成时间: ${report.generatedAt}\n\n`;
    md += `记录总数: ${report.totalRecords}\n\n`;

    if (report.statistics) {
      md += '## 统计摘要\n\n';
      md += '| 指标 | 值 |\n';
      md += '|------|-----|\n';
      Object.entries(report.statistics).forEach(([key, value]) => {
        md += `| ${key} | ${typeof value === 'number' ? value.toFixed(2) : value} |\n`;
      });
      md += '\n';
    }

    md += '## 数据预览\n\n';
    md += '```json\n';
    md += JSON.stringify(report.data.slice(0, 10), null, 2);
    md += '\n```\n';

    return md;
  }
}

// ==================== 导出单例 ====================

export const dataAnalyzer = new DataAnalyzer();
export const chartGenerator = new ChartGenerator();
export const reportGenerator = new ReportGenerator();

export default {
  DataPipeline,
  DataAnalyzer,
  ChartGenerator,
  ReportGenerator,
  dataAnalyzer,
  chartGenerator,
  reportGenerator
};
