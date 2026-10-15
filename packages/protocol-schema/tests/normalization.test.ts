import { describe, expect, it } from 'bun:test';
import {
  computeSha256,
  normalizeContent,
  ValidationError,
} from '../src/index.js';

describe('Content Normalization & Hashing', () => {
  it('normalizes CRLF and CR to LF for text', () => {
    const raw = 'Line 1\r\nLine 2\rLine 3\n';
    const result = normalizeContent(raw, 'text');

    expect(result.normalized).toBe('Line 1\nLine 2\nLine 3\n');
    expect(result.sizeBytes).toBe(Buffer.byteLength(result.normalized, 'utf8'));
    expect(result.hash).toBe(computeSha256(result.normalized));
  });

  it('normalizes and validates valid URLs', () => {
    const raw = '   https://clipsync.dev/dashboard/settings?tab=sync   ';
    const result = normalizeContent(raw, 'url');

    expect(result.normalized).toBe('https://clipsync.dev/dashboard/settings?tab=sync');
    expect(result.contentType).toBe('url');
  });

  it('rejects invalid or unsupported URL protocols', () => {
    expect(() => normalizeContent('javascript:alert(1)', 'url')).toThrow(ValidationError);
    expect(() => normalizeContent('not a valid url', 'url')).toThrow(ValidationError);
  });

  it('computes identical SHA-256 hashes for identical normalized text', () => {
    const res1 = normalizeContent('Hello World\r\n', 'text');
    const res2 = normalizeContent('Hello World\n', 'text');

    expect(res1.hash).toBe(res2.hash);
  });
});
