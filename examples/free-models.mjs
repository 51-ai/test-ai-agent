/**
 * 免费模型 API 示例集
 * 
 * 包含多个免费/有免费额度的AI模型
 * 无需信用卡即可使用
 * 
 * 模型列表：
 * 1. DeepSeek V3 - 免费（性价比最高）
 * 2. 通义千问 Qwen-Turbo - 免费额度
 * 3. 智谱 GLM-3-Turbo - 免费额度
 * 4. Groq (LLaMA) - 免费（速度快）
 * 5. Cohere Command - 免费额度
 * 6. 豆包 - 免费额度
 */

import fetch from 'node-fetch';

/**
 * 模型配置
 */
const MODELS = {
  deepseek: {
    name: 'DeepSeek V3',
    provider: '深度求索',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    model: 'deepseek-chat',
    free: true,
    description: '性能强、成本低，中英文优秀'
  },
  
  qwen: {
    name: '通义千问 Qwen-Turbo',
    provider: '阿里云',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    model: 'qwen-turbo',
    free: true,
    description: '中文优化好，免费额度多'
  },
  
  glm: {
    name: '智谱 GLM-3-Turbo',
    provider: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
    model: 'glm-3-turbo',
    free: true,
    description: '中文能力强，适合学术'
  },
  
  groq: {
    name: 'Groq LLaMA',
    provider: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    model: 'llama-3.1-8b-instant',
    free: true,
    description: '速度快，适合实时应用'
  },
  
  cohere: {
    name: 'Cohere Command R',
    provider: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v2',
    apiKeyEnv: 'COHERE_API_KEY',
    model: 'command-r-plus-08-2024',
    free: true,
    description: '多语言支持，RAG优化'
  },
  
  doubao: {
    name: '豆包 Doubao',
    provider: '字节跳动',
    baseUrl: 'https://api.doubao.com',
    apiKeyEnv: 'DOUBAN_API_KEY',
    model: 'Doubao-3',
    free: true,
    description: '响应快，免费额度多'
  }
};

/**
 * AI客户端基类
 */
class BaseAIClient {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : null;
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error(`请设置 ${this.config.apiKeyEnv} 环境变量`);
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        max_tokens: options.max_tokens || 2048,
        temperature: options.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API调用失败: ${response.status}`);
    }

    return await response.json();
  }

  async sendMessage(prompt, systemPrompt = '') {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages);
    return response.choices[0].message.content;
  }
}

// 为每个模型创建客户端
const clients = {};
Object.entries(MODELS).forEach(([key, config]) => {
  clients[key] = new BaseAIClient(config);
});

/**
 * 演示函数
 */
async function runDemo(modelKey = null) {
  const targetModels = modelKey ? [modelKey] : Object.keys(MODELS);

  console.log("=".repeat(70));
  console.log("   免费模型 API 示例集");
  console.log("=".repeat(70));
  console.log("");

  // 显示可用模型
  console.log("📋 可用模型列表：");
  console.log("");
  Object.entries(MODELS).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(10)} | ${config.name.padEnd(25)} | ${config.provider.padEnd(10)} | ${config.free ? '✅ 免费' : '❌ 付费'}`);
  });
  console.log("");

  // 检查环境变量
  const configuredModels = Object.entries(MODELS)
    .filter(([key, config]) => process.env[config.apiKeyEnv])
    .map(([key]) => key);

  if (configuredModels.length === 0) {
    console.log("⚠️  未检测到已配置的API密钥");
    console.log("");
    console.log("📝 请选择要配置的模型：");
    console.log("");
    console.log("   1. DeepSeek V3 (推荐)");
    console.log("      获取地址: https://platform.deepseek.com/");
    console.log("      设置命令: set DEEPSEEK_API_KEY=your-key");
    console.log("");
    console.log("   2. 通义千问 Qwen");
    console.log("      获取地址: https://dashscope.console.aliyun.com/");
    console.log("      设置命令: set DASHSCOPE_API_KEY=your-key");
    console.log("");
    console.log("   3. 智谱 GLM");
    console.log("      获取地址: https://open.bigmodel.cn/");
    console.log("      设置命令: set ZHIPU_API_KEY=your-key");
    console.log("");
    console.log("   4. Groq LLaMA (速度快)");
    console.log("      获取地址: https://console.groq.com/");
    console.log("      设置命令: set GROQ_API_KEY=your-key");
    console.log("");
    console.log("   5. 豆包 Doubao");
    console.log("      获取地址: https://www.doubao.com/");
    console.log("      设置命令: set DOUBAN_API_KEY=your-key");
    console.log("");
    
    // 运行模拟演示
    console.log("=".repeat(70));
    console.log("   运行模拟演示...");
    console.log("=".repeat(70));
    console.log("");
    
    runMockDemo();
    return;
  }

  console.log(`✅ 已配置模型: ${configuredModels.join(', ')}`);
  console.log("");

  // 测试已配置的模型
  for (const key of configuredModels) {
    try {
      const config = MODELS[key];
      console.log(`📌 测试 ${config.name}...`);
      
      const response = await clients[key].sendMessage("用一句话介绍你自己");
      console.log(`   回答: ${response.substring(0, 100)}...`);
      console.log("");
    } catch (error) {
      console.log(`   ❌ 调用失败: ${error.message}`);
      console.log("");
    }
  }
}

