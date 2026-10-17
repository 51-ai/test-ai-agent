import { RLState, RLAction, RLExperience, RewardConfig, defaultRewardConfig } from './types';

export class RewardCalculator {
  private config: RewardConfig;
  private userMistakeHistory: Map<string, number> = new Map();
  private conversationHistory: Map<string, string[]> = new Map();

  constructor(config: Partial<RewardConfig> = {}) {
    this.config = { ...defaultRewardConfig, ...config };
  }

  calculateReward(
    state: RLState,
    action: RLAction,
    nextState: RLState,
    done: boolean,
    metrics: {
      taskCompleted?: boolean;
      userSatisfied?: boolean;
      hasHallucination?: boolean;
      responseTime?: number;
      correctToolUsed?: boolean;
      usedRelevantContext?: boolean;
      safetyViolation?: boolean;
      actionRelevant?: boolean;
      /** 对话质量综合分（DialogueEvaluator.overall，0-10）；给出时按 dialogueQualityScale 计入奖励 */
      dialogueQuality?: number;
    }
  ): number {
    let reward = 0;

    if (metrics.taskCompleted) {
      reward += this.config.taskCompletion;
    }

    if (metrics.userSatisfied) {
      reward += this.config.userPositiveFeedback;
    }

    if (metrics.correctToolUsed) {
      reward += this.config.correctToolUsage;
    }

    if (metrics.responseTime && metrics.responseTime < 2) {
      reward += this.config.fastResponse;
    }

    if (metrics.hasHallucination) {
      reward += this.config.hallucinationPenalty;
    }

    if (done && !metrics.taskCompleted) {
      reward += this.config.timeoutPenalty;
    }

    if (metrics.usedRelevantContext) {
      reward += this.config.relevantContextBonus;
    }

    if (metrics.actionRelevant) {
      reward += this.config.contextAwarenessBonus;
    }

    if (metrics.safetyViolation) {
      reward += this.config.safetyViolationPenalty;
    }

    // 对话质量信号：DialogueEvaluator 综合分（0-10）线性映射，5 分中性、满分 +scale、零分 -scale
    if (typeof metrics.dialogueQuality === 'number' && Number.isFinite(metrics.dialogueQuality)) {
      const q = Math.min(10, Math.max(0, metrics.dialogueQuality));
      reward += ((q - 5) / 5) * this.config.dialogueQualityScale;
    }

    if (action.type === 'ask_clarification' && state.currentInput.length < 10) {
      reward += this.config.clarificationBonus;
    }

    const conversationFlowReward = this.evaluateConversationFlow(state, action, nextState);
    reward += conversationFlowReward;

    const repeatedMistake = this.checkRepeatedMistakes(state.userId, action);
    if (repeatedMistake) {
      reward += this.config.repeatedMistakePenalty;
    }

    return Math.max(reward, -20);
  }

  private evaluateConversationFlow(state: RLState, action: RLAction, nextState: RLState): number {
    let flowBonus = 0;

    if (state.lastActionType && state.lastActionType !== action.type) {
      const goodTransitions = this.getGoodTransitions();
      if (goodTransitions[state.lastActionType]?.includes(action.type)) {
        flowBonus += this.config.conversationFlowBonus;
      }
    }

    if (action.type === 'respond' && nextState.conversationTurns > 1) {
      flowBonus += 1;
    }

    return flowBonus;
  }

  private getGoodTransitions(): Record<string, string[]> {
    return {
      'ask_clarification': ['respond', 'search', 'execute_code'],
      'search': ['respond', 'summarize'],
      'execute_code': ['respond', 'summarize'],
      'summarize': ['respond'],
      'respond': ['search', 'ask_clarification', 'respond']
    };
  }

  private checkRepeatedMistakes(userId: string, action: RLAction): boolean {
    const history = this.conversationHistory.get(userId) || [];
    const recentMistakes = history.slice(-5);
    
    const sameActionCount = recentMistakes.filter(type => type === action.type).length;
    
    if (sameActionCount >= 3) {
      return true;
    }

    history.push(action.type);
    this.conversationHistory.set(userId, history);
    
    return false;
  }

  evaluateActionQuality(action: RLAction, state: RLState): number {
    let qualityScore = 0;

    const searchKeywords = ['搜索', '查找', 'search', 'find', 'what is', 'how to', 'how do'];
    const codeKeywords = ['代码', 'python', 'javascript', 'js', '执行', 'run', 'execute', 'coding'];
    const summarizeKeywords = ['总结', '摘要', 'sum up', 'summarize', 'recap'];
    const translateKeywords = ['翻译', 'translate', 'convert', '英文', '中文'];

    const lowerInput = state.currentInput.toLowerCase();

    if (action.type === 'search' && searchKeywords.some(k => lowerInput.includes(k))) {
      qualityScore += 8;
    }

    if (action.type === 'execute_code' && codeKeywords.some(k => lowerInput.includes(k))) {
      qualityScore += 8;
    }

    if (action.type === 'summarize' && summarizeKeywords.some(k => lowerInput.includes(k))) {
      qualityScore += 7;
    }

    if (action.type === 'translate' && translateKeywords.some(k => lowerInput.includes(k))) {
      qualityScore += 7;
    }

    if (action.type === 'ask_clarification' && state.currentInput.length < 10) {
      qualityScore += 5;
    }

    if (action.type === 'respond' && state.conversationTurns > 3) {
      qualityScore += 4;
    }

    qualityScore += action.confidence * 3;

    return qualityScore;
  }

  calculateShapedReward(baseReward: number, state: RLState, action: RLAction): number {
    let shaped = baseReward;

    const complexity = state.inputComplexity || 1;
    if (complexity > 5 && action.type !== 'ask_clarification') {
      shaped -= 2;
    }

    if (state.userMood === 'negative' && action.type === 'respond') {
      shaped += 1;
    }

    if (state.userMood === 'positive') {
      shaped += 1;
    }

    return shaped;
  }

  updateUserHistory(userId: string, actionType: string): void {
    const current = this.userMistakeHistory.get(userId) || 0;
    this.userMistakeHistory.set(userId, current + 1);
  }

  resetUserHistory(userId: string): void {
    this.userMistakeHistory.delete(userId);
    this.conversationHistory.delete(userId);
  }
}
