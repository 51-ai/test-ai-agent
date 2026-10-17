/**
 * LLM 服务模块
 * 支持 DeepSeek、OpenAI、Ollama（本地 NPU 加速）等多种 LLM 提供商
 * 自动故障转移：API 不可用时切换到本地 Ollama
 */

import axios from 'axios';

export interface LLMConfig {
  provider: 'deepseek' | 'openai' | 'anthropic' | 'ollama';
  apiKey: string;
  model: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Ollama 默认配置
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL = 'qwen2.5:7b';

export class LLMService {
  private config: LLMConfig;
  private client: any;
  private ollamaClient: any;
  private useOllama: boolean = false;
  private lastFailoverTime: number = 0;
  private failoverAttempts: number = 0;
  private maxFailoverBackoff: number = 60000; // 最大退避 60 秒
  private baseFailoverBackoff: number = 1000; // 基础退避 1 秒

  constructor(config: LLMConfig) {
    this.config = {
      maxTokens: 4096,
      temperature: 0.7,
      ...config
    };

    // 设置 baseURL
    if (!this.config.baseURL) {
      switch (this.config.provider) {
        case 'deepseek':
          this.config.baseURL = 'https://api.deepseek.com/v1';
          break;
        case 'openai':
          this.config.baseURL = 'https://api.openai.com/v1';
          break;
        case 'anthropic':
          this.config.baseURL = 'https://api.anthropic.com/v1';
          break;
        case 'ollama':
          this.config.baseURL = OLLAMA_BASE_URL;
          this.useOllama = true;
          break;
      }
    }

    // 创建 API 客户端
    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      timeout: 60000
    });

