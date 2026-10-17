// === 对话质量评估相关类型 ===
export interface DialogueQualityScore {
  overall: number;        // 0-10
  relevance: number;      // 相关性
  usefulness: number;     // 有用性
  accuracy: number;       // 准确性
  completeness: number;   // 完整性
  clarity: number;        // 清晰度
  timeliness: number;     // 时效性
  reasoning: string;      // 评分理由
  improvementSuggestions: string[]; // 改进建议
}

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

export interface QualityTrend {
  userId: string;
  period: 'hourly' | 'daily' | 'weekly';
  scores: Array<{ timestamp: Date; score: number }>;
  averageScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

const LOG_PREFIX = '[DialogueEvaluator]';

/**
 * 对话质量评估器 —— 从 Agent.ts 中提取
 * 职责：评估对话质量、分析对话流畅度、追踪质量趋势
 */
export class DialogueEvaluator {
  private qualityHistory = new Map<string, DialogueQualityScore[]>();
  private flowAnalysisHistory = new Map<string, DialogueFlowAnalysis[]>();
  private readonly maxHistoryPerUser = 50;

  /**
   * 评估单轮对话质量
   */
  evaluateDialogueQuality(
    userId: string,
    userInput: string,
    agentResponse: string,
    intent?: string,
    previousTurns?: string[]
  ): DialogueQualityScore {
    const scores: DialogueQualityScore = {
      overall: 0,
      relevance: this.scoreRelevance(userInput, agentResponse, intent),
      usefulness: this.scoreUsefulness(agentResponse),
      accuracy: this.scoreAccuracy(agentResponse),
      completeness: this.scoreCompleteness(userInput, agentResponse),
      clarity: this.scoreClarity(agentResponse),
      timeliness: this.scoreTimeliness(agentResponse),
      reasoning: '',
      improvementSuggestions: []
    };

    // 加权综合评分
    scores.overall = Math.round(
      (scores.relevance * 0.25 +
        scores.usefulness * 0.20 +
        scores.accuracy * 0.25 +
        scores.completeness * 0.15 +
        scores.clarity * 0.10 +
        scores.timeliness * 0.05) * 10
    ) / 10;

    // 生成评分理由和改进建议
    scores.reasoning = this.generateReasoning(scores);
    scores.improvementSuggestions = this.generateSuggestions(scores);

    // 存储质量历史
    this.storeQualityHistory(userId, scores);

    console.log(`${LOG_PREFIX} Quality score for ${userId}: ${scores.overall}/10`);

    return scores;
  }

  // ==================== 评分维度 ====================

  private scoreRelevance(userInput: string, agentResponse: string, intent?: string): number {
    let score = 5; // 基础分

    // 检查响应是否包含用户问题中的关键词
    const inputWords = new Set(
      userInput.toLowerCase()
        .replace(/[，。！？、；：""''（）\s]/g, ' ')
        .split(' ')
        .filter(w => w.length > 1)
    );

    // 按空格切分对中文无效（整句成为单一 token，关键词匹配恒为 0），
    // 补充中文 2-gram 与英文连续字母数字 token，使相关性评分对中文输入生效
    for (const seq of userInput.match(/[\u4e00-\u9fa5]{2,}/g) || []) {
      for (let i = 0; i < seq.length - 1; i++) inputWords.add(seq.slice(i, i + 2));
    }
    for (const w of userInput.toLowerCase().match(/[a-z0-9]+/g) || []) {
      if (w.length > 1) inputWords.add(w);
    }

    const responseLower = agentResponse.toLowerCase();
    let matchCount = 0;
    for (const word of inputWords) {
      if (responseLower.includes(word)) matchCount++;
    }

    const relevanceRatio = inputWords.size > 0 ? matchCount / inputWords.size : 0;
    score += relevanceRatio * 4;

    // 意图匹配加分
    if (intent && responseLower.includes(intent.toLowerCase())) {
      score += 0.5;
    }

    return Math.min(10, Math.max(1, score));
  }

