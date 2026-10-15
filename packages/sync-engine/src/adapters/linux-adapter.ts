import { execFile, spawn } from 'node:child_process';
import { ClipboardAdapter, RawClipboardData } from '../types.js';

export type LinuxDisplayServer = 'wayland' | 'x11' | 'unknown';
export type LinuxClipboardBackend = 'wl-clipboard' | 'xclip' | 'xsel' | 'none';
export type LinuxSelection = 'clipboard' | 'primary';

export interface LinuxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface LinuxCommandRunner {
  exec(command: string, args: string[], input?: string): Promise<LinuxCommandResult>;
  which(binaryName: string): Promise<boolean>;
}

export class DefaultLinuxCommandRunner implements LinuxCommandRunner {
  public async exec(command: string, args: string[], input?: string): Promise<LinuxCommandResult> {
    const { promise, resolve } = Promise.withResolvers<LinuxCommandResult>();
    const proc = spawn(command, args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    if (input !== undefined) {
      proc.stdin.write(input, 'utf8', () => {
        proc.stdin.end();
      });
    }

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    });

    return promise;
  }

  public async which(binaryName: string): Promise<boolean> {
    const { promise, resolve } = Promise.withResolvers<boolean>();
    execFile('which', [binaryName], (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
    return promise;
  }
}

export interface LinuxAdapterOptions {
  displayServer?: LinuxDisplayServer;
  backend?: LinuxClipboardBackend;
  selection?: LinuxSelection;
  pollIntervalMs?: number;
  runner?: LinuxCommandRunner;
  env?: Record<string, string | undefined>;
}

export class LinuxClipboardAdapter implements ClipboardAdapter {
  public readonly platformName = 'linux';
  private readonly runner: LinuxCommandRunner;
  private readonly selection: LinuxSelection;
  private readonly pollIntervalMs: number;
  private readonly env: Record<string, string | undefined>;
  private detectedDisplayServer: LinuxDisplayServer | null = null;
  private detectedBackend: LinuxClipboardBackend | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private lastContent: string | null = null;
  private watcherCallback: ((data: RawClipboardData) => void) | null = null;

  constructor(options: LinuxAdapterOptions = {}) {
    this.runner = options.runner ?? new DefaultLinuxCommandRunner();
    this.selection = options.selection ?? 'clipboard';
    this.pollIntervalMs = options.pollIntervalMs ?? 300;
    this.env = options.env ?? process.env;
    if (options.displayServer) {
      this.detectedDisplayServer = options.displayServer;
    }
    if (options.backend) {
      this.detectedBackend = options.backend;
    }
  }

  public detectDisplayServer(): LinuxDisplayServer {
    if (this.detectedDisplayServer) {
      return this.detectedDisplayServer;
    }

    const xdgSession = this.env.XDG_SESSION_TYPE?.toLowerCase();
    if (xdgSession === 'wayland' || Boolean(this.env.WAYLAND_DISPLAY)) {
      this.detectedDisplayServer = 'wayland';
      return 'wayland';
    }

    if (xdgSession === 'x11' || Boolean(this.env.DISPLAY)) {
      this.detectedDisplayServer = 'x11';
      return 'x11';
    }

    this.detectedDisplayServer = 'unknown';
    return 'unknown';
  }

  public async resolveBackend(): Promise<LinuxClipboardBackend> {
    if (this.detectedBackend) {
      return this.detectedBackend;
    }

    const displayServer = this.detectDisplayServer();

    if (displayServer === 'wayland') {
      const hasWlCopy = await this.runner.which('wl-copy');
      const hasWlPaste = await this.runner.which('wl-paste');
      if (hasWlCopy && hasWlPaste) {
        this.detectedBackend = 'wl-clipboard';
        return 'wl-clipboard';
      }
    }

    // Check X11 tools (or XWayland fallback)
    const hasXclip = await this.runner.which('xclip');
    if (hasXclip) {
      this.detectedBackend = 'xclip';
      return 'xclip';
    }

    const hasXsel = await this.runner.which('xsel');
    if (hasXsel) {
      this.detectedBackend = 'xsel';
      return 'xsel';
    }

    this.detectedBackend = 'none';
    return 'none';
  }

  public async read(): Promise<RawClipboardData | null> {
    const backend = await this.resolveBackend();

    if (backend === 'none') {
      const display = this.detectDisplayServer();
      const hint =
        display === 'wayland'
          ? 'Install wl-clipboard (sudo apt install wl-clipboard)'
          : 'Install xclip (sudo apt install xclip) or xsel (sudo apt install xsel)';
      throw new Error(`No compatible Linux clipboard backend found for display server "${display}". ${hint}`);
    }

    let stdout = '';

    if (backend === 'wl-clipboard') {
      const args = ['--no-newline'];
      if (this.selection === 'primary') {
        args.push('--primary');
      }
      const res = await this.runner.exec('wl-paste', args);
      if (res.exitCode !== 0) {
        return null;
      }
      stdout = res.stdout;
    } else if (backend === 'xclip') {
      const res = await this.runner.exec('xclip', ['-selection', this.selection, '-o']);
      if (res.exitCode !== 0) {
        return null;
      }
      stdout = res.stdout;
    } else if (backend === 'xsel') {
      const flag = this.selection === 'primary' ? '--primary' : '--clipboard';
      const res = await this.runner.exec('xsel', [flag, '--output']);
      if (res.exitCode !== 0) {
        return null;
      }
      stdout = res.stdout;
    }

    if (stdout.length === 0) {
      return null;
    }

    const trimmed = stdout.trim();
    const isUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);

    return {
      content: stdout,
      contentType: isUrl ? 'url' : 'text',
    };
  }

  public async write(data: RawClipboardData): Promise<void> {
    const backend = await this.resolveBackend();

    if (backend === 'none') {
      throw new Error('Cannot write to Linux clipboard: No compatible clipboard backend found');
    }

    if (backend === 'wl-clipboard') {
      const args: string[] = [];
      if (this.selection === 'primary') {
        args.push('--primary');
      }
      const res = await this.runner.exec('wl-copy', args, data.content);
      if (res.exitCode !== 0) {
        throw new Error(`wl-copy failed: ${res.stderr}`);
      }
    } else if (backend === 'xclip') {
      const res = await this.runner.exec('xclip', ['-selection', this.selection], data.content);
      if (res.exitCode !== 0) {
        throw new Error(`xclip failed: ${res.stderr}`);
      }
    } else if (backend === 'xsel') {
      const flag = this.selection === 'primary' ? '--primary' : '--clipboard';
      const res = await this.runner.exec('xsel', [flag, '--input'], data.content);
      if (res.exitCode !== 0) {
        throw new Error(`xsel failed: ${res.stderr}`);
      }
    }
  }

  public startWatching(callback: (data: RawClipboardData) => void): void {
    this.watcherCallback = callback;
    clearInterval(this.pollingTimer as NodeJS.Timeout);

    this.pollingTimer = setInterval(async () => {
      try {
        const current = await this.read();
        if (!current) {
          return;
        }

        if (current.content !== this.lastContent) {
          this.lastContent = current.content;
          if (this.watcherCallback) {
            this.watcherCallback(current);
          }
        }
      } catch {
        // Polling error handled gracefully
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
