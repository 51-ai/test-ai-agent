/**
 * 搜索引擎 - 全文检索与高级搜索
 */

import { v4 as uuidv4 } from 'uuid';

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  source?: string;
  tags?: string[];
  category?: string;
  metadata?: Record<string, unknown>;
  created: Date;
  updated: Date;
  score?: number;
}

export interface SearchQuery {
  text: string;
  fields?: string[];
  filters?: Record<string, unknown>;
  tags?: string[];
  category?: string;
  dateRange?: { start: Date; end: Date };
  limit?: number;
  offset?: number;
  minScore?: number;
  sortBy?: 'relevance' | 'date' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  highlight?: boolean;
  fuzzy?: boolean;
  fuzzyDistance?: number;
}

export interface SearchResult {
  documents: SearchDocument[];
  total: number;
  page: number;
  pageSize: number;
  query: SearchQuery;
  processingTime: number;
  highlights?: Record<string, string[]>;
  facets?: {
    categories?: Record<string, number>;
    tags?: Record<string, number>;
    sources?: Record<string, number>;
  };
  suggestions?: string[];
}

export interface SearchIndex {
  documents: Map<string, SearchDocument>;
  termIndex: Map<string, Set<string>>;
  tagIndex: Map<string, Set<string>>;
  categoryIndex: Map<string, Set<string>>;
}

export interface SearchAnalytics {
  totalQueries: number;
  popularQueries: Array<{ query: string; count: number }>;
  recentQueries: Array<{ query: string; timestamp: Date; resultCount: number }>;
  averageResponseTime: number;
  zeroResults: number;
  topCategories: Record<string, number>;
}

