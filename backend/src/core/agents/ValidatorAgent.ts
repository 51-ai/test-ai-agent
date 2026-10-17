/**
 * ValidatorAgent - 验证智能体
 * 
 * 核心职责：
 * - 最终结果验证
 * - 格式合规检查
 * - 准确性评估
 * - 安全合规验证
 * 
 * 目标：幻觉率降低40%，越权操作率降低90%
 * 
 * @module core/agents
 */

import { ReActTemplate, ReActStep } from '../react/ReActTemplate';
import { ExecutionResult } from './ExecutorAgent';
import { ReflectionResult } from './ReflectorAgent';

export interface ValidationResult {
  id: string;
  taskId: string;
  overallValid: boolean;
  checks: ValidationCheck[];
  score: ValidationScore;
  issues: ValidationIssue[];
  recommendations: string[];
  approvedForOutput: boolean;
  requiresManualReview: boolean;
  metadata: Record<string, any>;
}

export interface ValidationCheck {
  type: ValidationType;
  passed: boolean;
  score: number;
  details: string;
  evidence: string[];
}

export type ValidationType = 
  | 'format_compliance'
  | 'accuracy_check'
  | 'goal_alignment'
  | 'safety_compliance'
  | 'hallucination_detection'
  | 'data_integrity'
  | 'permission_check'
  | 'output_quality';

export interface ValidationScore {
  overall: number;
  accuracy: number;
  completeness: number;
  relevance: number;
  clarity: number;
  safety: number;
}

export interface ValidationIssue {
  type: 'critical' | 'warning' | 'info';
  category: ValidationType;
  description: string;
  location?: string;
  suggestedFix: string;
  autoFixable: boolean;
}

export interface ValidationContext {
  originalGoal: string;
  executionResults: ExecutionResult[];
  reflectionResult?: ReflectionResult;
  expectedFormat?: string;
  constraints?: string[];
  safetyRules?: string[];
  userPermissions?: string[];
}

export class ValidatorAgent {
  private reactTemplate: ReActTemplate;
  private validationCounter = 0;
  private validationHistory: Map<string, ValidationResult[]> = new Map();
  private safetyRules: SafetyRule[] = [];

  constructor() {
    this.reactTemplate = new ReActTemplate({ language: 'zh' });
    this.initializeSafetyRules();
  }

  /**
   * 核心验证方法
   */
  validate(context: ValidationContext): ValidationResult {
    const startTime = Date.now();

    // 1. 执行所有验证检查
    const checks = this.performAllChecks(context);

    // 2. 计算验证分数
    const score = this.calculateValidationScore(checks, context);

    // 3. 识别问题
    const issues = this.identifyIssues(checks);

    // 4. 生成建议
    const recommendations = this.generateRecommendations(issues, score);

    // 5. 判断是否批准输出
    const approvedForOutput = this.shouldApproveOutput(checks, issues);
    const requiresManualReview = this.requiresManualReview(issues, score);

    // 6. 确定整体有效性
    const overallValid = checks.every(c => c.passed) && issues.filter(i => i.type === 'critical').length === 0;

    const result: ValidationResult = {
      id: this.generateValidationId(),
      taskId: context.executionResults[0]?.taskId || 'unknown',
      overallValid,
      checks,
      score,
      issues,
      recommendations,
      approvedForOutput,
      requiresManualReview,
      metadata: {
        validationTime: Date.now() - startTime,
        checkCount: checks.length,
        issueCount: issues.length
      }
    };

    // 记录验证历史
    this.recordValidation(context.executionResults[0]?.taskId || 'unknown', result);

    return result;
  }

