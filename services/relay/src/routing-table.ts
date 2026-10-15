import { ProtocolMessage } from '@clipsync/shared-types';

export type SendPacketFn = (message: ProtocolMessage) => void;

interface DeviceRoute {
  deviceId: string;
  clusterId: string;
  send: SendPacketFn;
  connectedAt: number;
}

export class RelayRoutingTable {
  private readonly routes = new Map<string, DeviceRoute>();
  private readonly clusterMembers = new Map<string, Set<string>>();

  public register(deviceId: string, clusterId: string, send: SendPacketFn): void {
    // Unregister existing route for this device if reconnecting
    this.unregister(deviceId);

    this.routes.set(deviceId, {
      deviceId,
      clusterId,
      send,
      connectedAt: Date.now(),
    });

    let members = this.clusterMembers.get(clusterId);
    if (!members) {
      members = new Set();
      this.clusterMembers.set(clusterId, members);
    }
    members.add(deviceId);
  }

  public unregister(deviceId: string): boolean {
    const route = this.routes.get(deviceId);
    if (!route) {
      return false;
    }

    this.routes.delete(deviceId);

    const members = this.clusterMembers.get(route.clusterId);
    if (members) {
      members.delete(deviceId);
      if (members.size === 0) {
        this.clusterMembers.delete(route.clusterId);
      }
    }

    return true;
  }

  public getRoute(deviceId: string): SendPacketFn | null {
    const route = this.routes.get(deviceId);
    return route ? route.send : null;
  }

  public getClusterRoutes(clusterId: string, excludeDeviceId?: string): SendPacketFn[] {
    const members = this.clusterMembers.get(clusterId);
    if (!members) {
      return [];
    }

    const sends: SendPacketFn[] = [];
    for (const devId of members) {
      if (devId !== excludeDeviceId) {
        const route = this.routes.get(devId);
        if (route) {
          sends.push(route.send);
        }
      }
    }
    return sends;
  }

  public isConnected(deviceId: string): boolean {
    return this.routes.has(deviceId);
  }

  public getConnectedDevicesCount(): number {
    return this.routes.size;
  }
}
