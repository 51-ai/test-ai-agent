/**
 * A/B 测试框架 (A/B Testing Framework)
 *
 * 用于在线实验：
 *  - 创建实验（多臂）
 *  - 基于用户分群/哈希稳定分流
 *  - 记录曝光与转化
 *  - 计算每个变体的关键指标（CTR / 转化率 / 平均分）
 *  - 显著性检验（Z 检验两比例）
 *  - 自动判定胜出
 */

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'finished';

export interface Variant {
  id: string;
  name: string;
  weight: number;        // 流量权重（数字，越大分配越多；总和不必为 1，会自动归一）
  config: Record<string, unknown>;  // 该变体下的实验参数
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variants: Variant[];
  startedAt?: Date;
  finishedAt?: Date;
  primaryMetric: 'ctr' | 'conversion' | 'avg_score' | 'custom';
  minSampleSize: number;
  metadata?: Record<string, unknown>;
}

export interface Exposure {
  experimentId: string;
  variantId: string;
  userId: string;
  at: Date;
}

export interface Conversion {
  experimentId: string;
  variantId: string;
  userId: string;
  metric: string;       // 与 Experiment.primaryMetric 对应；可自定义
  value: number;        // 0/1 转化，或连续值
  at: Date;
}

export interface VariantStats {
  variantId: string;
  exposures: number;
  uniqueUsers: number;
  conversions: number;
  conversionRate: number;
  avgScore: number;
}

export interface ExperimentStats {
  experimentId: string;
  status: ExperimentStatus;
  totalExposures: number;
  totalConversions: number;
  variants: VariantStats[];
  /** 显著性结果：与对照组相比的 p 值与差异 */
  significance: Array<{ variantId: string; vsControl: string; pValue: number; lift: number; significant: boolean }>;
  winner?: string;
}

export default class ABTestingFramework {
  private experiments: Map<string, Experiment> = new Map();
  private exposures: Exposure[] = [];
  private conversions: Conversion[] = [];
  private assignments: Map<string, string> = new Map();   // `${expId}:${userId}` -> variantId (稳定)
  private maxEvents = 100000;

  // ============== 实验 CRUD ==============
  createExperiment(exp: Omit<Experiment, 'status'> & { status?: ExperimentStatus }): Experiment {
    const e: Experiment = { status: 'draft', ...exp };
    this.experiments.set(e.id, e);
    return e;
  }

  startExperiment(id: string): boolean {
    const e = this.experiments.get(id);
    if (!e) return false;
    e.status = 'running';
    e.startedAt = new Date();
    return true;
  }

  pauseExperiment(id: string): boolean {
    const e = this.experiments.get(id);
    if (!e) return false;
    e.status = 'paused';
    return true;
  }

  finishExperiment(id: string): boolean {
    const e = this.experiments.get(id);
    if (!e) return false;
    e.status = 'finished';
    e.finishedAt = new Date();
    return true;
  }

  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  listExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  // ============== 分流 ==============
  /**
   * 稳定分配（同一用户在同一实验下永远进入同一组）。
   * 使用哈希 + 加权轮询。
   */
  assign(experimentId: string, userId: string): string | null {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return null;
    const key = `${experimentId}:${userId}`;
    let assigned = this.assignments.get(key);
    if (assigned) return assigned;
    if (exp.variants.length === 0) return null;

    // 哈希分流
    const h = this.hash(`${experimentId}|${userId}`);
    const totalWeight = exp.variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
    if (totalWeight <= 0) return null;
    let cursor = (h % 1000) / 1000 * totalWeight;
    for (const v of exp.variants) {
      cursor -= Math.max(0, v.weight);
      if (cursor <= 0) {
        assigned = v.id;
        break;
      }
    }
    if (!assigned) assigned = exp.variants[exp.variants.length - 1].id;
    this.assignments.set(key, assigned);
    return assigned;
  }

  /** 记录曝光 */
  recordExposure(experimentId: string, userId: string): Exposure | null {
    const variantId = this.assign(experimentId, userId);
    if (!variantId) return null;
    const e: Exposure = { experimentId, variantId, userId, at: new Date() };
    this.exposures.push(e);
    this.trim();
    return e;
  }

