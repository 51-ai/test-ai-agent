/**
 * 用户行为分析系统 - 用户交互模式和行为模式分析
 */

import { v4 as uuidv4 } from 'uuid';

export type UserAction = 
  | 'search' | 'click' | 'view' | 'purchase' | 'scroll' | 'click' | 'like' | 'share' 
  | 'comment' | 'follow' | 'login' | 'logout' | 'download' | 'interact';

export interface UserBehaviorRecord {
  id: string;
  userId: string;
  sessionId?: string;
  action: UserAction;
  target?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  timestamp: Date;
}

export interface UserProfile {
  userId: string;
  totalActions: number;
  lastActive: Date;
  firstActive: Date;
  actionCounts: Record<UserAction, number>;
  favoriteCategories: Set<string>;
  sessionCount: number;
  averageSessionDuration: number;
  timePreferences: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  interests: Set<string>;
  riskScore: number;
  behaviorPattern: string[];
  deviceType?: string;
  language?: string;
}

export interface BehaviorPattern {
  id: string;
  pattern: string;
  support: number;
  confidence: number;
  actions: UserAction[];
}

export interface UserSegment {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  userCount: number;
  members: Set<string>;
}

export interface RecommendationResult {
  recommendations: Array<{
    item: string;
    score: number;
    reason: string;
  }>;
  basedOn: string[];
}

export interface ChurnPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  probability: number;
  lastActivityDays: number;
  recommendations: string[];
}

class UserBehaviorAnalysis {
  private records: UserBehaviorRecord[] = [];
  private profiles: Map<string, UserProfile> = new Map();
  private sessions: Map<string, UserBehaviorRecord[]> = new Map();
  private patterns: BehaviorPattern[] = [];
  private segments: Map<string, UserSegment> = new Map();
  private maxRecords = 100000;
  private actionCooccurrences: Map<UserAction, Set<string>> = new Map();
  private itemPopularity: Map<string, number> = new Map();
  private maxProfileAge = 30 * 24 * 60 * 60 * 1000; // 30天

  constructor() {
    this.initializeDefaultSegments();
  }

  private initializeDefaultSegments(): void {
    this.segments.set('active', {
      id: 'active',
      name: '活跃用户',
      criteria: { minActions: 50 },
      userCount: 0,
      members: new Set()
    });
    this.segments.set('new', {
      id: 'new',
      name: '新用户',
      criteria: { maxDaysSinceFirst: 7 },
      userCount: 0,
      members: new Set()
    });
    this.segments.set('inactive', {
      id: 'inactive',
      name: '流失风险用户',
      criteria: { minDaysInactive: 7 },
      userCount: 0,
      members: new Set()
    });
    this.segments.set('premium', {
      id: 'premium',
      name: '高价值用户',
      criteria: { minPurchaseCount: 5 },
      userCount: 0,
      members: new Set()
    });
  }

  /**
   * 记录用户行为
   */
  recordBehavior(userId: string, action: UserAction, options?: {
    target?: string;
    sessionId?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
  }): string {
    const record: UserBehaviorRecord = {
      id: uuidv4(),
      userId,
      sessionId: options?.sessionId,
      action,
      target: options?.target,
      metadata: options?.metadata,
      duration: options?.duration,
      timestamp: new Date()
    };

    this.records.push(record);

    // 保持记录大小限制
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    // 更新用户画像
    this.updateProfile(record);

    // 更新会话记录
    if (record.sessionId) {
      if (!this.sessions.has(record.sessionId)) {
        this.sessions.set(record.sessionId, []);
      }
      this.sessions.get(record.sessionId)!.push(record);
    }

    // 更新项目流行度
    if (record.target) {
      this.itemPopularity.set(
        record.target,
        (this.itemPopularity.get(record.target) || 0) + 1
      );
    }

    // 更新用户分段
    this.updateSegments(userId);

    return record.id;
  }

  /**
   * 创建新的用户画像
   */
  private createProfile(userId: string): UserProfile {
    const now = new Date();
    const profile: UserProfile = {
      userId,
      totalActions: 0,
      lastActive: now,
      firstActive: now,
      actionCounts: {
        search: 0, view: 0, click: 0, purchase: 0,
        scroll: 0, like: 0, share: 0, comment: 0,
        follow: 0, login: 0, logout: 0,
        download: 0, interact: 0
      },
      favoriteCategories: new Set(),
      sessionCount: 0,
      averageSessionDuration: 0,
      timePreferences: {
        morning: 0, afternoon: 0, evening: 0, night: 0
      },
      interests: new Set(),
      riskScore: 0,
      behaviorPattern: []
    };
    return profile;
  }

