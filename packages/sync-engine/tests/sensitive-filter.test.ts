import { describe, expect, it } from 'bun:test';
import { inspectSensitiveContent } from '../src/index.js';
import { RawClipboardData } from '../src/types.js';

describe('Sensitive Content & Privacy Filter', () => {
  it('filters content marked with isConcealed flag', () => {
    const data: RawClipboardData = {
      content: 'super-secret-password-123',
      contentType: 'text',
      isConcealed: true,
    };

    const result = inspectSensitiveContent(data);
    expect(result.isSensitive).toBe(true);
    expect(result.reason).toContain('Concealed by password manager flag');
  });

  it('filters content copied from known password managers', () => {
    const apps = ['1Password', 'Bitwarden', 'KeePassXC', 'LastPass', 'Dashlane'];

    for (const app of apps) {
      const data: RawClipboardData = {
        content: 'mypassword',
        contentType: 'text',
        sourceApp: app,
      };

      const result = inspectSensitiveContent(data);
      expect(result.isSensitive).toBe(true);
      expect(result.reason).toContain('Ignored from password manager application');
    }
  });

  it('detects and filters PEM / RSA private keys', () => {
    const pemKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y7...
-----END RSA PRIVATE KEY-----`;

    const data: RawClipboardData = {
      content: pemKey,
      contentType: 'text',
    };

    const result = inspectSensitiveContent(data);
    expect(result.isSensitive).toBe(true);
    expect(result.reason).toContain('Private Key');
  });

  it('detects and filters JWT / Bearer authentication tokens', () => {
    const jwt = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    const data: RawClipboardData = {
      content: jwt,
      contentType: 'text',
    };

    const result = inspectSensitiveContent(data);
    expect(result.isSensitive).toBe(true);
    expect(result.reason).toContain('JWT / Bearer Token');
  });

  it('detects and filters AWS access keys', () => {
    const data: RawClipboardData = {
      content: 'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
      contentType: 'text',
    };

    const result = inspectSensitiveContent(data);
    expect(result.isSensitive).toBe(true);
    expect(result.reason).toContain('AWS Access Key');
  });

  it('detects and filters GitHub Personal Access Tokens', () => {
    const data: RawClipboardData = {
      content: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      contentType: 'text',
    };

    const result = inspectSensitiveContent(data);
    expect(result.isSensitive).toBe(true);
    expect(result.reason).toContain('GitHub Token');
  });

  it('permits standard text and links', () => {
    const safeItems: RawClipboardData[] = [
      { content: 'Hello, this is a normal message to paste!', contentType: 'text' },
      { content: 'https://clipsync.dev/docs/architecture', contentType: 'url' },
      { content: 'const a = 10; const b = 20; return a + b;', contentType: 'text' },
    ];

    for (const item of safeItems) {
      const result = inspectSensitiveContent(item);
      expect(result.isSensitive).toBe(false);
      expect(result.reason).toBeUndefined();
    }
  });

  it('respects configuration override to allow password managers when disabled', () => {
    const data: RawClipboardData = {
      content: 'secret-token',
      contentType: 'text',
      isConcealed: true,
      sourceApp: '1Password',
    };

    const result = inspectSensitiveContent(data, {
      ignorePasswordManagers: false,
      ignoreAuthTokens: false,
    });

    expect(result.isSensitive).toBe(false);
  });
});
