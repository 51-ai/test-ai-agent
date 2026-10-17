import OpenAI from "openai";

const client = new OpenAI();

/**
 * MCP (Model Context Protocol) 工具示例
 * 
 * MCP 是一种新的工具集成协议
 * 允许连接外部服务器和工具
 * 
 * 注意：MCP 工具可能需要特殊配置和权限
 */

async function mcpToolExample() {
  try {
    console.log("=== MCP 工具示例 ===\n");

    // 方式1：使用 Chat Completions API 模拟 MCP
    console.log("📦 方式1：模拟 MCP 工具调用");
    
    const response1 = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a Dungeons and Dragons assistant. When asked to roll dice, calculate the result mathematically and explain it."
        },
        {
          role: "user",
          content: "Roll 2d4+1"
        }
      ],
      max_tokens: 200
    });

    console.log("\n📝 回答:");
    console.log(response1.choices[0].message.content);

    // 方式2：使用 Function Calling 模拟 MCP
    console.log("\n\n📦 方式2：使用 Function Calling 模拟");
    
    const tools = [
      {
        type: "function",
        function: {
          name: "roll_dice",
          description: "Roll dice according to D&D notation (e.g., 2d4+1 means roll 2 four-sided dice and add 1)",
          parameters: {
            type: "object",
            properties: {
              notation: {
                type: "string",
                description: "Dice notation e.g. 2d4+1, 1d20, 3d6"
              }
            },
            required: ["notation"],
            additionalProperties: false
          },
          strict: true
        }
      }
    ];

    const response2 = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: "Roll 2d4+1"
        }
      ],
      tools: tools,
      tool_choice: "auto"
    });

    const message = response2.choices[0].message;
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log("\n🔧 工具调用:");
      console.log(`   工具: ${toolCall.function.name}`);
      console.log(`   参数:`, args);
      
      // 执行骰子滚动
      const notation = args.notation;
      const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
      
      if (match) {
        const numDice = parseInt(match[1]);
        const diceSize = parseInt(match[2]);
        const modifier = match[3] ? parseInt(match[3]) : 0;
        
        const rolls = [];
        for (let i = 0; i < numDice; i++) {
          rolls.push(Math.floor(Math.random() * diceSize) + 1);
        }
        
        const total = rolls.reduce((a, b) => a + b, 0) + modifier;
        
        const result = {
          notation: notation,
          rolls: rolls,
          modifier: modifier,
          total: total,
          explanation: `Rolled ${numDice}d${diceSize}: [${rolls.join(', ')}]${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''} = ${total}`
        };
        
        console.log("\n🎲 骰子结果:");
        console.log(`   ${result.explanation}`);
        
        // 将结果发送回模型
        const finalResponse = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: "Roll 2d4+1"
            },
            message,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            }
          ]
        });
        
        console.log("\n📝 最终回答:");
        console.log(finalResponse.choices[0].message.content);
      }
    } else {
      console.log("\n📝 模型直接回答:");
      console.log(message.content);
    }

    // 方式3：真实 MCP 工具（需要特殊配置）
    console.log("\n\n📦 方式3：真实 MCP 工具（演示）");
    console.log("   MCP 工具需要:");
    console.log("   - 外部 MCP 服务器");
    console.log("   - 特殊的 API 配置");
    console.log("   - 可能需要企业版订阅");
    console.log("\n   示例配置:");
    console.log("   {");
    console.log("     type: 'mcp',");
    console.log("     server_label: 'dmcp',");
    console.log("     server_description: 'D&D MCP server',");
    console.log("     server_url: 'https://dmcp-server.deno.dev/sse',");
    console.log("     require_approval: 'never'");
    console.log("   }");
    
  } catch (error) {
    console.error("\n❌ 调用失败:", error.message);
    console.log("\n💡 提示:");
    console.log("   - MCP 工具可能需要特殊权限");
    console.log("   - 当前使用模拟方式演示");
    console.log("   - 请确保已设置 OPENAI_API_KEY");
  }
}

mcpToolExample();