  /**
   * 更新用户画像
   */
  private updateProfile(record: UserBehaviorRecord): void {
    let profile = this.profiles.get(record.userId);
    if (!profile) {
      profile = this.createProfile(record.userId);
    }

    profile.totalActions++;
    profile.lastActive = new Date();
    profile.actionCounts[record.action] =
      (profile.actionCounts[record.action] || 0) + 1;

    // 更新时间段偏好
    const hour = record.timestamp.getHours();
    if (hour >= 6 && hour < 12) {
      profile.timePreferences.morning++;
    } else if (hour >= 12 && hour < 18) {
      profile.timePreferences.afternoon++;
    } else if (hour >= 18 && hour < 24) {
      profile.timePreferences.evening++;
    } else {
      profile.timePreferences.night++;
    }

    // 记录目标分类
    if (record.target) {
      const category = this.extractCategory(record.target);
      if (category) {
        profile.favoriteCategories.add(category);
      }
    }

    // 基于内容提取兴趣
    if (record.target) {
      const tokens = record.target.split(' ');
      profile.interests.add(tokens[0].substring(0, 20));
    }

    // 更新会话计数
    if (record.action === 'login') {
      profile.sessionCount++;
    }

    // 计算风险评分
    profile.riskScore = this.calculateRiskScore(profile);

    this.profiles.set(record.userId, profile);
  }

