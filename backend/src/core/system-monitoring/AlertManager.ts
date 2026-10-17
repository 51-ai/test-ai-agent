import { Metric, Alert, AlertRule } from './types';

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  checkMetric(metric: Metric): Alert | null {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.metricName !== metric.name) continue;

      if (rule.lastTriggered) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (Date.now() - rule.lastTriggered.getTime() < cooldownMs) {
          continue;
        }
      }

      let shouldTrigger = false;

      if (rule.condition === 'above' && metric.value > rule.threshold) {
        shouldTrigger = true;
      } else if (rule.condition === 'below' && metric.value < rule.threshold) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          level: rule.level,
          message: rule.message,
          metric,
          threshold: rule.threshold,
          triggeredAt: new Date()
        };

        this.alerts.set(alert.id, alert);
        rule.lastTriggered = new Date();

        return alert;
      }
    }

    return null;
  }

  acknowledgeAlert(alertId: string, ackUser?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    return true;
  }

  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getAlerts(level?: Alert['level']): Alert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (level) {
      alerts = alerts.filter(a => a.level === level);
    }

    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  getActiveAlerts(): Alert[] {
    return this.getAlerts().filter(a => !a.resolved);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  clearResolvedAlerts(): number {
    let cleared = 0;
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}
