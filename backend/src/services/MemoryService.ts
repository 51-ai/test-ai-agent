import { Memory, IMemory } from '../models/Memory';
import { getEmbeddingProvider } from '../core/rag/embedding/EmbeddingProvider';

/** 语义召回的可调参数 */
export interface SemanticSearchOptions {
  topK?: number;
  /** 余弦相似度阈值（默认 0.35），低于该值的相关记忆不返回 */
  threshold?: number;
  /** 内存打分前最多扫描的该用户记忆条数（按 accessedAt 降序），防止超大集合拖慢请求 */
  maxScan?: number;
}

/** 语义召回结果条目（干净对象，不含 embedding 向量） */
export interface SemanticHit {
  id: string;
  type: 'short' | 'long' | 'skill';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  accessedAt: Date;
  /** 余弦相似度 0~1 */
  score: number;
}

export class MemoryService {
  /**
   * 为记忆内容生成向量（增强能力，绝不影响主流程）：
   * 任何失败（未配置密钥 / 本地依赖缺失 / 网络）都返回 null，记忆本身照常保存。
   */
  private async embedContent(content: string): Promise<number[] | null> {
    try {
      const provider = getEmbeddingProvider();
      const [vector] = await provider.embed([content]);
      return Array.isArray(vector) && vector.length > 0 ? vector : null;
    } catch {
      return null;
    }
  }

  async listMemories(query: {
    page?: number;
    pageSize?: number;
    userId?: string;
    type?: 'short' | 'long' | 'skill';
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (query.userId) filter.userId = query.userId;
    if (query.type) filter.type = query.type;
    if (query.search) filter.content = { $regex: query.search, $options: 'i' };

    const sortBy = query.sortBy || 'accessedAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [total, docs] = await Promise.all([
      Memory.countDocuments(filter),
      Memory.find(filter).sort(sort).skip(skip).limit(pageSize)
        .populate('userId', 'username email').lean()
    ]);
    return { data: docs, total, page, pageSize };
  }

  /**
   * 语义召回：查询文本向量化后与该用户记忆的 embedding 做余弦相似度排序。
   * - 只匹配维度一致的记忆（向量模型切换后旧维度自动跳过，不做无意义比对）；
   * - 没有向量的旧记忆不参与（可用 listMemories 的正则搜索兜底）；
   * - 查询向量化失败时抛出 EmbeddingError，由调用方决定降级策略。
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<{ data: SemanticHit[]; scanned: number }> {
    const topK = Math.min(50, Math.max(1, options.topK ?? 5));
    const threshold = Math.min(1, Math.max(0, options.threshold ?? 0.35));
    const maxScan = Math.min(2000, Math.max(1, options.maxScan ?? 500));

    const [queryVector] = await getEmbeddingProvider().embed([query]);

    const docs = (await Memory.find({ userId })
      .sort({ accessedAt: -1 })
      .limit(maxScan)
      .lean()) as unknown as IMemory[];

    const data = docs
      .filter((d) => Array.isArray(d.embedding) && d.embedding.length === queryVector.length)
      .map((d) => ({ doc: d, score: cosineOf(d.embedding as number[], queryVector) }))
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      // 显式构造干净对象：向量字段不回传给调用方
      .map(({ doc, score }) => ({
        id: String(doc._id),
        type: doc.type,
        content: doc.content,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
        accessedAt: doc.accessedAt,
        score,
      }));

    return { data, scanned: docs.length };
  }

  async getById(id: string) {
    return Memory.findById(id).populate('userId', 'username email').lean();
  }

  async create(data: { userId: string; type: 'short' | 'long' | 'skill'; content: string; metadata?: Record<string, unknown> }) {
    const embedding = await this.embedContent(data.content);
    const memory = new Memory({ ...data, embedding: embedding ?? undefined });
    return memory.save();
  }

  async update(id: string, patch: Partial<Pick<IMemory, 'type' | 'content' | 'metadata'>>) {
    const update: Record<string, unknown> = {};
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.content !== undefined) {
      update.content = patch.content;
      // 内容变更后旧向量失效，重新生成（失败则清空，避免用旧向量给出错误召回）
      update.embedding = (await this.embedContent(patch.content)) ?? undefined;
    }
    if (patch.metadata !== undefined) update.metadata = patch.metadata;
    update.accessedAt = new Date();
    return Memory.findByIdAndUpdate(id, update, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const res = await Memory.findByIdAndDelete(id);
    return res !== null;
  }

  async getStats() {
    const [total, byType] = await Promise.all([
      Memory.countDocuments(),
      Memory.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
    ]);
    const byTypeMap: Record<string, number> = { short: 0, long: 0, skill: 0 };
    byType.forEach(r => { byTypeMap[r._id as string] = r.count; });
    return { total, byType: byTypeMap };
  }
}

/** 内存余弦相似度（与 EmbeddingProvider 的实现一致，避免为打分重复引入模块状态） */
function cosineOf(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
