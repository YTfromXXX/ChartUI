// Fibonacci mirror: a hand-tracking reflex game on a single price line.
//
// The recent swing of the line defines Fibonacci retracement levels. The hand (any source
// that reports x, y — today the pointer, later camera hand tracking) is reflected across the
// golden 61.8 % level, so the player owns two hands: the real one and its mirror. Targets
// flash up on the levels for a short window; touching one with either hand scores by reaction
// time. The chosen Fibonacci moon sneaker sets the reach, the window and the mirror's
// cushioning. A reflex and precision game — it gives no trading signal.

import { sneakerParams } from '@/lib/moonSneaker';
import { cipher } from '@/lib/retroBlocks';

export const LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
export const GOLDEN = 0.618;

export type MirrorConfig = { hitRadius: number; windowMs: number; damping: number; label: string };

/** Sneaker type k (0..3 = A..D) → mirror settings. */
export function mirrorConfig(k: number, date = new Date()): MirrorConfig {
  const p = sneakerParams(k, date, 0.5);
  return { hitRadius: 10 + p.soleLayers * 3, windowMs: 520 + p.stackMm * 14, damping: Math.min(0.9, 0.35 + p.cushion * 0.6), label: `${p.key}. ${p.type}` };
}

/** Screen y of each level for a chart band [top, bottom] (level 0 = swing low at the bottom). */
export const levelY = (level: number, top: number, bottom: number) => bottom - level * (bottom - top);

/** Reflect a y coordinate across the golden line. */
export const mirrorY = (y: number, goldenY: number) => 2 * goldenY - y;

export type Target = { id: number; level: number; x: number; born: number };

/** Deterministic target stream: the n-th target's level and horizontal place. */
export function targetAt(n: number, seed: number, now: number, width: number): Target {
  const h = cipher(seed, n, 618);
  return { id: n, level: LEVELS[1 + (h % (LEVELS.length - 2))], x: width * (0.55 + ((h >>> 8) % 40) / 100), born: now };
}

export type RoundStats = { hits: number; misses: number; mirrorHits: number; reactions: number[] };

export const emptyStats = (): RoundStats => ({ hits: 0, misses: 0, mirrorHits: 0, reactions: [] });

export const summary = (s: RoundStats) => {
  const avg = s.reactions.length ? s.reactions.reduce((a, b) => a + b, 0) / s.reactions.length : 0;
  const best = s.reactions.length ? Math.min(...s.reactions) : 0;
  return { avg, best, accuracy: s.hits + s.misses ? s.hits / (s.hits + s.misses) : 0 };
};
