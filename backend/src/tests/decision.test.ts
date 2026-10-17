import { describe, it, expect, beforeEach } from '@jest/globals';
import { DecisionEngine } from '../core/decision/DecisionEngine';

describe('DecisionEngine', () => {
  let decisionEngine: DecisionEngine;

  beforeEach(() => {
    decisionEngine = new DecisionEngine();
  });

  describe('decomposeTask', () => {
    it('should decompose search task', () => {
      const task = decisionEngine.decomposeTask('搜索天气', 'user1');
      expect(task.description).toBe('搜索天气');
      expect(task.subtasks.length).toBeGreaterThan(0);
    });

    it('should decompose calculate task', () => {
      const task = decisionEngine.decomposeTask('计算数学题', 'user1');
      // complexity=5 → score=1.30，当前启发式判定为 medium（与复杂任务 high 区分明确）
      expect(task.priority).toBe('medium');
    });

    it('should set task priority based on complexity', () => {
      const task = decisionEngine.decomposeTask('搜索信息并总结', 'user1');
      expect(['low', 'medium', 'high']).toContain(task.priority);
    });
  });

  describe('prioritizeSubtasks', () => {
    it('should prioritize subtasks with tools', () => {
      const task = decisionEngine.decomposeTask('搜索并计算', 'user1');
      const prioritized = decisionEngine.prioritizeSubtasks(task.subtasks);
      expect(prioritized.length).toBe(task.subtasks.length);
    });
  });

  describe('planExecution', () => {
    it('should generate tool calls for tasks', () => {
      const task = decisionEngine.decomposeTask('搜索天气', 'user1');
      const plan = decisionEngine.planExecution(task);
      expect(Array.isArray(plan)).toBe(true);
    });
  });

  describe('updatePlan', () => {
    it('should update task status based on results', () => {
      const task = decisionEngine.decomposeTask('简单任务', 'user1');
      const results = new Map<string, unknown>();
      task.subtasks.forEach(subtask => {
        results.set(subtask.id, 'done');
      });
      const updated = decisionEngine.updatePlan(task, results);
      expect(updated.status).toBe('completed');
    });
  });
});