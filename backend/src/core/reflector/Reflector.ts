export interface Reflection {
  id: string;
  timestamp: number;
  taskId: string;
  taskName: string;
  originalGoal: string;
  executedSteps: ExecutionStep[];
  outcome: 'success' | 'partial' | 'failure';
  analysis: AnalysisResult;
  suggestions: Suggestion[];
  confidence: number;
}

export interface ExecutionStep {
  stepNumber: number;
  action: string;
  toolName?: string;
  parameters?: Record<string, any>;
  result: string;
  success: boolean;
  timestamp: number;
}

export interface AnalysisResult {
  achievedGoal: boolean;
  goalAlignment: number;
  stepQuality: number;
  resourceUsage: number;
  errorAnalysis: ErrorAnalysis | null;
  improvementAreas: string[];
}

export interface ErrorAnalysis {
  errorType: 'execution' | 'planning' | 'tool' | 'logic' | 'unknown';
  errorMessage: string;
  occurredAtStep: number;
  potentialCauses: string[];
  recommendedFix: string;
}

export interface Suggestion {
  type: 'revision' | 'retry' | 'alternative' | 'optimization';
  priority: 'high' | 'medium' | 'low';
  description: string;
  action: string;
}

export class Reflector {
  private reflectionIdCounter = 0;

  reflect(
    taskId: string,
    taskName: string,
    originalGoal: string,
    executedSteps: ExecutionStep[],
    expectedResult?: string
  ): Reflection {
    const analysis = this.analyzeExecution(executedSteps, originalGoal, expectedResult);
    const suggestions = this.generateSuggestions(analysis, executedSteps, originalGoal);
    const outcome = this.determineOutcome(analysis);
    const confidence = this.calculateConfidence(analysis, executedSteps);

    return {
      id: this.generateReflectionId(),
      timestamp: Date.now(),
      taskId,
      taskName,
      originalGoal,
      executedSteps,
      outcome,
      analysis,
      suggestions,
      confidence
    };
  }

  private analyzeExecution(
    steps: ExecutionStep[],
    originalGoal: string,
    expectedResult?: string
  ): AnalysisResult {
    const completedSteps = steps.filter(s => s.success).length;
    const totalSteps = steps.length;
    const stepQuality = totalSteps > 0 ? completedSteps / totalSteps : 0;

    const goalAlignment = this.calculateGoalAlignment(steps, originalGoal);
    const resourceUsage = this.calculateResourceUsage(steps);
    const errorAnalysis = this.detectErrors(steps);
    const improvementAreas = this.identifyImprovementAreas(steps, goalAlignment);

    return {
      achievedGoal: this.checkGoalAchieved(steps, originalGoal),
      goalAlignment,
      stepQuality,
      resourceUsage,
      errorAnalysis,
      improvementAreas
    };
  }

  private calculateGoalAlignment(steps: ExecutionStep[], goal: string): number {
    const goalKeywords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let matchedKeywords = 0;

    for (const step of steps) {
      const stepText = (step.action + ' ' + step.result).toLowerCase();
      for (const keyword of goalKeywords) {
        if (stepText.includes(keyword)) {
          matchedKeywords++;
          break;
        }
      }
    }

    return goalKeywords.length > 0 ? matchedKeywords / goalKeywords.length : 0;
  }

  private calculateResourceUsage(steps: ExecutionStep[]): number {
    const totalTime = steps.reduce((acc, step) => acc + (step.timestamp - (steps[0]?.timestamp || 0)), 0);
    const toolCalls = steps.filter(s => s.toolName).length;
    
    const timeScore = totalTime < 30000 ? 1 : totalTime < 60000 ? 0.7 : 0.4;
    const toolScore = toolCalls < 5 ? 1 : toolCalls < 10 ? 0.7 : 0.4;
    
    return (timeScore + toolScore) / 2;
  }

  private detectErrors(steps: ExecutionStep[]): ErrorAnalysis | null {
    const failedStep = steps.find(s => !s.success);
    
    if (!failedStep) return null;

    const stepIndex = steps.indexOf(failedStep);
    let errorType: ErrorAnalysis['errorType'] = 'unknown';
    let potentialCauses: string[] = [];
    let recommendedFix = '';

    if (failedStep.toolName) {
      errorType = 'tool';
      potentialCauses = [
        '工具调用参数错误',
        '工具返回格式异常',
        '工具服务不可用'
      ];
      recommendedFix = '检查工具调用参数是否正确，并验证工具服务状态';
    } else if (stepIndex === 0) {
      errorType = 'planning';
      potentialCauses = [
        '任务规划不合理',
        '目标理解错误',
        '初始假设错误'
      ];
      recommendedFix = '重新分析目标，调整任务规划策略';
    } else if (stepIndex === steps.length - 1) {
      errorType = 'execution';
      potentialCauses = [
        '执行逻辑错误',
        '中间结果处理不当',
        '最终输出不符合预期'
      ];
      recommendedFix = '检查执行逻辑，验证最终输出是否满足目标';
    } else {
      errorType = 'logic';
      potentialCauses = [
        '步骤间逻辑衔接问题',
        '状态传递错误',
        '条件判断错误'
      ];
      recommendedFix = '检查步骤间的数据传递和状态管理';
    }

    return {
      errorType,
      errorMessage: failedStep.result,
      occurredAtStep: stepIndex + 1,
      potentialCauses,
      recommendedFix
    };
  }

