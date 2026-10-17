import { ProtocolMessage } from '@clipsync/shared-types';
import { EncryptedRelayServer } from '@clipsync/relay';
import { SyncTransport } from '../types.js';

export interface RemoteWebSocketClientOptions {
  relayUrl: string;
  deviceId: string;
  clusterId?: string;
}

export class RelayClientTransport implements SyncTransport {
  public readonly transportId: string;
  private server: EncryptedRelayServer | null = null;
  private ws: WebSocket | null = null;
  private clusterId: string | null = null;
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  private connected = false;

  constructor(public readonly deviceId: string) {
    this.transportId = `relay-client-${deviceId}`;
  }

  /**
   * Connects to an in-memory relay server directly (used in tests or same-process runtimes).
   */
  public connect(server: EncryptedRelayServer, clusterId: string): void {
    this.server = server;
    this.clusterId = clusterId;
    this.connected = true;

    server.registerDevice(this.deviceId, clusterId, (msg) => {
      this.messageHandler?.(msg);
    });
  }

  /**
   * Connects to a remote public WebSocket relay server (e.g. wss://relay.clipsync.dev).
   */
  public async connectRemote(options: RemoteWebSocketClientOptions): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const cluster = options.clusterId ?? 'default-cluster';
    this.clusterId = cluster;

    const base = options.relayUrl.replace(/^http/, 'ws').replace(/\/$/, '');
    const fullUrl = `${base}?deviceId=${encodeURIComponent(options.deviceId)}&clusterId=${encodeURIComponent(cluster)}`;

    try {
      // Use isomorphic WebSocket (browser or Node/Bun global)
      const ws = new WebSocket(fullUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          const parsed = JSON.parse(raw) as ProtocolMessage;
          this.messageHandler?.(parsed);
        } catch {
          // Discard malformed packets
        }
      };

      ws.onerror = (err) => {
        this.connected = false;
        reject(err instanceof Error ? err : new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
      };
    } catch (err) {
      this.connected = false;
      reject(err instanceof Error ? err : new Error(String(err)));
    }

    return promise;
  }

  public disconnect(): void {
    if (this.server) {
      this.server.unregisterDevice(this.deviceId);
      this.server = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  public async send(message: ProtocolMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Cannot send packet: RelayClientTransport is disconnected');
    }

    if (this.server && this.clusterId) {
      this.server.forwardMessage(this.clusterId, message);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }

    throw new Error('No active relay connection to send packet');
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
