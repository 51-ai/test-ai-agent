/**
 * 用户分群模块 (User Segmentation)
 *
 * 功能：
 *  - 基于行为/特征自动将用户分到不同分群（VIP / 活跃 / 沉默 / 流失风险 / 新用户）
 *  - 支持自定义分群规则
 *  - 提供分群迁移跟踪（用户从一个分群迁移到另一个分群）
 *  - 支持按分群批量查询、运营推送
 *
 * 设计为单例使用；与 Agent.ts 的 LoggingSystem 配合记录关键事件。
 */

export type SegmentId = string;

export interface SegmentRule {
  /** 条件组合，全部满足才算匹配 */
  conditions: Array<{
    field: 'messageCount' | 'avgRating' | 'lastActiveDays' | 'totalSpent' | 'errorRate' | 'sentimentScore';
    operator: '>' | '>=' | '<' | '<=' | '==';
    value: number;
  }>;
}

export interface Segment {
  id: SegmentId;
  name: string;
  description: string;
  priority: number; // 数字越大越优先匹配
  rule: SegmentRule;
  userIds: Set<string>;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UserFeatures {
  userId: string;
  messageCount: number;
  avgRating: number;
  lastActiveDays: number;
  totalSpent: number;
  errorRate: number;
  sentimentScore: number;
}

export interface UserSegmentState {
  userId: string;
  currentSegments: SegmentId[];
  segmentHistory: Array<{ segmentId: SegmentId; joinedAt: Date; leftAt?: Date }>;
}

export interface SegmentationStats {
  totalSegments: number;
  totalUsers: number;
  totalAssignments: number;
  migrationsLast24h: number;
  segmentSizes: Record<SegmentId, number>;
}

const DEFAULT_SEGMENTS: Array<Omit<Segment, 'userIds' | 'createdAt'>> = [
  {
    id: 'vip',
    name: 'VIP 用户',
    description: '高消费、高频互动',
    priority: 100,
    rule: {
      conditions: [
        { field: 'totalSpent', operator: '>=', value: 1000 },
        { field: 'messageCount', operator: '>=', value: 100 },
      ],
    },
  },
  {
    id: 'active',
    name: '活跃用户',
    description: '最近 7 天内有互动',
    priority: 50,
    rule: {
      conditions: [
        { field: 'lastActiveDays', operator: '<=', value: 7 },
        { field: 'messageCount', operator: '>=', value: 5 },
      ],
    },
  },
  {
    id: 'churn_risk',
    name: '流失风险',
    description: '超过 30 天未活跃',
    priority: 80,
    rule: {
      conditions: [
        { field: 'lastActiveDays', operator: '>=', value: 30 },
      ],
    },
  },
  {
    id: 'new_user',
    name: '新用户',
    description: '首次使用不到 3 天',
    priority: 30,
    rule: {
      conditions: [
        { field: 'messageCount', operator: '<=', value: 3 },
        { field: 'lastActiveDays', operator: '<=', value: 3 },
      ],
    },
  },
  {
    id: 'frustrated',
    name: '不满用户',
    description: '情感分数低 / 错误率高',
    priority: 90,
    rule: {
      conditions: [
        { field: 'sentimentScore', operator: '<', value: 0.3 },
      ],
    },
  },
];

export default class UserSegmentation {
  private segments: Map<SegmentId, Segment> = new Map();
  private userStates: Map<string, UserSegmentState> = new Map();
  private features: Map<string, UserFeatures> = new Map();
  private migrations: Array<{ userId: string; from: SegmentId; to: SegmentId; at: Date }> = [];

  constructor() {
    this.loadDefaultSegments();
  }

  private loadDefaultSegments(): void {
    for (const def of DEFAULT_SEGMENTS) {
      this.segments.set(def.id, {
        ...def,
        userIds: new Set(),
        createdAt: new Date(),
      });
    }
  }

  /** 注册一个自定义分群 */
  registerSegment(seg: Omit<Segment, 'userIds' | 'createdAt'>): void {
    this.segments.set(seg.id, {
      ...seg,
      userIds: new Set(),
      createdAt: new Date(),
    });
  }

  /** 更新用户特征（推荐每次会话结束时调用） */
  updateFeatures(features: UserFeatures): UserSegmentState {
    this.features.set(features.userId, features);
    return this.recomputeUser(features.userId);
  }

