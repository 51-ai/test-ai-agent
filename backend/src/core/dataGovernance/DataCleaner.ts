import { RawData, CleanedData, DataQualityCheck, QualityScore } from './types';

export class DataCleaner {
  private contentHashCache = new Map<string, string>();

  cleanText(text: string): string {
    let cleaned = text;

    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/[^\S\r\n]+/g, ' ')
      .replace(/\r\n/g, '\n')
      .trim();

    return cleaned;
  }

  removeSpecialCharacters(text: string): string {
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  normalizePunctuation(text: string): string {
    return text
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/！/g, '!')
      .replace(/？/g, '?')
      .replace(/：/g, ':')
      .replace(/；/g, ';');
  }

  normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  deduplicate(texts: string[]): { uniqueTexts: string[]; duplicates: number } {
    const seen = new Set<string>();
    const uniqueTexts: string[] = [];
    let duplicates = 0;

    for (const text of texts) {
      const normalized = this.cleanText(text).toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueTexts.push(text);
      } else {
        duplicates++;
      }
    }

    return { uniqueTexts, duplicates };
  }

  checkDuplicate(text: string, existingTexts: string[]): { isDuplicate: boolean; duplicateOf?: string } {
    const normalized = this.generateContentHash(text);
    for (const existing of existingTexts) {
      if (this.generateContentHash(existing) === normalized) {
        return { isDuplicate: true, duplicateOf: existing };
      }
    }
    return { isDuplicate: false };
  }

  generateContentHash(text: string): string {
    const normalized = this.normalizeTextForHashing(text);
    if (this.contentHashCache.has(normalized)) {
      return this.contentHashCache.get(normalized)!;
    }
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashStr = hash.toString(36);
    this.contentHashCache.set(normalized, hashStr);
    return hashStr;
  }

  normalizeTextForHashing(text: string): string {
    return this.cleanText(text)
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
      .replace(/\s+/g, '');
  }

  assessQuality(text: string): number {
    let score = 100;

    if (text.length < 10) score -= 30;
    if (text.length < 5) score -= 20;

    const specialCharRatio = (text.match(/[^\w\s\u4e00-\u9fa5,.!?;:'"()\[\]{}-]/g) || []).length / text.length;
    if (specialCharRatio > 0.2) score -= 20;

    const words = text.split(/\s+/).length;
    if (words < 3) score -= 20;

    if (text.toUpperCase() === text) score -= 10;

    if (text.includes('http://') || text.includes('https://')) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  calculateDetailedQualityScore(text: string): QualityScore {
    const completeness = this.calculateCompleteness(text);
    const accuracy = this.calculateAccuracy(text);
    const consistency = this.calculateConsistency(text);
    const timeliness = 100;
    const uniqueness = 100;

    const overall = Math.round(
      (completeness * 0.25) +
      (accuracy * 0.25) +
      (consistency * 0.2) +
      (timeliness * 0.15) +
      (uniqueness * 0.15)
    );

    return {
      overall,
      completeness,
      accuracy,
      consistency,
      timeliness,
      uniqueness
    };
  }

  private calculateCompleteness(text: string): number {
    let score = 100;
    if (text.length < 20) score -= 40;
    else if (text.length < 50) score -= 20;
    if (text.trim().length === 0) score = 0;
    return Math.max(0, score);
  }

  private calculateAccuracy(text: string): number {
    let score = 100;
    const specialChars = (text.match(/[^\w\s\u4e00-\u9fa5,.!?;:'"()\[\]{}-]/g) || []).length;
    const ratio = specialChars / text.length;
    if (ratio > 0.3) score -= 50;
    else if (ratio > 0.15) score -= 25;
    return Math.max(0, score);
  }

  private calculateConsistency(text: string): number {
    let score = 100;
    const hasMixedCase = text !== text.toLowerCase() && text !== text.toUpperCase();
    if (!hasMixedCase && text.length > 30) score -= 20;
    return Math.max(0, score);
  }

  clean(rawData: RawData): CleanedData {
    let content = rawData.content;
    content = this.cleanText(content);
    content = this.removeSpecialCharacters(content);
    content = this.normalizePunctuation(content);
    content = this.normalizeWhitespace(content);

    const quality = this.assessQuality(content);

    return {
      id: `cleaned_${rawData.id}`,
      originalId: rawData.id,
      content,
      quality,
      isDuplicate: false,
      cleanedAt: new Date(),
      metadata: rawData.metadata
    };
  }

  advancedClean(rawData: RawData): CleanedData {
    let content = rawData.content;
    content = this.cleanText(content);
    content = this.removeSpecialCharacters(content);
    content = this.normalizePunctuation(content);
    content = this.normalizeWhitespace(content);
    content = this.removeNoisePatterns(content);

    const quality = this.calculateDetailedQualityScore(content).overall;

    return {
      id: `cleaned_${rawData.id}`,
      originalId: rawData.id,
      content,
      quality,
      isDuplicate: false,
      cleanedAt: new Date(),
      metadata: rawData.metadata
    };
  }

  private removeNoisePatterns(text: string): string {
    return text
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\{.*?\}/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  runQualityChecks(data: CleanedData): DataQualityCheck[] {
    const checks: DataQualityCheck[] = [];

    checks.push({
      id: `${data.id}_length`,
      dataId: data.id,
      checkType: 'length_check',
      passed: data.content.length >= 10,
      score: data.content.length,
      details: `Content length: ${data.content.length} characters`,
      checkedAt: new Date()
    });

    checks.push({
      id: `${data.id}_quality`,
      dataId: data.id,
      checkType: 'quality_score',
      passed: data.quality >= 60,
      score: data.quality,
      details: `Overall quality score: ${data.quality}/100`,
      checkedAt: new Date()
    });

    checks.push({
      id: `${data.id}_special_chars`,
      dataId: data.id,
      checkType: 'special_chars',
      passed: (data.content.match(/[^\w\s\u4e00-\u9fa5,.!?;:'"()\[\]{}-]/g) || []).length / data.content.length < 0.1,
      details: 'Special characters ratio check',
      checkedAt: new Date()
    });

    const detailedScore = this.calculateDetailedQualityScore(data.content);
    checks.push({
      id: `${data.id}_completeness`,
      dataId: data.id,
      checkType: 'completeness',
      passed: detailedScore.completeness >= 70,
      score: detailedScore.completeness,
      details: `Completeness score: ${detailedScore.completeness}/100`,
      checkedAt: new Date()
    });

    checks.push({
      id: `${data.id}_accuracy`,
      dataId: data.id,
      checkType: 'accuracy',
      passed: detailedScore.accuracy >= 70,
      score: detailedScore.accuracy,
      details: `Accuracy score: ${detailedScore.accuracy}/100`,
      checkedAt: new Date()
    });

    checks.push({
      id: `${data.id}_consistency`,
      dataId: data.id,
      checkType: 'consistency',
      passed: detailedScore.consistency >= 70,
      score: detailedScore.consistency,
      details: `Consistency score: ${detailedScore.consistency}/100`,
      checkedAt: new Date()
    });

    return checks;
  }

  batchClean(rawDataList: RawData[]): { cleanedData: CleanedData[]; stats: { total: number; duplicates: number; highQuality: number } } {
    const cleanedData: CleanedData[] = [];
    const seenHashes = new Set<string>();
    let duplicates = 0;
    let highQuality = 0;

    for (const rawData of rawDataList) {
      const cleaned = this.advancedClean(rawData);
      const hash = this.generateContentHash(cleaned.content);

      if (seenHashes.has(hash)) {
        duplicates++;
        cleaned.isDuplicate = true;
      } else {
        seenHashes.add(hash);
        if (cleaned.quality >= 70) {
          highQuality++;
        }
      }

      cleanedData.push(cleaned);
    }

    return {
      cleanedData,
      stats: {
        total: rawDataList.length,
        duplicates,
        highQuality
      }
    };
  }
}