  private scoreUsefulness(agentResponse: string): number {
    let score = 5;

    // 包含具体步骤/列表
    if (/\d+[\.、)]/.test(agentResponse)) score += 1.5;
    // 包含示例
    if (/例如|比如|示例|example|e\.g\./i.test(agentResponse)) score += 1;
    // 包含可操作建议
    if (/建议|推荐|可以|试试|尝试|建议你|recommend/i.test(agentResponse)) score += 1;
    // 长度适中（太长或太短扣分）
    const len = agentResponse.length;
    if (len > 50 && len < 500) score += 1;
    else if (len > 2000) score -= 1;
    else if (len < 20) score -= 0.5;

    return Math.min(10, Math.max(1, score));
  }

  private scoreAccuracy(agentResponse: string): number {
    let score = 7; // 默认基本准确

    // 检测不确定性表达（降低准确度评分）
    const uncertaintyPatterns = [
      /可能|也许|大概|不确定|不太清楚|我不确定/i,
      /might|maybe|perhaps|not sure|uncertain/i,
    ];
    const uncertaintyCount = uncertaintyPatterns.filter(p => p.test(agentResponse)).length;
    score -= uncertaintyCount * 1.5;

    // 检测过于绝对的表达
    const absolutePatterns = [
      /绝对|一定|肯定|必然|毫无疑问/i,
      /absolutely|definitely|certainly|without doubt/i,
    ];
    const absoluteCount = absolutePatterns.filter(p => p.test(agentResponse)).length;
    if (absoluteCount > 2) score -= 1;

    // 包含引用来源加分
    if (/根据|来源|参考|依据|according to|source|reference/i.test(agentResponse)) {
      score += 1;
    }

    return Math.min(10, Math.max(1, score));
  }

  private scoreCompleteness(userInput: string, agentResponse: string): number {
    let score = 6;

    // 问题中有问号，回答需要更完整
    const questionCount = (userInput.match(/[？?]/g) || []).length;
    if (questionCount > 0) {
      // 检查回答是否处理了多个问题
      const responseParts = agentResponse.split(/[。.!！\n]/).filter(p => p.trim().length > 10);
      if (responseParts.length >= questionCount) score += 2;
      else score -= 1;
    }

    // 是否有总结或下一步建议
    if (/总之|总结|综上所述|in summary|to sum up/i.test(agentResponse)) score += 1;
    if (/如果.*可以|需要.*帮助|还需要|还有什么/i.test(agentResponse)) score += 0.5;

    return Math.min(10, Math.max(1, score));
  }

  private scoreClarity(agentResponse: string): number {
    let score = 6;

    // 段落结构（按连续换行符分割）
    const paragraphs = agentResponse.split(/\n{2,}/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 2 && paragraphs.length <= 5) score += 2;
    else if (paragraphs.length > 10) score -= 1;

    // 避免过于专业的术语（常见易懂词汇比例）
    const simpleWordRatio = this.estimateSimpleWordRatio(agentResponse);
    score += simpleWordRatio * 2;

    return Math.min(10, Math.max(1, score));
  }

  private scoreTimeliness(agentResponse: string): number {
    // 包含时间相关信息加分
    const hasTimeInfo = /今天|现在|当前|最新|最近|today|now|current|latest|recent/i.test(agentResponse);
    const hasDateInfo = /\d{4}年|\d{1,2}月|\d{1,2}日|星期/i.test(agentResponse);
    return hasDateInfo ? 9 : hasTimeInfo ? 7 : 5;
  }

  private estimateSimpleWordRatio(text: string): number {
    // 简单估算：排除过长词汇和罕见字符
    const words = text.split(/[\s，。！？、；：""''（）]+/).filter(w => w.length > 0);
    if (words.length === 0) return 0.5;
    const simpleWords = words.filter(w => w.length <= 4);
    return Math.min(1, simpleWords.length / words.length);
  }

  // ==================== 评估报告生成 ====================

  private generateReasoning(scores: DialogueQualityScore): string {
    const parts: string[] = [];
    if (scores.relevance > 7) parts.push('回答与问题相关性高');
    if (scores.relevance < 5) parts.push('回答与问题相关性不足');
    if (scores.usefulness > 7) parts.push('提供了有价值的建议');
    if (scores.accuracy > 8) parts.push('信息准确可靠');
    if (scores.accuracy < 5) parts.push('准确性有待提升');
    if (scores.clarity > 7) parts.push('表达清晰易懂');
    return parts.join('；') || '整体质量一般';
  }

