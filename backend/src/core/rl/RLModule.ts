import { RLState, RLAction, RLExperience } from './types';
import { RewardCalculator } from './RewardCalculator';
import { ExperienceReplay } from './ExperienceReplay';
import { PPOAgent } from './PPOAgent';
import { SpecialEventSystem, SPECIAL_EVENT_TEMPLATES, type SpecialEvent } from './SpecialEvents';
import { TrainingHistory } from '../../models/TrainingHistory';
import { isMongoDBConnected } from '../../utils/database';

/** 训练历史留存的默认用户（未显式指定时使用，与 devModeUserId 口径一致） */
const HISTORY_DEFAULT_USER = 'default';
/** 训练历史内存兜底上限（DB 不可用时仪表盘仍能展示最近数据） */
const HISTORY_MEMORY_LIMIT = 500;
/** 单次仪表盘查询默认返回条数 */
const HISTORY_DEFAULT_LIMIT = 200;
const HISTORY_MAX_LIMIT = 2000;

export class RLModule {
  private rewardCalculator: RewardCalculator;
  private ppoAgent: PPOAgent;
  private experienceReplay: ExperienceReplay;
  private experiences: RLExperience[] = [];
  private specialEvents: SpecialEventSystem;
  private currentEpisodeId?: string;
  private currentStepNumber: number = 0;
  private dialogueFeedbackCount: number = 0;
  private dialogueQualitySum: number = 0;

  constructor() {
    this.rewardCalculator = new RewardCalculator();
    this.specialEvents = new SpecialEventSystem();
    this.ppoAgent = new PPOAgent({}, this.specialEvents);
    this.experienceReplay = new ExperienceReplay();
  }

  /**
   * 设置记忆系统集成
   */
  setMemoryIntegration(memoryCallback: (event: SpecialEvent) => void): void {
    this.specialEvents.setMemoryIntegration(memoryCallback);
  }

  /**
   * 触发特殊事件
   */
  triggerSpecialEvent(
    templateKey: keyof typeof SPECIAL_EVENT_TEMPLATES,
    context: SpecialEvent['context'],
    options?: {
      reward?: number;
      customValues?: Record<string, string | number>;
    }
  ): SpecialEvent {
    return this.specialEvents.trigger(templateKey, context, {
      episodeId: this.currentEpisodeId,
      stepNumber: this.currentStepNumber,
      reward: options?.reward,
      customValues: options?.customValues
    });
  }

  /**
   * 获取特殊事件系统
   */
  getSpecialEventSystem(): SpecialEventSystem {
    return this.specialEvents;
  }

  selectAction(state: RLState): RLAction {
    return this.ppoAgent.getAction(state);
  }

  recordExperience(
    state: RLState, action: RLAction, reward: number, nextState: RLState, done: boolean
  ): void {
    // 使用调整后的奖励
    const adjustedReward = this.ppoAgent.adjustRewardForEvents(reward, state);
    
    console.log('[RLModule] Recording experience:', { 
      originalReward: reward, 
      adjustedReward 
    });

    const experience: RLExperience = {
      state,
      action,
      reward: adjustedReward, // 使用调整后的奖励
      nextState,
      done,
      timestamp: new Date()
    };

    this.experiences.push(experience);
    this.experienceReplay.add(experience, Math.abs(adjustedReward) + 0.01);
    this.ppoAgent.storeExperience(experience);
    this.currentStepNumber++;

    // 根据调整后的奖励触发特殊事件
    if (adjustedReward > 5) {
      this.triggerSpecialEvent('TASK_COMPLETED', { state, action: action.type, result: adjustedReward });
    } else if (adjustedReward < -5) {
      this.triggerSpecialEvent('TASK_FAILED', { state, action: action.type, result: adjustedReward });
    }

    if (this.experiences.length % 10 === 0) {
      this.ppoAgent.train();
      // 训练完成后把最新一次损失指标落库（best-effort，失败仅告警）
      this.persistLatestTrainEvent();
    }
  }

  /**
   * 把 TrainingLogger 里最新一次 train 事件落库。fire-and-forget：
   * 不 await、不抛异常，DB 不可用时训练主流程完全不受影响。
   */
  private persistLatestTrainEvent(): void {
    try {
      if (!isMongoDBConnected()) return;
      const events = this.ppoAgent.getLogger().getEventsByType('train');
      const last = events[events.length - 1];
      if (!last) return;
      void TrainingHistory.create({
        userId: HISTORY_DEFAULT_USER,
        kind: 'train',
        ts: last.timestamp,
        policyLoss: Number(last.data?.policyLoss) || 0,
        valueLoss: Number(last.data?.valueLoss) || 0,
        entropy: Number(last.data?.entropy) || 0
      }).catch((error: Error) => {
        console.warn('[RLModule] 训练记录落库失败：', error.message);
      });
    } catch (error) {
      console.warn('[RLModule] 训练记录落库异常：', (error as Error).message);
    }
  }

