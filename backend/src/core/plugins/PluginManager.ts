/**
 * 插件管理器
 * 插件生命周期管理（注册→加载→启用→停用→卸载）、热加载、SDK规范
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// === 插件相关类型 ===
export type PluginStatus = 'registered' | 'loaded' | 'enabled' | 'disabled' | 'error' | 'unloaded';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;              // 入口文件路径
  dependencies?: Record<string, string>;
  permissions?: string[];
  config?: Record<string, unknown>;
  hooks?: string[];          // 支持的钩子
  minAgentVersion?: string;
  maxAgentVersion?: string;
}

export interface PluginMetadata {
  manifest: PluginManifest;
  status: PluginStatus;
  registeredAt: Date;
  lastStatusChange: Date;
  errorMessage?: string;
  stats: {
    hookCalls: number;
    errorCount: number;
    avgExecutionTimeMs: number;
  };
}

export interface PluginContext {
  emitEvent: (event: string, data: unknown) => void;
  getConfig: (key: string) => unknown;
  setConfig: (key: string, value: unknown) => void;
  log: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
  getService: <T>(serviceName: string) => T | undefined;
  registerHook: (hookName: string, handler: (data: unknown) => Promise<unknown>) => void;
}

export interface PluginSDK {
  register: (context: PluginContext) => Promise<void>;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  uninstall: () => Promise<void>;
  getInfo: () => { name: string; version: string; status: string };
}

// 系统钩子类型
export type SystemHook =
  | 'before:processInput'
  | 'after:processInput'
  | 'before:toolExecute'
  | 'after:toolExecute'
  | 'on:memoryStore'
  | 'on:memoryRetrieve'
  | 'on:decisionPlan'
  | 'on:error'
  | 'on:userLogin'
  | 'on:sessionStart'
  | 'on:sessionEnd';

const LOG_PREFIX = '[PluginManager]';

/**
 * 插件管理器
 * 职责：插件生命周期管理、钩子系统、服务发现
 */
export class PluginManager extends EventEmitter {
  private plugins = new Map<string, {
    metadata: PluginMetadata;
    instance?: PluginSDK;
    source?: string;  // 源代码或路径
  }>();

  private hooks = new Map<string, Array<{
    pluginId: string;
    handler: (data: unknown) => Promise<unknown>;
    priority: number;
  }>>();

  private services = new Map<string, unknown>();
  private configStore = new Map<string, Map<string, unknown>>();
  private loadedModules = new Set<string>();

  // ==================== 插件生命周期 ====================

  /**
   * 注册插件
   */
  registerPlugin(manifest: PluginManifest, source?: string): boolean {
    if (this.plugins.has(manifest.id)) {
      console.warn(`${LOG_PREFIX} [ALREADY_REGISTERED] id=${manifest.id}`);
      return false;
    }

    // 验证版本兼容性
    if (!this.checkVersionCompatibility(manifest)) {
      console.warn(`${LOG_PREFIX} [VERSION_MISMATCH] id=${manifest.id}`);
      return false;
    }

    const metadata: PluginMetadata = {
      manifest,
      status: 'registered',
      registeredAt: new Date(),
      lastStatusChange: new Date(),
      stats: { hookCalls: 0, errorCount: 0, avgExecutionTimeMs: 0 }
    };

    this.plugins.set(manifest.id, { metadata, source });
    this.configStore.set(manifest.id, new Map(Object.entries(manifest.config || {})));

    console.log(`${LOG_PREFIX} [REGISTERED] id=${manifest.id}, name=${manifest.name}, version=${manifest.version}`);
    this.emit('plugin:registered', { pluginId: manifest.id, manifest });

    return true;
  }

