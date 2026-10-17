/**
 * 场景评估器 - 评估agent在场景中的表现
 */

import {
  Scenario,
  ScenarioResult,
  ScenarioMetrics,
  SimulatedConversation,
  ConversationTurn,
  EvaluationCriteria
} from './types';

export class ScenarioEvaluator {
  private evaluationMode: 'strict' | 'lenient' | 'balanced';

  constructor(mode: 'strict' | 'lenient' | 'balanced' = 'balanced') {
    this.evaluationMode = mode;
  }

  /**
   * 评估场景结果
   */
  evaluateScenario(
    scenario: Scenario,
    conversation: SimulatedConversation,
    expectedOutcome?: any
  ): ScenarioResult {
    const metrics = this.calculateMetrics(scenario, conversation, expectedOutcome);
    const score = this.calculateOverallScore(scenario.evaluationCriteria, metrics);
    const success = this.determineSuccess(scenario, score);

    return {
      scenarioId: scenario.id,
      success,
      score,
      metrics,
      conversation,
      feedback: this.generateFeedback(scenario, metrics, success),
      recommendations: this.generateRecommendations(scenario, metrics),
      timestamp: new Date()
    };
  }

  /**
   * 计算各项指标
   */
  private calculateMetrics(
    scenario: Scenario,
    conversation: SimulatedConversation,
    expectedOutcome?: any
  ): ScenarioMetrics {
    return {
      accuracy: this.evaluateAccuracy(scenario, conversation, expectedOutcome),
      relevance: this.evaluateRelevance(scenario, conversation),
      efficiency: this.evaluateEfficiency(scenario, conversation),
      userSatisfaction: this.evaluateUserSatisfaction(scenario, conversation),
      completionTime: this.calculateCompletionTime(conversation),
      turnsUsed: conversation.turns.length,
      toolsUsed: this.extractToolsUsed(conversation),
      errors: this.identifyErrors(conversation),
      rewards: this.calculateRewards(conversation)
    };
  }

  /**
   * 评估准确性
   */
  private evaluateAccuracy(
    scenario: Scenario,
    conversation: SimulatedConversation,
    expectedOutcome?: any
  ): number {
    // 根据场景类型评估准确性
    let baseAccuracy = 0.8;

    switch (scenario.category) {
      case 'question_answering':
        // 检查回答是否包含关键词
        baseAccuracy = this.evaluateAnswerAccuracy(conversation);
        break;

      case 'tool_usage':
        // 检查工具是否正确使用
        baseAccuracy = this.evaluateToolAccuracy(conversation);
        break;

      case 'technical':
        // 检查代码或技术方案的正确性
        baseAccuracy = this.evaluateTechnicalAccuracy(conversation);
        break;

      case 'problem_solving':
        // 检查问题是否被正确解决
        baseAccuracy = this.evaluateProblemSolvingAccuracy(conversation);
        break;

      default:
        // 基于对话质量评估
        baseAccuracy = this.evaluateConversationQuality(conversation);
    }

    // 根据难度调整
    const difficultyModifier = 1 - (scenario.difficulty - 1) * 0.1;
    baseAccuracy *= difficultyModifier;

    return this.applyModeModifier(baseAccuracy, 'accuracy');
  }

