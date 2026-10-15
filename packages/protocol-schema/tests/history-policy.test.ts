import { describe, expect, it } from 'bun:test';
import { ClipboardItem, HistoryPolicy } from '@clipsync/shared-types';
import {
  evaluateHistoryPruning,
  validateHistoryPolicy,
  ValidationError,
} from '../src/index.js';

describe('History Policy & Retention Engine', () => {
  const basePolicy: HistoryPolicy = {
    id: 'pol-1',
    retentionDays: 30,
    unlimitedRetention: false,
    maxItems: 100,
    maxStorageBytes: 10_000,
    cleanupEnabled: true,
    updatedAt: Date.now(),
  };

  it('rejects ambiguous retentionDays of 0', () => {
    const invalidPolicy: HistoryPolicy = {
      ...basePolicy,
      retentionDays: 0,
    };

    expect(() => validateHistoryPolicy(invalidPolicy)).toThrow(ValidationError);
  });

  it('rejects unlimitedRetention: true when retentionDays is not null', () => {
    const invalidPolicy: HistoryPolicy = {
      ...basePolicy,
      unlimitedRetention: true,
      retentionDays: 14,
    };

    expect(() => validateHistoryPolicy(invalidPolicy)).toThrow(ValidationError);
  });

  it('validates unlimitedRetention: true with retentionDays: null', () => {
    const validPolicy: HistoryPolicy = {
      ...basePolicy,
      unlimitedRetention: true,
      retentionDays: null,
    };

    expect(() => validateHistoryPolicy(validPolicy)).not.toThrow();
  });

  it('prunes items older than retentionDays', () => {
    const now = 1_000_000_000;
    const oneDayMs = 24 * 60 * 60 * 1000;

    const freshItem: ClipboardItem = {
      id: 'item-fresh',
      sourceDeviceId: 'dev-1',
      contentType: 'text',
      content: 'Fresh item',
      sizeBytes: 10,
      hash: 'hash-1',
      isPinned: false,
      isFavourite: false,
      createdAt: now - 5 * oneDayMs, // 5 days old
      updatedAt: now - 5 * oneDayMs,
    };

    const expiredItem: ClipboardItem = {
      id: 'item-expired',
      sourceDeviceId: 'dev-1',
      contentType: 'text',
      content: 'Expired item',
      sizeBytes: 12,
      hash: 'hash-2',
      isPinned: false,
      isFavourite: false,
      createdAt: now - 35 * oneDayMs, // 35 days old (retention is 30)
      updatedAt: now - 35 * oneDayMs,
    };

    const result = evaluateHistoryPruning([freshItem, expiredItem], basePolicy, {
      currentTimeMs: now,
    });

    expect(result.itemsToKeep.map((i) => i.id)).toEqual(['item-fresh']);
    expect(result.itemsToPrune.map((i) => i.id)).toEqual(['item-expired']);
    expect(result.reasons.expiredByAge).toBe(1);
  });

  it('protects pinned items from age-based expiration', () => {
    const now = 1_000_000_000;
    const oneDayMs = 24 * 60 * 60 * 1000;

    const pinnedOldItem: ClipboardItem = {
      id: 'item-pinned',
      sourceDeviceId: 'dev-1',
      contentType: 'text',
      content: 'Pinned secret',
      sizeBytes: 13,
      hash: 'hash-pinned',
      isPinned: true,
      isFavourite: true,
      createdAt: now - 60 * oneDayMs, // 60 days old
      updatedAt: now - 60 * oneDayMs,
    };

    const result = evaluateHistoryPruning([pinnedOldItem], basePolicy, {
      currentTimeMs: now,
      exemptPinnedItems: true,
    });

    expect(result.itemsToKeep.map((i) => i.id)).toEqual(['item-pinned']);
    expect(result.itemsToPrune).toHaveLength(0);
  });

  it('enforces storage bytes ceiling even when retention is unlimited', () => {
    const unlimitedPolicy: HistoryPolicy = {
      ...basePolicy,
      unlimitedRetention: true,
      retentionDays: null,
      maxStorageBytes: 50, // 50 bytes ceiling
      maxItems: 1000,
    };

    const item1: ClipboardItem = {
      id: 'item-1',
      sourceDeviceId: 'dev-1',
      contentType: 'text',
      content: '1234567890',
      sizeBytes: 30,
      hash: 'h1',
      isPinned: false,
      isFavourite: false,
      createdAt: 200,
      updatedAt: 200,
    };

    const item2: ClipboardItem = {
      id: 'item-2',
      sourceDeviceId: 'dev-1',
      contentType: 'text',
      content: '1234567890',
      sizeBytes: 30, // 30 + 30 = 60 > 50
      hash: 'h2',
      isPinned: false,
      isFavourite: false,
      createdAt: 100, // Older
      updatedAt: 100,
    };

    const result = evaluateHistoryPruning([item1, item2], unlimitedPolicy);

    expect(result.itemsToKeep.map((i) => i.id)).toEqual(['item-1']);
    expect(result.itemsToPrune.map((i) => i.id)).toEqual(['item-2']);
    expect(result.reasons.exceededStorageBytes).toBe(1);
  });
});
