import { RawClipboardData } from './types.js';

export interface SensitiveFilterResult {
  isSensitive: boolean;
  reason?: string;
}

const PASSWORD_MANAGER_APPS: Record<string, true> = {
  '1password': true,
  'bitwarden': true,
  'keepass': true,
  'keepassxc': true,
  'lastpass': true,
  'dashlane': true,
  'enpass': true,
  'nordpass': true,
};

const SENSITIVE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/i,
  },
  {
    name: 'JWT / Bearer Token',
    pattern: /(?:Bearer\s+)?eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  },
  {
    name: 'AWS Access Key',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub Token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/,
  },
  {
    name: 'Stripe / Generic Secret Key',
    pattern: /\b(?:sk_live|rk_live)_[0-9a-zA-Z]{24,}\b/,
  },
];

export function inspectSensitiveContent(
  data: RawClipboardData,
  options: { ignorePasswordManagers?: boolean; ignoreAuthTokens?: boolean } = {}
): SensitiveFilterResult {
  const ignorePasswordManagers = options.ignorePasswordManagers ?? true;
  const ignoreAuthTokens = options.ignoreAuthTokens ?? true;

  // 1. Explicit concealment marker from OS / password manager
  if (data.isConcealed && ignorePasswordManagers) {
    return {
      isSensitive: true,
      reason: 'Concealed by password manager flag',
    };
  }

  // 2. Known password manager source application
  if (data.sourceApp && ignorePasswordManagers) {
    const normalizedApp = data.sourceApp.toLowerCase().trim();
    if (PASSWORD_MANAGER_APPS[normalizedApp]) {
      return {
        isSensitive: true,
        reason: `Ignored from password manager application: ${data.sourceApp}`,
      };
    }
  }

  // 3. Token & private key heuristics
  if (ignoreAuthTokens && data.contentType === 'text') {
    for (const { name, pattern } of SENSITIVE_PATTERNS) {
      if (pattern.test(data.content)) {
        return {
          isSensitive: true,
          reason: `Detected sensitive credential pattern: ${name}`,
        };
      }
    }
  }

  return { isSensitive: false };
}
