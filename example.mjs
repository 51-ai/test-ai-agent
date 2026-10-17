import OpenAI from "openai";

// 创建OpenAI客户端
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // 从环境变量读取API密钥
});

async function main() {
  try {
    // 调用Chat Completions API
    const response = await client.chat.completions.create({
      model: "gpt-4o", // 使用gpt-4o模型（gpt-5.5尚未发布）
      messages: [
        { role: "system", content: "你是一个富有想象力的故事讲述者" },
        { role: "user", content: "Write a one-sentence bedtime story about a unicorn." }
      ],
      max_tokens: 100
    });

    // 输出结果
    console.log(response.choices[0].message.content);
    
  } catch (error) {
    console.error("调用失败:", error.message);
    console.log("\n💡 提示: 请在环境变量中设置OPENAI_API_KEY");
  }
}

main();