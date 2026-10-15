import { randomUUID } from 'node:crypto';
import {
  ClipboardItem,
  ContentType,
  HistoryPolicy,
} from '@clipsync/shared-types';
import {
  normalizeContent,
  SETTING_DEFINITIONS,
} from '@clipsync/protocol-schema';
import { BlobStore, HistoryStore, SettingsStore } from '@clipsync/storage';
import { DeviceRegistry } from './device-registry.js';
import { TransferManager } from './transfer-manager.js';

export interface ApiServerContext {
  historyStore: HistoryStore;
  settingsStore: SettingsStore;
  deviceRegistry: DeviceRegistry;
  transferManager: TransferManager;
  blobStore: BlobStore;
  defaultUserId?: string;
}

export class ApiRouter {
  private isSyncPaused = false;
  private readonly userId: string;

  constructor(private readonly ctx: ApiServerContext) {
    this.userId = ctx.defaultUserId ?? 'default-user';
  }

  public async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // CORS headers for Web App dashboard
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 1. Health
      if (path === '/api/v1/health' && method === 'GET') {
        return this.json({ status: 'ok', timestamp: Date.now(), version: '2.0.0' }, 200, corsHeaders);
      }

      // 2. Devices
      if (path === '/api/v1/devices' && method === 'GET') {
        return this.json(this.ctx.deviceRegistry.getAllDevices(), 200, corsHeaders);
      }

      if (path === '/api/v1/devices/pair' && method === 'POST') {
        const body = (await req.json()) as {
          id: string;
          name: string;
          platform: 'macos' | 'windows' | 'linux' | 'android' | 'web';
          appVersion: string;
        };
        const paired = this.ctx.deviceRegistry.registerOrPairDevice(body);
        return this.json(paired, 201, corsHeaders);
      }

      const deviceIdMatch = path.match(/^\/api\/v1\/devices\/([^/]+)$/);
      if (deviceIdMatch) {
        const deviceId = deviceIdMatch[1];
        if (method === 'GET') {
          const dev = this.ctx.deviceRegistry.getDevice(deviceId);
          return dev ? this.json(dev, 200, corsHeaders) : this.notFound('Device not found', corsHeaders);
        }
        if (method === 'PATCH') {
          const body = (await req.json()) as { name?: string; status?: 'online' | 'offline'; trustLevel?: 'pending' | 'paired' | 'revoked' };
          const updated = this.ctx.deviceRegistry.updateDevice(deviceId, body);
          return updated ? this.json(updated, 200, corsHeaders) : this.notFound('Device not found', corsHeaders);
        }
        if (method === 'DELETE') {
          const revoked = this.ctx.deviceRegistry.revokeDevice(deviceId);
          return this.json({ success: revoked }, 200, corsHeaders);
        }
      }

      // 3. History
      if (path === '/api/v1/history/stats' && method === 'GET') {
        return this.json(this.ctx.historyStore.getStats(), 200, corsHeaders);
      }

      if (path === '/api/v1/history' && method === 'GET') {
        const search = url.searchParams.get('q') ?? undefined;
        const contentType = (url.searchParams.get('type') as ContentType) ?? undefined;
        const sourceDeviceId = url.searchParams.get('device') ?? undefined;
        const since = url.searchParams.get('since') ? Number(url.searchParams.get('since')) : undefined;
        const until = url.searchParams.get('until') ? Number(url.searchParams.get('until')) : undefined;
        const isPinned = url.searchParams.has('pinned') ? url.searchParams.get('pinned') === 'true' : undefined;
        const isFavourite = url.searchParams.has('favourite') ? url.searchParams.get('favourite') === 'true' : undefined;
        const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined;
        const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined;
        const cursor = url.searchParams.get('cursor') ?? undefined;

        const result = this.ctx.historyStore.query({
          search,
          contentType,
          sourceDeviceId,
          since,
          until,
          isPinned,
          isFavourite,
          limit,
          offset,
          cursor,
        });
        return this.json(result, 200, corsHeaders);
      }

      if (path === '/api/v1/history' && method === 'POST') {
        const body = (await req.json()) as {
          content: string;
          contentType?: ContentType;
          sourceDeviceId?: string;
        };
        const rawType = body.contentType ?? 'text';
        const normalized = normalizeContent(body.content, rawType);
        const now = Date.now();
        const sourceDev = body.sourceDeviceId ?? 'web-dashboard';

        const item: ClipboardItem = {
          id: `clip-${sourceDev}-${randomUUID()}`,
          sourceDeviceId: sourceDev,
          contentType: normalized.contentType,
          content: normalized.normalized,
          sizeBytes: normalized.sizeBytes,
          hash: normalized.hash,
          isPinned: false,
          isFavourite: false,
          createdAt: now,
          updatedAt: now,
        };

        const saved = this.ctx.historyStore.saveItem(item);
        return this.json(saved, 201, corsHeaders);
      }

