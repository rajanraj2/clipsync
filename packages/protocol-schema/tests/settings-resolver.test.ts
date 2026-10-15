import { describe, expect, it } from 'bun:test';
import { PlatformCapabilities } from '@clipsync/shared-types';
import {
  resolveSetting,
  SecurityPolicyViolationError,
  ValidationError,
} from '../src/index.js';

describe('Settings Resolver & Precedence', () => {
  it('resolves application default when no overrides exist', () => {
    const result = resolveSetting<boolean>({
      key: 'sync.automatic',
    });

    expect(result.key).toBe('sync.automatic');
    expect(result.value).toBe(true);
    expect(result.source).toBe('application_default');
    expect(result.platformPermitted).toBe(true);
  });

  it('user preference overrides application default', () => {
    const result = resolveSetting<boolean>({
      key: 'sync.automatic',
      userPreferences: {
        'sync.automatic': false,
      },
    });

    expect(result.value).toBe(false);
    expect(result.source).toBe('user_preference');
  });

  it('device override takes precedence over user preference', () => {
    const result = resolveSetting<boolean>({
      key: 'sync.automatic',
      userPreferences: {
        'sync.automatic': false,
      },
      deviceOverrides: {
        'sync.automatic': true,
      },
    });

    expect(result.value).toBe(true);
    expect(result.source).toBe('device_override');
  });

  it('mandatory security policies cannot be weakened by user preferences', () => {
    expect(() => {
      resolveSetting({
        key: 'security.encryptedCommunication',
        userPreferences: {
          'security.encryptedCommunication': false,
        },
      });
    }).toThrow(SecurityPolicyViolationError);
  });

  it('mandatory security policies cannot be weakened by device overrides', () => {
    expect(() => {
      resolveSetting({
        key: 'security.encryptedLocalStorage',
        deviceOverrides: {
          'security.encryptedLocalStorage': false,
        },
      });
    }).toThrow(SecurityPolicyViolationError);
  });

  it('rejects unknown setting keys', () => {
    expect(() => {
      resolveSetting({ key: 'invalid.setting.key' });
    }).toThrow(ValidationError);
  });

  it('flags platform limitation when background sync is requested on web browser', () => {
    const webCapabilities: PlatformCapabilities = {
      backgroundClipboardMonitoring: false,
      osClipboardHook: false,
      hybridCapture: false,
      directFileAccess: false,
      browserRestricted: true,
    };

    const result = resolveSetting<boolean>({
      key: 'sync.automatic',
      platformCapabilities: webCapabilities,
    });

    expect(result.value).toBe(true);
    expect(result.platformPermitted).toBe(false);
    expect(result.platformLimitationReason).toContain('Web environment cannot continuously monitor clipboard');
  });

  it('permits background sync when platform supports it (native desktop)', () => {
    const desktopCapabilities: PlatformCapabilities = {
      backgroundClipboardMonitoring: true,
      osClipboardHook: true,
      hybridCapture: false,
      directFileAccess: true,
      browserRestricted: false,
    };

    const result = resolveSetting<boolean>({
      key: 'sync.automatic',
      platformCapabilities: desktopCapabilities,
    });

    expect(result.value).toBe(true);
    expect(result.platformPermitted).toBe(true);
    expect(result.platformLimitationReason).toBeUndefined();
  });
});
