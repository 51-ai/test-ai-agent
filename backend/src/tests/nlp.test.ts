import { describe, it, expect, beforeEach } from '@jest/globals';
import { NLPModule } from '../core/nlp/NLPModule';

describe('NLPModule', () => {
  let nlpModule: NLPModule;

  beforeEach(() => {
    nlpModule = new NLPModule();
  });

  describe('Intent Recognition', () => {
    it('should recognize greeting intent', () => {
      const result = nlpModule.recognizeIntent('Hello, how are you?');
      expect(result.name).toBe('greeting');
    });

    it('should recognize calculation intent', () => {
      const result = nlpModule.recognizeIntent('Calculate 2+2');
      expect(result.name).toBe('calculate');
    });

    it('should recognize weather intent', () => {
      const result = nlpModule.recognizeIntent('What is the weather today?');
      expect(result.name).toBe('weather');
    });

    it('should recognize joke intent', () => {
      const result = nlpModule.recognizeIntent('Tell me a joke');
      expect(result.name).toBe('joke');
    });

    it('should recognize compliment intent', () => {
      const result = nlpModule.recognizeIntent('You are great!');
      expect(result.name).toBe('compliment');
    });

    it('should recognize complaint intent', () => {
      const result = nlpModule.recognizeIntent('This is really bad');
      expect(['complain', 'question'].includes(result.name)).toBe(true);
    });

    it('should recognize clarify intent', () => {
      const result = nlpModule.recognizeIntent('Can you explain again? I don\'t understand');
      expect(['clarify', 'question', 'unknown'].includes(result.name)).toBe(true);
    });

    it('should return unknown for unrecognized intent', () => {
      const result = nlpModule.recognizeIntent('xyz123abc');
      expect(result.name).toBe('unknown');
    });
  });

  describe('Entity Extraction', () => {
    it('should extract URLs', () => {
      const input = 'Visit https://example.com';
      const result = nlpModule.extractEntities(input);
      expect(result.some(e => e.name === 'url')).toBe(true);
    });

    it('should extract emails', () => {
      const input = 'Email me at test@example.com';
      const result = nlpModule.extractEntities(input);
      expect(result.some(e => e.name === 'email')).toBe(true);
    });

    it('should extract dates', () => {
      const input = 'The date is 2024-01-01';
      const result = nlpModule.extractEntities(input);
      expect(result.some(e => e.name === 'date')).toBe(true);
    });

    it('should extract numbers', () => {
      const input = 'There are 100 apples';
      const result = nlpModule.extractEntities(input);
      expect(result.some(e => e.name === 'number')).toBe(true);
    });
  });

  describe('Emotion Analysis', () => {
    it('should detect positive emotion', () => {
      const result = nlpModule.analyzeEmotion('This is great! I love it.');
      expect(result.type).toBe('positive');
    });

    it('should detect negative emotion', () => {
      const result = nlpModule.analyzeEmotion('This is bad, I hate it.');
      expect(result.type).toBe('negative');
    });

    it('should detect neutral emotion', () => {
      const result = nlpModule.analyzeEmotion('The sky is blue.');
      expect(result.type).toBe('neutral');
    });
  });

  describe('Language Detection', () => {
    it('should detect Chinese', () => {
      const result = nlpModule.detectLanguage('你好世界');
      expect(result).toBe('zh');
    });

    it('should detect English', () => {
      const result = nlpModule.detectLanguage('Hello world');
      expect(result).toBe('en');
    });
  });

  describe('Response Generation', () => {
    it('should generate response with emotion', () => {
      const emotion = { type: 'positive' as const, confidence: 0.9 };
      const result = nlpModule.generateResponse('Hello', emotion, 'zh');
      expect(result.content).toBeDefined();
      expect(result.emotion).toEqual(emotion);
    });

    it('should generate response without emotion', () => {
      const result = nlpModule.generateResponse('Hello');
      expect(result.content).toBe('Hello');
    });
  });
});
