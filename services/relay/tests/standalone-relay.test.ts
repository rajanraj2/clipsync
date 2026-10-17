import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ProtocolMessage } from '@clipsync/shared-types';
import { createProtocolMessage } from '@clipsync/protocol-schema';
import { RelayClientTransport } from '@clipsync/sync-engine';
import { StandaloneRelayService } from '../src/index.js';

describe('Standalone WebSocket Relay Server & Remote Transport', () => {
  let relayService: StandaloneRelayService;
  const testPort = 4855;

  beforeAll(async () => {
    relayService = new StandaloneRelayService({ port: testPort, heartbeatIntervalMs: 5000 });
    await relayService.start();
  });

  afterAll(async () => {
    await relayService.stop();
  });

  it('serves HTTP health check', async () => {
    const res = await fetch(`http://localhost:${testPort}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('online');
    expect(body.service).toBe('ClipSync Encrypted Relay');
  });

  it('connects two remote clients over WebSocket and synchronizes messages across different networks', async () => {
    const clientA = new RelayClientTransport('mac-remote-1');
    const clientB = new RelayClientTransport('android-5g-1');

    await clientA.connectRemote({
      relayUrl: `ws://localhost:${testPort}`,
      deviceId: 'mac-remote-1',
      clusterId: 'user-cluster-123',
    });

    await clientB.connectRemote({
      relayUrl: `ws://localhost:${testPort}`,
      deviceId: 'android-5g-1',
      clusterId: 'user-cluster-123',
    });

    expect(clientA.isConnected()).toBe(true);
    expect(clientB.isConnected()).toBe(true);

    const { promise: receivedPromise, resolve: onReceived } = Promise.withResolvers<ProtocolMessage>();
    clientB.onMessage(onReceived);

    // Client A sends message over remote WebSocket
    const packet = createProtocolMessage<{ text: string }, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: 'mac-remote-1',
      targetDeviceId: 'android-5g-1',
      payload: { text: 'Cross-network sync via public relay' },
    });

    await clientA.send(packet);

    const received = await receivedPromise;
    expect(received.messageId).toBe(packet.messageId);
    const payload = received.payload;
    if (payload && typeof payload === 'object' && 'text' in payload) {
      expect(payload.text).toBe('Cross-network sync via public relay');
    } else {
      throw new Error('Payload does not contain expected text field');
    }
    clientA.disconnect();
    clientB.disconnect();
  });
});
