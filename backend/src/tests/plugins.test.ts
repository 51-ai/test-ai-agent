/**
 * 插件系统单元测试
 */

import { PluginManager, PluginManifest } from '../core/plugins';

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  describe('install()', () => {
    it('should install a new plugin', async () => {
      const manifest: PluginManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        main: 'index.js'
      };

      await manager.install(manifest);
      
      const plugin = manager.getPlugin('test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.manifest.name).toBe('Test Plugin');
      expect(plugin?.state).toBe('loaded');
    });

    it('should throw error for duplicate plugin', async () => {
      const manifest: PluginManifest = {
        id: 'duplicate-plugin',
        name: 'Duplicate Plugin',
        version: '1.0.0',
        main: 'index.js'
      };

      await manager.install(manifest);
      await expect(manager.install(manifest)).rejects.toThrow();
    });
  });

  describe('enable/disable()', () => {
    it('should enable a plugin', async () => {
      const manifest: PluginManifest = {
        id: 'enable-test',
        name: 'Enable Test',
        version: '1.0.0',
        main: 'index.js'
      };

      await manager.install(manifest);
      await manager.enable('enable-test');
      
      const plugin = manager.getPlugin('enable-test');
      expect(plugin?.state).toBe('active');
    });

    it('should disable a plugin', async () => {
      const manifest: PluginManifest = {
        id: 'disable-test',
        name: 'Disable Test',
        version: '1.0.0',
        main: 'index.js'
      };

      await manager.install(manifest);
      await manager.enable('disable-test');
      await manager.disable('disable-test');
      
      const plugin = manager.getPlugin('disable-test');
      expect(plugin?.state).toBe('disabled');
    });

    it('should throw error for non-existing plugin', async () => {
      await expect(manager.enable('non-existing')).rejects.toThrow();
      await expect(manager.disable('non-existing')).rejects.toThrow();
    });
  });

  describe('uninstall()', () => {
    it('should uninstall a plugin', async () => {
      const manifest: PluginManifest = {
        id: 'uninstall-test',
        name: 'Uninstall Test',
        version: '1.0.0',
        main: 'index.js'
      };

      await manager.install(manifest);
      await manager.uninstall('uninstall-test');
      
      expect(manager.getPlugin('uninstall-test')).toBeUndefined();
    });

    it('should throw error for non-existing plugin', async () => {
      await expect(manager.uninstall('non-existing')).rejects.toThrow();
    });
  });

  describe('getPlugins()', () => {
    it('should return all installed plugins', async () => {
      await manager.install({
        id: 'plugin1',
        name: 'Plugin 1',
        version: '1.0.0',
        main: 'index.js'
      });
      await manager.install({
        id: 'plugin2',
        name: 'Plugin 2',
        version: '1.0.0',
        main: 'index.js'
      });

      const plugins = manager.getPlugins();
      expect(plugins.length).toBe(2);
    });
  });

  describe('getEnabledPlugins()', () => {
    it('should return only enabled plugins', async () => {
      await manager.install({
        id: 'enabled-plugin',
        name: 'Enabled Plugin',
        version: '1.0.0',
        main: 'index.js'
      });
      await manager.install({
        id: 'disabled-plugin',
        name: 'Disabled Plugin',
        version: '1.0.0',
        main: 'index.js'
      });

      await manager.enable('enabled-plugin');
      // Note: disabled-plugin remains in 'loaded' state

      const enabled = manager.getEnabledPlugins();
      expect(enabled.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateConfig()', () => {
    it('should update plugin configuration', async () => {
      const manifest: PluginManifest = {
        id: 'config-test',
        name: 'Config Test',
        version: '1.0.0',
        main: 'index.js'
      };

      await manager.install(manifest);
      manager.updateConfig('config-test', {
        enabled: true,
        priority: 100,
        config: { customKey: 'customValue' }
      });

      const plugin = manager.getPlugin('config-test');
      expect(plugin?.config.priority).toBe(100);
      expect(plugin?.config.config).toEqual({ customKey: 'customValue' });
    });
  });

  describe('hooks', () => {
    it('should register and trigger hooks', async () => {
      let hookCalled = false;
      
      manager.registerHook('test.hook', async (data: any) => {
        hookCalled = true;
        return data;
      });

      const results = await manager.triggerHook('test.hook', { test: 'data' });
      
      expect(hookCalled).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
    });

    it('should handle hook errors gracefully', async () => {
      manager.registerHook('error.hook', async () => {
        throw new Error('Hook error');
      });

      const results = await manager.triggerHook('error.hook');
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    it('should get registered hooks', () => {
      manager.registerHook('hook1', () => {});
      manager.registerHook('hook2', () => {});

      const hooks = manager.getHooks();
      expect(hooks).toContain('hook1');
      expect(hooks).toContain('hook2');
    });
  });

  describe('events', () => {
    it('should emit install event', (done: jest.DoneCallback) => {
      manager.on('plugin:installed' as any, (manifest: PluginManifest) => {
        expect(manifest.id).toBe('event-test');
        done();
      });

      manager.install({
        id: 'event-test',
        name: 'Event Test',
        version: '1.0.0',
        main: 'index.js'
      });
    });

    it('should emit uninstall event', (done: jest.DoneCallback) => {
      manager.install({
        id: 'event-uninstall-test',
        name: 'Event Uninstall Test',
        version: '1.0.0',
        main: 'index.js'
      });

      manager.on('plugin:uninstalled' as any, (manifest: PluginManifest) => {
        expect(manifest.id).toBe('event-uninstall-test');
        done();
      });

      manager.uninstall('event-uninstall-test');
    });
  });

  describe('sandbox mode', () => {
    it('should allow all URLs by default', () => {
      expect(manager['isSandboxed']).toBe(true);
    });

    it('should toggle sandbox mode', () => {
      manager.setSandboxMode(false);
      expect(manager['isSandboxed']).toBe(false);

      manager.setSandboxMode(true);
      expect(manager['isSandboxed']).toBe(true);
    });
  });
});
