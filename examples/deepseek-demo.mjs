/**
 * DeepSeek API 使用示例
 * 
 * 支持 DeepSeek V3 和 V4 系列
 * 
 * V3 价格：¥1输入 / ¥2输出（每百万tokens）
 * V4-Flash 价格：¥0.2输入 / ¥0.8输出（每百万tokens）⭐ 超级便宜！
 * V4-Pro 价格：¥12输入 / ¥24输出（每百万tokens）
 * 
 * 官方网站：https://platform.deepseek.com/
 * 
 * 使用方法：
 * 1. 在 DeepSeek 开放平台获取 API Key
 * 2. 设置环境变量 DEEPSEEK_API_KEY
 * 3. 运行此脚本
 */

import fetch from 'node-fetch';

/**
 * DeepSeek 客户端
 */
class DeepSeekClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY;
    this.baseUrl = 'https://api.deepseek.com/v1';
    
    // 支持的模型
    this.models = {
      // V3 系列
      chat: 'deepseek-chat',           // DeepSeek-V3（默认）
      
      // V4 系列
      v4Flash: 'deepseek-v4-flash',   // DeepSeek-V4-Flash ⭐ 超级便宜！
      v4Pro: 'deepseek-v4-pro',       // DeepSeek-V4-Pro
      
      // 推理模型
     coder: 'deepseek-coder',         // 代码专用
      math: 'deepseek-math',           // 数学专用
    };
    
    this.currentModel = this.models.chat;
  }

  /**
   * 发送聊天请求
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('请设置 DEEPSEEK_API_KEY 环境变量');
    }

    const defaultOptions = {
      model: this.model,
      max_tokens: 2048,
      temperature: 0.7
    };

    const config = { ...defaultOptions, ...options };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
      throw new Error(error.error?.message || `API调用失败: ${response.statusText}`);
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
   * 对话补全（流式）
   */
  async streamMessage(prompt, onChunk) {
    if (!this.apiKey) {
      throw new Error('请设置 DEEPSEEK_API_KEY 环境变量');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
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
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content && onChunk) {
              onChunk(content);
            }
          }
        }
      }
    }
  }

  /**
   * 图像分析（需要 vision 模型）
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
            image_url: {
              url: imageUrl,
              detail: 'high'
            }
          }
        ]
      }
    ];

    const response = await this.chat(messages, {
      model: 'deepseek-chat' // 注意：V3可能不支持vision
    });
    return response.choices[0].message.content;
  }

  /**
   * 函数调用
   */
  async callFunction(prompt, tools) {
    const messages = [{ role: 'user', content: prompt }];
    
    const response = await this.chat(messages, {
      tools: tools
    });

    return response;
  }
}

// 创建默认客户端
const deepseek = new DeepSeekClient();

/**
 * 演示函数
 */
