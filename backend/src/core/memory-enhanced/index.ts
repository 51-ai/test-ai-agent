/**
 * 增强型记忆系统 - Enhanced Memory System with Vector Search
 *
 * 增强特性：
 * 1. 向量嵌入生成与相似度计算
 * 2. 混合检索策略（语义 + 关键词）
 * 3. 记忆压缩与摘要
 * 4. 长期学习与知识图谱
 * 5. 自适应记忆衰减
 * 6. 跨会话知识迁移
 *
 * @module core/memory-enhanced
 */

import { EventEmitter } from 'events';
import { getEmbeddingProvider } from '../rag/embedding/EmbeddingProvider';
import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

export type MemoryType = 'short-term' | 'working' | 'long-term' | 'semantic';
export type EmbeddingModel = 'real' | 'simhash' | 'tfidf' | 'universal';

export interface Vector {
  dimensions: number[];
  magnitude: number;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  vector?: Vector;
  metadata: Record<string, any>;
  timestamp: number;
  importance: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  links: string[];
  expiresAt?: number;
}

export interface MemorySearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  type?: MemoryType;
  tags?: string[];
  dateRange?: { start: number; end: number };
  includeExpired?: boolean;
  hybridSearch?: boolean;
}

export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchType: 'exact' | 'semantic' | 'keyword' | 'hybrid';
  highlights?: string[];
}

export interface MemoryCluster {
  id: string;
  centroid: Vector;
  entries: string[];
  keywords: string[];
  size: number;
  lastUpdated: number;
}

