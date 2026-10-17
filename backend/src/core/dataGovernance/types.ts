export interface RawData {
  id: string;
  source: string;
  dataType: 'text' | 'conversation' | 'document';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface CleanedData {
  id: string;
  originalId: string;
  content: string;
  quality: number;
  isDuplicate: boolean;
  duplicateOf?: string;
  cleanedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AnnotatedData {
  id: string;
  cleanedDataId: string;
  labels: Record<string, string>;
  intent?: string;
  entities?: Array<{ name: string; value: string }>;
  quality: number;
  annotator?: string;
  annotatedAt: Date;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface DataQualityCheck {
  id: string;
  dataId: string;
  checkType: string;
  passed: boolean;
  score?: number;
  details?: string;
  checkedAt: Date;
}

export interface DataVersion {
  id: string;
  dataId: string;
  version: string;
  content: string;
  changeLog: string;
  createdBy: string;
  createdAt: Date;
}

export interface QualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  uniqueness: number;
}

export interface TrainingDataset {
  id: string;
  name: string;
  description?: string;
  dataIds: string[];
  version: string;
  size: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
