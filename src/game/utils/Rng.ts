/**
 * Seedable pseudo-random generator (mulberry32).
 *
 * Match logic uses this rather than `Math.random()` so a given seed always
 * produces the same island, loot layout and AI rolls — invaluable for debugging
 * ("the egg was in the north cave again"). The seed is logged each match and can
 * be pinned with the `?seed=12345` URL parameter.
 */
export class Rng {
  private state: number;

  constructor(public readonly seed: number) {
    // Ensure a non-zero 32-bit state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability `p` (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** ±1 with equal probability. */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** Random angle in radians. */
  angle(): number {
    return this.next() * Math.PI * 2;
  }

  /**
   * Weighted key selection. `weights` maps option → relative weight.
   * Returns the chosen key.
   */
  weighted<K extends string>(weights: Record<K, number>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  /** Durstenfeld shuffle (in place) — returns the same array for chaining. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}

/** Resolve the match seed from the URL (`?seed=`) or fall back to a random one. */
export function resolveSeed(): number {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('seed');
    if (param !== null) {
      const parsed = Number.parseInt(param, 10);
      if (!Number.isNaN(parsed)) return parsed >>> 0;
    }
  }
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