  private extractCategory(target: string): string | null {
    const categoryKeywords: Record<string, string[]> = {
      '产品': ['product', 'item', '商品', '产品'],
      '服务': ['service', '服务'],
      '内容': ['content', 'article', '内容', '文章'],
      '用户': ['user', 'profile', '用户', '用户']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => target.toLowerCase().includes(kw.toLowerCase()))) {
        return category;
      }
    }

    return null;
  }

  private calculateRiskScore(profile: UserProfile): number {
    let score = 0;
    const daysInactive = (Date.now() - profile.lastActive.getTime()) / (1000 * 60 * 60 * 24);
    
    // 长时间不活动增加风险
    if (daysInactive > 7) score += 0.3;
    if (daysInactive > 30) score += 0.5;
    
    // 低互动减少风险
    if (profile.totalActions > 100) score -= 0.2;
    
    // 最近活跃减少风险
    if (daysInactive < 1) score -= 0.3;
    
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * 更新用户分段
   */
  private updateSegments(userId: string): void {
    const profile = this.profiles.get(userId);
    if (!profile) return;

    for (const segment of this.segments.values()) {
      let matches = false;

      if (segment.id === 'active' && profile.totalActions >= 50) {
        matches = true;
      }
      if (segment.id === 'new' &&
        (Date.now() - profile.firstActive.getTime() < 7 * 24 * 60 * 60 * 1000)) {
        matches = true;
      }
      if (segment.id === 'inactive' &&
        (Date.now() - profile.lastActive.getTime() > 7 * 24 * 60 * 60 * 1000)) {
        matches = true;
      }
      if (segment.id === 'premium' && profile.actionCounts.purchase >= 5) {
        matches = true;
      }

      if (matches) {
        if (!segment.members.has(userId)) {
          segment.members.add(userId);
          segment.userCount = segment.members.size;
        }
      } else {
        segment.members.delete(userId);
        segment.userCount = segment.members.size;
      }
    }
  }

  /**
   * 获取用户画像
   */
  getProfile(userId: string): UserProfile | undefined {
    return this.profiles.get(userId);
  }

  /**
   * 获取用户所有记录
   */
  getUserRecords(userId: string, limit: number = 100): UserBehaviorRecord[] {
    return this.records
      .filter(r => r.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 获取用户最近会话
   */
  getUserSessions(userId: string): string[] {
    const userRecords = this.records.filter(r => r.userId === userId);
    const sessions = new Set(userRecords.map(r => r.sessionId));
    return Array.from(sessions).filter(Boolean) as string[];
  }

  /**
   * 获取所有用户画像列表
   */
  getAllProfiles(limit: number = 50): UserProfile[] {
    return Array.from(this.profiles.values())
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, limit);
  }

  /**
   * 获取活跃用户数
   */
  getActiveUserCount(days: number = 7): number {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return Array.from(this.profiles.values()).filter(
      p => p.lastActive.getTime() > threshold
    ).length;
  }

  /**
   * 获取新用户数量
   */
  getNewUserCount(days: number = 7): number {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return Array.from(this.profiles.values()).filter(
      p => p.firstActive.getTime() > threshold
    ).length;
  }

  /**
   * 获取用户统计
   */
  getUserStats(userId: string): {
    totalActions: number;
    actionsByType: Record<UserAction, number>;
    favoriteTime: string;
    topCategories: string[];
    activityLevel: 'low' | 'medium' | 'high';
    sessionCount: number;
    daysSinceLastActive: number;
  } {
    const profile = this.profiles.get(userId);
    if (!profile) {
      const empty: Record<UserAction, number> = {
        search: 0, click: 0, view: 0, purchase: 0, scroll: 0,
        like: 0, share: 0, comment: 0, follow: 0, login: 0,
        logout: 0, download: 0, interact: 0
      };
      return {
        totalActions: 0,
        actionsByType: empty,
        favoriteTime: 'unknown',
        topCategories: [],
        activityLevel: 'low',
        sessionCount: 0,
        daysSinceLastActive: 999
      };
    }

    const daysInactive = Math.floor(
      (Date.now() - profile.lastActive.getTime()) / (1000 * 60 * 60 * 24)
    );

    let activityLevel: 'low' | 'medium' | 'high';
    if (profile.totalActions > 100) activityLevel = 'high';
    else if (profile.totalActions > 20) activityLevel = 'medium';
    else activityLevel = 'low';

    const topCategories = Array.from(profile.favoriteCategories).slice(0, 5);
    const favoriteTime = Object.entries(profile.timePreferences)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return {
      totalActions: profile.totalActions,
      actionsByType: profile.actionCounts,
      favoriteTime,
      topCategories,
      activityLevel,
      sessionCount: profile.sessionCount,
      daysSinceLastActive: daysInactive
    };
  }

  /**
   * 发现行为模式
   */
  discoverPatterns(minSupport: number = 5): BehaviorPattern[] {
    const userActions = new Map<string, UserAction[]>();

    for (const record of this.records) {
      if (!userActions.has(record.userId)) {
        userActions.set(record.userId, []);
      }
      userActions.get(record.userId)!.push(record.action);
    }

    const patterns: BehaviorPattern[] = [];
    const patternCount = new Map<string, number>();

    for (const actions of userActions.values()) {
      if (actions.length < 3) continue;

      // 简化的模式识别
      const sequence = actions.slice(0, 10).join(',');
      patternCount.set(sequence, (patternCount.get(sequence) || 0) + 1);
    }

    for (const [pattern, count] of patternCount) {
      if (count >= minSupport) {
        patterns.push({
          id: uuidv4(),
          pattern,
          support: count,
          confidence: count / userActions.size,
          actions: pattern.split(',').map(a => a.trim() as UserAction)
        });
      }
    }

    patterns.sort((a, b) => b.confidence - a.confidence);
    this.patterns = patterns.slice(0, 50);
    return this.patterns;
  }

  /**
   * 获取用户行为预测
   */
  predictNextAction(userId: string): {
    possibleActions: Array<{action: UserAction; probability: number}>;
    confidence: number;
  } {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return { possibleActions: [], confidence: 0 };
    }

    const actionCounts = profile.actionCounts;
    const totalActions = profile.totalActions;

    const possibleActions = Object.entries(actionCounts)
      .map(([action, count]) => ({
      action: action as UserAction,
      probability: count / totalActions
    }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    const confidence = possibleActions.length > 0 ? possibleActions[0].probability : 0;

    return { possibleActions, confidence };
  }

  /**
   * 生成用户推荐
   */
  generateRecommendations(userId: string, limit: number = 5): RecommendationResult {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return { recommendations: [], basedOn: [] };
    }

    const recommendations: Array<{
      item: string; score: number; reason: string;
    }> = [];
    const basedOn: string[] = [];

    // 基于兴趣的推荐
    for (const interest of profile.interests) {
      const popularForInterest = Array.from(this.itemPopularity.entries())
        .filter(([item]) => item.toLowerCase().includes(interest.toLowerCase()))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

      for (const [item, popularity] of popularForInterest) {
        recommendations.push({
          item,
          score: popularity / this.records.length,
          reason: `基于兴趣: ${interest}`
        });
        basedOn.push(interest);
      }
    }

    // 基于热门项目的推荐
    const popularItems = Array.from(this.itemPopularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [item, popularity] of popularItems) {
      recommendations.push({
        item,
        score: popularity / this.records.length,
        reason: '热门推荐'
      });
    }

    return {
      recommendations: recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit),
      basedOn
    };
  }

  /**
   * 预测用户流失
   */
  predictChurn(userId: string): ChurnPrediction {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return {
        riskLevel: 'low',
        probability: 0,
        lastActivityDays: 999,
        recommendations: ['用户不存在']
      };
    }

    const daysSinceActive = Math.floor(
      (Date.now() - profile.lastActive.getTime()) / (1000 * 60 * 60 * 24)
    );

    let probability = 0;
    const recommendations: string[] = [];

    // 基于最后活跃时间
    if (daysSinceActive > 30) {
      probability += 0.6;
      recommendations.push('用户已30天未活动');
    } else if (daysSinceActive > 7) {
      probability += 0.3;
      recommendations.push('用户已一周未活动');
    }

    // 基于最近活动频率
    const recentActivity = this.getUserRecords(userId, 20).length;
    if (recentActivity < 5 && daysSinceActive > 3) {
      probability += 0.2;
      recommendations.push('近期活动减少');
    }

    // 基于行动多样性下降趋势
    const recentPattern = profile.actionCounts;
    const actionDiversity = (Object.keys(recentPattern) as Array<keyof typeof recentPattern>).filter(k => recentPattern[k] > 0).length;
    if (actionDiversity < 3) {
      probability += 0.2;
      recommendations.push('互动类型减少');
    }

    probability = Math.min(probability, 1);

    let riskLevel: 'low' | 'medium' | 'high';
    if (probability > 0.6) riskLevel = 'high';
    else if (probability > 0.3) riskLevel = 'medium';
    else riskLevel = 'low';

    if (recommendations.length === 0) {
      recommendations.push('继续保持当前互动');
    }

    return { riskLevel, probability, lastActivityDays: daysSinceActive, recommendations };
  }

  /**
   * 获取热门项目
   */
  getPopularItems(limit: number = 10): Array<{item: string; popularity: number}> {
    return Array.from(this.itemPopularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item, popularity]) => ({ item, popularity }));
  }

  /**
   * 获取用户分段
   */
  getSegments(): UserSegment[] {
    return Array.from(this.segments.values());
  }

  /**
   * 获取分段中的用户列表
   */
  getSegmentMembers(segmentId: string): string[] {
    const segment = this.segments.get(segmentId);
    return segment ? Array.from(segment.members) : [];
  }

  /**
   * 获取系统总体统计
   */
  getOverallStats(): {
    totalUsers: number;
    totalRecords: number;
    activeUsers24h: number;
    activeUsers7d: number;
    averageActionsPerUser: number;
    topActions: Array<{action: UserAction; count: number}>;
    mostActiveUsers: UserProfile[];
  } {
    const actionTotals: Record<UserAction, number> = {
      search: 0, view: 0, click: 0, purchase: 0,
      scroll: 0, like: 0, share: 0, comment: 0,
      follow: 0, login: 0, logout: 0, download: 0, interact: 0
    };

    for (const record of this.records) {
      actionTotals[record.action] = (actionTotals[record.action] || 0) + 1;
    }

    const topActions = Object.entries(actionTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action: action as UserAction, count }));

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const activeUsers24h = Array.from(this.profiles.values()).filter(
      p => p.lastActive.getTime() > oneDayAgo).length;
    const activeUsers7d = Array.from(this.profiles.values()).filter(
      p => p.lastActive.getTime() > sevenDaysAgo).length;

    const mostActiveUsers = Array.from(this.profiles.values())
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 10);

    return {
      totalUsers: this.profiles.size,
      totalRecords: this.records.length,
      activeUsers24h,
      activeUsers7d,
      averageActionsPerUser: this.profiles.size > 0
        ? this.records.length / this.profiles.size
        : 0,
      topActions,
      mostActiveUsers
    };
  }

  /**
   * 导出用户数据
   */
  exportUserData(userId: string): string {
    const profile = this.getProfile(userId);
    const records = this.getUserRecords(userId);
    return JSON.stringify({ profile, records }, null, 2);
  }

  /**
   * 删除用户数据
   */
  deleteUserData(userId: string): boolean {
    this.profiles.delete(userId);
    this.records = this.records.filter(r => r.userId !== userId);
    for (const segment of this.segments.values()) {
      segment.members.delete(userId);
    }
    return true;
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.records = [];
    this.profiles.clear();
    this.sessions.clear();
    this.patterns = [];
    this.itemPopularity.clear();
    for (const segment of this.segments.values()) {
      segment.members.clear();
      segment.userCount = 0;
    }
  }
}

export const userBehaviorAnalysis = new UserBehaviorAnalysis();
export default UserBehaviorAnalysis;
