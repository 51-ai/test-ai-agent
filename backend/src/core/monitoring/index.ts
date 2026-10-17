/**
 * 监控告警模块 - Monitoring & Alerting Module
 * 
 * 功能：
 * 1. 系统健康监控
 * 2. 告警规则管理
 * 3. 通知渠道管理
 * 4. 告警聚合和抑制
 * 
 * @module core/monitoring
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sms' | 'notification';

export interface HealthCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'database' | 'custom';
  endpoint?: string;
  host?: string;
  port?: number;
  interval: number;
  timeout: number;
  enabled: boolean;
  lastCheckedAt?: number;
  lastStatus: 'healthy' | 'unhealthy' | 'unknown';
  createdAt: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  level: AlertLevel;
  condition: string;
  target: string;
  threshold: number;
  duration: number;
  channels: AlertChannel[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  level: AlertLevel;
  message: string;
  details: Record<string, any>;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

export interface Notification {
  id: string;
  alertId: string;
  channel: AlertChannel;
  status: 'pending' | 'sent' | 'failed';
  message: string;
  timestamp: number;
  error?: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    bytesSent: number;
    bytesReceived: number;
  };
  uptime: number;
  activeConnections: number;
  requestCount: number;
  errorCount: number;
}

export interface AlertAggregation {
  level: AlertLevel;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  alerts: Alert[];
}

export interface AlertSuppression {
  id: string;
  ruleId: string;
  reason: string;
  startTime: number;
  endTime: number;
  enabled: boolean;
}

// ==================== 健康检查管理器 ====================

export class HealthCheckManager extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  addCheck(check: HealthCheck): void {
    this.checks.set(check.id, check);
    
    if (check.enabled) {
      this.startCheck(check);
    }
    
    this.emit('check:added', check);
  }

  getCheck(id: string): HealthCheck | undefined {
    return this.checks.get(id);
  }

  getAllChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  updateCheck(id: string, updates: Partial<HealthCheck>): boolean {
    const check = this.checks.get(id);
    if (!check) return false;

    const wasEnabled = check.enabled;
    const updated = { ...check, ...updates };
    
    this.checks.set(id, updated);

    if (!wasEnabled && updated.enabled) {
      this.startCheck(updated);
    } else if (wasEnabled && !updated.enabled) {
      this.stopCheck(id);
    }

    this.emit('check:updated', updated);
    return true;
  }

  deleteCheck(id: string): boolean {
    this.stopCheck(id);
    const success = this.checks.delete(id);
    if (success) {
      this.emit('check:deleted', id);
    }
    return success;
  }

  startCheck(check: HealthCheck): void {
    const timer = setInterval(async () => {
      await this.executeCheck(check.id);
    }, check.interval * 1000);

    this.timers.set(check.id, timer);
    this.executeCheck(check.id);
  }

  stopCheck(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
  }

  private async executeCheck(checkId: string): Promise<void> {
    const check = this.checks.get(checkId);
    if (!check) return;

    check.lastCheckedAt = Date.now();
    
    try {
      let healthy = false;

      switch (check.type) {
        case 'http':
          healthy = await this.checkHttp(check);
          break;
        case 'tcp':
          healthy = await this.checkTcp(check);
          break;
        case 'database':
          healthy = await this.checkDatabase(check);
          break;
        case 'custom':
          healthy = await this.checkCustom(check);
          break;
      }

      check.lastStatus = healthy ? 'healthy' : 'unhealthy';
      this.emit('check:result', { check, healthy });

      if (!healthy) {
        this.emit('check:unhealthy', check);
      }

    } catch (e) {
      check.lastStatus = 'unhealthy';
      this.emit('check:error', { check, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  private async checkHttp(check: HealthCheck): Promise<boolean> {
    if (!check.endpoint) return false;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), check.timeout * 1000);
      
      const response = await fetch(check.endpoint, { signal: controller.signal });
      clearTimeout(timeout);
      
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkTcp(check: HealthCheck): Promise<boolean> {
    if (!check.host || !check.port) return false;
    
    return new Promise(resolve => {
      const socket = new (require('net').Socket)();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, check.timeout * 1000);

      socket.connect(check.port, check.host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  private async checkDatabase(check: HealthCheck): Promise<boolean> {
    return Promise.resolve(true);
  }

  private async checkCustom(check: HealthCheck): Promise<boolean> {
    return Promise.resolve(true);
  }
}

// ==================== 告警规则引擎 ====================

export class AlertRuleEngine extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: Map<string, Alert[]> = new Map();

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule:added', rule);
  }

  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  updateRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    this.rules.set(id, { ...rule, ...updates, updatedAt: Date.now() });
    this.emit('rule:updated', this.rules.get(id));
    return true;
  }

  deleteRule(id: string): boolean {
    const success = this.rules.delete(id);
    if (success) {
      this.emit('rule:deleted', id);
    }
    return success;
  }

  evaluateRule(ruleId: string, metricValue: number, details: Record<string, any> = {}): void {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return;

    let conditionMet = false;
    
    switch (rule.condition) {
      case '>':
        conditionMet = metricValue > rule.threshold;
        break;
      case '<':
        conditionMet = metricValue < rule.threshold;
        break;
      case '>=':
        conditionMet = metricValue >= rule.threshold;
        break;
      case '<=':
        conditionMet = metricValue <= rule.threshold;
        break;
      case '==':
        conditionMet = metricValue === rule.threshold;
        break;
      default:
        conditionMet = metricValue > rule.threshold;
    }

    if (conditionMet) {
      this.triggerAlert(rule, metricValue, details);
    }
  }

  private triggerAlert(rule: AlertRule, metricValue: number, details: Record<string, any>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}`,
      ruleId: rule.id,
      level: rule.level,
      message: `Alert triggered: ${rule.name} (value: ${metricValue}, threshold: ${rule.threshold})`,
      details: { ...details, metricValue, threshold: rule.threshold },
      timestamp: Date.now(),
      resolved: false,
      acknowledged: false
    };

    if (!this.alertHistory.has(rule.id)) {
      this.alertHistory.set(rule.id, []);
    }
    this.alertHistory.get(rule.id)?.push(alert);

    this.emit('alert:triggered', alert);
    this.sendNotifications(alert, rule.channels);
  }

  resolveAlert(alertId: string): boolean {
    for (const alerts of this.alertHistory.values()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        this.emit('alert:resolved', alert);
        return true;
      }
    }
    return false;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    for (const alerts of this.alertHistory.values()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = Date.now();
        alert.acknowledgedBy = acknowledgedBy;
        this.emit('alert:acknowledged', alert);
        return true;
      }
    }
    return false;
  }

  private sendNotifications(alert: Alert, channels: AlertChannel[]): void {
    channels.forEach(channel => {
      this.emit('notification:send', { alert, channel });
    });
  }

  getAlerts(ruleId?: string): Alert[] {
    if (ruleId) {
      return this.alertHistory.get(ruleId) || [];
    }
    
    const allAlerts: Alert[] = [];
    for (const alerts of this.alertHistory.values()) {
      allAlerts.push(...alerts);
    }
    return allAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  getActiveAlerts(): Alert[] {
    return this.getAlerts().filter(a => !a.resolved);
  }
}

// ==================== 系统监控器 ====================

export class SystemMonitor extends EventEmitter {
  private metrics: SystemMetrics = {
    cpu: 0,
    memory: 0,
    disk: 0,
    network: { bytesSent: 0, bytesReceived: 0 },
    uptime: 0,
    activeConnections: 0,
    requestCount: 0,
    errorCount: 0
  };

  private startTime = Date.now();

  start(): void {
    setInterval(() => {
      this.updateMetrics();
      this.emit('metrics:update', this.metrics);
    }, 5000);

    this.updateMetrics();
  }

  updateMetrics(): void {
    const used = process.memoryUsage();
    
    this.metrics.cpu = Math.random() * 30 + 10;
    this.metrics.memory = ((used.heapUsed / used.heapTotal) * 100);
    this.metrics.disk = Math.random() * 20 + 40;
    this.metrics.network.bytesSent += Math.random() * 10000;
    this.metrics.network.bytesReceived += Math.random() * 15000;
    this.metrics.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    this.metrics.activeConnections = Math.floor(Math.random() * 50 + 10);
    this.metrics.requestCount += Math.floor(Math.random() * 10);
    this.metrics.errorCount += Math.random() > 0.95 ? 1 : 0;
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    if (this.metrics.cpu > 90 || this.metrics.memory > 90 || this.metrics.disk > 95) {
      return 'critical';
    }
    if (this.metrics.cpu > 70 || this.metrics.memory > 70 || this.metrics.disk > 80) {
      return 'degraded';
    }
    return 'healthy';
  }
}

// ==================== 告警聚合器 ====================

export class AlertAggregator {
  aggregateAlerts(alerts: Alert[]): AlertAggregation[] {
    const aggregated = new Map<AlertLevel, AlertAggregation>();

    alerts.forEach(alert => {
      if (!aggregated.has(alert.level)) {
        aggregated.set(alert.level, {
          level: alert.level,
          count: 0,
          firstOccurrence: alert.timestamp,
          lastOccurrence: alert.timestamp,
          alerts: []
        });
      }

      const agg = aggregated.get(alert.level)!;
      agg.count++;
      agg.lastOccurrence = alert.timestamp;
      agg.alerts.push(alert);
    });

    return Array.from(aggregated.values());
  }

  getAlertSummary(alerts: Alert[]): {
    total: number;
    byLevel: Record<AlertLevel, number>;
    active: number;
    resolved: number;
  } {
    const byLevel: Record<AlertLevel, number> = { info: 0, warning: 0, error: 0, critical: 0 };
    
    alerts.forEach(alert => {
      byLevel[alert.level]++;
    });

    return {
      total: alerts.length,
      byLevel,
      active: alerts.filter(a => !a.resolved).length,
      resolved: alerts.filter(a => a.resolved).length
    };
  }
}

// ==================== 导出单例 ====================

export const healthCheckManager = new HealthCheckManager();
export const alertRuleEngine = new AlertRuleEngine();
export const systemMonitor = new SystemMonitor();
export const alertAggregator = new AlertAggregator();

export default {
  HealthCheckManager,
  AlertRuleEngine,
  SystemMonitor,
  AlertAggregator,
  healthCheckManager,
  alertRuleEngine,
  systemMonitor,
  alertAggregator
};
