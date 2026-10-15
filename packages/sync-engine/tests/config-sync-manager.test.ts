import { describe, expect, it } from 'bun:test';
import { ProtocolMessage } from '@clipsync/shared-types';
import {
  ConcurrencyConflictError,
  resolveSetting,
  SecurityPolicyViolationError,
  ValidationError,
} from '@clipsync/protocol-schema';
import { NodeSqliteDriver, SettingsStore } from '@clipsync/storage';
import {
  ConfigSyncManager,
  InMemoryClipboardAdapter,
  SyncEngine,
  SyncTransport,
} from '../src/index.js';

class MockTransport implements SyncTransport {
  public peer: MockTransport | null = null;
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  public sentMessages: ProtocolMessage[] = [];

  constructor(public readonly transportId: string) {}

  public async send(message: ProtocolMessage): Promise<void> {
    this.sentMessages.push(message);
    if (this.peer && this.peer.messageHandler) {
      this.peer.messageHandler(message);
    }
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }
}

describe('Configuration Management & Settings Synchronization', () => {
  function createManager(deviceId: string, transport?: SyncTransport): { manager: ConfigSyncManager; store: SettingsStore } {
    const driver = new NodeSqliteDriver(':memory:');
    const store = new SettingsStore(driver);
    const manager = new ConfigSyncManager(deviceId, store, 'user-1', transport);
    return { manager, store };
  }

  it('increments version number and enforces optimistic concurrency control', async () => {
    const { manager } = createManager('dev-1');

    expect(manager.getCurrentVersion()).toBe(1);

    // Initial update
    const res1 = await manager.updateSettingsLocally({ 'sync.text': true });
    expect(res1.version).toBe(2);

    // Update with correct expectedVersion
    const res2 = await manager.updateSettingsLocally({ 'sync.url': false }, 2);
    expect(res2.version).toBe(3);

    // Update with stale expectedVersion triggers ConcurrencyConflictError
    await expect(
      manager.updateSettingsLocally({ 'sync.image': false }, 2)
    ).rejects.toThrow(ConcurrencyConflictError);
  });

  it('validates settings and rejects invalid types or unknown keys', async () => {
    const { manager } = createManager('dev-1');

    // Reject unknown setting key
    await expect(
      manager.updateSettingsLocally({ 'unknown.fake.setting': true })
    ).rejects.toThrow(ValidationError);

    // Reject wrong value type (boolean expected for sync.text)
    await expect(
      manager.updateSettingsLocally({ 'sync.text': 12345 })
    ).rejects.toThrow(ValidationError);
  });

  it('strictly protects mandatory security policies from being disabled', async () => {
    const { manager } = createManager('dev-1');

    await expect(
      manager.updateSettingsLocally({ 'security.encryptedCommunication': false })
    ).rejects.toThrow(SecurityPolicyViolationError);

    await expect(
      manager.updateSettingsLocally({ 'security.encryptedLocalStorage': false })
    ).rejects.toThrow(SecurityPolicyViolationError);
  });

  it('synchronizes user preferences between connected devices over transport', async () => {
    const transportA = new MockTransport('transport-a');
    const transportB = new MockTransport('transport-b');
    transportA.peer = transportB;
    transportB.peer = transportA;

    const { manager: managerA } = createManager('device-a', transportA);
    const { manager: managerB } = createManager('device-b', transportB);

    // Hook transport to manager B
    transportB.onMessage((msg) => {
      if (msg.type === 'config_sync') {
        void managerB.handleInboundConfigSync(msg);
      }
    });

    const { promise: notifiedPromise, resolve: onNotified } = Promise.withResolvers<Record<string, unknown>>();
    managerB.subscribe(onNotified);

    // Device A updates preference
    await managerA.updateSettingsLocally({ 'sync.automatic': false });

    // Wait for B to receive notification
    const bSettings = await notifiedPromise;
    expect(bSettings['sync.automatic']).toBe(false);
    expect(managerB.getCurrentVersion()).toBe(2);
  });

  it('ignores stale config updates on inbound receiver', async () => {
    const { manager } = createManager('device-b');

    // Fast-forward local version to 5
    await manager.updateSettingsLocally({ 'sync.text': true }); // v2
    await manager.updateSettingsLocally({ 'sync.text': true }); // v3
    await manager.updateSettingsLocally({ 'sync.text': true }); // v4
    await manager.updateSettingsLocally({ 'sync.text': true }); // v5

    // Inbound stale message with version 3
    const staleMsg: ProtocolMessage & { type: 'config_sync' } = {
      protocolVersion: '2.0',
      messageId: 'msg-stale',
      senderDeviceId: 'device-a',
      targetDeviceId: null,
      timestamp: Date.now(),
      type: 'config_sync',
      payload: {
        version: 3,
        userSettings: { 'sync.text': false },
        updatedAt: Date.now(),
      },
    };

    const result = await manager.handleInboundConfigSync(staleMsg);
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('Ignored stale config update');
    expect(manager.getCurrentSettings()['sync.text']).toBe(true);
  });

  it('preserves device-level overrides when user preferences synchronize', async () => {
    const { manager: managerWin, store: storeWin } = createManager('device-win');

    // Windows has a local device-level override disabling image synchronization
    storeWin.setDeviceSetting('device-win', 'sync.image', false);

    // Global user preferences synchronize image sync = true
    await managerWin.updateSettingsLocally({ 'sync.image': true });

    // Verify precedence resolution for Windows:
    // Device override (false) beats user preference (true)
    const resolvedWin = resolveSetting<boolean>({
      key: 'sync.image',
      deviceId: 'device-win',
      userPreferences: managerWin.getCurrentSettings(),
      deviceOverrides: storeWin.getAllDeviceSettings('device-win'),
    });

    expect(resolvedWin.value).toBe(false);
    expect(resolvedWin.source).toBe('device_override');

    // Another device without override resolves user preference (true)
    const resolvedMac = resolveSetting<boolean>({
      key: 'sync.image',
      deviceId: 'device-mac',
      userPreferences: managerWin.getCurrentSettings(),
      deviceOverrides: {},
    });

    expect(resolvedMac.value).toBe(true);
    expect(resolvedMac.source).toBe('user_preference');
  });

  it('propagates configuration updates live to running SyncEngine without restart', async () => {
    const adapter = new InMemoryClipboardAdapter();
    const transport = new MockTransport('transport-live');
    const { manager, store } = createManager('device-live', transport);

    const engine = new SyncEngine(adapter, transport, {
      localDevice: {
        id: 'device-live',
        name: 'Live Device',
        platform: 'macos',
        appVersion: '0.1.0',
        capabilities: {
          backgroundClipboardMonitoring: true,
          osClipboardHook: true,
          hybridCapture: false,
          directFileAccess: true,
          browserRestricted: false,
        },
        status: 'online',
        trustLevel: 'paired',
        lastSeenAt: Date.now(),
        registeredAt: Date.now(),
      },
      userPreferences: store.getAllUserSettings('user-1'),
      configSyncManager: manager,
    });

    engine.start();

    // Copying text while sending is enabled
    adapter.simulateExternalCopy({ content: 'Message 1', contentType: 'text' });
    expect(transport.sentMessages.some((m) => m.type === 'clipboard_sync')).toBe(true);
    transport.sentMessages = [];

    // Dynamically disable sending via ConfigSyncManager
    await manager.updateSettingsLocally({ 'sync.sendClipboard': false });

    // Copying text while sending is disabled
    adapter.simulateExternalCopy({ content: 'Message 2', contentType: 'text' });
    expect(transport.sentMessages.filter((m) => m.type === 'clipboard_sync')).toHaveLength(0);

    // Re-enable sending dynamically
    await manager.updateSettingsLocally({ 'sync.sendClipboard': true });

    adapter.simulateExternalCopy({ content: 'Message 3', contentType: 'text' });
    expect(transport.sentMessages.some((m) => m.type === 'clipboard_sync')).toBe(true);

    engine.stop();
  });
});
