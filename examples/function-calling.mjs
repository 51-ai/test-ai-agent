import OpenAI from "openai";

const client = new OpenAI();

/**
 * Function Calling 示例
 * 
 * 定义自定义工具并让模型调用
 */

// 定义工具
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current temperature for a given location.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City and country e.g. Bogotá, Colombia"
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit"
          }
        },
        required: ["location"],
        additionalProperties: false
      },
      strict: true
    }
  },
  {
    type: "function",
    function: {
      name: "get_time",
      description: "Get current time for a given timezone.",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "Timezone e.g. Asia/Shanghai, America/New_York"
          }
        },
        required: ["timezone"],
        additionalProperties: false
      },
      strict: true
    }
  }
];

// 模拟工具执行函数
function executeFunction(name, args) {
  console.log(`🔧 执行工具: ${name}`);
  console.log(`   参数:`, args);
  
  switch (name) {
    case "get_weather":
      // 模拟天气数据
      return {
        location: args.location,
        temperature: Math.floor(Math.random() * 30 + 10),
        unit: args.unit || "celsius",
        condition: "sunny",
        humidity: 45
      };
    
    case "get_time":
      // 返回当前时间
      return {
        timezone: args.timezone,
        time: new Date().toLocaleString("en-US", { timeZone: args.timezone })
      };
    
    default:
      return { error: "Unknown function" };
  }
}

async function functionCallingExample() {
  try {
    console.log("=== Function Calling 示例 ===\n");

    // 步骤1：发送请求
    console.log("📤 发送请求...");
    
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: "What is the weather like in Paris today? And what time is it there?"
        }
      ],
      tools: tools,
      tool_choice: "auto"
    });

    console.log("✅ 收到响应");

    // 步骤2：检查是否需要调用工具
    const message = response.choices[0].message;
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log("\n🔧 模型请求调用工具:");
      console.log(`   工具数量: ${message.tool_calls.length}`);
      
      // 步骤3：执行工具调用
      const toolResults = [];
      
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        // 执行工具
        const result = executeFunction(functionName, functionArgs);
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(result)
        });
        
        console.log(`   ✅ 工具 ${functionName} 执行完成`);
        console.log(`   结果:`, result);
      }

      // 步骤4：将工具结果发送回模型
      console.log("\n📤 将工具结果发送回模型...");
      
      const finalResponse = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: "What is the weather like in Paris today? And what time is it there?"
          },
          message,
          ...toolResults
        ]
      });

      console.log("\n📝 最终回答:");
      console.log(finalResponse.choices[0].message.content);
      
    } else {
      console.log("\n📝 模型直接回答:");
      console.log(message.content);
    }
    
  } catch (error) {
    console.error("\n❌ 调用失败:", error.message);
    console.log("\n💡 提示:");
    console.log("   - Function Calling 需要 gpt-4o 或 gpt-3.5-turbo");
    console.log("   - 请确保已设置 OPENAI_API_KEY");
    console.log("   - 工具定义需要符合 JSON Schema 规范");
  }
}

functionCallingExample();