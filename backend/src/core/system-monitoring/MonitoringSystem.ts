import { 
  Metric, 
  Alert, 
  PerformanceMetrics, 
  BehaviorMetrics, 
  AlertRule, 
  ResourceMetrics,
  QualityMetrics,
  TrafficMetrics,
  SystemHealth,
  ComprehensiveMetrics
} from './types';
import { AlertManager } from './AlertManager';
import { PerformanceMonitor } from './PerformanceMonitor';

// ============ 新增类型定义 ============

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
}

export interface AutoRecoveryAction {
  id: string;
  name: string;
  executedAt: Date;
  success: boolean;
  result?: string;
}

// 性能基线接口
export interface PerformanceBaseline {
  id: string;
  name: string;
  metricName: string;
  baselineValue: number;
  stdDeviation: number;
  upperThreshold: number;
  lowerThreshold: number;
  recordedAt: Date;
  sampleCount: number;
}

// 告警升级配置
export interface AlertEscalation {
  id: string;
  fromLevel: Alert['level'];
  toLevel: Alert['level'];
  triggerCondition: 'time' | 'count' | 'severity';
  thresholdValue: number;
  enabled: boolean;
}

// 恢复动作配置
export interface RecoveryActionConfig {
  id: string;
  name: string;
  metricPattern: string;
  condition: 'above' | 'below';
  threshold: number;
  action: () => Promise<boolean>;
  cooldownMs: number;
  maxAttempts: number;
  enabled: boolean;
  lastExecuted?: Date;
  consecutiveFailures: number;
}

// 趋势分析结果
export interface TrendAnalysis {
  metricName: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  predictedValue: number;
  confidence: number;
  changePercentage: number;
  analyzedAt: Date;
  dataPoints: number;
}

// 资源预测
export interface ResourcePrediction {
  metricName: string;
  predictedValue: number;
  predictedAt: Date;
  predictionWindow: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// 多维度监控数据
export interface MultiDimensionalMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
    frequency?: number;
  };
  memory: {
    used: number;
    total: number;
    usagePercent: number;
    available: number;
  };
  disk: {
    readBytes: number;
    writeBytes: number;
    usagePercent: number;
    freeSpace: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    connections: number;
  };
  process: {
    threads: number;
    handles: number;
    memoryPrivate: number;
  };
  timestamp: Date;
}

// 异常检测结果
export interface AnomalyDetection {
  id: string;
  metricName: string;
  value: number;
  expectedValue: number;
  deviation: number;
  deviationType: 'above' | 'below' | 'spike' | 'drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedAt: Date;
  zScore?: number;
}

// 监控报告
export interface MonitoringReport {
  id: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: {
    overallHealth: 'good' | 'fair' | 'poor' | 'critical';
    totalAlerts: number;
    criticalAlerts: number;
    resolvedAlerts: number;
    autoRecoverySuccess: number;
    autoRecoveryFailed: number;
    avgResponseTime: number;
    uptime: number;
  };
  performance: {
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    throughput: number;
    errorRate: number;
    baselineDeviation: number;
  };
  resource: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;
    resourcePrediction: ResourcePrediction[];
  };
  trends: TrendAnalysis[];
  anomalies: AnomalyDetection[];
  recommendations: string[];
}

// 历史数据查询条件
export interface MetricHistoryQuery {
  metricName: string;
  startTime: Date;
  endTime: Date;
  limit?: number;
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
  filters?: Record<string, unknown>;
}

// 仪表板快照
export interface DashboardSnapshot {
  id: string;
  timestamp: Date;
  summary: {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    activeAlerts: number;
    pendingRecoveries: number;
    uptime: number;
  };
  performance: PerformanceMetrics;
  resource: ResourceMetrics;
  multiDimensional: MultiDimensionalMetrics;
  traffic: TrafficMetrics;
  quality: QualityMetrics;
  recentAlerts: Alert[];
  topAnomalies: AnomalyDetection[];
  trends: TrendAnalysis[];
}

export class MonitoringSystem {
  private alertManager: AlertManager;
  private performanceMonitor: PerformanceMonitor;
  private behaviorMetrics: BehaviorMetrics = {
    totalConversations: 0,
    totalMessages: 0,
    averageMessagesPerConversation: 0,
    toolCalls: 0,
    hallucinationRate: 0,
    userSatisfaction: 0,
    taskCompletionRate: 0
  };
  private resourceMetrics: ResourceMetrics = {
    cpuUsage: 0,
    memoryUsage: 0
  };
  private qualityMetrics: QualityMetrics = {
    relevanceScore: 0.5,
    coherenceScore: 0.5,
    safetyScore: 1,
    hallucinationRate: 0,
    userSatisfaction: 0.5,
    responseQuality: 0.5
  };
  private trafficMetrics: TrafficMetrics = {
    requestsPerMinute: 0,
    concurrentUsers: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0
  };
  private systemHealth: SystemHealth = {
    overallStatus: 'healthy',
    uptime: 0,
    componentStatuses: {}
  };
  private startTime: Date = new Date();
  private healthCheckHistory: HealthCheckResult[] = [];
  private autoRecoveryActions: AutoRecoveryAction[] = [];
  private healthCheckCallbacks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  // ============ 新增私有属性 ============
  // 性能基线管理
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private baselineSamples: Map<string, number[]> = new Map();
  private baselineCooldown: Map<string, Date> = new Map();

  // 告警分级管理与升级
  private alertEscalations: AlertEscalation[] = [];
  private alertCountByLevel: Map<string, number> = new Map();
  private alertFirstTriggered: Map<string, Date> = new Map();

  // 自动恢复机制
  private recoveryActions: RecoveryActionConfig[] = [];
  private pendingRecoveries: Set<string> = new Set();

  // 性能趋势分析
  private trendAnalysisHistory: TrendAnalysis[] = [];
  private trendAnalysisWindow: number = 100;

  // 资源使用预测
  private resourceHistory: Map<string, number[]> = new Map();
  private predictionModels: Map<string, { slope: number; intercept: number }> = new Map();

