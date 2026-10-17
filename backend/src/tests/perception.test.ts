import { describe, it, expect, beforeEach } from '@jest/globals';
import { PerceptionModule } from '../core/perception/PerceptionModule';

describe('PerceptionModule', () => {
  let perception: PerceptionModule;

  beforeEach(() => {
    perception = new PerceptionModule();
  });

  describe('detectLanguage', () => {
    it('should detect Chinese', () => {
      expect(perception.detectLanguage('你好世界')).toBe('zh');
    });

    it('should detect English', () => {
      expect(perception.detectLanguage('Hello World')).toBe('en');
    });

    it('should detect Japanese', () => {
      expect(perception.detectLanguage('こんにちは世界')).toBe('ja');
    });
  });

  describe('recognizeIntent', () => {
    it('should recognize search intent', () => {
      const intent = perception.recognizeIntent('搜索天气');
      expect(intent.name).toBe('search');
      expect(intent.confidence).toBeGreaterThan(0.8);
    });

    it('should recognize calculate intent', () => {
      const intent = perception.recognizeIntent('计算 1 + 1');
      expect(intent.name).toBe('calculate');
    });

    it('should recognize help intent', () => {
      const intent = perception.recognizeIntent('帮助我');
      expect(intent.name).toBe('help');
    });
  });

  describe('extractEntities', () => {
    it('should extract URLs', () => {
      const entities = perception.extractEntities('访问 https://example.com');
      const urlEntity = entities.find(e => e.name === 'url');
      expect(urlEntity).toBeDefined();
      expect(urlEntity?.value).toBe('https://example.com');
    });

    it('should extract emails', () => {
      const entities = perception.extractEntities('联系我们: test@example.com');
      const emailEntity = entities.find(e => e.name === 'email');
      expect(emailEntity).toBeDefined();
      expect(emailEntity?.value).toBe('test@example.com');
    });
  });

  describe('analyzeEmotion', () => {
    it('should detect positive emotion', () => {
      const emotion = perception.analyzeEmotion('太棒了！好开心！');
      expect(emotion.type).toBe('positive');
    });

    it('should detect negative emotion', () => {
      const emotion = perception.analyzeEmotion('太糟糕了，我很难过');
      expect(emotion.type).toBe('negative');
    });

    it('should detect neutral emotion', () => {
      // 用不含任何情感词的中性句子（'不错' 会被正确识别为 positive）
      const emotion = perception.analyzeEmotion('今天星期三');
      expect(emotion.type).toBe('neutral');
    });
  });

  describe('validateInput', () => {
    it('should validate valid input', () => {
      const result = perception.validateInput('Hello');
      expect(result.valid).toBe(true);
    });

    it('should reject null input', () => {
      const result = perception.validateInput(null);
      expect(result.valid).toBe(false);
    });

    it('should reject empty input', () => {
      const result = perception.validateInput('');
      expect(result.valid).toBe(false);
    });
  });
});