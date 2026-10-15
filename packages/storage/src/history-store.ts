import {
  ClipboardItem,
  ContentType,
  HistoryPolicy,
} from '@clipsync/shared-types';
import {
  evaluateHistoryPruning,
  PruneOptions,
  PruneResult,
} from '@clipsync/protocol-schema';
import { INIT_SCHEMA_SQL } from './schema.js';
import {
  HistoryQueryOptions,
  HistoryStats,
  PaginatedHistoryResult,
  SqliteDriver,
} from './types.js';

interface RawClipboardRow {
  id: string;
  source_device_id: string;
  content_type: string;
  content: string;
  preview: string | null;
  size_bytes: number;
  hash: string;
  is_pinned: number;
  is_favourite: number;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

export class HistoryStore {
  constructor(private readonly driver: SqliteDriver) {
    this.initialize();
  }

  public initialize(): void {
    this.driver.exec(INIT_SCHEMA_SQL);
  }

  public saveItem(item: ClipboardItem): ClipboardItem {
    const existing = this.driver.get<{ id: string }>(
      'SELECT id FROM clipboard_items WHERE hash = ?',
      [item.hash]
    );

    if (existing) {
      // Update timestamp of existing duplicate item to move to top of history
      this.driver.run(
        'UPDATE clipboard_items SET updated_at = ?, source_device_id = ? WHERE id = ?',
        [item.updatedAt, item.sourceDeviceId, existing.id]
      );
      return this.getItem(existing.id) ?? item;
    }

    this.driver.run(
      `INSERT INTO clipboard_items (
        id, source_device_id, content_type, content, preview, size_bytes,
        hash, is_pinned, is_favourite, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.sourceDeviceId,
        item.contentType,
        item.content,
        item.preview ?? null,
        item.sizeBytes,
        item.hash,
        item.isPinned ? 1 : 0,
        item.isFavourite ? 1 : 0,
        item.metadata ? JSON.stringify(item.metadata) : null,
        item.createdAt,
        item.updatedAt,
      ]
    );

    return item;
  }

  public getItem(id: string): ClipboardItem | null {
    const row = this.driver.get<RawClipboardRow>(
      'SELECT * FROM clipboard_items WHERE id = ?',
      [id]
    );
    return row ? this.mapRowToItem(row) : null;
  }

  public query(options: HistoryQueryOptions = {}): PaginatedHistoryResult {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.search && options.search.trim().length > 0) {
      conditions.push('content LIKE ?');
      params.push(`%${options.search.trim()}%`);
    }

    if (options.contentType) {
      conditions.push('content_type = ?');
      params.push(options.contentType);
    }

    if (options.sourceDeviceId) {
      conditions.push('source_device_id = ?');
      params.push(options.sourceDeviceId);
    }

    if (options.since !== undefined) {
      conditions.push('created_at >= ?');
      params.push(options.since);
    }

    if (options.until !== undefined) {
      conditions.push('created_at <= ?');
      params.push(options.until);
    }

    if (options.isPinned !== undefined) {
      conditions.push('is_pinned = ?');
      params.push(options.isPinned ? 1 : 0);
    }

    if (options.isFavourite !== undefined) {
      conditions.push('is_favourite = ?');
      params.push(options.isFavourite ? 1 : 0);
    }

    if (options.cursor) {
      const cursorRow = this.driver.get<{ created_at: number }>(
        'SELECT created_at FROM clipboard_items WHERE id = ?',
        [options.cursor]
      );
      if (cursorRow) {
        conditions.push('created_at < ?');
        params.push(cursorRow.created_at);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.driver.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM clipboard_items ${whereClause}`,
      params
    );
    const totalCount = countRow?.total ?? 0;

    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
    const offset = options.cursor ? 0 : Math.max(0, options.offset ?? 0);
    const direction = options.sortDirection === 'asc' ? 'ASC' : 'DESC';

    const querySql = `
      SELECT * FROM clipboard_items
      ${whereClause}
      ORDER BY is_pinned DESC, created_at ${direction}
      LIMIT ? OFFSET ?
    `;

    const rows = this.driver.all<RawClipboardRow>(querySql, [...params, limit + 1, offset]);
    const hasMore = rows.length > limit;
    const itemsRows = hasMore ? rows.slice(0, limit) : rows;
    const items = itemsRows.map((r) => this.mapRowToItem(r));
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  public setPinned(id: string, isPinned: boolean): ClipboardItem {
    this.driver.run(
      'UPDATE clipboard_items SET is_pinned = ?, updated_at = ? WHERE id = ?',
      [isPinned ? 1 : 0, Date.now(), id]
    );
    const updated = this.getItem(id);
    if (!updated) {
      throw new Error(`Item not found: ${id}`);
    }
    return updated;
  }

  public setFavourite(id: string, isFavourite: boolean): ClipboardItem {
    this.driver.run(
      'UPDATE clipboard_items SET is_favourite = ?, updated_at = ? WHERE id = ?',
      [isFavourite ? 1 : 0, Date.now(), id]
    );
    const updated = this.getItem(id);
    if (!updated) {
      throw new Error(`Item not found: ${id}`);
    }
    return updated;
  }

  public deleteItem(id: string): boolean {
    const existing = this.getItem(id);
    if (!existing) {
      return false;
    }
    this.driver.run('DELETE FROM clipboard_items WHERE id = ?', [id]);
    return true;
  }

  public bulkDelete(ids: string[]): number {
    if (ids.length === 0) {
      return 0;
    }
    const placeholders = ids.map(() => '?').join(',');
    this.driver.run(
      `DELETE FROM clipboard_items WHERE id IN (${placeholders})`,
      ids
    );
    return ids.length;
  }

  public clearHistory(): number {
    const count = this.driver.get<{ count: number }>('SELECT COUNT(*) as count FROM clipboard_items');
    this.driver.run('DELETE FROM clipboard_items');
    return count?.count ?? 0;
  }

  public enforceRetention(policy: HistoryPolicy, options: PruneOptions = {}): PruneResult {
    const allRows = this.driver.all<RawClipboardRow>(
      'SELECT * FROM clipboard_items ORDER BY created_at DESC'
    );
    const allItems = allRows.map((r) => this.mapRowToItem(r));

    const pruneResult = evaluateHistoryPruning(allItems, policy, options);
    if (pruneResult.itemsToPrune.length > 0) {
      const idsToDelete = pruneResult.itemsToPrune.map((i) => i.id);
      this.bulkDelete(idsToDelete);
    }

    return pruneResult;
  }

  public getStats(): HistoryStats {
    const statsRow = this.driver.get<{
      total_items: number;
      total_bytes: number | null;
      pinned_items: number;
      oldest_ts: number | null;
      newest_ts: number | null;
    }>(`
      SELECT
        COUNT(*) as total_items,
        SUM(size_bytes) as total_bytes,
        SUM(is_pinned) as pinned_items,
        MIN(created_at) as oldest_ts,
        MAX(created_at) as newest_ts
      FROM clipboard_items
    `);

    return {
      totalItems: statsRow?.total_items ?? 0,
      totalSizeBytes: statsRow?.total_bytes ?? 0,
      pinnedItems: statsRow?.pinned_items ?? 0,
      oldestItemTimestamp: statsRow?.oldest_ts ?? null,
      newestItemTimestamp: statsRow?.newest_ts ?? null,
    };
  }

  private mapRowToItem(row: RawClipboardRow): ClipboardItem {
    let metadata: Record<string, unknown> | undefined;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = undefined;
      }
    }

    return {
      id: row.id,
      sourceDeviceId: row.source_device_id,
      contentType: row.content_type as ContentType,
      content: row.content,
      preview: row.preview ?? undefined,
      sizeBytes: row.size_bytes,
      hash: row.hash,
      isPinned: Boolean(row.is_pinned),
      isFavourite: Boolean(row.is_favourite),
      metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
