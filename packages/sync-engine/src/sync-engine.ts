import {
  ClipboardItem,
  ClipboardSyncPayload,
  ClipboardAckPayload,
  DeviceMetadata,
  ProtocolMessage,
} from '@clipsync/shared-types';
import {
  createProtocolMessage,
  normalizeContent,
  resolveSetting,
} from '@clipsync/protocol-schema';
import {
  ClipboardAdapter,
  RawClipboardData,
  SyncEngineConfig,
  SyncEngineEventHandler,
  SyncTransport,
} from './types.js';
import { EchoSuppressor } from './echo-suppressor.js';
import { inspectSensitiveContent } from './sensitive-filter.js';

export class SyncEngine {
  private readonly localDevice: DeviceMetadata;
  private readonly adapter: ClipboardAdapter;
  private readonly transport: SyncTransport;
  private readonly echoSuppressor: EchoSuppressor;
  private readonly eventHandlers: SyncEngineEventHandler;
  private userPreferences: Record<string, unknown>;
  private deviceOverrides: Record<string, unknown>;
  private isRunning = false;
  private isPaused = false;
  private sequenceCounter = 0;

  constructor(
    adapter: ClipboardAdapter,
    transport: SyncTransport,
    config: SyncEngineConfig,
    handlers: SyncEngineEventHandler = {}
  ) {
    this.adapter = adapter;
    this.transport = transport;
    this.localDevice = config.localDevice;
    this.userPreferences = { ...(config.userPreferences ?? {}) };
    this.deviceOverrides = { ...(config.deviceOverrides ?? {}) };
    this.echoSuppressor = new EchoSuppressor(config.echoSuppressionWindowMs ?? 3000);
    this.eventHandlers = handlers;
  }

  public start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    this.adapter.startWatching((data) => {
      void this.handleLocalClipboardChange(data);
    });

    this.transport.onMessage((message) => {
      void this.handleInboundProtocolMessage(message);
    });
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    this.adapter.stopWatching();
    this.echoSuppressor.clear();
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  public updatePreferences(prefs: Record<string, unknown>): void {
    this.userPreferences = { ...this.userPreferences, ...prefs };
  }

  public updateDeviceOverrides(overrides: Record<string, unknown>): void {
    this.deviceOverrides = { ...this.deviceOverrides, ...overrides };
  }

