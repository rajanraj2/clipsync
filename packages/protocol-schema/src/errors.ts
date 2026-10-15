export class ProtocolError extends Error {
  constructor(message: string, public readonly code: string = 'PROTOCOL_ERROR') {
    super(message);
    this.name = 'ProtocolError';
  }
}

export class ValidationError extends ProtocolError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class VersionMismatchError extends ProtocolError {
  constructor(public readonly expected: string, public readonly received: string) {
    super(
      `Protocol version mismatch: expected ${expected}, received ${received}`,
      'VERSION_MISMATCH'
    );
    this.name = 'VersionMismatchError';
  }
}

export class SecurityPolicyViolationError extends ProtocolError {
  constructor(public readonly settingKey: string, message: string) {
    super(
      `Security policy violation for '${settingKey}': ${message}`,
      'SECURITY_POLICY_VIOLATION'
    );
    this.name = 'SecurityPolicyViolationError';
  }
}

export class ConcurrencyConflictError extends ProtocolError {
  constructor(public readonly expectedVersion: number, public readonly currentVersion: number) {
    super(
      `Optimistic concurrency conflict: expected config version ${expectedVersion}, but current version is ${currentVersion}`,
      'CONCURRENCY_CONFLICT'
    );
    this.name = 'ConcurrencyConflictError';
  }
}
