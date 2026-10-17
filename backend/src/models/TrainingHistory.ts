import mongoose, { Schema, Document } from 'mongoose';

/**
 * 训练历史持久化（仪表盘趋势图数据源）。
 *
 * 背景：TrainingLogger 的 events/metrics 只存在内存（最多 1000 事件 / 100 指标），
 * 进程重启即丢，仪表盘"历史趋势"无从谈起。这里把两类关键记录落库：
 *  - kind='train'：一次 PPO 训练完成的损失指标（policy/value/entropy）
 *  - kind='episode'：一次 episode 结束的累计奖励与成败
 *
 * 写入全部走 best-effort（失败仅告警），MongoDB 不可用时训练主流程不受影响。
 */
export type TrainingRecordKind = 'train' | 'episode';

export interface ITrainingHistory extends Document {
  /** 归属用户（训练数据按用户隔离） */
  userId: string;
  kind: TrainingRecordKind;
  /** 记录产生时间（毫秒时间戳，与前端 TrainingLogger 口径一致） */
  ts: number;
  /** kind='train' 时有效 */
  policyLoss?: number;
  valueLoss?: number;
  entropy?: number;
  /** kind='episode' 时有效 */
  episode?: number;
  reward?: number;
  success?: boolean;
  /** 记录时间（用于 TTL / 按天聚合） */
  createdAt: Date;
}

const TrainingHistorySchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  kind: { type: String, enum: ['train', 'episode'], required: true },
  ts: { type: Number, required: true },
  policyLoss: { type: Number },
  valueLoss: { type: Number },
  entropy: { type: Number },
  episode: { type: Number },
  reward: { type: Number },
  success: { type: Boolean }
}, {
  timestamps: true
});

// 仪表盘查询模式：按用户 + 类型，按时间倒序取最近 N 条
TrainingHistorySchema.index({ userId: 1, kind: 1, ts: -1 });

export const TrainingHistory = mongoose.model<ITrainingHistory>('TrainingHistory', TrainingHistorySchema);
