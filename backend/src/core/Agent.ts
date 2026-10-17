import { PerceptionModule } from './perception/PerceptionModule';
import { DecisionEngine } from './decision/DecisionEngine';
import { ExecutionEngine } from './execution/ExecutionEngine';
import { MemorySystem } from './memory/MemorySystem';
import { NLPModule } from './nlp/NLPModule';
import { ToolManager } from './tools/ToolManager';
import { ToolExecutor } from './tool-enhance';
import { webSearchTool, codeExecutorTool, documentTool, dataAnalysisTool, cloudServiceTool } from './tools/external';
import { AgentResponse, Task, Emotion } from '../types';
import { LLMService, getLLMService, DEFAULT_SYSTEM_PROMPT } from '../services/LLMService';

import { RLModule } from './rl';
import { SpecialEventSystem, SPECIAL_EVENT_TEMPLATES, type SpecialEvent } from './rl/SpecialEvents';
import { DialogueEvaluator } from './agent-core/DialogueEvaluator';
import { RAGSystem } from './rag';
import { EvaluationSystem } from './evaluation';
import { DataGovernanceSystem } from './dataGovernance';
import { MonitoringSystem } from './system-monitoring';
import { ContinuousIterationSystem } from './continuousIteration';
import LoggingSystem from './logging/LoggingSystem';
import SearchEngine from './search/SearchEngine';
import TaskScheduler from './scheduler/TaskScheduler';
import UserBehaviorAnalysis from './user-behavior/UserBehaviorAnalysis';
import WorkflowEngine from './workflow/WorkflowEngine';
import AnalyticsEngine from './analysis/AnalyticsEngine';
import AuditSystem from './audit/AuditSystem';
import CacheManager from './cache/CacheManager';
import ConfigManager from './config/ConfigManager';
import NotificationSystem from './notification/NotificationSystem';
import RateLimiter from './rate-limit/RateLimiter';
import ContentModerationSystem from './moderation/ContentModerationSystem';
import DataPipeline from './pipeline/DataPipeline';
import FeatureEngineering from './feature-engineering/FeatureEngineering';
import ModelManagement from './model-management/ModelManagement';
import MessageQueue from './message-queue/MessageQueue';
import DistributedLock from './distributed-lock/DistributedLock';
import I18n from './i18n/I18n';
import ApiGateway from './gateway/ApiGateway';
import UserSegmentation from './user-segmentation/UserSegmentation';
import RecommendationEngine from './recommendation/RecommendationEngine';
import AnomalyDetector from './anomaly/AnomalyDetector';
import CostTracker from './cost/CostTracker';
import ABTestingFramework from './ab-testing/ABTestingFramework';

export interface FAQCacheEntry {
  answer: string;
  hitCount: number;
  lastHit: Date;
  matchPatterns: string[];
}

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

// === 新增：对话质量评估相关类型 ===
export interface DialogueQualityScore {
  overall: number;
  relevance: number;
  usefulness: number;
  accuracy: number;
  completeness: number;
  clarity: number;
  timeliness: number;
  reasoning: string;
  improvementSuggestions: string[];
}

// === 新增：用户画像相关类型 ===
export interface UserProfile {
  userId: string;
  preferredLanguage: 'zh' | 'en' | 'ja' | 'auto';
  communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';
  responseLengthPreference: 'short' | 'medium' | 'long';
  knowledgeLevel: 'beginner' | 'intermediate' | 'expert';
  interestTopics: string[];
  emotionalTendency: 'positive' | 'neutral' | 'negative';
  interactionCount: number;
  avgTurnLength: number;
  lastActive: Date;
  preferredTone: string[];
  technicalTopics: string[];
  nonTechnicalTopics: string[];
  questionPatterns: string[];
}

// === 新增：对话流程控制相关类型 ===
export interface DialogueFlowAnalysis {
  isInterrupted: boolean;
  interruptionReason?: string;
  topicSwitchDetected: boolean;
  topicSwitchReason?: string;
  previousTopic?: string;
  currentTopic?: string;
  contextConsistency: 'high' | 'medium' | 'low';
  contextConsistencyScore: number;
  dialoguePhase: 'greeting' | 'problem_understanding' | 'solution' | 'closing' | 'digression';
  flowCoherenceScore: number;
  suggestions: string[];
  needsRedirection: boolean;
  recommendedResponseStrategy: string;
}

// === 新增：多语言响应文本类型 ===
export interface MultilingualText {
  zh: string;
  en: string;
  ja?: string;
}

// === 新增：情感自适应响应类型 ===
export interface EmotionalContext {
  primaryEmotion: 'happy' | 'sad' | 'angry' | 'anxious' | 'confused' | 'neutral' | 'excited' | 'frustrated';
  intensity: number;
  confidence: number;
  emotionKeywords: string[];
  sentimentPolarity: number;
  recommendedTone: string;
}

// === 新增：主动对话建议类型 ===
export interface ProactiveSuggestion {
  topic: string;
  rationale: string;
  priority: number;
  userRelevance: number;
  followUpQuestion: string;
}

export class Agent {
  private perceptionModule: PerceptionModule;
  private decisionEngine: DecisionEngine;
  private executionEngine: ExecutionEngine;
  private memorySystem: MemorySystem;
  private nlpModule: NLPModule;
  private toolManager: ToolManager;
  private llmService: LLMService | null;

  private rlModule: RLModule;
  private specialEvents: SpecialEventSystem;
  /** agent-core 对话质量评估器：为 RL 提供 reward 信号（评估→强化闭环） */
  private dialogueEvaluator: DialogueEvaluator;
  private ragSystem: RAGSystem;
  private evaluationSystem: EvaluationSystem;
  private dataGovernanceSystem: DataGovernanceSystem;
  private monitoringSystem: MonitoringSystem;
  private continuousIterationSystem: ContinuousIterationSystem;

  // === 新增的19+个核心模块 ===
  private loggingSystem: LoggingSystem;
  private searchEngine: SearchEngine;
  private taskScheduler: TaskScheduler;
  private userBehaviorAnalysis: UserBehaviorAnalysis;
  private workflowEngine: WorkflowEngine;
  private analyticsEngine: AnalyticsEngine;
  private auditSystem: AuditSystem;
  private cacheManager: CacheManager;
  private configManager: ConfigManager;
  private notificationSystem: NotificationSystem;
  private rateLimiter: RateLimiter;
  private contentModeration: ContentModerationSystem;
  private dataPipeline: DataPipeline;
  private featureEngineering: FeatureEngineering;
  private modelManagement: ModelManagement;
  private messageQueue: MessageQueue;
  private distributedLock: DistributedLock;
  private i18n: I18n;
  private apiGateway: ApiGateway;
  private userSegmentation: UserSegmentation;
  private recommendation: RecommendationEngine;
  private anomalyDetector: AnomalyDetector;
  private costTracker: CostTracker;
  private abTesting: ABTestingFramework;

  // FAQ缓存和统计
  private faqCache: Map<string, FAQCacheEntry> = new Map();
  private faqStats = {
    totalQueries: 0,
    cacheHits: 0,
    matchAttempts: 0
  };

  // === 新增：会话管理系统 ===
  private conversationSessions: Map<string, ConversationSession> = new Map();
  private activeSessionId?: string;
  private maxContextTurns: number = 10;
  private sessionTimeoutMs: number = 30 * 60 * 1000;
  private sessionCache: Map<string, SessionSummary> = new Map();

  // === 新增：对话状态追踪 ===
  private dialogueState: Map<string, {
    pendingQuestion?: string;
    awaitingClarification: boolean;
    lastTopic?: string;
    topicContinuity: number;
    referredEntities: string[];
  }> = new Map();

  // === 新增：用户画像与偏好学习 ===
  private userPreferences: Map<string, {
    preferredTopics: string[];
    communicationStyle: string;
    responseLength: 'short' | 'medium' | 'long';
    formality: 'formal' | 'casual';
    language: string;
    interactionHistory: {
      positiveCount: number;
      negativeCount: number;
      totalInteractions: number;
    };
    learnedTopics: string[];
  }> = new Map();

  // === 新增：对话流程控制 ===
  private dialogueFlowControl: Map<string, {
    conversationPhase: 'greeting' | 'problem_understanding' | 'solution' | 'closing';
    emotionState: 'neutral' | 'positive' | 'negative' | 'confused';
    questionsAsked: number;
    responsesGiven: number;
    lastInputLength: number;
    inputComplexityTrend: number[];
    needsFollowUp: boolean;
    suggestedNextTopic?: string;
  }> = new Map();

  // === 新增：引用解析 ===
  private referenceResolver: Map<string, string[]> = new Map();

  // === 新增：对话上下文增强器 ===
  private contextEnhancer: {
    topicKeywords: Map<string, string[]>;
    topicTransitionWords: string[];
    clarificationPhrases: string[];
  } = {
    topicKeywords: new Map(),
    topicTransitionWords: [
      '对了', '顺便问一下', '还有一个问题', '换个话题', '说到', '关于',
      'by the way', 'another thing', 'speaking of', 'changing topic'
    ],
    clarificationPhrases: [
      '你的意思是', '你是说', '我理解的对吗', '是这个意思吗',
      'you mean', 'do you mean', 'if I understand correctly'
    ]
  };

  // === 新增：对话质量评分存储 ===
  private dialogueQualityHistory: Map<string, DialogueQualityScore[]> = new Map();

  // === 新增：用户画像系统 ===
  private userProfiles: Map<string, UserProfile> = new Map();

  // === 新增：对话流程分析历史 ===
  private dialogueFlowHistory: Map<string, DialogueFlowAnalysis[]> = new Map();

  // === 新增：情感上下文历史 ===
  private emotionalContextHistory: Map<string, EmotionalContext[]> = new Map();

  // === 新增：对话摘要历史 ===
  private dialogueSummaries: Map<string, string[]> = new Map();

  // === 新增：上下文窗口动态调整 ===
  private dynamicContextConfig: Map<string, {
    targetSize: number;
    complexity: number;
    importanceThreshold: number;
  }> = new Map();

  // === 新增：主题关键词扩展（用于质量评估和画像） ===
  private topicDictionary: Record<string, string[]> = {
    programming: ['python', 'javascript', 'java', 'c++', 'code', 'program', '算法', '代码', '编程', 'bug', '调试', '函数', '变量', 'sql', 'html', 'css', 'node'],
    ai: ['ai', '人工智能', '机器学习', '深度学习', 'llm', 'gpt', '模型', '神经网络', 'prompt', 'agent'],
    education: ['学习', '教育', '课程', '知识', '考试', '复习', '记忆', '方法', '技巧', 'study', 'learn'],
    health: ['健康', '锻炼', '运动', '身体', '睡眠', '饮食', '压力', '心理', '焦虑', 'health', 'exercise'],
    work: ['工作', '职场', '面试', '简历', '职业', '晋升', '老板', '同事', 'job', 'career', 'work'],
    finance: ['股票', '基金', '投资', '理财', '钱', '银行', '贷款', '金融', 'money', 'finance', '投资'],
    emotion: ['开心', '难过', '伤心', '生气', '焦虑', '压力', '喜欢', '烦恼', '不开心', '郁闷', '情绪'],
    entertainment: ['游戏', '电影', '音乐', '电视剧', '动漫', '娱乐', '推荐', '好玩', 'game', 'movie', 'music'],
    life: ['生活', '朋友', '家人', '沟通', '交流', '建议', '怎么办', '关系'],
    tech: ['电脑', '手机', '平板', '网络', 'wifi', '软件', 'app', '硬件', 'cpu', '内存', '硬盘']
  };

  // === 新增：情感关键词词典 ===
  private emotionDictionary: Record<string, { emotion: EmotionalContext['primaryEmotion']; intensity: number }> = {
    '开心': { emotion: 'happy', intensity: 0.7 },
    '高兴': { emotion: 'happy', intensity: 0.7 },
    '兴奋': { emotion: 'excited', intensity: 0.8 },
    '快乐': { emotion: 'happy', intensity: 0.6 },
    '棒': { emotion: 'happy', intensity: 0.6 },
    '好': { emotion: 'happy', intensity: 0.4 },
    '谢谢': { emotion: 'happy', intensity: 0.5 },
    '感谢': { emotion: 'happy', intensity: 0.5 },
    '难过': { emotion: 'sad', intensity: 0.7 },
    '伤心': { emotion: 'sad', intensity: 0.7 },
    '沮丧': { emotion: 'sad', intensity: 0.7 },
    '失望': { emotion: 'sad', intensity: 0.6 },
    '不开心': { emotion: 'sad', intensity: 0.6 },
    '郁闷': { emotion: 'sad', intensity: 0.5 },
    '生气': { emotion: 'angry', intensity: 0.7 },
    '愤怒': { emotion: 'angry', intensity: 0.9 },
    '烦': { emotion: 'angry', intensity: 0.5 },
    '讨厌': { emotion: 'angry', intensity: 0.6 },
    '糟糕': { emotion: 'frustrated', intensity: 0.6 },
    '焦虑': { emotion: 'anxious', intensity: 0.7 },
    '紧张': { emotion: 'anxious', intensity: 0.6 },
    '害怕': { emotion: 'anxious', intensity: 0.7 },
    '恐惧': { emotion: 'anxious', intensity: 0.8 },
    '担心': { emotion: 'anxious', intensity: 0.5 },
    '压力': { emotion: 'anxious', intensity: 0.6 },
    '迷茫': { emotion: 'confused', intensity: 0.6 },
    '不知道': { emotion: 'confused', intensity: 0.4 },
    '困惑': { emotion: 'confused', intensity: 0.6 },
    '不明白': { emotion: 'confused', intensity: 0.5 },
    '累': { emotion: 'frustrated', intensity: 0.5 },
    '很累': { emotion: 'frustrated', intensity: 0.7 },
    '辛苦': { emotion: 'frustrated', intensity: 0.5 },
    '糟糕透了': { emotion: 'frustrated', intensity: 0.9 },
    'happy': { emotion: 'happy', intensity: 0.7 },
    'glad': { emotion: 'happy', intensity: 0.6 },
    'excited': { emotion: 'excited', intensity: 0.8 },
    'sad': { emotion: 'sad', intensity: 0.7 },
    'angry': { emotion: 'angry', intensity: 0.8 },
    'anxious': { emotion: 'anxious', intensity: 0.7 },
    'confused': { emotion: 'confused', intensity: 0.6 },
    'frustrated': { emotion: 'frustrated', intensity: 0.7 },
    'tired': { emotion: 'frustrated', intensity: 0.5 },
    'thank': { emotion: 'happy', intensity: 0.5 }
  };

  // === 新增：多语言静态模板 ===
  private multilingualTemplates: Record<string, MultilingualText> = {
    greeting: { zh: '您好！很高兴为您服务！', en: 'Hello! How can I help you today?', ja: 'こんにちは！何かお手伝いできますか？' },
    farewell: { zh: '再见！祝您有美好的一天！', en: 'Goodbye! Have a nice day!', ja: 'さようなら！良い一日を！' },
    clarify: { zh: '您能说得更详细一些吗？', en: 'Could you elaborate on that?', ja: 'もう少し詳しく教えていただけますか？' },
    thanks: { zh: '不客气！能帮到您我很开心。', en: "You're welcome! I'm glad I could help.", ja: 'どういたしまして！お役に立てて嬉しいです。' },
    default: { zh: '这是个有意思的话题！让我帮您分析一下。', en: 'That is an interesting topic! Let me help you analyze it.', ja: '興味深いトピックですね！分析のお手伝いをします。' }
  };

  constructor() {
    this.perceptionModule = new PerceptionModule();
    this.decisionEngine = new DecisionEngine();
    this.executionEngine = new ExecutionEngine();
    this.memorySystem = new MemorySystem('global-session');
    this.nlpModule = new NLPModule();
    this.toolManager = new ToolManager();
    this.llmService = getLLMService();

    this.rlModule = new RLModule();
    this.specialEvents = this.rlModule.getSpecialEventSystem();
    this.dialogueEvaluator = new DialogueEvaluator();
    this.ragSystem = new RAGSystem();
    this.evaluationSystem = new EvaluationSystem();
    this.dataGovernanceSystem = new DataGovernanceSystem();
    this.monitoringSystem = new MonitoringSystem();
    this.continuousIterationSystem = new ContinuousIterationSystem();

    // === 初始化19+个新增模块 ===
    this.loggingSystem = new LoggingSystem();
    this.searchEngine = new SearchEngine();
    this.taskScheduler = new TaskScheduler();
    this.userBehaviorAnalysis = new UserBehaviorAnalysis();
    this.workflowEngine = new WorkflowEngine();
    this.analyticsEngine = new AnalyticsEngine();
    this.auditSystem = new AuditSystem();
    this.cacheManager = new CacheManager();
    this.configManager = new ConfigManager();
    this.notificationSystem = new NotificationSystem();
    this.rateLimiter = new RateLimiter();
    this.contentModeration = new ContentModerationSystem();
    this.dataPipeline = new DataPipeline();
    this.featureEngineering = new FeatureEngineering();
    this.modelManagement = new ModelManagement();
    this.messageQueue = new MessageQueue();
    this.distributedLock = new DistributedLock();
    this.i18n = new I18n();
    this.apiGateway = new ApiGateway();
    this.userSegmentation = new UserSegmentation();
    this.recommendation = new RecommendationEngine();
    this.anomalyDetector = new AnomalyDetector();
    this.costTracker = new CostTracker();
    this.abTesting = new ABTestingFramework();
    // 成本告警默认监听
    this.costTracker.onAlert((budget, current) => {
      // eslint-disable-next-line no-console
      console.warn(`[CostTracker] 预算告警: ${budget.scope.type}:${budget.scope.key ?? '*'} 当前=${current.toFixed(4)} 限制=${budget.limit}`);
    });

    // 设置SpecialEvents与记忆系统集成
    this.setupSpecialEventsMemoryIntegration();

    // 初始化默认主题关键词
    this.initializeTopicKeywords();

    this.registerDefaultTools();

    // 注册定时清理任务到任务调度器
    this.setupScheduledTasks();
  }

  // === 初始化主题关键词 ===
  private initializeTopicKeywords(): void {
    const topics = {
      '编程': ['代码', '编程', '程序', '开发', 'Python', 'JavaScript', 'bug', '错误', '算法', '函数', '变量'],
      '学习': ['学习', '教程', '课程', '方法', '记住', '记忆', '考试', '复习', '知识'],
      '健康': ['健康', '锻炼', '运动', '饮食', '睡眠', '压力', '心理', '减肥', '健身'],
      '工作': ['工作', '职场', '面试', '简历', '职业', '薪水', '晋升', '老板', '同事'],
      'AI/技术': ['AI', '人工智能', '机器学习', '深度学习', '模型', 'ChatGPT', '大模型', '算法'],
      '金融': ['股票', '基金', '投资', '理财', '钱', '银行', '贷款', '利息', '金融'],
      '情感': ['开心', '难过', '伤心', '生气', '焦虑', '压力', '喜欢', '爱', '烦恼', '不开心'],
      '娱乐': ['游戏', '电影', '音乐', '电视剧', '动漫', '娱乐', '推荐', '好玩'],
      '生活': ['生活', '朋友', '家人', '人际关系', '沟通', '交流', '建议', '怎么办']
    };
    for (const [topic, keywords] of Object.entries(topics)) {
      this.contextEnhancer.topicKeywords.set(topic, keywords);
    }
  }

  private registerDefaultTools(): void {
    this.registerTool('web_search', '网络搜索工具，用于获取实时信息', webSearchTool);
    this.registerTool('code_executor', '代码执行工具，支持Python和JavaScript', codeExecutorTool);
    this.registerTool('document_tool', '文档处理工具，支持PDF/Word/Excel', documentTool);
    this.registerTool('data_analysis', '数据分析工具，支持SQL查询与数据可视化', dataAnalysisTool);
    this.registerTool('cloud_service', '云服务工具，支持AWS和Azure', cloudServiceTool);
  }

