import { DeviceMetadata, DeviceStatus, DeviceTrustLevel } from '@clipsync/shared-types';

export class DeviceRegistry {
  private readonly devices = new Map<string, DeviceMetadata>();

  constructor(initialDevices: DeviceMetadata[] = []) {
    for (const dev of initialDevices) {
      this.devices.set(dev.id, dev);
    }
  }

  public getAllDevices(): DeviceMetadata[] {
    return Array.from(this.devices.values());
  }

  public getDevice(id: string): DeviceMetadata | null {
    return this.devices.get(id) ?? null;
  }

  public registerOrPairDevice(data: {
    id: string;
    name: string;
    platform: DeviceMetadata['platform'];
    appVersion: string;
    capabilities?: DeviceMetadata['capabilities'];
  }): DeviceMetadata {
    const existing = this.devices.get(data.id);
    const now = Date.now();

    const device: DeviceMetadata = {
      id: data.id,
      name: data.name,
      platform: data.platform,
      appVersion: data.appVersion,
      capabilities: data.capabilities ?? {
        backgroundClipboardMonitoring: data.platform !== 'web',
        osClipboardHook: ['macos', 'windows'].includes(data.platform),
        hybridCapture: data.platform === 'android',
        directFileAccess: data.platform !== 'web',
        browserRestricted: data.platform === 'web',
      },
      status: 'online',
      trustLevel: 'paired',
      lastSeenAt: now,
      registeredAt: existing ? existing.registeredAt : now,
    };

    this.devices.set(device.id, device);
    return device;
  }

  public updateDevice(
    id: string,
    updates: { name?: string; status?: DeviceStatus; trustLevel?: DeviceTrustLevel }
  ): DeviceMetadata | null {
    const device = this.devices.get(id);
    if (!device) {
      return null;
    }

    const updated: DeviceMetadata = {
      ...device,
      ...(updates.name ? { name: updates.name } : {}),
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.trustLevel ? { trustLevel: updates.trustLevel } : {}),
      lastSeenAt: Date.now(),
    };

    this.devices.set(id, updated);
    return updated;
  }

  public revokeDevice(id: string): boolean {
    return this.devices.delete(id);
  }
}
