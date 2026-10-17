import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { LLMService, LLMConfig, LLMResponse } from '../services/LLMService';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 构造 mock axios instance（用 any 绕过 TS 严格类型检查）
function mockAxiosInstance() {
  return {
    get: jest.fn<any>(),
    post: jest.fn<any>(),
    create: jest.fn<any>().mockReturnThis(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
}

describe('LLMService', () => {
  const cloudConfig: LLMConfig = {
    provider: 'deepseek',
    apiKey: 'test-api-key',
    model: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedAxios.create.mockReturnValue(mockAxiosInstance() as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ========== Token 使用量透传测试 ==========
  describe('Token 使用量透传', () => {
    it('chatWithCloudAPI 应透传 API 返回的 usage 数据', async () => {
      const mockInst = mockAxiosInstance();
      mockInst.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Hello, user!' } }],
          model: 'deepseek-chat',
          usage: { prompt_tokens: 150, completion_tokens: 80, total_tokens: 230 },
        },
      });
      mockedAxios.create.mockReturnValue(mockInst as any);

      const service = new LLMService(cloudConfig);
      const result = await (service as any).chatWithCloudAPI([{ role: 'user', content: 'Hi' }]);

      expect(result.usage).toBeDefined();
      expect(result.usage!.promptTokens).toBe(150);
      expect(result.usage!.completionTokens).toBe(80);
      expect(result.usage!.totalTokens).toBe(230);
    });

    it('chatWithCloudAPI 应在 API 无 usage 时返回 0', async () => {
      const mockInst = mockAxiosInstance();
      mockInst.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'Hello!' } }], model: 'deepseek-chat' },
      });
      mockedAxios.create.mockReturnValue(mockInst as any);

      const service = new LLMService(cloudConfig);
      const result = await (service as any).chatWithCloudAPI([{ role: 'user', content: 'Hi' }]);

      expect(result.usage!.promptTokens).toBe(0);
      expect(result.usage!.completionTokens).toBe(0);
      expect(result.usage!.totalTokens).toBe(0);
    });

    it('chatWithOllama 应透传 Ollama 返回的 token 统计', async () => {
      const mockInst = mockAxiosInstance();
      mockInst.post.mockResolvedValueOnce({
        data: { message: { content: 'Ollama response' }, prompt_eval_count: 45, eval_count: 30 },
      });
      mockedAxios.create.mockReturnValue(mockInst as any);

      const ollamaConfig: LLMConfig = { provider: 'ollama', apiKey: '', model: 'qwen2.5:7b' };
      const service = new LLMService(ollamaConfig);
      const result = await (service as any).chatWithOllama([{ role: 'user', content: 'Hi' }]);

      expect(result.usage!.promptTokens).toBe(45);
      expect(result.usage!.completionTokens).toBe(30);
      expect(result.usage!.totalTokens).toBe(75);
    });

    it('chatWithOllama 应在 Ollama 无 token 统计时返回 0', async () => {
      const mockInst = mockAxiosInstance();
      mockInst.post.mockResolvedValueOnce({
        data: { message: { content: 'Ollama response' } },
      });
      mockedAxios.create.mockReturnValue(mockInst as any);

      const ollamaConfig: LLMConfig = { provider: 'ollama', apiKey: '', model: 'qwen2.5:7b' };
      const service = new LLMService(ollamaConfig);
      const result = await (service as any).chatWithOllama([{ role: 'user', content: 'Hi' }]);

      expect(result.usage!.promptTokens).toBe(0);
      expect(result.usage!.completionTokens).toBe(0);
      expect(result.usage!.totalTokens).toBe(0);
    });

    it('chat() 应返回包含 usage 的 LLMResponse', async () => {
      const mockInst = mockAxiosInstance();
      mockInst.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Cloud response' } }],
          model: 'deepseek-chat',
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        },
      });
      mockedAxios.create.mockReturnValue(mockInst as any);

      const service = new LLMService(cloudConfig);
      const result = await service.chat([{ role: 'user', content: 'Hello' }], 'You are helpful.');

      expect(result.usage!.promptTokens).toBe(100);
      expect(result.usage!.completionTokens).toBe(50);
      expect(result.usage!.totalTokens).toBe(150);
      expect(result.provider).toBe('deepseek');
    });
  });

  // ========== 指数退避测试 ==========
  describe('指数退避故障转移', () => {
    it('首次成功调用应不触发退避（failoverAttempts 保持 0）', async () => {
      const mockInst = mockAxiosInstance();
      mockInst.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'OK' } }],
          model: 'deepseek-chat',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });
      mockedAxios.create.mockReturnValue(mockInst as any);

      const service = new LLMService(cloudConfig);
      await service.chat([{ role: 'user', content: 'Hi' }]);

      expect((service as any).failoverAttempts).toBe(0);
    });

    it('首次失败应设置 failoverAttempts=1 并尝试 Ollama', async () => {
      const cloudMock = mockAxiosInstance();
      cloudMock.post.mockRejectedValueOnce(new Error('Network error'));

      const ollamaMock = mockAxiosInstance();
      ollamaMock.get.mockResolvedValueOnce({ status: 200 });
      ollamaMock.post.mockResolvedValueOnce({
        data: { message: { content: 'Ollama fallback' }, prompt_eval_count: 5, eval_count: 3 },
      });

      // 让 axios.create 依次返回 cloudMock 和 ollamaMock
      mockedAxios.create
        .mockReturnValueOnce(cloudMock as any)
        .mockReturnValueOnce(ollamaMock as any);

      const service = new LLMService(cloudConfig);
      (service as any).client = cloudMock;
      (service as any).ollamaClient = ollamaMock;

      jest.setSystemTime(0);
      const result = await service.chat([{ role: 'user', content: 'Hi' }]);

      expect((service as any).failoverAttempts).toBe(1);
      expect(result.provider).toBe('ollama');
    });

    it('退避期内应跳过云端直接使用 Ollama', async () => {
      const cloudMock = mockAxiosInstance();
      const ollamaMock = mockAxiosInstance();
      ollamaMock.post.mockResolvedValueOnce({
        data: { message: { content: 'Ollama in backoff' }, prompt_eval_count: 5, eval_count: 3 },
      });

      const service = new LLMService(cloudConfig);
      (service as any).client = cloudMock;
      (service as any).ollamaClient = ollamaMock;

      // 模拟已在退避中：attempts=2, lastFailoverTime=0, 当前时间=500ms
      // backoff = 1s * 2^2 = 4s, 500ms < 4s → 在退避期内
      (service as any).failoverAttempts = 2;
      (service as any).lastFailoverTime = 0;
      jest.setSystemTime(500);

      const result = await service.chat([{ role: 'user', content: 'Hi' }]);

      expect(cloudMock.post).not.toHaveBeenCalled();
      expect(result.provider).toBe('ollama');
    });

    it('退避期过后应重新尝试云端 API 并重置计数', async () => {
      const cloudMock = mockAxiosInstance();
      cloudMock.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Cloud recovered!' } }],
          model: 'deepseek-chat',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });

      const service = new LLMService(cloudConfig);
      (service as any).client = cloudMock;

      // attempts=2, lastFailoverTime=0, backoff=4s, 当前=5000ms > 4s
      (service as any).failoverAttempts = 2;
      (service as any).lastFailoverTime = 0;
      jest.setSystemTime(5000);

      const result = await service.chat([{ role: 'user', content: 'Hi' }]);

      expect(cloudMock.post).toHaveBeenCalled();
      expect(result.provider).toBe('deepseek');
      expect((service as any).failoverAttempts).toBe(0);
    });

    it('连续失败应导致退避时间指数增长', async () => {
      const cloudMock = mockAxiosInstance();
      const ollamaMock = mockAxiosInstance();

      cloudMock.post.mockRejectedValue(new Error('Fail'));
      ollamaMock.get.mockResolvedValue({ status: 200 });
      ollamaMock.post.mockResolvedValue({
        data: { message: { content: 'Ollama' }, prompt_eval_count: 5, eval_count: 3 },
      });

      const service = new LLMService(cloudConfig);
      (service as any).client = cloudMock;
      (service as any).ollamaClient = ollamaMock;

      for (let i = 0; i < 3; i++) {
        jest.setSystemTime(i * 100000);
        await service.chat([{ role: 'user', content: 'Hi' }]);
      }

      expect((service as any).failoverAttempts).toBe(3);
      expect(1000 * Math.pow(2, 3)).toBe(8000);
    });

    it('退避时间应封顶在 maxFailoverBackoff (60s)', async () => {
      const cloudMock = mockAxiosInstance();
      const ollamaMock = mockAxiosInstance();

      cloudMock.post.mockRejectedValue(new Error('Fail'));
      ollamaMock.get.mockResolvedValue({ status: 200 });
      ollamaMock.post.mockResolvedValue({
        data: { message: { content: 'Ollama' }, prompt_eval_count: 5, eval_count: 3 },
      });

      const service = new LLMService(cloudConfig);
      (service as any).client = cloudMock;
      (service as any).ollamaClient = ollamaMock;

      for (let i = 0; i < 7; i++) {
        jest.setSystemTime(i * 200000);
        await service.chat([{ role: 'user', content: 'Hi' }]);
      }

      expect((service as any).failoverAttempts).toBe(7);
      // 2^7 * 1s = 128s > 60s, 封顶 60s
      expect(Math.min(1000 * Math.pow(2, 7), 60000)).toBe(60000);
    });

    it('云端恢复后应重置 failoverAttempts 为 0', async () => {
      const cloudMock = mockAxiosInstance();
      const ollamaMock = mockAxiosInstance();

      // 第一次失败 → 切到 Ollama
      cloudMock.post.mockRejectedValueOnce(new Error('Fail'));
      ollamaMock.get.mockResolvedValueOnce({ status: 200 });
      ollamaMock.post.mockResolvedValueOnce({
        data: { message: { content: 'Ollama' }, prompt_eval_count: 5, eval_count: 3 },
      });

      const service = new LLMService(cloudConfig);
      (service as any).client = cloudMock;
      (service as any).ollamaClient = ollamaMock;

      jest.setSystemTime(0);
      await service.chat([{ role: 'user', content: 'Hi' }]);
      expect((service as any).failoverAttempts).toBe(1);

      // 第二次成功（退避时间过后）
      cloudMock.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Recovered!' } }],
          model: 'deepseek-chat',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });
      jest.setSystemTime(100000);
      await service.chat([{ role: 'user', content: 'Hello again' }]);

      expect((service as any).failoverAttempts).toBe(0);
    });
  });

  // ========== getCurrentProvider 测试 ==========
  describe('getCurrentProvider', () => {
    it('Ollama 模式应返回 ollama', () => {
      const ollamaConfig: LLMConfig = { provider: 'ollama', apiKey: '', model: 'qwen2.5:7b' };
      const service = new LLMService(ollamaConfig);
      expect(service.getCurrentProvider()).toBe('ollama');
    });

    it('退避期内应返回 ollama (failover)', () => {
      const service = new LLMService(cloudConfig);
      (service as any).failoverAttempts = 2;
      (service as any).lastFailoverTime = 0;
      jest.setSystemTime(500);
      expect(service.getCurrentProvider()).toBe('ollama (failover)');
    });

    it('退避期过后应返回云端 provider', () => {
      const service = new LLMService(cloudConfig);
      (service as any).failoverAttempts = 2;
      (service as any).lastFailoverTime = 0;
      jest.setSystemTime(5000);
      expect(service.getCurrentProvider()).toBe('deepseek');
    });

    it('无失败时应返回云端 provider', () => {
      const service = new LLMService(cloudConfig);
      expect(service.getCurrentProvider()).toBe('deepseek');
    });
  });
});