import { ConfigSyncPayload, ProtocolMessage } from '@clipsync/shared-types';
import {
  createProtocolMessage,
  SecurityPolicyViolationError,
  SETTING_DEFINITIONS,
  ValidationError,
} from '@clipsync/protocol-schema';
import { SettingsStore } from '@clipsync/storage';
import { SyncTransport } from './types.js';

const MANDATORY_SECURITY_KEYS: Record<string, true> = {
  'security.encryptedCommunication': true,
  'security.encryptedLocalStorage': true,
};

export class ConfigSyncManager {
  private readonly subscribers = new Set<(settings: Record<string, unknown>) => void>();

  constructor(
    private readonly localDeviceId: string,
    private readonly settingsStore: SettingsStore,
    private readonly userId: string = 'default-user',
    private readonly transport?: SyncTransport
  ) {}

  public getCurrentVersion(): number {
    return this.settingsStore.getConfigVersion(this.userId);
  }

  public getCurrentSettings(): Record<string, unknown> {
    return this.settingsStore.getAllUserSettings(this.userId);
  }

  public validateSettings(settings: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith('_meta.')) {
        continue;
      }

      // 1. Mandatory security check
      if (MANDATORY_SECURITY_KEYS[key] && value !== true) {
        throw new SecurityPolicyViolationError(
          key,
          'Mandatory security policy cannot be disabled through configuration sync'
        );
      }

      // 2. Definition check
      const definition = SETTING_DEFINITIONS[key];
      if (!definition) {
        throw new ValidationError(`Unknown setting key: "${key}"`, key);
      }

      if (!definition.isUserConfigurable) {
        throw new ValidationError(`Setting "${key}" is not user-configurable`, key);
      }

      // 3. Type check
      const actualType = typeof value;
      if (definition.valueType === 'boolean' && actualType !== 'boolean') {
        throw new ValidationError(`Setting "${key}" must be a boolean`, key);
      }
      if (definition.valueType === 'number' && actualType !== 'number') {
        throw new ValidationError(`Setting "${key}" must be a number`, key);
      }
      if (definition.valueType === 'string' && actualType !== 'string') {
        throw new ValidationError(`Setting "${key}" must be a string`, key);
      }
    }
  }

  public async updateSettingsLocally(
    settings: Record<string, unknown>,
    expectedVersion?: number
  ): Promise<{ version: number; settings: Record<string, unknown> }> {
    this.validateSettings(settings);

    const result = this.settingsStore.updateUserSettingsBatch(
      this.userId,
      settings,
      expectedVersion
    );

    // Notify local subscribers (e.g. SyncEngine)
    this.notifySubscribers(result.settings);

    // Broadcast config_sync message to peers
    if (this.transport) {
      const message = createProtocolMessage<ConfigSyncPayload, 'config_sync'>({
        type: 'config_sync',
        senderDeviceId: this.localDeviceId,
        targetDeviceId: null, // Broadcast to all paired peers
        payload: {
          version: result.version,
          userSettings: result.settings,
          updatedAt: Date.now(),
        },
      });

      try {
        await this.transport.send(message);
      } catch {
        // Best effort transport
      }
    }

    return result;
  }

  public async handleInboundConfigSync(
    message: ProtocolMessage & { type: 'config_sync' }
  ): Promise<{ applied: boolean; reason?: string }> {
    const { version, userSettings } = message.payload;
    const currentVersion = this.getCurrentVersion();

    // Optimistic Concurrency Control: incoming version must be strictly newer
    if (version <= currentVersion) {
      return {
        applied: false,
        reason: `Ignored stale config update: received version ${version} <= current version ${currentVersion}`,
      };
    }

    // Validate settings before applying
    this.validateSettings(userSettings);

    // Apply updates while incrementing local version to match incoming version
    for (const [key, value] of Object.entries(userSettings)) {
      if (!key.startsWith('_meta.')) {
        this.settingsStore.setUserSetting(this.userId, key, value);
      }
    }
    this.settingsStore.setUserSetting(this.userId, '_meta.config_version', version);

    const updated = this.settingsStore.getAllUserSettings(this.userId);
    this.notifySubscribers(updated);

    return { applied: true };
  }

  public subscribe(callback: (settings: Record<string, unknown>) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(settings: Record<string, unknown>): void {
    for (const callback of this.subscribers) {
      try {
        callback(settings);
      } catch {
        // Catch subscriber errors to avoid breaking sync loop
      }
    }
  }
}
