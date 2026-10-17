import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Memory model 与 embedding provider 均隔离 mock，不触真实 MongoDB / 向量模型
jest.mock('../core/rag/embedding/EmbeddingProvider', () => ({
  getEmbeddingProvider: jest.fn(),
}));

const chainable = (docs: unknown[]) => ({
  sort: () => chainable(docs),
  skip: () => chainable(docs),
  limit: () => chainable(docs),
  populate: () => chainable(docs),
  lean: async () => docs,
});

jest.mock('../models/Memory', () => ({
  Memory: Object.assign(jest.fn(), {
    countDocuments: jest.fn(async () => 0),
    find: jest.fn((filter: { userId?: string }) =>
      chainable(store.filter((d) => !filter.userId || d.userId === filter.userId))
    ),
    findByIdAndUpdate: jest.fn(async () => ({})),
    findByIdAndDelete: jest.fn(async () => null),
    aggregate: jest.fn(async () => []),
  }),
}));

import { MemoryService } from '../services/MemoryService';
import { Memory } from '../models/Memory';
import { getEmbeddingProvider } from '../core/rag/embedding/EmbeddingProvider';

// 模块级共享存储：Memory.find 的 mock 闭包引用它
const store: Array<Record<string, unknown>> = [];

const embedMock: any = jest.fn();
const memoryMock = Memory as unknown as jest.Mock & Record<string, any>;

/** 构造一条带向量的记忆（plain object，模拟 lean() 输出） */
const mkMemory = (id: string, content: string, embedding: number[] | null, userId = 'u1') => ({
  _id: id,
  userId,
  type: 'long',
  content,
  embedding,
  createdAt: new Date(),
  accessedAt: new Date(),
});

describe('MemoryService — 语义召回', () => {
  let svc: MemoryService;

  beforeEach(() => {
    svc = new MemoryService();
    store.length = 0;
    jest.clearAllMocks();
    (getEmbeddingProvider as unknown as jest.Mock).mockReturnValue({ embed: embedMock });
  });

  it('create 成功路径：内容向量化后随记忆保存', async () => {
    embedMock.mockResolvedValue([[0.1, 0.2, 0.3]]);
    const fakeDoc = { save: jest.fn(async () => ({ _id: 'm1' })) };
    memoryMock.mockReturnValueOnce(fakeDoc);

    await svc.create({ userId: 'u1', type: 'long', content: '用户偏好深色主题' });

    expect(fakeDoc.save).toHaveBeenCalled();
    const saved = memoryMock.mock.calls[0][0] as { embedding?: number[] };
    expect(saved.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('create 容错路径：向量化失败（未配置/网络）时记忆照常保存，embedding 留空', async () => {
    embedMock.mockRejectedValue(new Error('NOT_CONFIGURED'));
    const fakeDoc = { save: jest.fn(async () => ({ _id: 'm2' })) };
    memoryMock.mockReturnValueOnce(fakeDoc);

    await svc.create({ userId: 'u1', type: 'short', content: '临时上下文' });

    expect(fakeDoc.save).toHaveBeenCalled(); // 主流程不受影响
    expect((memoryMock.mock.calls[0][0] as { embedding?: number[] }).embedding).toBeUndefined();
  });

  it('semanticSearch：按余弦降序、阈值过滤、topK 截断，且不回传大向量', async () => {
    store.push(
      mkMemory('m1', '喜欢深色主题', [1, 0, 0]),
      mkMemory('m2', '从事前端开发', [0.8, 0.6, 0]), // cos=0.8
      mkMemory('m3', '养了一只猫', [0, 1, 0]) // cos=0 → 低于阈值
    );
    embedMock.mockResolvedValue([[1, 0, 0]]);

    const { data } = await svc.semanticSearch('u1', '界面主题偏好', { topK: 2, threshold: 0.5 });

    expect(data.map((d) => d.id)).toEqual(['m1', 'm2']); // 1.0 → 0.8
    expect(data[0].score).toBeCloseTo(1, 6);
    expect(data[0].id).toBe("m1");
  });

  it('semanticSearch：维度不匹配的旧记忆（模型切换后）自动跳过，不做无意义比对', async () => {
    store.push(mkMemory('m1', '新维度记忆', [1, 0, 0]), mkMemory('m2', '旧模型记忆', new Array(128).fill(0.1)));
    embedMock.mockResolvedValue([[1, 0, 0]]);

    const { data } = await svc.semanticSearch('u1', '任意查询');
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('m1');
  });

  it('semanticSearch：查询向量化失败时抛错，由调用方决定降级', async () => {
    embedMock.mockRejectedValue(new Error('NETWORK'));
    await expect(svc.semanticSearch('u1', '查询')).rejects.toThrow('NETWORK');
  });

  it('update 修改内容后重新生成向量；生成失败则清空旧向量（防错误召回）', async () => {
    embedMock.mockResolvedValue([[0.5, 0.5, 0.5]]);

    await svc.update('m1', { content: '全新的内容' });
    expect(memoryMock.findByIdAndUpdate.mock.calls[0][1].embedding).toEqual([0.5, 0.5, 0.5]);

    embedMock.mockRejectedValue(new Error('fail'));
    await svc.update('m1', { content: '又改了' });
    expect(memoryMock.findByIdAndUpdate.mock.calls[1][1].embedding).toBeUndefined();
  });
});
