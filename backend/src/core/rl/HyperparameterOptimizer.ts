export interface HyperparameterConfig {
  learningRate: number;
  gamma: number;
  clipEpsilon: number;
  batchSize: number;
  epochs: number;
  valueLossCoef: number;
  entropyCoef: number;
  maxGradientNorm: number;
  gaeLambda: number;
}

export interface HyperparameterTrial {
  id: string;
  config: HyperparameterConfig;
  performance: {
    averageReward: number;
    successRate: number;
    taskCompletion: number;
  };
  timestamp: number;
}

export class HyperparameterOptimizer {
  private trials: HyperparameterTrial[] = [];
  private bestTrial?: HyperparameterTrial;
  private searchSpace: Partial<HyperparameterConfig> = {};

  constructor() {
    this.initializeSearchSpace();
  }

  private initializeSearchSpace(): void {
    this.searchSpace = {
      learningRate: 0.0001,
      gamma: 0.99,
      clipEpsilon: 0.2,
      batchSize: 32,
      epochs: 10,
      valueLossCoef: 0.5,
      entropyCoef: 0.01,
      maxGradientNorm: 0.5,
      gaeLambda: 0.95
    };
  }

  /**
   * 生成随机超参数配置
   */
  generateRandomConfig(): HyperparameterConfig {
    return {
      learningRate: this.randomBetween(1e-5, 1e-2),
      gamma: this.randomBetween(0.9, 0.999),
      clipEpsilon: this.randomBetween(0.1, 0.3),
      batchSize: Math.floor(this.randomBetween(8, 128)),
      epochs: Math.floor(this.randomBetween(3, 30)),
      valueLossCoef: this.randomBetween(0.1, 1.0),
      entropyCoef: this.randomBetween(0.001, 0.1),
      maxGradientNorm: this.randomBetween(0.1, 1.0),
      gaeLambda: this.randomBetween(0.9, 1.0)
    };
  }

  /**
   * 使用网格搜索生成配置
   */
  generateGridSearchConfigs(): HyperparameterConfig[] {
    const configs: HyperparameterConfig[] = [];
    const baseConfig = this.getDefaultConfig();
    
    const lrValues = [0.0001, 0.0003, 0.001, 0.003];
    const gammaValues = [0.95, 0.99, 0.995];
    const clipValues = [0.1, 0.2, 0.25];
    
    for (const lr of lrValues) {
      for (const gamma of gammaValues) {
        for (const clip of clipValues) {
          configs.push({
            ...baseConfig,
            learningRate: lr,
            gamma: gamma,
            clipEpsilon: clip
          });
        }
      }
    }
    
    return configs;
  }

  /**
   * 记录试验结果
   */
  recordTrial(config: HyperparameterConfig, performance: {
    averageReward: number;
    successRate: number;
    taskCompletion: number;
  }): HyperparameterTrial {
    const trial: HyperparameterTrial = {
      id: `trial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      config,
      performance,
      timestamp: Date.now()
    };
    
    this.trials.push(trial);
    
    if (!this.bestTrial || performance.averageReward > this.bestTrial.performance.averageReward) {
      this.bestTrial = trial;
    }
    
    return trial;
  }

  /**
   * 获取最佳配置
   */
  getBestConfig(): HyperparameterConfig {
    if (this.bestTrial) {
      return this.bestTrial.config;
    }
    return this.getDefaultConfig();
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): HyperparameterConfig {
    return {
      learningRate: 0.0003,
      gamma: 0.99,
      clipEpsilon: 0.2,
      batchSize: 32,
      epochs: 10,
      valueLossCoef: 0.5,
      entropyCoef: 0.01,
      maxGradientNorm: 0.5,
      gaeLambda: 0.95
    };
  }

  /**
   * 优化推荐配置
   */
  recommendNextConfig(): HyperparameterConfig {
    if (this.trials.length < 3) {
      return this.generateRandomConfig();
    }
    
    const bestConfigs = this.trials
      .sort((a, b) => b.performance.averageReward - a.performance.averageReward)
      .slice(0, 3);
    
    if (bestConfigs.length === 0) {
      return this.getDefaultConfig();
    }
    
    const avgConfig: Partial<HyperparameterConfig> = {};
    const keys = Object.keys(bestConfigs[0].config) as Array<keyof HyperparameterConfig>;
    
    for (const key of keys) {
      avgConfig[key] = bestConfigs.reduce((sum, t) => sum + t.config[key], 0) / bestConfigs.length;
    }
    
    const noise = 0.1;
    return {
      learningRate: this.addNoise(avgConfig.learningRate || 0.0003, noise),
      gamma: this.addNoise(avgConfig.gamma || 0.99, noise * 0.05),
      clipEpsilon: this.addNoise(avgConfig.clipEpsilon || 0.2, noise * 0.3),
      batchSize: Math.floor(this.addNoise(avgConfig.batchSize || 32, noise * 20)),
      epochs: Math.floor(this.addNoise(avgConfig.epochs || 10, noise * 5)),
      valueLossCoef: this.addNoise(avgConfig.valueLossCoef || 0.5, noise),
      entropyCoef: this.addNoise(avgConfig.entropyCoef || 0.01, noise),
      maxGradientNorm: this.addNoise(avgConfig.maxGradientNorm || 0.5, noise),
      gaeLambda: this.addNoise(avgConfig.gaeLambda || 0.95, noise * 0.05)
    };
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(): HyperparameterTrial[] {
    return [...this.trials].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取统计信息
   */
  getOptimizationStats() {
    if (this.trials.length === 0) {
      return { totalTrials: 0 };
    }
    
    const rewards = this.trials.map(t => t.performance.averageReward);
    return {
      totalTrials: this.trials.length,
      bestReward: Math.max(...rewards),
      avgReward: rewards.reduce((a, b) => a + b, 0) / rewards.length,
      worstReward: Math.min(...rewards),
      bestTrial: this.bestTrial
    };
  }

  /**
   * 导出优化结果
   */
  exportResults(): string {
    return JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      trials: this.trials,
      bestTrial: this.bestTrial
    }, null, 2);
  }

  /**
   * 导入优化结果
   */
  importResults(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.trials) {
        this.trials = data.trials;
        this.bestTrial = data.bestTrial;
        return true;
      }
    } catch (e) {
      console.error('[HyperparameterOptimizer] Failed to import results:', e);
    }
    return false;
  }

  /**
   * 重置优化器
   */
  reset(): void {
    this.trials = [];
    this.bestTrial = undefined;
  }

  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private addNoise(value: number, noiseScale: number): number {
    const noise = (Math.random() - 0.5) * noiseScale;
    return Math.max(0.00001, value + noise);
  }
}
