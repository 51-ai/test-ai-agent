import { ModelVersion, ModelComparison } from './types';

export class ModelVersionManager {
  private versions: Map<string, ModelVersion> = new Map();
  private activeVersion: ModelVersion | null = null;

  createVersion(
    version: string,
    name: string,
    options: {
      description?: string;
      checkpointPath?: string;
      createdBy: string;
      metrics?: Record<string, number>;
      tags?: string[];
      deploymentEnv?: ModelVersion['deploymentEnv'];
    }
  ): ModelVersion {
    const modelVersion: ModelVersion = {
      id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version,
      name,
      description: options.description,
      checkpointPath: options.checkpointPath,
      createdAt: new Date(),
      createdBy: options.createdBy,
      isActive: false,
      metrics: options.metrics,
      tags: options.tags || [],
      deploymentEnv: options.deploymentEnv || 'development',
      rollbackable: true,
      performanceScore: this.calculatePerformanceScore(options.metrics)
    };

    this.versions.set(modelVersion.id, modelVersion);
    return modelVersion;
  }

  getVersion(id: string): ModelVersion | undefined {
    return this.versions.get(id);
  }

  getVersions(filters?: {
    tags?: string[];
    deploymentEnv?: ModelVersion['deploymentEnv'];
    isActive?: boolean;
    createdAfter?: Date;
  }): ModelVersion[] {
    let results = Array.from(this.versions.values());

    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(v => 
        v.tags && filters.tags!.some(tag => v.tags!.includes(tag))
      );
    }

    if (filters?.deploymentEnv) {
      results = results.filter(v => v.deploymentEnv === filters.deploymentEnv);
    }

    if (filters?.isActive !== undefined) {
      results = results.filter(v => v.isActive === filters.isActive);
    }

    if (filters?.createdAfter) {
      results = results.filter(v => v.createdAt >= filters.createdAfter!);
    }

    return results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getActiveVersion(): ModelVersion | null {
    return this.activeVersion;
  }

  setActiveVersion(versionId: string): boolean {
    const version = this.versions.get(versionId);
    if (!version) return false;

    if (this.activeVersion) {
      this.activeVersion.isActive = false;
    }

    version.isActive = true;
    this.activeVersion = version;
    return true;
  }

  rollbackToVersion(versionId: string): boolean {
    const targetVersion = this.versions.get(versionId);
    
    if (!targetVersion || !targetVersion.rollbackable) {
      return false;
    }

    return this.setActiveVersion(versionId);
  }

  updateVersion(versionId: string, updates: Partial<ModelVersion>): ModelVersion | null {
    const version = this.versions.get(versionId);
    if (!version) return null;

    const updated: ModelVersion = {
      ...version,
      ...updates,
      performanceScore: updates.metrics 
        ? this.calculatePerformanceScore({ ...version.metrics, ...updates.metrics })
        : version.performanceScore
    };

    this.versions.set(versionId, updated);

    if (this.activeVersion?.id === versionId) {
      this.activeVersion = updated;
    }

    return updated;
  }

  deleteVersion(versionId: string): boolean {
    if (this.activeVersion?.id === versionId) {
      return false;
    }
    return this.versions.delete(versionId);
  }

  getLatestVersion(): ModelVersion | null {
    const versions = this.getVersions();
    return versions.length > 0 ? versions[0] : null;
  }

  getVersionByVersionNumber(versionNumber: string): ModelVersion | undefined {
    return this.getVersions().find(v => v.version === versionNumber);
  }

  compareVersions(versionAId: string, versionBId: string): ModelComparison | null {
    const versionA = this.getVersion(versionAId);
    const versionB = this.getVersion(versionBId);

    if (!versionA || !versionB) {
      return null;
    }

    const allMetricNames = new Set<string>([
      ...Object.keys(versionA.metrics || {}),
      ...Object.keys(versionB.metrics || {})
    ]);

    const comparisonMetrics: ModelComparison['comparisonMetrics'] = {};
    
    for (const metric of allMetricNames) {
      const a = versionA.metrics?.[metric] || 0;
      const b = versionB.metrics?.[metric] || 0;
      comparisonMetrics[metric] = { a, b, diff: b - a };
    }

    let winner: string | undefined;
    if (versionA.performanceScore !== undefined && versionB.performanceScore !== undefined) {
      winner = versionB.performanceScore > versionA.performanceScore ? versionBId : versionAId;
    }

    return {
      versionA: versionAId,
      versionB: versionBId,
      comparisonMetrics,
      winner,
      confidence: winner ? 0.8 : 0.5
    };
  }

  getBestPerformingVersion(): ModelVersion | null {
    const versions = this.getVersions()
      .filter(v => v.performanceScore !== undefined)
      .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0));

    return versions.length > 0 ? versions[0] : null;
  }

  archiveOldVersions(keepLastN: number = 10): number {
    const sortedVersions = this.getVersions();
    const toKeep = sortedVersions.slice(0, keepLastN);
    const toArchive = sortedVersions.slice(keepLastN);
    
    let archived = 0;
    for (const version of toArchive) {
      if (version.isActive) continue;
      if (this.deleteVersion(version.id)) {
        archived++;
      }
    }

    return archived;
  }

  getVersionStats() {
    const versions = this.getVersions();
    const active = this.getActiveVersion();
    
    const byEnv: Record<string, number> = {};
    const byDate: Record<string, number> = {};

    for (const v of versions) {
      const env = v.deploymentEnv || 'unknown';
      byEnv[env] = (byEnv[env] || 0) + 1;

      const monthKey = `${v.createdAt.getFullYear()}-${v.createdAt.getMonth()+1}`;
      byDate[monthKey] = (byDate[monthKey] || 0) + 1;
    }

    return {
      total: versions.length,
      activeVersion: active?.version || null,
      byEnvironment: byEnv,
      byCreationDate: byDate,
      bestPerformance: this.getBestPerformingVersion()?.performanceScore || 0
    };
  }

  private calculatePerformanceScore(metrics?: Record<string, number>): number {
    if (!metrics) return 0.5;

    const weights: Record<string, number> = {
      'accuracy': 0.3,
      'precision': 0.2,
      'recall': 0.2,
      'f1_score': 0.2,
      'response_time': -0.1,
      'user_satisfaction': 0.15,
      'helpful_rate': 0.15
    };

    let score = 0.5;
    let totalWeight = 0;

    for (const [metric, value] of Object.entries(metrics)) {
      const weight = weights[metric] || 0.05;
      
      if (weight < 0) {
        score += (1 - Math.min(value, 1)) * Math.abs(weight);
      } else {
        score += Math.min(value, 1) * weight;
      }
      
      totalWeight += Math.abs(weight);
    }

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }
}
