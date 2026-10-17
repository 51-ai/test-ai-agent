import { RawData, CleanedData, AnnotatedData, TrainingDataset, DataVersion, QualityScore } from './types';
import { DataCleaner } from './DataCleaner';
import { AnnotationManager } from './AnnotationManager';

// ============ 数据血缘追踪类型 ============
export interface DataLineage {
  id: string;
  dataId: string;
  sourceIds: string[];
  transformationType: 'ingestion' | 'cleaning' | 'annotation' | 'export' | 'merge' | 'filter';
  transformationDetails: string;
  createdAt: Date;
  createdBy: string;
}

export interface LineageGraph {
  nodes: Array<{ id: string; type: string; label: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

// ============ 数据脱敏类型 ============
export interface SensitiveDataPattern {
  type: 'email' | 'phone' | 'id_card' | 'bank_card' | 'address' | 'name' | 'custom';
  pattern: RegExp;
  replacement: string;
  description: string;
}

export interface DataMaskingResult {
  originalDataId: string;
  maskedContent: string;
  maskedFields: Array<{ field: string; maskedValue: string }>;
  maskingRules: string[];
  maskedAt: Date;
}

// ============ 数据合规检查类型 ============
export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  checkType: 'pii_detection' | 'data_retention' | 'access_control' | 'consent_verification' | 'data_minimization';
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}

export interface ComplianceCheckResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: string;
  affectedDataIds: string[];
  checkedAt: Date;
}

export interface ComplianceReport {
  generatedAt: Date;
  overallCompliance: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  results: ComplianceCheckResult[];
  recommendations: string[];
}

// ============ 数据统计分析类型 ============
export interface DatasetStatistics {
  dataId: string;
  contentLength: { min: number; max: number; avg: number; median: number };
  characterDistribution: Record<string, number>;
  wordCount: { min: number; max: number; avg: number };
  uniqueWordRatio: number;
  languageDistribution: Record<string, number>;
  patternCounts: Record<string, number>;
  calculatedAt: Date;
}

// ============ 数据标签管理类型 ============
export interface DataTag {
  id: string;
  name: string;
  category: string;
  color: string;
  description: string;
  count: number;
}

export interface TagAssignment {
  dataId: string;
  tagIds: string[];
  assignedAt: Date;
  assignedBy: string;
}

// ============ 数据备份类型 ============
export interface DataBackup {
  id: string;
  name: string;
  description: string;
  dataSnapshot: {
    rawData: RawData[];
    cleanedData: CleanedData[];
    annotatedData: AnnotatedData[];
    datasets: TrainingDataset[];
  };
  createdAt: Date;
  sizeBytes: number;
  checksum: string;
}

// ============ 数据质量报告类型 ============
export interface DataQualityReport {
  id: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  overallScore: number;
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  };
  statistics: {
    totalRecords: number;
    highQualityRecords: number;
    lowQualityRecords: number;
    duplicateRecords: number;
    missingValueFields: Record<string, number>;
  };
  trends: Array<{ date: Date; score: number }>;
  recommendations: string[];
}

export class DataGovernanceSystem {
  private dataCleaner: DataCleaner;
  private annotationManager: AnnotationManager;
  private rawData: Map<string, RawData> = new Map();
  private cleanedData: Map<string, CleanedData> = new Map();
  private datasets: Map<string, TrainingDataset> = new Map();
  private dataVersions: Map<string, DataVersion[]> = new Map();
  private qualityHistory: Map<string, QualityScore[]> = new Map();

  // ============ 新增属性 ============
  // 数据血缘追踪
  private dataLineage: Map<string, DataLineage[]> = new Map();
  private lineageGraph: LineageGraph = { nodes: [], edges: [] };

  // 数据脱敏
  private sensitivePatterns: SensitiveDataPattern[] = [
    {
      type: 'email',
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: '***@***.***',
      description: '邮箱地址'
    },
    {
      type: 'phone',
      pattern: /1[3-9]\d{9}/g,
      replacement: '***********',
      description: '手机号码'
    },
    {
      type: 'id_card',
      pattern: /\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
      replacement: '*******************',
      description: '身份证号'
    },
    {
      type: 'bank_card',
      pattern: /\b([1-9]\d{14,18})\b/g,
      replacement: '**** **** **** ****',
      description: '银行卡号'
    }
  ];
  private maskedData: Map<string, DataMaskingResult> = new Map();

  // 数据合规检查
  private complianceRules: ComplianceRule[] = [
    {
      id: 'rule_pii_001',
      name: 'PII数据检测',
      description: '检测是否存在未脱敏的个人身份信息',
      checkType: 'pii_detection',
      severity: 'critical',
      enabled: true
    },
    {
      id: 'rule_retention_001',
      name: '数据保留期检查',
      description: '检查数据保留时间是否符合规定',
      checkType: 'data_retention',
      severity: 'medium',
      enabled: true
    },
    {
      id: 'rule_consent_001',
      name: '同意书验证',
      description: '验证数据处理是否有用户同意',
      checkType: 'consent_verification',
      severity: 'high',
      enabled: true
    },
    {
      id: 'rule_minimization_001',
      name: '数据最小化检查',
      description: '检查是否收集了超出必要范围的数据',
      checkType: 'data_minimization',
      severity: 'medium',
      enabled: true
    }
  ];
  private complianceHistory: ComplianceCheckResult[] = [];

  // 数据标签管理
  private dataTags: Map<string, DataTag> = new Map();
  private tagAssignments: Map<string, TagAssignment> = new Map();

  // 数据备份恢复
  private backups: Map<string, DataBackup> = new Map();
  private backupSchedule: { intervalMs: number; lastBackupAt: Date | null } = {
    intervalMs: 24 * 60 * 60 * 1000,
    lastBackupAt: null
  };

  constructor() {
    this.dataCleaner = new DataCleaner();
    this.annotationManager = new AnnotationManager();
    this.initializeDefaultTags();
  }