      if (path === '/api/v1/history' && method === 'DELETE') {
        let count = 0;
        try {
          const body = (await req.json()) as { ids?: string[] };
          if (body.ids && Array.isArray(body.ids)) {
            count = this.ctx.historyStore.bulkDelete(body.ids);
          } else {
            count = this.ctx.historyStore.clearHistory();
          }
        } catch {
          count = this.ctx.historyStore.clearHistory();
        }
        return this.json({ deletedCount: count }, 200, corsHeaders);
      }

      const historyIdMatch = path.match(/^\/api\/v1\/history\/([^/]+)$/);
      if (historyIdMatch) {
        const id = historyIdMatch[1];
        if (method === 'GET') {
          const item = this.ctx.historyStore.getItem(id);
          return item ? this.json(item, 200, corsHeaders) : this.notFound('History item not found', corsHeaders);
        }
        if (method === 'PATCH') {
          const body = (await req.json()) as { isPinned?: boolean; isFavourite?: boolean };
          let updated = this.ctx.historyStore.getItem(id);
          if (!updated) {
            return this.notFound('History item not found', corsHeaders);
          }
          if (body.isPinned !== undefined) {
            updated = this.ctx.historyStore.setPinned(id, body.isPinned);
          }
          if (body.isFavourite !== undefined) {
            updated = this.ctx.historyStore.setFavourite(id, body.isFavourite);
          }
          return this.json(updated, 200, corsHeaders);
        }
        if (method === 'DELETE') {
          const deleted = this.ctx.historyStore.deleteItem(id);
          return this.json({ success: deleted }, 200, corsHeaders);
        }
      }

      // 4. Settings
      if (path === '/api/v1/settings/definitions' && method === 'GET') {
        return this.json(Object.values(SETTING_DEFINITIONS), 200, corsHeaders);
      }

      if (path === '/api/v1/settings/history-policy' && method === 'GET') {
        return this.json(this.ctx.settingsStore.getHistoryPolicy(), 200, corsHeaders);
      }

      if (path === '/api/v1/settings/history-policy' && method === 'PATCH') {
        const body = (await req.json()) as Partial<HistoryPolicy>;
        const current = this.ctx.settingsStore.getHistoryPolicy();
        const updated: HistoryPolicy = {
          ...current,
          ...body,
          updatedAt: Date.now(),
        };
        this.ctx.settingsStore.setHistoryPolicy(updated);
        // Also run automatic retention enforcement
        this.ctx.historyStore.enforceRetention(updated);
        return this.json(updated, 200, corsHeaders);
      }

      if (path === '/api/v1/settings' && method === 'GET') {
        const userSettings = this.ctx.settingsStore.getAllUserSettings(this.userId);
        return this.json(userSettings, 200, corsHeaders);
      }

      if (path === '/api/v1/settings' && method === 'PATCH') {
        const body = (await req.json()) as Record<string, unknown>;
        const expectedVersion = typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined;
        const settingsToUpdate =
          body.settings && typeof body.settings === 'object'
            ? (body.settings as Record<string, unknown>)
            : body;

        const result = this.ctx.settingsStore.updateUserSettingsBatch(
          this.userId,
          settingsToUpdate,
          expectedVersion
        );
        return this.json(result, 200, corsHeaders);
      }

      const deviceSettingsMatch = path.match(/^\/api\/v1\/devices\/([^/]+)\/settings$/);
      if (deviceSettingsMatch) {
        const devId = deviceSettingsMatch[1];
        if (method === 'GET') {
          return this.json(this.ctx.settingsStore.getAllDeviceSettings(devId), 200, corsHeaders);
        }
        if (method === 'PATCH') {
          const body = (await req.json()) as Record<string, unknown>;
          for (const [key, value] of Object.entries(body)) {
            this.ctx.settingsStore.setDeviceSetting(devId, key, value);
          }
          return this.json(this.ctx.settingsStore.getAllDeviceSettings(devId), 200, corsHeaders);
        }
      }

      // 5. Clipboard Controls
      if (path === '/api/v1/clipboard/status' && method === 'GET') {
        return this.json({
          isPaused: this.isSyncPaused,
          connectedDevicesCount: this.ctx.deviceRegistry.getAllDevices().filter((d) => d.status === 'online').length,
          lastSyncAt: Date.now(),
        }, 200, corsHeaders);
      }

