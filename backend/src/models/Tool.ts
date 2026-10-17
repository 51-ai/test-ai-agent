import mongoose, { Schema, Document } from 'mongoose';

export interface ITool extends Document {
  name: string;
  description: string;
  type: 'rest' | 'graphql' | 'websocket';
  endpoint?: string;
  toolSchema?: Record<string, unknown>;
  successRate: number;
  usageCount: number;
  createdAt: Date;
}

const ToolSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['rest', 'graphql', 'websocket'], required: true },
  endpoint: { type: String },
  toolSchema: { type: Schema.Types.Mixed },
  successRate: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

export const Tool = mongoose.model<ITool>('Tool', ToolSchema);