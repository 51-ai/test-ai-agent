export interface RLState {
  userId: string;
  conversationId?: string;
  currentInput: string;
  conversationHistory: string[];
  availableTools: string[];
  timeOfDay: number;
  userSatisfaction?: number;
  conversationTurns: number;
  lastActionType?: string;
  userMood?: 'positive' | 'neutral' | 'negative';
  inputComplexity: number;
}

export interface RLAction {
  type: 'respond' | 'search' | 'execute_code' | 'summarize' | 'translate' | 'use_tool' | 'ask_clarification';
  toolName?: string;
  parameters?: Record<string, unknown>;
  responseText?: string;
  confidence: number;
}

export interface RLExperience {
  state: RLState;
  action: RLAction;
  reward: number;
  nextState: RLState;
  done: boolean;
  timestamp: Date;
  actionLogProb?: number;
  valueEstimate?: number;
  tdError?: number;
}

export interface RewardConfig {
  taskCompletion: number;
  helpfulResponse: number;
  correctToolUsage: number;
  fastResponse: number;
  userPositiveFeedback: number;
  hallucinationPenalty: number;
  timeoutPenalty: number;
  wrongToolPenalty: number;
  relevantContextBonus: number;
  contextAwarenessBonus: number;
  conversationFlowBonus: number;
  repeatedMistakePenalty: number;
  clarificationBonus: number;
  safetyViolationPenalty: number;
  /** 对话质量分（DialogueEvaluator 0-10）映射为奖励的强度：(quality-5)/5 * scale */
  dialogueQualityScale: number;
}

export const defaultRewardConfig: RewardConfig = {
  taskCompletion: 10,
  helpfulResponse: 3,
  correctToolUsage: 2,
  fastResponse: 1,
  userPositiveFeedback: 5,
  hallucinationPenalty: -5,
  timeoutPenalty: -2,
  wrongToolPenalty: -3,
  relevantContextBonus: 2,
  contextAwarenessBonus: 3,
  conversationFlowBonus: 2,
  repeatedMistakePenalty: -4,
  clarificationBonus: 1,
  safetyViolationPenalty: -10,
  dialogueQualityScale: 3
};

export interface RLTrainingStats {
  totalUpdates: number;
  totalExperiences: number;
  averageReward: number;
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  lastUpdateTime?: Date;
  successRate: number;
  policyLossTrend?: number;
}

export interface Trajectory {
  states: RLState[];
  actions: RLAction[];
  rewards: number[];
  logProbs: number[];
  values: number[];
}

export interface PolicyGradient {
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  totalLoss: number;
}
