import {
  DeviceSetting,
  HistoryPolicy,
  UserSetting,
} from '@clipsync/shared-types';
import { ConcurrencyConflictError, validateHistoryPolicy } from '@clipsync/protocol-schema';
import { INIT_SCHEMA_SQL } from './schema.js';
import { SqliteDriver } from './types.js';

interface RawHistoryPolicyRow {
  id: string;
  retention_days: number | null;
  unlimited_retention: number;
  max_items: number;
  max_storage_bytes: number;
  cleanup_enabled: number;
  updated_at: number;
}

export class SettingsStore {
  constructor(private readonly driver: SqliteDriver) {
    this.initialize();
  }

  public initialize(): void {
    this.driver.exec(INIT_SCHEMA_SQL);
  }

  public getUserSetting(userId: string, key: string): UserSetting | null {
    const row = this.driver.get<{
      id: string;
      user_id: string;
      setting_key: string;
      setting_value: string;
      updated_at: number;
    }>(
      'SELECT * FROM user_settings WHERE user_id = ? AND setting_key = ?',
      [userId, key]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      settingKey: row.setting_key,
      settingValue: JSON.parse(row.setting_value) as unknown,
      updatedAt: row.updated_at,
    };
  }

  public setUserSetting(userId: string, key: string, value: unknown): UserSetting {
    const id = `usr-set-${userId}-${key}`;
    const now = Date.now();
    const serialized = JSON.stringify(value);

    this.driver.run(
      `INSERT INTO user_settings (id, user_id, setting_key, setting_value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`,
      [id, userId, key, serialized, now]
    );

    return {
      id,
      userId,
      settingKey: key,
      settingValue: value,
      updatedAt: now,
    };
  }

  public getAllUserSettings(userId: string): Record<string, unknown> {
    const rows = this.driver.all<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?',
      [userId]
    );

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.setting_key] = JSON.parse(row.setting_value) as unknown;
      } catch {
        result[row.setting_key] = row.setting_value;
      }
    }
    return result;
  }

  public getConfigVersion(userId: string): number {
    const row = this.getUserSetting(userId, '_meta.config_version');
    if (row && typeof row.settingValue === 'number') {
      return row.settingValue;
    }
    return 1;
  }

  public incrementConfigVersion(userId: string): number {
    const next = this.getConfigVersion(userId) + 1;
    this.setUserSetting(userId, '_meta.config_version', next);
    return next;
  }

  public updateUserSettingsBatch(
    userId: string,
    settings: Record<string, unknown>,
    expectedVersion?: number
  ): { version: number; settings: Record<string, unknown> } {
    const currentVersion = this.getConfigVersion(userId);
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new ConcurrencyConflictError(expectedVersion, currentVersion);
    }

    for (const [key, val] of Object.entries(settings)) {
      if (key !== '_meta.config_version') {
        this.setUserSetting(userId, key, val);
      }
    }

    const newVersion = currentVersion + 1;
    this.setUserSetting(userId, '_meta.config_version', newVersion);

    return {
      version: newVersion,
      settings: this.getAllUserSettings(userId),
    };
  }

  public getDeviceSetting(deviceId: string, key: string): DeviceSetting | null {
    const row = this.driver.get<{
      id: string;
      device_id: string;
      setting_key: string;
      setting_value: string;
      updated_at: number;
    }>(
      'SELECT * FROM device_settings WHERE device_id = ? AND setting_key = ?',
      [deviceId, key]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      deviceId: row.device_id,
      settingKey: row.setting_key,
      settingValue: JSON.parse(row.setting_value) as unknown,
      updatedAt: row.updated_at,
    };
  }

  public setDeviceSetting(deviceId: string, key: string, value: unknown): DeviceSetting {
    const id = `dev-set-${deviceId}-${key}`;
    const now = Date.now();
    const serialized = JSON.stringify(value);

    this.driver.run(
      `INSERT INTO device_settings (id, device_id, setting_key, setting_value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id, setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`,
      [id, deviceId, key, serialized, now]
    );

    return {
      id,
      deviceId,
      settingKey: key,
      settingValue: value,
      updatedAt: now,
    };
  }

  public getAllDeviceSettings(deviceId: string): Record<string, unknown> {
    const rows = this.driver.all<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM device_settings WHERE device_id = ?',
      [deviceId]
    );

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.setting_key] = JSON.parse(row.setting_value) as unknown;
      } catch {
        result[row.setting_key] = row.setting_value;
      }
    }
    return result;
  }

  public getHistoryPolicy(): HistoryPolicy {
    const row = this.driver.get<RawHistoryPolicyRow>(
      'SELECT * FROM history_policy LIMIT 1'
    );

    if (!row) {
      // Default policy per Section 5.2 B: 30 days retention, 5000 items, 1GB storage
      const defaultPolicy: HistoryPolicy = {
        id: 'default-policy',
        retentionDays: 30,
        unlimitedRetention: false,
        maxItems: 5000,
        maxStorageBytes: 1024 * 1024 * 1024,
        cleanupEnabled: true,
        updatedAt: Date.now(),
      };
      this.setHistoryPolicy(defaultPolicy);
      return defaultPolicy;
    }

    return {
      id: row.id,
      retentionDays: row.retention_days,
      unlimitedRetention: Boolean(row.unlimited_retention),
      maxItems: row.max_items,
      maxStorageBytes: row.max_storage_bytes,
      cleanupEnabled: Boolean(row.cleanup_enabled),
      updatedAt: row.updated_at,
    };
  }

  public setHistoryPolicy(policy: HistoryPolicy): void {
    validateHistoryPolicy(policy);

    this.driver.run(
      `INSERT INTO history_policy (
        id, retention_days, unlimited_retention, max_items, max_storage_bytes,
        cleanup_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        retention_days = excluded.retention_days,
        unlimited_retention = excluded.unlimited_retention,
        max_items = excluded.max_items,
        max_storage_bytes = excluded.max_storage_bytes,
        cleanup_enabled = excluded.cleanup_enabled,
        updated_at = excluded.updated_at`,
      [
        policy.id,
        policy.retentionDays,
        policy.unlimitedRetention ? 1 : 0,
        policy.maxItems,
        policy.maxStorageBytes,
        policy.cleanupEnabled ? 1 : 0,
        policy.updatedAt,
      ]
    );
  }
}