      if (path === '/api/v1/clipboard/pause' && method === 'POST') {
        this.isSyncPaused = true;
        return this.json({ isPaused: true }, 200, corsHeaders);
      }

      if (path === '/api/v1/clipboard/resume' && method === 'POST') {
        this.isSyncPaused = false;
        return this.json({ isPaused: false }, 200, corsHeaders);
      }

      if (path === '/api/v1/clipboard/send' && method === 'POST') {
        const body = (await req.json()) as { content: string; contentType?: ContentType };
        const rawType = body.contentType ?? 'text';
        const normalized = normalizeContent(body.content, rawType);
        const item: ClipboardItem = {
          id: `clip-web-${randomUUID()}`,
          sourceDeviceId: 'web-dashboard',
          contentType: normalized.contentType,
          content: normalized.normalized,
          sizeBytes: normalized.sizeBytes,
          hash: normalized.hash,
          isPinned: false,
          isFavourite: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.ctx.historyStore.saveItem(item);
        return this.json({ success: true, item }, 200, corsHeaders);
      }

      // 6. Sharing & File Transfers
      if (path === '/api/v1/share' && method === 'POST') {
        const body = (await req.json()) as {
          targetDeviceIds: string[];
          fileName: string;
          fileSizeBytes: number;
          mimeType: string;
        };
        const transfer = this.ctx.transferManager.createTransfer({
          sourceDeviceId: 'web-dashboard',
          targetDeviceIds: body.targetDeviceIds,
          fileName: body.fileName,
          fileSizeBytes: body.fileSizeBytes,
          mimeType: body.mimeType,
        });
        return this.json(transfer, 201, corsHeaders);
      }

      if (path === '/api/v1/transfers' && method === 'GET') {
        return this.json(this.ctx.transferManager.getAllTransfers(), 200, corsHeaders);
      }

      const transferIdMatch = path.match(/^\/api\/v1\/transfers\/([^/]+)$/);
      if (transferIdMatch && method === 'GET') {
        const xfer = this.ctx.transferManager.getTransfer(transferIdMatch[1]);
        return xfer ? this.json(xfer, 200, corsHeaders) : this.notFound('Transfer not found', corsHeaders);
      }

      const transferCancelMatch = path.match(/^\/api\/v1\/transfers\/([^/]+)\/cancel$/);
      if (transferCancelMatch && method === 'POST') {
        const cancelled = this.ctx.transferManager.cancelTransfer(transferCancelMatch[1]);
        return cancelled ? this.json(cancelled, 200, corsHeaders) : this.notFound('Transfer not found', corsHeaders);
      }
      // 7. Binary Blobs (Images & Files)
      if (path === '/api/v1/blobs' && method === 'GET') {
        return this.json(this.ctx.blobStore.listBlobs(), 200, corsHeaders);
      }

      if (path === '/api/v1/blobs' && method === 'POST') {
        const mimeType = req.headers.get('content-type') ?? 'application/octet-stream';
        const fileName = url.searchParams.get('filename') ?? undefined;
        const arrayBuf = await req.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        const meta = this.ctx.blobStore.saveBlob(buffer, mimeType, fileName);
        return this.json(meta, 201, corsHeaders);
      }

      const blobHashMatch = path.match(/^\/api\/v1\/blobs\/([a-f0-9]{64})$/);
      if (blobHashMatch) {
        const hash = blobHashMatch[1];
        if (method === 'GET') {
          const stored = this.ctx.blobStore.getBlob(hash);
          if (!stored) {
            return this.notFound('Blob not found', corsHeaders);
          }
          return new Response(new Uint8Array(stored.data), {
            status: 200,
            headers: {
              'Content-Type': stored.mimeType,
              'Content-Length': String(stored.sizeBytes),
              ...(stored.fileName ? { 'Content-Disposition': `inline; filename="${stored.fileName}"` } : {}),
              ...corsHeaders,
            },
          });
        }
        if (method === 'DELETE') {
          const deleted = this.ctx.blobStore.deleteBlob(hash);
          return this.json({ success: deleted }, 200, corsHeaders);
        }
      }
      return this.notFound(`Cannot ${method} ${path}`, corsHeaders);
    } catch (err) {
      return this.json({
        error: err instanceof Error ? err.message : String(err),
      }, 400, corsHeaders);
    }
  }

  private json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  private notFound(message: string, headers: Record<string, string> = {}): Response {
    return this.json({ error: message }, 404, headers);
  }
}