  /**
   * 设置定时任务 - 通过任务调度器调度周期性的清理、统计、备份等
   */
  private setupScheduledTasks(): void {
    // 每5分钟清理过期的FAQ缓存
    this.taskScheduler.scheduleInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.faqCache.entries()) {
        if (now - entry.lastHit.getTime() > 24 * 60 * 60 * 1000 && entry.hitCount < 3) {
          this.faqCache.delete(key);
        }
      }
      this.loggingSystem.info('FAQ缓存清理完成');
    }, 5 * 60 * 1000);

    // 每10分钟统计用户行为
    this.taskScheduler.scheduleInterval(() => {
      const stats = this.userBehaviorAnalysis.getOverallStats();
      this.loggingSystem.info('用户行为统计', { stats });
    }, 10 * 60 * 1000);

    // 每小时检查审计日志
    this.taskScheduler.scheduleInterval(() => {
      const logs = this.auditSystem.query({ limit: 100 });
      const critical = logs.filter(l => l.level === 'critical');
      if (critical.length > 0) {
        this.notificationSystem.send({
          channel: 'in_app',
          recipient: 'admin',
          subject: '严重审计日志警告',
          content: `检测到 ${critical.length} 条严重审计日志`,
          priority: 'high',
          maxRetries: 3
        });
      }
    }, 60 * 60 * 1000);

    // 每30分钟生成分析报告
    this.taskScheduler.scheduleInterval(() => {
      this.loggingSystem.info('分析报告已生成');
    }, 30 * 60 * 1000);

    // 每天凌晨清理过期会话
    this.taskScheduler.scheduleCron(() => {
      this.cleanupExpiredSessions();
      this.loggingSystem.info('每日清理任务完成');
    }, '0 0 * * *');
  }

  /**
   * 设置SpecialEvents与记忆系统的集成
   */
  private setupSpecialEventsMemoryIntegration(): void {
    this.specialEvents.setMemoryIntegration((event: SpecialEvent) => {
      // 根据事件严重性决定记忆类型
      const memoryType: 'event' | 'knowledge' = 
        event.severity === 'critical' || event.severity === 'high' ? 'knowledge' : 'event';
      
      // 构建记忆内容
      let memoryContent = `[${event.category.toUpperCase()}] ${event.title}: ${event.description}`;
      
      if (event.suggestedAction) {
        memoryContent += `\n建议行动: ${event.suggestedAction}`;
      }
      
      if (event.tags.length > 0) {
        memoryContent += `\n标签: ${event.tags.join(', ')}`;
      }

      // 添加到记忆系统
      this.memorySystem.addLongTermMemory(memoryContent, memoryType, {
        confidence: 0.9,
        tags: [event.category, event.severity, ...event.tags]
      });
    });
  }

  /**
   * 触发特殊事件
   */
  private triggerSpecialEvent(
    templateKey: keyof typeof SPECIAL_EVENT_TEMPLATES,
    context: SpecialEvent['context'],
    options?: {
      reward?: number;
      customValues?: Record<string, string | number>;
    }
  ): SpecialEvent {
    // 使用RLModule的triggerSpecialEvent方法，这样事件会有正确的episode和step信息
    return this.rlModule.triggerSpecialEvent(templateKey, context, options);
  }

  // ========== 会话管理核心方法 ==========

  /**
   * 确保用户有活跃的会话
   */
  private ensureSession(userId: string): ConversationSession {
    let session = this.conversationSessions.get(userId);

    if (!session || !session.isActive) {
      session = this.createNewSession(userId);
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
  private createNewSession(userId: string): ConversationSession {
    const prefs = this.userPreferences.get(userId);
    return {
      id: this.generateSessionId(userId),
      userId,
      startTime: new Date(),
      lastActive: new Date(),
      turns: [],
      topicHistory: [],
      userProfile: {
        preferences: prefs?.preferredTopics || [],
        language: prefs?.language || 'zh',
        interactionStyle: prefs?.communicationStyle || 'normal'
      },
      contextWindow: [],
      isActive: true,
      turnCount: 0
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(userId: string): string {
    return `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [userId, session] of this.conversationSessions.entries()) {
      if (now - session.lastActive.getTime() > this.sessionTimeoutMs) {
        this.finalizeSession(userId);
      }
    }
  }

  /**
   * 结束会话并生成摘要
   */
  private finalizeSession(userId: string): void {
    const session = this.conversationSessions.get(userId);
    if (!session) return;

    session.isActive = false;

    const summary = this.generateSessionSummary(session);
    this.sessionCache.set(session.id, summary);

    // 将重要信息保存到长期记忆
    if (session.turns.length > 2) {
      this.memorySystem.addLongTermMemory(
        `[会话摘要 ${session.startTime.toLocaleString()}] 主题: ${summary.mainTopics.join(', ') || '一般对话'}；共${summary.turnCount}轮对话；主要内容: ${summary.keyPoints.slice(0, 3).join('；')}`,
        'knowledge',
        {
          confidence: 0.8,
          tags: ['conversation', 'summary', ...summary.mainTopics]
        }
      );
    }

    this.conversationSessions.delete(userId);
  }

  /**
   * 记录对话轮次
   */
  private recordTurn(userId: string, input: string, response: string, intent?: string, entities?: string[], emotion?: string): void {
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

    // 更新用户偏好学习
    this.updateUserPreferences(userId, input, response, emotion);

    // 更新对话流程控制
    this.updateFlowControl(userId, input, response, emotion);
  }

  /**
   * 更新对话状态
   */
  private updateDialogueState(userId: string, input: string, intent: string): void {
    const state = this.dialogueState.get(userId) || {
      awaitingClarification: false,
      topicContinuity: 0,
      referredEntities: []
    };

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

    this.dialogueState.set(userId, state);
  }

  /**
   * 检测输入主题
   */
  private detectTopic(input: string): string | undefined {
    const lowerInput = input.toLowerCase();
    let bestTopic: string | undefined;
    let bestScore = 0;

    for (const [topic, keywords] of this.contextEnhancer.topicKeywords.entries()) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }

    return bestScore >= 2 ? bestTopic : undefined;
  }

  /**
   * 从输入中提取实体
   */
  private extractEntitiesFromInput(input: string): string[] {
    const entities: string[] = [];
    const lowerInput = input.toLowerCase();

    // 提取编程语言
    const languages = ['python', 'javascript', 'java', 'c++', 'c#', 'go', 'rust', 'typescript', 'ruby', 'php'];
    for (const lang of languages) {
      if (lowerInput.includes(lang)) entities.push(lang);
    }

    // 提取主题词
    for (const [topic, keywords] of this.contextEnhancer.topicKeywords.entries()) {
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword.toLowerCase()) && !entities.includes(topic)) {
          entities.push(topic);
          break;
        }
      }
    }

    return entities.slice(0, 5);
  }

  /**
   * 判断输入是否需要澄清
   */
  private needsClarification(input: string): boolean {
    if (input.length < 5) return true;
    if (/^(什么|怎么|为什么|是|对|不|不是|嗯|哦|啊|好|好的|知道了)$/.test(input.trim())) return true;
    return false;
  }

  /**
   * 增强输入：解析代词、添加上下文
   */
  private enhanceInputWithContext(input: string, userId: string): string {
    const session = this.conversationSessions.get(userId);
    const state = this.dialogueState.get(userId);
    if (!session || session.turns.length === 0) return input;

    let enhanced = input;

    // 解析常见代词
    if (/(这个|那个|它|他|她|这个东西|那个问题|这件事|那件事)/.test(input)) {
      const referredEntity = this.resolveReference(input, userId);
      if (referredEntity) {
        enhanced = input + '（指：' + referredEntity + '）';
      }
    }

    // 检测话题切换并添加上下文
    const detectedTopic = this.detectTopic(input);
    const sessionTopics = session.topicHistory;
    if (!detectedTopic && sessionTopics.length > 0) {
      const lastTopic = sessionTopics[sessionTopics.length - 1];
      if (lastTopic) {
        enhanced = `[上下文: ${lastTopic}] ` + input;
      }
    } else if (detectedTopic) {
      if (!session.topicHistory.includes(detectedTopic)) {
        session.topicHistory.push(detectedTopic);
      }
    }

    return enhanced;
  }

  /**
   * 解析代词引用
   */
  private resolveReference(input: string, userId: string): string | undefined {
    const state = this.dialogueState.get(userId);
    if (!state || state.referredEntities.length === 0) return undefined;

    // 尝试从最近提到的实体中解析
    const recentEntities = state.referredEntities.slice(-5);

    // 匹配不同类型的引用
    if (/这个问题|那个问题|这件事|那件事/.test(input)) {
      const session = this.conversationSessions.get(userId);
      if (session && session.turns.length > 0) {
        const lastTurn = session.turns[session.turns.length - 1];
        return `之前讨论的内容: ${lastTurn.userInput.substring(0, 30)}...`;
      }
    }

    return recentEntities[recentEntities.length - 1];
  }

  /**
   * 更新用户偏好学习
   */
  private updateUserPreferences(userId: string, input: string, response: string, emotion?: string): void {
    const prefs = this.userPreferences.get(userId) || {
      preferredTopics: [],
      communicationStyle: 'normal',
      responseLength: 'medium',
      formality: 'casual',
      language: 'zh',
      interactionHistory: { positiveCount: 0, negativeCount: 0, totalInteractions: 0 },
      learnedTopics: []
    };

    // 计数
    prefs.interactionHistory.totalInteractions++;
    if (emotion === 'positive') prefs.interactionHistory.positiveCount++;
    if (emotion === 'negative') prefs.interactionHistory.negativeCount++;

    // 学习用户感兴趣的主题
    const detectedTopic = this.detectTopic(input);
    if (detectedTopic && !prefs.learnedTopics.includes(detectedTopic)) {
      prefs.learnedTopics.push(detectedTopic);
    }

    // 分析响应长度偏好
    if (input.length > 100) prefs.responseLength = 'long';
    else if (input.length > 30) prefs.responseLength = 'medium';
    else prefs.responseLength = 'short';

    // 检测语言
    if (/[a-zA-Z]{5,}/.test(input) && !/[\u4e00-\u9fa5]/.test(input)) {
      prefs.language = 'en';
    } else {
      prefs.language = 'zh';
    }

    this.userPreferences.set(userId, prefs);
  }

  /**
   * 更新对话流程控制
   */
  private updateFlowControl(userId: string, input: string, response: string, emotion?: string): void {
    const flow = this.dialogueFlowControl.get(userId) || {
      conversationPhase: 'greeting',
      emotionState: 'neutral',
      questionsAsked: 0,
      responsesGiven: 0,
      lastInputLength: 0,
      inputComplexityTrend: [],
      needsFollowUp: false
    };

    // 更新状态
    flow.responsesGiven++;
    flow.lastInputLength = input.length;
    flow.inputComplexityTrend.push(input.length);
    if (flow.inputComplexityTrend.length > 10) flow.inputComplexityTrend.shift();

    // 情绪状态
    if (emotion) {
      if (emotion.includes('positive') || emotion.includes('happy')) flow.emotionState = 'positive';
      else if (emotion.includes('negative') || emotion.includes('sad') || emotion.includes('angry')) flow.emotionState = 'negative';
      else flow.emotionState = 'neutral';
    }

    // 更新对话阶段
    if (flow.responsesGiven === 1) flow.conversationPhase = 'greeting';
    else if (flow.responsesGiven < 5) flow.conversationPhase = 'problem_understanding';
    else flow.conversationPhase = 'solution';

    // 判断是否需要追问
    flow.needsFollowUp = this.shouldFollowUp(input, response);

    this.dialogueFlowControl.set(userId, flow);
  }

  /**
   * 判断是否应该追问
   */
  private shouldFollowUp(input: string, response: string): boolean {
    // 如果回答很短而问题很复杂
    if (input.length > 50 && response.length < 30) return true;
    // 如果问题包含多个问号
    if ((input.match(/[？?]/g) || []).length > 1) return true;
    // 如果输入看起来是在寻求确认
    if (/是不是|对不对|能不能|可以吗|好吗|是吗/.test(input)) return true;
    return false;
  }

  /**
   * 获取会话上下文
   */
  private getSessionContext(userId: string): string {
    const session = this.conversationSessions.get(userId);
    if (!session || session.contextWindow.length === 0) return '';

    return `[最近对话] ${session.contextWindow.slice(-3).join(' | ')}`;
  }

  /**
   * 生成会话摘要
   */
  private generateSessionSummary(session: ConversationSession): SessionSummary {
    const mainTopics: string[] = [];
    const keyPoints: string[] = [];
    const unresolvedQuestions: string[] = [];

    // 分析主要主题
    for (const turn of session.turns) {
      const topic = this.detectTopic(turn.userInput);
      if (topic && !mainTopics.includes(topic)) mainTopics.push(topic);
      if (turn.userInput.includes('?') || turn.userInput.includes('？')) {
        if (turn.agentResponse.length < 20) {
          unresolvedQuestions.push(turn.userInput);
        }
      }
    }

    // 提取关键点
    if (session.turns.length > 0) {
      const sortedTurns = [...session.turns].sort((a, b) => b.userInput.length - a.userInput.length);
      for (const turn of sortedTurns.slice(0, 5)) {
        if (turn.userInput.length > 10) {
          keyPoints.push(turn.userInput.substring(0, 50));
        }
      }
    }

    const duration = session.lastActive.getTime() - session.startTime.getTime();

    return {
      sessionId: session.id,
      duration,
      turnCount: session.turnCount,
      mainTopics,
      keyPoints,
      unresolvedQuestions
    };
  }

  /**
   * 获取会话摘要（对外方法）
   */
  getSessionSummary(userId: string): SessionSummary | null {
    const session = this.conversationSessions.get(userId);
    if (!session) {
      return null;
    }
    return this.generateSessionSummary(session);
  }

  /**
   * 获取活跃会话信息
   */
  getActiveSessionInfo(userId: string): { turnCount: number; topics: string[]; sessionAge: number } | null {
    const session = this.conversationSessions.get(userId);
    if (!session || !session.isActive) return null;

    return {
      turnCount: session.turnCount,
      topics: session.topicHistory,
      sessionAge: Date.now() - session.startTime.getTime()
    };
  }

  /**
   * 主动结束当前会话
   */
  endCurrentSession(userId: string): boolean {
    const session = this.conversationSessions.get(userId);
    if (!session) return false;
    this.finalizeSession(userId);
    return true;
  }

  /**
   * 获取所有活跃用户
   */
  getActiveUsers(): string[] {
    const users: string[] = [];
    for (const [userId, session] of this.conversationSessions.entries()) {
      if (session.isActive) users.push(userId);
    }
    return users;
  }

  // ===================================================================
  // === 1. 对话质量评估系统 (Dialogue Quality Evaluation) ============
  // ===================================================================

  /**
   * 评估对话轮次质量，基于相关性、有用性、准确性、完整性、清晰度、时效性等维度
   */
  evaluateDialogueQuality(userId: string, userInput: string, agentResponse: string, intent?: string): DialogueQualityScore {
    const reasoning: string[] = [];
    const suggestions: string[] = [];

    // 1. 相关性评估：响应是否与输入相关
    let relevance = 0.5;
    const inputKeywords = this.extractKeywords(userInput);
    const responseKeywords = this.extractKeywords(agentResponse);
    if (inputKeywords.length > 0 && responseKeywords.length > 0) {
      const overlap = inputKeywords.filter(k => responseKeywords.some(r => r.includes(k) || k.includes(r))).length;
      relevance = Math.min(1, 0.3 + (overlap / Math.max(inputKeywords.length, 1)) * 0.7);
      if (relevance < 0.4) reasoning.push('响应关键词与问题匹配度较低');
    } else if (agentResponse.length < 20) {
      relevance = 0.3;
      reasoning.push('响应过短，可能缺乏实质内容');
    } else {
      relevance = 0.7;
    }

    // 2. 有用性评估：是否包含实用信息/建议/步骤
    let usefulness = 0.5;
    const usefulMarkers = ['建议', '可以', '方法', '步骤', '试试', '推荐', 'should', 'try', 'recommend', '•', '-', '1.', '2.', '3.', '：', ':'];
    const usefulCount = usefulMarkers.filter(m => agentResponse.toLowerCase().includes(m.toLowerCase())).length;
    usefulness = Math.min(1, 0.4 + usefulCount * 0.1);
    if (usefulness < 0.5) suggestions.push('可以在响应中加入具体建议、步骤或操作指引');

    // 3. 准确性评估：是否有事实性/可验证内容
    let accuracy = 0.6;
    const uncertaintyMarkers = ['可能', '也许', '或许', '不确定', 'maybe', 'perhaps', 'not sure'];
    const hasUncertainty = uncertaintyMarkers.some(m => agentResponse.toLowerCase().includes(m.toLowerCase()));
    const isQuestionResponse = /什么|怎么|如何|为什么|是否|？|\?/.test(userInput);
    if (isQuestionResponse) {
      accuracy = hasUncertainty ? Math.max(0.3, accuracy - 0.2) : Math.min(0.95, accuracy + 0.1);
      if (agentResponse.length > 100) accuracy = Math.min(1, accuracy + 0.05);
    }
    if (hasUncertainty) reasoning.push('响应包含不确定性表述');

    // 4. 完整性评估：响应是否完整回答了问题
    let completeness = 0.5;
    const questionMarks = (userInput.match(/[？?]/g) || []).length;
    if (questionMarks > 1) {
      const periodCount = (agentResponse.match(/[。.!！]/g) || []).length;
      completeness = Math.min(1, 0.4 + (periodCount / Math.max(questionMarks, 1)) * 0.5);
    } else {
      completeness = agentResponse.length > 50 ? 0.8 : agentResponse.length > 20 ? 0.6 : 0.4;
    }
    if (completeness < 0.5) suggestions.push('响应可能不够完整，建议补充更多细节');

    // 5. 清晰度评估：是否有清晰的结构
    let clarity = 0.5;
    const structureMarkers = ['\n', '•', '1.', '2.', '3.', '（1）', '（2）', '：', ':'];
    const hasStructure = structureMarkers.some(m => agentResponse.includes(m));
    const averageSentenceLength = agentResponse.length / Math.max(1, agentResponse.split(/[。.!！\n]/).length);
    clarity = hasStructure ? 0.85 : (averageSentenceLength < 50 ? 0.7 : 0.55);
    if (!hasStructure && agentResponse.length > 100) suggestions.push('建议使用列表或分段方式提升可读性');

    // 6. 时效性评估：响应是否及时（基于长度推断响应效率）
    let timeliness = 0.7;
    if (intent === 'question' && agentResponse.length < 30) timeliness = 0.5;
    if (agentResponse.length > 500) timeliness = 0.55;
    if (agentResponse.length >= 50 && agentResponse.length <= 300) timeliness = 0.9;

    // 加权汇总
    const overall = Number(
      (relevance * 0.25 + usefulness * 0.2 + accuracy * 0.15 + completeness * 0.2 + clarity * 0.15 + timeliness * 0.05).toFixed(2)
    );

    if (reasoning.length === 0) reasoning.push('响应与问题相关，质量在合理范围内');

    const score: DialogueQualityScore = {
      overall,
      relevance: Number(relevance.toFixed(2)),
      usefulness: Number(usefulness.toFixed(2)),
      accuracy: Number(accuracy.toFixed(2)),
      completeness: Number(completeness.toFixed(2)),
      clarity: Number(clarity.toFixed(2)),
      timeliness: Number(timeliness.toFixed(2)),
      reasoning: reasoning.join('；'),
      improvementSuggestions: suggestions.length > 0 ? suggestions : ['保持现有响应风格即可']
    };

    // 记录到用户历史
    const history = this.dialogueQualityHistory.get(userId) || [];
    history.push(score);
    if (history.length > 50) history.shift();
    this.dialogueQualityHistory.set(userId, history);

    return score;
  }

  /**
   * 从文本中提取关键词（简单但实用的实现）
   */
  private extractKeywords(text: string): string[] {
    if (!text || text.length === 0) return [];
    const lower = text.toLowerCase();
    // 中英文混合分词：英文按空格，中文取2-4字词
    const englishWords = lower.match(/[a-z]{3,}/g) || [];
    const chineseWords: string[] = [];
    const chineseChars = lower.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseChars) {
      if (segment.length >= 2) {
        for (let i = 0; i <= segment.length - 2; i++) {
          chineseWords.push(segment.substring(i, i + 2));
        }
      }
    }
    const stopwords = ['什么', '怎么', '为什么', '如何', '这个', '那个', '你好', '请问', 'the', 'and', 'for', 'are', 'you', 'how', 'what', 'why', 'can', 'will'];
    return [...englishWords, ...chineseWords].filter(w => !stopwords.includes(w)).slice(0, 20);
  }

  /**
   * 获取用户平均对话质量
   */
  getAverageQualityScore(userId: string): DialogueQualityScore | null {
    const history = this.dialogueQualityHistory.get(userId);
    if (!history || history.length === 0) return null;
    const avg = (key: keyof DialogueQualityScore): number => {
      const vals = history.map(h => (typeof h[key] === 'number' ? (h[key] as number) : 0));
      return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
    };
    return {
      overall: avg('overall'),
      relevance: avg('relevance'),
      usefulness: avg('usefulness'),
      accuracy: avg('accuracy'),
      completeness: avg('completeness'),
      clarity: avg('clarity'),
      timeliness: avg('timeliness'),
      reasoning: `基于 ${history.length} 轮对话的平均质量`,
      improvementSuggestions: ['持续保持良好的交互风格']
    };
  }

  // ===================================================================
  // === 2. 智能上下文管理 (Smart Context Management) =================
  // ===================================================================

  /**
   * 根据对话复杂度动态调整上下文窗口大小并评分记忆重要性
   */
  smartManageContextWindow(userId: string, currentInput: string): {
    retainedTurns: string[];
    recommendedSize: number;
    complexityScore: number;
    prunedCount: number;
  } {
    const session = this.conversationSessions.get(userId);
    if (!session) {
      return { retainedTurns: [], recommendedSize: 10, complexityScore: 0, prunedCount: 0 };
    }

    // 1. 计算当前输入的复杂度
    const complexityScore = this.calculateInputComplexity(currentInput);

    // 2. 根据复杂度推荐上下文窗口大小
    const baseSize = 10;
    let recommendedSize = baseSize;
    if (complexityScore >= 0.7) recommendedSize = 20; // 复杂问题保留更多
    else if (complexityScore >= 0.4) recommendedSize = 15;
    else recommendedSize = 8; // 简单问题缩小窗口节省资源

    // 3. 对历史对话进行重要性评分并保留重要部分
    const turns = session.turns;
    const scoredTurns = turns.map((t, idx) => {
      const importance = this.scoreTurnImportance(t, currentInput, idx, turns.length);
      return { turn: t, importance, idx };
    });

    // 保留：最近 N 轮 + 高重要性历史轮（超出窗口但重要的）
    const recentTurns = scoredTurns.slice(-recommendedSize);
    const olderImportant = scoredTurns
      .slice(0, -recommendedSize)
      .filter(s => s.importance >= 0.75)
      .slice(-3);

    const retained = [...olderImportant, ...recentTurns]
      .sort((a, b) => a.idx - b.idx)
      .map(s => `[重要度${Math.round(s.importance * 100)}%] ${s.turn.userInput.substring(0, 60)}`);

    const prunedCount = turns.length - recentTurns.length - olderImportant.length;

    // 4. 更新动态配置
    this.dynamicContextConfig.set(userId, {
      targetSize: recommendedSize,
      complexity: complexityScore,
      importanceThreshold: 0.75
    });

    // 5. 同步更新会话的上下文窗口
    if (session.contextWindow.length > recommendedSize) {
      session.contextWindow = session.contextWindow.slice(-recommendedSize);
    }
    this.maxContextTurns = Math.max(this.maxContextTurns, recommendedSize);

    return {
      retainedTurns: retained,
      recommendedSize,
      complexityScore: Number(complexityScore.toFixed(2)),
      prunedCount: Math.max(0, prunedCount)
    };
  }

  /**
   * 计算输入的复杂度分数 (0-1)
   */
  private calculateInputComplexity(input: string): number {
    if (!input || input.length === 0) return 0;
    // 因素：长度、句数、问号数、技术关键词数、数字/符号
    const lengthScore = Math.min(1, input.length / 200);
    const sentenceCount = Math.max(1, input.split(/[。.!？?]/).length);
    const questionCount = (input.match(/[？?]/g) || []).length;
    const questionScore = Math.min(1, questionCount * 0.3);
    let technicalScore = 0;
    const combinedKeywords = Object.values(this.topicDictionary).flat();
    for (const kw of combinedKeywords) {
      if (input.toLowerCase().includes(kw.toLowerCase())) technicalScore += 0.1;
    }
    technicalScore = Math.min(1, technicalScore);
    const numSymbolScore = Math.min(1, ((input.match(/[0-9+\-*/=]/g) || []).length) * 0.05);
    return Math.min(1, lengthScore * 0.3 + questionScore * 0.3 + technicalScore * 0.3 + numSymbolScore * 0.1);
  }

  /**
   * 对历史对话轮次进行重要性评分
   */
  private scoreTurnImportance(turn: ConversationTurn, currentInput: string, index: number, total: number): number {
    // 因素：与当前输入的关键词重叠、问题类型、是否包含情感表达、位置权重
    const currentKw = new Set(this.extractKeywords(currentInput).map(k => k.toLowerCase()));
    const turnKw = this.extractKeywords(turn.userInput).map(k => k.toLowerCase());
    let overlapScore = 0;
    if (currentKw.size > 0) {
      const match = turnKw.filter(k => currentKw.has(k)).length;
      overlapScore = match / Math.max(currentKw.size, 1);
    }

    const questionScore = turn.userInput.includes('？') || turn.userInput.includes('?') ? 0.3 : 0.1;
    const emotionScore = turn.emotion && turn.emotion !== 'neutral' ? 0.2 : 0.05;
    const lengthScore = Math.min(0.2, turn.userInput.length / 500);
    // 位置：越近越重要
    const recencyScore = total > 0 ? (index / total) * 0.2 : 0.1;

    return Math.min(1, overlapScore * 0.4 + questionScore + emotionScore + lengthScore + recencyScore);
  }

  /**
   * 对外暴露：获取当前用户的上下文配置
   */
  getContextConfig(userId: string) {
    return this.dynamicContextConfig.get(userId) || null;
  }

  // ===================================================================
  // === 3. 用户画像系统 (User Profiling) ===============================
  // ===================================================================

  /**
   * 构建并更新用户画像：记录偏好、语言风格、知识水平、兴趣领域
   */
  buildAndUpdateUserProfile(userId: string, userInput: string, response: string): UserProfile {
    const existing = this.userProfiles.get(userId);
    const now = new Date();

    // 1. 语言检测
    let language: UserProfile['preferredLanguage'] = 'zh';
    if (/[a-zA-Z]{5,}/.test(userInput) && !/[\u4e00-\u9fa5]/.test(userInput)) {
      language = 'en';
    } else if (/[\u3040-\u30ff]/.test(userInput) && !/[\u4e00-\u9fa5]/.test(userInput)) {
      language = 'ja';
    }

    // 2. 沟通风格判断
    let style: UserProfile['communicationStyle'] = 'friendly';
    if (/先生|女士|您好|贵|请|请问|麻烦/.test(userInput)) style = 'formal';
    else if (/python|javascript|算法|代码|函数|变量|sql|bug|debug/.test(userInput.toLowerCase())) style = 'technical';
    else if (/嘿|哎|哈哈|啦|呢|呀/.test(userInput)) style = 'casual';

    // 3. 响应长度偏好
    const lengthPref: UserProfile['responseLengthPreference'] =
      userInput.length > 100 ? 'long' : userInput.length > 30 ? 'medium' : 'short';

    // 4. 知识水平推断（基于技术关键词密度）
    let knowledgeLevel: UserProfile['knowledgeLevel'] = 'beginner';
    const techKeywords = [...(this.topicDictionary.ai || []), ...(this.topicDictionary.programming || [])];
    const techMatchCount = techKeywords.filter(k => userInput.toLowerCase().includes(k.toLowerCase())).length;
    if (techMatchCount >= 5) knowledgeLevel = 'expert';
    else if (techMatchCount >= 2) knowledgeLevel = 'intermediate';

    // 5. 兴趣主题
    const interestTopics: string[] = [];
    for (const [topic, keywords] of Object.entries(this.topicDictionary)) {
      const match = keywords.filter(k => userInput.toLowerCase().includes(k.toLowerCase())).length;
      if (match >= 1) interestTopics.push(topic);
    }

    // 6. 情感倾向
    let emotionalTendency: UserProfile['emotionalTendency'] = 'neutral';
    const emotion = this.detectEmotionFromInput(userInput);
    if (emotion.primaryEmotion === 'happy' || emotion.primaryEmotion === 'excited') emotionalTendency = 'positive';
    else if (['sad', 'angry', 'anxious', 'frustrated'].includes(emotion.primaryEmotion)) emotionalTendency = 'negative';

    // 7. 技术/非技术主题分类
    const technicalTopics = interestTopics.filter(t => ['programming', 'ai', 'tech', 'finance'].includes(t));
    const nonTechnicalTopics = interestTopics.filter(t => !['programming', 'ai', 'tech', 'finance'].includes(t));

    // 8. 问题模式
    const questionPatterns: string[] = [];
    if (/怎么|如何|怎样/.test(userInput)) questionPatterns.push('how-to');
    if (/什么|是什么|什么是/.test(userInput)) questionPatterns.push('definition');
    if (/为什么|原因/.test(userInput)) questionPatterns.push('why');
    if (/哪里|在哪|哪个/.test(userInput)) questionPatterns.push('where-which');
    if (/多少|多少钱|价格/.test(userInput)) questionPatterns.push('quantity-price');
    if (/推荐|建议/.test(userInput)) questionPatterns.push('recommendation');

    // 9. 合并/更新
    const nextInteractionCount = (existing?.interactionCount || 0) + 1;
    const prevAvg = existing?.avgTurnLength || userInput.length;
    const newAvg = (prevAvg * (nextInteractionCount - 1) + userInput.length) / nextInteractionCount;

    const profile: UserProfile = {
      userId,
      preferredLanguage: language,
      communicationStyle: style,
      responseLengthPreference: lengthPref,
      knowledgeLevel,
      interestTopics: this.mergeTopN(existing?.interestTopics || [], interestTopics, 8),
      emotionalTendency,
      interactionCount: nextInteractionCount,
      avgTurnLength: Math.round(newAvg),
      lastActive: now,
      preferredTone: this.mergeTopN(existing?.preferredTone || [], [style], 3),
      technicalTopics: this.mergeTopN(existing?.technicalTopics || [], technicalTopics, 5),
      nonTechnicalTopics: this.mergeTopN(existing?.nonTechnicalTopics || [], nonTechnicalTopics, 5),
      questionPatterns: this.mergeTopN(existing?.questionPatterns || [], questionPatterns, 6)
    };

    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * 合并两个列表并去重，保留前 N 项
   */
  private mergeTopN(oldList: string[], newItems: string[], topN: number): string[] {
    const merged: string[] = [...oldList];
    for (const item of newItems) {
      if (!merged.includes(item)) merged.push(item);
    }
    return merged.slice(0, topN);
  }

  /**
   * 获取用户画像（对外方法）
   */
  getUserProfile(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  // ===================================================================
  // === 4. 对话流程控制 (Dialogue Flow Control) ========================
  // ===================================================================

  /**
   * 分析对话流程：检测中断、主题切换、上下文一致性
   */
  analyzeDialogueFlow(userId: string, currentInput: string): DialogueFlowAnalysis {
    const session = this.conversationSessions.get(userId);
    const flowHistory = this.dialogueFlowHistory.get(userId) || [];
    const lastAnalysis = flowHistory.length > 0 ? flowHistory[flowHistory.length - 1] : null;

    const suggestions: string[] = [];
    let isInterrupted = false;
    let interruptionReason: string | undefined;
    let topicSwitchDetected = false;
    let topicSwitchReason: string | undefined;

    // 1. 检测主题
    const currentTopic = this.detectTopic(currentInput) || 'general';
    const previousTopic = session?.topicHistory?.[session.topicHistory.length - 2] || lastAnalysis?.currentTopic;

    // 2. 主题切换检测
    if (previousTopic && currentTopic !== previousTopic) {
      topicSwitchDetected = true;
      const transitionWords = this.contextEnhancer.topicTransitionWords;
      const explicit = transitionWords.some(w => currentInput.toLowerCase().includes(w.toLowerCase()));
      topicSwitchReason = explicit ? '用户使用显式切换词（如"对了"、"顺便问一下"等）' : `主题从"${previousTopic}"切换到"${currentTopic}"`;
      suggestions.push(`检测到主题切换：${previousTopic} → ${currentTopic}`);
    }

    // 3. 对话中断检测（输入突然变短、使用否定词、表示离开）
    const interruptionMarkers = ['算了', '不用了', '没关系', '没事', '下次再说', '先这样', '再见', '拜拜', 'bye', 'never mind', 'forget it'];
    const hasInterruptionMarker = interruptionMarkers.some(m => currentInput.toLowerCase().includes(m.toLowerCase()));
    const isVeryShort = currentInput.trim().length < 5 && flowHistory.length > 1;
    if (hasInterruptionMarker || isVeryShort) {
      isInterrupted = true;
      interruptionReason = hasInterruptionMarker ? '用户表达终止/放弃的意图' : '输入突然变短，可能表示失去兴趣';
      suggestions.push('检测到对话即将中断');
    }

    // 4. 上下文一致性评估
    let contextConsistencyScore = 0.7;
    if (session && session.turns.length > 0) {
      const lastTurn = session.turns[session.turns.length - 1];
      const lastKw = new Set(this.extractKeywords(lastTurn.userInput));
      const currKw = this.extractKeywords(currentInput);
      if (currKw.length > 0 && lastKw.size > 0) {
        const match = currKw.filter(k => lastKw.has(k)).length;
        contextConsistencyScore = match / currKw.length;
      } else if (topicSwitchDetected) {
        contextConsistencyScore = 0.3;
      }
    }
    const contextConsistency: DialogueFlowAnalysis['contextConsistency'] =
      contextConsistencyScore >= 0.6 ? 'high' : contextConsistencyScore >= 0.35 ? 'medium' : 'low';

    // 5. 对话阶段判断
    let dialoguePhase: DialogueFlowAnalysis['dialoguePhase'] = 'greeting';
    if (session) {
      const turnCount = session.turns.length;
      if (turnCount <= 1) dialoguePhase = 'greeting';
      else if (turnCount <= 3) dialoguePhase = 'problem_understanding';
      else if (turnCount <= 8) dialoguePhase = 'solution';
      else if (isInterrupted) dialoguePhase = 'closing';
      else dialoguePhase = topicSwitchDetected ? 'digression' : 'solution';
    }

    // 6. 流程连贯性综合评分
    let flowCoherence = 0.5;
    if (!topicSwitchDetected && !isInterrupted) flowCoherence += 0.2;
    flowCoherence += contextConsistencyScore * 0.2;
    if (session && session.turns.length > 5) flowCoherence += 0.1;
    flowCoherence = Math.min(1, Math.max(0, flowCoherence));

    // 7. 是否需要重定向
    const needsRedirection = !!(isInterrupted || (contextConsistencyScore < 0.3 && session && session.turns.length > 2));

    // 8. 推荐响应策略
    let recommendedResponseStrategy = 'continue_current_topic';
    if (isInterrupted) recommendedResponseStrategy = 'offer_farewell_or_summary';
    else if (topicSwitchDetected) recommendedResponseStrategy = 'acknowledge_then_focus_new_topic';
    else if (contextConsistencyScore < 0.4) recommendedResponseStrategy = 'ask_clarification';
    else if (dialoguePhase === 'solution') recommendedResponseStrategy = 'provide_structured_solution';

    const analysis: DialogueFlowAnalysis = {
      isInterrupted,
      interruptionReason,
      topicSwitchDetected,
      topicSwitchReason,
      previousTopic,
      currentTopic,
      contextConsistency,
      contextConsistencyScore: Number(contextConsistencyScore.toFixed(2)),
      dialoguePhase,
      flowCoherenceScore: Number(flowCoherence.toFixed(2)),
      suggestions: suggestions.length > 0 ? suggestions : ['对话流程正常，无需调整'],
      needsRedirection,
      recommendedResponseStrategy
    };

    flowHistory.push(analysis);
    if (flowHistory.length > 30) flowHistory.shift();
    this.dialogueFlowHistory.set(userId, flowHistory);

    return analysis;
  }

  /**
   * 获取最近对话流程分析
   */
  getRecentFlowAnalysis(userId: string): DialogueFlowAnalysis | null {
    const history = this.dialogueFlowHistory.get(userId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  // ===================================================================
  // === 5. 对话摘要生成 (Dialogue Summary Generation) ==================
  // ===================================================================

  /**
   * 自动生成对话摘要并存储到记忆系统
   */
  generateDialogueSummary(userId: string): string {
    const session = this.conversationSessions.get(userId);
    if (!session || session.turns.length === 0) {
      return '暂无对话记录可供摘要。';
    }

    const turns = session.turns;
    const topics = new Set<string>();
    const keyPoints: string[] = [];
    let questions = 0;
    let unresolved = 0;

    // 遍历每一轮，收集主题和关键内容
    for (const turn of turns) {
      const topic = this.detectTopic(turn.userInput);
      if (topic) topics.add(topic);
      if (/[？?]/.test(turn.userInput)) {
        questions++;
        if (turn.agentResponse.length < 25) unresolved++;
      }
      if (turn.userInput.length >= 40) {
        keyPoints.push(turn.userInput.substring(0, 80) + (turn.userInput.length > 80 ? '…' : ''));
      }
    }

    // 拼接摘要
    const summaryLines: string[] = [];
    summaryLines.push(`【对话摘要】时间: ${session.startTime.toLocaleString()}，共 ${turns.length} 轮对话`);
    if (topics.size > 0) summaryLines.push(`• 涉及主题: ${Array.from(topics).join('、')}`);
    if (questions > 0) summaryLines.push(`• 提出问题: ${questions} 个（其中 ${unresolved} 个响应较短可能需关注）`);
    if (keyPoints.length > 0) {
      summaryLines.push(`• 关键要点:`);
      for (const kp of keyPoints.slice(0, 5)) summaryLines.push(`  - "${kp}"`);
    }
    const summary = summaryLines.join('\n');

    // 存储到历史
    const history = this.dialogueSummaries.get(userId) || [];
    history.push(summary);
    if (history.length > 10) history.shift();
    this.dialogueSummaries.set(userId, history);

    // 写入长期记忆
    this.memorySystem.addLongTermMemory(summary, 'knowledge', {
      confidence: 0.85,
      tags: ['dialogue', 'summary', ...Array.from(topics)]
    });

    return summary;
  }

  /**
   * 获取用户所有对话摘要
   */
  getDialogueSummaries(userId: string): string[] {
    return this.dialogueSummaries.get(userId) || [];
  }

  // ===================================================================
  // === 6. 多语言响应 (Multilingual Response) =========================
  // ===================================================================

  /**
   * 检测用户语言并返回相应语言的响应
   */
  respondInDetectedLanguage(userInput: string, templateKey?: string): {
    detectedLanguage: 'zh' | 'en' | 'ja';
    response: string;
  } {
    const detected = this.detectLanguageFromText(userInput);
    let response: string;

    if (templateKey && this.multilingualTemplates[templateKey]) {
      const tpl = this.multilingualTemplates[templateKey];
      response = detected === 'ja' && tpl.ja ? tpl.ja : tpl[detected] || tpl.zh;
    } else {
      // 根据语言生成默认响应
      switch (detected) {
        case 'en':
          response = this.generateEnglishResponse(userInput);
          break;
        case 'ja':
          response = this.generateJapaneseResponse(userInput);
          break;
        case 'zh':
        default:
          response = this.generateChineseResponse(userInput);
      }
    }

    return { detectedLanguage: detected, response };
  }

  /**
   * 从文本中检测语言
   */
  private detectLanguageFromText(text: string): 'zh' | 'en' | 'ja' {
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const hasJapanese = /[\u3040-\u30ff]/.test(text);
    const hasEnglish = /[a-zA-Z]{5,}/.test(text);

    if (hasChinese || (!hasEnglish && !hasJapanese)) return 'zh';
    if (hasJapanese) return 'ja';
    if (hasEnglish) return 'en';
    return 'zh';
  }

  private generateChineseResponse(input: string): string {
    const topic = this.detectTopic(input) || '您提到的内容';
    return `收到！关于 "${topic}"，我理解您的意思了。请告诉我更多细节，或者您希望我从哪个方面帮您分析？`;
  }

  private generateEnglishResponse(input: string): string {
    const topic = this.extractKeywords(input)[0] || 'your topic';
    return `I understand your message about "${topic}". Could you tell me more details? I'm here to help.`;
  }

  private generateJapaneseResponse(input: string): string {
    const topic = this.extractKeywords(input)[0] || 'トピック';
    return `「${topic}」について承知いたしました。もう少し詳しく教えていただけますか？`;
  }

  // ===================================================================
  // === 7. 情感自适应响应 (Emotion-Adaptive Response) =================
  // ===================================================================

  /**
   * 从用户输入中检测情感上下文
   */
  detectEmotionFromInput(userInput: string): EmotionalContext {
    const lower = userInput.toLowerCase();
    const matchedKeywords: string[] = [];
    let totalIntensity = 0;
    const emotionVotes = new Map<EmotionalContext['primaryEmotion'], number>();

    for (const [keyword, info] of Object.entries(this.emotionDictionary)) {
      if (lower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        totalIntensity += info.intensity;
        emotionVotes.set(info.emotion, (emotionVotes.get(info.emotion) || 0) + info.intensity);
      }
    }

    // 选择得票最高的情感
    let primaryEmotion: EmotionalContext['primaryEmotion'] = 'neutral';
    let maxVote = 0;
    for (const [em, v] of emotionVotes.entries()) {
      if (v > maxVote) {
        maxVote = v;
        primaryEmotion = em;
      }
    }

    const intensity = matchedKeywords.length > 0 ? Math.min(1, totalIntensity / matchedKeywords.length) : 0;
    const confidence = matchedKeywords.length > 0 ? Math.min(1, 0.4 + matchedKeywords.length * 0.15) : 0.2;

    // 情感极性：positive=1，neutral=0，negative=-1
    let polarity = 0;
    if (primaryEmotion === 'happy' || primaryEmotion === 'excited') polarity = intensity;
    else if (['sad', 'angry', 'anxious', 'frustrated'].includes(primaryEmotion)) polarity = -intensity;

    let recommendedTone = '中立且礼貌';
    if (primaryEmotion === 'happy' || primaryEmotion === 'excited') recommendedTone = '热情、鼓励的语气';
    else if (primaryEmotion === 'sad') recommendedTone = '温柔、共情的语气';
    else if (primaryEmotion === 'angry' || primaryEmotion === 'frustrated') recommendedTone = '冷静、理解并寻求解决方案的语气';
    else if (primaryEmotion === 'anxious') recommendedTone = '安抚、鼓励的语气';
    else if (primaryEmotion === 'confused') recommendedTone = '清晰、引导性的语气';

    return {
      primaryEmotion,
      intensity: Number(intensity.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      emotionKeywords: matchedKeywords.slice(0, 6),
      sentimentPolarity: Number(polarity.toFixed(2)),
      recommendedTone
    };
  }

  /**
   * 根据用户情感调整响应内容与语气
   */
  adaptToUserEmotion(baseResponse: string, emotionalContext: EmotionalContext): string {
    const { primaryEmotion, intensity, sentimentPolarity } = emotionalContext;

    // 中性或低强度情感，返回原响应（附带轻微修饰）
    if (intensity < 0.3 || primaryEmotion === 'neutral') return baseResponse;

    // 根据情感添加前缀/后缀
    const prefixes: Record<EmotionalContext['primaryEmotion'], string[]> = {
      happy: ['太好了！', '很高兴听到！😊 ', '太棒了，'],
      excited: ['哇！', '真令人兴奋！✨ '],
      sad: ['很抱歉听到您这样说。💙 ', '我理解您的感受，'],
      angry: ['我能理解您的不满，让我们一起解决这个问题。', '非常抱歉让您失望了，'],
      anxious: ['深呼吸～没关系的，我们一步一步来。', '别担心，'],
      frustrated: ['我能感受到您的不容易，', '辛苦了！让我帮您梳理一下：'],
      confused: ['好的，让我为您梳理一下：', '明白，我来解释清楚：'],
      neutral: ['']
    };

    const suffixes: Record<EmotionalContext['primaryEmotion'], string[]> = {
      happy: ['继续保持好心情！', '有任何问题随时找我~'],
      excited: ['期待和您继续交流！', '我们一起加油！💪'],
      sad: ['如果想倾诉，我随时在这儿陪您。', '希望事情会越来越好。💛'],
      angry: ['我们一步一步来，一定能解决的。', '非常感谢您的反馈，我会认真对待。'],
      anxious: ['慢慢来，不用急。', '有我在，不用太担心。'],
      frustrated: ['休息一下也没关系的。', '您已经做得很好了。'],
      confused: ['还有不明白的地方，尽管问！', '需要我再讲哪一部分？'],
      neutral: ['']
    };

    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    let adapted = baseResponse;
    if (sentimentPolarity < -0.2) {
      // 负向情感：先共情，再回答
      adapted = `${pick(prefixes[primaryEmotion])}${baseResponse}\n\n${pick(suffixes[primaryEmotion])}`;
    } else if (sentimentPolarity > 0.2) {
      // 正向情感：先肯定，再回答
      adapted = `${pick(prefixes[primaryEmotion])}${baseResponse}\n\n${pick(suffixes[primaryEmotion])}`;
    } else {
      adapted = `${pick(prefixes[primaryEmotion])}${baseResponse}`;
    }

    return adapted;
  }

  /**
   * 记录并获取情感上下文历史
   */
  trackEmotion(userId: string, emotionalContext: EmotionalContext): EmotionalContext[] {
    const history = this.emotionalContextHistory.get(userId) || [];
    history.push(emotionalContext);
    if (history.length > 30) history.shift();
    this.emotionalContextHistory.set(userId, history);
    return history;
  }

  // ===================================================================
  // === 8. 主动对话管理 (Proactive Dialogue Management) ===============
  // ===================================================================

  /**
   * 根据用户画像与对话历史，生成可能的后续主动建议
   */
  provideProactiveSuggestions(userId: string, currentInput: string): ProactiveSuggestion[] {
    const profile = this.userProfiles.get(userId);
    const session = this.conversationSessions.get(userId);
    const suggestions: ProactiveSuggestion[] = [];

    const currentTopic = this.detectTopic(currentInput) || 'general';
    const inputKeywords = this.extractKeywords(currentInput);
    const emotion = this.detectEmotionFromInput(currentInput);

    // 策略 1：基于当前主题深入
    if (currentTopic !== 'general') {
      const followUps: Record<string, string> = {
        programming: '是否需要我提供代码示例或调试思路？',
        ai: '想深入了解某个具体模型或算法的原理吗？',
        education: '需要我帮您制定一个学习计划或记忆方法吗？',
        health: '要不要我给您一些运动或作息建议？',
        work: '需要我帮您梳理职业规划或简历优化思路吗？',
        finance: '需要我帮您分析理财方案吗？（请记住：我不能提供投资建议）',
        emotion: '想多聊聊吗？或者需要一些调节情绪的小方法？',
        entertainment: '需要具体的推荐吗？比如电影、游戏或音乐。',
        life: '想聊聊这个话题的哪个方面呢？我可以帮您整理思路。',
        tech: '需要我帮您排查设备问题吗？请描述具体症状。'
      };
      suggestions.push({
        topic: `继续深入：${currentTopic}`,
        rationale: `当前对话聚焦在 "${currentTopic}" 主题，可进一步挖掘需求`,
        priority: 0.8,
        userRelevance: 0.85,
        followUpQuestion: followUps[currentTopic] || `想继续聊聊${currentTopic}的更多内容吗？`
      });
    }

    // 策略 2：基于用户画像推荐
    if (profile && profile.interestTopics.length > 0) {
      const interested = profile.interestTopics.filter(t => t !== currentTopic);
      if (interested.length > 0) {
        const topic = interested[Math.floor(Math.random() * interested.length)];
        suggestions.push({
          topic: `拓展到感兴趣领域：${topic}`,
          rationale: `根据用户画像，${topic} 是用户之前提到过的兴趣领域`,
          priority: 0.55,
          userRelevance: 0.75,
          followUpQuestion: `另外，我注意到您似乎对 ${topic} 也感兴趣，想顺便聊聊吗？`
        });
      }
    }

    // 策略 3：情感支持型跟进
    if (emotion.sentimentPolarity < -0.3) {
      suggestions.push({
        topic: '情感支持',
        rationale: `检测到用户具有负面情感倾向（${emotion.primaryEmotion}, 强度 ${emotion.intensity}）`,
        priority: 0.9,
        userRelevance: 0.9,
        followUpQuestion: '您看起来有些心事，想多聊一会儿吗？我在这里听您说。'
      });
    }

    // 策略 4：问题未充分回答检测
    if (session && session.turns.length > 0) {
      const lastTurn = session.turns[session.turns.length - 1];
      if (lastTurn.agentResponse.length < 30 && /[？?什么怎么如何为什么]/.test(lastTurn.userInput)) {
        suggestions.push({
          topic: '完善未充分回答的问题',
          rationale: `上一轮问题响应较短（${lastTurn.agentResponse.length}字），可能需要补充`,
          priority: 0.85,
          userRelevance: 0.8,
          followUpQuestion: '上一个问题我回答得比较简短，需要我详细展开吗？'
        });
      }
    }

    // 策略 5：学习拓展
    if (inputKeywords.some(k => ['学习', 'learn', 'study', '入门'].includes(k))) {
      suggestions.push({
        topic: '学习路径',
        rationale: '用户提到学习，可提供学习路径建议',
        priority: 0.7,
        userRelevance: 0.8,
        followUpQuestion: '需要我帮您制定一个学习计划或入门路线吗？'
      });
    }

    // 按优先级排序并返回前 3 个
    return suggestions
      .sort((a, b) => b.priority * b.userRelevance - a.priority * a.userRelevance)
      .slice(0, 3);
  }

  /**
   * 将主动建议格式化为响应文本
   */
  formatProactiveSuggestionsToText(suggestions: ProactiveSuggestion[]): string {
    if (suggestions.length === 0) return '';
    const top = suggestions.slice(0, 2);
    if (top.length === 1) return `\n\n💡 ${top[0].followUpQuestion}`;
    return `\n\n💡 ${top[0].followUpQuestion}\n或者：${top[1].followUpQuestion}`;
  }

  // ===================================================================
  // === 8.5 RL↔评估闭环：把对话质量分写回 RL 奖励 ======================
  // ===================================================================

  /**
   * 记录对话质量奖励：用 agent-core DialogueEvaluator 的综合分（0-10）作为
   * RLModule 的奖励信号并落库为一条经验，打通"对话 → 评估 → 强化"闭环。
   * 任何失败都不影响主对话流程。
   */
  private recordDialogueReward(userId: string, input: string, response: string, intent: string | undefined, taskSuccess: boolean): void {
    try {
      const quality = this.dialogueEvaluator.evaluateDialogueQuality(userId, input, response, intent);
      const turns = this.conversationSessions.get(userId)?.turns.length || 1;
      const state = {
        userId,
        conversationId: userId,
        currentInput: input.slice(0, 200),
        conversationHistory: [] as string[],
        availableTools: [] as string[],
        timeOfDay: Date.now(),
        conversationTurns: turns,
        inputComplexity: Math.min(1, input.length / 200),
        lastActionType: 'respond'
      };
      const action = {
        type: 'respond' as const,
        responseText: response.slice(0, 200),
        confidence: Math.min(1, quality.overall / 10)
      };
      const nextState = { ...state, conversationTurns: turns + 1 };
      this.rlModule.recordDialogueFeedback({
        state,
        action,
        nextState,
        done: true,
        quality: quality.overall,
        baseMetrics: {
          taskCompleted: taskSuccess,
          actionRelevant: quality.relevance >= 6
        }
      });
    } catch (error) {
      this.loggingSystem.warning('对话质量奖励闭环失败（不影响主流程）', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ===================================================================
  // === 9. 综合增强方法：一键调用所有增强能力 ===========================
  // ===================================================================

  /**
   * 综合处理：对单个输入进行完整的增强管道处理（质量评估、画像更新、流程分析、摘要、多语言、情感、主动建议）
   */
  runEnhancementPipeline(userId: string, input: string, response: string, intent?: string): {
    quality: DialogueQualityScore;
    profile: UserProfile;
    flow: DialogueFlowAnalysis;
    emotion: EmotionalContext;
    context: { recommendedSize: number; complexityScore: number };
    proactive: ProactiveSuggestion[];
    detectedLanguage: 'zh' | 'en' | 'ja';
    summary: string | null;
  } {
    const quality = this.evaluateDialogueQuality(userId, input, response, intent);
    const profile = this.buildAndUpdateUserProfile(userId, input, response);
    const flow = this.analyzeDialogueFlow(userId, input);
    const emotion = this.detectEmotionFromInput(input);
    this.trackEmotion(userId, emotion);
    const ctx = this.smartManageContextWindow(userId, input);
    const proactive = this.provideProactiveSuggestions(userId, input);
    const lang = this.detectLanguageFromText(input);
    // 每 5 轮生成一次摘要以节省开销
    const shouldSummary = (this.conversationSessions.get(userId)?.turns.length || 0) % 5 === 0;
    const summary = shouldSummary ? this.generateDialogueSummary(userId) : null;

    return {
      quality,
      profile,
      flow,
      emotion,
      context: { recommendedSize: ctx.recommendedSize, complexityScore: ctx.complexityScore },
      proactive,
      detectedLanguage: lang,
      summary
    };
  }

  /**
   * 对外暴露：获取完整用户画像与质量报告
   */
  getUserEnhancementReport(userId: string): {
    profile: UserProfile | null;
    avgQuality: DialogueQualityScore | null;
    lastFlow: DialogueFlowAnalysis | null;
    summaryCount: number;
    lastEmotion: EmotionalContext | null;
  } {
    const lastEmotion = (this.emotionalContextHistory.get(userId) || []);
    return {
      profile: this.getUserProfile(userId),
      avgQuality: this.getAverageQualityScore(userId),
      lastFlow: this.getRecentFlowAnalysis(userId),
      summaryCount: (this.dialogueSummaries.get(userId) || []).length,
      lastEmotion: lastEmotion.length > 0 ? lastEmotion[lastEmotion.length - 1] : null
    };
  }

  /**
   * 生成智能追问建议
   */
  private generateFollowUpSuggestion(input: string, response: string, userId: string): string | null {
    const state = this.dialogueState.get(userId);
    if (!state || !state.awaitingClarification) return null;

    // 根据用户输入生成不同的追问
    if (input.length < 10) {
      const suggestions = [
        '你想了解关于什么方面的问题呢？',
        '可以告诉我更多细节吗？',
        '你希望我帮你做什么呢？'
      ];
      return suggestions[Math.floor(Math.random() * suggestions.length)];
    }

    const detectedTopic = this.detectTopic(input);
    if (detectedTopic) {
      return `关于${detectedTopic}，你还有其他问题吗？或者需要更详细的解释？`;
    }

    return null;
  }

  /**
   * 根据用户偏好定制响应
   */
  private customizeResponseForUser(response: string, userId: string): string {
    const prefs = this.userPreferences.get(userId);
    if (!prefs) return response;

    // 根据语言偏好（这里简化处理）
    // 根据响应长度偏好（这里简化处理）
    return response;
  }

  // ========== 结束会话管理方法 ==========

  async processInput(input: string, userId: string, userRole?: string): Promise<AgentResponse> {
    const startTime = Date.now();
    let response: AgentResponse;
    let taskSuccess = false;

    try {
      // === 新增：API网关请求记录 + 分布式锁 + 限流 + 内容审核 + 行为记录 + 日志 ===
      this.apiGateway.handle({ method: 'POST', path: '/api/agent/process', ip: userId });

      const lockToken = await this.distributedLock.acquire(`user:${userId}`, 'mutex', { ttlMs: 30000, waitTimeoutMs: 1000 });

      try {
        // 限流检查
        const rateCheck = this.rateLimiter.check(`user:${userId}`, 'user');
        if (!rateCheck.allowed) {
          this.loggingSystem.warning('用户被限流', { userId, remaining: rateCheck.remaining });
          this.auditSystem.log({
            category: 'security',
            action: 'rate_limit_exceeded',
            userId,
            level: 'warning',
            result: 'blocked',
            details: { description: '用户触发限流' }
          });
          return { content: this.i18n.translate('errors.rate_limit', { locale: 'zh' }) };
        }

        // 内容审核
        const moderationResult = this.contentModeration.moderate(input, 'text', { contentId: `input-${Date.now()}`, userId });
        if (moderationResult.action === 'block') {
          this.loggingSystem.warning('内容审核拒绝', { userId, categories: moderationResult.categories });
          this.auditSystem.log({
            category: 'security',
            action: 'content_blocked',
            userId,
            level: 'critical',
            result: 'blocked',
            details: { description: `输入内容被拦截: ${moderationResult.categories.join(', ')}` }
          });
          return { content: this.i18n.translate('errors.content_blocked', { locale: 'zh' }) };
        }

        // 用户行为记录
        this.userBehaviorAnalysis.recordBehavior(userId, 'interact', {
          target: 'agent',
          metadata: { inputLength: input.length }
        });

        // 日志
        this.loggingSystem.info('处理用户输入', { userId, inputLength: input.length });

        // 开始新的episode
        this.rlModule.startEpisode();

        // === 新增：会话管理 ===
        this.ensureSession(userId);
        this.cleanupExpiredSessions();

        // === 新增：上下文增强输入处理（代词解析、主题检测）
        const enhancedInput = this.enhanceInputWithContext(input, userId);

        const validation = this.perceptionModule.validateInput(input);
        if (!validation.valid) {
          this.rlModule.endEpisode(false);
          return { content: validation.error || 'Invalid input' };
        }

        // 最优先：使用 LLM 服务（如果可用）
        if (this.llmService) {
          try {
            // 构建对话历史
            const session = this.conversationSessions.get(userId);
            const messages: { role: 'user' | 'assistant'; content: string }[] = [];
            
            // 添加最近的对话历史（最多5轮）
            if (session && session.turns.length > 0) {
              const recentTurns = session.turns.slice(-5);
              for (const turn of recentTurns) {
                messages.push({ role: 'user', content: turn.userInput });
                messages.push({ role: 'assistant', content: turn.agentResponse });
              }
            }
            
            // 添加当前用户输入
            messages.push({ role: 'user', content: enhancedInput });
            
            // 调用 LLM
            const llmResponse = await this.llmService.chat(messages, DEFAULT_SYSTEM_PROMPT);
            
            console.log('[Agent] LLM 响应成功');
            response = { content: llmResponse.content, usage: llmResponse.usage };
            taskSuccess = true;
            
            // 触发 LLM 成功事件
            this.triggerSpecialEvent('TASK_COMPLETED', {
              state: { userId, input },
              action: 'llm_call',
              result: llmResponse.content.substring(0, 100)
            });
            
            // 继续其他流程
            const perceptionResult = this.perceptionModule.processText(input);
            const { emotion, language } = perceptionResult;
            
            if (emotion) {
              response.emotion = emotion;
            }
            
            this.memorySystem.addMessage({ role: 'user', content: input, timestamp: Date.now() });
            this.memorySystem.addMessage({ role: 'assistant', content: response.content, timestamp: Date.now() });
            
            // 记录对话轮次
            this.recordTurn(userId, input, response.content, 'llm',
              this.extractEntitiesFromInput(input),
              typeof emotion === 'object' ? (emotion as any)?.type || 'neutral' : 'neutral');
            
            // 检查是否需要追问
            const followUp = this.generateFollowUpSuggestion(input, response.content, userId);
            if (followUp && response.content.length < 200) {
              response.content += '\n\n' + followUp;
            }

            // RL↔评估闭环：对话质量分作为奖励写入 RL，并结束 episode
            //（此前 LLM 路径提前 return，episode 从未闭合，RL 也拿不到任何真实经验）
            this.recordDialogueReward(userId, input, response.content, undefined, taskSuccess);
            this.rlModule.endEpisode(taskSuccess);

            // 返回 LLM 响应
            return response;
          } catch (error) {
            console.error('[Agent] LLM 调用失败，回退到知识库:', error);
            // LLM 失败时回退到知识库
          }
        }
        
        // 回退：直接查知识库
        const faqAnswer = this.tryAnswerFAQ(enhancedInput);
        if (faqAnswer) {
          // 找到知识库答案，直接返回！
          response = { content: faqAnswer };

          // 触发知识库命中成功事件
          this.triggerSpecialEvent('TASK_COMPLETED', {
            state: { userId, input },
            action: 'faq_lookup',
            result: faqAnswer.substring(0, 100)
          });
          taskSuccess = true;

          // 继续其他流程
          const perceptionResult = this.perceptionModule.processText(input);
          const { emotion, language } = perceptionResult;

          if (emotion) {
            response.content = this.nlpModule.generateResponse(response.content, emotion, language).content;
            response.emotion = emotion;
          }

          this.memorySystem.addMessage({ role: 'user', content: input, timestamp: Date.now() });
          this.memorySystem.addMessage({ role: 'assistant', content: response.content, timestamp: Date.now() });

          // === 新增：记录对话轮次 ===
          this.recordTurn(userId, input, response.content, 'faq',
            this.extractEntitiesFromInput(input),
            typeof emotion === 'object' ? (emotion as any)?.type || 'neutral' : 'neutral');

          // === 新增：检查是否需要追问 ===
          const followUp = this.generateFollowUpSuggestion(input, response.content, userId);
          if (followUp && response.content.length < 200) {
            response.content += '\n\n' + followUp;
          }

          // === 新增：完整增强管道（质量评估+用户画像+流程分析+情感自适应+主动建议） ===
          try {
            const faqEmotion = this.detectEmotionFromInput(input);
            this.runEnhancementPipeline(userId, input, response.content, 'faq');
            if (faqEmotion.intensity >= 0.3 && faqEmotion.primaryEmotion !== 'neutral') {
              response.content = this.adaptToUserEmotion(response.content, faqEmotion);
            }
            const faqProactive = this.provideProactiveSuggestions(userId, input);
            if (faqProactive.length > 0 && response.content.length < 400) {
              response.content += this.formatProactiveSuggestionsToText(faqProactive);
            }
          } catch (enhErr) {
            // 增强管道失败不影响核心响应
          }

          // RL↔评估闭环：知识库命中同样沉淀为 RL 经验
          this.recordDialogueReward(userId, input, response.content, 'faq', taskSuccess);

          this.monitoringSystem.recordLatency(Date.now() - startTime);
          this.monitoringSystem.recordSuccess();
          this.rlModule.endEpisode(taskSuccess);
          return response;
        }

        const perceptionResult = this.perceptionModule.processText(input);
        const { intent, entities, emotion, language } = perceptionResult;

        this.memorySystem.addMessage({ role: 'user', content: input, timestamp: Date.now() });

        const relevantMemories = this.memorySystem.retrieveMemories(input);
        const context = relevantMemories.map(m => m.content).join('\n');

        // RAG 是增强能力而非硬依赖：检索失败（如向量依赖缺失、模型加载失败）时
        // 降级为空上下文继续对话，绝不让主流程被增强子系统炸穿
        let ragContext = '';
        try {
          ragContext = await this.ragSystem.getContextForQuery(input);
        } catch (ragError) {
          this.loggingSystem.warning('RAG 上下文获取失败，已降级为无上下文继续对话', {
            error: ragError instanceof Error ? ragError.message : String(ragError)
          });
        }

      switch (intent.name) {
        case 'search':
          response = await this.handleSearch(input, userId);
          break;
        case 'calculate':
          response = await this.handleCalculate(input, userId);
          break;
        case 'summarize':
          response = await this.handleSummarize(input, userId);
          break;
        case 'translate':
          response = await this.handleTranslate(input, userId);
          break;
        case 'execute_code':
          response = await this.handleExecuteCode(input, userId, userRole);
          break;
        case 'task_create':
          response = await this.handleCreateTask(input, userId);
          break;
        case 'help':
          response = this.handleHelp(language);
          break;
        case 'greeting':
          response = this.handleGreeting(language);
          break;
        case 'goodbye':
          response = this.handleGoodbye(language);
          break;
        case 'introduction':
          response = this.handleIntroduction(input);
          break;
        case 'thanks':
          response = this.handleThanks(input);
          break;
        case 'time':
          response = this.handleTimeQuery(input);
          break;
        case 'weather':
          response = this.handleWeatherQuery(input);
          break;
        case 'joke':
          response = this.handleJoke(input);
          break;
        case 'compliment':
          response = this.handleCompliment(input);
          break;
        case 'complain':
          response = this.handleComplaint(input);
          break;
        case 'clarify':
          response = this.handleClarification(input);
          break;
        case 'question':
          response = await this.handleQuestion(input);
          break;
        default:
          response = await this.handleDefault(input, userId, context, ragContext);
      }

      if (emotion) {
        response.content = this.nlpModule.generateResponse(response.content, emotion, language).content;
        response.emotion = emotion;
      }

      // 根据结果触发事件
      if (response.content.includes('错误') || response.content.includes('失败')) {
        this.triggerSpecialEvent('TASK_FAILED', {
          state: { userId, input },
          action: intent.name,
          result: response.content.substring(0, 100)
        });
        taskSuccess = false;
      } else if (response.status === 'completed') {
        this.triggerSpecialEvent('TASK_COMPLETED', {
          state: { userId, input },
          action: intent.name,
          result: 'success'
        });
        taskSuccess = true;
      } else {
        // 普通响应也算成功
        taskSuccess = true;
      }

      // 检查用户情绪
      if (emotion?.type === 'negative') {
        this.triggerSpecialEvent('USER_EXPRESSION_OF_SATISFACTION', {
          state: { userId, input },
          action: intent.name,
          result: 'negative_emotion_detected'
        }, { customValues: { emotion: 'negative' } });
        taskSuccess = false;
      }

      this.memorySystem.addMessage({ role: 'assistant', content: response.content, timestamp: Date.now() });

      // === 新增：记录对话轮次 ===
      this.recordTurn(userId, input, response.content, intent.name,
        entities.map(e => e.name).slice(0, 5),
        typeof emotion === 'object' ? (emotion as any)?.type || 'neutral' : 'neutral');

      // === 新增：智能追问建议 ===
      const followUp = this.generateFollowUpSuggestion(input, response.content, userId);
      if (followUp && response.content.length < 300) {
        response.content += '\n\n' + followUp;
      }

      // === 新增：完整增强管道（质量评估+用户画像+流程分析+情感自适应+主动建议） ===
      try {
        const mainEmotion = this.detectEmotionFromInput(input);
        this.runEnhancementPipeline(userId, input, response.content, intent.name);
        // 情感自适应响应
        if (mainEmotion.intensity >= 0.3 && mainEmotion.primaryEmotion !== 'neutral') {
          response.content = this.adaptToUserEmotion(response.content, mainEmotion);
        }
        // 主动对话管理建议
        const mainProactive = this.provideProactiveSuggestions(userId, input);
        if (mainProactive.length > 0 && response.content.length < 500) {
          response.content += this.formatProactiveSuggestionsToText(mainProactive);
        }
      } catch (enhErr) {
        // 增强管道失败不影响核心响应
      }

      this.monitoringSystem.recordLatency(Date.now() - startTime);
      this.monitoringSystem.recordSuccess();

      // 记录审计日志
      this.auditSystem.log({
        category: 'business',
        action: 'user_interaction',
        userId,
        level: 'info',
        result: 'success',
        details: { inputLength: input.length, responseLength: response.content.length },
        resource: 'conversation',
        resourceId: userId
      });

      // 记录性能指标
      this.recordPerformanceMetrics(response, startTime, input);

      // RL↔评估闭环：主路径对话质量分作为奖励写入 RL
      this.recordDialogueReward(userId, input, response.content, intent?.name, taskSuccess);

      this.rlModule.endEpisode(taskSuccess);
      return response;
      } finally {
        // 释放分布式锁
        this.distributedLock.release(`user:${userId}`, lockToken, 'mutex');
      }
    } catch (error) {
      this.triggerSpecialEvent('TASK_FAILED', {
        state: { userId, input },
        action: 'processInput',
        error: error instanceof Error ? error.message : String(error)
      });

      // === 新增：错误情况下也记录对话轮次 ===
      this.recordTurn(userId, input, '处理出错：' + (error instanceof Error ? error.message : String(error)),
        'error', [], 'negative');

      this.monitoringSystem.recordLatency(Date.now() - startTime);
      this.monitoringSystem.recordError();
      this.rlModule.endEpisode(false);
      
      // 尝试错误恢复
      const recoveryResponse = await this.attemptRecovery(
        error instanceof Error ? error : new Error(String(error)),
        input,
        userId
      );
      
      if (recoveryResponse) {
        return recoveryResponse;
      }
      
      throw error;
    }
  }

  /**
   * 尝试从错误中恢复
   */
  private async attemptRecovery(error: Error, input: string, userId: string): Promise<AgentResponse | null> {
    console.log(`[Agent] [RECOVERY] Attempting recovery for error: ${error.message}`);
    
    try {
      // 1. 分析错误类型
      const errorType = this.classifyError(error);
      console.log(`[Agent] [RECOVERY] Error classified as: ${errorType}`);
      
      // 2. 根据错误类型尝试不同恢复策略
      switch (errorType) {
        case 'validation':
          // 输入验证错误，尝试简化输入
          const simplifiedInput = this.simplifyInput(input);
          if (simplifiedInput && simplifiedInput !== input) {
            console.log(`[Agent] [RECOVERY] Trying simplified input: ${simplifiedInput}`);
            return await this.processInput(simplifiedInput, userId);
          }
          break;
          
        case 'tool_execution':
          // 工具执行错误，尝试使用备用工具或降级处理
          const fallbackResponse = this.handleToolExecutionError(error, input);
          if (fallbackResponse) {
            return fallbackResponse;
          }
          break;
          
        case 'memory':
          // 记忆系统错误，尝试继续处理（跳过记忆操作）
          console.log(`[Agent] [RECOVERY] Memory error, continuing without memory operations`);
          break;
          
        case 'unknown':
        default:
          // 未知错误，尝试通用恢复
          const genericResponse = this.handleGenericError(error, input);
          if (genericResponse) {
            return genericResponse;
          }
          break;
      }
    } catch (recoveryError) {
      console.error(`[Agent] [RECOVERY] Recovery attempt failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
    }
    
    return null;
  }

  /**
   * 对错误进行分类
   */
  private classifyError(error: Error): 'validation' | 'tool_execution' | 'memory' | 'unknown' {
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('invalid') || errorMsg.includes('validation') || errorMsg.includes('invalid input')) {
      return 'validation';
    }
    if (errorMsg.includes('tool') || errorMsg.includes('execute') || errorMsg.includes('timeout') || errorMsg.includes('network')) {
      return 'tool_execution';
    }
    if (errorMsg.includes('memory') || errorMsg.includes('storage') || errorMsg.includes('retrieve')) {
      return 'memory';
    }
    
    return 'unknown';
  }

  /**
   * 简化输入
   */
  private simplifyInput(input: string): string | null {
    // 移除多余空格和标点
    const simplified = input.trim().replace(/[!?.,。，、]+/g, ' ').replace(/\s+/g, ' ').trim();
    return simplified.length > 0 ? simplified : null;
  }

  /**
   * 处理工具执行错误
   */
  private handleToolExecutionError(error: Error, input: string): AgentResponse | null {
    // 返回一个友好的错误消息，让用户知道发生了什么
    return {
      content: `执行时遇到了一些问题：${error.message}\n\n您可以尝试：\n• 简化一下您的请求\n• 稍后再试\n• 联系技术支持`
    };
  }

  /**
   * 处理通用错误
   */
  private handleGenericError(error: Error, input: string): AgentResponse | null {
    return {
      content: `抱歉，处理您的请求时出现了问题。\n\n请您：\n• 稍后重试\n• 尝试用不同的方式表达\n• 如果问题持续存在，请反馈给我们`
    };
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetrics(response: AgentResponse, startTime: number, input: string): void {
    const latency = Date.now() - startTime;
    const responseLength = response.content?.length || 0;
    const hasEmotion = !!response.emotion;
    const isCompleted = response.status === 'completed';
    
    // 记录响应质量指标
    console.log(`[Agent] [METRICS] Response metrics:
      - Latency: ${latency}ms
      - Response length: ${responseLength} chars
      - Has emotion: ${hasEmotion}
      - Status: ${response.status}
      - Input length: ${input.length} chars
    `);
    
    // 更新监控系统的行为指标
    this.monitoringSystem.updateBehaviorMetrics({
      avgResponseTime: latency,
      responseQuality: responseLength > 50 ? 1 : 0.5,
      taskCompletion: isCompleted ? 1 : 0
    });
  }

  private async handleSearch(input: string, userId: string): Promise<AgentResponse> {
    const task = this.decisionEngine.decomposeTask(input, userId);
    const toolCalls = this.decisionEngine.planExecution(task);

    const results = await this.executionEngine.executeBatch(toolCalls, task.id);
    const updatedTask = this.decisionEngine.updatePlan(task, results);

    const searchResults = Array.from(results.values())
      .filter(r => r.success)
      .map(r => r.result);

    const hasFailure = Array.from(results.values()).some(r => !r.success);
    if (hasFailure) {
      this.triggerSpecialEvent('TOOL_EXECUTION_FAILED', {
        state: { userId, input },
        action: 'search',
        error: '部分搜索结果获取失败'
      });
    } else {
      this.triggerSpecialEvent('TOOL_EXECUTION_SUCCESS', {
        state: { userId, input },
        action: 'search'
      }, { customValues: { toolName: 'web_search' } });
    }

    this.monitoringSystem.updateBehaviorMetrics({ toolCalls: (this.monitoringSystem['behaviorMetrics'].toolCalls || 0) + 1 });

    return {
      content: `搜索结果：\n${JSON.stringify(searchResults, null, 2)}`,
      taskId: task.id,
      status: updatedTask.status
    };
  }

  private async handleCalculate(input: string, userId: string): Promise<AgentResponse> {
    const task = this.decisionEngine.decomposeTask(input, userId);
    
    try {
      // 安全数学表达式解析：仅允许 0-9、.、+、-、*、/、(、) 和空白
      const match = input.match(/([\d\.\+\-\*\/\(\)\s]+)/);
      if (match) {
        const expression = match[1].replace(/\s+/g, '');
        // 二次校验：仅允许安全字符
        if (!/^[\d\.\+\-\*\/\(\)]+$/.test(expression)) {
          return { content: '表达式包含不支持的字符' };
        }
        // 安全求值：使用 Function 而非 eval，限制输入为纯数学表达式
        const result = new Function('"use strict"; return (' + expression + ')')();
        if (typeof result !== 'number' || !isFinite(result)) {
          return { content: '计算结果无效' };
        }
        return { content: `${expression} = ${result}` };
      }
      return { content: '无法解析数学表达式' };
    } catch {
      return { content: '计算错误' };
    }
  }

  private async handleSummarize(input: string, userId: string): Promise<AgentResponse> {
    const relevantMemories = this.memorySystem.retrieveMemories(input);
    const contentToSummarize = relevantMemories.map(m => m.content).join('\n');
    
    if (contentToSummarize.length === 0) {
      return { content: '没有找到相关内容可总结' };
    }

    const summary = this.summarizeContent(contentToSummarize);
    return { content: `摘要：\n${summary}` };
  }

  private summarizeContent(content: string): string {
    const sentences = content.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    if (sentences.length <= 3) return content;
    
    return sentences.slice(0, 3).join('. ') + '...';
  }

  private async handleTranslate(input: string, userId: string): Promise<AgentResponse> {
    const match = input.match(/翻译\s*(.+)/);
    if (match) {
      const textToTranslate = match[1].trim();
      const detectedLang = this.nlpModule.detectLanguage(textToTranslate);
      
      let translation: string;
      if (detectedLang === 'zh') {
        translation = `English: ${this.mockTranslate(textToTranslate, 'en')}`;
      } else if (detectedLang === 'ja') {
        translation = `Chinese: ${this.mockTranslate(textToTranslate, 'zh')}`;
      } else {
        translation = `Chinese: ${this.mockTranslate(textToTranslate, 'zh')}`;
      }
      
      return { content: translation };
    }
    return { content: '请提供需要翻译的文本' };
  }

  private mockTranslate(text: string, targetLang: string): string {
    const translations: Record<string, Record<string, string>> = {
      zh: { en: 'Hello', ja: 'こんにちは' },
      en: { zh: '你好', ja: 'こんにちは' },
      ja: { zh: '你好', en: 'Hello' }
    };
    return translations['en']?.[targetLang] || text;
  }

  private async handleExecuteCode(input: string, userId: string, userRole?: string): Promise<AgentResponse> {
    // 代码执行仅限管理员，防止普通用户通过 LLM 回退触发 SSRF/DNS 外带
    if (userRole !== 'admin') {
      return { content: '代码执行功能仅限管理员使用。' };
    }

    const match = input.match(/(python|javascript|js)\s*[:：]?\s*(.+)/i);
    if (match) {
      const language = match[1].toLowerCase();
      const code = match[2].trim();
      
      try {
        const result = await this.executeCode(code, language);
        this.monitoringSystem.updateBehaviorMetrics({ toolCalls: (this.monitoringSystem['behaviorMetrics'].toolCalls || 0) + 1 });
        
        this.triggerSpecialEvent('TOOL_EXECUTION_SUCCESS', {
          state: { userId, input },
          action: 'execute_code'
        }, { customValues: { toolName: language } });
        
        return { content: `执行结果：\n${result}`, status: 'completed' };
      } catch (error) {
        this.triggerSpecialEvent('TOOL_EXECUTION_FAILED', {
          state: { userId, input },
          action: 'execute_code',
          error: error instanceof Error ? error.message : String(error)
        }, { customValues: { toolName: language } });
        
        return { content: `执行错误：${error instanceof Error ? error.message : String(error)}` };
      }
    }
    return { content: '请提供代码内容' };
  }

  private async executeCode(code: string, language: string): Promise<string> {
    const result = await codeExecutorTool.execute('code_executor', {
      code,
      language: language === 'python' ? 'python' : 'javascript',
      timeout: 5000
    });

    if (!result.success) {
      throw new Error(result.error || 'Code execution failed');
    }

    // codeExecutorTool.execute 返回 result: { result: 实际执行值, language, code, ... }
    const payload = result.result as { result?: unknown } | null | undefined;
    const actual = payload && typeof payload === 'object' && 'result' in payload
      ? payload.result
      : payload;
    return String(actual);
  }

  private async handleCreateTask(input: string, userId: string): Promise<AgentResponse> {
    const task = this.decisionEngine.decomposeTask(input, userId);
    return {
      content: `任务已创建！\n任务ID: ${task.id}\n状态: ${task.status}\n优先级: ${task.priority}`,
      taskId: task.id,
      status: task.status
    };
  }

  private handleHelp(language: string): AgentResponse {
    const responses: Record<string, string> = {
      zh: '我可以帮助您完成以下任务：\n- 搜索信息\n- 计算数学问题\n- 总结内容\n- 翻译文本\n- 执行代码\n- 创建任务\n请告诉我您需要什么帮助！',
      en: 'I can help you with:\n- Search information\n- Calculate math problems\n- Summarize content\n- Translate text\n- Execute code\n- Create tasks\nHow can I assist you?',
      ja: '以下のことができます：\n- 情報検索\n- 数学の問題を計算\n- 内容の要約\n- テキスト翻訳\n- コード実行\n- タスク作成\n何かお手伝いできますか？'
    };
    return { content: responses[language] || responses.en };
  }

  private handleGreeting(language: string): AgentResponse {
    const responses: Record<string, string> = {
      zh: '您好！很高兴为您服务！',
      en: 'Hello! How can I help you today?',
      ja: 'こんにちは！何かお手伝いできますか？'
    };
    return { content: responses[language] || responses.en };
  }

  private handleGoodbye(language: string): AgentResponse {
    const responses: Record<string, string> = {
      zh: '再见！祝您有美好的一天！',
      en: 'Goodbye! Have a nice day!',
      ja: 'さようなら！良い一日を！'
    };
    return { content: responses[language] || responses.en };
  }

  private async handleDefault(input: string, userId: string, context: string, ragContext: string): Promise<AgentResponse> {
    // 优先使用 LLM 服务
    if (this.llmService) {
      try {
        // 构建对话历史
        const session = this.conversationSessions.get(userId);
        const messages: { role: 'user' | 'assistant'; content: string }[] = [];
        
        // 添加最近的对话历史（最多5轮）
        if (session && session.turns.length > 0) {
          const recentTurns = session.turns.slice(-5);
          for (const turn of recentTurns) {
            messages.push({ role: 'user', content: turn.userInput });
            messages.push({ role: 'assistant', content: turn.agentResponse });
          }
        }
        
        // 添加当前用户输入
        messages.push({ role: 'user', content: input });
        
        // 构建系统提示，包含上下文信息
        const systemPrompt = DEFAULT_SYSTEM_PROMPT + 
          (context ? `\n\n对话上下文：\n${context}` : '') +
          (ragContext ? `\n\n相关知识：\n${ragContext}` : '');
        
        // 调用 LLM
        const response = await this.llmService.chat(messages, systemPrompt);
        
        console.log('[Agent] LLM 响应成功');
        return { content: response.content };
      } catch (error) {
        console.error('[Agent] LLM 调用失败，回退到知识库:', error);
        // LLM 失败时回退到知识库
      }
    }
    
    // 回退：查询知识库
    const faqAnswer = this.tryAnswerFAQ(input);
    if (faqAnswer) {
      return { content: faqAnswer };
    }
    
    // 检测常见对话场景并给出相应回复
    const lowerInput = input.toLowerCase().trim();
    
    // 常见问题和对话场景
    const responsePatterns = [
      // 询问系统
      { pattern: /(你是谁|你是什么|你能做什么|你有什么功能)/i, handler: this.handleIntroduction.bind(this) },
      // 感谢
      { pattern: /(谢谢|感谢|thanks|thank you|thx)/i, handler: this.handleThanks.bind(this) },
      // 时间相关
      { pattern: /(几点|时间|现在|什么时候|time|date)/i, handler: this.handleTimeQuery.bind(this) },
      // 天气
      { pattern: /(天气|下雨|晴天|temperature|weather)/i, handler: this.handleWeatherQuery.bind(this) },
      // 笑话/娱乐
      { pattern: /(讲个笑话|笑话|joke|funny)/i, handler: this.handleJoke.bind(this) },
      // 赞美
      { pattern: /(你好棒|厉害|优秀|great|awesome|amazing)/i, handler: this.handleCompliment.bind(this) },
      // 道歉
      { pattern: /(抱歉|对不起|sorry)/i, handler: this.handleApology.bind(this) },
      // 确认
      { pattern: /(是的|对的|没错|是|对|yes|yeah|right)/i, handler: this.handleAgreement.bind(this) },
      // 否定
      { pattern: /(不|不是|不对|no|nope|wrong)/i, handler: this.handleDisagreement.bind(this) },
      // 问候/近况
      { pattern: /(怎么样|好吗|好嘛|how are you|how's it going|what's up)/i, handler: this.handleHowAreYou.bind(this) },
    ];
    
    for (const { pattern, handler } of responsePatterns) {
      if (pattern.test(input)) {
        return handler(input);
      }
    }
    
    // 默认智能回复
    return this.generateSmartReply(input, context, ragContext);
  }
  
  private handleIntroduction(input: string): AgentResponse {
    return { 
      content: '你好！我是AI智能助手。我可以帮你：\n1. 搜索信息\n2. 计算数学题\n3. 翻译文本\n4. 执行代码\n5. 总结内容\n\n输入"帮助"查看更多详情！' 
    };
  }
  
  private handleThanks(input: string): AgentResponse {
    const responses = [
      '不客气！能帮到你我很开心。',
      '不用谢，有问题随时找我！',
      '这是我应该做的，还需要什么帮助吗？',
      '很高兴能帮上忙！😊'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }
  
  private handleTimeQuery(input: string): AgentResponse {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
    return { content: `现在是 ${timeStr}` };
  }
  
  private handleWeatherQuery(input: string): AgentResponse {
    return { content: '抱歉，我暂时无法获取实时天气信息。你可以查看天气网站或使用天气APP获取最新天气情况。' };
  }
  
  private handleJoke(input: string): AgentResponse {
    const jokes = [
      '程序员最讨厌的三件事：数数、命名变量和歧义。',
      '为什么程序员喜欢黑暗？因为light attracts bugs！',
      '有10种人：懂二进制的和不懂的。',
      '我跟我的床是真爱，但闹钟总是想拆散我们。'
    ];
    return { content: jokes[Math.floor(Math.random() * jokes.length)] };
  }
  
  private handleCompliment(input: string): AgentResponse {
    const responses = [
      '谢谢你的夸奖！我会继续努力的！',
      '你太客气了，能帮到你就好！',
      '很高兴你满意，这让我很开心！😊',
      '谢谢！你也很棒！'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }
  
  private handleApology(input: string): AgentResponse {
    const responses = [
      '没关系的！不用放在心上。',
      '别担心，这不是你的错。',
      '没事！我们继续吧。'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }
  
  private handleAgreement(input: string): AgentResponse {
    const responses = [
      '好的！',
      '明白！',
      '没问题！',
      '收到！'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }
  
  private handleDisagreement(input: string): AgentResponse {
    const responses = [
      '好的，我理解了。',
      '没问题。',
      '那让我们换个方式吧。'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }
  
  private handleHowAreYou(input: string): AgentResponse {
    const responses = [
      '我很好，谢谢！你呢？',
      '我状态不错，有什么我能帮你的吗？',
      '一切正常！今天很高兴为你服务。'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }
  
  private generateSmartReply(input: string, context: string, ragContext: string): AgentResponse {
    // 检查是否有常见问题可以回答
    const faqAnswer = this.tryAnswerFAQ(input);
    if (faqAnswer) {
      return { content: faqAnswer };
    }

    // 根据输入长度和类型给出不同回复
    if (input.length < 3) {
      const shortReplies = [
        '嗯，我在听呢。有什么我可以帮你的吗？',
        '明白了，请继续说。或者告诉我你需要什么帮助？',
        '好的，还有什么吗？随时可以问我问题哦！'
      ];
      return { content: shortReplies[Math.floor(Math.random() * shortReplies.length)] };
    }

    // 问题式输入 - 更智能的回答
    if (input.includes('?') || input.includes('？') || 
        input.match(/(什么|为什么|怎么|如何|哪里|哪个|谁|多少|请问)/)) {
      return this.handleQuestion(input);
    }

    // 陈述式输入 - 给予更智能的反馈
    return this.handleStatement(input);
  }

  // FAQ 知识库
  private tryAnswerFAQ(input: string): string | null {
    this.faqStats.totalQueries++;
    const lowerInput = input.toLowerCase().trim();
    
    // 优先级1: 检查缓存
    const cacheKey = this.generateCacheKey(lowerInput);
    const cached = this.faqCache.get(cacheKey);
    if (cached) {
      cached.hitCount++;
      cached.lastHit = new Date();
      this.faqStats.cacheHits++;
      return cached.answer;
    }
    
    // 优先级2: 精确匹配检查（完全匹配）
    const exactMatchResult = this.checkExactMatch(lowerInput, input);
    if (exactMatchResult) {
      this.updateCache(cacheKey, exactMatchResult, ['exact']);
      return exactMatchResult;
    }
    
    // 优先级3: 语义相似匹配
    const similarMatchResult = this.checkSimilarMatch(lowerInput, input);
    if (similarMatchResult) {
      this.updateCache(cacheKey, similarMatchResult, ['similar']);
      return similarMatchResult;
    }
    
    // 优先级4: 关键词组合匹配
    const keywordMatchResult = this.checkKeywordMatch(lowerInput, input);
    if (keywordMatchResult) {
      this.updateCache(cacheKey, keywordMatchResult, ['keyword']);
      return keywordMatchResult;
    }
    
    // 优先级5: 模糊/部分匹配
    const fuzzyMatchResult = this.checkFuzzyMatch(lowerInput, input);
    if (fuzzyMatchResult) {
      this.updateCache(cacheKey, fuzzyMatchResult, ['fuzzy']);
      return fuzzyMatchResult;
    }
    
    return null;
  }
  
  private generateCacheKey(input: string): string {
    return input.slice(0, 50);
  }
  
  private updateCache(key: string, answer: string, matchPatterns: string[]): void {
    this.faqCache.set(key, {
      answer,
      hitCount: 1,
      lastHit: new Date(),
      matchPatterns
    });
    
    if (this.faqCache.size > 1000) {
      const oldestKey = this.faqCache.keys().next().value;
      if (oldestKey) {
        this.faqCache.delete(oldestKey);
      }
    }
  }
  
  private checkExactMatch(lowerInput: string, originalInput: string): string | null {
    this.faqStats.matchAttempts++;
    const exactPatterns: Array<{ pattern: RegExp; answer: string }> = [
      { pattern: /^你是(什么|谁)$/, answer: '我是 AI Agent 智能助手！我可以帮你搜索信息、计算数学、翻译、执行代码等等。试试输入"帮助"查看完整功能！' },
      { pattern: /^你叫什么$/, answer: '我是 AI Agent 智能助手！我可以帮你搜索信息、计算数学、翻译、执行代码等等。试试输入"帮助"查看完整功能！' },
      { pattern: /^你的名字$/, answer: '我是 AI Agent 智能助手！我可以帮你搜索信息、计算数学、翻译、执行代码等等。试试输入"帮助"查看完整功能！' },
    ];
    
    for (const { pattern, answer } of exactPatterns) {
      if (pattern.test(lowerInput)) {
        return answer;
      }
    }
    return null;
  }
  
  private checkSimilarMatch(lowerInput: string, originalInput: string): string | null {
    this.faqStats.matchAttempts++;
    const similarPatterns: Array<{ pattern: RegExp; answer: string }> = [
      { pattern: /^(你好|你好吗|你好呀|您好)$/, answer: '我很好！谢谢你关心 😊 有什么我可以帮你的吗？' },
      { pattern: /^谢谢$/, answer: '不客气！能帮到你我很开心。' },
      { pattern: /^你是谁$/, answer: '我是 AI Agent 智能助手！我可以帮你搜索信息、计算数学、翻译、执行代码等等。试试输入"帮助"查看完整功能！' },
    ];
    
    for (const { pattern, answer } of similarPatterns) {
      if (pattern.test(lowerInput)) {
        return answer;
      }
    }
    return null;
  }
  
  private checkKeywordMatch(lowerInput: string, originalInput: string): string | null {
    this.faqStats.matchAttempts++;
    const keywordPatterns: Array<{ keywords: string[]; answer: string }> = [
      { keywords: ['你', '什么'], answer: '我是 AI Agent 智能助手！我可以帮你搜索信息、计算数学、翻译、执行代码等等。试试输入"帮助"查看完整功能！' },
      { keywords: ['功能'], answer: '我能帮你做很多事！🎯\n• 🔍 搜索信息\n• 🔢 数学计算\n• 🌐 翻译\n• 💻 执行代码\n• 📝 总结内容\n• ⏰ 查询时间\n• 😄 讲笑话\n输入"帮助"了解更多！' },
      // AI Agent 核心知识
      { keywords: ['ai', 'agent', '定义'], answer: 'AI Agent（智能体）是具备自主感知、规划、执行、复盘闭环能力的人工智能系统，可像虚拟员工一样独立完成整套复杂任务，无需人类逐步骤下达指令。本质是大模型从"对话工具"向"智能执行者"的进化，核心突破是拥有自主决策与行动能力。' },
      { keywords: ['ai', 'agent', '区别', '普通'], answer: 'AI Agent与普通AI工具的核心区别：\n• 工作模式：普通AI是被动应答，Agent是主动推进\n• 能力边界：普通AI是单点能力，Agent可多工具联动\n• 思考逻辑：普通AI仅依赖当前上下文，Agent具备目标拆解与纠错能力\n• 交互方式：普通AI需要精细指令，Agent只需最终目标' },
      { keywords: ['ai', 'agent', '训练'], answer: 'AI Agent训练流程：\n1. 冷启动：有监督微调（SFT）- 掌握基础任务逻辑\n2. 能力增强：工具调用与规划训练（Function Calling + ReAct）\n3. 核心进化：强化学习（RL）- 从试错中习得最优策略\n4. 对齐安全：RLHF与红队测试\n5. 持续迭代：记录成功失败轨迹回流训练' },
      { keywords: ['ai', 'agent', '评估', '性能'], answer: 'AI Agent七大核心评估维度：\n• 任务表现（完成率、准确率、耗时）\n• 规划推理能力（目标拆解、思维链、自省纠错）\n• 工具调用能力（命中率、参数规范、多工具串联）\n• 记忆能力（上下文留存、长期记忆召回）\n• 工程性能（时延、算力开销、并发承载）\n• 体验对齐（指令遵循、交互自然度、幻觉率）\n• 安全合规（内容安全、越权风险、隐私保护）' },
      { keywords: ['ai', 'agent', '提升', '优化'], answer: 'AI Agent性能提升优先级：\n1. 架构流程优化（提升30%-70%）- 结构化状态机、层次化任务分解\n2. 提示词推理优化（提升20%-50%）- 结构化ReAct、少样本示例\n3. 工具调用优化（提升25%-45%）- 标准化工具描述、动态加载\n4. 记忆系统优化（提升20%-40%）- 分层记忆架构、记忆摘要\n5. 训练工程优化（最后考虑）- LoRA微调、奖励函数优化' },
      { keywords: ['ai', 'agent', '评测', '数据集'], answer: '主流AI Agent评测数据集：\n• GAIA：行业通用标杆，466道真实问题\n• AgentBench：国内规模化基准，8大类任务2000+用例\n• ToolBench：工具调用专项，1.6万+API样本\n• Mind2Web：网页自动化，2350条真实任务\n• SWE-bench：代码Agent黄金标准，500条GitHub Issue\n• MSAgent-Bench：中文环境最优，近60万条中文API' },
    ];
    
    for (const { keywords, answer } of keywordPatterns) {
      const matchCount = keywords.filter(kw => lowerInput.includes(kw)).length;
      if (matchCount >= keywords.length * 0.7) {
        return answer;
      }
    }
    return null;
  }
  
  private checkFuzzyMatch(lowerInput: string, originalInput: string): string | null {
    this.faqStats.matchAttempts++;
    
    // ✅ 修复：心理/情绪/压力问题 - 最优先匹配！这些问题比"怎么办"更具体
    if (/(无聊|没事做|无聊了|好无聊|真无聊)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '😊 无聊时可以试试：\n• 📚 读一本好书\n• 🎵 听音乐或学习新歌\n• 🏃 出去运动一下\n• 🎨 学习新技能\n• 📝 写日记或随笔\n• 🧹 整理房间\n• 🧑‍🤝‍🧑 联系好久没见的朋友\n• 🌳 去公园或户外走走\n\n无聊也是休息的一种方式，偶尔放松也不错！';
    }
    
    if (/(失眠|睡不着|睡不着怎么办|失眠了|睡不好|睡眠不好)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '😴 失眠建议：\n• 睡前不要看手机屏幕\n• 保持卧室安静舒适\n• 放松心态，不要焦虑\n• 可以听轻音乐或白噪音\n• 喝点热牛奶\n• 如果长期失眠，建议看医生\n\n不要因为睡不着而焦虑，越焦虑越睡不着！';
    }
    
    if (/(压力|压力大|压力太大|有压力)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '💙 缓解压力建议：\n• 运动运动！让身体帮你释放压力\n• 与朋友家人聊聊天\n• 做点自己喜欢的事\n• 保证充足睡眠\n• 不要同时想太多事\n• 深呼吸、冥想\n• 必要时找心理咨询\n\n有压力是正常的，学会释放压力！';
    }
    
    if (/(焦虑|紧张|紧张怎么办|焦虑怎么办|很紧张|很焦虑|焦虑症)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '💙 缓解焦虑建议：\n• 深呼吸（4秒吸，4秒呼）\n• 转移注意力\n• 不要想太多未来的事\n• 专注当下可以做的小事\n• 运动释放焦虑\n• 倾诉给信任的人\n• 如果严重，找专业心理咨询\n\n焦虑是身体提醒你需要休息了！';
    }
    
    if (/(迷茫|不知道该怎么办|不知道怎么办|没方向|失去方向|没有目标|找不到方向)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '🧭 迷茫是正常的成长阶段！建议：\n• 先冷静下来，不要焦虑\n• 思考自己真正想要什么\n• 可以从小目标开始\n• 多尝试不同的事情\n• 向你信任的人请教\n• 读书学习，扩大视野\n\n每个人都会有迷茫期，这是成长的契机。一步一步来，不要着急！';
    }
    
    if (/(坚持不下去|不想坚持|没有动力|没动力|缺乏动力|没有干劲)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '💪 坚持的秘诀：\n• 把大目标拆成小目标\n• 给自己设定奖励\n• 找到志同道合的伙伴\n• 记住为什么开始\n• 允许自己偶尔休息\n• 建立习惯（21天养成一个习惯）\n• 进步是曲线的，不是每天都能提高\n\n坚持很难，但坚持下来一定会有收获！';
    }
    
    if (/(心情不好|情绪低落|不开心|难过|伤心|情绪不好|郁闷)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '💛 心情不好是正常的！试试这些：\n• 🎵 听喜欢的音乐\n• 🚶 出去走走\n• 📞 找朋友倾诉\n• 😢 允许自己难过一下\n• 📝 写日记\n• 🧹 做点体力劳动或运动\n\n情绪就像天气，有阴晴变化是正常的。过一会就会好起来！';
    }
    
    if (/(害怕|恐惧|担心|担忧|很担心|害怕了|好害怕)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '💜 面对恐惧建议：\n• 深呼吸几次\n• 分析恐惧的来源\n• 把恐惧具体化（写下来）\n• 从小事开始面对\n• 找信任的人倾诉\n• 如果影响生活，找专业帮助\n\n害怕是正常的情绪，勇敢不是不害怕，而是害怕还能前行！';
    }
    
    // ✅ 高优先级：学习方法相关（比通用"学习"更具体）
    if (/(学习方法|学习技巧|怎么学习|如何学习|学习的方法|高效学习|怎么学|如何学).*$/.test(lowerInput)) {
      return '📚 高效学习方法：\n• 1️⃣ 主动学习：边学边思考，不只是记忆\n• 2️⃣ 做笔记：用自己的语言总结\n• 3️⃣ 间隔重复：隔一段时间复习\n• 4️⃣ 实践应用：学了就用\n• 5️⃣ 费曼技巧：用简单语言教别人\n• 6️⃣ 保持好奇：多问为什么\n• 7️⃣ 劳逸结合：大脑也需要休息！';
    }
    
    if (/(记忆力|记忆力差|怎么提高记忆力|如何增强记忆|提高记忆力|记忆不好)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '🧠 提高记忆力建议：\n• 🔁 重复记忆\n• 🖼️ 联想记忆（把内容和图像联系）\n• 😴 充足睡眠（睡眠帮助记忆整理）\n• 📋 分类记忆\n• 🏃 运动后学习效果更好\n• 🍱 饮食健康营养\n• 🎯 专注学习，减少干扰\n\n记忆是可以训练的，越用越好！';
    }
    
    if (/(注意力不集中|注意力|分心|不专注|难以集中|集中不了注意力|走神|容易分心)(怎么办|呢|吗)?/.test(lowerInput)) {
      return '🎯 提高注意力建议：\n• 📱 远离手机和社交媒体\n• ⏰ 番茄工作法：25分钟专注+5分钟休息\n• 🧘 冥想练习\n• 🏃 规律运动\n• 😴 充足睡眠\n• 🗒️ 一次只做一件事\n• 📖 先从简单任务开始\n\n注意力像肌肉一样，是可以训练的！';
    }
    
    // 关于 AI 自身
    if (/你是(什么|谁)|你叫什么|你的名字/.test(lowerInput)) {
      return '我是 AI Agent 智能助手！我可以帮你搜索信息、计算数学、翻译、执行代码等等。试试输入"帮助"查看完整功能！';
    }
    if (/你(能|会|可以)做什么|有什么功能/.test(lowerInput)) {
      return '我能帮你做很多事！🎯\n• 🔍 搜索信息\n• 🔢 数学计算\n• 🌐 翻译\n• 💻 执行代码\n• 📝 总结内容\n• ⏰ 查询时间\n• 😄 讲笑话\n输入"帮助"了解更多！';
    }
    
    // 关于系统使用
    if (/怎么(用|使用)|如何(使用|操作)/.test(lowerInput)) {
      return '很简单！直接用自然语言和我交流就可以了。比如：\n• "计算 2+3"\n• "搜索 人工智能"\n• "翻译 你好到英语"\n• "讲个笑话"';
    }
    
    // 编程定义类问题 - 优先匹配（在"执行代码"提示之前）
    // 同时匹配两种格式："什么是Python" 和 "Python是什么"
    if (/(什么是|什么叫|是什么|介绍一下)(python|python语言|python编程|javascript|js|java|c\+\+|编程|代码|程序|算法|变量|函数|面向对象|数据结构|数据库|sql|html|css)/.test(lowerInput) ||
        /(python|javascript|js|java|c\+\+|编程|代码|程序|算法|变量|函数|面向对象|数据结构|数据库|sql|html|css)(是什么|什么是|什么叫|介绍一下)/.test(lowerInput)) {
      if (/python|python语言|python编程/.test(lowerInput)) return '🐍 Python 是一门简单易学但功能强大的编程语言！\n\n✅ 特点：\n• 语法简单，像写英语\n• 有丰富的第三方库\n• 跨平台（Windows/Mac/Linux）\n\n💡 用途：\n• 🤖 人工智能/机器学习\n• 📊 数据分析\n• 🌐 网站开发\n• 🛠️ 自动化脚本\n• 🎮 游戏开发\n\n初学者的最佳入门语言！';
      if (/javascript|^js\b/.test(lowerInput)) return '⚛️ JavaScript 是网页的编程语言！\n\n✅ 特点：\n• 浏览器原生支持\n• 可以做前端和后端（Node.js）\n• 生态系统非常丰富\n\n💡 用途：\n• 🌐 网页交互效果\n• 📱 移动应用\n• 💻 后端服务（Node.js）\n• 🎮 游戏\n• 🤖 AI应用\n\n想做网页开发必须学的语言！';
      if (/java/.test(lowerInput)) return '☕ Java 是一门成熟稳定的企业级编程语言！\n\n✅ 特点：\n• 跨平台（JVM）\n• 强类型，安全稳定\n• 性能优秀\n\n💡 用途：\n• 🏢 企业应用\n• 📱 Android 应用\n• 🛠️ 大型系统\n\n适合想做大型项目的开发者！';
      if (/c\+\+|cpp/.test(lowerInput)) return '⚡ C++ 是一门高性能系统级编程语言！\n\n✅ 特点：\n• 性能极高\n• 直接操作内存\n• 学习曲线较陡\n\n💡 用途：\n• 🎮 游戏引擎\n• 🖥️ 操作系统\n• 📊 高性能计算\n• 🤖 嵌入式系统\n\n适合追求极致性能的开发者！';
      if (/编程|代码|程序/.test(lowerInput)) return '💻 编程是告诉电脑做什么的艺术！\n\n编程就是写代码，让计算机完成特定任务。\n\n📚 学习编程建议：\n• 🐍 从 Python 开始（最简单）\n• 🎯 做小项目练习\n• 📖 多读优秀代码\n• 💪 持续练习和学习\n• 🤝 加入编程社区\n\n编程是21世纪的必备技能！';
      if (/算法/.test(lowerInput)) return '🔢 算法是解决问题的步骤和方法！\n\n就像菜谱告诉你怎么做菜一样，算法告诉电脑怎么解决问题。\n\n📚 常见算法：\n• 🔄 排序算法\n• 🔍 搜索算法\n• 🧮 动态规划\n• 🌳 图算法\n• 🧠 机器学习算法\n\n算法是编程的灵魂，面试必问！';
      if (/变量/.test(lowerInput)) return '📦 变量是存储数据的容器！\n\n就像给盒子贴标签一样，你可以在变量里存数字、文字、列表等。\n\n💡 例子（Python）：\n```\nname = "小明"    # 文字\nage = 18         # 数字\nscores = [90, 85, 95]  # 列表\n```\n\n学习编程首先要理解变量！';
      if (/函数|方法/.test(lowerInput)) return '⚙️ 函数是可重用的代码块！\n\n把经常用的代码打包起来，需要的时候直接调用。\n\n💡 例子（Python）：\n```\ndef say_hello(name):\n    return "你好，" + name\n```\n\n函数让代码更简洁、更易维护！';
      if (/面向对象|oop|类|对象/.test(lowerInput)) return '🎨 面向对象是一种编程思想！\n\n把代码组织成"对象"，就像现实世界中的事物一样。\n\n📚 核心概念：\n• 📦 类(Class) - 模板/蓝图\n• 🎯 对象(Object) - 具体实例\n• 🔒 封装 - 隐藏内部细节\n• 🧬 继承 - 复用代码\n• 🎭 多态 - 多种形态\n\n大型项目常用这种方式组织代码！';
      if (/数据结构/.test(lowerInput)) return '🏗️ 数据结构是组织数据的方式！\n\n不同的数据结构适合不同的场景：\n\n📚 常见数据结构：\n• 📋 数组(Array) - 顺序存储\n• 🔗 链表(LinkedList) - 灵活连接\n• 📚 栈(Stack) - 后进先出\n• 🎯 队列(Queue) - 先进先出\n• 🌳 树(Tree) - 层级结构\n• 🔍 哈希表(Hash) - 快速查找\n\n数据结构 + 算法 = 高效程序！';
      if (/数据库|sql|mysql|mongodb/.test(lowerInput)) return '💾 数据库是存储数据的仓库！\n\n📚 常见数据库：\n• 🐬 MySQL - 关系型数据库\n• 🐘 PostgreSQL - 功能强大\n• 🟢 MongoDB - 文档型NoSQL\n• 🔴 Redis - 内存缓存\n\n💡 SQL是查询数据库的语言，比如：\n```\nSELECT * FROM users WHERE age > 18;\n```\n\n后端开发必须掌握数据库！';
      if (/html|css/.test(lowerInput)) return '🎨 HTML + CSS 是网页的基础！\n\n• 📄 HTML - 网页的内容和结构（骨架）\n• 🎨 CSS - 网页的样式和外观（皮肤）\n• ⚡ JavaScript - 网页的交互和动态（肌肉）\n\n💡 简单例子：\n```html\n<h1 style="color: blue;">你好世界</h1>\n```\n\n做网站开发从这三个开始！';
      return '💻 编程就是用代码告诉电脑做什么。从 Python 或 JavaScript 开始学习是个不错的选择！';
    }
    
    // 学习编程相关
    if (/(怎么|如何|怎样)(学习|学|开始|入门)(编程|代码|python|java|c\+\+|js|javascript|开发)/.test(lowerInput)) {
      return '🚀 学习编程建议：\n\n1️⃣ 选择一门语言开始\n   • 🐍 Python - 初学者首选\n   • ⚛️ JavaScript - 想做网页选这个\n\n2️⃣ 学习基础概念\n   • 变量、函数、循环、条件\n   • 数据类型、操作符\n\n3️⃣ 动手实践\n   • 每天写代码，哪怕只有10行\n   • 做小项目（计算器、待办列表）\n\n4️⃣ 遇到问题怎么办？\n   • 🔍 搜索错误信息\n   • 📖 看教程和文档\n   • 🤝 加入编程社区\n\n5️⃣ 持续学习和进步\n   • 读优秀代码\n   • 学习数据结构和算法\n   • 尝试新的技术\n\n💪 记住：编程是一门手艺，多练才能熟练！\n\n现在就开始吧，你会发现编程很有趣的！';
    }
    
    // 编程相关 - 只有在不匹配定义类问题时才提示执行代码
    if (/python|javascript|^js\b|编程|代码/.test(lowerInput) && !/(执行|运行|什么是|是什么|介绍|学|学习|入门|开始|怎么|如何|什么叫)/.test(lowerInput)) {
      return '我可以帮你执行 Python 或 JavaScript 代码！只要说"执行 python: 你的代码"就可以了。注意：这是模拟执行，用于演示。';
    }
    if (/(什么|怎么)是(ai|人工智能)/.test(lowerInput)) {
      return '人工智能（AI）是让计算机模拟人类智能的技术。我就是一个 AI Agent，可以理解你的意图并帮助你完成各种任务！';
    }
    
    // 日常常识
    if (/(你好吗|怎么样|还好吗)/.test(lowerInput)) {
      return '我很好！谢谢你关心 😊 有什么我可以帮你的吗？';
    }
    
    // 学习/知识
    if (/(学习|学)什么/.test(lowerInput)) {
      return '学习是个好问题！你可以：\n• 学习编程 - Python、JavaScript 都很有趣\n• 了解 AI - 看看人工智能是怎么工作的\n• 学习数据分析 - 很实用的技能\n你对哪个感兴趣？';
    }
    
    // 鼓励/安慰
    if (/(好累|累了|辛苦|难过|不开心)/.test(lowerInput)) {
      return '听到你这样说我很关心。记得要休息一下哦！💪 有时候放松一下是很重要的。需要我帮你转移注意力吗？讲个笑话怎么样？';
    }
    
    // 简单计算（直接回答）
    const addMatch = lowerInput.match(/(\d+)\s*\+\s*(\d+)/);
    if (addMatch) {
      return `${addMatch[1]} + ${addMatch[2]} = ${parseInt(addMatch[1]) + parseInt(addMatch[2])}`;
    }
    const minusMatch = lowerInput.match(/(\d+)\s*\-\s*(\d+)/);
    if (minusMatch) {
      return `${minusMatch[1]} - ${minusMatch[2]} = ${parseInt(minusMatch[1]) - parseInt(minusMatch[2])}`;
    }
    const multiplyMatch = lowerInput.match(/(\d+)\s*\*\s*(\d+)/);
    if (multiplyMatch) {
      return `${multiplyMatch[1]} × ${multiplyMatch[2]} = ${parseInt(multiplyMatch[1]) * parseInt(multiplyMatch[2])}`;
    }
    
    // 更多常识问题
    if (/一加一|1\+1/.test(lowerInput)) {
      return '1 + 1 = 2！简单的数学难不倒我！😉';
    }
    if (/(世界上|地球)最大的动物/.test(lowerInput)) {
      return '地球上最大的动物是蓝鲸！它可以长到 30 米长，180 吨重！';
    }
    if (/(世界上|中国)最长的河/.test(lowerInput)) {
      return '世界上最长的河是尼罗河（约6,650公里）。中国最长的河是长江（约6,300公里）！';
    }
    
    // 更多新增问题
    if (/(什么|什么是)程序员/.test(lowerInput)) {
      return '程序员是编写计算机程序的人！他们用代码创造软件、网站、APP等。Python、JavaScript、Java 都是常用的编程语言！';
    }
    if (/(什么|怎么)是(算法|algorithm)/.test(lowerInput)) {
      return '算法就是解决问题的步骤和方法！比如你要排序，算法就告诉你怎么一步步把数字排好。它是编程的核心！';
    }
    if (/(推荐|有什么)好看的(书|电影)|推荐一下/.test(lowerInput)) {
      return '这是个好问题！虽然我没有具体推荐，但：\n• 学习编程可以看《Python编程从入门到实践》\n• 科幻电影可以看《黑客帝国》、《星际穿越》\n你对什么类型感兴趣？';
    }
    if (/(推荐|学)什么(编程|语言)|学哪个编程语言/.test(lowerInput)) {
      return '如果是初学者，我推荐：\n• 🐍 Python - 简单易学，用途广泛\n• ⚛️ JavaScript - 做网页必备\n先从 Python 开始吧！';
    }
    
    // 电脑/技术问题 - 只在提到具体设备或技术问题时匹配
    if (/(电脑|手机|平板|设备)(坏了|出问题|打不开|不工作|卡住了)|(网络|wifi|路由器|连接)(出问题|坏了|连不上)/.test(lowerInput)) {
      return '遇到设备问题了？别担心！可以试试：\n1. 🔄 重启一下设备\n2. 📶 检查网络连接\n3. 🔍 搜索具体的错误信息\n如果问题还在，试着把问题描述得更具体点！';
    }
    if (/(什么是|解释)(cpu|内存|硬盘|ram|rom)/.test(lowerInput)) {
      return '💻 电脑基础知识：\n• CPU - 中央处理器，电脑的"大脑"\n• 内存(RAM) - 临时存储，读写快\n• 硬盘 - 永久存储，容量大\n这三个是电脑的核心组件！';
    }
    
    // 学习/教育相关
    if (/(怎么|如何)(学习|学|开始)/.test(lowerInput)) {
      return '学习任何技能的好方法：\n1️⃣ 从基础开始，循序渐进\n2️⃣ 多动手实践，不要只看\n3️⃣ 遇到问题多搜索\n4️⃣ 坚持下去！\n你想学什么呢？';
    }
    if (/(怎么|如何)提高(编程|技术)/.test(lowerInput)) {
      return '提高编程能力的秘诀：\n• 📝 多写代码，多做项目\n• 🐛 多读优秀代码\n• 🔧 解决实际问题\n• 📚 持续学习新技术\n最重要的是：坚持！';
    }
    
    // 生活/日常问题
    if (/(今天|明天)天气|下雨吗|温度/.test(lowerInput)) {
      return '我现在没法获取实时天气呢，但你可以：\n• 打开手机天气APP\n• 搜索"XX天气"\n• 看看窗外就知道啦！';
    }
    if (/(无聊|没事做|干什么|做什么).*好/.test(lowerInput)) {
      return '无聊时可以做这些：\n• 📚 读本书\n• 💪 运动一下\n• ✍️ 学点新技能\n• 🎵 听音乐\n或者让我给你讲个笑话？';
    }
    if (/(工作|上班|学习)好累|好辛苦/.test(lowerInput)) {
      return '辛苦了！💛 记得要劳逸结合哦！\n• 每小时休息5分钟\n• 起来活动一下\n• 喝杯水\n• 偶尔看看窗外\n身体最重要！';
    }
    
    // 简单数学/逻辑
    if (/(什么|几|多少)加(什么|几|多少)|(\d+)\s*\+\s*(\d+)/.test(lowerInput)) {
      const match = originalInput.match(/(\d+)\s*\+\s*(\d+)/);
      if (match) return `${match[1]} + ${match[2]} = ${parseInt(match[1]) + parseInt(match[2])}`;
      return '你可以直接告诉我"计算 X+Y"，我来帮你算！';
    }
    if (/(什么|几|多少)减(什么|几|多少)|(\d+)\s*\-\s*(\d+)/.test(lowerInput)) {
      const match = originalInput.match(/(\d+)\s*\-\s*(\d+)/);
      if (match) return `${match[1]} - ${match[2]} = ${parseInt(match[1]) - parseInt(match[2])}`;
      return '你可以直接告诉我"计算 X-Y"！';
    }
    
    // 更多常识问题
    if (/(中国|世界)(有|有多少|几)(个|省|国家)/.test(lowerInput)) {
      return '🌍 常识小科普：\n• 中国有 34 个省级行政区\n• 世界上有约 195 个国家\n有想了解的具体国家或地区吗？';
    }
    if (/(地球|世界|中国)有(多少|几)(人|人口)/.test(lowerInput)) {
      return '👥 关于人口：\n• 世界总人口约 80 亿\n• 中国人口约 14 亿\n这些数字随时在变化哦！';
    }
    if (/(什么|谁)发明了(电灯|电话|电脑|互联网)/.test(lowerInput)) {
      return '📜 发明小知识：\n• 电灯 - 爱迪生\n• 电话 - 贝尔\n• 电脑 - 多个发明者共同努力\n• 互联网 - 美国国防部高级研究计划局\n人类的智慧真了不起！';
    }
    
    // 日期/节日相关
    if (/(今天|明天)是(什么|几号)|什么节日/.test(lowerInput)) {
      return '我没法获取实时日期，但你可以问我"现在几点"来查询时间！至于节日，重要的节日有：新年、春节、五一、国庆等！';
    }
    
    // 情感/对话支持
    if (/(开心|高兴|快乐|太棒了)/.test(lowerInput)) {
      return '太棒了！看到你开心我也开心！🎉 有什么好事分享吗？';
    }
    if (/(难过|伤心|不开心|失望)/.test(lowerInput)) {
      return '抱抱你～ 💛 难过是正常的，会好起来的！需要我陪陪你或者讲个笑话吗？';
    }
    if (/(爱你|喜欢你|你好棒|你真厉害)/.test(lowerInput)) {
      return '谢谢你！你也很棒！🌟 能帮到你我很开心！';
    }
    
    // 元对话 - 关于对话本身
    if (/(你)笨|你好笨|你不行|你不会/.test(lowerInput)) {
      return '抱歉让你失望了！😅 我还在学习中。试着把问题说具体点，或者问我"帮助"看看我能做什么！';
    }
    if (/(你)聪明|你好聪明|你好厉害/.test(lowerInput)) {
      return '谢谢！你过奖了！😊 其实我只是个简单的程序，但我会努力帮你的！';
    }
    
    // 简单翻译提示
    if (/(翻译|英文|英语|translate)/.test(lowerInput) && !/翻译.*(到|成|为)/.test(lowerInput)) {
      return '要翻译吗？试试说：\n• "翻译 你好 到英语"\n• "翻译 Hello 到中文"\n我会尽力帮你的！';
    }
    
    // 🔬 科学/自然知识
    if (/(什么是|什么叫|解释)(宇宙|太阳系|银河系|黑洞|地球|太阳|月亮|月球)/.test(lowerInput)) {
      if (/宇宙/.test(lowerInput)) return '🌌 宇宙是万物的总称！包括所有的星系、星球、空间和时间。可观测宇宙直径约930亿光年！';
      if (/太阳系/.test(lowerInput)) return '☀️ 太阳系由太阳和围绕它转的8大行星组成！从近到远：水星、金星、地球、火星、木星、土星、天王星、海王星。';
      if (/银河系/.test(lowerInput)) return '🌌 银河系是我们所在的星系！包含约1000亿到4000亿颗恒星，太阳只是其中之一。';
      if (/黑洞/.test(lowerInput)) return '🕳️ 黑洞是一种引力极强的天体！连光都无法逃脱它！';
      if (/地球/.test(lowerInput)) return '🌍 地球是我们的家园！太阳系第三行星，是目前已知唯一有生命的星球。';
      if (/太阳/.test(lowerInput)) return '☀️ 太阳是太阳系的中心！它是一颗恒星，为地球提供光和热。';
      if (/月亮|月球/.test(lowerInput)) return '🌙 月球是地球的唯一卫星！它绕地球转，还会引起潮汐呢。';
    }
    
    if (/(什么是|什么叫|解释)(动物|植物|生物|细胞|基因|DNA|遗传)/.test(lowerInput)) {
      if (/动物/.test(lowerInput)) return '🦓 动物是地球上的生命之一！有脊椎动物（鱼、鸟、哺乳动物）和无脊椎动物（昆虫、水母）等。';
      if (/植物/.test(lowerInput)) return '🌿 植物是能进行光合作用的生命！给我们提供氧气和食物。';
      if (/生物/.test(lowerInput)) return '🧬 生物是有生命的东西！包括动物、植物、微生物等。';
      if (/细胞/.test(lowerInput)) return '🔬 细胞是生命的基本单位！所有生物都由一个或多个细胞组成。';
      if (/基因|DNA|遗传/.test(lowerInput)) return '🧬 基因/DNA是遗传信息的载体！决定了我们的长相和许多特征。';
    }
    
    if (/(什么是|什么叫|解释)(水|空气|氧气|二氧化碳|能源|环保)/.test(lowerInput)) {
      if (/水/.test(lowerInput)) return '💧 水是生命之源！分子式H₂O，覆盖地球约71%的表面。';
      if (/空气/.test(lowerInput)) return '🌬️ 空气是混合气体！主要是氮气(78%)和氧气(21%)，我们呼吸需要氧气。';
      if (/氧气/.test(lowerInput)) return '💨 氧气(O₂)是我们呼吸必需的气体！由植物光合作用产生。';
      if (/二氧化碳/.test(lowerInput)) return '🌫️ 二氧化碳(CO₂)是一种温室气体！植物需要它进行光合作用。';
      if (/能源/.test(lowerInput)) return '⚡ 能源是能提供能量的资源！包括化石能源（石油、煤）和清洁能源（太阳能、风能）。';
      if (/环保/.test(lowerInput)) return '🌱 环保就是保护环境！节约用水、垃圾分类、减少污染，都是环保的方式。';
    }
    
    // 📜 历史/文化知识
    if (/(什么是|什么叫|解释)(历史|中国历史|古代|朝代|皇帝)/.test(lowerInput)) {
      if (/中国历史/.test(lowerInput)) return '🇨🇳 中国历史悠久！有五千年的文明，经历了很多朝代：夏商周、秦汉、唐宋元明清等。';
      if (/朝代/.test(lowerInput)) return '👑 中国主要朝代顺序：夏 → 商 → 周 → 秦 → 汉 → 三国 → 晋 → 南北朝 → 隋 → 唐 → 宋 → 元 → 明 → 清。';
      if (/古代/.test(lowerInput)) return '🏛️ 古代通常指有历史记载以前到中世纪的时期！中国古代有四大发明：造纸术、印刷术、火药、指南针。';
    }
    
    if (/(什么是|什么叫|解释)(四大发明|长城|故宫|金字塔)/.test(lowerInput)) {
      if (/四大发明/.test(lowerInput)) return '🎯 中国四大发明：造纸术、印刷术、火药、指南针！对世界文明发展有巨大贡献。';
      if (/长城/.test(lowerInput)) return '🏯 中国万里长城！是古代修建的防御工程，非常壮观！';
      if (/故宫/.test(lowerInput)) return '🏮 故宫是明清两代的皇家宫殿！现在是博物院，在北京。';
      if (/金字塔/.test(lowerInput)) return '🔺 金字塔是古埃及法老的陵墓！最有名的是吉萨大金字塔。';
    }
    
    // 🌍 地理知识
    if (/(什么是|什么叫|解释)(山|河|海洋|岛屿|国家|城市|首都)/.test(lowerInput)) {
      if (/山/.test(lowerInput)) return '⛰️ 世界最高山峰是珠穆朗玛峰！海拔8848米，在中国和尼泊尔边境。';
      if (/河/.test(lowerInput)) return '🌊 世界最长的河流是尼罗河！中国最长的是长江。';
      if (/海洋/.test(lowerInput)) return '🌊 地球有五大洋：太平洋、大西洋、印度洋、南冰洋、北冰洋。太平洋最大！';
      if (/岛屿/.test(lowerInput)) return '🏝️ 岛屿是被水包围的小块陆地！世界最大的岛屿是格陵兰岛。';
      if (/首都/.test(lowerInput)) return '🏙️ 首都就是一个国家的中央政府所在地！中国首都是北京，美国首都是华盛顿。';
    }
    
    if (/(中国|世界)(最高|最长|最大)(的|)(山|河|楼|建筑)/.test(lowerInput)) {
      if (/最高.*山/.test(lowerInput)) return '🏔️ 世界最高山峰：珠穆朗玛峰(8848米)，中国最高的也是它！';
      if (/最长.*河/.test(lowerInput)) return '🌊 世界最长：尼罗河，中国最长：长江！';
      if (/最大.*建筑|楼/.test(lowerInput)) return '🏙️ 世界最高建筑在不断更新！台北101、迪拜塔都曾是世界第一高楼。';
    }
    
    // 🍎 生活/健康建议
    if (/(怎么|如何|怎样)(减肥|健康|健康饮食|锻炼|运动|睡眠)/.test(lowerInput)) {
      if (/减肥/.test(lowerInput)) return '⚖️ 健康减肥建议：\n• 合理饮食，多吃蔬菜水果\n• 规律运动\n• 保证充足睡眠\n• 别追求过快！';
      if (/健康|健康饮食/.test(lowerInput)) return '🥗 健康生活建议：\n• 均衡饮食\n• 规律运动\n• 充足睡眠\n• 心情愉快！';
      if (/锻炼|运动/.test(lowerInput)) return '🏃 运动好处多多！\n• 每周3-5次运动\n• 跑步、游泳、瑜伽都好\n• 最重要是坚持！';
      if (/睡眠/.test(lowerInput)) return '😴 良好睡眠建议：\n• 每晚7-8小时\n• 规律作息\n• 睡前少看手机\n• 保持卧室舒适。';
    }
    
    if (/(怎么|如何|怎样)(学习|读书|记忆|考试)/.test(lowerInput)) {
      if (/学习|读书/.test(lowerInput)) return '📚 学习方法：\n• 制定计划\n• 分段学习\n• 多复习\n• 动手实践\n• 保持好奇心！';
      if (/记忆/.test(lowerInput)) return '🧠 记忆技巧：\n• 重复记忆\n• 联想记忆\n• 理解记忆\n• 及时复习\n• 充足睡眠很重要！';
      if (/考试/.test(lowerInput)) return '✍️ 考试建议：\n• 提前复习\n• 考前放松\n• 仔细读题\n• 做完检查\n• 平常心对待！';
    }
    
    // 🎮 娱乐/休闲
    if (/(推荐|有什么|介绍一下|有什么|).*(好看|好听|好玩|电影|音乐|歌曲|游戏|书|书籍)/.test(lowerInput) || /推荐.*电影|推荐一些电影|推荐电影/.test(lowerInput)) {
      if (/电影/.test(lowerInput)) return '🎬 电影推荐：\n• 科幻片《星际穿越》\n• 动画电影《寻梦环游记》\n• 喜剧片也很治愈！找你喜欢的类型吧～';
      if (/音乐|歌曲/.test(lowerInput)) return '🎵 音乐推荐：\n• 不同心情听不同类型\n• 古典乐让人平静\n• 流行歌很轻松\n• 找你喜欢的风格！';
      if (/游戏/.test(lowerInput)) return '🎮 游戏推荐：\n• 益智游戏锻炼大脑\n• 休闲游戏放松心情\n• 注意时间管理！';
      if (/书|书籍/.test(lowerInput)) return '📚 好书推荐：\n• 经典文学作品\n• 实用技能书\n• 你感兴趣的领域书籍！';
      return '🎬 推荐方向：电影、音乐、书籍都可以！你对什么类型感兴趣呢？';
    }
    
    if (/(推荐|有什么|介绍一下)(旅游|旅行|玩|)(的|地方|景点|好玩|)|(哪里|什么地方)(好玩|旅游|旅行)/.test(lowerInput)) {
      return '✈️ 旅游推荐：\n• 北京：长城、故宫\n• 上海：现代都市\n• 西安：古都文化\n• 桂林：山水甲天下\n• 还有好多好地方！';
    }
    
    // 💡 更多实用问答
    if (/(怎么|如何|怎样)(赚钱|省钱|理财|投资)/.test(lowerInput)) {
      return '💰 金钱建议：\n• 努力工作是基础\n• 学会记账和储蓄\n• 理性消费\n• 投资需要先学习\n• 风险意识很重要！';
    }
    
    if (/(怎么|如何|怎样)(交朋友|社交|沟通|聊天)/.test(lowerInput)) {
      return '💬 社交建议：\n• 真诚待人\n• 倾听对方\n• 乐于助人\n• 保持联系\n• 做你自己就好！';
    }
    
    if (/(怎么|如何|怎样)(开心|快乐|幸福|调整心情|保持积极)/.test(lowerInput)) {
      return '😊 开心秘诀：\n• 感恩小事\n• 运动锻炼\n• 和朋友相处\n• 培养兴趣爱好\n• 接受不完美！';
    }
    
    if (/(什么是|什么叫|解释)(梦想|目标|计划|时间管理)/.test(lowerInput)) {
      if (/梦想|目标/.test(lowerInput)) return '⭐ 梦想和目标是前进的动力！有目标就有方向，一步步努力实现它。';
      if (/计划/.test(lowerInput)) return '📋 计划就是把目标拆成步骤！有计划做事更有条理。';
      if (/时间管理/.test(lowerInput)) return '⏰ 时间管理建议：\n• 优先级排序\n• 避免拖延\n• 集中注意力\n• 适当休息\n• 做时间的主人！';
    }
    
    // ⚽ 运动/健康知识
    if (/(什么是|什么叫|解释)(足球|篮球|乒乓球|羽毛球|游泳|跑步|健身|瑜伽)/.test(lowerInput)) {
      if (/足球/.test(lowerInput)) return '⚽ 足球是世界第一运动！两队各11人，进球多的获胜。';
      if (/篮球/.test(lowerInput)) return '🏀 篮球很受欢迎！5人一队，把球投进篮筐得分。';
      if (/乒乓球|羽毛球/.test(lowerInput)) return '🏸 乒乓球和羽毛球是中国强项！单人或双人对打。';
      if (/游泳/.test(lowerInput)) return '🏊 游泳是全身运动！能锻炼身体，很有趣。';
      if (/跑步/.test(lowerInput)) return '🏃 跑步是简单高效的运动！能提高心肺功能。';
      if (/健身|瑜伽/.test(lowerInput)) return '💪 健身和瑜伽让身体更强壮！提高力量和柔韧性。';
    }
    
    if (/(怎么|如何|怎样)(开始|学习|练习)(运动|健身|跑步|瑜伽|游泳|打球)/.test(lowerInput)) {
      if (/运动|健身/.test(lowerInput)) return '💪 开始运动建议：\n• 从简单项目开始\n• 循序渐进\n• 保持规律\n• 热身和拉伸！';
      if (/跑步/.test(lowerInput)) return '🏃 开始跑步建议：\n• 买一双好鞋\n• 从快走开始\n• 逐渐增加距离\n• 注意休息！';
      if (/游泳/.test(lowerInput)) return '🏊 开始游泳建议：\n• 学会基础动作\n• 最好有人教\n• 注意安全\n• 先在浅水区！';
    }
    
    if (/(什么是|什么叫|解释)(健康|健康生活|均衡饮食|营养|维生素|蛋白质)/.test(lowerInput)) {
      if (/健康|健康生活/.test(lowerInput)) return '🏥 健康是宝！饮食规律、充足睡眠、适当运动。';
      if (/均衡饮食|营养/.test(lowerInput)) return '🥗 均衡饮食要荤素搭配！多吃蔬菜水果，不挑食。';
      if (/维生素|蛋白质/.test(lowerInput)) return '🥩 蛋白质和维生素都重要！肉蛋奶有蛋白质，蔬果有维生素。';
    }
    
    // 🍜 美食/饮食知识
    if (/(推荐|有什么)(好吃|著名|特色)的(美食|食物|菜|菜品)/.test(lowerInput)) {
      return '🍜 美食推荐：\n• 北京烤鸭、火锅\n• 川菜、粤菜、各种地方菜\n• 还有各地小吃！';
    }
    
    if (/(什么是|什么叫|解释)(中餐|西餐|日料|快餐|素食)/.test(lowerInput)) {
      if (/中餐/.test(lowerInput)) return '🍚 中餐就是中国菜！有八大菜系，很讲究色香味俱全。';
      if (/西餐/.test(lowerInput)) return '🍝 西餐是西方菜！牛排、意面、面包，用刀叉。';
      if (/日料/.test(lowerInput)) return '🍣 日料是日本料理！寿司、刺身、拉面，很精致。';
      if (/快餐/.test(lowerInput)) return '🍔 快餐很快很方便！汉堡、炸鸡，但不宜多吃。';
      if (/素食/.test(lowerInput)) return '🥬 素食就是不吃肉！健康环保，现在很流行。';
    }
    
    if (/(怎么|如何|怎样)(健康饮食|减肥饮食|搭配饮食|吃得健康)/.test(lowerInput)) {
      return '🥗 健康饮食建议：\n• 一日三餐规律\n• 多吃蔬果\n• 少油少盐\n• 营养均衡\n• 多喝水！';
    }
    
    // ✈️ 旅行/交通知识
    if (/(什么是|什么叫|解释)(旅行|旅游|飞机|火车|高铁|地铁|公交)/.test(lowerInput)) {
      if (/旅行|旅游/.test(lowerInput)) return '✈️ 旅行就是出去玩！看风景、品美食、长见识。';
      if (/飞机/.test(lowerInput)) return '✈️ 飞机是最快的交通工具！能快速到达远方。';
      if (/火车|高铁/.test(lowerInput)) return '🚄 火车/高铁舒适又方便！适合中长途旅行。';
      if (/地铁|公交/.test(lowerInput)) return '🚇 地铁和公交是城市出行好选择！省钱又环保。';
    }
    
    if (/(怎么|如何|怎样)(规划|准备|计划)(旅行|旅游|出行)/.test(lowerInput)) {
      return '🧳 旅行规划建议：\n• 确定目的地\n• 预订机票酒店\n• 查攻略\n• 准备好行李\n• 注意安全！';
    }
    
    if (/(推荐|有什么)(好玩|著名|必去)的(地方|景点|旅游胜地)/.test(lowerInput)) {
      return '🏖️ 旅游推荐：\n• 北京长城故宫\n• 上海都市风光\n• 桂林山水\n• 还有很多好地方！';
    }
    
    // 💼 职业/发展知识
    if (/(什么是|什么叫|解释)(工作|职业|事业|职业规划|简历|面试)/.test(lowerInput)) {
      if (/工作|职业/.test(lowerInput)) return '💼 工作/职业是谋生的方式！要做自己喜欢又适合的。';
      if (/事业/.test(lowerInput)) return '🚀 事业是长期的追求！要一步步来，持续成长。';
      if (/职业规划/.test(lowerInput)) return '📋 职业规划很重要！明确目标，制定计划，努力实现。';
      if (/简历|面试/.test(lowerInput)) return '👔 简历和面试是找工作的关键！简历要真实，面试要自信。';
    }
    
    if (/(怎么|如何|怎样)(找工作|准备面试|写简历|职业发展)/.test(lowerInput)) {
      if (/找工作|面试|简历/.test(lowerInput)) return '👔 找工作建议：\n• 准备好简历\n• 了解公司和岗位\n• 面试自信\n• 不断学习！';
      if (/职业发展/.test(lowerInput)) return '📈 职业发展建议：\n• 不断学习\n• 积累经验\n• 建立人脉\n• 把握机会！';
    }
    
    if (/(推荐|有什么)(好|热门|有前途)的(职业|工作|行业)/.test(lowerInput)) {
      return '💼 职业发展方向：\n• 科技/编程\n• 医疗/教育\n• 设计/创意\n• 选你喜欢又有前景的！';
    }
    
    // 🎯 更多实用知识
    if (/(怎么|如何|怎样)(养成好习惯|自律|坚持|管理时间)/.test(lowerInput)) {
      return '✨ 好习惯养成建议：\n• 从小事开始\n• 每天坚持\n• 定期反思\n• 找伙伴一起\n• 慢慢来不着急！';
    }
    
    if (/(什么是|什么叫|解释)(情商|沟通|人际关系|社交)/.test(lowerInput)) {
      if (/情商/.test(lowerInput)) return '🧠 情商就是控制情绪和理解他人的能力！和智商一样重要。';
      if (/沟通|人际关系|社交/.test(lowerInput)) return '🤝 沟通和社交是重要技能！真诚倾听、表达清楚、互相尊重。';
    }
    
    if (/(怎么|如何|怎样)(提高情商|改善沟通|处理人际关系)/.test(lowerInput)) {
      return '🤝 人际交往建议：\n• 真诚待人\n• 学会倾听\n• 换位思考\n• 保持包容\n• 不断学习！';
    }
    
    if (/(推荐|有什么)(好|有用)的(技能|能力|特长)学习/.test(lowerInput)) {
      return '🎯 推荐学习的技能：\n• 编程/电脑操作\n• 英语/外语\n• 沟通表达\n• 运动技能\n• 看你兴趣来！';
    }
    
    // 🎓 教育/学校知识
    if (/(什么是|什么叫|解释)(小学|中学|高中|大学|学院|学校|教育|课程|作业|考试|成绩)/.test(lowerInput)) {
      if (/小学|中学|高中/.test(lowerInput)) return '📚 这些是不同的学习阶段！小学(6年)→中学(初中3年)→高中(3年)→大学。';
      if (/大学|学院/.test(lowerInput)) return '🎓 大学是高等教育！有本科、硕士、博士，学习专业知识。';
      if (/学校|教育/.test(lowerInput)) return '🏫 学校是学习的地方！教育可以改变人生，要好好珍惜学习机会。';
      if (/作业|考试|成绩/.test(lowerInput)) return '📝 作业和考试是为了巩固知识！认真对待，尽力就好。';
    }
    
    if (/(怎么|如何|怎样)(做作业|复习|备考|应付考试|提高成绩)/.test(lowerInput)) {
      return '📚 学习建议：\n• 按时完成作业\n• 及时复习\n• 做计划\n• 劳逸结合\n• 有问题问老师！';
    }
    
    // 🎨 艺术/文学/设计
    if (/(什么是|什么叫|解释)(音乐|美术|绘画|设计|文学|小说|诗歌|电影|摄影)/.test(lowerInput)) {
      if (/音乐/.test(lowerInput)) return '🎵 音乐是艺术的一种！有各种乐器和歌曲风格，能让人心情好。';
      if (/美术|绘画/.test(lowerInput)) return '🎨 绘画是视觉艺术！可以用画笔、电脑创作，表达自己的想法。';
      if (/设计/.test(lowerInput)) return '🎯 设计无处不在！平面设计、产品设计、网页设计，让生活更美好。';
      if (/文学|小说|诗歌/.test(lowerInput)) return '📖 文学是语言的艺术！小说、诗歌、散文，能陶冶情操。';
      if (/电影/.test(lowerInput)) return '🎬 电影是综合艺术！集故事、音乐、美术于一体，很有魅力。';
      if (/摄影/.test(lowerInput)) return '📷 摄影是用镜头记录瞬间！发现美，记录美。';
    }
    
    if (/(推荐|有什么)(好听|好看)(的|)(歌曲|音乐|歌|电影|书|绘画)/.test(lowerInput)) {
      if (/歌曲|音乐|歌/.test(lowerInput)) return '🎵 音乐推荐：\n• 古典乐（巴赫、莫扎特）\n• 流行乐（看你喜欢的歌手）\n• 找个音乐APP探索吧！';
      if (/电影/.test(lowerInput)) return '🎬 电影推荐：\n• 经典电影《肖申克的救赎》\n• 动画片《寻梦环游记》\n• 选你喜欢的类型！';
      if (/书|绘画/.test(lowerInput)) return '📚 好书好画有很多！\n• 经典文学作品\n• 现代小说\n• 看你兴趣选择！';
    }
    
    // 🌐 网络/科技/软件知识
    if (/(什么是|什么叫|解释)(网络|互联网|网站|网页|APP|应用|软件|程序|病毒|黑客|安全)/.test(lowerInput)) {
      if (/网络|互联网/.test(lowerInput)) return '🌐 互联网把全球电脑连在一起！让信息传递更方便。';
      if (/网站|网页/.test(lowerInput)) return '🖥️ 网站由网页组成！用浏览器访问，获取各种信息。';
      if (/APP|应用/.test(lowerInput)) return '📱 APP就是应用程序！手机上的各种软件都是APP。';
      if (/软件|程序/.test(lowerInput)) return '💻 软件就是程序！让电脑/手机完成各种任务。';
      if (/病毒|黑客|安全/.test(lowerInput)) return '🔒 网络安全很重要！不点击可疑链接，保护好个人信息。';
    }
    
    if (/(怎么|如何|怎样)(使用|玩|安装|下载)(手机|电脑|软件|APP|互联网)/.test(lowerInput)) {
      return '📱 电子产品使用建议：\n• 按照提示操作\n• 不懂可以搜索\n• 注意保护隐私\n• 不要沉迷！';
    }
    
    // 🚗 交通/汽车知识
    if (/(什么是|什么叫|解释)(汽车|火车|飞机|轮船|自行车|电动车|交通规则|驾照)/.test(lowerInput)) {
      if (/汽车/.test(lowerInput)) return '🚗 汽车是常见的交通工具！有汽油车、电动车等。';
      if (/火车|飞机|轮船/.test(lowerInput)) return '✈️ 这些都是交通工具！火车走铁轨，飞机飞天上，轮船在水里。';
      if (/自行车|电动车/.test(lowerInput)) return '🚲 这两个是环保的出行方式！锻炼身体还省钱。';
      if (/交通规则|驾照/.test(lowerInput)) return '🚦 遵守交通规则！考了驾照才能开车，出行要注意安全。';
    }
    
    if (/(怎么|如何|怎样)(考驾照|学开车|选车|买汽车|保养车)/.test(lowerInput)) {
      if (/考驾照|学开车/.test(lowerInput)) return '🚗 考驾照建议：\n• 报驾校学习\n• 认真练习\n• 遵守交规\n• 注意安全！';
      if (/选车|买汽车|保养车/.test(lowerInput)) return '🚗 购车/保养建议：\n• 根据需求选车\n• 定期保养\n• 安全第一！';
    }
    
    // 🏠 生活/家居/家务
    if (/(什么是|什么叫|解释)(家务|做饭|洗衣|打扫卫生|装修|家具|家电|电器)/.test(lowerInput)) {
      if (/家务|做饭|洗衣|打扫/.test(lowerInput)) return '🧹 做家务是基本生活技能！自己动手，丰衣足食。';
      if (/装修|家具|家电|电器/.test(lowerInput)) return '🏠 家是我们的港湾！装修、家具、家电让家更舒适。';
    }
    
    if (/(怎么|如何|怎样)(做饭|炒菜|烧菜|做|学习做饭)/.test(lowerInput)) {
      return '👨‍🍳 学做饭建议：\n• 从简单菜开始\n• 多看食谱\n• 多加练习\n• 注意安全用火！';
    }
    
    if (/(怎么|如何|怎样)(打扫卫生|做家务|整理房间|收纳)/.test(lowerInput)) {
      return '🧹 做家务建议：\n• 定期打扫\n• 分类整理\n• 保持整洁\n• 做家务也是运动！';
    }
    
    // 🐾 动物/宠物知识
    if (/(什么是|什么叫|解释)(宠物|猫|狗|鸟|鱼|动物|兽医|疫苗)/.test(lowerInput)) {
      if (/宠物|猫|狗|鸟|鱼/.test(lowerInput)) return '🐾 宠物是人类的朋友！养猫养狗很常见，但养了就要负责。';
      if (/动物/.test(lowerInput)) return '🦁 动物是地球大家庭的一员！有野生动物、家养动物，我们要爱护它们。';
      if (/兽医|疫苗/.test(lowerInput)) return '🏥 兽医是给动物看病的！打疫苗可以保护宠物健康。';
    }
    
    if (/(怎么|如何|怎样)(养宠物|养猫|养狗|照顾宠物|选宠物)/.test(lowerInput)) {
      return '🐾 养宠物建议：\n• 想好再养\n• 不离不弃\n• 按时打疫苗\n• 生病看兽医！';
    }
    
    if (/(推荐|适合养)什么(宠物|猫|狗)|什么宠物好/.test(lowerInput)) {
      return '🐾 宠物推荐：\n• 猫咪 - 独立可爱\n• 狗狗 - 忠诚陪伴\n• 鱼、鸟也很好\n• 根据条件选择！';
    }
    
    // 🌱 植物/园艺知识
    if (/(什么是|什么叫|解释)(植物|花|草|树|园艺|种花|养植物|浇水)/.test(lowerInput)) {
      if (/植物|花|草|树/.test(lowerInput)) return '🌱 植物是生命的重要部分！给我们氧气，美化环境。';
      if (/园艺|种花|养植物/.test(lowerInput)) return '🪴 园艺很治愈！看着植物长大很有成就感。';
    }
    
    if (/(怎么|如何|怎样)(种花|养植物|养花|浇水|种植)/.test(lowerInput)) {
      return '🌱 养植物建议：\n• 了解植物习性\n• 适度浇水\n• 适量光照\n• 有耐心！';
    }
    
    // ⚡ 物理/化学/数学知识
    if (/(什么是|什么叫|解释)(物理|化学|数学|科学|实验|公式|方程式)/.test(lowerInput)) {
      if (/物理/.test(lowerInput)) return '⚡ 物理研究物质和能量！力、热、光、电都很有意思。';
      if (/化学/.test(lowerInput)) return '⚗️ 化学研究物质的变化！元素周期表、化学反应很神奇。';
      if (/数学/.test(lowerInput)) return '🔢 数学是科学的基础！培养逻辑思维能力，很有用。';
      if (/科学|实验/.test(lowerInput)) return '🔬 科学让我们认识世界！做实验可以验证猜想。';
    }
    
    if (/(怎么|如何|怎样)(学好|学习|提高)(数学|物理|化学|科学)/.test(lowerInput)) {
      return '📐 理科学好建议：\n• 理解概念\n• 多做练习\n• 动手实验\n• 多问为什么！';
    }
    
    // 📖 语言/语文知识
    if (/(什么是|什么叫|解释)(语文|作文|写作|阅读|古诗|文言文|成语|语法)/.test(lowerInput)) {
      if (/语文|作文|写作|阅读/.test(lowerInput)) return '📚 语文很重要！是学习其他学科的基础，多读书多写作。';
      if (/古诗|文言文/.test(lowerInput)) return '📜 古诗和文言文是中国文化瑰宝！有优美的文字和深邃的思想。';
      if (/成语|语法/.test(lowerInput)) return '📝 成语有历史故事！语法让我们表达更准确。';
    }
    
    if (/(怎么|如何|怎样)(写好作文|学好语文|提高写作|提高阅读)/.test(lowerInput)) {
      return '✍️ 语文学好建议：\n• 多读书\n• 多写多练\n• 背诵好文章\n• 观察生活！';
    }
    
    // 🗺️ 外语/英语学习
    if (/(什么是|什么叫|解释)(英语|外语|单词|语法|听力|口语|翻译)/.test(lowerInput)) {
      if (/英语|外语/.test(lowerInput)) return '🌍 英语是国际语言！学会了可以和更多人交流。';
      if (/单词|语法|听力|口语|翻译/.test(lowerInput)) return '📝 这些都是语言学习的部分！听说读写都要练。';
    }
    
    if (/(怎么|如何|怎样)(学习|学好|提高)(英语|外语|单词|听力|口语)/.test(lowerInput)) {
      return '📖 外语学习建议：\n• 多背单词\n• 多听多说\n• 看剧听歌\n• 坚持下去！';
    }
    
    // 🎉 节日/庆祝/传统知识
    if (/(什么是|什么叫|解释)(春节|新年|圣诞节|中秋节|端午节|节日|传统|习俗)/.test(lowerInput)) {
      if (/春节|新年/.test(lowerInput)) return '🧧 春节是中国最重要的节日！全家团圆，放鞭炮，吃年夜饭。';
      if (/圣诞节/.test(lowerInput)) return '🎄 圣诞节是西方重要节日！有圣诞树、圣诞老人、礼物。';
      if (/中秋节/.test(lowerInput)) return '🥮 中秋节家人团聚！吃月饼，赏月。';
      if (/端午节/.test(lowerInput)) return '🐲 端午节纪念屈原！吃粽子，赛龙舟。';
      if (/节日|传统|习俗/.test(lowerInput)) return '🎉 节日让生活有仪式感！传承文化，增进感情。';
    }
    
    if (/(怎么|如何|怎样)(庆祝|过节|准备)(节日|过年|中秋|圣诞)/.test(lowerInput)) {
      return '🎉 庆祝节日建议：\n• 和家人团聚\n• 按照传统习俗\n• 开心最重要！';
    }
    
    // 👨‍👩‍👧 家庭/亲情/人际关系
    if (/(什么是|什么叫|解释)(家庭|家人|父母|亲情|友谊|朋友|爱情|婚姻)/.test(lowerInput)) {
      if (/家庭|家人|父母|亲情/.test(lowerInput)) return '❤️ 家是最温暖的地方！珍惜和家人在一起的时光。';
      if (/友谊|朋友/.test(lowerInput)) return '🤝 朋友很重要！真诚相待，互相帮助。';
      if (/爱情|婚姻/.test(lowerInput)) return '💑 爱情婚姻是人生大事！要认真对待，负责任。';
    }
    
    if (/(怎么|如何|怎样)(和家人相处|和朋友相处|交朋友|维持友谊)/.test(lowerInput)) {
      return '❤️ 人际关系建议：\n• 真诚沟通\n• 互相理解\n• 关心对方\n• 保持联系！';
    }
    
    // 💭 心理/情绪知识
    if (/(什么是|什么叫|解释)(心理|情绪|压力|焦虑|抑郁|开心|难过|心理咨询)/.test(lowerInput)) {
      if (/心理|情绪/.test(lowerInput)) return '💭 情绪是正常的！喜怒哀乐都会有，学会管理情绪。';
      if (/压力|焦虑|抑郁/.test(lowerInput)) return '💙 有压力是正常的！太严重可以找心理咨询。';
      if (/心理咨询/.test(lowerInput)) return '🗣️ 心理咨询很正常！有专业人士帮助你。';
    }
    
    // === 🚀 新增：高阶科技知识 ===
    if (/(什么是|什么叫|解释)(人工智能|ai|机器学习|机器学习|深度学习|算法|大数据|云计算|物联网|区块链)/.test(lowerInput)) {
      if (/人工智能|ai\b/.test(lowerInput)) return '🤖 人工智能(AI)是让电脑模拟人类智能的技术！包括机器学习、深度学习等。';
      if (/机器学习|深度学习/.test(lowerInput)) return '🧠 机器学习是AI的核心！让电脑从数据中学习规律。深度学习是更复杂的机器学习。';
      if (/大数据/.test(lowerInput)) return '📊 大数据是超大规模的数据！可以通过分析发现有价值的信息。';
      if (/云计算/.test(lowerInput)) return '☁️ 云计算是通过互联网提供计算服务！不用自己买服务器也能有强大算力。';
      if (/物联网/.test(lowerInput)) return '📡 物联网(IoT)是让各种设备连上网！比如智能家居、智能手表。';
      if (/区块链/.test(lowerInput)) return '⛓️ 区块链是一种去中心化的数据库技术！比特币就是基于区块链的。';
      if (/算法/.test(lowerInput)) return '🔢 算法是解决问题的步骤和方法！编程的核心就是设计好算法。';
    }
    
    if (/(怎么|如何|怎样)(学习|入门|开始)(人工智能|ai|机器学习|编程|代码)/.test(lowerInput)) {
      return '🚀 学习技术建议：\n• 先学基础概念\n• 从Python编程语言开始\n• 做项目练习\n• 多看教程和文档\n• 加入学习社区！';
    }
    
    // === 🎨 新增：科技产品知识 ===
    if (/(什么是|什么叫|解释)(笔记本|电脑|平板|ipad|手机|智能手机|耳机|蓝牙|wifi|路由器)/.test(lowerInput)) {
      if (/笔记本|电脑|平板|ipad/.test(lowerInput)) return '💻 这些都是常用的电子设备！笔记本便携，台式机性能强，平板娱乐性好。';
      if (/手机|智能手机/.test(lowerInput)) return '📱 智能手机是我们的好帮手！可以打电话、上网、拍照、安装各种APP。';
      if (/耳机|蓝牙/.test(lowerInput)) return '🎧 蓝牙耳机方便实用！无线连接，可以听音乐、打电话。';
      if (/wifi|路由器/.test(lowerInput)) return '📶 WiFi是无线网络技术！路由器提供WiFi信号，让手机电脑可以无线上网。';
    }
    
    if (/(推荐|买|选择|什么)(笔记本|电脑|手机|平板)好/.test(lowerInput)) {
      return '💻 选购电子产品建议：\n• 确定预算\n• 看使用需求（学习、游戏、工作）\n• 看品牌和口碑\n• 看配置参数\n• 可以先去实体店体验！';
    }
    
    // === 📱 新增：网络与应用知识 ===
    if (/(什么是|什么叫|解释)(微信|支付宝|抖音|视频号|朋友圈|社交|软件|应用|app)/.test(lowerInput)) {
      if (/微信/.test(lowerInput)) return '💬 微信是中国流行的即时通讯工具！可以聊天、发朋友圈、支付。';
      if (/支付宝/.test(lowerInput)) return '💰 支付宝是移动支付工具！可以付款、理财、交水电费。';
      if (/抖音|视频号/.test(lowerInput)) return '📹 抖音/视频号是短视频平台！可以看视频、分享生活、直播。';
      if (/朋友圈|社交/.test(lowerInput)) return '👥 社交软件方便我们与朋友保持联系！但也要注意保护隐私。';
      if (/app|软件|应用/.test(lowerInput)) return '📲 APP就是应用程序！可以在手机或电脑上安装各种APP实现不同功能。';
    }
    
    if (/(怎么|如何|怎样)(使用|注册|设置)(微信|支付宝|app|账号)/.test(lowerInput)) {
      return '📱 使用APP建议：\n• 从官方应用商店下载\n• 保护账号密码\n• 注意隐私设置\n• 不要在非官方链接登录！';
    }
    
    // === 💼 新增：金融与理财知识 ===
    if (/(什么是|什么叫|解释)(理财|投资|股票|基金|银行|信用卡|贷款|存款|利息)/.test(lowerInput)) {
      if (/理财|投资/.test(lowerInput)) return '💰 理财是管理你的金钱！包括储蓄、投资、消费规划。投资有风险，入市需谨慎！';
      if (/股票|基金/.test(lowerInput)) return '📈 股票是公司股权的一部分！基金是把钱交给专业人士投资。两者都有风险。';
      if (/银行|存款|利息/.test(lowerInput)) return '🏦 银行是管理钱的地方！存款有利息，可以贷款，是安全的金融机构。';
      if (/信用卡|贷款/.test(lowerInput)) return '💳 信用卡可以先消费后还款，但要按时还款！贷款要根据能力借，理性消费。';
    }
    
    if (/(怎么|如何|怎样)(理财|存钱|省钱|投资|赚钱)/.test(lowerInput)) {
      return '💰 理财入门建议：\n• 养成记账习惯\n• 每月强制储蓄\n• 不要盲目投资高风险产品\n• 先学习金融知识\n• 钱生钱需要耐心！';
    }
    
    // === 🍳 新增：更多生活实用知识 ===
    if (/(什么是|什么叫|解释)(健身|减肥|瑜伽|跑步|运动|饮食|健康|养生|中医)/.test(lowerInput)) {
      if (/健身|减肥|瑜伽|跑步|运动/.test(lowerInput)) return '💪 运动让身体健康！坚持运动可以增强体质、改善心情、控制体重。';
      if (/饮食|健康|养生|中医/.test(lowerInput)) return '🥗 健康饮食是健康基础！均衡饮食、规律作息，比吃保健品更重要。';
    }
    
    if (/(怎么|如何|怎样)(减肥|健身|增肌|塑形|保持健康)/.test(lowerInput)) {
      return '💪 健康生活建议：\n• 管住嘴、迈开腿\n• 均衡饮食、少油少盐\n• 规律运动\n• 充足睡眠\n• 最重要是坚持！';
    }
    
    // === 🛡️ 新增：安全与防护 ===
    if (/(什么是|什么叫|解释)(诈骗|网络诈骗|电信诈骗|骗局|传销|隐私|个人信息|安全)/.test(lowerInput)) {
      if (/诈骗|网络诈骗|电信诈骗|骗局|传销/.test(lowerInput)) return '⚠️ 警惕诈骗！不透露银行卡、不转账给陌生人、不点可疑链接。有疑问直接报警。';
      if (/隐私|个人信息/.test(lowerInput)) return '🔒 保护个人隐私很重要！不要随便透露身份证、手机号、密码等敏感信息。';
      if (/安全/.test(lowerInput)) return '🛡️ 安全第一！无论是上网、出行、用火用电，都要注意安全。';
    }
    
    if (/(怎么|如何|怎样)(防诈骗|保护隐私|保护个人信息|安全上网)/.test(lowerInput)) {
      return '🛡️ 安全防护建议：\n• 不轻易透露个人信息\n• 不点击陌生链接和邮件\n• 不转账给陌生人\n• 使用复杂密码\n• 有疑问及时报警！';
    }
    
    // === 📚 新增：知识学习与自我提升 ===
    if (/(什么是|什么叫|解释)(知识|学习|成长|进步|技能|能力|特长|优势)/.test(lowerInput)) {
      if (/知识|学习|成长|进步/.test(lowerInput)) return '📚 学习是终身的过程！不断学习新知识，让自己不断进步，适应时代变化。';
      if (/技能|能力|特长|优势/.test(lowerInput)) return '🎯 每个人都有自己的特长！找到并发挥自己的优势，比盲目弥补缺点更重要。';
    }
    
    if (/(怎么|如何|怎样)(提升自己|提高能力|学知识|自我提升|变得优秀)/.test(lowerInput)) {
      return '🚀 自我提升建议：\n• 保持好奇心和学习热情\n• 多读书、多思考\n• 多实践、多练习\n• 认识比自己优秀的人\n• 每天进步一点点！';
    }
    
    // === 💡 新增：创业与赚钱 ===
    if (/(什么是|什么叫|解释)(创业|副业|兼职|赚钱|打工|工作|收入)/.test(lowerInput)) {
      if (/创业/.test(lowerInput)) return '🚀 创业是自己开创事业！有风险也有回报，需要充分准备和不断学习。';
      if (/副业|兼职|赚钱/.test(lowerInput)) return '💰 副业是在主业之外赚钱的方式！可以根据自己的技能和时间选择合适的副业。';
      if (/打工|工作|收入/.test(lowerInput)) return '💼 工作是获得收入的主要方式！选择自己喜欢且适合的职业很重要。';
    }
    
    if (/(怎么|如何|怎样)(赚钱|创业|找副业|增加收入)/.test(lowerInput)) {
      return '💡 赚钱建议：\n• 先做好本职工作\n• 发展技能和特长\n• 关注市场需求\n• 可以尝试副业\n• 持续学习提升\n• 不要轻信高收益陷阱！';
    }
    
    // === 🤖 新增：AI Agent相关 ===
    if (/(你是谁|你是|你是什么|介绍一下自己|你能做什么|你有什么功能|你可以做什么)/.test(lowerInput)) {
      return '🤖 你好！我是一个AI智能助手。我可以：\n• 回答各种问题\n• 提供建议和指导\n• 帮你计算和分析\n• 提供情感支持\n• 陪你聊天\n\n我是用代码和数据训练出来的，会不断学习和进步！';
    }
    
    if (/(你是ai|你是人工智能|你是程序|你是机器人)/.test(lowerInput)) {
      return '🤖 是的！我是一个AI程序。我是通过大量的数据训练出来的，可以理解人类语言并进行对话。我不是真人，但我会尽力帮你！';
    }
    
    // === 🔄 新增：更多日常实用问题 ===
    if (/(无聊|没事做|无聊怎么办|无聊了|不知道做什么)/.test(lowerInput)) {
      return '😊 无聊时可以试试：\n• 📚 读一本好书\n• 🎵 听音乐或学习新歌\n• 🏃 出去运动一下\n• 🎨 学习新技能\n• 📝 写日记或随笔\n• 🧹 整理房间\n• 🧑‍🤝‍🧑 联系好久没见的朋友\n• 🌳 去公园或户外走走\n\n无聊也是休息的一种方式，偶尔放松也不错！';
    }
    
    if (/(失眠|睡不着|睡不着怎么办|失眠了)/.test(lowerInput)) {
      return '😴 失眠建议：\n• 睡前不要看手机屏幕\n• 保持卧室安静舒适\n• 放松心态，不要焦虑\n• 可以听轻音乐或白噪音\n• 喝点热牛奶\n• 如果长期失眠，建议看医生\n\n不要因为睡不着而焦虑，越焦虑越睡不着！';
    }
    
    if (/(压力大|压力|压力太大|压力大怎么办)/.test(lowerInput)) {
      return '💙 缓解压力建议：\n• 运动运动！让身体帮你释放压力\n• 与朋友家人聊聊天\n• 做点自己喜欢的事\n• 保证充足睡眠\n• 不要同时想太多事\n• 深呼吸、冥想\n• 必要时找心理咨询\n\n有压力是正常的，学会释放压力！';
    }
    
    if (/(迷茫|不知道该怎么办|不知道怎么办|没方向|失去方向|没有目标)/.test(lowerInput)) {
      return '🧭 迷茫是正常的成长阶段！建议：\n• 先冷静下来，不要焦虑\n• 思考自己真正想要什么\n• 可以从小目标开始\n• 多尝试不同的事情\n• 向你信任的人请教\n• 读书学习，扩大视野\n\n每个人都会有迷茫期，这是成长的契机。一步一步来，不要着急！';
    }
    
    if (/(坚持不下去|不想坚持|没有动力|没动力|怎么坚持)/.test(lowerInput)) {
      return '💪 坚持的秘诀：\n• 把大目标拆成小目标\n• 给自己设定奖励\n• 找到志同道合的伙伴\n• 记住为什么开始\n• 允许自己偶尔休息\n• 建立习惯（21天养成一个习惯）\n• 进步是曲线的，不是每天都能提高\n\n坚持很难，但坚持下来一定会有收获！';
    }
    
    if (/(心情不好|情绪低落|不开心|难过|伤心)/.test(lowerInput)) {
      return '💛 心情不好是正常的！试试这些：\n• 🎵 听喜欢的音乐\n• 🚶 出去走走\n• 📞 找朋友倾诉\n• 😢 允许自己难过一下\n• 📝 写日记\n• 🧹 做点体力劳动或运动\n\n情绪就像天气，有阴晴变化是正常的。过一会就会好起来！';
    }
    
    if (/(焦虑|紧张|紧张怎么办|焦虑怎么办|很紧张|很焦虑)/.test(lowerInput)) {
      return '💙 缓解焦虑建议：\n• 深呼吸（4秒吸，4秒呼）\n• 转移注意力\n• 不要想太多未来的事\n• 专注当下可以做的小事\n• 运动释放焦虑\n• 倾诉给信任的人\n• 如果严重，找专业心理咨询\n\n焦虑是身体提醒你需要休息了！';
    }
    
    // === 🎓 新增：学习方法更多 ===
    if (/(学习方法|学习技巧|怎么学习|如何学习|学习的方法|高效学习)/.test(lowerInput)) {
      return '📚 高效学习方法：\n• 1️⃣ 主动学习：边学边思考，不只是记忆\n• 2️⃣ 做笔记：用自己的语言总结\n• 3️⃣ 间隔重复：隔一段时间复习\n• 4️⃣ 实践应用：学了就用\n• 5️⃣ 费曼技巧：用简单语言教别人\n• 6️⃣ 保持好奇：多问为什么\n• 7️⃣ 劳逸结合：大脑也需要休息！';
    }
    
    if (/(记忆力|记忆力差|怎么提高记忆力|如何增强记忆)/.test(lowerInput)) {
      return '🧠 提高记忆力建议：\n• 🔁 重复记忆\n• 🖼️ 联想记忆（把内容和图像联系）\n• 😴 充足睡眠（睡眠帮助记忆整理）\n• 📋 分类记忆\n• 🏃 运动后学习效果更好\n• 🍱 饮食健康营养\n• 🎯 专注学习，减少干扰\n\n记忆是可以训练的，越用越好！';
    }
    
    if (/(注意力不集中|注意力|分心|不专注|难以集中|集中不了注意力)/.test(lowerInput)) {
      return '🎯 提高注意力建议：\n• 📱 远离手机和社交媒体\n• ⏰ 番茄工作法：25分钟专注+5分钟休息\n• 🧘 冥想练习\n• 🏃 规律运动\n• 😴 充足睡眠\n• 🗒️ 一次只做一件事\n• 📖 先从简单任务开始\n\n注意力像肌肉一样，是可以训练的！';
    }
    
    // === 🌐 新增：通用/万能问答 ===
    if (/(什么是|什么叫|解释一下|介绍一下|讲讲)(什么|东西|意思|概念)/.test(lowerInput)) {
      return '💡 你好！请告诉我你想了解什么？比如：\n• "什么是人工智能"\n• "怎么学习编程"\n• "推荐几本好书"\n\n把你的问题说具体一点，我来帮你解答！';
    }
    
    if (/(给我一些|给我|介绍一下|有什么|推荐一些)(建议|意见|想法|主意|信息)/.test(lowerInput)) {
      return '💭 当然可以！请告诉我你想了解什么？比如：\n• 🎯 学习建议\n• 💼 职业发展建议\n• 💪 健康建议\n• 💰 理财建议\n• 🎬 娱乐推荐\n• 📚 书籍推荐\n\n告诉我具体需求，我来给你有用的建议！';
    }
    
    if (/(怎么|如何|怎样)(缓解压力|调整情绪|放松|开心起来|处理焦虑)/.test(lowerInput)) {
      return '💙 调整情绪建议：\n• 深呼吸\n• 运动一下\n• 和朋友聊聊\n• 做喜欢的事！';
    }
    
    // 🌍 环保/自然知识
    if (/(什么是|什么叫|解释)(环保|污染|垃圾|回收|循环利用|生态|环境)/.test(lowerInput)) {
      if (/环保|环境/.test(lowerInput)) return '🌱 保护环境，人人有责！让地球更美好。';
      if (/污染|垃圾/.test(lowerInput)) return '🗑️ 污染对地球有害！垃圾分类回收可以减少污染。';
      if (/回收|循环利用/.test(lowerInput)) return '♻️ 回收循环再利用！节约资源，减少浪费。';
    }
    
    if (/(怎么|如何|怎样)(环保|保护环境|节约|垃圾分类|绿色生活)/.test(lowerInput)) {
      return '🌱 环保建议：\n• 节约水电\n• 垃圾分类\n• 自带购物袋\n• 低碳出行！';
    }
    
    // 🎯 更多生活常识
    if (/(什么是|什么叫|解释)(礼貌|礼仪|感谢|道歉|社交|礼貌用语)/.test(lowerInput)) {
      return '🎭 礼貌礼仪很重要！会说请、谢谢、对不起，尊重他人。';
    }
    
    if (/(怎么|如何|怎样)(懂礼貌|学礼仪|打招呼|道歉|感谢)/.test(lowerInput)) {
      return '🤝 社交礼仪建议：\n• 多说"请""谢谢""对不起"\n• 尊重他人\n• 换位思考\n• 保持微笑！';
    }
    
    // 💰 金钱/消费/理财
    if (/(什么是|什么叫|解释)(钱|赚钱|花钱|消费|购物|价格|价值|省钱|理财)/.test(lowerInput)) {
      if (/钱|赚钱|花钱|消费/.test(lowerInput)) return '💰 钱是生活必需！要靠劳动获得，理性消费。';
      if (/购物|价格|价值/.test(lowerInput)) return '🛒 购物要理性！看价值，不冲动消费。';
      if (/省钱|理财/.test(lowerInput)) return '📊 理财让钱生钱！先储蓄，再合理规划。';
    }
    
    if (/(怎么|如何|怎样)(省钱|存钱|合理消费|不浪费|理财)/.test(lowerInput)) {
      return '💰 金钱建议：\n• 记账\n• 节约\n• 不浪费\n• 适度消费！';
    }
    
    // 🔧 解决问题/求助
    if (/(怎么|如何|怎样)(办|做|解决|处理|应对)|遇到.*怎么办/.test(lowerInput)) {
      return '💡 解决问题建议：\n1. 先冷静\n2. 分析问题\n3. 寻求帮助\n4. 总结经验\n能把问题说具体一点吗？';
    }
    
    // 🤔 对话引导
    if (/(你说|你觉得|你认为)/.test(lowerInput)) {
      return '🤔 这是个很好的话题！你是怎么想的呢？我愿意听听你的想法～';
    }
    
    // 重复/复读机检查
    if (/(重复|复读|你刚才|你之前)/.test(lowerInput)) {
      return '抱歉！让我重新说。你想问什么问题呢？';
    }
    
    // 无法识别但很长的输入
    if (originalInput.length > 50) {
      return '收到！你说的我认真看了。请问有什么我可以帮你的吗？比如：\n• 搜索相关信息\n• 回答具体问题\n• 或者聊点别的？';
    }

    // ========== 扩展知识库 ==========

    // 🤖 AI/机器学习/深度学习
    if (/(什么是|什么叫|解释)(人工智能|AI|机器学习|深度学习|神经网络|ChatGPT|GPT|大模型)/.test(lowerInput)) {
      if (/人工智能|AI/.test(lowerInput)) return '🤖 人工智能(AI)是让机器具有人类智能的技术！包括机器学习、深度学习等。';
      if (/机器学习/.test(lowerInput)) return '📊 机器学习是AI的分支！让计算机通过数据学习，不需要明确编程。';
      if (/深度学习/.test(lowerInput)) return '🧠 深度学习是机器学习的进阶！使用神经网络处理复杂问题。';
      if (/神经网络/.test(lowerInput)) return '🔬 神经网络模仿人脑！由很多"神经元"组成，可以学习复杂模式。';
      if (/ChatGPT|GPT|大模型/.test(lowerInput)) return '💬 GPT是大语言模型！能理解和生成文本，像我就是这样工作的。';
    }

    if (/(怎么|如何|怎样)(学习|入门|了解)(人工智能|AI|机器学习|深度学习)/.test(lowerInput)) {
      return '🤖 AI学习建议：\n• 从Python编程开始\n• 学习数学基础\n• 了解机器学习概念\n• 动手做小项目\n• 多看教程和论文！';
    }

    // 💻 编程语言/开发
    if (/(什么是|什么叫|解释)(Python|JavaScript|Java|C\+\+|Go|Rust|编程语言)/.test(lowerInput)) {
      if (/Python/.test(lowerInput)) return '🐍 Python简单易学！适合初学者，常用于AI、数据分析、Web开发。';
      if (/JavaScript/.test(lowerInput)) return '⚡ JavaScript是Web语言！做网页必备，也可以做服务器开发。';
      if (/Java/.test(lowerInput)) return '☕ Java是企业级语言！安卓开发、企业应用都很常用。';
      if (/C\+\+/.test(lowerInput)) return '⚙️ C++是高性能语言！游戏、系统、嵌入式开发常用。';
      if (/Go|Rust/.test(lowerInput)) return '🚀 Go和Rust是现代系统语言！性能高，安全可靠。';
    }

    if (/(怎么|如何|怎样)(学习|入门|选择)(编程语言|第一门语言|写代码)/.test(lowerInput)) {
      return '💻 编程入门建议：\n• 推荐从Python开始\n• 找在线教程\n• 多动手练习\n• 写小项目\n• 坚持最重要！';
    }

    if (/(什么是|什么叫|解释)(代码|程序|软件|App|网站|数据库|服务器|云)/.test(lowerInput)) {
      if (/代码|程序/.test(lowerInput)) return '💻 代码就是指令！告诉计算机做什么，用各种编程语言写。';
      if (/软件|App/.test(lowerInput)) return '📱 软件是程序的总称！App就是手机应用程序。';
      if (/网站|网页/.test(lowerInput)) return '🌐 网站由网页组成！通过浏览器访问。';
      if (/数据库/.test(lowerInput)) return '🗄️ 数据库存储数据！像一个大仓库，存放各种信息。';
      if (/服务器|云/.test(lowerInput)) return '☁️ 服务器是运行软件的电脑！云服务器可以随时租用。';
    }

    // 🔐 密码/账户/安全
    if (/(什么是|什么叫|解释)(密码|账户|账号|验证码|登录|注册|双因素)/.test(lowerInput)) {
      if (/密码/.test(lowerInput)) return '🔑 密码保护账户安全！要用强密码，不要重复使用。';
      if (/账户|账号/.test(lowerInput)) return '👤 账户是你的身份标识！保护好不要泄露。';
      if (/验证码/.test(lowerInput)) return '📱 验证码证明你是真人！防止机器人攻击。';
      if (/双因素/.test(lowerInput)) return '🔐 双因素认证更安全！需要两种方式验证身份。';
    }

    if (/(怎么|如何|怎样)(设置|保护|找回)(密码|账户)|账户.*怎么办/.test(lowerInput)) {
      return '🔒 安全建议：\n• 设置强密码\n• 定期更换\n• 不告诉他人\n• 开启双因素认证\n• 警惕钓鱼网站！';
    }

    // 📊 数据/分析/统计
    if (/(什么是|什么叫|解释)(大数据|数据分析|统计|Excel|表格|图表)/.test(lowerInput)) {
      if (/大数据/.test(lowerInput)) return '📊 大数据就是海量数据！用于发现规律和趋势。';
      if (/数据分析/.test(lowerInput)) return '📈 数据分析从数据中提取价值！用统计方法发现规律。';
      if (/统计/.test(lowerInput)) return '📉 统计是收集分析数据！用数字描述和推断事物。';
      if (/Excel|表格|图表/.test(lowerInput)) return '📊 Excel是数据处理工具！做表格、图表、简单计算。';
    }

    // 💹 股票/投资/金融
    if (/(什么是|什么叫|解释)(股票|基金|债券|投资|理财|风险|收益)/.test(lowerInput)) {
      if (/股票/.test(lowerInput)) return '📈 股票是公司股份！买股票就是成为公司股东。';
      if (/基金/.test(lowerInput)) return '💰 基金是集合投资！专业经理帮你管钱。';
      if (/债券/.test(lowerInput)) return '📄 债券是借条！借钱给政府或企业，到期收回本金和利息。';
      if (/投资|理财/.test(lowerInput)) return '💵 投资让钱生钱！但要记住高收益高风险。';
      if (/风险|收益/.test(lowerInput)) return '⚠️ 投资有风险！收益越高风险越大，要谨慎。';
    }

    if (/(怎么|如何|怎样)(开始|入门)(投资|理财|买股票|买基金)/.test(lowerInput)) {
      return '💹 投资入门建议：\n• 先学习知识\n• 不要急于投资\n• 从基金开始\n• 分散风险\n• 不懂不要投！';
    }

    // 🏛️ 法律/权利/常识
    if (/(什么是|什么叫|解释)(法律|权利|义务|合同|协议|违法|犯罪)/.test(lowerInput)) {
      if (/法律/.test(lowerInput)) return '⚖️ 法律是社会规则！规定什么能做、什么不能做。';
      if (/权利|义务/.test(lowerInput)) return '📜 权利是可以做的事！义务是必须做的事。';
      if (/合同|协议/.test(lowerInput)) return '📝 合同是法律协议！签字前要仔细看。';
      if (/违法|犯罪/.test(lowerInput)) return '🚫 违法会受处罚！严重的就是犯罪。';
    }

    if (/(怎么|如何|怎样)(维权|投诉|报警|找律师)/.test(lowerInput)) {
      return '⚖️ 维权建议：\n• 保留证据\n• 了解相关法律\n• 可以报警或投诉\n• 必要时找律师\n• 合法途径维权！';
    }

    // 🎓 升学/考研/留学
    if (/(什么是|什么叫|解释)(高考|考研|留学|大学专业|志愿)/.test(lowerInput)) {
      if (/高考/.test(lowerInput)) return '🎓 高考是人生重要考试！决定能上哪所大学。';
      if (/考研/.test(lowerInput)) return '📚 考研是大学毕业后继续深造！可以提升学历。';
      if (/留学/.test(lowerInput)) return '🌍 留学是去国外学习！可以开阔眼界。';
      if (/大学专业|志愿/.test(lowerInput)) return '📋 大学专业选择很重要！要结合兴趣和前景。';
    }

    if (/(怎么|如何|怎样)(准备|应对)(高考|考研|留学|面试)/.test(lowerInput)) {
      return '📚 考试/面试建议：\n• 提早准备\n• 制定计划\n• 多做练习\n• 保持好心态\n• 注意身体！';
    }

    // 🏢 创业/工作/职场
    if (/(什么是|什么叫|解释)(创业|创新|商业模式|商业计划书|融资)/.test(lowerInput)) {
      if (/创业/.test(lowerInput)) return '🚀 创业是创建自己的企业！有风险也有机遇。';
      if (/创新/.test(lowerInput)) return '💡 创新是新想法新方法！是创业的核心竞争力。';
      if (/商业模式/.test(lowerInput)) return '📊 商业模式是如何赚钱！要想清楚谁买单。';
      if (/商业计划书/.test(lowerInput)) return '📋 商业计划书是创业蓝图！说明你要做什么、怎么做。';
      if (/融资/.test(lowerInput)) return '💰 融资是找投资人要钱！需要说服他们你的想法能赚钱。';
    }

    if (/(怎么|如何|怎样)(创业|找工作|面试|升职|加薪)/.test(lowerInput)) {
      if (/创业/.test(lowerInput)) return '🚀 创业建议：\n• 先上班积累经验\n• 发现市场需求\n• 组建好团队\n• 从小开始\n• 准备好失败！';
      if (/找工作|面试|升职|加薪/.test(lowerInput)) return '💼 职场建议：\n• 提升能力\n• 建立人脉\n• 积极表现\n• 适时沟通\n• 保持学习！';
    }

    // 🌈 心理学/个人成长
    if (/(什么是|什么叫|解释)(情商|智商|逆商|自律|拖延症|焦虑症|抑郁症)/.test(lowerInput)) {
      if (/情商/.test(lowerInput)) return '🧠 情商是情绪智力！理解和管理情绪，比智商更重要。';
      if (/智商/.test(lowerInput)) return '🧠 智商是智力水平！反映学习和分析能力。';
      if (/逆商/.test(lowerInput)) return '💪 逆商是抗压能力！面对挫折的态度很重要。';
      if (/自律/.test(lowerInput)) return '✨ 自律是自我管理！能控制自己才能成功。';
      if (/拖延症/.test(lowerInput)) return '⏰ 拖延症是推迟做事！要克服它才能进步。';
      if (/焦虑症|抑郁症/.test(lowerInput)) return '💙 这些是心理问题！需要专业帮助，别硬撑。';
    }

    if (/(怎么|如何|怎样)(提高情商|克服拖延|管理时间|减少焦虑)/.test(lowerInput)) {
      return '💪 自我提升建议：\n• 认识自己\n• 设定目标\n• 立即行动\n• 反思总结\n• 坚持不懈！';
    }

    // 🎮 游戏/电竞/动漫
    if (/(什么是|什么叫|解释)(电子游戏|电竞|steam|游戏主机|王者荣耀|原神|我的世界)/.test(lowerInput)) {
      if (/电子游戏|游戏/.test(lowerInput)) return '🎮 游戏是娱乐活动！适度玩可以放松，但不要沉迷。';
      if (/电竞/.test(lowerInput)) return '🏆 电竞是电子竞技！已经成为正式体育项目。';
      if (/steam/.test(lowerInput)) return '📺 Steam是游戏平台！可以买游戏、和朋友一起玩。';
      if (/王者荣耀|原神|我的世界/.test(lowerInput)) return '🎮 这些是热门游戏！各有人气，适度娱乐就好。';
    }

    if (/(推荐|有什么好)(游戏|手游|端游|PC游戏|switch|ps5)/.test(lowerInput)) {
      return '🎮 游戏推荐：\n• 手游：王者荣耀、原神\n• PC：我的世界、英雄联盟\n• 主机：塞尔达、马里奥\n• 适度游戏益脑！';
    }

    // 📱 手机/数码/科技产品
    if (/(什么是|什么叫|解释)(智能手机|5G|折叠屏|拍照像素|处理器|CPU|GPU)/.test(lowerInput)) {
      if (/智能手机/.test(lowerInput)) return '📱 智能手机功能强大！打电话、上网、拍照、玩游戏。';
      if (/5G/.test(lowerInput)) return '📡 5G是第五代通信技术！比4G更快。';
      if (/折叠屏/.test(lowerInput)) return '📱 折叠屏是新型手机！屏幕可以折叠，更大更便携。';
      if (/拍照像素/.test(lowerInput)) return '📷 像素越高照片越清晰！但不是唯一标准。';
      if (/处理器|CPU/.test(lowerInput)) return '💻 CPU是手机/电脑的大脑！处理所有计算任务。';
      if (/GPU/.test(lowerInput)) return '🎨 GPU是图形处理器！专门处理图像和游戏。';
    }

    if (/(怎么|如何|怎样)(选择|购买)(手机|电脑|相机|耳机)/.test(lowerInput)) {
      return '📱 数码购买建议：\n• 明确需求\n• 设定预算\n• 看评测\n• 对比参数\n• 买新不买旧！';
    }

    // 🌱 养生/保健/医疗
    if (/(什么是|什么叫|解释)(疫苗|体检|保险|医保|处方药|感冒|发烧|新冠)/.test(lowerInput)) {
      if (/疫苗/.test(lowerInput)) return '💉 疫苗是预防疾病的！接种后身体产生免疫力。';
      if (/体检/.test(lowerInput)) return '🏥 定期体检很重要！可以早发现早治疗。';
      if (/医保/.test(lowerInput)) return '🏦 医保是医疗保障！看病可以报销一部分费用。';
      if (/处方药/.test(lowerInput)) return '💊 处方药需要医生开！不能随便买。';
      if (/感冒|发烧/.test(lowerInput)) return '🤒 感冒发烧要多喝水！严重就去看医生。';
      if (/新冠/.test(lowerInput)) return '🦠 新冠是呼吸道疾病！戴口罩、勤洗手、打疫苗。';
    }

    if (/(怎么|如何|怎样)(增强免疫力|预防感冒|保持健康|养生)/.test(lowerInput)) {
      return '🏥 健康建议：\n• 均衡饮食\n• 适量运动\n• 充足睡眠\n• 心情愉快\n• 定期体检！';
    }

    // 👶 育儿/教育/亲子
    if (/(什么是|什么叫|解释)(早教|胎教|母乳|辅食|疫苗接种|幼儿园)/.test(lowerInput)) {
      if (/早教/.test(lowerInput)) return '👶 早教是早期教育！0-6岁是大脑发育黄金期。';
      if (/胎教/.test(lowerInput)) return '🤰 胎教是孕期教育！听音乐、讲故事对宝宝好。';
      if (/母乳/.test(lowerInput)) return '🤱 母乳是宝宝最好的食物！营养全面增强免疫力。';
      if (/辅食/.test(lowerInput)) return '🥣 辅食是宝宝添加的额外食物！一般在6个月后开始。';
      if (/幼儿园/.test(lowerInput)) return '🏫 幼儿园是孩子第一个社交场所！培养独立性和社交能力。';
    }

    if (/(怎么|如何|怎样)(教育|培养|照顾)(孩子|宝宝|婴儿)/.test(lowerInput)) {
      return '👨‍👩‍👧 育儿建议：\n• 多陪伴\n• 以身作则\n• 耐心沟通\n• 鼓励探索\n• 让孩子快乐成长！';
    }

    // 🏠 房产/装修/家居
    if (/(什么是|什么叫|解释)(房贷|公积金|学区房|装修|甲醛|智能家居)/.test(lowerInput)) {
      if (/房贷/.test(lowerInput)) return '🏦 房贷是买房贷款！要还本金和利息，还款期很长。';
      if (/公积金/.test(lowerInput)) return '💰 公积金是住房保障！买房、租房、装修都可以用。';
      if (/学区房/.test(lowerInput)) return '🏫 学区房靠近好学校！为了孩子教育很多人买。';
      if (/装修/.test(lowerInput)) return '🏠 装修让家更舒适！要注意环保和安全。';
      if (/甲醛/.test(lowerInput)) return '⚠️ 甲醛有害健康！装修后要通风一段时间。';
      if (/智能家居/.test(lowerInput)) return '🏠 智能家居用手机控制！灯光、空调、门锁都可以智能。';
    }

    if (/(怎么|如何|怎样)(买房|装修|选家具|布置房间)/.test(lowerInput)) {
      return '🏠 家居建议：\n• 量入为出\n• 实用为主\n• 环保材料\n• 简约风格\n• 舒适第一！';
    }

    // 🚗 汽车/出行/交通
    if (/(什么是|什么叫|解释)(新能源汽车|电动车|自动驾驶|保养|年检|违章)/.test(lowerInput)) {
      if (/新能源汽车|电动车/.test(lowerInput)) return '🚗 新能源车用电驱动！环保、省钱，但续航有限。';
      if (/自动驾驶/.test(lowerInput)) return '🤖 自动驾驶是AI开车！目前还在发展中。';
      if (/保养/.test(lowerInput)) return '🔧 汽车保养很重要！定期保养延长寿命。';
      if (/年检/.test(lowerInput)) return '📋 年检是检查车辆安全！达标才能上路。';
      if (/违章/.test(lowerInput)) return '🚦 违章会被罚款扣分！遵守交通规则。';
    }

    // ✈️ 航空/旅行/签证
    if (/(什么是|什么叫|解释)(护照|签证|登机牌|行李托运|机票|退票|改签)/.test(lowerInput)) {
      if (/护照/.test(lowerInput)) return '📘 护照是出国证件！相当于国际身份证。';
      if (/签证/.test(lowerInput)) return '📋 签证是入境许可！不同国家要求不同。';
      if (/登机牌|行李托运/.test(lowerInput)) return '🎫 登机牌是上飞机的凭证！行李要托运或随身带。';
      if (/机票|退票|改签/.test(lowerInput)) return '✈️ 机票可以退改！但可能有手续费，购买前看清楚。';
    }

    if (/(怎么|如何|怎样)(出国|办签证|买机票|过安检)/.test(lowerInput)) {
      return '🌍 出国旅行建议：\n• 提前办护照签证\n• 买好机票保险\n• 了解目的地\n• 准备好行李\n• 注意安全！';
    }

    // 📺 媒体/社交/网络
    if (/(什么是|什么叫|解释)(微博|微信|抖音|B站|小红书|朋友圈|公众号)/.test(lowerInput)) {
      if (/微博/.test(lowerInput)) return '📢 微博是社交平台！可以看新闻、追星、发状态。';
      if (/微信/.test(lowerInput)) return '💬 微信是多功能App！聊天、支付、朋友圈。';
      if (/抖音/.test(lowerInput)) return '🎵 抖音是短视频平台！看视频、发视频的平台。';
      if (/B站/.test(lowerInput)) return '📺 B站是弹幕视频网！二次元、学习内容很丰富。';
      if (/小红书/.test(lowerInput)) return '📒 小红书是生活方式分享！美妆、穿搭、旅行攻略。';
      if (/朋友圈|公众号/.test(lowerInput)) return '📱 朋友圈是分享生活！公众号是获取资讯的渠道。';
    }

    // 🎬 影视/娱乐/综艺
    if (/(什么是|什么叫|解释)(奥斯卡|诺贝尔|春晚|脱口秀|相声|话剧|演唱会)/.test(lowerInput)) {
      if (/奥斯卡/.test(lowerInput)) return '🏆 奥斯卡是电影最高奖！每年评选最佳电影。';
      if (/诺贝尔/.test(lowerInput)) return '🏅 诺贝尔奖是世界最高荣誉！和平、物理、化学、医学、文学、经济学。';
      if (/春晚/.test(lowerInput)) return '🎊 春晚是春节联欢晚会！每年除夕夜播出。';
      if (/脱口秀|相声|话剧/.test(lowerInput)) return '🎭 这些是表演艺术！让人笑、让人思考。';
      if (/演唱会/.test(lowerInput)) return '🎤 演唱会是现场演出！感受音乐的魅力。';
    }

    // 🏋️ 健身/减肥/塑形
    if (/(什么是|什么叫|解释)(有氧运动|无氧运动|力量训练|HIIT|体脂|BMI)/.test(lowerInput)) {
      if (/有氧运动/.test(lowerInput)) return '🏃 有氧运动是耐力运动！跑步、游泳、骑车，增强心肺。';
      if (/无氧运动|力量训练/.test(lowerInput)) return '💪 无氧运动是力量训练！举重、器械，增长肌肉。';
      if (/HIIT/.test(lowerInput)) return '⚡ HIIT是高强度训练！短时间高效燃脂。';
      if (/体脂|BMI/.test(lowerInput)) return '📊 体脂率和BMI是衡量身体健康的指标！可以参考。';
    }

    if (/(怎么|如何|怎样)(减肥|增肌|塑形|练出腹肌)/.test(lowerInput)) {
      return '🏋️ 健身建议：\n• 有氧+力量结合\n• 控制饮食\n• 保证蛋白质\n• 坚持锻炼\n• 充足睡眠！';
    }

    // 🍷 酒/烟/咖啡/茶
    if (/(什么是|什么叫|解释)(红酒|白酒|啤酒|咖啡|茶|香烟|电子烟)/.test(lowerInput)) {
      if (/红酒|白酒|啤酒/.test(lowerInput)) return '🍺 酒要适量饮用！过量有害健康。';
      if (/咖啡/.test(lowerInput)) return '☕ 咖啡提神醒脑！适量饮用有好处。';
      if (/茶/.test(lowerInput)) return '🍵 茶是健康饮品！绿茶、红茶、普洱各有好处。';
      if (/香烟|电子烟/.test(lowerInput)) return '🚬 吸烟有害健康！包括电子烟，建议戒烟。';
    }

    // 🧘 冥想/瑜伽/放松
    if (/(什么是|什么叫|解释)(冥想|瑜伽|正念|放松训练|深呼吸)/.test(lowerInput)) {
      return '🧘 这些是放松技巧！可以帮助减压、改善睡眠、提高专注力。';
    }

    if (/(怎么|如何|怎样)(冥想|瑜伽|放松|减压|改善睡眠)/.test(lowerInput)) {
      return '🧘 放松建议：\n• 深呼吸\n• 冥想10分钟\n• 瑜伽伸展\n• 听轻音乐\n• 保持规律！';
    }

    return null;
  }

  private handleQuestion(input: string): AgentResponse {
    // 先尝试查询知识库！这是最重要的修复！
    const faqAnswer = this.tryAnswerFAQ(input);
    if (faqAnswer) {
      return { content: faqAnswer };
    }
    
    // 分析问题类型，给出更有针对性的回复
    const topic = this.extractKeyTopic(input);
    const lowerInput = input.toLowerCase();
    
    // === 增强：更智能的问题分类和响应 ===
    
    // 类型1: 方法类问题 (怎么、如何、怎样)
    if (/(怎么|如何|怎样)(做|学|提高|改善|解决|处理|开始|入门)/.test(input)) {
      return {
        content: `好问题！关于"${topic}"，这里有一些通用建议：\n\n📝 **学习方法：**\n• 先了解基础概念\n• 从简单的开始，循序渐进\n• 边学边实践，学以致用\n• 遇到问题及时请教\n\n💡 **具体建议：**\n• 你可以说"搜索 ${topic}"获取更多信息\n• 把问题描述得更具体，我会给更针对性的建议\n• 也可以告诉我你的背景，我帮你定制学习路径！`
      };
    }
    
    // 类型2: 定义类问题 (什么是、是什么)
    if (/(什么是|是什么|什么叫|什么意思)/.test(input)) {
      return {
        content: `这是个好问题！关于"${topic}"的定义：\n\n📖 虽然我的知识库中没有详细记录，但我可以告诉你：\n• "${topic}"通常是一个值得了解的概念\n• 你可以说"搜索 ${topic}"来获取详细信息\n• 也可以问我相关的基础问题，我会尽力回答！\n\n🔍 小贴士：试试用更简单的关键词搜索！`
      };
    }
    
    // 类型3: 推荐类问题 (推荐、什么好、选什么)
    if (/(推荐|什么好|选什么|哪个好|建议买|推荐一下)/.test(input)) {
      return {
        content: `关于"${topic}"的选择建议：\n\n🎯 **考虑因素：**\n• 📊 你的需求和使用场景是什么？\n• 💰 预算范围是多少？\n• ⭐ 你更看重品质、价格还是品牌？\n\n💡 **建议：**\n• 可以告诉我更多具体需求，我帮你分析\n• 也可以说"搜索 ${topic}推荐"获取更多信息\n• 多做对比，不要急于做决定！`
      };
    }
    
    // 类型4: 原因类问题 (为什么、为什么会、原因是什么)
    if (/(为什么|为什么会|原因是什么|是什么原因)/.test(input)) {
      return {
        content: `很好奇！关于"${topic}"的原因：\n\n🔍 分析问题通常需要：\n• 📚 了解相关背景知识\n• 🔗 找出相关因素和联系\n• 📊 收集数据和证据\n• 💭 进行逻辑推理\n\n💡 你可以：\n• 说"搜索 ${topic}"获取更多信息\n• 告诉我你已经了解的信息\n• 我们一起讨论分析！`
      };
    }
    
    // 类型5: 比较类问题 (区别、不同、比较、哪个更好)
    if (/(区别|不同|比较|哪个更好|差异|对比)/.test(input)) {
      return {
        content: `关于"${topic}"的比较：\n\n⚖️ 比较分析建议：\n• 📋 列出关键比较点（价格、质量、功能等）\n• ⭐ 根据你的需求给每个因素打分\n• 💡 权衡利弊后做出选择\n\n🔍 需要我帮你分析吗？告诉我：\n• 你比较的具体选项是什么？\n• 你的主要需求和顾虑是什么？\n• 我来帮你做详细对比分析！`
      };
    }
    
    // 类型6: 地点类问题 (哪里、在哪、去哪里、位置)
    if (/(哪里|在哪|去哪里|位置|地方|地点)/.test(input)) {
      return {
        content: `关于"${topic}"的地点信息：\n\n📍 查找地点建议：\n• 🗺️ 使用地图软件搜索\n• 📱 可以说"搜索 ${topic}地址"\n• 📝 也可以咨询当地人\n\n💡 如果是具体城市或区域的问题，告诉我，我帮你分析！`
      };
    }
    
    // 类型7: 时间类问题 (什么时候、多久、时间、什么时候开始)
    if (/(什么时候|多久|时间|什么时候开始|什么时候结束|需要多少时间)/.test(input)) {
      return {
        content: `关于"${topic}"的时间信息：\n\n⏰ 时间相关建议：\n• 📅 可以搜索相关的官方公告\n• 📋 列出计划和时间节点\n• ⏳ 预留缓冲时间\n\n💡 告诉我更多背景信息，我可以帮你：\n• 分析时间安排\n• 建议最佳时机\n• 制定行动计划！`
      };
    }
    
    // 类型8: 数量/价格类问题 (多少、多少钱、价格、费用)
    if (/(多少|多少钱|价格|费用|成本|预算|花费)/.test(input)) {
      return {
        content: `关于"${topic}"的价格/费用：\n\n💰 价格查询建议：\n• 🛒 搜索相关商品或服务的官方价格\n• 📊 对比不同选项的性价比\n• 💡 考虑质量和售后服务\n\n🔍 可以说"搜索 ${topic}价格"获取最新信息！\n\n💬 告诉我你的预算范围，我帮你分析如何选择！`
      };
    }
    
    // 类型9: 通用方法/方式问题
    if (/(为什么|怎么|如何|怎样)/.test(input)) {
      return {
        content: `关于"${topic}"，这是个很好的问题！\n\n💡 你可以尝试：\n• 📚 说"搜索 ${topic}"获取详细信息\n• 📝 把问题描述得更具体一些\n• 💬 告诉我你已经尝试过什么\n• 🎯 说明你的目标和预期结果\n\n我会根据你的具体需求，给你更有针对性的建议！`
      };
    }
    
    // 类型10: 定义/事实类问题
    if (/(什么|哪个|谁|哪里|多少|几)/.test(input)) {
      return {
        content: `这个问题很有意思！关于"${topic}"：\n\n🔍 获取信息的方法：\n• 试试用"搜索 ${topic}"查找详细答案\n• 告诉我更多背景信息，我帮你分析\n• 如果是常识类问题，我可能有相关知识\n\n💡 小贴士：提问越具体，答案越准确！\n例如：不说"什么是编程"，可以问"什么是Python编程"`
      };
    }
    
    // 通用问题回复 - 更友好和有帮助的
    const responses = [
      `关于"${topic}"，这是个很棒的问题！虽然我的知识库有限，但我可以帮你：\n\n1️⃣ 试试说"搜索 ${topic}"查找详细信息\n2️⃣ 更具体地描述你的问题（比如你想了解哪方面？）\n3️⃣ 告诉我你的背景和目标\n4️⃣ 也可以换个方式提问\n\n我会尽力帮你找到答案！💪`,
      `好问题！对于"${topic}"这个话题：\n\n🔍 **获取答案的方法：**\n• 说"搜索 ${topic}"查找相关信息\n• 把问题描述得更具体\n• 告诉我你已经知道什么\n\n💡 我能帮你：分析问题、整理思路、提供建议！有什么具体想了解的？`,
      `这个问题很有意思！🤔 关于"${topic}"：\n\n虽然我现在没法直接回答完整答案，但我可以：\n1️⃣ 帮你搜索相关信息（说"搜索 ${topic}"）\n2️⃣ 帮你分析问题\n3️⃣ 提供相关的基础知识\n4️⃣ 和你一起讨论\n\n告诉我你的具体需求，我来帮你！🌟`,
      `收到！关于"${topic}"：\n\n💡 **我的建议：**\n• 可以尝试用搜索功能获取详细信息\n• 把问题说得更具体，我会给更好的答案\n• 如果你有相关的背景，告诉我会更有帮助\n\n❓ 你最想了解这个话题的哪个方面？我可以帮你聚焦重点！`,
    ];
    
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }

  private handleStatement(input: string): AgentResponse {
    // 先尝试查知识库！即便是陈述式的，也可能能匹配到答案！
    const faqAnswer = this.tryAnswerFAQ(input);
    if (faqAnswer) {
      return { content: faqAnswer };
    }
    
    const topic = this.extractKeyTopic(input);
    const lowerInput = input.toLowerCase();
    
    // 增强：检测不同类型的陈述，给出更有针对性的回应
    
    // 类型1: 表达情感（开心、难过、愤怒等）
    if (/(开心|高兴|兴奋|快乐|愉快|难过|伤心|沮丧|失望|生气|愤怒|烦|讨厌|焦虑|紧张|害怕|恐惧|担忧|担心)/.test(input)) {
      const responses = [
        `我理解你的感受！😊 有时候分享一下心情会让你感觉好些。想和我聊聊吗？`,
        `我能感受到你的情绪！💙 无论是开心还是难过，我都在这里陪你。想说点什么吗？`,
        `听起来你有一些感受！💛 我在认真听。想多聊聊发生了什么吗？`,
        `谢谢你分享你的感受！💜 我理解。需要我帮你分析一下情况吗？`,
      ];
      return { content: responses[Math.floor(Math.random() * responses.length)] };
    }
    
    // 类型2: 表达观点或意见
    if (/(我觉得|我认为|在我看来|我感觉|我想|对我来说|我相信)/.test(input)) {
      const responses = [
        `有意思的观点！🤔 关于"${topic}"，你能多说说你的想法吗？我很想了解更多。`,
        `嗯，我明白你的看法！💡 你提到的这个点很值得讨论。想深入聊聊吗？`,
        `你说得有道理！👍 关于"${topic}"，还有什么其他想法吗？`,
        `感谢分享你的观点！📝 不同的角度总能带来新的启发。想继续讨论吗？`,
      ];
      return { content: responses[Math.floor(Math.random() * responses.length)] };
    }
    
    // 类型3: 分享经历或故事
    if (/(我今天|昨天|前天|刚才|刚刚|之前|曾经|有一次|记得).*(的时候|经历|发生|遇到|看到|听到)/.test(input)) {
      const responses = [
        `听起来这是个有趣的经历！📖 能多告诉我一些细节吗？我很好奇！`,
        `谢谢你和我分享！💕 你提到的这件事听起来很有意思。后来怎么样了？`,
        `哇，这个经历听起来很特别！🌟 你当时有什么感受？`,
        `嗯，我在认真听！👂 这个经历对你有什么影响或启发吗？`,
      ];
      return { content: responses[Math.floor(Math.random() * responses.length)] };
    }
    
    // 类型4: 寻求建议或帮助
    if (/(帮我|建议|给点意见|出出主意|怎么办|该怎么|怎么处理|给点建议)/.test(input)) {
      const responses = [
        `当然可以帮你！💪 关于"${topic}"，你能告诉我更多具体情况吗？\n\n比如：\n• 你的目标是什么？\n• 你遇到了什么困难？\n• 你已经尝试过什么？\n\n这样我可以给更有针对性的建议！`,
        `我很乐意帮忙！🤝 关于"${topic}"，请告诉我：\n\n1️⃣ 具体的情况是怎样的？\n2️⃣ 你想要的结果是什么？\n3️⃣ 有什么限制或约束？\n\n我来帮你分析和建议！`,
        `好的，让我帮你想想！🧠 关于"${topic}"：\n\n💡 建议你先想清楚：\n• 你真正想要的是什么？\n• 有哪些可能的选项？\n• 每个选项的利弊是什么？\n\n告诉我更多信息，我给你具体建议！`,
      ];
      return { content: responses[Math.floor(Math.random() * responses.length)] };
    }
    
    // 类型5: 提问或确认
    if (/(对吗|是吗|是吗|对吧|是不是|有没有|有没有人|谁知道|有没有人知道)/.test(input)) {
      const responses = [
        `关于"${topic}"，这个问题很有意思！🤔\n\n你想让我帮你搜索相关信息吗？或者你想先讨论一下你的想法？`,
        `这是个好问题！❓ 关于"${topic}"：\n\n我建议：\n• 可以说"搜索 ${topic}"获取详细信息\n• 也可以告诉我你已经了解的信息\n• 我们一起讨论和分析！`,
        `嗯，这个问题值得思考！🧭\n\n关于"${topic}"，你已经有什么想法或信息了吗？我可以帮你补充和完善！`,
      ];
      return { content: responses[Math.floor(Math.random() * responses.length)] };
    }
    
    // 通用回应
    const responses = [
      `明白了！关于"${topic}"，有什么我可以帮你的吗？💬`,
      `收到！你说的很有道理。关于"${topic}"，想让我帮你搜索相关信息或者深入讨论吗？🔍`,
      `有意思！听起来"${topic}"这个话题很有趣。想继续聊聊天或者让我帮你做点什么吗？🌟`,
      `好的，我理解了。关于"${topic}"，还有什么想聊的或者需要我帮忙的吗？我随时都在！🤗`,
    ];
    
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }

  private extractKeyTopic(input: string): string {
    // 简单提取问题关键词
    const words = input.replace(/[？?，,.。！!、]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    if (words.length > 3) {
      return words.slice(0, 3).join(' ') + '...';
    }
    return words.join(' ') || '这个话题';
  }

  private handleComplaint(input: string): AgentResponse {
    const responses = [
      '非常抱歉让您感到不满意！请告诉我具体问题，我会尽力改进。',
      '很抱歉听到这个反馈！请详细说明您的问题，我们会重视的。',
      '感谢您的反馈！请告诉我哪里做得不好，我们会努力改进。'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }

  private handleClarification(input: string): AgentResponse {
    const responses = [
      '让我再解释一下！请问哪个部分不清楚呢？',
      '好的，我可以更详细地说明。请问您具体想了解什么？',
      '没问题！请告诉我您哪里没理解，我会重新解释。'
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)] };
  }

  getMemoryStats(userId: string) {
    // 按 userId 隔离：返回用户专属统计，而非全局聚合
    return this.memorySystem.getStatsForUser(userId);
  }

  consolidateMemory(userId: string) {
    this.memorySystem.consolidateForUser(userId);
  }

  registerTool(name: string, description: string, executor: { execute: (toolId: string, parameters: Record<string, any>) => Promise<any> }) {
    // Tool registration is handled differently in the new architecture
    // This is a placeholder for compatibility
  }

  getRAGSystem() {
    return this.ragSystem;
  }

  getFAQStats() {
    return {
      ...this.faqStats,
      cacheSize: this.faqCache.size,
      cacheHitRate: this.faqStats.totalQueries > 0 
        ? (this.faqStats.cacheHits / this.faqStats.totalQueries * 100).toFixed(2) + '%' 
        : '0%'
    };
  }

  getFAQCache() {
    return Array.from(this.faqCache.entries()).map(([key, value]) => ({
      query: key,
      ...value
    }));
  }

  clearFAQCache(): void {
    this.faqCache.clear();
  }

  getRLModule() {
    return this.rlModule;
  }

  /** 执行引擎（仪表盘读取全工具成功率） */
  getExecutionEngine() {
    return this.executionEngine;
  }

  /** 对话质量评估器（仪表盘读取质量统计） */
  getDialogueEvaluator() {
    return this.dialogueEvaluator;
  }

  getEvaluationSystem() {
    return this.evaluationSystem;
  }

  getDataGovernanceSystem() {
    return this.dataGovernanceSystem;
  }

  getMonitoringSystem() {
    return this.monitoringSystem;
  }

  getContinuousIterationSystem() {
    return this.continuousIterationSystem;
  }

  // === 新增模块的getter方法 ===
  getLoggingSystem() { return this.loggingSystem; }
  getSearchEngine() { return this.searchEngine; }
  getTaskScheduler() { return this.taskScheduler; }
  getUserBehaviorAnalysis() { return this.userBehaviorAnalysis; }
  getWorkflowEngine() { return this.workflowEngine; }
  getAnalyticsEngine() { return this.analyticsEngine; }
  getAuditSystem() { return this.auditSystem; }
  getCacheManager() { return this.cacheManager; }
  getConfigManager() { return this.configManager; }
  getNotificationSystem() { return this.notificationSystem; }
  getRateLimiter() { return this.rateLimiter; }
  getContentModeration() { return this.contentModeration; }
  getDataPipelineInstance() { return this.dataPipeline; }
  getFeatureEngineering() { return this.featureEngineering; }
  getModelManagement() { return this.modelManagement; }
  getMessageQueue() { return this.messageQueue; }
  getDistributedLock() { return this.distributedLock; }
  getI18n() { return this.i18n; }
  getApiGateway() { return this.apiGateway; }
  getUserSegmentation() { return this.userSegmentation; }
  getRecommendationEngine() { return this.recommendation; }
  getAnomalyDetector() { return this.anomalyDetector; }
  getCostTracker() { return this.costTracker; }
  getABTesting() { return this.abTesting; }

  getFullSystemStatus() {
    return {
      monitoring: this.monitoringSystem.getFullReport(),
      evaluation: this.evaluationSystem.generateReport(),
      rl: this.rlModule.getTrainingStats(),
      rag: this.ragSystem.getStats(),
      data: this.dataGovernanceSystem.getStats(),
      iteration: this.continuousIterationSystem.getFullReport(),
      // === 新增模块状态 ===
      logging: this.loggingSystem.getStats(),
      scheduler: this.taskScheduler.getStats(),
      userBehavior: this.userBehaviorAnalysis.getOverallStats(),
      audit: this.auditSystem.getSummary(),
      cache: this.cacheManager.getStats(),
      config: { groups: this.configManager.getAllGroups().length },
      notifications: this.notificationSystem.getStats(),
      rateLimit: this.rateLimiter.getStats(),
      moderation: this.contentModeration.getStats(),
      dataPipeline: this.dataPipeline.getStats(),
      models: this.modelManagement.getStats(),
      messageQueue: this.messageQueue.getStats(),
      distributedLock: this.distributedLock.getStats(),
      i18n: this.i18n.getStats(),
      apiGateway: this.apiGateway.getStats(),
      userSegmentation: this.userSegmentation.getStats(),
      recommendation: this.recommendation.getStats(),
      anomalyDetector: this.anomalyDetector.getStats(),
      costTracker: this.costTracker.getStats(),
      abTesting: {
        experiments: this.abTesting.listExperiments().length,
        running: this.abTesting.listExperiments().filter((e) => e.status === 'running').length,
      }
    };
  }

  getSpecialEventSystem() {
    return this.specialEvents;
  }

  getSpecialEventStats() {
    return this.specialEvents.getStats();
  }

  getAllSpecialEvents() {
    return this.specialEvents.getAllEvents();
  }

  getSpecialEventsByCategory(category: string) {
    return this.specialEvents.getEventsByCategory(category as any);
  }

  getSpecialEventsBySeverity(severity: string) {
    return this.specialEvents.getEventsBySeverity(severity as any);
  }

  markEventAsViewed(eventId: string) {
    this.specialEvents.markAsViewed(eventId);
  }

  markEventAsMemorized(eventId: string) {
    this.specialEvents.markAsMemorized(eventId);
  }
}

// ==================== 全局共享单例：普通入口与开发者入口共用此实例 ====================
let sharedAgentInstance: Agent | null = null;

/**
 * 获取全局共享的 Agent 实例（单例模式）。
 * 确保：普通用户入口 (/api/agent) 与 开发者入口 (/api/dev)
 * 共享同一套记忆/会话/监控/RL/RAG 等状态，保证两端数据一致。
 */
export function getSharedAgent(): Agent {
  if (!sharedAgentInstance) {
    sharedAgentInstance = new Agent();
  }
  return sharedAgentInstance;
}

/**
 * 手动设置一个共享的 Agent 实例（测试/重置时使用）。
 */
export function setSharedAgent(agent: Agent): void {
  sharedAgentInstance = agent;
}

export default Agent;