  ingestRawData(data: RawData): void {
    this.rawData.set(data.id, data);
    this.createVersion(data.id, data.content, 'Initial ingestion', 'system');
  }

  ingestRawDataBatch(datas: RawData[]): void {
    for (const data of datas) {
      this.ingestRawData(data);
    }
  }

  processAndCleanData(): void {
    for (const rawData of this.rawData.values()) {
      if (!this.cleanedData.has(`cleaned_${rawData.id}`)) {
        const cleaned = this.dataCleaner.clean(rawData);
        this.cleanedData.set(cleaned.id, cleaned);
        this.trackQualityScore(cleaned.id, this.dataCleaner.calculateDetailedQualityScore(cleaned.content));
      }
    }
  }

  advancedProcess(): { total: number; duplicates: number; highQuality: number } {
    const rawDataList = Array.from(this.rawData.values());
    const result = this.dataCleaner.batchClean(rawDataList);

    for (const cleaned of result.cleanedData) {
      this.cleanedData.set(cleaned.id, cleaned);
      this.trackQualityScore(cleaned.id, this.dataCleaner.calculateDetailedQualityScore(cleaned.content));
    }

    return result.stats;
  }

  getCleanedData(): CleanedData[] {
    return Array.from(this.cleanedData.values());
  }

  getHighQualityData(minQuality: number = 70): CleanedData[] {
    return this.getCleanedData().filter(d => d.quality >= minQuality);
  }

  createAnnotation(
    cleanedDataId: string,
    labels: Record<string, string>,
    options: any = {}
  ): AnnotatedData | null {
    const cleanedData = this.cleanedData.get(cleanedDataId);
    if (!cleanedData) return null;

    return this.annotationManager.createAnnotation(cleanedData, labels, options);
  }

  getAnnotations(): AnnotatedData[] {
    return this.annotationManager.getAnnotations();
  }

  createDataset(
    name: string,
    dataIds: string[],
    options: {
      description?: string;
      version?: string;
      createdBy: string;
    }
  ): TrainingDataset {
    const dataset: TrainingDataset = {
      id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: options.description,
      dataIds,
      version: options.version || '1.0.0',
      size: dataIds.length,
      createdBy: options.createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.datasets.set(dataset.id, dataset);
    return dataset;
  }

  updateDataset(
    datasetId: string,
    dataIds: string[],
    changeLog: string,
    updatedBy: string
  ): TrainingDataset | null {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) return null;

    const newVersion = this.incrementVersion(dataset.version);
    dataset.dataIds = dataIds;
    dataset.size = dataIds.length;
    dataset.version = newVersion;
    dataset.updatedAt = new Date();

    return dataset;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++;
    if (parts[2] >= 10) {
      parts[2] = 0;
      parts[1]++;
      if (parts[1] >= 10) {
        parts[1] = 0;
        parts[0]++;
      }
    }
    return parts.join('.');
  }

  createVersion(dataId: string, content: string, changeLog: string, createdBy: string): DataVersion {
    const versions = this.dataVersions.get(dataId) || [];
    const newVersion: DataVersion = {
      id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataId,
      version: `v${versions.length + 1}`,
      content,
      changeLog,
      createdBy,
      createdAt: new Date()
    };

    versions.push(newVersion);
    this.dataVersions.set(dataId, versions);
    return newVersion;
  }

  getVersions(dataId: string): DataVersion[] {
    return this.dataVersions.get(dataId) || [];
  }

  revertToVersion(dataId: string, versionId: string): boolean {
    const versions = this.dataVersions.get(dataId);
    if (!versions) return false;

    const targetVersion = versions.find(v => v.id === versionId);
    if (!targetVersion) return false;

    const cleaned = this.cleanedData.get(dataId);
    if (cleaned) {
      this.createVersion(dataId, cleaned.content, `Reverted to ${targetVersion.version}`, 'system');
      cleaned.content = targetVersion.content;
    }

    return true;
  }

  private trackQualityScore(dataId: string, score: QualityScore): void {
    const history = this.qualityHistory.get(dataId) || [];
    history.push(score);
    this.qualityHistory.set(dataId, history);
  }

  getQualityHistory(dataId: string): QualityScore[] {
    return this.qualityHistory.get(dataId) || [];
  }

  getQualityTrend(dataId: string): { trend: 'improving' | 'declining' | 'stable'; recentScores: number[] } {
    const history = this.getQualityHistory(dataId);
    const recentScores = history.slice(-10).map(h => h.overall);

    if (recentScores.length < 2) {
      return { trend: 'stable', recentScores };
    }

    const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
    const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondAvg - firstAvg > 5) trend = 'improving';
    else if (firstAvg - secondAvg > 5) trend = 'declining';

