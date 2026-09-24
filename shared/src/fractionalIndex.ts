/**
 * Fractional string ordering (BUILD_PROMPT rule 9, Phase 6).
 *
 * Keys are base-62 fractions in (0, 1) rendered over the alphabet
 * '0'-'9' 'A'-'Z' 'a'-'z' (digit value 0..61, which matches both JS
 * lexicographic string order and MongoDB's byte-wise BSON string order).
 *
 * Invariants:
 *  - keyBetween(prev, next) returns a key strictly between its neighbours
 *  - generated keys are canonical: never end in '0' (no trailing zero digits),
 *    so lexicographic compare === numeric compare, always
 *  - a move/insert is ONE document write — no renumbering of siblings
 *  - when a key would exceed MAX_ORDER_KEY_LENGTH the caller must trigger a
 *    rebalance (evenKeys) — see ORDER_KEY_EXHAUSTED in the error catalogue
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length; // 62
const MID_CHAR = 'V'; // digit 31 — the middle of the alphabet

/** Hard cap before a rebalance is required (BUILD_PROMPT: 60 chars). */
export const MAX_ORDER_KEY_LENGTH = 60;

function digitValue(char: string): number {
  const v = DIGITS.indexOf(char);
  if (v === -1) throw new Error(`fractionalIndex: invalid order-key character "${char}"`);
  return v;
}

/** True when `a` sorts strictly before `b` (plain lexicographic on canonical keys). */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isValidOrderKey(key: string): boolean {
  if (key.length === 0 || key.length > MAX_ORDER_KEY_LENGTH) return false;
  if (key.endsWith('0')) return false;
  for (const ch of key) if (DIGITS.indexOf(ch) === -1) return false;
  return true;
}

/**
 * Midpoint between two canonical keys.
 * `a === null` means "the very beginning" (0), `b === null` means "the very end" (1).
 * Throws when neighbours are out of order (caller maps to ORDER_CONFLICT).
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null) {
    if (a === b) throw new Error('fractionalIndex: equal neighbours cannot be ordered');
    if (!isBefore(a, b)) throw new Error('fractionalIndex: neighbours are out of order');
  }
  if (a !== null && !isValidOrderKey(a)) throw new Error(`fractionalIndex: invalid key "${a}"`);
  if (b !== null && !isValidOrderKey(b)) throw new Error(`fractionalIndex: invalid key "${b}"`);

  const result = midpoint(a ?? '', b);
  if (result.length > MAX_ORDER_KEY_LENGTH) {
    throw new Error('fractionalIndex: order key exhausted — rebalance required');
  }
  return result;
}

/**
 * Digit-average `a` (canonical, possibly empty = 0) and `b` (canonical, null = 1).
 * Walks digits until it finds a position with room for a strict middle digit;
 * when digits are adjacent it copies the lower digit and recurses into the tail.
 */
function midpoint(a: string, b: string | null): string {
  // b === null represents 1.0: digit BASE at position 0, then zeros.
  let prefix = '';
  for (let i = 0; ; i++) {
    const da = i < a.length ? digitValue(a[i]!) : 0;
    const db = b === null ? (i === 0 ? BASE : 0) : i < b.length ? digitValue(b[i]!) : 0;

    if (db - da > 1) {
      const mid = da + Math.floor((db - da) / 2);
      return prefix + DIGITS[mid]!;
    }
    if (db - da === 1) {
      // No digit fits here; keep the lower digit and average a's tail with 1.0.
      return prefix + DIGITS[da]! + midpoint(a.slice(i + 1), null);
    }
    if (da === db) {
      prefix += DIGITS[da]!;
      continue;
    }
    // da > db is unreachable: keyBetween validated a < b (and b=null ⇒ db ≥ da).
    throw new Error('fractionalIndex: internal ordering violation');
  }
}

/** The key placed at the very end (0.5) — first item of an empty list. */
export function firstKey(): string {
  return MID_CHAR;
}

/** Key strictly after `last`. */
export function incrementKey(last: string): string {
  return keyBetween(last, null);
}

/** Key strictly before `first`. */
export function decrementKey(first: string): string {
  return keyBetween(null, first);
}

/**
 * `count` evenly spaced canonical keys — used by the rebalance job to
 * renumber a whole list in one transaction when keys grow too long.
 */
export function evenKeys(count: number): string[] {
  if (count < 0 || !Number.isInteger(count)) throw new Error('fractionalIndex: count must be ≥ 0');
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    keys.push(rationalToKey(i, count + 1));
  }
  return keys;
}

/** Render the fraction num/den (0 < num < den) as a canonical base-62 fraction. */
function rationalToKey(num: number, den: number): string {
  let out = '';
  let remainder = num;
  for (let i = 0; i < MAX_ORDER_KEY_LENGTH; i++) {
    remainder *= BASE;
    const digit = Math.floor(remainder / den);
    remainder = remainder % den;
    out += DIGITS[digit]!;
    if (remainder === 0) break;
  }
  // Strip trailing zeros to keep the key canonical (value unchanged).
  return out.replace(/0+$/, '') || MID_CHAR;
}
