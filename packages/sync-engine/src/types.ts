import type {
  ClipboardItem,
  ContentType,
  DeviceMetadata,
  ProtocolMessage,
} from '@clipsync/shared-types';
import type { ConfigSyncManager } from './config-sync-manager.js';

export interface RawClipboardData {
  content: string;
  contentType: ContentType;
  /** True if tagged with password manager / concealment marker */
  isConcealed?: boolean;
  sourceApp?: string;
  sequenceNumber?: number;
}

export interface ClipboardAdapter {
  readonly platformName: string;
  read(): Promise<RawClipboardData | null>;
  write(data: RawClipboardData): Promise<void>;
  startWatching(callback: (data: RawClipboardData) => void): void;
  stopWatching(): void;
  isWatching(): boolean;
}

export interface SyncTransport {
  readonly transportId: string;
  send(message: ProtocolMessage): Promise<void>;
  onMessage(handler: (message: ProtocolMessage) => void): void;
}

export interface SyncEngineConfig {
  localDevice: DeviceMetadata;
  userPreferences?: Record<string, unknown>;
  deviceOverrides?: Record<string, unknown>;
  configSyncManager?: ConfigSyncManager;
  echoSuppressionWindowMs?: number;
  /** Debounce time in ms before processing rapid clipboard changes (default 250ms) */
  debounceMs?: number;
}

export type SyncEngineEventHandler = {
  itemSent?: (item: ClipboardItem) => void;
  itemReceived?: (item: ClipboardItem) => void;
  itemFiltered?: (reason: string, preview?: string) => void;
  error?: (error: Error) => void;
};
