import { describe, expect, it } from 'bun:test';
import {
  LinuxClipboardAdapter,
  LinuxCommandResult,
  LinuxCommandRunner,
} from '../src/index.js';

class MockLinuxCommandRunner implements LinuxCommandRunner {
  public executedCommands: Array<{ command: string; args: string[]; input?: string }> = [];
  public installedBinaries: Record<string, boolean> = {};
  public simulatedClipboardContent = '';
  public exitCode = 0;
  public stderr = '';

  public async exec(command: string, args: string[], input?: string): Promise<LinuxCommandResult> {
    this.executedCommands.push({ command, args, input });

    if (input !== undefined) {
      this.simulatedClipboardContent = input;
    }

    return {
      stdout: this.simulatedClipboardContent,
      stderr: this.stderr,
      exitCode: this.exitCode,
    };
  }

  public async which(binaryName: string): Promise<boolean> {
    return Boolean(this.installedBinaries[binaryName]);
  }
}

describe('Linux / Ubuntu Clipboard Adapter', () => {
  it('detects Wayland display server from environment variables', () => {
    const adapter = new LinuxClipboardAdapter({
      env: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0' },
    });
    expect(adapter.detectDisplayServer()).toBe('wayland');

    const adapterViaDisplay = new LinuxClipboardAdapter({
      env: { WAYLAND_DISPLAY: 'wayland-1' },
    });
    expect(adapterViaDisplay.detectDisplayServer()).toBe('wayland');
  });

  it('detects X11 display server from environment variables', () => {
    const adapter = new LinuxClipboardAdapter({
      env: { XDG_SESSION_TYPE: 'x11', DISPLAY: ':0' },
    });
    expect(adapter.detectDisplayServer()).toBe('x11');

    const adapterViaDisplay = new LinuxClipboardAdapter({
      env: { DISPLAY: ':1' },
    });
    expect(adapterViaDisplay.detectDisplayServer()).toBe('x11');
  });

  it('detects unknown display server when env is headless or unspecified', () => {
    const adapter = new LinuxClipboardAdapter({ env: {} });
    expect(adapter.detectDisplayServer()).toBe('unknown');
  });

  it('resolves wl-clipboard backend on Wayland when tools exist', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { 'wl-copy': true, 'wl-paste': true };

    const adapter = new LinuxClipboardAdapter({
      displayServer: 'wayland',
      runner,
    });

    const backend = await adapter.resolveBackend();
    expect(backend).toBe('wl-clipboard');
  });

  it('resolves xclip backend on X11 when xclip is installed', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { xclip: true };

    const adapter = new LinuxClipboardAdapter({
      displayServer: 'x11',
      runner,
    });

    const backend = await adapter.resolveBackend();
    expect(backend).toBe('xclip');
  });

  it('resolves xsel backend on X11 when xclip is absent but xsel is installed', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { xclip: false, xsel: true };

    const adapter = new LinuxClipboardAdapter({
      displayServer: 'x11',
      runner,
    });

    const backend = await adapter.resolveBackend();
    expect(backend).toBe('xsel');
  });

  it('provides actionable diagnostic error message when tools are missing', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { 'wl-copy': false, 'wl-paste': false, xclip: false, xsel: false };

    const adapterWayland = new LinuxClipboardAdapter({
      displayServer: 'wayland',
      runner,
    });

    await expect(adapterWayland.read()).rejects.toThrow('Install wl-clipboard (sudo apt install wl-clipboard)');

    const adapterX11 = new LinuxClipboardAdapter({
      displayServer: 'x11',
      runner,
    });

    await expect(adapterX11.read()).rejects.toThrow('Install xclip (sudo apt install xclip)');
  });

  it('reads and writes clipboard content using wl-clipboard backend', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { 'wl-copy': true, 'wl-paste': true };

    const adapter = new LinuxClipboardAdapter({
      displayServer: 'wayland',
      runner,
    });

    await adapter.write({
      content: 'Ubuntu terminal command: git status',
      contentType: 'text',
    });

    expect(runner.executedCommands).toHaveLength(1);
    expect(runner.executedCommands[0].command).toBe('wl-copy');
    expect(runner.executedCommands[0].input).toBe('Ubuntu terminal command: git status');

    const readBack = await adapter.read();
    expect(readBack).not.toBeNull();
    expect(readBack?.content).toBe('Ubuntu terminal command: git status');
    expect(readBack?.contentType).toBe('text');
  });

  it('reads and writes clipboard content using xclip backend', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { xclip: true };

    const adapter = new LinuxClipboardAdapter({
      displayServer: 'x11',
      selection: 'clipboard',
      runner,
    });

    await adapter.write({
      content: 'https://ubuntu.com/download/desktop',
      contentType: 'url',
    });

    expect(runner.executedCommands[0].command).toBe('xclip');
    expect(runner.executedCommands[0].args).toEqual(['-selection', 'clipboard']);
    expect(runner.executedCommands[0].input).toBe('https://ubuntu.com/download/desktop');

    const readBack = await adapter.read();
    expect(readBack?.content).toBe('https://ubuntu.com/download/desktop');
    expect(readBack?.contentType).toBe('url');
  });

  it('supports Linux primary selection (middle-click highlight)', async () => {
    const runner = new MockLinuxCommandRunner();
    runner.installedBinaries = { 'wl-copy': true, 'wl-paste': true };

    const adapter = new LinuxClipboardAdapter({
      displayServer: 'wayland',
      selection: 'primary',
      runner,
    });

    await adapter.write({
      content: 'highlighted text',
      contentType: 'text',
    });

    expect(runner.executedCommands[0].args).toEqual(['--primary']);
  });
});