  private generateSuggestions(scores: DialogueQualityScore): string[] {
    const suggestions: string[] = [];
    if (scores.relevance < 6) suggestions.push('更直接地回答用户问题');
    if (scores.usefulness < 6) suggestions.push('提供更具体的步骤或示例');
    if (scores.accuracy < 6) suggestions.push('注明信息来源，减少不确定表达');
    if (scores.completeness < 6) suggestions.push('确保完整回答用户的所有问题');
    if (scores.clarity < 6) suggestions.push('优化段落结构，使用更简单的语言');
    return suggestions;
  }

  // ==================== 对话流畅度分析 ====================

  analyzeDialogueFlow(
    userId: string,
    currentInput: string,
    previousTopic?: string,
    contextConsistencyScore?: number
  ): DialogueFlowAnalysis {
    const previous = this.getRecentFlowAnalysis(userId);

    const topicSwitchDetected = !!previousTopic && this.detectTopicSwitch(previousTopic, currentInput);

    const analysis: DialogueFlowAnalysis = {
      isInterrupted: false,
      topicSwitchDetected,
      topicSwitchReason: topicSwitchDetected ? '检测到话题转换' : undefined,
      previousTopic,
      currentTopic: this.extractCurrentTopic(currentInput),
      contextConsistency: this.determineContextConsistency(contextConsistencyScore),
      contextConsistencyScore: contextConsistencyScore || 5,
      dialoguePhase: this.detectDialoguePhase(currentInput, previous),
      flowCoherenceScore: this.calculateFlowCoherence(currentInput, previous),
      suggestions: [],
      needsRedirection: false,
      recommendedResponseStrategy: 'neutral'
    };

    // 生成流畅度建议
    if (topicSwitchDetected && previous) {
      analysis.suggestions.push('检测到话题转换，建议确认用户意图后再回复');
      analysis.needsRedirection = true;
    }

    if (analysis.flowCoherenceScore < 4) {
      analysis.suggestions.push('对话流畅度较低，建议回顾上文确认理解正确');
    }

    // 推荐响应策略
    if (analysis.dialoguePhase === 'greeting') {
      analysis.recommendedResponseStrategy = 'warm_welcome';
    } else if (analysis.dialoguePhase === 'problem_understanding') {
      analysis.recommendedResponseStrategy = 'clarify_and_confirm';
    } else if (analysis.dialoguePhase === 'solution') {
      analysis.recommendedResponseStrategy = 'detailed_guidance';
    } else if (analysis.dialoguePhase === 'closing') {
      analysis.recommendedResponseStrategy = 'summarize_and_followup';
    } else {
      analysis.recommendedResponseStrategy = 'neutral';
    }

    // 存储
    this.storeFlowAnalysis(userId, analysis);

    return analysis;
  }

  private detectTopicSwitch(previousTopic: string, currentInput: string): boolean {
    const topicPatterns: Record<string, RegExp> = {
      technology: /代码|编程|程序|算法|AI|开发|软件|技术/i,
      business: /商业|市场|营销|销售|客户|产品|公司/i,
      education: /学习|教育|课程|老师|学校|培训|考试/i,
      health: /健康|医疗|疾病|医院|药物|锻炼|饮食/i,
    };

    const currentTopic = Object.entries(topicPatterns).find(([, p]) => p.test(currentInput));
    return !!currentTopic && currentTopic[0] !== previousTopic;
  }

  private extractCurrentTopic(input: string): string | undefined {
    const topics = ['technology', 'business', 'education', 'health', 'entertainment', 'finance', 'travel'];
    for (const topic of topics) {
      if (input.toLowerCase().includes(topic)) return topic;
    }
    return undefined;
  }

