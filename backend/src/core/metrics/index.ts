/**
 * 指标分析模块 - Metrics Module
 * 
 * 功能：
 * 1. 收集和聚合系统运行指标
 * 2. 提供多维度数据分析
 * 3. 生成趋势报告和可视化数据
 * 4. 支持自定义指标和告警阈值
 * 
 * @module core/metrics
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

export interface MetricConfig {
  name: string;
  description?: string;
  unit?: string;
  aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count';
  retentionPeriod?: number; // 毫秒
  maxDataPoints?: number;
}

export interface MetricSnapshot {
  name: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  min: number;
  max: number;
  avg: number;
}

export interface TimeSeriesData {
  metric: string;
  startTime: number;
  endTime: number;
  interval: number;
  dataPoints: MetricDataPoint[];
  stats: {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  };
}

// ==================== 单个指标类 ====================

export class Metric {
  private config: MetricConfig;
  private dataPoints: MetricDataPoint[] = [];
  private eventEmitter: EventEmitter;

  constructor(config: MetricConfig, eventEmitter?: EventEmitter) {
    this.config = config;
    this.eventEmitter = eventEmitter || new EventEmitter();
    this.cleanup();
  }

  /**
   * 记录一个指标数据点
   */
  record(value: number, tags?: Record<string, string>): void {
    const dataPoint: MetricDataPoint = {
      timestamp: Date.now(),
      value,
      tags
    };

    this.dataPoints.push(dataPoint);

    // 触发更新事件
    this.eventEmitter.emit('metric:update', {
      metric: this.config.name,
      value,
      timestamp: dataPoint.timestamp
    });

    // 清理过期数据
    this.cleanup();
  }

  /**
   * 递增计数器
   */
  increment(amount: number = 1, tags?: Record<string, string>): void {
    this.record(amount, tags);
  }

  /**
   * 获取时间序列数据
   */
  getTimeSeries(startTime?: number, endTime?: number): MetricDataPoint[] {
    const start = startTime || Date.now() - 3600000; // 默认最近1小时
    const end = endTime || Date.now();

    return this.dataPoints.filter(
      dp => dp.timestamp >= start && dp.timestamp <= end
    );
  }

  /**
   * 获取聚合值
   */
  getAggregatedValue(type?: string): number {
    const aggregationType = type || this.config.aggregationType;
    const values = this.dataPoints.map(dp => dp.value);

    if (values.length === 0) return 0;

    switch (aggregationType) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return values[values.length - 1];
    }
  }

  /**
   * 获取指标快照
   */
  getSnapshot(periodMs: number = 60000): MetricSnapshot {
    const now = Date.now();
    const periodData = this.getTimeSeries(now - periodMs, now);
    const previousPeriodData = this.getTimeSeries(now - periodMs * 2, now - periodMs);

    const current = this.getAggregatedValue();
    const previous = previousPeriodData.length > 0
      ? previousPeriodData.reduce((a, b) => a + b.value, 0) / previousPeriodData.length
      : 0;

    const change = current - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

    const allValues = periodData.map(dp => dp.value);
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const max = allValues.length > 0 ? Math.max(...allValues) : 0;
    const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'up' : 'down';
    }

    return {
      name: this.config.name,
      current,
      previous,
      change,
      changePercent,
      trend,
      min,
      max,
      avg
    };
  }

  /**
   * 获取完整时间序列数据
   */
  getFullTimeSeries(startTime: number, endTime: number, interval: number = 60000): TimeSeriesData {
    const dataPoints = this.getTimeSeries(startTime, endTime);
    const values = dataPoints.map(dp => dp.value);

    return {
      metric: this.config.name,
      startTime,
      endTime,
      interval,
      dataPoints,
      stats: {
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
        avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        sum: values.length > 0 ? values.reduce((a, b) => a + b, 0) : 0,
        count: values.length
      }
    };
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    if (!this.config.retentionPeriod) return;

    const cutoff = Date.now() - this.config.retentionPeriod;
    this.dataPoints = this.dataPoints.filter(dp => dp.timestamp > cutoff);

    // 强制限制最大数据点数量
    if (this.config.maxDataPoints && this.dataPoints.length > this.config.maxDataPoints) {
      this.dataPoints = this.dataPoints.slice(-this.config.maxDataPoints);
    }
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.dataPoints = [];
  }

  /**
   * 获取配置
   */
  getConfig(): MetricConfig {
    return { ...this.config };
  }
}

// ==================== 指标管理器 ====================

export class MetricsManager {
  private metrics: Map<string, Metric> = new Map();
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  /**
   * 注册新指标
   */
  registerMetric(config: MetricConfig): Metric {
    if (this.metrics.has(config.name)) {
      throw new Error(`Metric '${config.name}' already exists`);
    }

    const metric = new Metric(config, this.eventEmitter);
    this.metrics.set(config.name, metric);
    
    this.eventEmitter.emit('metric:registered', config);
    
    return metric;
  }

