import { randomUUID } from 'node:crypto';
import {
  BaseProtocolMessage,
  MessageType,
  PROTOCOL_VERSION,
  ProtocolMessage,
} from '@clipsync/shared-types';
import { ValidationError, VersionMismatchError } from './errors.js';

const VALID_MESSAGE_TYPES: Record<MessageType, true> = {
  handshake_init: true,
  handshake_ack: true,
  device_announce: true,
  clipboard_sync: true,
  clipboard_ack: true,
  history_request: true,
  history_response: true,
  config_sync: true,
  transfer_offer: true,
  transfer_accept: true,
  transfer_chunk: true,
  transfer_complete: true,
  transfer_cancel: true,
  ping: true,
  pong: true,
  error: true,
};

export interface CreateMessageOptions<T> {
  type: MessageType;
  senderDeviceId: string;
  targetDeviceId?: string | null;
  payload: T;
  messageId?: string;
  timestamp?: number;
  signature?: string;
}

export function createProtocolMessage<T>(options: CreateMessageOptions<T>): BaseProtocolMessage<T> {
  if (!options.senderDeviceId || options.senderDeviceId.trim().length === 0) {
    throw new ValidationError('senderDeviceId is required and cannot be empty', 'senderDeviceId');
  }
  if (!VALID_MESSAGE_TYPES[options.type]) {
    throw new ValidationError(`Unknown message type: "${options.type}"`, 'type');
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    messageId: options.messageId ?? randomUUID(),
    senderDeviceId: options.senderDeviceId,
    targetDeviceId: options.targetDeviceId ?? null,
    timestamp: options.timestamp ?? Date.now(),
    type: options.type,
    payload: options.payload,
    ...(options.signature ? { signature: options.signature } : {}),
  };
}

export function validateProtocolEnvelope(message: unknown): message is ProtocolMessage {
  if (!message || typeof message !== 'object') {
    throw new ValidationError('Message must be a non-null object');
  }

  const candidate = message as Record<string, unknown>;

  if (candidate.protocolVersion !== PROTOCOL_VERSION) {
    throw new VersionMismatchError(
      PROTOCOL_VERSION,
      typeof candidate.protocolVersion === 'string' ? candidate.protocolVersion : 'unknown'
    );
  }

  if (typeof candidate.messageId !== 'string' || candidate.messageId.trim().length === 0) {
    throw new ValidationError('messageId must be a non-empty string', 'messageId');
  }

  if (typeof candidate.senderDeviceId !== 'string' || candidate.senderDeviceId.trim().length === 0) {
    throw new ValidationError('senderDeviceId must be a non-empty string', 'senderDeviceId');
  }

  if (candidate.targetDeviceId !== null && typeof candidate.targetDeviceId !== 'string') {
    throw new ValidationError('targetDeviceId must be null or string', 'targetDeviceId');
  }

  if (typeof candidate.timestamp !== 'number' || Number.isNaN(candidate.timestamp) || candidate.timestamp <= 0) {
    throw new ValidationError('timestamp must be a positive integer', 'timestamp');
  }

  if (!VALID_MESSAGE_TYPES[candidate.type as MessageType]) {
    throw new ValidationError(`Invalid message type: "${candidate.type}"`, 'type');
  }

  if (candidate.payload === undefined) {
    throw new ValidationError('payload cannot be undefined', 'payload');
  }

  return true;
}

export function serializeProtocolMessage(message: BaseProtocolMessage<unknown>): string {
  validateProtocolEnvelope(message);
  return JSON.stringify(message);
}

export function deserializeProtocolMessage(rawJson: string): ProtocolMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new ValidationError(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
  }

  validateProtocolEnvelope(parsed);
  return parsed as ProtocolMessage;
}
