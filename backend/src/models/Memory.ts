import mongoose, { Schema, Document } from 'mongoose';

export interface IMemory extends Document {
  userId: string;
  type: 'short' | 'long' | 'skill';
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  accessedAt: Date;
}

const MemorySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['short', 'long', 'skill'], required: true },
  content: { type: String, required: true },
  embedding: { type: [Number] },
  metadata: { type: Schema.Types.Mixed },
  accessedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

export const Memory = mongoose.model<IMemory>('Memory', MemorySchema);