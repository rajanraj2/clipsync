import { ProtocolMessage } from '@clipsync/shared-types';
import { EncryptedRelayServer } from '@clipsync/relay';
import { SyncTransport } from '../types.js';

export class RelayClientTransport implements SyncTransport {
  public readonly transportId: string;
  private server: EncryptedRelayServer | null = null;
  private clusterId: string | null = null;
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  private connected = false;

  constructor(public readonly deviceId: string) {
    this.transportId = `relay-client-${deviceId}`;
  }

  public connect(server: EncryptedRelayServer, clusterId: string): void {
    this.server = server;
    this.clusterId = clusterId;
    this.connected = true;

    server.registerDevice(this.deviceId, clusterId, (msg) => {
      this.messageHandler?.(msg);
    });
  }

  public disconnect(): void {
    if (this.server) {
      this.server.unregisterDevice(this.deviceId);
      this.server = null;
    }
    this.connected = false;
  }

  public async send(message: ProtocolMessage): Promise<void> {
    if (!this.server || !this.clusterId || !this.connected) {
      throw new Error('Cannot send packet: RelayClientTransport is disconnected');
    }

    this.server.forwardMessage(this.clusterId, message);
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
