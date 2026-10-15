import { describe, expect, it } from 'bun:test';
import { ProtocolMessage } from '@clipsync/shared-types';
import { createProtocolMessage } from '@clipsync/protocol-schema';
import { EncryptedRelayServer } from '../src/index.js';

describe('Encrypted Relay Service', () => {
  it('registers and unregisters peer routes in cluster', () => {
    const relay = new EncryptedRelayServer();
    const delivered: ProtocolMessage[] = [];

    relay.registerDevice('dev-mac', 'user-cluster-1', (msg) => {
      delivered.push(msg);
    });

    expect(relay.getStats().activeConnections).toBe(1);

    relay.unregisterDevice('dev-mac');
    expect(relay.getStats().activeConnections).toBe(0);
  });

  it('forwards unicast message to online target peer', () => {
    const relay = new EncryptedRelayServer();
    const macDelivered: ProtocolMessage[] = [];
    const winDelivered: ProtocolMessage[] = [];

    relay.registerDevice('dev-mac', 'cluster-1', (msg) => macDelivered.push(msg));
    relay.registerDevice('dev-win', 'cluster-1', (msg) => winDelivered.push(msg));

    const msg = createProtocolMessage<{ text: string }, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: 'dev-mac',
      targetDeviceId: 'dev-win',
      payload: { text: 'Direct to Windows' },
    });

    const result = relay.forwardMessage('cluster-1', msg);
    expect(result.forwarded).toBe(true);
    expect(result.recipientCount).toBe(1);
    expect(result.buffered).toBe(false);

    expect(winDelivered).toHaveLength(1);
    expect(winDelivered[0].messageId).toBe(msg.messageId);
    expect(macDelivered).toHaveLength(0); // Sender did not receive
  });

  it('broadcasts message to all other connected peers in the cluster', () => {
    const relay = new EncryptedRelayServer();
    const macDelivered: ProtocolMessage[] = [];
    const winDelivered: ProtocolMessage[] = [];
    const linDelivered: ProtocolMessage[] = [];

    relay.registerDevice('dev-mac', 'cluster-1', (msg) => macDelivered.push(msg));
    relay.registerDevice('dev-win', 'cluster-1', (msg) => winDelivered.push(msg));
    relay.registerDevice('dev-lin', 'cluster-1', (msg) => linDelivered.push(msg));

    const broadcastMsg = createProtocolMessage<{ text: string }, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: 'dev-mac',
      targetDeviceId: null, // Broadcast
      payload: { text: 'Broadcast to all cluster members' },
    });

    const result = relay.forwardMessage('cluster-1', broadcastMsg);
    expect(result.forwarded).toBe(true);
    expect(result.recipientCount).toBe(2);

    expect(winDelivered).toHaveLength(1);
    expect(linDelivered).toHaveLength(1);
    expect(macDelivered).toHaveLength(0); // Sender excluded
  });

  it('ephemerally buffers packet when target is offline and flushes on reconnect', () => {
    const relay = new EncryptedRelayServer();
    const winDelivered: ProtocolMessage[] = [];

    // dev-win is initially offline!
    const msg = createProtocolMessage<{ text: string }, 'clipboard_sync'>({
      type: 'clipboard_sync',
      senderDeviceId: 'dev-mac',
      targetDeviceId: 'dev-win',
      payload: { text: 'Buffered while offline' },
    });

    const forwardResult = relay.forwardMessage('cluster-1', msg);
    expect(forwardResult.forwarded).toBe(false);
    expect(forwardResult.buffered).toBe(true);
    expect(relay.getStats().totalBufferedPackets).toBe(1);

    // dev-win now comes online and registers
    const flushedCount = relay.registerDevice('dev-win', 'cluster-1', (m) => {
      winDelivered.push(m);
    });

    expect(flushedCount).toBe(1);
    expect(winDelivered).toHaveLength(1);
    expect(winDelivered[0].messageId).toBe(msg.messageId);
    expect(relay.getStats().totalBufferedPackets).toBe(0);
  });
});
