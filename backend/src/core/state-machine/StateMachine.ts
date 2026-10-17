export type StateId = string;
export type EventType = string;

export interface StateTransition {
  event: EventType;
  targetState: StateId;
  condition?: (context: StateMachineContext) => boolean;
  action?: (context: StateMachineContext) => Promise<void> | void;
}

export interface StateConfig {
  id: StateId;
  name: string;
  transitions: StateTransition[];
  entryAction?: (context: StateMachineContext) => Promise<void> | void;
  exitAction?: (context: StateMachineContext) => Promise<void> | void;
}

export interface StateMachineContext {
  [key: string]: any;
}

export interface StateMachineOptions {
  initialState: StateId;
  states: StateConfig[];
  context?: StateMachineContext;
}

export class StateMachine {
  private states: Map<StateId, StateConfig> = new Map();
  private currentState: StateId;
  private context: StateMachineContext;
  private listeners: Set<(event: StateMachineEvent) => void> = new Set();

  constructor(options: StateMachineOptions) {
    options.states.forEach(state => {
      this.states.set(state.id, state);
    });
    this.currentState = options.initialState;
    this.context = options.context || {};
  }

  getCurrentState(): StateId {
    return this.currentState;
  }

  getContext(): StateMachineContext {
    return this.context;
  }

  setContext(key: string, value: any): void {
    this.context[key] = value;
  }

  async triggerEvent(event: EventType): Promise<boolean> {
    const currentConfig = this.states.get(this.currentState);
    if (!currentConfig) {
      this.emitEvent('error', { error: `State ${this.currentState} not found` });
      return false;
    }

    const transition = currentConfig.transitions.find(t => {
      if (t.event !== event) return false;
      if (t.condition) return t.condition(this.context);
      return true;
    });

    if (!transition) {
      this.emitEvent('rejected', { event, currentState: this.currentState });
      return false;
    }

    if (currentConfig.exitAction) {
      await currentConfig.exitAction(this.context);
    }

    if (transition.action) {
      await transition.action(this.context);
    }

    this.currentState = transition.targetState;
    const nextConfig = this.states.get(this.currentState);

    if (nextConfig?.entryAction) {
      await nextConfig.entryAction(this.context);
    }

    this.emitEvent('transition', {
      from: currentConfig.id,
      to: this.currentState,
      event,
      context: { ...this.context }
    });

    return true;
  }

  async start(): Promise<void> {
    const config = this.states.get(this.currentState);
    if (config?.entryAction) {
      await config.entryAction(this.context);
    }
    this.emitEvent('started', { initialState: this.currentState });
  }

  onEvent(listener: (event: StateMachineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitEvent(type: StateMachineEventType, data: Record<string, any>): void {
    const event: StateMachineEvent = { type, timestamp: Date.now(), ...data };
    this.listeners.forEach(listener => listener(event));
  }

  reset(): void {
    const initialState = Array.from(this.states.values()).find(
      s => s.id === this.currentState || s.transitions.some(t => t.event === 'reset')
    )?.id || this.currentState;
    this.currentState = initialState;
    this.context = {};
    this.emitEvent('reset', {});
  }
}

export type StateMachineEventType = 'started' | 'transition' | 'rejected' | 'error' | 'reset';

export interface StateMachineEvent {
  type: StateMachineEventType;
  timestamp: number;
  from?: StateId;
  to?: StateId;
  event?: EventType;
  context?: StateMachineContext;
  error?: string;
}

export const AgentState = {
  IDLE: 'idle',
  UNDERSTANDING: 'understanding',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  REFLECTING: 'reflecting',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const AgentEvent = {
  START: 'start',
  UNDERSTOOD: 'understood',
  PLANNED: 'planned',
  EXECUTED: 'executed',
  REFLECTED: 'reflected',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  RESET: 'reset',
  RETRY: 'retry'
};

export function createAgentStateMachine(): StateMachine {
  return new StateMachine({
    initialState: AgentState.IDLE,
    states: [
      {
        id: AgentState.IDLE,
        name: '空闲状态',
        transitions: [
          { event: AgentEvent.START, targetState: AgentState.UNDERSTANDING }
        ],
        entryAction: async (ctx) => {
          ctx.taskComplete = false;
          ctx.error = null;
        }
      },
      {
        id: AgentState.UNDERSTANDING,
        name: '目标理解',
        transitions: [
          { event: AgentEvent.UNDERSTOOD, targetState: AgentState.PLANNING },
          { event: AgentEvent.FAILED, targetState: AgentState.FAILED }
        ]
      },
      {
        id: AgentState.PLANNING,
        name: '任务规划',
        transitions: [
          { event: AgentEvent.PLANNED, targetState: AgentState.EXECUTING },
          { event: AgentEvent.FAILED, targetState: AgentState.FAILED }
        ]
      },
      {
        id: AgentState.EXECUTING,
        name: '执行任务',
        transitions: [
          { event: AgentEvent.EXECUTED, targetState: AgentState.REFLECTING },
          { event: AgentEvent.FAILED, targetState: AgentState.FAILED },
          { event: AgentEvent.RETRY, targetState: AgentState.PLANNING }
        ]
      },
      {
        id: AgentState.REFLECTING,
        name: '结果反思',
        transitions: [
          {
            event: AgentEvent.REFLECTED,
            targetState: AgentState.COMPLETED,
            condition: (ctx) => ctx.taskComplete === true
          },
          {
            event: AgentEvent.REFLECTED,
            targetState: AgentState.PLANNING,
            condition: (ctx) => ctx.taskComplete !== true
          },
          { event: AgentEvent.FAILED, targetState: AgentState.FAILED }
        ]
      },
      {
        id: AgentState.COMPLETED,
        name: '任务完成',
        transitions: [
          { event: AgentEvent.RESET, targetState: AgentState.IDLE }
        ],
        entryAction: async (ctx) => {
          ctx.taskComplete = true;
        }
      },
      {
        id: AgentState.FAILED,
        name: '任务失败',
        transitions: [
          { event: AgentEvent.RESET, targetState: AgentState.IDLE },
          { event: AgentEvent.RETRY, targetState: AgentState.UNDERSTANDING }
        ],
        entryAction: async (ctx) => {
          ctx.taskComplete = false;
        }
      }
    ]
  });
}