  /** 记录转化（value 0/1 或连续） */
  recordConversion(opts: { experimentId: string; userId: string; metric: string; value: number }): Conversion | null {
    const variantId = this.assign(opts.experimentId, opts.userId);
    if (!variantId) return null;
    const c: Conversion = { ...opts, variantId, at: new Date() };
    this.conversions.push(c);
    this.trim();
    return c;
  }

  // ============== 统计 ==============
  getStats(experimentId: string): ExperimentStats | null {
    const exp = this.experiments.get(experimentId);
    if (!exp) return null;
    const vStats: VariantStats[] = exp.variants.map((v) => {
      const ex = this.exposures.filter((e) => e.experimentId === experimentId && e.variantId === v.id);
      const co = this.conversions.filter((c) => c.experimentId === experimentId && c.variantId === v.id);
      const users = new Set(ex.map((e) => e.userId));
      const sum = co.reduce((s, c) => s + c.value, 0);
      return {
        variantId: v.id,
        exposures: ex.length,
        uniqueUsers: users.size,
        conversions: co.length,
        conversionRate: ex.length > 0 ? co.length / ex.length : 0,
        avgScore: co.length > 0 ? sum / co.length : 0,
      };
    });
    const totalExposures = vStats.reduce((s, x) => s + x.exposures, 0);
    const totalConversions = vStats.reduce((s, x) => s + x.conversions, 0);

    // 显著性：与第一个变体作为对照
    const control = vStats[0];
    const sigs = vStats.slice(1).map((v) => {
      const { pValue, lift } = this.twoProportionZTest(
        v.conversions, v.exposures,
        control.conversions, control.exposures
      );
      return {
        variantId: v.variantId,
        vsControl: control.variantId,
        pValue,
        lift,
        significant: pValue < 0.05 && v.exposures >= exp.minSampleSize && control.exposures >= exp.minSampleSize,
      };
    });

    // 选出胜出：转化率最高且显著
    let winner: string | undefined;
    if (exp.status === 'finished' || vStats.every((v) => v.exposures >= exp.minSampleSize)) {
      const top = vStats.slice().sort((a, b) => b.conversionRate - a.conversionRate)[0];
      if (top.variantId !== control.variantId) {
        const sig = sigs.find((s) => s.variantId === top.variantId);
        if (sig?.significant) winner = top.variantId;
      } else {
        winner = control.variantId;
      }
    }

    return {
      experimentId,
      status: exp.status,
      totalExposures,
      totalConversions,
      variants: vStats,
      significance: sigs,
      winner,
    };
  }

  /** 列出某个变体的配置（实验中获取） */
  getVariantConfig(experimentId: string, userId: string): Record<string, unknown> | null {
    const variantId = this.assign(experimentId, userId);
    if (!variantId) return null;
    return this.experiments.get(experimentId)?.variants.find((v) => v.id === variantId)?.config ?? null;
  }

  // ============== 内部 ==============
  private hash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  private twoProportionZTest(c1: number, n1: number, c2: number, n2: number): { pValue: number; lift: number } {
    if (n1 === 0 || n2 === 0) return { pValue: 1, lift: 0 };
    const p1 = c1 / n1, p2 = c2 / n2;
    const p = (c1 + c2) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    if (se === 0) return { pValue: 1, lift: p2 > 0 ? (p1 - p2) / p2 : 0 };
    const z = (p1 - p2) / se;
    const pValue = 2 * (1 - this.normalCdf(Math.abs(z)));
    return { pValue, lift: p2 > 0 ? (p1 - p2) / p2 : 0 };
  }

  /** 近似标准正态 CDF（误差 < 1e-7） */
  private normalCdf(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * ax);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
    return 0.5 * (1.0 + sign * y);
  }

  private trim(): void {
    if (this.exposures.length > this.maxEvents) this.exposures = this.exposures.slice(-this.maxEvents);
    if (this.conversions.length > this.maxEvents) this.conversions = this.conversions.slice(-this.maxEvents);
  }
}
