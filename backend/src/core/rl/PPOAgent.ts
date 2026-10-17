import { RLState, RLAction, RLExperience, RLTrainingStats, PolicyGradient } from './types';
import { ExperienceReplay } from './ExperienceReplay';
import { PolicyPersistence } from './PolicyPersistence';
import { CurriculumLearning } from './CurriculumLearning';
import { AdaptiveExploration } from './CurriculumLearning';
import { TrainingLogger } from './TrainingLogger';
import { MetricsVisualizer } from './TrainingLogger';
import { HyperparameterOptimizer } from './HyperparameterOptimizer';
import { SpecialEventSystem, type SpecialEvent } from './SpecialEvents';

export interface PPOConfig {
  learningRate: number;
  gamma: number;
  clipEpsilon: number;
  batchSize: number;
  epochs: number;
  valueLossCoef: number;
  entropyCoef: number;
  maxGradientNorm: number;
  gaeLambda: number;
  klTargetDivergence: number;
  momentumBeta: number;
  slidingWindowSize: number;
}

export const defaultPPOConfig: PPOConfig = {
  learningRate: 3e-4,
  gamma: 0.99,
  clipEpsilon: 0.2,
  batchSize: 32,
  epochs: 10,
  valueLossCoef: 0.5,
  entropyCoef: 0.01,
  maxGradientNorm: 0.5,
  gaeLambda: 0.95,
  klTargetDivergence: 0.015,
  momentumBeta: 0.9,
  slidingWindowSize: 50
};

interface PolicyTable {
  [key: string]: number;
}

interface MomentumBuffer {
  [key: string]: number;
}

interface SlidingWindowMetrics {
  successes: number[];
  failures: number[];
  policyUpdates: number[];
  updateMagnitudes: number[];
}

export interface RecommendedActionResult {
  action: RLAction;
  confidence: number;
  rationale: string;
  alternativeActions: RLAction[];
}

export interface EnhancedTrainingResult {
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  klDivergence: number;
  explainedVariance: number;
}

export class PPOAgent {
  private config: PPOConfig;
  private experienceReplay: ExperienceReplay;
  private policyTable: Map<string, PolicyTable> = new Map();
  private valueTable: Map<string, number> = new Map();
  private policyMomentum: Map<string, MomentumBuffer> = new Map();
  private trainingStats: RLTrainingStats;
  private epsilonDecay: number = 0.995;
  private epsilon: number = 0.1;
  private minEpsilon: number = 0.01;

  private persistence: PolicyPersistence;
  private curriculum: CurriculumLearning;
  private exploration: AdaptiveExploration;
  private logger: TrainingLogger;
  private visualizer: MetricsVisualizer;
  private hpOptimizer: HyperparameterOptimizer;
  private specialEvents?: SpecialEventSystem;
  private recentEvents: SpecialEvent[] = [];
  private eventImpactCache: Map<string, number> = new Map();

  private userPreferenceCache: Map<string, Map<string, number>> = new Map();
  private decisionConfidenceHistory: number[] = [];
  private slidingWindow: SlidingWindowMetrics = {
    successes: [],
    failures: [],
    policyUpdates: [],
    updateMagnitudes: []
  };

  constructor(config: Partial<PPOConfig> = {}, specialEvents?: SpecialEventSystem) {
    this.config = { ...defaultPPOConfig, ...config };
    this.experienceReplay = new ExperienceReplay();
    this.trainingStats = {
      totalUpdates: 0,
      totalExperiences: 0,
      averageReward: 0,
      policyLoss: 0,
      valueLoss: 0,
      entropy: 0,
      successRate: 0
    };

    this.persistence = new PolicyPersistence();
    this.curriculum = new CurriculumLearning();
    this.exploration = new AdaptiveExploration();
    this.logger = new TrainingLogger();
    this.visualizer = new MetricsVisualizer(this.logger);
    this.hpOptimizer = new HyperparameterOptimizer();
    this.specialEvents = specialEvents;
  }

  /**
   * 设置特殊事件系统
   */
  setSpecialEventSystem(specialEvents: SpecialEventSystem): void {
    this.specialEvents = specialEvents;
  }

  /**
   * 获取事件对策略的影响
   */
  private getEventImpact(state?: RLState): { rewardModifier: number; explorationModifier: number; learningRateModifier: number } {
    if (!this.specialEvents) {
      return { rewardModifier: 1, explorationModifier: 1, learningRateModifier: 1 };
    }

    const events = this.specialEvents.getAllEvents();
    let rewardModifier = 1;
    let explorationModifier = 1;
    let learningRateModifier = 1;

    const recentEvents = events.slice(-20);

    for (const event of recentEvents) {
      switch (event.category) {
        case 'success':
          rewardModifier += 0.2;
          explorationModifier = Math.max(0.5, explorationModifier - 0.05);
          break;
        case 'failure':
          rewardModifier = Math.max(0.3, rewardModifier - 0.3);
          explorationModifier = Math.min(2, explorationModifier + 0.1);
          learningRateModifier = Math.min(1.5, learningRateModifier + 0.1);
          break;
        case 'warning':
          explorationModifier = Math.min(1.5, explorationModifier + 0.05);
          break;
        case 'learning':
          learningRateModifier = Math.min(1.3, learningRateModifier + 0.05);
          break;
        case 'breakthrough':
          rewardModifier += 0.5;
          explorationModifier = Math.max(0.7, explorationModifier - 0.1);
          break;
        case 'correction':
          learningRateModifier = Math.min(1.8, learningRateModifier + 0.2);
          explorationModifier = Math.min(1.8, explorationModifier + 0.15);
          break;
      }
    }

    if (rewardModifier !== 1 || explorationModifier !== 1 || learningRateModifier !== 1) {
      console.log('[PPOAgent] Event Impact Applied:', {
        rewardModifier,
        explorationModifier,
        learningRateModifier,
        eventCount: events.length
      });
    }

    return { rewardModifier, explorationModifier, learningRateModifier };
  }