  /**
   * 加载插件（解析代码、创建实例）
   */
  async loadPlugin(pluginId: string): Promise<boolean> {
    const pluginEntry = this.plugins.get(pluginId);
    if (!pluginEntry) return false;

    if (pluginEntry.metadata.status !== 'registered') {
      console.warn(`${LOG_PREFIX} [LOAD_FAILED] id=${pluginId}, status=${pluginEntry.metadata.status}`);
      return false;
    }

    try {
      // 创建插件上下文
      const context = this.createPluginContext(pluginEntry.metadata.manifest);

      // 尝试动态加载插件模块
      let pluginInstance: PluginSDK;
      if (pluginEntry.source) {
        // 从源码加载
        pluginInstance = await this.loadFromSource(pluginEntry.source, context);
      } else {
        // 创建stub实例（插件未提供源码时）
        pluginInstance = this.createStubPlugin(pluginEntry.metadata.manifest);
      }

      await pluginInstance.register(context);

      pluginEntry.instance = pluginInstance;
      pluginEntry.metadata.status = 'loaded';
      pluginEntry.metadata.lastStatusChange = new Date();

      console.log(`${LOG_PREFIX} [LOADED] id=${pluginId}`);
      this.emit('plugin:loaded', { pluginId });

      return true;
    } catch (error) {
      pluginEntry.metadata.status = 'error';
      pluginEntry.metadata.errorMessage = error instanceof Error ? error.message : String(error);
      pluginEntry.metadata.lastStatusChange = new Date();

      console.error(`${LOG_PREFIX} [LOAD_ERROR] id=${pluginId}`, error);
      return false;
    }
  }

  /**
   * 启用插件
   */
  async enablePlugin(pluginId: string): Promise<boolean> {
    const pluginEntry = this.plugins.get(pluginId);
    if (!pluginEntry || !pluginEntry.instance) return false;

    if (pluginEntry.metadata.status !== 'loaded' && pluginEntry.metadata.status !== 'disabled') {
      console.warn(`${LOG_PREFIX} [ENABLE_FAILED] id=${pluginId}, status=${pluginEntry.metadata.status}`);
      return false;
    }

    try {
      await pluginEntry.instance.activate();
      pluginEntry.metadata.status = 'enabled';
      pluginEntry.metadata.lastStatusChange = new Date();

      console.log(`${LOG_PREFIX} [ENABLED] id=${pluginId}`);
      this.emit('plugin:enabled', { pluginId });

      return true;
    } catch (error) {
      pluginEntry.metadata.status = 'error';
      pluginEntry.metadata.errorMessage = error instanceof Error ? error.message : String(error);
      pluginEntry.metadata.stats.errorCount++;

      console.error(`${LOG_PREFIX} [ENABLE_ERROR] id=${pluginId}`, error);
      return false;
    }
  }

