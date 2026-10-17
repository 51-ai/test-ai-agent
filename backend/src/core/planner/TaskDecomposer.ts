export interface Task {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  children?: Task[];
  dependencies: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  estimatedTime: number;
  actualTime?: number;
  toolName?: string;
  parameters?: Record<string, any>;
}

export interface DecompositionResult {
  rootTask: Task;
  allTasks: Task[];
  taskGraph: Map<string, string[]>;
}

export interface DecompositionOptions {
  maxDepth?: number;
  minTaskSize?: number;
  maxTasks?: number;
}

export class TaskDecomposer {
  private taskIdCounter = 0;

  decompose(goal: string, options: DecompositionOptions = {}): DecompositionResult {
    const { maxDepth = 3, minTaskSize = 2, maxTasks = 50 } = options;
    
    const rootTask: Task = {
      id: this.generateTaskId(),
      name: goal,
      description: `完成目标: ${goal}`,
      dependencies: [],
      priority: 'high',
      status: 'pending',
      estimatedTime: this.estimateTaskTime(goal),
      children: []
    };

    const allTasks: Task[] = [rootTask];
    const taskGraph = new Map<string, string[]>();
    taskGraph.set(rootTask.id, []);

    this.recursiveDecompose(rootTask, goal, 1, maxDepth, minTaskSize, maxTasks, allTasks, taskGraph);

    return { rootTask, allTasks, taskGraph };
  }

  private recursiveDecompose(
    parentTask: Task,
    goal: string,
    depth: number,
    maxDepth: number,
    minTaskSize: number,
    maxTasks: number,
    allTasks: Task[],
    taskGraph: Map<string, string[]>
  ): void {
    if (depth >= maxDepth || allTasks.length >= maxTasks) {
      return;
    }

    const subTasks = this.generateSubTasks(goal, depth);
    
    for (const subTask of subTasks) {
      const task: Task = {
        id: this.generateTaskId(),
        name: subTask.name,
        description: subTask.description,
        parentId: parentTask.id,
        dependencies: subTask.dependencies || [],
        priority: subTask.priority || 'medium',
        status: 'pending',
        estimatedTime: subTask.estimatedTime || this.estimateTaskTime(subTask.name),
        toolName: subTask.toolName,
        parameters: subTask.parameters
      };

      allTasks.push(task);
      taskGraph.set(task.id, subTask.dependencies || []);
      parentTask.children = parentTask.children || [];
      parentTask.children.push(task);

      if (subTask.name.length > minTaskSize && depth + 1 < maxDepth) {
        this.recursiveDecompose(task, subTask.name, depth + 1, maxDepth, minTaskSize, maxTasks, allTasks, taskGraph);
      }
    }
  }

