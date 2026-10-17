import { RLState, RLAction, RLExperience } from './types';

interface TrainingEvent {
  timestamp: number;
  type: 'experience' | 'train' | 'action' | 'reward' | 'phase-change' | 'error';
  data: any;
}

interface TrainingMetric {
  timestamp: number;
  episode: number;
  reward: number;
  success: boolean;
  duration: number;
}

export class TrainingLogger {
  private events: TrainingEvent[] = [];
  private metrics: TrainingMetric[] = [];
  private maxEvents: number = 1000;
  private maxMetrics: number = 100;
  private episodeStartTime?: number;
  private currentEpisode: number = 0;
  private episodeRewards: number[] = [];

  constructor() {}

  /**
   * 记录体验
   */
  logExperience(experience: RLExperience): void {
    this.addEvent('experience', {
      state: experience.state,
      action: experience.action,
      reward: experience.reward,
      done: experience.done
    });
  }

  /**
   * 记录动作
   */
  logAction(state: RLState, action: RLAction, epsilon?: number): void {
    this.addEvent('action', {
      state: state,
      action: action,
      epsilon: epsilon
    });
  }

  /**
   * 记录奖励
   */
  logReward(reward: number, reason?: string): void {
    this.addEvent('reward', {
      reward: reward,
      reason: reason || 'unknown'
    });
    
    this.episodeRewards.push(reward);
  }

  /**
   * 记录训练
   */
  logTraining(stats: {
    policyLoss: number;
    valueLoss: number;
    entropy: number;
    totalLoss: number;
    batchSize: number;
  }): void {
    this.addEvent('train', stats);
  }

  /**
   * 记录阶段变化
   */
  logPhaseChange(phase: string, details?: any): void {
    this.addEvent('phase-change', {
      phase: phase,
      details: details
    });
  }

  /**
   * 记录错误
   */
  logError(error: Error | string, context?: any): void {
    this.addEvent('error', {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context: context
    });
  }

  /**
   * 开始新的 episode
   */
  startEpisode(): void {
    this.currentEpisode++;
    this.episodeStartTime = Date.now();
    this.episodeRewards = [];
  }

  /**
   * 结束 episode
   */
  endEpisode(success: boolean): void {
    const endTime = Date.now();
    const duration = this.episodeStartTime ? endTime - this.episodeStartTime : 0;
    const totalReward = this.episodeRewards.reduce((sum, r) => sum + r, 0);
    
    const metric: TrainingMetric = {
      timestamp: endTime,
      episode: this.currentEpisode,
      reward: totalReward,
      success: success,
      duration: duration
    };
    
    this.metrics.push(metric);
    
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    this.episodeStartTime = undefined;
  }

