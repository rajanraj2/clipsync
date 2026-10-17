import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ClipSyncApiServer } from '@clipsync/api';
import { executeCli } from '../src/index.js';

describe('ClipSync CLI', () => {
  let server: ClipSyncApiServer;
  const testPort = 4840;
  const apiUrl = `http://localhost:${testPort}`;

  beforeAll(async () => {
    server = new ClipSyncApiServer({
      port: testPort,
      dbPath: ':memory:',
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('prints version information', async () => {
    const result = await executeCli({ args: ['--version'] });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('ClipSync CLI v0.1.1');
    expect(result.output).toContain('Protocol v2.0');
  });

  it('prints help instructions', async () => {
    const result = await executeCli({ args: ['help'] });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage:');
    expect(result.output).toContain('status');
    expect(result.output).toContain('send <text>');
  });

  it('checks status against active API server', async () => {
    const result = await executeCli({ args: ['status'], apiUrl });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('ClipSync System Status');
    expect(result.output).toContain('API Server:      ONLINE');
    expect(result.output).toContain('Sync Engine:     ACTIVE');
  });

  it('dispatches text to connected peers over CLI', async () => {
    const result = await executeCli({ args: ['send', 'Hello', 'from', 'terminal'], apiUrl });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ Dispatched to connected devices');
    expect(result.output).toContain('Hello from terminal');
  });

  it('queries clipboard history over CLI', async () => {
    const result = await executeCli({ args: ['history', '5'], apiUrl });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Clipboard History');
    expect(result.output).toContain('Hello from terminal');
  });

  it('lists paired devices over CLI', async () => {
    // Register test device
    server.context.deviceRegistry.registerOrPairDevice({
      id: 'cli-test-device',
      name: 'Terminal Workstation',
      platform: 'linux',
      appVersion: '0.1.0',
    });

    const result = await executeCli({ args: ['devices'], apiUrl });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Paired Devices');
    expect(result.output).toContain('Terminal Workstation');
  });
});
