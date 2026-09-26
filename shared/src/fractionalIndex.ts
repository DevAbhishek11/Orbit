const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const MID_CHAR = "V";

export const MAX_ORDER_KEY_LENGTH = 60;

function digitValue(char: string): number {
  const v = DIGITS.indexOf(char);
  if (v === -1)
    throw new Error(`fractionalIndex: invalid order-key character "${char}"`);
  return v;
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isValidOrderKey(key: string): boolean {
  if (key.length === 0 || key.length > MAX_ORDER_KEY_LENGTH) return false;
  if (key.endsWith("0")) return false;
  for (const ch of key) if (DIGITS.indexOf(ch) === -1) return false;
  return true;
}

export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null) {
    if (a === b)
      throw new Error("fractionalIndex: equal neighbours cannot be ordered");
    if (!isBefore(a, b))
      throw new Error("fractionalIndex: neighbours are out of order");
  }
  if (a !== null && !isValidOrderKey(a))
    throw new Error(`fractionalIndex: invalid key "${a}"`);
  if (b !== null && !isValidOrderKey(b))
    throw new Error(`fractionalIndex: invalid key "${b}"`);

  const result = midpoint(a ?? "", b);
  if (result.length > MAX_ORDER_KEY_LENGTH) {
    throw new Error(
      "fractionalIndex: order key exhausted — rebalance required",
    );
  }
  return result;
}

function midpoint(a: string, b: string | null): string {
  let prefix = "";
  for (let i = 0; ; i++) {
    const da = i < a.length ? digitValue(a[i]!) : 0;
    const db =
      b === null ? (i === 0 ? BASE : 0) : i < b.length ? digitValue(b[i]!) : 0;

    if (db - da > 1) {
      const mid = da + Math.floor((db - da) / 2);
      return prefix + DIGITS[mid]!;
    }
    if (db - da === 1) {
      return prefix + DIGITS[da]! + midpoint(a.slice(i + 1), null);
    }
    if (da === db) {
      prefix += DIGITS[da]!;
      continue;
    }

    throw new Error("fractionalIndex: internal ordering violation");
  }
}

export function firstKey(): string {
  return MID_CHAR;
}

export function incrementKey(last: string): string {
  return keyBetween(last, null);
}

export function decrementKey(first: string): string {
  return keyBetween(null, first);
}

export function evenKeys(count: number): string[] {
  if (count < 0 || !Number.isInteger(count))
    throw new Error("fractionalIndex: count must be ≥ 0");
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    keys.push(rationalToKey(i, count + 1));
  }
  return keys;
}

function rationalToKey(num: number, den: number): string {
  let out = "";
  let remainder = num;
  for (let i = 0; i < MAX_ORDER_KEY_LENGTH; i++) {
    remainder *= BASE;
    const digit = Math.floor(remainder / den);
    remainder = remainder % den;
    out += DIGITS[digit]!;
    if (remainder === 0) break;
  }

  return out.replace(/0+$/, "") || MID_CHAR;
}
