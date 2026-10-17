import { Document, DocumentChunk, SearchResult, RAGConfig, defaultRAGConfig, RecallStrategy } from './types';
import { DocumentProcessor } from './DocumentProcessor';
import { VectorStore } from './VectorStore';

interface ContextHistoryEntry {
  query: string;
  refinedQuery: string;
  timestamp: Date;
  resultCount: number;
  avgScore: number;
}

interface QueryUnderstandingResult {
  intent: 'definition' | 'procedure' | 'comparison' | 'factual' | 'causal' | 'opinion' | 'other';
  confidence: number;
  complexity: number;
  complexityLevel: 'simple' | 'medium' | 'complex';
  coreEntities: string[];
  keywords: string[];
  queryType: 'fact' | 'reasoning' | 'open' | 'list' | 'yesno';
  expectedResponseLength: 'short' | 'medium' | 'long';
  rewriteSuggestions: string[];
  timeConstraints: { hasTimeConstraint: boolean; timeRange?: string };
  domainHints: string[];
}

interface DocumentQualityAssessment {
  authority: number;
  timeliness: number;
  relevance: number;
  completeness: number;
  readability: number;
  overallScore: number;
  dimensions: {
    authority: number;
    timeliness: number;
    relevance: number;
    completeness: number;
    readability: number;
  };
  issues: string[];
  strengths: string[];
  summary: string;
}

interface KnowledgeEntity {
  name: string;
  type: string;
  frequency: number;
  relatedEntities: string[];
  sourceChunks: string[];
}

interface KnowledgeRelation {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

interface KnowledgeGraph {
  entities: Map<string, KnowledgeEntity>;
  relations: KnowledgeRelation[];
  lastBuilt: Date;
}

interface HybridSearchResult extends SearchResult {
  keywordScore: number;
  semanticScore: number;
  entityScore: number;
  timeScore: number;
  qualityScore: number;
  combinedScore: number;
  matchHighlights: string[];
}

interface RAGQualityReport {
  overallScore: number;
  relevance: number;
  consistency: number;
  informativeness: number;
  readability: number;
  citationCoverage: number;
  hallucinationRisk: number;
  issues: string[];
  suggestions: string[];
  metrics: {
    avgChunkScore: number;
    contextDiversity: number;
    responseLength: number;
    keywordCoverage: number;
  };
}

interface RAGSystemStatus {
  totalDocuments: number;
  totalChunks: number;
  avgChunksPerDoc: number;
  coverage: {
    keywordCoverage: number;
    entityCoverage: number;
    domainDiversity: number;
  };
  recallQuality: {
    avgScore: number;
    hitRate: number;
    recentPerformance: 'excellent' | 'good' | 'fair' | 'poor';
  };
  knowledgeGraph: {
    entityCount: number;
    relationCount: number;
    isBuilt: boolean;
  };
  health: {
    hasIndex: boolean;
    hasHistory: boolean;
    hasKG: boolean;
    overallHealth: 'healthy' | 'degraded' | 'critical';
  };
  recommendations: string[];
  recentActivity: {
    queryCount: number;
    lastQueryTime: Date | null;
    avgQueryComplexity: number;
  };
}

interface UserProfile {
  id: string;
  topicInterests: Map<string, number>;
  queryHistory: string[];
  preferenceKeywords: Set<string>;
  queryCount: number;
}

type RetrievedChunk = {
  chunk: DocumentChunk;
  document: Document;
  score: number;
  strategy: 'keyword' | 'semantic' | 'entity' | 'time';
  strategyScore: number;
};

export class RAGSystem {
  private config: RAGConfig;
  private documentProcessor: DocumentProcessor;
  private vectorStore: VectorStore;
  private contextHistory: ContextHistoryEntry[] = [];
  private readonly maxHistorySize = 50;

  private knowledgeGraph: KnowledgeGraph = {
    entities: new Map(),
    relations: [],
    lastBuilt: new Date()
  };

