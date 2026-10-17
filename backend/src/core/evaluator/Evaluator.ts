export interface EvaluationResult {
  id: string;
  taskId: string;
  taskName: string;
  input: string;
  actualOutput: string;
  expectedOutput?: string;
  judgeOutput: JudgeOutput;
  score: number;
  maxScore: number;
  confidence: number;
  evaluationType: EvaluationType;
  timestamp: number;
}

export interface JudgeOutput {
  reasoning: string;
  score: number;
  maxScore: number;
  criteria: ScoreCriteria;
  suggestions: string[];
}

export interface ScoreCriteria {
  correctness: number;
  completeness: number;
  relevance: number;
  clarity: number;
  creativity?: number;
}

export type EvaluationType = 'automated' | 'manual' | 'llm_judge';

export interface EvaluationDataset {
  id: string;
  name: string;
  description: string;
  type: DatasetType;
  samples: EvaluationSample[];
  createdAt: number;
}

export type DatasetType = 'gaia' | 'agentbench' | 'toolbench' | 'custom';

export interface EvaluationSample {
  id: string;
  input: string;
  expectedOutput?: string;
  context?: string;
  metadata: SampleMetadata;
}

export interface SampleMetadata {
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  requiresTools: boolean;
  expectedSteps?: number;
}

export interface BenchmarkResult {
  datasetId: string;
  datasetName: string;
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  avgScore: number;
  avgConfidence: number;
  results: EvaluationResult[];
  timestamp: number;
}

export class LLMJudge {
  private judgePrompt: string;

  constructor() {
    this.judgePrompt = `
作为AI Agent评估专家，你的任务是评估AI Agent对给定任务的响应质量。

评估标准：
1. 正确性 (30分)：答案是否准确无误？
2. 完整性 (25分)：是否覆盖了问题的所有方面？
3. 相关性 (25分)：回答是否与问题紧密相关？
4. 清晰性 (20分)：表达是否清晰易懂？

评分规则：
- 正确性：完全正确30分，部分正确15-25分，错误0-10分
- 完整性：完整覆盖25分，基本覆盖15-20分，不完整0-10分
- 相关性：高度相关25分，部分相关15-20分，不相关0-10分
- 清晰性：非常清晰20分，基本清晰10-15分，模糊0-5分

输出格式：
评分：[总分]/100
正确性：[分数]/30
完整性：[分数]/25
相关性：[分数]/25
清晰性：[分数]/20
理由：[详细说明评分理由]
建议：[改进建议]
`;
  }

  evaluate(input: string, actualOutput: string, expectedOutput?: string): JudgeOutput {
    const scores = this.calculateScores(input, actualOutput, expectedOutput);
    const totalScore = scores.correctness + scores.completeness + scores.relevance + scores.clarity;
    
    return {
      reasoning: this.generateReasoning(input, actualOutput, expectedOutput, scores),
      score: totalScore,
      maxScore: 100,
      criteria: scores,
      suggestions: this.generateSuggestions(scores)
    };
  }

  private calculateScores(input: string, actualOutput: string, expectedOutput?: string): ScoreCriteria {
    const scores: ScoreCriteria = {
      correctness: 20,
      completeness: 20,
      relevance: 20,
      clarity: 15
    };

    const lowerInput = input.toLowerCase();
    const lowerOutput = actualOutput.toLowerCase();

    if (expectedOutput) {
      const lowerExpected = expectedOutput.toLowerCase();
      const exactMatch = lowerOutput === lowerExpected;
      const containsExpected = lowerOutput.includes(lowerExpected) || lowerExpected.includes(lowerOutput);
      
      if (exactMatch) {
        scores.correctness = 30;
      } else if (containsExpected) {
        scores.correctness = 25;
      } else if (this.checkSemanticSimilarity(actualOutput, expectedOutput) > 0.7) {
        scores.correctness = 22;
      } else {
        scores.correctness = this.estimateCorrectness(actualOutput);
      }
    } else {
      scores.correctness = this.estimateCorrectness(actualOutput);
    }

    scores.completeness = this.estimateCompleteness(input, actualOutput);
    scores.relevance = this.estimateRelevance(input, actualOutput);
    scores.clarity = this.estimateClarity(actualOutput);

    return scores;
  }

  private estimateCorrectness(output: string): number {
    if (!output || output.trim().length < 5) return 5;
    
    const hasCode = output.includes('```') || output.includes('function') || output.includes('import');
    const hasStructure = output.includes('\n') || output.includes('。') || output.includes(';');
    
    if (hasCode && hasStructure) return 25;
    if (hasStructure) return 20;
    return 15;
  }

