/**
 * 记忆系统模块 - Memory System Module
 * 
 * 功能：
 * 1. 分层记忆架构（短期、工作、长期）
 * 2. 记忆摘要与过滤
 * 3. 任务进度跟踪
 * 4. 向量检索支持
 * 
 * @module core/memory
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export type MemoryType = 'short-term' | 'working' | 'long-term';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, any>;
  timestamp: number;
  importance: number;
  tags: string[];
  expiresAt?: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
}

export interface MemorySummary {
  id: string;
  originalIds: string[];
  summary: string;
  keywords: string[];
  timestamp: number;
  coverage: number;
}

export interface TaskProgress {
  taskId: string;
  taskName: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  subtasks: Array<{
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error?: string;
  }>;
  overallProgress: number;
  startTime: number;
  endTime?: number;
}

export interface MemoryConfig {
  shortTermLimit: number;
  workingMemoryLimit: number;
  longTermLimit: number;
  importanceDecayRate: number;
  autoSummarizeThreshold: number;
  summaryInterval: number;
}

// ==================== 短期记忆（会话级别） ====================

export class ShortTermMemory {
  private entries: MemoryEntry[] = [];
  private limit: number;

  constructor(limit: number = 100) {
    this.limit = limit;
  }

  add(content: string, metadata: Record<string, any> = {}): MemoryEntry {
    const entry: MemoryEntry = {
      id: `stm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'short-term',
      content,
      metadata,
      timestamp: Date.now(),
      importance: 1.0,
      tags: metadata.tags || []
    };

    this.entries.unshift(entry);
    
    if (this.entries.length > this.limit) {
      this.entries = this.entries.slice(0, this.limit);
    }

    return entry;
  }

  getRecent(count: number = 10): MemoryEntry[] {
    return this.entries.slice(0, count);
  }

  search(query: string, limit: number = 5): MemorySearchResult[] {
    const results = this.entries.map(entry => ({
      entry,
      score: this.calculateSimilarity(query, entry.content)
    }))
    .filter(r => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return results;
  }

  clear(): void {
    this.entries = [];
  }

  size(): number {
    return this.entries.length;
  }

  private calculateSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    queryWords.forEach(qw => {
      if (contentWords.includes(qw)) {
        matches++;
      }
    });
    
    return matches / queryWords.length;
  }
}

// ==================== 工作记忆（任务级别） ====================

export class WorkingMemory {
  private entries: MemoryEntry[] = [];
  private limit: number;
  private taskContexts: Map<string, string[]> = new Map();

  constructor(limit: number = 500) {
    this.limit = limit;
  }

  add(content: string, metadata: Record<string, any> = {}, taskId?: string): MemoryEntry {
    const entry: MemoryEntry = {
      id: `wkm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'working',
      content,
      metadata,
      timestamp: Date.now(),
      importance: 1.0,
      tags: metadata.tags || []
    };

    this.entries.unshift(entry);
    
    if (taskId) {
      if (!this.taskContexts.has(taskId)) {
        this.taskContexts.set(taskId, []);
      }
      this.taskContexts.get(taskId)!.unshift(entry.id);
    }

    if (this.entries.length > this.limit) {
      this.entries = this.entries.slice(0, this.limit);
    }

    return entry;
  }

  getByTask(taskId: string): MemoryEntry[] {
    const entryIds = this.taskContexts.get(taskId) || [];
    return entryIds.map(id => this.entries.find(e => e.id === id)).filter(Boolean) as MemoryEntry[];
  }

  search(query: string, taskId?: string, limit: number = 10): MemorySearchResult[] {
    let entries = this.entries;
    
    if (taskId) {
      const entryIds = this.taskContexts.get(taskId) || [];
      entries = entries.filter(e => entryIds.includes(e.id));
    }

    const results = entries.map(entry => ({
      entry,
      score: this.calculateSimilarity(query, entry.content)
    }))
    .filter(r => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    return results;
  }

  summarize(taskId: string): MemorySummary {
    const entries = this.getByTask(taskId);
    if (entries.length === 0) {
      return {
        id: `sum_${taskId}`,
        originalIds: [],
        summary: '暂无记忆内容',
        keywords: [],
        timestamp: Date.now(),
        coverage: 0
      };
    }

    const content = entries.map(e => e.content).join(' ');
    const summary = this.generateSummary(content);
    const keywords = this.extractKeywords(content);

    return {
      id: `sum_${taskId}_${Date.now()}`,
      originalIds: entries.map(e => e.id),
      summary,
      keywords,
      timestamp: Date.now(),
      coverage: Math.min(entries.length / 10, 1)
    };
  }

  clearTask(taskId: string): void {
    const entryIds = this.taskContexts.get(taskId) || [];
    this.entries = this.entries.filter(e => !entryIds.includes(e.id));
    this.taskContexts.delete(taskId);
  }

  private calculateSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    let totalWeight = 0;
    
    queryWords.forEach((qw, i) => {
      const weight = queryWords.length - i;
      if (contentWords.includes(qw)) {
        matches += weight;
      }
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? matches / totalWeight : 0;
  }

  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 5);
    
    if (sentences.length <= 3) {
      return content.substring(0, 200) + (content.length > 200 ? '...' : '');
    }

    const keySentences = sentences.slice(0, 3);
    return keySentences.join('。') + '...';
  }

  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase().split(/\W+/);
    const wordCount: Record<string, number> = {};
    
    words.forEach(word => {
      if (word.length >= 2) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);
  }
}

// ==================== 长期记忆（持久化） ====================

export class LongTermMemory extends EventEmitter {
  private entries: MemoryEntry[] = [];
  private limit: number;
  private decayRate: number;

  constructor(limit: number = 10000, decayRate: number = 0.01) {
    super();
    this.limit = limit;
    this.decayRate = decayRate;
  }

  add(content: string, metadata: Record<string, any> = {}): MemoryEntry {
    const entry: MemoryEntry = {
      id: `ltm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'long-term',
      content,
      metadata,
      timestamp: Date.now(),
      importance: 1.0,
      tags: metadata.tags || [],
      expiresAt: metadata.expiresAt
    };

    this.entries.push(entry);
    this.emit('memory:added', entry);

    if (this.entries.length > this.limit) {
      this.purgeLowImportance();
    }

    return entry;
  }

  retrieve(query: string, limit: number = 10): MemorySearchResult[] {
    this.decayImportance();

    const results = this.entries
      .filter(e => !e.expiresAt || e.expiresAt > Date.now())
      .map(entry => ({
        entry,
        score: this.calculateRelevance(query, entry)
      }))
      .filter(r => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    results.forEach(r => {
      this.increaseImportance(r.entry.id, 0.1);
    });

    return results;
  }

  retrieveByTag(tag: string, limit: number = 10): MemoryEntry[] {
    return this.entries
      .filter(e => e.tags.includes(tag))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  update(id: string, updates: Partial<MemoryEntry>): boolean {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.entries[index] = { ...this.entries[index], ...updates };
    this.emit('memory:updated', this.entries[index]);
    return true;
  }

  delete(id: string): boolean {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    const deleted = this.entries.splice(index, 1)[0];
    this.emit('memory:deleted', deleted);
    return true;
  }

  private calculateRelevance(query: string, entry: MemoryEntry): number {
    let score = 0;
    
    const queryLower = query.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    
    if (contentLower.includes(queryLower)) {
      score += 0.5;
    }
    
    entry.tags.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower)) {
        score += 0.1;
      }
    });
    
    score += entry.importance * 0.4;

    const ageInHours = (Date.now() - entry.timestamp) / 3600000;
    const agePenalty = Math.exp(-this.decayRate * ageInHours);
    score *= agePenalty;

    return Math.min(score, 1);
  }

  private decayImportance(): void {
    this.entries.forEach(entry => {
      entry.importance = Math.max(0.01, entry.importance - this.decayRate);
    });
  }

  private increaseImportance(id: string, amount: number): void {
    const entry = this.entries.find(e => e.id === id);
    if (entry) {
      entry.importance = Math.min(1.0, entry.importance + amount);
    }
  }

  private purgeLowImportance(): void {
    this.entries.sort((a, b) => a.importance - b.importance);
    this.entries = this.entries.slice(-this.limit);
  }

  exportToJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  importFromJSON(json: string): void {
    try {
      const entries = JSON.parse(json) as MemoryEntry[];
      this.entries.push(...entries);
      this.emit('memory:imported', entries.length);
    } catch {
      throw new Error('Invalid JSON format');
    }
  }
}

// ==================== 任务进度跟踪器 ====================

export class TaskProgressTracker {
  private tasks: Map<string, TaskProgress> = new Map();

  createTask(taskId: string, taskName: string, subtasks: string[]): TaskProgress {
    const task: TaskProgress = {
      taskId,
      taskName,
      status: 'pending',
      subtasks: subtasks.map((name, index) => ({
        id: `sub_${taskId}_${index}`,
        name,
        status: 'pending' as const,
        progress: 0
      })),
      overallProgress: 0,
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);
    return task;
  }

  updateSubtask(taskId: string, subtaskId: string, updates: Partial<TaskProgress['subtasks'][0]>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return false;

    Object.assign(subtask, updates);
    this.updateOverallProgress(task);

    return true;
  }

  completeSubtask(taskId: string, subtaskId: string, result?: any): boolean {
    return this.updateSubtask(taskId, subtaskId, {
      status: 'completed',
      progress: 100,
      result
    });
  }

  failSubtask(taskId: string, subtaskId: string, error: string): boolean {
    return this.updateSubtask(taskId, subtaskId, {
      status: 'failed',
      error
    });
  }

  getTask(taskId: string): TaskProgress | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): TaskProgress[] {
    return Array.from(this.tasks.values());
  }

  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  private updateOverallProgress(task: TaskProgress): void {
    const completed = task.subtasks.filter(s => s.status === 'completed').length;
    const failed = task.subtasks.filter(s => s.status === 'failed').length;
    
    if (failed > 0) {
      task.status = 'failed';
    } else if (completed === task.subtasks.length) {
      task.status = 'completed';
      task.endTime = Date.now();
    } else if (completed > 0) {
      task.status = 'in-progress';
    }

    task.overallProgress = Math.round((completed / task.subtasks.length) * 100);
  }
}

// ==================== 记忆管理器（协调三层记忆） ====================

export class MemoryManager {
  private shortTerm: ShortTermMemory;
  private working: WorkingMemory;
  private longTerm: LongTermMemory;
  private config: MemoryConfig;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      shortTermLimit: 100,
      workingMemoryLimit: 500,
      longTermLimit: 10000,
      importanceDecayRate: 0.01,
      autoSummarizeThreshold: 10,
      summaryInterval: 300000,
      ...config
    };

    this.shortTerm = new ShortTermMemory(this.config.shortTermLimit);
    this.working = new WorkingMemory(this.config.workingMemoryLimit);
    this.longTerm = new LongTermMemory(this.config.longTermLimit, this.config.importanceDecayRate);
  }

  addMemory(content: string, type: MemoryType, metadata: Record<string, any> = {}, taskId?: string): MemoryEntry {
    switch (type) {
      case 'short-term':
        return this.shortTerm.add(content, metadata);
      case 'working':
        return this.working.add(content, metadata, taskId);
      case 'long-term':
        return this.longTerm.add(content, metadata);
      default:
        return this.shortTerm.add(content, metadata);
    }
  }

  search(query: string, type?: MemoryType, taskId?: string): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];

    if (!type || type === 'short-term') {
      results.push(...this.shortTerm.search(query, 5));
    }
    
    if (!type || type === 'working') {
      results.push(...this.working.search(query, taskId, 5));
    }
    
    if (!type || type === 'long-term') {
      results.push(...this.longTerm.retrieve(query, 5));
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  getRecentShortTerm(count: number = 10): MemoryEntry[] {
    return this.shortTerm.getRecent(count);
  }

  getWorkingByTask(taskId: string): MemoryEntry[] {
    return this.working.getByTask(taskId);
  }

  summarizeWorking(taskId: string): MemorySummary {
    return this.working.summarize(taskId);
  }

  recallFromLongTerm(query: string): MemorySearchResult[] {
    return this.longTerm.retrieve(query, 10);
  }

  commitToLongTerm(content: string, metadata: Record<string, any> = {}): MemoryEntry {
    return this.longTerm.add(content, metadata);
  }

  consolidate(taskId: string): void {
    const workingEntries = this.working.getByTask(taskId);
    
    if (workingEntries.length >= this.config.autoSummarizeThreshold) {
      const summary = this.working.summarize(taskId);
      this.longTerm.add(summary.summary, {
        tags: summary.keywords,
        originalTaskId: taskId,
        summaryOf: summary.originalIds
      });
      
      this.working.clearTask(taskId);
    }
  }

  clearShortTerm(): void {
    this.shortTerm.clear();
  }

  clearWorking(taskId?: string): void {
    if (taskId) {
      this.working.clearTask(taskId);
    } else {
      this.working = new WorkingMemory(this.config.workingMemoryLimit);
    }
  }
}

// ==================== 导出单例 ====================

export const memoryManager = new MemoryManager();

export default {
  ShortTermMemory,
  WorkingMemory,
  LongTermMemory,
  TaskProgressTracker,
  MemoryManager,
  memoryManager
};
