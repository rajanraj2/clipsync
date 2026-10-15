import { describe, expect, it } from 'bun:test';
import { ClipboardItem, DeviceMetadata, ProtocolMessage } from '@clipsync/shared-types';
import {
  InMemoryClipboardAdapter,
  SyncEngine,
  SyncTransport,
} from '../src/index.js';

class MeshHub {
  private transports: Map<string, MeshPeerTransport> = new Map();

  public register(transport: MeshPeerTransport): void {
    this.transports.set(transport.transportId, transport);
  }

  public broadcast(senderId: string, message: ProtocolMessage): void {
    for (const [id, peer] of this.transports.entries()) {
      if (id !== senderId) {
        queueMicrotask(() => {
          peer.deliver(message);
        });
      }
    }
  }
}

class MeshPeerTransport implements SyncTransport {
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  public sentMessages: ProtocolMessage[] = [];

  constructor(
    public readonly transportId: string,
    private readonly hub: MeshHub
  ) {
    this.hub.register(this);
  }

  public async send(message: ProtocolMessage): Promise<void> {
    this.sentMessages.push(message);
    this.hub.broadcast(this.transportId, message);
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }

  public deliver(message: ProtocolMessage): void {
    this.messageHandler?.(message);
  }
}

describe('Tri-Platform Mesh Sync (macOS <-> Windows <-> Ubuntu)', () => {
  const deviceMac: DeviceMetadata = {
    id: 'dev-mac',
    name: 'MacBook Pro',
    platform: 'macos',
    appVersion: '0.1.0',
    capabilities: {
      backgroundClipboardMonitoring: true,
      osClipboardHook: true,
      hybridCapture: false,
      directFileAccess: true,
      browserRestricted: false,
    },
    status: 'online',
    trustLevel: 'paired',
    lastSeenAt: Date.now(),
    registeredAt: Date.now(),
  };

  const deviceWin: DeviceMetadata = {
    id: 'dev-win',
    name: 'Windows Desktop',
    platform: 'windows',
    appVersion: '0.1.0',
    capabilities: {
      backgroundClipboardMonitoring: true,
      osClipboardHook: true,
      hybridCapture: false,
      directFileAccess: true,
      browserRestricted: false,
    },
    status: 'online',
    trustLevel: 'paired',
    lastSeenAt: Date.now(),
    registeredAt: Date.now(),
  };

  const deviceLinux: DeviceMetadata = {
    id: 'dev-linux',
    name: 'Ubuntu Workstation',
    platform: 'linux',
    appVersion: '0.1.0',
    capabilities: {
      backgroundClipboardMonitoring: true,
      osClipboardHook: true,
      hybridCapture: false,
      directFileAccess: true,
      browserRestricted: false,
    },
    status: 'online',
    trustLevel: 'paired',
    lastSeenAt: Date.now(),
    registeredAt: Date.now(),
  };

  it('broadcasts from Ubuntu and synchronizes to both macOS and Windows without loop echoes', async () => {
    const hub = new MeshHub();

    const adapterMac = new InMemoryClipboardAdapter();
    const adapterWin = new InMemoryClipboardAdapter();
    const adapterLinux = new InMemoryClipboardAdapter();

    const transportMac = new MeshPeerTransport('mac', hub);
    const transportWin = new MeshPeerTransport('win', hub);
    const transportLinux = new MeshPeerTransport('linux', hub);

    const { promise: macPromise, resolve: macResolve } = Promise.withResolvers<ClipboardItem>();
    const { promise: winPromise, resolve: winResolve } = Promise.withResolvers<ClipboardItem>();

    const engineMac = new SyncEngine(adapterMac, transportMac, { localDevice: deviceMac }, {
      itemReceived: macResolve,
    });
    const engineWin = new SyncEngine(adapterWin, transportWin, { localDevice: deviceWin }, {
      itemReceived: winResolve,
    });
    const engineLinux = new SyncEngine(adapterLinux, transportLinux, { localDevice: deviceLinux });

    engineMac.start();
    engineWin.start();
    engineLinux.start();

    // Ubuntu user copies shell command
    adapterLinux.simulateExternalCopy({
      content: 'systemctl restart clipsync',
      contentType: 'text',
    });

    const [macItem, winItem] = await Promise.all([macPromise, winPromise]);

    expect(macItem.content).toBe('systemctl restart clipsync');
    expect(winItem.content).toBe('systemctl restart clipsync');

    // Verify clipboards on both macOS and Windows
    const macClip = await adapterMac.read();
    const winClip = await adapterWin.read();
    expect(macClip?.content).toBe('systemctl restart clipsync');
    expect(winClip?.content).toBe('systemctl restart clipsync');

    // CRITICAL: Verify neither macOS nor Windows echoed the message back out as a sync
    const macEchoes = transportMac.sentMessages.filter((m) => m.type === 'clipboard_sync');
    const winEchoes = transportWin.sentMessages.filter((m) => m.type === 'clipboard_sync');
    expect(macEchoes).toHaveLength(0);
    expect(winEchoes).toHaveLength(0);

    engineMac.stop();
    engineWin.stop();
    engineLinux.stop();
  });
});
