/**
 * 通义千问 Qwen 测试
 * 
 * 特点：
 * - 有免费额度
 * - 国内可直接访问
 * - 中文优化最好
 * 
 * 获取 API Key：https://dashscope.console.aliyun.com/
 */

import fetch from 'node-fetch';

const API_KEY = process.env.DASHSCOPE_API_KEY;
const MODEL = 'qwen-turbo';

async function testQwen() {
  console.log("=".repeat(70));
  console.log("   通义千问 Qwen 测试");
  console.log("=".repeat(70));
  console.log("");
  console.log(`📋 模型: ${MODEL}`);
  console.log(`🔑 API Key: ${API_KEY ? "已设置" : "未设置"}`);
  console.log("");

  if (!API_KEY) {
    console.log("❌ 未设置 API Key！");
    console.log("");
    console.log("📋 获取步骤：");
    console.log("   1. 访问 https://dashscope.console.aliyun.com/");
    console.log("   2. 使用淘宝/支付宝账号登录");
    console.log("   3. 创建 API Key");
    console.log("   4. 设置环境变量: set DASHSCOPE_API_KEY=你的key");
    console.log("");
    runMockTest();
    return;
  }

  console.log("🚀 开始测试...\n");

  try {
    // 测试1: 简单对话
    console.log("📌 测试1: 简单对话");
    console.log("问题: 你好，请介绍一下通义千问");
    const response1 = await chat("你好，请介绍一下通义千问");
    console.log("回答:", response1);
    console.log("");

    // 测试2: 代码生成
    console.log("📌 测试2: 代码生成");
    console.log("问题: 用Python写一个快速排序");
    const response2 = await chat("用Python写一个快速排序算法");
    console.log("回答:", response2);
    console.log("");

    // 测试3: 中文理解
    console.log("📌 测试3: 中文理解");
    console.log("问题: 解释一下什么是大模型");
    const response3 = await chat("解释一下什么是大语言模型，尽量简洁");
    console.log("回答:", response3);
    console.log("");

    console.log("✅ 测试完成！");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.log("");
    runMockTest();
  }

  console.log("\n" + "=".repeat(70));
}

/**
 * 调用通义千问 API
 */
async function chat(message) {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      input: {
        prompt: message
      },
      parameters: {
        max_tokens: 500,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API错误: ${response.status}`);
  }

  const data = await response.json();
  return data.output?.text || data.output?.choices?.[0]?.text || '无输出';
}

/**
 * 模拟测试
 */
function runMockTest() {
  console.log("=".repeat(70));
  console.log("   模拟测试");
  console.log("=".repeat(70));
  console.log("");

  console.log("📌 测试1: 简单对话");
  console.log("回答: 通义千问是阿里云推出的大语言模型，");
  console.log("      支持中文和多种语言，具有强大的理解和生成能力。");
  console.log("");

  console.log("📌 测试2: 代码生成");
  console.log("回答: def quicksort(arr):");
  console.log("          if len(arr) <= 1: return arr");
  console.log("          pivot = arr[len(arr) // 2]");
  console.log("          return quicksort([x for x in arr if x < pivot]) + \\");
  console.log("                 [pivot] * arr.count(pivot) + \\");
  console.log("                 quicksort([x for x in arr if x > pivot])");
  console.log("");

  console.log("📌 测试3: 中文理解");
  console.log("回答: 大语言模型(LLM)是基于海量文本数据训练的人工智能模型，");
  console.log("      能够理解和生成自然语言文本。");
  console.log("");

  console.log("✅ 模拟测试完成！");
}

testQwen().catch(console.error);
