/**
 * Groq LLaMA API 使用示例
 * 
 * Groq - 完全免费，速度极快！
 * 官方网站：https://console.groq.com/
 * 
 * 特点：
 * 1. 完全免费（无需信用卡）
 * 2. 速度极快（AI加速器）
 * 3. 支持 LLaMA、Mistral 等开源模型
 * 
 * 使用方法：
 * 1. 在 Groq Console 获取 API Key（完全免费，无需信用卡）
 * 2. 设置环境变量 GROQ_API_KEY
 * 3. 运行此脚本
 */

import fetch from 'node-fetch';

/**
 * Groq 客户端
 */
class GroqClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1';
    
    // 支持的模型
    this.models = {
      llama: 'llama-3.1-8b-instant',      // 快速，适合日常对话
      llamaLarge: 'llama-3.1-70b-versatile', // 大模型，性能更强
      mixtral: 'mixtral-8x7b-32768',       // Mixtral 模型
      gemma: 'gemma2-9b-it'                // Google Gemma 模型
    };
  }

  /**
   * 发送聊天请求
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('请设置 GROQ_API_KEY 环境变量');
    }

    const model = options.model || this.models.llama;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: options.max_tokens || 2048,
        temperature: options.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API调用失败: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 简单对话
   */
  async sendMessage(prompt, systemPrompt = '', model = 'llama') {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages, { model: this.models[model] || model });
    return response.choices[0].message.content;
  }

  /**
   * 流式输出
   */
  async streamMessage(prompt, options = {}, onChunk) {
    if (!this.apiKey) {
      throw new Error('请设置 GROQ_API_KEY 环境变量');
    }

    const model = options.model || this.models.llama;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API调用失败: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content && onChunk) {
                onChunk(content);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
  }

  /**
   * 获取可用模型列表
   */
  getAvailableModels() {
    return {
      'llama (快速)': this.models.llama,
      'llama-large (高性能)': this.models.llamaLarge,
      'mixtral': this.models.mixtral,
      'gemma': this.models.gemma
    };
  }
}

// 创建默认客户端
const groq = new GroqClient();

/**
 * 演示函数
 */
