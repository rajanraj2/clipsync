import type {
  ClipboardItem,
  ContentType,
  DeviceMetadata,
  HistoryPolicy,
  SettingDefinition,
  TransferItem,
} from '@clipsync/shared-types';

export interface HistoryQueryParameters {
  q?: string;
  type?: ContentType;
  device?: string;
  since?: number;
  until?: number;
  pinned?: boolean;
  favourite?: boolean;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface HistoryStatsResponse {
  totalItems: number;
  totalSizeBytes: number;
  pinnedItems: number;
  oldestItemTimestamp: number | null;
  newestItemTimestamp: number | null;
}

export interface ClipboardStatusResponse {
  isPaused: boolean;
  connectedDevicesCount: number;
  lastSyncAt: number;
}

export class ClipSyncApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // --- Devices ---
  public readonly devices = {
    list: async (): Promise<DeviceMetadata[]> => this.request<DeviceMetadata[]>('/api/v1/devices'),
    get: async (id: string): Promise<DeviceMetadata> => this.request<DeviceMetadata>(`/api/v1/devices/${id}`),
    pair: async (data: {
      id: string;
      name: string;
      platform: DeviceMetadata['platform'];
      appVersion: string;
    }): Promise<DeviceMetadata> =>
      this.request<DeviceMetadata>('/api/v1/devices/pair', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: async (
      id: string,
      data: { name?: string; status?: 'online' | 'offline'; trustLevel?: 'pending' | 'paired' | 'revoked' }
    ): Promise<DeviceMetadata> =>
      this.request<DeviceMetadata>(`/api/v1/devices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    revoke: async (id: string): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/v1/devices/${id}`, {
        method: 'DELETE',
      }),
  };

  // --- History ---
  public readonly history = {
    query: async (params: HistoryQueryParameters = {}): Promise<PaginatedResult<ClipboardItem>> => {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined) {
          searchParams.set(key, String(val));
        }
      }
      const qs = searchParams.toString();
      const path = `/api/v1/history${qs ? `?${qs}` : ''}`;
      return this.request<PaginatedResult<ClipboardItem>>(path);
    },
    get: async (id: string): Promise<ClipboardItem> => this.request<ClipboardItem>(`/api/v1/history/${id}`),
    save: async (data: { content: string; contentType?: ContentType; sourceDeviceId?: string }): Promise<ClipboardItem> =>
      this.request<ClipboardItem>('/api/v1/history', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    setPinned: async (id: string, isPinned: boolean): Promise<ClipboardItem> =>
      this.request<ClipboardItem>(`/api/v1/history/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned }),
      }),
    setFavourite: async (id: string, isFavourite: boolean): Promise<ClipboardItem> =>
      this.request<ClipboardItem>(`/api/v1/history/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavourite }),
      }),
    delete: async (id: string): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/v1/history/${id}`, {
        method: 'DELETE',
      }),
    bulkDelete: async (ids: string[]): Promise<{ deletedCount: number }> =>
      this.request<{ deletedCount: number }>('/api/v1/history', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      }),
    clear: async (): Promise<{ deletedCount: number }> =>
      this.request<{ deletedCount: number }>('/api/v1/history', {
        method: 'DELETE',
      }),
    getStats: async (): Promise<HistoryStatsResponse> =>
      this.request<HistoryStatsResponse>('/api/v1/history/stats'),
  };

  // --- Settings ---
  public readonly settings = {
    get: async (): Promise<Record<string, unknown>> => this.request<Record<string, unknown>>('/api/v1/settings'),
    update: async (
      settings: Record<string, unknown>,
      expectedVersion?: number
    ): Promise<{ version: number; settings: Record<string, unknown> }> =>
      this.request<{ version: number; settings: Record<string, unknown> }>('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify(expectedVersion !== undefined ? { settings, expectedVersion } : settings),
      }),
    getDefinitions: async (): Promise<SettingDefinition[]> =>
      this.request<SettingDefinition[]>('/api/v1/settings/definitions'),
    getHistoryPolicy: async (): Promise<HistoryPolicy> =>
      this.request<HistoryPolicy>('/api/v1/settings/history-policy'),
    updateHistoryPolicy: async (policy: Partial<HistoryPolicy>): Promise<HistoryPolicy> =>
      this.request<HistoryPolicy>('/api/v1/settings/history-policy', {
        method: 'PATCH',
        body: JSON.stringify(policy),
      }),
  };

  // --- Clipboard Controls ---
  public readonly clipboard = {
    getStatus: async (): Promise<ClipboardStatusResponse> =>
      this.request<ClipboardStatusResponse>('/api/v1/clipboard/status'),
    send: async (content: string, contentType: ContentType = 'text'): Promise<{ success: boolean; item: ClipboardItem }> =>
      this.request<{ success: boolean; item: ClipboardItem }>('/api/v1/clipboard/send', {
        method: 'POST',
        body: JSON.stringify({ content, contentType }),
      }),
    pause: async (): Promise<{ isPaused: boolean }> =>
      this.request<{ isPaused: boolean }>('/api/v1/clipboard/pause', {
        method: 'POST',
      }),
    resume: async (): Promise<{ isPaused: boolean }> =>
      this.request<{ isPaused: boolean }>('/api/v1/clipboard/resume', {
        method: 'POST',
      }),
  };

  // --- Transfers ---
  public readonly transfers = {
    share: async (data: {
      targetDeviceIds: string[];
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
    }): Promise<TransferItem> =>
      this.request<TransferItem>('/api/v1/share', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: async (): Promise<TransferItem[]> => this.request<TransferItem[]>('/api/v1/transfers'),
    cancel: async (id: string): Promise<TransferItem> =>
      this.request<TransferItem>(`/api/v1/transfers/${id}/cancel`, {
        method: 'POST',
      }),
  };

  // --- Blobs (Images & Binary Files) ---
  public readonly blobs = {
    list: async (): Promise<Array<{ hash: string; mimeType: string; fileName?: string; sizeBytes: number; createdAt: number }>> =>
      this.request('/api/v1/blobs'),
    upload: async (
      data: Blob | ArrayBuffer | Uint8Array,
      mimeType: string,
      fileName?: string
    ): Promise<{ hash: string; mimeType: string; fileName?: string; sizeBytes: number; createdAt: number }> => {
      const qs = fileName ? `?filename=${encodeURIComponent(fileName)}` : '';
      const res = await fetch(`${this.baseUrl}/api/v1/blobs${qs}`, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
        },
        body: data instanceof Uint8Array ? (data.buffer as ArrayBuffer) : data,
      });
      if (!res.ok) {
        throw new Error(`Blob upload failed: ${res.statusText}`);
      }
      return (await res.json()) as { hash: string; mimeType: string; fileName?: string; sizeBytes: number; createdAt: number };
    },
    download: async (hash: string): Promise<ArrayBuffer> => {
      const res = await fetch(`${this.baseUrl}/api/v1/blobs/${hash}`);
      if (!res.ok) {
        throw new Error(`Blob download failed: ${res.statusText}`);
      }
      return res.arrayBuffer();
    },
    delete: async (hash: string): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/v1/blobs/${hash}`, {
        method: 'DELETE',
      }),
  };

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errMsg = `Request failed: ${res.status} ${res.statusText}`;
      try {
        const errorJson = (await res.json()) as { error?: string };
        if (errorJson.error) {
          errMsg = errorJson.error;
        }
      } catch {
        // Fallback to HTTP status text
      }
      throw new Error(errMsg);
    }

    return (await res.json()) as T;
  }
}