export interface KnowledgeGraph {
  nodes: Map<string, {
    id: string;
    type: string;
    properties: Record<string, any>;
    connections: string[];
  }>;
  edges: Map<string, {
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

export interface MemoryConfig {
  vectorDimensions: number;
  embeddingModel: EmbeddingModel;
  maxMemorySize: number;
  importanceDecayRate: number;
  compressionThreshold: number;
  clusteringEnabled: boolean;
  knowledgeGraphEnabled: boolean;
  autoSummarize: boolean;
  crossSessionLearning: boolean;
}

// ==================== 向量嵌入引擎 ====================

class VectorEmbeddingEngine extends EventEmitter {
  private dimensions: number;
  private model: EmbeddingModel;

  /**
   * 默认模型已改为 'real'（真实语义向量）。
   * 原默认值 'simhash' 是二值哈希，不具备语义相似度能力，仅保留以兼容显式调用。
   */
  constructor(dimensions: number = 128, model: EmbeddingModel = 'real') {
    super();
    this.dimensions = dimensions;
    this.model = model;
  }

  async generateEmbedding(text: string): Promise<Vector> {
    switch (this.model) {
      case 'real':
        return this.generateRealEmbedding(text);
      case 'simhash':
        return this.generateSimHash(text);
      case 'tfidf':
        return this.generateTFIDF(text);
      case 'universal':
        return this.generateUniversalEmbedding(text);
      default:
        return this.generateRealEmbedding(text);
    }
  }

  /** 真实语义向量：复用 RAG 模块的向量化后端（在线 API 或本地模型） */
  private async generateRealEmbedding(text: string): Promise<Vector> {
    const [values] = await getEmbeddingProvider().embed([text]);
    const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
    return { dimensions: values, magnitude };
  }

  private generateSimHash(text: string): Vector {
    const dimensions = this.dimensions;
    const hashBits = new Array(dimensions).fill(0);

    const words = this.tokenize(text);
    const wordHashes = words.map(word => this.simpleHash(word));

    wordHashes.forEach(hash => {
      for (let i = 0; i < dimensions; i++) {
        hashBits[i] += (hash >> i) & 1 ? 1 : -1;
      }
    });

    const dimensions_normalized = hashBits.map(bit => bit >= 0 ? 1 : 0);
    const magnitude = Math.sqrt(dimensions_normalized.reduce((sum: number, v: number) => sum + v * v, 0));

    return { dimensions: dimensions_normalized, magnitude };
  }

  private generateTFIDF(text: string): Vector {
    const words = this.tokenize(text);
    const wordFreq: Record<string, number> = {};

    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const uniqueWords = Object.keys(wordFreq);
    const dimensions = new Array(this.dimensions).fill(0);

    uniqueWords.forEach((word, i) => {
      const hash = this.simpleHash(word);
      const idx = hash % this.dimensions;
      dimensions[idx] += wordFreq[word];
    });

    const magnitude = Math.sqrt(dimensions.reduce((sum, v) => sum + v * v, 0));

    return { dimensions, magnitude: magnitude || 1 };
  }

  private generateUniversalEmbedding(text: string): Vector {
    // 简化版通用嵌入：结合多种特征
    const words = this.tokenize(text);
    const dimensions = new Array(this.dimensions).fill(0);

    words.forEach((word, wordIdx) => {
      const wordHash = this.simpleHash(word);

      for (let i = 0; i < Math.min(10, this.dimensions); i++) {
        const dim = (wordHash + i * 31) % this.dimensions;
        dimensions[dim] += Math.cos(wordIdx * i) * Math.log(word.length + 1);
      }
    });

    // 归一化
    const magnitude = Math.sqrt(dimensions.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      dimensions.forEach((_, i) => dimensions[i] /= magnitude);
    }

    return { dimensions, magnitude: 1 };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  computeSimilarity(v1: Vector, v2: Vector): number {
    if (v1.magnitude === 0 || v2.magnitude === 0) return 0;

    let dotProduct = 0;
    for (let i = 0; i < v1.dimensions.length; i++) {
      dotProduct += v1.dimensions[i] * v2.dimensions[i];
    }

    return dotProduct / (v1.magnitude * v2.magnitude);
  }

  computeCosineSimilarity(v1: Vector, v2: Vector): number {
    return this.computeSimilarity(v1, v2);
  }

  computeEuclideanDistance(v1: Vector, v2: Vector): number {
    let sum = 0;
    for (let i = 0; i < v1.dimensions.length; i++) {
      sum += Math.pow(v1.dimensions[i] - v2.dimensions[i], 2);
    }
    return Math.sqrt(sum);
  }
}

// ==================== 语义记忆存储 ====================

class SemanticMemoryStore extends EventEmitter {
  private entries: Map<string, MemoryEntry> = new Map();
  private vectors: Map<string, Vector> = new Map();
  private embeddingEngine: VectorEmbeddingEngine;
  private maxSize: number;

  constructor(maxSize: number = 5000, dimensions: number = 128) {
    super();
    this.maxSize = maxSize;
    this.embeddingEngine = new VectorEmbeddingEngine(dimensions);
  }

  async add(content: string, metadata: Record<string, any> = {}): Promise<MemoryEntry> {
    const vector = await this.embeddingEngine.generateEmbedding(content);

    const entry: MemoryEntry = {
      id: `sem_${uuidv4()}`,
      type: 'semantic',
      content,
      vector,
      metadata,
      timestamp: Date.now(),
      importance: metadata.importance || 0.5,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags: metadata.tags || [],
      links: []
    };

    this.entries.set(entry.id, entry);
    this.vectors.set(entry.id, vector);

    if (this.entries.size > this.maxSize) {
      this.evictLowImportance();
    }

    this.emit('semantic:added', entry);
    return entry;
  }

  async search(query: string, options: { limit?: number; threshold?: number; tags?: string[] } = {}): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.5 } = options;

    const queryVector = await this.embeddingEngine.generateEmbedding(query);

    const results: SearchResult[] = [];

    for (const [id, entry] of this.entries) {
      if (entry.type !== 'semantic' || !entry.vector) continue;
      if (options.tags && !options.tags.some((tag: string) => entry.tags.includes(tag))) continue;

      const score = this.embeddingEngine.computeCosineSimilarity(queryVector, entry.vector);

      if (score >= threshold) {
        results.push({
          entry,
          score,
          matchType: this.determineMatchType(score),
          highlights: this.generateHighlights(entry.content, query)
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private determineMatchType(score: number): 'exact' | 'semantic' | 'keyword' | 'hybrid' {
    if (score > 0.95) return 'exact';
    if (score > 0.7) return 'semantic';
    if (score > 0.5) return 'hybrid';
    return 'keyword';
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);

    queryWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(content.length, match.index + word.length + 20);
        highlights.push('...' + content.substring(start, end) + '...');
      }
    });

    return highlights.slice(0, 3);
  }

  get(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }
    return entry;
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  private evictLowImportance(): void {
    const entries = Array.from(this.entries.values());
    entries.sort((a, b) => a.importance - b.importance);

    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.1));
    toRemove.forEach(entry => {
      this.entries.delete(entry.id);
      this.vectors.delete(entry.id);
    });
  }

  size(): number {
    return this.entries.size;
  }
}

// ==================== 记忆聚类引擎 ====================

