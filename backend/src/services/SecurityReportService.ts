import SecurityReport, { RiskLevel, ISecurityReport } from '../models/SecurityReport';
import mongoose from 'mongoose';

export interface CreateReportInput {
  userId: string;
  modelName: string;
  provider: ISecurityReport['provider'];
  prompt: string;
  customPrompt?: string;
  content: string;
  usage?: ISecurityReport['usage'];
  elapsedMs: number;
  riskLevel?: RiskLevel;
}

class SecurityReportService {
  async create(input: CreateReportInput): Promise<ISecurityReport> {
    const doc = await SecurityReport.create({
      ...input,
      generatedAt: new Date(),
    });
    const total = await SecurityReport.countDocuments({ userId: input.userId });
    if (total > 500) {
      const overflow = total - 500;
      const olds = await SecurityReport.find({ userId: input.userId })
        .sort({ generatedAt: 1 }).limit(overflow).select('_id');
      const ids = olds.map((d) => (d as any)._id);
      if (ids.length) {
        await SecurityReport.deleteMany({ _id: { $in: ids } });
      }
    }
    return doc;
  }

  async list(
    userId: string,
    page = 1,
    size = 20
  ): Promise<{ items: ISecurityReport[]; total: number; page: number; size: number }> {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, size));
    const skip = (safePage - 1) * safeSize;
    const [items, total] = await Promise.all([
      SecurityReport.find({ userId })
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(safeSize)
        .lean(),
      SecurityReport.countDocuments({ userId }),
    ]);
    return { items: items as unknown as ISecurityReport[], total, page: safePage, size: safeSize };
  }

  async getById(id: string): Promise<ISecurityReport | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return SecurityReport.findById(id).lean() as unknown as Promise<ISecurityReport | null>;
  }

  async getLatest(userId: string): Promise<ISecurityReport | null> {
    return SecurityReport.findOne({ userId })
      .sort({ generatedAt: -1 })
      .lean() as unknown as Promise<ISecurityReport | null>;
  }

  async setRiskLevel(
    id: string,
    userId: string,
    riskLevel: RiskLevel
  ): Promise<ISecurityReport | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await SecurityReport.findById(id);
    if (!doc) return null;
    if (doc.userId.toString() !== userId) return null;
    doc.riskLevel = riskLevel;
    await doc.save();
    return doc.toObject() as ISecurityReport;
  }
}

export const securityReportService = new SecurityReportService();
export default securityReportService;