  // 多维度监控
  private multiDimensionalMetrics: MultiDimensionalMetrics = {
    cpu: { usage: 0, cores: 1 },
    memory: { used: 0, total: 0, usagePercent: 0, available: 0 },
    disk: { readBytes: 0, writeBytes: 0, usagePercent: 0, freeSpace: 0 },
    network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0, connections: 0 },
    process: { threads: 0, handles: 0, memoryPrivate: 0 },
    timestamp: new Date()
  };

  // 异常检测
  private anomalyHistory: AnomalyDetection[] = [];
  private anomalyDetectionEnabled: boolean = true;
  private anomalyStdDevThreshold: number = 2.5;

  // 监控报告
  private reportHistory: MonitoringReport[] = [];
  private lastReportTime: Date = new Date();
  private reportIntervalMs: number = 3600000; // 默认1小时

  // 历史数据
  private metricHistory: Metric[] = [];
  private maxHistorySize: number = 10000;

  constructor() {
    this.alertManager = new AlertManager();
    this.performanceMonitor = new PerformanceMonitor();
    this.setupDefaultRules();
  }

  registerHealthCheck(component: string, callback: () => Promise<HealthCheckResult>): void {
    this.healthCheckCallbacks.set(component, callback);
  }

  async performHealthCheck(component?: string): Promise<HealthCheckResult | HealthCheckResult[]> {
    if (component) {
      const callback = this.healthCheckCallbacks.get(component);
      if (!callback) {
        return {
          component,
          status: 'unhealthy',
          message: 'Component not registered',
          lastCheck: new Date()
        };
      }

      const startTime = Date.now();
      try {
        const result = await callback();
        result.responseTime = Date.now() - startTime;
        this.healthCheckHistory.push(result);
        if (this.healthCheckHistory.length > 100) {
          this.healthCheckHistory = this.healthCheckHistory.slice(-100);
        }
        return result;
      } catch (error) {
        const result: HealthCheckResult = {
          component,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : String(error),
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
        this.healthCheckHistory.push(result);
        return result;
      }
    }

    const results: HealthCheckResult[] = [];
    for (const [comp, callback] of this.healthCheckCallbacks.entries()) {
      const result = await this.performHealthCheck(comp);
      results.push(result as HealthCheckResult);
    }
    return results;
  }

  getHealthCheckHistory(limit: number = 10): HealthCheckResult[] {
    return this.healthCheckHistory.slice(-limit);
  }

  executeAutoRecovery(recoveryAction: () => Promise<boolean>, name: string): Promise<AutoRecoveryAction> {
    const action: AutoRecoveryAction = {
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      executedAt: new Date(),
      success: false
    };

    return recoveryAction().then(success => {
      action.success = success;
      action.result = success ? 'Recovery completed successfully' : 'Recovery failed';
      this.autoRecoveryActions.push(action);
      return action;
    }).catch(error => {
      action.success = false;
      action.result = error instanceof Error ? error.message : String(error);
      this.autoRecoveryActions.push(action);
      return action;
    });
  }

  getAutoRecoveryHistory(): AutoRecoveryAction[] {
    return this.autoRecoveryActions.slice(-20);
  }

  private setupDefaultRules(): void {
    const rules: AlertRule[] = [
      {
        id: 'rule_latency_p99',
        metricName: 'latency_p99',
        condition: 'above',
        threshold: 5000,
        level: 'warning',
        message: 'P99 延迟超过 5 秒',
        cooldownMinutes: 5,
        enabled: true
      },
      {
        id: 'rule_latency_p95',
        metricName: 'latency_p95',
        condition: 'above',
        threshold: 3000,
        level: 'warning',
        message: 'P95 延迟超过 3 秒',
        cooldownMinutes: 5,
        enabled: true
      },
      {
        id: 'rule_error_rate',
        metricName: 'error_rate',
        condition: 'above',
        threshold: 0.1,
        level: 'error',
        message: '错误率超过 10%',
        cooldownMinutes: 1,
        enabled: true
      },
      {
        id: 'rule_error_rate_critical',
        metricName: 'error_rate',
        condition: 'above',
        threshold: 0.3,
        level: 'critical',
        message: '错误率超过 30%，系统可能异常',
        cooldownMinutes: 1,
        enabled: true
      },
      {
        id: 'rule_hallucination',
        metricName: 'hallucination_rate',
        condition: 'above',
        threshold: 0.2,
        level: 'warning',
        message: '幻觉率超过 20%',
        cooldownMinutes: 10,
        enabled: true
      },
      {
        id: 'rule_cpu_high',
        metricName: 'cpu_usage',
        condition: 'above',
        threshold: 80,
        level: 'warning',
        message: 'CPU 使用率超过 80%',
        cooldownMinutes: 5,
        enabled: true
      },
      {
        id: 'rule_cpu_critical',
        metricName: 'cpu_usage',
        condition: 'above',
        threshold: 95,
        level: 'critical',
        message: 'CPU 使用率超过 95%',
        cooldownMinutes: 2,
        enabled: true
      },
      {
        id: 'rule_memory_high',
        metricName: 'memory_usage',
        condition: 'above',
        threshold: 85,
        level: 'warning',
        message: '内存使用率超过 85%',
        cooldownMinutes: 5,
        enabled: true
      },
      {
        id: 'rule_safety_low',
        metricName: 'safety_score',
        condition: 'below',
        threshold: 0.7,
        level: 'warning',
        message: '安全评分低于 0.7',
        cooldownMinutes: 10,
        enabled: true
      },
      {
        id: 'rule_relevance_low',
        metricName: 'relevance_score',
        condition: 'below',
        threshold: 0.5,
        level: 'warning',
        message: '相关性评分低于 0.5',
        cooldownMinutes: 15,
        enabled: true
      },
      {
        id: 'rule_user_satisfaction_low',
        metricName: 'user_satisfaction',
        condition: 'below',
        threshold: 0.3,
        level: 'warning',
        message: '用户满意度低于 0.3',
        cooldownMinutes: 30,
        enabled: true
      },
      {
        id: 'rule_task_completion_low',
        metricName: 'task_completion_rate',
        condition: 'below',
        threshold: 0.5,
        level: 'warning',
        message: '任务完成率低于 50%',
        cooldownMinutes: 10,
        enabled: true
      }
    ];

    for (const rule of rules) {
      this.alertManager.addRule(rule);
    }
  }

  recordLatency(latencyMs: number): void {
    this.performanceMonitor.recordRequestLatency(latencyMs);

    this.recordMetric({
      id: `latency_${Date.now()}`,
      name: 'request_latency',
      value: latencyMs,
      unit: 'ms',
      timestamp: new Date()
    });
  }

  recordSuccess(): void {
    this.performanceMonitor.recordSuccess();
  }

  recordError(): void {
    this.performanceMonitor.recordError();
  }

  recordMetric(metric: Metric): void {
    this.performanceMonitor.recordMetric(metric);
    this.alertManager.checkMetric(metric);
    this.recordMetricToHistory(metric);

    // 自动检测异常
    if (this.anomalyDetectionEnabled) {
      const anomaly = this.detectAnomaly(metric.name, metric.value);
      if (anomaly && anomaly.severity === 'high') {
        console.warn(`[Anomaly Detection] ${metric.name}: ${metric.value} (z-score: ${anomaly.zScore?.toFixed(2)})`);
      }
    }

    // 检查自动恢复
    this.checkAndTriggerAutoRecovery(metric.name, metric.value);
  }

  updateBehaviorMetrics(updates: Partial<BehaviorMetrics>): void {
    this.behaviorMetrics = {
      ...this.behaviorMetrics,
      ...updates
    };

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'number') {
        this.recordMetric({
          id: `${key}_${Date.now()}`,
          name: key,
          value,
          timestamp: new Date()
        });
      }
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getPerformanceMetrics();
  }

  getBehaviorMetrics(): BehaviorMetrics {
    return { ...this.behaviorMetrics };
  }

  getAlerts(level?: Alert['level']): Alert[] {
    return this.alertManager.getAlerts(level);
  }

  getActiveAlerts(): Alert[] {
    return this.alertManager.getActiveAlerts();
  }

  acknowledgeAlert(alertId: string): boolean {
    return this.alertManager.acknowledgeAlert(alertId);
  }

  resolveAlert(alertId: string): boolean {
    return this.alertManager.resolveAlert(alertId);
  }

  getDashboardData(): {
    performance: PerformanceMetrics;
    resource: ResourceMetrics;
    traffic: TrafficMetrics;
    quality: QualityMetrics;
    alerts: { active: Alert[]; byLevel: Record<string, number> };
    health: SystemHealth;
  } {
    const activeAlerts = this.getActiveAlerts();
    const byLevel: Record<string, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };
    activeAlerts.forEach(alert => {
      byLevel[alert.level]++;
    });

    return {
      performance: this.getPerformanceMetrics(),
      resource: this.getResourceMetrics(),
      traffic: this.getTrafficMetrics(),
      quality: this.getQualityMetrics(),
      alerts: {
        active: activeAlerts,
        byLevel
      },
      health: this.getSystemHealth()
    };
  }

  getFullReport() {
    return {
      performance: this.getPerformanceMetrics(),
      behavior: this.getBehaviorMetrics(),
      alerts: {
        active: this.getActiveAlerts(),
        total: this.getAlerts()
      },
      metricsSummary: this.performanceMonitor.getMetricsSummary(),
      dashboard: this.getDashboardData()
    };
  }

  addAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule);
  }

  clearAll(): void {
    this.performanceMonitor.reset();
    this.behaviorMetrics = {
      totalConversations: 0,
      totalMessages: 0,
      averageMessagesPerConversation: 0,
      toolCalls: 0,
      hallucinationRate: 0,
      userSatisfaction: 0,
      taskCompletionRate: 0
    };
    this.resourceMetrics = { cpuUsage: 0, memoryUsage: 0 };
    this.qualityMetrics = {
      relevanceScore: 0.5, coherenceScore: 0.5, safetyScore: 1,
      hallucinationRate: 0, userSatisfaction: 0.5, responseQuality: 0.5
    };
    this.trafficMetrics = {
      requestsPerMinute: 0, concurrentUsers: 0, totalRequests: 0,
      successfulRequests: 0, failedRequests: 0
    };
    this.startTime = new Date();
    this.healthCheckHistory = [];
  }

  updateResourceMetrics(metrics: Partial<ResourceMetrics>): void {
    this.resourceMetrics = { ...this.resourceMetrics, ...metrics };
    
    if (metrics.cpuUsage !== undefined) {
      this.recordMetric({
        id: `cpu_${Date.now()}`,
        name: 'cpu_usage',
        value: metrics.cpuUsage,
        timestamp: new Date()
      });
    }
    
    if (metrics.memoryUsage !== undefined) {
      this.recordMetric({
        id: `memory_${Date.now()}`,
        name: 'memory_usage',
        value: metrics.memoryUsage,
        timestamp: new Date()
      });
    }
  }

  updateQualityMetrics(metrics: Partial<QualityMetrics>): void {
    this.qualityMetrics = { ...this.qualityMetrics, ...metrics };
    
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        this.recordMetric({
          id: `${key}_${Date.now()}`,
          name: key,
          value,
          timestamp: new Date()
        });
      }
    }
  }

  updateTrafficMetrics(metrics: Partial<TrafficMetrics>): void {
    this.trafficMetrics = { ...this.trafficMetrics, ...metrics };
    
    if (metrics.totalRequests !== undefined) {
      this.recordMetric({
        id: `total_requests_${Date.now()}`,
        name: 'total_requests',
        value: metrics.totalRequests,
        timestamp: new Date()
      });
    }
  }

  recordRequest(success: boolean): void {
    this.trafficMetrics.totalRequests++;
    if (success) {
      this.trafficMetrics.successfulRequests++;
      this.recordSuccess();
    } else {
      this.trafficMetrics.failedRequests++;
      this.recordError();
    }
  }

  getResourceMetrics(): ResourceMetrics {
    return { ...this.resourceMetrics };
  }

  getQualityMetrics(): QualityMetrics {
    return { ...this.qualityMetrics };
  }

  getTrafficMetrics(): TrafficMetrics {
    return { ...this.trafficMetrics };
  }

  getSystemHealth(): SystemHealth {
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    const performance = this.getPerformanceMetrics();
    
    let overallStatus: SystemHealth['overallStatus'] = 'healthy';
    
    if (performance.errorRate > 0.3 || this.resourceMetrics.cpuUsage > 90) {
      overallStatus = 'critical';
    } else if (performance.errorRate > 0.1 || this.resourceMetrics.cpuUsage > 75) {
      overallStatus = 'warning';
    }
    
    return {
      ...this.systemHealth,
      uptime,
      overallStatus
    };
  }

  getComprehensiveMetrics(): ComprehensiveMetrics {
    return {
      performance: this.getPerformanceMetrics(),
      behavior: this.getBehaviorMetrics(),
      resource: this.getResourceMetrics(),
      quality: this.getQualityMetrics(),
      traffic: this.getTrafficMetrics(),
      health: this.getSystemHealth(),
      timestamp: new Date()
    };
  }

  // ============ 性能基线管理 ============

  /**
   * 记录性能基线样本
   */
  recordBaselineSample(metricName: string, value: number): void {
    const samples = this.baselineSamples.get(metricName) || [];
    samples.push(value);
    if (samples.length > 100) {
      samples.shift();
    }
    this.baselineSamples.set(metricName, samples);
    this.updateBaseline(metricName);
  }

  /**
   * 更新性能基线
   */
  private updateBaseline(metricName: string): void {
    const samples = this.baselineSamples.get(metricName);
    if (!samples || samples.length < 10) return;

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    const existingBaseline = this.baselines.get(metricName);
    const sampleCount = existingBaseline ? existingBaseline.sampleCount + samples.length : samples.length;

    const baseline: PerformanceBaseline = {
      id: `baseline_${metricName}`,
      name: `${metricName} baseline`,
      metricName,
      baselineValue: mean,
      stdDeviation: stdDev,
      upperThreshold: mean + (stdDev * this.anomalyStdDevThreshold),
      lowerThreshold: Math.max(0, mean - (stdDev * this.anomalyStdDevThreshold)),
      recordedAt: new Date(),
      sampleCount
    };

    this.baselines.set(metricName, baseline);
  }

  /**
   * 获取性能基线
   */
  getBaseline(metricName: string): PerformanceBaseline | undefined {
    return this.baselines.get(metricName);
  }

  /**
   * 获取所有基线
   */
  getAllBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * 检测性能偏离基线
   */
  checkBaselineDeviation(metricName: string, value: number): { deviated: boolean; severity: 'none' | 'warning' | 'critical'; deviation: number } {
    const baseline = this.baselines.get(metricName);
    if (!baseline) {
      return { deviated: false, severity: 'none', deviation: 0 };
    }

    const now = new Date();
    const cooldownKey = `${metricName}_deviation`;
    const lastChecked = this.baselineCooldown.get(cooldownKey);
    if (lastChecked && (now.getTime() - lastChecked.getTime()) < 60000) {
      return { deviated: false, severity: 'none', deviation: 0 };
    }
    this.baselineCooldown.set(cooldownKey, now);

    const deviation = value - baseline.baselineValue;
    const deviationRatio = Math.abs(deviation) / (baseline.baselineValue || 1);
    const isDeviated = value > baseline.upperThreshold || value < baseline.lowerThreshold;

    let severity: 'none' | 'warning' | 'critical' = 'none';
    if (isDeviated) {
      const stdDevsFromBaseline = Math.abs(deviation) / (baseline.stdDeviation || 1);
      severity = stdDevsFromBaseline > 3 ? 'critical' : 'warning';
    }

    return {
      deviated: isDeviated,
      severity,
      deviation: deviationRatio * 100
    };
  }

  /**
   * 清除指定基线
   */
  clearBaseline(metricName: string): void {
    this.baselines.delete(metricName);
    this.baselineSamples.delete(metricName);
  }

  // ============ 告警分级管理与升级 ============

  /**
   * 添加告警升级规则
   */
  addAlertEscalation(escalation: Omit<AlertEscalation, 'id'>): void {
    const newEscalation: AlertEscalation = {
      ...escalation,
      id: `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    this.alertEscalations.push(newEscalation);
  }

  /**
   * 获取所有告警升级规则
   */
  getAlertEscalations(): AlertEscalation[] {
    return [...this.alertEscalations];
  }

  /**
   * 检查并执行告警升级
   */
  checkAlertEscalation(alertId: string, currentLevel: Alert['level']): Alert['level'] | null {
    const firstTriggered = this.alertFirstTriggered.get(alertId);
    if (!firstTriggered) {
      this.alertFirstTriggered.set(alertId, new Date());
    }

    const count = this.alertCountByLevel.get(alertId) || 0;
    this.alertCountByLevel.set(alertId, count + 1);

    const elapsedMs = firstTriggered ? Date.now() - firstTriggered.getTime() : 0;
    const elapsedMinutes = elapsedMs / 60000;

    for (const escalation of this.alertEscalations) {
      if (!escalation.enabled || escalation.fromLevel !== currentLevel) continue;

      let shouldEscalate = false;
      switch (escalation.triggerCondition) {
        case 'time':
          shouldEscalate = elapsedMinutes >= escalation.thresholdValue;
          break;
        case 'count':
          shouldEscalate = count >= escalation.thresholdValue;
          break;
        case 'severity':
          const severityOrder = { info: 1, warning: 2, error: 3, critical: 4 };
          shouldEscalate = severityOrder[currentLevel] >= escalation.thresholdValue;
          break;
      }

      if (shouldEscalate) {
        this.alertCountByLevel.delete(alertId);
        this.alertFirstTriggered.delete(alertId);
        return escalation.toLevel;
      }
    }

    return null;
  }

  /**
   * 清除告警升级状态
   */
  clearAlertEscalationState(alertId: string): void {
    this.alertCountByLevel.delete(alertId);
    this.alertFirstTriggered.delete(alertId);
  }

  // ============ 自动恢复机制 ============

  /**
   * 注册自动恢复动作
   */
  registerRecoveryAction(config: Omit<RecoveryActionConfig, 'id' | 'consecutiveFailures' | 'lastExecuted'>): void {
    const recoveryAction: RecoveryActionConfig = {
      ...config,
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      consecutiveFailures: 0
    };
    this.recoveryActions.push(recoveryAction);
  }

  /**
   * 获取所有恢复动作配置
   */
  getRecoveryActions(): RecoveryActionConfig[] {
    return [...this.recoveryActions];
  }

  /**
   * 检查并触发自动恢复
   */
  async checkAndTriggerAutoRecovery(metricName: string, value: number): Promise<AutoRecoveryAction | null> {
    for (const recovery of this.recoveryActions) {
      if (!recovery.enabled) continue;
      if (!recovery.metricPattern.includes(metricName)) continue;

      const now = new Date();
      if (recovery.lastExecuted && now.getTime() - recovery.lastExecuted.getTime() < recovery.cooldownMs) {
        continue;
      }

      let shouldTrigger = false;
      if (recovery.condition === 'above' && value > recovery.threshold) {
        shouldTrigger = true;
      } else if (recovery.condition === 'below' && value < recovery.threshold) {
        shouldTrigger = true;
      }

      if (shouldTrigger && !this.pendingRecoveries.has(recovery.id)) {
        this.pendingRecoveries.add(recovery.id);
        recovery.lastExecuted = now;

        try {
          const success = await recovery.action();
          if (!success) {
            recovery.consecutiveFailures++;
          } else {
            recovery.consecutiveFailures = 0;
          }

          const action: AutoRecoveryAction = {
            id: recovery.id,
            name: recovery.name,
            executedAt: now,
            success,
            result: success ? 'Recovery completed successfully' : 'Recovery action returned false'
          };
          this.autoRecoveryActions.push(action);
          this.pendingRecoveries.delete(recovery.id);
          return action;
        } catch (error) {
          recovery.consecutiveFailures++;
          const action: AutoRecoveryAction = {
            id: recovery.id,
            name: recovery.name,
            executedAt: now,
            success: false,
            result: error instanceof Error ? error.message : String(error)
          };
          this.autoRecoveryActions.push(action);
          this.pendingRecoveries.delete(recovery.id);
          return action;
        }
      }
    }
    return null;
  }

  /**
   * 启用/禁用恢复动作
   */
  setRecoveryActionEnabled(recoveryId: string, enabled: boolean): void {
    const recovery = this.recoveryActions.find(r => r.id === recoveryId);
    if (recovery) {
      recovery.enabled = enabled;
    }
  }

  // ============ 性能趋势分析 ============

  /**
   * 分析性能趋势
   */
  analyzeTrend(metricName: string, windowSize?: number): TrendAnalysis | null {
    const samples = this.baselineSamples.get(metricName);
    if (!samples || samples.length < 5) return null;

    const window = windowSize || Math.min(samples.length, this.trendAnalysisWindow);
    const recentSamples = samples.slice(-window);

    const n = recentSamples.length;
    const xMean = (n - 1) / 2;
    const yMean = recentSamples.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (recentSamples[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;
    const predictedValue = slope * n + intercept;

    // 计算R²确定趋势可信度
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssRes += Math.pow(recentSamples[i] - predicted, 2);
      ssTot += Math.pow(recentSamples[i] - yMean, 2);
    }
    const confidence = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

    // 判断趋势方向
    let direction: TrendAnalysis['direction'];
    const changePercentage = n > 0 ? ((predictedValue - recentSamples[0]) / (recentSamples[0] || 1)) * 100 : 0;

    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (slope > 0) {
      // 检测波动性
      const variance = recentSamples.reduce((sum, val, i) => {
        if (i === 0) return sum;
        return sum + Math.pow(val - recentSamples[i - 1], 2);
      }, 0) / (n - 1);
      const meanAbsChange = Math.sqrt(variance) / yMean;
      direction = meanAbsChange > 0.1 ? 'volatile' : 'increasing';
    } else {
      direction = 'decreasing';
    }

    const trend: TrendAnalysis = {
      metricName,
      direction,
      slope,
      predictedValue,
      confidence: Math.max(0, Math.min(1, confidence)),
      changePercentage,
      analyzedAt: new Date(),
      dataPoints: n
    };

    this.trendAnalysisHistory.push(trend);
    if (this.trendAnalysisHistory.length > 100) {
      this.trendAnalysisHistory.shift();
    }

    return trend;
  }

  /**
   * 获取趋势分析历史
   */
  getTrendHistory(metricName?: string): TrendAnalysis[] {
    if (metricName) {
      return this.trendAnalysisHistory.filter(t => t.metricName === metricName);
    }
    return [...this.trendAnalysisHistory];
  }

  /**
   * 批量分析趋势
   */
  analyzeAllTrends(windowSize?: number): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];
    for (const metricName of this.baselineSamples.keys()) {
      const trend = this.analyzeTrend(metricName, windowSize);
      if (trend) trends.push(trend);
    }
    return trends;
  }

  // ============ 资源使用预测 ============

  /**
   * 记录资源历史数据
   */
  recordResourceHistory(metricName: string, value: number): void {
    const history = this.resourceHistory.get(metricName) || [];
    history.push(value);
    if (history.length > 500) {
      history.shift();
    }
    this.resourceHistory.set(metricName, history);
    this.updatePredictionModel(metricName);
  }

  /**
   * 更新预测模型（简单线性回归）
   */
  private updatePredictionModel(metricName: string): void {
    const history = this.resourceHistory.get(metricName);
    if (!history || history.length < 10) return;

    const n = history.length;
    const xMean = (n - 1) / 2;
    const yMean = history.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (history[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    this.predictionModels.set(metricName, { slope, intercept });
  }

  /**
   * 预测未来资源使用
   */
  predictResourceUsage(metricName: string, predictionWindowMs: number): ResourcePrediction | null {
    const history = this.resourceHistory.get(metricName);
    const model = this.predictionModels.get(metricName);

    if (!history || history.length < 10 || !model) return null;

    // 假设每分钟一个数据点
    const stepsAhead = Math.ceil(predictionWindowMs / 60000);
    const predictedValue = model.slope * (history.length - 1 + stepsAhead) + model.intercept;

    // 计算置信度
    const recentHistory = history.slice(-20);
    const variance = recentHistory.reduce((sum, val, i) => {
      if (i === 0) return sum;
      return sum + Math.pow(val - recentHistory[i - 1], 2);
    }, 0) / (recentHistory.length - 1 || 1);
    const stability = 1 / (1 + Math.sqrt(variance) / (recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length || 1));

    let trend: ResourcePrediction['trend'];
    if (Math.abs(model.slope) < 0.01) {
      trend = 'stable';
    } else if (model.slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      metricName,
      predictedValue: Math.max(0, predictedValue),
      predictedAt: new Date(),
      predictionWindow: predictionWindowMs,
      confidence: Math.max(0, Math.min(1, stability)),
      trend
    };
  }

  /**
   * 预测所有资源
   */
  predictAllResources(predictionWindowMs: number = 300000): ResourcePrediction[] {
    const predictions: ResourcePrediction[] = [];
    for (const metricName of this.resourceHistory.keys()) {
      const prediction = this.predictResourceUsage(metricName, predictionWindowMs);
      if (prediction) predictions.push(prediction);
    }
    return predictions;
  }

  // ============ 多维度监控 ============

  /**
   * 更新多维度监控数据
   */
  updateMultiDimensionalMetrics(metrics: Partial<MultiDimensionalMetrics>): void {
    if (metrics.cpu) {
      this.multiDimensionalMetrics.cpu = { ...this.multiDimensionalMetrics.cpu, ...metrics.cpu };
      if (metrics.cpu.usage !== undefined) {
        this.recordResourceHistory('cpu_usage', metrics.cpu.usage);
        this.recordBaselineSample('cpu_usage', metrics.cpu.usage);
      }
    }
    if (metrics.memory) {
      this.multiDimensionalMetrics.memory = { ...this.multiDimensionalMetrics.memory, ...metrics.memory };
      if (metrics.memory.usagePercent !== undefined) {
        this.recordResourceHistory('memory_usage_percent', metrics.memory.usagePercent);
      }
    }
    if (metrics.disk) {
      this.multiDimensionalMetrics.disk = { ...this.multiDimensionalMetrics.disk, ...metrics.disk };
      if (metrics.disk.usagePercent !== undefined) {
        this.recordResourceHistory('disk_usage', metrics.disk.usagePercent);
      }
    }
    if (metrics.network) {
      this.multiDimensionalMetrics.network = { ...this.multiDimensionalMetrics.network, ...metrics.network };
      if (metrics.network.connections !== undefined) {
        this.recordResourceHistory('network_connections', metrics.network.connections);
      }
    }
    if (metrics.process) {
      this.multiDimensionalMetrics.process = { ...this.multiDimensionalMetrics.process, ...metrics.process };
      if (metrics.process.memoryPrivate !== undefined) {
        this.recordResourceHistory('process_memory', metrics.process.memoryPrivate);
      }
    }
    this.multiDimensionalMetrics.timestamp = new Date();
  }

  /**
   * 获取多维度监控数据
   */
  getMultiDimensionalMetrics(): MultiDimensionalMetrics {
    return { ...this.multiDimensionalMetrics };
  }

  // ============ 异常检测增强 ============

  /**
   * 使用Z-Score检测异常值
   */
  detectAnomaly(metricName: string, value: number): AnomalyDetection | null {
    if (!this.anomalyDetectionEnabled) return null;

    const baseline = this.baselines.get(metricName);
    if (!baseline || baseline.sampleCount < 20) {
      // 样本不足时，记录以便后续建立基线
      this.recordBaselineSample(metricName, value);
      return null;
    }

    const zScore = (value - baseline.baselineValue) / (baseline.stdDeviation || 1);

    if (Math.abs(zScore) < this.anomalyStdDevThreshold) {
      this.recordBaselineSample(metricName, value);
      return null;
    }

    let deviationType: AnomalyDetection['deviationType'];
    if (value > baseline.baselineValue) {
      const prevSamples = this.baselineSamples.get(metricName) || [];
      const recentAvg = prevSamples.slice(-5).reduce((a, b) => a + b, 0) / (prevSamples.slice(-5).length || 1);
      deviationType = value > recentAvg * 1.5 ? 'spike' : 'above';
    } else {
      const prevSamples = this.baselineSamples.get(metricName) || [];
      const recentAvg = prevSamples.slice(-5).reduce((a, b) => a + b, 0) / (prevSamples.slice(-5).length || 1);
      deviationType = value < recentAvg * 0.5 ? 'drop' : 'below';
    }

    let severity: AnomalyDetection['severity'];
    const absZScore = Math.abs(zScore);
    if (absZScore > 4) {
      severity = 'critical';
    } else if (absZScore > 3) {
      severity = 'high';
    } else if (absZScore > 2.5) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    const anomaly: AnomalyDetection = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metricName,
      value,
      expectedValue: baseline.baselineValue,
      deviation: Math.abs(value - baseline.baselineValue),
      deviationType,
      severity,
      confidence: Math.min(1, absZScore / 4),
      detectedAt: new Date(),
      zScore
    };

    this.anomalyHistory.push(anomaly);
    if (this.anomalyHistory.length > 500) {
      this.anomalyHistory.shift();
    }

    // 同时更新基线样本
    this.recordBaselineSample(metricName, value);

    return anomaly;
  }

  /**
   * 批量检测异常
   */
  detectAnomalies(values: Record<string, number>): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    for (const [metricName, value] of Object.entries(values)) {
      const anomaly = this.detectAnomaly(metricName, value);
      if (anomaly) anomalies.push(anomaly);
    }
    return anomalies;
  }

  /**
   * 获取异常历史
   */
  getAnomalyHistory(limit?: number, severity?: AnomalyDetection['severity']): AnomalyDetection[] {
    let filtered = this.anomalyHistory;
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    if (limit) {
      return filtered.slice(-limit);
    }
    return [...filtered];
  }

  /**
   * 设置异常检测阈值
   */
  setAnomalyStdDevThreshold(threshold: number): void {
    this.anomalyStdDevThreshold = threshold;
  }

  /**
   * 启用/禁用异常检测
   */
  setAnomalyDetectionEnabled(enabled: boolean): void {
    this.anomalyDetectionEnabled = enabled;
  }

  // ============ 监控报告自动生成 ============

  /**
   * 生成监控报告
   */
  generateMonitoringReport(periodMinutes: number = 60): MonitoringReport {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodMinutes * 60000);

    const performance = this.getPerformanceMetrics();
    const resource = this.getResourceMetrics();
    const activeAlerts = this.getActiveAlerts();
    const resolvedAlerts = this.getAlerts().filter(a => a.resolved);

    // 计算平均资源使用
    const cpuHistory = this.resourceHistory.get('cpu_usage') || [];
    const memoryHistory = this.resourceHistory.get('memory_usage_percent') || [];
    const avgCpuUsage = cpuHistory.length > 0 ? cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length : resource.cpuUsage;
    const avgMemoryUsage = memoryHistory.length > 0 ? memoryHistory.reduce((a, b) => a + b, 0) / memoryHistory.length : resource.memoryUsage;
    const peakCpuUsage = cpuHistory.length > 0 ? Math.max(...cpuHistory) : resource.cpuUsage;
    const peakMemoryUsage = memoryHistory.length > 0 ? Math.max(...memoryHistory) : resource.memoryUsage;

    // 计算基线偏离
    const latencyBaseline = this.baselines.get('latency_p99');
    const baselineDeviation = latencyBaseline && performance.latency.p99 > 0
      ? ((performance.latency.p99 - latencyBaseline.baselineValue) / (latencyBaseline.baselineValue || 1)) * 100
      : 0;

    // 获取趋势和异常
    const trends = this.analyzeAllTrends();
    const anomalies = this.getAnomalyHistory(10, 'high');

    // 生成建议
    const recommendations: string[] = [];
    if (performance.errorRate > 0.1) {
      recommendations.push('错误率偏高，建议检查系统错误日志和外部依赖服务');
    }
    if (avgCpuUsage > 80) {
      recommendations.push('CPU使用率持续偏高，考虑扩展计算资源或优化负载');
    }
    if (avgMemoryUsage > 85) {
      recommendations.push('内存使用率偏高，建议检查内存泄漏或增加内存资源');
    }
    if (trends.some(t => t.direction === 'increasing' && t.metricName.includes('latency'))) {
      recommendations.push('延迟呈上升趋势，建议进行性能分析和优化');
    }
    if (anomalies.length > 5) {
      recommendations.push('检测到较多异常事件，建议进行系统性排查');
    }

    // 计算健康状态
    let overallHealth: MonitoringReport['summary']['overallHealth'];
    const criticalCount = activeAlerts.filter(a => a.level === 'critical').length;
    if (criticalCount > 0 || performance.errorRate > 0.3) {
      overallHealth = 'critical';
    } else if (activeAlerts.length > 10 || performance.errorRate > 0.1) {
      overallHealth = 'poor';
    } else if (activeAlerts.length > 0 || performance.errorRate > 0.05) {
      overallHealth = 'fair';
    } else {
      overallHealth = 'good';
    }

    // 自动恢复统计
    const recentRecoveries = this.autoRecoveryActions.filter(r => r.executedAt >= periodStart);
    const autoRecoverySuccess = recentRecoveries.filter(r => r.success).length;
    const autoRecoveryFailed = recentRecoveries.filter(r => !r.success).length;

    const report: MonitoringReport = {
      id: `report_${now.getTime()}`,
      generatedAt: now,
      periodStart,
      periodEnd: now,
      summary: {
        overallHealth,
        totalAlerts: activeAlerts.length,
        criticalAlerts: criticalCount,
        resolvedAlerts: resolvedAlerts.length,
        autoRecoverySuccess,
        autoRecoveryFailed,
        avgResponseTime: performance.latency.average,
        uptime: this.getSystemHealth().uptime
      },
      performance: {
        latencyP50: performance.latency.p50,
        latencyP95: performance.latency.p95,
        latencyP99: performance.latency.p99,
        throughput: performance.throughput,
        errorRate: performance.errorRate,
        baselineDeviation
      },
      resource: {
        avgCpuUsage,
        avgMemoryUsage,
        peakCpuUsage,
        peakMemoryUsage,
        resourcePrediction: this.predictAllResources(periodMinutes * 60000)
      },
      trends,
      anomalies,
      recommendations
    };

    this.reportHistory.push(report);
    if (this.reportHistory.length > 100) {
      this.reportHistory.shift();
    }
    this.lastReportTime = now;

    return report;
  }

  /**
   * 获取历史报告
   */
  getReportHistory(limit?: number): MonitoringReport[] {
    if (limit) {
      return this.reportHistory.slice(-limit);
    }
    return [...this.reportHistory];
  }

  /**
   * 设置报告生成间隔
   */
  setReportInterval(intervalMs: number): void {
    this.reportIntervalMs = intervalMs;
  }

  /**
   * 检查是否需要生成新报告
   */
  shouldGenerateReport(): boolean {
    return Date.now() - this.lastReportTime.getTime() >= this.reportIntervalMs;
  }

  // ============ 监控历史数据查询 ============

  /**
   * 查询历史指标数据
   */
  queryMetricHistory(query: MetricHistoryQuery): Metric[] {
    let filtered = this.metricHistory.filter(m => {
      if (m.name !== query.metricName) return false;
      const timestamp = m.timestamp instanceof Date ? m.timestamp.getTime() : Number(m.timestamp);
      return timestamp >= query.startTime.getTime() && timestamp <= query.endTime.getTime();
    });

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        filtered = filtered.filter(m => m.metadata?.[key] === value);
      }
    }

    if (query.aggregation) {
      const values = filtered.map(m => m.value);
      const timestamp = query.startTime;
      switch (query.aggregation) {
        case 'avg':
          return [{ id: 'agg', name: query.metricName, value: values.reduce((a, b) => a + b, 0) / values.length, timestamp }];
        case 'min':
          return [{ id: 'agg', name: query.metricName, value: Math.min(...values), timestamp }];
        case 'max':
          return [{ id: 'agg', name: query.metricName, value: Math.max(...values), timestamp }];
        case 'sum':
          return [{ id: 'agg', name: query.metricName, value: values.reduce((a, b) => a + b, 0), timestamp }];
        case 'count':
          return [{ id: 'agg', name: query.metricName, value: values.length, timestamp }];
      }
    }

    if (query.limit) {
      filtered = filtered.slice(-query.limit);
    }

    return filtered;
  }

  /**
   * 记录指标到历史
   */
  private recordMetricToHistory(metric: Metric): void {
    this.metricHistory.push({ ...metric, timestamp: metric.timestamp instanceof Date ? metric.timestamp : new Date(metric.timestamp) });
    if (this.metricHistory.length > this.maxHistorySize) {
      this.metricHistory.shift();
    }
  }

  /**
   * 获取历史记录统计
   */
  getHistoryStats(): { totalRecords: number; byMetricName: Record<string, number>; oldestRecord: Date | null; newestRecord: Date | null } {
    const byMetricName: Record<string, number> = {};
    for (const m of this.metricHistory) {
      byMetricName[m.name] = (byMetricName[m.name] || 0) + 1;
    }

    const getTimestamp = (t: Date | number): Date => t instanceof Date ? t : new Date(t);
    const oldest = this.metricHistory.length > 0 ? getTimestamp(this.metricHistory[0].timestamp) : null;
    const newest = this.metricHistory.length > 0 ? getTimestamp(this.metricHistory[this.metricHistory.length - 1].timestamp) : null;

    return {
      totalRecords: this.metricHistory.length,
      byMetricName,
      oldestRecord: oldest,
      newestRecord: newest
    };
  }

  /**
   * 清除历史数据
   */
  clearHistory(startTime?: Date, endTime?: Date): number {
    if (!startTime && !endTime) {
      const count = this.metricHistory.length;
      this.metricHistory = [];
      return count;
    }

    const start = startTime?.getTime() || 0;
    const end = endTime?.getTime() || Date.now();
    const originalLength = this.metricHistory.length;
    this.metricHistory = this.metricHistory.filter(m => {
      const timestamp = m.timestamp instanceof Date ? m.timestamp.getTime() : Number(m.timestamp);
      return timestamp < start || timestamp > end;
    });
    return originalLength - this.metricHistory.length;
  }

  // ============ 监控仪表板数据生成增强 ============

  /**
   * 生成仪表板快照
   */
  generateDashboardSnapshot(): DashboardSnapshot {
    const activeAlerts = this.getActiveAlerts();
    const health = this.getSystemHealth();
    const trends = this.analyzeAllTrends();
    const anomalies = this.getAnomalyHistory(5, 'high');

    let overallStatus: DashboardSnapshot['summary']['overallStatus'];
    if (health.overallStatus === 'critical') {
      overallStatus = 'critical';
    } else if (health.overallStatus === 'warning') {
      overallStatus = 'degraded';
    } else if (activeAlerts.length > 0) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'healthy';
    }

    return {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      summary: {
        overallStatus,
        activeAlerts: activeAlerts.length,
        pendingRecoveries: this.pendingRecoveries.size,
        uptime: health.uptime
      },
      performance: this.getPerformanceMetrics(),
      resource: this.getResourceMetrics(),
      multiDimensional: this.getMultiDimensionalMetrics(),
      traffic: this.getTrafficMetrics(),
      quality: this.getQualityMetrics(),
      recentAlerts: activeAlerts.slice(0, 10),
      topAnomalies: anomalies,
      trends: trends.slice(0, 5)
    };
  }

  /**
   * 获取增强版仪表板数据
   */
  getEnhancedDashboardData(): {
    snapshot: DashboardSnapshot;
    baselines: PerformanceBaseline[];
    predictions: ResourcePrediction[];
    systemHealth: SystemHealth;
    alerts: { active: Alert[]; byLevel: Record<string, number>; escalated: number };
    anomalies: AnomalyDetection[];
    trends: TrendAnalysis[];
  } {
    const snapshot = this.generateDashboardSnapshot();
    const escalatedCount = this.alertEscalations.filter(e => e.enabled).length;

    return {
      snapshot,
      baselines: this.getAllBaselines(),
      predictions: this.predictAllResources(300000),
      systemHealth: this.getSystemHealth(),
      alerts: {
        active: this.getActiveAlerts(),
        byLevel: {
          info: snapshot.recentAlerts.filter(a => a.level === 'info').length,
          warning: snapshot.recentAlerts.filter(a => a.level === 'warning').length,
          error: snapshot.recentAlerts.filter(a => a.level === 'error').length,
          critical: snapshot.recentAlerts.filter(a => a.level === 'critical').length
        },
        escalated: escalatedCount
      },
      anomalies: this.getAnomalyHistory(10),
      trends: this.getTrendHistory()
    };
  }
}
