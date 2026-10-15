import { createHash } from 'node:crypto';
import { INIT_SCHEMA_SQL } from './schema.js';
import { SqliteDriver } from './types.js';

export interface StoredBlobMetadata {
  hash: string;
  mimeType: string;
  fileName?: string;
  sizeBytes: number;
  createdAt: number;
}

export interface StoredBlob extends StoredBlobMetadata {
  data: Buffer;
}

export class BlobStore {
  // Content-addressable in-memory storage backing the SQLite metadata index
  private readonly blobPayloads = new Map<string, Buffer>();

  constructor(private readonly driver: SqliteDriver) {
    this.initialize();
  }

  public initialize(): void {
    this.driver.exec(INIT_SCHEMA_SQL);
  }

  public saveBlob(
    data: Buffer | Uint8Array,
    mimeType: string,
    fileName?: string
  ): StoredBlobMetadata {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const sizeBytes = buffer.length;
    const now = Date.now();

    this.blobPayloads.set(hash, buffer);

    this.driver.run(
      `INSERT INTO blob_metadata (hash, mime_type, file_name, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(hash) DO UPDATE SET
         mime_type = excluded.mime_type,
         file_name = COALESCE(excluded.file_name, blob_metadata.file_name)`,
      [hash, mimeType, fileName ?? null, sizeBytes, now]
    );

    return {
      hash,
      mimeType,
      fileName,
      sizeBytes,
      createdAt: now,
    };
  }

  public getBlob(hash: string): StoredBlob | null {
    const meta = this.driver.get<{
      hash: string;
      mime_type: string;
      file_name: string | null;
      size_bytes: number;
      created_at: number;
    }>('SELECT * FROM blob_metadata WHERE hash = ?', [hash]);

    if (!meta) {
      return null;
    }

    const data = this.blobPayloads.get(hash);
    if (!data) {
      return null;
    }

    return {
      hash: meta.hash,
      mimeType: meta.mime_type,
      fileName: meta.file_name ?? undefined,
      sizeBytes: meta.size_bytes,
      createdAt: meta.created_at,
      data,
    };
  }

  public hasBlob(hash: string): boolean {
    return this.blobPayloads.has(hash);
  }

  public deleteBlob(hash: string): boolean {
    this.blobPayloads.delete(hash);
    this.driver.run('DELETE FROM blob_metadata WHERE hash = ?', [hash]);
    return true;
  }

  public listBlobs(): StoredBlobMetadata[] {
    const rows = this.driver.all<{
      hash: string;
      mime_type: string;
      file_name: string | null;
      size_bytes: number;
      created_at: number;
    }>('SELECT * FROM blob_metadata ORDER BY created_at DESC');

    return rows.map((r) => ({
      hash: r.hash,
      mimeType: r.mime_type,
      fileName: r.file_name ?? undefined,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    }));
  }

  public getTotalStorageBytes(): number {
    const row = this.driver.get<{ total: number | null }>(
      'SELECT SUM(size_bytes) as total FROM blob_metadata'
    );
    return row?.total ?? 0;
  }
}