  /**
   * 根据事件调整奖励
   */
  adjustRewardForEvents(baseReward: number, state?: RLState): number {
    const { rewardModifier } = this.getEventImpact(state);
    const adjustedReward = baseReward * rewardModifier;

    if (this.specialEvents && Math.abs(rewardModifier - 1) > 0.1) {
      console.log(`[PPOAgent] Reward Adjustment: ${baseReward} -> ${adjustedReward} (modifier: ${rewardModifier})`);
      this.recentEvents.push(...this.specialEvents.getUnviewedEvents());
    }

    return adjustedReward;
  }

  /**
   * 增强版 getAction：先检查策略值再探索，记录决策置信度
   */
  getAction(state: RLState, epsilon: number = this.epsilon): RLAction {
    const stateKey = this.getStateKey(state);
    const actions: RLAction[] = [
      { type: 'respond', confidence: 0.8 },
      { type: 'search', confidence: 0.8 },
      { type: 'execute_code', confidence: 0.8 },
      { type: 'summarize', confidence: 0.8 },
      { type: 'translate', confidence: 0.8 },
      { type: 'ask_clarification', confidence: 0.8 }
    ];

    const { explorationModifier } = this.getEventImpact(state);
    const adjustedEpsilon = Math.max(this.minEpsilon, Math.min(0.5, epsilon * explorationModifier));

    const probabilities = this.getPolicy(state, stateKey);

    let maxProb = 0;
    let bestActionType: string = 'respond';
    for (const [actionType, prob] of Object.entries(probabilities)) {
      if (prob > maxProb) {
        maxProb = prob;
        bestActionType = actionType;
      }
    }

    if (Math.random() < adjustedEpsilon) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const confidence = probabilities[randomAction.type] || 0.3;
      this.recordDecisionConfidence(confidence);
      return { ...randomAction, confidence };
    }

