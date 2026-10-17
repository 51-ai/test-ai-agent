import { v4 as uuidv4 } from 'uuid';
import { MemorySystem } from '../memory/MemorySystem';

// === 会话管理相关类型 ===
export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  agentResponse: string;
  intent?: string;
  entities?: string[];
  emotion?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationSession {
  id: string;
  userId: string;
  startTime: Date;
  lastActive: Date;
  turns: ConversationTurn[];
  currentTopic?: string;
  topicHistory: string[];
  userProfile: {
    preferences: string[];
    personality?: string;
    language?: string;
    interactionStyle?: string;
  };
  contextWindow: string[];
  isActive: boolean;
  turnCount: number;
}

export interface SessionSummary {
  sessionId: string;
  duration: number;
  turnCount: number;
  mainTopics: string[];
  keyPoints: string[];
  unresolvedQuestions: string[];
}

export interface DialogueState {
  lastTopic?: string;
  topicContinuity: number;
  awaitingClarification: boolean;
  referredEntities: string[];
  currentPhase: 'greeting' | 'problem_understanding' | 'solution' | 'closing' | 'digression';
}

export interface UserPreferences {
  preferredTopics: string[];
  language: string;
  communicationStyle: string;
  interactionCount: number;
  lastActive: Date;
}

const LOG_PREFIX = '[SessionManager]';

/**
 * 会话管理器 —— 从 Agent.ts 中提取
 * 职责：管理用户对话会话的完整生命周期（创建→活跃→结束→归档）
 */
export class SessionManager {
  private conversationSessions = new Map<string, ConversationSession>();
  private dialogueState = new Map<string, DialogueState>();
  private userPreferences = new Map<string, UserPreferences>();
  private sessionCache = new Map<string, SessionSummary>();
  private activeSessionId: string | null = null;

  private readonly maxContextTurns = 10;
  private readonly sessionTimeoutMs = 30 * 60 * 1000; // 30分钟

  // 主题关键词库
  private topicKeywords = new Map<string, string[]>([
    ['technology', ['代码', '编程', '程序', '算法', 'AI', '人工智能', '机器学习', '开发', '软件']],
    ['business', ['商业', '市场', '营销', '销售', '客户', '产品', '策略', '公司']],
    ['education', ['学习', '教育', '课程', '老师', '学校', '培训', '知识', '考试']],
    ['health', ['健康', '医疗', '疾病', '医院', '药物', '锻炼', '饮食', '养生']],
    ['entertainment', ['游戏', '电影', '音乐', '视频', '娱乐', '节目', '动漫']],
    ['finance', ['股票', '基金', '投资', '理财', '银行', '贷款', '保险', '汇率']],
    ['travel', ['旅行', '旅游', '酒店', '机票', '签证', '景点', '攻略']],
  ]);

  constructor(private memorySystem: MemorySystem) {}

  // ==================== 会话生命周期 ====================

  /**
   * 确保用户有活跃的会话，无则创建
   */
  ensureSession(userId: string, prefs?: Partial<UserPreferences>): ConversationSession {
    let session = this.conversationSessions.get(userId);

    if (!session || !session.isActive) {
      session = this.createNewSession(userId, prefs);
      this.conversationSessions.set(userId, session);
      this.activeSessionId = session.id;
    }

    session.lastActive = new Date();
    session.isActive = true;
    return session;
  }

  /**
   * 创建新会话
   */
  private createNewSession(userId: string, prefs?: Partial<UserPreferences>): ConversationSession {
    const userPref = this.userPreferences.get(userId);
    return {
      id: this.generateSessionId(userId),
      userId,
      startTime: new Date(),
      lastActive: new Date(),
      turns: [],
      topicHistory: [],
      userProfile: {
        preferences: prefs?.preferredTopics || userPref?.preferredTopics || [],
        language: prefs?.language || userPref?.language || 'zh',
        interactionStyle: prefs?.communicationStyle || userPref?.communicationStyle || 'normal'
      },
      contextWindow: [],
      isActive: true,
      turnCount: 0
    };
  }

  /**
   * 记录对话轮次
   */
  recordTurn(
    userId: string,
    input: string,
    response: string,
    intent?: string,
    entities?: string[],
    emotion?: string
  ): void {
    const session = this.conversationSessions.get(userId);
    if (!session) return;

    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      userInput: input,
      agentResponse: response,
      intent,
      entities,
      emotion
    };

    session.turns.push(turn);
    session.turnCount++;
    session.lastActive = new Date();

