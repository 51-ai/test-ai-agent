/**
 * 审计日志模块单元测试
 */

import { AuditLogger, LogLevel, AuditCategory } from '../core/audit';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger({
      maxEntries: 1000,
      maxAge: 3600000,
      level: LogLevel.DEBUG
    });
  });

  describe('log()', () => {
    it('should log an entry', () => {
      logger.log({
        id: 'test-id',
        timestamp: Date.now(),
        level: LogLevel.INFO,
        category: AuditCategory.AUTHENTICATION,
        message: 'Test message',
        action: 'test_action',
        result: 'success'
      });

      expect(logger.getCount()).toBe(1);
    });

    it('should filter entries by log level', () => {
      logger.setLevel(LogLevel.WARN);
      
      logger.info(AuditCategory.AUTHENTICATION, 'info_action', 'Info message');
      logger.warn(AuditCategory.AUTHENTICATION, 'warn_action', 'Warn message');
      logger.error(AuditCategory.AUTHENTICATION, 'error_action', 'Error message');

      expect(logger.getCount()).toBe(2); // Only WARN and ERROR
    });
  });

  describe('log levels', () => {
    it('should log debug message', () => {
      logger.debug(AuditCategory.SYSTEM_CONFIG, 'debug_action', 'Debug message');
      expect(logger.getCount()).toBe(1);
    });

    it('should log info message', () => {
      logger.info(AuditCategory.SYSTEM_CONFIG, 'info_action', 'Info message');
      expect(logger.getCount()).toBe(1);
    });

    it('should log warning message', () => {
      logger.warn(AuditCategory.SYSTEM_CONFIG, 'warn_action', 'Warn message');
      expect(logger.getCount()).toBe(1);
    });

    it('should log error message', () => {
      logger.error(AuditCategory.SYSTEM_CONFIG, 'error_action', 'Error message');
      expect(logger.getCount()).toBe(1);
    });

    it('should log critical message', () => {
      logger.critical(AuditCategory.SYSTEM_CONFIG, 'critical_action', 'Critical message');
      expect(logger.getCount()).toBe(1);
    });
  });

  describe('logAuth()', () => {
    it('should log authentication events', () => {
      logger.logAuth('login', 'user123', 'testuser', 'success');
      expect(logger.getCount()).toBe(1);
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.AUTHENTICATION);
      expect(entry.userId).toBe('user123');
      expect(entry.userName).toBe('testuser');
      expect(entry.result).toBe('success');
    });

    it('should log failed login', () => {
      logger.logAuth('login', 'user123', 'testuser', 'failure');
      const entry = logger.getRecent(1)[0];
      expect(entry.result).toBe('failure');
    });
  });

  describe('logAuthz()', () => {
    it('should log authorization events', () => {
      logger.logAuthz(
        'access_granted',
        'user123',
        { type: 'document', id: 'doc-1' },
        'success'
      );
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.AUTHORIZATION);
      expect(entry.resource?.type).toBe('document');
      expect(entry.resource?.id).toBe('doc-1');
    });

    it('should log access denied', () => {
      logger.logAuthz(
        'access_denied',
        'user123',
        { type: 'document', id: 'doc-1' },
        'failure'
      );
      
      const entry = logger.getRecent(1)[0];
      expect(entry.result).toBe('failure');
    });
  });

  describe('logDataAccess()', () => {
    it('should log data access events', () => {
      logger.logDataAccess('read', 'user123', { type: 'file', id: 'file-1' });
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.DATA_ACCESS);
      expect(entry.action).toBe('read');
    });
  });

  describe('logDataModification()', () => {
    it('should log data modification events', () => {
      logger.logDataModification('create', 'user123', { type: 'file', id: 'file-1' });
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.DATA_MODIFICATION);
      expect(entry.action).toBe('create');
    });
  });

  describe('logApiRequest()', () => {
    it('should log successful API request', () => {
      logger.logApiRequest('GET', '/api/users', 'user123', 100, 200);
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.API_REQUEST);
      expect(entry.action).toBe('GET /api/users');
      expect(entry.result).toBe('success');
      expect(entry.duration).toBe(100);
    });

    it('should log failed API request as warning', () => {
      logger.setLevel(LogLevel.WARN);
      logger.logApiRequest('POST', '/api/users', 'user123', 50, 400);
      
      const entry = logger.getRecent(1)[0];
      expect(entry.result).toBe('failure');
    });
  });

  describe('logSecurityEvent()', () => {
    it('should log security events', () => {
      logger.logSecurityEvent('intrusion_attempt', '192.168.1.1');
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.SECURITY);
      expect(entry.ipAddress).toBe('192.168.1.1');
    });
  });

  describe('logRLTraining()', () => {
    it('should log RL training metrics', () => {
      logger.logRLTraining(100, { reward: 0.95, loss: 0.05, klDivergence: 0.01 });
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.RL_TRAINING);
      expect(entry.metadata?.reward).toBe(0.95);
    });
  });

  describe('logRAGOperation()', () => {
    it('should log RAG operations', () => {
      logger.logRAGOperation('query', 'test query', 5, 100);
      
      const entry = logger.getRecent(1)[0];
      expect(entry.category).toBe(AuditCategory.RAG_OPERATIONS);
      expect(entry.metadata?.results).toBe(5);
      expect(entry.metadata?.latency).toBe(100);
    });
  });

  describe('query()', () => {
    beforeEach(() => {
      // Create test entries
      logger.info(AuditCategory.AUTHENTICATION, 'login', 'Login 1', { userId: 'user1' });
      logger.info(AuditCategory.AUTHENTICATION, 'login', 'Login 2', { userId: 'user2' });
      logger.warn(AuditCategory.AUTHENTICATION, 'login', 'Login 3', { userId: 'user1' });
      logger.info(AuditCategory.DATA_ACCESS, 'read', 'Read 1', { userId: 'user1' });
    });

    it('should query by userId', () => {
      const results = logger.query({ userId: 'user1' });
      expect(results.length).toBe(3);
    });

    it('should query by category', () => {
      const results = logger.query({ categories: [AuditCategory.AUTHENTICATION] });
      expect(results.length).toBe(3);
    });

    it('should query by action', () => {
      const results = logger.query({ action: 'login' });
      expect(results.length).toBe(3);
    });

    it('should query by result', () => {
      const results = logger.query({ result: 'failure' });
      // Add a failure entry
      logger.error(AuditCategory.AUTHENTICATION, 'login', 'Failed login', { result: 'failure' });
      const failureResults = logger.query({ result: 'failure' });
      expect(failureResults.length).toBeGreaterThan(0);
    });

    it('should query by time range', () => {
      const now = Date.now();
      const results = logger.query({ startTime: now - 1000, endTime: now + 1000 });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by text', () => {
      const results = logger.query({ searchText: 'Login 1' });
      expect(results.length).toBe(1);
    });

    it('should apply pagination', () => {
      const results = logger.query({ limit: 2, offset: 0 });
      expect(results.length).toBe(2);
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      logger.info(AuditCategory.AUTHENTICATION, 'action1', 'Message 1');
      logger.warn(AuditCategory.AUTHENTICATION, 'action2', 'Message 2');
      logger.error(AuditCategory.DATA_ACCESS, 'action3', 'Message 3');

      const stats = logger.getStats();
      
      expect(stats.totalEntries).toBe(3);
      expect(stats.byLevel[LogLevel.INFO]).toBe(1);
      expect(stats.byLevel[LogLevel.WARN]).toBe(1);
      expect(stats.byLevel[LogLevel.ERROR]).toBe(1);
      expect(stats.byCategory[AuditCategory.AUTHENTICATION]).toBe(2);
      expect(stats.byCategory[AuditCategory.DATA_ACCESS]).toBe(1);
    });
  });

  describe('getRecent()', () => {
    it('should return recent entries', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(AuditCategory.SYSTEM_CONFIG, `action${i}`, `Message ${i}`);
      }

      const recent = logger.getRecent(5);
      expect(recent.length).toBe(5);
    });
  });

  describe('subscribe()', () => {
    it('should receive all new entries', (done) => {
      logger.subscribe((entry: any) => {
        expect(entry.action).toBe('test_action');
        done();
      });

      logger.info(AuditCategory.SYSTEM_CONFIG, 'test_action', 'Test message');
    });

    it('should receive entries by level', (done) => {
      logger.subscribeToLevel(LogLevel.ERROR, (entry: any) => {
        expect(entry.level).toBe(LogLevel.ERROR);
        done();
      });

      logger.error(AuditCategory.SYSTEM_CONFIG, 'error_action', 'Error message');
    });

    it('should receive failure entries', (done) => {
      logger.subscribeToFailures((entry: any) => {
        expect(entry.result).toBe('failure');
        done();
      });

      logger.error(AuditCategory.AUTHENTICATION, 'login', 'Failed login', { result: 'failure' });
    });

    it('should return unsubscribe function', () => {
      let callCount = 0;
      const unsubscribe = logger.subscribe(() => callCount++);
      unsubscribe();
      
      logger.info(AuditCategory.SYSTEM_CONFIG, 'action', 'Message');
      expect(callCount).toBe(0);
    });
  });

  describe('export()', () => {
    it('should export as JSON', () => {
      logger.info(AuditCategory.SYSTEM_CONFIG, 'action', 'Test message');
      logger.info(AuditCategory.SYSTEM_CONFIG, 'action2', 'Test message 2');

      const json = logger.export('json');
      const parsed = JSON.parse(json);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should export as CSV', () => {
      logger.info(AuditCategory.SYSTEM_CONFIG, 'action', 'Test message');

      const csv = logger.export('csv');
      
      expect(csv).toContain('id');
      expect(csv).toContain('timestamp');
      expect(csv).toContain('Test message');
    });

    it('should filter exported entries', () => {
      logger.info(AuditCategory.AUTHENTICATION, 'login', 'Login message');
      logger.info(AuditCategory.DATA_ACCESS, 'read', 'Read message');

      const json = logger.export('json', { categories: [AuditCategory.AUTHENTICATION] });
      const parsed = JSON.parse(json);
      
      expect(parsed.length).toBe(1);
      expect(parsed[0].category).toBe(AuditCategory.AUTHENTICATION);
    });
  });

  describe('clear()', () => {
    it('should clear all logs', () => {
      logger.info(AuditCategory.SYSTEM_CONFIG, 'action', 'Test message');
      logger.clear();
      expect(logger.getCount()).toBe(0);
    });
  });

  describe('import()', () => {
    it('should import new entries', () => {
      const entries = [
        {
          id: 'import-1',
          timestamp: Date.now(),
          level: LogLevel.INFO,
          category: AuditCategory.SYSTEM_CONFIG,
          message: 'Imported 1',
          action: 'import',
          result: 'success' as const
        },
        {
          id: 'import-2',
          timestamp: Date.now(),
          level: LogLevel.INFO,
          category: AuditCategory.SYSTEM_CONFIG,
          message: 'Imported 2',
          action: 'import',
          result: 'success' as const
        }
      ];

      const imported = logger.import(entries);
      expect(imported).toBe(2);
    });

    it('should not duplicate existing entries', () => {
      const entries = [
        {
          id: 'test-id',
          timestamp: Date.now(),
          level: LogLevel.INFO,
          category: AuditCategory.SYSTEM_CONFIG,
          message: 'Duplicate',
          action: 'duplicate',
          result: 'success' as const
        }
      ];

      // First import should add the entry
      const imported1 = logger.import(entries);
      expect(imported1).toBe(1);

      // Second import with same ID should not add
      const imported2 = logger.import(entries);
      expect(imported2).toBe(0);
    });
  });
});
