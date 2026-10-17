/**
 * 用户模拟器 - 模拟不同类型的用户行为
 */

import { SimulatedUser, UserProfile, UserBehavior, Scenario } from './types';

export class UserSimulator {
  private conversationHistory: Map<string, ConversationContext>;
  private responsePatterns: Map<string, ResponsePattern[]>;

  constructor() {
    this.conversationHistory = new Map();
    this.responsePatterns = new Map();
    this.initializeResponsePatterns();
  }

  /**
   * 初始化响应模式库
   */
  private initializeResponsePatterns(): void {
    // 问候语模式
    this.responsePatterns.set('greeting', [
      { pattern: /你好|您好|hi|hello|嗨/i, response: '你好！', nextExpected: 'question' },
      { pattern: /.*/, response: '早上好！', nextExpected: 'question' }
    ]);

    // 问题类型模式
    this.responsePatterns.set('question', [
      { pattern: /怎么|如何|what.*how/i, response: '这个怎么做？', category: 'how-to' },
      { pattern: /为什么|why/i, response: '为什么会这样？', category: 'why' },
      { pattern: /是什么|what.*is/i, response: '这是什么？', category: 'definition' },
      { pattern: /.*/, response: '我有个问题想请教', category: 'general' }
    ]);

    // 工具使用反馈
    this.responsePatterns.set('tool_feedback', [
      { pattern: /很好|不错|great|good/i, response: '很好，继续！', sentiment: 'positive' },
      { pattern: /不对|错误|wrong/i, response: '这个不对，请重新试试', sentiment: 'negative' },
      { pattern: /.*/, response: '我理解了', sentiment: 'neutral' }
    ]);

    // 结束语模式
    this.responsePatterns.set('closing', [
      { pattern: /谢谢|thanks|thank.*you/i, response: '不客气！', sentiment: 'positive' },
      { pattern: /.*/, response: '好的，明白了！', sentiment: 'positive' }
    ]);
  }

  /**
   * 模拟用户消息
   */
  simulateUserMessage(
    user: SimulatedUser,
    scenario: Scenario,
    agentResponse: string,
    turnNumber: number
  ): { message: string; sentiment: number; intent: string } {
    const context = this.getOrCreateContext(user.id);

    // 更新上下文
    context.conversationHistory.push({
      turnNumber,
      agentResponse,
      timestamp: new Date()
    });

    // 根据场景和上下文生成响应
    const message = this.generateMessage(user, scenario, context, turnNumber);
    const sentiment = this.evaluateSentiment(user, message);
    const intent = this.detectIntent(message);

    return { message, sentiment, intent };
  }

  /**
   * 生成用户消息
   */
  private generateMessage(
    user: SimulatedUser,
    scenario: Scenario,
    context: ConversationContext,
    turnNumber: number
  ): string {
    // 第一轮通常是问候或介绍问题
    if (turnNumber === 1) {
      return this.generateOpeningMessage(user, scenario);
    }

    // 根据场景类型生成消息
    switch (scenario.category) {
      case 'conversation':
        return this.generateConversationMessage(user, context);
      case 'question_answering':
        return this.generateQuestionMessage(user, context);
      case 'tool_usage':
        return this.generateToolFeedbackMessage(user, context);
      case 'problem_solving':
        return this.generateProblemSolvingMessage(user, context);
      case 'creativity':
        return this.generateCreativeMessage(user, context);
      case 'technical':
        return this.generateTechnicalMessage(user, context);
      case 'multi_turn':
        return this.generateMultiTurnMessage(user, context);
      default:
        return this.generateGenericMessage(user);
    }
  }

