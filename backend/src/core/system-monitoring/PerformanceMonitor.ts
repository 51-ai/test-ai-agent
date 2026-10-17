import { Metric, PerformanceMetrics, BehaviorMetrics } from './types';
import { v4 as uuidv4 } from 'uuid';

export class PerformanceMonitor {
  private metrics: Map<string, Metric[]> = new Map();
  private maxHistorySize = 1000;
  private requestTimes: number[] = [];
  private successCount = 0;
  private errorCount = 0;
  private totalRequests = 0;
  private startTime = Date.now();

  recordMetric(name: string, value: number, success?: boolean, metadata?: Record<string, unknown>): void;
  recordMetric(metric: Metric): void;
  recordMetric(nameOrMetric: string | Metric, value?: number, success?: boolean, metadata?: Record<string, unknown>): void {
    let metric: Metric;
    if (typeof nameOrMetric === 'object') {
      metric = nameOrMetric;
    } else {
      metric = {
        id: uuidv4(),
        name: nameOrMetric as string,
        value: value || 0,
        timestamp: new Date(),
        success: success !== undefined ? success : true,
        metadata
      } as unknown as Metric;
    }

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const history = this.metrics.get(metric.name)!;
    history.push(metric);

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  recordRequestLatency(latencyMs: number): void {
    this.requestTimes.push(latencyMs);
    this.totalRequests++;

    if (this.requestTimes.length > 10000) {
      this.requestTimes.shift();
    }
  }

  recordSuccess(): void {
    this.successCount++;
  }

  recordError(): void {
    this.errorCount++;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const count = sorted.length;

    let latency = {
      p50: count > 0 ? (sorted[Math.floor(count * 0.5)] || 0) : 0,
      p95: count > 0 ? (sorted[Math.floor(count * 0.95)] || 0) : 0,
      p99: count > 0 ? (sorted[Math.floor(count * 0.99)] || 0) : 0,
      average: count > 0 ? sorted.reduce((a, b) => a + b, 0) / count : 0,
      max: count > 0 ? sorted[sorted.length - 1] : 0
    };

    const total = this.successCount + this.errorCount;
    const errorRate = total > 0 ? this.errorCount / total : 0;
    const successRate = total > 0 ? this.successCount / total : 1;

    const runtimeMinutes = (Date.now() - this.startTime) / 1000 / 60;
    const throughput = runtimeMinutes > 0 ? this.totalRequests / runtimeMinutes : 0;

    return {
      latency,
      throughput,
      errorRate,
      successRate,
      uptime: (Date.now() - this.startTime) / 1000,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  getMetricHistory(name: string, limit: number = 100): Metric[] {
    const history = this.metrics.get(name) || [];
    return history.slice(-limit);
  }

  getMetricsSummary() {
    const summary: Record<string, { latest: number | null; avg: number; count: number }> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        const avg = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        summary[name] = {
          latest: latest?.value || null,
          avg,
          count: metrics.length
        };
      }
    }

    return summary;
  }

  getStats(name: string) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return { count: 0, avg: 0, min: 0, max: 0 };
    
    const values = metrics.map(m => m.value);
    return {
      count: metrics.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  getAllMetrics() {
    return {
      performance: this.getPerformanceMetrics(),
      metrics: this.getMetricsSummary()
    };
  }

  getPerformanceReport() {
    return this.getAllMetrics();
  }

  resetMetric(name: string) {
    this.metrics.delete(name);
  }

  resetAll() {
    this.reset();
  }

  logPerformanceReport() {
    console.log('Performance report:', this.getPerformanceReport());
  }

  reset(): void {
    this.metrics.clear();
    this.requestTimes = [];
    this.successCount = 0;
    this.errorCount = 0;
    this.totalRequests = 0;
    this.startTime = Date.now();
  }
}

export const performanceMonitor = new PerformanceMonitor();