class SearchEngine {
  private index: SearchIndex = {
    documents: new Map(),
    termIndex: new Map(),
    tagIndex: new Map(),
    categoryIndex: new Map()
  };
  private analytics: SearchAnalytics = {
    totalQueries: 0,
    popularQueries: [],
    recentQueries: [],
    averageResponseTime: 0,
    zeroResults: 0,
    topCategories: {}
  };
  private queryHistory: Map<string, number> = new Map();
  private synonyms: Map<string, string[]> = new Map();
  private stopWords: Set<string> = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing']);
  private maxDocuments = 100000;
  private autocompleteIndex: Map<string, string[]> = new Map();
  private documentVectors: Map<string, number[]> = new Map();
  private idfCache: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultSynonyms();
  }

  private initializeDefaultSynonyms(): void {
    this.addSynonyms('fast', ['quick', 'rapid', 'speedy', 'swift']);
    this.addSynonyms('important', ['crucial', 'essential', 'critical', 'vital']);
    this.addSynonyms('good', ['great', 'excellent', 'fine', 'superb']);
    this.addSynonyms('big', ['large', 'huge', 'enormous', 'massive']);
    this.addSynonyms('small', ['tiny', 'little', 'miniature', 'compact']);
  }

  /**
   * 添加文档到索引
   */
  addDocument(document: Omit<SearchDocument, 'id' | 'created' | 'updated'> & { id?: string }): string {
    const now = new Date();
    const id = document.id || uuidv4();
    const fullDocument: SearchDocument = {
      ...document,
      id,
      created: now,
      updated: now
    };

    // 检查索引大小
    if (this.index.documents.size >= this.maxDocuments) {
      // 删除最旧的文档
      const oldestDoc = Array.from(this.index.documents.values())
        .sort((a, b) => a.created.getTime() - b.created.getTime())[0];
      if (oldestDoc) {
        this.removeDocument(oldestDoc.id);
      }
    }

    this.index.documents.set(id, fullDocument);
    this.indexDocument(fullDocument);

    return id;
  }

  /**
   * 批量添加文档
   */
  addDocuments(documents: Array<Omit<SearchDocument, 'id' | 'created' | 'updated'>>): string[] {
    return documents.map(doc => this.addDocument(doc));
  }

  private indexDocument(document: SearchDocument): void {
    const terms = this.tokenize(`${document.title} ${document.content}`);
    const termSet = new Set(terms);
    
    for (const term of termSet) {
      if (!this.index.termIndex.has(term)) {
        this.index.termIndex.set(term, new Set());
      }
      this.index.termIndex.get(term)!.add(document.id);
      
      // 添加到自动完成索引
      for (let i = 1; i <= Math.min(term.length, 10); i++) {
        const prefix = term.substring(0, i);
        if (!this.autocompleteIndex.has(prefix)) {
          this.autocompleteIndex.set(prefix, []);
        }
        if (!this.autocompleteIndex.get(prefix)!.includes(term)) {
          this.autocompleteIndex.get(prefix)!.push(term);
          if (this.autocompleteIndex.get(prefix)!.length > 10) {
            this.autocompleteIndex.get(prefix)!.shift();
          }
        }
      }
    }

    // 标签索引
    if (document.tags) {
      for (const tag of document.tags) {
        if (!this.index.tagIndex.has(tag)) {
          this.index.tagIndex.set(tag, new Set());
        }
        this.index.tagIndex.get(tag)!.add(document.id);
      }
    }

    // 分类索引
    if (document.category) {
      if (!this.index.categoryIndex.has(document.category)) {
        this.index.categoryIndex.set(document.category, new Set());
      }
      this.index.categoryIndex.get(document.category)!.add(document.id);
      this.analytics.topCategories[document.category] = 
        (this.analytics.topCategories[document.category] || 0) + 1;
    }

    // 计算文档向量
    this.documentVectors.set(document.id, this.createDocumentVector(termSet));
    
    // 清空IDF缓存，因为文档已变化
    this.idfCache.clear();
  }

  private createDocumentVector(terms: Set<string>): number[] {
    // 使用简单的哈希向量
    const size = 256;
    const vector = new Array(size).fill(0);
    for (const term of terms) {
      let hash = 0;
      for (let i = 0; i < term.length; i++) {
        hash = term.charCodeAt(i) + ((hash << 5) - hash);
      }
      vector[Math.abs(hash) % size]++;
    }
    return vector;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token))
      .slice(0, 1000);
  }

  /**
   * 搜索文档
   */
  search(query: SearchQuery): SearchResult {
    const startTime = Date.now();
    const searchTerms = this.tokenize(query.text);
    
    // 扩展同义词
    const expandedTerms = new Set(searchTerms);
    for (const term of searchTerms) {
      const synonyms = this.synonyms.get(term);
      if (synonyms) {
        for (const syn of synonyms) {
          expandedTerms.add(syn);
        }
      }
    }

    // 收集候选文档
    const candidateDocs = new Set<string>();
    for (const term of expandedTerms) {
      const docs = this.index.termIndex.get(term);
      if (docs) {
        for (const docId of docs) {
          candidateDocs.add(docId);
        }
      }
    }

    // 标签过滤
    if (query.tags?.length) {
      for (const tag of query.tags) {
        const tagDocs = this.index.tagIndex.get(tag);
        if (tagDocs) {
          const filtered = new Set<string>();
          for (const docId of candidateDocs) {
            if (tagDocs.has(docId)) {
              filtered.add(docId);
            }
          }
          candidateDocs.clear();
          for (const docId of filtered) {
            candidateDocs.add(docId);
          }
        }
      }
    }

    // 分类过滤
    if (query.category) {
      const categoryDocs = this.index.categoryIndex.get(query.category);
      if (categoryDocs) {
        const filtered = new Set<string>();
        for (const docId of candidateDocs) {
          if (categoryDocs.has(docId)) {
            filtered.add(docId);
          }
        }
        candidateDocs.clear();
        for (const docId of filtered) {
          candidateDocs.add(docId);
        }
      }
    }

    // 评分和排序
    const scoredDocuments: SearchDocument[] = [];
    const highlights: Record<string, string[]> = {};

    for (const docId of candidateDocs) {
      const doc = this.index.documents.get(docId);
      if (!doc) continue;

      // 计算相关性得分
      const score = this.calculateScore(doc, searchTerms);
      
      if (score >= (query.minScore || 0.05)) {
        doc.score = score;
        scoredDocuments.push(doc);

        // 创建高亮
        if (query.highlight) {
          const docHighlights = this.createHighlights(doc.content, searchTerms);
          if (docHighlights.length > 0) {
            highlights[doc.id] = docHighlights;
          }
        }
      }
    }

    // 排序
    if (query.sortBy === 'date') {
      scoredDocuments.sort((a, b) => query.sortOrder === 'asc'
        ? a.created.getTime() - b.created.getTime()
        : b.created.getTime() - a.created.getTime()
      );
    } else {
      scoredDocuments.sort((a, b) => query.sortOrder === 'asc'
        ? (a.score || 0) - (b.score || 0)
        : (b.score || 0) - (a.score || 0)
      );
    }

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginatedDocs = scoredDocuments.slice(offset, offset + limit);

    // 计算分面
    const facets = this.calculateFacets(scoredDocuments);

    // 生成建议
    const suggestions = scoredDocuments.length === 0 ? this.generateSuggestions(query.text) : [];

    // 更新分析
    const processingTime = Date.now() - startTime;
    this.updateAnalytics(query, scoredDocuments.length, processingTime);

    return {
      documents: paginatedDocs,
      total: scoredDocuments.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      query,
      processingTime,
      highlights,
      facets,
      suggestions
    };
  }

  private calculateScore(document: SearchDocument, queryTerms: string[]): number {
    let score = 0;
    const docTerms = this.tokenize(`${document.title} ${document.content}`);
    const uniqueDocTerms = new Set(docTerms);
    
    for (const term of queryTerms) {
      // 标题中的术语权重更高
      if (document.title.toLowerCase().includes(term)) {
        score += 1.5;
      }
      // 内容中的术语
      if (uniqueDocTerms.has(term)) {
        score += 1;
      }
      // 模糊匹配
      for (const docTerm of uniqueDocTerms) {
        if (docTerm.startsWith(term) || term.startsWith(docTerm)) {
          score += 0.5;
        }
      }
    }

    // TF-IDF 计算
    for (const term of queryTerms) {
      const tf = docTerms.filter(t => t === term).length / docTerms.length;
      const idf = this.calculateIDF(term);
      score += tf * idf;
    }

    // 时间衰减
    const ageInDays = (Date.now() - document.created.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) {
      score *= 1.2; // 最近一周的文档增加权重
    } else if (ageInDays > 365) {
      score *= 0.8; // 超过一年的文档降低权重
    }

    return Math.min(score, 10);
  }

  private calculateIDF(term: string): number {
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!;
    }

    const docsWithTerm = this.index.termIndex.get(term)?.size || 0;
    const totalDocs = this.index.documents.size;
    const idf = totalDocs > 0 ? Math.log((totalDocs + 1) / (docsWithTerm + 1)) + 1 : 1;

    this.idfCache.set(term, idf);
    return idf;
  }

  private createHighlights(content: string, terms: string[]): string[] {
    const highlights: string[] = [];
    const lowerContent = content.toLowerCase();
    const sentences = content.split(/[.!?。！？]+/);
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const term of terms) {
        if (lowerSentence.includes(term)) {
          const highlighted = sentence.trim()
            .replace(new RegExp(term, 'gi'), `[${term}]`);
          if (highlighted.length > 3 && highlighted.length < 200) {
            highlights.push(highlighted);
            break;
          }
        }
      }
    }
    
    return highlights.slice(0, 3);
  }

  private calculateFacets(documents: SearchDocument[]): SearchResult['facets'] {
    const categories: Record<string, number> = {};
    const tags: Record<string, number> = {};
    const sources: Record<string, number> = {};

    for (const doc of documents) {
      if (doc.category) {
        categories[doc.category] = (categories[doc.category] || 0) + 1;
      }
      if (doc.tags) {
        for (const tag of doc.tags) {
          tags[tag] = (tags[tag] || 0) + 1;
        }
      }
      if (doc.source) {
        sources[doc.source] = (sources[doc.source] || 0) + 1;
      }
    }

    return {
      categories: Object.fromEntries(Object.entries(categories).slice(0, 10)),
      tags: Object.fromEntries(Object.entries(tags).slice(0, 15)),
      sources: Object.fromEntries(Object.entries(sources).slice(0, 10))
    };
  }

  private generateSuggestions(query: string): string[] {
    const terms = query.toLowerCase().split(/\s+/);
    const suggestions: string[] = [];
    
    for (const term of terms) {
      // 添加同义词建议
      const synonyms = this.synonyms.get(term);
      if (synonyms) {
        suggestions.push(...synonyms.slice(0, 2));
      }
      
      // 查找相似的索引词
      for (const indexedTerm of this.index.termIndex.keys()) {
        if (indexedTerm.startsWith(term) && !suggestions.includes(indexedTerm)) {
          suggestions.push(indexedTerm);
        }
      }
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * 自动完成建议
   */
  autocomplete(prefix: string, limit: number = 10): string[] {
    const lowerPrefix = prefix.toLowerCase();
    const suggestions: string[] = [];
    
    // 直接匹配前缀
    for (const [termPrefix, terms] of this.autocompleteIndex) {
      if (termPrefix.startsWith(lowerPrefix) || lowerPrefix.startsWith(termPrefix)) {
        suggestions.push(...terms.slice(0, limit - suggestions.length));
      }
      if (suggestions.length >= limit) break;
    }
    
    return suggestions.slice(0, limit);
  }

  private updateAnalytics(query: SearchQuery, resultCount: number, processingTime: number): void {
    this.analytics.totalQueries++;
    
    // 更新热门查询
    const queryText = query.text.toLowerCase();
    this.queryHistory.set(queryText, (this.queryHistory.get(queryText) || 0) + 1);
    this.analytics.popularQueries = Array.from(this.queryHistory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // 更新最近查询
    this.analytics.recentQueries.push({
      query: query.text,
      timestamp: new Date(),
      resultCount
    });
    if (this.analytics.recentQueries.length > 50) {
      this.analytics.recentQueries.shift();
    }

    // 更新平均响应时间
    this.analytics.averageResponseTime = 
      (this.analytics.averageResponseTime * (this.analytics.totalQueries - 1) + processingTime) / 
      this.analytics.totalQueries;

    // 零结果计数
    if (resultCount === 0) {
      this.analytics.zeroResults++;
    }
  }

  /**
   * 更新文档
   */
  updateDocument(id: string, updates: Partial<SearchDocument>): boolean {
    const doc = this.index.documents.get(id);
    if (!doc) return false;

    // 从索引中移除旧索引
    this.removeFromIndex(doc);
    
    // 更新文档
    const updatedDoc: SearchDocument = {
      ...doc,
      ...updates,
      id,
      updated: new Date()
    };
    
    this.index.documents.set(id, updatedDoc);
    this.indexDocument(updatedDoc);
    
    return true;
  }

  private removeFromIndex(document: SearchDocument): void {
    const terms = this.tokenize(`${document.title} ${document.content}`);
    const termSet = new Set(terms);
    
    for (const term of termSet) {
      this.index.termIndex.get(term)?.delete(document.id);
      if (this.index.termIndex.get(term)?.size === 0) {
        this.index.termIndex.delete(term);
      }
    }

    if (document.tags) {
      for (const tag of document.tags) {
        this.index.tagIndex.get(tag)?.delete(document.id);
      }
    }

    if (document.category) {
      this.index.categoryIndex.get(document.category)?.delete(document.id);
    }

    this.documentVectors.delete(document.id);
  }

  /**
   * 删除文档
   */
  removeDocument(id: string): boolean {
    const doc = this.index.documents.get(id);
    if (!doc) return false;

    this.removeFromIndex(doc);
    this.index.documents.delete(id);
    return true;
  }

  /**
   * 添加同义词
   */
  addSynonyms(word: string, synonyms: string[]): void {
    const existing = this.synonyms.get(word) || [];
    this.synonyms.set(word, [...new Set([...existing, ...synonyms])]);
  }

  /**
   * 获取分析数据
   */
  getAnalytics(): SearchAnalytics {
    return { ...this.analytics };
  }

  /**
   * 获取所有文档
   */
  getAllDocuments(limit: number = 100): SearchDocument[] {
    return Array.from(this.index.documents.values())
      .sort((a, b) => b.updated.getTime() - a.updated.getTime())
      .slice(0, limit);
  }

  /**
   * 获取文档计数
   */
  getDocumentCount(): number {
    return this.index.documents.size;
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.index.documents.clear();
    this.index.termIndex.clear();
    this.index.tagIndex.clear();
    this.index.categoryIndex.clear();
    this.documentVectors.clear();
    this.idfCache.clear();
    this.queryHistory.clear();
    this.analytics = {
      totalQueries: 0,
      popularQueries: [],
      recentQueries: [],
      averageResponseTime: 0,
      zeroResults: 0,
      topCategories: {}
    };
  }

  /**
   * 查找相似文档
   */
  findSimilar(documentId: string, limit: number = 10): SearchDocument[] {
    const sourceDoc = this.index.documents.get(documentId);
    if (!sourceDoc) return [];

    const sourceVector = this.documentVectors.get(documentId);
    if (!sourceVector) return [];

    const scored: Array<{ doc: SearchDocument; similarity: number }> = [];

    for (const [id, vector] of this.documentVectors) {
      if (id === documentId) continue;

      const similarity = this.cosineSimilarity(sourceVector, vector);
      const doc = this.index.documents.get(id);
      if (doc && similarity > 0.1) {
        scored.push({ doc, similarity });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit).map(s => ({
      ...s.doc,
      score: s.similarity
    }));
  }

  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < v1.length && i < v2.length; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * 按类别获取文档
   */
  getDocumentsByCategory(category: string, limit: number = 50): SearchDocument[] {
    const docIds = this.index.categoryIndex.get(category);
    if (!docIds) return [];
    
    const docs: SearchDocument[] = [];
    for (const id of docIds) {
      const doc = this.index.documents.get(id);
      if (doc) docs.push(doc);
    }
    
    return docs.sort((a, b) => b.updated.getTime() - a.updated.getTime()).slice(0, limit);
  }

  /**
   * 按标签搜索
   */
  searchByTag(tag: string, limit: number = 50): SearchDocument[] {
    const docIds = this.index.tagIndex.get(tag);
    if (!docIds) return [];
    
    const docs: SearchDocument[] = [];
    for (const id of docIds) {
      const doc = this.index.documents.get(id);
      if (doc) docs.push(doc);
    }
    
    return docs.sort((a, b) => b.updated.getTime() - a.updated.getTime()).slice(0, limit);
  }

  /**
   * 获取热门标签
   */
  getPopularTags(limit: number = 20): Array<{ tag: string; count: number }> {
    const tagCounts: Array<{ tag: string; count: number }> = [];
    for (const [tag, docs] of this.index.tagIndex) {
      tagCounts.push({ tag, count: docs.size });
    }
    return tagCounts.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /**
   * 导出索引
   */
  export(): string {
    return JSON.stringify({
      documents: Array.from(this.index.documents.values()),
      synonyms: Object.fromEntries(this.synonyms),
      analytics: this.analytics
    });
  }
}

export const searchEngine = new SearchEngine();
export default SearchEngine;
