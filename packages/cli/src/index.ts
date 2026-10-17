import { ClipSyncApiClient } from '@clipsync/api-client';

export interface CliExecutionOptions {
  apiUrl?: string;
  args: string[];
}

export interface CliCommandResult {
  exitCode: number;
  output: string;
}

export async function executeCli(options: CliExecutionOptions): Promise<CliCommandResult> {
  const client = new ClipSyncApiClient(options.apiUrl ?? 'http://localhost:4000');
  const [command, ...params] = options.args;

  switch (command) {
    case 'status': {
      try {
        const [health, status, devices, stats] = await Promise.all([
          client.devices.list().then(() => ({ ok: true })).catch(() => ({ ok: false })),
          client.clipboard.getStatus().catch(() => null),
          client.devices.list().catch(() => []),
          client.history.getStats().catch(() => null),
        ]);

        const onlineCount = devices.filter((d) => d.status === 'online').length;
        const syncState = status?.isPaused ? 'PAUSED' : 'ACTIVE';

        const lines = [
          '=== ClipSync System Status ===',
          `API Server:      ${health.ok ? 'ONLINE (http://localhost:4000)' : 'OFFLINE / UNREACHABLE'}`,
          `Sync Engine:     ${syncState}`,
          `Connected Peers: ${onlineCount} online / ${devices.length} paired`,
          `History Entries: ${stats?.totalItems ?? 0} items (${stats?.pinnedItems ?? 0} pinned)`,
          `Storage Used:    ${Math.round((stats?.totalSizeBytes ?? 0) / 1024)} KB`,
        ];
        return { exitCode: 0, output: lines.join('\n') };
      } catch (err) {
        return { exitCode: 1, output: `Failed to fetch status: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'send': {
      const text = params.join(' ').trim();
      if (!text) {
        return { exitCode: 1, output: 'Usage: clipsync send <text or url>' };
      }

      try {
        const isUrl = /^https?:\/\//i.test(text);
        const res = await client.clipboard.send(text, isUrl ? 'url' : 'text');
        return {
          exitCode: 0,
          output: `✓ Dispatched to connected devices: "${res.item.content}" (ID: ${res.item.id})`,
        };
      } catch (err) {
        return { exitCode: 1, output: `Failed to dispatch: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'history': {
      const limit = params[0] ? Number(params[0]) : 10;
      try {
        const res = await client.history.query({ limit });
        if (res.items.length === 0) {
          return { exitCode: 0, output: 'No clipboard history entries found.' };
        }

        const lines = [`=== Clipboard History (${res.items.length} of ${res.totalCount}) ===`];
        for (const item of res.items) {
          const pinBadge = item.isPinned ? ' [PINNED]' : '';
          const typeBadge = `[${item.contentType.toUpperCase()}]`;
          lines.push(`• ${typeBadge}${pinBadge} ${item.content} (from: ${item.sourceDeviceId})`);
        }
        return { exitCode: 0, output: lines.join('\n') };
      } catch (err) {
        return { exitCode: 1, output: `Failed to fetch history: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'devices': {
      try {
        const devices = await client.devices.list();
        if (devices.length === 0) {
          return { exitCode: 0, output: 'No paired devices found.' };
        }

        const lines = ['=== Paired Devices ==='];
        for (const dev of devices) {
          const statusBadge = dev.status === 'online' ? '🟢 Online' : '⚪ Offline';
          lines.push(`• ${dev.name} (${dev.platform}) - ${statusBadge} [ID: ${dev.id}]`);
        }
        return { exitCode: 0, output: lines.join('\n') };
      } catch (err) {
        return { exitCode: 1, output: `Failed to fetch devices: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case 'version':
    case '-v':
    case '--version': {
      return { exitCode: 0, output: 'ClipSync CLI v0.1.1 (Protocol v2.0)' };
    }

    case 'help':
    case '-h':
    case '--help':
    default: {
      const helpText = [
        'ClipSync — Universal Clipboard CLI',
        '',
        'Usage:',
        '  clipsync <command> [arguments]',
        '',
        'Commands:',
        '  status            Check system health, sync state, and connected peers',
        '  send <text>       Dispatch text or URL to connected devices',
        '  history [limit]   List recent synchronized clipboard items',
        '  devices           List all paired devices and connectivity status',
        '  version           Print CLI and protocol version',
        '  help              Show this help message',
      ];
      return { exitCode: command === 'help' || !command ? 0 : 1, output: helpText.join('\n') };
    }
  }
}
