/**
 * 内容审核系统 - 文本/图片/视频审核、敏感词过滤、违规检测
 */

import { v4 as uuidv4 } from 'uuid';

export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'file';
export type ModerationAction = 'pass' | 'review' | 'block' | 'replace' | 'log';
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface SensitiveWord {
  id: string;
  word: string;
  category: 'politics' | 'violence' | 'porn' | 'gambling' | 'drug' | 'spam' | 'abuse' | 'custom';
  severity: RiskLevel;
  replacement?: string;
  action: ModerationAction;
  enabled: boolean;
  createdAt: Date;
  matchCount: number;
}

export interface ModerationRule {
  id: string;
  name: string;
  description?: string;
  contentType: ContentType;
  condition: string;
  threshold: number;
  action: ModerationAction;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  matchCount: number;
}

export interface ModerationResult {
  id: string;
  contentId: string;
  contentType: ContentType;
  content: string;
  action: ModerationAction;
  riskLevel: RiskLevel;
  score: number;
  categories: string[];
  matchedWords: string[];
  matchedRules: string[];
  suggestions?: string[];
  sanitizedContent?: string;
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ModerationReport {
  id: string;
  contentId: string;
  reporter: string;
  reason: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  moderatorId?: string;
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface ModerationStats {
  total: number;
  byAction: Record<ModerationAction, number>;
  byRiskLevel: Record<RiskLevel, number>;
  byContentType: Record<ContentType, number>;
  blockRate: number;
  averageScore: number;
  recentActivity: Array<{ time: string; total: number; blocked: number }>;
  topCategories: Array<{ category: string; count: number }>;
  falsePositiveRate: number;
}

export interface ModerationConfig {
  enableTextModeration: boolean;
  enableImageModeration: boolean;
  enableVideoModeration: boolean;
  defaultAction: ModerationAction;
  blockThreshold: number;
  reviewThreshold: number;
  enableLogging: boolean;
  enableSanitization: boolean;
  enableReporting: boolean;
  maxLength: number;
}

export class ContentModerationSystem {
  private words: Map<string, SensitiveWord> = new Map();
  private rules: Map<string, ModerationRule> = new Map();
  private results: ModerationResult[] = [];
  private reports: Map<string, ModerationReport> = new Map();
  private stats: ModerationStats = {
    total: 0,
    byAction: { pass: 0, review: 0, block: 0, replace: 0, log: 0 },
    byRiskLevel: { safe: 0, low: 0, medium: 0, high: 0, critical: 0 },
    byContentType: { text: 0, image: 0, video: 0, audio: 0, file: 0 },
    blockRate: 0,
    averageScore: 0,
    recentActivity: [],
    topCategories: [],
    falsePositiveRate: 0
  };
  private config: ModerationConfig;
  private totalScore = 0;
  private falsePositives = 0;
  private truePositives = 0;

  constructor(config?: Partial<ModerationConfig>) {
    this.config = {
      enableTextModeration: true,
      enableImageModeration: true,
      enableVideoModeration: false,
      defaultAction: 'pass',
      blockThreshold: 0.8,
      reviewThreshold: 0.5,
      enableLogging: true,
      enableSanitization: true,
      enableReporting: true,
      maxLength: 100000,
      ...config
    };
    this.initializeDefaultWords();
    this.initializeDefaultRules();
  }

  private initializeDefaultWords(): void {
    const defaults = [
      { word: 'spam', category: 'spam' as const, severity: 'low' as RiskLevel },
      { word: 'advertisement', category: 'spam' as const, severity: 'low' as RiskLevel },
      { word: 'viagra', category: 'spam' as const, severity: 'high' as RiskLevel },
      { word: 'casino', category: 'gambling' as const, severity: 'high' as RiskLevel },
      { word: 'hack', category: 'violence' as const, severity: 'medium' as RiskLevel }
    ];
    for (const w of defaults) {
      this.addWord(w.word, w.category, w.severity);
    }
  }

  private initializeDefaultRules(): void {
    this.addRule('长度超限', 'text', 'length > maxLength', this.config.maxLength, 'block', 10);
    this.addRule('高风险词触发', 'text', 'risk_score >= 0.8', 0.8, 'block', 5);
    this.addRule('中风险词触发', 'text', 'risk_score >= 0.5', 0.5, 'review', 3);
    this.addRule('可疑URL', 'text', 'contains_url && spam_keywords', 0.6, 'review', 4);
  }

  addWord(
    word: string,
    category: SensitiveWord['category'],
    severity: RiskLevel,
    action: ModerationAction = 'replace',
    replacement: string = '***'
  ): string {
    const id = uuidv4();
    this.words.set(word.toLowerCase(), {
      id,
      word,
      category,
      severity,
      replacement,
      action,
      enabled: true,
      createdAt: new Date(),
      matchCount: 0
    });
    return id;
  }

  addRule(
    name: string,
    contentType: ContentType,
    condition: string,
    threshold: number,
    action: ModerationAction,
    priority: number = 1
  ): string {
    const id = uuidv4();
    this.rules.set(id, {
      id,
      name,
      contentType,
      condition,
      threshold,
      action,
      enabled: true,
      priority,
      createdAt: new Date(),
      matchCount: 0
    });
    return id;
  }

  moderate(content: string, contentType: ContentType = 'text', metadata?: Record<string, unknown>): ModerationResult {
    const start = Date.now();
    const result: ModerationResult = {
      id: uuidv4(),
      contentId: metadata?.contentId ? String(metadata.contentId) : uuidv4(),
      contentType,
      content: content.substring(0, 1000),
      action: this.config.defaultAction,
      riskLevel: 'safe',
      score: 0,
      categories: [],
      matchedWords: [],
      matchedRules: [],
      timestamp: new Date(),
      duration: 0,
      metadata
    };

    if (contentType === 'text' && this.config.enableTextModeration) {
      this.moderateText(content, result);
    } else if (contentType === 'image' && this.config.enableImageModeration) {
      this.moderateImage(content, result);
    } else if (contentType === 'video' && this.config.enableVideoModeration) {
      this.moderateVideo(content, result);
    }

    // 应用规则
    this.applyRules(result);

    // 决策
    if (result.score >= this.config.blockThreshold) {
      result.action = 'block';
      result.riskLevel = 'high';
    } else if (result.score >= this.config.reviewThreshold) {
      result.action = 'review';
      result.riskLevel = 'medium';
    } else if (result.action === 'pass') {
      result.riskLevel = result.score > 0.2 ? 'low' : 'safe';
    }

    // 清理内容
    if (this.config.enableSanitization && (result.action === 'replace' || result.action === 'review')) {
      result.sanitizedContent = this.sanitize(content, result.matchedWords);
    }

    result.duration = Date.now() - start;
    this.recordResult(result);
    return result;
  }

  private moderateText(content: string, result: ModerationResult): void {
    const lower = content.toLowerCase();
    let totalScore = 0;

    for (const [word, info] of this.words) {
      if (!info.enabled) continue;
      if (lower.includes(word)) {
        result.matchedWords.push(word);
        result.categories.push(info.category);
        info.matchCount++;
        const wordScore = this.severityToScore(info.severity);
        totalScore += wordScore;
      }
    }

    // 检测URL
    const urlMatches = content.match(/https?:\/\/[^\s]+/gi) || [];
    if (urlMatches.length > 3) {
      result.categories.push('spam');
      totalScore += 0.3;
    }

    // 检测重复字符
    const repetition = (content.match(/(.)\1{10,}/g) || []).length;
    if (repetition > 0) {
      result.categories.push('spam');
      totalScore += 0.2;
    }

    // 检测全大写
    if (content.length > 20) {
      const upper = content.replace(/[^A-Za-z]/g, '').replace(/[^A-Z]/g, '').length;
      const total = content.replace(/[^A-Za-z]/g, '').length;
      if (total > 0 && upper / total > 0.7) {
        result.categories.push('abuse');
        totalScore += 0.15;
      }
    }

    result.score = Math.min(1, totalScore);
  }

  private moderateImage(_content: string, result: ModerationResult): void {
    // 模拟图片审核 - 实际接入 OCR/NSFW 检测
    result.score = 0.1;
    result.categories.push('image_analyzed');
  }

  private moderateVideo(_content: string, result: ModerationResult): void {
    result.score = 0.1;
    result.categories.push('video_analyzed');
  }

  private severityToScore(severity: RiskLevel): number {
    return { safe: 0, low: 0.1, medium: 0.4, high: 0.7, critical: 0.95 }[severity];
  }

  private applyRules(result: ModerationResult): void {
    const sorted = Array.from(this.rules.values())
      .filter(r => r.enabled && r.contentType === result.contentType)
      .sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
      if (result.score >= rule.threshold) {
        result.matchedRules.push(rule.name);
        rule.matchCount++;
        if (rule.action === 'block' || (rule.action === 'review' && result.action === 'pass')) {
          result.action = rule.action;
        }
      }
    }
  }

  private sanitize(content: string, words: string[]): string {
    let result = content;
    for (const word of words) {
      const info = this.words.get(word);
      const replacement = info?.replacement || '***';
      const regex = new RegExp(word, 'gi');
      result = result.replace(regex, replacement);
    }
    return result;
  }

  private recordResult(result: ModerationResult): void {
    this.results.push(result);
    if (this.results.length > 10000) this.results.shift();

    this.stats.total++;
    this.stats.byAction[result.action]++;
    this.stats.byRiskLevel[result.riskLevel]++;
    this.stats.byContentType[result.contentType]++;
    this.totalScore += result.score;

    const categoryCount = new Map<string, number>();
    for (const r of this.results.slice(-100)) {
      for (const c of r.categories) {
        categoryCount.set(c, (categoryCount.get(c) || 0) + 1);
      }
    }
    this.stats.topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    this.stats.blockRate = this.stats.byAction.block / this.stats.total;
    this.stats.averageScore = this.totalScore / this.stats.total;

    const hourKey = new Date().toISOString().substring(0, 13);
    const existing = this.stats.recentActivity.find(a => a.time === hourKey);
    if (existing) {
      existing.total++;
      if (result.action === 'block') existing.blocked++;
    } else {
      this.stats.recentActivity.push({ time: hourKey, total: 1, blocked: result.action === 'block' ? 1 : 0 });
    }
    if (this.stats.recentActivity.length > 24) this.stats.recentActivity.shift();
  }

  reportContent(contentId: string, reporter: string, reason: string, category: string): string {
    const id = uuidv4();
    this.reports.set(id, {
      id,
      contentId,
      reporter,
      reason,
      category,
      status: 'pending',
      createdAt: new Date()
    });
    return id;
  }

  resolveReport(reportId: string, moderatorId: string, approved: boolean, resolution: string): boolean {
    const report = this.reports.get(reportId);
    if (!report) return false;
    report.status = approved ? 'approved' : 'rejected';
    report.moderatorId = moderatorId;
    report.resolution = resolution;
    report.resolvedAt = new Date();
    return true;
  }

  getResult(id: string): ModerationResult | undefined {
    return this.results.find(r => r.id === id);
  }

  getResultsByContentId(contentId: string): ModerationResult[] {
    return this.results.filter(r => r.contentId === contentId);
  }

  getStats(): ModerationStats {
    return { ...this.stats };
  }

  updateConfig(updates: Partial<ModerationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  removeWord(word: string): boolean {
    return this.words.delete(word.toLowerCase());
  }

  listWords(category?: SensitiveWord['category']): SensitiveWord[] {
    const all = Array.from(this.words.values());
    return category ? all.filter(w => w.category === category) : all;
  }

  listRules(): ModerationRule[] {
    return Array.from(this.rules.values());
  }

  clear(): void {
    this.results = [];
    this.stats.total = 0;
    this.totalScore = 0;
  }
}

export const contentModeration = new ContentModerationSystem();
export default ContentModerationSystem;
