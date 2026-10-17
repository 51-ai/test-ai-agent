/**
 * 模块化Agent系统导出
 * 
 * 包含四个专用Agent和协调器：
 * - PlannerAgent: 规划智能体
 * - ExecutorAgent: 执行智能体
 * - ReflectorAgent: 反思智能体
 * - ValidatorAgent: 验证智能体
 * - ModularAgentCoordinator: 协调器
 * 
 * @module core/agents
 */

export { PlannerAgent, TaskPlan, SubTask, PlanningResult, TaskType, Priority, Dependency } from './PlannerAgent';
export { ExecutorAgent, ExecutionResult, ToolCallRecord, ExecutionContext, ToolExecutor, ToolSchema } from './ExecutorAgent';
export { ReflectorAgent, ReflectionResult, ReflectionAnalysis, ErrorPattern, Correction, ImprovementSuggestion, RetryStrategy } from './ReflectorAgent';
export { ValidatorAgent, ValidationResult, ValidationCheck, ValidationScore, ValidationIssue, ValidationContext } from './ValidatorAgent';
export { ModularAgentCoordinator, AgentWorkflowResult, WorkflowConfig } from './ModularAgentCoordinator';

// 默认导出协调器
export { default as ModularAgentSystem } from './ModularAgentCoordinator';