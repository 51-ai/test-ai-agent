/**
 * 数据管道 - ETL/批处理/流处理管道
 */

import { v4 as uuidv4 } from 'uuid';

export type PipelineStageType = 'source' | 'transform' | 'filter' | 'enrich' | 'aggregate' | 'sink' | 'split' | 'merge';
export type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ExecutionMode = 'batch' | 'stream' | 'micro_batch';
export type DataFormat = 'json' | 'csv' | 'avro' | 'parquet' | 'protobuf' | 'text' | 'binary';

export interface PipelineStage {
  id: string;
  name: string;
  type: PipelineStageType;
  config: Record<string, unknown>;
  nextStages: string[];
  enabled: boolean;
  parallel: number;
  timeout?: number;
  retryCount?: number;
  metadata?: Record<string, unknown>;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  version: string;
  stages: PipelineStage[];
  mode: ExecutionMode;
  status: PipelineStatus;
  schedule?: {
    type: 'manual' | 'interval' | 'cron';
    expression?: string;
    intervalMs?: number;
  };
  config: {
    parallelism: number;
    bufferSize: number;
    checkpointInterval: number;
    errorHandling: 'stop' | 'skip' | 'retry' | 'dlq';
    maxRetries: number;
  };
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  runCount: number;
  metadata?: Record<string, unknown>;
}

export interface PipelineRecord {
  id: string;
  data: Record<string, unknown>;
  metadata: {
    source?: string;
    timestamp: Date;
    pipelineId: string;
    stageId?: string;
    attempts: number;
  };
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  bytesProcessed: number;
  stageMetrics: Map<string, { duration: number; in: number; out: number; errors: number }>;
  errors: Array<{ stage: string; record: string; error: string; timestamp: Date }>;
  metadata?: Record<string, unknown>;
}

export interface TransformFunction {
  (record: PipelineRecord): PipelineRecord | Promise<PipelineRecord> | null | Promise<null>;
}

export interface PipelineStats {
  totalPipelines: number;
  totalExecutions: number;
  runningExecutions: number;
  averageThroughput: number;
  totalRecordsProcessed: number;
  successRate: number;
  byStatus: Record<PipelineStatus, number>;
}

export class DataPipeline {
  private pipelines: Map<string, Pipeline> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();
  private transforms: Map<string, TransformFunction> = new Map();
  private buffers: Map<string, PipelineRecord[]> = new Map();
  private stats: PipelineStats = {
    totalPipelines: 0,
    totalExecutions: 0,
    runningExecutions: 0,
    averageThroughput: 0,
    totalRecordsProcessed: 0,
    successRate: 0,
    byStatus: { idle: 0, running: 0, paused: 0, completed: 0, failed: 0, cancelled: 0 }
  };

  createPipeline(config: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'status'>): string {
    const id = uuidv4();
    const pipeline: Pipeline = {
      ...config,
      id,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0
    };
    this.pipelines.set(id, pipeline);
    this.stats.totalPipelines++;
    return id;
  }

  registerTransform(name: string, fn: TransformFunction): void {
    this.transforms.set(name, fn);
  }

  addStage(pipelineId: string, stage: Omit<PipelineStage, 'id'>): string | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;
    const id = uuidv4();
    pipeline.stages.push({ ...stage, id });
    pipeline.updatedAt = new Date();
    return id;
  }

  async execute(pipelineId: string, records: PipelineRecord[]): Promise<PipelineExecution> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const execution: PipelineExecution = {
      id: uuidv4(),
      pipelineId,
      status: 'running',
      startTime: new Date(),
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      bytesProcessed: 0,
      stageMetrics: new Map(),
      errors: []
    };

    pipeline.status = 'running';
    pipeline.lastRunAt = execution.startTime;
    pipeline.runCount++;
    this.executions.set(execution.id, execution);
    this.stats.totalExecutions++;
    this.stats.runningExecutions++;
    this.stats.byStatus.running++;

    try {
      let current = [...records];
      for (const stage of pipeline.stages) {
        if (!stage.enabled) continue;
        const stageStart = Date.now();
        const stageIn = current.length;
        const errors = 0;

        const transformed = await this.processStage(stage, current, execution);
        current = transformed.records;
        execution.stageMetrics.set(stage.id, {
          duration: Date.now() - stageStart,
          in: stageIn,
          out: transformed.records.length,
          errors
        });
      }

      execution.recordsProcessed = current.length;
      execution.recordsSucceeded = current.length;
      execution.recordsFailed = 0;
      execution.status = 'completed';
    } catch (err) {
      execution.status = 'failed';
      execution.errors.push({
        stage: 'pipeline',
        record: 'pipeline',
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date()
      });
    } finally {
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      pipeline.status = execution.status;
      this.stats.runningExecutions--;
      this.stats.byStatus[execution.status]++;
      this.updateStats(execution);
    }

    return execution;
  }

  private async processStage(
    stage: PipelineStage,
    records: PipelineRecord[],
    execution: PipelineExecution
  ): Promise<{ records: PipelineRecord[] }> {
    const results: PipelineRecord[] = [];
    for (const record of records) {
      try {
        if (stage.type === 'filter') {
          const pass = this.evaluateFilter(record, stage.config);
          if (pass) results.push(record);
        } else if (stage.type === 'transform' || stage.type === 'enrich') {
          const fn = this.transforms.get(String(stage.config.transform));
          if (fn) {
            const transformed = await fn(record);
            if (transformed) results.push(transformed);
          } else {
            results.push(record);
          }
        } else {
          results.push(record);
        }
        execution.recordsProcessed++;
        execution.bytesProcessed += JSON.stringify(record.data).length;
      } catch (err) {
        execution.recordsFailed++;
        execution.errors.push({
          stage: stage.name,
          record: record.id,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date()
        });
        if (this.pipelines.get(execution.pipelineId)?.config.errorHandling === 'stop') throw err;
      }
    }
    return { records: results };
  }

  private evaluateFilter(record: PipelineRecord, config: Record<string, unknown>): boolean {
    const field = String(config.field || '');
    const op = String(config.op || 'eq');
    const value = config.value;
    const recordValue = record.data[field];

    switch (op) {
      case 'eq': return recordValue === value;
      case 'neq': return recordValue !== value;
      case 'gt': return Number(recordValue) > Number(value);
      case 'lt': return Number(recordValue) < Number(value);
      case 'contains': return String(recordValue || '').includes(String(value));
      case 'exists': return recordValue !== undefined && recordValue !== null;
      default: return true;
    }
  }

  pause(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline || pipeline.status !== 'running') return false;
    pipeline.status = 'paused';
    return true;
  }

  resume(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline || pipeline.status !== 'paused') return false;
    pipeline.status = 'running';
    return true;
  }

  cancel(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;
    pipeline.status = 'cancelled';
    return true;
  }

  getPipeline(pipelineId: string): Pipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  listPipelines(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  getStats(): PipelineStats {
    return { ...this.stats };
  }

  private updateStats(execution: PipelineExecution): void {
    this.stats.totalRecordsProcessed += execution.recordsProcessed;
    const total = this.stats.totalExecutions;
    const completed = this.stats.byStatus.completed + (execution.status === 'completed' ? 1 : 0);
    this.stats.successRate = total > 0 ? completed / total : 0;
    if (execution.duration && execution.duration > 0) {
      this.stats.averageThroughput = (execution.recordsProcessed / execution.duration) * 1000;
    }
  }

  deletePipeline(pipelineId: string): boolean {
    return this.pipelines.delete(pipelineId);
  }
}

export const dataPipeline = new DataPipeline();
export default DataPipeline;
