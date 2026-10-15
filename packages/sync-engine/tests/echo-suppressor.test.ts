import { describe, expect, it } from 'bun:test';
import { EchoSuppressor } from '../src/index.js';

describe('Echo Suppressor & Loop Prevention', () => {
  it('suppresses change event matching a recent programmatic local write', () => {
    const suppressor = new EchoSuppressor(2000);
    const hash = 'a1b2c3d4e5f6';
    const writeTime = 1000;

    suppressor.recordLocalWrite(hash, writeTime);

    // Incoming change event within suppression window (500ms later)
    const isEcho = suppressor.isEchoAndConsume(hash, writeTime + 500);
    expect(isEcho).toBe(true);

    // Second event for the same hash is not suppressed because token was consumed
    const secondEvent = suppressor.isEchoAndConsume(hash, writeTime + 600);
    expect(secondEvent).toBe(false);
  });

  it('does not suppress event if outside the suppression window', () => {
    const suppressor = new EchoSuppressor(1500);
    const hash = 'hash-outside-window';
    const writeTime = 1000;

    suppressor.recordLocalWrite(hash, writeTime);

    // Arrives 2000ms later (> 1500ms window)
    const isEcho = suppressor.isEchoAndConsume(hash, writeTime + 2000);
    expect(isEcho).toBe(false);
  });

  it('tracks last sent hash to avoid transmitting consecutive duplicates', () => {
    const suppressor = new EchoSuppressor();
    const hash = 'dup-hash-123';

    expect(suppressor.isDuplicateOfLastSent(hash)).toBe(false);

    suppressor.recordSent(hash);
    expect(suppressor.isDuplicateOfLastSent(hash)).toBe(true);

    // Different hash is not a duplicate
    expect(suppressor.isDuplicateOfLastSent('other-hash')).toBe(false);
  });
});
