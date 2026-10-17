import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionManager } from '../core/agent-core/SessionManager';
import { MemorySystem } from '../core/memory/MemorySystem';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockMemorySystem: MemorySystem;

  beforeEach(() => {
    mockMemorySystem = {
      addMemory: jest.fn(),
      addLongTermMemory: jest.fn(),
      retrieveMemories: jest.fn().mockReturnValue([]),
      searchMemory: jest.fn().mockReturnValue([]),
      consolidateMemory: jest.fn(),
      getMemoryStats: jest.fn().mockReturnValue({ total: 0 })
    } as unknown as MemorySystem;

    sessionManager = new SessionManager(mockMemorySystem);
  });

  describe('ensureSession', () => {
    it('应为新用户创建会话', () => {
      const session = sessionManager.ensureSession('user1');
      expect(session).toBeDefined();
      expect(session.userId).toBe('user1');
      expect(session.isActive).toBe(true);
      expect(session.turns).toEqual([]);
    });

    it('同用户多次调用返回同一会话', () => {
      const session1 = sessionManager.ensureSession('user1');
      const session2 = sessionManager.ensureSession('user1');
      expect(session1.id).toBe(session2.id);
    });

    it('应接受偏好设置', () => {
      const session = sessionManager.ensureSession('user1', {
        language: 'en',
        communicationStyle: 'formal'
      });
      expect(session.userProfile.language).toBe('en');
      expect(session.userProfile.interactionStyle).toBe('formal');
    });
  });

  describe('recordTurn', () => {
    it('应记录对话轮次', () => {
      sessionManager.ensureSession('user1');
      sessionManager.recordTurn('user1', '你好', '你好！有什么可以帮助你的？', 'greeting');

      const session = sessionManager.getSession('user1');
      expect(session?.turns.length).toBe(1);
      expect(session?.turnCount).toBe(1);
    });

    it('应更新上下文窗口', () => {
      sessionManager.ensureSession('user1');
      for (let i = 0; i < 15; i++) {
        sessionManager.recordTurn('user1', `问题${i}`, `回答${i}`, 'general');
      }
      const session = sessionManager.getSession('user1');
      // 上下文窗口应限制在 maxContextTurns (10)
      expect(session?.contextWindow.length).toBeLessThanOrEqual(10);
    });
  });

  describe('finalizeSession', () => {
    it('应结束会话并保存到长期记忆', () => {
      sessionManager.ensureSession('user1');
      sessionManager.recordTurn('user1', '搜索AI', 'AI是人工智能的缩写', 'search');
      sessionManager.recordTurn('user1', '什么是机器学习', '机器学习是AI的一个分支', 'question');
      sessionManager.recordTurn('user1', '谢谢', '不客气！', 'thanks');

      const summary = sessionManager.finalizeSession('user1');
      expect(summary).not.toBeNull();
      expect(summary!.turnCount).toBe(3);
      // 实现：>2 轮的会话才把摘要写入长期记忆（addLongTermMemory）
      expect(mockMemorySystem.addLongTermMemory).toHaveBeenCalled();
    });

    it('少于3轮的会话也应正确结束', () => {
      sessionManager.ensureSession('user2');
      const summary = sessionManager.finalizeSession('user2');
      expect(summary).not.toBeNull();
      expect(summary!.turnCount).toBe(0);
    });

    it('不存在的用户返回null', () => {
      const summary = sessionManager.finalizeSession('nonexistent');
      expect(summary).toBeNull();
    });
  });

  describe('getSessionSummary', () => {
    it('活跃会话应返回实时摘要', () => {
      sessionManager.ensureSession('user1');
      sessionManager.recordTurn('user1', '问题', '回答');
      const summary = sessionManager.getSessionSummary('user1');
      expect(summary).not.toBeNull();
      expect(summary!.mainTopics).toBeDefined();
    });
  });

  describe('getActiveSessionInfo', () => {
    it('应返回活跃会话信息', () => {
      sessionManager.ensureSession('user1');
      sessionManager.recordTurn('user1', '测试', '回复');
      const info = sessionManager.getActiveSessionInfo('user1');
      expect(info).not.toBeNull();
      expect(info!.turnCount).toBe(1);
    });

    it('非活跃会话返回null', () => {
      const info = sessionManager.getActiveSessionInfo('unknown');
      expect(info).toBeNull();
    });
  });

  describe('getActiveUsers', () => {
    it('应列出所有活跃用户', () => {
      sessionManager.ensureSession('user1');
      sessionManager.ensureSession('user2');
      const users = sessionManager.getActiveUsers();
      expect(users).toContain('user1');
      expect(users).toContain('user2');
    });
  });

  describe('endCurrentSession', () => {
    it('应结束当前会话', () => {
      sessionManager.ensureSession('user1');
      const ended = sessionManager.endCurrentSession('user1');
      expect(ended).toBe(true);
    });
  });

  describe('getDialogueState', () => {
    it('新用户应有默认状态', () => {
      const state = sessionManager.getDialogueState('new_user');
      expect(state.currentPhase).toBe('greeting');
      expect(state.topicContinuity).toBe(0);
    });

    it('recordTurn 后更新状态', () => {
      sessionManager.ensureSession('user1');
      // 用有主题的输入（'你好' 这类 greeting 不含主题关键词，lastTopic 本就为 undefined）
      sessionManager.recordTurn('user1', '搜索AI', 'AI是人工智能的缩写', 'search');
      const state = sessionManager.getDialogueState('user1');
      expect(state.lastTopic).toBeDefined();
    });
  });

  describe('updateUserPreferences', () => {
    it('应更新用户偏好', () => {
      const prefs = sessionManager.updateUserPreferences('user1', '帮我写代码', '好的', 'positive');
      expect(prefs.interactionCount).toBe(1);
    });

    it('应检测语言', () => {
      const prefs = sessionManager.updateUserPreferences('user1', 'こんにちは', 'はい');
      expect(prefs.language).toBe('ja');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('应清理过期会话', () => {
      sessionManager.ensureSession('user1');
      const cleaned = sessionManager.cleanupExpiredSessions();
      // 新创建的会话不应被清理
      expect(cleaned).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应返回统计信息', () => {
      sessionManager.ensureSession('user1');
      const stats = sessionManager.getStats();
      expect(stats.activeSessions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getTopicKeywords', () => {
    it('应返回话题关键词映射', () => {
      const keywords = sessionManager.getTopicKeywords();
      expect(keywords).toBeInstanceOf(Map);
      expect(keywords.has('technology')).toBe(true);
    });
  });
});
