/**
 * Ollama 本地模型使用示例
 * 
 * Ollama - 真正完全免费！
 * 官方网站：https://ollama.com/
 * 
 * 特点：
 * 1. ✅ 完全免费（无任何费用）
 * 2. ✅ 完全离线可用（无需网络）
 * 3. ✅ 数据完全私密（本地运行）
 * 4. ✅ 支持多种开源模型
 * 
 * 支持的模型：
 * - llama3.2 (最新)
 * - qwen2.5 (通义千问)
 * - deepseek-r1
 * - mistral
 * - gemma
 * - codellama (编程)
 * - 和更多...
 * 
 * 使用方法：
 * 1. 下载安装 Ollama
 * 2. 运行模型
 * 3. 运行此脚本
 */

import fetch from 'node-fetch';

/**
 * Ollama 客户端
 */
class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = 'llama3.2';
  }

  /**
   * 检查 Ollama 是否运行
   */
  async isRunning() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        timeout: 3000
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error('无法获取模型列表');
    }
    const data = await response.json();
    return data.models || [];
  }

  /**
   * 发送聊天请求
   */
  async chat(messages, options = {}) {
    const model = options.model || this.model;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: options.stream || false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama 请求失败: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 简单对话
   */
  async sendMessage(prompt, model = 'llama3.2') {
    const response = await this.chat([
      { role: 'user', content: prompt }
    ], { model });

    return response.message.content;
  }

  /**
   * 流式输出
   */
  async streamMessage(prompt, onChunk, model = 'llama3.2') {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama 请求失败: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content && onChunk) {
              onChunk(data.message.content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }

  /**
   * 生成（不带消息历史）
   */
  async generate(prompt, model = 'llama3.2') {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama 请求失败: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 下载模型
   */
  async pullModel(modelName) {
    console.log(`📥 正在下载模型: ${modelName}`);
    console.log("   首次下载需要一些时间，请耐心等待...\n");

    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.statusText}`);
    }

    // 流式读取下载进度
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              console.log(`   ${data.status}`);
            }
            if (data.total) {
              const progress = ((data.completed / data.total) * 100).toFixed(1);
              process.stdout.write(`\r   下载进度: ${progress}%`);
            }
          } catch (e) {
            // 忽略
          }
        }
      }
    }
    console.log("\n✅ 下载完成！");
  }
}

// 创建默认客户端
const ollama = new OllamaClient();

/**
 * 演示函数
 */
async function runDemo() {
  console.log("=".repeat(70));
  console.log("   Ollama 本地模型演示");
  console.log("=".repeat(70));
  console.log("");
  console.log("🎉 真正完全免费！无需网络！无需注册！");
  console.log("");
  console.log("📊 模型信息：");
  console.log("   - 名称: Ollama 本地模型");
  console.log("   - 特点: 完全免费、离线可用、数据私密");
  console.log("   - 模型: LLaMA, Qwen, DeepSeek, Mistral, Gemma 等");
  console.log("");

  // 检查 Ollama 是否运行
  console.log("🔍 检查 Ollama 服务状态...");
  
  const isRunning = await ollama.isRunning();
  
  if (!isRunning) {
    console.log("");
    console.log("❌ Ollama 未运行");
    console.log("");
    console.log("📋 安装步骤：");
    console.log("");
    console.log("   1️⃣ 下载 Ollama");
    console.log("      访问: https://ollama.com/download");
    console.log("      下载 Windows 版本并安装");
    console.log("");
    console.log("   2️⃣ 启动 Ollama");
    console.log("      安装完成后，Ollama 会自动启动");
    console.log("      你也可以在终端运行: ollama serve");
    console.log("");
    console.log("   3️⃣ 下载模型（首次需要）");
    console.log("      运行命令下载模型:");
    console.log("      ollama pull llama3.2");
    console.log("");
    console.log("   4️⃣ 运行示例");
    console.log("      重启此脚本");
    console.log("");
    console.log("💡 正在使用模拟模式演示...");
    console.log("");
    runMockDemo();
    return;
  }

  try {
    console.log("✅ Ollama 已运行！");
    console.log("");

    // 获取可用模型
    console.log("📋 获取可用模型...");
    const models = await ollama.getModels();
    
    if (models.length === 0) {
      console.log("⚠️ 未安装任何模型");
      console.log("");
      console.log("📥 请先下载模型：");
      console.log("");
      console.log("   ollama pull llama3.2      # 推荐！最新最轻量");
      console.log("   ollama pull qwen2.5       # 通义千问");
      console.log("   ollama pull deepseek-r1   # DeepSeek");
      console.log("   ollama pull codellama     # 代码专用");
      console.log("");
      console.log("💡 正在使用模拟模式演示...");
      console.log("");
      runMockDemo();
      return;
    }

    console.log(`✅ 已安装 ${models.length} 个模型:`);
    models.forEach(m => console.log(`   - ${m.name}`));
    console.log("");

    // 使用第一个模型
    const modelName = models[0].name;

    // 1. 简单对话
    console.log("📌 演示1: 简单对话");
    console.log(`使用模型: ${modelName}`);
    console.log("问题: 你好，请介绍一下你自己");
    console.log("");
    const response1 = await ollama.sendMessage("你好，请介绍一下你自己", modelName);
    console.log("回答:", response1);
    console.log("");

    // 2. 代码生成
    console.log("📌 演示2: 代码生成");
    console.log("问题: 用Python写一个快速排序");
    console.log("");
    const response2 = await ollama.sendMessage("用Python写一个快速排序算法", modelName);
    console.log("回答:");
    console.log(response2);
    console.log("");

    // 3. 流式输出
    console.log("📌 演示3: 流式输出");
    console.log("问题: 讲一个关于AI的有趣故事");
    console.log("");
    console.log("回答: ");
    await ollama.streamMessage("讲一个关于人工智能的有趣故事", (chunk) => {
      process.stdout.write(chunk);
    }, modelName);
    console.log("");
    console.log("");

    console.log("✅ 演示完成！");
    
  } catch (error) {
    console.error("❌ 演示失败:", error.message);
    console.log("");
    console.log("💡 提示:");
    console.log("   - 确保 Ollama 已安装并运行");
    console.log("   - 确保已下载模型");
    console.log("   - 检查 localhost:11434 是否可访问");
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * 模拟演示
 */
function runMockDemo() {
  const mockResponses = {
    intro: `你好！我是 Ollama 本地运行的 AI 助手。

我的特点：
1. 🎉 完全免费 - 无需付费，无使用限制
2. 🔒 数据私密 - 所有数据都在本地处理
3. 🌐 离线可用 - 无需网络连接
4. ⚡ 响应快速 - 本地运行，无需等待

我是基于开源大模型运行的，包括：
- LLaMA (Meta)
- Qwen (阿里)
- DeepSeek
- Mistral
- Gemma (Google)
- Codellama (编程专用)

有什么我可以帮你的吗？`,

    code: `# 快速排序算法 - Python

def quicksort(arr):
    """
    快速排序算法实现
    时间复杂度: O(n log n)
    """
    if len(arr) <= 1:
        return arr
    
    # 选择中间元素作为基准
    pivot = arr[len(arr) // 2]
    
    # 分区
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    
    # 递归排序并合并
    return quicksort(left) + middle + quicksort(right)

# 测试
arr = [3, 6, 8, 10, 1, 2, 1, 5]
print("原数组:", arr)
print("排序后:", quicksort(arr))`,

    story: `从前有一个人工智能，它总是在等待用户的输入。

有一天，一个程序员问它："你会取代人类吗？"

AI 思考了一下，回答："不会。"

"因为，" AI 继续说，"我可以帮你写代码、回答问题，但无法帮你去洗手间。"

程序员笑了。

"而且，" AI 补充道，"就算我可以帮你做所有事情，我也不知道为什么早上起床要叠被子。"

程序员笑得更开心了。

"最重要的是，" AI 最后说，"我无法理解为什么人类这么喜欢发 emoji 😂"

程序员沉默了三秒，然后默默关掉了电脑。

（以上故事由本地 AI 生成，完全免费）`
  };

  console.log("📌 演示1: 简单对话");
  console.log("问题: 你好，请介绍一下你自己");
  console.log("回答:");
  console.log(mockResponses.intro);
  console.log("");

  console.log("📌 演示2: 代码生成");
  console.log("问题: 用Python写一个快速排序");
  console.log("回答:");
  console.log(mockResponses.code);
  console.log("");

  console.log("📌 演示3: 流式输出（模拟）");
  console.log("问题: 讲一个关于AI的有趣故事");
  console.log("回答:");
  console.log(mockResponses.story);
  console.log("");

  console.log("✅ 模拟演示完成！");
}

// 执行
runDemo().catch(console.error);

// 导出
export { OllamaClient, ollama };