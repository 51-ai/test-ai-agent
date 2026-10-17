import { Task, ITask, ISubtask } from '../models/Task';

export class TaskService {
  async listTasks(query: {
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: ITask['status'];
    priority?: ITask['priority'];
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (query.userId) filter.userId = query.userId;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.search) filter.description = { $regex: query.search, $options: 'i' };

    const sortBy = query.sortBy || 'updatedAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [total, docs] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter).sort(sort).skip(skip).limit(pageSize)
        .populate('userId', 'username email').lean()
    ]);
    return { data: docs, total, page, pageSize };
  }

  async getById(id: string) {
    return Task.findById(id).populate('userId', 'username email').lean();
  }

  async create(data: {
    userId: string;
    description: string;
    status?: ITask['status'];
    priority?: ITask['priority'];
    subtasks?: Partial<ISubtask>[];
  }) {
    const task = new Task({
      userId: data.userId,
      description: data.description,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      subtasks: (data.subtasks || []).map(s => ({
        description: s.description || '',
        status: s.status || 'pending',
        toolName: s.toolName,
        parameters: s.parameters,
        result: s.result
      }))
    });
    return task.save();
  }

  async update(id: string, patch: {
    description?: string;
    status?: ITask['status'];
    priority?: ITask['priority'];
    subtasks?: Partial<ISubtask>[];
  }) {
    const update: Record<string, unknown> = {};
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.priority !== undefined) update.priority = patch.priority;
    if (patch.subtasks !== undefined) {
      update.subtasks = patch.subtasks.map(s => ({
        description: s.description || '',
        status: s.status || 'pending',
        toolName: s.toolName,
        parameters: s.parameters,
        result: s.result
      }));
    }
    return Task.findByIdAndUpdate(id, update, { new: true });
  }

  async updateSubtaskStatus(taskId: string, subtaskIndex: number, status: ISubtask['status']) {
    return Task.findOneAndUpdate(
      { _id: taskId },
      { [`subtasks.${subtaskIndex}.status`]: status },
      { new: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const res = await Task.findByIdAndDelete(id);
    return res !== null;
  }

  async getStats() {
    const [total, byStatus, byPriority] = await Promise.all([
      Task.countDocuments(),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }])
    ]);
    const statusMap: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, failed: 0 };
    const priorityMap: Record<string, number> = { low: 0, medium: 0, high: 0 };
    byStatus.forEach(r => { statusMap[r._id as string] = r.count; });
    byPriority.forEach(r => { priorityMap[r._id as string] = r.count; });
    return { total, byStatus: statusMap, byPriority: priorityMap };
  }
}