  private identifyImprovementAreas(steps: ExecutionStep[], goalAlignment: number): string[] {
    const areas: string[] = [];

    if (goalAlignment < 0.5) {
      areas.push('目标理解不足，建议重新分析用户需求');
    }

    const redundantSteps = this.detectRedundantSteps(steps);
    if (redundantSteps > 0) {
      areas.push(`发现 ${redundantSteps} 个冗余步骤，建议优化执行流程`);
    }

    const failedSteps = steps.filter(s => !s.success).length;
    if (failedSteps > 0) {
      areas.push(`存在 ${failedSteps} 个失败步骤，建议排查原因`);
    }

    const toolOveruse = steps.filter(s => s.toolName).length > 10;
    if (toolOveruse) {
      areas.push('工具调用过于频繁，建议优化工具使用策略');
    }

    return areas;
  }

  private detectRedundantSteps(steps: ExecutionStep[]): number {
    const seenActions = new Set<string>();
    let redundantCount = 0;

    for (const step of steps) {
      const actionKey = step.action.toLowerCase().trim();
      if (seenActions.has(actionKey)) {
        redundantCount++;
      } else {
        seenActions.add(actionKey);
      }
    }

    return redundantCount;
  }

  private checkGoalAchieved(steps: ExecutionStep[], goal: string): boolean {
    const allStepsSuccessful = steps.every(s => s.success);
    const goalAlignment = this.calculateGoalAlignment(steps, goal);
    
    return allStepsSuccessful && goalAlignment >= 0.7;
  }

  private generateSuggestions(
    analysis: AnalysisResult,
    steps: ExecutionStep[],
    goal: string
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (!analysis.achievedGoal) {
      suggestions.push({
        type: 'revision',
        priority: 'high',
        description: '任务未完成，建议重新规划',
        action: '重新分析目标并调整执行步骤'
      });
    }

    if (analysis.errorAnalysis) {
      suggestions.push({
        type: 'retry',
        priority: 'high',
        description: `第 ${analysis.errorAnalysis.occurredAtStep} 步执行失败: ${analysis.errorAnalysis.errorMessage}`,
        action: analysis.errorAnalysis.recommendedFix
      });
    }

    if (analysis.goalAlignment < 0.7) {
      suggestions.push({
        type: 'revision',
        priority: 'medium',
        description: '执行结果与目标匹配度较低',
        action: '重新审视任务目标，调整执行策略'
      });
    }

    if (analysis.stepQuality < 0.8) {
      suggestions.push({
        type: 'optimization',
        priority: 'medium',
        description: '部分步骤执行质量不佳',
        action: '检查失败步骤，优化执行逻辑'
      });
    }

    if (analysis.resourceUsage < 0.7) {
      suggestions.push({
        type: 'optimization',
        priority: 'low',
        description: '资源使用效率较低',
        action: '优化执行流程，减少不必要的工具调用'
      });
    }

    const alternativePath = this.findAlternativePath(steps, goal);
    if (alternativePath) {
      suggestions.push({
        type: 'alternative',
        priority: 'medium',
        description: '发现更优的执行路径',
        action: alternativePath
      });
    }

    return suggestions;
  }

  private findAlternativePath(steps: ExecutionStep[], goal: string): string | null {
    const toolCalls = steps.filter(s => s.toolName);
    
    if (toolCalls.length > 3) {
      return '可以尝试合并部分工具调用，减少执行步骤';
    }

    if (steps.length > 5 && goal.length < 20) {
      return '任务目标较简单，可尝试简化执行流程';
    }

    return null;
  }

  private determineOutcome(analysis: AnalysisResult): 'success' | 'partial' | 'failure' {
    if (analysis.achievedGoal && analysis.stepQuality >= 0.9) {
      return 'success';
    }
    if (analysis.stepQuality >= 0.5 || analysis.goalAlignment >= 0.5) {
      return 'partial';
    }
    return 'failure';
  }

  private calculateConfidence(analysis: AnalysisResult, steps: ExecutionStep[]): number {
    const weights = {
      goalAlignment: 0.3,
      stepQuality: 0.3,
      resourceUsage: 0.2,
      completion: 0.2
    };

    const completionScore = steps.every(s => s.success) ? 1 : 
                           steps.filter(s => s.success).length / steps.length;

    return Math.min(1, Math.max(0,
      analysis.goalAlignment * weights.goalAlignment +
      analysis.stepQuality * weights.stepQuality +
      analysis.resourceUsage * weights.resourceUsage +
      completionScore * weights.completion
    ));
  }

  private generateReflectionId(): string {
    this.reflectionIdCounter++;
    return `reflection_${Date.now()}_${this.reflectionIdCounter}`;
  }

  summarize(reflection: Reflection): string {
    const summaryParts: string[] = [];
    
    summaryParts.push(`任务 "${reflection.taskName}" 执行${reflection.outcome === 'success' ? '成功' : reflection.outcome === 'partial' ? '部分完成' : '失败'}`);
    
    if (reflection.confidence < 0.7) {
      summaryParts.push(`置信度: ${(reflection.confidence * 100).toFixed(0)}%`);
    }

    if (reflection.analysis.errorAnalysis) {
      summaryParts.push(`错误分析: ${reflection.analysis.errorAnalysis.errorMessage}`);
      summaryParts.push(`建议: ${reflection.analysis.errorAnalysis.recommendedFix}`);
    }

    if (reflection.suggestions.length > 0) {
      const highPriority = reflection.suggestions.filter(s => s.priority === 'high');
      if (highPriority.length > 0) {
        summaryParts.push(`高优先级建议: ${highPriority.map(s => s.description).join('; ')}`);
      }
    }

    return summaryParts.join('\n');
  }
}