/**
 * 模拟演示
 */
function runMockDemo() {
  const mockResponses = {
    deepseek: {
      question: "用一句话介绍你自己",
      answer: "我是DeepSeek V3，一个由深度求索公司开发的强大AI助手，专注于提供高质量、低成本的智能服务。"
    },
    qwen: {
      question: "用一句话介绍你自己",
      answer: "我是通义千问，阿里巴巴达摩院研发的大语言模型，擅长中文理解和生成，致力于为用户提供智能服务。"
    },
    glm: {
      question: "用一句话介绍你自己",
      answer: "我是智谱GLM-4，由智谱AI自主研发，专注于中文语义理解和知识问答，致力于降低AI使用门槛。"
    },
    groq: {
      question: "用一句话介绍你自己",
      answer: "我是Groq LLaMA，运行在Groq的AI加速器上，以极快的响应速度为您提供高质量的对话服务。"
    },
    doubao: {
      question: "用一句话介绍你自己",
      answer: "我是豆包，字节跳动推出的AI助手，专注于为用户提供智能、便捷、有趣的对话体验。"
    }
  };

  Object.entries(mockResponses).forEach(([key, data]) => {
    console.log(`📌 ${MODELS[key].name}`);
    console.log(`   问题: ${data.question}`);
    console.log(`   回答: ${data.answer}`);
    console.log("");
  });

  console.log("✅ 模拟演示完成！");
}

/**
 * 单独测试某个模型
 */
async function testModel(modelKey) {
  if (!MODELS[modelKey]) {
    console.log(`❌ 未知的模型: ${modelKey}`);
    console.log("可用模型:", Object.keys(MODELS).join(', '));
    return;
  }

  const config = MODELS[modelKey];
  
  if (!process.env[config.apiKeyEnv]) {
    console.log(`❌ 请先设置 ${config.apiKeyEnv} 环境变量`);
    console.log(`   获取地址: https://platform.deepseek.com/`);
    return;
  }

  console.log(`🚀 测试 ${config.name}...`);
  console.log("");

  try {
    const response = await clients[modelKey].sendMessage(
      "写一首关于春天的诗",
      "你是一位诗人"
    );
    
    console.log("📝 生成结果:");
    console.log(response);
    console.log("");
    console.log("✅ 测试成功！");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const modelKey = args[1];

  switch (command) {
    case 'test':
      await testModel(modelKey || 'deepseek');
      break;
    case 'list':
      console.log("\n可用模型:");
      Object.entries(MODELS).forEach(([key, config]) => {
        console.log(`  - ${key}: ${config.name} (${config.provider})`);
      });
      break;
    default:
      await runDemo();
  }
}

// 执行
main().catch(console.error);

// 导出
export { MODELS, clients, BaseAIClient };
export default MODELS;