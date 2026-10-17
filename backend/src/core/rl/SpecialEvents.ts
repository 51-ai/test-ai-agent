import { v4 as uuidv4 } from 'uuid';

/**
 * PPO强化学习特殊事件系统
 * 用于在Agent遇到特定情况时触发并记录重要事件，可存储于记忆系统
 */

export type SpecialEventCategory = 
  | 'success'           // 成功事件
  | 'failure'           // 失败事件
  | 'warning'           // 警告事件
  | 'learning'          // 学习事件
  | 'milestone'         // 里程碑事件
  | 'correction'        // 纠正事件
  | 'discovery'         // 发现事件
  | 'difficulty'        // 困难事件
  | 'breakthrough'      // 突破事件
  | 'pattern';          // 模式识别事件

export type SpecialEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SpecialEvent {
  id: string;
  category: SpecialEventCategory;
  severity: SpecialEventSeverity;
  title: string;
  description: string;
  context: {
    state?: any;
    action?: string;
    result?: any;
    error?: string;
    metrics?: Record<string, number>;
  };
  timestamp: Date;
  episodeId?: string;
  stepNumber?: number;
  reward?: number;
  actionable: boolean;
  suggestedAction?: string;
  tags: string[];
  viewed: boolean;
  memorized: boolean;
}

export interface SpecialEventConfig {
  enableAutoMemory: boolean;
  maxEventsPerEpisode: number;
  minSeverityForMemory: SpecialEventSeverity;
  deduplicationWindow: number;
}

export const defaultSpecialEventConfig: SpecialEventConfig = {
  enableAutoMemory: true,
  maxEventsPerEpisode: 50,
  minSeverityForMemory: 'medium',
  deduplicationWindow: 30000
};

/**
 * 预定义的特殊事件模板
 */