    // 更新上下文窗口（保留最近N轮）
    session.contextWindow.push(`用户: ${input}；助手: ${response.substring(0, 100)}`);
    if (session.contextWindow.length > this.maxContextTurns) {
      session.contextWindow = session.contextWindow.slice(-this.maxContextTurns);
    }

    // 更新对话状态
    this.updateDialogueState(userId, input, intent || 'unknown');
  }

  /**
   * 结束会话并生成摘要，重要信息存入长期记忆
   */
  finalizeSession(userId: string): SessionSummary | null {
    const session = this.conversationSessions.get(userId);
    if (!session) return null;

    session.isActive = false;

    const summary = this.generateSessionSummary(session);
    this.sessionCache.set(session.id, summary);

    // 将重要信息保存到长期记忆
    if (session.turns.length > 2) {
      try {
        this.memorySystem.addLongTermMemory(
          `[会话摘要 ${session.startTime.toLocaleString()}] 主题: ${summary.mainTopics.join(', ') || '一般对话'}；共${summary.turnCount}轮对话；主要内容: ${summary.keyPoints.slice(0, 3).join('；')}`,
          'event',
          {
            source: 'conversation_summary',
            confidence: 0.9,
            tags: ['conversation', 'summary', ...summary.mainTopics]
          }
        );
      } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to store session summary to memory`, e);
      }
    }

    this.conversationSessions.delete(userId);
    return summary;
  }

  // ==================== 会话查询 ====================

  getSession(userId: string): ConversationSession | undefined {
    return this.conversationSessions.get(userId);
  }

  getSessionSummary(userId: string): SessionSummary | null {
    const session = this.conversationSessions.get(userId);
    if (!session) {
      // 尝试从缓存获取
      for (const [id, summary] of this.sessionCache.entries()) {
        if (id.startsWith(`session_${userId}_`)) return summary;
      }
      return null;
    }
    return this.generateSessionSummary(session);
  }

  getActiveSessionInfo(userId: string): { turnCount: number; topics: string[]; sessionAge: number } | null {
    const session = this.conversationSessions.get(userId);
    if (!session || !session.isActive) return null;
    return {
      turnCount: session.turnCount,
      topics: session.topicHistory.slice(-5),
      sessionAge: Date.now() - session.startTime.getTime()
    };
  }

  getActiveUsers(): string[] {
    return Array.from(this.conversationSessions.entries())
      .filter(([, s]) => s.isActive)
      .map(([userId]) => userId);
  }

  endCurrentSession(userId: string): boolean {
    return this.finalizeSession(userId) !== null;
  }

  // ==================== 对话状态跟踪 ====================

  getDialogueState(userId: string): DialogueState {
    return this.dialogueState.get(userId) || {
      topicContinuity: 0,
      awaitingClarification: false,
      referredEntities: [],
      currentPhase: 'greeting'
    };
  }

  /**
   * 更新对话状态：话题追踪、实体引用、追问检测
   */
  private updateDialogueState(userId: string, input: string, intent: string): void {
    const state = this.getDialogueState(userId);

    // 检测主题变化
    const detectedTopic = this.detectTopic(input);
    if (state.lastTopic && detectedTopic === state.lastTopic) {
      state.topicContinuity++;
    } else {
      state.topicContinuity = 0;
    }
    state.lastTopic = detectedTopic;

    // 检测是否需要追问
    state.awaitingClarification = this.needsClarification(input);

    // 提取并记录提到的实体
    const entities = this.extractEntitiesFromInput(input);
    state.referredEntities = [...state.referredEntities, ...entities].slice(-20);

    // 判断对话阶段
    state.currentPhase = this.detectPhase(input, state.topicContinuity, intent);

    this.dialogueState.set(userId, state);
  }

  // ==================== 话题检测 ====================

  private detectTopic(input: string): string | undefined {
    const lowerInput = input.toLowerCase();
    let bestTopic: string | undefined;
    let bestScore = 0;

    for (const [topic, keywords] of this.topicKeywords.entries()) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }
    return bestTopic;
  }

  // ==================== 实体提取（简单规则版） ====================

  private extractEntitiesFromInput(input: string): string[] {
    const entities: string[] = [];
    // URL
    const urls = input.match(/https?:\/\/[^\s]+/g);
    if (urls) entities.push(...urls);
    // 邮箱
    const emails = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emails) entities.push(...emails);
    // 日期
    const dates = input.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g);
    if (dates) entities.push(...dates);
    // 金额
    const amounts = input.match(/\d+(\.\d{1,2})?\s*[元美元欧元日元]/g);
    if (amounts) entities.push(...amounts);
    return entities;
  }

  // ==================== 追问检测 ====================

  private needsClarification(input: string): boolean {
    const clarificationPatterns = [
      /^什么意思[？?]?$/,
      /^不太明白/,
      /^能再说一遍/,
      /^能解释一下/,
      /^具体.*怎么/,
      /^为什么/,
      /^(什么|啥)意思/,
      /^没听懂/,
      /^再说一次/,
      /^what do you mean/i,
      /^can you explain/i,
    ];
    return clarificationPatterns.some(p => p.test(input.trim()));
  }

  // ==================== 对话阶段检测 ====================

  private detectPhase(
    input: string,
    topicContinuity: number,
    intent: string
  ): DialogueState['currentPhase'] {
    if (intent === 'greeting') return 'greeting';
    if (intent === 'goodbye') return 'closing';
    if (topicContinuity > 3) return 'solution';
    if (this.needsClarification(input)) return 'problem_understanding';
    return topicContinuity === 0 ? 'greeting' : 'problem_understanding';
  }

  // ==================== 会话摘要 ====================

  private generateSessionSummary(session: ConversationSession): SessionSummary {
    const duration = session.lastActive.getTime() - session.startTime.getTime();
    const mainTopics = this.extractMainTopics(session);
    const keyPoints = this.extractKeyPoints(session);
    const unresolvedQuestions = this.extractUnresolvedQuestions(session);

    return {
      sessionId: session.id,
      duration,
      turnCount: session.turnCount,
      mainTopics,
      keyPoints,
      unresolvedQuestions
    };
  }

  private extractMainTopics(session: ConversationSession): string[] {
    const topicCount = new Map<string, number>();
    for (const topic of session.topicHistory) {
      topicCount.set(topic, (topicCount.get(topic) || 0) + 1);
    }
    return Array.from(topicCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private extractKeyPoints(session: ConversationSession): string[] {
    return session.turns
      .filter(t => t.agentResponse && t.agentResponse.length > 50)
      .slice(-5)
      .map(t => t.agentResponse.substring(0, 80) + (t.agentResponse.length > 80 ? '...' : ''));
  }

  private extractUnresolvedQuestions(session: ConversationSession): string[] {
    const questions: string[] = [];
    const lastTurns = session.turns.slice(-3);
    for (const turn of lastTurns) {
      if (turn.userInput.includes('?') || turn.userInput.includes('？')) {
        const hasAnswer = lastTurns.some(
          t => t !== turn && t.agentResponse && t.agentResponse.length > 20
        );
        if (!hasAnswer) {
          questions.push(turn.userInput);
        }
      }
    }
    return questions;
  }

  // ==================== 用户偏好 ====================

  updateUserPreferences(
    userId: string,
    input: string,
    response: string,
    emotion?: string
  ): UserPreferences {
    let prefs = this.userPreferences.get(userId) || {
      preferredTopics: [],
      language: 'zh',
      communicationStyle: 'normal',
      interactionCount: 0,
      lastActive: new Date()
    };

    prefs.interactionCount++;
    prefs.lastActive = new Date();

    // 语言检测（简单规则）
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(input)) {
      prefs.language = 'ja';
    } else if (/[a-zA-Z]{3,}/.test(input)) {
      prefs.language = 'en';
    }

    // 话题偏好学习
    const topic = this.detectTopic(input);
    if (topic && !prefs.preferredTopics.includes(topic)) {
      prefs.preferredTopics.push(topic);
      if (prefs.preferredTopics.length > 20) {
        prefs.preferredTopics = prefs.preferredTopics.slice(-20);
      }
    }

    this.userPreferences.set(userId, prefs);
    return prefs;
  }

  getUserPreferences(userId: string): UserPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  // ==================== 清理维护 ====================

  /**
   * 清理过期会话（超过30分钟无活动）
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, session] of this.conversationSessions.entries()) {
      if (now - session.lastActive.getTime() > this.sessionTimeoutMs) {
        this.finalizeSession(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`${LOG_PREFIX} Cleaned ${cleaned} expired sessions`);
    }
    return cleaned;
  }

  // ==================== 统计 ====================

  getStats() {
    const active = Array.from(this.conversationSessions.values()).filter(s => s.isActive);
    return {
      activeSessions: active.length,
      totalSessions: this.conversationSessions.size + this.sessionCache.size,
      cachedSummaries: this.sessionCache.size,
      averageTurnsPerSession: active.length > 0
        ? Math.round(active.reduce((sum, s) => sum + s.turnCount, 0) / active.length)
        : 0,
      activeUsers: active.map(s => s.userId)
    };
  }

  private generateSessionId(userId: string): string {
    return `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getTopicKeywords(): Map<string, string[]> {
    return this.topicKeywords;
  }
}
