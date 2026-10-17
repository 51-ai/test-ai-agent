/**
 * 推荐引擎 (Recommendation Engine)
 *
 * 实现轻量级混合推荐：
 *  - 基于内容相似度（TF-IDF + 余弦）
 *  - 基于协同过滤（用户-物品共现）
 *  - 热门兜底
 *
 * 用于：
 *  - 工具/文档/FAQ 推荐
 *  - 用户可能感兴趣的话题
 *  - 个性化"下一步行动"建议
 */

export interface Item {
  id: string;
  title: string;
  content: string;     // 用于内容相似度
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface Interaction {
  userId: string;
  itemId: string;
  weight: number;      // 1=浏览，3=点赞，5=采纳/使用
  at: Date;
}

export interface Recommendation {
  itemId: string;
  score: number;
  reason: 'content' | 'collaborative' | 'popular' | 'hybrid';
}

export interface RecommendationStats {
  totalItems: number;
  totalInteractions: number;
  totalUsers: number;
  cacheSize: number;
  topItems: Array<{ itemId: string; score: number }>;
}

// ============== TF-IDF 工具 ==============
function tokenize(text: string): string[] {
  // 同时支持中英文：英文按词，中文按字 (bigram)
  const tokens: string[] = [];
  const en = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  tokens.push(...en);
  // 中文 bigram
  const cn = text.match(/[一-龥]+/g) ?? [];
  for (const w of cn) {
    if (w.length === 1) tokens.push(w);
    else for (let i = 0; i < w.length - 1; i++) tokens.push(w.slice(i, i + 2));
  }
  return tokens;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  for (const [k, v] of a) {
    const ov = b.get(k);
    if (ov) dot += v * ov;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export default class RecommendationEngine {
  private items: Map<string, Item> = new Map();
  private interactions: Interaction[] = [];
  private tfidfCache: Map<string, Map<string, number>> = new Map();
  private idf: Map<string, number> = new Map();
  private dirty = true;
  private recCache: Map<string, { at: number; result: Recommendation[] }> = new Map();
  private readonly cacheTTL = 60 * 1000; // 60s

  // ============== 内容管理 ==============
  addItem(item: Item): void {
    this.items.set(item.id, item);
    this.dirty = true;
  }

  addItems(items: Item[]): void {
    for (const i of items) this.items.set(i.id, i);
    this.dirty = true;
  }

  removeItem(itemId: string): boolean {
    const ok = this.items.delete(itemId);
    if (ok) this.dirty = true;
    return ok;
  }

  getItem(itemId: string): Item | undefined {
    return this.items.get(itemId);
  }

  // ============== 交互 ==============
  recordInteraction(userId: string, itemId: string, weight: number = 1): void {
    this.interactions.push({ userId, itemId, weight, at: new Date() });
    this.recCache.delete(`u:${userId}`);
  }

  // ============== 推荐 ==============
  /** 为指定用户生成推荐列表 */
  recommendForUser(userId: string, topK: number = 5): Recommendation[] {
    const key = `u:${userId}`;
    const cached = this.recCache.get(key);
    if (cached && Date.now() - cached.at < this.cacheTTL) {
      return cached.result.slice(0, topK);
    }

    this.rebuildIfDirty();

    const userItems = new Set(
      this.interactions.filter((i) => i.userId === userId).map((i) => i.itemId)
    );

    // 内容相似度：基于用户最近交互过的物品
    const userVector = this.buildUserVector(userId);
    const contentScores: Map<string, number> = new Map();
    if (userVector.size > 0) {
      for (const item of this.items.values()) {
        if (userItems.has(item.id)) continue;
        const v = this.tfidfCache.get(item.id);
        if (!v) continue;
        const sim = cosine(userVector, v);
        if (sim > 0) contentScores.set(item.id, sim);
      }
    }

    // 协同过滤：找到相似用户喜欢的物品
    const collabScores: Map<string, number> = new Map();
    const similarUsers = this.findSimilarUsers(userId, 10);
    for (const { userId: otherId, sim } of similarUsers) {
      for (const inter of this.interactions) {
        if (inter.userId !== otherId) continue;
        if (userItems.has(inter.itemId)) continue;
        collabScores.set(inter.itemId, (collabScores.get(inter.itemId) ?? 0) + sim * inter.weight);
      }
    }

    // 热门兜底
    const popularScores = this.popularItems(userItems);

    // 混合
    const allIds = new Set<string>([
      ...contentScores.keys(),
      ...collabScores.keys(),
      ...popularScores.keys(),
    ]);
    const result: Recommendation[] = [];
    for (const id of allIds) {
      const c = contentScores.get(id) ?? 0;
      const k = collabScores.get(id) ?? 0;
      const p = popularScores.get(id) ?? 0;
      const score = 0.5 * c + 0.4 * k + 0.1 * p;
      const reason: Recommendation['reason'] =
        c > 0 && k > 0 ? 'hybrid' :
        c > 0 ? 'content' :
        k > 0 ? 'collaborative' : 'popular';
      result.push({ itemId: id, score, reason });
    }
    result.sort((a, b) => b.score - a.score);
    const final = result.slice(0, topK);
    this.recCache.set(key, { at: Date.now(), result: final });
    return final;
  }

  /** 基于查询文本找相似物品 */
  recommendByText(query: string, topK: number = 5): Recommendation[] {
    this.rebuildIfDirty();
    const qVec = this.vectorize(query);
    const out: Recommendation[] = [];
    for (const item of this.items.values()) {
      const v = this.tfidfCache.get(item.id);
      if (!v) continue;
      const sim = cosine(qVec, v);
      if (sim > 0) out.push({ itemId: item.id, score: sim, reason: 'content' });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, topK);
  }

  // ============== 内部方法 ==============
  private rebuildIfDirty(): void {
    if (!this.dirty) return;
    // 计算 IDF
    const df: Map<string, number> = new Map();
    const docs: string[] = [];
    for (const item of this.items.values()) {
      docs.push(`${item.title} ${item.content} ${item.tags.join(' ')}`);
    }
    for (const doc of docs) {
      const seen = new Set(tokenize(doc));
      for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
    }
    this.idf.clear();
    const N = docs.length || 1;
    for (const [t, d] of df) {
      this.idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
    }
    // 计算 TF-IDF
    this.tfidfCache.clear();
    let i = 0;
    for (const item of this.items.values()) {
      const text = docs[i++];
      this.tfidfCache.set(item.id, this.vectorize(text));
    }
    this.dirty = false;
  }

  private vectorize(text: string): Map<string, number> {
    const tokens = tokenize(text);
    if (tokens.length === 0) return new Map();
    const tf: Map<string, number> = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const len = tokens.length;
    const v = new Map<string, number>();
    for (const [t, c] of tf) {
      v.set(t, (c / len) * (this.idf.get(t) ?? 1));
    }
    return v;
  }

  private buildUserVector(userId: string): Map<string, number> {
    const v = new Map<string, number>();
    for (const inter of this.interactions) {
      if (inter.userId !== userId) continue;
      const itemVec = this.tfidfCache.get(inter.itemId);
      if (!itemVec) continue;
      for (const [t, w] of itemVec) {
        v.set(t, (v.get(t) ?? 0) + w * inter.weight);
      }
    }
    // 归一化
    let sum = 0;
    for (const w of v.values()) sum += w * w;
    if (sum === 0) return v;
    const norm = Math.sqrt(sum);
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  }

  private findSimilarUsers(userId: string, topK: number): Array<{ userId: string; sim: number }> {
    const userItems = this.interactions.filter((i) => i.userId === userId);
    if (userItems.length === 0) return [];
    const userItemSet = new Set(userItems.map((i) => i.itemId));
    // 用户-物品倒排
    const userScores: Map<string, number> = new Map();
    for (const inter of this.interactions) {
      if (inter.userId === userId) continue;
      if (!userItemSet.has(inter.itemId)) continue;
      userScores.set(inter.userId, (userScores.get(inter.userId) ?? 0) + inter.weight);
    }
    return Array.from(userScores.entries())
      .map(([uid, s]) => ({ userId: uid, sim: s }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, topK);
  }

  private popularItems(exclude: Set<string>): Map<string, number> {
    const scores: Map<string, number> = new Map();
    const now = Date.now();
    for (const inter of this.interactions) {
      if (exclude.has(inter.itemId)) continue;
      // 时间衰减：30 天半衰期
      const ageDays = (now - inter.at.getTime()) / (24 * 3600 * 1000);
      const decay = Math.pow(0.5, ageDays / 30);
      scores.set(inter.itemId, (scores.get(inter.itemId) ?? 0) + inter.weight * decay);
    }
    return scores;
  }

  // ============== 状态 ==============
  getStats(): RecommendationStats {
    const users = new Set(this.interactions.map((i) => i.userId));
    const pop = this.popularItems(new Set());
    const top = Array.from(pop.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([itemId, score]) => ({ itemId, score }));
    return {
      totalItems: this.items.size,
      totalInteractions: this.interactions.length,
      totalUsers: users.size,
      cacheSize: this.recCache.size,
      topItems: top,
    };
  }
}