    return { trend, recentScores };
  }

  getDataset(id: string): TrainingDataset | undefined {
    return this.datasets.get(id);
  }

  getDatasets(): TrainingDataset[] {
    return Array.from(this.datasets.values());
  }

  getStats() {
    const highQuality = this.getHighQualityData();
    const qualityScores = this.getCleanedData().map(d => this.dataCleaner.calculateDetailedQualityScore(d.content));
    const avgQuality = qualityScores.length > 0
      ? Math.round(qualityScores.reduce((sum, s) => sum + s.overall, 0) / qualityScores.length)
      : 0;

    return {
      rawDataCount: this.rawData.size,
      cleanedDataCount: this.cleanedData.size,
      highQualityCount: highQuality.length,
      avgQualityScore: avgQuality,
      annotationCount: this.getAnnotations().length,
      verifiedAnnotationCount: this.annotationManager.getVerifiedAnnotations().length,
      datasetCount: this.datasets.size,
      versionedDataCount: this.dataVersions.size
    };
  }

  exportTrainingData(datasetId: string): any[] {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) return [];

    const trainingData: any[] = [];
    
    for (const dataId of dataset.dataIds) {
      const annotation = this.getAnnotations().find(a => a.cleanedDataId === dataId);
      const cleanedData = this.cleanedData.get(dataId);

      if (annotation && cleanedData) {
        trainingData.push({
          input: cleanedData.content,
          output: annotation.labels['output'] || '',
          intent: annotation.intent,
          entities: annotation.entities
        });
      }
    }

    return trainingData;
  }

  importTrainingData(dataList: Array<{ input: string; output: string }>, source: string): number {
    let imported = 0;
    for (const item of dataList) {
      const rawData: RawData = {
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source,
        dataType: 'text',
        content: item.input,
        timestamp: new Date()
      };

      this.ingestRawData(rawData);
      imported++;
    }

    this.processAndCleanData();
    return imported;
  }

  // ============ 数据血缘追踪方法 ============

  /**
   * 记录数据血缘关系
   */
  recordLineage(
    dataId: string,
    sourceIds: string[],
    transformationType: DataLineage['transformationType'],
    transformationDetails: string,
    createdBy: string
  ): DataLineage {
    const lineage: DataLineage = {
      id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataId,
      sourceIds,
      transformationType,
      transformationDetails,
      createdAt: new Date(),
      createdBy
    };

    const lineages = this.dataLineage.get(dataId) || [];
    lineages.push(lineage);
    this.dataLineage.set(dataId, lineages);

    // 更新血缘图
    this.updateLineageGraph(dataId, sourceIds, transformationType, transformationDetails);

    return lineage;
  }

  /**
   * 更新血缘图
   */
  private updateLineageGraph(
    dataId: string,
    sourceIds: string[],
    transformationType: DataLineage['transformationType'],
    transformationDetails: string
  ): void {
    // 添加目标节点
    const targetNodeExists = this.lineageGraph.nodes.some(n => n.id === dataId);
    if (!targetNodeExists) {
      this.lineageGraph.nodes.push({
        id: dataId,
        type: 'data',
        label: `数据 ${dataId.substring(0, 8)}`
      });
    }

    // 添加源节点和边
    for (const sourceId of sourceIds) {
      const sourceNodeExists = this.lineageGraph.nodes.some(n => n.id === sourceId);
      if (!sourceNodeExists) {
        this.lineageGraph.nodes.push({
          id: sourceId,
          type: 'data',
          label: `数据 ${sourceId.substring(0, 8)}`
        });
      }

      const edgeExists = this.lineageGraph.edges.some(
        e => e.from === sourceId && e.to === dataId
      );
      if (!edgeExists) {
        this.lineageGraph.edges.push({
          from: sourceId,
          to: dataId,
          label: `${transformationType}: ${transformationDetails}`
        });
      }
    }
  }

  /**
   * 获取数据血缘链
   */
  getLineage(dataId: string): DataLineage[] {
    return this.dataLineage.get(dataId) || [];
  }

  /**
   * 获取完整血缘图
   */
  getLineageGraph(): LineageGraph {
    return this.lineageGraph;
  }

  /**
   * 追踪数据祖先
   */
  getLineageAncestors(dataId: string, maxDepth: number = 10): DataLineage[] {
    const ancestors: DataLineage[] = [];
    const visited = new Set<string>();
    let currentIds = [dataId];
    let depth = 0;

    while (currentIds.length > 0 && depth < maxDepth) {
      const nextIds: string[] = [];
      for (const id of currentIds) {
        const lineages = this.dataLineage.get(id) || [];
        for (const lineage of lineages) {
          if (!visited.has(lineage.id)) {
            visited.add(lineage.id);
            ancestors.push(lineage);
            nextIds.push(...lineage.sourceIds);
          }
        }
      }
      currentIds = [...new Set(nextIds)];
      depth++;
    }

    return ancestors;
  }

  /**
   * 追踪数据后代
   */
  getLineageDescendants(dataId: string, maxDepth: number = 10): DataLineage[] {
    const descendants: DataLineage[] = [];
    const visited = new Set<string>();
    let currentIds = [dataId];
    let depth = 0;

    while (currentIds.length > 0 && depth < maxDepth) {
      const nextIds: string[] = [];
      for (const [targetId, lineages] of this.dataLineage.entries()) {
        for (const lineage of lineages) {
          if (currentIds.includes(lineage.dataId) && !visited.has(lineage.id)) {
            visited.add(lineage.id);
            descendants.push(lineage);
            nextIds.push(targetId);
          }
        }
      }
      currentIds = [...new Set(nextIds)];
      depth++;
    }

    return descendants;
  }

  // ============ 数据脱敏处理方法 ============

  /**
   * 初始化默认标签
   */
  private initializeDefaultTags(): void {
    const defaultTags: DataTag[] = [
      { id: 'tag_quality_high', name: '高质量', category: 'quality', color: '#52c41a', description: '高质量数据', count: 0 },
      { id: 'tag_quality_low', name: '低质量', category: 'quality', color: '#ff4d4f', description: '低质量数据', count: 0 },
      { id: 'tag_sensitive', name: '敏感数据', category: 'security', color: '#faad14', description: '包含敏感信息', count: 0 },
      { id: 'tag_pii', name: 'PII数据', category: 'security', color: '#f5222d', description: '包含个人身份信息', count: 0 },
      { id: 'tag_verified', name: '已验证', category: 'status', color: '#1890ff', description: '已通过验证', count: 0 },
      { id: 'tag_pending', name: '待处理', category: 'status', color: '#8c8c8c', description: '待处理数据', count: 0 },
      { id: 'tag_training', name: '训练数据', category: 'usage', color: '#722ed1', description: '用于模型训练', count: 0 },
      { id: 'tag_test', name: '测试数据', category: 'usage', color: '#13c2c2', description: '用于测试验证', count: 0 }
    ];

    for (const tag of defaultTags) {
      this.dataTags.set(tag.id, tag);
    }
  }

  /**
   * 检测敏感数据
   */
  detectSensitiveData(dataId: string): { type: string; matched: string; position: number }[] {
    const cleanedData = this.cleanedData.get(dataId) || this.rawData.get(dataId);
    if (!cleanedData) return [];

    const detections: { type: string; matched: string; position: number }[] = [];
    const content = cleanedData.content;

    for (const pattern of this.sensitivePatterns) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        detections.push({
          type: pattern.type,
          matched: match[0],
          position: match.index
        });
      }
    }

    return detections;
  }

  /**
   * 脱敏数据内容
   */
  maskSensitiveData(dataId: string, customPatterns?: SensitiveDataPattern[]): DataMaskingResult | null {
    const cleanedData = this.cleanedData.get(dataId) || this.rawData.get(dataId);
    if (!cleanedData) return null;

    const patternsToUse = customPatterns || this.sensitivePatterns;
    let maskedContent = cleanedData.content;
    const maskedFields: Array<{ field: string; maskedValue: string }> = [];
    const maskingRules: string[] = [];

    for (const pattern of patternsToUse) {
      const matches = maskedContent.match(pattern.pattern);
      if (matches && matches.length > 0) {
        maskingRules.push(`${pattern.type}: ${pattern.description}`);
        maskedFields.push({
          field: pattern.type,
          maskedValue: pattern.replacement
        });
        maskedContent = maskedContent.replace(pattern.pattern, pattern.replacement);
      }
    }

    const result: DataMaskingResult = {
      originalDataId: dataId,
      maskedContent,
      maskedFields,
      maskingRules,
      maskedAt: new Date()
    };

    this.maskedData.set(dataId, result);
    return result;
  }

  /**
   * 批量脱敏数据
   */
  maskSensitiveDataBatch(dataIds: string[]): DataMaskingResult[] {
    const results: DataMaskingResult[] = [];
    for (const dataId of dataIds) {
      const result = this.maskSensitiveData(dataId);
      if (result) results.push(result);
    }
    return results;
  }

  /**
   * 添加自定义脱敏规则
   */
  addSensitivePattern(pattern: Omit<SensitiveDataPattern, 'pattern'> & { pattern: string }): void {
    this.sensitivePatterns.push({
      type: pattern.type,
      pattern: new RegExp(pattern.pattern, 'g'),
      replacement: pattern.replacement,
      description: pattern.description
    });
  }

  /**
   * 获取脱敏结果
   */
  getMaskedData(dataId: string): DataMaskingResult | undefined {
    return this.maskedData.get(dataId);
  }

  /**
   * 移除脱敏规则
   */
  removeSensitivePattern(type: SensitiveDataPattern['type']): boolean {
    const index = this.sensitivePatterns.findIndex(p => p.type === type);
    if (index !== -1) {
      this.sensitivePatterns.splice(index, 1);
      return true;
    }
    return false;
  }

  // ============ 数据合规检查方法 ============

  /**
   * 检查所有合规规则
   */
  checkCompliance(dataIds?: string[]): ComplianceCheckResult[] {
    const results: ComplianceCheckResult[] = [];
    const targetIds = dataIds || Array.from(this.cleanedData.keys());

    for (const rule of this.complianceRules) {
      if (!rule.enabled) continue;

      const result = this.executeComplianceCheck(rule, targetIds);
      results.push(result);
      this.complianceHistory.push(result);
    }

    return results;
  }

  /**
   * 执行单项合规检查
   */
  private executeComplianceCheck(rule: ComplianceRule, dataIds: string[]): ComplianceCheckResult {
    const affectedDataIds: string[] = [];
    let details = '';
    let passed = true;

    switch (rule.checkType) {
      case 'pii_detection':
        for (const dataId of dataIds) {
          const detections = this.detectSensitiveData(dataId);
          if (detections.length > 0) {
            const masked = this.maskedData.get(dataId);
            if (!masked || masked.maskedContent === this.cleanedData.get(dataId)?.content) {
              affectedDataIds.push(dataId);
              passed = false;
            }
          }
        }
        details = affectedDataIds.length > 0
          ? `发现 ${affectedDataIds.length} 条数据包含未脱敏的敏感信息`
          : '所有数据均已正确脱敏';
        break;

      case 'data_retention':
        const now = new Date();
        for (const dataId of dataIds) {
          const cleanedData = this.cleanedData.get(dataId);
          if (cleanedData) {
            const retentionDays = (now.getTime() - cleanedData.cleanedAt.getTime()) / (1000 * 60 * 60 * 24);
            if (retentionDays > 365) {
              affectedDataIds.push(dataId);
              passed = false;
            }
          }
        }
        details = affectedDataIds.length > 0
          ? `发现 ${affectedDataIds.length} 条数据超过保留期限`
          : '所有数据均在保留期限内';
        break;

      case 'consent_verification':
        for (const dataId of dataIds) {
          const annotations = this.getAnnotations();
          const hasAnnotation = annotations.some(a => a.cleanedDataId === dataId);
          if (!hasAnnotation) {
            affectedDataIds.push(dataId);
            passed = false;
          }
        }
        details = affectedDataIds.length > 0
          ? `发现 ${affectedDataIds.length} 条数据缺少标注验证`
          : '所有数据均已验证';
        break;

      case 'data_minimization':
        for (const dataId of dataIds) {
          const cleanedData = this.cleanedData.get(dataId);
          if (cleanedData && cleanedData.content.length > 100000) {
            affectedDataIds.push(dataId);
            passed = false;
          }
        }
        details = affectedDataIds.length > 0
          ? `发现 ${affectedDataIds.length} 条数据可能超出必要范围`
          : '数据收集范围合理';
        break;

      default:
        details = '未知检查类型';
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      severity: rule.severity,
      details,
      affectedDataIds,
      checkedAt: new Date()
    };
  }

  /**
   * 生成合规报告
   */
  generateComplianceReport(): ComplianceReport {
    const results = this.checkCompliance();
    const passedChecks = results.filter(r => r.passed).length;
    const totalChecks = results.length;

    const recommendations: string[] = [];
    const failedResults = results.filter(r => !r.passed);

    for (const failed of failedResults) {
      if (failed.severity === 'critical') {
        recommendations.push(`【严重】${failed.ruleName}: ${failed.details}，建议立即处理`);
      } else if (failed.severity === 'high') {
        recommendations.push(`【高危】${failed.ruleName}: ${failed.details}，建议尽快处理`);
      } else {
        recommendations.push(`【提醒】${failed.ruleName}: ${failed.details}`);
      }
    }

    return {
      generatedAt: new Date(),
      overallCompliance: totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100,
      totalChecks,
      passedChecks,
      failedChecks: totalChecks - passedChecks,
      results,
      recommendations
    };
  }

  /**
   * 添加自定义合规规则
   */
  addComplianceRule(rule: Omit<ComplianceRule, 'id'>): void {
    const newRule: ComplianceRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    this.complianceRules.push(newRule);
  }

  /**
   * 启用/禁用合规规则
   */
  setComplianceRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.complianceRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 获取所有合规规则
   */
  getComplianceRules(): ComplianceRule[] {
    return [...this.complianceRules];
  }

  // ============ 数据集统计分析方法 ============

  /**
   * 计算数据集统计信息
   */
  calculateDatasetStatistics(dataIds?: string[]): DatasetStatistics[] {
    const targetData = dataIds
      ? dataIds.map(id => this.cleanedData.get(id)).filter(Boolean) as CleanedData[]
      : Array.from(this.cleanedData.values());

    const stats: DatasetStatistics[] = [];

    for (const data of targetData) {
      const content = data.content;
      const contentLength = content.length;
      const words = content.split(/\s+/).filter(w => w.length > 0);
      const wordCount = words.length;
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      const uniqueWordRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;

      // 字符分布
      const charDistribution: Record<string, number> = {};
      for (const char of content) {
        charDistribution[char] = (charDistribution[char] || 0) + 1;
      }

      // 简单语言分布估算
      const languageDistribution: Record<string, number> = {};
      const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
      const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
      if (chineseChars > englishWords) {
        languageDistribution['zh'] = chineseChars;
      } else {
        languageDistribution['en'] = englishWords;
      }

      // 模式统计
      const patternCounts: Record<string, number> = {
        url: (content.match(/https?:\/\/[^\s]+/g) || []).length,
        email: (content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).length,
        number: (content.match(/\d+/g) || []).length,
        specialChar: (content.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length
      };

      stats.push({
        dataId: data.id,
        contentLength: { min: contentLength, max: contentLength, avg: contentLength, median: contentLength },
        characterDistribution: charDistribution,
        wordCount: { min: wordCount, max: wordCount, avg: wordCount },
        uniqueWordRatio,
        languageDistribution,
        patternCounts,
        calculatedAt: new Date()
      });
    }

    return stats;
  }

  /**
   * 获取聚合统计信息
   */
  getAggregatedStatistics(): {
    totalRecords: number;
    avgContentLength: number;
    avgWordCount: number;
    avgUniqueWordRatio: number;
    totalUrls: number;
    totalEmails: number;
    totalNumbers: number;
    languageBreakdown: Record<string, number>;
  } {
    const stats = this.calculateDatasetStatistics();

    if (stats.length === 0) {
      return {
        totalRecords: 0,
        avgContentLength: 0,
        avgWordCount: 0,
        avgUniqueWordRatio: 0,
        totalUrls: 0,
        totalEmails: 0,
        totalNumbers: 0,
        languageBreakdown: {}
      };
    }

    const totalContentLength = stats.reduce((sum, s) => sum + s.contentLength.avg, 0);
    const totalWordCount = stats.reduce((sum, s) => sum + s.wordCount.avg, 0);
    const totalUniqueWordRatio = stats.reduce((sum, s) => sum + s.uniqueWordRatio, 0);
    const totalUrls = stats.reduce((sum, s) => sum + s.patternCounts.url, 0);
    const totalEmails = stats.reduce((sum, s) => sum + s.patternCounts.email, 0);
    const totalNumbers = stats.reduce((sum, s) => sum + s.patternCounts.number, 0);

    const languageBreakdown: Record<string, number> = {};
    for (const stat of stats) {
      for (const [lang, count] of Object.entries(stat.languageDistribution)) {
        languageBreakdown[lang] = (languageBreakdown[lang] || 0) + count;
      }
    }

    return {
      totalRecords: stats.length,
      avgContentLength: Math.round(totalContentLength / stats.length),
      avgWordCount: Math.round(totalWordCount / stats.length),
      avgUniqueWordRatio: Math.round((totalUniqueWordRatio / stats.length) * 100) / 100,
      totalUrls,
      totalEmails,
      totalNumbers,
      languageBreakdown
    };
  }

  // ============ 数据标签管理方法 ============

  /**
   * 创建标签
   */
  createTag(name: string, category: string, color: string, description: string): DataTag {
    const tag: DataTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      color,
      description,
      count: 0
    };
    this.dataTags.set(tag.id, tag);
    return tag;
  }

  /**
   * 分配标签
   */
  assignTags(dataId: string, tagIds: string[], assignedBy: string): TagAssignment {
    // 更新标签计数
    for (const tagId of tagIds) {
      const tag = this.dataTags.get(tagId);
      if (tag) {
        tag.count++;
      }
    }

    const assignment: TagAssignment = {
      dataId,
      tagIds,
      assignedAt: new Date(),
      assignedBy
    };
    this.tagAssignments.set(dataId, assignment);

    // 记录血缘
    this.recordLineage(dataId, [], 'annotation', `标签分配: ${tagIds.join(', ')}`, assignedBy);

    return assignment;
  }

  /**
   * 移除标签
   */
  removeTags(dataId: string, tagIds: string[]): boolean {
    const assignment = this.tagAssignments.get(dataId);
    if (!assignment) return false;

    for (const tagId of tagIds) {
      const tag = this.dataTags.get(tagId);
      if (tag && tag.count > 0) {
        tag.count--;
      }
      assignment.tagIds = assignment.tagIds.filter(id => id !== tagId);
    }

    return true;
  }

  /**
   * 获取数据的标签
   */
  getDataTags(dataId: string): DataTag[] {
    const assignment = this.tagAssignments.get(dataId);
    if (!assignment) return [];
    return assignment.tagIds.map(id => this.dataTags.get(id)).filter(Boolean) as DataTag[];
  }

  /**
   * 查询具有特定标签的数据
   */
  queryByTags(tagIds: string[], matchAll: boolean = false): string[] {
    const result: string[] = [];

    for (const [dataId, assignment] of this.tagAssignments.entries()) {
      if (matchAll) {
        if (tagIds.every(tagId => assignment.tagIds.includes(tagId))) {
          result.push(dataId);
        }
      } else {
        if (tagIds.some(tagId => assignment.tagIds.includes(tagId))) {
          result.push(dataId);
        }
      }
    }

    return result;
  }

  /**
   * 获取所有标签
   */
  getAllTags(): DataTag[] {
    return Array.from(this.dataTags.values());
  }

  /**
   * 获取标签分类
   */
  getTagsByCategory(category: string): DataTag[] {
    return Array.from(this.dataTags.values()).filter(tag => tag.category === category);
  }

  /**
   * 删除标签
   */
  deleteTag(tagId: string): boolean {
    const tag = this.dataTags.get(tagId);
    if (!tag) return false;

    // 从所有分配中移除
    for (const assignment of this.tagAssignments.values()) {
      assignment.tagIds = assignment.tagIds.filter(id => id !== tagId);
    }

    this.dataTags.delete(tagId);
    return true;
  }

  // ============ 数据导出增强方法 ============

  /**
   * 导出数据（支持多种格式）
   */
  exportData(format: 'json' | 'csv' | 'tsv' | 'xml' | 'yaml', dataIds?: string[]): string {
    const targetData = dataIds
      ? dataIds.map(id => ({
          cleaned: this.cleanedData.get(id),
          annotated: this.getAnnotations().find(a => a.cleanedDataId === id)
        }))
      : this.getCleanedData().map(cleaned => ({
          cleaned,
          annotated: this.getAnnotations().find(a => a.cleanedDataId === cleaned.id)
        }));

    switch (format) {
      case 'json':
        return this.exportAsJson(targetData);
      case 'csv':
        return this.exportAsCsv(targetData);
      case 'tsv':
        return this.exportAsTsv(targetData);
      case 'xml':
        return this.exportAsXml(targetData);
      case 'yaml':
        return this.exportAsYaml(targetData);
      default:
        return this.exportAsJson(targetData);
    }
  }

  private exportAsJson(data: Array<{ cleaned?: CleanedData; annotated?: AnnotatedData }>): string {
    const exportData = data.map(d => ({
      id: d.cleaned?.id,
      content: d.cleaned?.content,
      quality: d.cleaned?.quality,
      labels: d.annotated?.labels,
      intent: d.annotated?.intent,
      entities: d.annotated?.entities
    }));
    return JSON.stringify(exportData, null, 2);
  }

  private exportAsCsv(data: Array<{ cleaned?: CleanedData; annotated?: AnnotatedData }>): string {
    const headers = ['id', 'content', 'quality', 'labels', 'intent', 'entities'];
    const rows = data.map(d => [
      d.cleaned?.id || '',
      `"${(d.cleaned?.content || '').replace(/"/g, '""')}"`,
      d.cleaned?.quality?.toString() || '',
      d.annotated?.labels ? JSON.stringify(d.annotated.labels) : '',
      d.annotated?.intent || '',
      d.annotated?.entities ? JSON.stringify(d.annotated.entities) : ''
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  private exportAsTsv(data: Array<{ cleaned?: CleanedData; annotated?: AnnotatedData }>): string {
    const headers = ['id', 'content', 'quality', 'labels', 'intent', 'entities'];
    const rows = data.map(d => [
      d.cleaned?.id || '',
      (d.cleaned?.content || '').replace(/\t/g, ' ').replace(/\n/g, ' '),
      d.cleaned?.quality?.toString() || '',
      d.annotated?.labels ? JSON.stringify(d.annotated.labels) : '',
      d.annotated?.intent || '',
      d.annotated?.entities ? JSON.stringify(d.annotated.entities) : ''
    ]);
    return [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
  }

  private exportAsXml(data: Array<{ cleaned?: CleanedData; annotated?: AnnotatedData }>): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<dataset>\n';
    for (const d of data) {
      xml += '  <record>\n';
      xml += `    <id>${this.escapeXml(d.cleaned?.id || '')}</id>\n`;
      xml += `    <content><![CDATA[${d.cleaned?.content || ''}]]></content>\n`;
      xml += `    <quality>${d.cleaned?.quality || 0}</quality>\n`;
      if (d.annotated?.labels) {
        xml += '    <labels>\n';
        for (const [key, value] of Object.entries(d.annotated.labels)) {
          xml += `      <${key}><![CDATA[${value}]]></${key}>\n`;
        }
        xml += '    </labels>\n';
      }
      xml += '  </record>\n';
    }
    xml += '</dataset>';
    return xml;
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  private exportAsYaml(data: Array<{ cleaned?: CleanedData; annotated?: AnnotatedData }>): string {
    let yaml = 'records:\n';
    for (const d of data) {
      yaml += '  - id: ' + (d.cleaned?.id || '') + '\n';
      yaml += '    content: "' + (d.cleaned?.content || '').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"\n';
      yaml += '    quality: ' + (d.cleaned?.quality || 0) + '\n';
      if (d.annotated?.labels) {
        yaml += '    labels:\n';
        for (const [key, value] of Object.entries(d.annotated.labels)) {
          yaml += `      ${key}: "${value}"\n`;
        }
      }
    }
    return yaml;
  }

  /**
   * 导出数据集
   */
  exportDataset(datasetId: string, format: 'json' | 'csv' | 'tsv' | 'xml' | 'yaml'): string {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) return '';
    return this.exportData(format, dataset.dataIds);
  }

  /**
   * 导出带血缘信息的数据
   */
  exportDataWithLineage(dataIds?: string[]): string {
    const targetIds = dataIds || Array.from(this.cleanedData.keys());
    const exportData = targetIds.map(id => ({
      data: this.cleanedData.get(id),
      lineage: this.getLineage(id),
      ancestors: this.getLineageAncestors(id),
      annotations: this.getAnnotations().filter(a => a.cleanedDataId === id)
    }));
    return JSON.stringify(exportData, null, 2);
  }

  // ============ 数据备份恢复方法 ============

  /**
   * 创建数据备份
   */
  createBackup(name: string, description: string): DataBackup {
    const rawDataArray = Array.from(this.rawData.values());
    const cleanedDataArray = Array.from(this.cleanedData.values());
    const annotatedDataArray = this.getAnnotations();
    const datasetsArray = Array.from(this.datasets.values());

    const dataSnapshot = {
      rawData: rawDataArray,
      cleanedData: cleanedDataArray,
      annotatedData: annotatedDataArray,
      datasets: datasetsArray
    };

    const dataString = JSON.stringify(dataSnapshot);
    const sizeBytes = new Blob([dataString]).size;

    const backup: DataBackup = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      dataSnapshot,
      createdAt: new Date(),
      sizeBytes,
      checksum: this.calculateChecksum(dataString)
    };

    this.backups.set(backup.id, backup);
    this.backupSchedule.lastBackupAt = new Date();
    return backup;
  }

  /**
   * 计算简单校验和
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 恢复数据备份
   */
  restoreBackup(backupId: string, options?: { restoreRawData?: boolean; restoreCleanedData?: boolean; restoreAnnotatedData?: boolean; restoreDatasets?: boolean }): boolean {
    const backup = this.backups.get(backupId);
    if (!backup) return false;

    const opts = {
      restoreRawData: true,
      restoreCleanedData: true,
      restoreAnnotatedData: true,
      restoreDatasets: true,
      ...options
    };

    // 清空现有数据
    if (opts.restoreRawData) {
      this.rawData.clear();
      for (const data of backup.dataSnapshot.rawData) {
        this.rawData.set(data.id, data);
      }
    }

    if (opts.restoreCleanedData) {
      this.cleanedData.clear();
      for (const data of backup.dataSnapshot.cleanedData) {
        this.cleanedData.set(data.id, data);
      }
    }

    if (opts.restoreAnnotatedData) {
      this.annotationManager.clear();
      for (const data of backup.dataSnapshot.annotatedData) {
        const cleanedData = this.cleanedData.get(data.cleanedDataId);
        if (cleanedData) {
          const annotation = this.annotationManager.createAnnotation(cleanedData, data.labels, {
            intent: data.intent,
            entities: data.entities,
            annotator: data.annotator
          });
          if (annotation && data.verified) {
            (annotation as AnnotatedData).verified = data.verified;
            (annotation as AnnotatedData).verifiedBy = data.verifiedBy;
            (annotation as AnnotatedData).verifiedAt = data.verifiedAt;
          }
        }
      }
    }

    if (opts.restoreDatasets) {
      this.datasets.clear();
      for (const dataset of backup.dataSnapshot.datasets) {
        this.datasets.set(dataset.id, dataset);
      }
    }

    return true;
  }

  /**
   * 获取所有备份
   */
  getBackups(): DataBackup[] {
    return Array.from(this.backups.values());
  }

  /**
   * 获取备份详情
   */
  getBackup(backupId: string): DataBackup | undefined {
    return this.backups.get(backupId);
  }

  /**
   * 删除备份
   */
  deleteBackup(backupId: string): boolean {
    return this.backups.delete(backupId);
  }

  /**
   * 检查是否需要备份
   */
  needsBackup(): boolean {
    if (!this.backupSchedule.lastBackupAt) return true;
    const elapsed = Date.now() - this.backupSchedule.lastBackupAt.getTime();
    return elapsed >= this.backupSchedule.intervalMs;
  }

  /**
   * 设置备份间隔
   */
  setBackupInterval(intervalMs: number): void {
    this.backupSchedule.intervalMs = intervalMs;
  }

  /**
   * 验证备份完整性
   */
  verifyBackup(backupId: string): { valid: boolean; errors: string[] } {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return { valid: false, errors: ['备份不存在'] };
    }

    const errors: string[] = [];
    const dataString = JSON.stringify(backup.dataSnapshot);
    const calculatedChecksum = this.calculateChecksum(dataString);

    if (calculatedChecksum !== backup.checksum) {
      errors.push('校验和不匹配，数据可能已损坏');
    }

    if (backup.dataSnapshot.rawData.length === 0 &&
        backup.dataSnapshot.cleanedData.length === 0 &&
        backup.dataSnapshot.annotatedData.length === 0) {
      errors.push('备份数据为空');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ============ 数据质量报告生成方法 ============

  /**
   * 生成数据质量报告
   */
  generateQualityReport(periodDays: number = 7): DataQualityReport {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const allCleanedData = Array.from(this.cleanedData.values());
    const highQualityThreshold = 70;
    const lowQualityThreshold = 40;

    const highQualityRecords = allCleanedData.filter(d => d.quality >= highQualityThreshold);
    const lowQualityRecords = allCleanedData.filter(d => d.quality < lowQualityThreshold);
    const duplicateRecords = allCleanedData.filter(d => d.isDuplicate);

    // 计算各维度平均分
    const allScores = allCleanedData.map(d =>
      this.dataCleaner.calculateDetailedQualityScore(d.content)
    );

    const dimensions = {
      completeness: this.calculateDimensionAverage(allScores, s => s.completeness),
      accuracy: this.calculateDimensionAverage(allScores, s => s.accuracy),
      consistency: this.calculateDimensionAverage(allScores, s => s.consistency),
      timeliness: this.calculateDimensionAverage(allScores, s => s.timeliness),
      uniqueness: this.calculateDimensionAverage(allScores, s => s.uniqueness)
    };

    // 收集质量趋势
    const trends: Array<{ date: Date; score: number }> = [];
    for (const [dataId, history] of this.qualityHistory.entries()) {
      for (const score of history) {
        // 使用当前日期作为趋势点的时间，因为QualityScore没有checkedAt属性
        const trendDate = new Date();
        if (trendDate >= startDate && trendDate <= endDate) {
          trends.push({ date: trendDate, score: score.overall });
        }
      }
    }
    trends.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 生成建议
    const recommendations: string[] = [];
    if (dimensions.completeness < 70) {
      recommendations.push('数据完整性较低，建议检查缺失值处理逻辑');
    }
    if (dimensions.accuracy < 70) {
      recommendations.push('数据准确性有待提高，建议加强数据验证');
    }
    if (dimensions.consistency < 70) {
      recommendations.push('数据一致性存在问题，建议统一数据格式');
    }
    if (lowQualityRecords.length > allCleanedData.length * 0.2) {
      recommendations.push(`低质量数据占比过高 (${Math.round(lowQualityRecords.length / allCleanedData.length * 100)}%)，建议优先处理`);
    }
    if (duplicateRecords.length > 0) {
      recommendations.push(`发现 ${duplicateRecords.length} 条重复数据，建议去重处理`);
    }

    return {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      overallScore: Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0) / 5),
      dimensions,
      statistics: {
        totalRecords: allCleanedData.length,
        highQualityRecords: highQualityRecords.length,
        lowQualityRecords: lowQualityRecords.length,
        duplicateRecords: duplicateRecords.length,
        missingValueFields: this.analyzeMissingFields(allCleanedData)
      },
      trends,
      recommendations
    };
  }

  private calculateDimensionAverage(
    scores: QualityScore[],
    selector: (s: QualityScore) => number
  ): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, s) => acc + selector(s), 0);
    return Math.round(sum / scores.length);
  }

  private analyzeMissingFields(data: CleanedData[]): Record<string, number> {
    const missingFields: Record<string, number> = {};
    for (const d of data) {
      if (d.isDuplicate && !d.duplicateOf) missingFields['duplicateOf'] = (missingFields['duplicateOf'] || 0) + 1;
      if (!d.metadata) missingFields['metadata'] = (missingFields['metadata'] || 0) + 1;
    }
    return missingFields;
  }

  /**
   * 生成数据质量摘要
   */
  getQualitySummary(): {
    overall: number;
    distribution: Record<string, number>;
    topIssues: string[];
  } {
    const data = Array.from(this.cleanedData.values());
    if (data.length === 0) {
      return { overall: 0, distribution: {}, topIssues: [] };
    }

    const distribution: Record<string, number> = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0
    };

    let totalQuality = 0;
    const issues: Array<{ type: string; count: number }> = [];

    for (const d of data) {
      totalQuality += d.quality;
      if (d.quality >= 90) distribution.excellent++;
      else if (d.quality >= 70) distribution.good++;
      else if (d.quality >= 50) distribution.fair++;
      else distribution.poor++;

      if (d.isDuplicate) {
        issues.push({ type: 'duplicate', count: 1 });
      }
    }

    const topIssues = issues
      .reduce((acc, issue) => {
        const existing = acc.find(i => i.type === issue.type);
        if (existing) existing.count += issue.count;
        else acc.push({ ...issue });
        return acc;
      }, [] as Array<{ type: string; count: number }>)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(i => `${i.type}: ${i.count}条`);

    return {
      overall: Math.round(totalQuality / data.length),
      distribution,
      topIssues
    };
  }

  // ============ 增强的数据版本控制方法 ============

  /**
   * 比较两个版本的差异
   */
  compareVersions(dataId: string, versionId1: string, versionId2: string): {
    version1: DataVersion | null;
    version2: DataVersion | null;
    differences: string[];
  } {
    const versions = this.getVersions(dataId);
    const v1 = versions.find(v => v.id === versionId1) || null;
    const v2 = versions.find(v => v.id === versionId2) || null;
    const differences: string[] = [];

    if (v1 && v2) {
      if (v1.content !== v2.content) {
        differences.push('内容已修改');
      }
      if (v1.version !== v2.version) {
        differences.push(`版本从 ${v1.version} 变为 ${v2.version}`);
      }
    }

    return { version1: v1, version2: v2, differences };
  }

  /**
   * 获取版本历史统计
   */
  getVersionStatistics(): {
    totalVersions: number;
    versionedDataCount: number;
    avgVersionsPerData: number;
    mostActiveData: string | null;
  } {
    let totalVersions = 0;
    let mostActiveData: string | null = null;
    let maxVersions = 0;

    for (const [dataId, versions] of this.dataVersions.entries()) {
      totalVersions += versions.length;
      if (versions.length > maxVersions) {
        maxVersions = versions.length;
        mostActiveData = dataId;
      }
    }

    const versionedDataCount = this.dataVersions.size;

    return {
      totalVersions,
      versionedDataCount,
      avgVersionsPerData: versionedDataCount > 0 ? Math.round(totalVersions / versionedDataCount * 10) / 10 : 0,
      mostActiveData
    };
  }

  clearAll(): void {
    this.rawData.clear();
    this.cleanedData.clear();
    this.datasets.clear();
    this.dataVersions.clear();
    this.qualityHistory.clear();
    this.annotationManager.clear();
    this.dataLineage.clear();
    this.lineageGraph = { nodes: [], edges: [] };
    this.maskedData.clear();
    this.complianceHistory = [];
    this.dataTags.clear();
    this.tagAssignments.clear();
    this.backups.clear();
    this.initializeDefaultTags();
  }
}