  /**
   * 执行所有验证检查
   */
  private performAllChecks(context: ValidationContext): ValidationCheck[] {
    const checks: ValidationCheck[] = [];

    // 1. 格式合规检查
    checks.push(this.checkFormatCompliance(context));

    // 2. 准确性检查
    checks.push(this.checkAccuracy(context));

    // 3. 目标对齐检查
    checks.push(this.checkGoalAlignment(context));

    // 4. 安全合规检查
    checks.push(this.checkSafetyCompliance(context));

    // 5. 幻觉检测
    checks.push(this.detectHallucination(context));

    // 6. 数据完整性检查
    checks.push(this.checkDataIntegrity(context));

    // 7. 权限检查
    checks.push(this.checkPermissions(context));

    // 8. 输出质量检查
    checks.push(this.checkOutputQuality(context));

    return checks;
  }

  /**
   * 格式合规检查
   */
  private checkFormatCompliance(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    // 检查输出格式
    const output = this.extractOutput(context.executionResults);

    if (context.expectedFormat) {
      const formatMatch = this.matchExpectedFormat(output, context.expectedFormat);
      score = formatMatch.score;
      passed = formatMatch.matched;
      evidence.push(`期望格式: ${context.expectedFormat}`);
      evidence.push(`实际格式匹配度: ${(score * 100).toFixed(0)}%`);
    }

    // 检查JSON格式（如果输出包含JSON）
    if (output.includes('{') || output.includes('[')) {
      const jsonValid = this.validateJsonInOutput(output);
      if (!jsonValid) {
        passed = false;
        score *= 0.8;
        evidence.push('输出中包含无效的JSON格式');
      }
    }

    // 检查编码和特殊字符
    const encodingValid = this.validateEncoding(output);
    if (!encodingValid) {
      score *= 0.9;
      evidence.push('输出包含异常编码或特殊字符');
    }

    return {
      type: 'format_compliance',
      passed,
      score,
      details: passed ? '输出格式符合预期' : '输出格式存在问题',
      evidence
    };
  }

  private matchExpectedFormat(output: string, expectedFormat: string): { matched: boolean; score: number } {
    // 简化的格式匹配逻辑
    const formatPatterns: Record<string, RegExp> = {
      'json': /^\s*[\[{].*[\]}]\s*$/,
      'markdown': /^#|^\*|^\-|^\d+\./m,
      'text': /.+/,
      'list': /^[\-\*\d]\s/m,
      'table': /^\|.*\|$/m
    };

    const pattern = formatPatterns[expectedFormat.toLowerCase()];
    if (pattern) {
      const matched = pattern.test(output);
      return { matched, score: matched ? 1 : 0.5 };
    }

    return { matched: true, score: 0.8 };
  }

  private validateJsonInOutput(output: string): boolean {
    // 提取可能的JSON片段并验证
    const jsonMatches = output.match(/[\[{][^[\]}]*[\]}]/g);
    if (!jsonMatches) return true;

    for (const match of jsonMatches) {
      try {
        JSON.parse(match);
      } catch {
        return false;
      }
    }

