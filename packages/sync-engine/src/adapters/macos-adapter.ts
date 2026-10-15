import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { ClipboardAdapter, RawClipboardData } from '../types.js';

const execAsync = promisify(exec);

export class MacOSClipboardAdapter implements ClipboardAdapter {
  public readonly platformName = 'macos';
  private pollingTimer: NodeJS.Timeout | null = null;
  private lastContentHash: string | null = null;
  private watcherCallback: ((data: RawClipboardData) => void) | null = null;

  constructor(private readonly pollIntervalMs: number = 300) {}

  public async read(): Promise<RawClipboardData | null> {
    try {
      const { stdout } = await execAsync('pbpaste', { maxBuffer: 10 * 1024 * 1024 });
      if (!stdout || stdout.length === 0) {
        return null;
      }

      const trimmed = stdout.trim();
      const isUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);

      return {
        content: stdout,
        contentType: isUrl ? 'url' : 'text',
      };
    } catch {
      return null;
    }
  }

  public async write(data: RawClipboardData): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const proc = spawn('pbcopy');

    proc.stdin.write(data.content, 'utf8', (err) => {
      if (err) {
        reject(err);
        return;
      }
      proc.stdin.end();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pbcopy exited with non-zero code ${code}`));
      }
    });

    proc.on('error', reject);
    return promise;
  }

  public startWatching(callback: (data: RawClipboardData) => void): void {
    this.watcherCallback = callback;
    clearInterval(this.pollingTimer as NodeJS.Timeout);

    this.pollingTimer = setInterval(async () => {
      const current = await this.read();
      if (!current) {
        return;
      }

      if (current.content !== this.lastContentHash) {
        this.lastContentHash = current.content;
        if (this.watcherCallback) {
          this.watcherCallback(current);
        }
      }
    }, this.pollIntervalMs);
  }

  public stopWatching(): void {
    clearInterval(this.pollingTimer as NodeJS.Timeout);
    this.pollingTimer = null;
    this.watcherCallback = null;
  }

  public isWatching(): boolean {
    return this.pollingTimer !== null;
  }
}
