/**
 * 审计系统 - 全面的操作审计和追踪（内存 + MongoDB 双写持久化）
 */

import { v4 as uuidv4 } from 'uuid';
import { AuditLog, IAuditLog } from '../../models/AuditLog';

export type AuditLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type AuditCategory = 
  | 'authentication' 
  | 'authorization' 
  | 'data_access' 
  | 'data_modification' 
  | 'system' 
  | 'business' 
  | 'security';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  level: AuditLevel;
  category: AuditCategory;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'blocked';
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  levels?: AuditLevel[];
  categories?: AuditCategory[];
  userId?: string;
  action?: string;
  resource?: string;
  result?: 'success' | 'failure' | 'blocked';
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEntries: number;
  byLevel: Record<AuditLevel, number>;
  byCategory: Record<AuditCategory, number>;
  byResult: Record<string, number>;
  recentActivity: AuditEntry[];
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  securityAlerts: number;
}

export interface AuditRule {
  id: string;
  name: string;
  description: string;
  category: AuditCategory;
  condition: (entry: AuditEntry) => boolean;
  action: 'alert' | 'block' | 'log';
  severity: AuditLevel;
  enabled: boolean;
}

export interface AuditRetention {
  byCategory: Record<AuditCategory, number>;
  defaultDays: number;
}

export class AuditSystem {
  private entries: AuditEntry[] = [];
  private maxEntries = 100000;
  private rules: AuditRule[] = [];
  private retention: AuditRetention = {
    byCategory: {
      authentication: 365,
      authorization: 365,
      data_access: 180,
      data_modification: 365,
      system: 90,
      business: 180,
      security: 365
    },
    defaultDays: 180
  };
  private alertCallbacks: Array<(alert: AuditEntry, rule: AuditRule) => void> = [];

  constructor() {
    this.setupDefaultRules();
    this.startRetentionScheduler();
  }

  /**
   * 设置默认审计规则
   */
  private setupDefaultRules(): void {
    // 多次登录失败
    this.addRule({
      name: '多次登录失败',
      description: '检测用户连续登录失败',
      category: 'authentication',
      condition: (entry) => entry.action === 'login' && entry.result === 'failure',
      action: 'alert',
      severity: 'warning',
      enabled: true
    });

    // 敏感数据访问
    this.addRule({
      name: '敏感数据访问',
      description: '检测敏感数据被访问',
      category: 'data_access',
      condition: (entry) => {
        const sensitiveResources = ['password', 'credit_card', 'ssn', 'api_key', 'secret'];
        return sensitiveResources.some(r => 
          entry.resource?.toLowerCase().includes(r) || 
          entry.action.toLowerCase().includes(r)
        );
      },
      action: 'alert',
      severity: 'info',
      enabled: true
    });

    // 未授权访问尝试
    this.addRule({
      name: '未授权访问',
      description: '检测未授权访问尝试',
      category: 'authorization',
      condition: (entry) => entry.result === 'blocked',
      action: 'alert',
      severity: 'warning',
      enabled: true
    });

    // 系统错误
    this.addRule({
      name: '系统错误',
      description: '记录系统错误',
      category: 'system',
      condition: (entry) => entry.level === 'error' || entry.level === 'critical',
      action: 'alert',
      severity: 'error',
      enabled: true
    });
  }

  /**
   * 启动保留策略调度器
   */
  private startRetentionScheduler(): void {
    // 每小时检查一次
    setInterval(() => {
      this.applyRetentionPolicy();
    }, 60 * 60 * 1000).unref();
  }

