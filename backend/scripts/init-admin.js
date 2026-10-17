require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// 使用与 src/models/User.ts 相同的 Schema 定义，包含 pre save hook
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' }
}, { timestamps: true });

// 添加 pre save hook 来自动加密密码
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 添加密码比较方法
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

async function initAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent');
    
    // 先删除已存在的用户
    await User.deleteMany({ email: 'admin@example.com' });
    
    // 创建用户，pre save hook 会自动加密密码
    const adminUser = new User({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',  // 原始密码，pre save hook 会自动加密
      role: 'admin'
    });
    
    await adminUser.save();
    console.log('管理员用户创建成功！');
    console.log('邮箱: admin@example.com');
    console.log('密码: admin123');
    
    // 验证密码是否正确
    const savedUser = await User.findOne({ email: 'admin@example.com' });
    const isMatch = await savedUser.comparePassword('admin123');
    console.log('密码验证测试:', isMatch ? '成功 ✓' : '失败 ✗');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('创建管理员用户失败:', error.message);
    process.exit(1);
  }
}

initAdmin();