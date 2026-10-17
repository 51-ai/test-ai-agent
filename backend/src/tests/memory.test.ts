import { describe, it, expect, beforeEach } from '@jest/globals';
import { MemorySystem } from '../core/memory/MemorySystem';

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;

  beforeEach(() => {
    memorySystem = new MemorySystem('test-session');
  });

  describe('addLongTermMemory', () => {
    it('should add long term memory with fact type', () => {
      const memory = memorySystem.addLongTermMemory('test content', 'fact', {
        confidence: 0.9,
        tags: ['test']
      });
      expect(memory.id).toBeDefined();
      expect(memory.type).toBe('fact');
    });

    it('should add long term memory with event type', () => {
      const memory = memorySystem.addLongTermMemory('test event', 'event', {
        confidence: 1,
        tags: ['event']
      });
      expect(memory.type).toBe('event');
    });

    it('should add long term memory with knowledge type', () => {
      const memory = memorySystem.addLongTermMemory('test knowledge', 'knowledge', {
        confidence: 0.8,
        tags: ['knowledge']
      });
      expect(memory.type).toBe('knowledge');
    });
  });

  describe('retrieveMemories', () => {
    it('should retrieve memory by query', () => {
      memorySystem.addLongTermMemory('hello world', 'fact', {
        confidence: 1,
        tags: ['test']
      });
      const memories = memorySystem.retrieveMemories('hello');
      expect(memories.length).toBeGreaterThan(0);
    });

    it('should filter by type', () => {
      memorySystem.addLongTermMemory('hello fact', 'fact', {
        confidence: 1,
        tags: ['test']
      });
      memorySystem.addLongTermMemory('hello event', 'event', {
        confidence: 1,
        tags: ['test']
      });
      
      const factMemories = memorySystem.retrieveMemories('hello', { types: ['fact'] });
      expect(factMemories.length).toBeGreaterThanOrEqual(1);
      expect(factMemories[0].type).toBe('fact');
    });
  });

  describe('getStats', () => {
    it('should return memory stats', () => {
      memorySystem.addLongTermMemory('content1', 'fact', {
        confidence: 1,
        tags: ['test']
      });
      memorySystem.addLongTermMemory('content2', 'event', {
        confidence: 1,
        tags: ['test']
      });
      
      const stats = memorySystem.getStats();
      expect(stats.longTermMemories).toBeGreaterThanOrEqual(2);
      expect(stats.shortTermMessages).toBe(0);
      expect(stats.mediumTermTasks).toBe(0);
    });
  });

  describe('addMessage', () => {
    it('should add message to short term memory', () => {
      memorySystem.addMessage({
        role: 'user',
        content: 'test message',
        timestamp: Date.now()
      });
      
      const stats = memorySystem.getStats();
      expect(stats.shortTermMessages).toBe(1);
    });
  });

  describe('createTask', () => {
    it('should create task in medium term memory', () => {
      const task = memorySystem.createTask('task-1', 'test goal');
      expect(task.taskId).toBe('task-1');
      expect(task.goal).toBe('test goal');
      expect(task.status).toBe('pending');
    });
  });

  describe('completeTask', () => {
    it('should complete task and add to long term memory', () => {
      memorySystem.createTask('task-2', 'test goal');
      const completed = memorySystem.completeTask('task-2');
      expect(completed).toBe(true);
      
      const task = memorySystem.getTask('task-2');
      expect(task?.status).toBe('completed');
    });
  });
});