async function runDemo() {
  console.log("=".repeat(70));
  console.log("   Groq LLaMA API 演示");
  console.log("=".repeat(70));
  console.log("");
  console.log("🎉 完全免费！无需信用卡！");
  console.log("");
  console.log("📊 模型信息：");
  console.log("   - 名称: Groq LLaMA");
  console.log("   - 厂商: Groq (AI加速器)");
  console.log("   - 特点: 完全免费、速度极快");
  console.log("   - 模型: LLaMA 3.1, Mixtral, Gemma");
  console.log("");

  const client = new GroqClient();

  // 检查API Key
  if (!client.apiKey) {
    console.log("❌ 未配置 GROQ_API_KEY");
    console.log("");
    console.log("📋 配置步骤（完全免费，无需信用卡）：");
    console.log("");
    console.log("   1. 访问 https://console.groq.com/");
    console.log("   2. 点击「Sign Up」注册账号");
    console.log("   3. 使用 Google 或 GitHub 登录（推荐）");
    console.log("   4. 进入「API Keys」页面");
    console.log("   5. 点击「Create API Key」创建密钥");
    console.log("   6. 复制密钥并设置环境变量:");
    console.log("");
    console.log("      Windows: set GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx");
    console.log("      Linux/Mac: export GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx");
    console.log("");
    console.log("💡 正在使用模拟模式演示...");
    console.log("");
    
    // 模拟演示
    runMockDemo();
    return;
  }

  try {
    console.log("✅ API Key 已配置");
    console.log("");

    // 显示可用模型
    console.log("📋 可用模型：");
    const models = client.getAvailableModels();
    Object.entries(models).forEach(([name, model]) => {
      console.log(`   - ${name}: ${model}`);
    });
    console.log("");

    // 1. 简单对话
    console.log("📌 演示1: 简单对话");
    console.log("问题: 你好，请介绍一下你自己");
    console.log("");
    const response1 = await client.sendMessage("你好，请介绍一下你自己");
    console.log("回答:", response1);
    console.log("");

    // 2. 代码生成
    console.log("📌 演示2: 代码生成");
    console.log("问题: 用JavaScript写一个斐波那契数列函数");
    console.log("");
    const response2 = await client.sendMessage("用JavaScript写一个斐波那契数列函数");
    console.log("回答:");
    console.log(response2);
    console.log("");

    // 3. 使用大模型
    console.log("📌 演示3: 使用大模型 (LLaMA Large)");
    console.log("问题: 解释一下什么是量子计算");
    console.log("");
    const response3 = await client.sendMessage(
      "用简洁的语言解释什么是量子计算",
      "你是一位物理学教授，用通俗易懂的语言解释复杂概念",
      'llamaLarge'
    );
    console.log("回答:", response3.substring(0, 300), "...");
    console.log("");

    // 4. 流式输出
    console.log("📌 演示4: 流式输出（体验极速）");
    console.log("问题: 写一首关于编程的诗");
    console.log("");
    console.log("回答: ");
    await client.streamMessage("写一首关于编程的诗", {}, (chunk) => {
      process.stdout.write(chunk);
    });
    console.log("");
    console.log("");

    console.log("✅ 演示完成！");
    
  } catch (error) {
    console.error("❌ 调用失败:", error.message);
    console.log("");
    console.log("💡 可能的原因：");
    console.log("   - API Key 不正确");
    console.log("   - 网络连接问题");
    console.log("   - 请求频率过高");
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * 模拟演示（无API Key时使用）
 */
function runMockDemo() {
  const mockResponses = {
    intro: `你好！我是 Groq LLaMA，一个由 Groq 驱动的 AI 助手。

Groq 是一个专注于 AI 加速的公司，我们使用自主研发的 LPU（Language Processing Unit）来提供极快的推理速度。

我的特点：
1. 🚀 速度极快 - 使用 AI 加速器
2. 💰 完全免费 - 无需信用卡
3. 🤖 开源模型 - 基于 LLaMA、Mistral 等

我可以帮助你：
- 回答问题
- 编写代码
- 写作创作
- 分析问题

有什么我可以帮你的吗？`,

    code: `// 斐波那契数列 - JavaScript

// 方法1: 递归（简洁但效率低）
function fibonacciRecursive(n) {
  if (n <= 1) return n;
  return fibonacciRecursive(n - 1) + fibonacciRecursive(n - 2);
}

// 方法2: 循环（推荐）
function fibonacciLoop(n) {
  if (n <= 1) return n;
  
  let prev = 0, curr = 1;
  for (let i = 2; i <= n; i++) {
    [prev, curr] = [curr, prev + curr];
  }
  return curr;
}

// 示例
console.log(fibonacciLoop(10)); // 55`,

    quantum: `量子计算是一种利用量子力学原理进行信息处理的新型计算方式。

与传统计算机的区别：
1. 量子比特（Qubit）
   - 传统计算机用0或1
   - 量子计算机可以同时是0和1（叠加态）

2. 并行计算
   - 传统：一次处理一个计算
   - 量子：同时处理多个计算

3. 应用场景
   - 密码破解
   - 药物研发
   - 气候模拟
   - 优化问题

简单来说，量子计算是一种"超级并行计算"，在特定问题上比传统计算机快得多。`,

    poem: `代码如诗，逻辑成韵
键盘轻敲，智慧流淌
Bug如魔，Debug是道
循环往复，终达彼岸
屏幕闪烁，光标跳动
一行行代码，一段段人生`
  };

  console.log("📋 可用模型：");
  console.log("   - llama (快速): llama-3.1-8b-instant");
  console.log("   - llama-large (高性能): llama-3.1-70b-versatile");
  console.log("   - mixtral: mixtral-8x7b-32768");
  console.log("   - gemma: gemma2-9b-it");
  console.log("");

  console.log("📌 演示1: 简单对话");
  console.log("问题: 你好，请介绍一下你自己");
  console.log("回答:");
  console.log(mockResponses.intro);
  console.log("");

  console.log("📌 演示2: 代码生成");
  console.log("问题: 用JavaScript写一个斐波那契数列函数");
  console.log("回答:");
  console.log(mockResponses.code);
  console.log("");

  console.log("📌 演示3: 大模型解释");
  console.log("问题: 解释一下什么是量子计算");
  console.log("回答:");
  console.log(mockResponses.quantum);
  console.log("");

  console.log("📌 演示4: 流式输出（模拟）");
  console.log("问题: 写一首关于编程的诗");
  console.log("回答:");
  console.log(mockResponses.poem);
  console.log("");

  console.log("✅ 模拟演示完成！");
}

// 执行演示
runDemo().catch(console.error);

// 导出
export { GroqClient, groq };