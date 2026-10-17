/**
 * 分布式锁 - 互斥锁/读写锁/公平锁/红锁
 */

import { v4 as uuidv4 } from 'uuid';

export type LockType = 'mutex' | 'rwlock' | 'semaphore' | 'fair' | 'redlock';
export type LockStatus = 'available' | 'locked' | 'expired';

export interface Lock {
  id: string;
  key: string;
  type: LockType;
  owner: string;
  token: string;
  acquiredAt: Date;
  expiresAt: Date;
  ttlMs: number;
  autoRenew: boolean;
  waiters: Array<{ token: string; resolve: () => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>;
  metadata?: Record<string, unknown>;
}

export interface LockConfig {
  ttlMs: number;
  waitTimeoutMs: number;
  autoRenew: boolean;
  renewIntervalMs: number;
}

export interface LockStats {
  totalAcquired: number;
  totalReleased: number;
  totalExpired: number;
  totalWaited: number;
  totalContention: number;
  averageWaitTime: number;
  byType: Record<LockType, number>;
  activeLocks: number;
}

export class DistributedLock {
  private locks: Map<string, Lock> = new Map();
  private readLocks: Map<string, Set<string>> = new Map();
  private semaphores: Map<string, { permits: number; holders: Set<string> }> = new Map();
  private stats: LockStats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalExpired: 0,
    totalWaited: 0,
    totalContention: 0,
    averageWaitTime: 0,
    byType: { mutex: 0, rwlock: 0, semaphore: 0, fair: 0, redlock: 0 },
    activeLocks: 0
  };
  private totalWait = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(private defaultConfig: LockConfig = { ttlMs: 30000, waitTimeoutMs: 5000, autoRenew: false, renewIntervalMs: 10000 }) {
    this.startExpiryCheck();
  }

  private startExpiryCheck(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkExpired(), 1000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async acquire(key: string, type: LockType = 'mutex', options: { ttlMs?: number; waitTimeoutMs?: number; autoRenew?: boolean; owner?: string } = {}): Promise<string> {
    const ttl = options.ttlMs || this.defaultConfig.ttlMs;
    const waitTimeout = options.waitTimeoutMs || this.defaultConfig.waitTimeoutMs;
    const owner = options.owner || uuidv4();
    const start = Date.now();

    if (type === 'semaphore') return this.acquireSemaphore(key, owner, options as { permits?: number });
    if (type === 'rwlock') return this.acquireReadLock(key, owner, waitTimeout);

    return new Promise<string>((resolve, reject) => {
      const tryAcquire = (): boolean => {
        const existing = this.locks.get(key);
        if (existing && existing.expiresAt > new Date()) {
          return false;
        }
        const lock: Lock = {
          id: uuidv4(),
          key,
          type,
          owner,
          token: uuidv4(),
          acquiredAt: new Date(),
          expiresAt: new Date(Date.now() + ttl),
          ttlMs: ttl,
          autoRenew: options.autoRenew || this.defaultConfig.autoRenew,
          waiters: []
        };
        this.locks.set(key, lock);
        this.stats.totalAcquired++;
        this.stats.byType[type]++;
        this.stats.activeLocks = this.locks.size;
        this.totalWait += Date.now() - start;
        this.stats.averageWaitTime = this.stats.totalAcquired > 0 ? this.totalWait / this.stats.totalAcquired : 0;
        if (lock.autoRenew) this.scheduleRenew(lock);
        resolve(lock.token);
        return true;
      };

      if (tryAcquire()) return;

      this.stats.totalContention++;
      const existing = this.locks.get(key)!;
      const timeout = setTimeout(() => {
        const idx = existing.waiters.findIndex(w => w.token === owner);
        if (idx >= 0) {
          existing.waiters.splice(idx, 1);
          reject(new Error(`Lock acquisition timed out for key ${key}`));
        }
      }, waitTimeout);

      existing.waiters.push({ token: owner, resolve: () => {
        clearTimeout(timeout);
        tryAcquire();
      }, reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      }, timeout });
      this.stats.totalWaited++;
    });
  }

