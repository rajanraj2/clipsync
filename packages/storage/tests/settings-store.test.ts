import { describe, expect, it } from 'bun:test';
import { HistoryPolicy } from '@clipsync/shared-types';
import { ValidationError } from '@clipsync/protocol-schema';
import {
  INIT_SCHEMA_SQL,
  NodeSqliteDriver,
  SettingsStore,
} from '../src/index.js';

describe('SettingsStore (SQLite Preferences & Policies)', () => {
  function createStore(): SettingsStore {
    const driver = new NodeSqliteDriver(':memory:');
    driver.exec(INIT_SCHEMA_SQL);
    return new SettingsStore(driver);
  }

  it('stores and retrieves user preferences with JSON serialization', () => {
    const store = createStore();
    const userId = 'user-1';

    store.setUserSetting(userId, 'sync.automatic', false);
    store.setUserSetting(userId, 'app.theme', 'dark');
    store.setUserSetting(userId, 'custom.filter', { excludeExt: ['exe', 'dmg'] });

    const autoSync = store.getUserSetting(userId, 'sync.automatic');
    expect(autoSync?.settingValue).toBe(false);

    const theme = store.getUserSetting(userId, 'app.theme');
    expect(theme?.settingValue).toBe('dark');

    const custom = store.getUserSetting(userId, 'custom.filter');
    expect(custom?.settingValue).toEqual({ excludeExt: ['exe', 'dmg'] });

    const all = store.getAllUserSettings(userId);
    expect(all['sync.automatic']).toBe(false);
    expect(all['app.theme']).toBe('dark');
  });

  it('stores and retrieves device overrides', () => {
    const store = createStore();
    const deviceId = 'dev-win';

    store.setDeviceSetting(deviceId, 'sync.image', false);
    const setting = store.getDeviceSetting(deviceId, 'sync.image');
    expect(setting?.settingValue).toBe(false);

    const all = store.getAllDeviceSettings(deviceId);
    expect(all['sync.image']).toBe(false);
  });

  it('provides sensible default history policy on first access', () => {
    const store = createStore();
    const policy = store.getHistoryPolicy();

    expect(policy.retentionDays).toBe(30);
    expect(policy.unlimitedRetention).toBe(false);
    expect(policy.maxItems).toBe(5000);
    expect(policy.maxStorageBytes).toBe(1024 * 1024 * 1024);
    expect(policy.cleanupEnabled).toBe(true);
  });

  it('updates history policy and rejects invalid 0 retention days', () => {
    const store = createStore();

    const updatedPolicy: HistoryPolicy = {
      id: 'custom-pol',
      retentionDays: 14,
      unlimitedRetention: false,
      maxItems: 2000,
      maxStorageBytes: 500 * 1024 * 1024,
      cleanupEnabled: true,
      updatedAt: Date.now(),
    };

    store.setHistoryPolicy(updatedPolicy);
    const retrieved = store.getHistoryPolicy();
    expect(retrieved.retentionDays).toBe(14);
    expect(retrieved.maxItems).toBe(2000);

    // Rejects ambiguous 0 retention days
    expect(() => {
      store.setHistoryPolicy({
        ...updatedPolicy,
        retentionDays: 0,
      });
    }).toThrow(ValidationError);
  });
});