    // 创建 Ollama 客户端（用于故障转移）
    this.ollamaClient = axios.create({
      baseURL: OLLAMA_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000  // 本地模型可能慢一些
    });
  }

  /**
   * 检查 Ollama 是否可用
   */
  async checkOllamaAvailability(): Promise<boolean> {
    try {
      const response = await this.ollamaClient.get('/api/tags', {
        timeout: 3000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 获取 Ollama 可用的模型列表
   */
  async getOllamaModels(): Promise<string[]> {
    try {
      const response = await this.ollamaClient.get('/api/tags');
      return response.data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }

  /**
   * 通过 Ollama 调用本地模型
   */
  private async chatWithOllama(messages: ChatMessage[], model?: string): Promise<LLMResponse> {
    const ollamaModel = model || process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;

    // Ollama 的消息格式与 OpenAI 兼容
    const response = await this.ollamaClient.post('/api/chat', {
      model: ollamaModel,
      messages: messages,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    });

    const data = response.data;

    return {
      content: data.message?.content || '',
      model: ollamaModel,
      provider: 'ollama',
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      }
    };
  }

  /**
   * 通过云端 API 调用
   */
  private async chatWithCloudAPI(messages: ChatMessage[], model?: string): Promise<LLMResponse> {
    const response = await this.client.post('/chat/completions', {
      model: model || this.config.model,
      messages: messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    });

    const data = response.data;

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || this.config.model,
      provider: this.config.provider,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }

  /**
   * 发送聊天请求（自动故障转移）
   */
  async chat(messages: ChatMessage[], systemPrompt?: string, model?: string): Promise<LLMResponse> {
    const fullMessages: ChatMessage[] = [];

    // 添加系统提示
    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }

    // 添加对话历史
    fullMessages.push(...messages);

    // 如果是 Ollama 模式，直接使用 Ollama
    if (this.useOllama) {
      return await this.chatWithOllama(fullMessages, model);
    }

    // 指数退避：计算动态冷却时间
    const now = Date.now();
    const backoffTime = Math.min(
      this.baseFailoverBackoff * Math.pow(2, this.failoverAttempts),
      this.maxFailoverBackoff
    );
    const inFailover = this.failoverAttempts > 0 && (now - this.lastFailoverTime) < backoffTime;

    // 如果不在冷却期，尝试云端 API
    if (!inFailover) {
      try {
        const result = await this.chatWithCloudAPI(fullMessages, model);
        // 云端 API 成功，重置失败计数
        if (this.failoverAttempts > 0) {
          console.log('[LLMService] 云端 API 恢复，重置退避计数');
          this.failoverAttempts = 0;
        }
        return result;
      } catch (error: any) {
        console.error('[LLMService] 云端 API 调用失败:', error.response?.data?.error?.message || error.message);
        this.failoverAttempts++;
        this.lastFailoverTime = now;
        const nextBackoff = Math.min(
          this.baseFailoverBackoff * Math.pow(2, this.failoverAttempts),
          this.maxFailoverBackoff
        );
        console.log(`[LLMService] 故障转移 #${this.failoverAttempts}，下次退避 ${(nextBackoff / 1000).toFixed(1)}s`);

        // 检查 Ollama 是否可用
        const ollamaAvailable = await this.checkOllamaAvailability();
        if (ollamaAvailable) {
          console.log('[LLMService] ✅ Ollama 可用，切换到本地模型');
          return await this.chatWithOllama(fullMessages, model);
        } else {
          console.error('[LLMService] ❌ Ollama 也不可用');
          throw new Error(`LLM 调用失败（云端和本地均不可用）: ${error.message}`);
        }
      }
    } else {
      // 在退避期内，直接使用 Ollama
      console.log(`[LLMService] 退避期内（${(backoffTime / 1000).toFixed(1)}s），使用本地 Ollama`);
      try {
        return await this.chatWithOllama(fullMessages, model);
      } catch (ollamaError: any) {
        // Ollama 也失败了
        this.failoverAttempts++;
        this.lastFailoverTime = now;
        throw new Error(`本地模型调用失败: ${ollamaError.message}`);
      }
    }
  }

  /**
   * 单轮对话（简化接口）
   */
  async ask(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    const response = await this.chat(messages, systemPrompt);
    return response.content;
  }

  /**
   * 流式响应（用于长回复）
   */
  async *chatStream(messages: ChatMessage[], systemPrompt?: string): AsyncGenerator<string> {
    const fullMessages: ChatMessage[] = [];

    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }
    fullMessages.push(...messages);

    // Ollama 流式响应
    if (this.useOllama) {
      const ollamaModel = process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;
      try {
        const response = await this.ollamaClient.post('/api/chat', {
          model: ollamaModel,
          messages: fullMessages,
          stream: true,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens
          }
        }, {
          responseType: 'stream'
        });

        const stream = response.data;
        for await (const chunk of stream) {
          const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              const content = parsed.message?.content;
              if (content) yield content;
              if (parsed.done) return;
            } catch {
              // 忽略解析错误
            }
          }
        }
      } catch (error: any) {
        console.error('[LLMService] Ollama 流式调用失败:', error.message);
        throw new Error(`Ollama 流式调用失败: ${error.message}`);
      }
      return;
    }

    // 云端 API 流式响应
    // 指数退避检查
    const backoffTime = Math.min(
      this.baseFailoverBackoff * Math.pow(2, this.failoverAttempts),
      this.maxFailoverBackoff
    );
    const inFailover = this.failoverAttempts > 0 && (Date.now() - this.lastFailoverTime) < backoffTime;

    if (!inFailover) {
      try {
        const response = await this.client.post('/chat/completions', {
          model: this.config.model,
          messages: fullMessages,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          stream: true
        }, {
          responseType: 'stream'
        });

        // 云端成功，重置退避计数
        if (this.failoverAttempts > 0) {
          console.log('[LLMService] 云端流式 API 恢复，重置退避计数');
          this.failoverAttempts = 0;
        }

        const stream = response.data;
        for await (const chunk of stream) {
          const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) yield content;
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
        return;
      } catch (error: any) {
        console.error('[LLMService] 云端流式调用失败:', error.message);
        this.failoverAttempts++;
        this.lastFailoverTime = Date.now();
        const nextBackoff = Math.min(
          this.baseFailoverBackoff * Math.pow(2, this.failoverAttempts),
          this.maxFailoverBackoff
        );
        console.log(`[LLMService] 流式故障转移 #${this.failoverAttempts}，下次退避 ${(nextBackoff / 1000).toFixed(1)}s`);
        console.log('[LLMService] 尝试切换到 Ollama 流式...');
      }
    } else {
      console.log(`[LLMService] 流式退避期内（${(backoffTime / 1000).toFixed(1)}s），使用本地 Ollama`);
    }

    // 故障转移到 Ollama 流式
    const ollamaAvailable = await this.checkOllamaAvailability();
    if (ollamaAvailable) {
      const ollamaModel = process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;
      const response = await this.ollamaClient.post('/api/chat', {
        model: ollamaModel,
        messages: fullMessages,
        stream: true,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      }, {
        responseType: 'stream'
      });

      const stream = response.data;
      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content;
            if (content) yield content;
            if (parsed.done) return;
          } catch {
            // 忽略解析错误
          }
        }
      }
    } else {
      throw new Error('LLM 流式调用失败（云端和本地均不可用）');
    }
  }

  /**
   * 检查 API 是否可用
   */
  async checkAvailability(): Promise<boolean> {
    // 如果是 Ollama 模式，检查 Ollama
    if (this.useOllama) {
      return await this.checkOllamaAvailability();
    }

    // 检查云端 API
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });
      return response.status === 200;
    } catch {
      // 云端不可用，检查 Ollama
      return await this.checkOllamaAvailability();
    }
  }

  /**
   * 获取当前使用的提供商
   */
  getCurrentProvider(): string {
    if (this.useOllama) return 'ollama';
    const backoffTime = Math.min(
      this.baseFailoverBackoff * Math.pow(2, this.failoverAttempts),
      this.maxFailoverBackoff
    );
    const inFailover = this.failoverAttempts > 0 && (Date.now() - this.lastFailoverTime) < backoffTime;
    return inFailover ? 'ollama (failover)' : this.config.provider;
  }

  /**
   * 获取当前配置
   */
  getConfig(): LLMConfig {
    return this.config;
  }
}

