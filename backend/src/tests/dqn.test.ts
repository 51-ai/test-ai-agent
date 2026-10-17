import { describe, it, expect, beforeEach } from '@jest/globals';
import { DQNAgent, defaultDQNConfig } from '../core/rl/DQNAgent';

describe('DQNAgent', () => {
  let dqnAgent: DQNAgent;

  beforeEach(() => {
    dqnAgent = new DQNAgent();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(dqnAgent.getEpsilon()).toBe(defaultDQNConfig.epsilonStart);
    });

    it('should initialize with custom config', () => {
      const customConfig = { epsilonStart: 0.5 };
      const customAgent = new DQNAgent(customConfig);
      expect(customAgent.getEpsilon()).toBe(0.5);
    });
  });

  describe('Action Selection', () => {
    it('should return a valid action', () => {
      const state = {
        userId: 'test-user',
        currentInput: 'Hello',
        conversationHistory: [],
        availableTools: [],
        timeOfDay: Date.now(),
        conversationTurns: 0,
        inputComplexity: 0.5
      };
      
      const action = dqnAgent.getAction(state);
      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
    });
  });

  describe('Experience Handling', () => {
    it('should store experience and update stats', () => {
      const experience = {
        state: {
          userId: 'test-user',
          currentInput: 'Test',
          conversationHistory: [],
          availableTools: [],
          timeOfDay: Date.now(),
          conversationTurns: 0,
          inputComplexity: 0.5
        },
        action: { type: 'respond' as const, confidence: 0.8 },
        reward: 1,
        nextState: {
          userId: 'test-user',
          currentInput: 'Next',
          conversationHistory: [],
          availableTools: [],
          timeOfDay: Date.now(),
          conversationTurns: 1,
          inputComplexity: 0.5
        },
        done: true,
        timestamp: new Date()
      };
      
      dqnAgent.storeExperience(experience);
      const stats = dqnAgent.getTrainingStats();
      expect(stats.totalExperiences).toBe(1);
    });
  });

  describe('Success Rate', () => {
    it('should update success rate', () => {
      dqnAgent.updateSuccessRate(true);
      dqnAgent.updateSuccessRate(true);
      dqnAgent.updateSuccessRate(false);
      
      const stats = dqnAgent.getTrainingStats();
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.successRate).toBeLessThan(1);
    });
  });

  describe('Configuration', () => {
    it('should update config', () => {
      dqnAgent.updateConfig({ learningRate: 0.002 });
      expect(dqnAgent.getCurrentConfig().learningRate).toBe(0.002);
    });

    it('should export and import Q-table', () => {
      const initialExport = dqnAgent.exportQTable();
      dqnAgent.importQTable(initialExport);
      const newExport = dqnAgent.exportQTable();
      expect(newExport).toBe(initialExport);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      dqnAgent.updateSuccessRate(true);
      dqnAgent.reset();
      
      const stats = dqnAgent.getTrainingStats();
      expect(stats.totalExperiences).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });
});
