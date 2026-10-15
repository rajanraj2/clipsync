import { PlatformCapabilities } from '@clipsync/shared-types';
import { SETTING_DEFINITIONS } from './settings-catalog.js';
import { SecurityPolicyViolationError, ValidationError } from './errors.js';

const MANDATORY_SECURITY_POLICIES: Record<string, unknown> = {
  'security.encryptedCommunication': true,
  'security.encryptedLocalStorage': true,
};

export interface ResolveSettingOptions {
  key: string;
  deviceId?: string;
  deviceOverrides?: Record<string, unknown>;
  userPreferences?: Record<string, unknown>;
  platformCapabilities?: PlatformCapabilities;
}

export interface ResolvedSettingResult<T = unknown> {
  key: string;
  value: T;
  source: 'security_enforced' | 'device_override' | 'user_preference' | 'application_default';
  platformPermitted: boolean;
  platformLimitationReason?: string;
}

export function resolveSetting<T = unknown>(options: ResolveSettingOptions): ResolvedSettingResult<T> {
  const { key, deviceOverrides, userPreferences, platformCapabilities } = options;
  const definition = SETTING_DEFINITIONS[key];

  if (!definition) {
    throw new ValidationError(`Unknown setting key: "${key}"`, 'key');
  }

  // 1. Mandatory security policy precedence (Cannot be weakened or overridden)
  if (key in MANDATORY_SECURITY_POLICIES) {
    const enforcedValue = MANDATORY_SECURITY_POLICIES[key] as T;

    if (userPreferences && key in userPreferences && userPreferences[key] !== enforcedValue) {
      throw new SecurityPolicyViolationError(
        key,
        'Cannot override mandatory security policy in user preferences'
      );
    }
    if (deviceOverrides && key in deviceOverrides && deviceOverrides[key] !== enforcedValue) {
      throw new SecurityPolicyViolationError(
        key,
        'Cannot override mandatory security policy in device overrides'
      );
    }

    return {
      key,
      value: enforcedValue,
      source: 'security_enforced',
      platformPermitted: true,
    };
  }

  // Determine candidate value by precedence: Device Override > User Preference > Application Default
  let value: T = definition.defaultValue as T;
  let source: ResolvedSettingResult['source'] = 'application_default';

  if (definition.isDeviceOverridable && deviceOverrides && key in deviceOverrides) {
    value = deviceOverrides[key] as T;
    source = 'device_override';
  } else if (definition.isUserConfigurable && userPreferences && key in userPreferences) {
    value = userPreferences[key] as T;
    source = 'user_preference';
  }

  // Check platform capability restrictions
  let platformPermitted = true;
  let platformLimitationReason: string | undefined;

  if (platformCapabilities) {
    // If background sync is enabled, verify platform actually supports background monitoring
    if (key === 'sync.automatic' && value === true && !platformCapabilities.backgroundClipboardMonitoring) {
      platformPermitted = false;
      platformLimitationReason = platformCapabilities.browserRestricted
        ? 'Web environment cannot continuously monitor clipboard in background (requires foreground interaction)'
        : 'Platform does not support background clipboard monitoring';
    }

    // Direct file access capability
    if (key === 'sync.file' && value === true && !platformCapabilities.directFileAccess) {
      platformPermitted = false;
      platformLimitationReason = 'Environment does not support direct background file system access';
    }
  }

  return {
    key,
    value,
    source,
    platformPermitted,
    ...(platformLimitationReason ? { platformLimitationReason } : {}),
  };
}
