import { ClipboardItem } from './clipboard.js';
import { DeviceMetadata } from './device.js';
import { TransferItem, TransferChunk } from './transfer.js';

export const PROTOCOL_VERSION = '2.0' as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type MessageType =
  | 'handshake_init'
  | 'handshake_ack'
  | 'device_announce'
  | 'clipboard_sync'
  | 'clipboard_ack'
  | 'history_request'
  | 'history_response'
  | 'config_sync'
  | 'transfer_offer'
  | 'transfer_accept'
  | 'transfer_chunk'
  | 'transfer_complete'
  | 'transfer_cancel'
  | 'ping'
  | 'pong'
  | 'error';

export interface BaseProtocolMessage<T = unknown> {
  protocolVersion: ProtocolVersion;
  messageId: string;
  senderDeviceId: string;
  targetDeviceId: string | null; // null represents broadcast to all paired devices
  timestamp: number;
  type: MessageType;
  payload: T;
  signature?: string;
}

export interface HandshakeInitPayload {
  device: DeviceMetadata;
  nonce: string;
  supportedProtocolVersions: string[];
}

export interface HandshakeAckPayload {
  device: DeviceMetadata;
  selectedProtocolVersion: ProtocolVersion;
  verifiedNonce: string;
  sessionToken: string;
}

export interface ClipboardSyncPayload {
  item: ClipboardItem;
  originatingDeviceId: string;
}

export interface ClipboardAckPayload {
  itemId: string;
  receivedAt: number;
  status: 'received' | 'duplicate_ignored' | 'rejected';
  rejectionReason?: string;
}

export interface ConfigSyncPayload {
  version: number;
  userSettings: Record<string, unknown>;
  updatedAt: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ProtocolMessage =
  | (BaseProtocolMessage<HandshakeInitPayload> & { type: 'handshake_init' })
  | (BaseProtocolMessage<HandshakeAckPayload> & { type: 'handshake_ack' })
  | (BaseProtocolMessage<DeviceMetadata> & { type: 'device_announce' })
  | (BaseProtocolMessage<ClipboardSyncPayload> & { type: 'clipboard_sync' })
  | (BaseProtocolMessage<ClipboardAckPayload> & { type: 'clipboard_ack' })
  | (BaseProtocolMessage<ConfigSyncPayload> & { type: 'config_sync' })
  | (BaseProtocolMessage<TransferItem> & { type: 'transfer_offer' | 'transfer_accept' | 'transfer_complete' | 'transfer_cancel' })
  | (BaseProtocolMessage<TransferChunk> & { type: 'transfer_chunk' })
  | (BaseProtocolMessage<{ echo: number }> & { type: 'ping' | 'pong' })
  | (BaseProtocolMessage<ErrorPayload> & { type: 'error' });
