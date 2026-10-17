/**
 * 特征工程 - 特征提取/转换/选择/降维
 */

import { v4 as uuidv4 } from 'uuid';

export type FeatureType = 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean' | 'embedding' | 'image' | 'array';
export type TransformType = 'normalize' | 'standardize' | 'encode' | 'bin' | 'log' | 'polynomial' | 'interaction' | 'aggregate' | 'embed' | 'tfidf';
export type SelectionMethod = 'variance' | 'correlation' | 'chi2' | 'mutual_info' | 'rfe' | 'lasso' | 'tree_based';

export interface Feature {
  id: string;
  name: string;
  type: FeatureType;
  description?: string;
  nullable: boolean;
  uniqueCount: number;
  missingCount: number;
  statistics?: FeatureStatistics;
  transformer?: string;
  importance?: number;
  selected: boolean;
  tags?: string[];
}

export interface FeatureStatistics {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  variance?: number;
  skewness?: number;
  kurtosis?: number;
  quantiles?: Record<string, number>;
  topValues?: Array<{ value: unknown; count: number }>;
  distribution?: Record<string, number>;
}

export interface FeatureTransform {
  id: string;
  name: string;
  type: TransformType;
  inputFeatures: string[];
  outputFeature: string;
  params: Record<string, unknown>;
  fittedAt: Date;
  fittedParams: Record<string, number | string | number[]>;
  apply: (values: unknown[]) => unknown[];
}

export interface FeatureSet {
  id: string;
  name: string;
  description?: string;
  features: Feature[];
  transforms: FeatureTransform[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SelectionResult {
  selectedFeatures: string[];
  scores: Record<string, number>;
  method: SelectionMethod;
  k: number;
  timestamp: Date;
}

export class FeatureEngineering {
  private featureSets: Map<string, FeatureSet> = new Map();
  private transforms: Map<string, FeatureTransform> = new Map();
  private fittedScalers: Map<string, { mean: number; std: number; min: number; max: number }> = new Map();
  private encodings: Map<string, Map<string, number>> = new Map();
  private tfidfVocabulary: Map<string, number> = new Map();
  private idfScores: Map<string, number> = new Map();

  createFeatureSet(name: string, description?: string): string {
    const id = uuidv4();
    this.featureSets.set(id, {
      id,
      name,
      description,
      features: [],
      transforms: [],
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return id;
  }

  inferFeatureType(values: unknown[]): FeatureType {
    const sample = values.filter(v => v !== null && v !== undefined).slice(0, 100);
    if (sample.length === 0) return 'text';
    if (sample.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))))) {
      return 'numeric';
    }
    if (sample.every(v => typeof v === 'boolean')) return 'boolean';
    if (sample.every(v => v instanceof Date || !isNaN(Date.parse(String(v))))) return 'datetime';
    if (sample.every(v => Array.isArray(v) || (typeof v === 'object' && v !== null))) {
      return Array.isArray(sample[0]) ? 'array' : 'embedding';
    }
    const unique = new Set(sample);
    if (unique.size <= Math.max(20, sample.length * 0.1)) return 'categorical';
    return 'text';
  }

  computeStatistics(values: unknown[]): FeatureStatistics {
    const numeric = values
      .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(v => Number(v))
      .sort((a, b) => a - b);

    if (numeric.length === 0) {
      const counts = new Map<unknown, number>();
      for (const v of values) {
        if (v === null || v === undefined) continue;
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      return {
        topValues: Array.from(counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      };
    }

    const sum = numeric.reduce((a, b) => a + b, 0);
    const mean = sum / numeric.length;
    const variance = numeric.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / numeric.length;
    const std = Math.sqrt(variance);
    const min = numeric[0];
    const max = numeric[numeric.length - 1];
    const median = numeric[Math.floor(numeric.length / 2)];

    const skewness = std > 0
      ? numeric.reduce((acc, v) => acc + Math.pow((v - mean) / std, 3), 0) / numeric.length
      : 0;
    const kurtosis = std > 0
      ? numeric.reduce((acc, v) => acc + Math.pow((v - mean) / std, 4), 0) / numeric.length - 3
      : 0;

    return {
      min, max, mean, median, std, variance, skewness, kurtosis,
      quantiles: {
        '25%': numeric[Math.floor(numeric.length * 0.25)],
        '50%': median,
        '75%': numeric[Math.floor(numeric.length * 0.75)],
        '90%': numeric[Math.floor(numeric.length * 0.9)],
        '95%': numeric[Math.floor(numeric.length * 0.95)]
      }
    };
  }

  detectFeatures(data: Record<string, unknown[]>): Feature[] {
    const features: Feature[] = [];
    for (const [name, values] of Object.entries(data)) {
      const type = this.inferFeatureType(values);
      const missing = values.filter(v => v === null || v === undefined).length;
      const unique = new Set(values.filter(v => v !== null && v !== undefined)).size;
      const stats = type === 'numeric' ? this.computeStatistics(values) : this.computeStatistics(values);
      features.push({
        id: uuidv4(),
        name,
        type,
        nullable: missing > 0,
        uniqueCount: unique,
        missingCount: missing,
        statistics: stats,
        selected: true
      });
    }
    return features;
  }

  addFeature(featureSetId: string, feature: Omit<Feature, 'id'>): string | null {
    const fs = this.featureSets.get(featureSetId);
    if (!fs) return null;
    const id = uuidv4();
    fs.features.push({ ...feature, id });
    fs.updatedAt = new Date();
    return id;
  }

  normalize(values: number[]): { result: number[]; params: { min: number; max: number } } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const result = values.map(v => (v - min) / range);
    return { result, params: { min, max } };
  }

  standardize(values: number[]): { result: number[]; params: { mean: number; std: number } } {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    const result = values.map(v => (v - mean) / std);
    return { result, params: { mean, std } };
  }

  labelEncode(values: unknown[]): { result: number[]; encoding: Map<string, number> } {
    const encoding = new Map<string, number>();
    let counter = 0;
    for (const v of values) {
      const key = String(v);
      if (!encoding.has(key)) {
        encoding.set(key, counter++);
      }
    }
    const result = values.map(v => encoding.get(String(v)) || 0);
    return { result, encoding };
  }

  oneHotEncode(values: unknown[]): { result: number[][]; categories: string[] } {
    const categories = Array.from(new Set(values.map(v => String(v))));
    const categoryIndex = new Map(categories.map((c, i) => [c, i]));
    const result = values.map(v => {
      const vec = new Array(categories.length).fill(0);
      vec[categoryIndex.get(String(v)) || 0] = 1;
      return vec;
    });
    return { result, categories };
  }

  logTransform(values: number[]): number[] {
    return values.map(v => Math.log1p(Math.max(0, v)));
  }

  binning(values: number[], bins: number): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = (max - min) / bins;
    return values.map(v => Math.min(bins - 1, Math.floor((v - min) / width)));
  }

