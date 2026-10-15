export type DevicePlatform = 'macos' | 'windows' | 'linux' | 'android' | 'web';

export type DeviceStatus = 'online' | 'offline' | 'syncing' | 'error';

export type DeviceTrustLevel = 'pending' | 'paired' | 'revoked';

export interface PlatformCapabilities {
  /** Background clipboard monitoring capability */
  backgroundClipboardMonitoring: boolean;
  /** Full OS clipboard hook (read/write system clipboard without UI focus) */
  osClipboardHook: boolean;
  /** Hybrid capture (e.g. Android foreground/Sharesheet) */
  hybridCapture: boolean;
  /** Direct native file system access */
  directFileAccess: boolean;
  /** Browser-restricted clipboard access (requires active tab / user gesture) */
  browserRestricted: boolean;
}

export interface DeviceMetadata {
  id: string;
  name: string;
  platform: DevicePlatform;
  appVersion: string;
  osVersion?: string;
  capabilities: PlatformCapabilities;
  status: DeviceStatus;
  trustLevel: DeviceTrustLevel;
  lastSeenAt: number;
  registeredAt: number;
}
