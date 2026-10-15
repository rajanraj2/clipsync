import { describe, expect, it } from 'bun:test';
import { ClipboardItem } from '@clipsync/shared-types';
import { HistoryStore, NodeSqliteDriver } from '../src/index.js';

describe('HistoryStore (SQLite Persistence & Queries)', () => {
  function createStore(): HistoryStore {
    const driver = new NodeSqliteDriver(':memory:');
    return new HistoryStore(driver);
  }

  const sampleItem: ClipboardItem = {
    id: 'clip-1',
    sourceDeviceId: 'dev-mac',
    contentType: 'text',
    content: 'git commit -m "feat: initial commit"',
    sizeBytes: 37,
    hash: 'hash-abc-123',
    isPinned: false,
    isFavourite: false,
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
  };

  it('saves and retrieves a clipboard item', () => {
    const store = createStore();
    store.saveItem(sampleItem);

    const retrieved = store.getItem('clip-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('clip-1');
    expect(retrieved?.content).toBe(sampleItem.content);
    expect(retrieved?.hash).toBe(sampleItem.hash);
    expect(retrieved?.isPinned).toBe(false);
  });

  it('updates timestamp of existing duplicate item instead of inserting duplicate row', () => {
    const store = createStore();
    store.saveItem(sampleItem);

    const duplicateCopy: ClipboardItem = {
      ...sampleItem,
      id: 'clip-2-new-id',
      updatedAt: 2_000_000,
    };

    const saved = store.saveItem(duplicateCopy);
    expect(saved.id).toBe('clip-1'); // Reused existing ID
    expect(saved.updatedAt).toBe(2_000_000);

    const stats = store.getStats();
    expect(stats.totalItems).toBe(1);
  });

  it('pins and favourites an item', () => {
    const store = createStore();
    store.saveItem(sampleItem);

    const pinned = store.setPinned('clip-1', true);
    expect(pinned.isPinned).toBe(true);

    const faved = store.setFavourite('clip-1', true);
    expect(faved.isFavourite).toBe(true);

    const retrieved = store.getItem('clip-1');
    expect(retrieved?.isPinned).toBe(true);
    expect(retrieved?.isFavourite).toBe(true);
  });

  it('searches items by text query', () => {
    const store = createStore();
    store.saveItem({ ...sampleItem, id: '1', hash: 'h1', content: 'Docker compose up -d' });
    store.saveItem({ ...sampleItem, id: '2', hash: 'h2', content: 'Kubernetes ingress controller' });
    store.saveItem({ ...sampleItem, id: '3', hash: 'h3', content: 'Docker build -t my-app .' });

    const searchResult = store.query({ search: 'Docker' });
    expect(searchResult.totalCount).toBe(2);
    expect(searchResult.items.map((i) => i.id)).toEqual(['3', '1']);
  });

  it('filters by content type and source device', () => {
    const store = createStore();
    store.saveItem({ ...sampleItem, id: '1', hash: 'h1', contentType: 'text', sourceDeviceId: 'mac' });
    store.saveItem({ ...sampleItem, id: '2', hash: 'h2', contentType: 'url', content: 'https://clipsync.dev', sourceDeviceId: 'mac' });
    store.saveItem({ ...sampleItem, id: '3', hash: 'h3', contentType: 'text', sourceDeviceId: 'win' });

    const urlFilter = store.query({ contentType: 'url' });
    expect(urlFilter.totalCount).toBe(1);
    expect(urlFilter.items[0].id).toBe('2');

    const deviceFilter = store.query({ sourceDeviceId: 'win' });
    expect(deviceFilter.totalCount).toBe(1);
    expect(deviceFilter.items[0].id).toBe('3');
  });

  it('supports pagination with limits and cursors', () => {
    const store = createStore();
    for (let i = 1; i <= 5; i++) {
      store.saveItem({
        ...sampleItem,
        id: `clip-${i}`,
        hash: `hash-${i}`,
        content: `Entry ${i}`,
        createdAt: 1000 + i * 10,
        updatedAt: 1000 + i * 10,
      });
    }

    // First page: limit 2
    const page1 = store.query({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.totalCount).toBe(5);
    expect(page1.hasMore).toBe(true);
    expect(page1.items.map((i) => i.id)).toEqual(['clip-5', 'clip-4']);
    expect(page1.nextCursor).toBe('clip-4');

    // Second page using cursor
    const page2 = store.query({ limit: 2, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(2);
    expect(page2.items.map((i) => i.id)).toEqual(['clip-3', 'clip-2']);
    expect(page2.hasMore).toBe(true);

    // Third page
    const page3 = store.query({ limit: 2, cursor: page2.nextCursor });
    expect(page3.items).toHaveLength(1);
    expect(page3.items[0].id).toBe('clip-1');
    expect(page3.hasMore).toBe(false);
  });

  it('deletes single item and supports bulk delete', () => {
    const store = createStore();
    store.saveItem({ ...sampleItem, id: '1', hash: 'h1' });
    store.saveItem({ ...sampleItem, id: '2', hash: 'h2' });
    store.saveItem({ ...sampleItem, id: '3', hash: 'h3' });

    const deleted = store.deleteItem('1');
    expect(deleted).toBe(true);
    expect(store.getItem('1')).toBeNull();

    const bulkCount = store.bulkDelete(['2', '3']);
    expect(bulkCount).toBe(2);
    expect(store.getStats().totalItems).toBe(0);
  });

  it('calculates history statistics accurately', () => {
    const store = createStore();
    store.saveItem({ ...sampleItem, id: '1', hash: 'h1', sizeBytes: 100, isPinned: true, createdAt: 1000 });
    store.saveItem({ ...sampleItem, id: '2', hash: 'h2', sizeBytes: 250, isPinned: false, createdAt: 2000 });

    const stats = store.getStats();
    expect(stats.totalItems).toBe(2);
    expect(stats.totalSizeBytes).toBe(350);
    expect(stats.pinnedItems).toBe(1);
    expect(stats.oldestItemTimestamp).toBe(1000);
    expect(stats.newestItemTimestamp).toBe(2000);
  });
});