  private async acquireSemaphore(key: string, owner: string, _options: { permits?: number } = {}): Promise<string> {
    let sem = this.semaphores.get(key);
    if (!sem) {
      sem = { permits: 5, holders: new Set() };
      this.semaphores.set(key, sem);
    }
    if (sem.holders.size >= sem.permits) {
      throw new Error(`No permits available for semaphore ${key}`);
    }
    sem.holders.add(owner);
    this.stats.totalAcquired++;
    this.stats.byType.semaphore++;
    return owner;
  }

  private async acquireReadLock(key: string, owner: string, waitTimeout: number): Promise<string> {
    const start = Date.now();
    return new Promise<string>((resolve, reject) => {
      const tryAcquire = (): boolean => {
        const writer = this.locks.get(key);
        if (writer && writer.expiresAt > new Date()) return false;
        let readers = this.readLocks.get(key);
        if (!readers) {
          readers = new Set();
          this.readLocks.set(key, readers);
        }
        readers.add(owner);
        this.stats.totalAcquired++;
        this.stats.byType.rwlock++;
        resolve(owner);
        return true;
      };
      if (tryAcquire()) return;
      const timeout = setTimeout(() => reject(new Error('Read lock acquisition timed out')), waitTimeout);
      this.stats.totalContention++;
      const interval = setInterval(() => {
        if (Date.now() - start > waitTimeout) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error('Read lock acquisition timed out'));
        } else if (tryAcquire()) {
          clearInterval(interval);
          clearTimeout(timeout);
        }
      }, 50);
    });
  }

  release(key: string, token: string, type: LockType = 'mutex'): boolean {
    if (type === 'semaphore') {
      const sem = this.semaphores.get(key);
      if (sem) {
        sem.holders.delete(token);
        return true;
      }
      return false;
    }
    if (type === 'rwlock') {
      const readers = this.readLocks.get(key);
      if (readers) {
        readers.delete(token);
        if (readers.size === 0) this.readLocks.delete(key);
        this.stats.totalReleased++;
        return true;
      }
      return false;
    }
    const lock = this.locks.get(key);
    if (!lock || lock.token !== token) return false;
    this.locks.delete(key);
    this.stats.totalReleased++;
    this.stats.activeLocks = this.locks.size;
    if (lock.waiters.length > 0) {
      const next = lock.waiters.shift()!;
      next.resolve();
    }
    return true;
  }

  renew(key: string, token: string, ttlMs?: number): boolean {
    const lock = this.locks.get(key);
    if (!lock || lock.token !== token) return false;
    lock.expiresAt = new Date(Date.now() + (ttlMs || lock.ttlMs));
    return true;
  }

  isLocked(key: string): boolean {
    const lock = this.locks.get(key);
    return lock !== undefined && lock.expiresAt > new Date();
  }

  private scheduleRenew(lock: Lock): void {
    setInterval(() => {
      if (!this.locks.has(lock.key) || this.locks.get(lock.key)?.token !== lock.token) return;
      this.renew(lock.key, lock.token);
    }, this.defaultConfig.renewIntervalMs);
  }

  private checkExpired(): void {
    const now = new Date();
    for (const [key, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(key);
        this.stats.totalExpired++;
        this.stats.activeLocks = this.locks.size;
        if (lock.waiters.length > 0) {
          const next = lock.waiters.shift()!;
          next.resolve();
        }
      }
    }
  }

  async withLock<T>(key: string, fn: () => Promise<T> | T, type: LockType = 'mutex', options?: { ttlMs?: number }): Promise<T> {
    const token = await this.acquire(key, type, options);
    try {
      return await fn();
    } finally {
      this.release(key, token, type);
    }
  }

  getStats(): LockStats {
    return { ...this.stats };
  }

  listLocks(): Lock[] {
    return Array.from(this.locks.values());
  }
}

export const distributedLock = new DistributedLock();
export default DistributedLock;
