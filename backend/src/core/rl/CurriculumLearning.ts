import { RLState, RLAction } from './types';

interface CurriculumStage {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  complexityThreshold: number;
  successThreshold: number;
  minAttempts: number;
}

export interface LessonState {
  stageId: string;
  attempts: number;
  successes: number;
  totalReward: number;
  averageReward: number;
}

export class CurriculumLearning {
  private stages: CurriculumStage[] = [];
  private currentStageIndex = 0;
  private lessonStates: Map<string, LessonState> = new Map();
  private currentStageStartTimestamp: number = Date.now();
  private stageSuccessHistory: Map<string, boolean[]> = new Map();

  constructor() {
    this.initializeDefaultStages();
  }

  private initializeDefaultStages(): void {
    this.stages = [
      {
        id: 'intro',
        name: 'Introduction',
        description: '简单的对话和问候',
        difficulty: 1,
        complexityThreshold: 0.2,
        successThreshold: 0.8,
        minAttempts: 10
      },
      {
        id: 'qa',
        name: 'Question Answering',
        description: '回答基本问题',
        difficulty: 2,
        complexityThreshold: 0.4,
        successThreshold: 0.75,
        minAttempts: 15
      },
      {
        id: 'tools',
        name: 'Tool Usage',
        description: '使用简单工具',
        difficulty: 3,
        complexityThreshold: 0.6,
        successThreshold: 0.7,
        minAttempts: 20
      },
      {
        id: 'planning',
        name: 'Task Planning',
        description: '多步任务规划',
        difficulty: 4,
        complexityThreshold: 0.8,
        successThreshold: 0.65,
        minAttempts: 25
      },
      {
        id: 'advanced',
        name: 'Advanced Tasks',
        description: '复杂任务处理',
        difficulty: 5,
        complexityThreshold: 1.0,
        successThreshold: 0.6,
        minAttempts: 30
      }
    ];
  }

  /**
   * 获取当前阶段
   */
  getCurrentStage(): CurriculumStage {
    return this.stages[this.currentStageIndex];
  }

  /**
   * 获取所有阶段
   */
  getAllStages(): CurriculumStage[] {
    return [...this.stages];
  }

  /**
   * 记录尝试
   */
  recordAttempt(success: boolean, reward: number): void {
    const stage = this.getCurrentStage();
    const state = this.lessonStates.get(stage.id) || {
      stageId: stage.id,
      attempts: 0,
      successes: 0,
      totalReward: 0,
      averageReward: 0
    };
    
    state.attempts++;
    state.totalReward += reward;
    state.averageReward = state.totalReward / state.attempts;
    
    if (success) {
      state.successes++;
    }
    
    let history = this.stageSuccessHistory.get(stage.id) || [];
    history.push(success);
    if (history.length > 50) {
      history = history.slice(-50);
    }
    this.stageSuccessHistory.set(stage.id, history);
    
    this.lessonStates.set(stage.id, state);
    this.checkStageAdvancement();
  }

  /**
   * 检查是否可以进阶
   */
  private checkStageAdvancement(): void {
    const state = this.lessonStates.get(this.getCurrentStage().id);
    if (!state) return;
    
    const stage = this.getCurrentStage();
    const successRate = state.attempts > 0 ? state.successes / state.attempts : 0;
    
    const recentHistory = this.stageSuccessHistory.get(stage.id) || [];
    const recentSuccessRate = recentHistory.length > 0 
      ? recentHistory.filter(s => s).length / recentHistory.length 
      : successRate;
    
    if (state.attempts >= stage.minAttempts && recentSuccessRate >= stage.successThreshold) {
      this.advanceStage();
    }
  }

  /**
   * 进阶到下一阶段
   */
  private advanceStage(): boolean {
    if (this.currentStageIndex >= this.stages.length - 1) {
      return false;
    }
    
    this.currentStageIndex++;
    this.currentStageStartTimestamp = Date.now();
    console.log(`[CurriculumLearning] Advanced to stage: ${this.getCurrentStage().name}`);
    return true;
  }

  /**
   * 重置到指定阶段
   */
  resetToStage(stageId: string): boolean {
    const stageIndex = this.stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) return false;
    