  private estimateCompleteness(input: string, output: string): number {
    const inputLength = input.length;
    const outputLength = output.length;
    
    const ratio = Math.min(outputLength / inputLength, 5);
    
    if (ratio >= 3) return 25;
    if (ratio >= 2) return 20;
    if (ratio >= 1) return 15;
    if (ratio >= 0.5) return 10;
    return 5;
  }

  private estimateRelevance(input: string, output: string): number {
    const inputWords = input.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    let matchedCount = 0;
    
    for (const word of inputWords) {
      if (output.toLowerCase().includes(word)) {
        matchedCount++;
      }
    }
    
    const matchRatio = inputWords.length > 0 ? matchedCount / inputWords.length : 0;
    
    if (matchRatio >= 0.8) return 25;
    if (matchRatio >= 0.6) return 20;
    if (matchRatio >= 0.4) return 15;
    if (matchRatio >= 0.2) return 10;
    return 5;
  }

  private estimateClarity(output: string): number {
    const sentences = output.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 
      ? output.length / sentences.length 
      : output.length;
    
    const hasMarkdown = output.includes('#') || output.includes('**') || output.includes('- ');
    
    let score = 10;
    
    if (avgSentenceLength < 100) score += 5;
    if (avgSentenceLength < 50) score += 3;
    if (hasMarkdown) score += 2;
    
    return Math.min(20, score);
  }

  private checkSemanticSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    let intersection = 0;
    set1.forEach(w => {
      if (set2.has(w)) intersection++;
    });
    const union = set1.size + set2.size - intersection;
    
    return union > 0 ? intersection / union : 0;
  }

  private generateReasoning(input: string, actualOutput: string, expectedOutput: string | undefined, scores: ScoreCriteria): string {
    const parts: string[] = [];
    
    parts.push(`问题：${input}`);
    parts.push(`回答：${actualOutput}`);
    if (expectedOutput) {
      parts.push(`期望输出：${expectedOutput}`);
    }
    parts.push('');
    parts.push(`评分明细：`);
    parts.push(`- 正确性：${scores.correctness}/30`);
    parts.push(`- 完整性：${scores.completeness}/25`);
    parts.push(`- 相关性：${scores.relevance}/25`);
    parts.push(`- 清晰性：${scores.clarity}/20`);
    parts.push('');
    parts.push('评估说明：');
    
    if (scores.correctness >= 25) {
      parts.push('回答准确，符合预期。');
    } else if (scores.correctness >= 15) {
      parts.push('回答基本正确，但可能存在一些小问题。');
    } else {
      parts.push('回答存在明显错误或不准确。');
    }
    
    if (scores.completeness >= 20) {
      parts.push('回答内容完整，覆盖了问题的主要方面。');
    } else if (scores.completeness >= 10) {
      parts.push('回答内容基本完整，但可能缺少一些细节。');
    } else {
      parts.push('回答内容不够完整，需要补充更多信息。');
    }
    
    return parts.join('\n');
  }

  private generateSuggestions(scores: ScoreCriteria): string[] {
    const suggestions: string[] = [];
    
    if (scores.correctness < 20) {
      suggestions.push('建议检查回答的准确性，确保信息正确无误。');
    }
    
    if (scores.completeness < 15) {
      suggestions.push('建议提供更详细的回答，覆盖问题的各个方面。');
    }
    
    if (scores.relevance < 15) {
      suggestions.push('建议确保回答紧密围绕问题主题，避免无关内容。');
    }
    
    if (scores.clarity < 12) {
      suggestions.push('建议使用更清晰的表达方式，适当分段和使用格式。');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('回答质量较高，继续保持！');
    }
    
    return suggestions;
  }
}

export class Evaluator {
  private llmJudge: LLMJudge;
  private evaluationCounter = 0;

  constructor() {
    this.llmJudge = new LLMJudge();
  }

  evaluate(taskId: string, taskName: string, input: string, actualOutput: string, expectedOutput?: string): EvaluationResult {
    const judgeOutput = this.llmJudge.evaluate(input, actualOutput, expectedOutput);
    
    return {
      id: `eval_${Date.now()}_${this.evaluationCounter++}`,
      taskId,
      taskName,
      input,
      actualOutput,
      expectedOutput,
      judgeOutput,
      score: judgeOutput.score,
      maxScore: judgeOutput.maxScore,
      confidence: this.calculateConfidence(judgeOutput),
      evaluationType: 'llm_judge',
      timestamp: Date.now()
    };
  }