  /**
   * 获取指标
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * 获取或创建指标
   */
  getOrCreateMetric(config: MetricConfig): Metric {
    const existing = this.metrics.get(config.name);
    if (existing) return existing;
    return this.registerMetric(config);
  }

  /**
   * 记录指标值（快捷方法）
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    let metric = this.metrics.get(name);
    
    if (!metric) {
      metric = this.registerMetric({
        name,
        aggregationType: 'avg',
        retentionPeriod: 3600000, // 1小时
        maxDataPoints: 10000
      });
    }
    
    metric.record(value, tags);
  }

  /**
   * 批量记录指标
   */
  recordBatch(records: Array<{ name: string; value: number; tags?: Record<string, string> }>): void {
    records.forEach(record => this.record(record.name, record.value, record.tags));
  }

  /**
   * 获取所有指标快照
   */
  getAllSnapshots(periodMs: number = 60000): MetricSnapshot[] {
    return Array.from(this.metrics.values()).map(metric => metric.getSnapshot(periodMs));
  }

  /**
   * 获取时间序列数据
   */
  getTimeSeriesData(metricName: string, startTime: number, endTime: number, interval?: number): TimeSeriesData | null {
    const metric = this.metrics.get(metricName);
    if (!metric) return null;
    
    return metric.getFullTimeSeries(startTime, endTime, interval);
  }

  /**
   * 获取所有指标名称
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * 获取指标数量
   */
  getMetricCount(): number {
    return this.metrics.size;
  }

  /**
   * 删除指标
   */
  removeMetric(name: string): boolean {
    const deleted = this.metrics.delete(name);
    if (deleted) {
      this.eventEmitter.emit('metric:removed', { name });
    }
    return deleted;
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics.clear();
    this.eventEmitter.emit('metrics:cleared');
  }

  /**
   * 订阅指标更新
   */
  onUpdate(callback: (data: { metric: string; value: number; timestamp: number }) => void): void {
    this.eventEmitter.on('metric:update', callback);
  }

  /**
   * 订阅指标注册
   */
  onRegister(callback: (config: MetricConfig) => void): void {
    this.eventEmitter.on('metric:registered', callback);
  }

  /**
   * 导出所有指标数据
   */
  exportAll(startTime: number, endTime: number): Record<string, TimeSeriesData> {
    const result: Record<string, TimeSeriesData> = {};
    
    this.metrics.forEach((metric, name) => {
      result[name] = metric.getFullTimeSeries(startTime, endTime);
    });
    
    return result;
  }
}

// ==================== 预定义指标工厂 ====================

export const createSystemMetrics = (manager: MetricsManager): void => {
  // 响应时间指标
  manager.registerMetric({
    name: 'response_time',
    description: 'API响应时间（毫秒）',
    unit: 'ms',
    aggregationType: 'avg',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });

  // 请求计数指标
  manager.registerMetric({
    name: 'request_count',
    description: 'API请求总数',
    unit: 'count',
    aggregationType: 'sum',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });

  // 错误率指标
  manager.registerMetric({
    name: 'error_rate',
    description: '错误率（百分比）',
    unit: '%',
    aggregationType: 'avg',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });

  // CPU使用率指标
  manager.registerMetric({
    name: 'cpu_usage',
    description: 'CPU使用率',
    unit: '%',
    aggregationType: 'avg',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });

  // 内存使用率指标
  manager.registerMetric({
    name: 'memory_usage',
    description: '内存使用率',
    unit: '%',
    aggregationType: 'avg',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });

  // RL训练指标
  manager.registerMetric({
    name: 'rl_reward',
    description: '强化学习奖励值',
    unit: 'score',
    aggregationType: 'avg',
    retentionPeriod: 86400000, // 24小时
    maxDataPoints: 50000
  });

  manager.registerMetric({
    name: 'rl_loss',
    description: '强化学习损失值',
    unit: 'loss',
    aggregationType: 'avg',
    retentionPeriod: 86400000,
    maxDataPoints: 50000
  });

  // RAG检索指标
  manager.registerMetric({
    name: 'rag_latency',
    description: 'RAG检索延迟（毫秒）',
    unit: 'ms',
    aggregationType: 'avg',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });

  manager.registerMetric({
    name: 'rag_accuracy',
    description: 'RAG检索准确率',
    unit: '%',
    aggregationType: 'avg',
    retentionPeriod: 3600000,
    maxDataPoints: 10000
  });
};

// ==================== 导出单例 ====================

export const metricsManager = new MetricsManager();

// 初始化预定义系统指标
createSystemMetrics(metricsManager);

export default MetricsManager;
