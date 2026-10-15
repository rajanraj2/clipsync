import { describe, expect, it } from 'bun:test';
import {
  decryptPayload,
  deriveKey,
  encryptPayload,
  ProtocolError,
} from '../src/index.js';

describe('AEAD Cryptography (AES-256-GCM & HKDF)', () => {
  const secret = 'shared-device-pairing-secret-key-12345';
  const salt = 'clipsync-unique-cluster-salt';
  const key = deriveKey(secret, salt, 'clipsync-test-key');

  it('derives consistent 32-byte (256-bit) key from shared secret', () => {
    expect(key.length).toBe(32);

    // Same inputs produce identical derived key
    const key2 = deriveKey(secret, salt, 'clipsync-test-key');
    expect(key.equals(key2)).toBe(true);

    // Different salt produces distinct key
    const keyDiff = deriveKey(secret, 'different-salt', 'clipsync-test-key');
    expect(key.equals(keyDiff)).toBe(false);
  });

  it('encrypts and decrypts payload roundtrip correctly', () => {
    const sensitivePayload = JSON.stringify({
      secretNote: 'Confidential corporate credentials',
      token: 'my-super-secret-passphrase',
      timestamp: 1234567890,
    });

    const envelope = encryptPayload(sensitivePayload, key, 'authenticated-metadata-dev-1');
    expect(envelope.algorithm).toBe('AES-256-GCM');
    expect(envelope.iv).toBeDefined();
    expect(envelope.authTag).toBeDefined();
    expect(envelope.ciphertext).not.toContain('Confidential corporate credentials');

    const decrypted = decryptPayload(envelope, key, 'authenticated-metadata-dev-1');
    expect(decrypted).toBe(sensitivePayload);
  });

  it('detects and rejects tampered ciphertext', () => {
    const envelope = encryptPayload('Hello World', key);

    // Tamper with one character of the hex ciphertext
    const tamperedHex = envelope.ciphertext.slice(0, -2) + (envelope.ciphertext.endsWith('00') ? 'ff' : '00');
    const tamperedEnvelope = {
      ...envelope,
      ciphertext: tamperedHex,
    };

    expect(() => decryptPayload(tamperedEnvelope, key)).toThrow(ProtocolError);
  });

  it('detects and rejects tampered authentication tag', () => {
    const envelope = encryptPayload('Hello World', key);

    // Tamper with authentication tag
    const tamperedTag = envelope.authTag.slice(0, -2) + (envelope.authTag.endsWith('00') ? 'ff' : '00');
    const tamperedEnvelope = {
      ...envelope,
      authTag: tamperedTag,
    };

    expect(() => decryptPayload(tamperedEnvelope, key)).toThrow(ProtocolError);
  });

  it('detects and rejects tampered associated data (AAD)', () => {
    const envelope = encryptPayload('Hello World', key, 'original-associated-data');

    // Attempting decryption with different or modified AAD fails authentication
    expect(() => decryptPayload(envelope, key, 'tampered-associated-data')).toThrow(ProtocolError);
    expect(() => decryptPayload(envelope, key)).toThrow(ProtocolError);
  });

  it('rejects keys that do not meet 256-bit requirement', () => {
    const shortKey = Buffer.alloc(16); // Only 128-bit
    expect(() => encryptPayload('Test', shortKey)).toThrow(ProtocolError);
  });
});