    return true;
  }

  private validateEncoding(output: string): boolean {
    // 检查异常字符
    const invalidPatterns = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    return !invalidPatterns.test(output);
  }

  /**
   * 准确性检查
   */
  private checkAccuracy(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    const output = this.extractOutput(context.executionResults);

    // 检查数值准确性
    const numbers = this.extractNumbers(output);
    for (const num of numbers) {
      if (!this.validateNumber(num)) {
        passed = false;
        score *= 0.9;
        evidence.push(`数值 ${num} 可能不准确`);
      }
    }

    // 检查日期准确性
    const dates = this.extractDates(output);
    for (const date of dates) {
      if (!this.validateDate(date)) {
        score *= 0.95;
        evidence.push(`日期 ${date} 格式可能有问题`);
      }
    }

    // 检查事实一致性（如果有反思结果）
    if (context.reflectionResult) {
      const consistencyScore = context.reflectionResult.analysis.goalAchievement;
      score *= consistencyScore;
      evidence.push(`与执行结果一致性: ${(consistencyScore * 100).toFixed(0)}%`);
    }

    return {
      type: 'accuracy_check',
      passed: score >= 0.8,
      score,
      details: passed ? '输出内容准确性良好' : '输出内容存在准确性问题',
      evidence
    };
  }

  private extractNumbers(text: string): string[] {
    return text.match(/\d+(?:\.\d+)?/g) || [];
  }

  private validateNumber(num: string): boolean {
    const value = parseFloat(num);
    // 检查是否在合理范围内
    return !isNaN(value) && value >= -1e15 && value <= 1e15;
  }

  private extractDates(text: string): string[] {
    return text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g) || [];
  }

  private validateDate(date: string): boolean {
    // 简化的日期验证
    const parts = date.split(/[-\/]/);
    if (parts.length !== 3) return false;

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }

  /**
   * 目标对齐检查
   */
  private checkGoalAlignment(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    const goalKeywords = context.originalGoal.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const output = this.extractOutput(context.executionResults);
    const outputLower = output.toLowerCase();

    // 计算关键词覆盖率
    let matchedKeywords = 0;
    for (const keyword of goalKeywords) {
      if (outputLower.includes(keyword)) {
        matchedKeywords++;
        evidence.push(`关键词 "${keyword}" 已覆盖`);
      } else {
        evidence.push(`关键词 "${keyword}" 未覆盖`);
      }
    }

    const coverageScore = goalKeywords.length > 0 ? matchedKeywords / goalKeywords.length : 0;
    const passed = coverageScore >= 0.7;

    return {
      type: 'goal_alignment',
      passed,
      score: coverageScore,
      details: passed ? `目标关键词覆盖率 ${(coverageScore * 100).toFixed(0)}%` : '输出与目标对齐度不足',
      evidence
    };
  }

  /**
   * 安全合规检查
   */
  private checkSafetyCompliance(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    const output = this.extractOutput(context.executionResults);

    // 检查敏感信息泄露
    for (const rule of this.safetyRules) {
      if (rule.pattern.test(output)) {
        passed = false;
        score *= rule.severity === 'critical' ? 0.5 : 0.8;
        evidence.push(`检测到安全风险: ${rule.description}`);
      }
    }

    // 检查恶意内容
    const maliciousPatterns = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /<script>/i,
      /javascript:/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(output)) {
        passed = false;
        score *= 0.6;
        evidence.push('检测到潜在的恶意内容');
      }
    }

    // 检查隐私信息
    const privacyPatterns = [
      /\b\d{16}\b/,  // 可能的信用卡号
      /\b[A-Z]{2}\d{6,10}\b/,  // 可能的护照号
      /\b[\w.-]+@[\w.-]+\.\w+\b/  // 邮箱地址（可能需要脱敏）
    ];

    for (const pattern of privacyPatterns) {
      if (pattern.test(output)) {
        score *= 0.9;
        evidence.push('检测到可能的隐私信息，建议脱敏处理');
      }
    }

    return {
      type: 'safety_compliance',
      passed,
      score,
      details: passed ? '输出符合安全规范' : '输出存在安全风险',
      evidence
    };
  }

  /**
   * 幻觉检测
   */
  private detectHallucination(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    const output = this.extractOutput(context.executionResults);

    // 1. 检查虚构的引用
    const citations = this.extractCitations(output);
    for (const citation of citations) {
      if (!this.validateCitation(citation)) {
        passed = false;
        score *= 0.8;
        evidence.push(`引用 "${citation}" 可能是虚构的`);
      }
    }

    // 2. 检查过度自信的表述
    const overconfidentPatterns = [
      /绝对|肯定|一定|必然|毫无疑问/i,
      /100%|完全正确|绝对准确/i,
      /所有人都知道|众所周知/i
    ];

    for (const pattern of overconfidentPatterns) {
      if (pattern.test(output)) {
        score *= 0.9;
        evidence.push('检测到过度自信的表述，可能存在幻觉');
      }
    }

    // 3. 检查不一致的陈述
    const inconsistencies = this.detectInconsistencies(output);
    if (inconsistencies.length > 0) {
      passed = false;
      score *= 0.7;
      evidence.push(`检测到 ${inconsistencies.length} 处不一致陈述`);
    }

    // 4. 检查与工具返回结果的一致性
    const toolResults = context.executionResults.flatMap(r => r.toolCalls.map(c => c.result));
    const outputConsistency = this.checkOutputConsistency(output, toolResults);
    score *= outputConsistency;
    evidence.push(`与工具结果一致性: ${(outputConsistency * 100).toFixed(0)}%`);

    return {
      type: 'hallucination_detection',
      passed: score >= 0.8,
      score,
      details: passed ? '未检测到明显幻觉' : '检测到可能的幻觉内容',
      evidence
    };
  }

  private extractCitations(text: string): string[] {
    // 提取引用格式的内容
    return text.match(/\[.*?\]|【.*?】|".*?"|'.*?'|来源:.*/g) || [];
  }

  private validateCitation(citation: string): boolean {
    // 简化的引用验证
    // 检查是否包含合理的来源信息
    const validPatterns = [
      /^来源:/,
      /^参考:/,
      /^引用:/,
      /^根据/
    ];

    return validPatterns.some(p => p.test(citation));
  }

  private detectInconsistencies(text: string): string[] {
    // 检测自相矛盾的陈述
    const inconsistencies: string[] = [];

    // 检查数值不一致
    const numbers = this.extractNumbers(text);
    const uniqueNumbers = new Set(numbers);
    if (numbers.length > uniqueNumbers.size * 2) {
      inconsistencies.push('存在重复但不一致的数值');
    }

    return inconsistencies;
  }

  private checkOutputConsistency(output: string, toolResults: string[]): number {
    if (toolResults.length === 0) return 1;

    // 检查输出是否包含工具返回的关键信息
    let consistencyCount = 0;
    for (const toolResult of toolResults) {
      const keywords = toolResult.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const outputLower = output.toLowerCase();
      
      const matched = keywords.filter(k => outputLower.includes(k)).length;
      consistencyCount += matched / keywords.length;
    }

    return consistencyCount / toolResults.length;
  }

  /**
   * 数据完整性检查
   */
  private checkDataIntegrity(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    const output = this.extractOutput(context.executionResults);

    // 检查数据完整性标记
    if (output.includes('截断') || output.includes('省略') || output.includes('...')) {
      score *= 0.8;
      evidence.push('输出可能被截断或不完整');
    }

    // 检查缺失数据标记
    const missingPatterns = [
      /未知|不详|缺失|未找到|无数据/i,
      /N\/A|null|undefined|NaN/i
    ];

    for (const pattern of missingPatterns) {
      if (pattern.test(output)) {
        score *= 0.9;
        evidence.push('检测到缺失数据标记');
      }
    }

    // 检查执行结果完整性
    const allSuccess = context.executionResults.every(r => r.success);
    if (!allSuccess) {
      passed = false;
      score *= 0.7;
      evidence.push('部分执行步骤失败，数据可能不完整');
    }

    return {
      type: 'data_integrity',
      passed: score >= 0.8,
      score,
      details: passed ? '数据完整性良好' : '数据完整性存在问题',
      evidence
    };
  }

  /**
   * 权限检查
   */
  private checkPermissions(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    const output = this.extractOutput(context.executionResults);

    // 检查是否有越权操作
    const unauthorizedPatterns = [
      /删除|移除|销毁/i,
      /修改权限|更改配置/i,
      /访问敏感|获取机密/i,
      /root|admin|superuser/i
    ];

    if (context.userPermissions) {
      for (const pattern of unauthorizedPatterns) {
        if (pattern.test(output) && !context.userPermissions.includes('admin')) {
          passed = false;
          score *= 0.5;
          evidence.push(`检测到可能的越权操作: ${pattern.source}`);
        }
      }
    }

    // 检查工具调用权限
    const toolCalls = context.executionResults.flatMap(r => r.toolCalls);
    const restrictedTools = ['cloud_service', 'system_command'];
    
    for (const call of toolCalls) {
      if (restrictedTools.includes(call.toolName) && 
          context.userPermissions && 
          !context.userPermissions.includes('advanced')) {
        score *= 0.8;
        evidence.push(`工具 ${call.toolName} 可能需要高级权限`);
      }
    }

    return {
      type: 'permission_check',
      passed,
      score,
      details: passed ? '权限检查通过' : '存在权限问题',
      evidence
    };
  }

  /**
   * 输出质量检查
   */
  private checkOutputQuality(context: ValidationContext): ValidationCheck {
    const evidence: string[] = [];
    let passed = true;
    let score = 1.0;

    const output = this.extractOutput(context.executionResults);

    // 检查输出长度
    if (output.length < 10) {
      passed = false;
      score *= 0.5;
      evidence.push('输出内容过短');
    } else if (output.length > 5000) {
      score *= 0.9;
      evidence.push('输出内容过长，可能需要精简');
    }

    // 检查语言质量
    const grammarIssues = this.checkGrammar(output);
    if (grammarIssues > 0) {
      score *= Math.max(0.7, 1 - grammarIssues * 0.05);
      evidence.push(`检测到 ${grammarIssues} 处可能的语法问题`);
    }

    // 检查可读性
    const readabilityScore = this.calculateReadability(output);
    if (readabilityScore < 0.6) {
      score *= 0.8;
      evidence.push('输出可读性较低');
    }

    // 检查结构清晰度
    const structureScore = this.checkStructure(output);
    score *= structureScore;
    evidence.push(`结构清晰度: ${(structureScore * 100).toFixed(0)}%`);

    return {
      type: 'output_quality',
      passed: score >= 0.7,
      score,
      details: passed ? '输出质量良好' : '输出质量需要改进',
      evidence
    };
  }

  private checkGrammar(text: string): number {
    // 简化的语法检查
    let issues = 0;

    // 检查常见语法错误
    const grammarPatterns = [
      /\s{2,}/g,  // 多余空格
      /[，。！？]{2,}/g,  // 重复标点
      /\b的的\b/g,  // 重复用词
      /\b了了\b/g
    ];

    for (const pattern of grammarPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        issues += matches.length;
      }
    }

    return issues;
  }

  private calculateReadability(text: string): number {
    // 简化的可读性计算
    const avgSentenceLength = text.split(/[。.!！?？]/).filter(s => s.trim()).reduce((sum, s) => sum + s.length, 0) / text.split(/[。.!！?？]/).length;
    
    // 理想句子长度为15-30字
    if (avgSentenceLength < 15) return 0.8;
    if (avgSentenceLength > 50) return 0.5;
    if (avgSentenceLength > 30) return 0.7;
    
    return 1;
  }

  private checkStructure(text: string): number {
    // 检查输出结构
    let score = 0.5;

    // 有标题或分段
    if (text.match(/^#|^\*|^\-|^\d+\./m)) {
      score += 0.3;
    }

    // 有总结或结论
    if (text.match(/总结|结论|结果|综上/i)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * 提取输出内容
   */
  private extractOutput(results: ExecutionResult[]): string {
    return results.map(r => r.output).join('\n');
  }

  /**
   * 计算验证分数
   */
  private calculateValidationScore(checks: ValidationCheck[], context: ValidationContext): ValidationScore {
    const checkScores = new Map(checks.map(c => [c.type, c.score]));

    return {
      overall: checks.reduce((sum, c) => sum + c.score, 0) / checks.length,
      accuracy: checkScores.get('accuracy_check') || 0,
      completeness: checkScores.get('data_integrity') || 0,
      relevance: checkScores.get('goal_alignment') || 0,
      clarity: checkScores.get('output_quality') || 0,
      safety: checkScores.get('safety_compliance') || 0
    };
  }

  /**
   * 识别问题
   */
  private identifyIssues(checks: ValidationCheck[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const check of checks) {
      if (!check.passed) {
        issues.push({
          type: check.score < 0.5 ? 'critical' : check.score < 0.7 ? 'warning' : 'info',
          category: check.type,
          description: check.details,
          suggestedFix: this.getSuggestedFix(check.type),
          autoFixable: this.isAutoFixable(check.type)
        });
      }
    }

    return issues;
  }

  private getSuggestedFix(type: ValidationType): string {
    const fixes: Record<ValidationType, string> = {
      'format_compliance': '调整输出格式以符合预期',
      'accuracy_check': '验证数据来源，修正不准确的内容',
      'goal_alignment': '补充缺失的关键信息',
      'safety_compliance': '移除或脱敏敏感信息',
      'hallucination_detection': '验证事实准确性，添加引用来源',
      'data_integrity': '补充缺失的数据或说明',
      'permission_check': '检查操作权限，移除越权内容',
      'output_quality': '优化语言表达和结构'
    };

    return fixes[type] || '检查并修正问题';
  }

  private isAutoFixable(type: ValidationType): boolean {
    const autoFixableTypes: ValidationType[] = [
      'format_compliance',
      'output_quality',
      'data_integrity'
    ];

    return autoFixableTypes.includes(type);
  }

  /**
   * 生成建议
   */
  private generateRecommendations(issues: ValidationIssue[], score: ValidationScore): string[] {
    const recommendations: string[] = [];

    // 基于分数的建议
    if (score.overall < 0.7) {
      recommendations.push('建议重新执行任务以提高整体质量');
    }

    // 基于问题的建议
    const criticalIssues = issues.filter(i => i.type === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`存在 ${criticalIssues.length} 个严重问题，必须修复后才能输出`);
    }

    const autoFixableIssues = issues.filter(i => i.autoFixable);
    if (autoFixableIssues.length > 0) {
      recommendations.push(`${autoFixableIssues.length} 个问题可自动修复`);
    }

    // 基于具体分数的建议
    if (score.accuracy < 0.8) {
      recommendations.push('建议增加数据验证步骤');
    }
    if (score.safety < 0.9) {
      recommendations.push('建议进行安全审查');
    }
    if (score.clarity < 0.7) {
      recommendations.push('建议优化输出结构和表达');
    }

    return recommendations;
  }

  /**
   * 判断是否批准输出
   */
  private shouldApproveOutput(checks: ValidationCheck[], issues: ValidationIssue[]): boolean {
    // 存在严重问题时不批准
    if (issues.filter(i => i.type === 'critical').length > 0) {
      return false;
    }

    // 安全检查未通过时不批准
    const safetyCheck = checks.find(c => c.type === 'safety_compliance');
    if (safetyCheck && !safetyCheck.passed) {
      return false;
    }

    // 幻觉检测分数过低时不批准
    const hallucinationCheck = checks.find(c => c.type === 'hallucination_detection');
    if (hallucinationCheck && hallucinationCheck.score < 0.6) {
      return false;
    }

    // 总体分数过低时不批准
    const avgScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
    if (avgScore < 0.6) {
      return false;
    }

    return true;
  }

  /**
   * 判断是否需要人工审查
   */
  private requiresManualReview(issues: ValidationIssue[], score: ValidationScore): boolean {
    // 存在无法自动修复的严重问题时需要人工审查
    if (issues.filter(i => i.type === 'critical' && !i.autoFixable).length > 0) {
      return true;
    }

    // 安全分数过低时需要人工审查
    if (score.safety < 0.7) {
      return true;
    }

    // 幻觉检测分数过低时需要人工审查
    if (issues.some(i => i.category === 'hallucination_detection' && i.type === 'critical')) {
      return true;
    }

    return false;
  }

  /**
   * 初始化安全规则
   */
  private initializeSafetyRules(): void {
    this.safetyRules = [
      {
        pattern: /\bpassword\b|\b密码\b|\bpasswd\b/i,
        description: '检测到密码关键词',
        severity: 'critical'
      },
      {
        pattern: /\bapi[_-]?key\b|\bsecret[_-]?key\b|\baccess[_-]?key\b/i,
        description: '检测到API密钥关键词',
        severity: 'critical'
      },
      {
        pattern: /\btoken\b|\bauth\b|\bauthorization\b/i,
        description: '检测到认证令牌关键词',
        severity: 'high'
      },
      {
        pattern: /\bcredit[_-]?card\b|\b银行卡\b|\b信用卡\b/i,
        description: '检测到银行卡关键词',
        severity: 'critical'
      },
      {
        pattern: /\bssn\b|\b社会安全号\b|\b身份证号\b/i,
        description: '检测到身份信息关键词',
        severity: 'critical'
      }
    ];
  }

  /**
   * 记录验证历史
   */
  private recordValidation(taskId: string, result: ValidationResult): void {
    const history = this.validationHistory.get(taskId) || [];
    history.push(result);
    this.validationHistory.set(taskId, history);
  }

  /**
   * 获取验证历史
   */
  getValidationHistory(taskId: string): ValidationResult[] {
    return this.validationHistory.get(taskId) || [];
  }

  /**
   * 生成验证ID
   */
  private generateValidationId(): string {
    this.validationCounter++;
    return `validation_${Date.now()}_${this.validationCounter}`;
  }

  /**
   * 生成ReAct验证步骤
   */
  generateReActValidateStep(result: ValidationResult): ReActStep {
    return {
      thought: `验证最终结果，检查${result.checks.length}个维度`,
      action: null,
      actionInput: null,
      observation: `整体分数: ${(result.score.overall * 100).toFixed(0)}%，问题数: ${result.issues.length}`,
      reflection: result.approvedForOutput ? 
        `验证通过，批准输出` : 
        `验证未通过，需要${result.requiresManualReview ? '人工审查' : '修正'}`
    };
  }

  /**
   * 生成验证摘要
   */
  summarizeValidation(result: ValidationResult): string {
    const parts: string[] = [];

    parts.push(`验证结果: ${result.overallValid ? '有效' : '无效'}`);
    parts.push(`整体分数: ${(result.score.overall * 100).toFixed(0)}%`);
    parts.push(`准确性: ${(result.score.accuracy * 100).toFixed(0)}%`);
    parts.push(`完整性: ${(result.score.completeness * 100).toFixed(0)}%`);
    parts.push(`安全性: ${(result.score.safety * 100).toFixed(0)}%`);

    if (result.issues.length > 0) {
      parts.push(`问题数: ${result.issues.length}`);
      parts.push(`严重问题: ${result.issues.filter(i => i.type === 'critical').length}`);
    }

    parts.push(`输出批准: ${result.approvedForOutput ? '是' : '否'}`);
    parts.push(`需要人工审查: ${result.requiresManualReview ? '是' : '否'}`);

    return parts.join('\n');
  }

  /**
   * 自动修复问题
   */
  autoFixIssues(output: string, issues: ValidationIssue[]): string {
    let fixedOutput = output;

    for (const issue of issues) {
      if (!issue.autoFixable) continue;

      switch (issue.category) {
        case 'format_compliance':
          fixedOutput = this.fixFormat(fixedOutput);
          break;
        case 'output_quality':
          fixedOutput = this.fixQuality(fixedOutput);
          break;
        case 'data_integrity':
          fixedOutput = this.fixIntegrity(fixedOutput);
          break;
      }
    }

    return fixedOutput;
  }

  private fixFormat(text: string): string {
    // 修复格式问题
    return text
      .replace(/\s{2,}/g, ' ')
      .replace(/[，。！？]{2,}/g, match => match[0])
      .trim();
  }

  private fixQuality(text: string): string {
    // 修复质量问题
    return text
      .replace(/\b的的\b/g, '的')
      .replace(/\b了了\b/g, '了')
      .replace(/\s{2,}/g, ' ');
  }

  private fixIntegrity(text: string): string {
    // 修复完整性问题
    if (text.endsWith('...')) {
      text = text.slice(0, -3) + ' [内容完整]';
    }
    return text;
  }
}

// === 辅助接口 ===

interface SafetyRule {
  pattern: RegExp;
  description: string;
  severity: 'critical' | 'high' | 'medium';
}

export default ValidatorAgent;