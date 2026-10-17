import mongoose, { Schema, Document } from 'mongoose';
import { AuditLevel, AuditCategory } from '../core/audit/AuditSystem';

export interface IAuditLog extends Document {
  auditId: string;
  timestamp: Date;
  level: AuditLevel;
  category: AuditCategory;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'blocked';
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
  auditId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  level: { type: String, enum: ['debug', 'info', 'warning', 'error', 'critical'], required: true, index: true },
  category: {
    type: String,
    enum: ['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'business', 'security'],
    required: true,
    index: true
  },
  userId: { type: String, index: true },
  sessionId: { type: String, index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, index: true },
  resourceId: { type: String, index: true },
  details: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, index: true },
  userAgent: { type: String },
  result: { type: String, enum: ['success', 'failure', 'blocked'], required: true, index: true },
  errorMessage: { type: String },
  duration: { type: Number },
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ category: 1, level: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, result: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
