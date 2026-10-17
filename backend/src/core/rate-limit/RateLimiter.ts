/**
 * 限流系统 - 多种限流策略支持
 */

import { v4 as uuidv4 } from 'uuid';

export type RateLimitAlgorithm = 'token_bucket' | 'leaky_bucket' | 'sliding_window' | 'fixed_window' | 'adaptive';
export type RateLimitScope = 'global' | 'user' | 'ip' | 'endpoint' | 'api_key';

export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  scope: RateLimitScope;
  requests: number;
  windowMs: number;
  burst?: number;
  blockDuration?: number;
  enabled: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
  total?: number;
}

export interface RateLimitEntry {
  id: string;
  key: string;
  count: number;
  firstRequestAt: Date;
  lastRequestAt: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

export interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  hitRate: number;
  byScope: Record<RateLimitScope, number>;
  topLimiters: Array<{ key: string; requests: number }>;
}

export class RateLimiter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private entries: Map<string, RateLimitEntry> = new Map();
  private tokenBuckets: Map<string, { tokens: number; lastRefill: Date }> = new Map();
  private leakyBuckets: Map<string, { level: number; lastLeak: Date }> = new Map();
  private stats: RateLimitStats = {
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    hitRate: 0,
    byScope: {} as Record<RateLimitScope, number>,
    topLimiters: []
  };
  private listeners: Array<(result: RateLimitResult, key: string, config: RateLimitConfig) => void> = [];

  constructor() {
    this.setupDefaultConfigs();
    this.startCleanupScheduler();
  }

  /**
   * 设置默认配置
   */
  private setupDefaultConfigs(): void {
    const defaultConfigs: RateLimitConfig[] = [
      {
        algorithm: 'sliding_window',
        scope: 'global',
        requests: 1000,
        windowMs: 60000,
        enabled: true
      },
      {
        algorithm: 'token_bucket',
        scope: 'user',
        requests: 100,
        windowMs: 60000,
        burst: 20,
        enabled: true
      },
      {
        algorithm: 'fixed_window',
        scope: 'ip',
        requests: 500,
        windowMs: 60000,
        blockDuration: 300000,
        enabled: true
      },
      {
        algorithm: 'leaky_bucket',
        scope: 'endpoint',
        requests: 50,
        windowMs: 1000,
        enabled: true
      },
      {
        algorithm: 'adaptive',
        scope: 'api_key',
        requests: 1000,
        windowMs: 60000,
        burst: 100,
        enabled: true
      }
    ];

    for (const config of defaultConfigs) {
      this.configs.set(this.getConfigKey(config.scope, config.algorithm), config);
    }
  }

  /**
   * 检查限流
   */
  check(identifier: string, scope: RateLimitScope, endpoint?: string): RateLimitResult {
    const configKey = this.getConfigKey(scope, undefined, endpoint);
    const config = this.configs.get(configKey) || this.getDefaultConfig(scope);
    
    if (!config.enabled) {
      return {
        allowed: true,
        remaining: -1,
        resetAt: new Date()
      };
    }

    this.stats.totalRequests++;
    this.stats.byScope[scope] = (this.stats.byScope[scope] || 0) + 1;

    let result: RateLimitResult;

    switch (config.algorithm) {
      case 'token_bucket':
        result = this.checkTokenBucket(identifier, config);
        break;
      case 'leaky_bucket':
        result = this.checkLeakyBucket(identifier, config);
        break;
      case 'sliding_window':
        result = this.checkSlidingWindow(identifier, config);
        break;
      case 'fixed_window':
        result = this.checkFixedWindow(identifier, config);
        break;
      case 'adaptive':
        result = this.checkAdaptive(identifier, config);
        break;
      default:
        result = { allowed: true, remaining: -1, resetAt: new Date() };
    }

    // 更新统计
    if (result.allowed) {
      this.stats.allowedRequests++;
    } else {
      this.stats.blockedRequests++;
    }

    this.updateHitRate();

    // 触发监听器
    for (const listener of this.listeners) {
      listener(result, identifier, config);
    }

    return result;
  }

  /**
   * Token Bucket算法
   */
  private checkTokenBucket(identifier: string, config: RateLimitConfig): RateLimitResult {
    const key = `token:${identifier}`;
    let bucket = this.tokenBuckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: config.burst || config.requests,
        lastRefill: new Date()
      };
      this.tokenBuckets.set(key, bucket);
    }

    // 补充tokens
    const now = new Date();
    const elapsed = now.getTime() - bucket.lastRefill.getTime();
    const refillRate = config.requests / config.windowMs;
    const tokensToAdd = elapsed * refillRate;
    bucket.tokens = Math.min(config.requests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens--;
      const remaining = Math.floor(bucket.tokens);
      const resetAt = new Date(now.getTime() + (config.requests - bucket.tokens) / refillRate);
      
      return {
        allowed: true,
        remaining,
        resetAt,
        total: config.requests
      };
    }

    const retryAfter = Math.ceil(1000 / refillRate);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now.getTime() + retryAfter),
      retryAfter
    };
  }

  /**
   * Leaky Bucket算法
   */
  private checkLeakyBucket(identifier: string, config: RateLimitConfig): RateLimitResult {
    const key = `leaky:${identifier}`;
    let bucket = this.leakyBuckets.get(key);
    
    if (!bucket) {
      bucket = { level: 0, lastLeak: new Date() };
      this.leakyBuckets.set(key, bucket);
    }

    const now = new Date();
    const leakRate = config.requests / config.windowMs;
    const leaked = (now.getTime() - bucket.lastLeak.getTime()) * leakRate;
    bucket.level = Math.max(0, bucket.level - leaked);
    bucket.lastLeak = now;

    if (bucket.level < config.requests) {
      bucket.level++;
      
      return {
        allowed: true,
        remaining: config.requests - bucket.level,
        resetAt: new Date(now.getTime() + bucket.level / leakRate),
        total: config.requests
      };
    }

    const retryAfter = Math.ceil(1000 / leakRate);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now.getTime() + retryAfter),
      retryAfter
    };
  }

  /**
   * Sliding Window算法
   */
  private checkSlidingWindow(identifier: string, config: RateLimitConfig): RateLimitResult {
    const key = `sliding:${identifier}`;
    const entry = this.getOrCreateEntry(key);
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);
    
    // 清理过期请求
    const requestsInWindow = this.getRequestsInWindow(entry, windowStart);
    
    if (requestsInWindow < config.requests) {
      this.recordRequest(entry);
      
      return {
        allowed: true,
        remaining: config.requests - requestsInWindow - 1,
        resetAt: this.getNextResetTime(entry, config.windowMs),
        total: config.requests
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: this.getNextResetTime(entry, config.windowMs),
      retryAfter: config.windowMs
    };
  }

  /**
   * Fixed Window算法
   */
  private checkFixedWindow(identifier: string, config: RateLimitConfig): RateLimitResult {
    const key = `fixed:${identifier}`;
    const entry = this.getOrCreateEntry(key);
    
    const now = new Date();
    const windowStart = this.getWindowStart(now, config.windowMs);
    
    // 检查是否在新窗口
    if (entry.firstRequestAt < windowStart) {
      entry.count = 0;
      entry.firstRequestAt = now;
    }
    
    if (entry.blocked) {
      if (entry.blockedUntil && entry.blockedUntil > now) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: entry.blockedUntil,
          retryAfter: entry.blockedUntil.getTime() - now.getTime()
        };
      }
      entry.blocked = false;
      entry.blockedUntil = undefined;
      entry.count = 0;
    }

    if (entry.count < config.requests) {
      entry.count++;
      entry.lastRequestAt = now;
      
      return {
        allowed: true,
        remaining: config.requests - entry.count,
        resetAt: new Date(windowStart.getTime() + config.windowMs),
        total: config.requests
      };
    }

    // 超出限制，阻止
    entry.blocked = true;
    entry.blockedUntil = new Date(now.getTime() + (config.blockDuration || 60000));
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: config.blockDuration
    };
  }

  /**
   * Adaptive算法
   */
  private checkAdaptive(identifier: string, config: RateLimitConfig): RateLimitResult {
    // 基于系统负载动态调整
    const systemLoad = this.calculateSystemLoad();
    let adjustedRequests = config.requests;
    
    if (systemLoad > 0.8) {
      adjustedRequests = Math.floor(config.requests * 0.5);
    } else if (systemLoad > 0.6) {
      adjustedRequests = Math.floor(config.requests * 0.75);
    }

    const result = this.checkSlidingWindow(identifier, {
      ...config,
      requests: adjustedRequests
    });

    if (!result.allowed) {
      result.total = adjustedRequests;
    }

    return result;
  }

  /**
   * 计算系统负载
   */
  private calculateSystemLoad(): number {
    const totalRequests = this.stats.totalRequests;
    if (totalRequests === 0) return 0;
    
    // 基于最近请求率估算
    const recentWindow = 60000;
    const now = Date.now();
    let recentCount = 0;
    
    for (const entry of this.entries.values()) {
      if (now - entry.lastRequestAt.getTime() < recentWindow) {
        recentCount++;
      }
    }
    
    return Math.min(1, recentCount / 1000);
  }

  /**
   * 获取或创建条目
   */
  private getOrCreateEntry(key: string): RateLimitEntry {
    let entry = this.entries.get(key);
    
    if (!entry) {
      entry = {
        id: uuidv4(),
        key,
        count: 0,
        firstRequestAt: new Date(),
        lastRequestAt: new Date(),
        blocked: false
      };
      this.entries.set(key, entry);
    }
    
    return entry;
  }

  /**
   * 记录请求
   */
  private recordRequest(entry: RateLimitEntry): void {
    entry.count++;
    entry.lastRequestAt = new Date();
  }

  /**
   * 获取窗口内的请求数
   */
  private getRequestsInWindow(entry: RateLimitEntry, windowStart: Date): number {
    if (entry.firstRequestAt < windowStart) {
      return 0;
    }
    return entry.count;
  }

  /**
   * 获取下次重置时间
   */
  private getNextResetTime(entry: RateLimitEntry, windowMs: number): Date {
    const oldestInWindow = new Date(entry.lastRequestAt.getTime() - windowMs);
    return new Date(oldestInWindow.getTime() + windowMs);
  }

  /**
   * 获取窗口开始时间
   */
  private getWindowStart(time: Date, windowMs: number): Date {
    const windowSize = Math.floor(time.getTime() / windowMs) * windowMs;
    return new Date(windowSize);
  }

  /**
   * 获取配置键
   */
  private getConfigKey(scope: RateLimitScope, algorithm?: RateLimitAlgorithm, endpoint?: string): string {
    if (endpoint) {
      return `${scope}:${endpoint}`;
    }
    return scope;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(scope: RateLimitScope): RateLimitConfig {
    return {
      algorithm: 'sliding_window',
      scope,
      requests: 100,
      windowMs: 60000,
      enabled: true
    };
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = this.stats.allowedRequests / this.stats.totalRequests;
    }
  }

  /**
   * 启动清理调度器
   */
  private startCleanupScheduler(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 3600000; // 1小时

      for (const [key, entry] of this.entries) {
        if (now - entry.lastRequestAt.getTime() > maxAge) {
          this.entries.delete(key);
          this.tokenBuckets.delete(`token:${entry.key}`);
          this.leakyBuckets.delete(`leaky:${entry.key}`);
        }
      }
    }, 300000).unref(); // 每5分钟清理
  }

  /**
   * 设置限流配置
   */
  setConfig(key: string, config: RateLimitConfig): void {
    this.configs.set(key, config);
  }

  /**
   * 获取限流配置
   */
  getConfig(key: string): RateLimitConfig | undefined {
    return this.configs.get(key);
  }

  /**
   * 删除限流配置
   */
  deleteConfig(key: string): boolean {
    return this.configs.delete(key);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): Map<string, RateLimitConfig> {
    return new Map(this.configs);
  }

  /**
   * 启用限流配置
   */
  enable(key: string): boolean {
    const config = this.configs.get(key);
    if (config) {
      config.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * 禁用限流配置
   */
  disable(key: string): boolean {
    const config = this.configs.get(key);
    if (config) {
      config.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * 重置限流
   */
  reset(identifier?: string): void {
    if (identifier) {
      this.entries.delete(`sliding:${identifier}`);
      this.entries.delete(`fixed:${identifier}`);
      this.tokenBuckets.delete(`token:${identifier}`);
      this.leakyBuckets.delete(`leaky:${identifier}`);
    } else {
      this.entries.clear();
      this.tokenBuckets.clear();
      this.leakyBuckets.clear();
    }
  }

  /**
   * 获取统计
   */
  getStats(): RateLimitStats {
    return {
      ...this.stats,
      topLimiters: Array.from(this.entries.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(e => ({ key: e.key, requests: e.count }))
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      hitRate: 0,
      byScope: {} as Record<RateLimitScope, number>,
      topLimiters: []
    };
  }

  /**
   * 注册监听器
   */
  onLimitCheck(callback: (result: RateLimitResult, key: string, config: RateLimitConfig) => void): void {
    this.listeners.push(callback);
  }

  /**
   * 生成限流中间件配置
   */
  generateMiddlewareConfig(): {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  } {
    const defaultConfig = this.configs.get('global') || this.getDefaultConfig('global');
    
    return {
      windowMs: defaultConfig.windowMs,
      max: defaultConfig.requests,
      message: JSON.stringify({
        error: 'Too many requests',
        retryAfter: defaultConfig.windowMs / 1000
      }),
      standardHeaders: true,
      legacyHeaders: false
    };
  }
}

export default RateLimiter;
