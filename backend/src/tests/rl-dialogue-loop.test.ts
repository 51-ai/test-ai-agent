import { describe, it, expect } from '@jest/globals';
import { RewardCalculator } from '../core/rl/RewardCalculator';
import { RLModule } from '../core/rl/RLModule';
import { DialogueEvaluator } from '../core/agent-core/DialogueEvaluator';
import type { RLState, RLAction } from '../core/rl/types';

/**
 * RL↔DialogueEvaluator 闭环测试：
 * 对话质量分（0-10）作为奖励信号进入 RL 经验池，驱动策略训练。
 */

const mkState = (userId: string): RLState => ({
  userId,
  currentInput: '如何重置账户密码',
  conversationHistory: [],
  availableTools: [],
  timeOfDay: Date.now(),
  conversationTurns: 1,
  inputComplexity: 0.5
});

const respondAction = (confidence = 0.8): RLAction => ({ type: 'respond', confidence });

describe('RewardCalculator — dialogueQuality 奖励分量', () => {
  // 每次断言用独立实例，避免 repeatedMistake 历史污染差值
  const rewardWith = (quality?: number, scale?: number) =>
    new RewardCalculator(scale === undefined ? {} : { dialogueQualityScale: scale }).calculateReward(
      mkState('u1'),
      respondAction(),
      mkState('u1'),
      true,
      quality === undefined ? {} : { dialogueQuality: quality }
    );

  it('满分 10 相比中性 5 多得 +scale（默认 3）', () => {
    expect(rewardWith(10) - rewardWith(5)).toBeCloseTo(3, 6);
  });

  it('低分 1 相比中性 5 少得 -2.4（scale=3 时）', () => {
    expect(rewardWith(1) - rewardWith(5)).toBeCloseTo(-2.4, 6);
  });

  it('中性 5 分不改变奖励（向后兼容）', () => {
    expect(rewardWith(5)).toBe(rewardWith(undefined));
  });

  it('越界分数被截断到 [0,10]', () => {
    expect(rewardWith(99)).toBe(rewardWith(10));
    expect(rewardWith(-7)).toBe(rewardWith(0));
  });

  it('自定义 scale 生效', () => {
    expect(rewardWith(10, 5) - rewardWith(5, 5)).toBeCloseTo(5, 6);
  });
});

describe('RLModule.recordDialogueFeedback — 闭环入口', () => {
  it('记录经验并统计质量反馈', () => {
    const rl = new RLModule();
    const before = rl.getTrainingStats().totalExperiences;

    const reward = rl.recordDialogueFeedback({
      state: mkState('u1'),
      action: respondAction(),
      nextState: { ...mkState('u1'), conversationTurns: 2 },
      done: true,
      quality: 8
    });

    expect(typeof reward).toBe('number');
    expect(rl.getTrainingStats().totalExperiences).toBe(before + 1);

    const stats = rl.getTrainingStats();
    expect(stats.dialogueFeedback.count).toBe(1);
    expect(stats.dialogueFeedback.averageQuality).toBe(8);
  });

  it('多次反馈的平均质量分正确', () => {
    const rl = new RLModule();
    for (const q of [8, 4]) {
      rl.recordDialogueFeedback({
        state: mkState('u1'),
        action: respondAction(),
        nextState: { ...mkState('u1'), conversationTurns: 2 },
        done: true,
        quality: q
      });
    }
    expect(rl.getTrainingStats().dialogueFeedback).toMatchObject({ count: 2, averageQuality: 6 });
  });

  it('越界质量分被截断后再统计', () => {
    const rl = new RLModule();
    rl.recordDialogueFeedback({
      state: mkState('u1'),
      action: respondAction(),
      nextState: { ...mkState('u1'), conversationTurns: 2 },
      done: true,
      quality: 50
    });
    expect(rl.getTrainingStats().dialogueFeedback.averageQuality).toBe(10);
  });

  it('无反馈时统计为零值', () => {
    const rl = new RLModule();
    expect(rl.getTrainingStats().dialogueFeedback).toEqual({ count: 0, averageQuality: 0 });
  });
});

describe('RLModule.getTrainingHistory — 仪表盘时间序列', () => {
  it('多次训练后返回 train 事件序列', async () => {
    const rl = new RLModule();
    // 每 10 条经验触发一次 ppoAgent.train()；但 train() 要求经验数 ≥ batchSize（默认 32）
    // 才真正训练并 logTraining，故至少需要 40 条（第 10/20/30/40 条各触发一次）
    for (let i = 0; i < 40; i++) {
      rl.recordExperience(mkState('hist'), respondAction(), 1 + (i % 3), { ...mkState('hist'), conversationTurns: 2 }, false);
    }
    const hist = await rl.getTrainingHistory();
    expect(hist.trainEvents.length).toBeGreaterThanOrEqual(1);
    expect(hist.trainEvents[0]).toHaveProperty('policyLoss');
    expect(hist.trainEvents[0]).toHaveProperty('valueLoss');
    expect(hist.trainEvents[0]).toHaveProperty('entropy');
  });

  it('episode 闭环后产生带奖励与成败的序列', async () => {
    const rl = new RLModule();
    rl.startEpisode();
    rl.recordExperience(mkState('ep'), respondAction(), 2.5, { ...mkState('ep'), conversationTurns: 2 }, false);
    rl.recordExperience(mkState('ep'), respondAction(), 1.5, { ...mkState('ep'), conversationTurns: 3 }, false);
    rl.endEpisode(true);

    const hist = await rl.getTrainingHistory();
    expect(hist.episodes).toHaveLength(1);
    expect(hist.episodes[0].success).toBe(true);
    expect(hist.episodes[0].reward).toBeGreaterThan(0);
    expect(hist.episodes[0].episode).toBe(1);
  });

  it('无训练时返回空序列（不抛错）', async () => {
    const rl = new RLModule();
    const hist = await rl.getTrainingHistory();
    expect(hist.trainEvents).toEqual([]);
    expect(hist.episodes).toEqual([]);
  });
});

describe('RL↔DialogueEvaluator 闭环 — 好答案应获得更高奖励', () => {
  const evaluator = new DialogueEvaluator();

  it('相关性高的回答评分更高，且对应更高的 RL 奖励', () => {
    const input = '如何重置账户密码';
    const goodAnswer =
      '重置账户密码的步骤：1. 打开设置；2. 点击账户安全；3. 选择重置密码并按提示操作。建议定期更新密码。';
    const badAnswer = '今天天气不错，适合出去玩。';

    const good = evaluator.evaluateDialogueQuality('loop-user', input, goodAnswer);
    const bad = evaluator.evaluateDialogueQuality('loop-user', input, badAnswer);
    expect(good.overall).toBeGreaterThan(bad.overall);

    // 同一 RL 实例对重复动作有惩罚历史，为隔离干扰，两路各用独立实例
    const feedback = (rl: RLModule, quality: number) =>
      rl.recordDialogueFeedback({
        state: mkState('loop-user'),
        action: respondAction(),
        nextState: { ...mkState('loop-user'), conversationTurns: 2 },
        done: true,
        quality
      });

    const rGood = feedback(new RLModule(), good.overall);
    const rBad = feedback(new RLModule(), bad.overall);
    expect(rGood).toBeGreaterThan(rBad);
  });
});
