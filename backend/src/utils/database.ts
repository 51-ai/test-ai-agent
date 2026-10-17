import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'path';
import { config } from '../config';

let mongoServer: MongoMemoryServer | null = null;

// 数据持久化目录
const DB_DATA_PATH = path.join(process.cwd(), '..', 'data', 'mongodb');

let isEphemeral = false;

export const connectDB = async (): Promise<boolean> => {
  try {
    console.log('🔄 Trying to connect to MongoDB...');

    // 先尝试连接外部 MongoDB（如果用户安装了的话）
    const connectWithTimeout = async (uri: string, timeout: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve(false);
        }, timeout);

        mongoose.connect(uri)
          .then(() => {
            clearTimeout(timer);
            resolve(true);
          })
          .catch(() => {
            clearTimeout(timer);
            resolve(false);
          });
      });
    };

    const externalConnected = await connectWithTimeout(config.database.mongoUri, 3000);

    if (externalConnected) {
      console.log('✅ External MongoDB connected successfully');
      return true;
    }

    console.warn('⚠️ External MongoDB not available');
    console.log('📦 Starting embedded MongoDB Memory Server...');

    // 启动嵌入式 MongoDB
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27018,
        dbName: 'ai-agent',
        storageEngine: 'wiredTiger',
        dbPath: DB_DATA_PATH
      },
      binary: {
        version: '7.0.11'
      }
    });

    const mongoUri = mongoServer.getUri();
    console.log('🔌 Embedded MongoDB URI:', mongoUri);

    await mongoose.connect(mongoUri);
    console.log('✅ Embedded MongoDB connected successfully');
    console.log('💾 Data will be persisted to:', DB_DATA_PATH);

    return true;
  } catch (error) {
    console.error('❌ Database connection error:', (error as Error).message);
    console.warn('⚠️ Using memory-only storage mode (data will NOT persist)');

    // 最后降级到纯内存模式
    try {
      mongoServer = await MongoMemoryServer.create({
        instance: {
          port: 27019,
          dbName: 'ai-agent'
        }
      });
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log('✅ In-memory MongoDB started (data will NOT persist after restart)');
      isEphemeral = true;
      return true;
    } catch (memError) {
      console.error('❌ Failed to start in-memory MongoDB:', (memError as Error).message);
      return false;
    }
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};

export const isMongoDBConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export const getMongoDBInfo = (): { type: string; uri: string } => {
  if (mongoServer) {
    return {
      type: 'embedded',
      uri: mongoServer.getUri()
    };
  }
  return {
    type: 'external',
    uri: config.database.mongoUri
  };
};

export const isEphemeralDB = (): boolean => isEphemeral;