export const SPECIAL_EVENT_TEMPLATES = {
  // ========== 成功事件 ==========
  TASK_COMPLETED: {
    category: 'success' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '任务成功完成',
    description: 'Agent成功完成了用户请求的任务',
    actionable: false,
    tags: ['task', 'success', 'completion']
  },
  
  TOOL_EXECUTION_SUCCESS: {
    category: 'success' as SpecialEventCategory,
    severity: 'low' as SpecialEventSeverity,
    title: '工具执行成功',
    description: '工具{toolName}执行成功',
    actionable: false,
    tags: ['tool', 'execution', 'success']
  },
  
  FIRST_SUCCESSFUL_ATTEMPT: {
    category: 'success' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '首次成功',
    description: '在多次尝试后首次成功完成任务',
    actionable: true,
    tags: ['milestone', 'first-time', 'breakthrough']
  },
  
  IMPROVED_SUCCESS_RATE: {
    category: 'success' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '成功率提升',
    description: '任务成功率比上次提升{percentage}%',
    actionable: true,
    suggestedAction: '继续保持当前策略',
    tags: ['improvement', 'success-rate', 'progress']
  },
  
  QUICK_RESOLUTION: {
    category: 'success' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '快速解决',
    description: '在{turns}轮对话内快速解决了问题',
    actionable: false,
    tags: ['efficiency', 'speed', 'resolution']
  },
  
  USER_EXPRESSION_OF_SATISFACTION: {
    category: 'success' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '用户满意度提升',
    description: '用户表达了明确的正面反馈',
    actionable: true,
    tags: ['user-feedback', 'satisfaction', 'positive']
  },
  
  // ========== 失败事件 ==========
  TASK_FAILED: {
    category: 'failure' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '任务失败',
    description: 'Agent未能完成用户请求的任务',
    actionable: true,
    suggestedAction: '分析失败原因，考虑使用不同方法',
    tags: ['task', 'failure', 'problem']
  },
  
  TOOL_EXECUTION_FAILED: {
    category: 'failure' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '工具执行失败',
    description: '工具{toolName}执行失败: {error}',
    actionable: true,
    suggestedAction: '检查工具参数或尝试替代工具',
    tags: ['tool', 'execution', 'failure', 'error']
  },
  
  MAX_RETRIES_EXCEEDED: {
    category: 'failure' as SpecialEventCategory,
    severity: 'critical' as SpecialEventSeverity,
    title: '超过最大重试次数',
    description: '在{attempts}次尝试后仍未成功',
    actionable: true,
    suggestedAction: '重新评估策略，可能需要人工介入',
    tags: ['retries', 'failure', 'critical']
  },
  
  DEAD_END_CONVERSATION: {
    category: 'failure' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '对话陷入僵局',
    description: '对话循环无法继续推进',
    actionable: true,
    suggestedAction: '尝试总结当前进展并请求用户澄清',
    tags: ['conversation', 'dead-end', 'loop']
  },
  
  REPEATED_MISTAKE: {
    category: 'failure' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '重复犯错',
    description: 'Agent在之前犯过的错误上再次失败',
    actionable: true,
    suggestedAction: '回顾记忆系统中的类似案例',
    tags: ['mistake', 'repetition', 'learning']
  },
  
  CONSISTENT_FAILURE: {
    category: 'failure' as SpecialEventCategory,
    severity: 'critical' as SpecialEventSeverity,
    title: '连续失败',
    description: '连续{failures}次任务失败',
    actionable: true,
    suggestedAction: '暂停并分析失败模式，可能需要调整整体策略',
    tags: ['failure', 'consecutive', 'critical']
  },
  
  // ========== 警告事件 ==========
  LOW_CONFIDENCE: {
    category: 'warning' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '低置信度',
    description: 'Agent对当前响应的置信度较低({confidence})',
    actionable: true,
    suggestedAction: '考虑请求用户反馈或提供多个选项',
    tags: ['confidence', 'uncertainty', 'warning']
  },
  
  RESPONSE_LATENCY_HIGH: {
    category: 'warning' as SpecialEventCategory,
    severity: 'low' as SpecialEventSeverity,
    title: '响应延迟过高',
    description: '响应时间{latency}ms超过预期',
    actionable: false,
    tags: ['performance', 'latency', 'warning']
  },
  
  CONTEXT_OVERFLOW_RISK: {
    category: 'warning' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '上下文溢出风险',
    description: '对话历史长度即将超出限制',
    actionable: true,
    suggestedAction: '建议进行对话摘要',
    tags: ['context', 'overflow', 'memory']
  },
  
  TOOL_PARAMETER_UNCERTAINTY: {
    category: 'warning' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '工具参数不确定',
    description: '对工具{toolName}的参数不够确定',
    actionable: true,
    suggestedAction: '查阅工具使用说明或请求用户确认',
    tags: ['tool', 'parameters', 'uncertainty']
  },
  
  AMBIGUOUS_USER_INPUT: {
    category: 'warning' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '用户输入歧义',
    description: '用户输入存在多种可能的解释',
    actionable: true,
    suggestedAction: '请求用户澄清或提供多种解释选项',
    tags: ['ambiguity', 'clarification', 'user-input']
  },
  
  // ========== 学习事件 ==========
  NEW_PATTERN_RECOGNIZED: {
    category: 'learning' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '识别到新模式',
    description: '在用户行为中发现新的模式: {pattern}',
    actionable: true,
    suggestedAction: '记录此模式供后续参考',
    tags: ['pattern', 'recognition', 'learning']
  },
  
  SUCCESSFUL_STRATEGY: {
    category: 'learning' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '发现有效策略',
    description: '某种策略在当前场景下效果良好',
    actionable: true,
    suggestedAction: '记录此策略并尝试泛化到其他场景',
    tags: ['strategy', 'success', 'learning']
  },
  
  ADAPTATION_SUCCESS: {
    category: 'learning' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '适应成功',
    description: 'Agent成功适应了新的用户偏好或场景',
    actionable: true,
    tags: ['adaptation', 'learning', 'success']
  },
  
  NEGATIVE_PATTERN_DETECTED: {
    category: 'learning' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '发现负面模式',
    description: '识别出一个需要避免的行为模式',
    actionable: true,
    suggestedAction: '记录并确保在类似场景中避免',
    tags: ['pattern', 'negative', 'avoid']
  },
  
  // ========== 里程碑事件 ==========
  EPISODE_MILESTONE: {
    category: 'milestone' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '训练里程碑',
    description: '完成第{episode}个训练回合',
    actionable: false,
    tags: ['milestone', 'training', 'episode']
  },
  
  SUCCESS_RATE_MILESTONE: {
    category: 'milestone' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '成功率里程碑',
    description: '成功率首次达到{rate}%',
    actionable: true,
    tags: ['milestone', 'success-rate', 'achievement']
  },
  
  LEARNING_PLATEAU_BROKEN: {
    category: 'milestone' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '突破学习高原',
    description: '成功突破了持续{plateauTurns}轮的学习高原期',
    actionable: true,
    tags: ['milestone', 'plateau', 'breakthrough']
  },
  
  // ========== 纠正事件 ==========
  HALLUCINATION_CORRECTED: {
    category: 'correction' as SpecialEventCategory,
    severity: 'critical' as SpecialEventSeverity,
    title: '幻觉被纠正',
    description: 'Agent的幻觉信息被用户或系统纠正',
    actionable: true,
    suggestedAction: '更新知识库并记录正确信息',
    tags: ['hallucination', 'correction', 'error']
  },
  
  INCORRECT_TOOL_CORRECTED: {
    category: 'correction' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '错误工具选择被纠正',
    description: 'Agent选择了错误的工具被纠正',
    actionable: true,
    suggestedAction: '学习正确的工具选择策略',
    tags: ['tool', 'correction', 'learning']
  },
  
  WRONG_INTENT_CORRECTED: {
    category: 'correction' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '错误意图识别被纠正',
    description: 'Agent对用户意图的理解被用户纠正',
    actionable: true,
    suggestedAction: '改进意图识别策略',
    tags: ['intent', 'correction', 'understanding']
  },
  
  FACTUAL_ERROR_CORRECTED: {
    category: 'correction' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '事实错误被纠正',
    description: 'Agent提供了错误的事实信息被纠正',
    actionable: true,
    suggestedAction: '更新对应知识点的记忆',
    tags: ['factual', 'error', 'correction']
  },
  
  // ========== 发现事件 ==========
  USER_PREFERENCE_DISCOVERED: {
    category: 'discovery' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '发现用户偏好',
    description: '发现用户偏好: {preference}',
    actionable: true,
    suggestedAction: '记住此偏好以优化未来响应',
    tags: ['user', 'preference', 'discovery']
  },
  
  DOMAIN_KNOWLEDGE_GAP: {
    category: 'discovery' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '发现知识盲区',
    description: 'Agent在领域{domain}存在知识盲区',
    actionable: true,
    suggestedAction: '建议补充该领域的训练数据',
    tags: ['knowledge', 'gap', 'domain']
  },
  
  TOOL_CAPABILITY_DISCOVERED: {
    category: 'discovery' as SpecialEventCategory,
    severity: 'low' as SpecialEventSeverity,
    title: '发现工具新用法',
    description: '发现工具{toolName}的新用法',
    actionable: true,
    tags: ['tool', 'capability', 'discovery']
  },
  
  CONVERSATION_CONTEXT_DISCOVERED: {
    category: 'discovery' as SpecialEventCategory,
    severity: 'low' as SpecialEventSeverity,
    title: '发现对话隐含上下文',
    description: '从对话中发现用户的隐含需求',
    actionable: true,
    tags: ['context', 'implicit', 'discovery']
  },
  
  // ========== 困难事件 ==========
  COMPLEX_TASK_ENCOUNTERED: {
    category: 'difficulty' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '遇到复杂任务',
    description: '当前任务复杂度超出预期',
    actionable: true,
    suggestedAction: '拆分为子任务逐步解决',
    tags: ['complexity', 'difficulty', 'task']
  },
  
  NO_VALID_TOOL_FOUND: {
    category: 'difficulty' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '找不到合适工具',
    description: '没有工具能直接解决当前问题',
    actionable: true,
    suggestedAction: '尝试组合多个工具或使用基础响应',
    tags: ['tool', 'missing', 'difficulty']
  },
  
  CONFLICTING_INFORMATION: {
    category: 'difficulty' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '信息冲突',
    description: '遇到相互矛盾的信息源',
    actionable: true,
    suggestedAction: '标记为不确定，请求用户指引',
    tags: ['conflict', 'information', 'difficulty']
  },
  
  EXTERNAL_DEPENDENCY_FAILURE: {
    category: 'difficulty' as SpecialEventCategory,
    severity: 'critical' as SpecialEventSeverity,
    title: '外部依赖失败',
    description: '外部服务{dependency}不可用',
    actionable: true,
    suggestedAction: '实现降级策略或通知用户',
    tags: ['external', 'dependency', 'failure']
  },
  
  // ========== 突破事件 ==========
  MAJOR_BREAKTHROUGH: {
    category: 'breakthrough' as SpecialEventCategory,
    severity: 'critical' as SpecialEventSeverity,
    title: '重大突破',
    description: '在某方面取得重大进展: {description}',
    actionable: false,
    tags: ['breakthrough', 'major', 'achievement']
  },
  
  NEW_CAPABILITY_LEARNED: {
    category: 'breakthrough' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '习得新能力',
    description: 'Agent学会了处理: {capability}',
    actionable: true,
    tags: ['capability', 'new', 'learning']
  },
  
  UNSOLVABLE_BECOMES_SOLVABLE: {
    category: 'breakthrough' as SpecialEventCategory,
    severity: 'critical' as SpecialEventSeverity,
    title: '难题被解决',
    description: '之前无法解决的问题现在可以解决了',
    actionable: true,
    tags: ['problem', 'solved', 'breakthrough']
  },
  
  // ========== 模式事件 ==========
  USER_BEHAVIOR_PATTERN: {
    category: 'pattern' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '用户行为模式',
    description: '识别出用户行为模式: {pattern}',
    actionable: true,
    tags: ['pattern', 'user', 'behavior']
  },
  
  CONVERSATION_FLOW_PATTERN: {
    category: 'pattern' as SpecialEventCategory,
    severity: 'low' as SpecialEventSeverity,
    title: '对话流程模式',
    description: '识别出对话流程模式',
    actionable: false,
    tags: ['pattern', 'conversation', 'flow']
  },
  
  TOOL_USAGE_PATTERN: {
    category: 'pattern' as SpecialEventCategory,
    severity: 'medium' as SpecialEventSeverity,
    title: '工具使用模式',
    description: '识别出有效的工具使用组合模式',
    actionable: true,
    suggestedAction: '记录并推广此工具使用策略',
    tags: ['pattern', 'tool', 'usage']
  },
  
  ERROR_RECOVERY_PATTERN: {
    category: 'pattern' as SpecialEventCategory,
    severity: 'high' as SpecialEventSeverity,
    title: '错误恢复模式',
    description: '发现有效的错误恢复模式',
    actionable: true,
    suggestedAction: '将此模式记录为标准恢复流程',
    tags: ['pattern', 'error', 'recovery']
  }
} as const;

