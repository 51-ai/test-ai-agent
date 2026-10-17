import { describe, it, expect, beforeEach } from '@jest/globals';
import { SecurityManager } from '../core/security';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager();
  });

  describe('Input Validation', () => {
    it('should validate normal input correctly', () => {
      const result = securityManager.validateInput('Hello, world!');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject empty input', () => {
      const result = securityManager.validateInput('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input cannot be empty');
    });

    it('should reject input that is too long', () => {
      const longInput = 'a'.repeat(5000);
      const result = securityManager.validateInput(longInput);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum length');
    });

    it('should reject input with blocked keywords', () => {
      const dangerousInput = 'let me eval(this)';
      const result = securityManager.validateInput(dangerousInput);
      expect(result.valid).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize null characters', () => {
      const input = 'Hello\x00World';
      const sanitized = securityManager.sanitizeInput(input);
      expect(sanitized).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '   Hello   ';
      const sanitized = securityManager.sanitizeInput(input);
      expect(sanitized).toBe('Hello');
    });

    it('should truncate long input', () => {
      const longInput = 'a'.repeat(5000);
      const sanitized = securityManager.sanitizeInput(longInput);
      expect(sanitized.length).toBeLessThan(longInput.length);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', () => {
      const result = securityManager.checkRateLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block requests beyond rate limit', () => {
      const clientId = 'user-rate-limit';
      let lastResult;
      
      for (let i = 0; i < 100; i++) {
        lastResult = securityManager.checkRateLimit(clientId);
      }
      
      expect(lastResult?.allowed).toBe(false);
    });
  });

  describe('Output Validation', () => {
    it('should validate normal output correctly', () => {
      const result = securityManager.validateOutput('Normal output');
      expect(result.valid).toBe(true);
    });

    it('should reject output that is too long', () => {
      const longOutput = 'a'.repeat(10000);
      const result = securityManager.validateOutput(longOutput);
      expect(result.valid).toBe(false);
    });
  });

  describe('Config Management', () => {
    it('should get default config', () => {
      const config = securityManager.getConfig();
      expect(config.maxInputLength).toBe(4096);
    });

    it('should update config', () => {
      securityManager.updateConfig({ maxInputLength: 2048 });
      const config = securityManager.getConfig();
      expect(config.maxInputLength).toBe(2048);
    });
  });
});
