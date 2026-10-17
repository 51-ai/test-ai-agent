/**
 * 配置管理系统 - 集中化配置管理
 */

import { v4 as uuidv4 } from 'uuid';

export type ConfigType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'secret';
export type ConfigScope = 'system' | 'application' | 'user' | 'environment';
export type ConfigStatus = 'draft' | 'pending' | 'active' | 'deprecated' | 'archived';

export interface ConfigEntry {
  id: string;
  key: string;
  value: unknown;
  type: ConfigType;
  scope: ConfigScope;
  status: ConfigStatus;
  description?: string;
  defaultValue?: unknown;
  validationRules?: ValidationRule[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  environment?: string;
  dependencies?: string[];
}

export interface ValidationRule {
  type: 'range' | 'pattern' | 'enum' | 'custom';
  value?: unknown;
  message?: string;
}

export interface ConfigVersion {
  id: string;
  configId: string;
  value: unknown;
  version: number;
  changedBy?: string;
  changedAt: Date;
  changeReason?: string;
}

export interface ConfigGroup {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  children?: ConfigGroup[];
  configs: string[];
  permissions: {
    read: string[];
    write: string[];
    admin: string[];
  };
}

export interface ConfigQuery {
  keys?: string[];
  scopes?: ConfigScope[];
  statuses?: ConfigStatus[];
  tags?: string[];
  search?: string;
  environment?: string;
}

export class ConfigManager {
  private configs: Map<string, ConfigEntry> = new Map();
  private versions: Map<string, ConfigVersion[]> = new Map();
  private groups: Map<string, ConfigGroup> = new Map();
  private environments: Set<string> = new Set(['development', 'staging', 'production']);
  private listeners: Map<string, Array<(config: ConfigEntry) => void>> = new Map();
  private maxVersionsPerConfig = 50;

  constructor() {
    this.setupDefaultGroups();
    this.setupBuiltInConfigs();
  }

  /**
   * 设置默认配置组
   */
  private setupDefaultGroups(): void {
    const defaultGroups: ConfigGroup[] = [
      {
        id: 'system',
        name: '系统配置',
        description: '系统级别配置',
        configs: [],
        permissions: { read: ['*'], write: ['admin'], admin: ['admin'] }
      },
      {
        id: 'application',
        name: '应用配置',
        description: '应用程序配置',
        configs: [],
        permissions: { read: ['*'], write: ['admin', 'developer'], admin: ['admin'] }
      },
      {
        id: 'features',
        name: '功能开关',
        description: '功能特性开关',
        configs: [],
        permissions: { read: ['*'], write: ['admin', 'developer'], admin: ['admin'] }
      },
      {
        id: 'integrations',
        name: '集成配置',
        description: '第三方服务集成配置',
        configs: [],
        permissions: { read: ['*'], write: ['admin'], admin: ['admin'] }
      }
    ];

    for (const group of defaultGroups) {
      this.groups.set(group.id, group);
    }
  }

