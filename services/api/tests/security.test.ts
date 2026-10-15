import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ClipSyncApiServer, maskSensitiveLog, RateLimiter, validateFileMagicBytes } from '../src/index.js';

describe('API Security Hardening & Rate Limiting', () => {
  let server: ClipSyncApiServer;
  const testPort = 4831;

  beforeAll(async () => {
    server = new ClipSyncApiServer({
      port: testPort,
      dbPath: ':memory:',
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('includes security headers in HTTP responses', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/health`);
    expect(res.headers.get('content-security-policy')).toBeDefined();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('enforces rate limiting against abusive request floods', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 10_000 });
    const clientId = 'abusive-bot-123';

    for (let i = 0; i < 5; i++) {
      const check = limiter.check(clientId);
      expect(check.allowed).toBe(true);
    }

    // 6th request is blocked
    const blockedCheck = limiter.check(clientId);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.remaining).toBe(0);
    expect(blockedCheck.resetInMs).toBeGreaterThan(0);
  });

  it('validates binary magic bytes to reject fraudulent file extensions', () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
    expect(validateFileMagicBytes(validPng, 'image/png')).toBe(true);

    const fraudulentPng = Buffer.from('<?php echo "malicious payload"; ?>');
    expect(validateFileMagicBytes(fraudulentPng, 'image/png')).toBe(false);

    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateFileMagicBytes(validJpeg, 'image/jpeg')).toBe(true);
  });

  it('blocks upload of fraudulent file disguised with fake MIME type', async () => {
    const fakeFile = Buffer.from('Text masquerading as image');

    const res = await fetch(`http://localhost:${testPort}/api/v1/blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
      },
      body: new Uint8Array(fakeFile),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('File signature mismatch');
  });

  it('permits upload of legitimate binary image matching magic bytes', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

    const res = await fetch(`http://localhost:${testPort}/api/v1/blobs?filename=icon.png`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
      },
      body: new Uint8Array(validPng),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { hash: string; mimeType: string };
    expect(body.hash).toBeDefined();
    expect(body.mimeType).toBe('image/png');
  });

  it('redacts sensitive credentials and tokens in application logs', () => {
    const rawLog = 'User authentication failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoxfQ.mockSign and key AKIAIOSFODNN7EXAMPLE';
    const masked = maskSensitiveLog(rawLog);

    expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(masked).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(masked).toContain('[REDACTED_JWT]');
    expect(masked).toContain('[REDACTED_AWS_KEY]');
  });
});
