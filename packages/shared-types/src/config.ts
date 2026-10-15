export type SettingCategory = 'sync' | 'history' | 'network' | 'device' | 'app' | 'security';

export type SettingValueType = 'boolean' | 'number' | 'string' | 'json';

export interface SettingDefinition {
  key: string;
  category: SettingCategory;
  defaultValue: unknown;
  valueType: SettingValueType;
  validationSchema?: string;
  isUserConfigurable: boolean;
  isDeviceOverridable: boolean;
  description: string;
}

export interface UserSetting {
  id: string;
  userId: string;
  settingKey: string;
  settingValue: unknown;
  updatedAt: number;
}

export interface DeviceSetting {
  id: string;
  deviceId: string;
  settingKey: string;
  settingValue: unknown;
  updatedAt: number;
}

export interface HistoryPolicy {
  id: string;
  /**
   * Number of days to retain items.
   * NULL or undefined when unlimitedRetention is true.
   * Zero is NOT permitted as an ambiguous retention duration.
   */
  retentionDays: number | null;
  /** Explicit flag indicating history does not automatically expire */
  unlimitedRetention: boolean;
  maxItems: number;
  maxStorageBytes: number;
  cleanupEnabled: boolean;
  updatedAt: number;
}

export interface SecurityEnforcedPolicies {
  /** Authenticated encryption cannot be disabled */
  encryptedCommunication: true;
  /** Local storage encryption cannot be disabled */
  encryptedLocalStorage: true;
}