  polynomialFeatures(values: number[], degree: number): number[][] {
    return values.map(v => {
      const features: number[] = [];
      for (let d = 0; d <= degree; d++) features.push(Math.pow(v, d));
      return features;
    });
  }

  fitTfidf(documents: string[]): void {
    this.tfidfVocabulary.clear();
    this.idfScores.clear();
    const docFrequency = new Map<string, number>();
    documents.forEach(doc => {
      const terms = new Set(this.tokenize(doc));
      for (const term of terms) {
        docFrequency.set(term, (docFrequency.get(term) || 0) + 1);
      }
    });
    let idx = 0;
    for (const [term] of docFrequency) {
      this.tfidfVocabulary.set(term, idx++);
      this.idfScores.set(term, Math.log(documents.length / (docFrequency.get(term) || 1)));
    }
  }

  transformTfidf(document: string): number[] {
    const vector = new Array(this.tfidfVocabulary.size).fill(0);
    const terms = this.tokenize(document);
    const tf = new Map<string, number>();
    for (const t of terms) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [term, count] of tf) {
      const idx = this.tfidfVocabulary.get(term);
      if (idx !== undefined) {
        vector[idx] = count * (this.idfScores.get(term) || 0);
      }
    }
    return vector;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(t => t.length > 1);
  }

  selectFeatures(features: Feature[], method: SelectionMethod, k: number): SelectionResult {
    const scores: Record<string, number> = {};
    for (const f of features) {
      if (f.statistics) {
        switch (method) {
          case 'variance':
            scores[f.name] = f.statistics.variance || 0;
            break;
          case 'correlation':
            scores[f.name] = Math.abs(f.statistics.mean || 0);
            break;
          case 'tree_based':
            scores[f.name] = f.importance || 0;
            break;
          case 'mutual_info':
            scores[f.name] = f.uniqueCount > 1 ? 1 / f.uniqueCount : 0;
            break;
          default:
            scores[f.name] = f.statistics.variance || 0;
        }
      } else {
        scores[f.name] = f.importance || 0;
      }
    }
    const selected = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, k)
      .map(([name]) => name);
    return {
      selectedFeatures: selected,
      scores,
      method,
      k,
      timestamp: new Date()
    };
  }

  createTransform(
    name: string,
    type: TransformType,
    inputFeatures: string[],
    outputFeature: string,
    params: Record<string, unknown>,
    fittedParams: Record<string, number | string | number[]> = {}
  ): string {
    const id = uuidv4();
    const transform: FeatureTransform = {
      id,
      name,
      type,
      inputFeatures,
      outputFeature,
      params,
      fittedAt: new Date(),
      fittedParams,
      apply: (values: unknown[]) => this.applyTransform(type, values, params, fittedParams)
    };
    this.transforms.set(id, transform);
    return id;
  }

  private applyTransform(
    type: TransformType,
    values: unknown[],
    _params: Record<string, unknown>,
    fittedParams: Record<string, number | string | number[]>
  ): unknown[] {
    const numeric = values.map(v => Number(v));
    switch (type) {
      case 'normalize': {
        const min = Number(fittedParams.min || 0);
        const max = Number(fittedParams.max || 1);
        const range = (max - min) || 1;
        return numeric.map(v => (v - min) / range);
      }
      case 'standardize': {
        const mean = Number(fittedParams.mean || 0);
        const std = Number(fittedParams.std || 1);
        return numeric.map(v => (v - mean) / std);
      }
      case 'log':
        return numeric.map(v => Math.log1p(Math.max(0, v)));
      case 'bin': {
        const bins = Number(fittedParams.bins || 5);
        const min = Math.min(...numeric);
        const max = Math.max(...numeric);
        const width = (max - min) / bins || 1;
        return numeric.map(v => Math.min(bins - 1, Math.floor((v - min) / width)));
      }
      default:
        return values;
    }
  }

  getFeatureSet(id: string): FeatureSet | undefined {
    return this.featureSets.get(id);
  }

  listFeatureSets(): FeatureSet[] {
    return Array.from(this.featureSets.values());
  }

  listTransforms(): FeatureTransform[] {
    return Array.from(this.transforms.values());
  }

  deleteFeatureSet(id: string): boolean {
    return this.featureSets.delete(id);
  }
}

export const featureEngineering = new FeatureEngineering();
export default FeatureEngineering;
