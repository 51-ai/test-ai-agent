import fs from "fs";
import OpenAI from "openai";

const client = new OpenAI();

/**
 * PDF文档分析示例（上传文件）
 * 
 * 步骤：
 * 1. 上传PDF文件到OpenAI
 * 2. 使用文件ID进行分析
 */

async function analyzePDFByUpload() {
  try {
    // 检查文件是否存在
    const filePath = "draconomicon.pdf";
    
    if (!fs.existsSync(filePath)) {
      console.log("⚠️ 文件不存在，使用模拟内容演示");
      
      // 模拟PDF内容
      const mockContent = `
Draconomicon - The Book of Dragons

Chapter 1: Introduction to Dragons
Dragons are ancient and powerful creatures that have existed for millennia.

First Dragon: The Red Dragon
The Red Dragon is the first dragon described in this book.
It is known for its fiery breath and immense strength.
Red Dragons are typically found in volcanic regions.
`;

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `Based on the following book content, what is the first dragon mentioned?\n\n${mockContent}`
          }
        ]
      });

      console.log("分析结果:");
      console.log(response.choices[0].message.content);
      return;
    }

    // 如果文件存在，上传并分析
    console.log("📤 上传PDF文件...");
    
    const file = await client.files.create({
      file: fs.createReadStream(filePath),
      purpose: "user_data" // 注意：这个purpose可能需要调整为"assistants"
    });

    console.log(`✅ 文件上传成功，ID: ${file.id}`);

    // 使用Assistants API分析文件
    // 注意：Chat Completions API不直接支持file_id
    // 需要使用Assistants API
    
    const assistant = await client.beta.assistants.create({
      name: "PDF Analyzer",
      instructions: "You are a helpful assistant that analyzes PDF documents.",
      model: "gpt-4o",
      tools: [{ type: "file_search" }]
    });

    const thread = await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "What is the first dragon in the book?",
      attachments: [
        {
          file_id: file.id,
          tools: [{ type: "file_search" }]
        }
      ]
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id
    });

    if (run.status === "completed") {
      const messages = await client.beta.threads.messages.list(thread.id);
      console.log("分析结果:");
      console.log(messages.data[0].content[0].text.value);
    }
    
  } catch (error) {
    console.error("调用失败:", error.message);
    console.log("\n💡 提示:");
    console.log("   - 请确保已设置OPENAI_API_KEY环境变量");
    console.log("   - PDF文件分析需要使用Assistants API");
    console.log("   - 确保PDF文件存在于当前目录");
  }
}

analyzePDFByUpload();