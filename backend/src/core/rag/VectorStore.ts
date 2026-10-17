import fs from 'fs';
import path from 'path';
import { Document, DocumentChunk, SearchResult, RAGConfig, defaultRAGConfig } from './types';
import {
  EmbeddingError,
  cosineSimilarity,
  getEmbeddingProvider,
  type EmbeddingProvider,
} from './embedding/EmbeddingProvider';

/**
 * 向量存储：真实语义向量检索 + 可选持久化。
 *
 * 变更说明（修复前）：
 *  - 旧实现用「字符 hash + Math.sin」伪造向量，语义相似度恒为 ~0.65，检索无意义；
 *  - 旧实现只存内存 Map，进程重启即丢失全部知识。
 * 现改为：调用真实 Embedding 后端（在线 API / 本地模型），并支持把索引落盘（RAG_INDEX_PATH）。
 */

export interface VectorIndexSnapshot {
  version: 1;
  createdAt: string;
  documents: Document[];
  chunks: DocumentChunk[];
}

export class VectorStore {
  private config: RAGConfig;
  private documents: Map<string, Document> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();
  private provider: EmbeddingProvider;
  private embedFailed = false;

  constructor(
    config: Partial<RAGConfig> = {},
    provider: EmbeddingProvider = getEmbeddingProvider(),
    private readonly indexFile: string = process.env.RAG_INDEX_PATH ?? ''
  ) {
    this.config = { ...defaultRAGConfig, ...config };
    this.provider = provider;
  }

  /** 当前使用的向量化后端名称 */
  get providerName(): string {
    return this.provider.name;
  }

  /** 向量化是否可用（不可用时应由上层明确报错，而不是静默降级） */
  isHealthy(): boolean {
    return !this.embedFailed;
  }

  /**
   * 批量生成向量。失败时抛出明确错误——绝不回退到伪随机向量。
   * （旧实现的 generateEmbedding 已删除，避免被误用。）
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    try {
      const vectors = await this.provider.embed(texts);
      this.embedFailed = false;
      return vectors;
    } catch (e) {
      this.embedFailed = true;
      throw e instanceof EmbeddingError
        ? e
        : new EmbeddingError(`向量化失败：${(e as Error).message}`, 'API');
    }
  }

  /**
   * 写入文档并为其片段生成向量。
   * 注意：真实向量化是异步过程，必须 await；不接受无向量的片段入库。
   */
  async addDocument(document: Document, chunks: DocumentChunk[]): Promise<void> {
    this.documents.set(document.id, document);

    const pending = chunks.filter((c) => !c.embedding || c.embedding.length === 0);
    if (pending.length) {
      const vectors = await this.embed(pending.map((c) => c.content));
      pending.forEach((chunk, i) => {
        chunk.embedding = vectors[i];
      });
    }

    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  /** 语义检索：向量化查询 → 余弦相似度 → 阈值过滤 → Top-K */
  async search(query: string): Promise<SearchResult[]> {
    const [queryEmbedding] = await this.embed([query]);
    const results: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (similarity < this.config.minRelevanceScore) continue;
      const document = this.documents.get(chunk.documentId);
      if (document) results.push({ chunk, document, score: similarity });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, this.config.topK);
  }

  // ---------- 索引持久化：避免进程重启丢失知识 ----------

  /** 将文档与向量索引落盘（JSON） */
  async saveIndex(target?: string): Promise<string> {
    const file = target ?? this.indexFile;
    if (!file) throw new Error('未指定索引文件路径（设置 RAG_INDEX_PATH 或传入参数）');
    const snapshot: VectorIndexSnapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      documents: Array.from(this.documents.values()),
      chunks: Array.from(this.chunks.values()),
    };
    await fs.promises.mkdir(path.dirname(path.resolve(file)), { recursive: true });
    await fs.promises.writeFile(path.resolve(file), JSON.stringify(snapshot), 'utf8');
    return file;
  }

  /** 从磁盘恢复索引 */
  async loadIndex(source?: string): Promise<boolean> {
    const file = source ?? this.indexFile;
    if (!file || !fs.existsSync(path.resolve(file))) return false;
    const raw = await fs.promises.readFile(path.resolve(file), 'utf8');
    const snapshot = JSON.parse(raw) as VectorIndexSnapshot;
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.chunks)) return false;
    this.documents = new Map(snapshot.documents.map((d) => [d.id, d]));
    this.chunks = new Map(snapshot.chunks.map((c) => [c.id, c]));
    return true;
  }

  // ---------- 既有查询接口（保持同步，不涉及向量化） ----------

  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }

  getChunksByDocument(documentId: string): DocumentChunk[] {
    return Array.from(this.chunks.values()).filter((c) => c.documentId === documentId);
  }

  getAllChunks(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  deleteDocument(id: string): void {
    this.documents.delete(id);
    const keys = Array.from(this.chunks.keys()).filter((k) => k.startsWith(id + '_'));
    keys.forEach((k) => this.chunks.delete(k));
  }

  clear(): void {
    this.documents.clear();
    this.chunks.clear();
  }

  getStats() {
    const docs = Array.from(this.documents.values());
    const totalChunks = this.chunks.size;
    const avgChunksPerDoc = docs.length > 0 ? totalChunks / docs.length : 0;
    const withEmbedding = Array.from(this.chunks.values()).filter((c) => c.embedding?.length).length;

    return {
      totalDocuments: docs.length,
      totalChunks,
      avgChunksPerDoc: Math.round(avgChunksPerDoc * 100) / 100,
      chunksWithEmbedding: withEmbedding,
      provider: this.provider.name,
      lastUpdated: new Date(),
    };
  }
}
