import mongoose, { Schema, Document } from 'mongoose';

export type RiskLevel = 'high' | 'mid' | 'low' | 'excellent';

export interface ISecurityReport extends Document {
  userId: mongoose.Types.ObjectId;
  modelName: string;
  provider: 'deepseek' | 'ollama' | 'openai' | 'fallback';
  prompt: string;
  customPrompt?: string;
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  elapsedMs: number;
  riskLevel?: RiskLevel;
  generatedAt: Date;
}

const SecurityReportSchema: Schema = new Schema<ISecurityReport>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  modelName: { type: String, required: true },
  provider: {
    type: String,
    enum: ['deepseek', 'ollama', 'openai', 'fallback'],
    required: true
  },
  prompt: { type: String, required: true },
  customPrompt: { type: String },
  content: { type: String, required: true },
  usage: {
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number
  },
  elapsedMs: { type: Number, required: true },
  riskLevel: {
    type: String,
    enum: ['high', 'mid', 'low', 'excellent']
  },
  generatedAt: { type: Date, required: true, index: -1 }
});

SecurityReportSchema.index({ userId: 1, generatedAt: -1 });

export const SecurityReport = mongoose.model<ISecurityReport>('SecurityReport', SecurityReportSchema);
export default SecurityReport;
