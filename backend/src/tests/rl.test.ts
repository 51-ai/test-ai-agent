import { describe, it, expect } from '@jest/globals';
import { PPOAgent } from '../core/rl/PPOAgent';
import { RLModule } from '../core/rl/RLModule';

describe('RL Components', () => {
  describe('PPOAgent', () => {
    it('should create PPOAgent instance', () => {
      const agent = new PPOAgent();
      expect(agent).toBeDefined();
    });

    it('should get actions based on state', () => {
      const agent = new PPOAgent();
      const state = { 
        userId: 'test', 
        currentInput: 'hello world', 
        conversationHistory: [], 
        availableTools: [], 
        timeOfDay: Date.now(),
        conversationTurns: 1,
        inputComplexity: 0.5
      };
      
      const action = agent.getAction(state);
      expect(action).toBeDefined();
      expect(action.type).toBeDefined();
    });

    it('should get training stats', () => {
      const agent = new PPOAgent();
      const stats = agent.getTrainingStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalUpdates).toBeDefined();
      expect(stats.successRate).toBeDefined();
    });
  });

  describe('RLModule', () => {
    it('should create RLModule instance', () => {
      const module = new RLModule();
      expect(module).toBeDefined();
    });

    it('should select actions', () => {
      const module = new RLModule();
      const state = { 
        userId: 'test', 
        currentInput: 'test', 
        conversationHistory: [], 
        availableTools: [], 
        timeOfDay: Date.now(),
        conversationTurns: 1,
        inputComplexity: 0.5
      };
      
      const action = module.selectAction(state);
      expect(action).toBeDefined();
    });

    it('should record experiences', () => {
      const module = new RLModule();
      const state = { 
        userId: 'test', 
        currentInput: 'test', 
        conversationHistory: [], 
        availableTools: [], 
        timeOfDay: Date.now(),
        conversationTurns: 1,
        inputComplexity: 0.5
      };
      const action = { type: 'respond' as const, confidence: 0.8 };
      
      module.recordExperience(state, action, 1.0, state, true);
      
      const stats = module.getTrainingStats();
      expect(stats).toBeDefined();
    });

    it('should calculate rewards', () => {
      const module = new RLModule();
      const state = { 
        userId: 'test', 
        currentInput: 'test', 
        conversationHistory: [], 
        availableTools: [], 
        timeOfDay: Date.now(),
        conversationTurns: 1,
        inputComplexity: 0.5
      };
      const action = { type: 'respond' as const, confidence: 0.8 };
      
      const reward = module.calculateReward(state, action, state, true, { responseQuality: 0.8 });
      expect(typeof reward).toBe('number');
    });
  });

  describe('Integration Tests', () => {
    it('should run a full training cycle', () => {
      const rlModule = new RLModule();
      const state = { 
        userId: 'test', 
        currentInput: 'integration test', 
        conversationHistory: [], 
        availableTools: ['search', 'execute_code'], 
        timeOfDay: Date.now(),
        conversationTurns: 1,
        inputComplexity: 0.6
      };
      
      rlModule.startEpisode();
      
      for (let i = 0; i < 10; i++) {
        const action = rlModule.selectAction(state);
        const reward = i % 2 === 0 ? 1.0 : -0.5;
        rlModule.recordExperience(state, action, reward, state, i === 9);
      }
      
      rlModule.endEpisode(true);
      rlModule.train();
      
      const stats = rlModule.getTrainingStats();
      expect(stats).toBeDefined();
    });
  });
});
