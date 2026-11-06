/** A function returning uniformly distributed numbers in [0, 1), like `Math.random`. */
export type RandomSource = () => number;

/** Seeded pseudo-random generator (mulberry32), so simulation runs can be reproduced. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random 32-bit unsigned seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

export function pickRandom<T>(random: RandomSource, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }
  return items[Math.floor(random() * items.length)];
}