  private generateSubTasks(goal: string, depth: number): Array<{
    name: string;
    description: string;
    dependencies?: string[];
    priority?: 'high' | 'medium' | 'low';
    estimatedTime?: number;
    toolName?: string;
    parameters?: Record<string, any>;
  }> {
    const lowerGoal = goal.toLowerCase();
    
    if (lowerGoal.includes('竞品分析') || lowerGoal.includes('competitive analysis')) {
      return [
        {
          name: '收集竞品信息',
          description: '搜索并收集目标竞品的产品信息、市场定位、功能特性',
          priority: 'high',
          estimatedTime: 30,
          toolName: 'web_search',
          parameters: { query: goal }
        },
        {
          name: '分析竞品优势劣势',
          description: '分析竞品的核心优势和劣势',
          dependencies: [],
          priority: 'high',
          estimatedTime: 20
        },
        {
          name: '整理分析报告',
          description: '将收集的信息整理成结构化报告',
          dependencies: [],
          priority: 'medium',
          estimatedTime: 30
        }
      ];
    }

    if (lowerGoal.includes('写报告') || lowerGoal.includes('write report') || lowerGoal.includes('撰写')) {
      return [
        {
          name: '明确报告主题',
          description: '确定报告的核心主题和目标受众',
          priority: 'high',
          estimatedTime: 10
        },
        {
          name: '收集相关资料',
          description: '搜索和收集与主题相关的资料和数据',
          dependencies: [],
          priority: 'high',
          estimatedTime: 45,
          toolName: 'web_search',
          parameters: { query: goal }
        },
        {
          name: '撰写报告初稿',
          description: '根据收集的资料撰写报告初稿',
          dependencies: [],
          priority: 'high',
          estimatedTime: 60
        },
        {
          name: '修改完善报告',
          description: '审核并修改报告内容',
          dependencies: [],
          priority: 'medium',
          estimatedTime: 30
        }
      ];
    }

    if (lowerGoal.includes('计算') || lowerGoal.includes('calculate') || lowerGoal.includes('数学')) {
      return [
        {
          name: '理解计算需求',
          description: '分析用户的数学问题',
          priority: 'high',
          estimatedTime: 5
        },
        {
          name: '执行计算',
          description: '进行数学计算',
          dependencies: [],
          priority: 'high',
          estimatedTime: 10,
          toolName: 'code_executor',
          parameters: { code: this.generateMathCode(goal) }
        },
        {
          name: '验证结果',
          description: '验证计算结果的正确性',
          dependencies: [],
          priority: 'medium',
          estimatedTime: 5
        }
      ];
    }

    if (lowerGoal.includes('搜索') || lowerGoal.includes('search') || lowerGoal.includes('查找')) {
      return [
        {
          name: '执行搜索',
          description: '使用搜索引擎查找相关信息',
          priority: 'high',
          estimatedTime: 15,
          toolName: 'web_search',
          parameters: { query: goal }
        },
        {
          name: '整理搜索结果',
          description: '整理和总结搜索结果',
          dependencies: [],
          priority: 'medium',
          estimatedTime: 10
        }
      ];
    }

    if (lowerGoal.includes('代码') || lowerGoal.includes('code') || lowerGoal.includes('编程')) {
      return [
        {
          name: '分析需求',
          description: '分析编程需求和技术方案',
          priority: 'high',
          estimatedTime: 15
        },
        {
          name: '编写代码',
          description: '编写实现代码',
          dependencies: [],
          priority: 'high',
          estimatedTime: 45,
          toolName: 'code_executor',
          parameters: { code: '' }
        },
        {
          name: '测试代码',
          description: '测试代码功能',
          dependencies: [],
          priority: 'medium',
          estimatedTime: 20
        }
      ];
    }

    return [
      {
        name: '分析目标',
        description: '深入分析用户的目标需求',
        priority: 'high',
        estimatedTime: 10
      },
      {
        name: '制定计划',
        description: '制定详细的执行计划',
        dependencies: [],
        priority: 'high',
        estimatedTime: 15
      },
      {
        name: '执行任务',
        description: '按照计划执行任务',
        dependencies: [],
        priority: 'high',
        estimatedTime: 30
      },
      {
        name: '总结结果',
        description: '总结任务执行结果',
        dependencies: [],
        priority: 'medium',
        estimatedTime: 10
      }
    ];
  }

  private generateTaskId(): string {
    this.taskIdCounter++;
    return `task_${Date.now()}_${this.taskIdCounter}`;
  }

  private estimateTaskTime(goal: string): number {
    const wordCount = goal.length;
    if (wordCount < 10) return 10;
    if (wordCount < 20) return 20;
    if (wordCount < 30) return 30;
    return 45;
  }

  private generateMathCode(goal: string): string {
    const patterns = [
      { regex: /(\d+)\s*[*×]\s*(\d+)/, template: 'result = {0} * {1}' },
      { regex: /(\d+)\s*[+＋]\s*(\d+)/, template: 'result = {0} + {1}' },
      { regex: /(\d+)\s*[-−]\s*(\d+)/, template: 'result = {0} - {1}' },
      { regex: /(\d+)\s*[/÷]\s*(\d+)/, template: 'result = {0} / {1}' },
      { regex: /(\d+)\s*的?\s*平方/, template: 'result = {0} ** 2' },
      { regex: /(\d+)\s*的?\s*立方/, template: 'result = {0} ** 3' },
    ];

    for (const { regex, template } of patterns) {
      const match = goal.match(regex);
      if (match) {
        return template.replace('{0}', match[1]).replace('{1}', match[2] || '');
      }
    }
    return `result = ${goal}`;
  }

  getTaskOrder(taskGraph: Map<string, string[]>): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const order: string[] = [];

    taskGraph.forEach((deps, taskId) => {
      inDegree.set(taskId, deps.length);
      if (deps.length === 0) {
        queue.push(taskId);
      }
    });

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      order.push(taskId);

      taskGraph.forEach((deps, childId) => {
        if (deps.includes(taskId)) {
          const current = inDegree.get(childId)!;
          inDegree.set(childId, current - 1);
          if (inDegree.get(childId) === 0) {
            queue.push(childId);
          }
        }
      });
    }

    return order;
  }

  getCriticalPath(tasks: Task[]): Task[] {
    const criticalPath: Task[] = [];
    let currentTask = tasks.find(t => t.status === 'pending' && !t.parentId);
    
    while (currentTask) {
      criticalPath.push(currentTask);
      const children = currentTask.children || [];
      const highPriorityChild = children.find(c => c.priority === 'high');
      currentTask = highPriorityChild || children[0];
    }

    return criticalPath;
  }
}