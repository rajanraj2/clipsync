import { ProtocolMessage } from '@clipsync/shared-types';
import { SyncTransport } from '../types.js';
import { LanDiscoveryService } from './lan-discovery.js';
import { RelayClientTransport } from './relay-client-transport.js';

export interface HybridRouterOptions {
  localDeviceId: string;
  lanDiscovery: LanDiscoveryService;
  relayTransport: RelayClientTransport;
  directLanTransport?: SyncTransport;
  preferLan?: boolean;
}

export class HybridNetworkRouter implements SyncTransport {
  public readonly transportId: string;
  private readonly lanDiscovery: LanDiscoveryService;
  private readonly relayTransport: RelayClientTransport;
  private readonly directLanTransport?: SyncTransport;
  private readonly preferLan: boolean;
  private messageHandler: ((message: ProtocolMessage) => void) | null = null;
  private lastRouteUsed: 'lan' | 'relay' | null = null;

  constructor(options: HybridRouterOptions) {
    this.transportId = `hybrid-router-${options.localDeviceId}`;
    this.lanDiscovery = options.lanDiscovery;
    this.relayTransport = options.relayTransport;
    this.directLanTransport = options.directLanTransport;
    this.preferLan = options.preferLan ?? true;

    // Listen to inbound messages from both transports
    this.relayTransport.onMessage((msg) => {
      this.messageHandler?.(msg);
    });

    if (this.directLanTransport) {
      this.directLanTransport.onMessage((msg) => {
        this.messageHandler?.(msg);
      });
    }
  }

  public async send(message: ProtocolMessage): Promise<void> {
    const targetId = message.targetDeviceId;

    // 1. If unicast to a target peer that is currently active on local LAN, prefer direct LAN route
    if (this.preferLan && targetId && this.lanDiscovery.isPeerOnLan(targetId) && this.directLanTransport) {
      try {
        await this.directLanTransport.send(message);
        this.lastRouteUsed = 'lan';
        return;
      } catch {
        // Direct LAN failed: fall through to encrypted relay fallback
      }
    }

    // 2. Relay fallback (Cross-network, NAT traversal, or LAN unavailable)
    if (this.relayTransport.isConnected()) {
      await this.relayTransport.send(message);
      this.lastRouteUsed = 'relay';
      return;
    }

    // 3. Fallback to direct LAN if relay disconnected and direct transport exists
    if (this.directLanTransport) {
      await this.directLanTransport.send(message);
      this.lastRouteUsed = 'lan';
      return;
    }

    throw new Error('All network transports (LAN direct and Relay) are currently disconnected');
  }

  public onMessage(handler: (message: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }

  public getLastRouteUsed(): 'lan' | 'relay' | null {
    return this.lastRouteUsed;
  }
}