  private addEvent(type: TrainingEvent['type'], data: any): void {
    const event: TrainingEvent = {
      timestamp: Date.now(),
      type,
      data
    };
    
    this.events.push(event);
    
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * 获取训练指标统计
   */
  getMetricsStats() {
    if (this.metrics.length === 0) {
      return { totalEpisodes: 0 };
    }
    
    const rewards = this.metrics.map(m => m.reward);
    const successRate = this.metrics.filter(m => m.success).length / this.metrics.length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;
    
    const recentMetrics = this.metrics.slice(-10);
    const recentSuccessRate = recentMetrics.length > 0 
      ? recentMetrics.filter(m => m.success).length / recentMetrics.length 
      : 0;
    const recentAvgReward = recentMetrics.reduce((sum, m) => sum + m.reward, 0) / recentMetrics.length;
    
    return {
      totalEpisodes: this.metrics.length,
      averageReward: rewards.reduce((sum, r) => sum + r, 0) / this.metrics.length,
      maxReward: Math.max(...rewards),
      minReward: Math.min(...rewards),
      successRate,
      averageDuration: avgDuration,
      recentStats: {
        successRate: recentSuccessRate,
        averageReward: recentAvgReward
      }
    };
  }

  /**
   * 获取最近的事件
   */
  getRecentEvents(count: number = 50): TrainingEvent[] {
    return this.events.slice(-count);
  }

  /**
   * 获取最近的指标
   */
  getRecentMetrics(count: number = 20): TrainingMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * 获取所有事件按类型分组
   */
  getEventsByType(type: TrainingEvent['type']): TrainingEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * 导出训练日志
   */
  exportLogs(): string {
    return JSON.stringify({
      version: '1.0',
      exportTime: Date.now(),
      events: this.events,
      metrics: this.metrics,
      stats: this.getMetricsStats()
    }, null, 2);
  }

  /**
   * 生成训练报告
   */
  generateReport(): string {
    const stats = this.getMetricsStats();
    const recentEvents = this.getRecentEvents(20);
    
    let report = '=== TRAINING REPORT ===\n\n';
    report += `Total Episodes: ${stats.totalEpisodes}\n`;
    report += `Average Reward: ${(stats.averageReward || 0).toFixed(2)}\n`;
    report += `Best Reward: ${(stats.maxReward || 0).toFixed(2)}\n`;
    report += `Success Rate: ${((stats.successRate || 0) * 100).toFixed(1)}%\n`;
    report += `Average Duration: ${(stats.averageDuration || 0).toFixed(0)}ms\n\n`;
    
    if (stats.recentStats) {
      report += '--- Recent Performance ---\n';
      report += `Recent Success Rate: ${(stats.recentStats.successRate * 100).toFixed(1)}%\n`;
      report += `Recent Average Reward: ${stats.recentStats.averageReward.toFixed(2)}\n\n`;
    }
    
    report += '--- Recent Events ---\n';
    for (const event of recentEvents.reverse()) {
      const date = new Date(event.timestamp);
      const timeStr = date.toLocaleTimeString();
      report += `[${timeStr}] ${event.type.toUpperCase()}: `;
      report += JSON.stringify(event.data).substring(0, 100);
      if (JSON.stringify(event.data).length > 100) report += '...';
      report += '\n';
    }
    
    return report;
  }

  /**
   * 清除日志
   */
  clear(): void {
    this.events = [];
    this.metrics = [];
    this.currentEpisode = 0;
    this.episodeRewards = [];
    this.episodeStartTime = undefined;
  }
}

export class MetricsVisualizer {
  private logger: TrainingLogger;

  constructor(logger: TrainingLogger) {
    this.logger = logger;
  }

  /**
   * 生成简单的 ASCII 图表
   */
  generateRewardChart(width: number = 40, height: number = 10): string {
    const metrics = this.logger.getRecentMetrics(width);
    if (metrics.length === 0) return 'No data to display';
    
    const rewards = metrics.map(m => m.reward);
    const maxReward = Math.max(...rewards, 1);
    const minReward = Math.min(...rewards, 0);
    const range = maxReward - minReward || 1;
    
    let chart = '';
    
    for (let row = 0; row < height; row++) {
      const y = 1 - row / height;
      const currentLevel = minReward + range * y;
      
      let line = '';
      for (let col = 0; col < Math.min(width, metrics.length); col++) {
        const reward = rewards[col];
        if (reward >= currentLevel && reward < currentLevel + range / height) {
          line += '■';
        } else {
          line += ' ';
        }
      }
      chart += line + '\n';
    }
    
    chart += '-'.repeat(Math.min(width, metrics.length)) + '\n';
    chart += `Rewards (min: ${minReward.toFixed(1)}, max: ${maxReward.toFixed(1)})`;
    
    return chart;
  }

  /**
   * 生成成功率图表
   */
  generateSuccessRateChart(width: number = 40, windowSize: number = 10): string {
    const metrics = this.logger.getRecentMetrics(width * windowSize);
    if (metrics.length === 0) return 'No data to display';
    
    const windows: number[] = [];
    for (let i = 0; i < metrics.length; i += windowSize) {
      const window = metrics.slice(i, i + windowSize);
      const successRate = window.filter(m => m.success).length / window.length;
      windows.push(successRate);
    }
    
    let chart = '';
    for (const rate of windows) {
      const fill = Math.round(rate * 10);
      chart += '[' + '█'.repeat(fill) + ' '.repeat(10 - fill) + '] ';
      chart += `${(rate * 100).toFixed(0)}%\n`;
    }
    
    return chart;
  }

  /**
   * 生成可视化报告
   */
  generateVisualReport(): string {
    const report = this.logger.generateReport();
    const rewardChart = this.generateRewardChart();
    const successChart = this.generateSuccessRateChart();
    
    return `${report}\n\n=== REWARD CHART ===\n${rewardChart}\n\n=== SUCCESS RATE ===\n${successChart}`;
  }
}
