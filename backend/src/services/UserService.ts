import { User, IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import bcrypt from 'bcrypt';
import { config } from '../config';

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  role?: 'admin' | 'user';
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserListResult {
  data: Array<Omit<IUser, 'password' | 'comparePassword'>>;
  total: number;
  page: number;
  pageSize: number;
}

export class UserService {
  async register(username: string, email: string, password: string): Promise<{ user: IUser; token: string }> {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const total = await User.countDocuments();
    const user = new User({
      username, email, password,
      role: total === 0 ? 'admin' : 'user'
    });
    await user.save();

    const token = generateToken(user);

    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken(user);

    return { user, token };
  }

  async getUserById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email });
  }

  async updateUser(id: string, updateData: Partial<Pick<IUser, 'username' | 'email'>>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return result !== null;
  }

  // ========== Admin methods ==========

  async listUsers(query: UserListQuery = {}): Promise<UserListResult> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.search) {
      const regex = { $regex: query.search, $options: 'i' };
      filter.$or = [{ username: regex }, { email: regex }];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDir };

    const [total, docs] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select('-password -__v').sort(sort).skip(skip).limit(pageSize).lean()
    ]);

    return { data: docs as unknown as UserListResult['data'], total, page, pageSize };
  }

  async getUserByIdAdmin(id: string): Promise<unknown | null> {
    return User.findById(id).select('-password -__v').lean();
  }

  async createUserByAdmin(data: { username: string; email: string; password: string; role?: 'admin' | 'user' }): Promise<IUser> {
    const existing = await User.findOne({ $or: [{ username: data.username }, { email: data.email }] });
    if (existing) throw new Error('User already exists');
    const user = new User({
      username: data.username,
      email: data.email,
      password: data.password,
      role: data.role || 'user'
    });
    return user.save();
  }

  async updateUserByAdmin(id: string, patch: {
    username?: string;
    email?: string;
    role?: 'admin' | 'user';
    password?: string;
  }): Promise<IUser | null> {
    const user = await User.findById(id);
    if (!user) return null;
    if (patch.username !== undefined) user.username = patch.username;
    if (patch.email !== undefined) user.email = patch.email;
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.password !== undefined) user.password = patch.password;
    await user.save();
    const raw = user.toObject();
    delete (raw as any).password;
    delete (raw as any).__v;
    return raw as unknown as IUser;
  }

  async deleteUserByAdmin(id: string): Promise<boolean> {
    const res = await User.findByIdAndDelete(id);
    return res !== null;
  }

  async countByRole(): Promise<{ admins: number; users: number; total: number; regularUsers: number }> {
    const [total, admins, users] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'user' })
    ]);
    return { admins, users, total, regularUsers: users };
  }
}