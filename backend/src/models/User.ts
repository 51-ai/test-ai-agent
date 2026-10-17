import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { config } from '../config';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  totpSecret?: string;
  totpEnabled?: boolean;
  totpBackupCodes?: string[];
  totpUsedBackupMask?: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  totpSecret: { type: String },
  totpEnabled: { type: Boolean, default: false },
  totpBackupCodes: [{ type: String }],
  totpUsedBackupMask: { type: Number, default: 0 }
}, {
  timestamps: true
});

UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const ok = await bcrypt.compare(candidatePassword, this.password);
  if (!ok) return false;
  const targetPrefix = `$2b$${String(config.security.bcryptRounds).padStart(2, '0')}$`;
  const needsRehash = !this.password.startsWith(targetPrefix);
  if (needsRehash) {
    try {
      const salt = await bcrypt.genSalt(config.security.bcryptRounds);
      const newHash = await bcrypt.hash(candidatePassword, salt);
      await User.updateOne(
        { _id: this._id },
        { $set: { password: newHash } }
      );
    } catch (e) {
      console.warn('[SECURITY] bcrypt auto-upgrade (rehash) failed, skip:', e);
    }
  }
  return true;
};

export const User = mongoose.model<IUser>('User', UserSchema);