  /**
   * 评估答案准确性
   */
  private evaluateAnswerAccuracy(conversation: SimulatedConversation): number {
    let score = 0.8;
    const lastResponse = conversation.turns[conversation.turns.length - 1]?.agentResponse || '';

    // 检查是否包含完整信息
    if (lastResponse.includes('？') || lastResponse.includes('?')) {
      score -= 0.2; // 反问可能表示不确定
    }

    // 检查回答长度
    if (lastResponse.length < 20) {
      score -= 0.1; // 回答过短
    }

    // 检查是否包含关键词
    const keywords = ['因为', '由于', '所以', '因此'];
    const hasKeywords = keywords.some(keyword => lastResponse.toLowerCase().includes(keyword.toLowerCase()));
    if (hasKeywords) {
      score += 0.1; // 包含关键词加分
    }

    // 检查是否有解释
    if (lastResponse.toLowerCase().includes('因为') || lastResponse.toLowerCase().includes('由于')) {
      score += 0.1; // 有解释加分
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估工具使用准确性
   */
  private evaluateToolAccuracy(conversation: SimulatedConversation): number {
    let score = 0.7;
    const toolCalls = this.extractToolCalls(conversation);

    // 检查是否使用了工具
    if (toolCalls.length === 0) {
      return 0.3; // 没有使用工具
    }

    // 检查工具调用是否成功
    const successfulCalls = toolCalls.filter(call => call.success).length;
    score = successfulCalls / toolCalls.length;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估技术准确性
   */
  private evaluateTechnicalAccuracy(conversation: SimulatedConversation): number {
    let score = 0.75;
    const lastResponse = conversation.turns[conversation.turns.length - 1]?.agentResponse || '';

    // 检查是否包含代码
    if (lastResponse.toLowerCase().includes('```') || lastResponse.toLowerCase().includes('def ') || lastResponse.toLowerCase().includes('function')) {
      score += 0.1;
    }

    // 检查是否有错误处理
    if (lastResponse.toLowerCase().includes('try') || lastResponse.toLowerCase().includes('catch') || lastResponse.toLowerCase().includes('error')) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估问题解决准确性
   */
  private evaluateProblemSolvingAccuracy(conversation: SimulatedConversation): number {
    let score = 0.7;

    // 检查是否有分析过程
    const hasAnalysis = conversation.turns.some(turn =>
      turn.agentResponse. includes('分析') ||
      turn.agentResponse.includes('问题') ||
      turn.agentResponse.includes('方案')
    );

    if (hasAnalysis) {
      score += 0.1;
    }

    // 检查是否有解决方案
    const hasSolution = conversation.turns.some(turn =>
      turn.agentResponse. includes('解决') ||
      turn.agentResponse.includes('方案') ||
      turn.agentResponse.includes('建议')
    );

    if (hasSolution) {
      score += 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估对话质量
   */
  private evaluateConversationQuality(conversation: SimulatedConversation): number {
    let score = 0.75;

    // 检查响应长度是否合理
    const avgLength = conversation.turns.reduce((sum, turn) => 
      sum + turn.agentResponse.length, 0) / conversation.turns.length;

    if (avgLength < 10) {
      score -= 0.2;
    } else if (avgLength > 100) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 评估相关性
   */
  private evaluateRelevance(scenario: Scenario, conversation: SimulatedConversation): number {
    let score = 0.8;
    const userMessages = conversation.turns.map(turn => turn.userMessage.toLowerCase());
    const agentResponses = conversation.turns.map(turn => turn.agentResponse.toLowerCase());

    // 检查agent响应是否与用户问题相关
    for (let i = 0; i < Math.min(userMessages.length, agentResponses.length); i++) {
      const userMsg = userMessages[i];
      const agentResp = agentResponses[i];

      // 简单的关键词匹配
      const userKeywords = this.extractKeywords(userMsg);
      const hasRelevantKeywords = userKeywords.some(keyword => agentResp.includes(keyword.toLowerCase()));

      if (!hasRelevantKeywords && userKeywords.length > 0) {
        score -= 0.05;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取
    const words = text.split(/\s+/).filter(word => word.length > 2);
    return words.slice(0, 5); // 只取前5个关键词
  }

  /**
   * 评估效率
   */
  private evaluateEfficiency(scenario: Scenario, conversation: SimulatedConversation): number {
    let score = 1.0;

    // 检查是否超过最大轮数
    const maxTurns = this.getMaxTurns(scenario);
    if (conversation.turns.length > maxTurns) {
      score -= (conversation.turns.length - maxTurns) * 0.1;
    }

    // 检查是否在合理时间内完成
    const estimatedDuration = scenario.metadata.estimatedDuration * 1000;
    if (conversation.totalDuration > estimatedDuration) {
      score -= 0.2;
    } else if (conversation.totalDuration < estimatedDuration * 0.5) {
      score += 0.1; // 提前完成加分
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 获取最大轮数限制
   */
  private getMaxTurns(scenario: Scenario): number {
    const turnConstraint = scenario.constraints.find(c => c.type === 'max_turns');
    return turnConstraint?.value as number || 10;
  }

  /**
   * 评估用户满意度
   */
  private evaluateUserSatisfaction(scenario: Scenario, conversation: SimulatedConversation): number {
    let score = 0.75;

    // 基于情感趋势评估
    const sentiments = conversation.turns.map(turn => turn.metadata?.sentiment || 0.5);
    const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;

    if (avgSentiment > 0.6) {
      score += 0.15;
    } else if (avgSentiment < 0.4) {
      score -= 0.15;
    }

    // 检查是否有负面反馈
    const hasNegativeFeedback = sentiments.some(s => s < 0.3);
    if (hasNegativeFeedback) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 计算完成时间
   */
  private calculateCompletionTime(conversation: SimulatedConversation): number {
    return conversation.totalDuration;
  }

  /**
   * 提取使用的工具
   */
  private extractToolsUsed(conversation: SimulatedConversation): string[] {
    const tools = new Set<string>();
    
    for (const turn of conversation.turns) {
      if (turn.tools) {
        turn.tools.forEach(tool => tools.add(tool.toolName));
      }
    }

    return Array.from(tools);
  }

  /**
   * 提取工具调用
   */
  private extractToolCalls(conversation: SimulatedConversation): any[] {
    const calls: any[] = [];
    
    for (const turn of conversation.turns) {
      if (turn.tools) {
        calls.push(...turn.tools);
      }
    }

    return calls;
  }

  /**
   * 识别错误
   */
  private identifyErrors(conversation: SimulatedConversation): string[] {
    const errors: string[] = [];

    for (const turn of conversation.turns) {
      if (turn.metadata?.error) {
        errors.push(turn.metadata.error);
      }
      if (turn.agentResponse.includes('错误') || turn.agentResponse.includes('error')) {
        errors.push(`Turn ${turn.turnNumber}: 可能存在错误`);
      }
    }

    return errors;
  }

  /**
   * 计算奖励
   */
  private calculateRewards(conversation: SimulatedConversation): number[] {
    return conversation.turns.map(turn => turn.reward || 0);
  }

  /**
   * 计算总体评分
   */
  private calculateOverallScore(
    criteria: EvaluationCriteria,
    metrics: ScenarioMetrics
  ): number {
    const weightedScore = 
      metrics.accuracy * criteria.accuracy +
      metrics.relevance * criteria.relevance +
      metrics.efficiency * criteria.efficiency +
      metrics.userSatisfaction * criteria.user_satisfaction;

    return Math.round(weightedScore * 100) / 100;
  }

  /**
   * 判断是否成功
   */
  private determineSuccess(scenario: Scenario, score: number): boolean {
    // 根据难度调整成功阈值
    const baseThreshold = this.evaluationMode === 'strict' ? 0.8 :
                          this.evaluationMode === 'lenient' ? 0.5 : 0.65;

    const difficultyModifier = 1 - (scenario.difficulty - 1) * 0.05;
    const threshold = baseThreshold * difficultyModifier;

    return score >= threshold;
  }

  /**
   * 应用模式修正
   */
  private applyModeModifier(value: number, metric: string): number {
    if (this.evaluationMode === 'strict') {
      return metric === 'accuracy' ? value * 0.9 : value * 0.95;
    } else if (this.evaluationMode === 'lenient') {
      return metric === 'accuracy' ? Math.min(1, value * 1.1) : value * 1.05;
    }
    return value;
  }

  /**
   * 生成反馈
   */
  private generateFeedback(
    scenario: Scenario,
    metrics: ScenarioMetrics,
    success: boolean
  ): string {
    const parts: string[] = [];

    if (success) {
      parts.push('✓ 场景完成成功！');
    } else {
      parts.push('✗ 场景未完全达成目标');
    }

    parts.push(`\n评分: ${(metrics.accuracy * 100).toFixed(0)}%`);

    if (metrics.accuracy > 0.8) {
      parts.push('准确性较高');
    } else if (metrics.accuracy < 0.5) {
      parts.push('准确性需要提高');
    }

    if (metrics.relevance > 0.8) {
      parts.push('相关性很好');
    }

    if (metrics.efficiency > 0.8) {
      parts.push('效率很高');
    }

    if (metrics.errors.length > 0) {
      parts.push(`\n发现 ${metrics.errors.length} 个问题`);
    }

    return parts.join('\n');
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    scenario: Scenario,
    metrics: ScenarioMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.accuracy < 0.7) {
      recommendations.push('建议提高回答的准确性');
      recommendations.push('可以参考相关文档和最佳实践');
    }

    if (metrics.relevance < 0.7) {
      recommendations.push('建议更好地理解用户意图');
      recommendations.push('确保回答与问题相关');
    }

    if (metrics.efficiency < 0.7) {
      recommendations.push('建议优化响应策略');
      recommendations.push('可以减少不必要的交互轮数');
    }

    if (metrics.userSatisfaction < 0.6) {
      recommendations.push('建议改善沟通方式');
      recommendations.push('使用更友好的语言风格');
    }

    if (recommendations.length === 0) {
      recommendations.push('表现优秀，继续保持！');
    }

    return recommendations;
  }

  /**
   * 批量评估场景
   */
  evaluateBatch(
    scenarios: Scenario[],
    conversations: SimulatedConversation[]
  ): ScenarioResult[] {
    return scenarios.map((scenario, index) => 
      this.evaluateScenario(scenario, conversations[index])
    );
  }
}
