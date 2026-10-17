import mongoose, { Schema, Document } from 'mongoose';

export interface ISubtask extends Document {
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  toolName?: string;
  parameters?: Record<string, unknown>;
  result?: unknown;
}

export interface ITask extends Document {
  userId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  subtasks: ISubtask[];
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskSchema: Schema = new Schema({
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  toolName: { type: String },
  parameters: { type: Schema.Types.Mixed },
  result: { type: Schema.Types.Mixed }
});

const TaskSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  subtasks: [SubtaskSchema]
}, {
  timestamps: true
});

export const Task = mongoose.model<ITask>('Task', TaskSchema);