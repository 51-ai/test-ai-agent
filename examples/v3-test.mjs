/**
 * DeepSeek V3 测试（更便宜，额度可能还有）
 */

import fetch from 'node-fetch';

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = 'deepseek-chat';  // V3 模型

async function testV3() {
  console.log("=".repeat(70));
  console.log("   DeepSeek V3 测试（更便宜）");
  console.log("=".repeat(70));
  console.log("");
  console.log(`📋 模型: ${MODEL} (V3)`);
  console.log(`💰 价格: ¥1输入 / ¥2输出（每百万tokens）`);
  console.log("");

  console.log("🚀 开始测试...\n");

  try {
    // 测试1: 简单对话
    console.log("📌 测试1: 简单对话");
    console.log("问题: 你好，请介绍一下DeepSeek");
    const response1 = await chat("你好，请介绍一下DeepSeek");
    console.log("回答:", response1);
    console.log("");

    // 测试2: 代码生成
    console.log("📌 测试2: 代码生成");
    console.log("问题: 用Python写一个快速排序");
    const response2 = await chat("用Python写一个快速排序算法");
    console.log("回答:", response2);
    console.log("");

    console.log("✅ 测试完成！");
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }

  console.log("\n" + "=".repeat(70));
}

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

testV3().catch(console.error);
