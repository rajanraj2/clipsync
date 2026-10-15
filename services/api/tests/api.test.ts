import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ClipSyncApiClient } from '@clipsync/api-client';
import { ClipSyncApiServer } from '../src/index.js';

describe('ClipSync API Service & Client SDK', () => {
  let server: ClipSyncApiServer;
  let client: ClipSyncApiClient;
  const testPort = 4829;

  beforeAll(async () => {
    server = new ClipSyncApiServer({
      port: testPort,
      dbPath: ':memory:',
    });
    await server.start();
    client = new ClipSyncApiClient(`http://localhost:${testPort}`);
  });

  afterAll(async () => {
    await server.stop();
  });

  it('responds to health check', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe('ok');
    expect(body.version).toBe('2.0.0');
  });

  it('manages device pairing and lifecycle', async () => {
    // Pair device
    const paired = await client.devices.pair({
      id: 'mac-test-1',
      name: 'MacBook Pro M3',
      platform: 'macos',
      appVersion: '0.1.0',
    });
    expect(paired.id).toBe('mac-test-1');
    expect(paired.platform).toBe('macos');
    expect(paired.status).toBe('online');

    // List devices
    const devices = await client.devices.list();
    expect(devices.some((d) => d.id === 'mac-test-1')).toBe(true);

    // Get device
    const fetched = await client.devices.get('mac-test-1');
    expect(fetched.name).toBe('MacBook Pro M3');

    // Update device
    const updated = await client.devices.update('mac-test-1', { name: 'Work Mac' });
    expect(updated.name).toBe('Work Mac');

    // Revoke device
    const revoked = await client.devices.revoke('mac-test-1');
    expect(revoked.success).toBe(true);
  });

  it('manages clipboard history, search, and pagination', async () => {
    // Save items
    const item1 = await client.history.save({
      content: 'https://clipsync.dev',
      contentType: 'url',
    });
    expect(item1.contentType).toBe('url');

    const item2 = await client.history.save({
      content: 'SELECT * FROM clipboard_items',
      contentType: 'text',
    });
    expect(item2.contentType).toBe('text');

    // Query items
    const all = await client.history.query();
    expect(all.totalCount).toBeGreaterThanOrEqual(2);

    // Search
    const searchResult = await client.history.query({ q: 'SELECT' });
    expect(searchResult.items.some((i) => i.id === item2.id)).toBe(true);

    // Filter by type
    const urlResult = await client.history.query({ type: 'url' });
    expect(urlResult.items.every((i) => i.contentType === 'url')).toBe(true);

    // Pin and Favourite
    const pinned = await client.history.setPinned(item1.id, true);
    expect(pinned.isPinned).toBe(true);

    const faved = await client.history.setFavourite(item1.id, true);
    expect(faved.isFavourite).toBe(true);

    // Stats
    const stats = await client.history.getStats();
    expect(stats.totalItems).toBeGreaterThanOrEqual(2);
    expect(stats.pinnedItems).toBeGreaterThanOrEqual(1);

    // Delete
    const deleted = await client.history.delete(item2.id);
    expect(deleted.success).toBe(true);
  });

  it('manages configuration and history policy', async () => {
    // Setting definitions
    const defs = await client.settings.getDefinitions();
    expect(defs.length).toBeGreaterThan(5);

    // User settings
    await client.settings.update({ 'sync.automatic': false, 'app.theme': 'dark' });
    const settings = await client.settings.get();
    expect(settings['sync.automatic']).toBe(false);
    expect(settings['app.theme']).toBe('dark');

    // History policy
    const policy = await client.settings.getHistoryPolicy();
    expect(policy.retentionDays).toBe(30);

    const updatedPolicy = await client.settings.updateHistoryPolicy({
      retentionDays: 14,
      maxItems: 2500,
    });
    expect(updatedPolicy.retentionDays).toBe(14);
    expect(updatedPolicy.maxItems).toBe(2500);
  });

  it('manages clipboard status, pause, and send', async () => {
    const status = await client.clipboard.getStatus();
    expect(status.isPaused).toBe(false);

    const paused = await client.clipboard.pause();
    expect(paused.isPaused).toBe(true);

    const resumed = await client.clipboard.resume();
    expect(resumed.isPaused).toBe(false);

    const sent = await client.clipboard.send('Dispatched from web client');
    expect(sent.success).toBe(true);
    expect(sent.item.content).toBe('Dispatched from web client');
  });

  it('manages quick share and file transfer tracking', async () => {
    const transfer = await client.transfers.share({
      targetDeviceIds: ['device-mac'],
      fileName: 'specs.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
    });

    expect(transfer.fileName).toBe('specs.pdf');
    expect(transfer.status).toBe('pending');

    const list = await client.transfers.list();
    expect(list.some((t) => t.id === transfer.id)).toBe(true);

    const cancelled = await client.transfers.cancel(transfer.id);
    expect(cancelled.status).toBe('cancelled');
  });
});