class MemoryClusteringEngine extends EventEmitter {
  private clusters: Map<string, MemoryCluster> = new Map();
  private embeddingEngine: VectorEmbeddingEngine;
  private minClusterSize: number = 3;

  constructor(dimensions: number = 128) {
    super();
    this.embeddingEngine = new VectorEmbeddingEngine(dimensions);
  }

  async cluster(entries: MemoryEntry[]): Promise<MemoryCluster[]> {
    const clusteredIds = new Set<string>();
    const unclustered = entries.filter(e => e.vector && e.type === 'semantic');

    // 简单聚类：基于向量相似度
    for (let i = 0; i < unclustered.length; i++) {
      if (clusteredIds.has(unclustered[i].id)) continue;

      const clusterEntries: string[] = [unclustered[i].id];
      const centroid = { ...unclustered[i].vector! };

      // 查找相似条目
      for (let j = i + 1; j < unclustered.length; j++) {
        if (clusteredIds.has(unclustered[j].id)) continue;
        if (!unclustered[j].vector) continue;

        const similarity = this.embeddingEngine.computeCosineSimilarity(centroid, unclustered[j].vector!);

        if (similarity > 0.7) {
          clusterEntries.push(unclustered[j].id);
          clusteredIds.add(unclustered[j].id);

          // 更新质心
          for (let k = 0; k < centroid.dimensions.length; k++) {
            centroid.dimensions[k] = (centroid.dimensions[k] + unclustered[j].vector!.dimensions[k]) / 2;
          }
        }
      }

      if (clusterEntries.length >= this.minClusterSize) {
        const cluster: MemoryCluster = {
          id: `cluster_${uuidv4()}`,
          centroid,
          entries: clusterEntries,
          keywords: this.extractKeywords(clusterEntries.map(id => {
            const entry = entries.find(e => e.id === id);
            return entry?.content || '';
          })),
          size: clusterEntries.length,
          lastUpdated: Date.now()
        };

        this.clusters.set(cluster.id, cluster);
      }
    }

    return Array.from(this.clusters.values());
  }

