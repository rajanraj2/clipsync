export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface ClipboardDiagnosticsResult {
  readPermission: PermissionState;
  writePermission: PermissionState;
  notificationsPermission: PermissionState;
  isSecureContext: boolean;
  isStandalonePwa: boolean;
}

export async function queryClipboardDiagnostics(): Promise<ClipboardDiagnosticsResult> {
  const isSecure = typeof window !== 'undefined' && window.isSecureContext;
  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  let readPermission: PermissionState = 'unsupported';
  let writePermission: PermissionState = 'unsupported';

  if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
    try {
      const readStatus = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      readPermission = readStatus.state;
    } catch {
      readPermission = 'prompt';
    }

    try {
      const writeStatus = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
      writePermission = writeStatus.state;
    } catch {
      writePermission = 'granted'; // Writing to clipboard is usually permitted on user gesture
    }
  }

  let notifState: PermissionState = 'unsupported';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    notifState = Notification.permission as PermissionState;
  }

  return {
    readPermission,
    writePermission,
    notificationsPermission: notifState,
    isSecureContext: isSecure,
    isStandalonePwa: isStandalone,
  };
}

export async function readBrowserClipboard(): Promise<{ text: string | null; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
    return { text: null, error: 'Clipboard API not supported in this browser context' };
  }

  try {
    const text = await navigator.clipboard.readText();
    return { text };
  } catch (err) {
    return {
      text: null,
      error: err instanceof Error ? err.message : 'User denied clipboard permission or tab inactive',
    };
  }
}

export async function writeBrowserClipboard(text: string): Promise<{ success: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
    return { success: false, error: 'Clipboard API not supported in this browser context' };
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to write to clipboard',
    };
  }
}
