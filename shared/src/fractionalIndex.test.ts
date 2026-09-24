import { describe, expect, it } from 'vitest';
import {
  MAX_ORDER_KEY_LENGTH,
  decrementKey,
  evenKeys,
  firstKey,
  incrementKey,
  isBefore,
  isValidOrderKey,
  keyBetween,
} from './fractionalIndex.js';

/** Deterministic PRNG (mulberry32) so property tests are reproducible. */
function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('fractionalIndex', () => {
  it('produces the middle key for an empty list', () => {
    expect(firstKey()).toBe('V');
    expect(isValidOrderKey(firstKey())).toBe(true);
  });

  it('generates strictly increasing keys when appending', () => {
    let prev: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 200; i++) {
      const next = keyBetween(prev, null);
      if (prev !== null) expect(isBefore(prev, next)).toBe(true);
      expect(isValidOrderKey(next)).toBe(true);
      keys.push(next);
      prev = next;
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('generates strictly decreasing keys when prepending', () => {
    let next: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 200; i++) {
      const prev = keyBetween(null, next);
      if (next !== null) expect(isBefore(prev, next)).toBe(true);
      expect(isValidOrderKey(prev)).toBe(true);
      keys.unshift(prev);
      next = prev;
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('always lands strictly between neighbours and exhausts the gap eventually', () => {
    let a = 'V';
    let b = incrementKey(a);
    let squeezed = 0;
    let exhausted = false;
    for (let i = 0; i < 500; i++) {
      let mid: string;
      try {
        mid = keyBetween(a, b);
      } catch (err) {
        // The ONLY legal failure is gap exhaustion after ≤ MAX length keys.
        expect((err as Error).message).toMatch(/exhausted/);
        expect(b.length).toBeGreaterThan(MAX_ORDER_KEY_LENGTH - 3);
        exhausted = true;
        break;
      }
      expect(isBefore(a, mid)).toBe(true);
      expect(isBefore(mid, b)).toBe(true);
      expect(isValidOrderKey(mid)).toBe(true);
      b = mid; // keep squeezing the same gap
      squeezed++;
    }
    expect(exhausted).toBe(true); // a squeezed gap MUST report exhaustion, not corrupt
    expect(squeezed).toBeGreaterThan(20);
    // After exhaustion, the rebalance path restores ordering.
    const rebalanced = evenKeys(squeezed + 2);
    for (let i = 1; i < rebalanced.length; i++) {
      expect(isBefore(rebalanced[i - 1]!, rebalanced[i]!)).toBe(true);
    }
  });

  it('increment/decrement helpers agree with keyBetween', () => {
    expect(incrementKey('V')).toBe(keyBetween('V', null));
    expect(decrementKey('V')).toBe(keyBetween(null, 'V'));
  });

  it('rejects out-of-order and equal neighbours', () => {
    expect(() => keyBetween('b', 'a')).toThrow(/out of order/);
    expect(() => keyBetween('a', 'a')).toThrow(/equal neighbours/);
    expect(() => keyBetween('bad key!', null)).toThrow(/invalid/);
  });

  it('evenKeys returns sorted, unique, valid keys for rebalance', () => {
    for (const n of [0, 1, 2, 5, 20, 100, 500]) {
      const keys = evenKeys(n);
      expect(keys).toHaveLength(n);
      for (const k of keys) expect(isValidOrderKey(k)).toBe(true);
      const sorted = [...keys].sort();
      expect(sorted).toEqual(keys);
      expect(new Set(keys).size).toBe(n);
    }
  });

  it('property: 10k random insert sequences always sort correctly and never collide', () => {
    const rng = makeRng(1337);
    const list: string[] = [];
    const seen = new Set<string>();
    let rebalances = 0;

    for (let step = 0; step < 10_000; step++) {
      const pos = Math.floor(rng() * (list.length + 1));
      const prev = pos === 0 ? null : (list[pos - 1] ?? null);
      const next = pos === list.length ? null : (list[pos] ?? null);
      let key: string;
      try {
        key = keyBetween(prev, next);
      } catch {
        // Only legal failure: exhausted gap length → rebalance and continue.
        const rebalanced = evenKeys(list.length + 1);
        list.length = 0;
        seen.clear();
        list.push(...rebalanced);
        rebalances++;
        continue;
      }
      expect(key.length).toBeLessThanOrEqual(MAX_ORDER_KEY_LENGTH);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      list.splice(pos, 0, key);
      // O(1) local invariant every step — neighbours must stay ordered.
      if (pos > 0) expect(isBefore(list[pos - 1]!, key)).toBe(true);
      if (pos < list.length - 1) expect(isBefore(key, list[pos + 1]!)).toBe(true);
      // Full sort invariant periodically (cheap enough, catches global drift).
      if (step % 500 === 499) expect([...list].sort()).toEqual(list);
    }
    expect([...list].sort()).toEqual(list);
    expect(list.length).toBeGreaterThan(9_000);
    expect(rebalances).toBeLessThan(50); // random inserts rarely exhaust gaps
  });

  it('canonical keys never end in 0 (append + prepend sequences)', () => {
    // Appending: on exhaustion the rebalance path must also stay canonical.
    let last: string | null = null;
    for (let i = 0; i < 400; i++) {
      let next: string;
      try {
        next = keyBetween(last, null);
      } catch {
        const rebalanced = evenKeys(50);
        for (const k of rebalanced) expect(k.endsWith('0')).toBe(false);
        next = rebalanced[rebalanced.length - 1]!;
      }
      expect(next.endsWith('0')).toBe(false);
      expect(isValidOrderKey(next)).toBe(true);
      last = next;
    }
    // Prepending.
    let first: string | null = null;
    for (let i = 0; i < 400; i++) {
      let prev: string;
      try {
        prev = keyBetween(null, first);
      } catch {
        break; // exhaustion is legal; rebalance covered above
      }
      expect(prev.endsWith('0')).toBe(false);
      first = prev;
    }
  });
});
