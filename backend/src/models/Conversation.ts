import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IMessageDocument extends IMessage, Document {}

export interface IConversation extends Document {
  userId: string;
  title: string;
  messages: IMessageDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
  content: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed }
});

const ConversationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  messages: [MessageSchema]
}, {
  timestamps: true
});

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);