/**
 * 特殊事件系统类
 */
export class SpecialEventSystem {
  private events: Map<string, SpecialEvent> = new Map();
  private config: SpecialEventConfig;
  private episodeEvents: Map<string, SpecialEvent[]> = new Map();
  private recentEventHashes: Map<string, number> = new Map();
  private memoryIntegrationCallback?: (event: SpecialEvent) => void;

  constructor(config: Partial<SpecialEventConfig> = {}) {
    this.config = { ...defaultSpecialEventConfig, ...config };
  }

  /**
   * 设置记忆系统集成回调
   */
  setMemoryIntegration(callback: (event: SpecialEvent) => void): void {
    this.memoryIntegrationCallback = callback;
  }

  /**
   * 触发特殊事件
   */
  trigger(
    templateKey: keyof typeof SPECIAL_EVENT_TEMPLATES,
    context: SpecialEvent['context'],
    options?: {
      episodeId?: string;
      stepNumber?: number;
      reward?: number;
      customValues?: Record<string, string | number>;
    }
  ): SpecialEvent {
    const template = SPECIAL_EVENT_TEMPLATES[templateKey];
    
    let title = template.title as string;
    let description = template.description as string;
    
    // 替换模板变量
    if (options?.customValues) {
      for (const [key, value] of Object.entries(options.customValues)) {
        title = title.replace(`{${key}}`, String(value));
        description = description.replace(`{${key}}`, String(value));
      }
    }
    
    const event: SpecialEvent = {
      id: uuidv4(),
      category: template.category,
      severity: template.severity,
      title,
      description,
      context,
      timestamp: new Date(),
      episodeId: options?.episodeId,
      stepNumber: options?.stepNumber,
      reward: options?.reward,
      actionable: template.actionable,
      suggestedAction: (template as any).suggestedAction,
      tags: [...(template.tags as unknown as string[])],
      viewed: false,
      memorized: false
    };

    // 检查去重
    if (this.shouldDeduplicate(event)) {
      return event;
    }

    // 存储事件
    this.events.set(event.id, event);
    
    // 按episode存储
    if (event.episodeId) {
      const episodeEvents = this.episodeEvents.get(event.episodeId) || [];
      episodeEvents.push(event);
      
      // 限制每个episode的事件数量
      if (episodeEvents.length > this.config.maxEventsPerEpisode) {
        episodeEvents.shift();
      }
      
      this.episodeEvents.set(event.episodeId, episodeEvents);
    }

    // 自动记忆
    if (this.config.enableAutoMemory && this.shouldMemorialize(event)) {
      this.memorizeEvent(event);
    }

    return event;
  }

