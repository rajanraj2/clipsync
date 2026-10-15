import { PlatformCapabilities } from '@clipsync/shared-types';
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
export declare function resolveSetting<T = unknown>(options: ResolveSettingOptions): ResolvedSettingResult<T>;
//# sourceMappingURL=settings-resolver.d.ts.map