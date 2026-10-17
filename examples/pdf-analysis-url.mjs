import OpenAI from "openai";

const client = new OpenAI();

/**
 * PDF文档分析示例（通过URL）
 * 注意：OpenAI Chat API不直接支持PDF URL
 * 需要先下载PDF内容，转换为文本后发送给模型
 */

async function analyzePDFByUrl() {
  try {
    // 示例：分析PDF文档内容
    // 由于API不直接支持PDF URL，这里演示如何处理文本内容
    
    const pdfContent = `
Berkshire Hathaway 2024 Annual Letter

Key Points:
1. Operating earnings of $37.4 billion in 2024
2. Insurance operations performed exceptionally well
3. Investment portfolio value increased significantly
4. Berkshire's cash position reached $189 billion
5. Continued focus on long-term value investing
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial analyst assistant."
        },
        {
          role: "user",
          content: `Analyze the following letter and provide a summary of the key points:\n\n${pdfContent}`
        }
      ],
      max_tokens: 500
    });

    console.log("PDF分析结果:");
    console.log(response.choices[0].message.content);
    
  } catch (error) {
    console.error("调用失败:", error.message);
  }
}

analyzePDFByUrl();