  private determineContextConsistency(score?: number): 'high' | 'medium' | 'low' {
    if (!score || score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  private detectDialoguePhase(
    input: string,
    previous?: DialogueFlowAnalysis | null
  ): DialogueFlowAnalysis['dialoguePhase'] {
    if (/^(你好|hi|hello|嗨|早上好|下午好|晚上好)/i.test(input.trim())) return 'greeting';
    if (/^(再见|bye|拜拜|晚安|see you)/i.test(input.trim())) return 'closing';
    if (/(怎么|如何|怎样|为什么|what|how|why)/i.test(input.trim())) return 'problem_understanding';
    if (previous?.dialoguePhase === 'problem_understanding') return 'solution';
    return 'problem_understanding';
  }

  private calculateFlowCoherence(
    currentInput: string,
    previous?: DialogueFlowAnalysis | null
  ): number {
    if (!previous) return 5; // 首轮对话默认5分

    let score = 5;
    if (previous.topicSwitchDetected) score -= 1;
    if (previous.contextConsistency === 'high') score += 1;
    if (previous.contextConsistency === 'low') score -= 2;
    return Math.min(10, Math.max(1, score));
  }

  // ==================== 历史查询 ====================

  getAverageQualityScore(userId: string): DialogueQualityScore | null {
    const history = this.qualityHistory.get(userId);
    if (!history || history.length === 0) return null;

    const count = history.length;
    const average: DialogueQualityScore = {
      overall: 0, relevance: 0, usefulness: 0, accuracy: 0,
      completeness: 0, clarity: 0, timeliness: 0,
      reasoning: '', improvementSuggestions: []
    };

    for (const score of history) {
      average.overall += score.overall;
      average.relevance += score.relevance;
      average.usefulness += score.usefulness;
      average.accuracy += score.accuracy;
      average.completeness += score.completeness;
      average.clarity += score.clarity;
      average.timeliness += score.timeliness;
    }

    average.overall = Math.round((average.overall / count) * 10) / 10;
    average.relevance = Math.round((average.relevance / count) * 10) / 10;
    average.usefulness = Math.round((average.usefulness / count) * 10) / 10;
    average.accuracy = Math.round((average.accuracy / count) * 10) / 10;
    average.completeness = Math.round((average.completeness / count) * 10) / 10;
    average.clarity = Math.round((average.clarity / count) * 10) / 10;
    average.timeliness = Math.round((average.timeliness / count) * 10) / 10;

    return average;
  }

  getRecentFlowAnalysis(userId: string): DialogueFlowAnalysis | null {
    const history = this.flowAnalysisHistory.get(userId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  getQualityTrend(userId: string, period: 'hourly' | 'daily' | 'weekly' = 'daily'): QualityTrend {
    const history = this.qualityHistory.get(userId) || [];
    const now = Date.now();
    const periodMs = { hourly: 3600000, daily: 86400000, weekly: 604800000 }[period];

    const recentScores = history.filter(
      s => now - new Date().getTime() < periodMs // 简化处理
    );

    const scores = recentScores.map((s, i) => ({
      timestamp: new Date(Date.now() - (recentScores.length - i) * 60000),
      score: s.overall
    }));

    const averageScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

    let trend: QualityTrend['trend'] = 'stable';
    if (scores.length >= 3) {
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((s, sc) => s + sc.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, sc) => s + sc.score, 0) / secondHalf.length;
      if (secondAvg > firstAvg + 0.5) trend = 'improving';
      else if (secondAvg < firstAvg - 0.5) trend = 'declining';
    }

    return { userId, period, scores, averageScore, trend };
  }

  // ==================== 内部存储 ====================

  private storeQualityHistory(userId: string, scores: DialogueQualityScore): void {
    let history = this.qualityHistory.get(userId) || [];
    history.push(scores);
    if (history.length > this.maxHistoryPerUser) {
      history = history.slice(-this.maxHistoryPerUser);
    }
    this.qualityHistory.set(userId, history);
  }

  private storeFlowAnalysis(userId: string, analysis: DialogueFlowAnalysis): void {
    let history = this.flowAnalysisHistory.get(userId) || [];
    history.push(analysis);
    if (history.length > this.maxHistoryPerUser) {
      history = history.slice(-this.maxHistoryPerUser);
    }
    this.flowAnalysisHistory.set(userId, history);
  }

  getStats() {
    return {
      usersTracked: this.qualityHistory.size,
      totalEvaluations: Array.from(this.qualityHistory.values()).reduce((s, h) => s + h.length, 0),
      totalFlowAnalyses: Array.from(this.flowAnalysisHistory.values()).reduce((s, h) => s + h.length, 0),
    };
  }
}