  /**
   * 设置内置配置
   */
  private setupBuiltInConfigs(): void {
    const builtInConfigs: Omit<ConfigEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [
      {
        key: 'system.maxConcurrentRequests',
        value: 1000,
        type: 'number',
        scope: 'system',
        status: 'active',
        description: '最大并发请求数',
        validationRules: [{ type: 'range', value: { min: 1, max: 10000 }, message: '值必须在1-10000之间' }]
      },
      {
        key: 'system.requestTimeout',
        value: 30000,
        type: 'number',
        scope: 'system',
        status: 'active',
        description: '请求超时时间(ms)',
        validationRules: [{ type: 'range', value: { min: 1000, max: 300000 }, message: '值必须在1-300秒之间' }]
      },
      {
        key: 'system.enableDebugMode',
        value: false,
        type: 'boolean',
        scope: 'system',
        status: 'active',
        description: '是否启用调试模式'
      },
      {
        key: 'application.defaultLanguage',
        value: 'zh-CN',
        type: 'string',
        scope: 'application',
        status: 'active',
        description: '默认语言',
        validationRules: [{ type: 'enum', value: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'], message: '不支持的语言' }]
      },
      {
        key: 'features.enableAdvancedAnalytics',
        value: true,
        type: 'boolean',
        scope: 'system',
        status: 'active',
        description: '是否启用高级分析功能',
        tags: ['feature-toggle']
      },
      {
        key: 'features.enableExperimentalUI',
        value: false,
        type: 'boolean',
        scope: 'system',
        status: 'active',
        description: '是否启用实验性UI',
        tags: ['feature-toggle']
      }
    ];

    for (const config of builtInConfigs) {
      this.set(config as Omit<ConfigEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>);
    }
  }

  /**
   * 设置配置
   */
  set(config: Omit<ConfigEntry, 'id' | 'createdAt' | 'updatedAt' | 'version'>): string {
    const now = new Date();
    
    // 验证配置
    if (config.validationRules?.length) {
      const validationError = this.validateValue(config.value, config.validationRules);
      if (validationError) {
        throw new Error(`Validation failed: ${validationError}`);
      }
    }

    // 检查是否已存在
    const existingConfig = this.configs.get(config.key);
    const version = existingConfig ? existingConfig.version + 1 : 1;

    const entry: ConfigEntry = {
      ...config,
      id: existingConfig?.id || `config_${uuidv4()}`,
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now,
      version
    };

    this.configs.set(config.key, entry);

    // 保存版本历史
    if (!this.versions.has(config.key)) {
      this.versions.set(config.key, []);
    }
    
    const versionHistory = this.versions.get(config.key)!;
    versionHistory.push({
      id: `version_${uuidv4()}`,
      configId: config.key,
      value: config.value,
      version,
      changedAt: now,
      changedBy: config.updatedBy
    });

    // 限制版本数量
    while (versionHistory.length > this.maxVersionsPerConfig) {
      versionHistory.shift();
    }

    // 通知监听器
    this.notifyListeners(config.key, entry);

    return entry.id;
  }

  /**
   * 获取配置
   */
  get(key: string, environment?: string): unknown {
    const config = this.configs.get(key);
    if (!config) {
      return undefined;
    }

    // 检查环境
    if (environment && config.environment && config.environment !== environment) {
      return undefined;
    }

    // 检查状态
    if (config.status !== 'active') {
      if (config.status === 'deprecated') {
        console.warn(`[Config] Config ${key} is deprecated`);
      }
      return undefined;
    }

    return config.value;
  }

  /**
   * 获取完整配置项
   */
  getConfig(key: string): ConfigEntry | undefined {
    return this.configs.get(key);
  }

  /**
   * 获取多个配置
   */
  getMultiple(keys: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 查询配置
   */
  query(query: ConfigQuery): ConfigEntry[] {
    let results = Array.from(this.configs.values());

    if (query.keys?.length) {
      results = results.filter(c => query.keys!.includes(c.key));
    }

    if (query.scopes?.length) {
      results = results.filter(c => query.scopes!.includes(c.scope));
    }

    if (query.statuses?.length) {
      results = results.filter(c => query.statuses!.includes(c.status));
    }

    if (query.tags?.length) {
      results = results.filter(c => 
        c.tags?.some(tag => query.tags!.includes(tag))
      );
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      results = results.filter(c => 
        c.key.toLowerCase().includes(search) ||
        c.description?.toLowerCase().includes(search)
      );
    }

    if (query.environment) {
      results = results.filter(c => 
        !c.environment || c.environment === query.environment
      );
    }

    return results;
  }

  /**
   * 删除配置
   */
  delete(key: string, soft: boolean = true): boolean {
    const config = this.configs.get(key);
    if (!config) {
      return false;
    }

    if (soft) {
      // 软删除
      config.status = 'archived';
      config.updatedAt = new Date();
      config.version++;
    } else {
      // 硬删除
      this.configs.delete(key);
      this.versions.delete(key);
    }

    return true;
  }

  /**
   * 获取版本历史
   */
  getVersionHistory(key: string, limit?: number): ConfigVersion[] {
    const history = this.versions.get(key) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * 回滚到指定版本
   */
  rollback(key: string, version: number, userId?: string): boolean {
    const history = this.versions.get(key);
    if (!history) {
      return false;
    }

    const targetVersion = history.find(v => v.version === version);
    if (!targetVersion) {
      return false;
    }

    const currentConfig = this.configs.get(key);
    if (!currentConfig) {
      return false;
    }

    // 设置为新版本
    this.set({
      key: currentConfig.key,
      value: targetVersion.value,
      type: currentConfig.type,
      scope: currentConfig.scope,
      status: currentConfig.status,
      description: currentConfig.description,
      defaultValue: currentConfig.defaultValue,
      validationRules: currentConfig.validationRules,
      tags: currentConfig.tags,
      environment: currentConfig.environment,
      dependencies: currentConfig.dependencies,
      updatedBy: userId
    });

    return true;
  }

  /**
   * 创建配置组
   */
  createGroup(group: Omit<ConfigGroup, 'id'>): string {
    const id = `group_${uuidv4()}`;
    this.groups.set(id, { ...group, id });
    return id;
  }

  /**
   * 获取配置组
   */
  getGroup(id: string): ConfigGroup | undefined {
    return this.groups.get(id);
  }

  /**
   * 获取所有组
   */
  getAllGroups(): ConfigGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * 添加环境
   */
  addEnvironment(name: string): boolean {
    if (this.environments.has(name)) {
      return false;
    }
    this.environments.add(name);
    return true;
  }

  /**
   * 获取所有环境
   */
  getEnvironments(): string[] {
    return Array.from(this.environments);
  }

  /**
   * 导出配置
   */
  export(environment?: string, format: 'json' | 'env' = 'json'): string {
    const configs = this.query({
      scopes: environment ? undefined : undefined,
      statuses: ['active'],
      environment
    });

    if (format === 'json') {
      const exportData: Record<string, unknown> = {};
      for (const config of configs) {
        exportData[config.key] = config.value;
      }
      return JSON.stringify(exportData, null, 2);
    }

    // ENV格式
    return configs.map(c => `${c.key}=${c.value}`).join('\n');
  }

  /**
   * 导入配置
   */
  import(configs: Record<string, unknown>, options?: {
    overwrite?: boolean;
    environment?: string;
    userId?: string;
  }): { imported: number; skipped: number; errors: string[] } {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const [key, value] of Object.entries(configs)) {
      try {
        const existing = this.configs.get(key);
        
        if (existing && !options?.overwrite) {
          result.skipped++;
          continue;
        }

        this.set({
          key,
          value,
          type: this.inferType(value),
          scope: existing?.scope || 'application',
          status: 'active',
          environment: options?.environment,
          updatedBy: options?.userId
        });

        result.imported++;
      } catch (error) {
        result.errors.push(`${key}: ${error}`);
      }
    }

    return result;
  }

  /**
   * 注册监听器
   */
  onChange(key: string, callback: (config: ConfigEntry) => void): string {
    const listenerId = uuidv4();
    
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    this.listeners.get(key)!.push(callback as (config: ConfigEntry) => void);
    
    return listenerId;
  }

  /**
   * 移除监听器
   */
  offChange(key: string, listenerId: string): boolean {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      const index = callbacks.findIndex((cb: unknown) => (cb as { id?: string }).id === listenerId);
      if (index > -1) {
        callbacks.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * 通知监听器
   */
  private notifyListeners(key: string, config: ConfigEntry): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(config);
        } catch (error) {
          console.error(`[Config] Listener error: ${error}`);
        }
      }
    }

    // 也通知通配符监听器
    const wildcardCallbacks = this.listeners.get('*');
    if (wildcardCallbacks) {
      for (const callback of wildcardCallbacks) {
        try {
          callback(config);
        } catch (error) {
          console.error(`[Config] Wildcard listener error: ${error}`);
        }
      }
    }
  }

  /**
   * 验证值
   */
  private validateValue(value: unknown, rules: ValidationRule[]): string | undefined {
    for (const rule of rules) {
      switch (rule.type) {
        case 'range':
          const range = rule.value as { min?: number; max?: number };
          if (typeof value === 'number') {
            if (range.min !== undefined && value < range.min) {
              return rule.message || `值必须大于等于${range.min}`;
            }
            if (range.max !== undefined && value > range.max) {
              return rule.message || `值必须小于等于${range.max}`;
            }
          }
          break;

        case 'enum':
          const enumValues = rule.value as unknown[];
          if (!enumValues.includes(value)) {
            return rule.message || `值必须是${enumValues.join(', ')}之一`;
          }
          break;

        case 'pattern':
          if (typeof value === 'string' && rule.value) {
            const regex = new RegExp(rule.value as string);
            if (!regex.test(value)) {
              return rule.message || '值格式不正确';
            }
          }
          break;

        case 'custom':
          // 自定义验证需要额外实现
          break;
      }
    }

    return undefined;
  }

  /**
   * 推断类型
   */
  private inferType(value: unknown): ConfigType {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * 获取配置统计
   */
  getStats(): {
    total: number;
    byType: Record<ConfigType, number>;
    byScope: Record<ConfigScope, number>;
    byStatus: Record<ConfigStatus, number>;
    environments: number;
    groups: number;
  } {
    const stats = {
      total: this.configs.size,
      byType: {} as Record<ConfigType, number>,
      byScope: {} as Record<ConfigScope, number>,
      byStatus: {} as Record<ConfigStatus, number>,
      environments: this.environments.size,
      groups: this.groups.size
    };

    for (const config of this.configs.values()) {
      stats.byType[config.type] = (stats.byType[config.type] || 0) + 1;
      stats.byScope[config.scope] = (stats.byScope[config.scope] || 0) + 1;
      stats.byStatus[config.status] = (stats.byStatus[config.status] || 0) + 1;
    }

    return stats;
  }
}

export default ConfigManager;
