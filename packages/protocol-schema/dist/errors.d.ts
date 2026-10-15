export declare class ProtocolError extends Error {
    readonly code: string;
    constructor(message: string, code?: string);
}
export declare class ValidationError extends ProtocolError {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
export declare class VersionMismatchError extends ProtocolError {
    readonly expected: string;
    readonly received: string;
    constructor(expected: string, received: string);
}
export declare class SecurityPolicyViolationError extends ProtocolError {
    readonly settingKey: string;
    constructor(settingKey: string, message: string);
}
//# sourceMappingURL=errors.d.ts.map