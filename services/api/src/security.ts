export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
}

interface ClientTracker {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly clients = new Map<string, ClientTracker>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000; // 1 minute window
    this.maxRequests = options.maxRequests ?? 200; // 200 requests / minute default
  }

  public check(clientId: string): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    let tracker = this.clients.get(clientId);

    if (!tracker || now > tracker.resetAt) {
      tracker = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      this.clients.set(clientId, tracker);
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetInMs: this.windowMs,
      };
    }

    tracker.count += 1;
    const remaining = Math.max(0, this.maxRequests - tracker.count);
    const resetInMs = Math.max(0, tracker.resetAt - now);

    return {
      allowed: tracker.count <= this.maxRequests,
      remaining,
      resetInMs,
    };
  }

  public reset(): void {
    this.clients.clear();
  }
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:;",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Validates binary magic byte headers against declared MIME types to prevent polyglot attacks.
 */
export function validateFileMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
  if (buffer.length < 4) {
    return false;
  }

  // PNG: 89 50 4E 47
  if (declaredMimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // JPEG: FF D8 FF
  if (declaredMimeType === 'image/jpeg' || declaredMimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // GIF: 47 49 46 38
  if (declaredMimeType === 'image/gif') {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  }

  // PDF: 25 50 44 46 (%PDF)
  if (declaredMimeType === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  return true; // Unknown or binary payload allows pass-through
}

/**
 * Redacts any clipboard payloads or sensitive credentials from logging.
 */
export function maskSensitiveLog(rawMessage: string): string {
  return rawMessage
    .replace(/(?:Bearer\s+)[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'Bearer [REDACTED_JWT]')
    .replace(/(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]')
    .replace(/ghp_[A-Za-z0-9_]{36}/g, 'ghp_[REDACTED_GITHUB_TOKEN]')
    .replace(/-----BEGIN[A-Z\s_-]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s_-]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
}
