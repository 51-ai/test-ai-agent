export interface MemoryItem {
  id: string;
  content: string;
  type: 'fact' | 'event' | 'task' | 'knowledge' | 'preference';
  metadata: MemoryMetadata;
  createdAt: number;
  lastAccessedAt: number;
  importance: number;
}

export interface MemoryMetadata {
  source?: string;
  context?: string;
  tags: string[];
  confidence: number;
  expiresAt?: number;
  userId?: string;
}

export interface SessionMemory {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallRecord[];
}

export interface ToolCallRecord {
  toolName: string;
  parameters: Record<string, any>;
  result: any;
}

export interface TaskMemory {
  taskId: string;
  goal: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: TaskStep[];
  createdAt: number;
  updatedAt: number;
}

export interface TaskStep {
  stepNumber: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  timestamp: number;
}

export type MemoryLevel = 'short' | 'medium' | 'long';

export class ShortTermMemory {
  private messages: ChatMessage[] = [];
  private maxMessages: number;
  private sessionId: string;

  constructor(sessionId: string, maxMessages: number = 50) {
    this.sessionId = sessionId;
    this.maxMessages = maxMessages;
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  getRecentMessages(count: number): ChatMessage[] {
    return this.messages.slice(-count);
  }

  getContext(): string {
    return this.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  clear(): void {
    this.messages = [];
  }

  findRelatedMessages(query: string): ChatMessage[] {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(msg => 
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

export class MediumTermMemory {
  private tasks: Map<string, TaskMemory> = new Map();
  private maxTasks: number;

  constructor(maxTasks: number = 20) {
    this.maxTasks = maxTasks;
  }

  createTask(taskId: string, goal: string): TaskMemory {
    const task: TaskMemory = {
      taskId,
      goal,
      status: 'pending',
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    if (this.tasks.size >= this.maxTasks) {
      const oldestTask = Array.from(this.tasks.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldestTask) {
        this.tasks.delete(oldestTask[0]);
      }
    }
    
    this.tasks.set(taskId, task);
    return task;
  }

  updateTask(taskId: string, updates: Partial<TaskMemory>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    Object.assign(task, updates);
    task.updatedAt = Date.now();
    return true;
  }

  addTaskStep(taskId: string, step: Omit<TaskStep, 'timestamp'>): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.steps.push({ ...step, timestamp: Date.now() });
    task.updatedAt = Date.now();
    return true;
  }

  getTask(taskId: string): TaskMemory | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): TaskMemory[] {
    return Array.from(this.tasks.values());
  }

  getActiveTasks(): TaskMemory[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'in_progress');
  }

  completeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = 'completed';
    task.updatedAt = Date.now();
    return true;
  }

  deleteTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }
}

export class LongTermMemory {
  private memories: Map<string, MemoryItem> = new Map();
  private maxMemories: number;

  constructor(maxMemories: number = 1000) {
    this.maxMemories = maxMemories;
  }

  addMemory(content: string, type: MemoryItem['type'], metadata: Omit<MemoryMetadata, 'tags'> & { tags?: string[] }): MemoryItem {
    const memory: MemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      metadata: {
        tags: metadata.tags || [],
        confidence: metadata.confidence,
        source: metadata.source,
        context: metadata.context,
        expiresAt: metadata.expiresAt
      },
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      importance: this.calculateImportance(content, type)
    };

    if (this.memories.size >= this.maxMemories) {
      this.evictLeastImportant();
    }

    this.memories.set(memory.id, memory);
    return memory;
  }

  private calculateImportance(content: string, type: MemoryItem['type']): number {
    let score = 0.5;
    
    const typeBonus: Record<MemoryItem['type'], number> = {
      fact: 0.1,
      event: 0.05,
      task: 0.2,
      knowledge: 0.15,
      preference: 0.1
    };
    
    score += typeBonus[type] || 0;
    score += Math.min(content.length / 100, 0.2);
    
    return Math.min(1, Math.max(0, score));
  }

  private evictLeastImportant(): void {
    const sorted = Array.from(this.memories.values())
      .sort((a, b) => {
        const now = Date.now();
        const aScore = a.importance - (now - a.lastAccessedAt) / (24 * 60 * 60 * 1000);
        const bScore = b.importance - (now - b.lastAccessedAt) / (24 * 60 * 60 * 1000);
        return aScore - bScore;
      });
    
    if (sorted.length > 0) {
      this.memories.delete(sorted[0].id);
    }
  }

