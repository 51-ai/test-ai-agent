export interface Document {
  id: string;
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  score: number;
  rerankScore?: number;
}

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  minRelevanceScore: number;
  maxContextLength: number;
  enableMultiVectorRecall: boolean;
  enableReranking: boolean;
}

export const defaultRAGConfig: RAGConfig = {
  chunkSize: 512,
  chunkOverlap: 64,
  topK: 5,
  minRelevanceScore: 0.5,
  maxContextLength: 4096,
  enableMultiVectorRecall: true,
  enableReranking: true
};

export interface RecallStrategy {
  name: 'dense' | 'sparse' | 'hybrid' | 'multi';
  weights?: {
    dense?: number;
    sparse?: number;
  };
}

export interface RerankResult {
  result: SearchResult;
  originalIndex: number;
  rerankScore: number;
}

export interface VectorStoreStats {
  totalDocuments: number;
  totalChunks: number;
  avgChunksPerDoc: number;
  lastUpdated: Date;
}
