import { createHash } from 'node:crypto';
import type { ContentType } from '@clipsync/shared-types';
import { ValidationError } from './errors.js';

export interface NormalizedContentResult {
  normalized: string;
  hash: string;
  sizeBytes: number;
  contentType: ContentType;
}

export function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function normalizeContent(
  rawContent: string,
  contentType: ContentType
): NormalizedContentResult {
  if (typeof rawContent !== 'string') {
    throw new ValidationError('Content must be a string', 'content');
  }

  let normalized = rawContent;

  if (contentType === 'text') {
    // Normalize newlines to standard LF for cross-platform consistency
    normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  } else if (contentType === 'url') {
    const trimmed = rawContent.trim();
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) {
        throw new Error('Unsupported URL protocol');
      }
      normalized = parsed.toString();
    } catch {
      throw new ValidationError(`Invalid URL format: "${trimmed}"`, 'content');
    }
  }

  const sizeBytes = Buffer.byteLength(normalized, 'utf8');
  const hash = computeSha256(normalized);

  return {
    normalized,
    hash,
    sizeBytes,
    contentType,
  };
}