  private userProfiles: Map<string, UserProfile> = new Map();
  private defaultUserId = 'default_user';
  private qualityMetrics: { reports: RAGQualityReport[]; totalQueries: number } = { reports: [], totalQueries: 0 };
  private deduplicationCache: Map<string, string> = new Map();
  private mergedFragmentsCache: Map<string, DocumentChunk> = new Map();

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...defaultRAGConfig, ...config };
    this.documentProcessor = new DocumentProcessor(config);
    this.vectorStore = new VectorStore(config);
  }

  /**
   * 添加文档：切分后调用真实向量模型生成向量并入库。
   * 注意：向量化是异步过程，调用方必须 await。
   */
  async addDocument(document: Document): Promise<void> {
    const processedDoc = this.documentProcessor.preprocessDocument(document);
    const chunks = this.documentProcessor.chunkDocumentBySentence(processedDoc);
    await this.vectorStore.addDocument(processedDoc, chunks);
  }

  /**
   * 语义检索：基于真实向量相似度召回。
   * 注意：检索需要向量化查询，因此为异步方法。
   */
  async search(query: string, strategy: RecallStrategy = { name: 'dense' }): Promise<SearchResult[]> {
    const refinedQuery = this.refineQuery(query);

    if (this.config.enableMultiVectorRecall && strategy.name === 'multi') {
      return await this.multiVectorSearch(refinedQuery);
    }

    let results = await this.vectorStore.search(refinedQuery);
    
    if (this.config.enableReranking) {
      results = this.rerankResults(refinedQuery, results);
    }
    
    const avgScore = results.length > 0 
      ? results.reduce((sum, r) => sum + (r.rerankScore || r.score), 0) / results.length 
      : 0;
    
    this.addToHistory(query, refinedQuery, results.length, avgScore);
    
    return results;
  }
  
  refineQuery(query: string): string {
    let refined = query.trim();
    
    refined = refined.replace(/[？?]/g, '?');
    refined = refined.replace(/[！!]/g, '!');
    refined = refined.replace(/\s+/g, ' ');
    
    const intentPatterns = [
      { pattern: /(什么是|什么叫|解释|介绍)/g, suffix: '' },
      { pattern: /(怎么|如何|怎样)/g, suffix: '' },
      { pattern: /(为什么|为何)/g, suffix: '' },
      { pattern: /(什么|哪)/g, suffix: '' }
    ];
    
    const lowerRefined = refined.toLowerCase();
    if (lowerRefined.includes('是什么') || lowerRefined.includes('什么叫')) {
      const match = refined.match(/(?:什么是|什么叫)\s*(.+)/);
      if (match) {
        refined = match[1];
      }
    }
    
    const queryType = this.detectQueryType(refined);
    if (queryType === 'definition') {
      const coreTerms = this.extractCoreTerms(refined);
      if (coreTerms.length > 0) {
        refined = coreTerms.join(' ');
      }
    }
    
    return refined;
  }
  
  private detectQueryType(query: string): 'definition' | 'procedure' | 'comparison' | 'factual' | 'other' {
    const lowerQuery = query.toLowerCase();
    
    if (/什么是|什么叫|解释|介绍/.test(lowerQuery)) return 'definition';
    if (/怎么|如何|怎样/.test(lowerQuery)) return 'procedure';
    if (/比较|区别|不同/.test(lowerQuery)) return 'comparison';
    if (/谁|哪|多少|几/.test(lowerQuery)) return 'factual';
    
    return 'other';
  }
  
  private extractCoreTerms(query: string): string[] {
    const stopWords = ['的', '是', '在', '和', '了', '我', '你', '他', '她', '它', '这', '那', '有', '个', '与', '或', '以及', '以及'];
    const terms = query.split(/\s+/).filter(term => 
      term.length > 1 && !stopWords.includes(term) && !/^[？?！!.,，、。：:]$/.test(term)
    );
    return terms;
  }
  
  calculateRelevance(chunk: DocumentChunk, query: string): number {
    const content = chunk.content.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);
    
    if (queryTerms.length === 0) return 0;
    
    let matchScore = 0;
    let positionScore = 0;
    let densityScore = 0;
    
    for (let i = 0; i < queryTerms.length; i++) {
      const term = queryTerms[i];
      const termIndex = content.indexOf(term);
      
      if (termIndex !== -1) {
        matchScore += 1;
        
        const firstTermPos = content.indexOf(queryTerms[0]);
        if (firstTermPos !== -1 && termIndex < firstTermPos + 50) {
          positionScore += 0.2;
        }
        
        let termCount = 0;
        let searchStart = 0;
        while ((searchStart = content.indexOf(term, searchStart)) !== -1) {
          termCount++;
          searchStart += term.length;
        }
        densityScore += Math.min(termCount / 3, 1) * 0.3;
      }
    }
    
    const relevanceScore = (
      (matchScore / queryTerms.length) * 0.5 +
      Math.min(positionScore, 0.3) +
      Math.min(densityScore, 0.2)
    );
    
    return Math.min(relevanceScore, 1);
  }
  
  adaptContextWindow(query: string, baseMaxLength: number): number {
    const queryType = this.detectQueryType(query);
    const queryLength = query.length;
    
    let multiplier = 1.0;
    
    switch (queryType) {
      case 'definition':
        multiplier = 1.2;
        break;
      case 'procedure':
        multiplier = 1.3;
        break;
      case 'comparison':
        multiplier = 1.4;
        break;
      case 'factual':
        multiplier = 0.9;
        break;
      default:
        multiplier = 1.0;
    }
    
    if (queryLength > 50) {
      multiplier *= 1.1;
    } else if (queryLength < 10) {
      multiplier *= 0.85;
    }
    
    return Math.round(baseMaxLength * multiplier);
  }

  private async multiVectorSearch(query: string): Promise<SearchResult[]> {
    const denseResults = await this.vectorStore.search(query);
    
    const sparseResults = this.sparseSearch(query);
    
    const mergedResults = this.mergeResults(denseResults, sparseResults, {
      dense: 0.6,
      sparse: 0.4
    });

    return mergedResults;
  }

  private sparseSearch(query: string): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const allResults = this.vectorStore.getAllChunks();
    
    const scoredResults = allResults.map(chunk => {
      const content = chunk.content.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchCount++;
        }
      }
      const score = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
      return {
        chunk,
        document: this.vectorStore.getDocument(chunk.documentId)!,
        score
      };
    });

    return scoredResults
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topK * 2);
  }

  private mergeResults(
    denseResults: SearchResult[],
    sparseResults: SearchResult[],
    weights: { dense: number; sparse: number }
  ): SearchResult[] {
    const scoreMap = new Map<string, SearchResult>();

    for (const result of denseResults) {
      const key = result.chunk.id;
      scoreMap.set(key, {
        ...result,
        score: result.score * weights.dense
      });
    }

    for (const result of sparseResults) {
      const key = result.chunk.id;
      const existing = scoreMap.get(key);
      if (existing) {
        existing.score += result.score * weights.sparse;
      } else {
        scoreMap.set(key, {
          ...result,
          score: result.score * weights.sparse
        });
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topK);
  }

  private rerankResults(query: string, results: SearchResult[]): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    return results.map((result, index) => {
      const content = result.chunk.content.toLowerCase();
      let rerankScore = result.score;

      const exactMatches = queryTerms.filter(term => content.includes(term)).length;
      rerankScore += exactMatches * 0.1;

      const positionBonus = 1 / (index + 1);
      rerankScore += positionBonus * 0.05;

      const contentLength = content.length;
      if (contentLength > 100 && contentLength < 1000) {
        rerankScore += 0.05;
      }

      return {
        ...result,
        rerankScore: Math.min(rerankScore, 1)
      };
    }).sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));
  }

  async getContextForQuery(query: string, maxLength?: number): Promise<string> {
    const results = await this.search(query);
    let context = '';
    const effectiveMaxLength = maxLength || this.adaptContextWindow(query, this.config.maxContextLength);

    for (const result of results) {
      const relevanceScore = this.calculateRelevance(result.chunk, query);
      
      if (relevanceScore < this.config.minRelevanceScore) {
        continue;
      }
      
      const sourceInfo = result.document.source 
        ? `[来源: ${result.document.source}]`
        : '';
      
      const relevanceIndicator = relevanceScore >= 0.7 ? '⭐' : relevanceScore >= 0.5 ? '✓' : '';
      
      const chunkContent = result.rerankScore !== undefined 
        ? `${relevanceIndicator}${result.chunk.content} ${sourceInfo}`
        : `${relevanceIndicator}${result.chunk.content} ${sourceInfo}`;
      
      if (context.length + chunkContent.length > effectiveMaxLength) {
        const remaining = effectiveMaxLength - context.length;
        if (remaining > 50) {
          context += chunkContent.slice(0, remaining) + '...\n\n';
        }
        break;
      }
      
      context += chunkContent + '\n\n';
    }

    return context;
  }
  
  private addToHistory(query: string, refinedQuery: string, resultCount: number, avgScore: number): void {
    const entry: ContextHistoryEntry = {
      query,
      refinedQuery,
      timestamp: new Date(),
      resultCount,
      avgScore
    };
    
    this.contextHistory.push(entry);
    
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory = this.contextHistory.slice(-this.maxHistorySize);
    }
  }
  
  getContextHistory(): ContextHistoryEntry[] {
    return [...this.contextHistory];
  }
  
  clearContextHistory(): void {
    this.contextHistory = [];
  }

  async buildPromptWithContext(query: string, systemPrompt: string = ''): Promise<string> {
    const context = await this.getContextForQuery(query);
    
    let prompt = '';
    
    if (systemPrompt) {
      prompt += `${systemPrompt}\n\n`;
    }

    if (context) {
      prompt += `请根据以下相关信息回答问题：\n\n${context}\n\n`;
    }

    prompt += `用户问题: ${query}`;

    return prompt;
  }

  deleteDocument(id: string): void {
    this.vectorStore.deleteDocument(id);
  }

  /** 将向量索引落盘（避免进程重启丢失知识） */
  async saveIndex(target?: string): Promise<string> {
    return this.vectorStore.saveIndex(target);
  }

  /** 从磁盘恢复向量索引 */
  async loadIndex(source?: string): Promise<boolean> {
    return this.vectorStore.loadIndex(source);
  }

  getDocument(id: string): Document | undefined {
    return this.vectorStore.getDocument(id);
  }

  getStats() {
    return this.vectorStore.getStats();
  }

  clearKnowledgeBase(): void {
    this.vectorStore.clear();
  }

  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RAGConfig {
    return { ...this.config };
  }

  /**
   * 文档相关性分析：评估文档与查询的匹配质量
   */
  analyzeDocumentRelevance(query: string, document: { content: string; source?: string }): {
    keywordMatch: number;
    semanticScore: number;
    overallScore: number;
    matchReasons: string[];
    suggestion: string;
  } {
    const matchReasons: string[] = [];
    const lowerQuery = query.toLowerCase();
    const lowerContent = document.content.toLowerCase();

    const queryWords = lowerQuery.split(/[\s,，。？！?!]+/).filter(w => w.length > 2);
    let matchedKeywords = 0;
    for (const word of queryWords) {
      if (lowerContent.includes(word)) {
        matchedKeywords++;
        matchReasons.push(`包含关键词「${word}」`);
      }
    }
    const keywordMatch = queryWords.length > 0 ? matchedKeywords / queryWords.length : 0.3;

    const contentWords = new Set(lowerContent.split(/[\s,，。？！?!]+/).filter(w => w.length > 2));
    let semanticOverlap = 0;
    for (const word of queryWords) {
      if (contentWords.has(word)) semanticOverlap++;
    }
    const semanticScore = contentWords.size > 0 ? semanticOverlap / Math.min(queryWords.length, 10) : 0.3;

    const overallScore = keywordMatch * 0.5 + semanticScore * 0.5;

    let suggestion = '文档与查询相关性良好';
    if (overallScore < 0.2) suggestion = '文档与查询相关性较低，建议补充更相关的资料';
    else if (overallScore < 0.4) suggestion = '文档有一定相关性，但建议查找更专业的资料';

    return {
      keywordMatch: Math.round(keywordMatch * 100) / 100,
      semanticScore: Math.round(semanticScore * 100) / 100,
      overallScore: Math.round(overallScore * 100) / 100,
      matchReasons: matchReasons.slice(0, 5),
      suggestion
    };
  }

  /**
   * 文档质量评估
   */
  evaluateDocumentQuality(content: string): {
    qualityScore: number;
    completeness: number;
    readability: number;
    technicalDepth: number;
    issues: string[];
  } {
    const issues: string[] = [];

    const length = content.length;
    const completeness = length > 500 ? 0.9 : length > 200 ? 0.6 : length > 50 ? 0.3 : 0.1;
    if (length < 50) issues.push('内容过短，信息不足');

    const sentenceCount = (content.match(/[。！？.!?\n]/g) || []).length;
    const avgSentenceLength = sentenceCount > 0 ? length / sentenceCount : length;
    const readability = avgSentenceLength < 50 ? 0.8 : avgSentenceLength < 100 ? 0.6 : avgSentenceLength < 150 ? 0.4 : 0.2;
    if (avgSentenceLength > 150) issues.push('句子过长，影响阅读');

    const technicalTerms = ['算法', '架构', '性能', '优化', '设计', '实现', '测试', '原理', '机制', '模式', '框架', '协议', '接口', '数据结构'];
    let techCount = 0;
    for (const term of technicalTerms) {
      if (content.includes(term)) techCount++;
    }
    const technicalDepth = Math.min(techCount / 5, 1.0);

    const qualityScore = (completeness * 0.3 + readability * 0.3 + technicalDepth * 0.4);

    return {
      qualityScore: Math.round(qualityScore * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      readability: Math.round(readability * 100) / 100,
      technicalDepth: Math.round(technicalDepth * 100) / 100,
      issues
    };
  }

  /**
   * 多路召回增强：结合多种策略检索最佳文档
   */
  async multiStrategyRetrieve(query: string, maxResults: number = 5): Promise<{
    strategy: string;
    results: Array<{ score: number; content: string; source?: string }>;
    recommended: Array<{ score: number; content: string; source?: string }>;
    ranking: string[];
    combinedScore: number;
  }> {
    const refined = this.refineQuery(query);
    const baseResults = await this.search(refined);

    const lowerQuery = query.toLowerCase();
    const queryWords = lowerQuery.split(/[\s,，。？！?!]+/).filter(w => w.length > 2);

    const keywordScored = baseResults.map(result => {
      let matchCount = 0;
      const lowerContent = result.chunk.content.toLowerCase();
      for (const word of queryWords) {
        if (lowerContent.includes(word)) matchCount++;
      }
      const keywordScore = queryWords.length > 0 ? matchCount / queryWords.length : 0.3;
      return { ...result, keywordScore };
    });

    const semanticScored = baseResults.map((result, index) => ({
      ...result,
      semanticScore: 1 - (index / baseResults.length)
    }));

    const qualityScored = baseResults.map(result => ({
      ...result,
      qualityScore: this.evaluateDocumentQuality(result.chunk.content).qualityScore
    }));

    const combined = baseResults.map((result, index) => {
      const keywordMatch = keywordScored[index]?.keywordScore || 0.3;
      const semanticMatch = semanticScored[index]?.semanticScore || 0.3;
      const quality = qualityScored[index]?.qualityScore || 0.5;
      const combinedScore = keywordMatch * 0.35 + semanticMatch * 0.35 + quality * 0.3;

      return {
        score: Math.round(combinedScore * 100) / 100,
        content: result.chunk.content.substring(0, 200) + (result.chunk.content.length > 200 ? '...' : ''),
        source: result.document.source
      };
    });

    const recommended = combined
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    const ranking = recommended.map((r, i) => `${i + 1}. 分数:${r.score} - ${r.content.substring(0, 30)}...`);
    const overallScore = recommended.length > 0 ? recommended.reduce((sum, r) => sum + r.score, 0) / recommended.length : 0;

    return {
      strategy: '综合多路召回（关键词35% + 语义35% + 质量30%）',
      results: recommended,
      recommended,
      ranking,
      combinedScore: Math.round(overallScore * 100) / 100
    };
  }

  /**
   * RAG系统状态分析
   */
  getRAGStatus(): {
    documentCount: number;
    config: object;
    recentQueries: string[];
    performanceIndicator: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];

    const docCount = this.vectorStore.getStats()?.totalDocuments || 0;
    if (docCount === 0) {
      suggestions.push('当前没有文档索引，建议添加知识库文档');
    } else if (docCount < 5) {
      suggestions.push('文档数量较少，建议补充更多领域知识');
    }

    const effectiveWindow = this.adaptContextWindow('test query', this.config.maxContextLength || 1000);
    if (effectiveWindow < 500) {
      suggestions.push('上下文窗口偏小，可能限制答案完整性');
    }

    const hasQueryRefinement = typeof this.refineQuery === 'function';
    if (!hasQueryRefinement) {
      suggestions.push('建议添加查询理解和改写功能');
    }

    const performanceIndicator = docCount > 20 ? '良好' : docCount > 5 ? '一般' : '需要补充';

    return {
      documentCount: docCount,
      config: {
        maxContextLength: this.config.maxContextLength || 1000,
        minRelevanceScore: this.config.minRelevanceScore || 0.3,
        enableMultiVectorRecall: this.config.enableMultiVectorRecall || false,
        enableReranking: this.config.enableReranking || false
      },
      recentQueries: this.contextHistory.slice(-5).map(e => e.query),
      performanceIndicator,
      suggestions
    };
  }

  // ============ 1. 查询理解增强 ============

  /**
   * 深度解析查询意图分类、复杂度评估、查询改写建议
   */
  analyzeQuery(query: string): QueryUnderstandingResult {
    const trimmedQuery = query.trim();
    const lowerQuery = trimmedQuery.toLowerCase();

    // 1. 意图分类 - 基于模式匹配+启发式评分
    const intentScores: Record<string, number> = {
      definition: 0,
      procedure: 0,
      comparison: 0,
      factual: 0,
      causal: 0,
      opinion: 0,
      other: 0
    };

    if (/什么是|什么叫|解释|介绍|定义|概念|含义/.test(lowerQuery)) intentScores.definition += 0.8;
    if (/怎么|如何|怎样|步骤|方法|教程|怎么做/.test(lowerQuery)) intentScores.procedure += 0.8;
    if (/比较|区别|不同|对比|哪个好|vs|相对于/.test(lowerQuery)) intentScores.comparison += 0.8;
    if (/谁|哪|多少|几|何时|何地|是否/.test(lowerQuery)) intentScores.factual += 0.7;
    if (/为什么|原因|导致|因为|所以|影响|原理/.test(lowerQuery)) intentScores.causal += 0.8;
    if (/你认为|推荐|评价|看法|最好|建议|应该/.test(lowerQuery)) intentScores.opinion += 0.7;

    // 基于问题词权重微调
    if (trimmedQuery.endsWith('？') || trimmedQuery.endsWith('?')) {
      for (const k of Object.keys(intentScores)) intentScores[k] += 0.1;
    }

    let maxScore = 0;
    let topIntent = 'other';
    for (const [intent, score] of Object.entries(intentScores)) {
      if (score > maxScore) {
        maxScore = score;
        topIntent = intent;
      }
    }
    const confidence = Math.min(maxScore + 0.2, 1.0);

    // 2. 复杂度评估
    const queryLength = trimmedQuery.length;
    const wordCount = trimmedQuery.split(/\s+/).filter(w => w.length > 1).length;
    const uniqueTermCount = new Set(trimmedQuery.split(/[\s,，。？！?!、]+/).filter(w => w.length > 1)).size;
    const hasConjunction = /[和与及或不仅而且此外另外]/.test(trimmedQuery);
    const hasNegation = /[不没无否非]/.test(trimmedQuery);
    const hasNumeric = /\d+/.test(trimmedQuery);
    const hasQuote = /[""'']/.test(trimmedQuery);
    const clauseCount = (trimmedQuery.match(/[，,。.？?！!；;]/g) || []).length + 1;

    let complexity = 0.1;
    complexity += Math.min(queryLength / 200, 0.3);
    complexity += Math.min(wordCount / 30, 0.2);
    complexity += Math.min(uniqueTermCount / 15, 0.2);
    complexity += hasConjunction ? 0.1 : 0;
    complexity += hasNegation ? 0.05 : 0;
    complexity += hasNumeric ? 0.05 : 0;
    complexity += hasQuote ? 0.05 : 0;
    complexity += Math.min(clauseCount / 5, 0.1);
    if (topIntent === 'comparison' || topIntent === 'causal') complexity += 0.15;
    if (topIntent === 'opinion') complexity += 0.1;
    complexity = Math.min(complexity, 1.0);

    const complexityLevel: 'simple' | 'medium' | 'complex' =
      complexity < 0.33 ? 'simple' : complexity < 0.66 ? 'medium' : 'complex';

    // 3. 核心实体与关键词提取
    const entityKeywords = [
      '公司', '产品', '技术', '系统', '算法', '框架', '模型', '数据', '服务',
      '平台', '项目', '方案', '架构', '标准', '协议', '接口', '流程', '机制',
      '策略', '模块', '组件', '版本', '文档', '案例', '场景', '业务', '用户',
      '管理员', '开发者', '工程师', '团队', '企业', '行业'
    ];
    const coreEntities: string[] = [];
    for (const keyword of entityKeywords) {
      if (trimmedQuery.includes(keyword)) {
        const pattern = new RegExp(`[\\u4e00-\\u9fa5A-Za-z0-9]{0,8}${keyword}[\\u4e00-\\u9fa5A-Za-z0-9]{0,4}`, 'g');
        const matches = trimmedQuery.match(pattern);
        if (matches) {
          for (const m of matches) {
            if (m.length > 1 && m.length < 20 && !coreEntities.includes(m)) {
              coreEntities.push(m);
            }
          }
        }
      }
    }

    const keywords = this.extractCoreTerms(trimmedQuery);

    // 4. 查询类型判断
    let queryType: 'fact' | 'reasoning' | 'open' | 'list' | 'yesno' = 'open';
    if (/是否|有没有|是不是|对吗|可以吗|能否/.test(lowerQuery)) queryType = 'yesno';
    else if (/列出|列举|有哪些|有什么|哪些|多少种/.test(lowerQuery)) queryType = 'list';
    else if (topIntent === 'factual' || topIntent === 'definition') queryType = 'fact';
    else if (topIntent === 'causal' || topIntent === 'comparison' || topIntent === 'procedure') queryType = 'reasoning';

    // 5. 期望响应长度
    let expectedResponseLength: 'short' | 'medium' | 'long' = 'medium';
    if (queryType === 'yesno' || (topIntent === 'factual' && queryLength < 20)) {
      expectedResponseLength = 'short';
    } else if (complexityLevel === 'complex' || topIntent === 'comparison' || topIntent === 'procedure') {
      expectedResponseLength = 'long';
    }

    // 6. 改写建议生成
    const rewriteSuggestions: string[] = [];
    if (queryLength < 5) {
      rewriteSuggestions.push('查询过短，建议补充更多背景信息或具体术语');
    }
    if (keywords.length === 0) {
      rewriteSuggestions.push('未能提取有效关键词，建议使用更专业的术语表述');
    }
    if (hasNegation && !hasConjunction) {
      rewriteSuggestions.push('查询中含否定词，建议改用正向表述以获得更精准结果');
    }
    if (complexityLevel === 'complex') {
      rewriteSuggestions.push('查询较复杂，建议拆分为多个简单子问题依次查询');
    }
    if (topIntent === 'definition') {
      rewriteSuggestions.push(`建议改写为：「${keywords.slice(0, 3).join(' ')} 的定义与核心概念是什么？」`);
    }
    if (topIntent === 'procedure') {
      rewriteSuggestions.push(`建议改写为：「如何实现 ${keywords.slice(0, 2).join(' ')} 的完整步骤？」`);
    }
    if (topIntent === 'comparison') {
      rewriteSuggestions.push('建议补充比较维度（性能/成本/易用性/可维护性等）');
    }
    rewriteSuggestions.push(`核心查询词：${keywords.length > 0 ? keywords.slice(0, 5).join('、') : '无'}`);

    // 7. 时间约束识别
    const timePatterns: Array<{ regex: RegExp; label: string }> = [
      { regex: /(20\d{2}|19\d{2})年/, label: '' },
      { regex: /最近(一天|一周|一个月|半年|一年)/, label: '' },
      { regex: /(今年|去年|明年|本月|上月|下周)/, label: '' },
      { regex: /(第一|第二|第三|第四)季度/, label: '' },
      { regex: /\d{4}\s*[-\/年]\s*\d{1,2}/, label: '' }
    ];
    let hasTimeConstraint = false;
    let timeRange: string | undefined;
    for (const tp of timePatterns) {
      const m = trimmedQuery.match(tp.regex);
      if (m) {
        hasTimeConstraint = true;
        timeRange = m[0];
        break;
      }
    }

    // 8. 领域提示识别
    const domainKeywords: Array<{ domain: string; keywords: string[] }> = [
      { domain: '技术/开发', keywords: ['代码', '编程', '开发', '算法', '函数', '接口', 'API', '框架', '系统', '部署'] },
      { domain: '商业/业务', keywords: ['业务', '市场', '客户', '运营', '销售', '收入', '成本', '利润', '产品'] },
      { domain: '数据/分析', keywords: ['数据', '分析', '统计', '报表', '可视化', '指标', '大数据', '模型'] },
      { domain: '安全/合规', keywords: ['安全', '漏洞', '风险', '合规', '权限', '认证', '加密', '审计'] },
      { domain: '运维/基础设施', keywords: ['服务器', '部署', '运维', '监控', '集群', '容器', '网络', '存储'] },
      { domain: '管理/组织', keywords: ['团队', '管理', '流程', '组织', '计划', '项目', '协作', '沟通'] }
    ];
    const domainHints: string[] = [];
    for (const dk of domainKeywords) {
      const hit = dk.keywords.some(k => trimmedQuery.includes(k));
      if (hit) domainHints.push(dk.domain);
    }

    return {
      intent: topIntent as QueryUnderstandingResult['intent'],
      confidence,
      complexity,
      complexityLevel,
      coreEntities: coreEntities.slice(0, 5),
      keywords: keywords.slice(0, 10),
      queryType,
      expectedResponseLength,
      rewriteSuggestions,
      timeConstraints: { hasTimeConstraint, timeRange },
      domainHints
    };
  }

  // ============ 2. 多路召回增强 ============

  /**
   * 关键词召回：基于精确词匹配 + TF-IDF 简化算法
   */
  keywordRecall(query: string): RetrievedChunk[] {
    const analysis = this.analyzeQuery(query);
    const queryTerms = analysis.keywords.length > 0
      ? analysis.keywords.map(k => k.toLowerCase())
      : query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    if (queryTerms.length === 0) return [];

    const allChunks = this.vectorStore.getAllChunks();
    const termDocFreq: Record<string, number> = {};

    // 计算每个词在多少 chunk 中出现（类似 IDF）
    for (const chunk of allChunks) {
      const content = chunk.content.toLowerCase();
      const seen = new Set<string>();
      for (const term of queryTerms) {
        if (content.includes(term) && !seen.has(term)) {
          seen.add(term);
          termDocFreq[term] = (termDocFreq[term] || 0) + 1;
        }
      }
    }

    const totalDocs = allChunks.length || 1;
    const scored: RetrievedChunk[] = [];

    for (const chunk of allChunks) {
      const document = this.vectorStore.getDocument(chunk.documentId);
      if (!document) continue;

      const content = chunk.content.toLowerCase();
      let score = 0;
      let matchedTerms = 0;

      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchedTerms++;
          // 简化的 TF-IDF: 出现次数越多 * 稀有度越高
          const tf = (content.match(new RegExp(this.escapeRegExp(term), 'g')) || []).length;
          const idf = Math.log((totalDocs + 1) / ((termDocFreq[term] || 0) + 1)) + 1;
          score += Math.min(tf, 3) * idf * (term.length / 3);
        }
      }

      // 标题加权
      const title = (document.title || '').toLowerCase();
      for (const term of queryTerms) {
        if (title.includes(term)) score += 1.5;
      }

      // 归一化
      const normalizedScore = matchedTerms > 0
        ? Math.min(score / (queryTerms.length * 2), 1.0)
        : 0;

      if (normalizedScore > 0.05) {
        scored.push({
          chunk,
          document,
          score: normalizedScore,
          strategy: 'keyword',
          strategyScore: normalizedScore
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, this.config.topK * 2);
  }

  /**
   * 语义召回：基于向量相似度
   */
  async semanticRecall(query: string): Promise<RetrievedChunk[]> {
    const results = await this.vectorStore.search(query);
    return results.map(r => ({
      chunk: r.chunk,
      document: r.document,
      score: r.score,
      strategy: 'semantic' as const,
      strategyScore: r.score
    }));
  }

  /**
   * 实体召回：基于知识图谱中的实体匹配
   */
  entityRecall(query: string): RetrievedChunk[] {
    const analysis = this.analyzeQuery(query);
    const targetEntities = [...analysis.coreEntities, ...analysis.keywords];
    if (targetEntities.length === 0) return [];

    // 构建实体索引（如果尚未构建）
    if (this.knowledgeGraph.entities.size === 0) {
      this.buildKnowledgeGraph();
    }

    const matchedChunkIds = new Set<string>();
    const chunkEntityScore: Record<string, number> = {};

    for (const entityName of targetEntities) {
      const lowerName = entityName.toLowerCase();
      // 在知识图谱中查找匹配实体
      for (const [entityKey, entityData] of this.knowledgeGraph.entities.entries()) {
        if (entityKey.toLowerCase().includes(lowerName) || lowerName.includes(entityKey.toLowerCase())) {
          const matchScore = Math.min(1.0, entityData.frequency / 5.0) + 0.3;
          for (const chunkId of entityData.sourceChunks) {
            matchedChunkIds.add(chunkId);
            chunkEntityScore[chunkId] = (chunkEntityScore[chunkId] || 0) + matchScore;
          }
        }
      }
    }

    // 同时进行简单的实体词匹配作为补充
    const allChunks = this.vectorStore.getAllChunks();
    for (const chunk of allChunks) {
      const content = chunk.content.toLowerCase();
      let directScore = 0;
      for (const entityName of targetEntities) {
        if (content.includes(entityName.toLowerCase())) {
          directScore += 0.3;
          // 实体在 chunk 中的密度加权
          const occurrences = (content.match(new RegExp(this.escapeRegExp(entityName.toLowerCase()), 'g')) || []).length;
          directScore += Math.min(occurrences * 0.1, 0.3);
        }
      }
      if (directScore > 0) {
        chunkEntityScore[chunk.id] = (chunkEntityScore[chunk.id] || 0) + directScore;
        matchedChunkIds.add(chunk.id);
      }
    }

    const results: RetrievedChunk[] = [];
    for (const chunkId of matchedChunkIds) {
      const chunk = allChunks.find(c => c.id === chunkId);
      if (!chunk) continue;
      const document = this.vectorStore.getDocument(chunk.documentId);
      if (!document) continue;
      const score = Math.min(chunkEntityScore[chunkId] || 0, 1.0);
      results.push({ chunk, document, score, strategy: 'entity', strategyScore: score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, this.config.topK * 2);
  }

  /**
   * 时间召回：基于文档时间与查询时间约束
   */
  timeRecall(query: string): RetrievedChunk[] {
    const analysis = this.analyzeQuery(query);
    const allChunks = this.vectorStore.getAllChunks();

    // 提取查询中的时间信息
    let queryYear: number | null = null;
    let queryRelativeTime: 'recent' | 'old' | null = null;

    const yearMatch = query.match(/(20\d{2}|19\d{2})/);
    if (yearMatch) queryYear = parseInt(yearMatch[1], 10);

    if (/最近|最新|当前|现在|今年|近年/.test(query)) queryRelativeTime = 'recent';
    if (/过去|历史|传统|早年|以前|之前/.test(query)) queryRelativeTime = 'old';

    // 如果没有时间约束，直接返回空
    if (!analysis.timeConstraints.hasTimeConstraint && !queryYear && !queryRelativeTime) {
      // 即使没有显式时间约束，也给新文档一点加分，作为补充召回
      const results: RetrievedChunk[] = [];
      const now = Date.now();
      for (const chunk of allChunks) {
        const document = this.vectorStore.getDocument(chunk.documentId);
        if (!document) continue;
        const docTime = new Date(document.updatedAt || document.createdAt).getTime();
        const daysDiff = (now - docTime) / (1000 * 60 * 60 * 24);
        // 衰减曲线：365天以上几乎无影响
        const timeScore = Math.max(0, 1 - daysDiff / 730);
        if (timeScore > 0.1) {
          results.push({ chunk, document, score: timeScore * 0.3, strategy: 'time', strategyScore: timeScore });
        }
      }
      return results.sort((a, b) => b.score - a.score).slice(0, this.config.topK);
    }

    const results: RetrievedChunk[] = [];
    for (const chunk of allChunks) {
      const document = this.vectorStore.getDocument(chunk.documentId);
      if (!document) continue;

      const docTime = new Date(document.updatedAt || document.createdAt);
      let score = 0;

      if (queryYear) {
        const yearDiff = Math.abs(docTime.getFullYear() - queryYear);
        score += Math.max(0, 1 - yearDiff / 5);
      }

      if (queryRelativeTime === 'recent') {
        const now = Date.now();
        const daysDiff = (now - docTime.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 1 - daysDiff / 365);
      } else if (queryRelativeTime === 'old') {
        const now = Date.now();
        const daysDiff = (now - docTime.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.min(1, daysDiff / 730);
      }

      // 内容中的时间信息匹配
      const content = chunk.content;
      const timeWordsInContent: Array<{ word: string; score: number }> = [];
      if (queryYear && content.includes(String(queryYear))) {
        timeWordsInContent.push({ word: String(queryYear), score: 0.5 });
      }
      for (const item of timeWordsInContent) {
        score += item.score;
      }

      if (score > 0.1) {
        const normalizedScore = Math.min(score, 1.0);
        results.push({ chunk, document, score: normalizedScore, strategy: 'time', strategyScore: normalizedScore });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, this.config.topK * 2);
  }

  /**
   * 多路召回融合排序：整合关键词/语义/实体/时间四种召回结果
   */
  async fusedMultiRecall(query: string, weights: {
    keyword?: number;
    semantic?: number;
    entity?: number;
    time?: number;
  } = {}): Promise<HybridSearchResult[]> {
    const w = { keyword: 0.3, semantic: 0.35, entity: 0.2, time: 0.15, ...weights };

    const keywordResults = this.keywordRecall(query);
    const semanticResults = await this.semanticRecall(query);
    const entityResults = this.entityRecall(query);
    const timeResults = this.timeRecall(query);

    // 收集所有 chunk 的综合评分
    const fusedMap = new Map<string, {
      chunk: DocumentChunk;
      document: Document;
      keywordScore: number;
      semanticScore: number;
      entityScore: number;
      timeScore: number;
      matchHighlights: string[];
    }>();

    const ensureEntry = (r: RetrievedChunk) => {
      const key = r.chunk.id;
      if (!fusedMap.has(key)) {
        fusedMap.set(key, {
          chunk: r.chunk,
          document: r.document,
          keywordScore: 0,
          semanticScore: 0,
          entityScore: 0,
          timeScore: 0,
          matchHighlights: []
        });
      }
      return fusedMap.get(key)!;
    };

    for (const r of keywordResults) {
      const entry = ensureEntry(r);
      entry.keywordScore = Math.max(entry.keywordScore, r.strategyScore);
    }
    for (const r of semanticResults) {
      const entry = ensureEntry(r);
      entry.semanticScore = Math.max(entry.semanticScore, r.strategyScore);
    }
    for (const r of entityResults) {
      const entry = ensureEntry(r);
      entry.entityScore = Math.max(entry.entityScore, r.strategyScore);
    }
    for (const r of timeResults) {
      const entry = ensureEntry(r);
      entry.timeScore = Math.max(entry.timeScore, r.strategyScore);
    }

    // 生成高亮信息
    const analysis = this.analyzeQuery(query);
    const highlightTerms = analysis.keywords;

    const hybridResults: HybridSearchResult[] = [];
    for (const entry of fusedMap.values()) {
      const qualityScore = this.evaluateDocumentQuality(entry.chunk.content).qualityScore;
      const combined = (
        entry.keywordScore * w.keyword +
        entry.semanticScore * w.semantic +
        entry.entityScore * w.entity +
        entry.timeScore * w.time
      ) * 0.85 + qualityScore * 0.15;

      const highlights: string[] = [];
      for (const term of highlightTerms.slice(0, 5)) {
        if (entry.chunk.content.toLowerCase().includes(term.toLowerCase())) {
          highlights.push(term);
        }
      }

      hybridResults.push({
        chunk: entry.chunk,
        document: entry.document,
        score: combined,
        keywordScore: entry.keywordScore,
        semanticScore: entry.semanticScore,
        entityScore: entry.entityScore,
        timeScore: entry.timeScore,
        qualityScore,
        combinedScore: Math.min(combined, 1.0),
        matchHighlights: highlights
      });
    }

    return hybridResults
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, this.config.topK);
  }

  // ============ 3. 文档质量评估增强 ============

  /**
   * 五维文档质量评估：权威性、时效性、相关性、完整性、可读性
   */
  assessDocumentQuality(document: Document, query?: string): DocumentQualityAssessment {
    const issues: string[] = [];
    const strengths: string[] = [];

    // 1. 权威性评估
    let authority = 0.5;
    const source = document.source || '';
    const authorityHints = [
      { pattern: /(官方|standard|rfc|ieee|国家标准|白皮书|manual|documentation)/i, score: 0.2 },
      { pattern: /(wiki|百科|blog|博客|知乎|medium)/i, score: 0.05 },
      { pattern: /(github|repository|repo)/i, score: 0.1 }
    ];
    for (const hint of authorityHints) {
      if (hint.pattern.test(source) || hint.pattern.test(document.content)) {
        authority += hint.score;
      }
    }
    const referenceCount = (document.content.match(/参考|引用|来源|see also|ref:/gi) || []).length;
    authority += Math.min(referenceCount * 0.05, 0.2);
    if (document.metadata && typeof document.metadata === 'object') {
      const md = document.metadata as Record<string, unknown>;
      if (md.authorityLevel && typeof md.authorityLevel === 'number') authority = md.authorityLevel;
    }
    authority = Math.min(authority, 1.0);
    if (authority > 0.75) strengths.push('文档来源权威性较高');
    if (authority < 0.4) issues.push('文档来源权威性不足，建议交叉验证');

    // 2. 时效性评估
    let timeliness = 0.5;
    const updatedAt = new Date(document.updatedAt || document.createdAt);
    const now = new Date();
    const yearsDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsDiff < 0.5) timeliness = 0.95;
    else if (yearsDiff < 1) timeliness = 0.85;
    else if (yearsDiff < 2) timeliness = 0.7;
    else if (yearsDiff < 3) timeliness = 0.55;
    else if (yearsDiff < 5) timeliness = 0.4;
    else timeliness = 0.25;

    // 内容中包含的最新年份也作为时效性线索
    const yearMatches = document.content.match(/20\d{2}/g);
    if (yearMatches && yearMatches.length > 0) {
      const maxYear = Math.max(...yearMatches.map(y => parseInt(y, 10)));
      const yearGap = now.getFullYear() - maxYear;
      if (yearGap <= 1) timeliness = Math.max(timeliness, 0.9);
      else if (yearGap <= 2) timeliness = Math.max(timeliness, 0.75);
    }
    timeliness = Math.min(timeliness, 1.0);
    if (yearsDiff > 3) issues.push(`文档更新时间距今 ${Math.round(yearsDiff)} 年，内容可能已过时`);
    if (yearsDiff < 1) strengths.push('文档较新，时效性良好');

    // 3. 相关性评估（如果提供了查询）
    let relevance = 0.5;
    if (query) {
      const rel = this.analyzeDocumentRelevance(query, { content: document.content, source: document.source });
      relevance = rel.overallScore;
      if (relevance > 0.7) strengths.push('文档与查询高度相关');
      if (relevance < 0.3) issues.push('文档与查询相关性较低');
    } else {
      relevance = 0.5;
    }

    // 4. 完整性评估
    const len = document.content.length;
    let completeness = 0.5;
    if (len > 3000) completeness = 0.95;
    else if (len > 1500) completeness = 0.85;
    else if (len > 800) completeness = 0.7;
    else if (len > 300) completeness = 0.5;
    else if (len > 100) completeness = 0.3;
    else completeness = 0.15;

    // 结构化信号（标题/分段/列表）增强完整性
    const hasHeading = /[\n\r]+.{1,40}[\n\r]+/.test(document.content);
    const hasList = /(^\s*[-*•]\s|^\s*\d+\.\s)/m.test(document.content);
    const hasParagraph = document.content.split(/\n\s*\n/).length >= 2;
    if (hasHeading) completeness = Math.min(completeness + 0.05, 1.0);
    if (hasList) completeness = Math.min(completeness + 0.05, 1.0);
    if (hasParagraph) completeness = Math.min(completeness + 0.05, 1.0);

    if (len < 200) issues.push('文档内容过短，可能不完整');
    if (hasList && hasHeading) strengths.push('文档结构清晰，内容组织良好');

    // 5. 可读性评估
    let readability = 0.5;
    const sentences = document.content.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 0);
    const avgSentenceLen = sentences.length > 0 ? len / sentences.length : len;
    if (avgSentenceLen < 40) readability += 0.3;
    else if (avgSentenceLen < 70) readability += 0.2;
    else if (avgSentenceLen < 120) readability += 0.05;
    else readability -= 0.15;

    // 标点多样性
    const punctuationSet = new Set((document.content.match(/[，。！？、；：,.!?;:]/g) || []));
    readability += Math.min(punctuationSet.size / 10, 0.2);

    // 代码/特殊符号比例
    const codeChars = (document.content.match(/[{}\[\]()<>=\-+*/%]/g) || []).length;
    const codeRatio = codeChars / Math.max(len, 1);
    if (codeRatio > 0.25) readability -= 0.2; // 代码太多对纯文本阅读不利
    else if (codeRatio > 0.05) readability += 0.05; // 适度代码辅助理解

    readability = Math.max(0, Math.min(readability, 1.0));
    if (avgSentenceLen > 150) issues.push('句子过长，影响阅读流畅度');
    if (punctuationSet.size >= 6) strengths.push('标点使用多样，表达丰富');

    // 综合评分
    const overallScore = Math.round((authority * 0.2 + timeliness * 0.15 + relevance * 0.25 + completeness * 0.2 + readability * 0.2) * 100) / 100;

    let summary = '文档质量评估完成';
    if (overallScore >= 0.8) summary = '文档质量优秀，可作为主要参考资料';
    else if (overallScore >= 0.6) summary = '文档质量良好，建议作为补充参考';
    else if (overallScore >= 0.4) summary = '文档质量一般，使用时需注意甄别';
    else summary = '文档质量偏低，建议寻找更优质的替代资料';

    return {
      authority: Math.round(authority * 100) / 100,
      timeliness: Math.round(timeliness * 100) / 100,
      relevance: Math.round(relevance * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      readability: Math.round(readability * 100) / 100,
      overallScore,
      dimensions: { authority, timeliness, relevance, completeness, readability },
      issues,
      strengths,
      summary
    };
  }

  // ============ 4. 上下文管理增强 ============

  /**
   * 动态上下文窗口：根据查询复杂度和响应长度自适应调整
   */
  adaptiveContextWindow(query: string, baseMaxLength?: number): number {
    const analysis = this.analyzeQuery(query);
    const base = baseMaxLength || this.config.maxContextLength;

    let multiplier = 1.0;

    // 基于查询意图调整
    switch (analysis.intent) {
      case 'definition':
        multiplier *= 1.1;
        break;
      case 'procedure':
        multiplier *= 1.3;
        break;
      case 'comparison':
        multiplier *= 1.5;
        break;
      case 'causal':
        multiplier *= 1.3;
        break;
      case 'opinion':
        multiplier *= 1.2;
        break;
      case 'factual':
        multiplier *= 0.8;
        break;
      default:
        multiplier *= 1.0;
    }

    // 基于复杂度调整
    switch (analysis.complexityLevel) {
      case 'complex':
        multiplier *= 1.4;
        break;
      case 'medium':
        multiplier *= 1.15;
        break;
      case 'simple':
        multiplier *= 0.85;
        break;
    }

    // 基于期望响应长度调整
    switch (analysis.expectedResponseLength) {
      case 'long':
        multiplier *= 1.4;
        break;
      case 'medium':
        multiplier *= 1.0;
        break;
      case 'short':
        multiplier *= 0.6;
        break;
    }

    // 基于关键词数量微调
    multiplier *= Math.min(1 + analysis.keywords.length / 20, 1.3);

    // 限制范围
    multiplier = Math.max(0.4, Math.min(multiplier, 2.5));

    return Math.round(base * multiplier);
  }

  /**
   * 基于上下文窗口和智能去重的上下文构建
   */
  async buildSmartContext(query: string, options: {
    enableDedup?: boolean;
    enableMerging?: boolean;
    maxLength?: number;
  } = {}): Promise<{
    context: string;
    usedChunks: SearchResult[];
    effectiveLength: number;
    maxAllowedLength: number;
    deduplicatedCount: number;
    mergedCount: number;
  }> {
    const opts = { enableDedup: true, enableMerging: true, ...options };
    const maxAllowedLength = opts.maxLength || this.adaptiveContextWindow(query, this.config.maxContextLength);

    // 使用混合召回
    const results = await this.fusedMultiRecall(query);
    let candidateChunks: SearchResult[] = results.map(r => ({
      chunk: r.chunk,
      document: r.document,
      score: r.combinedScore,
      rerankScore: r.combinedScore
    }));

    let deduplicatedCount = 0;
    let mergedCount = 0;

    // 去重
    if (opts.enableDedup) {
      const before = candidateChunks.length;
      candidateChunks = this.deduplicateChunks(candidateChunks);
      deduplicatedCount = before - candidateChunks.length;
    }

    // 合并相似片段
    if (opts.enableMerging) {
      const before = candidateChunks.length;
      candidateChunks = this.mergeSimilarFragments(candidateChunks);
      mergedCount = before - candidateChunks.length;
    }

    // 构建上下文内容
    let context = '';
    const usedChunks: SearchResult[] = [];
    const analysis = this.analyzeQuery(query);

    for (const result of candidateChunks) {
      const relevance = this.calculateRelevance(result.chunk, query);
      if (relevance < this.config.minRelevanceScore * 0.8) continue;

      const sourceInfo = result.document.source
        ? `[来源: ${result.document.source} | 文档: ${result.document.title}]`
        : `[文档: ${result.document.title}]`;

      const quality = this.assessDocumentQuality(result.document, query);
      const qualityTag = quality.overallScore >= 0.7 ? '⭐' : quality.overallScore >= 0.5 ? '✓' : '';

      const chunkContent = `${qualityTag}${result.chunk.content} ${sourceInfo}\n`;

      if (context.length + chunkContent.length > maxAllowedLength) {
        const remaining = maxAllowedLength - context.length;
        if (remaining > 80) {
          context += chunkContent.substring(0, remaining) + '...\n';
        }
        break;
      }
      context += chunkContent;
      usedChunks.push(result);
    }

    // 附加上下文引导
    if (analysis.intent === 'comparison' && usedChunks.length >= 2) {
      context += `\n[提示: 以上内容来自 ${usedChunks.length} 个文档片段，请进行对比分析]\n`;
    }

    return {
      context,
      usedChunks,
      effectiveLength: context.length,
      maxAllowedLength,
      deduplicatedCount,
      mergedCount
    };
  }

  // ============ 5. 答案生成质量监控 ============

  /**
   * 监控 RAG 输出质量，自动生成质量评分
   */
  monitorAnswerQuality(
    query: string,
    generatedAnswer: string,
    contextChunks: SearchResult[] = []
  ): RAGQualityReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const analysis = this.analyzeQuery(query);

    // 1. 相关性：答案是否包含查询关键词
    let relevance = 0.5;
    const keywords = analysis.keywords;
    if (keywords.length > 0) {
      let hits = 0;
      for (const kw of keywords) {
        if (generatedAnswer.toLowerCase().includes(kw.toLowerCase())) hits++;
      }
      relevance = hits / keywords.length;
      // 同义词或语义重叠补充
      const queryWords = query.split(/\s+/).filter(w => w.length > 1);
      for (const w of queryWords) {
        if (generatedAnswer.toLowerCase().includes(w.toLowerCase())) relevance = Math.min(relevance + 0.05, 1.0);
      }
    } else {
      relevance = 0.4;
    }
    if (relevance < 0.4) {
      issues.push('答案与查询关键词匹配度较低');
      suggestions.push('建议扩充知识库中相关主题的文档');
    }

    // 2. 一致性：答案与上下文信息的一致性
    let consistency = 0.5;
    const contextText = contextChunks.map(c => c.chunk.content).join(' ');
    if (contextText.length > 0 && generatedAnswer.length > 0) {
      // 简单的一致性检查：答案中出现的核心概念是否在上下文中出现
      const answerWords = new Set(
        generatedAnswer.split(/[\s,，。？！?!、；;:：]+/).filter(w => w.length >= 2)
      );
      const contextWords = new Set(
        contextText.split(/[\s,，。？！?!、；;:：]+/).filter(w => w.length >= 2)
      );
      let shared = 0;
      for (const w of answerWords) {
        if (contextWords.has(w)) shared++;
      }
      consistency = answerWords.size > 0 ? Math.min(shared / Math.min(answerWords.size, 20), 1.0) : 0.5;

      // 额外检查：上下文 chunk 的文档标题/来源是否提及
      for (const chunk of contextChunks) {
        const title = chunk.document.title || '';
        if (generatedAnswer.includes(title) || generatedAnswer.includes(chunk.document.source || '')) {
          consistency = Math.min(consistency + 0.05, 1.0);
        }
      }
    }
    if (consistency < 0.3) issues.push('答案与上下文信息一致性偏低');

    // 3. 信息量：答案的具体程度
    let informativeness = 0.5;
    const answerLen = generatedAnswer.length;
    // 长度评分
    if (analysis.expectedResponseLength === 'short') {
      informativeness = answerLen > 30 && answerLen < 300 ? 0.9 : answerLen < 500 ? 0.7 : 0.4;
    } else if (analysis.expectedResponseLength === 'medium') {
      informativeness = answerLen > 150 && answerLen < 800 ? 0.9 : answerLen > 80 && answerLen < 1500 ? 0.7 : 0.4;
    } else {
      informativeness = answerLen > 400 && answerLen < 2000 ? 0.9 : answerLen > 200 ? 0.7 : 0.4;
    }

    // 数字/引用/例子信号
    const numericHits = (generatedAnswer.match(/\d+/g) || []).length;
    const listHits = (generatedAnswer.match(/(^|\n)[\s]*[\d一二三四五六七八九十]+[.、)/]/g) || []).length;
    const quoteHits = (generatedAnswer.match(/[""''《》【】\[\]]/g) || []).length;
    informativeness += Math.min(numericHits * 0.02, 0.1);
    informativeness += Math.min(listHits * 0.05, 0.15);
    informativeness += Math.min(quoteHits * 0.02, 0.1);
    informativeness = Math.min(informativeness, 1.0);

    if (answerLen < 30) {
      issues.push('答案过于简短');
      suggestions.push('建议改进 prompt 以引导更详细的回答');
    }
    if (numericHits === 0 && analysis.queryType === 'fact') {
      suggestions.push('可补充更多具体数值和量化信息');
    }

    // 4. 可读性：答案的结构与流畅度
    let readability = 0.5;
    const ansSentences = generatedAnswer.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 0);
    const avgSentLen = ansSentences.length > 0 ? answerLen / ansSentences.length : answerLen;
    if (avgSentLen < 60 && avgSentLen > 10) readability += 0.2;
    else if (avgSentLen < 100) readability += 0.1;
    else readability -= 0.1;

    // 段落结构
    const paragraphs = generatedAnswer.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 2) readability += 0.15;
    if (listHits > 0) readability += 0.1;

    // 避免过度重复
    const wordFreq: Record<string, number> = {};
    const words = generatedAnswer.split(/[\s,，。？！?!、；;:：]+/).filter(w => w.length >= 2);
    for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;
    const maxFreq = Math.max(...Object.values(wordFreq), 1);
    const repetitionRatio = maxFreq / Math.max(words.length, 1);
    if (repetitionRatio > 0.15) readability -= 0.15;

    readability = Math.max(0, Math.min(readability, 1.0));
    if (avgSentLen > 150) issues.push('答案句子过长');

    // 5. 引用覆盖率：答案引用的上下文比例
    let citationCoverage = 0;
    if (contextChunks.length > 0) {
      const contextTerms = new Set<string>();
      for (const chunk of contextChunks) {
        const terms = chunk.chunk.content.split(/[\s,，。？！?!、；;:：]+/).filter(w => w.length >= 2);
        for (const t of terms.slice(0, 20)) contextTerms.add(t);
      }
      let covered = 0;
      for (const w of words) {
        if (contextTerms.has(w)) covered++;
      }
      citationCoverage = words.length > 0 ? Math.min(covered / words.length, 1.0) : 0;
    }

    // 6. 幻觉风险评估
    let hallucinationRisk = 0.3;
    if (contextChunks.length === 0 && generatedAnswer.length > 50) hallucinationRisk = 0.8;
    else if (consistency < 0.2) hallucinationRisk = 0.7;
    else if (relevance < 0.2) hallucinationRisk = 0.6;
    else if (citationCoverage < 0.2) hallucinationRisk = 0.5;
    else if (consistency > 0.6 && citationCoverage > 0.4) hallucinationRisk = 0.15;
    else hallucinationRisk = 0.3;

    if (hallucinationRisk > 0.5) {
      issues.push('答案可能存在较高的幻觉风险');
      suggestions.push('建议加强检索策略，提供更多相关上下文文档');
    }

    // 综合评分
    const overallScore = Math.round((
      relevance * 0.25 +
      consistency * 0.2 +
      informativeness * 0.2 +
      readability * 0.15 +
      citationCoverage * 0.2
    ) * 100) / 100;

    // 收集指标
    const avgChunkScore = contextChunks.length > 0
      ? contextChunks.reduce((sum, c) => sum + (c.rerankScore || c.score), 0) / contextChunks.length
      : 0;

    const docsSet = new Set(contextChunks.map(c => c.document.id));
    const contextDiversity = docsSet.size;

    const report: RAGQualityReport = {
      overallScore,
      relevance: Math.round(relevance * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      informativeness: Math.round(informativeness * 100) / 100,
      readability: Math.round(readability * 100) / 100,
      citationCoverage: Math.round(citationCoverage * 100) / 100,
      hallucinationRisk: Math.round(hallucinationRisk * 100) / 100,
      issues,
      suggestions,
      metrics: {
        avgChunkScore: Math.round(avgChunkScore * 100) / 100,
        contextDiversity,
        responseLength: answerLen,
        keywordCoverage: Math.round(relevance * 100) / 100
      }
    };

    this.qualityMetrics.reports.push(report);
    this.qualityMetrics.totalQueries++;
    if (this.qualityMetrics.reports.length > 100) {
      this.qualityMetrics.reports = this.qualityMetrics.reports.slice(-100);
    }

    return report;
  }

  getQualityHistory(): { totalQueries: number; avgScore: number; recentReports: RAGQualityReport[] } {
    const reports = this.qualityMetrics.reports;
    const avgScore = reports.length > 0
      ? reports.reduce((s, r) => s + r.overallScore, 0) / reports.length
      : 0;
    return {
      totalQueries: this.qualityMetrics.totalQueries,
      avgScore: Math.round(avgScore * 100) / 100,
      recentReports: reports.slice(-10)
    };
  }

  // ============ 6. 知识图谱集成 ============

  /**
   * 从文档中提取实体和关系，构建知识图谱
   */
  buildKnowledgeGraph(): KnowledgeGraph {
    const entities = new Map<string, KnowledgeEntity>();
    const relations: KnowledgeRelation[] = [];
    const allChunks = this.vectorStore.getAllChunks();

    // 实体类型模式字典
    const entityPatterns: Array<{ type: string; regex: RegExp }> = [
      { type: 'organization', regex: /(公司|集团|有限公司|机构|组织|联盟|协会|基金会)[\u4e00-\u9fa5A-Za-z0-9]{0,10}/g },
      { type: 'technology', regex: /[\u4e00-\u9fa5A-Za-z]{0,10}(技术|系统|框架|算法|模型|协议|标准|平台|引擎|服务)/g },
      { type: 'product', regex: /[\u4e00-\u9fa5A-Za-z0-9]{0,10}(产品|版本|应用|工具)[\u4e00-\u9fa5A-Za-z0-9]{0,4}/g },
      { type: 'concept', regex: /[\u4e00-\u9fa5]{2,8}(性|化|论|学|率|度|效应|原则|机制|流程|方法)/g },
      { type: 'person', regex: /(张|王|李|赵|陈|刘|杨|黄|吴|周)[\u4e00-\u9fa5]{1,3}(先生|女士|博士|工程师|专家|领导)/g },
      { type: 'location', regex: /[\u4e00-\u9fa5]{2,6}(省|市|区|县|国家|地区)/g }
    ];

    // 关系触发词
    const relationTriggers: Array<{ type: string; words: string[] }> = [
      { type: 'is_a', words: ['是一种', '是一个', '属于', '归类为', '即'] },
      { type: 'part_of', words: ['部分', '组成', '包含', '包括', '分为', '由...组成'] },
      { type: 'uses', words: ['使用', '采用', '基于', '通过', '利用'] },
      { type: 'related_to', words: ['与...相关', '有关', '联系', '关联', '涉及'] },
      { type: 'causes', words: ['导致', '引起', '造成', '产生', '影响'] },
      { type: 'improves', words: ['提高', '增强', '改进', '优化', '提升'] }
    ];

    for (const chunk of allChunks) {
      const content = chunk.content;
      const document = this.vectorStore.getDocument(chunk.documentId);
      if (!document) continue;

      // 1. 从文档标题中提取高置信度实体
      const title = document.title || '';
      const titleTerms = title.split(/[\s,，。？！?!、；;:：\-]+/).filter(t => t.length >= 2 && t.length <= 20);
      for (const term of titleTerms) {
        if (!entities.has(term)) {
          entities.set(term, {
            name: term,
            type: 'concept',
            frequency: 0,
            relatedEntities: [],
            sourceChunks: []
          });
        }
        const ent = entities.get(term)!;
        ent.frequency += 2; // 标题加权
        if (!ent.sourceChunks.includes(chunk.id)) ent.sourceChunks.push(chunk.id);
      }

      // 2. 通过模式匹配提取实体
      for (const pattern of entityPatterns) {
        const matches = content.match(pattern.regex);
        if (matches) {
          for (const m of matches) {
            const clean = m.trim();
            if (clean.length < 2 || clean.length > 30) continue;
            if (!entities.has(clean)) {
              entities.set(clean, {
                name: clean,
                type: pattern.type,
                frequency: 0,
                relatedEntities: [],
                sourceChunks: []
              });
            }
            const ent = entities.get(clean)!;
            ent.frequency += 1;
            if (!ent.sourceChunks.includes(chunk.id)) ent.sourceChunks.push(chunk.id);
          }
        }
      }

      // 3. 提取简单关系：如果句子中包含多个实体和触发词
      const sentences = content.split(/[。！？.!?\n]+/).filter(s => s.trim().length > 5);
      for (const sentence of sentences) {
        const sentEntities: string[] = [];
        for (const entityName of entities.keys()) {
          if (sentence.includes(entityName)) sentEntities.push(entityName);
        }
        if (sentEntities.length >= 2) {
          for (let i = 0; i < sentEntities.length - 1; i++) {
            for (let j = i + 1; j < sentEntities.length; j++) {
              let relationType = 'related_to';
              let confidence = 0.3;
              for (const trigger of relationTriggers) {
                for (const word of trigger.words) {
                  if (sentence.includes(word)) {
                    relationType = trigger.type;
                    confidence += 0.15;
                  }
                }
              }
              confidence = Math.min(confidence, 1.0);
              relations.push({
                source: sentEntities[i],
                target: sentEntities[j],
                type: relationType,
                confidence
              });
              // 更新相关实体列表
              const src = entities.get(sentEntities[i]);
              if (src && !src.relatedEntities.includes(sentEntities[j])) src.relatedEntities.push(sentEntities[j]);
              const tgt = entities.get(sentEntities[j]);
              if (tgt && !tgt.relatedEntities.includes(sentEntities[i])) tgt.relatedEntities.push(sentEntities[i]);
            }
          }
        }
      }
    }

    // 过滤低质量实体（仅保留出现 >=2 次的）
    const filteredEntities = new Map<string, KnowledgeEntity>();
    for (const [name, data] of entities.entries()) {
      if (data.frequency >= 2 || data.sourceChunks.length >= 1) {
        filteredEntities.set(name, data);
      }
    }

    // 去重关系
    const seenRelations = new Set<string>();
    const uniqueRelations: KnowledgeRelation[] = [];
    for (const rel of relations) {
      const key = `${rel.source}|${rel.target}|${rel.type}`;
      if (!seenRelations.has(key)) {
        seenRelations.add(key);
        uniqueRelations.push(rel);
      }
    }

    this.knowledgeGraph = {
      entities: filteredEntities,
      relations: uniqueRelations.slice(0, 500),
      lastBuilt: new Date()
    };

    return this.knowledgeGraph;
  }

  /**
   * 通过知识图谱扩展查询
   */
  expandQueryByGraph(query: string, maxExpansions: number = 5): string[] {
    if (this.knowledgeGraph.entities.size === 0) {
      this.buildKnowledgeGraph();
    }

    const analysis = this.analyzeQuery(query);
    const expansionTerms: string[] = [];
    const seen = new Set<string>();

    const seeds = [...analysis.coreEntities, ...analysis.keywords];

    for (const seed of seeds) {
      // 精确匹配
      if (this.knowledgeGraph.entities.has(seed)) {
        const data = this.knowledgeGraph.entities.get(seed)!;
        for (const related of data.relatedEntities.slice(0, 3)) {
          if (!seen.has(related) && related !== seed) {
            seen.add(related);
            expansionTerms.push(related);
          }
        }
      }
      // 部分匹配
      for (const entityName of this.knowledgeGraph.entities.keys()) {
        if (entityName.includes(seed) || seed.includes(entityName)) {
          const data = this.knowledgeGraph.entities.get(entityName)!;
          for (const related of data.relatedEntities.slice(0, 2)) {
            if (!seen.has(related)) {
              seen.add(related);
              expansionTerms.push(related);
            }
          }
        }
      }
    }

    return expansionTerms.slice(0, maxExpansions);
  }

  getKnowledgeGraphStats(): {
    entityCount: number;
    relationCount: number;
    topEntities: Array<{ name: string; frequency: number; type: string }>;
    lastBuilt: Date;
  } {
    if (this.knowledgeGraph.entities.size === 0) {
      this.buildKnowledgeGraph();
    }
    const top = Array.from(this.knowledgeGraph.entities.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(e => ({ name: e.name, frequency: e.frequency, type: e.type }));

    return {
      entityCount: this.knowledgeGraph.entities.size,
      relationCount: this.knowledgeGraph.relations.length,
      topEntities: top,
      lastBuilt: this.knowledgeGraph.lastBuilt
    };
  }

  // ============ 7. 文档去重与合并 ============

  /**
   * 检测重复文档（基于内容相似度 + 标题匹配）
   */
  deduplicateChunks(chunks: SearchResult[]): SearchResult[] {
    if (chunks.length <= 1) return chunks;

    const result: SearchResult[] = [];
    const seenSignatures = new Set<string>();
    const seenContentHashes = new Set<string>();

    for (const item of chunks) {
      // 1. 精确内容哈希去重
      const contentHash = this.simpleHash(item.chunk.content);
      if (seenContentHashes.has(contentHash)) continue;
      seenContentHashes.add(contentHash);

      // 2. 基于特征词的签名去重
      const contentLower = item.chunk.content.toLowerCase();
      const sigWords = contentLower
        .split(/[\s,，。？！?!、；;:：\-]+/)
        .filter(w => w.length >= 3)
        .slice(0, 15)
        .sort();
      const signature = sigWords.join('|');
      const sigHash = this.simpleHash(signature);
      if (seenSignatures.has(sigHash)) continue;
      seenSignatures.add(sigHash);

      // 3. 粗略相似度比对（Jaccard）
      let isDup = false;
      const contentSet = new Set(
        item.chunk.content.split(/[\s,，。？！?!、；;:：\-]+/).filter(w => w.length >= 2)
      );
      for (const existing of result) {
        const existingSet = new Set(
          existing.chunk.content.split(/[\s,，。？！?!、；;:：\-]+/).filter(w => w.length >= 2)
        );
        let intersection = 0;
        for (const w of contentSet) {
          if (existingSet.has(w)) intersection++;
        }
        const union = contentSet.size + existingSet.size - intersection;
        const jaccard = union > 0 ? intersection / union : 0;
        if (jaccard > 0.7) {
          isDup = true;
          // 保留评分更高的那个
          if ((item.rerankScore || item.score) > (existing.rerankScore || existing.score)) {
            const idx = result.indexOf(existing);
            result[idx] = item;
          }
          break;
        }
      }

      if (!isDup) {
        this.deduplicationCache.set(item.chunk.id, contentHash);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * 合并相似文档片段（同一文档内相邻/主题相似的 chunk）
   */
  mergeSimilarFragments(chunks: SearchResult[]): SearchResult[] {
    if (chunks.length <= 1) return chunks;

    // 按文档分组
    const byDoc = new Map<string, SearchResult[]>();
    for (const c of chunks) {
      const docId = c.document.id;
      if (!byDoc.has(docId)) byDoc.set(docId, []);
      byDoc.get(docId)!.push(c);
    }

    const merged: SearchResult[] = [];

    for (const [, docChunks] of byDoc) {
      if (docChunks.length === 1) {
        merged.push(docChunks[0]);
        continue;
      }

      // 按 chunkIndex 排序
      const sorted = [...docChunks].sort((a, b) => (a.chunk.chunkIndex || 0) - (b.chunk.chunkIndex || 0));

      // 合并相邻且相似度较高的 chunk
      const groups: SearchResult[][] = [];
      let currentGroup: SearchResult[] = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const prev = currentGroup[currentGroup.length - 1];
        const cur = sorted[i];
        const indexDiff = Math.abs((cur.chunk.chunkIndex || 0) - (prev.chunk.chunkIndex || 0));

        // 计算内容相似度
        const prevWords = new Set(prev.chunk.content.split(/[\s,，。？！?!、；;:：\-]+/).filter(w => w.length >= 2));
        const curWords = new Set(cur.chunk.content.split(/[\s,，。？！?!、；;:：\-]+/).filter(w => w.length >= 2));
        let shared = 0;
        for (const w of prevWords) if (curWords.has(w)) shared++;
        const union = prevWords.size + curWords.size - shared;
        const similarity = union > 0 ? shared / union : 0;

        if (indexDiff <= 2 || similarity > 0.5) {
          currentGroup.push(cur);
        } else {
          groups.push(currentGroup);
          currentGroup = [cur];
        }
      }
      groups.push(currentGroup);

      // 生成合并后的 chunk
      for (const group of groups) {
        if (group.length === 1) {
          merged.push(group[0]);
          continue;
        }

        const combinedContent = group.map(g => g.chunk.content).join('\n');
        const avgScore = group.reduce((s, g) => s + (g.rerankScore || g.score), 0) / group.length;
        const maxScore = Math.max(...group.map(g => g.rerankScore || g.score));

        const mergedChunk: DocumentChunk = {
          id: `merged_${group[0].chunk.documentId}_${group[0].chunk.chunkIndex}`,
          documentId: group[0].chunk.documentId,
          content: combinedContent,
          chunkIndex: group[0].chunk.chunkIndex || 0,
          metadata: { mergedFrom: group.map(g => g.chunk.id), mergedCount: group.length }
        };

        this.mergedFragmentsCache.set(mergedChunk.id, mergedChunk);

        merged.push({
          chunk: mergedChunk,
          document: group[0].document,
          score: maxScore,
          rerankScore: avgScore
        });
      }
    }

    return merged.sort((a, b) => (b.rerankScore || b.score) - (a.rerankScore || a.score));
  }

  // ============ 8. 查询扩展 ============

  /**
   * 基于查询历史和用户画像，智能扩展查询关键词
   */
  expandQuery(query: string, userId?: string): {
    originalQuery: string;
    expandedQueries: string[];
    addedTerms: string[];
    removedTerms: string[];
    suggestions: string[];
  } {
    const analysis = this.analyzeQuery(query);
    const profile = this.getOrCreateUserProfile(userId || this.defaultUserId);

    // 更新用户画像
    for (const kw of analysis.keywords) {
      const current = profile.topicInterests.get(kw) || 0;
      profile.topicInterests.set(kw, current + 1);
      profile.preferenceKeywords.add(kw);
    }
    profile.queryHistory.push(query);
    if (profile.queryHistory.length > 50) profile.queryHistory = profile.queryHistory.slice(-50);
    profile.queryCount++;

    // 扩展词来源 1：知识图谱扩展
    const graphExpansions = this.expandQueryByGraph(query, 5);

    // 扩展词来源 2：用户历史兴趣（高频主题词）
    const interestTerms = Array.from(profile.topicInterests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);

    // 扩展词来源 3：同义词/相关词
    const synonymMap: Record<string, string[]> = {
      '性能': ['效率', '速度', '吞吐量', '响应时间'],
      '优化': ['改进', '提升', '调优', '增强'],
      '部署': ['发布', '上线', '运维', '安装'],
      '架构': ['设计', '结构', '体系', '蓝图'],
      '安全': ['防护', '风险', '漏洞', '权限'],
      '数据': ['信息', '数据集', '存储', '分析'],
      '测试': ['验证', '检查', 'qa', '单元测试', '集成测试'],
      '开发': ['编写', '实现', '编码', '编程'],
      '问题': ['缺陷', 'bug', '故障', '异常'],
      '方案': ['解决', '方法', '策略', '思路']
    };
    const synonyms: string[] = [];
    for (const kw of analysis.keywords) {
      const syn = synonymMap[kw];
      if (syn) synonyms.push(...syn.slice(0, 2));
    }

    // 扩展词来源 4：最近查询中出现过的相关词
    const historyTerms: string[] = [];
    for (const hq of profile.queryHistory.slice(-5)) {
      const hqAnalysis = this.analyzeQuery(hq);
      for (const term of hqAnalysis.keywords.slice(0, 2)) {
        if (!analysis.keywords.includes(term)) historyTerms.push(term);
      }
    }

    // 整合所有扩展词，去重并过滤掉原始查询中已有的
    const allExpansions = [...graphExpansions, ...interestTerms, ...synonyms, ...historyTerms];
    const existingTerms = new Set(analysis.keywords.map(k => k.toLowerCase()));
    const addedTerms: string[] = [];
    for (const term of allExpansions) {
      const t = term.toLowerCase();
      if (!existingTerms.has(t) && !addedTerms.includes(term)) {
        addedTerms.push(term);
        if (addedTerms.length >= 8) break;
      }
    }

    // 生成扩展后的查询变体
    const expandedQueries: string[] = [];
    if (addedTerms.length > 0) {
      expandedQueries.push(`${query} ${addedTerms.slice(0, 3).join(' ')}`);
    }
    if (analysis.intent === 'definition') {
      expandedQueries.push(`${analysis.keywords.slice(0, 2).join(' ')} 的定义、特点与应用场景`);
    }
    if (analysis.intent === 'procedure') {
      expandedQueries.push(`如何实现 ${analysis.keywords.slice(0, 2).join(' ')}：步骤、方法、最佳实践`);
    }
    if (analysis.intent === 'comparison') {
      expandedQueries.push(`${analysis.keywords.slice(0, 3).join(' 与 ')} 的对比：优缺点、适用场景、性能差异`);
    }
    if (graphExpansions.length > 0) {
      expandedQueries.push(`${query} 相关概念：${graphExpansions.slice(0, 3).join('、')}`);
    }

    const suggestions: string[] = [];
    if (addedTerms.length > 0) {
      suggestions.push(`基于知识图谱和用户画像，建议补充查询词：${addedTerms.slice(0, 5).join('、')}`);
    }
    if (analysis.complexityLevel === 'complex') {
      suggestions.push('建议将复杂查询拆分为若干子问题以获得更精准的答案');
    }
    if (graphExpansions.length > 0) {
      suggestions.push(`知识图谱发现相关概念：${graphExpansions.slice(0, 3).join('、')}`);
    }

    return {
      originalQuery: query,
      expandedQueries,
      addedTerms: addedTerms.slice(0, 10),
      removedTerms: [],
      suggestions
    };
  }

  /**
   * 获取或创建用户画像
   */
  private getOrCreateUserProfile(userId: string): UserProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        id: userId,
        topicInterests: new Map(),
        queryHistory: [],
        preferenceKeywords: new Set(),
        queryCount: 0
      });
    }
    return this.userProfiles.get(userId)!;
  }

  getUserProfile(userId?: string): {
    id: string;
    queryCount: number;
    topInterests: Array<{ term: string; weight: number }>;
    recentQueries: string[];
    preferenceCount: number;
  } {
    const profile = this.getOrCreateUserProfile(userId || this.defaultUserId);
    const topInterests = Array.from(profile.topicInterests.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, weight]) => ({ term, weight }));

    return {
      id: profile.id,
      queryCount: profile.queryCount,
      topInterests,
      recentQueries: profile.queryHistory.slice(-10),
      preferenceCount: profile.preferenceKeywords.size
    };
  }

  // ============ 9. 语义搜索（混合算法） ============

  /**
   * 基于向量相似度和关键词匹配的混合搜索
   */
  async hybridSearch(query: string, options: {
    semanticWeight?: number;
    keywordWeight?: number;
    entityWeight?: number;
    qualityBoost?: boolean;
    rerank?: boolean;
    topK?: number;
  } = {}): Promise<{
    results: HybridSearchResult[];
    query: string;
    totalRetrieved: number;
    weights: { semantic: number; keyword: number; entity: number };
    analysis: QueryUnderstandingResult;
  }> {
    const opts = {
      semanticWeight: 0.4,
      keywordWeight: 0.35,
      entityWeight: 0.25,
      qualityBoost: true,
      rerank: true,
      topK: this.config.topK,
      ...options
    };

    const analysis = this.analyzeQuery(query);
    const normalizedQuery = analysis.keywords.join(' ') + ' ' + query;

    // 1. 获取各通道结果
    const semanticResults = await this.semanticRecall(normalizedQuery);
    const keywordResults = this.keywordRecall(normalizedQuery);
    const entityResults = this.entityRecall(normalizedQuery);

    // 2. 融合
    const fused = new Map<string, {
      chunk: DocumentChunk;
      document: Document;
      semanticScore: number;
      keywordScore: number;
      entityScore: number;
      highlights: string[];
    }>();

    const ensure = (chunk: DocumentChunk, document: Document) => {
      if (!fused.has(chunk.id)) {
        fused.set(chunk.id, {
          chunk, document,
          semanticScore: 0, keywordScore: 0, entityScore: 0,
          highlights: []
        });
      }
      return fused.get(chunk.id)!;
    };

    for (const r of semanticResults) {
      const entry = ensure(r.chunk, r.document);
      entry.semanticScore = Math.max(entry.semanticScore, r.strategyScore);
    }
    for (const r of keywordResults) {
      const entry = ensure(r.chunk, r.document);
      entry.keywordScore = Math.max(entry.keywordScore, r.strategyScore);
    }
    for (const r of entityResults) {
      const entry = ensure(r.chunk, r.document);
      entry.entityScore = Math.max(entry.entityScore, r.strategyScore);
    }

    // 3. 计算混合分数
    let results: HybridSearchResult[] = [];
    for (const entry of fused.values()) {
      const combined = (
        entry.semanticScore * opts.semanticWeight +
        entry.keywordScore * opts.keywordWeight +
        entry.entityScore * opts.entityWeight
      );

      const qualityScore = this.evaluateDocumentQuality(entry.chunk.content).qualityScore;
      const finalScore = opts.qualityBoost
        ? combined * 0.85 + qualityScore * 0.15
        : combined;

      // 提取高亮词
      const highlights: string[] = [];
      for (const term of analysis.keywords.slice(0, 6)) {
        if (entry.chunk.content.toLowerCase().includes(term.toLowerCase())) {
          highlights.push(term);
        }
      }

      results.push({
        chunk: entry.chunk,
        document: entry.document,
        score: finalScore,
        keywordScore: entry.keywordScore,
        semanticScore: entry.semanticScore,
        entityScore: entry.entityScore,
        timeScore: 0,
        qualityScore,
        combinedScore: Math.min(finalScore, 1.0),
        matchHighlights: highlights
      });
    }

    // 4. 重排序（根据查询意图）
    if (opts.rerank) {
      results = results.map((r, idx) => {
        let boost = 0;
        const content = r.chunk.content.toLowerCase();
        // 查询词位置加权：开头/结尾出现的词更重要
        for (const term of analysis.keywords.slice(0, 5)) {
          const lowerTerm = term.toLowerCase();
          const pos = content.indexOf(lowerTerm);
          if (pos !== -1 && pos < content.length * 0.2) boost += 0.03;
          if (content.endsWith(lowerTerm) || content.endsWith(lowerTerm + '。')) boost += 0.02;
        }
        // 文档标题直接匹配强加权
        const title = r.document.title.toLowerCase();
        for (const term of analysis.keywords.slice(0, 3)) {
          if (title.includes(term.toLowerCase())) boost += 0.05;
        }
        // 位置偏好（靠前的结果保持一定 momentum）
        if (idx < 3) boost += 0.01;
        const newScore = Math.min(r.combinedScore + boost, 1.0);
        return { ...r, combinedScore: newScore, score: newScore };
      });
    }

    results.sort((a, b) => b.combinedScore - a.combinedScore);

    return {
      results: results.slice(0, opts.topK),
      query,
      totalRetrieved: results.length,
      weights: {
        semantic: opts.semanticWeight,
        keyword: opts.keywordWeight,
        entity: opts.entityWeight
      },
      analysis
    };
  }

  // ============ 10. RAG 系统状态分析 ============

  /**
   * 分析 RAG 系统的整体运行状态、文档覆盖率、召回质量
   */
  analyzeSystemHealth(): RAGSystemStatus {
    const stats = this.vectorStore.getStats();
    const totalDocuments = stats.totalDocuments || 0;
    const totalChunks = stats.totalChunks || 0;
    const avgChunksPerDoc = totalDocuments > 0 ? totalChunks / totalDocuments : 0;

    // 确保知识图谱存在（若尚未构建，则构建）
    if (this.knowledgeGraph.entities.size === 0 && totalChunks > 0) {
      this.buildKnowledgeGraph();
    }

    // 1. 覆盖率评估
    const allChunks = this.vectorStore.getAllChunks();
    const allTerms = new Set<string>();
    const domainHits: Record<string, number> = {};
    const domains = ['技术', '业务', '数据', '安全', '运维', '管理', '产品', '服务'];

    for (const chunk of allChunks) {
      const actualContent = chunk.content || '';
      const terms = actualContent.split(/[\s,，。？！?!、；;:：\-]+/).filter(w => w.length >= 2);
      for (const t of terms.slice(0, 30)) allTerms.add(t);
      for (const d of domains) {
        if (actualContent.includes(d)) domainHits[d] = (domainHits[d] || 0) + 1;
      }
    }

    // 关键词覆盖率（相对于总词数的多样性）
    const keywordCoverage = Math.min(allTerms.size / Math.max(totalChunks * 5, 100), 1.0);

    // 实体覆盖率（图谱实体数 vs 文档总数）
    const entityCoverage = totalDocuments > 0
      ? Math.min(this.knowledgeGraph.entities.size / (totalDocuments * 3), 1.0)
      : 0;

    // 领域多样性（Shannon entropy 简化版）
    let domainDiversity = 0;
    const totalDomainHits = Object.values(domainHits).reduce((a, b) => a + b, 0);
    if (totalDomainHits > 0) {
      let entropy = 0;
      for (const count of Object.values(domainHits)) {
        if (count > 0) {
          const p = count / totalDomainHits;
          entropy -= p * Math.log(p);
        }
      }
      domainDiversity = Math.min(entropy / Math.log(domains.length), 1.0);
    }

    // 2. 召回质量评估（基于历史）
    const history = this.getContextHistory();
    const avgScore = history.length > 0
      ? history.reduce((s, h) => s + h.avgScore, 0) / history.length
      : 0;
    const hitRate = history.length > 0
      ? history.filter(h => h.resultCount > 0).length / history.length
      : 0;

    let recentPerformance: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    if (history.length >= 3) {
      const recent = history.slice(-10);
      const recentHitRate = recent.filter(h => h.resultCount > 0).length / recent.length;
      const recentAvgScore = recent.reduce((s, h) => s + h.avgScore, 0) / recent.length;
      if (recentHitRate > 0.9 && recentAvgScore > 0.7) recentPerformance = 'excellent';
      else if (recentHitRate > 0.7 && recentAvgScore > 0.5) recentPerformance = 'good';
      else if (recentHitRate > 0.4) recentPerformance = 'fair';
      else recentPerformance = 'poor';
    }

    // 3. 健康状态
    const hasIndex = totalChunks > 0;
    const hasHistory = history.length > 0;
    const hasKG = this.knowledgeGraph.entities.size > 0;
    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'degraded';
    if (!hasIndex) overallHealth = 'critical';
    else if (hasIndex && hasKG && hasHistory && avgScore > 0.5) overallHealth = 'healthy';
    else if (hasIndex && (hasKG || avgScore > 0.3)) overallHealth = 'degraded';
    else overallHealth = 'critical';

    // 4. 改进建议
    const recommendations: string[] = [];
    if (totalDocuments === 0) recommendations.push('知识库为空，请先添加文档');
    if (totalDocuments > 0 && totalDocuments < 5) recommendations.push('文档数量偏少，建议补充更多领域知识');
    if (totalChunks > 0 && avgChunksPerDoc < 2) recommendations.push('文档分块较少，建议检查分块策略');
    if (keywordCoverage < 0.3) recommendations.push('关键词多样性较低，建议补充不同主题的文档');
    if (entityCoverage < 0.2 && totalDocuments > 0) recommendations.push('知识图谱实体覆盖率低，建议重新构建图谱');
    if (domainDiversity < 0.5) recommendations.push('领域多样性偏低，建议补充更多跨领域文档');
    if (history.length > 0 && hitRate < 0.6) recommendations.push('查询命中率偏低，可考虑增强召回策略或扩展查询词');
    if (recentPerformance === 'poor') recommendations.push('近期检索表现不佳，建议评估文档质量与覆盖度');
    if (!hasKG && totalDocuments > 3) recommendations.push('建议构建知识图谱以进一步提升检索效果');

    // 5. 最近活动
    const recentActivity = {
      queryCount: history.length,
      lastQueryTime: history.length > 0 ? history[history.length - 1].timestamp : null,
      avgQueryComplexity: 0
    };
    if (history.length > 0) {
      let totalComplexity = 0;
      for (const entry of history.slice(-20)) {
        const entryAnalysis = this.analyzeQuery(entry.query);
        totalComplexity += entryAnalysis.complexity;
      }
      recentActivity.avgQueryComplexity = totalComplexity / Math.min(history.length, 20);
    }

    return {
      totalDocuments,
      totalChunks,
      avgChunksPerDoc: Math.round(avgChunksPerDoc * 100) / 100,
      coverage: {
        keywordCoverage: Math.round(keywordCoverage * 100) / 100,
        entityCoverage: Math.round(entityCoverage * 100) / 100,
        domainDiversity: Math.round(domainDiversity * 100) / 100
      },
      recallQuality: {
        avgScore: Math.round(avgScore * 100) / 100,
        hitRate: Math.round(hitRate * 100) / 100,
        recentPerformance
      },
      knowledgeGraph: {
        entityCount: this.knowledgeGraph.entities.size,
        relationCount: this.knowledgeGraph.relations.length,
        isBuilt: this.knowledgeGraph.entities.size > 0
      },
      health: {
        hasIndex,
        hasHistory,
        hasKG,
        overallHealth
      },
      recommendations,
      recentActivity: {
        queryCount: recentActivity.queryCount,
        lastQueryTime: recentActivity.lastQueryTime,
        avgQueryComplexity: Math.round(recentActivity.avgQueryComplexity * 100) / 100
      }
    };
  }

  // ============ 工具方法 ============

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return `h${hash}_${str.length}`;
  }
}
