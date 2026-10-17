/**
 * 插件系统 - Plugin System
 * 
 * 功能：
 * 1. 插件生命周期管理（安装、卸载、启用、禁用）
 * 2. 插件沙箱隔离
 * 3. 插件API接口定义
 * 4. 插件事件通信
 * 
 * @module core/plugins
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  main: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  hooks?: string[];
  configSchema?: Record<string, any>;
}

export interface PluginConfig {
  enabled: boolean;
  priority: number;
  config?: Record<string, any>;
}

export interface Plugin {
  manifest: PluginManifest;
  instance: any;
  config: PluginConfig;
  state: 'loading' | 'loaded' | 'active' | 'error' | 'disabled';
  error?: Error;
  loadedAt?: number;
}

export interface PluginAPI {
  // 存储
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: () => Promise<string[]>;
  };
  
  // 事件
  events: {
    emit: (event: string, data?: any) => void;
    on: (event: string, handler: (data?: any) => void) => () => void;
    off: (event: string, handler: (data?: any) => void) => void;
  };
  
  // 指标
  metrics: {
    record: (name: string, value: number, tags?: Record<string, string>) => void;
    getTimeSeries: (name: string, startTime: number, endTime: number) => Promise<any>;
  };
  
  // HTTP请求
  http: {
    get: (url: string, options?: RequestInit) => Promise<any>;
    post: (url: string, data?: any, options?: RequestInit) => Promise<any>;
  };
  
  // 日志
  logger: {
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
  
  // 注册钩子
  registerHook: (hookName: string, handler: Function) => void;
  
  // 获取应用信息
  getAppInfo: () => {
    version: string;
    environment: string;
    platform: string;
  };
}

export interface HookHandler {
  pluginId: string;
  handler: Function;
  priority: number;
}

// ==================== 插件存储 ====================

class PluginStorage {
  private prefix: string = 'plugin_data_';
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<any> {
    try {
      const data = this.store.get(this.prefix + key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(this.prefix + key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.prefix + key);
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      if (key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }
}

// ==================== 插件管理器 ====================

export class PluginManager extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, HookHandler[]> = new Map();
  private storage: PluginStorage;
  private api: PluginAPI;
  private isSandboxed: boolean = true;

  constructor() {
    super();
    this.storage = new PluginStorage();
    this.api = this.createAPI();
  }

  /**
   * 创建插件API
   */
  private createAPI(): PluginAPI {
    return {
      storage: this.storage,
      
      events: {
        emit: (event: string, data?: any) => {
          this.emit(`plugin:event:${event}`, data);
        },
        on: (event: string, handler: (data?: any) => void) => {
          const wrappedHandler = (data: any) => {
            try {
              handler(data);
            } catch (error) {
              console.error(`Plugin event handler error for '${event}':`, error);
            }
          };
          this.on(`plugin:event:${event}`, wrappedHandler);
          return () => this.off(`plugin:event:${event}`, wrappedHandler);
        },
        off: (event: string, handler: (data?: any) => void) => {
          this.off(`plugin:event:${event}`, handler);
        }
      },
      
      metrics: {
        record: (name: string, value: number, tags?: Record<string, string>) => {
          // 集成指标模块
          console.log(`[Metrics] ${name}: ${value}`, tags);
        },
        getTimeSeries: async (name: string, startTime: number, endTime: number) => {
          // 返回模拟数据
          return [];
        }
      },
      
      http: {
        get: async (url: string, options?: RequestInit) => {
          if (this.isSandboxed) {
            // 沙箱模式下只允许特定域名
            const allowedDomains = ['localhost', 'api.example.com'];
            const urlObj = new URL(url);
            if (!allowedDomains.some(d => urlObj.hostname.includes(d))) {
              throw new Error(`URL '${url}' is not allowed in sandbox mode`);
            }
          }
          
          const response = await fetch(url, { ...options, method: 'GET' });
          return response.json();
        },
        post: async (url: string, data?: any, options?: RequestInit) => {
          if (this.isSandboxed) {
            const allowedDomains = ['localhost', 'api.example.com'];
            const urlObj = new URL(url);
            if (!allowedDomains.some(d => urlObj.hostname.includes(d))) {
              throw new Error(`URL '${url}' is not allowed in sandbox mode`);
            }
          }
          
          const response = await fetch(url, {
            ...options,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data ? JSON.stringify(data) : undefined
          });
          return response.json();
        }
      },
      
      logger: {
        info: (message: string, ...args: any[]) => console.log(`[Plugin] ${message}`, ...args),
        warn: (message: string, ...args: any[]) => console.warn(`[Plugin] ${message}`, ...args),
        error: (message: string, ...args: any[]) => console.error(`[Plugin] ${message}`, ...args),
        debug: (message: string, ...args: any[]) => console.debug(`[Plugin] ${message}`, ...args)
      },
      
      registerHook: (hookName: string, handler: Function) => {
        this.registerHook(hookName, handler);
      },
      
      getAppInfo: () => ({
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        platform: 'web'
      })
    };
  }

  /**
   * 注册钩子
   */
  registerHook(hookName: string, handler: Function, pluginId?: string): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    const handlers = this.hooks.get(hookName)!;
    handlers.push({
      pluginId: pluginId || 'system',
      handler,
      priority: handlers.length
    });
    
    handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 触发钩子
   */
  async triggerHook(hookName: string, data?: any): Promise<any[]> {
    const handlers = this.hooks.get(hookName) || [];
    const results: any[] = [];
    
    for (const { handler } of handlers) {
      try {
        const result = await handler(data);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error });
      }
    }
    
    return results;
  }

  /**
   * 安装插件
   */
  async install(manifest: PluginManifest): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin '${manifest.id}' is already installed`);
    }

    const plugin: Plugin = {
      manifest,
      instance: null,
      config: {
        enabled: true,
        priority: 0
      },
      state: 'loading'
    };

    this.plugins.set(manifest.id, plugin);
    this.emit('plugin:installing', manifest);

    try {
      // 创建插件实例
      // 注意：在实际实现中，这里需要动态加载插件代码
      // 目前使用模拟实现
      plugin.instance = this.createSandboxedPlugin(manifest);
      plugin.state = 'loaded';
      plugin.loadedAt = Date.now();
      
      // 初始化插件
      if (plugin.instance.init) {
        await plugin.instance.init(this.api, plugin.config.config);
      }

      this.emit('plugin:installed', manifest);
    } catch (error) {
      plugin.state = 'error';
      plugin.error = error as Error;
      this.emit('plugin:error', { manifest, error });
      throw error;
    }
  }

  /**
   * 创建沙箱插件实例
   */
  private createSandboxedPlugin(manifest: PluginManifest): any {
    // 返回一个沙箱化的插件实例
    return {
      manifest,
      api: this.api,
      
      init: async (api: PluginAPI, config?: Record<string, any>) => {
        console.log(`Initializing plugin: ${manifest.name}`);
      },
      
      enable: async () => {
        const plugin = this.plugins.get(manifest.id);
        if (plugin) {
          plugin.state = 'active';
          this.emit('plugin:enabled', manifest);
        }
      },
      
      disable: async () => {
        const plugin = this.plugins.get(manifest.id);
        if (plugin) {
          plugin.state = 'disabled';
          this.emit('plugin:disabled', manifest);
        }
      },
      
      destroy: async () => {
        // 只需要更新状态，实际删除由 PluginManager.uninstall 处理
        const plugin = this.plugins.get(manifest.id);
        if (plugin) {
          plugin.state = 'disabled';
        }
      }
    };
  }

  /**
   * 卸载插件
   */
  async uninstall(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' is not installed`);
    }

    if (plugin.instance?.destroy) {
      await plugin.instance.destroy();
    }

    this.plugins.delete(pluginId);
    
    // 清理插件注册的钩子
    this.hooks.forEach((handlers, hookName) => {
      const filtered = handlers.filter(h => h.pluginId !== pluginId);
      if (filtered.length !== handlers.length) {
        this.hooks.set(hookName, filtered);
      }
    });

    this.emit('plugin:uninstalled', plugin.manifest);
  }

  /**
   * 启用插件
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' is not installed`);
    }

    if (plugin.instance?.enable) {
      await plugin.instance.enable();
    }
  }

  /**
   * 禁用插件
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' is not installed`);
    }

    if (plugin.instance?.disable) {
      await plugin.instance.disable();
    }
  }

  /**
   * 更新插件配置
   */
  updateConfig(pluginId: string, config: Partial<PluginConfig>): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin '${pluginId}' is not installed`);
    }

    plugin.config = { ...plugin.config, ...config };
    this.emit('plugin:configUpdated', { pluginId, config: plugin.config });
  }

  /**
   * 获取插件列表
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取单个插件
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 获取已启用的插件
   */
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.state === 'active');
  }

  /**
   * 获取插件数量
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * 获取已注册的钩子
   */
  getHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * 设置沙箱模式
   */
  setSandboxMode(enabled: boolean): void {
    this.isSandboxed = enabled;
  }
}

// ==================== 导出 ====================

export const pluginManager = new PluginManager();

export default PluginManager;