  /**
   * 记录审计日志（内存 + MongoDB 双写）
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): string {
    const fullEntry: AuditEntry = {
      ...entry,
      id: `audit_${uuidv4()}`,
      timestamp: new Date()
    };

    this.entries.push(fullEntry);
    this.evaluateRules(fullEntry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries * 0.8);
    }

    AuditLog.create({
      auditId: fullEntry.id,
      timestamp: fullEntry.timestamp,
      level: fullEntry.level,
      category: fullEntry.category,
      userId: fullEntry.userId,
      sessionId: fullEntry.sessionId,
      action: fullEntry.action,
      resource: fullEntry.resource,
      resourceId: fullEntry.resourceId,
      details: fullEntry.details,
      ipAddress: fullEntry.ipAddress,
      userAgent: fullEntry.userAgent,
      result: fullEntry.result,
      errorMessage: fullEntry.errorMessage,
      duration: fullEntry.duration,
      metadata: fullEntry.metadata
    }).catch(err => {
      console.error('[Audit] MongoDB persist failed:', err.message);
      // 本地文件 fallback：MongoDB 不可用时写入本地日志，防止审计丢失
      try {
        const fs = require('fs');
        const path = require('path');
        const logDir = path.join(process.cwd(), 'data', 'audit-fallback');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);
        fs.appendFileSync(logFile, JSON.stringify({ ...fullEntry, timestamp: new Date().toISOString() }) + '\n');
      } catch (fsErr) {
        console.error('[Audit] Local fallback also failed:', (fsErr as Error).message);
      }
    });

    console.log(`[Audit] ${fullEntry.level.toUpperCase()} [${fullEntry.category}] ${fullEntry.action}: ${fullEntry.result}`);

    return fullEntry.id;
  }

  /**
   * 评估审计规则
   */
  private evaluateRules(entry: AuditEntry): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.category !== entry.category) continue;

      try {
        if (rule.condition(entry)) {
          switch (rule.action) {
            case 'alert':
              this.triggerAlert(entry, rule);
              break;
            case 'block':
              // 阻止操作已在调用处处理
              console.warn(`[Audit] Blocked by rule: ${rule.name}`);
              break;
            case 'log':
              console.log(`[Audit] Rule triggered: ${rule.name}`);
              break;
          }
        }
      } catch (error) {
        console.error(`[Audit] Rule evaluation error: ${error}`);
      }
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(entry: AuditEntry, rule: AuditRule): void {
    console.warn(`[Audit] ALERT: ${rule.name} - ${rule.description}`);
    
    for (const callback of this.alertCallbacks) {
      try {
        callback(entry, rule);
      } catch (error) {
        console.error(`[Audit] Alert callback error: ${error}`);
      }
    }
  }

  /**
   * 查询审计日志
   */
  query(query: AuditQuery): AuditEntry[] {
    let results = [...this.entries];

    // 应用过滤条件
    if (query.startDate) {
      results = results.filter(e => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(e => e.timestamp <= query.endDate!);
    }
    if (query.levels?.length) {
      results = results.filter(e => query.levels!.includes(e.level));
    }
    if (query.categories?.length) {
      results = results.filter(e => query.categories!.includes(e.category));
    }
    if (query.userId) {
      results = results.filter(e => e.userId === query.userId);
    }
    if (query.action) {
      results = results.filter(e => e.action.includes(query.action!));
    }
    if (query.resource) {
      results = results.filter(e => e.resource?.includes(query.resource!));
    }
    if (query.result) {
      results = results.filter(e => e.result === query.result);
    }

    // 排序（按时间倒序）
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * 获取审计摘要
   */
  getSummary(timeRange?: { start: Date; end: Date }): AuditSummary {
    let entries = this.entries;
    
    if (timeRange) {
      entries = entries.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    const byLevel: Record<AuditLevel, number> = {
      debug: 0, info: 0, warning: 0, error: 0, critical: 0
    };
    const byCategory: Record<AuditCategory, number> = {
      authentication: 0, authorization: 0, data_access: 0,
      data_modification: 0, system: 0, business: 0, security: 0
    };
    const byResult: Record<string, number> = { success: 0, failure: 0, blocked: 0 };
    
    const userCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    let securityAlerts = 0;

    for (const entry of entries) {
      byLevel[entry.level]++;
      byCategory[entry.category]++;
      byResult[entry.result]++;

      if (entry.userId) {
        userCounts.set(entry.userId, (userCounts.get(entry.userId) || 0) + 1);
      }
      actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);

      if (entry.category === 'security' || entry.level === 'critical' || entry.level === 'error') {
        securityAlerts++;
      }
    }

    const topUsers = Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries: entries.length,
      byLevel,
      byCategory,
      byResult,
      recentActivity: entries.slice(-10).reverse(),
      topUsers,
      topActions,
      securityAlerts
    };
  }

  /**
   * 添加审计规则
   */
  addRule(rule: Omit<AuditRule, 'id'>): string {
    const id = `rule_${uuidv4()}`;
    this.rules.push({ ...rule, id });
    return id;
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 删除规则
   */
  deleteRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有规则
   */
  getRules(): AuditRule[] {
    return [...this.rules];
  }

  /**
   * 注册告警回调
   */
  onAlert(callback: (alert: AuditEntry, rule: AuditRule) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * 应用保留策略
   */
  private applyRetentionPolicy(): void {
    const now = Date.now();
    const newEntries: AuditEntry[] = [];

    for (const entry of this.entries) {
      const retentionDays = this.retention.byCategory[entry.category] || this.retention.defaultDays;
      const ageInDays = (now - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays <= retentionDays) {
        newEntries.push(entry);
      }
    }

    const removed = this.entries.length - newEntries.length;
    this.entries = newEntries;
    
    if (removed > 0) {
      console.log(`[Audit] Retention policy applied: removed ${removed} old entries`);
    }
  }

  /**
   * 设置保留策略
   */
  setRetentionPolicy(retention: Partial<AuditRetention>): void {
    this.retention = { ...this.retention, ...retention };
  }

  /**
   * 导出审计日志
   */
  export(format: 'json' | 'csv' = 'json', query?: AuditQuery): string {
    const entries = query ? this.query(query) : this.entries;

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV格式
    const headers = [
      'id', 'timestamp', 'level', 'category', 'userId', 'action',
      'resource', 'result', 'ipAddress', 'errorMessage'
    ];
    
    const rows = entries.map(e => headers.map(h => {
      const value = e[h as keyof AuditEntry];
      if (value instanceof Date) {
        return value.toISOString();
      }
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : String(value || '');
    }).join(','));
    
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * 获取特定用户的活动记录
   */
  getUserActivity(userId: string, limit: number = 50): AuditEntry[] {
    return this.entries
      .filter(e => e.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 获取资源访问历史
   */
  getResourceHistory(resourceId: string, limit: number = 50): AuditEntry[] {
    return this.entries
      .filter(e => e.resourceId === resourceId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 分析安全趋势
   */
  analyzeSecurityTrend(days: number = 7): {
    dailyTrend: Array<{ date: string; total: number; alerts: number }>;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  } {
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;
    const relevantEntries = this.entries.filter(e => e.timestamp.getTime() >= startTime);
    
    const dailyTrend: Array<{ date: string; total: number; alerts: number }> = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = startTime + i * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      
      const dayEntries = relevantEntries.filter(e => 
        e.timestamp.getTime() >= dayStart && e.timestamp.getTime() < dayEnd
      );
      
      const alerts = dayEntries.filter(e => 
        e.category === 'security' || 
        e.level === 'error' || 
        e.level === 'critical' ||
        e.result === 'blocked'
      ).length;
      
      dailyTrend.push({
        date: new Date(dayStart).toISOString().split('T')[0],
        total: dayEntries.length,
        alerts
      });
    }
    
    const totalAlerts = dailyTrend.reduce((sum, d) => sum + d.alerts, 0);
    const avgAlertsPerDay = totalAlerts / days;
    
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (avgAlertsPerDay > 50) threatLevel = 'critical';
    else if (avgAlertsPerDay > 20) threatLevel = 'high';
    else if (avgAlertsPerDay > 5) threatLevel = 'medium';
    else threatLevel = 'low';

    const recommendations: string[] = [];
    if (threatLevel !== 'low') {
      recommendations.push('建议增加安全监控强度');
      recommendations.push('检查最近的异常访问模式');
    }
    if (avgAlertsPerDay > 20) {
      recommendations.push('建议进行安全审计');
    }

    return { dailyTrend, threatLevel, recommendations };
  }

  // ========== MongoDB 持久化查询（管理后台使用） ==========

  async queryDB(query: AuditQuery & { sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<{
    data: unknown[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const filter: Record<string, unknown> = {};
    if (query.startDate) filter.timestamp = { ...(filter.timestamp as object || {}), $gte: query.startDate };
    if (query.endDate) filter.timestamp = { ...(filter.timestamp as object || {}), $lte: query.endDate };
    if (query.levels?.length) filter.level = { $in: query.levels };
    if (query.categories?.length) filter.category = { $in: query.categories };
    if (query.userId) filter.userId = query.userId;
    if (query.action) filter.action = { $regex: query.action, $options: 'i' };
    if (query.resource) filter.resource = { $regex: query.resource, $options: 'i' };
    if (query.result) filter.result = query.result;

    const page = Math.max(1, Math.floor((query.offset || 0) / (query.limit || 50)) + 1);
    const pageSize = query.limit || 50;
    const skip = (page - 1) * pageSize;

    const sortField = query.sortBy || 'timestamp';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDir };

    const [total, data] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter).sort(sort).skip(skip).limit(pageSize).lean()
    ]);

    return { data, total, page, pageSize };
  }

  async getSummaryDB(timeRange?: { start: Date; end: Date }): Promise<AuditSummary> {
    const match: Record<string, unknown> = {};
    if (timeRange) {
      match.timestamp = { $gte: timeRange.start, $lte: timeRange.end };
    }

    const [byLevelAgg, byCategoryAgg, byResultAgg, totalRes, userAgg, actionAgg, securityAgg, recentRes] = await Promise.all([
      AuditLog.aggregate([{ $match: match }, { $group: { _id: '$level', count: { $sum: 1 } } }]),
      AuditLog.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      AuditLog.aggregate([{ $match: match }, { $group: { _id: '$result', count: { $sum: 1 } } }]),
      AuditLog.countDocuments(match),
      AuditLog.aggregate([
        { $match: { ...match, userId: { $exists: true, $ne: null } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.countDocuments({
        ...match,
        $or: [{ category: 'security' }, { level: 'error' }, { level: 'critical' }]
      }),
      AuditLog.find(match).sort({ timestamp: -1 }).limit(10).lean()
    ]);

    const byLevel: Record<AuditLevel, number> = { debug: 0, info: 0, warning: 0, error: 0, critical: 0 };
    const byCategory: Record<AuditCategory, number> = {
      authentication: 0, authorization: 0, data_access: 0,
      data_modification: 0, system: 0, business: 0, security: 0
    };
    const byResult: Record<string, number> = { success: 0, failure: 0, blocked: 0 };

    byLevelAgg.forEach(r => { byLevel[r._id as AuditLevel] = r.count; });
    byCategoryAgg.forEach(r => { byCategory[r._id as AuditCategory] = r.count; });
    byResultAgg.forEach(r => { byResult[r._id as string] = r.count; });

    const topUsers = userAgg.map(r => ({ userId: String(r._id), count: r.count }));
    const topActions = actionAgg.map(r => ({ action: r._id as string, count: r.count }));
    const recentActivity: AuditEntry[] = (recentRes as unknown as IAuditLog[]).map(r => ({
      id: r.auditId,
      timestamp: r.timestamp,
      level: r.level,
      category: r.category,
      userId: r.userId?.toString(),
      sessionId: r.sessionId,
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      details: r.details || {},
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      result: r.result,
      errorMessage: r.errorMessage,
      duration: r.duration,
      metadata: r.metadata
    }));

    return {
      totalEntries: totalRes,
      byLevel,
      byCategory,
      byResult,
      recentActivity,
      topUsers,
      topActions,
      securityAlerts: securityAgg
    };
  }

  async getUserActivityDB(userId: string, limit: number = 50): Promise<unknown[]> {
    return AuditLog.find({ userId }).sort({ timestamp: -1 }).limit(limit).lean();
  }

  async getResourceHistoryDB(resourceId: string, limit: number = 50): Promise<unknown[]> {
    return AuditLog.find({ resourceId }).sort({ timestamp: -1 }).limit(limit).lean();
  }

  async deleteAuditLogsOlderThan(date: Date): Promise<number> {
    const res = await AuditLog.deleteMany({ timestamp: { $lt: date } });
    return res.deletedCount || 0;
  }
}

let auditSystemInstance: AuditSystem | null = null;
export const getAuditSystem = (): AuditSystem => {
  if (!auditSystemInstance) auditSystemInstance = new AuditSystem();
  return auditSystemInstance;
};

export default AuditSystem;