  /**
   * 停用插件
   */
  async disablePlugin(pluginId: string): Promise<boolean> {
    const pluginEntry = this.plugins.get(pluginId);
    if (!pluginEntry || !pluginEntry.instance) return false;

    if (pluginEntry.metadata.status !== 'enabled') return false;

    try {
      await pluginEntry.instance.deactivate();
      pluginEntry.metadata.status = 'disabled';
      pluginEntry.metadata.lastStatusChange = new Date();

      console.log(`${LOG_PREFIX} [DISABLED] id=${pluginId}`);
      this.emit('plugin:disabled', { pluginId });

      return true;
    } catch (error) {
      console.error(`${LOG_PREFIX} [DISABLE_ERROR] id=${pluginId}`, error);
      return false;
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    const pluginEntry = this.plugins.get(pluginId);
    if (!pluginEntry) return false;

    try {
      if (pluginEntry.instance) {
        await pluginEntry.instance.uninstall();
      }

      // 清理钩子
      for (const [hookName, handlers] of this.hooks.entries()) {
        this.hooks.set(
          hookName,
          handlers.filter(h => h.pluginId !== pluginId)
        );
      }

      this.plugins.delete(pluginId);
      this.configStore.delete(pluginId);

      console.log(`${LOG_PREFIX} [UNINSTALLED] id=${pluginId}`);
      this.emit('plugin:uninstalled', { pluginId });

      return true;
    } catch (error) {
      console.error(`${LOG_PREFIX} [UNINSTALL_ERROR] id=${pluginId}`, error);
      return false;
    }
  }

  /**
   * 热加载：重新加载插件（无需重启系统）
   */
  async hotReloadPlugin(pluginId: string): Promise<boolean> {
    const pluginEntry = this.plugins.get(pluginId);
    if (!pluginEntry) return false;

    const wasEnabled = pluginEntry.metadata.status === 'enabled';

    // 先停用
    if (wasEnabled) {
      await this.disablePlugin(pluginId);
    }

    // 卸载旧实例
    if (pluginEntry.instance) {
      await pluginEntry.instance.uninstall();
      pluginEntry.instance = undefined;
    }

    // 重新加载
    pluginEntry.metadata.status = 'registered';
    const loaded = await this.loadPlugin(pluginId);

    if (loaded && wasEnabled) {
      await this.enablePlugin(pluginId);
    }

    console.log(`${LOG_PREFIX} [HOT_RELOADED] id=${pluginId}`);
    return loaded;
  }

  // ==================== 钩子系统 ====================

  /**
   * 注册钩子处理器
   */
  registerHook(
    pluginId: string,
    hookName: string,
    handler: (data: unknown) => Promise<unknown>,
    priority: number = 0
  ): boolean {
    const pluginEntry = this.plugins.get(pluginId);
    if (!pluginEntry) return false;

    let handlers = this.hooks.get(hookName);
    if (!handlers) {
      handlers = [];
      this.hooks.set(hookName, handlers);
    }

    handlers.push({ pluginId, handler, priority });
    // 按优先级排序（高优先级先执行）
    handlers.sort((a, b) => b.priority - a.priority);

    console.log(`${LOG_PREFIX} [HOOK_REGISTERED] plugin=${pluginId}, hook=${hookName}, priority=${priority}`);
    return true;
  }

  /**
   * 触发钩子（按优先级顺序执行所有处理器）
   */
  async triggerHook(hookName: SystemHook | string, data: unknown): Promise<{
    results: Array<{ pluginId: string; success: boolean; result?: unknown; error?: string }>;
    allSucceeded: boolean;
  }> {
    const handlers = this.hooks.get(hookName);
    if (!handlers || handlers.length === 0) {
      return { results: [], allSucceeded: true };
    }

    const results: Array<{ pluginId: string; success: boolean; result?: unknown; error?: string }> = [];
    let allSucceeded = true;

    for (const { pluginId, handler } of handlers) {
      const pluginEntry = this.plugins.get(pluginId);
      if (!pluginEntry || pluginEntry.metadata.status !== 'enabled') continue;

      const startTime = Date.now();
      try {
        const result = await handler(data);
        const duration = Date.now() - startTime;

        // 更新统计
        pluginEntry.metadata.stats.hookCalls++;
        pluginEntry.metadata.stats.avgExecutionTimeMs = Math.round(
          (pluginEntry.metadata.stats.avgExecutionTimeMs * (pluginEntry.metadata.stats.hookCalls - 1) + duration) /
          pluginEntry.metadata.stats.hookCalls
        );

        results.push({ pluginId, success: true, result });
      } catch (error) {
        pluginEntry.metadata.stats.errorCount++;
        allSucceeded = false;

        const errMsg = error instanceof Error ? error.message : String(error);
        results.push({ pluginId, success: false, error: errMsg });

        console.error(`${LOG_PREFIX} [HOOK_ERROR] hook=${hookName}, plugin=${pluginId}`, error);
      }
    }

    return { results, allSucceeded };
  }

  // ==================== 服务注册与发现 ====================

  /**
   * 注册可供插件使用的系统服务
   */
  registerService<T>(serviceName: string, service: T): void {
    this.services.set(serviceName, service);
    console.log(`${LOG_PREFIX} [SERVICE_REGISTERED] name=${serviceName}`);
  }

  /**
   * 获取已注册的服务
   */
  getService<T>(serviceName: string): T | undefined {
    return this.services.get(serviceName) as T | undefined;
  }

  // ==================== 查询接口 ====================

  getPlugin(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId)?.metadata;
  }

  getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(e => e.metadata);
  }

  getEnabledPlugins(): PluginMetadata[] {
    return this.getAllPlugins().filter(p => p.status === 'enabled');
  }

  getPluginConfig(pluginId: string, key: string): unknown {
    return this.configStore.get(pluginId)?.get(key);
  }

  setPluginConfig(pluginId: string, key: string, value: unknown): boolean {
    const config = this.configStore.get(pluginId);
    if (!config) return false;
    config.set(key, value);
    return true;
  }

  getHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  // ==================== 内部方法 ====================

  /**
   * 创建插件上下文（安全地暴露系统能力给插件）
   */
  private createPluginContext(manifest: PluginManifest): PluginContext {
    return {
      emitEvent: (event: string, data: unknown) => {
        this.emit(`plugin:${manifest.id}:${event}`, data);
      },
      getConfig: (key: string) => {
        return this.getPluginConfig(manifest.id, key);
      },
      setConfig: (key: string, value: unknown) => {
        this.setPluginConfig(manifest.id, key, value);
      },
      log: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => {
        const prefix = `[Plugin:${manifest.name}]`;
        if (level === 'error') console.error(prefix, message, data);
        else if (level === 'warn') console.warn(prefix, message, data);
        else console.log(prefix, message, data);
      },
      getService: <T>(serviceName: string) => {
        // 权限检查：只有声明的权限才能访问对应服务
        if (manifest.permissions?.includes(serviceName) || manifest.permissions?.includes('*')) {
          return this.getService<T>(serviceName);
        }
        console.warn(`${LOG_PREFIX} [PERMISSION_DENIED] plugin=${manifest.id}, service=${serviceName}`);
        return undefined;
      },
      registerHook: (hookName: string, handler: (data: unknown) => Promise<unknown>) => {
        this.registerHook(manifest.id, hookName, handler);
      }
    };
  }

  /**
   * 从源码动态加载插件
   */
  private async loadFromSource(source: string, context: PluginContext): Promise<PluginSDK> {
    // 安全限制：不允许使用 require 动态加载（生产环境应使用沙箱或预编译）
    try {
      // eslint-disable-next-line no-eval
      const pluginFactory = new Function('context', 'require', source);
      const instance = pluginFactory(context, (name: string) => {
        // 白名单限制可require的模块
        const allowedModules = ['lodash', 'axios', 'moment', 'zod'];
        if (allowedModules.includes(name) || name.startsWith('.')) {
          return require(name);
        }
        throw new Error(`Module '${name}' is not allowed in plugin sandbox`);
      });

      return instance as PluginSDK;
    } catch (error) {
      throw new Error(`Failed to load plugin from source: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建存根插件（无源码时的最小实现）
   */
  private createStubPlugin(manifest: PluginManifest): PluginSDK {
    return {
      register: async () => {},
      activate: async () => {},
      deactivate: async () => {},
      uninstall: async () => {},
      getInfo: () => ({
        name: manifest.name,
        version: manifest.version,
        status: 'loaded'
      })
    };
  }

  /**
   * 版本兼容性检查
   */
  private checkVersionCompatibility(manifest: PluginManifest): boolean {
    // 简化的语义版本检查
    const currentVersion = '1.0.0'; // 当前系统版本

    if (manifest.minAgentVersion) {
      if (!this.semverGte(currentVersion, manifest.minAgentVersion)) return false;
    }
    if (manifest.maxAgentVersion) {
      if (!this.semverLte(currentVersion, manifest.maxAgentVersion)) return false;
    }
    return true;
  }

  private semverGte(v1: string, v2: string): boolean {
    const [a1, a2, a3] = v1.split('.').map(Number);
    const [b1, b2, b3] = v2.split('.').map(Number);
    if (a1 !== b1) return a1 > b1;
    if (a2 !== b2) return a2 > b2;
    return a3 >= b3;
  }

  private semverLte(v1: string, v2: string): boolean {
    const [a1, a2, a3] = v1.split('.').map(Number);
    const [b1, b2, b3] = v2.split('.').map(Number);
    if (a1 !== b1) return a1 < b1;
    if (a2 !== b2) return a2 < b2;
    return a3 <= b3;
  }

  // ==================== 统计 ====================

  getStats() {
    const allPlugins = Array.from(this.plugins.values());
    return {
      totalPlugins: allPlugins.length,
      enabledPlugins: allPlugins.filter(p => p.metadata.status === 'enabled').length,
      disabledPlugins: allPlugins.filter(p => p.metadata.status === 'disabled').length,
      errorPlugins: allPlugins.filter(p => p.metadata.status === 'error').length,
      registeredHooks: Array.from(this.hooks.keys()).length,
      registeredServices: this.services.size,
      plugins: allPlugins.map(p => ({
        id: p.metadata.manifest.id,
        name: p.metadata.manifest.name,
        version: p.metadata.manifest.version,
        status: p.metadata.status,
        hooks: p.metadata.manifest.hooks?.length || 0,
        errorMessage: p.metadata.errorMessage
      }))
    };
  }
}