    this.currentStageIndex = stageIndex;
    this.currentStageStartTimestamp = Date.now();
    return true;
  }

  /**
   * 完全重置
   */
  reset(): void {
    this.currentStageIndex = 0;
    this.currentStageStartTimestamp = Date.now();
    this.lessonStates.clear();
    this.stageSuccessHistory.clear();
  }

  /**
   * 根据当前阶段调整探索率
   */
  getEpsilonForCurrentStage(baseEpsilon: number = 0.1): number {
    const stage = this.getCurrentStage();
    const difficultyFactor = 1 - (stage.difficulty - 1) * 0.15;
    
    const state = this.lessonStates.get(stage.id);
    const masteryFactor = state 
      ? Math.max(0.2, 1 - (state.successes / Math.max(1, state.attempts))) 
      : 1;
    
    return Math.max(0.01, baseEpsilon * difficultyFactor * masteryFactor);
  }

  /**
   * 根据当前阶段获取任务复杂度
   */
  getComplexityForCurrentStage(): number {
    return this.getCurrentStage().complexityThreshold;
  }

  /**
   * 获取课程学习统计信息
   */
  getCurriculumStats() {
    const currentStage = this.getCurrentStage();
    const state = this.lessonStates.get(currentStage.id);
    
    return {
      currentStage: {
        id: currentStage.id,
        name: currentStage.name,
        difficulty: currentStage.difficulty,
        progress: state ? {
          attempts: state.attempts,
          successes: state.successes,
          successRate: state.attempts > 0 ? state.successes / state.attempts : 0,
          averageReward: state.averageReward
        } : null
      },
      overallProgress: {
        completedStages: this.currentStageIndex,
        totalStages: this.stages.length,
        progressPercentage: ((this.currentStageIndex + 1) / this.stages.length) * 100
      },
      stageHistory: Array.from(this.lessonStates.entries()).map(([id, s]) => ({
        stageId: id,
        attempts: s.attempts,
        successRate: s.attempts > 0 ? s.successes / s.attempts : 0
      }))
    };
  }

  /**
   * 获取建议的下一步动作
   */
  getSuggestedActionForStage(): RLAction['type'] {
    const stage = this.getCurrentStage();
    
    switch (stage.id) {
      case 'intro':
        return 'respond';
      case 'qa':
        return 'respond';
      case 'tools':
        return 'search';
      case 'planning':
        return 'execute_code';
      case 'advanced':
        return 'search';
      default:
        return 'respond';
    }
  }

  /**
   * 添加自定义阶段
   */
  addCustomStage(stage: CurriculumStage): void {
    this.stages.push(stage);
  }

  /**
   * 导出课程学习数据
   */
  exportCurriculum(): string {
    return JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      currentStageIndex: this.currentStageIndex,
      stages: this.stages,
      lessonStates: Array.from(this.lessonStates.entries()),
      stageSuccessHistory: Array.from(this.stageSuccessHistory.entries())
    }, null, 2);
  }

  /**
   * 导入课程学习数据
   */
  importCurriculum(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.stages && data.lessonStates) {
        this.stages = data.stages;
        this.currentStageIndex = data.currentStageIndex || 0;
        this.lessonStates = new Map(data.lessonStates);
        this.stageSuccessHistory = new Map(data.stageSuccessHistory || []);
        return true;
      }
    } catch (e) {
      console.error('[CurriculumLearning] Failed to import:', e);
    }
    return false;
  }
}

export class AdaptiveExploration {
  private epsilon: number = 0.1;
  private minEpsilon: number = 0.01;
  private maxEpsilon: number = 0.5;
  private decayRate: number = 0.995;
  private successHistory: boolean[] = [];
  private rewardHistory: number[] = [];
  private strategy: 'epsilon-greedy' | 'boltzmann' | 'ucb' = 'epsilon-greedy';

  constructor() {}

  /**
   * 获取探索率
   */
  getEpsilon(): number {
    return this.epsilon;
  }

  /**
   * 根据表现动态调整探索率
   */
  updateEpsilon(success: boolean, reward: number): number {
    this.successHistory.push(success);
    this.rewardHistory.push(reward);
    
    if (this.successHistory.length > 100) {
      this.successHistory = this.successHistory.slice(-100);
      this.rewardHistory = this.rewardHistory.slice(-100);
    }
    
    const recentSuccessRate = this.getRecentSuccessRate();
    const recentAverageReward = this.getRecentAverageReward();
    
    if (recentSuccessRate > 0.8) {
      this.epsilon *= this.decayRate;
    } else if (recentSuccessRate < 0.4) {
      this.epsilon *= 1.05;
    }
    
    if (recentAverageReward < 0) {
      this.epsilon *= 1.02;
    }
    
    this.epsilon = Math.max(this.minEpsilon, Math.min(this.maxEpsilon, this.epsilon));
    
    return this.epsilon;
  }

  /**
   * 获取最近成功率
   */
  getRecentSuccessRate(): number {
    if (this.successHistory.length === 0) return 0.5;
    const recent = this.successHistory.slice(-20);
    return recent.filter(s => s).length / recent.length;
  }

  /**
   * 获取最近平均奖励
   */
  getRecentAverageReward(): number {
    if (this.rewardHistory.length === 0) return 0;
    const recent = this.rewardHistory.slice(-20);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  /**
   * 基于 Boltzmann 探索选择动作
   */
  selectWithBoltzmann(policy: Record<string, number>, temperature: number = 0.5): string {
    const actions = Object.keys(policy);
    const adjusted = actions.map(action => {
      const value = Math.log(policy[action] || 0.01);
      return { action, value: Math.exp(value / temperature) };
    });
    
    const total = adjusted.reduce((sum, a) => sum + a.value, 0);
    const normalized = adjusted.map(a => ({ ...a, probability: a.value / total }));
    
    let cumulative = 0;
    const rand = Math.random();
    for (const item of normalized) {
      cumulative += item.probability;
      if (rand <= cumulative) {
        return item.action;
      }
    }
    
    return actions[0];
  }

  /**
   * 设置探索策略
   */
  setStrategy(strategy: 'epsilon-greedy' | 'boltzmann' | 'ucb'): void {
    this.strategy = strategy;
  }

  /**
   * 重置探索率
   */
  reset(): void {
    this.epsilon = 0.1;
    this.successHistory = [];
    this.rewardHistory = [];
  }

  /**
   * 获取探索统计信息
   */
  getExplorationStats() {
    return {
      currentEpsilon: this.epsilon,
      strategy: this.strategy,
      recentSuccessRate: this.getRecentSuccessRate(),
      recentAverageReward: this.getRecentAverageReward(),
      historySize: this.successHistory.length
    };
  }
}
