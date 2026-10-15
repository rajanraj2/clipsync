"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityPolicyViolationError = exports.VersionMismatchError = exports.ValidationError = exports.ProtocolError = void 0;
class ProtocolError extends Error {
    code;
    constructor(message, code = 'PROTOCOL_ERROR') {
        super(message);
        this.code = code;
        this.name = 'ProtocolError';
    }
}
exports.ProtocolError = ProtocolError;
class ValidationError extends ProtocolError {
    field;
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR');
        this.field = field;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class VersionMismatchError extends ProtocolError {
    expected;
    received;
    constructor(expected, received) {
        super(`Protocol version mismatch: expected ${expected}, received ${received}`, 'VERSION_MISMATCH');
        this.expected = expected;
        this.received = received;
        this.name = 'VersionMismatchError';
    }
}
exports.VersionMismatchError = VersionMismatchError;
class SecurityPolicyViolationError extends ProtocolError {
    settingKey;
    constructor(settingKey, message) {
        super(`Security policy violation for '${settingKey}': ${message}`, 'SECURITY_POLICY_VIOLATION');
        this.settingKey = settingKey;
        this.name = 'SecurityPolicyViolationError';
    }
}
exports.SecurityPolicyViolationError = SecurityPolicyViolationError;
//# sourceMappingURL=errors.js.map