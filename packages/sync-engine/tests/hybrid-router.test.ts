import { describe, expect, it } from 'bun:test';
import { ClipboardItem, DeviceMetadata, ProtocolMessage } from '@clipsync/shared-types';
import { createProtocolMessage } from '@clipsync/protocol-schema';
import { EncryptedRelayServer } from '@clipsync/relay';
import {
  HybridNetworkRouter,
  InMemoryClipboardAdapter,
  LanDiscoveryService,
  RelayClientTransport,
  SyncEngine,
  SyncTransport,
} from '../src/index.js';

class MockDirectLanTransport implements SyncTransport {
  public shouldFail = false;
  public sentMessages: ProtocolMessage[] = [];
  private handler: ((msg: ProtocolMessage) => void) | null = null;
  public readonly transportId = 'mock-direct-lan';

  public async send(message: ProtocolMessage): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Direct LAN socket error');
    }
    this.sentMessages.push(message);
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.handler = handler;
  }
}

describe('Hybrid Network Router & Relay Fallback', () => {
  const localDevice: DeviceMetadata = {
    id: 'mac-1',
    name: 'MacBook',
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

  const peerDevice: DeviceMetadata = {
    id: 'win-1',
    name: 'ThinkPad',
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

  it('routes over direct LAN when peer is detected on local network', async () => {
    const relayServer = new EncryptedRelayServer();
    const relayTransport = new RelayClientTransport('mac-1');
    relayTransport.connect(relayServer, 'cluster-home');

    const directLanTransport = new MockDirectLanTransport();
    const lanDiscovery = new LanDiscoveryService(localDevice);

    // Announce peer on LAN
    lanDiscovery.recordPeerAnnounce(peerDevice, '192.168.1.150', 8844);

    const router = new HybridNetworkRouter({
      localDeviceId: 'mac-1',
      lanDiscovery,
      relayTransport,
      directLanTransport,
      preferLan: true,
    });

    const msg = createProtocolMessage<{ text: string }, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: 'mac-1',
      targetDeviceId: 'win-1',
      payload: { text: 'LAN message' },
    });

    await router.send(msg);

    expect(router.getLastRouteUsed()).toBe('lan');
    expect(directLanTransport.sentMessages).toHaveLength(1);
    expect(relayServer.getStats().forwardedPackets).toBe(0);
  });

  it('fails over to encrypted relay when LAN send fails or peer is remote', async () => {
    const relayServer = new EncryptedRelayServer();
    const relayTransport = new RelayClientTransport('mac-1');
    relayTransport.connect(relayServer, 'cluster-home');

    const directLanTransport = new MockDirectLanTransport();
    // Simulate LAN network failure
    directLanTransport.shouldFail = true;

    const lanDiscovery = new LanDiscoveryService(localDevice);
    lanDiscovery.recordPeerAnnounce(peerDevice, '192.168.1.150', 8844);

    const router = new HybridNetworkRouter({
      localDeviceId: 'mac-1',
      lanDiscovery,
      relayTransport,
      directLanTransport,
      preferLan: true,
    });

    const msg = createProtocolMessage<{ text: string }, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: 'mac-1',
      targetDeviceId: 'win-1',
      payload: { text: 'Failover message' },
    });

    // Send should smoothly fail over to relay without throwing
    await router.send(msg);

    expect(router.getLastRouteUsed()).toBe('relay');
    expect(relayServer.getStats().totalBufferedPackets).toBe(1); // Buffered on relay since win-1 not yet connected
  });

  it('synchronizes clipboard between two devices over EncryptedRelayServer', async () => {
    const relayServer = new EncryptedRelayServer();

    const transportMac = new RelayClientTransport('mac-1');
    const transportWin = new RelayClientTransport('win-1');

    transportMac.connect(relayServer, 'user-family');
    transportWin.connect(relayServer, 'user-family');

    const adapterMac = new InMemoryClipboardAdapter();
    const adapterWin = new InMemoryClipboardAdapter();

    const { promise: winReceived, resolve: onWinReceived } = Promise.withResolvers<ClipboardItem>();

    const engineMac = new SyncEngine(adapterMac, transportMac, { localDevice });
    const engineWin = new SyncEngine(adapterWin, transportWin, { localDevice: peerDevice }, {
      itemReceived: onWinReceived,
    });

    engineMac.start();
    engineWin.start();

    // Copy on Mac
    adapterMac.simulateExternalCopy({
      content: 'Synchronized via Encrypted Relay Server',
      contentType: 'text',
    });

    const received = await winReceived;
    expect(received.content).toBe('Synchronized via Encrypted Relay Server');

    const winClipboard = await adapterWin.read();
    expect(winClipboard?.content).toBe('Synchronized via Encrypted Relay Server');

    // Verify relay forwarded count
    expect(relayServer.getStats().forwardedPackets).toBeGreaterThanOrEqual(1);

    engineMac.stop();
    engineWin.stop();
  });
});
