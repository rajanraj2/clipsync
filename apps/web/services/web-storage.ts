import { DeviceMetadata, HistoryPolicy } from '@clipsync/shared-types';

export function computeWebSha256(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface WebClipItem {
  id: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  contentType: 'text' | 'url' | 'image' | 'file';
  content: string;
  preview?: string;
  sizeBytes: number;
  hash: string;
  isPinned: boolean;
  isFavourite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebUserSession {
  userId: string;
  userName: string;
  currentDevice: DeviceMetadata;
  createdAt: number;
  relayUrl: string;
}

const STORAGE_KEY_SESSION = 'clipsync_web_session';
const STORAGE_KEY_ITEMS = 'clipsync_web_items';
const STORAGE_KEY_DEVICES = 'clipsync_web_devices';
const STORAGE_KEY_POLICY = 'clipsync_web_policy';
const STORAGE_KEY_SYNC_STATE = 'clipsync_web_sync_active';

export function getOrCreateWebSession(): WebUserSession {
  if (typeof window === 'undefined') {
    return createDefaultSession();
  }

  const existing = localStorage.getItem(STORAGE_KEY_SESSION);
  if (existing) {
    try {
      return JSON.parse(existing) as WebUserSession;
    } catch {
      // Fall through to create fresh
    }
  }

  const session = createDefaultSession();
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  return session;
}

function createDefaultSession(): WebUserSession {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const deviceId = `web-${randomSuffix}`;
  const now = Date.now();

  const currentDevice: DeviceMetadata = {
    id: deviceId,
    name: 'Browser Web Client',
    platform: 'web',
    appVersion: '0.1.0',
    capabilities: {
      backgroundClipboardMonitoring: false,
      osClipboardHook: false,
      hybridCapture: false,
      directFileAccess: false,
      browserRestricted: true,
    },
    status: 'online',
    trustLevel: 'paired',
    lastSeenAt: now,
    registeredAt: now,
  };

  return {
    userId: `user-${randomSuffix}`,
    userName: 'Local User',
    currentDevice,
    createdAt: now,
    relayUrl: 'https://relay.clipsync.dev',
  };
}

export function saveWebSession(session: WebUserSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
}

export function loadWebClips(): WebClipItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WebClipItem[];
  } catch {
    return [];
  }
}

export function saveWebClips(items: WebClipItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
}

export function addWebClip(
  content: string,
  sourceDevice: DeviceMetadata
): WebClipItem {
  const trimmed = content.trim();
  const isUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed);
  const contentType = isUrl ? 'url' : 'text';
  const hash = computeWebSha256(content);
  const now = Date.now();

  const items = loadWebClips();
  const existingIdx = items.findIndex((i) => i.hash === hash);

  if (existingIdx !== -1) {
    // Elevate duplicate to top
    const existing = items[existingIdx];
    existing.updatedAt = now;
    items.splice(existingIdx, 1);
    items.unshift(existing);
    saveWebClips(items);
    return existing;
  }

  const newItem: WebClipItem = {
    id: `clip-${sourceDevice.id}-${now}-${Math.random().toString(36).substring(2, 6)}`,
    sourceDeviceId: sourceDevice.id,
    sourceDeviceName: sourceDevice.name,
    contentType,
    content,
    sizeBytes: new TextEncoder().encode(content).length,
    hash,
    isPinned: false,
    isFavourite: false,
    createdAt: now,
    updatedAt: now,
  };

  items.unshift(newItem);
  saveWebClips(items);
  return newItem;
}

export function deleteWebClip(id: string): void {
  const items = loadWebClips().filter((i) => i.id !== id);
  saveWebClips(items);
}

export function clearAllWebClips(): void {
  saveWebClips([]);
}

export function togglePinWebClip(id: string): WebClipItem | null {
  const items = loadWebClips();
  const target = items.find((i) => i.id === id);
  if (!target) return null;
  target.isPinned = !target.isPinned;
  target.updatedAt = Date.now();
  saveWebClips(items);
  return target;
}

export function toggleFavWebClip(id: string): WebClipItem | null {
  const items = loadWebClips();
  const target = items.find((i) => i.id === id);
  if (!target) return null;
  target.isFavourite = !target.isFavourite;
  target.updatedAt = Date.now();
  saveWebClips(items);
  return target;
}

export function loadPairedDevices(): DeviceMetadata[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY_DEVICES);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DeviceMetadata[];
  } catch {
    return [];
  }
}

export function savePairedDevices(devices: DeviceMetadata[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
}

export function pairNewDevice(device: Omit<DeviceMetadata, 'registeredAt' | 'lastSeenAt'>): DeviceMetadata {
  const devices = loadPairedDevices();
  const now = Date.now();
  const newDev: DeviceMetadata = {
    ...device,
    registeredAt: now,
    lastSeenAt: now,
  };
  const filtered = devices.filter((d) => d.id !== device.id);
  filtered.push(newDev);
  savePairedDevices(filtered);
  return newDev;
}

export function removePairedDevice(deviceId: string): void {
  const devices = loadPairedDevices().filter((d) => d.id !== deviceId);
  savePairedDevices(devices);
}

export function loadHistoryPolicy(): HistoryPolicy {
  if (typeof window === 'undefined') {
    return {
      id: 'default',
      retentionDays: 30,
      unlimitedRetention: false,
      maxItems: 5000,
      maxStorageBytes: 1024 * 1024 * 1024,
      cleanupEnabled: true,
      updatedAt: Date.now(),
    };
  }

  const raw = localStorage.getItem(STORAGE_KEY_POLICY);
  if (!raw) {
    return {
      id: 'default',
      retentionDays: 30,
      unlimitedRetention: false,
      maxItems: 5000,
      maxStorageBytes: 1024 * 1024 * 1024,
      cleanupEnabled: true,
      updatedAt: Date.now(),
    };
  }
  try {
    return JSON.parse(raw) as HistoryPolicy;
  } catch {
    return {
      id: 'default',
      retentionDays: 30,
      unlimitedRetention: false,
      maxItems: 5000,
      maxStorageBytes: 1024 * 1024 * 1024,
      cleanupEnabled: true,
      updatedAt: Date.now(),
    };
  }
}

export function saveHistoryPolicy(policy: HistoryPolicy): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_POLICY, JSON.stringify(policy));
}

export function getSyncActiveState(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(STORAGE_KEY_SYNC_STATE);
  return raw !== 'false';
}

export function setSyncActiveState(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SYNC_STATE, active ? 'true' : 'false');
}