  /**
   * episode 结束时把累计奖励与成败落库（best-effort）。
   * 与 persistLatestTrainEvent 同策略：绝不阻塞、绝不抛出。
   */
  persistEpisode(episode: number, reward: number, success: boolean, ts: number = Date.now()): void {
    try {
      if (!isMongoDBConnected()) return;
      void TrainingHistory.create({
        userId: HISTORY_DEFAULT_USER,
        kind: 'episode',
        ts,
        episode: Number.isFinite(episode) ? episode : 0,
        reward: Number.isFinite(reward) ? reward : 0,
        success: Boolean(success)
      }).catch((error: Error) => {
        console.warn('[RLModule] episode 记录落库失败：', error.message);
      });
    } catch (error) {
      console.warn('[RLModule] episode 记录落库异常：', (error as Error).message);
    }
  }

  calculateReward(
    state: RLState,
    action: RLAction,
    nextState: RLState,
    done: boolean,
    metrics: any
  ): number {
    const reward = this.rewardCalculator.calculateReward(state, action, nextState, done, metrics);

    // 检查低置信度
    if (metrics?.confidence && metrics.confidence < 0.5) {
      this.triggerSpecialEvent('LOW_CONFIDENCE', { state, action: action.type, metrics: { confidence: metrics.confidence } });
    }

    return reward; // 返回原始奖励，由recordExperience进行调整
  }

  /**
   * 对话质量反馈闭环：把 DialogueEvaluator 的综合分（0-10）作为奖励信号记录为一条经验。
   * 这是"对话 → 评估 → 强化"闭环的统一入口：内部完成 质量分→奖励换算 → 经验落库 →（每10条）策略训练。
   * @returns 实际记录的奖励值（便于调用方记录日志/指标）
   */
  recordDialogueFeedback(params: {
    state: RLState;
    action: RLAction;
    nextState: RLState;
    done: boolean;
    /** DialogueEvaluator 综合质量分（0-10），越界自动截断 */
    quality: number;
    /** 除质量分外的规则奖励指标（taskCompleted 等） */
    baseMetrics?: {
      taskCompleted?: boolean;
      userSatisfied?: boolean;
      hasHallucination?: boolean;
      responseTime?: number;
      correctToolUsed?: boolean;
      usedRelevantContext?: boolean;
      safetyViolation?: boolean;
      actionRelevant?: boolean;
    };
  }): number {
    const quality = Math.min(10, Math.max(0, Number(params.quality) || 0));
    const reward = this.calculateReward(
      params.state,
      params.action,
      params.nextState,
      params.done,
      { ...params.baseMetrics, dialogueQuality: quality }
    );
    this.recordExperience(params.state, params.action, reward, params.nextState, params.done);
    this.dialogueFeedbackCount++;
    this.dialogueQualitySum += quality;
    return reward;
  }

  getTrainingStats() {
    const fullStats = this.ppoAgent.getFullStats();
    return {
      ...fullStats,
      totalExperiences: this.experiences.length,
      experienceBufferSize: this.experienceReplay.size(),
      recentRewards: this.experiences.slice(-10).map(e => e.reward),
      specialEvents: this.specialEvents.getStats(),
      dialogueFeedback: {
        count: this.dialogueFeedbackCount,
        averageQuality: this.dialogueFeedbackCount > 0
          ? Math.round((this.dialogueQualitySum / this.dialogueFeedbackCount) * 100) / 100
          : 0
      }
    };
  }