    const confidence = probabilities[bestActionType] || 0.8;
    this.recordDecisionConfidence(confidence);
    return { type: bestActionType as RLAction['type'], confidence };
  }

  /**
   * 增强版 getPolicy：结合用户偏好、对话深度、输入复杂度与近期成功率
   */
  getPolicy(state: RLState, stateKey?: string): Record<string, number> {
    const key = stateKey || this.getStateKey(state);

    if (this.policyTable.has(key)) {
      return this.policyTable.get(key)!;
    }

    const policies: Record<string, number> = {
      respond: 0.5,
      search: 0.15,
      execute_code: 0.1,
      summarize: 0.1,
      translate: 0.05,
      ask_clarification: 0.1,
      use_tool: 0.05
    };

    const input = state.currentInput.toLowerCase();
    const inputCategory = this.categorizeInput(state.currentInput);
    const complexity = this.calculateComplexity(state.currentInput);
    const historyDepth = Math.min(state.conversationHistory.length, 10);
    const hasTools = state.availableTools.length > 0;
    const recentSuccessRate = this.getSlidingWindowSuccessRate();

    switch (inputCategory) {
      case 'search':
        policies.search += 0.4;
        policies.respond -= 0.2;
        break;
      case 'code':
        policies.execute_code += 0.4;
        policies.respond -= 0.2;
        break;
      case 'translate':
        policies.translate += 0.35;
        policies.respond -= 0.15;
        break;
      case 'summarize':
        policies.summarize += 0.35;
        policies.respond -= 0.15;
        break;
      case 'help':
        policies.respond += 0.1;
        break;
      case 'greeting':
        policies.respond += 0.2;
        policies.search -= 0.05;
        policies.execute_code -= 0.05;
        break;
      case 'calculate':
        policies.execute_code += 0.2;
        policies.respond -= 0.05;
        break;
      case 'question':
        policies.search += 0.15;
        policies.ask_clarification += 0.1;
        policies.respond -= 0.1;
        break;
      default:
        policies.respond += 0.1;
    }

    if (complexity === 'complex') {
      policies.ask_clarification += 0.2;
      policies.respond -= 0.1;
    } else if (complexity === 'simple') {
      policies.respond += 0.1;
      policies.ask_clarification -= 0.05;
    }

    if (historyDepth > 5) {
      policies.respond += 0.1;
      policies.summarize += 0.1;
    } else if (historyDepth > 2) {
      policies.summarize += 0.05;
    }

    if (hasTools) {
      policies.use_tool += 0.15;
    }

    if (state.currentInput.length < 12 && inputCategory === 'general') {
      policies.ask_clarification += 0.2;
      policies.respond -= 0.1;
    }

    const userPreferences = this.userPreferenceCache.get(state.userId);
    if (userPreferences) {
      for (const [actionType, weight] of userPreferences.entries()) {
        if (policies[actionType] !== undefined) {
          policies[actionType] += weight * 0.15;
        }
      }
    }

    if (recentSuccessRate < 0.3) {
      policies.ask_clarification += 0.15;
      policies.execute_code -= 0.05;
      policies.search -= 0.05;
    } else if (recentSuccessRate > 0.7) {
      policies.execute_code += 0.05;
      policies.search += 0.05;
    }

    Object.keys(policies).forEach(k => {
      policies[k] = Math.max(policies[k], 0.005);
    });

    const total = Object.values(policies).reduce((a, b) => a + b, 0);
    Object.keys(policies).forEach(k => {
      policies[k] = policies[k] / total;
    });

    this.policyTable.set(key, policies);
    return policies;
  }

  sampleAction(probabilities: Record<string, number>): RLAction {
    const rand = Math.random();
    let cumulative = 0;

    for (const [action, prob] of Object.entries(probabilities)) {
      cumulative += prob;
      if (rand <= cumulative) {
        return { type: action as RLAction['type'], confidence: prob };
      }
    }

    return { type: 'respond', confidence: 0.8 };
  }

  getValue(state: RLState): number {
    const key = this.getStateKey(state);
    if (this.valueTable.has(key)) {
      return this.valueTable.get(key)!;
    }

    const baseValue = 0.5;
    const inputLengthBonus = Math.min(state.currentInput.length / 100, 0.2);
    const historyBonus = Math.min(state.conversationHistory.length / 10, 0.1);

    const value = baseValue + inputLengthBonus + historyBonus;
    this.valueTable.set(key, value);

    return value;
  }

  getLogProb(state: RLState, action: RLAction): number {
    const policy = this.getPolicy(state);
    const prob = policy[action.type] || 0.01;
    return Math.log(prob);
  }

  /**
   * 增强版状态键生成：多维度特征向量
   */
  private getStateKey(state: RLState): string {
    const inputLen = Math.min(state.currentInput.length, 30);
    const inputHash = state.currentInput.substring(0, inputLen)
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, '')
      .substring(0, 20);

    const userPrefix = state.userId ? state.userId.substring(0, 8) : 'anon';
    const convTurns = Math.min(state.conversationTurns, 10);
    const timeOfDay = Math.floor(state.timeOfDay / 6);
    const complexity = Math.min(state.inputComplexity, 5);

    return `${userPrefix}|${inputHash}|${convTurns}|${timeOfDay}|${complexity}|${state.availableTools.length}`;
  }

  private categorizeInput(input: string): string {
    const lower = input.toLowerCase();
    if (/(搜索|search|查找|查询|what is|how to|find)/.test(lower)) return 'search';
    if (/(代码|执行|编程|code|execute|run|python|javascript|写代码)/.test(lower)) return 'code';
    if (/(翻译|translate|英文|中文|convert)/.test(lower)) return 'translate';
    if (/(总结|总结|summary|summarize|摘要|recap)/.test(lower)) return 'summarize';
    if (/(帮助|help|功能|使用|how do|使用方法)/.test(lower)) return 'help';
    if (/(你好|hello|hi|问候|早上好|晚上好|嗨)/.test(lower)) return 'greeting';
    if (/(计算|算|math|calculate|compute|加减乘除)/.test(lower)) return 'calculate';
    if (input.endsWith('?') || input.endsWith('？') || /(什么|怎么|如何|为什么|哪里|谁|吗|呢|是不是|有没有)/.test(lower)) return 'question';
    return 'general';
  }

  private calculateComplexity(input: string): 'simple' | 'medium' | 'complex' {
    const length = input.length;
    const wordCount = input.split(/\s+/).filter(w => w.length > 0).length;
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>【】《》（），。？！]/.test(input);
    const hasLineBreaks = /\n|\r/.test(input);
    const hasCodeMarkers = /```|`|===|---|\{.*\}/.test(input);

    if ((length < 15 && wordCount < 5 && !hasSpecialChars) || length < 8) return 'simple';
    if (length < 50 && wordCount < 20 && !hasLineBreaks && !hasCodeMarkers) return 'medium';
    return 'complex';
  }

  /**
   * 记录决策置信度到滑动窗口
   */
  private recordDecisionConfidence(confidence: number): void {
    this.decisionConfidenceHistory.push(confidence);
    if (this.decisionConfidenceHistory.length > this.config.slidingWindowSize) {
      this.decisionConfidenceHistory.shift();
    }
  }

  /**
   * 获取滑动窗口内的平均成功率
   */
  private getSlidingWindowSuccessRate(): number {
    const total = this.slidingWindow.successes.length + this.slidingWindow.failures.length;
    if (total === 0) return 0.5;
    return this.slidingWindow.successes.length / total;
  }

  /**
   * 获取滑动窗口内的平均决策置信度
   */
  getAverageDecisionConfidence(): number {
    if (this.decisionConfidenceHistory.length === 0) return 0.5;
    return this.decisionConfidenceHistory.reduce((a, b) => a + b, 0) / this.decisionConfidenceHistory.length;
  }

  /**
   * 记录用户动作偏好
   */
  recordUserPreference(userId: string, actionType: string, success: boolean): void {
    if (!this.userPreferenceCache.has(userId)) {
      this.userPreferenceCache.set(userId, new Map());
    }
    const prefs = this.userPreferenceCache.get(userId)!;
    const current = prefs.get(actionType) || 0;
    const delta = success ? 1 : -0.5;
    const newVal = Math.max(-1, Math.min(1, current * 0.9 + delta * 0.1));
    prefs.set(actionType, newVal);
  }

  updatePolicy(experience: RLExperience): PolicyGradient {
    const state = experience.state;
    const action = experience.action;
    const nextState = experience.nextState;
    const baseReward = experience.reward;

    const reward = this.adjustRewardForEvents(baseReward, state);

    const oldLogProb = this.getLogProb(state, action);
    const value = this.getValue(state);
    const nextValue = this.getValue(nextState);
    const advantage = this.computeAdvantage(reward, value, nextValue);

    const policy = this.getPolicy(state);
    const newLogProb = Math.log(policy[action.type] || 0.01);

    const ratio = Math.exp(newLogProb - oldLogProb);
    const clippedRatio = Math.max(1 - this.config.clipEpsilon, Math.min(1 + this.config.clipEpsilon, ratio));

    const policyLoss1 = ratio * advantage;
    const policyLoss2 = clippedRatio * advantage;
    const policyLoss = -Math.min(policyLoss1, policyLoss2);

    const tdTarget = reward + this.config.gamma * nextValue;
    const valueLoss = Math.pow(value - tdTarget, 2);

    const minEntropyThreshold = 0.5;
    const currentEntropy = -Object.values(policy).reduce((sum, p) => sum + p * Math.log(p), 0);

    if (currentEntropy < minEntropyThreshold) {
      console.log(`[PPOAgent] Stability Warning: Low entropy (${currentEntropy.toFixed(3)}) below threshold (${minEntropyThreshold}). Adding random perturbation.`);
      const perturbationStrength = 0.05;
      for (const key of Object.keys(policy)) {
        const noise = (Math.random() - 0.5) * perturbationStrength;
        policy[key] = Math.max(0.005, policy[key] + noise);
      }
      const total = Object.values(policy).reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (const key of Object.keys(policy)) {
          policy[key] /= total;
        }
      }
      this.policyTable.set(this.getStateKey(state), policy);
    }

    const { learningRateModifier } = this.getEventImpact(state);
    this.updatePolicyTable(state, action, advantage, learningRateModifier);
    this.updateValueTable(state, tdTarget, learningRateModifier);

    this.recordUserPreference(state.userId, action.type, reward > 0);

    const stabilityScore = this.computeStabilityScore();

    const entropy = -Object.values(policy).reduce((sum, p) => sum + p * Math.log(p), 0);

    if (stabilityScore < 0.6) {
      console.log(`[PPOAgent] Stability Warning: Training stability score (${stabilityScore.toFixed(3)}) is low. Consider reducing learning rate.`);
    }

    return {
      policyLoss,
      valueLoss,
      entropy,
      totalLoss: policyLoss + valueLoss * this.config.valueLossCoef - entropy * this.config.entropyCoef
    };
  }

  /**
   * 增强版策略表更新：带梯度裁剪 + 动量 + 更好归一化
   */
  private updatePolicyTable(state: RLState, action: RLAction, advantage: number, learningRateModifier: number = 1): void {
    const key = this.getStateKey(state);
    const policy = this.getPolicy(state, key);

    const lr = this.config.learningRate * learningRateModifier;

    const rawUpdate = advantage * lr;
    const clippedUpdate = Math.max(-this.config.maxGradientNorm, Math.min(this.config.maxGradientNorm, rawUpdate));

    const momentumKey = key;
    if (!this.policyMomentum.has(momentumKey)) {
      this.policyMomentum.set(momentumKey, {});
    }
    const momentumBuffer = this.policyMomentum.get(momentumKey)!;
    const prevMomentum = momentumBuffer[action.type] || 0;
    const momentumUpdate = this.config.momentumBeta * prevMomentum + (1 - this.config.momentumBeta) * clippedUpdate;
    momentumBuffer[action.type] = momentumUpdate;

    const finalUpdate = momentumUpdate;
    const oldValue = policy[action.type] || 0;
    if (finalUpdate > 0) {
      policy[action.type] = Math.min(0.95, oldValue + finalUpdate);
    } else {
      policy[action.type] = Math.max(0.005, oldValue + finalUpdate);
    }

    const total = Object.values(policy).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(policy).forEach(k => {
        policy[k] = policy[k] / total;
      });
    }

    this.policyTable.set(key, policy);

    const mag = Math.abs(finalUpdate);
    this.slidingWindow.updateMagnitudes.push(mag);
    if (this.slidingWindow.updateMagnitudes.length > this.config.slidingWindowSize) {
      this.slidingWindow.updateMagnitudes.shift();
    }
  }

  private updateValueTable(state: RLState, targetValue: number, learningRateModifier: number = 1): void {
    const key = this.getStateKey(state);
    const currentValue = this.getValue(state);
    const lr = this.config.learningRate * learningRateModifier;
    const newValue = currentValue + lr * (targetValue - currentValue);
    this.valueTable.set(key, newValue);
  }

  /**
   * 获取特殊事件相关的统计信息
   */
  getSpecialEventsStats() {
    if (!this.specialEvents) {
      return null;
    }
    return {
      ...this.specialEvents.getStats(),
      recentEvents: this.recentEvents.slice(-10).map(e => ({
        id: e.id,
        category: e.category,
        severity: e.severity,
        title: e.title,
        timestamp: e.timestamp
      })),
      currentImpact: this.getEventImpact()
    };
  }

  computeAdvantage(reward: number, value: number, nextValue: number): number {
    const tdTarget = reward + this.config.gamma * nextValue;
    const advantage = tdTarget - value;
    return advantage;
  }

  computeGAE(rewards: number[], values: number[]): number[] {
    const advantages: number[] = [];
    let lastAdvantage = 0;

    for (let t = rewards.length - 1; t >= 0; t--) {
      const delta = rewards[t] + this.config.gamma * (values[t + 1] || 0) - values[t];
      lastAdvantage = delta + this.config.gamma * this.config.gaeLambda * lastAdvantage;
      advantages.unshift(lastAdvantage);
    }

    return advantages;
  }

  /**
   * 计算训练稳定性分数
   */
  private computeStabilityScore(): number {
    const updateCount = this.slidingWindow.updateMagnitudes.length;
    if (updateCount < 5) {
      return 1.0;
    }

    const recentMagnitudes = this.slidingWindow.updateMagnitudes.slice(-10);
    const meanMagnitude = recentMagnitudes.reduce((a, b) => a + b, 0) / recentMagnitudes.length;
    const variance = recentMagnitudes.reduce((sum, m) => sum + Math.pow(m - meanMagnitude, 2), 0) / recentMagnitudes.length;
    const stdDev = Math.sqrt(variance);

    const stabilityScore = Math.max(0, 1 - stdDev * 10);
    return Math.min(1, stabilityScore);
  }

  /**
   * 经验质量评估：基于奖励、TD-error、置信度等评估质量
   */
  evaluateExperienceQuality(experience: RLExperience): {
    quality: 'high' | 'medium' | 'low';
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0.5;

    const absReward = Math.abs(experience.reward);
    if (absReward > 5) {
      score += 0.3;
      reasons.push('高奖励信号');
    } else if (absReward > 2) {
      score += 0.15;
      reasons.push('中等奖励信号');
    } else if (absReward < 0.5) {
      score -= 0.2;
      reasons.push('奖励信号较弱');
    }

    const state = experience.state;
    const action = experience.action;
    const value = this.getValue(state);
    const nextValue = this.getValue(experience.nextState);
    const tdTarget = experience.reward + this.config.gamma * nextValue;
    const tdError = Math.abs(tdTarget - value);

    if (tdError > 3) {
      score += 0.2;
      reasons.push('高TD-error表明有价值学习空间');
    } else if (tdError < 0.5) {
      score -= 0.15;
      reasons.push('低TD-error表明状态值估计准确');
    }

    if (action.confidence > 0.8) {
      score += 0.1;
      reasons.push('高置信度动作');
    } else if (action.confidence < 0.3) {
      score += 0.05;
      reasons.push('低置信度动作提供探索机会');
    }

    if (state.conversationTurns > 5) {
      score += 0.1;
      reasons.push('多轮对话提供丰富上下文');
    }

    if (state.availableTools.length > 3) {
      score += 0.1;
      reasons.push('多工具可用增加决策复杂度');
    }

    score = Math.max(0, Math.min(1, score));

    let quality: 'high' | 'medium' | 'low';
    if (score >= 0.7) {
      quality = 'high';
    } else if (score >= 0.4) {
      quality = 'medium';
    } else {
      quality = 'low';
    }

    return { quality, score, reasons };
  }

  /**
   * 自适应学习率调整：根据近期表现调整学习率
   */
  computeAdaptiveLearningRate(recentPerformance: {
    successRate: number;
    avgReward: number;
    avgConfidence: number;
    policyLossTrend: number;
  }): number {
    let lrModifier = 1.0;

    if (recentPerformance.successRate > 0.8) {
      lrModifier *= 0.8;
    } else if (recentPerformance.successRate < 0.3) {
      lrModifier *= 1.5;
    }

    if (recentPerformance.avgReward > 5) {
      lrModifier *= 0.85;
    } else if (recentPerformance.avgReward < 1) {
      lrModifier *= 1.3;
    }

    if (recentPerformance.policyLossTrend > 0.1) {
      lrModifier *= 1.2;
    } else if (recentPerformance.policyLossTrend < -0.05) {
      lrModifier *= 0.9;
    }

    if (recentPerformance.avgConfidence > 0.85) {
      lrModifier *= 0.9;
    } else if (recentPerformance.avgConfidence < 0.4) {
      lrModifier *= 1.15;
    }

    lrModifier = Math.max(0.3, Math.min(2.0, lrModifier));

    const adaptiveLR = this.config.learningRate * lrModifier;

    if (lrModifier !== 1.0) {
      console.log(`[PPOAgent] Adaptive LR: ${this.config.learningRate} -> ${adaptiveLR} (modifier: ${lrModifier})`);
    }

    return adaptiveLR;
  }

  computeReturn(rewards: number[], values: number[]): number[] {
    const returns: number[] = [];
    let nextReturn = 0;

    for (let t = rewards.length - 1; t >= 0; t--) {
      nextReturn = rewards[t] + this.config.gamma * nextReturn;
      returns.unshift(nextReturn);
    }

    return returns;
  }

  getTrainingStats(): RLTrainingStats {
    return this.trainingStats;
  }

  reset(): void {
    this.policyTable.clear();
    this.valueTable.clear();
    this.policyMomentum.clear();
    this.userPreferenceCache.clear();
    this.decisionConfidenceHistory = [];
    this.slidingWindow = {
      successes: [],
      failures: [],
      policyUpdates: [],
      updateMagnitudes: []
    };
    this.epsilon = 0.1;
    this.trainingStats = {
      totalUpdates: 0,
      totalExperiences: 0,
      averageReward: 0,
      policyLoss: 0,
      valueLoss: 0,
      entropy: 0,
      successRate: 0,
      policyLossTrend: 0
    };
  }

  getEpsilon(): number {
    return this.epsilon;
  }

  updateSuccessRate(success: boolean): void {
    const weight = 0.01;
    this.trainingStats.successRate =
      this.trainingStats.successRate * (1 - weight) + (success ? 1 : 0) * weight;

    if (success) {
      this.slidingWindow.successes.push(1);
      if (this.slidingWindow.successes.length > this.config.slidingWindowSize) {
        this.slidingWindow.successes.shift();
      }
    } else {
      this.slidingWindow.failures.push(1);
      if (this.slidingWindow.failures.length > this.config.slidingWindowSize) {
        this.slidingWindow.failures.shift();
      }
    }

    this.curriculum.recordAttempt(success, 0);
    this.exploration.updateEpsilon(success, 0);
  }

  storeExperience(experience: RLExperience): void {
    const priority = Math.abs(experience.reward) + 0.01;
    this.experienceReplay.add(experience, priority);
    this.trainingStats.totalExperiences++;
    this.trainingStats.averageReward =
      (this.trainingStats.averageReward * (this.trainingStats.totalExperiences - 1) + experience.reward) /
      this.trainingStats.totalExperiences;

    this.persistence.savePolicy(
      this.getStateKey(experience.state),
      this.getPolicy(experience.state),
      this.getValue(experience.state)
    );

    this.logger.logExperience(experience);
    this.logger.logReward(experience.reward, 'experience');
  }

  /**
   * 增强版训练：GAE + 价值函数目标 + 多epoch + KL散度监控 + 解释方差
   */
  enhancedTrain(): EnhancedTrainingResult | null {
    if (this.experienceReplay.size() < this.config.batchSize) {
      return null;
    }

    const experiences = this.experienceReplay.sample(this.config.batchSize);

    const rewards: number[] = [];
    const values: number[] = [];
    const nextValues: number[] = [];
    const oldLogProbs: number[] = [];
    const stateKeys: string[] = [];
    const actionTypes: string[] = [];

    for (const exp of experiences) {
      rewards.push(this.adjustRewardForEvents(exp.reward, exp.state));
      const v = this.getValue(exp.state);
      const nv = this.getValue(exp.nextState);
      values.push(v);
      nextValues.push(nv);
      oldLogProbs.push(this.getLogProb(exp.state, exp.action));
      stateKeys.push(this.getStateKey(exp.state));
      actionTypes.push(exp.action.type);
    }

    const advantages = this.computeGAE(rewards, values);
    const returns: number[] = [];
    for (let t = 0; t < rewards.length; t++) {
      returns.push(advantages[t] + values[t]);
    }

    const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const std = Math.sqrt(advantages.reduce((a, b) => a + (b - mean) ** 2, 0) / advantages.length) || 1;
    const normalizedAdvantages = advantages.map(a => (a - mean) / std);

    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;
    let totalKL = 0;
    let earlyStopEpoch = this.config.epochs;

    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      let epochPolicyLoss = 0;
      let epochValueLoss = 0;
      let epochEntropy = 0;
      let epochKL = 0;

      for (let i = 0; i < experiences.length; i++) {
        const exp = experiences[i];
        const policy = this.getPolicy(exp.state);
        const currentLogProb = Math.log(policy[actionTypes[i]] || 0.01);

        const ratio = Math.exp(currentLogProb - oldLogProbs[i]);
        const clippedRatio = Math.max(
          1 - this.config.clipEpsilon,
          Math.min(1 + this.config.clipEpsilon, ratio)
        );

        const adv = normalizedAdvantages[i];
        const policyLoss1 = ratio * adv;
        const policyLoss2 = clippedRatio * adv;
        const policyLoss = -Math.min(policyLoss1, policyLoss2);

        const valueError = values[i] - returns[i];
        const valueLoss = valueError * valueError;

        const entropy = -Object.values(policy).reduce((s, p) => s + p * Math.log(p), 0);

        const kl = (Math.exp(currentLogProb) - Math.exp(oldLogProbs[i])) *
          (currentLogProb - oldLogProbs[i]) / 2;

        epochPolicyLoss += policyLoss;
        epochValueLoss += valueLoss;
        epochEntropy += entropy;
        epochKL += kl;

        const { learningRateModifier } = this.getEventImpact(exp.state);
        this.updatePolicyTable(exp.state, exp.action, adv, learningRateModifier);
        this.updateValueTable(exp.state, returns[i], learningRateModifier);
      }

      const avgKL = epochKL / experiences.length;
      totalPolicyLoss += epochPolicyLoss / experiences.length;
      totalValueLoss += epochValueLoss / experiences.length;
      totalEntropy += epochEntropy / experiences.length;
      totalKL += avgKL;

      if (avgKL > this.config.klTargetDivergence * 1.5) {
        console.log(`[PPOAgent] Early stopping at epoch ${epoch} due to high KL divergence: ${avgKL}`);
        earlyStopEpoch = epoch + 1;
        break;
      }
    }

    const avgPolicyLoss = totalPolicyLoss / earlyStopEpoch;
    const avgValueLoss = totalValueLoss / earlyStopEpoch;
    const avgEntropy = totalEntropy / earlyStopEpoch;
    const avgKL = totalKL / earlyStopEpoch;

    const valueMean = values.reduce((a, b) => a + b, 0) / values.length;
    const valueVar = values.reduce((s, v) => s + (v - valueMean) ** 2, 0) / values.length;
    const returnMean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnVar = returns.reduce((s, r) => s + (r - returnMean) ** 2, 0) / returns.length;
    const explainedVariance = returnVar > 0 ? Math.max(0, 1 - valueVar / returnVar) : 0;

    this.trainingStats.totalUpdates++;
    this.trainingStats.policyLoss = avgPolicyLoss;
    this.trainingStats.valueLoss = avgValueLoss;
    this.trainingStats.entropy = avgEntropy;
    this.trainingStats.lastUpdateTime = new Date();

    this.slidingWindow.policyUpdates.push(1);
    if (this.slidingWindow.policyUpdates.length > this.config.slidingWindowSize) {
      this.slidingWindow.policyUpdates.shift();
    }

    this.epsilon = Math.max(this.epsilon * this.epsilonDecay, this.minEpsilon);

    this.logger.logTraining({
      policyLoss: avgPolicyLoss,
      valueLoss: avgValueLoss,
      entropy: avgEntropy,
      totalLoss: avgPolicyLoss + avgValueLoss * this.config.valueLossCoef - avgEntropy * this.config.entropyCoef,
      batchSize: this.config.batchSize
    });

    return {
      policyLoss: avgPolicyLoss,
      valueLoss: avgValueLoss,
      entropy: avgEntropy,
      klDivergence: avgKL,
      explainedVariance
    };
  }

  /**
   * 高级决策接口：提供推荐动作、置信度、理由及备选方案
   */
  getRecommendedAction(
    state: RLState,
    context?: {
      userPreferences?: string[];
      recentSuccessRate?: number;
      availableTools?: string[];
    }
  ): RecommendedActionResult {
    const basePolicy = this.getPolicy(state);
    const adjustedPolicy: Record<string, number> = { ...basePolicy };

    const rationaleParts: string[] = [];
    const inputCategory = this.categorizeInput(state.currentInput);
    const complexity = this.calculateComplexity(state.currentInput);

    rationaleParts.push(`输入被识别为「${inputCategory}」类别（${complexity}复杂度）`);

    if (context?.userPreferences && context.userPreferences.length > 0) {
      for (const pref of context.userPreferences) {
        if (adjustedPolicy[pref] !== undefined) {
          adjustedPolicy[pref] += 0.15;
        }
      }
      rationaleParts.push(`结合用户偏好：${context.userPreferences.join(', ')}`);
    }

    if (context?.recentSuccessRate !== undefined) {
      if (context.recentSuccessRate < 0.3) {
        adjustedPolicy.ask_clarification += 0.1;
        rationaleParts.push('近期成功率偏低，增加澄清倾向');
      } else if (context.recentSuccessRate > 0.8) {
        adjustedPolicy.execute_code += 0.05;
        adjustedPolicy.search += 0.05;
        rationaleParts.push('近期成功率高，增强主动行动');
      }
    }

    if (context?.availableTools && context.availableTools.length > 0) {
      adjustedPolicy.use_tool = (adjustedPolicy.use_tool || 0.05) + 0.15;
      rationaleParts.push(`检测到可用工具：${context.availableTools.length} 项`);
    }

    Object.keys(adjustedPolicy).forEach(k => {
      adjustedPolicy[k] = Math.max(adjustedPolicy[k], 0.005);
    });
    const total = Object.values(adjustedPolicy).reduce((a, b) => a + b, 0);
    Object.keys(adjustedPolicy).forEach(k => {
      adjustedPolicy[k] = adjustedPolicy[k] / total;
    });

    const sortedEntries = Object.entries(adjustedPolicy)
      .sort((a, b) => b[1] - a[1]);

    const [bestType, bestProb] = sortedEntries[0];

    const alternativeActions: RLAction[] = sortedEntries
      .slice(1, 4)
      .map(([type, prob]) => ({
        type: type as RLAction['type'],
        confidence: prob
      }));

    const confidence = Math.max(0.1, Math.min(0.99, bestProb));

    if (state.conversationHistory.length > 3) {
      rationaleParts.push(`当前对话深度为 ${state.conversationHistory.length} 轮`);
    }

    return {
      action: { type: bestType as RLAction['type'], confidence },
      confidence,
      rationale: rationaleParts.join('；') + `。最优动作「${bestType}」的策略概率为 ${(bestProb * 100).toFixed(1)}%。`,
      alternativeActions
    };
  }

  train(): PolicyGradient | null {
    if (this.experienceReplay.size() < this.config.batchSize) {
      return null;
    }

    const allExperiences = this.experienceReplay.getAll();
    const experienceQualities = allExperiences.map(exp => ({
      exp,
      quality: this.evaluateExperienceQuality(exp)
    }));

    experienceQualities.sort((a, b) => b.quality.score - a.quality.score);

    const highQualityCount = Math.floor(this.config.batchSize * 0.6);
    const randomCount = this.config.batchSize - highQualityCount;

    const highQualityExperiences = experienceQualities.slice(0, highQualityCount).map(eq => eq.exp);

    const uniqueStateKeys = new Set<string>();
    const diverseExperiences: RLExperience[] = [];
    for (const eq of experienceQualities) {
      const stateKey = this.getStateKey(eq.exp.state);
      if (!uniqueStateKeys.has(stateKey)) {
        uniqueStateKeys.add(stateKey);
        diverseExperiences.push(eq.exp);
      }
      if (diverseExperiences.length >= randomCount) break;
    }

    const shuffledDiverse = diverseExperiences.sort(() => Math.random() - 0.5);
    const sampledExperiences = [...highQualityExperiences, ...shuffledDiverse].slice(0, this.config.batchSize);

    const recentPerformance = {
      successRate: this.getSlidingWindowSuccessRate(),
      avgReward: this.trainingStats.averageReward,
      avgConfidence: this.getAverageDecisionConfidence(),
      policyLossTrend: this.trainingStats.policyLossTrend || 0
    };
    const adaptiveLR = this.computeAdaptiveLearningRate(recentPerformance);
    const originalLR = this.config.learningRate;
    this.config.learningRate = adaptiveLR;

    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;

    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      for (const exp of sampledExperiences) {
        const result = this.updatePolicy(exp);
        totalPolicyLoss += result.policyLoss;
        totalValueLoss += result.valueLoss;
        totalEntropy += result.entropy;
      }
    }

    this.config.learningRate = originalLR;

    const avgPolicyLoss = totalPolicyLoss / (this.config.epochs * sampledExperiences.length);
    const avgValueLoss = totalValueLoss / (this.config.epochs * sampledExperiences.length);
    const avgEntropy = totalEntropy / (this.config.epochs * sampledExperiences.length);

    this.trainingStats.totalUpdates++;
    this.trainingStats.policyLossTrend = avgPolicyLoss - this.trainingStats.policyLoss;
    this.trainingStats.policyLoss = avgPolicyLoss;
    this.trainingStats.valueLoss = avgValueLoss;
    this.trainingStats.entropy = avgEntropy;
    this.trainingStats.lastUpdateTime = new Date();

    this.epsilon = Math.max(this.epsilon * this.epsilonDecay, this.minEpsilon);

    this.logger.logTraining({
      policyLoss: avgPolicyLoss,
      valueLoss: avgValueLoss,
      entropy: avgEntropy,
      totalLoss: avgPolicyLoss + avgValueLoss * this.config.valueLossCoef - avgEntropy * this.config.entropyCoef,
      batchSize: this.config.batchSize
    });

    return {
      policyLoss: avgPolicyLoss,
      valueLoss: avgValueLoss,
      entropy: avgEntropy,
      totalLoss: avgPolicyLoss + avgValueLoss * this.config.valueLossCoef - avgEntropy * this.config.entropyCoef
    };
  }

  startEpisode(): void {
    this.logger.startEpisode();
  }

  endEpisode(success: boolean): void {
    this.logger.endEpisode(success);
    this.updateSuccessRate(success);
  }

  getCurriculum() {
    return this.curriculum;
  }

  getExploration() {
    return this.exploration;
  }

  getLogger() {
    return this.logger;
  }

  getVisualizer() {
    return this.visualizer;
  }

  getHyperparameterOptimizer() {
    return this.hpOptimizer;
  }

  getTrainingReport(): string {
    return this.visualizer.generateVisualReport();
  }

  exportTrainingData(): string {
    return this.logger.exportLogs();
  }

  updateConfig(newConfig: Partial<PPOConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getCurrentConfig(): PPOConfig {
    return { ...this.config };
  }

  /**
   * 获取滑动窗口的详细统计
   */
  getSlidingWindowStats(): {
    slidingSuccessRate: number;
    slidingFailureRate: number;
    averageUpdateMagnitude: number;
    averageConfidence: number;
    updateCount: number;
  } {
    const successTotal = this.slidingWindow.successes.length;
    const failureTotal = this.slidingWindow.failures.length;
    const total = successTotal + failureTotal;
    const avgMag = this.slidingWindow.updateMagnitudes.length > 0
      ? this.slidingWindow.updateMagnitudes.reduce((a, b) => a + b, 0) / this.slidingWindow.updateMagnitudes.length
      : 0;
    return {
      slidingSuccessRate: total > 0 ? successTotal / total : 0.5,
      slidingFailureRate: total > 0 ? failureTotal / total : 0,
      averageUpdateMagnitude: avgMag,
      averageConfidence: this.getAverageDecisionConfidence(),
      updateCount: this.slidingWindow.policyUpdates.length
    };
  }

  getFullStats() {
    return {
      training: this.getTrainingStats(),
      curriculum: this.curriculum.getCurriculumStats(),
      exploration: this.exploration.getExplorationStats(),
      logger: this.logger.getMetricsStats(),
      experience: { size: this.experienceReplay.size() },
      specialEvents: this.getSpecialEventsStats(),
      slidingWindow: this.getSlidingWindowStats()
    };
  }

  /**
   * 策略评估：计算当前策略的综合评估分数
   */
  evaluatePolicy(): {
    overallScore: number;
    explorationScore: number;
    exploitationScore: number;
    stabilityScore: number;
    diversityScore: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    const explorationScore = Math.min(this.epsilon / 0.1, 1.0);
    if (explorationScore < 0.2) recommendations.push('探索率过低，可能需要增加epsilon或增加新类型输入');
    if (explorationScore > 0.8) recommendations.push('探索率偏高，可能需要稳定训练');

    const exploitationScore = this.getSlidingWindowSuccessRate();
    if (exploitationScore < 0.3) recommendations.push('成功率偏低，建议检查奖励设置和训练样本质量');

    const stabilityScore = this.computeStabilityScore();
    if (stabilityScore < 0.5) recommendations.push('训练稳定性不足，建议降低学习率或增加梯度裁剪强度');

    let diversityScore = 0;
    const sampleSize = Math.min(this.policyTable.size, 10);
    if (sampleSize > 0) {
      const stateKeys = Array.from(this.policyTable.keys()).slice(0, sampleSize);
      let totalEntropy = 0;
      for (const key of stateKeys) {
        const policy = this.policyTable.get(key)!;
        const entropy = -Object.values(policy).reduce((s, p) => s + p * Math.log(p), 0);
        totalEntropy += entropy;
      }
      diversityScore = Math.min(totalEntropy / sampleSize / 2, 1.0);
    }
    if (diversityScore < 0.3) recommendations.push('策略多样性不足，建议增加训练样本的多样性');

    const overallScore = (explorationScore * 0.2 + exploitationScore * 0.3 + stabilityScore * 0.3 + diversityScore * 0.2);

    if (recommendations.length === 0) recommendations.push('策略状态良好，继续训练即可稳定提升');

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      explorationScore: Math.round(explorationScore * 100) / 100,
      exploitationScore: Math.round(exploitationScore * 100) / 100,
      stabilityScore: Math.round(stabilityScore * 100) / 100,
      diversityScore: Math.round(diversityScore * 100) / 100,
      recommendations
    };
  }

  /**
   * 获取策略摘要（便于快速查看训练状态）
   */
  getPolicySummary(): {
    totalStates: number;
    averageValue: number;
    averageEntropy: number;
    dominantActions: Record<string, number>;
    mostVisitedStates: Array<{ key: string; bestAction: string; value: number }>;
  } {
    const dominantActions: Record<string, number> = {};
    let totalEntropy = 0;
    let totalValue = 0;
    const mostVisited: Array<{ key: string; bestAction: string; value: number }> = [];

    const stateKeys = Array.from(this.policyTable.keys()).slice(0, 20);
    for (const key of stateKeys) {
      const policy = this.policyTable.get(key)!;
      const value = this.valueTable.get(key) || 0;
      totalValue += value;

      const entropy = -Object.values(policy).reduce((s, p) => s + p * Math.log(p), 0);
      totalEntropy += entropy;

      let bestAction = 'respond';
      let bestProb = 0;
      for (const [action, prob] of Object.entries(policy)) {
        if (prob > bestProb) {
          bestProb = prob;
          bestAction = action;
        }
      }
      dominantActions[bestAction] = (dominantActions[bestAction] || 0) + 1;
      mostVisited.push({ key: key.substring(0, 20) + '...', bestAction, value: Math.round(value * 100) / 100 });
    }

    const stateCount = this.policyTable.size || 1;
    return {
      totalStates: stateCount,
      averageValue: Math.round((totalValue / stateCount) * 100) / 100,
      averageEntropy: Math.round((totalEntropy / stateCount) * 100) / 100,
      dominantActions,
      mostVisitedStates: mostVisited.sort((a, b) => b.value - a.value).slice(0, 10)
    };
  }

  /**
   * 策略比较：比较两种状态下的策略差异
   */
  comparePolicies(state1: RLState, state2: RLState): {
    divergence: number;
    similarity: number;
    dominantShift: string;
  } {
    const policy1 = this.getPolicy(state1);
    const policy2 = this.getPolicy(state2);

    let klDivergence = 0;
    for (const key of Object.keys(policy1)) {
      if (policy2[key] !== undefined && policy1[key] > 0) {
        klDivergence += policy1[key] * Math.log(policy1[key] / policy2[key]);
      }
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (const key of Object.keys(policy1)) {
      if (policy2[key] !== undefined) {
        dotProduct += policy1[key] * policy2[key];
        norm1 += policy1[key] * policy1[key];
        norm2 += policy2[key] * policy2[key];
      }
    }
    const similarity = (norm1 > 0 && norm2 > 0) ? dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;

    let best1 = 'respond', best2 = 'respond';
    let maxProb1 = 0, maxProb2 = 0;
    for (const [key, prob] of Object.entries(policy1)) {
      if (prob > maxProb1) { maxProb1 = prob; best1 = key; }
    }
    for (const [key, prob] of Object.entries(policy2)) {
      if (prob > maxProb2) { maxProb2 = prob; best2 = key; }
    }
    const dominantShift = best1 !== best2 ? `${best1} -> ${best2}` : best1;

    return {
      divergence: Math.round(klDivergence * 100) / 100,
      similarity: Math.round(similarity * 100) / 100,
      dominantShift
    };
  }

  /**
   * 智能建议：基于当前状态给出训练优化建议
   */
  getTrainingAdvice(): string[] {
    const advice: string[] = [];
    const evaluation = this.evaluatePolicy();
    const summary = this.getPolicySummary();
    const recentSuccess = this.getSlidingWindowSuccessRate();
    const avgConfidence = this.getAverageDecisionConfidence();

    if (summary.totalStates < 10) {
      advice.push('【建议】训练样本不足，建议增加更多不同类型的对话输入');
    }

    if (recentSuccess < 0.3) {
      advice.push('【警告】近期成功率偏低，建议检查奖励函数设置和任务难度');
    }

    if (avgConfidence < 0.4) {
      advice.push('【提示】决策置信度偏低，可能需要更多探索或增加训练数据');
    }

    if (evaluation.stabilityScore < 0.5) {
      advice.push('【警告】训练稳定性不足，建议降低学习率至当前的70%');
    }

    if (evaluation.diversityScore < 0.4) {
      advice.push('【建议】策略多样性不足，尝试增加更多类型的用户输入样本');
    }

    if (this.slidingWindow.successes.length + this.slidingWindow.failures.length < this.config.slidingWindowSize / 2) {
      advice.push('【提示】训练样本量不足，建议继续累积更多经验数据');
    }

    if (advice.length === 0) {
      advice.push('【状态良好】当前训练状态正常，继续按当前节奏训练即可');
    }

    return advice;
  }
}
