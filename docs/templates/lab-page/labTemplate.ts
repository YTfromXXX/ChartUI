// TEMPLATE — copy to lib/<yourLab>.ts and rename.
//
// The maths of a LAB lives here, with no React and no three.js, so it can be tested in Node and
// shipped in the chartui package. Keep it deterministic: take a seed, never call Math.random().

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Bar = { t: number; close: number; volume: number };

/** Synthetic prices only — the page must say so on screen. */
export function syntheticBars(seed: number, n = 60): Bar[] {
  const r = rng(seed); const out: Bar[] = []; let c = 100;
  for (let i = 0; i < n; i += 1) { c *= Math.exp((r() - 0.5) * 0.01); out.push({ t: i, close: c, volume: 0.5 + r() }); }
  return out;
}

/** Replace with the LAB's rule. Return numbers the page can show and a test can check. */
export function step(bars: Bar[]): { last: number; change: number } {
  const last = bars[bars.length - 1].close; return { last, change: last / bars[0].close - 1 };
}