async function runDemo() {
  console.log("=".repeat(70));
  console.log("   DeepSeek API 演示");
  console.log("=".repeat(70));
  console.log("");
  console.log("📊 支持的模型：");
  console.log("");
  console.log("   V3 系列:");
  console.log("   - deepseek-chat        ¥1输入 / ¥2输出    DeepSeek-V3");
  console.log("");
  console.log("   V4 系列:");
  console.log("   ⭐ deepseek-v4-flash  ¥0.2输入 / ¥0.8输出  DeepSeek-V4-Flash（超级便宜！）");
  console.log("   - deepseek-v4-pro     ¥12输入 / ¥24输出   DeepSeek-V4-Pro");
  console.log("");
  console.log("   专用模型:");
  console.log("   - deepseek-coder      代码专用");
  console.log("   - deepseek-math       数学专用");
  console.log("");

  const client = new DeepSeekClient();

  // 检查API Key
  if (!client.apiKey) {
    console.log("❌ 未配置 DEEPSEEK_API_KEY");
    console.log("");
    console.log("📋 配置步骤：");
    console.log("");
    console.log("   1. 访问 https://platform.deepseek.com/");
    console.log("   2. 注册/登录账号");
    console.log("   3. 进入「API Keys」页面");
    console.log("   4. 点击「Create API Key」创建密钥");
    console.log("   5. 复制密钥并设置环境变量:");
    console.log("");
    console.log("      Windows: set DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx");
    console.log("      Linux/Mac: export DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx");
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

    // 1. 简单对话
    console.log("📌 演示1: 简单对话");
    console.log("问题: 什么是人工智能？");
    console.log("");
    const response1 = await client.sendMessage("什么是人工智能？请用简洁的语言解释");
    console.log("回答:", response1);
    console.log("");

    // 2. 代码生成
    console.log("📌 演示2: 代码生成");
    console.log("问题: 用Python写一个快速排序算法");
    console.log("");
    const response2 = await client.sendMessage("用Python写一个快速排序算法，要求代码简洁");
    console.log("回答:");
    console.log(response2);
    console.log("");

    // 3. 写作助手
    console.log("📌 演示3: 写作助手");
    console.log("问题: 写一封求职邮件");
    console.log("");
    const response3 = await client.sendMessage(
      "写一封求职邮件，应聘Python开发工程师职位",
      "你是一位专业的求职顾问，帮助用户撰写专业的求职邮件"
    );
    console.log("回答:", response3.substring(0, 200), "...");
    console.log("");

    // 4. 流式输出
    console.log("📌 演示4: 流式输出");
    console.log("问题: 讲一个关于程序员的小故事");
    console.log("");
    console.log("回答: ");
    await client.streamMessage("讲一个关于程序员的小故事", (chunk) => {
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
    console.log("   - 账户余额不足");
    console.log("   - 请求频率过高（限流）");
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * 模拟演示（无API Key时使用）
 */
function runMockDemo() {
  const mockResponses = {
    aiExplain: `人工智能（Artificial Intelligence，简称AI）是计算机科学的一个分支，它试图理解智能的本质，并生产出一种能够像人类一样进行感知、理解、学习、推理和决策的智能机器。

人工智能的核心技术包括：
1. 机器学习 - 让机器从数据中学习
2. 深度学习 - 模仿人脑的神经网络
3. 自然语言处理 - 理解和生成人类语言
4. 计算机视觉 - 识别和理解图像/视频`,

    codeSnippet: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

# 示例
arr = [3, 6, 8, 10, 1, 2, 1]
print(quicksort(arr))  # 输出: [1, 1, 2, 3, 6, 8, 10]`,

    email: `Subject: 应聘Python开发工程师 - 张三

尊敬的招聘负责人：

您好！

我叫张三，毕业于XX大学计算机专业，拥有3年Python开发经验。

我对贵公司的Python开发工程师职位非常感兴趣。我熟练掌握Python语言，精通Django、Flask等Web框架，有丰富的RESTful API开发经验。

期待能有机会与您进一步交流。

谢谢！

张三
联系电话: 138-xxxx-xxxx
邮箱: zhangsan@email.com`,

    story: `从前有一个程序员，他每天的工作就是写代码。有一天，他遇到了一个bug，怎么也解决不了。他整整花了一周时间，日夜奋战，终于找到了问题的根源——原来是一个分号惹的祸。

从那以后，他变得更加细心，每次写代码都会仔细检查每一行。他说："编程不仅仅是技术，更是一种艺术。"

这个故事告诉我们：细节决定成败。`
  };

  console.log("📌 演示1: 简单对话");
  console.log("问题: 什么是人工智能？");
  console.log("回答:");
  console.log(mockResponses.aiExplain);
  console.log("");

  console.log("📌 演示2: 代码生成");
  console.log("问题: 用Python写一个快速排序算法");
  console.log("回答:");
  console.log(mockResponses.codeSnippet);
  console.log("");

  console.log("📌 演示3: 写作助手");
  console.log("问题: 写一封求职邮件");
  console.log("回答:");
  console.log(mockResponses.email);
  console.log("");

  console.log("📌 演示4: 流式输出（模拟）");
  console.log("问题: 讲一个关于程序员的小故事");
  console.log("回答:");
  console.log(mockResponses.story);
  console.log("");

  console.log("✅ 模拟演示完成！");
}

// 执行演示
runDemo().catch(console.error);

// 导出
export { DeepSeekClient, deepseek };