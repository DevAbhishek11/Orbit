/**
 * Password hashing + policy (BUILD_PROMPT Phase 3):
 *  - argon2id with env-driven parameters (memoryCost in KiB, timeCost, parallelism)
 *  - policy: ≥12 chars, not a common password, no email/handle substring
 * Hash verification is timing-safe inside @node-rs/argon2.
 */
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { env } from '../../config/env.js';

// Small embedded blocklist — a full corpus (HaveIBeenPwned k-anonymity)
// belongs behind a queue job; this stops the obvious cases synchronously.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  '1234567890', 'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome',
  'welcome1', 'admin', 'admin123', 'iloveyou', 'monkey', 'dragon',
  'sunshine', 'princess', 'football', 'baseball', 'superman', 'batman',
  'trustno1', 'changeme', 'changeme123', 'orbit12345', 'qwertyuiop',
  'passw0rd', 'password!', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'secret',
]);

export interface PasswordPolicyResult {
  ok: boolean;
  reasons: string[];
}

export function checkPasswordPolicy(password: string, context: { email?: string; handle?: string; name?: string }): PasswordPolicyResult {
  const reasons: string[] = [];
  if (password.length < 12) reasons.push('Password must be at least 12 characters');
  if (password.length > 128) reasons.push('Password must be at most 128 characters');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) reasons.push('Password is too common');

  const lowered = password.toLowerCase();
  for (const [field, value] of Object.entries(context)) {
    if (!value) continue;
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.length >= 4 && lowered.includes(normalized)) {
      reasons.push(`Password must not contain your ${field}`);
    }
  }
  // Require at least two character classes beyond length (light-touch, NIST-aligned).
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 2) reasons.push('Password must mix at least two character classes (letters, digits, symbols)');

  return { ok: reasons.length === 0, reasons };
}

export async function hashPassword(password: string): Promise<string> {
  // Algorithm defaults to Argon2id in @node-rs/argon2 (the recommended hybrid).
  return argon2Hash(password, {
    memoryCost: env.ARGON2_MEMORY_KIB,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify(passwordHash, password);
  } catch {
    // Malformed stored hash — treat as a failed verification, never crash.
    return false;
  }
}

/**
 * Dummy hash used to keep login timing uniform for unknown emails
 * (timing-safe login, BUILD_PROMPT Phase 3 item 4). Computed once at boot.
 */
let dummyHash: string | null = null;

export async function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = await hashPassword('orbit-timing-equalizer-dummy-password');
  }
  return dummyHash;
}
