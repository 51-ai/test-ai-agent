import OpenAI from "openai";

const openai = new OpenAI();

/**
 * File Search 工具示例（向量存储）
 * 
 * 使用 Assistants API 和 Vector Store 进行文件搜索
 */

async function fileSearchExample() {
  try {
    console.log("=== File Search 示例 ===\n");

    // 步骤1：创建向量存储
    console.log("📦 创建向量存储...");
    
    const vectorStore = await openai.beta.vectorStores.create({
      name: "Knowledge Base"
    });

    console.log(`✅ 向量存储已创建，ID: ${vectorStore.id}`);

    // 步骤2：上传文件到向量存储
    console.log("\n📤 上传文件...");
    
    // 注意：需要实际文件才能上传
    // 这里演示创建过程
    
    // 步骤3：创建助手并关联向量存储
    console.log("\n🤖 创建助手...");
    
    const assistant = await openai.beta.assistants.create({
      name: "Knowledge Assistant",
      instructions: "You are a helpful assistant that can search through uploaded files to answer questions.",
      model: "gpt-4o",
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStore.id]
        }
      }
    });

    console.log(`✅ 助手已创建，ID: ${assistant.id}`);

    // 步骤4：创建对话并提问
    console.log("\n💬 开始对话...");
    
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "What is deep research by OpenAI?"
    });

    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id
    });

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(thread.id);
      console.log("\n📝 回答:");
      console.log(messages.data[0].content[0].text.value);
    }

    // 清理资源
    console.log("\n🧹 清理资源...");
    await openai.beta.vectorStores.del(vectorStore.id);
    await openai.beta.assistants.del(assistant.id);
    console.log("✅ 清理完成");
    
  } catch (error) {
    console.error("\n❌ 调用失败:", error.message);
    console.log("\n💡 提示:");
    console.log("   - File Search 需要 Assistants API");
    console.log("   - 需要先上传文件到向量存储");
    console.log("   - 请确保已设置 OPENAI_API_KEY");
    console.log("   - vector_store_ids 需要替换为实际的ID");
  }
}

fileSearchExample();