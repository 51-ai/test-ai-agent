// === 用户画像相关类型 ===
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

export interface ProactiveSuggestion {
  topic: string;
  rationale: string;
  priority: number;
  userRelevance: number;
  followUpQuestion: string;
}

export interface EmotionalContext {
  primaryEmotion: 'happy' | 'sad' | 'angry' | 'anxious' | 'confused' | 'neutral' | 'excited' | 'frustrated';
  intensity: number;       // 0-1
  confidence: number;       // 0-1
  emotionKeywords: string[];
  sentimentPolarity: number; // -1 to 1
  recommendedTone: string;
}

export interface ContextWindowConfig {
  maxTurns: number;
  strategy: 'recent' | 'relevant' | 'hybrid';
  relevancyThreshold: number;
  includeSummaries: boolean;
}

const LOG_PREFIX = '[UserProfileManager]';

/**
 * 用户画像管理器 —— 从 Agent.ts 中提取
 * 职责：构建和维护用户画像、管理上下文窗口、生成主动建议、情感分析
 */
export class UserProfileManager {
  private userProfiles = new Map<string, UserProfile>();
  private emotionalContexts = new Map<string, EmotionalContext>();
  private proactiveSuggestions = new Map<string, ProactiveSuggestion[]>();
  private contextConfigs = new Map<string, ContextWindowConfig>();

  private readonly defaultProfile: Omit<UserProfile, 'userId'> = {
    preferredLanguage: 'auto',
    communicationStyle: 'friendly',
    responseLengthPreference: 'medium',
    knowledgeLevel: 'intermediate',
    interestTopics: [],
    emotionalTendency: 'neutral',
    interactionCount: 0,
    avgTurnLength: 0,
    lastActive: new Date(),
    preferredTone: [],
    technicalTopics: [],
    nonTechnicalTopics: [],
    questionPatterns: []
  };

  // 技术关键词库
  private readonly technicalKeywords = new Set([
    'api', 'sdk', 'framework', 'library', 'database', 'algorithm',
    '编程', '代码', '程序', '算法', '接口', '框架', '数据库',
    'docker', 'kubernetes', 'aws', 'azure', 'linux', 'git',
    'react', 'vue', 'angular', 'node', 'python', 'java', 'go', 'rust',
    'sql', 'nosql', 'mongodb', 'redis', 'rest', 'graphql',
    'ai', 'ml', '深度学习', '机器学习', '神经网络', 'transformer',
  ]);

  /**
   * 构建和更新用户画像（基于每次交互）
   */
  buildAndUpdateUserProfile(userId: string, userInput: string, response: string): UserProfile {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      profile = { userId, ...this.defaultProfile, lastActive: new Date() };
    }

    // 更新交互统计
    profile.interactionCount++;
    profile.lastActive = new Date();
    profile.avgTurnLength = Math.round(
      (profile.avgTurnLength * (profile.interactionCount - 1) + userInput.length) / profile.interactionCount
    );

    // 语言检测
    profile.preferredLanguage = this.detectLanguage(userInput);

    // 交流风格识别
    profile.communicationStyle = this.detectCommunicationStyle(userInput, profile.interactionCount);

    // 回复长度偏好
    profile.responseLengthPreference = this.detectResponseLengthPreference(profile);

    // 知识水平评估
    profile.knowledgeLevel = this.assessKnowledgeLevel(userInput, profile.knowledgeLevel);

    // 话题追踪
    const newTopics = this.extractTopics(userInput);
    profile.interestTopics = this.mergeTopics(profile.interestTopics, newTopics);
    profile.technicalTopics = this.mergeTopics(
      profile.technicalTopics,
      newTopics.filter(t => this.technicalKeywords.has(t.toLowerCase()))
    );
    profile.nonTechnicalTopics = this.mergeTopics(
      profile.nonTechnicalTopics,
      newTopics.filter(t => !this.technicalKeywords.has(t.toLowerCase()))
    );

    // 问题模式学习
    if (this.isQuestion(userInput)) {
      const pattern = this.extractQuestionPattern(userInput);
      if (pattern && !profile.questionPatterns.includes(pattern)) {
        profile.questionPatterns.push(pattern);
        if (profile.questionPatterns.length > 50) {
          profile.questionPatterns.shift();
        }
      }
    }

