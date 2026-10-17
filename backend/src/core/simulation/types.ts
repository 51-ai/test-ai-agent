/**
 * 模拟场景类型定义
 */

export interface SimulatedUser {
  id: string;
  profile: UserProfile;
  behavior: UserBehavior;
}

export interface UserProfile {
  age?: number;
  occupation?: string;
  expertise: 'beginner' | 'intermediate' | 'expert';
  language: 'zh' | 'en' | 'ja' | 'mixed';
  personality: 'friendly' | 'neutral' | 'aggressive';
}

export interface UserBehavior {
  patienceLevel: number; // 0-1
  expectedResponseTime: number; // ms
  toleranceForErrors: number; // 0-1
  communicationStyle: 'formal' | 'casual' | 'mixed';
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  difficulty: number; // 1-5
  objectives: ScenarioObjective[];
  constraints: ScenarioConstraint[];
  evaluationCriteria: EvaluationCriteria;
  metadata: ScenarioMetadata;
}

export type ScenarioCategory = 
  | 'conversation'
  | 'question_answering'
  | 'tool_usage'
  | 'problem_solving'
  | 'creativity'
  | 'technical'
  | 'multi_turn'
  | 'conflict_resolution'
  | 'emotional_support'
  | 'learning_assistance'
  | 'task_planning';

export interface ScenarioObjective {
  id: string;
  description: string;
  required: boolean;
  weight: number;
}

export interface ScenarioConstraint {
  type: 'max_turns' | 'max_time' | 'allowed_tools' | 'required_tools';
  value: any;
  description: string;
}

export interface EvaluationCriteria {
  accuracy: number; // 权重
  relevance: number;
  efficiency: number;
  user_satisfaction: number;
}

export interface ScenarioMetadata {
  author: string;
  createdAt: Date;
  tags: string[];
  estimatedDuration: number; // seconds
  successRate?: number;
  avgScore?: number;
}

export interface ScenarioResult {
  scenarioId: string;
  success: boolean;
  score: number;
  metrics: ScenarioMetrics;
  conversation: SimulatedConversation;
  feedback: string;
  recommendations: string[];
  timestamp: Date;
}

export interface ScenarioMetrics {
  accuracy: number;
  relevance: number;
  efficiency: number;
  userSatisfaction: number;
  completionTime: number;
  turnsUsed: number;
  toolsUsed: string[];
  errors: string[];
  rewards: number[];
}

export interface SimulatedConversation {
  turns: ConversationTurn[];
  totalDuration: number;
  userProfile: UserProfile;
}

export interface ConversationTurn {
  turnNumber: number;
  userMessage: string;
  agentResponse: string;
  tools?: ToolCall[];
  timestamp: Date;
  reward?: number;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  result?: any;
  success: boolean;
  duration: number;
}

export interface SimulationConfig {
  numEpisodes: number;
  scenarios: Scenario[];
  userProfiles: SimulatedUser[];
  evaluationMode: 'strict' | 'lenient' | 'balanced';
  enableRealTimeFeedback: boolean;
  saveResults: boolean;
  parallelScenarios: number;
}

export interface SimulationResult {
  overallScore: number;
  successRate: number;
  scenarioResults: ScenarioResult[];
  aggregatedMetrics: AggregatedMetrics;
  trainingData: TrainingData[];
  recommendations: string[];
  summary: string;
}

export interface AggregatedMetrics {
  avgAccuracy: number;
  avgRelevance: number;
  avgEfficiency: number;
  avgUserSatisfaction: number;
  totalTurns: number;
  totalToolsUsed: number;
  mostDifficultScenarios: string[];
  easiestScenarios: string[];
}

export interface TrainingData {
  scenario: Scenario;
  experience: {
    state: any;
    action: any;
    reward: number;
    nextState: any;
    done: boolean;
  };
}
