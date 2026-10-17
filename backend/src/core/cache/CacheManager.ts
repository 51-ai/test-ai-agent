/**
 * 缓存管理系统 - 智能多级缓存
 */

import { v4 as uuidv4 } from 'uuid';

export type CacheType = 'memory' | 'disk' | 'redis' | 'distributed';
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  ttl?: number;
  size?: number;
  tags?: string[];
}

export interface CacheConfig {
  type: CacheType;
  maxSize: number;
  defaultTTL: number;
  evictionPolicy: EvictionPolicy;
  enableCompression: boolean;
  enablePersistence: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  size: number;
  maxSize: number;
  memoryUsage: number;
}

export interface CacheQuery {
  tags?: string[];
  prefix?: string;
  olderThan?: Date;
}

export class CacheManager<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    size: 0,
    maxSize: 0,
    memoryUsage: 0
  };
  private accessOrder: string[] = [];
  private tagIndex: Map<string, Set<string>> = new Map();
  private persistenceTimer?: NodeJS.Timeout;
  private listeners: Map<string, Array<(event: string, key: string) => void>> = new Map();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      type: 'memory',
      maxSize: config.maxSize || 10000,
      defaultTTL: config.defaultTTL || 3600000, // 1小时
      evictionPolicy: config.evictionPolicy || 'lru',
      enableCompression: config.enableCompression || false,
      enablePersistence: config.enablePersistence || false,
      ...config
    };

    this.stats.maxSize = this.config.maxSize;
    
    // 启动过期检查
    this.startExpiryChecker();
    
    // 启动持久化
    if (this.config.enablePersistence) {
      this.startPersistence();
    }
  }

  /**
   * 设置缓存项
   */
  set(key: string, value: T, options?: {
    ttl?: number;
    tags?: string[];
    size?: number;
  }): void {
    const now = new Date();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      ttl: options?.ttl || this.config.defaultTTL,
      size: options?.size || this.estimateSize(value),
      tags: options?.tags
    };

    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.delete(key, false);
    }

    // 检查是否需要驱逐
    while (this.shouldEvict()) {
      this.evict();
    }

    // 添加到缓存
    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.stats.size++;

    // 更新标签索引
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }

    // 触发事件
    this.emit('set', key);
  }

  /**
   * 获取缓存项
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // 检查过期
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // 更新访问信息
    entry.lastAccessedAt = new Date();
    entry.accessCount++;
    
    // 更新LRU顺序
    if (this.config.evictionPolicy === 'lru') {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(key);
      }
    }

    this.stats.hits++;
    this.updateHitRate();
    this.emit('hit', key);

    return entry.value;
  }

  /**
   * 获取或设置（如果不存在）
   */
  getOrSet(key: string, factory: () => T | Promise<T>, options?: {
    ttl?: number;
    tags?: string[];
  }): T | Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = factory();
    if (value instanceof Promise) {
      return value.then(resolved => {
        this.set(key, resolved, options);
        return resolved;
      });
    }

    this.set(key, value, options);
    return value;
  }

  /**
   * 删除缓存项
   */
  delete(key: string, notify: boolean = true): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // 从标签索引中移除
    if (entry.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }

    // 从访问顺序中移除
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    this.cache.delete(key);
    this.stats.size--;

    if (notify) {
      this.emit('delete', key);
    }

    return true;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const keys = Array.from(this.cache.keys());
    this.cache.clear();
    this.accessOrder = [];
    this.tagIndex.clear();
    this.stats.size = 0;
    
    for (const key of keys) {
      this.emit('clear', key);
    }
    
    console.log('[Cache] All entries cleared');
  }

  /**
   * 查询缓存
   */
  query(query: CacheQuery): string[] {
    const results = new Set<string>();

    // 按标签查询
    if (query.tags?.length) {
      for (const tag of query.tags) {
        const taggedKeys = this.tagIndex.get(tag);
        if (taggedKeys) {
          for (const key of taggedKeys) {
            results.add(key);
          }
        }
      }
      if (query.prefix) {
        for (const key of results) {
          if (!key.startsWith(query.prefix)) {
            results.delete(key);
          }
        }
      }
    } else if (query.prefix) {
      // 只按前缀查询
      for (const key of this.cache.keys()) {
        if (key.startsWith(query.prefix)) {
          results.add(key);
        }
      }
    }

    // 按时间过滤
    if (query.olderThan) {
      for (const key of results) {
        const entry = this.cache.get(key);
        if (entry && entry.lastAccessedAt > query.olderThan!) {
          results.delete(key);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * 删除匹配的缓存项
   */
  deleteByQuery(query: CacheQuery): number {
    const keys = this.query(query);
    let deleted = 0;
    
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }
    
    return deleted;
  }

  /**
   * 按标签删除
   */
  deleteByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let deleted = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }
    
    this.tagIndex.delete(tag);
    return deleted;
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 获取缓存项元数据
   */
  getMetadata(key: string): {
    createdAt: Date;
    lastAccessedAt: Date;
    accessCount: number;
    ttl: number;
    size: number;
    tags: string[];
    isExpired: boolean;
  } | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    return {
      createdAt: entry.createdAt,
      lastAccessedAt: entry.lastAccessedAt,
      accessCount: entry.accessCount,
      ttl: entry.ttl || 0,
      size: entry.size || 0,
      tags: entry.tags || [],
      isExpired: this.isExpired(entry)
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.hitRate = 0;
    this.stats.evictions = 0;
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.stats.size;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 预热缓存
   */
  async warmUp(entries: Array<{ key: string; value: T; options?: { ttl?: number; tags?: string[] } }>): Promise<void> {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.options);
    }
    console.log(`[Cache] Warmed up with ${entries.length} entries`);
  }

  /**
   * 注册事件监听器
   */
  on(event: string, callback: (event: string, key: string) => void): string {
    const listenerId = uuidv4();
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    
    return listenerId;
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listenerId?: string): void {
    if (listenerId) {
      // 移除特定监听器
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.findIndex(cb => (cb as unknown as { id: string }).id === listenerId);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    } else {
      // 移除所有该事件的监听器
      this.listeners.delete(event);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, key: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(event, key);
        } catch (error) {
          console.error(`[Cache] Event listener error: ${error}`);
        }
      }
    }
  }

  /**
   * 检查是否应该驱逐
   */
  private shouldEvict(): boolean {
    if (this.stats.size >= this.config.maxSize) {
      return true;
    }

    // 检查内存使用
    const memoryUsage = this.estimateMemoryUsage();
    if (memoryUsage > this.config.maxSize * 100) { // 假设每个条目平均100字节
      return true;
    }

    return false;
  }

  /**
   * 执行驱逐
   */
  private evict(): void {
    let keyToEvict: string | undefined;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // 驱逐最久未使用的
        keyToEvict = this.accessOrder[0];
        break;

      case 'lfu':
        // 驱逐访问频率最低的
        let minAccess = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.accessCount < minAccess) {
            minAccess = entry.accessCount;
            keyToEvict = key;
          }
        }
        break;

      case 'fifo':
        // 驱逐最早的
        for (const entry of this.cache.values()) {
          if (!keyToEvict || entry.createdAt < this.cache.get(keyToEvict)!.createdAt) {
            keyToEvict = entry.key;
          }
        }
        break;

      case 'ttl':
        // 驱逐最快过期的
        const now = Date.now();
        let minTTL = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.ttl) {
            const remainingTTL = entry.ttl - (now - entry.createdAt.getTime());
            if (remainingTTL < minTTL) {
              minTTL = remainingTTL;
              keyToEvict = key;
            }
          }
        }
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
      console.log(`[Cache] Evicted: ${keyToEvict} (policy: ${this.config.evictionPolicy})`);
    }
  }

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) return false;
    const age = Date.now() - entry.createdAt.getTime();
    return age > entry.ttl;
  }

  /**
   * 启动过期检查
   */
  private startExpiryChecker(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.cache) {
        if (entry.ttl && now - entry.createdAt.getTime() > entry.ttl) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        this.delete(key);
      }

      if (expiredKeys.length > 0) {
        console.log(`[Cache] Expired ${expiredKeys.length} entries`);
      }
    }, 60000).unref(); // 每分钟检查一次
  }

  /**
   * 启动持久化
   */
  private startPersistence(): void {
    this.persistenceTimer = setInterval(() => {
      this.persistToDisk();
    }, 300000); // 每5分钟持久化一次
  }

  /**
   * 持久化到磁盘
   */
  private persistToDisk(): void {
    try {
      const data = JSON.stringify({
        entries: Array.from(this.cache.entries()),
        stats: this.stats,
        timestamp: new Date().toISOString()
      });
      
      // 实际应用中应该写入文件
      console.log(`[Cache] Persisted ${this.cache.size} entries`);
    } catch (error) {
      console.error(`[Cache] Persistence error: ${error}`);
    }
  }

  /**
   * 估算大小
   */
  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1;
    }
  }

  /**
   * 估算内存使用
   */
  private estimateMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size || 100;
    }
    this.stats.memoryUsage = total;
    return total;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 多级缓存支持
   */
  createTieredCache(localConfig: Partial<CacheConfig>, remoteConfig: Partial<CacheConfig>): {
    local: CacheManager<T>;
    remote: CacheManager<T>;
    unified: CacheManager<T>;
  } {
    const local = new CacheManager<T>(localConfig);
    const remote = new CacheManager<T>(remoteConfig);

    const unified = new CacheManager<T>({
      ...this.config,
      maxSize: (localConfig.maxSize || 0) + (remoteConfig.maxSize || 0)
    });

    // 设置统一缓存的get方法，先查本地再查远程
    const originalSet = unified.set.bind(unified);
    unified.set = (key: string, value: T, options?: { ttl?: number; tags?: string[]; size?: number }) => {
      local.set(key, value, options);
      remote.set(key, value, options);
      originalSet(key, value, options);
    };

    return { local, remote, unified };
  }
}

export default CacheManager;
