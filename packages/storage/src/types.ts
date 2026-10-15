import type { ClipboardItem, ContentType, HistoryPolicy } from '@clipsync/shared-types';

export interface HistoryQueryOptions {
  search?: string;
  contentType?: ContentType;
  sourceDeviceId?: string;
  since?: number;
  until?: number;
  isPinned?: boolean;
  isFavourite?: boolean;
  limit?: number;
  offset?: number;
  cursor?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedHistoryResult {
  items: ClipboardItem[];
  totalCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface HistoryStats {
  totalItems: number;
  totalSizeBytes: number;
  pinnedItems: number;
  oldestItemTimestamp: number | null;
  newestItemTimestamp: number | null;
}

export interface SqliteDriver {
  run(sql: string, params?: unknown[]): void;
  get<T>(sql: string, params?: unknown[]): T | undefined;
  all<T>(sql: string, params?: unknown[]): T[];
  exec(sql: string): void;
  close(): void;
}