// 默认系统提示
export const DEFAULT_SYSTEM_PROMPT = `你是一个智能助手，能够帮助用户完成各种任务。
你的特点：
- 友好、专业、乐于助人
- 能够理解用户的意图并提供准确的回答
- 对于复杂问题，会给出详细的分析和建议
- 对于编程问题，可以提供代码示例和解释
- 始终保持积极的态度

请用中文回复用户，除非用户明确要求使用其他语言。`;

// 创建默认 LLM 服务实例
export function createLLMService(): LLMService | null {
  // 优先检查是否配置为使用 Ollama
  if (process.env.LLM_PROVIDER === 'ollama') {
    console.log('[LLMService] 使用 Ollama 本地模型');
    return new LLMService({
      provider: 'ollama',
      apiKey: '',
      model: process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL,
      baseURL: OLLAMA_BASE_URL,
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // 没有配置 API Key，尝试使用 Ollama
    console.log('[LLMService] 未配置 API Key，尝试使用 Ollama 本地模型');
    return new LLMService({
      provider: 'ollama',
      apiKey: '',
      model: process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL,
      baseURL: OLLAMA_BASE_URL,
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
    });
  }

  const provider = process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai';
  const model = process.env.LLM_MODEL || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

  console.log(`[LLMService] 使用 ${provider} API，故障转移到 Ollama`);

  return new LLMService({
    provider,
    apiKey,
    model,
    baseURL: process.env.LLM_BASE_URL,
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
  });
}

// 导出单例实例
let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService | null {
  if (!llmServiceInstance) {
    llmServiceInstance = createLLMService();
  }
  return llmServiceInstance;
}