import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development'
  },
  security: {
    jwtSecret: (() => {
      const secret = process.env.JWT_SECRET;
      if (process.env.NODE_ENV === 'production' && (!secret || secret === 'your-secret-key')) {
        throw new Error(
          '[SECURITY] FATAL: JWT_SECRET must be explicitly set in production environment. ' +
          'Using the default value is a critical security risk. Set JWT_SECRET to a strong random value.'
        );
      }
      return secret || 'your-secret-key';
    })(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: Math.min(20, Math.max(4, parseInt(process.env.BCRYPT_ROUNDS || '12', 10))),
    mfaDisabled: process.env.MFA_DISABLED === '1'
  },
  database: {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai-agent',
    redisUri: process.env.REDIS_URI || 'redis://localhost:6379'
  },
  llm: {
    defaultProvider: process.env.LLM_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      apiBase: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7')
    },
    qwen: {
      apiKey: process.env.QWEN_API_KEY || '',
      model: process.env.QWEN_MODEL || 'qwen-max',
      maxTokens: parseInt(process.env.QWEN_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.QWEN_TEMPERATURE || '0.7'),
      apiBase: process.env.QWEN_API_BASE || 'https://api.together.xyz/v1'
    }
  },
  // 文档照片识别（手机拍摄的文档照片 → 文本）
  documentImage: {
    visionModel: process.env.OCR_VISION_MODEL || 'gpt-4o-mini',
    apiKey: process.env.OCR_VISION_API_KEY || process.env.OPENAI_API_KEY || '',
    apiBase: process.env.OCR_VISION_API_BASE || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    timeoutMs: parseInt(process.env.OCR_VISION_TIMEOUT_MS || '60000', 10),
    maxBytes: parseInt(process.env.OCR_MAX_IMAGE_BYTES || '10485760', 10)
  },
  search: {
    google: {
      apiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
      cx: process.env.GOOGLE_SEARCH_CX || ''
    },
    bing: {
      apiKey: process.env.BING_SEARCH_API_KEY || ''
    },
    duckduckgo: {
      enabled: process.env.USE_DUCKDUCKGO === 'true'
    },
    serpapi: {
      apiKey: process.env.SERPAPI_API_KEY || ''
    }
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  },
  memory: {
    shortTermTTL: 60 * 60 * 1000,
    longTermTTL: 30 * 24 * 60 * 60 * 1000,
    vectorDbPath: './data/chroma',
    maxShortTermItems: 1000
  },
  execution: {
    timeout: 30 * 1000,
    maxRetries: 3,
    concurrentTasks: 10
  }
};

export default config;