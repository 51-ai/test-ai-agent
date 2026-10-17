import { Tool, ITool } from '../models/Tool';

export class ToolService {
  async listTools(query: {
    page?: number;
    pageSize?: number;
    type?: ITool['type'];
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.search) {
      const regex = { $regex: query.search, $options: 'i' };
      filter.$or = [{ name: regex }, { description: regex }];
    }

    const sortBy = query.sortBy || 'usageCount';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [total, docs] = await Promise.all([
      Tool.countDocuments(filter),
      Tool.find(filter).sort(sort).skip(skip).limit(pageSize).lean()
    ]);
    return { data: docs, total, page, pageSize };
  }

  async getById(id: string) {
    return Tool.findById(id).lean();
  }

  async create(data: {
    name: string;
    description: string;
    type: ITool['type'];
    endpoint?: string;
    toolSchema?: Record<string, unknown>;
  }) {
    const existing = await Tool.findOne({ name: data.name });
    if (existing) throw new Error('Tool with same name already exists');
    const tool = new Tool({
      name: data.name,
      description: data.description,
      type: data.type,
      endpoint: data.endpoint,
      toolSchema: data.toolSchema,
      successRate: 0,
      usageCount: 0
    });
    return tool.save();
  }

  async update(id: string, patch: Partial<Omit<ITool, 'usageCount' | 'successRate'> & { successRate?: number }>) {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.endpoint !== undefined) update.endpoint = patch.endpoint;
    if (patch.toolSchema !== undefined) update.toolSchema = patch.toolSchema;
    if (patch.successRate !== undefined) update.successRate = patch.successRate;
    return Tool.findByIdAndUpdate(id, update, { new: true });
  }

  async incrementUsage(id: string, succeeded: boolean): Promise<void> {
    const tool = await Tool.findById(id);
    if (!tool) return;
    const newCount = tool.usageCount + 1;
    const newSuccess = ((tool.successRate * tool.usageCount) + (succeeded ? 1 : 0)) / newCount;
    await Tool.findByIdAndUpdate(id, { usageCount: newCount, successRate: newSuccess });
  }

  async delete(id: string): Promise<boolean> {
    const res = await Tool.findByIdAndDelete(id);
    return res !== null;
  }

  async getStats() {
    const [total, byType] = await Promise.all([
      Tool.countDocuments(),
      Tool.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
    ]);
    const typeMap: Record<string, number> = { rest: 0, graphql: 0, websocket: 0 };
    byType.forEach(r => { typeMap[r._id as string] = r.count; });
    return { total, byType: typeMap };
  }
}
