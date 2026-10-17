import { describe, it, expect, beforeEach } from '@jest/globals';
import { ScenarioGenerator } from '../core/simulation/ScenarioGenerator';
import { ScenarioCategory } from '../core/simulation/types';

describe('ScenarioGenerator', () => {
  let scenarioGenerator: ScenarioGenerator;

  beforeEach(() => {
    scenarioGenerator = new ScenarioGenerator();
  });

  describe('Scenario Generation', () => {
    it('should generate random scenario', () => {
      const scenario = scenarioGenerator.generateRandomScenario();
      expect(scenario).toBeDefined();
      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBeDefined();
      expect(scenario.difficulty).toBeGreaterThan(0);
    });

    it('should generate scenario for specific category', () => {
      const category: ScenarioCategory = 'question_answering';
      const scenario = scenarioGenerator.generateRandomScenario(category);
      expect(scenario.category).toBe(category);
    });

    it('should generate multiple scenarios for category', () => {
      const category: ScenarioCategory = 'conversation';
      const scenarios = scenarioGenerator.generateScenariosForCategory(category, 3);
      expect(scenarios.length).toBe(3);
      expect(scenarios.every(s => s.category === category)).toBe(true);
    });

    it('should generate progressive scenarios with increasing difficulty', () => {
      const category: ScenarioCategory = 'technical';
      const scenarios = scenarioGenerator.generateProgressiveScenarios(category, 5);
      expect(scenarios.length).toBe(5);
    });
  });

  describe('User Profiles', () => {
    it('should get random user profile', () => {
      const user = scenarioGenerator.getRandomUserProfile();
      expect(user).toBeDefined();
      expect(user.profile).toBeDefined();
      expect(user.profile.personality).toBeDefined();
    });

    it('should get all user profiles', () => {
      const users = scenarioGenerator.getAllUserProfiles();
      expect(users.length).toBeGreaterThan(0);
    });
  });

  describe('Categories', () => {
    it('should get all categories', () => {
      const categories = scenarioGenerator.getAllCategories();
      expect(categories).toContain('conversation');
      expect(categories).toContain('question_answering');
      expect(categories).toContain('tool_usage');
      expect(categories).toContain('conflict_resolution');
      expect(categories).toContain('emotional_support');
      expect(categories).toContain('learning_assistance');
      expect(categories).toContain('task_planning');
    });
  });

  describe('Training Dataset Generation', () => {
    it('should generate training dataset', () => {
      const dataset = scenarioGenerator.generateTrainingDataset({
        scenariosPerCategory: 2,
        difficultyLevels: [1, 2, 3],
        userProfiles: true
      });
      
      expect(dataset.scenarios.length).toBeGreaterThan(0);
      expect(dataset.users.length).toBeGreaterThan(0);
    });
  });

  describe('New Scenario Categories', () => {
    it('should generate conflict resolution scenarios', () => {
      const scenario = scenarioGenerator.generateRandomScenario('conflict_resolution');
      expect(scenario.category).toBe('conflict_resolution');
      expect(scenario.objectives.length).toBeGreaterThan(0);
    });

    it('should generate emotional support scenarios', () => {
      const scenario = scenarioGenerator.generateRandomScenario('emotional_support');
      expect(scenario.category).toBe('emotional_support');
    });

    it('should generate learning assistance scenarios', () => {
      const scenario = scenarioGenerator.generateRandomScenario('learning_assistance');
      expect(scenario.category).toBe('learning_assistance');
    });

    it('should generate task planning scenarios', () => {
      const scenario = scenarioGenerator.generateRandomScenario('task_planning');
      expect(scenario.category).toBe('task_planning');
    });
  });
});