  retrieve(query: string, options: {
    maxResults?: number;
    types?: MemoryItem['type'][];
    tags?: string[];
  } = {}): MemoryItem[] {
    const { maxResults = 10, types, tags } = options;
    
    let results = Array.from(this.memories.values())
      .filter(memory => {
        if (types && !types.includes(memory.type)) return false;
        if (tags && !tags.some(tag => memory.metadata.tags.includes(tag))) return false;
        
        const lowerContent = memory.content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        return lowerContent.includes(lowerQuery);
      })
      .map(memory => ({
        ...memory,
        lastAccessedAt: Date.now()
      }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxResults);

    results.forEach(m => {
      const stored = this.memories.get(m.id);
      if (stored) stored.lastAccessedAt = Date.now();
    });

    return results;
  }

  updateMemory(id: string, updates: Partial<Pick<MemoryItem, 'content' | 'importance'>> & { tags?: string[] }): boolean {
    const memory = this.memories.get(id);
    if (!memory) return false;
    
    if (updates.content !== undefined) memory.content = updates.content;
    if (updates.importance !== undefined) memory.importance = updates.importance;
    if (updates.tags !== undefined) memory.metadata.tags = updates.tags;
    memory.lastAccessedAt = Date.now();
    
    return true;
  }

  deleteMemory(id: string): boolean {
    return this.memories.delete(id);
  }

  getAllMemories(): MemoryItem[] {
    return Array.from(this.memories.values());
  }

  getMemoriesByType(type: MemoryItem['type']): MemoryItem[] {
    return Array.from(this.memories.values())
      .filter(m => m.type === type);
  }

  getStats(): {
    totalMemories: number;
    byType: Record<MemoryItem['type'], number>;
    avgImportance: number;
  } {
    return this._computeStats(this.getAllMemories());
  }

  getStatsForUser(userId: string): {
    totalMemories: number;
    byType: Record<MemoryItem['type'], number>;
    avgImportance: number;
  } {
    const userMemories = this.getAllMemories().filter(m => m.metadata?.userId === userId);
    return this._computeStats(userMemories);
  }

  private _computeStats(memories: MemoryItem[]): {
    totalMemories: number;
    byType: Record<MemoryItem['type'], number>;
    avgImportance: number;
  } {
    const byType: Record<MemoryItem['type'], number> = {
      fact: 0, event: 0, task: 0, knowledge: 0, preference: 0
    };
    
    memories.forEach(m => byType[m.type]++);
    
    return {
      totalMemories: memories.length,
      byType,
      avgImportance: memories.length > 0 
        ? memories.reduce((acc, m) => acc + m.importance, 0) / memories.length 
        : 0
    };
  }
}

export class MemorySystem {
  private shortTerm: ShortTermMemory;
  private mediumTerm: MediumTermMemory;
  private longTerm: LongTermMemory;

  constructor(sessionId: string) {
    this.shortTerm = new ShortTermMemory(sessionId);
    this.mediumTerm = new MediumTermMemory();
    this.longTerm = new LongTermMemory();
  }

  addMessage(message: ChatMessage): void {
    this.shortTerm.addMessage(message);
  }

  getContext(): string {
    return this.shortTerm.getContext();
  }

  createTask(taskId: string, goal: string): TaskMemory {
    return this.mediumTerm.createTask(taskId, goal);
  }

  updateTask(taskId: string, updates: Partial<TaskMemory>): boolean {
    return this.mediumTerm.updateTask(taskId, updates);
  }

  addTaskStep(taskId: string, step: Omit<TaskStep, 'timestamp'>): boolean {
    return this.mediumTerm.addTaskStep(taskId, step);
  }

  getTask(taskId: string): TaskMemory | undefined {
    return this.mediumTerm.getTask(taskId);
  }

  completeTask(taskId: string): boolean {
    const completed = this.mediumTerm.completeTask(taskId);
    if (completed) {
      const task = this.mediumTerm.getTask(taskId);
      if (task) {
        this.longTerm.addMemory(
          `Task completed: ${task.goal}`,
          'task',
          {
            confidence: 1,
            tags: ['completed', 'task']
          }
        );
      }
    }
    return completed;
  }

  addLongTermMemory(content: string, type: MemoryItem['type'], metadata: Omit<MemoryMetadata, 'tags'> & { tags?: string[] }): MemoryItem {
    return this.longTerm.addMemory(content, type, metadata);
  }

  addMemory(content: string, type: MemoryItem['type'], metadata: Omit<MemoryMetadata, 'tags'> & { tags?: string[] } = { confidence: 1, tags: [] }): MemoryItem {
    return this.addLongTermMemory(content, type, metadata);
  }

  retrieveMemories(query: string, options?: Parameters<LongTermMemory['retrieve']>[1]): MemoryItem[] {
    return this.longTerm.retrieve(query, options);
  }

  getSessionId(): string {
    return this.shortTerm.getSessionId();
  }

  getStats(): {
    shortTermMessages: number;
    mediumTermTasks: number;
    longTermMemories: number;
    longTermStats: ReturnType<LongTermMemory['getStats']>;
  } {
    return {
      shortTermMessages: this.shortTerm.getMessageCount(),
      mediumTermTasks: this.mediumTerm.getAllTasks().length,
      longTermMemories: this.longTerm.getAllMemories().length,
      longTermStats: this.longTerm.getStats()
    };
  }

  getStatsForUser(userId: string): {
    shortTermMessages: number;
    mediumTermTasks: number;
    longTermMemories: number;
    longTermStats: ReturnType<LongTermMemory['getStats']>;
  } {
    const longTermUserMemories = this.longTerm.getAllMemories()
      .filter(m => m.metadata?.userId === userId);
    return {
      shortTermMessages: this.shortTerm.getMessageCount(),
      mediumTermTasks: this.mediumTerm.getAllTasks().length,
      longTermMemories: longTermUserMemories.length,
      longTermStats: this.longTerm.getStatsForUser(userId)
    };
  }

  consolidateForUser(_userId: string): void {
    // 按用户合并短期/长期记忆（当前为占位，后续可接入 background job）
  }

  clearShortTerm(): void {
    this.shortTerm.clear();
  }

  clearAll(): void {
    this.shortTerm.clear();
    // Medium and long term memories are kept intentionally
  }
}