  /**
   * 检查是否应该去重
   */
  private shouldDeduplicate(event: SpecialEvent): boolean {
    const hash = this.generateEventHash(event);
    const lastTime = this.recentEventHashes.get(hash);
    
    if (lastTime && Date.now() - lastTime < this.config.deduplicationWindow) {
      return true;
    }
    
    this.recentEventHashes.set(hash, Date.now());
    return false;
  }

  /**
   * 生成事件哈希
   */
  private generateEventHash(event: SpecialEvent): string {
    return `${event.category}:${event.title}:${event.context.action || ''}`;
  }

  /**
   * 检查是否应该记忆
   */
  private shouldMemorialize(event: SpecialEvent): boolean {
    const severityOrder: SpecialEventSeverity[] = ['low', 'medium', 'high', 'critical'];
    const eventSeverityIndex = severityOrder.indexOf(event.severity);
    const minSeverityIndex = severityOrder.indexOf(this.config.minSeverityForMemory);
    
    return eventSeverityIndex >= minSeverityIndex;
  }

  /**
   * 记忆事件
   */
  private memorizeEvent(event: SpecialEvent): void {
    event.memorized = true;
    
    if (this.memoryIntegrationCallback) {
      this.memoryIntegrationCallback(event);
    }
  }

  /**
   * 获取事件
   */
  getEvent(id: string): SpecialEvent | undefined {
    return this.events.get(id);
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): SpecialEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * 获取按类别过滤的事件
   */
  getEventsByCategory(category: SpecialEventCategory): SpecialEvent[] {
    return this.getAllEvents().filter(e => e.category === category);
  }

