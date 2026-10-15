import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { ProtocolError } from './errors.js';

export interface EncryptedPayloadEnvelope {
  /** Hex-encoded ciphertext */
  ciphertext: string;
  /** 12-byte hex-encoded initialization vector */
  iv: string;
  /** 16-byte hex-encoded GCM authentication tag */
  authTag: string;
  /** Algorithm identifier */
  algorithm: 'AES-256-GCM';
}

/**
 * Derives a cryptographic 256-bit key from a shared secret using HKDF-SHA256.
 */
export function deriveKey(
  secret: string | Buffer,
  salt: string | Buffer,
  info: string = 'clipsync-payload-encryption'
): Buffer {
  const secretBuf = Buffer.isBuffer(secret) ? secret : Buffer.from(secret, 'utf8');
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'utf8');
  const infoBuf = Buffer.from(info, 'utf8');

  const derived = hkdfSync('sha256', secretBuf, saltBuf, infoBuf, 32);
  return Buffer.from(derived);
}

/**
 * Encrypts data using AES-256-GCM Authenticated Encryption with Associated Data (AEAD).
 */
export function encryptPayload(
  plaintext: string | Buffer,
  key: Buffer,
  associatedData?: string
): EncryptedPayloadEnvelope {
  if (key.length !== 32) {
    throw new ProtocolError('AES-256-GCM requires a 32-byte (256-bit) encryption key');
  }

  const iv = randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }

  const plainBuf = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: 'AES-256-GCM',
  };
}

/**
 * Decrypts an AES-256-GCM payload and verifies the integrity authentication tag.
 * Throws a ProtocolError if ciphertext, IV, authTag, or associated data was altered.
 */
export function decryptPayload(
  envelope: EncryptedPayloadEnvelope,
  key: Buffer,
  associatedData?: string
): string {
  if (key.length !== 32) {
    throw new ProtocolError('AES-256-GCM requires a 32-byte (256-bit) encryption key');
  }

  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertext, 'hex');

  if (iv.length !== 12) {
    throw new ProtocolError('Invalid IV length: expected 12 bytes');
  }
  if (authTag.length !== 16) {
    throw new ProtocolError('Invalid AuthTag length: expected 16 bytes');
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    if (associatedData) {
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new ProtocolError(
      `Decryption authentication failed: payload tampered, corrupted, or incorrect key (${err instanceof Error ? err.message : String(err)})`,
      'DECRYPTION_AUTH_FAILED'
    );
  }
}
