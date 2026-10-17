import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScenarioGenerator } from '../core/simulation/ScenarioGenerator';
import { UserSimulator } from '../core/simulation/UserSimulator';
import { ScenarioEvaluator } from '../core/simulation/ScenarioEvaluator';
import { SimulationManager } from '../core/simulation/SimulationManager';
import { Agent } from '../core/Agent';

// 模拟器会跑完整 Agent 闭环（感知→决策→执行→反思），远超 jest 默认 5s
jest.setTimeout(180000);

describe('Simulation Module', () => {
  describe('ScenarioGenerator', () => {
    let generator: ScenarioGenerator;

    beforeEach(() => {
      generator = new ScenarioGenerator();
    });

    it('should create instance', () => {
      expect(generator).toBeDefined();
    });

    it('should generate random scenario', () => {
      const scenario = generator.generateRandomScenario();
      expect(scenario).toBeDefined();
      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBeDefined();
      expect(scenario.category).toBeDefined();
    });

    it('should generate scenarios for specific category', () => {
      const scenarios = generator.generateScenariosForCategory('conversation', 3);
      expect(scenarios).toHaveLength(3);
      scenarios.forEach(s => {
        expect(s.category).toBe('conversation');
      });
    });

    it('should generate progressive scenarios with increasing difficulty', () => {
      const scenarios = generator.generateProgressiveScenarios('question_answering', 5);
      expect(scenarios).toHaveLength(5);
      
      let lastDifficulty = 0;
      scenarios.forEach(s => {
        expect(s.difficulty).toBeGreaterThanOrEqual(lastDifficulty);
        lastDifficulty = s.difficulty;
      });
    });

    it('should get all categories', () => {
      const categories = generator.getAllCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('conversation');
      expect(categories).toContain('question_answering');
    });

    it('should get random user profile', () => {
      const user = generator.getRandomUserProfile();
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.profile).toBeDefined();
      expect(user.behavior).toBeDefined();
    });

    it('should get all user profiles', () => {
      const users = generator.getAllUserProfiles();
      expect(users.length).toBeGreaterThan(0);
    });
  });

  describe('UserSimulator', () => {
    let simulator: UserSimulator;
    let generator: ScenarioGenerator;

    beforeEach(() => {
      simulator = new UserSimulator();
      generator = new ScenarioGenerator();
    });

    it('should create instance', () => {
      expect(simulator).toBeDefined();
    });

    it('should generate initial message', () => {
      const scenario = generator.generateRandomScenario('conversation');
      const user = generator.getRandomUserProfile();
      const message = simulator.generateInitialMessage(scenario, user);
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should generate closing message', () => {
      const scenario = generator.generateRandomScenario();
      const user = generator.getRandomUserProfile();
      const message = simulator.generateClosingMessage(scenario, user);
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should simulate user response', () => {
      const scenario = generator.generateRandomScenario();
      const user = generator.getRandomUserProfile();
      const agentResponse = 'Hello, how can I help you?';
      
      const feedback = simulator.simulateUserMessage(user, scenario, agentResponse, 1);
      
      expect(feedback).toBeDefined();
      expect(feedback.message).toBeDefined();
      expect(typeof feedback.sentiment).toBe('number');
      expect(feedback.intent).toBeDefined();
    });

    it('should clear context', () => {
      const user = generator.getRandomUserProfile();
      simulator.simulateUserMessage(user, generator.generateRandomScenario(), 'test', 1);
      
      expect(() => simulator.clearContext(user.id)).not.toThrow();
    });
  });

  describe('ScenarioEvaluator', () => {
    let evaluator: ScenarioEvaluator;
    let generator: ScenarioGenerator;
    let simulator: UserSimulator;

    beforeEach(() => {
      evaluator = new ScenarioEvaluator('balanced');
      generator = new ScenarioGenerator();
      simulator = new UserSimulator();
    });

    it('should create instance', () => {
      expect(evaluator).toBeDefined();
    });

    it('should evaluate scenario', () => {
      const scenario = generator.generateRandomScenario();
      const user = generator.getRandomUserProfile();
      
      const conversation = {
        turns: [
          {
            turnNumber: 1,
            userMessage: 'Hello',
            agentResponse: 'Hi there! How can I help you?',
            timestamp: new Date(),
            reward: 0.8
          },
          {
            turnNumber: 2,
            userMessage: 'Thanks',
            agentResponse: 'You are welcome!',
            timestamp: new Date(),
            reward: 0.9
          }
        ],
        totalDuration: 5000,
        userProfile: user.profile
      };

      const result = evaluator.evaluateScenario(scenario, conversation);
      
      expect(result).toBeDefined();
      expect(result.scenarioId).toBe(scenario.id);
      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(result.metrics).toBeDefined();
      expect(result.feedback).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should evaluate with strict mode', () => {
      const strictEvaluator = new ScenarioEvaluator('strict');
      const scenario = generator.generateRandomScenario('question_answering');
      const user = generator.getRandomUserProfile();
      
      const conversation = {
        turns: [
          {
            turnNumber: 1,
            userMessage: 'What is AI?',
            agentResponse: 'AI stands for Artificial Intelligence.',
            timestamp: new Date(),
            reward: 0.7
          }
        ],
        totalDuration: 3000,
        userProfile: user.profile
      };

      const result = strictEvaluator.evaluateScenario(scenario, conversation);
      expect(result).toBeDefined();
    });
  });

  describe('SimulationManager', () => {
    let manager: SimulationManager;
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent();
      manager = new SimulationManager(agent);
    });

    it('should create instance', () => {
      expect(manager).toBeDefined();
    });

    it('should get scenario generator', () => {
      const generator = manager.getScenarioGenerator();
      expect(generator).toBeDefined();
    });

    it('should get user simulator', () => {
      const simulator = manager.getUserSimulator();
      expect(simulator).toBeDefined();
    });

    it('should get evaluator', () => {
      const evaluator = manager.getEvaluator();
      expect(evaluator).toBeDefined();
    });

    it('should generate report', async () => {
      const generator = manager.getScenarioGenerator();
      const scenarios = generator.generateScenariosForCategory('conversation', 2);
      const users = generator.getAllUserProfiles();

      const config = {
        numEpisodes: 2,
        scenarios,
        userProfiles: [users[0]],
        evaluationMode: 'balanced' as const,
        enableRealTimeFeedback: false,
        saveResults: false,
        parallelScenarios: 1
      };

      const result = await manager.runSimulation(config);
      const report = manager.generateReport(result);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      // 报告标题做了居中排版（汉字间有空白），断言前先做空白归一
      expect(report.replace(/\s+/g, '')).toContain('模拟场景测试报告');
      expect(report).toContain('总体评分');
      expect(report).toContain('成功率');
    });
  });

  describe('Integration Tests', () => {
    it('should run complete simulation workflow', async () => {
      const agent = new Agent();
      const manager = new SimulationManager(agent);
      const generator = manager.getScenarioGenerator();

      const scenarios = generator.generateScenariosForCategory('question_answering', 3);
      const users = generator.getAllUserProfiles().slice(0, 2);

      const config = {
        numEpisodes: 3,
        scenarios,
        userProfiles: users,
        evaluationMode: 'balanced' as const,
        enableRealTimeFeedback: false,
        saveResults: true,
        parallelScenarios: 1
      };

      const result = await manager.runSimulation(config);
      
      expect(result).toBeDefined();
      expect(result.scenarioResults).toHaveLength(3);
      expect(result.overallScore).toBeDefined();
      expect(result.successRate).toBeDefined();
      expect(result.aggregatedMetrics).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle curriculum training', async () => {
      const agent = new Agent();
      const manager = new SimulationManager(agent);

      // 每级 1 个回合即可覆盖课程训练逻辑（默认 5 会跑 15 次完整 Agent 闭环，耗时 5 分钟+）
      const results = await manager.runCurriculumTraining('conversation', [1, 2, 3], 1);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });
  });
});
