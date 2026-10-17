/**
 * 成本追踪模块 (Cost Tracker)
 *
 * 用于追踪 AI Agent 调用 LLM / 工具 / 外部服务产生的"成本"：
 *  - 抽象成"信用点"或美元
 *  - 支持按 token 计费（输入/输出分别计价）
 *  - 支持工具调用固定/可变计费
 *  - 按用户/模块/操作类型聚合
 *  - 提供预算上限告警
 */

export type CostUnit = 'USD' | 'CNY' | 'credit';

export interface ModelPricing {
  model: string;
  inputPer1k: number;     // 每 1k input token 多少 cost
  outputPer1k: number;
  unit: CostUnit;
}

export interface ToolPricing {
  tool: string;
  perCall: number;
  unit: CostUnit;
}

export interface CostRecord {
  id: string;
  at: Date;
  userId: string;
  module: string;       // 'llm' | 'tool:webSearch' | 'tool:code' | ...
  operation: string;     // 'chat' | 'embedding' | 'rag.query' ...
  inputTokens: number;
  outputTokens: number;
  calls: number;
  cost: number;
  unit: CostUnit;
  metadata?: Record<string, unknown>;
}

export interface Budget {
  scope: { type: 'global' | 'user' | 'module'; key?: string };
  limit: number;
  unit: CostUnit;
  period: 'hourly' | 'daily' | 'monthly';
  triggered: boolean;
  triggeredAt?: Date;
}

export interface CostStats {
  totalCost: number;
  unit: CostUnit;
  byModule: Record<string, number>;
  byUser: Record<string, number>;
  recordsCount: number;
  triggeredBudgets: number;
}

export default class CostTracker {
  private records: CostRecord[] = [];
  private modelPricing: Map<string, ModelPricing> = new Map();
  private toolPricing: Map<string, ToolPricing> = new Map();
  private budgets: Budget[] = [];
  private alertListeners: Array<(b: Budget, current: number) => void> = [];
  private maxRecords = 50000;

  constructor() {
    this.loadDefaultPricing();
  }

  private loadDefaultPricing(): void {
    // 默认 LLM 模型定价（示例）
    this.setModelPricing({ model: 'gpt-4',       inputPer1k: 0.03,  outputPer1k: 0.06,  unit: 'USD' });
    this.setModelPricing({ model: 'gpt-3.5-turbo', inputPer1k: 0.0005, outputPer1k: 0.0015, unit: 'USD' });
    this.setModelPricing({ model: 'claude-3-opus', inputPer1k: 0.015, outputPer1k: 0.075, unit: 'USD' });
    this.setModelPricing({ model: 'claude-3-sonnet', inputPer1k: 0.003, outputPer1k: 0.015, unit: 'USD' });
    this.setModelPricing({ model: 'qwen-turbo',  inputPer1k: 0.003,  outputPer1k: 0.006,  unit: 'CNY' });
    this.setModelPricing({ model: 'ernie-bot',   inputPer1k: 0.012,  outputPer1k: 0.012,  unit: 'CNY' });
    this.setModelPricing({ model: 'mock',        inputPer1k: 0,      outputPer1k: 0,      unit: 'credit' });

    // 默认工具定价
    this.setToolPricing({ tool: 'webSearch', perCall: 0.002, unit: 'USD' });
    this.setToolPricing({ tool: 'codeExecutor', perCall: 0.01, unit: 'USD' });
    this.setToolPricing({ tool: 'document', perCall: 0.001, unit: 'USD' });
    this.setToolPricing({ tool: 'dataAnalysis', perCall: 0.05, unit: 'USD' });
    this.setToolPricing({ tool: 'cloudService', perCall: 0.005, unit: 'USD' });
  }

  // ============== 定价管理 ==============
  setModelPricing(p: ModelPricing): void { this.modelPricing.set(p.model, p); }
  setToolPricing(p: ToolPricing): void { this.toolPricing.set(p.tool, p); }

