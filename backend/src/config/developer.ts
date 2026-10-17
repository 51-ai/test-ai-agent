export interface DeveloperConfig {
  enabled: boolean;
  apiKey?: string;
  devModeUserId: string;
  isolatedDataPrefix: string;
  maxRequestsPerMinute: number;
  enableDetailedLogging: boolean;
  allowedOrigins: string[];
}

export const getDeveloperConfig = (): DeveloperConfig => {
  // 🔒 安全修复：生产环境强制关闭开发者模式，忽略环境变量设置
  const isProduction = process.env.NODE_ENV === 'production';
  const developerMode = !isProduction && process.env.DEVELOPER_MODE === 'true';

  return {
    enabled: developerMode,
    apiKey: process.env.DEVELOPER_API_KEY,
    devModeUserId: process.env.DEVELOPER_USER_ID || 'dev-user-001',
    isolatedDataPrefix: 'dev_',
    maxRequestsPerMinute: parseInt(process.env.DEVELOPER_MAX_REQUESTS || '60'),
    enableDetailedLogging: process.env.DEVELOPER_LOGGING === 'true',
    allowedOrigins: (process.env.DEVELOPER_ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
  };
};

export const isDeveloperMode = (): boolean => {
  return getDeveloperConfig().enabled;
};
