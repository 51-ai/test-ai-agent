// AI Agent JavaScript Framework
// 这个版本可以直接在 Node.js 环境中运行

class Tool {
    constructor(name, description, execute) {
        this.name = name;
        this.description = description;
        this.execute = execute;
    }
}

class Memory {
    constructor() {
        this.shortTerm = [];
        this.longTerm = [];
        this.maxShortTerm = 20;
    }
    
    addShortTerm(key, value) {
        this.shortTerm.push({ key, value });
        if (this.shortTerm.length > this.maxShortTerm) {
            this.shortTerm.shift();
        }
    }
    
    addLongTerm(key, value) {
        const index = this.longTerm.findIndex(item => item.key === key);
        if (index !== -1) {
            this.longTerm[index].value = value;
        } else {
            this.longTerm.push({ key, value });
        }
    }
    
    retrieve(key) {
        for (let i = this.shortTerm.length - 1; i >= 0; i--) {
            if (this.shortTerm[i].key === key) return this.shortTerm[i].value;
        }
        for (let i = this.longTerm.length - 1; i >= 0; i--) {
            if (this.longTerm[i].key === key) return this.longTerm[i].value;
        }
        return null;
    }
}

class Agent {
    constructor(systemPrompt = "") {
        this.tools = [];
        this.memory = new Memory();
        this.systemPrompt = systemPrompt;
        this.rng = Math.random;
    }
    
    addTool(tool) {
        this.tools.push(tool);
    }
    
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
    }
    
    generateResponse(prompt) {
        const responses = [
            "我理解你的需求，让我帮你分析一下。",
            "这是一个很好的问题，让我思考一下。",
            "根据我的分析，我认为最佳方案是：",
            "我已经考虑了各种可能性，以下是我的建议：",
            "让我为你详细解释一下这个问题。"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    findTool(name) {
        return this.tools.find(tool => tool.name === name);
    }
    
    process(userInput) {
        console.log(`[DEBUG] Processing input: ${userInput}`);
        
        this.memory.addShortTerm("last_input", userInput);
        
        const context = this.memory.retrieve("user_name");
        if (context) {
            console.log(`[DEBUG] Retrieved context: user_name = ${context}`);
        }
        
        // 工具调用逻辑
        if (userInput.includes("搜索") || userInput.includes("查找")) {
            const searchTool = this.findTool("web_search");
            if (searchTool) {
                console.log(`[TOOL] Calling: ${searchTool.name}`);
                const result = searchTool.execute([userInput]);
                this.memory.addShortTerm("search_result", result);
                return result;
            }
        }
        
        if (userInput.includes("计算") || userInput.includes("等于")) {
            const calcTool = this.findTool("calculator");
            if (calcTool) {
                console.log(`[TOOL] Calling: ${calcTool.name}`);
                return calcTool.execute([userInput]);
            }
        }
        
        if (userInput.includes("记住")) {
            const content = userInput.replace("记住", "");
            this.memory.addLongTerm("user_note", content.trim());
            return `好的，我已经记住了：${content.trim()}`;
        }
        
        const response = this.generateResponse(userInput);
        this.memory.addShortTerm("last_response", response);
        
        return response;
    }
}

// 工具实现
function webSearchTool(params) {
    console.log(`[SEARCH] Query: ${params[0]}`);
    return `搜索完成，找到以下结果：\n- 搜索结果1：关于${params[0]}的详细信息\n- 搜索结果2：相关文章和文档\n- 搜索结果3：最新研究和趋势`;
}

function calculatorTool(params) {
    console.log(`[CALC] Calculating: ${params[0]}`);
    const result = Math.floor(Math.random() * 1000) + 1;
    return `计算结果：${result}`;
}

function codeExecutorTool(params) {
    console.log(`[CODE] Executing: ${params[0].substr(0, 50)}...`);
    return "代码执行完成！\n输出：Hello, World!\n执行时间：15ms";
}

// 主程序
async function main() {
    console.log("==========================================");
    console.log("      AI Agent JavaScript Framework Demo    ");
    console.log("==========================================\n");
    
    // 创建 Agent
    const agent = new Agent("你是一个智能助手，帮助用户解决问题。");
    
    // 添加工具
    agent.addTool(new Tool("web_search", "网络搜索工具", webSearchTool));
    agent.addTool(new Tool("calculator", "数学计算器", calculatorTool));
    agent.addTool(new Tool("code_executor", "代码执行器", codeExecutorTool));
    
    console.log(`[INIT] Agent initialized with ${agent.tools.length} tools\n`);
    
    // 测试对话
    const testInputs = [
        "你好，我想搜索一下人工智能的最新发展",
        "请计算 100 + 200 等于多少",
        "记住：我叫张三，喜欢编程",
        "你能帮我执行一段代码吗？",
        "你还记得我叫什么吗？"
    ];
    
    for (const input of testInputs) {
        console.log(`\n用户: ${input}`);
        const startTime = Date.now();
        const response = agent.process(input);
        const duration = Date.now() - startTime;
        console.log(`助手: ${response}`);
        console.log(`[METRIC] Response time: ${duration}ms`);
        console.log(`[METRIC] Memory entries: short=${agent.memory.shortTerm.length}, long=${agent.memory.longTerm.length}`);
    }
    
    console.log("\n==========================================");
    console.log("                测试完成                    ");
    console.log("==========================================");
}

// 运行
if (require.main === module) {
    main();
}

module.exports = { Agent, Tool, Memory };