  /**
   * 生成开场消息
   */
  private generateOpeningMessage(user: SimulatedUser, scenario: Scenario): string {
    const profile = user.profile;
    const behavior = user.behavior;

    // 根据专业知识水平调整问题复杂度
    const complexity = profile.expertise === 'expert' ? '高级' :
                      profile.expertise === 'intermediate' ? '中级' : '基础';

    const openings = [
      `你好，我想了解一下${scenario.name}相关的内容。`,
      `您好，请问可以帮助我解决一个问题吗？`,
      `嗨，我需要一些帮助。`,
      `你好，我正在学习${scenario.category}相关的内容，遇到了一些困难。`
    ];

    const baseMessage = openings[Math.floor(Math.random() * openings.length)];

    // 根据性格调整语气
    if (profile.personality === 'friendly') {
      return `${baseMessage} 非常感谢！`;
    } else if (profile.personality === 'aggressive') {
      return `${baseMessage} 快点帮我解决！`;
    }

    return baseMessage;
  }

  /**
   * 生成对话消息
   */
  private generateConversationMessage(user: SimulatedUser, context: ConversationContext): string {
    const responses = [
      '继续说说看？',
      '还有其他建议吗？',
      '我明白了',
      '这个思路不错',
      '能具体解释一下吗？',
      '好的，继续'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成问题消息
   */
  private generateQuestionMessage(user: SimulatedUser, context: ConversationContext): string {
    const responses = [
      '能更详细地解释一下吗？',
      '有没有其他方法？',
      '能举个例子吗？',
      '这个答案对吗？',
      '我还有些不明白',
      '能总结一下重点吗？'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成工具使用反馈
   */
  private generateToolFeedbackMessage(user: SimulatedUser, context: ConversationContext): string {
    const responses = [
      '执行成功了吗？',
      '结果正确吗？',
      '还有其他工具可以用吗？',
      '能优化一下代码吗？',
      '这个工具很好用',
      '请检查一下结果'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成问题解决消息
   */
  private generateProblemSolvingMessage(user: SimulatedUser, context: ConversationContext): string {
    const responses = [
      '还有其他可能的解决方案吗？',
      '这个方案的风险是什么？',
      '需要多长时间能完成？',
      '能否一步步演示？',
      '这个方法可行吗？',
      '还有其他考虑因素吗？'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成创意消息
   */
  private generateCreativeMessage(user: SimulatedUser, context: ConversationContext): string {
    const responses = [
      '这个想法很有趣！',
      '能再想一个不同的方案吗？',
      '有点类似了，能更创新吗？',
      '我喜欢这个创意！',
      '还有其他可能性吗？',
      '能结合这两个想法吗？'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成技术消息
   */
  private generateTechnicalMessage(user: SimulatedUser, context: ConversationContext): string {
    const responses = [
      '这段代码能运行吗？',
      '能优化性能吗？',
      '有没有bug？',
      '能加个注释吗？',
      '符合最佳实践吗？',
      '能重构一下吗？'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成多轮对话消息
   */
  private generateMultiTurnMessage(user: SimulatedUser, context: ConversationContext): string {
    // 模拟用户逐步明确需求
    const turnInContext = context.conversationHistory.length;
    
    if (turnInContext === 1) {
      return '我有个初步的想法，但不太确定具体怎么实现。';
    } else if (turnInContext === 2) {
      return '更具体来说，我想实现一个可以...的功能。';
    } else if (turnInContext === 3) {
      return '对，就是这样的。还需要考虑到...的情况。';
    }

    const responses = [
      '好的，还有一个问题',
      '明白了，继续',
      '这和我预期的一样',
      '差不多，但我还需要...',
      '很好，这个方案不错'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 生成通用消息
   */
  private generateGenericMessage(user: SimulatedUser): string {
    const responses = [
      '好的，请继续',
      '我明白了',
      '明白了',
      '有道理',
      '了解了'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 评估情感
   */
  private evaluateSentiment(user: SimulatedUser, message: string): number {
    // 基础情感值（根据用户性格）
    let baseSentiment = user.profile.personality === 'friendly' ? 0.7 :
                       user.profile.personality === 'aggressive' ? 0.4 : 0.5;

    // 根据消息内容调整
    const positiveWords = /好|不错|谢谢|对|行|可以|很好|棒|赞/i;
    const negativeWords = /不对|错误|不行|不要|别|不对|糟糕|差/i;

    if (positiveWords.test(message)) {
      baseSentiment = Math.min(1, baseSentiment + 0.2);
    } else if (negativeWords.test(message)) {
      baseSentiment = Math.max(0, baseSentiment - 0.2);
    }

    // 添加一些随机性
    baseSentiment += (Math.random() - 0.5) * 0.2;

    return Math.max(0, Math.min(1, baseSentiment));
  }

  /**
   * 检测意图
   */
  private detectIntent(message: string): string {
    if (/怎么|如何|what.*how/i.test(message)) return 'how-to';
    if (/为什么|why/i.test(message)) return 'why';
    if (/是什么|what.*is/i.test(message)) return 'definition';
    if (/谢谢/i.test(message)) return 'thanks';
    if (/继续|好的|明白/i.test(message)) return 'acknowledgment';
    return 'general';
  }

  /**
   * 获取或创建上下文
   */
  private getOrCreateContext(userId: string): ConversationContext {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, {
        conversationHistory: [],
        lastSentiment: 0.5,
        lastIntent: 'greeting'
      });
    }
    return this.conversationHistory.get(userId)!;
  }

  /**
   * 清除用户上下文
   */
  clearContext(userId: string): void {
    this.conversationHistory.delete(userId);
  }

  /**
   * 清除所有上下文
   */
  clearAllContexts(): void {
    this.conversationHistory.clear();
  }

  /**
   * 生成场景初始消息
   */
  generateInitialMessage(scenario: Scenario, user: SimulatedUser): string {
    // 根据场景类型和难度生成初始消息
    const difficultyModifier = scenario.difficulty <= 2 ? '基础' :
                              scenario.difficulty <= 3 ? '进阶' : '高级';

    switch (scenario.category) {
      case 'question_answering':
        return `你好，我想了解${difficultyModifier}${scenario.name}相关的问题。`;

      case 'tool_usage':
        return `你好，我需要使用工具来完成${scenario.name}任务。`;

      case 'problem_solving':
        return `你好，我遇到了一个问题，希望能帮我分析${difficultyModifier}${scenario.name}。`;

      case 'creativity':
        return `你好，我需要进行${scenario.name}的创意任务。`;

      case 'technical':
        return `你好，我需要${difficultyModifier}${scenario.name}的技术帮助。`;

      case 'multi_turn':
        return `你好，我们来进行${scenario.name}的多轮交互。`;

      default:
        return `你好，请帮我完成${scenario.name}任务。`;
    }
  }

  /**
   * 生成场景结束消息
   */
  generateClosingMessage(scenario: Scenario, user: SimulatedUser): string {
    const successPhrases = [
      '非常好，谢谢你的帮助！',
      '问题解决了，非常感谢！',
      '太好了，已经完成了！',
      '谢谢你，学到了很多！'
    ];

    const partialPhrases = [
      '基本解决了，还有一点疑问',
      '了解了，以后有问题再来请教',
      '明白了，感谢你的耐心解答'
    ];

    const failurePhrases = [
      '还是有些困惑',
      '没有完全理解',
      '需要再想想'
    ];

    // 根据用户性格选择不同的表达方式
    if (user.profile.personality === 'aggressive') {
      return successPhrases[0];
    } else if (user.profile.personality === 'friendly') {
      return successPhrases[Math.floor(Math.random() * successPhrases.length)];
    }

    return successPhrases[0];
  }
}

interface ConversationContext {
  conversationHistory: Array<{
    turnNumber: number;
    agentResponse: string;
    timestamp: Date;
  }>;
  lastSentiment: number;
  lastIntent: string;
}

interface ResponsePattern {
  pattern: RegExp;
  response: string;
  nextExpected?: string;
  category?: string;
  sentiment?: string;
}