    // 情感倾向更新
    profile.emotionalTendency = this.updateEmotionalTendency(userInput, profile);

    // 偏好语气
    const tones = this.detectPreferredTone(userInput, response);
    profile.preferredTone = this.mergeTopics(profile.preferredTone, tones);

    this.userProfiles.set(userId, profile);
    return profile;
  }

  // ==================== 语言检测 ====================

  private detectLanguage(input: string): UserProfile['preferredLanguage'] {
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(input);
    const hasChinese = /[\u4e00-\u9fff]/.test(input);
    const hasEnglish = /[a-zA-Z]{3,}/.test(input);

    if (hasJapanese) return 'ja';
    if (hasChinese && !hasEnglish) return 'zh';
    if (hasEnglish && !hasChinese) return 'en';
    return 'auto';
  }

  // ==================== 交流风格识别 ====================

  private detectCommunicationStyle(
    input: string,
    interactionCount: number
  ): UserProfile['communicationStyle'] {
    if (interactionCount < 3) return 'friendly'; // 新用户默认友好

    const formalIndicators = [/您好/, /请问/, /麻烦/, /谢谢您/, /贵公司/, /尊敬/];
    const casualIndicators = [/嗨/, /嘿/, /啦/, /吧/, /嘛/, /呀/, /哈哈/, /嘿嘿/];
    const technicalIndicators = [
      /代码/, /api/i, /bug/i, /debug/i, /函数/, /类/, /模块/,
      /config/i, /error/i, /exception/i, /async/i, /await/i,
    ];

    let formalScore = 0, casualScore = 0, technicalScore = 0;

    for (const p of formalIndicators) if (p.test(input)) formalScore++;
    for (const p of casualIndicators) if (p.test(input)) casualScore++;
    for (const p of technicalIndicators) if (p.test(input)) technicalScore++;

    if (technicalScore >= 2) return 'technical';
    if (formalScore > casualScore) return 'formal';
    if (casualScore > formalScore) return 'casual';
    return 'friendly';
  }

  // ==================== 回复长度偏好 ====================

  private detectResponseLengthPreference(
    profile: UserProfile
  ): UserProfile['responseLengthPreference'] {
    if (profile.interactionCount < 5) return 'medium';
    // 基于用户提问长度推断偏好
    if (profile.avgTurnLength > 200) return 'long';
    if (profile.avgTurnLength < 30) return 'short';
    return 'medium';
  }

  // ==================== 知识水平评估 ====================

  private assessKnowledgeLevel(
    input: string,
    current: UserProfile['knowledgeLevel']
  ): UserProfile['knowledgeLevel'] {
    const expertIndicators = [
      /底层|原理|源码|架构|设计模式|优化|性能|并发|分布式/,
      /runtime|compiler|memory|latency|throughput|scalability/i,
    ];
    const beginnerIndicators = [
      /什么是|怎么学|入门|基础|新手|初学者|不会|不懂/,
      /what is|how to|beginner|basic|tutorial|learn/i,
    ];

    let expertScore = 0, beginnerScore = 0;
    for (const p of expertIndicators) if (p.test(input)) expertScore++;
    for (const p of beginnerIndicators) if (p.test(input)) beginnerScore++;

    if (expertScore >= 2) return 'expert';
    if (beginnerScore >= 2) return 'beginner';
    if (current === 'expert' && expertScore >= 1) return 'expert';
    return current;
  }

  // ==================== 话题提取 ====================

  private extractTopics(input: string): string[] {
    const topics: string[] = [];
    const topicPatterns = [
      /(?:关于|讨论|聊|讲)\s*(\S{1,10})/g,
      /([A-Z][a-z]+(?:[A-Z][a-z]+)*)/g, // PascalCase terms
    ];

    for (const pattern of topicPatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const topic = match[1].toLowerCase().trim();
        if (topic.length >= 2 && topic.length <= 20 && !topics.includes(topic)) {
          topics.push(topic);
        }
      }
    }

    return topics.slice(0, 5);
  }

  private mergeTopics(existing: string[], newTopics: string[]): string[] {
    const merged = [...existing];
    for (const topic of newTopics) {
      if (!merged.includes(topic)) {
        merged.push(topic);
      }
    }
    return merged.slice(-30); // 最多保留30个话题
  }

  // ==================== 问题模式识别 ====================

  private isQuestion(input: string): boolean {
    return /[？?]/.test(input) ||
      /^(什么|怎么|如何|为什么|谁|哪|what|how|why|who|where|when)/i.test(input.trim());
  }

  private extractQuestionPattern(input: string): string | null {
    const patterns = [
      { regex: /^(怎么|如何|怎样)\s*(用|做|处理|解决|实现)/, name: 'how_to' },
      { regex: /^(什么|啥)\s*(是|叫|意思)/, name: 'what_is' },
      { regex: /^(为什么|为啥)/, name: 'why' },
      { regex: /^(区别|差异|不同).*(和|与|vs)/, name: 'compare' },
      { regex: /^(推荐|建议).*/, name: 'recommend' },
    ];

    for (const { regex, name } of patterns) {
      if (regex.test(input.trim())) return name;
    }
    return null;
  }

  // ==================== 情感倾向 ====================

  private updateEmotionalTendency(
    input: string,
    profile: UserProfile
  ): UserProfile['emotionalTendency'] {
    const positiveWords = ['谢谢', '好', '棒', '喜欢', '开心', '感谢', '不错', '赞', 'great', 'good', 'thanks', 'love', 'awesome', 'nice'];
    const negativeWords = ['不好', '糟糕', '失望', '生气', '烦', '讨厌', '没用', '差', 'bad', 'terrible', 'hate', 'awful', 'useless'];

    let posCount = 0, negCount = 0;
    for (const w of positiveWords) if (input.includes(w)) posCount++;
    for (const w of negativeWords) if (input.includes(w)) negCount++;

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return profile.emotionalTendency; // 保持之前的状态
  }

  // ==================== 语气偏好 ====================

  private detectPreferredTone(input: string, response: string): string[] {
    const tones: string[] = [];
    if (/谢谢|感谢|请|麻烦|thanks|please/i.test(input)) tones.push('polite');
    if (/哈哈|嘿嘿|😄|😂|好笑|有趣/i.test(input)) tones.push('humorous');
    if (/代码|api|bug|config|error/i.test(input)) tones.push('technical');
    if (/简单|快|直接|short|brief/i.test(input)) tones.push('concise');
    return tones;
  }

  // ==================== 情感上下文分析 ====================

  analyzeEmotionalContext(userId: string, input: string): EmotionalContext {
    const intensity = this.calculateEmotionIntensity(input);
    const primaryEmotion = this.detectPrimaryEmotion(input);
    const polarity = this.calculateSentimentPolarity(input);

    const context: EmotionalContext = {
      primaryEmotion,
      intensity,
      confidence: Math.min(1, 0.5 + intensity * 0.5),
      emotionKeywords: this.extractEmotionKeywords(input),
      sentimentPolarity: polarity,
      recommendedTone: this.recommendTone(primaryEmotion, intensity)
    };

    this.emotionalContexts.set(userId, context);
    return context;
  }

  private calculateEmotionIntensity(input: string): number {
    const strongIndicators = [/!!!|！！|非常|极其|太|超级|非常非常|extremely|very much|absolutely/i];
    const weakIndicators = [/有点|稍微|还行|一般|可能|maybe|slightly|a bit/i];

    let intensity = 0.5; // 默认中等
    for (const p of strongIndicators) if (p.test(input)) intensity += 0.2;
    for (const p of weakIndicators) if (p.test(input)) intensity -= 0.15;

    return Math.min(1, Math.max(0.1, intensity));
  }

  private detectPrimaryEmotion(input: string): EmotionalContext['primaryEmotion'] {
    const emotionMap: Array<{ emotion: EmotionalContext['primaryEmotion']; patterns: RegExp[] }> = [
      { emotion: 'happy', patterns: [/开心|高兴|好棒|太棒了|哈哈|😊|😄|great|awesome|wonderful|love/i] },
      { emotion: 'sad', patterns: [/难过|伤心|失望|可惜|😢|😭|sad|unfortunate|depressing/i] },
      { emotion: 'angry', patterns: [/生气|愤怒|可恶|讨厌|😡|😠|angry|furious|annoying/i] },
      { emotion: 'anxious', patterns: [/担心|焦虑|紧张|害怕|怎么办|😰|worried|anxious|nervous|scared/i] },
      { emotion: 'confused', patterns: [/不懂|不明白|困惑|迷茫|奇怪|confused|puzzled|what do you mean/i] },
      { emotion: 'excited', patterns: [/激动|兴奋|期待|迫不及待|😆|excited|thrilled|can't wait/i] },
      { emotion: 'frustrated', patterns: [/烦|无奈|没办法|又|还是不行|frustrated|stuck|again/i] },
    ];

    for (const { emotion, patterns } of emotionMap) {
      for (const p of patterns) {
        if (p.test(input)) return emotion;
      }
    }
    return 'neutral';
  }

  private calculateSentimentPolarity(input: string): number {
    const positiveWords = /(好|棒|赞|喜欢|开心|感谢|谢谢|不错|优秀|厉害|great|good|love|nice|awesome|excellent|thanks|wonderful)/gi;
    const negativeWords = /(不好|差|坏|讨厌|烦|糟糕|失望|生气|难过|悲哀|bad|terrible|hate|awful|poor|worst|sad)/gi;

    const posMatches = input.match(positiveWords) || [];
    const negMatches = input.match(negativeWords) || [];
    const total = posMatches.length + negMatches.length;
    if (total === 0) return 0;
    return Math.round(((posMatches.length - negMatches.length) / total) * 100) / 100;
  }

  private extractEmotionKeywords(input: string): string[] {
    const emotionWords = [
      '开心', '难过', '生气', '担心', '害怕', '兴奋', '期待', '失望',
      'happy', 'sad', 'angry', 'worried', 'excited', 'disappointed',
    ];
    return emotionWords.filter(w => input.includes(w));
  }

  private recommendTone(
    emotion: EmotionalContext['primaryEmotion'],
    intensity: number
  ): string {
    const toneMap: Record<string, string> = {
      happy: 'enthusiastic',
      sad: 'empathetic',
      angry: 'calm_and_professional',
      anxious: 'reassuring',
      confused: 'patient_and_clear',
      excited: 'matching_enthusiasm',
      frustrated: 'solution_focused',
      neutral: 'friendly',
    };
    const baseTone = toneMap[emotion] || 'friendly';
    if (intensity > 0.8) return `${baseTone}_intense`;
    return baseTone;
  }

  // ==================== 上下文窗口管理 ====================

  smartManageContextWindow(
    userId: string,
    currentInput: string,
    contextWindow: string[],
    maxTurns: number = 10
  ): { updatedWindow: string[]; relevanceScores: number[] } {
    const config = this.contextConfigs.get(userId) || {
      maxTurns,
      strategy: 'hybrid',
      relevancyThreshold: 0.3,
      includeSummaries: true
    };

    // 计算每条上下文与当前输入的相关性
    const relevanceScores = contextWindow.map(ctx => this.calculateRelevance(ctx, currentInput));

    // 混合策略：保留最近的 + 最相关的
    if (config.strategy === 'hybrid') {
      const recent = contextWindow.slice(-Math.floor(config.maxTurns / 2));
      const relevant = contextWindow
        .map((ctx, i) => ({ ctx, score: relevanceScores[i] }))
        .filter(item => item.score >= config.relevancyThreshold && !recent.includes(item.ctx))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(config.maxTurns / 2))
        .map(item => item.ctx);

      return {
        updatedWindow: [...relevant, ...recent].slice(-config.maxTurns),
        relevanceScores
      };
    }

    // 最近策略
    if (config.strategy === 'recent') {
      return {
        updatedWindow: contextWindow.slice(-config.maxTurns),
        relevanceScores
      };
    }

    // 相关性策略
    return {
      updatedWindow: contextWindow
        .map((ctx, i) => ({ ctx, score: relevanceScores[i] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, config.maxTurns)
        .map(item => item.ctx),
      relevanceScores
    };
  }

  private calculateRelevance(contextText: string, currentInput: string): number {
    const ctxLower = contextText.toLowerCase();
    const inputLower = currentInput.toLowerCase();
    const inputWords = inputLower.split(/[\s，。！？、；：""''（）]+/).filter(w => w.length > 0);

    if (inputWords.length === 0) return 0;

    let matchCount = 0;
    for (const word of inputWords) {
      if (ctxLower.includes(word)) matchCount++;
    }

    return matchCount / inputWords.length;
  }

  getContextConfig(userId: string): ContextWindowConfig {
    return this.contextConfigs.get(userId) || {
      maxTurns: 10,
      strategy: 'hybrid',
      relevancyThreshold: 0.3,
      includeSummaries: true
    };
  }

  setContextConfig(userId: string, config: Partial<ContextWindowConfig>): void {
    const current = this.getContextConfig(userId);
    this.contextConfigs.set(userId, { ...current, ...config });
  }

  // ==================== 主动建议 ====================

  generateProactiveSuggestions(userId: string, currentTopic?: string): ProactiveSuggestion[] {
    const profile = this.userProfiles.get(userId);
    if (!profile) return [];

    const suggestions: ProactiveSuggestion[] = [];

    // 基于兴趣话题
    for (const topic of profile.interestTopics.slice(-5)) {
      if (currentTopic !== topic) {
        suggestions.push({
          topic,
          rationale: `根据您的兴趣 "${topic}"`,
          priority: 5,
          userRelevance: 0.7,
          followUpQuestion: `您想了解更多关于${topic}的内容吗？`
        });
      }
    }

    // 基于知识水平推荐学习内容
    if (profile.knowledgeLevel === 'beginner' && profile.technicalTopics.length > 0) {
      const topic = profile.technicalTopics[profile.technicalTopics.length - 1];
      suggestions.push({
        topic: `${topic} 入门教程`,
        rationale: '根据您的学习进度',
        priority: 8,
        userRelevance: 0.9,
        followUpQuestion: `需要我为您推荐${topic}的学习资源吗？`
      });
    }

    // 基于常见问题模式
    if (profile.questionPatterns.includes('how_to')) {
      suggestions.push({
        topic: '效率工具推荐',
        rationale: '您经常询问操作方法',
        priority: 3,
        userRelevance: 0.5,
        followUpQuestion: '想知道有哪些提升效率的工具吗？'
      });
    }

    // 按优先级排序
    const sorted = suggestions.sort((a, b) => b.priority - a.priority).slice(0, 3);
    this.proactiveSuggestions.set(userId, sorted);
    return sorted;
  }

  // ==================== 查询接口 ====================

  getUserProfile(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  getEmotionalContext(userId: string): EmotionalContext | undefined {
    return this.emotionalContexts.get(userId);
  }

  getProactiveSuggestions(userId: string): ProactiveSuggestion[] {
    return this.proactiveSuggestions.get(userId) || [];
  }

  // ==================== 统计 ====================

  getStats() {
    const profiles = Array.from(this.userProfiles.values());
    return {
      totalProfiles: profiles.length,
      languageDistribution: {
        zh: profiles.filter(p => p.preferredLanguage === 'zh').length,
        en: profiles.filter(p => p.preferredLanguage === 'en').length,
        ja: profiles.filter(p => p.preferredLanguage === 'ja').length,
        auto: profiles.filter(p => p.preferredLanguage === 'auto').length,
      },
      avgInteractionsPerUser: profiles.length > 0
        ? Math.round(profiles.reduce((s, p) => s + p.interactionCount, 0) / profiles.length)
        : 0,
      emotionalDistribution: {
        positive: profiles.filter(p => p.emotionalTendency === 'positive').length,
        neutral: profiles.filter(p => p.emotionalTendency === 'neutral').length,
        negative: profiles.filter(p => p.emotionalTendency === 'negative').length,
      }
    };
  }
}