  /**
   * 获取按严重性过滤的事件
   */
  getEventsBySeverity(severity: SpecialEventSeverity): SpecialEvent[] {
    return this.getAllEvents().filter(e => e.severity === severity);
  }

  /**
   * 获取未查看的事件
   */
  getUnviewedEvents(): SpecialEvent[] {
    return this.getAllEvents().filter(e => !e.viewed);
  }

  /**
   * 获取未记忆的事件
   */
  getUnmemorizedEvents(): SpecialEvent[] {
    return this.getAllEvents().filter(e => !e.memorized);
  }

  /**
   * 获取可操作的事件
   */
  getActionableEvents(): SpecialEvent[] {
    return this.getAllEvents().filter(e => e.actionable);
  }

  /**
   * 获取特定episode的事件
   */
  getEpisodeEvents(episodeId: string): SpecialEvent[] {
    return this.episodeEvents.get(episodeId) || [];
  }

  /**
   * 标记事件为已查看
   */
  markAsViewed(eventId: string): void {
    const event = this.events.get(eventId);
    if (event) {
      event.viewed = true;
    }
  }

  /**
   * 标记事件为已记忆
   */
  markAsMemorized(eventId: string): void {
    const event = this.events.get(eventId);
    if (event) {
      this.memorizeEvent(event);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byCategory: Record<SpecialEventCategory, number>;
    bySeverity: Record<SpecialEventSeverity, number>;
    unviewed: number;
    unmemorized: number;
    actionable: number;
  } {
    const events = this.getAllEvents();
    
    const byCategory: Record<SpecialEventCategory, number> = {
      success: 0,
      failure: 0,
      warning: 0,
      learning: 0,
      milestone: 0,
      correction: 0,
      discovery: 0,
      difficulty: 0,
      breakthrough: 0,
      pattern: 0
    };
    
    const bySeverity: Record<SpecialEventSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    for (const event of events) {
      byCategory[event.category]++;
      bySeverity[event.severity]++;
    }
    
    return {
      total: events.length,
      byCategory,
      bySeverity,
      unviewed: this.getUnviewedEvents().length,
      unmemorized: this.getUnmemorizedEvents().length,
      actionable: this.getActionableEvents().length
    };
  }

  /**
   * 清除旧事件
   */
  clearOldEvents(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    let cleared = 0;
    
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp.getTime() < cutoff) {
        this.events.delete(id);
        cleared++;
      }
    }
    
    return cleared;
  }

  /**
   * 清除episode事件
   */
  clearEpisodeEvents(episodeId: string): void {
    this.episodeEvents.delete(episodeId);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SpecialEventConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 导出事件为记忆格式
   */
  exportAsMemoryEntries(): Array<{
    content: string;
    type: 'short' | 'long';
    metadata: Record<string, unknown>;
  }> {
    const entries: Array<{
      content: string;
      type: 'short' | 'long';
      metadata: Record<string, unknown>;
    }> = [];
    
    for (const event of this.getAllEvents()) {
      if (event.memorized) {
        const memoryType: 'short' | 'long' = 
          event.severity === 'critical' || event.severity === 'high' ? 'long' : 'short';
        
        entries.push({
          content: `[${event.category.toUpperCase()}] ${event.title}: ${event.description}${event.suggestedAction ? ` 建议: ${event.suggestedAction}` : ''}`,
          type: memoryType,
          metadata: {
            eventId: event.id,
            severity: event.severity,
            tags: event.tags,
            timestamp: event.timestamp.toISOString()
          }
        });
      }
    }
    
    return entries;
  }
}

// 导出单例实例
export const specialEventSystem = new SpecialEventSystem();
