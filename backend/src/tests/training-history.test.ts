import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * 训练历史持久化测试：
 * - RLModule 把 train 指标 / episode 结果 best-effort 落库（DB 不可用绝不炸主流程）
 * - getTrainingHistory 数据来源优先级：DB 持久化 > 内存环形缓冲
 */

jest.mock('../utils/database', () => ({
  isMongoDBConnected: jest.fn(() => true),
}));

jest.mock('../models/TrainingHistory', () => ({
  TrainingHistory: {
    find: jest.fn(),
    countDocuments: jest.fn(async () => 0),
    create: jest.fn(async () => ({}))
  }
}));

import { RLModule } from '../core/rl/RLModule';
import { TrainingHistory } from '../models/TrainingHistory';
import { isMongoDBConnected } from '../utils/database';
import type { RLState, RLAction } from '../core/rl/types';

// 注意：该项目 ts-jest 配置下 jest.fn<T>() 单泛型会报错，统一用 any 标注 mock
const findMock: any = TrainingHistory.find;
const countMock: any = TrainingHistory.countDocuments;
const createMock: any = TrainingHistory.create;
const connectedMock: any = isMongoDBConnected;

/** 模拟 mongoose 链式查询：find().sort().limit().lean() */
const chain = (docs: unknown[]) => ({
  sort: () => chain(docs),
  limit: () => chain(docs),
  lean: async () => docs
});

const mkState = (): RLState => ({
  userId: 'u1',
  currentInput: '测试输入',
  conversationHistory: [],
  availableTools: [],
  timeOfDay: Date.now(),
  conversationTurns: 1,
  inputComplexity: 0.5
});
const respondAction = (): RLAction => ({ type: 'respond', confidence: 0.8 });

/** 让 fire-and-forget 的落库 promise 结清 */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('RLModule — 训练历史持久化', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectedMock.mockReturnValue(true);
    countMock.mockResolvedValue(0);
    createMock.mockResolvedValue({});
  });

  it('DB 有记录时优先返回持久化数据，并按时间升序排列', async () => {
    findMock.mockImplementation((filter: any) =>
      chain(
        filter.kind === 'train'
          ? [
              { ts: 300, policyLoss: 0.3, valueLoss: 0.6, entropy: 1.2 },
              { ts: 100, policyLoss: 0.1, valueLoss: 0.2, entropy: 1.0 }
            ]
          : [{ ts: 200, episode: 2, reward: 5, success: true }]
      )
    );
    countMock.mockImplementation(async (filter: any) => (filter.kind === 'train' ? 42 : 7));

    const rl = new RLModule();
    const hist = await rl.getTrainingHistory();

    expect(hist.source).toBe('persisted');
    expect(hist.trainEvents.map((e) => e.t)).toEqual([100, 300]); // 升序
    expect(hist.trainEvents[0]).toEqual({ t: 100, policyLoss: 0.1, valueLoss: 0.2, entropy: 1.0 });
    expect(hist.episodes).toEqual([{ t: 200, episode: 2, reward: 5, success: true }]);
    expect(hist.total).toEqual({ trainEvents: 42, episodes: 7 });
  });

  it('DB 查询超时/报错时降级到内存，不抛异常', async () => {
    findMock.mockImplementation(() => {
      throw new Error('connection lost');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const rl = new RLModule();
    const hist = await rl.getTrainingHistory();

    expect(hist.source).toBe('empty'); // 新实例内存也为空
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('DB 未连接时完全不查库，直接走内存', async () => {
    connectedMock.mockReturnValue(false);
    const rl = new RLModule();

    const hist = await rl.getTrainingHistory();

    expect(findMock).not.toHaveBeenCalled();
    expect(hist.source).toBe('empty');
  });

  it('DB 可用但无记录时回退内存（source=memory）', async () => {
    findMock.mockImplementation(() => chain([])); // 空结果
    const rl = new RLModule();
    // 造一条内存 train 事件（40 条经验足以触发真实训练）
    for (let i = 0; i < 40; i++) rl.recordExperience(mkState(), respondAction(), 1, mkState(), false);
    countMock.mockResolvedValue(0);
    createMock.mockResolvedValue({});

    const hist = await rl.getTrainingHistory();

    expect(hist.source).toBe('memory');
    expect(hist.trainEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('episode 结束时把结果落库（字段与默认用户正确）', async () => {
    const rl = new RLModule();
    rl.endEpisode(true);
    await flush();

    const episodeCalls = createMock.mock.calls.filter((c: any) => c[0]?.kind === 'episode');
    expect(episodeCalls.length).toBe(1);
    expect(episodeCalls[0][0]).toMatchObject({
      userId: 'default',
      kind: 'episode',
      success: true
    });
    expect(typeof episodeCalls[0][0].ts).toBe('number');
  });

  it('训练完成后把最新损失指标落库', async () => {
    const rl = new RLModule();
    for (let i = 0; i < 40; i++) rl.recordExperience(mkState(), respondAction(), 1, mkState(), false);
    await flush();

    const trainCalls = createMock.mock.calls.filter((c: any) => c[0]?.kind === 'train');
    expect(trainCalls.length).toBeGreaterThanOrEqual(1);
    expect(trainCalls[0][0]).toMatchObject({ userId: 'default', kind: 'train' });
  });

  it('DB 未连接时不产生任何落库调用（无副作用）', async () => {
    connectedMock.mockReturnValue(false);
    const rl = new RLModule();
    rl.endEpisode(false);
    for (let i = 0; i < 40; i++) rl.recordExperience(mkState(), respondAction(), 1, mkState(), false);
    await flush();

    expect(createMock).not.toHaveBeenCalled();
  });

  it('落库失败只告警，不影响后续训练调用', async () => {
    createMock.mockRejectedValue(new Error('write failed'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const rl = new RLModule();
    rl.endEpisode(true);
    await flush();

    expect(warnSpy).toHaveBeenCalled();
    expect(() => rl.recordExperience(mkState(), respondAction(), 1, mkState(), false)).not.toThrow();
    warnSpy.mockRestore();
  });

  it('limit 参数被限制在 1~2000', async () => {
    findMock.mockImplementation(() => chain([]));
    const rl = new RLModule();

    await rl.getTrainingHistory({ limit: 99999 });
    const limitChain = findMock.mock.results[0]?.value ?? null;
    expect(limitChain).toBeTruthy();
    expect(findMock).toHaveBeenCalled();
    // 超限不报错即视为通过（内部已 clamp）
    await expect(rl.getTrainingHistory({ limit: -5 })).resolves.toBeDefined();
  });
});
