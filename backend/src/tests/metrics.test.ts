/**
 * 指标模块单元测试
 */

import { MetricsManager, Metric, MetricSnapshot, TimeSeriesData } from '../core/metrics';

describe('Metric', () => {
  let metric: Metric;

  beforeEach(() => {
    metric = new Metric({
      name: 'test_metric',
      description: 'Test metric',
      unit: 'ms',
      aggregationType: 'avg',
      retentionPeriod: 3600000,
      maxDataPoints: 100
    });
  });

  describe('record()', () => {
    it('should record a single data point', () => {
      metric.record(100);
      const snapshot = metric.getSnapshot();
      expect(snapshot.current).toBe(100);
    });

    it('should record multiple data points', () => {
      metric.record(100);
      metric.record(200);
      metric.record(150);
      const snapshot = metric.getSnapshot();
      expect(snapshot.current).toBe(150);
    });

    it('should include tags in data point', () => {
      metric.record(100, { env: 'test', region: 'us-west' });
      const timeSeries = metric.getTimeSeries();
      expect(timeSeries[0].tags).toEqual({ env: 'test', region: 'us-west' });
    });
  });

  describe('increment()', () => {
    it('should increment by default value of 1', () => {
      metric.increment();
      const snapshot = metric.getSnapshot();
      expect(snapshot.current).toBe(1);
    });

    it('should increment by specified amount', () => {
      metric.increment(5);
      const snapshot = metric.getSnapshot();
      expect(snapshot.current).toBe(5);
    });
  });

  describe('getAggregatedValue()', () => {
    it('should return sum for sum aggregation', () => {
      metric.record(100);
      metric.record(200);
      metric.record(300);
      const sumMetric = new Metric({
        name: 'sum_metric',
        aggregationType: 'sum'
      });
      sumMetric.record(100);
      sumMetric.record(200);
      sumMetric.record(300);
      expect(sumMetric.getAggregatedValue('sum')).toBe(600);
    });

    it('should return average for avg aggregation', () => {
      metric.record(100);
      metric.record(200);
      metric.record(300);
      expect(metric.getAggregatedValue('avg')).toBe(200);
    });

    it('should return min for min aggregation', () => {
      metric.record(100);
      metric.record(50);
      metric.record(200);
      expect(metric.getAggregatedValue('min')).toBe(50);
    });

    it('should return max for max aggregation', () => {
      metric.record(100);
      metric.record(50);
      metric.record(200);
      expect(metric.getAggregatedValue('max')).toBe(200);
    });

    it('should return count for count aggregation', () => {
      metric.record(100);
      metric.record(200);
      metric.record(300);
      expect(metric.getAggregatedValue('count')).toBe(3);
    });
  });

  describe('getSnapshot()', () => {
    it('should calculate trend correctly for increasing values', () => {
      // getSnapshot 是"跨周期对比"设计：previous 取上一时间窗均值。
      // 用假计时器把数据铺进两个周期（上一周期均值 100 → 当前周期均值 120）
      jest.useFakeTimers();
      try {
        const base = Date.now();
        jest.setSystemTime(base - 120000);
        for (let i = 0; i < 5; i++) {
          metric.record(100);
        }
        jest.setSystemTime(base);
        for (let i = 0; i < 5; i++) {
          metric.record(100 + i * 10);
        }

        const snapshot = metric.getSnapshot(60000);
        expect(snapshot.trend).toBe('up');
        expect(snapshot.changePercent).toBeGreaterThan(5);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should calculate trend correctly for decreasing values', () => {
      jest.useFakeTimers();
      try {
        const base = Date.now();
        jest.setSystemTime(base - 120000);
        for (let i = 0; i < 5; i++) {
          metric.record(150);
        }
        jest.setSystemTime(base);
        for (let i = 0; i < 5; i++) {
          metric.record(150 - i * 10);
        }

        const snapshot = metric.getSnapshot(60000);
        expect(snapshot.trend).toBe('down');
        expect(snapshot.changePercent).toBeLessThan(-5);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should calculate stable trend for similar values', () => {
      for (let i = 0; i < 5; i++) {
        metric.record(100);
      }
      
      const snapshot = metric.getSnapshot(60000);
      expect(snapshot.trend).toBe('stable');
    });
  });

  describe('reset()', () => {
    it('should clear all data points', () => {
      metric.record(100);
      metric.record(200);
      metric.reset();
      expect(metric.getSnapshot().current).toBe(0);
      expect(metric.getTimeSeries().length).toBe(0);
    });
  });
});

describe('MetricsManager', () => {
  let manager: MetricsManager;

  beforeEach(() => {
    manager = new MetricsManager();
  });

  describe('registerMetric()', () => {
    it('should register a new metric', () => {
      const metric = manager.registerMetric({
        name: 'new_metric',
        aggregationType: 'avg'
      });
      expect(manager.getMetric('new_metric')).toBeDefined();
      expect(manager.getMetricCount()).toBe(1);
    });

    it('should throw error for duplicate metric', () => {
      manager.registerMetric({
        name: 'duplicate',
        aggregationType: 'avg'
      });
      expect(() => {
        manager.registerMetric({
          name: 'duplicate',
          aggregationType: 'sum'
        });
      }).toThrow();
    });
  });

  describe('getOrCreateMetric()', () => {
    it('should return existing metric if exists', () => {
      const metric1 = manager.registerMetric({
        name: 'existing',
        aggregationType: 'avg'
      });
      const metric2 = manager.getOrCreateMetric({
        name: 'existing',
        aggregationType: 'sum'
      });
      expect(metric1).toBe(metric2);
    });

    it('should create new metric if not exists', () => {
      const metric = manager.getOrCreateMetric({
        name: 'new_metric',
        aggregationType: 'avg'
      });
      expect(metric).toBeDefined();
      expect(manager.getMetricCount()).toBe(1);
    });
  });

  describe('record()', () => {
    it('should record value for existing metric', () => {
      manager.registerMetric({
        name: 'test_metric',
        aggregationType: 'avg'
      });
      manager.record('test_metric', 100);
      expect(manager.getMetric('test_metric')!.getSnapshot().current).toBe(100);
    });

    it('should auto-create metric if not exists', () => {
      manager.record('auto_metric', 50);
      expect(manager.getMetric('auto_metric')).toBeDefined();
    });
  });

  describe('recordBatch()', () => {
    it('should record multiple metrics at once', () => {
      manager.recordBatch([
        { name: 'metric1', value: 100 },
        { name: 'metric2', value: 200 },
        { name: 'metric3', value: 300 }
      ]);
      expect(manager.getMetricCount()).toBe(3);
    });
  });

  describe('getAllSnapshots()', () => {
    it('should return snapshots for all metrics', () => {
      manager.record('metric1', 100);
      manager.record('metric2', 200);
      
      const snapshots = manager.getAllSnapshots();
      expect(snapshots.length).toBe(2);
    });
  });

  describe('removeMetric()', () => {
    it('should remove existing metric', () => {
      manager.registerMetric({
        name: 'to_remove',
        aggregationType: 'avg'
      });
      expect(manager.removeMetric('to_remove')).toBe(true);
      expect(manager.getMetric('to_remove')).toBeUndefined();
    });

    it('should return false for non-existing metric', () => {
      expect(manager.removeMetric('non_existing')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should clear all metrics', () => {
      manager.record('metric1', 100);
      manager.record('metric2', 200);
      manager.clear();
      expect(manager.getMetricCount()).toBe(0);
    });
  });
});
