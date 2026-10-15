import { describe, expect, it } from 'bun:test';
import { BlobStore, NodeSqliteDriver } from '../src/index.js';

describe('BlobStore (Content-Addressable Storage)', () => {
  function createStore(): BlobStore {
    const driver = new NodeSqliteDriver(':memory:');
    return new BlobStore(driver);
  }

  it('saves and retrieves binary blob by SHA-256 hash', () => {
    const store = createStore();
    const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

    const meta = store.saveBlob(fakeImageBuffer, 'image/png', 'screenshot.png');
    expect(meta.hash).toBeDefined();
    expect(meta.hash.length).toBe(64);
    expect(meta.sizeBytes).toBe(8);
    expect(meta.mimeType).toBe('image/png');
    expect(meta.fileName).toBe('screenshot.png');

    const retrieved = store.getBlob(meta.hash);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.data).toEqual(fakeImageBuffer);
    expect(retrieved?.mimeType).toBe('image/png');
    expect(retrieved?.fileName).toBe('screenshot.png');
  });

  it('deduplicates identical blobs with identical content-addressable hash', () => {
    const store = createStore();
    const data = Buffer.from('Duplicate content to store twice');

    const meta1 = store.saveBlob(data, 'text/plain', 'doc1.txt');
    const meta2 = store.saveBlob(data, 'text/plain', 'doc2.txt');

    expect(meta1.hash).toBe(meta2.hash);
    expect(store.listBlobs()).toHaveLength(1);
    expect(store.getTotalStorageBytes()).toBe(data.length);
  });

  it('lists, deletes, and calculates total storage bytes', () => {
    const store = createStore();
    const buf1 = Buffer.alloc(100, 1);
    const buf2 = Buffer.alloc(250, 2);

    const m1 = store.saveBlob(buf1, 'application/octet-stream');
    const m2 = store.saveBlob(buf2, 'application/octet-stream');

    expect(store.getTotalStorageBytes()).toBe(350);
    expect(store.listBlobs()).toHaveLength(2);

    const deleted = store.deleteBlob(m1.hash);
    expect(deleted).toBe(true);
    expect(store.hasBlob(m1.hash)).toBe(false);
    expect(store.hasBlob(m2.hash)).toBe(true);
    expect(store.getTotalStorageBytes()).toBe(250);
  });
});
