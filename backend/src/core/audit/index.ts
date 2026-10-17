/**
 * 审计日志模块 - Audit Log Module
 * 
 * 功能：
 * 1. 记录所有系统操作和事件
 * 2. 支持多级别日志（DEBUG, INFO, WARN, ERROR, CRITICAL）
 * 3. 结构化日志存储
 * 4. 日志查询和过滤
 * 5. 日志导出和归档
 * 
 * @module core/audit
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM_CONFIG = 'system_config',
  API_REQUEST = 'api_request',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  RL_TRAINING = 'rl_training',
  RAG_OPERATIONS = 'rag_operations',
  USER_ACTION = 'user_action',
  PLUGIN = 'plugin'
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: AuditCategory;
  message: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: {
    type: string;
    id: string;
    name?: string;
  };
  action: string;
  result: 'success' | 'failure' | 'partial';
  duration?: number;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  tags?: string[];
}

export interface AuditQuery {
  startTime?: number;
  endTime?: number;
  levels?: LogLevel[];
  categories?: AuditCategory[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  result?: 'success' | 'failure' | 'partial';
  searchText?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEntries: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<AuditCategory, number>;
  byResult: Record<string, number>;
  timeRange: {
    oldest: number;
    newest: number;
  };
}

export interface LogRetention {
  maxEntries: number;
  maxAge: number; // 毫秒
  archiveBeforeDelete: boolean;
}

// ==================== 审计日志类 ====================

export class AuditLogger extends EventEmitter {
  private logs: AuditLogEntry[] = [];
  private maxEntries: number = 100000;
  private maxAge: number = 30 * 24 * 60 * 60 * 1000; // 30天
  private currentLevel: LogLevel = LogLevel.INFO;
  private retention: LogRetention;
  private eventEmitter: EventEmitter;

  constructor(options?: {
    maxEntries?: number;
    maxAge?: number;
    level?: LogLevel;
  }) {
    super();
    this.retention = {
      maxEntries: options?.maxEntries || this.maxEntries,
      maxAge: options?.maxAge || this.maxAge,
      archiveBeforeDelete: true
    };
    this.currentLevel = options?.level !== undefined ? options.level : LogLevel.INFO;
    this.eventEmitter = new EventEmitter();
    this.cleanup();
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 创建日志条目
   */
  private createEntry(
    level: LogLevel,
    category: AuditCategory,
    action: string,
    message: string,
    options?: Partial<AuditLogEntry>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      action,
      result: 'success',
      ...options
    };

    return entry;
  }

  /**
   * 记录日志
   */
  log(entry: AuditLogEntry): void {
    // 检查日志级别
    if (entry.level < this.currentLevel) {
      return;
    }

    this.logs.push(entry);
    this.emit('audit:log', entry);
    this.eventEmitter.emit('entry', entry);

    // 触发特定级别的事件（避免 'error' 与 Node.js EventEmitter 冲突）
    const levelEventName = `level:${LogLevel[entry.level].toLowerCase()}`;
    this.eventEmitter.emit(levelEventName, entry);

    // 触发特定类别的事件
    this.eventEmitter.emit(`category:${entry.category}`, entry);

    // 触发操作事件
    this.eventEmitter.emit(`action:${entry.action}`, entry);

    // 触发失败事件
    if (entry.result === 'failure') {
      this.eventEmitter.emit('failure', entry);
    }

    // 清理过期日志
    this.cleanup();
  }

  /**
   * 调试级别日志
   */
  debug(category: AuditCategory, action: string, message: string, options?: Partial<AuditLogEntry>): void {
    this.log(this.createEntry(LogLevel.DEBUG, category, action, message, options));
  }

  /**
   * 信息级别日志
   */
  info(category: AuditCategory, action: string, message: string, options?: Partial<AuditLogEntry>): void {
    this.log(this.createEntry(LogLevel.INFO, category, action, message, options));
  }

  /**
   * 警告级别日志
   */
  warn(category: AuditCategory, action: string, message: string, options?: Partial<AuditLogEntry>): void {
    this.log(this.createEntry(LogLevel.WARN, category, action, message, options));
  }

  /**
   * 错误级别日志
   */
  error(category: AuditCategory, action: string, message: string, options?: Partial<AuditLogEntry>): void {
    this.log(this.createEntry(LogLevel.ERROR, category, action, message, options));
  }

  /**
   * 严重级别日志
   */
  critical(category: AuditCategory, action: string, message: string, options?: Partial<AuditLogEntry>): void {
    this.log(this.createEntry(LogLevel.CRITICAL, category, action, message, options));
  }

  /**
   * 记录认证事件
   */
  logAuth(action: 'login' | 'logout' | 'register' | 'password_change' | 'mfa_verify', 
          userId: string, userName: string, result: 'success' | 'failure', 
          metadata?: Record<string, any>): void {
    this.info(AuditCategory.AUTHENTICATION, action, 
      `User ${action}: ${userName}`,
      { userId, userName, result, metadata });
  }

  /**
   * 记录授权事件
   */
  logAuthz(action: 'access_granted' | 'access_denied' | 'permission_change',
           userId: string, resource: { type: string; id: string },
           result: 'success' | 'failure', metadata?: Record<string, any>): void {
    this.info(AuditCategory.AUTHORIZATION, action,
      `Authorization ${action} for resource ${resource.type}:${resource.id}`,
      { userId, resource, result, metadata });
  }

  /**
   * 记录数据访问
   */
  logDataAccess(action: 'read' | 'export' | 'query',
                userId: string, resource: { type: string; id: string; name?: string },
                metadata?: Record<string, any>): void {
    this.info(AuditCategory.DATA_ACCESS, action,
      `Data ${action}: ${resource.type}:${resource.id}`,
      { userId, resource, metadata });
  }

  /**
   * 记录数据修改
   */
  logDataModification(action: 'create' | 'update' | 'delete',
                      userId: string, resource: { type: string; id: string; name?: string },
                      metadata?: Record<string, any>): void {
    this.info(AuditCategory.DATA_MODIFICATION, action,
      `Data ${action}: ${resource.type}:${resource.id}`,
      { userId, resource, metadata });
  }

  /**
   * 记录API请求
   */
  logApiRequest(method: string, path: string, userId?: string,
                 duration?: number, statusCode?: number, metadata?: Record<string, any>): void {
    const level = statusCode && statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(this.createEntry(level, AuditCategory.API_REQUEST, `${method} ${path}`,
      `API ${method} ${path} - ${statusCode || 'pending'}`,
      { userId, duration, metadata, result: statusCode && statusCode >= 400 ? 'failure' : 'success' }));
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(event: 'intrusion_attempt' | 'rate_limit_exceeded' | 'invalid_token' | 'session_hijack',
                    ipAddress: string, metadata?: Record<string, any>): void {
    this.warn(AuditCategory.SECURITY, event,
      `Security event: ${event} from ${ipAddress}`,
      { ipAddress, metadata });
  }

  /**
   * 记录RL训练事件
   */
  logRLTraining(episode: number, metrics: { reward: number; loss: number; klDivergence?: number },
                metadata?: Record<string, any>): void {
    this.debug(AuditCategory.RL_TRAINING, 'episode_complete',
      `RL Episode ${episode} - Reward: ${metrics.reward.toFixed(2)}`,
      { metadata: { episode, ...metrics, ...metadata } });
  }

  /**
   * 记录RAG操作
   */
  logRAGOperation(operation: 'query' | 'index' | 'retrieve',
                  query?: string, results?: number, latency?: number,
                  metadata?: Record<string, any>): void {
    this.info(AuditCategory.RAG_OPERATIONS, operation,
      `RAG ${operation}${query ? `: ${query.substring(0, 50)}...` : ''} - ${results || 0} results`,
      { metadata: { query, results, latency, ...metadata } });
  }

  /**
   * 查询日志
   */
  query(filter: AuditQuery): AuditLogEntry[] {
    let results = this.logs;

    // 时间范围过滤
    if (filter.startTime) {
      results = results.filter(e => e.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      results = results.filter(e => e.timestamp <= filter.endTime!);
    }

    // 级别过滤
    if (filter.levels && filter.levels.length > 0) {
      results = results.filter(e => filter.levels!.includes(e.level));
    }

    // 类别过滤
    if (filter.categories && filter.categories.length > 0) {
      results = results.filter(e => filter.categories!.includes(e.category));
    }

    // 用户过滤
    if (filter.userId) {
      results = results.filter(e => e.userId === filter.userId);
    }

    // 资源类型过滤
    if (filter.resourceType) {
      results = results.filter(e => e.resource?.type === filter.resourceType);
    }

    // 资源ID过滤
    if (filter.resourceId) {
      results = results.filter(e => e.resource?.id === filter.resourceId);
    }

    // 操作过滤
    if (filter.action) {
      const actionFilter = filter.action;
      results = results.filter(e => e.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    // 结果过滤
    if (filter.result) {
      results = results.filter(e => e.result === filter.result);
    }

    // 搜索文本
    if (filter.searchText) {
      const search = filter.searchText.toLowerCase();
      results = results.filter(e => 
        e.message.toLowerCase().includes(search) ||
        e.action.toLowerCase().includes(search) ||
        (e.userName && e.userName.toLowerCase().includes(search))
      );
    }

    // 标签过滤
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(e => 
        e.tags && filter.tags!.some(t => e.tags!.includes(t))
      );
    }

    // 排序（按时间倒序）
    results = results.sort((a, b) => b.timestamp - a.timestamp);

    // 分页
    if (filter.offset) {
      results = results.slice(filter.offset);
    }
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * 获取日志统计
   */
  getStats(startTime?: number, endTime?: number): AuditStats {
    const logs = this.query({ startTime, endTime });

    const stats: AuditStats = {
      totalEntries: logs.length,
      byLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
        [LogLevel.CRITICAL]: 0
      },
      byCategory: {} as Record<AuditCategory, number>,
      byResult: { success: 0, failure: 0, partial: 0 },
      timeRange: {
        oldest: logs.length > 0 ? logs[logs.length - 1].timestamp : Date.now(),
        newest: logs.length > 0 ? logs[0].timestamp : Date.now()
      }
    };

    logs.forEach(log => {
      stats.byLevel[log.level]++;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      stats.byResult[log.result]++;
    });

    return stats;
  }

  /**
   * 获取最近的日志
   */
  getRecent(limit: number = 100): AuditLogEntry[] {
    return this.logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 获取日志条目
   */
  getById(id: string): AuditLogEntry | undefined {
    return this.logs.find(e => e.id === id);
  }

  /**
   * 订阅日志事件
   */
  subscribe(callback: (entry: AuditLogEntry) => void): () => void {
    this.eventEmitter.on('entry', callback);
    return () => this.eventEmitter.off('entry', callback);
  }

  /**
   * 订阅特定级别的日志
   */
  subscribeToLevel(level: LogLevel, callback: (entry: AuditLogEntry) => void): () => void {
    const eventName = `level:${LogLevel[level].toLowerCase()}`;
    this.eventEmitter.on(eventName, callback);
    return () => this.eventEmitter.off(eventName, callback);
  }

  /**
   * 订阅失败事件
   */
  subscribeToFailures(callback: (entry: AuditLogEntry) => void): () => void {
    this.eventEmitter.on('failure', callback);
    return () => this.eventEmitter.off('failure', callback);
  }

  /**
   * 导出日志
   */
  export(format: 'json' | 'csv' = 'json', filter?: AuditQuery): string {
    const logs = filter ? this.query(filter) : this.logs;

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV格式
    const headers = [
      'id', 'timestamp', 'level', 'category', 'message', 'userId',
      'action', 'result', 'duration', 'resource_type', 'resource_id'
    ];
    
    const rows = logs.map(log => [
      log.id,
      new Date(log.timestamp).toISOString(),
      LogLevel[log.level],
      log.category,
      `"${log.message.replace(/"/g, '""')}"`,
      log.userId || '',
      log.action,
      log.result,
      log.duration?.toString() || '',
      log.resource?.type || '',
      log.resource?.id || ''
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * 清理过期日志
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.retention.maxAge;
    
    // 删除过期日志
    if (this.retention.archiveBeforeDelete) {
      // TODO: 实现归档逻辑
    }
    
    this.logs = this.logs.filter(log => log.timestamp > cutoff);

    // 如果还是超过最大条目数，删除最旧的
    if (this.logs.length > this.retention.maxEntries) {
      this.logs = this.logs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.retention.maxEntries);
    }
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * 获取日志总数
   */
  getCount(): number {
    return this.logs.length;
  }

  /**
   * 清空所有日志
   */
  clear(): void {
    this.logs = [];
    this.emit('audit:cleared');
    this.eventEmitter.emit('cleared');
  }

  /**
   * 批量导入日志
   */
  import(logs: AuditLogEntry[]): number {
    let imported = 0;
    logs.forEach(log => {
      if (!this.logs.some(l => l.id === log.id)) {
        this.logs.push(log);
        imported++;
      }
    });
    return imported;
  }
}

// ==================== 导出单例 ====================

export const auditLogger = new AuditLogger({
  maxEntries: 100000,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  level: LogLevel.INFO
});

export default AuditLogger;
