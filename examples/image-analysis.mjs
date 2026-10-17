import OpenAI from "openai";

const client = new OpenAI();

/**
 * 图像分析示例
 * 使用GPT-4 Vision模型分析图像内容
 */
async function analyzeImage() {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o", // 使用gpt-4o（支持视觉）
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What is in this image? Describe it in detail."
            },
            {
              type: "image_url",
              image_url: {
                url: "https://openai-documentation.vercel.app/images/cat_and_otter.png"
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    console.log("图像分析结果:");
    console.log(response.choices[0].message.content);
    
  } catch (error) {
    console.error("调用失败:", error.message);
  }
}

analyzeImage();