  /** 记录一次简单事件（自动维护 messageCount / lastActiveDays） */
  recordEvent(userId: string, opts?: { rating?: number; spent?: number; sentiment?: number; success?: boolean }): UserSegmentState {
    const prev = this.features.get(userId) ?? {
      userId,
      messageCount: 0,
      avgRating: 0,
      lastActiveDays: 0,
      totalSpent: 0,
      errorRate: 0,
      sentimentScore: 0.5,
    };
    const next: UserFeatures = {
      userId,
      messageCount: prev.messageCount + 1,
      avgRating: opts?.rating !== undefined
        ? (prev.avgRating * prev.messageCount + opts.rating) / (prev.messageCount + 1)
        : prev.avgRating,
      lastActiveDays: 0,
      totalSpent: prev.totalSpent + (opts?.spent ?? 0),
      errorRate: opts?.success === false
        ? Math.min(1, prev.errorRate * 0.9 + 0.1)
        : Math.max(0, prev.errorRate * 0.95),
      sentimentScore: opts?.sentiment !== undefined
        ? (prev.sentimentScore * 0.7 + opts.sentiment * 0.3)
        : prev.sentimentScore,
    };
    return this.updateFeatures(next);
  }

  private matches(features: UserFeatures, rule: SegmentRule): boolean {
    return rule.conditions.every((c) => {
      const v = features[c.field];
      switch (c.operator) {
        case '>':  return v >  c.value;
        case '>=': return v >= c.value;
        case '<':  return v <  c.value;
        case '<=': return v <= c.value;
        case '==': return v === c.value;
        default:   return false;
      }
    });
  }

  private recomputeUser(userId: string): UserSegmentState {
    const features = this.features.get(userId);
    let state = this.userStates.get(userId);
    if (!state) {
      state = { userId, currentSegments: [], segmentHistory: [] };
      this.userStates.set(userId, state);
    }
    if (!features) return state;

    // 按优先级匹配
    const matched = Array.from(this.segments.values())
      .filter((s) => this.matches(features, s.rule))
      .sort((a, b) => b.priority - a.priority)
      .map((s) => s.id);

    // 找出差异
    const prevSet = new Set(state.currentSegments);
    const nextSet = new Set(matched);

    // 离开
    for (const segId of state.currentSegments) {
      if (!nextSet.has(segId)) {
        const seg = this.segments.get(segId);
        if (seg) {
          seg.userIds.delete(userId);
          const h = state.segmentHistory.find((x) => x.segmentId === segId && !x.leftAt);
          if (h) h.leftAt = new Date();
        }
      }
    }
    // 进入
    for (const segId of matched) {
      if (!prevSet.has(segId)) {
        const seg = this.segments.get(segId);
        if (seg) {
          seg.userIds.add(userId);
          state.segmentHistory.push({ segmentId: segId, joinedAt: new Date() });
          // 记录迁移
          const fromList = Array.from(prevSet);
          for (const from of fromList) {
            this.migrations.push({ userId, from, to: segId, at: new Date() });
          }
        }
      }
    }
    state.currentSegments = matched;
    return state;
  }

  /** 手动将用户分配到分群（绕过规则） */
  assignUser(segmentId: SegmentId, userId: string): boolean {
    const seg = this.segments.get(segmentId);
    if (!seg) return false;
    seg.userIds.add(userId);
    let state = this.userStates.get(userId);
    if (!state) {
      state = { userId, currentSegments: [], segmentHistory: [] };
      this.userStates.set(userId, state);
    }
    if (!state.currentSegments.includes(segmentId)) {
      state.currentSegments.push(segmentId);
      state.segmentHistory.push({ segmentId, joinedAt: new Date() });
    }
    return true;
  }

  /** 获取用户的当前分群 */
  getUserSegments(userId: string): SegmentId[] {
    return this.userStates.get(userId)?.currentSegments ?? [];
  }

  /** 获取分群内的所有用户 */
  getSegmentUsers(segmentId: SegmentId): string[] {
    return Array.from(this.segments.get(segmentId)?.userIds ?? new Set());
  }

  /** 获取分群详情 */
  getSegment(segmentId: SegmentId): Segment | undefined {
    return this.segments.get(segmentId);
  }

  /** 列出所有分群 */
  listSegments(): Array<Omit<Segment, 'userIds'> & { size: number }> {
    return Array.from(this.segments.values()).map((s) => {
      const { userIds, ...rest } = s;
      return { ...rest, size: userIds.size };
    });
  }

  /** 全量重算所有用户（特征已有，但分群未跑） */
  recomputeAll(): number {
    let count = 0;
    for (const userId of this.features.keys()) {
      this.recomputeUser(userId);
      count++;
    }
    return count;
  }

  getStats(): SegmentationStats {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const segmentSizes: Record<string, number> = {};
    let total = 0;
    for (const s of this.segments.values()) {
      segmentSizes[s.id] = s.userIds.size;
      total += s.userIds.size;
    }
    return {
      totalSegments: this.segments.size,
      totalUsers: this.userStates.size,
      totalAssignments: total,
      migrationsLast24h: this.migrations.filter((m) => m.at.getTime() >= last24h).length,
      segmentSizes,
    };
  }
}
