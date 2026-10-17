import { RLState, RLAction, RLExperience, RLTrainingStats } from './types';

export interface DQNConfig {
  learningRate: number;
  gamma: number;
  epsilonStart: number;
  epsilonEnd: number;
  epsilonDecay: number;
  targetUpdateFreq: number;
  batchSize: number;
}

export const defaultDQNConfig: DQNConfig = {
  learningRate: 0.001,
  gamma: 0.99,
  epsilonStart: 1.0,
  epsilonEnd: 0.01,
  epsilonDecay: 0.995,
  targetUpdateFreq: 100,
  batchSize: 32
};

interface QTable {
  [key: string]: { [action: string]: number };
}

export class DQNAgent {
  private config: DQNConfig;
  private qTable: QTable = {};
  private targetQTable: QTable = {};
  private trainingStats: RLTrainingStats;
  private epsilon: number;
  private updateCounter: number = 0;

  private actions: RLAction[] = [
    { type: 'respond' as const, confidence: 0.8 },
    { type: 'search' as const, confidence: 0.8 },
    { type: 'execute_code' as const, confidence: 0.8 },
    { type: 'summarize' as const, confidence: 0.8 },
    { type: 'translate' as const, confidence: 0.8 },
    { type: 'ask_clarification' as const, confidence: 0.8 }
  ];

  constructor(config: Partial<DQNConfig> = {}) {
    this.config = { ...defaultDQNConfig, ...config };
    this.epsilon = this.config.epsilonStart;
    this.trainingStats = {
      totalUpdates: 0,
      totalExperiences: 0,
      averageReward: 0,
      policyLoss: 0,
      valueLoss: 0,
      entropy: 0,
      successRate: 0
    };
  }

  getAction(state: RLState): RLAction {
    if (Math.random() < this.epsilon) {
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    }

    const stateKey = this.getStateKey(state);
    const qValues = this.getQValues(stateKey);
    const bestAction = this.argmax(qValues);
    
    return { ...bestAction, confidence: 0.8 };
  }

  private getStateKey(state: RLState): string {
    const inputHash = state.currentInput.substring(0, Math.min(state.currentInput.length, 50));
    const historyHash = state.conversationHistory.length.toString();
    return `${inputHash}|${historyHash}`;
  }

  private getQValues(stateKey: string): { [action: string]: number } {
    if (!this.qTable[stateKey]) {
      this.qTable[stateKey] = {};
      this.actions.forEach(action => {
        this.qTable[stateKey][action.type] = Math.random() * 0.1;
      });
    }
    return this.qTable[stateKey];
  }

  private getTargetQValues(stateKey: string): { [action: string]: number } {
    if (!this.targetQTable[stateKey]) {
      this.targetQTable[stateKey] = {};
      this.actions.forEach(action => {
        this.targetQTable[stateKey][action.type] = Math.random() * 0.1;
      });
    }
    return this.targetQTable[stateKey];
  }

  private argmax(qValues: { [action: string]: number }): RLAction {
    let bestValue = -Infinity;
    let bestAction: RLAction = this.actions[0];

    for (const action of this.actions) {
      const value = qValues[action.type] || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  private maxQ(qValues: { [action: string]: number }): number {
    return Math.max(...Object.values(qValues));
  }

  updateQValue(experience: RLExperience): void {
    const stateKey = this.getStateKey(experience.state);
    const nextStateKey = this.getStateKey(experience.nextState);
    const qValues = this.getQValues(stateKey);
    const targetQValues = this.getTargetQValues(nextStateKey);

    const oldValue = qValues[experience.action.type] || 0;
    const nextMaxQ = this.maxQ(targetQValues);
    
    const target = experience.done 
      ? experience.reward 
      : experience.reward + this.config.gamma * nextMaxQ;

    const newValue = oldValue + this.config.learningRate * (target - oldValue);
    qValues[experience.action.type] = newValue;

    this.updateCounter++;
    if (this.updateCounter % this.config.targetUpdateFreq === 0) {
      this.updateTargetNetwork();
    }

    this.updateEpsilon();

    this.trainingStats.totalUpdates++;
  }

  private updateTargetNetwork(): void {
    this.targetQTable = JSON.parse(JSON.stringify(this.qTable));
  }

  private updateEpsilon(): void {
    this.epsilon = Math.max(
      this.config.epsilonEnd,
      this.epsilon * this.config.epsilonDecay
    );
  }

  storeExperience(experience: RLExperience): void {
    this.trainingStats.totalExperiences++;
    this.trainingStats.averageReward = 
      (this.trainingStats.averageReward * (this.trainingStats.totalExperiences - 1) + experience.reward) / 
      this.trainingStats.totalExperiences;
  }

  updateSuccessRate(success: boolean): void {
    const weight = 0.01;
    this.trainingStats.successRate = 
      this.trainingStats.successRate * (1 - weight) + (success ? 1 : 0) * weight;
  }

  getEpsilon(): number {
    return this.epsilon;
  }

  getTrainingStats(): RLTrainingStats {
    return this.trainingStats;
  }

  reset(): void {
    this.qTable = {};
    this.targetQTable = {};
    this.epsilon = this.config.epsilonStart;
    this.updateCounter = 0;
    this.trainingStats = {
      totalUpdates: 0,
      totalExperiences: 0,
      averageReward: 0,
      policyLoss: 0,
      valueLoss: 0,
      entropy: 0,
      successRate: 0
    };
  }

  updateConfig(newConfig: Partial<DQNConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getCurrentConfig(): DQNConfig {
    return { ...this.config };
  }

  exportQTable(): string {
    return JSON.stringify(this.qTable, null, 2);
  }

  importQTable(data: string): void {
    try {
      this.qTable = JSON.parse(data);
    } catch (e) {
      console.error('Failed to import Q-table:', e);
    }
  }
}