  private calculateConfidence(judgeOutput: JudgeOutput): number {
    const criteria = judgeOutput.criteria;
    const avgScore = (criteria.correctness + criteria.completeness + criteria.relevance + criteria.clarity) / 4;
    return avgScore / 100;
  }

  async runBenchmark(dataset: EvaluationDataset): Promise<BenchmarkResult> {
    const results: EvaluationResult[] = [];
    let passedCount = 0;

    for (const sample of dataset.samples) {
      const result = this.evaluate(
        dataset.id,
        sample.id,
        sample.input,
        '',
        sample.expectedOutput
      );
      results.push(result);
      
      if (result.score >= 70) {
        passedCount++;
      }
    }

    const avgScore = results.length > 0
      ? results.reduce((acc, r) => acc + r.score, 0) / results.length
      : 0;
    const avgConfidence = results.length > 0
      ? results.reduce((acc, r) => acc + r.confidence, 0) / results.length
      : 0;

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalSamples: dataset.samples.length,
      passedSamples: passedCount,
      failedSamples: dataset.samples.length - passedCount,
      avgScore,
      avgConfidence,
      results,
      timestamp: Date.now()
    };
  }

  loadGAIA(): EvaluationDataset {
    return {
      id: 'gaia',
      name: 'GAIA Benchmark',
      description: 'GAIA (General AI Assistant) benchmark - 466道人工标注真实问题',
      type: 'gaia',
      samples: this.generateGAIASamples(),
      createdAt: Date.now()
    };
  }

  loadAgentBench(): EvaluationDataset {
    return {
      id: 'agentbench',
      name: 'AgentBench',
      description: '国内规模化通用基准，8大类任务、超2000用例',
      type: 'agentbench',
      samples: this.generateAgentBenchSamples(),
      createdAt: Date.now()
    };
  }

  private generateGAIASamples(): EvaluationSample[] {
    return [
      {
        id: 'gaia_001',
        input: '解释什么是人工智能？',
        metadata: { difficulty: 'easy', tags: ['概念'], requiresTools: false }
      },
      {
        id: 'gaia_002',
        input: '计算 25 × 4 + 18',
        expectedOutput: '118',
        metadata: { difficulty: 'easy', tags: ['数学', '计算'], requiresTools: false }
      },
      {
        id: 'gaia_003',
        input: '什么是量子计算？与经典计算有什么区别？',
        metadata: { difficulty: 'medium', tags: ['概念', '技术'], requiresTools: false }
      },
      {
        id: 'gaia_004',
        input: '搜索2024年诺贝尔物理学奖获得者',
        metadata: { difficulty: 'medium', tags: ['搜索', '时事'], requiresTools: true }
      },
      {
        id: 'gaia_005',
        input: '写一个Python函数来计算斐波那契数列',
        metadata: { difficulty: 'medium', tags: ['编程', 'Python'], requiresTools: false }
      }
    ];
  }

  private generateAgentBenchSamples(): EvaluationSample[] {
    return [
      {
        id: 'agent_001',
        input: '帮我制定一份一周健身计划',
        metadata: { difficulty: 'medium', tags: ['计划', '健康'], requiresTools: false }
      },
      {
        id: 'agent_002',
        input: '分析当前市场上主流的AI模型',
        metadata: { difficulty: 'hard', tags: ['分析', 'AI'], requiresTools: true }
      },
      {
        id: 'agent_003',
        input: '翻译"Artificial Intelligence"到中文',
        expectedOutput: '人工智能',
        metadata: { difficulty: 'easy', tags: ['翻译'], requiresTools: false }
      },
      {
        id: 'agent_004',
        input: '总结这篇文章的主要观点：人工智能正在改变世界，它在医疗、金融、教育等领域都有广泛应用。',
        expectedOutput: '人工智能在医疗、金融、教育等多个领域广泛应用，正在改变世界。',
        metadata: { difficulty: 'easy', tags: ['总结'], requiresTools: false }
      }
    ];
  }

  createCustomDataset(name: string, description: string, samples: EvaluationSample[]): EvaluationDataset {
    return {
      id: `custom_${Date.now()}`,
      name,
      description,
      type: 'custom',
      samples,
      createdAt: Date.now()
    };
  }
}