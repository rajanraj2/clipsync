import { ProtocolMessage } from '@clipsync/shared-types';
import { validateProtocolEnvelope } from '@clipsync/protocol-schema';
import { RelayRoutingTable, SendPacketFn } from './routing-table.js';
import { EphemeralBuffer } from './ephemeral-buffer.js';

export interface RelayForwardResult {
  forwarded: boolean;
  recipientCount: number;
  buffered: boolean;
}

export class EncryptedRelayServer {
  public readonly routingTable: RelayRoutingTable;
  public readonly buffer: EphemeralBuffer;
  private forwardedCount = 0;

  constructor(routingTable?: RelayRoutingTable, buffer?: EphemeralBuffer) {
    this.routingTable = routingTable ?? new RelayRoutingTable();
    this.buffer = buffer ?? new EphemeralBuffer();
  }

  public registerDevice(deviceId: string, clusterId: string, send: SendPacketFn): number {
    this.routingTable.register(deviceId, clusterId, send);

    // Flush any buffered messages that were waiting for this device while it was offline
    const queuedMessages = this.buffer.popBufferedMessages(deviceId);
    for (const msg of queuedMessages) {
      try {
        send(msg);
        this.forwardedCount += 1;
      } catch {
        // Drop failed delivery
      }
    }

    return queuedMessages.length;
  }

  public unregisterDevice(deviceId: string): boolean {
    return this.routingTable.unregister(deviceId);
  }

  public forwardMessage(
    clusterId: string,
    message: unknown
  ): RelayForwardResult {
    // Validate protocol envelope without inspecting payload contents (zero-payload-knowledge)
    validateProtocolEnvelope(message);
    const validMessage = message as ProtocolMessage;

    if (validMessage.targetDeviceId !== null) {
      // 1. Unicast to specific device
      const route = this.routingTable.getRoute(validMessage.targetDeviceId);
      if (route) {
        route(validMessage);
        this.forwardedCount += 1;
        return { forwarded: true, recipientCount: 1, buffered: false };
      }

      // Offline: buffer ephemerally until peer reconnects
      this.buffer.bufferMessage(validMessage.targetDeviceId, validMessage);
      return { forwarded: false, recipientCount: 0, buffered: true };
    }

    // 2. Multicast / Broadcast to all other devices in the cluster
    const clusterRoutes = this.routingTable.getClusterRoutes(clusterId, validMessage.senderDeviceId);
    for (const send of clusterRoutes) {
      try {
        send(validMessage);
        this.forwardedCount += 1;
      } catch {
        // Best effort
      }
    }

    return {
      forwarded: clusterRoutes.length > 0,
      recipientCount: clusterRoutes.length,
      buffered: false,
    };
  }

  public getStats(): {
    forwardedPackets: number;
    activeConnections: number;
    totalBufferedPackets: number;
  } {
    return {
      forwardedPackets: this.forwardedCount,
      activeConnections: this.routingTable.getConnectedDevicesCount(),
      totalBufferedPackets: this.buffer.getTotalBufferedCount(),
    };
  }
}
