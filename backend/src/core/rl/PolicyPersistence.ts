import { RLState, RLAction } from './types';

interface PolicyEntry {
  policy: Record<string, number>;
  value: number;
  lastUpdated: number;
  visitCount: number;
}

export class PolicyPersistence {
  private policyData: Map<string, PolicyEntry> = new Map();
  private savePath?: string;
  private autoSaveInterval?: NodeJS.Timeout;
  private autoSaveEnabled: boolean = false;

  constructor(savePath?: string) {
    this.savePath = savePath;
  }

  /**
   * 保存策略
   */
  savePolicy(stateKey: string, policy: Record<string, number>, value: number): void {
    const existing = this.policyData.get(stateKey);
    const now = Date.now();
    
    this.policyData.set(stateKey, {
      policy,
      value,
      lastUpdated: now,
      visitCount: (existing?.visitCount || 0) + 1
    });

    if (this.autoSaveEnabled && this.savePath) {
      this.tryAutoSave();
    }
  }

  /**
   * 加载策略
   */
  loadPolicy(stateKey: string): { policy: Record<string, number>; value: number } | null {
    const entry = this.policyData.get(stateKey);
    if (entry) {
      entry.visitCount++;
      return { policy: entry.policy, value: entry.value };
    }
    return null;
  }

  /**
   * 检查是否已有策略
   */
  hasPolicy(stateKey: string): boolean {
    return this.policyData.has(stateKey);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const entries = Array.from(this.policyData.values());
    return {
      totalStates: this.policyData.size,
      totalVisits: entries.reduce((sum, e) => sum + e.visitCount, 0),
      averageVisits: entries.length > 0 ? entries.reduce((sum, e) => sum + e.visitCount, 0) / entries.length : 0,
      newestUpdate: Math.max(...entries.map(e => e.lastUpdated), 0),
      oldestUpdate: Math.min(...entries.map(e => e.lastUpdated), 0)
    };
  }

  /**
   * 导出策略数据
   */
  exportPolicies(): string {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      policies: Array.from(this.policyData.entries())
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入策略数据
   */
  importPolicies(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.policies) {
        this.policyData = new Map(data.policies);
        return true;
      }
    } catch (e) {
      console.error('[PolicyPersistence] Failed to import policies:', e);
    }
    return false;
  }

  /**
   * 启用自动保存
   */
  enableAutoSave(intervalMs: number = 60000): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.autoSaveEnabled = true;
    this.autoSaveInterval = setInterval(() => this.tryAutoSave(), intervalMs);
    this.autoSaveInterval.unref(); // 自动保存不阻止进程退出
  }

  /**
   * 禁用自动保存
   */
  disableAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.autoSaveEnabled = false;
  }

  private tryAutoSave(): void {
    try {
      if (this.savePath) {
        console.log('[PolicyPersistence] Auto-saving policies...');
      }
    } catch (e) {
      console.error('[PolicyPersistence] Auto-save failed:', e);
    }
  }

  /**
   * 清理旧策略
   */
  cleanupOldPolicies(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.policyData.entries()) {
      if (now - entry.lastUpdated > maxAgeMs) {
        this.policyData.delete(key);
        removedCount++;
      }
    }
    
    return removedCount;
  }

  /**
   * 合并策略
   */
  mergeWith(other: PolicyPersistence, alpha: number = 0.5): void {
    for (const [key, entry] of other.policyData.entries()) {
      const existing = this.policyData.get(key);
      if (existing) {
        const mergedPolicy: Record<string, number> = {};
        const allActions = new Set([...Object.keys(existing.policy), ...Object.keys(entry.policy)]);
        
        for (const action of allActions) {
          const p1 = existing.policy[action] || 0;
          const p2 = entry.policy[action] || 0;
          mergedPolicy[action] = p1 * (1 - alpha) + p2 * alpha;
        }
        
        const total = Object.values(mergedPolicy).reduce((a, b) => a + b, 0);
        for (const action of Object.keys(mergedPolicy)) {
          mergedPolicy[action] /= total;
        }
        
        this.policyData.set(key, {
          policy: mergedPolicy,
          value: existing.value * (1 - alpha) + entry.value * alpha,
          lastUpdated: Math.max(existing.lastUpdated, entry.lastUpdated),
          visitCount: existing.visitCount + entry.visitCount
        });
      } else {
        this.policyData.set(key, entry);
      }
    }
  }

  /**
   * 清空所有策略
   */
  clear(): void {
    this.policyData.clear();
  }
}
