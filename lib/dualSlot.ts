// Dual・パチスロ（慎重に） — the slot machine as a sugoroku die.
//
// Fami ports 3, 8, 15, 20, 21, 22 (lib/idlecrash.ts): 奇数＆偶数, aviator, ファミつく, King＆Queen,
// MAP ex (パチスロ版), バイク魂 or 海賊戦線 (パチスロ版). The brief: two-way choices and slots that follow
// the sugoroku squares, with no money and no odds. So the machine's only output is how far the
// piece moves on the 22-square board. Nothing is won, stored up or exchanged.
//
// Careful-design rules this module enforces (and the page states):
//   1. The outcome is drawn first (three uniform stops); the reels only show it. There is no
//      stop control: no near-miss staging, no "almost" symbols placed above the line.
//   2. Every probability is computed exactly from the strips and shown.
//   3. Every Dual choice has the same expected number of steps (3.5): the choice changes the
//      spread, never the advantage.
//   4. One press = one spin, at least SPIN_MS long. No auto-play.
//   5. After BREAK_EVERY spins a break card appears with the session so far; it needs a click.
//   6. Lights stay under 3 Hz; nothing celebrates a non-event.

import { FAMI_PORTS } from './idlecrash';

export const SYMBOLS = ['7', '♚', '♛', '🎲', '🌸', '⚓', '🏍'] as const;
export type Sym = (typeof SYMBOLS)[number];
const V: Record<Sym, number> = { '7': 0, '♚': 1, '♛': 2, '🎲': 3, '🌸': 4, '⚓': 5, '🏍': 6 };
/** Three fixed strips of 20 stops. Sevens: 1, 2 and 2 → three 7s on the line = 4 / 8000 = 1 / 2000. */
export const STRIPS: Sym[][] = [
  ['7', '♚', '🌸', '⚓', '♛', '🎲', '🏍', '♚', '🌸', '♛', '⚓', '🎲', '🏍', '♚', '🌸', '♛', '⚓', '🎲', '🏍', '🌸'],
  ['♛', '7', '🎲', '🏍', '♚', '🌸', '⚓', '♛', '🎲', '7', '🏍', '♚', '🌸', '⚓', '♛', '🎲', '🏍', '♚', '🌸', '⚓'],
  ['🎲', '⚓', '7', '♚', '🌸', '🏍', '♛', '🎲', '⚓', '♚', '🌸', '7', '🏍', '♛', '🎲', '⚓', '♚', '🌸', '🏍', '♛'],
];
export const STOPS = 20; export const SQUARES = 22; export const SPIN_MS = 1600; export const BREAK_EVERY = 20;

export type Line = [Sym, Sym, Sym];
export const lineAt = (stops: [number, number, number]): Line => [STRIPS[0][stops[0]], STRIPS[1][stops[1]], STRIPS[2][stops[2]]];
export const isProphecy = (l: Line) => l[0] === '7' && l[1] === '7' && l[2] === '7';
/** Steps on the board: (sum of symbol values) mod 6 + 1. */
export const stepsOf = (l: Line) => ((V[l[0]] + V[l[1]] + V[l[2]]) % 6) + 1;

/** Exact distribution over all 8 000 stop combinations. */
export function distribution() {
  const steps = Array(7).fill(0); let prophecy = 0; const total = STOPS ** 3;
  for (let a = 0; a < STOPS; a += 1) for (let b = 0; b < STOPS; b += 1) for (let c = 0; c < STOPS; c += 1) { const l = lineAt([a, b, c]); steps[stepsOf(l)] += 1; if (isProphecy(l)) prophecy += 1; }
  const p = steps.map((n) => n / total);
  return { steps: p, prophecy: prophecy / total, mean: p.reduce((s, x, k) => s + x * k, 0), total };
}

// ---------- Dual choices (all with the same expected steps) ----------
export type Dual = { port: number; pair: [string, string]; pick: 0 | 1 };
export type Transform = { label: string; apply: (s: number, u: number) => number; note: string };
/**
 * What each side of a Dual does to the rolled steps s (1–6). Both sides keep the mean at 3.5 when s
 * is uniform; the page shows the exact mean and spread for the real strips.
 */