  private extractKeywords(contents: string[]): string[] {
    const wordFreq: Record<string, number> = {};

    contents.forEach(content => {
      const words = content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length >= 3) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  getClusters(): MemoryCluster[] {
    return Array.from(this.clusters.values());
  }
}

// ==================== 知识图谱管理器 ====================

class KnowledgeGraphManager extends EventEmitter {
  private graph: KnowledgeGraph;

  constructor() {
    super();
    this.graph = {
      nodes: new Map(),
      edges: new Map()
    };
  }

  addNode(id: string, type: string, properties: Record<string, any> = {}): void {
    this.graph.nodes.set(id, {
      id,
      type,
      properties,
      connections: []
    });
    this.emit('graph:node:added', id);
  }

  addEdge(source: string, target: string, type: string, weight: number = 1): void {
    if (!this.graph.nodes.has(source) || !this.graph.nodes.has(target)) {
      return;
    }

    const edgeId = `${source}_${target}`;
    this.graph.edges.set(edgeId, { source, target, type, weight });

    this.graph.nodes.get(source)!.connections.push(target);
    this.graph.nodes.get(target)!.connections.push(source);

    this.emit('graph:edge:added', { source, target, type });
  }

  findPath(start: string, end: string, maxDepth: number = 5): string[] | null {
    const visited = new Set<string>();
    const queue: { node: string; path: string[] }[] = [{ node: start, path: [start] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === end) {
        return path;
      }

      if (visited.has(node) || path.length >= maxDepth) {
        continue;
      }

      visited.add(node);
      const connections = this.graph.nodes.get(node)?.connections || [];

      for (const next of connections) {
        if (!visited.has(next)) {
          queue.push({ node: next, path: [...path, next] });
        }
      }
    }

    return null;
  }

  getRelatedNodes(nodeId: string, depth: number = 1): string[] {
    const related = new Set<string>();
    const toVisit = [nodeId];
    let currentDepth = 0;

    while (toVisit.length > 0 && currentDepth < depth) {
      const levelSize = toVisit.length;

      for (let i = 0; i < levelSize; i++) {
        const node = toVisit.shift()!;
        const connections = this.graph.nodes.get(node)?.connections || [];

        for (const conn of connections) {
          if (!related.has(conn)) {
            related.add(conn);
            toVisit.push(conn);
          }
        }
      }

      currentDepth++;
    }

    return Array.from(related);
  }

  getNode(id: string) {
    return this.graph.nodes.get(id);
  }

  exportGraph(): object {
    return {
      nodes: Array.from(this.graph.nodes.entries()),
      edges: Array.from(this.graph.edges.entries())
    };
  }
}

// ==================== 增强型记忆管理器 ====================

export class EnhancedMemoryManager extends EventEmitter {
  private shortTerm: Map<string, MemoryEntry> = new Map();
  private working: Map<string, MemoryEntry> = new Map();
  private longTerm: Map<string, MemoryEntry> = new Map();
  private semantic: SemanticMemoryStore;
  private clustering: MemoryClusteringEngine;
  private knowledgeGraph: KnowledgeGraphManager;
  private embeddingEngine: VectorEmbeddingEngine;
  private config: MemoryConfig;

  constructor(config: Partial<MemoryConfig> = {}) {
    super();

    this.config = {
      vectorDimensions: config.vectorDimensions || 128,
      embeddingModel: config.embeddingModel || 'simhash',
      maxMemorySize: config.maxMemorySize || 10000,
      importanceDecayRate: config.importanceDecayRate || 0.01,
      compressionThreshold: config.compressionThreshold || 10,
      clusteringEnabled: config.clusteringEnabled ?? true,
      knowledgeGraphEnabled: config.knowledgeGraphEnabled ?? true,
      autoSummarize: config.autoSummarize ?? true,
      crossSessionLearning: config.crossSessionLearning ?? true,
      ...config
    };

    this.semantic = new SemanticMemoryStore(this.config.maxMemorySize, this.config.vectorDimensions);
    this.clustering = new MemoryClusteringEngine(this.config.vectorDimensions);
    this.knowledgeGraph = new KnowledgeGraphManager();
    this.embeddingEngine = new VectorEmbeddingEngine(this.config.vectorDimensions, this.config.embeddingModel);
  }

  async store(content: string, type: MemoryType, metadata: Record<string, any> = {}): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `${type}_${uuidv4()}`,
      type,
      content,
      metadata,
      timestamp: Date.now(),
      importance: metadata.importance || this.calculateImportance(content),
      accessCount: 0,
      lastAccessed: Date.now(),
      tags: this.extractTags(content, metadata),
      links: []
    };

    // 添加到对应的存储
    switch (type) {
      case 'short-term':
        this.shortTerm.set(entry.id, entry);
        if (this.shortTerm.size > 100) this.evictShortTerm();
        break;
      case 'working':
        this.working.set(entry.id, entry);
        if (this.working.size > 500) this.evictWorking();
        break;
      case 'long-term':
        this.longTerm.set(entry.id, entry);
        break;
      case 'semantic':
        const semanticEntry = await this.semantic.add(content, metadata);
        return semanticEntry;
    }

    // 自动知识图谱构建
    if (this.config.knowledgeGraphEnabled && type === 'long-term') {
      this.updateKnowledgeGraph(entry);
    }

    // 自动聚类
    if (this.config.clusteringEnabled) {
      await this.updateClusters();
    }

    this.emit('memory:stored', entry);
    return entry;
  }

  async retrieve(options: MemorySearchOptions): Promise<SearchResult[]> {
    const { query, limit = 10, threshold = 0.3, type } = options;

    const results: SearchResult[] = [];

    // 语义搜索
    if (options.hybridSearch || type === 'semantic') {
      const semanticResults = await this.semantic.search(query, { limit, threshold });
      results.push(...semanticResults);
    }

    // 关键词搜索（所有类型）
    if (!type || type === 'short-term') {
      results.push(...this.keywordSearch(this.shortTerm, query, limit));
    }
    if (!type || type === 'working') {
      results.push(...this.keywordSearch(this.working, query, limit));
    }
    if (!type || type === 'long-term') {
      results.push(...this.keywordSearch(this.longTerm, query, limit));
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    // 应用记忆衰减
    return results.slice(0, limit).map(result => ({
      ...result,
      score: result.score * this.computeDecayFactor(result.entry)
    }));
  }

  private keywordSearch(store: Map<string, MemoryEntry>, query: string, limit: number): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);

    for (const [, entry] of store) {
      const contentLower = entry.content.toLowerCase();
      let matchCount = 0;

      queryWords.forEach(word => {
        if (contentLower.includes(word)) {
          matchCount++;
        }
      });

      if (matchCount > 0) {
        const score = matchCount / queryWords.length;
        results.push({
          entry,
          score,
          matchType: 'keyword',
          highlights: this.generateHighlights(entry.content, query)
        });
      }
    }

