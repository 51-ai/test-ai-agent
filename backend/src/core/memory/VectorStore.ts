/**
 * 简单向量检索系统
 * 使用TF-IDF进行向量化，支持语义相似度检索
 */

export interface VectorEntry {
  id: string;
  vector: number[];
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult<T = any> {
  item: T;
  score: number;
  method: 'keyword' | 'semantic' | 'hybrid';
}

export class VectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount = 0;

  /**
   * 添加文档到向量存储
   */
  addDocument(id: string, content: string, metadata?: Record<string, unknown>): void {
    const vector = this.computeTFIDF(content);
    this.vectors.set(id, { id, vector, content, metadata });
    this.updateIDF(content);
    this.documentCount++;
  }

  /**
   * 移除文档
   */
  removeDocument(id: string): void {
    this.vectors.delete(id);
    this.documentCount = Math.max(0, this.documentCount - 1);
  }

  /**
   * 计算TF-IDF向量
   */
  private computeTFIDF(content: string): number[] {
    const tokens = this.tokenize(content);
    const tf = this.computeTF(tokens);
    const vector: number[] = [];

    for (const [term, freq] of tf) {
      const tfScore = freq;
      const idfScore = this.idf.get(term) || Math.log(this.documentCount + 1);
      vector.push(tfScore * idfScore);
    }

    // 归一化
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  /**
   * 计算词频
   */
  private computeTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    // 归一化
    for (const [token, count] of tf) {
      tf.set(token, count / tokens.length);
    }
    return tf;
  }

  /**
   * 更新IDF值
   */
  private updateIDF(content: string): void {
    const tokens = new Set(this.tokenize(content));
    for (const token of tokens) {
      this.idf.set(token, (this.idf.get(token) || 0) + 1);
    }
    // 计算IDF
    for (const [token, docFreq] of this.idf) {
      this.idf.set(token, Math.log(this.documentCount / (docFreq + 1)) + 1);
    }
  }

  /**
   * 语义搜索
   */
  semanticSearch(query: string, topK: number = 5): VectorEntry[] {
    if (this.vectors.size === 0) return [];

    const queryVector = this.computeTFIDF(query);
    const results: Array<{ entry: VectorEntry; similarity: number }> = [];

    for (const entry of this.vectors.values()) {
      const similarity = this.cosineSimilarity(queryVector, entry.vector);
      results.push({ entry, similarity });
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK).map(r => r.entry);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * 混合搜索（结合关键词和语义）
   */
  hybridSearch(
    query: string, 
    keywordMatch: (content: string) => boolean,
    topK: number = 10
  ): Array<{ entry: VectorEntry; keywordScore: number; semanticScore: number }> {
    const semanticResults = this.semanticSearch(query, topK * 2);
    const results: Array<{ entry: VectorEntry; keywordScore: number; semanticScore: number }> = [];

    for (const entry of semanticResults) {
      const keywordScore = keywordMatch(entry.content) ? 1 : 0;
      const semanticScore = this.cosineSimilarity(
        this.computeTFIDF(query), 
        entry.vector
      );
      
      results.push({ entry, keywordScore, semanticScore });
    }

    // 按综合分数排序（关键词权重0.4，语义权重0.6）
    return results.sort((a, b) => {
      const scoreA = a.keywordScore * 0.4 + a.semanticScore * 0.6;
      const scoreB = b.keywordScore * 0.4 + b.semanticScore * 0.6;
      return scoreB - scoreA;
    }).slice(0, topK);
  }

  /**
   * 获取存储的文档数量
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * 获取所有文档
   */
  getAllDocuments(): VectorEntry[] {
    return Array.from(this.vectors.values());
  }

  /**
   * 获取单个文档
   */
  getDocument(id: string): VectorEntry | undefined {
    return this.vectors.get(id);
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.vectors.clear();
    this.vocabulary.clear();
    this.idf.clear();
    this.documentCount = 0;
  }

  /**
   * 批量添加文档
   */
  addDocuments(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): void {
    for (const doc of documents) {
      this.addDocument(doc.id, doc.content, doc.metadata);
    }
  }
}

export default VectorStore;
