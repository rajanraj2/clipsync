import { DatabaseSync } from 'node:sqlite';
import { SqliteDriver } from './types.js';

export class NodeSqliteDriver implements SqliteDriver {
  private readonly db: DatabaseSync;

  constructor(filePath: string = ':memory:') {
    this.db = new DatabaseSync(filePath);
  }

  public run(sql: string, params: unknown[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(...params as (number | string | bigint | Buffer | null)[]);
  }

  public get<T>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params as (number | string | bigint | Buffer | null)[]);
    return result as T | undefined;
  }

  public all<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params as (number | string | bigint | Buffer | null)[]);
    return results as T[];
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public close(): void {
    this.db.close();
  }
}