  // ============== 记录接口 ==============
  /** 记录一次 LLM 调用 */
  recordLLM(opts: {
    userId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    operation?: string;
  }): CostRecord {
    const pricing = this.modelPricing.get(opts.model) ?? { model: opts.model, inputPer1k: 0, outputPer1k: 0, unit: 'credit' as CostUnit };
    const cost = (opts.inputTokens / 1000) * pricing.inputPer1k + (opts.outputTokens / 1000) * pricing.outputPer1k;
    const rec = this.makeRecord({
      userId: opts.userId,
      module: 'llm',
      operation: opts.operation ?? 'chat',
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      calls: 1,
      cost,
      unit: pricing.unit,
      metadata: { model: opts.model },
    });
    this.checkBudgets();
    return rec;
  }

  /** 记录一次工具调用 */
  recordTool(opts: {
    userId: string;
    tool: string;
    calls?: number;
    costOverride?: number;
  }): CostRecord {
    const pricing = this.toolPricing.get(opts.tool);
    const cost = opts.costOverride ?? (pricing ? pricing.perCall * (opts.calls ?? 1) : 0);
    const rec = this.makeRecord({
      userId: opts.userId,
      module: `tool:${opts.tool}`,
      operation: 'call',
      inputTokens: 0,
      outputTokens: 0,
      calls: opts.calls ?? 1,
      cost,
      unit: pricing?.unit ?? 'credit',
      metadata: { tool: opts.tool },
    });
    this.checkBudgets();
    return rec;
  }

  // ============== 预算管理 ==============
  addBudget(b: Omit<Budget, 'triggered' | 'triggeredAt'>): void {
    this.budgets.push({ ...b, triggered: false });
  }

  onAlert(fn: (b: Budget, current: number) => void): void {
    this.alertListeners.push(fn);
  }

  private checkBudgets(): void {
    if (this.budgets.length === 0) return;
    const now = Date.now();
    for (const b of this.budgets) {
      if (b.triggered) continue;
      const window = this.windowStart(b.period);
      let current = 0;
      for (const r of this.records) {
        if (r.unit !== b.unit) continue;
        if (r.at.getTime() < window) continue;
        if (b.scope.type === 'global') {
          current += r.cost;
        } else if (b.scope.type === 'user' && b.scope.key === r.userId) {
          current += r.cost;
        } else if (b.scope.type === 'module' && b.scope.key === r.module) {
          current += r.cost;
        }
      }
      if (current >= b.limit) {
        b.triggered = true;
        b.triggeredAt = new Date();
        for (const fn of this.alertListeners) {
          try { fn(b, current); } catch { /* 忽略回调错误 */ }
        }
      }
    }
  }

  private windowStart(period: Budget['period']): number {
    const now = new Date();
    if (period === 'hourly') return now.getTime() - 3600 * 1000;
    if (period === 'daily')  return now.getTime() - 24 * 3600 * 1000;
    return now.getTime() - 30 * 24 * 3600 * 1000;
  }

  // ============== 查询 ==============
  query(opts: { userId?: string; module?: string; fromTs?: number; toTs?: number; limit?: number }): CostRecord[] {
    let r = this.records;
    if (opts.userId) r = r.filter((x) => x.userId === opts.userId);
    if (opts.module) r = r.filter((x) => x.module === opts.module);
    if (opts.fromTs) r = r.filter((x) => x.at.getTime() >= opts.fromTs!);
    if (opts.toTs)   r = r.filter((x) => x.at.getTime() <= opts.toTs!);
    return r.slice(-1 * (opts.limit ?? 100));
  }

  getStats(unit: CostUnit = 'USD'): CostStats {
    const byModule: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    let total = 0;
    let count = 0;
    for (const r of this.records) {
      if (r.unit !== unit) continue;
      total += r.cost;
      byModule[r.module] = (byModule[r.module] ?? 0) + r.cost;
      byUser[r.userId]   = (byUser[r.userId] ?? 0) + r.cost;
      count++;
    }
    return {
      totalCost: total,
      unit,
      byModule,
      byUser,
      recordsCount: count,
      triggeredBudgets: this.budgets.filter((b) => b.triggered).length,
    };
  }

  // ============== 内部 ==============
  private makeRecord(opts: Omit<CostRecord, 'id' | 'at'>): CostRecord {
    const rec: CostRecord = {
      id: `cost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date(),
      ...opts,
    };
    this.records.push(rec);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
    return rec;
  }
}
