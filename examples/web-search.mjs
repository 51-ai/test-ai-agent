import OpenAI from "openai";

const client = new OpenAI();

/**
 * Web Search 工具示例
 * 
 * 注意：Web Search 是 OpenAI 的新功能
 * 当前版本可能需要使用 Assistants API 或自定义实现
 */

async function webSearchExample() {
  try {
    // 方式1：使用 Chat Completions API（模拟Web搜索）
    console.log("=== 方式1：Chat Completions API ===");
    
    const response1 = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant with access to web search capabilities. When asked about current events, provide the most relevant and up-to-date information you know."
        },
        {
          role: "user",
          content: "What was a positive news story from today?"
        }
      ],
      max_tokens: 500
    });

    console.log("回答:", response1.choices[0].message.content);

    // 方式2：使用 Assistants API（如果需要真实Web搜索）
    console.log("\n=== 方式2：Assistants API ===");
    
    const assistant = await client.beta.assistants.create({
      name: "Web Search Assistant",
      instructions: "You are a helpful assistant that can search the web for current information.",
      model: "gpt-4o",
      tools: [{ type: "code_interpreter" }] // 注意：Web Search工具可能需要特殊配置
    });

    const thread = await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "What was a positive news story from today?"
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id
    });

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(thread.id);
      console.log("回答:", messages.data[0].content[0].text.value);
    }
    
  } catch (error) {
    console.error("调用失败:", error.message);
    console.log("\n💡 提示:");
    console.log("   - Web Search 工具可能需要特殊权限或配置");
    console.log("   - 请确保已设置 OPENAI_API_KEY");
    console.log("   - 当前使用模拟方式演示");
  }
}

webSearchExample();