    return results.slice(0, limit);
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);

    queryWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(content.length, match.index + word.length + 20);
        highlights.push('...' + content.substring(start, end) + '...');
      }
    });

    return highlights.slice(0, 3);
  }

  private calculateImportance(content: string): number {
    // 基于内容特征计算重要性
    let importance = 0.5;

    if (content.length > 100) importance += 0.1;
    if (content.includes('关键') || content.includes('重要')) importance += 0.2;
    if (content.includes('？') || content.includes('?')) importance += 0.1;
    if (/\d+/.test(content)) importance += 0.1; // 包含数字

    return Math.min(importance, 1);
  }

  private extractTags(content: string, metadata: Record<string, any>): string[] {
    const tags = metadata.tags || [];

    // 自动提取关键词作为标签
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      if (word.length >= 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return [...new Set([...tags, ...topWords])];
  }

  private computeDecayFactor(entry: MemoryEntry): number {
    const age = (Date.now() - entry.lastAccessed) / (1000 * 60 * 60); // 小时
    return Math.exp(-this.config.importanceDecayRate * age) * (0.5 + 0.5 * entry.importance);
  }

  private evictShortTerm(): void {
    const entries = Array.from(this.shortTerm.values());
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toEvict = entries.slice(0, 10);

    toEvict.forEach(entry => {
      this.shortTerm.delete(entry.id);
      // 将重要的转移到工作记忆
      if (entry.importance > 0.6) {
        this.working.set(entry.id, { ...entry, type: 'working' });
      }
    });
  }

  private evictWorking(): void {
    const entries = Array.from(this.working.values());
    entries.sort((a, b) => a.importance - b.importance);
    const toEvict = entries.slice(0, 20);

    toEvict.forEach(entry => {
      this.working.delete(entry.id);
      // 将重要的转移到长期记忆
      if (entry.importance > 0.7) {
        this.longTerm.set(entry.id, { ...entry, type: 'long-term' });
      }
    });
  }

  private async updateClusters(): Promise<void> {
    const allEntries = [
      ...Array.from(this.longTerm.values()),
      ...this.semantic.getAll()
    ];

    await this.clustering.cluster(allEntries);
  }

  private updateKnowledgeGraph(entry: MemoryEntry): void {
    // 提取实体和关系
    const nodeId = entry.id;
    this.knowledgeGraph.addNode(nodeId, 'memory', {
      content: entry.content,
      timestamp: entry.timestamp,
      tags: entry.tags
    });

    // 链接相关记忆
    entry.links.forEach(targetId => {
      this.knowledgeGraph.addEdge(nodeId, targetId, 'related', 0.5);
    });
  }

  consolidate(): { summary: string; statistics: object } {
    // 记忆整合：压缩和摘要
    const summary = {
      shortTerm: this.shortTerm.size,
      working: this.working.size,
      longTerm: this.longTerm.size,
      semantic: this.semantic.size(),
      clusters: this.clustering.getClusters().length,
      totalEntries:
        this.shortTerm.size +
        this.working.size +
        this.longTerm.size +
        this.semantic.size()
    };

    const summaryText = `当前记忆系统包含 ${summary.totalEntries} 条记忆：短期记忆 ${summary.shortTerm} 条，工作记忆 ${summary.working} 条，长期记忆 ${summary.longTerm} 条，语义记忆 ${summary.semantic} 条，共 ${summary.clusters} 个记忆簇。`;

    this.emit('memory:consolidated', summary);
    return { summary: summaryText, statistics: summary };
  }

  getStatistics(): object {
    return {
      shortTerm: this.shortTerm.size,
      working: this.working.size,
      longTerm: this.longTerm.size,
      semantic: this.semantic.size(),
      clusters: this.clustering.getClusters().length,
      graph: {
        nodes: Array.from(this.knowledgeGraph['graph'].nodes.keys()).length,
        edges: Array.from(this.knowledgeGraph['graph'].edges.keys()).length
      }
    };
  }
}

// ==================== 导出 ====================

export const enhancedMemoryManager = new EnhancedMemoryManager();

export default {
  EnhancedMemoryManager,
  VectorEmbeddingEngine,
  SemanticMemoryStore,
  MemoryClusteringEngine,
  KnowledgeGraphManager,
  enhancedMemoryManager
};
