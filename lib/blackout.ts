// Whiteout ⇄ blackout colour rules, decided with a quantum dice.
//
// The whiteout version (./menu) is white paper, ink #1f1f1f, stone greys and one red (#c8001a).
// The blackout version keeps the same roles on a black page. Red that reads on white is too dark
// on black, so the blackout accent is chosen from six reds lifted for a dark page — and which one
// is chosen by a quantum dice: an outcome k drawn from a recorded QAOA distribution (the spin
// lab / IBM challenge), face = k mod 6 + 1. The same k also orders the four screen quadrants of
// the blackout page by z-index (k mod 24 → one of the 4! = 24 stackings).
// Every role must pass: text ≥ 4.5 : 1, secondary text ≥ 4.5 : 1, accent ≥ 3 : 1 against its page.

import { contrast, hslToHex } from './smokeCandle';

export type Roles = { bg: string; panel: string; text: string; sub: string; line: string; accent: string };
export const WHITEOUT: Roles = { bg: '#ffffff', panel: '#fafaf9', text: '#1f1f1f', sub: '#57534e', line: '#e7e5e4', accent: '#c8001a' };
const BLACK_BASE: Omit<Roles, 'accent'> = { bg: '#0a0a0a', panel: '#161514', text: '#f4f1ec', sub: '#a8a29e', line: '#2a2826' };

/** Six reds for a dark page (hue around the whiteout red, lifted lightness). Face n picks ACCENTS[n − 1]. */
export const ACCENTS = [352, 0, 344, 8, 336, 16].map((h) => hslToHex(h, 0.9, 0.6));
export const blackout = (face: number): Roles => ({ ...BLACK_BASE, accent: ACCENTS[(face - 1) % 6] });

export type Check = { role: string; value: number; min: number; ok: boolean };
export function checks(r: Roles): Check[] {
  const c = (role: string, a: string, b: string, min: number) => { const v = contrast(a, b); return { role, value: v, min, ok: v >= min }; };
  return [c('文字 / 背景', r.text, r.bg, 4.5), c('補助の文字 / 背景', r.sub, r.bg, 4.5), c('アクセント / 背景', r.accent, r.bg, 3), c('アクセント / パネル', r.accent, r.panel, 3)];
}

export const QUADRANTS = ['HEADER', 'BOTTOM', 'SIDE MENU', 'POP UP'] as const;
/** The k-th permutation of the four quadrants (factorial number system), front-most first. */
export function stacking(k: number): (typeof QUADRANTS)[number][] {
  const pool = [...QUADRANTS]; const out: (typeof QUADRANTS)[number][] = []; let x = ((k % 24) + 24) % 24;
  for (let f = 3; f >= 0; f -= 1) { const fact = [1, 1, 2, 6][f]; const i = Math.floor(x / fact); x %= fact; out.push(pool.splice(i, 1)[0]); }
  return out;
}
/** z-index for each quadrant: front-most 40, then 30, 20, 10. */
export const zOf = (order: string[]) => Object.fromEntries(order.map((q, i) => [q, 40 - i * 10])) as Record<string, number>;

/** One roll: weighted draw from the distribution with a uniform u ∈ [0, 1). */
export function roll(probabilities: number[], u: number) {
  const total = probabilities.reduce((a, b) => a + b, 0) || 1; let acc = 0; let k = probabilities.length - 1;
  for (let i = 0; i < probabilities.length; i += 1) { acc += probabilities[i] / total; if (u < acc) { k = i; break; } }
  return { k, face: (k % 6) + 1, order: stacking(k) };
}
