/**
 * DeepSeek V4-Flash 专用测试
 * 
 * 使用方法：
 * 1. 设置环境变量: set DEEPSEEK_API_KEY=your-key
 * 2. 运行: node examples/v4-flash-test.mjs
 */

import fetch from 'node-fetch';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = 'deepseek-v4-flash';

async function testV4Flash() {
  console.log("=".repeat(70));
  console.log("   DeepSeek V4-Flash 真实测试");
  console.log("=".repeat(70));
  console.log("");
  console.log(`📋 模型: ${MODEL}`);
  console.log(`🔑 API Key: ${API_KEY ? "已设置" : "未设置"}`);
  console.log("");

  if (!API_KEY) {
    console.log("❌ 未设置 API Key！");
    console.log("");
    console.log("请先设置环境变量：");
    console.log("   Windows: set DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx");
    console.log("   Linux/Mac: export DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx");
    console.log("");
    console.log("获取 API Key: https://platform.deepseek.com/api_keys");
    console.log("");
    runMockTest();
    return;
  }

  console.log("🚀 开始测试...\n");

  try {
    // 测试1: 简单对话
    console.log("📌 测试1: 简单对话");
    console.log("问题: 你好，请介绍一下DeepSeek V4");
    const response1 = await chat("你好，请介绍一下DeepSeek V4");
    console.log("回答:", response1);
    console.log("");

    // 测试2: 代码生成
    console.log("📌 测试2: 代码生成");
    console.log("问题: 用JavaScript写一个快速排序");
    const response2 = await chat("用JavaScript写一个快速排序算法");
    console.log("回答:", response2);
    console.log("");

    // 测试3: 中文理解
    console.log("📌 测试3: 中文理解");
    console.log("问题: 解释一下什么是人工智能");
    const response3 = await chat("解释一下什么是人工智能，尽量简洁");
    console.log("回答:", response3);
    console.log("");

    console.log("✅ 测试完成！");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.log("");
    console.log("可能原因：");
    console.log("1. API Key 无效");
    console.log("2. 网络连接问题");
    console.log("3. 账户余额不足");
    console.log("");
    console.log("💡 建议：");
    console.log("1. 检查 API Key 是否正确");
    console.log("2. 访问 https://platform.deepseek.com/ 查看账户状态");
    runMockTest();
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * 调用 DeepSeek API
 */
async function chat(message) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API错误: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 模拟测试
 */
function runMockTest() {
  console.log("=".repeat(70));
  console.log("   模拟测试（未配置API Key）");
  console.log("=".repeat(70));
  console.log("");

  console.log("📌 测试1: 简单对话");
  console.log("回答: DeepSeek V4 是深度求索公司发布的新一代大模型，");
  console.log("      包括V4-Flash和V4-Pro两个版本。");
  console.log("      V4-Flash价格超级便宜：¥0.2/百万tokens！");
  console.log("");

  console.log("📌 测试2: 代码生成");
  console.log("回答: function quickSort(arr) {");
  console.log("        if (arr.length <= 1) return arr;");
  console.log("        const pivot = arr[Math.floor(arr.length / 2)];");
  console.log("        const left = arr.filter(x => x < pivot);");
  console.log("        const middle = arr.filter(x => x === pivot);");
  console.log("        const right = arr.filter(x => x > pivot);");
  console.log("        return [...quickSort(left), ...middle, ...quickSort(right)];");
  console.log("      }");
  console.log("");

  console.log("📌 测试3: 中文理解");
  console.log("回答: 人工智能（AI）是让机器具有人类智能的技术，");
  console.log("      包括学习、推理、理解语言、识别图像等能力。");
  console.log("");

  console.log("✅ 模拟测试完成！");
  console.log("");
  console.log("💡 配置真实 API Key 后即可运行真实测试");
  console.log("   获取地址: https://platform.deepseek.com/");
}

testV4Flash().catch(console.error);