  /**
   * 训练历史时间序列（供可视化仪表盘消费）。
   *
   * 数据来源优先级：MongoDB 持久化记录 > TrainingLogger 内存。
   * - DB 可用：返回跨进程存活的完整历史（默认最近 200 条，可调），支持重启后查看长期趋势；
   * - DB 不可用 / 尚无落库记录：自动回退到内存环形缓冲（进程内最近数据），仪表盘不至于空白。
   *
   * @param options.userId 历史归属用户（默认 'default'）
   * @param options.limit  最多返回条数（1~2000，默认 200）
   */
  async getTrainingHistory(options: {
    userId?: string;
    limit?: number;
  } = {}): Promise<{
    trainEvents: Array<{ t: number; policyLoss: number; valueLoss: number; entropy: number }>;
    episodes: Array<{ t: number; episode: number; reward: number; success: boolean }>;
    /** 数据来源：persisted = 来自数据库；memory = 内存回退；empty = 无任何数据 */
    source: 'persisted' | 'memory' | 'empty';
    /** 持久化记录总数（source=persisted 时有效，用于展示"共 N 条"） */
    total?: { trainEvents: number; episodes: number };
  }> {
    const userId = options.userId || HISTORY_DEFAULT_USER;
    const limit = Math.min(HISTORY_MAX_LIMIT, Math.max(1, options.limit ?? HISTORY_DEFAULT_LIMIT));

    if (isMongoDBConnected()) {
      try {
        const [train, episodes, trainTotal, episodeTotal] = await Promise.all([
          TrainingHistory.find({ userId, kind: 'train' }).sort({ ts: -1 }).limit(limit).lean(),
          TrainingHistory.find({ userId, kind: 'episode' }).sort({ ts: -1 }).limit(limit).lean(),
          TrainingHistory.countDocuments({ userId, kind: 'train' }),
          TrainingHistory.countDocuments({ userId, kind: 'episode' })
        ]);

        if (train.length || episodes.length) {
          // 查询时按 ts 倒序取最近 N 条，图上应正序绘制
          const toAsc = <T extends { ts: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.ts - b.ts);
          return {
            trainEvents: toAsc(train).map(r => ({
              t: r.ts,
              policyLoss: Number(r.policyLoss) || 0,
              valueLoss: Number(r.valueLoss) || 0,
              entropy: Number(r.entropy) || 0
            })),
            episodes: toAsc(episodes).map(r => ({
              t: r.ts,
              episode: Number(r.episode) || 0,
              reward: Number(r.reward) || 0,
              success: Boolean(r.success)
            })),
            source: 'persisted',
            total: { trainEvents: trainTotal, episodes: episodeTotal }
          };
        }
      } catch (error) {
        // 查询失败不应中断仪表盘：降级到内存数据
        console.warn('[RLModule] 训练历史查询失败，回退内存数据：', (error as Error).message);
      }
    }

    const logger = this.ppoAgent.getLogger();
    const trainEvents = logger
      .getEventsByType('train')
      .map(e => ({
        t: e.timestamp,
        policyLoss: Number(e.data?.policyLoss) || 0,
        valueLoss: Number(e.data?.valueLoss) || 0,
        entropy: Number(e.data?.entropy) || 0
      }));
    const episodes = logger.getRecentMetrics(100).map(m => ({
      t: m.timestamp,
      episode: m.episode,
      reward: m.reward,
      success: m.success
    }));
    return {
      trainEvents,
      episodes,
      source: trainEvents.length || episodes.length ? 'memory' : 'empty'
    };
  }

  train(): void {
    this.ppoAgent.train();
  }

  clearExperienceBuffer(): void {
    this.experiences = [];
    this.currentStepNumber = 0;
  }

  startEpisode(): void {
    this.currentEpisodeId = `episode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentStepNumber = 0;
    this.ppoAgent.startEpisode();
    
    this.triggerSpecialEvent('EPISODE_MILESTONE', { state: { episodeId: this.currentEpisodeId } }, {
      customValues: { episode: this.currentEpisodeId }
    });
  }

  endEpisode(success: boolean): void {
    this.ppoAgent.endEpisode(success);

    // episode 落库（取刚落库的那条 metric 的累计奖励与编号）
    {
      const metrics = this.ppoAgent.getLogger().getRecentMetrics(1);
      const last = metrics[metrics.length - 1];
      if (last) this.persistEpisode(last.episode, last.reward, success, last.timestamp);
    }

    if (success) {
      this.triggerSpecialEvent('FIRST_SUCCESSFUL_ATTEMPT', { 
        state: { episodeId: this.currentEpisodeId },
        result: success
      });
    } else {
      this.triggerSpecialEvent('TASK_FAILED', {
        state: { episodeId: this.currentEpisodeId },
        result: success
      });
    }
    
    // 不清除episode事件，这样后续训练可以继续使用事件影响策略
    this.currentEpisodeId = undefined;
  }

  getTrainingReport(): string {
    return this.ppoAgent.getTrainingReport();
  }

  exportTrainingData(): string {
    return this.ppoAgent.exportTrainingData();
  }

  getPPOAgent(): PPOAgent {
    return this.ppoAgent;
  }
}
