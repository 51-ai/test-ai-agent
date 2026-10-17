import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason?: string;
}

export interface LLMConfig {
  provider: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export class LLMService {
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private qwenClient?: OpenAI;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    if (config.llm.openai.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: config.llm.openai.apiKey,
        baseURL: config.llm.openai.apiBase
      });
    }

    if (config.llm.anthropic.apiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: config.llm.anthropic.apiKey
      });
    }

    if (config.llm.qwen.apiKey) {
      this.qwenClient = new OpenAI({
        apiKey: config.llm.qwen.apiKey,
        baseURL: config.llm.qwen.apiBase
      });
    }
  }

  async generate(
    prompt: string,
    options: Partial<LLMConfig> = {}
  ): Promise<LLMResponse> {
    const provider = options.provider || config.llm.defaultProvider;
    const model = options.model || this.getDefaultModel(provider);
    const maxTokens = options.maxTokens || this.getDefaultMaxTokens(provider);
    const temperature = options.temperature || this.getDefaultTemperature(provider);

    switch (provider) {
      case 'anthropic':
        return this.generateWithAnthropic(prompt, model, maxTokens, temperature);
      case 'qwen':
        return this.generateWithQwen(prompt, model, maxTokens, temperature);
      case 'openai':
      default:
        return this.generateWithOpenAI(prompt, model, maxTokens, temperature);
    }
  }

  async generateWithOpenAI(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Please set OPENAI_API_KEY.');
    }

    const response = await this.openaiClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
      n: 1
    });

    return {
      content: response.choices[0].message.content || '',
      model,
      provider: 'openai',
      tokenUsage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      },
      finishReason: response.choices[0].finish_reason
    };
  }

  async generateWithAnthropic(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized. Please set ANTHROPIC_API_KEY.');
    }

    const anthropic = this.anthropicClient as any;
    
    const response = await anthropic.completions.create({
      model,
      max_tokens_to_sample: maxTokens,
      temperature,
      prompt: `\n\nHuman: ${prompt}\n\nAssistant:`
    });

    return {
      content: response.completion || '',
      model,
      provider: 'anthropic',
      tokenUsage: {
        prompt: response.usage?.input_tokens || 0,
        completion: response.usage?.output_tokens || 0,
        total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      finishReason: response.stop_reason
    };
  }

  async generateWithQwen(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<LLMResponse> {
    if (!this.qwenClient) {
      throw new Error('Qwen client not initialized. Please set QWEN_API_KEY.');
    }

    const response = await this.qwenClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
      n: 1
    });

    return {
      content: response.choices[0].message.content || '',
      model,
      provider: 'qwen',
      tokenUsage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      },
      finishReason: response.choices[0].finish_reason
    };
  }

  async generateWithFunctionCall(
    prompt: string,
    functions: any[],
    options: Partial<LLMConfig> = {}
  ): Promise<LLMResponse & { functionCall?: any }> {
    const provider = options.provider || config.llm.defaultProvider;

    if (provider === 'anthropic') {
      return this.generateWithAnthropicFunctionCall(prompt, functions, options);
    }

    return this.generateWithOpenAIFunctionCall(prompt, functions, options);
  }

  private async generateWithOpenAIFunctionCall(
    prompt: string,
    functions: any[],
    options: Partial<LLMConfig>
  ): Promise<LLMResponse & { functionCall?: any }> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized.');
    }

    const model = options.model || config.llm.openai.model;
    const maxTokens = options.maxTokens || config.llm.openai.maxTokens;
    const temperature = options.temperature || config.llm.openai.temperature;

    const response = await this.openaiClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
      functions,
      function_call: 'auto'
    });

    const message = response.choices[0].message;
    const functionCall = message.function_call ? {
      name: message.function_call.name,
      arguments: JSON.parse(message.function_call.arguments || '{}')
    } : undefined;

    return {
      content: message.content || '',
      model,
      provider: 'openai',
      tokenUsage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      },
      finishReason: response.choices[0].finish_reason,
      functionCall
    };
  }

  private async generateWithAnthropicFunctionCall(
    prompt: string,
    functions: any[],
    options: Partial<LLMConfig>
  ): Promise<LLMResponse & { functionCall?: any }> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized.');
    }

    const anthropic = this.anthropicClient as any;
    const model = options.model || config.llm.anthropic.model;
    const maxTokens = options.maxTokens || config.llm.anthropic.maxTokens;
    const temperature = options.temperature || config.llm.anthropic.temperature;

    const tools = functions.map(f => ({
      name: f.name,
      description: f.description,
      input_schema: f.parameters
    }));

    const toolPrompt = tools.map(t => 
      `Tool: ${t.name} - ${t.description}`
    ).join('\n');

    const fullPrompt = `${toolPrompt}\n\nHuman: ${prompt}\n\nAssistant:`;

    const response = await anthropic.completions.create({
      model,
      max_tokens_to_sample: maxTokens,
      temperature,
      prompt: fullPrompt
    });

    return {
      content: response.completion || '',
      model,
      provider: 'anthropic',
      tokenUsage: {
        prompt: response.usage?.input_tokens || 0,
        completion: response.usage?.output_tokens || 0,
        total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      finishReason: response.stop_reason,
      functionCall: undefined
    };
  }

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'anthropic':
        return config.llm.anthropic.model;
      case 'qwen':
        return config.llm.qwen.model;
      default:
        return config.llm.openai.model;
    }
  }

  private getDefaultMaxTokens(provider: string): number {
    switch (provider) {
      case 'anthropic':
        return config.llm.anthropic.maxTokens;
      case 'qwen':
        return config.llm.qwen.maxTokens;
      default:
        return config.llm.openai.maxTokens;
    }
  }

  private getDefaultTemperature(provider: string): number {
    switch (provider) {
      case 'anthropic':
        return config.llm.anthropic.temperature;
      case 'qwen':
        return config.llm.qwen.temperature;
      default:
        return config.llm.openai.temperature;
    }
  }

  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (config.llm.openai.apiKey) providers.push('openai');
    if (config.llm.anthropic.apiKey) providers.push('anthropic');
    if (config.llm.qwen.apiKey) providers.push('qwen');
    return providers;
  }
}

export const llmService = new LLMService();