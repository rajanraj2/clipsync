import { describe, expect, it } from 'bun:test';
import { ClipboardItem, HistoryPolicy } from '@clipsync/shared-types';
import { HistoryStore, NodeSqliteDriver } from '../src/index.js';

describe('HistoryStore Retention Enforcement', () => {
  function createStore(): HistoryStore {
    const driver = new NodeSqliteDriver(':memory:');
    return new HistoryStore(driver);
  }

  const baseItem: ClipboardItem = {
    id: 'c1',
    sourceDeviceId: 'dev-1',
    contentType: 'text',
    content: 'Lorem ipsum content',
    sizeBytes: 50,
    hash: 'h1',
    isPinned: false,
    isFavourite: false,
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('prunes expired items based on retentionDays', () => {
    const store = createStore();
    const now = 100_000_000;
    const dayMs = 86_400_000;

    // Fresh item (2 days old)
    store.saveItem({
      ...baseItem,
      id: 'fresh',
      hash: 'h-fresh',
      createdAt: now - 2 * dayMs,
      updatedAt: now - 2 * dayMs,
    });

    // Expired item (45 days old)
    store.saveItem({
      ...baseItem,
      id: 'expired',
      hash: 'h-expired',
      createdAt: now - 45 * dayMs,
      updatedAt: now - 45 * dayMs,
    });

    const policy: HistoryPolicy = {
      id: 'pol-30',
      retentionDays: 30,
      unlimitedRetention: false,
      maxItems: 1000,
      maxStorageBytes: 100_000,
      cleanupEnabled: true,
      updatedAt: now,
    };

    const pruneResult = store.enforceRetention(policy, { currentTimeMs: now });

    expect(pruneResult.itemsToPrune.map((i) => i.id)).toEqual(['expired']);
    expect(pruneResult.itemsToKeep.map((i) => i.id)).toEqual(['fresh']);

    // Check database state after pruning
    expect(store.getItem('expired')).toBeNull();
    expect(store.getItem('fresh')).not.toBeNull();
  });

  it('exempts pinned items from age-based cleanup', () => {
    const store = createStore();
    const now = 100_000_000;
    const dayMs = 86_400_000;

    store.saveItem({
      ...baseItem,
      id: 'pinned-old',
      hash: 'h-pinned',
      isPinned: true,
      createdAt: now - 100 * dayMs,
      updatedAt: now - 100 * dayMs,
    });

    const policy: HistoryPolicy = {
      id: 'pol-30',
      retentionDays: 30,
      unlimitedRetention: false,
      maxItems: 1000,
      maxStorageBytes: 100_000,
      cleanupEnabled: true,
      updatedAt: now,
    };

    const pruneResult = store.enforceRetention(policy, { currentTimeMs: now });
    expect(pruneResult.itemsToPrune).toHaveLength(0);
    expect(store.getItem('pinned-old')).not.toBeNull();
  });

  it('enforces storage bytes ceiling even when unlimited retention is configured', () => {
    const store = createStore();

    store.saveItem({
      ...baseItem,
      id: 'item-newer',
      hash: 'h-newer',
      sizeBytes: 400,
      createdAt: 2000,
      updatedAt: 2000,
    });

    store.saveItem({
      ...baseItem,
      id: 'item-older',
      hash: 'h-older',
      sizeBytes: 400,
      createdAt: 1000,
      updatedAt: 1000,
    });

    const unlimitedPolicyWithCeiling: HistoryPolicy = {
      id: 'pol-unlimited',
      retentionDays: null,
      unlimitedRetention: true,
      maxItems: 1000,
      maxStorageBytes: 500, // Total 800 > 500 ceiling
      cleanupEnabled: true,
      updatedAt: Date.now(),
    };

    const pruneResult = store.enforceRetention(unlimitedPolicyWithCeiling);

    // Oldest item pruned to fit within 500 bytes
    expect(pruneResult.itemsToPrune.map((i) => i.id)).toEqual(['item-older']);
    expect(pruneResult.itemsToKeep.map((i) => i.id)).toEqual(['item-newer']);
    expect(store.getItem('item-older')).toBeNull();
    expect(store.getItem('item-newer')).not.toBeNull();
  });
});