  /**
   * Pipeline for locally initiated clipboard changes.
   */
  public async handleLocalClipboardChange(raw: RawClipboardData): Promise<ClipboardItem | null> {
    if (!this.isRunning || this.isPaused) {
      return null;
    }

    // Check sync settings
    const automaticSync = this.getSetting<boolean>('sync.automatic');
    const sendClipboard = this.getSetting<boolean>('sync.sendClipboard');

    if (!automaticSync || !sendClipboard) {
      return null;
    }

    // Check sensitive / password manager markers
    const ignorePasswordManagers = this.getSetting<boolean>('security.ignorePasswordManagers');
    const ignoreAuthTokens = this.getSetting<boolean>('security.ignoreAuthTokens');

    const sensitiveCheck = inspectSensitiveContent(raw, {
      ignorePasswordManagers,
      ignoreAuthTokens,
    });

    if (sensitiveCheck.isSensitive) {
      this.eventHandlers.itemFiltered?.(sensitiveCheck.reason ?? 'Sensitive content filtered');
      return null;
    }

    // Normalize content & compute SHA-256
    const normalized = normalizeContent(raw.content, raw.contentType);

    // Verify content type is allowed
    const typeKey = `sync.${normalized.contentType}`;
    if (!this.getSetting<boolean>(typeKey)) {
      this.eventHandlers.itemFiltered?.(`Sync disabled for content type: ${normalized.contentType}`);
      return null;
    }

    // Verify size limits
    const maxSizeBytes = this.getSetting<number>('sync.maxClipboardSizeBytes');
    if (normalized.sizeBytes > maxSizeBytes) {
      this.eventHandlers.itemFiltered?.(
        `Payload size (${normalized.sizeBytes} bytes) exceeds limit (${maxSizeBytes} bytes)`
      );
      return null;
    }

    // Echo suppression: was this change caused by a recent inbound sync write?
    if (this.echoSuppressor.isEchoAndConsume(normalized.hash)) {
      return null;
    }

    // Consecutive duplicate suppression
    if (this.echoSuppressor.isDuplicateOfLastSent(normalized.hash)) {
      return null;
    }

    this.sequenceCounter += 1;
    const now = Date.now();

    const clipboardItem: ClipboardItem = {
      id: `clip-${this.localDevice.id}-${this.sequenceCounter}-${now}`,
      sourceDeviceId: this.localDevice.id,
      contentType: normalized.contentType,
      content: normalized.normalized,
      sizeBytes: normalized.sizeBytes,
      hash: normalized.hash,
      isPinned: false,
      isFavourite: false,
      createdAt: now,
      updatedAt: now,
    };

    const message = createProtocolMessage<ClipboardSyncPayload, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: this.localDevice.id,
      targetDeviceId: null, // Broadcast to all connected peers
      payload: {
        item: clipboardItem,
        originatingDeviceId: this.localDevice.id,
      },
    });

    this.echoSuppressor.recordSent(normalized.hash);

    try {
      await this.transport.send(message);
      this.eventHandlers.itemSent?.(clipboardItem);
      return clipboardItem;
    } catch (err) {
      this.eventHandlers.error?.(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }

  /**
   * Pipeline for inbound clipboard messages from peers.
   */
  public async handleInboundProtocolMessage(message: ProtocolMessage): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Reject self-broadcasts
    if (message.senderDeviceId === this.localDevice.id) {
      return;
    }

    if (message.type === 'clipboard_sync') {
      await this.processInboundClipboardSync(message);
    }
  }

  private async processInboundClipboardSync(
    message: ProtocolMessage & { type: 'clipboard_sync' }
  ): Promise<void> {
    const { item, originatingDeviceId } = message.payload;

    // Loop prevention: check originating device
    if (originatingDeviceId === this.localDevice.id) {
      return;
    }

    // Check receiving settings
    const receiveClipboard = this.getSetting<boolean>('sync.receiveClipboard');
    if (!receiveClipboard || this.isPaused) {
      await this.sendAck(message.senderDeviceId, item.id, 'rejected', 'Receiving disabled or paused');
      return;
    }

    // Check content type allowance
    const typeKey = `sync.${item.contentType}`;
    if (!this.getSetting<boolean>(typeKey)) {
      await this.sendAck(message.senderDeviceId, item.id, 'rejected', `Content type ${item.contentType} disabled`);
      return;
    }

    // Deduplication against current clipboard content
    const currentLocal = await this.adapter.read();
    if (currentLocal) {
      const currentNormalized = normalizeContent(currentLocal.content, currentLocal.contentType);
      if (currentNormalized.hash === item.hash) {
        await this.sendAck(message.senderDeviceId, item.id, 'duplicate_ignored');
        return;
      }
    }

    // CRITICAL: Record local write hash BEFORE writing to OS clipboard to prevent echo!
    this.echoSuppressor.recordLocalWrite(item.hash);

    try {
      await this.adapter.write({
        content: item.content,
        contentType: item.contentType,
      });

      this.eventHandlers.itemReceived?.(item);
      await this.sendAck(message.senderDeviceId, item.id, 'received');
    } catch (err) {
      this.eventHandlers.error?.(err instanceof Error ? err : new Error(String(err)));
      await this.sendAck(message.senderDeviceId, item.id, 'rejected', 'Failed to write to local clipboard');
    }
  }

  private async sendAck(
    targetDeviceId: string,
    itemId: string,
    status: ClipboardAckPayload['status'],
    rejectionReason?: string
  ): Promise<void> {
    const ackMessage = createProtocolMessage<ClipboardAckPayload, 'clipboard_ack'>({
      type: 'clipboard_ack',
      senderDeviceId: this.localDevice.id,
      targetDeviceId,
      payload: {
        itemId,
        receivedAt: Date.now(),
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      },
    });

    try {
      await this.transport.send(ackMessage);
    } catch {
      // Best-effort ack
    }
  }

  private getSetting<T>(key: string): T {
    const resolved = resolveSetting<T>({
      key,
      deviceId: this.localDevice.id,
      userPreferences: this.userPreferences,
      deviceOverrides: this.deviceOverrides,
      platformCapabilities: this.localDevice.capabilities,
    });
    return resolved.value;
  }
}
