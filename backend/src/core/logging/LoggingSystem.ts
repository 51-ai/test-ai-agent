/**
 * 结构化日志系统 - 多级别的日志管理
 */

import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
export type LogFormat = 'text' | 'json' | 'csv';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  levelNumber: number;
  message: string;
  module?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  source?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  context?: Record<string, unknown>;
}

export interface LogQuery {
  levels?: LogLevel[];
  module?: string;
  userId?: string;
  tags?: string[];
  startTime?: Date;
  endTime?: Date;
  text?: string;
  limit?: number;
  offset?: number;
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byModule: Record<string, number>;
  byHour: Record<string, number>;
  errorRate: number;
  recentActivity: Array<{ time: string; total: number; errors: number }>;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  format: LogFormat;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  enableRemote?: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
  maxHistorySize: number;
  enableMetrics: boolean;
  enableAnomalyDetection: boolean;
  fields?: Record<string, string>;
}

const LEVEL_NUMBERS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  notice: 2,
  warning: 3,
  error: 4,
  critical: 5,
  alert: 6,
  emergency: 7
};

class LoggingSystem {
  private logs: LogEntry[] = [];
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private alertCallbacks: Array<(entry: LogEntry) => void> = [];
  private errorThreshold: number = 5;
  private errorCountWindow: Map<string, number[]> = new Map();
  private performanceMarks: Map<string, Date> = new Map();

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: 'info',
      format: 'json',
      enableConsole: true,
      enableFile: false,
      bufferSize: 100,
      flushInterval: 5000,
      maxHistorySize: 50000,
      enableMetrics: true,
      enableAnomalyDetection: false,
      ...config
    };

    this.startBufferedWriter();
    this.startAnomalyDetection();
  }

  private startBufferedWriter(): void {
    setInterval(() => {
      if (this.buffer.length > 0) {
        this.flushBuffer();
      }
    }, this.config.flushInterval).unref();
  }

  private startAnomalyDetection(): void {
    if (!this.config.enableAnomalyDetection) return;

    setInterval(() => {
      this.detectErrorSpike();
    }, 60000);
  }

  private detectErrorSpike(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentErrors = this.logs.filter(
      log => log.timestamp >= oneMinuteAgo && 
      LEVEL_NUMBERS[log.level] >= LEVEL_NUMBERS.error
    ).length;

    if (recentErrors >= this.errorThreshold) {
      console.warn(`[Logging] ⚠ Detected ${recentErrors} errors in last minute`);
      this.errorCountWindow.set(now.toISOString(), [recentErrors]);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_NUMBERS[level] >= LEVEL_NUMBERS[this.config.minLevel];
  }

  private createEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      levelNumber: LEVEL_NUMBERS[level],
      message,
      module: metadata?.module as string || 'system',
      userId: metadata?.userId as string,
      sessionId: metadata?.sessionId as string,
      requestId: metadata?.requestId as string,
      tags: metadata?.tags as string[],
      metadata: { ...this.config.fields, ...metadata },
      source: 'agent-system',
      duration: metadata?.duration as number
    };
  }

  private write(entry: LogEntry): void {
    // 添加到历史
    this.logs.push(entry);
    if (this.logs.length > this.config.maxHistorySize) {
      this.logs = this.logs.slice(-this.config.maxHistorySize);
    }

    // 添加到缓冲区
    this.buffer.push(entry);

    // 输出到控制台
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }

    // 高优先级触发警报
    if (LEVEL_NUMBERS[entry.level] >= LEVEL_NUMBERS.error) {
      for (const callback of this.alertCallbacks) {
        callback(entry);
      }
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const formatted = this.formatLog(entry);
    if (LEVEL_NUMBERS[entry.level] >= LEVEL_NUMBERS.warning) {
      console.error(formatted);
    } else if (LEVEL_NUMBERS[entry.level] === LEVEL_NUMBERS.warning) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  private formatLog(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry, null, 2);
    }

    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase();
    const module = entry.module || 'system';
    const prefix = `${timestamp} [${level}] ${module}`;
    
    if (this.config.format === 'csv') {
      return [
        timestamp,
        level,
        module,
        entry.message,
        entry.userId || '',
        JSON.stringify(entry.metadata || {})
      ].join(',');
    }

    // text格式
    let message = `${prefix}: ${entry.message}`;
    if (entry.metadata) {
      const extras = Object.entries(entry.metadata)
        .filter(([key]) => !['module', 'userId', 'sessionId', 'requestId'].includes(key))
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      if (extras) message += ` | ${extras}`;
    }
    return message;
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;
    
    // 这里可以写入文件或发送到远程服务
    const buffered = [...this.buffer];
    this.buffer = [];
    
    if (this.config.enableFile && this.config.filePath) {
      // 实际实现会写入文件
      console.debug(`[Logging] Flush ${buffered.length} entries to file`);
    }
    
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      // 实际实现会发送到远程日志服务
      console.debug(`[Logging] Flush ${buffered.length} entries to remote`);
    }
  }

  // 日志方法
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    this.write(this.createEntry('debug', message, metadata));
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    this.write(this.createEntry('info', message, metadata));
  }

  notice(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('notice')) return;
    this.write(this.createEntry('notice', message, metadata));
  }

  warning(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('warning')) return;
    this.write(this.createEntry('warning', message, metadata));
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createEntry('error', message, metadata);
    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as { code?: string }).code
      };
    }
    this.write(entry);
  }

  critical(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('critical')) return;
    const entry = this.createEntry('critical', message, metadata);
    if (error) {
      entry.error = { message: error.message, stack: error.stack };
    }
    this.write(entry);
  }

  alert(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog('alert')) return;
    this.write(this.createEntry('alert', message, metadata));
  }

  emergency(message: string, metadata?: Record<string, unknown>): void {
    this.write(this.createEntry('emergency', message, metadata));
  }

  // 性能计时
  startTimer(name: string): string {
    const timerId = uuidv4();
    this.performanceMarks.set(timerId, new Date());
    this.debug(`Timer started: ${name}`, { timerId, name });
    return timerId;
  }

  endTimer(timerId: string, metadata?: Record<string, unknown>): number | null {
    const startTime = this.performanceMarks.get(timerId);
    if (!startTime) return null;

    const duration = Date.now() - startTime.getTime();
    this.performanceMarks.delete(timerId);
    
    this.info(`Timer completed`, {
      timerId,
      durationMs: duration,
      ...metadata
    });
    
    return duration;
  }

  // 查询方法
  query(query: LogQuery): LogEntry[] {
    let results = [...this.logs];

    if (query.levels?.length) {
      results = results.filter(log => query.levels!.includes(log.level));
    }
    if (query.module) {
      results = results.filter(log => log.module === query.module);
    }
    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }
    if (query.tags?.length) {
      results = results.filter(log => log.tags?.some(tag => query.tags!.includes(tag)));
    }
    if (query.startTime) {
      results = results.filter(log => log.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(log => log.timestamp <= query.endTime!);
    }
    if (query.text) {
      results = results.filter(log => log.message.includes(query.text!));
    }

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const limit = query.limit || 100;
    const offset = query.offset || 0;
    return results.slice(offset, offset + limit);
  }

  // 统计方法
  getStats(timeRangeMinutes: number = 60): LogStats {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeRangeMinutes * 60 * 1000);
    const relevantLogs = this.logs.filter(log => log.timestamp >= startTime);
    
    const byLevel: Record<LogLevel, number> = {
      debug: 0, info: 0, notice: 0, warning: 0,
      error: 0, critical: 0, alert: 0, emergency: 0
    };
    const byModule: Record<string, number> = {};
    const byHour: Record<string, number> = {};

    for (const log of relevantLogs) {
      byLevel[log.level]++;
      if (log.module) {
        byModule[log.module] = (byModule[log.module] || 0) + 1;
      }
      const hour = log.timestamp.toISOString().substring(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    }

    const totalErrors = byLevel.error + byLevel.critical + byLevel.alert + byLevel.emergency;
    
    // 最近活动
    const recentActivity: Array<{ time: string; total: number; errors: number }> = [];
    for (let i = Math.min(24, timeRangeMinutes / 60); i >= 0; i--) {
      const hourTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStr = hourTime.toISOString().substring(0, 13);
      const hourLogs = relevantLogs.filter(log => log.timestamp.toISOString().substring(0, 13) === hourStr);
      const hourErrors = hourLogs.filter(log => LEVEL_NUMBERS[log.level] >= LEVEL_NUMBERS.error).length;
      recentActivity.push({
        time: hourStr,
        total: hourLogs.length,
        errors: hourErrors
      });
    }

    return {
      total: relevantLogs.length,
      byLevel,
      byModule,
      byHour,
      errorRate: relevantLogs.length > 0 ? totalErrors / relevantLogs.length : 0,
      recentActivity
    };
  }

  // 配置方法
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  // 注册警报回调
  onAlert(callback: (entry: LogEntry) => void): void {
    this.alertCallbacks.push(callback);
  }

  // 导出日志
  export(format: LogFormat = 'json', query?: LogQuery): string {
    const logs = query ? this.query(query) : this.logs;

    if (format === 'json') {
      return JSON.stringify(logs.slice(-1000), null, 2);
    }

    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'module', 'message', 'userId'];
      const rows = logs.slice(-1000).map(log => [
        log.timestamp.toISOString(),
        log.level,
        log.module || '',
        log.message.replace(/"/g, '""'),
        log.userId || ''
      ].map(v => `"${v}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    }

    return logs.slice(-1000).map(log => this.formatLog(log)).join('\n');
  }

  // 清除历史
  clear(): void {
    this.logs = [];
    this.buffer = [];
    this.info('Log history cleared');
  }

  // 获取计数
  getCount(): number {
    return this.logs.length;
  }

  getErrorCount(lastMinutes: number = 60): number {
    const startTime = new Date(Date.now() - lastMinutes * 60 * 1000);
    return this.logs.filter(log => 
      log.timestamp >= startTime && LEVEL_NUMBERS[log.level] >= LEVEL_NUMBERS.error
    ).length;
  }

  // 获取模块专用logger
  createLogger(module: string): {
    debug: (message: string, metadata?: Record<string, unknown>) => void;
    info: (message: string, metadata?: Record<string, unknown>) => void;
    notice: (message: string, metadata?: Record<string, unknown>) => void;
    warning: (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, error?: Error, metadata?: Record<string, unknown>) => void;
    critical: (message: string, error?: Error, metadata?: Record<string, unknown>) => void;
    startTimer: (name: string) => string;
    endTimer: (timerId: string, metadata?: Record<string, unknown>) => number | null;
  } {
    return {
      debug: (message, metadata) => this.debug(message, { module, ...metadata }),
      info: (message, metadata) => this.info(message, { module, ...metadata }),
      notice: (message, metadata) => this.notice(message, { module, ...metadata }),
      warning: (message, metadata) => this.warning(message, { module, ...metadata }),
      error: (message, error, metadata) => this.error(message, error, { module, ...metadata }),
      critical: (message, error, metadata) => this.critical(message, error, { module, ...metadata }),
      startTimer: (name) => this.startTimer(`${module}:${name}`),
      endTimer: (timerId, metadata) => this.endTimer(timerId, { module, ...metadata })
    };
  }

  // 性能分析
  getPerformanceReport(): {
    timerCount: number;
    averageDuration: number;
    slowOperations: Array<{ name: string; duration: number }>;
    recentTimers: Array<{ name: string; startTime: Date }>;
  } {
    const recentTimers = Array.from(this.performanceMarks.entries())
      .map(([name, startTime]) => ({ name, startTime }))
      .slice(-20);

    return {
      timerCount: this.performanceMarks.size,
      averageDuration: 0,
      slowOperations: [],
      recentTimers
    };
  }

  // 健康检查
  healthCheck(): {
    status: 'healthy' | 'warning' | 'critical';
    messageCount: number;
    bufferUsage: number;
    errorRate: number;
    performance: string;
  } {
    const stats = this.getStats(15);
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (stats.errorRate > 0.1) status = 'warning';
    if (stats.errorRate > 0.25) status = 'critical';
    
    return {
      status,
      messageCount: this.logs.length,
      bufferUsage: this.buffer.length / this.config.bufferSize,
      errorRate: stats.errorRate,
      performance: 'excellent'
    };
  }
}

export const logger = new LoggingSystem({
  minLevel: 'info',
  format: 'text',
  enableConsole: true,
  bufferSize: 100,
  flushInterval: 5000,
  maxHistorySize: 50000,
  enableMetrics: true
});

export default LoggingSystem;
