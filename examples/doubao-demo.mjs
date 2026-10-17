/**
 * 豆包 API 使用示例
 * 
 * 豆包是字节跳动推出的AI助手
 * 官方网站：https://www.doubao.com/
 * 
 * 使用方法：
 * 1. 在豆包开放平台获取API Key
 * 2. 设置环境变量 DOUBAN_API_KEY
 * 3. 运行此脚本
 */

import fetch from 'node-fetch';

/**
 * 豆包客户端
 */
class DoubaoClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.DOUBAN_API_KEY;
    this.baseUrl = 'https://api.doubao.com';
  }

  /**
   * 发送聊天请求
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('请设置 DOUBAN_API_KEY 环境变量');
    }

    const defaultOptions = {
      model: 'Doubao-3',
      max_tokens: 2048,
      temperature: 0.7
    };

    const config = { ...defaultOptions, ...options };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        max_tokens: config.max_tokens,
        temperature: config.temperature
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API调用失败: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 简单对话
   */
  async sendMessage(prompt, systemPrompt = '') {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages);
    return response.choices[0].message.content;
  }

  /**
   * 图像分析（豆包支持多模态）
   */
  async analyzeImage(imageUrl, question = '描述这张图片') {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: question
          },
          {
            type: 'image_url',
            image_url: imageUrl
          }
        ]
      }
    ];

    const response = await this.chat(messages);
    return response.choices[0].message.content;
  }

  /**
   * 工具调用
   */
  async callFunction(prompt, tools) {
    const messages = [{ role: 'user', content: prompt }];
    
    const response = await this.chat(messages, {
      tools: tools,
      tool_choice: 'auto'
    });

    return response;
  }
}

/**
 * 演示函数
 */
async function runDemo() {
  console.log("=".repeat(60));
  console.log("   豆包 API 演示");
  console.log("=".repeat(60));
  console.log("");

  const client = new DoubaoClient();

  // 检查API Key
  if (!client.apiKey) {
    console.log("❌ 未配置 DOUBAN_API_KEY");
    console.log("");
    console.log("📋 配置步骤：");
    console.log("   1. 访问 https://www.doubao.com/");
    console.log("   2. 注册账号并获取API Key");
    console.log("   3. 设置环境变量:");
    console.log("      set DOUBAN_API_KEY=your-api-key");
    console.log("");
    console.log("💡 正在使用模拟模式演示...");
    console.log("");
    
    // 模拟演示
    runMockDemo();
    return;
  }

  try {
    // 1. 简单对话
    console.log("📌 演示1: 简单对话");
    const response1 = await client.sendMessage("写一个关于春天的诗歌");
    console.log("回答:", response1.substring(0, 100), "...");
    console.log("");

    // 2. 带系统提示
    console.log("📌 演示2: 带系统提示");
    const response2 = await client.sendMessage(
      "解释什么是人工智能",
      "你是一位专业的AI科普专家，用简单易懂的语言解释复杂概念"
    );
    console.log("回答:", response2.substring(0, 100), "...");
    console.log("");

    // 3. 图像分析
    console.log("📌 演示3: 图像分析");
    try {
      const imageResult = await client.analyzeImage(
        "https://example.com/image.jpg",
        "描述这张图片"
      );
      console.log("分析结果:", imageResult.substring(0, 100), "...");
    } catch (error) {
      console.log("⚠️ 图像分析需要特殊权限:", error.message);
    }
    console.log("");

    console.log("✅ 演示完成！");
    
  } catch (error) {
    console.error("❌ 调用失败:", error.message);
    console.log("");
    console.log("💡 可能的原因：");
    console.log("   - API Key 不正确");
    console.log("   - 网络连接问题");
    console.log("   - 账户余额不足");
  }

  console.log("\n" + "=".repeat(60));
}

/**
 * 模拟演示（无API Key时使用）
 */
function runMockDemo() {
  const mockResponses = {
    poem: `春天来了
冰雪消融，万物复苏
小草从土里探出头
花儿在枝头绽放

春风轻轻吹拂
带来温暖和希望
小鸟欢快地歌唱
迎接这美好的时光`,
    
    aiExplain: `人工智能（AI）是计算机科学的一个分支，它致力于研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统。简单来说，AI就是让计算机能够像人一样思考和学习。`,
    
    imageAnalysis: `这张图片展示了一个美丽的场景，包含自然风光和人文元素。整体画面色彩丰富，构图精美，给人一种宁静和谐的感觉。`
  };

  console.log("📌 演示1: 简单对话");
  console.log("提问: 写一个关于春天的诗歌");
  console.log("回答:", mockResponses.poem);
  console.log("");

  console.log("📌 演示2: AI概念解释");
  console.log("提问: 什么是人工智能");
  console.log("回答:", mockResponses.aiExplain);
  console.log("");

  console.log("📌 演示3: 图像分析");
  console.log("图片: https://example.com/image.jpg");
  console.log("分析:", mockResponses.imageAnalysis);
  console.log("");

  console.log("✅ 模拟演示完成！");
}

// 执行演示
runDemo().catch(console.error);