export const TRANSFORMS: Record<number, [Transform, Transform]> = {
  3: [{ label: '奇数', apply: (s) => s, note: 'そのまま' }, { label: '偶数', apply: (s) => 7 - s, note: '鏡写し（7 − 出目）' }],
  8: [{ label: 'リトル', apply: (_s, u) => (u < 0.5 ? 3 : 4), note: 'いつも 3 か 4（交互）' }, { label: 'ネフェリム', apply: (_s, u) => (u < 0.5 ? 2 : 5), note: '2 か 5 の大ジャンプ（標準の翼）' }],
  15: [{ label: '軍服パターン', apply: (s) => s, note: 'そのまま' }, { label: 'セーラー服', apply: (s) => 7 - s, note: '鏡写し' }],
  20: [{ label: 'King', apply: (s) => s, note: 'そのまま' }, { label: 'Queen', apply: (s) => 7 - s, note: '鏡写し' }],
  22: [{ label: 'バイク魂', apply: (s) => s, note: '陸路：そのまま' }, { label: '海賊戦線', apply: (s) => 7 - s, note: '海路：鏡写し' }],
};
// ---------- 8. aviator: the pop-up initialises the Dual ----------
// Little flies low and lands 3 or 4 squares ahead (alternating). Nephilim, the giant, flies high
// and lands 3.5 − span or 3.5 + span ahead, half the time each. Whatever the wingspan, the mean is
// 3.5: the setting only chooses how wide the landings spread. There is no multiplier, no cashing
// out and no crash — the plane always lands; all that is decided is the square.
export const WINGSPANS = [1.5, 2.5] as const;
/** The standard wing: Nephilim lands 2 or 5 squares ahead. */
export const DEFAULT_SPAN = 1.5;
export type Wingspan = (typeof WINGSPANS)[number];
export function aviatorPair(span: Wingspan): [Transform, Transform] {
  return [
    { label: 'リトル', apply: (_s, u) => (u < 0.5 ? 3 : 4), note: '低く飛んで 3 か 4（交互）' },
    { label: 'ネフェリム', apply: (_s, u) => (u < 0.5 ? 3.5 - span : 3.5 + span), note: `高く飛んで ${3.5 - span} か ${3.5 + span}` },
  ];
}
export const transformsFor = (span: Wingspan): Record<number, [Transform, Transform]> => ({ ...TRANSFORMS, 8: aviatorPair(span) });
/** Where each flier can land (squares ahead → probability). */
export const landings = (span: Wingspan) => ({ little: { 3: 0.5, 4: 0.5 } as Record<number, number>, nephilim: { [3.5 - span]: 0.5, [3.5 + span]: 0.5 } as Record<number, number> });

/** Exact mean and variance of a transform under the real step distribution (Little alternates 3/4 → mean 3.5). */
export function transformStats(t: Transform, steps: number[]) {
  let m = 0; let m2 = 0;
  for (let s = 1; s <= 6; s += 1) for (const u of [0.25, 0.75]) { const x = t.apply(s, u); m += (steps[s] / 2) * x; m2 += (steps[s] / 2) * x * x; }
  return { mean: m, variance: m2 - m * m };
}

// ---------- board ----------
export const portAt = (square: number) => FAMI_PORTS[((square % SQUARES) + SQUARES) % SQUARES];
/**
 * Square effects from the port briefs (no rewards — only where the piece ends up, and what you get
 * to see). 奇数回帰 (port 3): while the 奇数＆偶数 Dual is set to 奇数, landing on an even-numbered
 * square slides the piece on to the next odd one.
 */
/** Even squares that hold the piece despite 奇数回帰: the Dual squares 8 (aviator), 20 (King＆Queen), 22 (バイク魂 or 海賊戦線). */
export const HOLDS = new Set([8, 20, 22]);
export function landEffect(square: number, oddReturn = true): { to: number; text: string; reveal: number } {
  const p = portAt(square); const n = p.no;
  if (oddReturn && n % 2 === 0 && !HOLDS.has(n)) return { to: square + 1, text: `奇数回帰：偶数マス ${n} から奇数マス ${n + 1} へ滑る`, reveal: 0 };
  if (n === 15) return { to: square + 7, text: 'ファミつく：音に合わせて 7 マス', reveal: 0 };
  if (n === 21) return { to: square, text: 'MAP ex：地図が開き、さらに 6 マス先まで見える', reveal: 6 };
  return { to: square, text: '', reveal: 0 };
}

export type Spin = { stops: [number, number, number]; line: Line; rolled: number; moved: number; dual: string | null; from: number; to: number; effect: string; prophecy: boolean };
/** One spin: draw the stops first, then read everything off them. `u` are uniforms in [0, 1). */
export function spin(square: number, picks: Record<number, 0 | 1>, u: [number, number, number, number], spinIndex: number, span: Wingspan = DEFAULT_SPAN): Spin {
  const stops = u.slice(0, 3).map((x) => Math.floor(x * STOPS)) as [number, number, number];
  const line = lineAt(stops); const rolled = stepsOf(line); const port = portAt(square).no;
  const t = transformsFor(span)[port]?.[picks[port] ?? 0];
  // Little alternates 3 and 4 by spin number, so its mean is exactly 3.5 with no randomness.
  const moved = t ? (t.label === 'リトル' ? (spinIndex % 2 ? 4 : 3) : Math.round(t.apply(rolled, u[3]))) : rolled;
  let to = square + moved; const eff = landEffect(to, (picks[3] ?? 0) === 0); to = eff.to;
  return { stops, line, rolled, moved, dual: t ? t.label : null, from: square, to, effect: eff.text, prophecy: isProphecy(line) };
}
