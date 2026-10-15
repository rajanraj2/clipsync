import { describe, expect, it } from 'bun:test';
import {
  createProtocolMessage,
  deserializeProtocolMessage,
  serializeProtocolMessage,
  validateProtocolEnvelope,
  ValidationError,
  VersionMismatchError,
} from '../src/index.js';

describe('Protocol Envelope', () => {
  it('creates valid protocol envelope with defaults', () => {
    const msg = createProtocolMessage({
      type: 'clipboard_sync',
      senderDeviceId: 'dev-mac-1',
      payload: { test: 123 },
    });

    expect(msg.protocolVersion).toBe('2.0');
    expect(msg.senderDeviceId).toBe('dev-mac-1');
    expect(msg.targetDeviceId).toBeNull();
    expect(typeof msg.messageId).toBe('string');
    expect(msg.messageId.length).toBeGreaterThan(0);
    expect(msg.type).toBe('clipboard_sync');
    expect(msg.payload).toEqual({ test: 123 });
  });

  it('rejects empty or whitespace senderDeviceId', () => {
    expect(() => {
      createProtocolMessage({
        type: 'clipboard_sync',
        senderDeviceId: '   ',
        payload: {},
      });
    }).toThrow(ValidationError);
  });

  it('rejects unknown message type', () => {
    expect(() => {
      createProtocolMessage({
        type: 'invalid_type' as unknown as 'ping',
        senderDeviceId: 'dev-1',
        payload: {},
      });
    }).toThrow(ValidationError);
  });

  it('serializes and deserializes message roundtrip correctly', () => {
    const original = createProtocolMessage<{ echo: number }>({
      type: 'ping',
      senderDeviceId: 'dev-sender',
      targetDeviceId: 'dev-receiver',
      payload: { echo: 42 },
    });

    const json = serializeProtocolMessage(original);
    const deserialized = deserializeProtocolMessage(json);

    expect(deserialized).toEqual(original);
  });

  it('rejects mismatched protocol versions', () => {
    const invalidMsg = {
      protocolVersion: '1.0',
      messageId: 'msg-1',
      senderDeviceId: 'dev-1',
      targetDeviceId: null,
      timestamp: Date.now(),
      type: 'ping',
      payload: {},
    };

    expect(() => validateProtocolEnvelope(invalidMsg)).toThrow(VersionMismatchError);
  });

  it('rejects non-object or malformed JSON payloads', () => {
    expect(() => deserializeProtocolMessage('not valid json')).toThrow(ValidationError);
    expect(() => validateProtocolEnvelope(null)).toThrow(ValidationError);
    expect(() => validateProtocolEnvelope('string')).toThrow(ValidationError);
  });
});
