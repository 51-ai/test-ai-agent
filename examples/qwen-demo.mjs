/**
 * 通义千问 Qwen API 示例
 * 
 * 阿里云 - 国内可访问、中文优化好
 * 官方网站：https://dashscope.console.aliyun.com/
 * 
 * 特点：
 * 1. ✅ 国内可直接访问（无需代理）
 * 2. ✅ 中文优化最好
 * 3. ✅ 有免费额度
 * 4. ✅ 部分模型开源可本地部署
 * 
 * 使用方法：
 * 1. 在阿里云百炼获取 API Key
 * 2. 设置环境变量 DASHSCOPE_API_KEY
 * 3. 运行此脚本
 */

import fetch from 'node-fetch';

/**
 * 通义千问客户端
 */
class QwenClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.DASHSCOPE_API_KEY;
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    
    // 支持的模型
    this.models = {
      turbo: 'qwen-turbo',           // 快速，适合日常对话
      plus: 'qwen-plus',             // 高性能，适合复杂任务
      max: 'qwen-max',              // 最强性能
      maxLongContext: 'qwen-max-longtext', // 长文本
      audioTurbo: 'qwen-audio-turbo', // 音频模型
    };
  }

  /**
   * 发送聊天请求
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('请设置 DASHSCOPE_API_KEY 环境变量');
    }

    const model = options.model || this.models.turbo;

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
  async sendMessage(prompt, systemPrompt = '', model = 'turbo') {
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
      throw new Error('请设置 DASHSCOPE_API_KEY 环境变量');
    }

    const model = options.model || this.models.turbo;

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
   * 获取可用模型
   */
  getAvailableModels() {
    return {
      'qwen-turbo (快速)': this.models.turbo,
      'qwen-plus (高性能)': this.models.plus,
      'qwen-max (最强)': this.models.max,
      'qwen-max-longtext (长文本)': this.models.maxLongContext,
    };
  }
}

// 创建默认客户端
const qwen = new QwenClient();

/**
 * 演示函数
 */
async function runDemo() {
  console.log("=".repeat(70));
  console.log("   通义千问 Qwen API 演示");
  console.log("=".repeat(70));
  console.log("");
  console.log("✅ 国内可直接访问！无需代理！");
  console.log("");
  console.log("📊 模型信息：");
  console.log("   - 名称: 通义千问 Qwen");
  console.log("   - 厂商: 阿里云");
  console.log("   - 特点: 中文优化最好、国内可访问、有免费额度");
  console.log("   - 模型: Qwen-Turbo, Qwen-Plus, Qwen-Max");
  console.log("");

  const client = new QwenClient();

  // 检查API Key
  if (!client.apiKey) {
    console.log("❌ 未配置 DASHSCOPE_API_KEY");
    console.log("");
    console.log("📋 配置步骤（国内可直接访问）：");
    console.log("");
    console.log("   1. 访问 https://dashscope.console.aliyun.com/");
    console.log("   2. 使用淘宝/支付宝/阿里云账号登录");
    console.log("   3. 进入「API-KEY管理」页面");
    console.log("   4. 点击「创建API-KEY」创建密钥");
    console.log("   5. 复制密钥并设置环境变量:");
    console.log("");
    console.log("      Windows: set DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx");
    console.log("      Linux/Mac: export DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx");
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

    // 2. 中文写作
    console.log("📌 演示2: 中文写作");
    console.log("问题: 写一首关于春天的古诗");
    console.log("");
    const response2 = await client.sendMessage(
      "写一首关于春天的七言绝句",
      "你是一位精通古典诗词的诗人"
    );
    console.log("回答:", response2);
    console.log("");

    // 3. 代码生成
    console.log("📌 演示3: 代码生成");
    console.log("问题: 用Python写一个快速排序");
    console.log("");
    const response3 = await client.sendMessage("用Python写一个快速排序算法");
    console.log("回答:");
    console.log(response3);
    console.log("");

    // 4. 流式输出
    console.log("📌 演示4: 流式输出");
    console.log("问题: 讲一个程序员的故事");
    console.log("");
    console.log("回答: ");
    await client.streamMessage("讲一个关于程序员的有趣故事", {}, (chunk) => {
      process.stdout.write(chunk);
    });
    console.log("");
    console.log("");

    console.log("✅ 演示完成！");
    
  } catch (error) {
    console.error("❌ 调用失败:", error.message);
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * 模拟演示
 */
function runMockDemo() {
  const mockResponses = {
    intro: `你好！我是通义千问，由阿里云开发的大语言模型。

我的特点：
1. 🌐 中文优化最好 - 特别擅长中文理解和生成
2. 🆓 免费额度多 - 新用户有丰富的免费额度
3. ⚡ 国内可访问 - 无需代理，直接访问
4. 🤖 多场景支持 - 对话、写作、代码、分析

我可以帮助你：
- 回答各种问题
- 写作创作（文章、诗歌、故事）
- 编写和分析代码
- 翻译和解释
- 数据分析和总结

有什么我可以帮你的吗？`,

    poem: `【七言绝句·春】

东风吹绿江南岸，
柳絮飞舞映碧天。
桃李争妍春色好，
踏青赏景乐无边。`,

    code: `# 快速排序算法 - Python

def quicksort(arr):
    """
    快速排序算法
    时间复杂度: 平均 O(n log n)，最坏 O(n²)
    空间复杂度: O(log n)
    """
    if len(arr) <= 1:
        return arr
    
    # 选择基准元素（这里选择中间元素）
    pivot = arr[len(arr) // 2]
    
    # 分区
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    
    # 递归排序并合并
    return quicksort(left) + middle + quicksort(right)

# 示例
arr = [3, 6, 8, 10, 1, 2, 1, 5]
print(quicksort(arr))  # 输出: [1, 1, 2, 3, 5, 6, 8, 10]`,

    story: `从前有一个程序员，他每天的工作就是写代码。

有一天，产品经理又双叒叕改需求了！

程序员深呼吸了三次，然后打开电脑，开始敲代码。

"这个需求很简单，只需要改三行代码..." 他自言自语。

三小时后...
"为什么会有这么多bug？？？"

又过了两小时，他终于解决了所有问题。

第二天，他学会了：永远不要说"这个需求很简单"。`
  };

  console.log("📋 可用模型：");
  console.log("   - qwen-turbo (快速): 适合日常对话");
  console.log("   - qwen-plus (高性能): 适合复杂任务");
  console.log("   - qwen-max (最强): 最佳性能");
  console.log("   - qwen-max-longtext (长文本): 处理长文本");
  console.log("");

  console.log("📌 演示1: 简单对话");
  console.log("问题: 你好，请介绍一下你自己");
  console.log("回答:");
  console.log(mockResponses.intro);
  console.log("");

  console.log("📌 演示2: 中文古诗");
  console.log("问题: 写一首关于春天的七言绝句");
  console.log("回答:");
  console.log(mockResponses.poem);
  console.log("");

  console.log("📌 演示3: 代码生成");
  console.log("问题: 用Python写一个快速排序");
  console.log("回答:");
  console.log(mockResponses.code);
  console.log("");

  console.log("📌 演示4: 流式输出（模拟）");
  console.log("问题: 讲一个程序员的故事");
  console.log("回答:");
  console.log(mockResponses.story);
  console.log("");

  console.log("✅ 模拟演示完成！");
}

// 执行演示
runDemo().catch(console.error);

// 导出
export { QwenClient, qwen };