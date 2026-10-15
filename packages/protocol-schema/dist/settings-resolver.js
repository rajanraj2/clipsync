"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSetting = resolveSetting;
const settings_catalog_js_1 = require("./settings-catalog.js");
const errors_js_1 = require("./errors.js");
const MANDATORY_SECURITY_POLICIES = {
    'security.encryptedCommunication': true,
    'security.encryptedLocalStorage': true,
};
function resolveSetting(options) {
    const { key, deviceOverrides, userPreferences, platformCapabilities } = options;
    const definition = settings_catalog_js_1.SETTING_DEFINITIONS[key];
    if (!definition) {
        throw new errors_js_1.ValidationError(`Unknown setting key: "${key}"`, 'key');
    }
    // 1. Mandatory security policy precedence (Cannot be weakened or overridden)
    if (key in MANDATORY_SECURITY_POLICIES) {
        const enforcedValue = MANDATORY_SECURITY_POLICIES[key];
        if (userPreferences && key in userPreferences && userPreferences[key] !== enforcedValue) {
            throw new errors_js_1.SecurityPolicyViolationError(key, 'Cannot override mandatory security policy in user preferences');
        }
        if (deviceOverrides && key in deviceOverrides && deviceOverrides[key] !== enforcedValue) {
            throw new errors_js_1.SecurityPolicyViolationError(key, 'Cannot override mandatory security policy in device overrides');
        }
        return {
            key,
            value: enforcedValue,
            source: 'security_enforced',
            platformPermitted: true,
        };
    }
    // Determine candidate value by precedence: Device Override > User Preference > Application Default
    let value = definition.defaultValue;
    let source = 'application_default';
    if (definition.isDeviceOverridable && deviceOverrides && key in deviceOverrides) {
        value = deviceOverrides[key];
        source = 'device_override';
    }
    else if (definition.isUserConfigurable && userPreferences && key in userPreferences) {
        value = userPreferences[key];
        source = 'user_preference';
    }
    // Check platform capability restrictions
    let platformPermitted = true;
    let platformLimitationReason;
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
//# sourceMappingURL=settings-resolver.js.map