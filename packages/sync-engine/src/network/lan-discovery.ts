import { DeviceMetadata } from '@clipsync/shared-types';

export interface LanPeer {
  device: DeviceMetadata;
  ipAddress: string;
  port: number;
  lastSeenAt: number;
}

export class LanDiscoveryService {
  private readonly peers = new Map<string, LanPeer>();
  private readonly listeners = new Set<(peer: LanPeer) => void>();

  constructor(
    private readonly localDevice: DeviceMetadata,
    private readonly peerTtlMs: number = 30_000
  ) {}

  public recordPeerAnnounce(peerDevice: DeviceMetadata, ipAddress: string, port: number): void {
    if (peerDevice.id === this.localDevice.id) {
      return;
    }

    const peer: LanPeer = {
      device: peerDevice,
      ipAddress,
      port,
      lastSeenAt: Date.now(),
    };

    const isNew = !this.peers.has(peerDevice.id);
    this.peers.set(peerDevice.id, peer);

    if (isNew) {
      for (const listener of this.listeners) {
        try {
          listener(peer);
        } catch {
          // Ignore listener failures
        }
      }
    }
  }

  public getOnlineLanPeers(): LanPeer[] {
    const now = Date.now();
    const active: LanPeer[] = [];

    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeenAt <= this.peerTtlMs) {
        active.push(peer);
      } else {
        this.peers.delete(id);
      }
    }

    return active;
  }

  public isPeerOnLan(deviceId: string): boolean {
    const peer = this.peers.get(deviceId);
    if (!peer) return false;
    return Date.now() - peer.lastSeenAt <= this.peerTtlMs;
  }

  public onPeerDiscovered(callback: (peer: LanPeer) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}
