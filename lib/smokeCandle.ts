// Colour rules for the golden and Yamato editions, the candle that turns into a spring and melts,
// and the torn smoke mesh tangled round a metal cylinder.
//
// Editions (decided in the design-rule questions — the moods are swapped on purpose):
//   黄金比版 (golden, φ)  = 墨と藍 — ink and indigo. Cool, quiet, printed.
//   大和比版 (Yamato, √2) = 炎と蝋 — flame and wax. Warm, soft, melting.
// Every colour comes from a rule, not a hand-picked list:
//   hue_k        = base hue + k × step angle  (golden 137.5°, Yamato 360·(1 − 1/√2) ≈ 105.4°)
//   saturation_k = s0 × ratio^(k mod 3)       (golden 1/φ, Yamato 1/√2)
//   lightness_k  = alternates dark / light so that neighbours never blur together.
// Checks the page runs on its own palette: neighbouring hues ≥ 90° apart, text on the background
// ≥ 4.5:1, the price line ≥ 3:1 against both the smoke and the background.
//
// Melt speed comes from the market: volume relative to its average and volatility (stdev of
// returns relative to its average). A busy, nervous market melts the wax quickly; a quiet one barely.

export const PHI = (1 + Math.sqrt(5)) / 2;
export type Edition = 'golden' | 'yamato';

export type EditionRule = {
  label: string; mood: string; ratio: number; stepDeg: number; satRatio: number;
  baseHue: number; s0: number;
  background: string; text: string; smoke: string; price: string; metal: string; accent: string;
  wax: [string, string, string]; // top → bottom of a candle (cool edition: indigo-dyed wax)
};

export const EDITIONS: Record<Edition, EditionRule> = {
  golden: {
    label: '黄金比版', mood: '墨と藍', ratio: PHI, stepDeg: 360 * (1 - 1 / PHI), satRatio: 1 / PHI,
    baseHue: 201, s0: 0.71,
    background: '#121418', text: '#f3f3f2', smoke: '#3d4a5c', price: '#f3f3f2', metal: '#8a96a8', accent: '#eb6101',
    wax: ['#dfe7ef', '#5b7fa6', '#165e83'],
  },
  yamato: {
    label: '大和比版', mood: '炎と蝋', ratio: Math.SQRT2, stepDeg: 360 * (1 - 1 / Math.SQRT2), satRatio: 1 / Math.SQRT2,
    baseHue: 34, s0: 1,
    background: '#1a100a', text: '#fff4d6', smoke: '#5a4636', price: '#fff4d6', metal: '#b79a7a', accent: '#ff5e1a',
    wax: ['#fff4d6', '#ffb347', '#ff5e1a'],
  },
};

// ---------- colour maths ----------
export function hslToHex(h: number, s: number, l: number) {
  const hh = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((hh / 60) % 2) - 1)); const m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string) { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); }
export function contrast(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
export const hueGap = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

export type Swatch = { k: number; hue: number; s: number; l: number; hex: string };
/** n accent colours for an edition, produced by the rule above. */
export function palette(edition: Edition, n = 6): Swatch[] {
  const e = EDITIONS[edition];
  return Array.from({ length: n }, (_, k) => {
    const hue = (e.baseHue + k * e.stepDeg) % 360; const s = e.s0 * e.satRatio ** (k % 3); const l = k % 2 === 0 ? 0.58 : 0.72;
    return { k, hue, s, l, hex: hslToHex(hue, s, l) };
  });
}

export type Check = { name: string; value: number; min: number; ok: boolean };
/** The numbers behind the rule; a page may only use an edition whose checks all pass. */
export function checkEdition(edition: Edition): Check[] {
  const e = EDITIONS[edition]; const p = palette(edition);
  const minGap = Math.min(...p.slice(1).map((s, i) => hueGap(s.hue, p[i].hue)));
  return [
    { name: '隣り合う色相の差 (°)', value: minGap, min: 90, ok: minGap >= 90 },
    { name: '文字 / 背景', value: contrast(e.text, e.background), min: 4.5, ok: contrast(e.text, e.background) >= 4.5 },
    { name: '価格線 / 煙', value: contrast(e.price, e.smoke), min: 3, ok: contrast(e.price, e.smoke) >= 3 },
    { name: '価格線 / 背景', value: contrast(e.price, e.background), min: 3, ok: contrast(e.price, e.background) >= 3 },
    { name: 'アクセント / 背景', value: contrast(e.accent, e.background), min: 3, ok: contrast(e.accent, e.background) >= 3 },
  ];
}

// ---------- melting ----------
export type Market = { volume: number; volatility: number }; // both relative to their own average (1 = usual)
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** Fraction of the candle's wax lost per second. Quiet market ≈ 0.4 %/s, busy and nervous ≈ 6 %/s. */
export function meltRate(m: Market) {
  const v = clamp(m.volume, 0, 3); const s = clamp(m.volatility, 0, 3);
  return 0.004 * (0.5 + 0.5 * v) * (1 + 1.5 * s) ** 1.2;
}
/** Market numbers from a run of closes and volumes: last bar against the run's average. */
export function marketFrom(closes: number[], volumes: number[], look = 20): Market {
  const r = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const sd = (xs: number[]) => { const mu = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, xs.length)); };
  const recent = r.slice(-5); const base = r.slice(-look);
  const vAvg = volumes.slice(-look).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(look, volumes.length));
  return { volume: vAvg ? volumes[volumes.length - 1] / vAvg : 1, volatility: sd(base) ? sd(recent) / sd(base) : 1 };
}

// ---------- the candle spring ----------
export type Spring = { melt: number; x: number; v: number }; // melt 0–1, x = compression (+ squashed), v = speed
/** Stiffness falls as the wax softens: a fresh candle is stiff, a melted one is a lazy coil. */
export const stiffness = (melt: number) => 140 * (1 - melt) ** 2 + 6;
export function stepSpring(s: Spring, dt: number, m: Market, kick = 0): Spring {
  const melt = clamp(s.melt + meltRate(m) * dt, 0, 1); const k = stiffness(melt); const c = 2 * 0.18 * Math.sqrt(k); // under-damped: it wobbles, then settles
  let v = s.v + kick; let x = s.x;
  const n = Math.max(1, Math.ceil(dt / 0.008)); const h = dt / n; // small steps keep the stiff spring stable
  for (let i = 0; i < n; i += 1) { v += (-k * x - c * v) * h; x += v * h; }
  return { melt, x: clamp(x, -0.4, 0.6), v };
}
/**
 * Points of the candle as a coil. Height shrinks with melt and compression; the coil sags outward
 * as it softens, and the turns lean (a drip running down one side).
 */
export function springCurve(s: Spring, opts: { height?: number; radius?: number; turns?: number; n?: number } = {}) {
  const H = opts.height ?? 1.6; const r0 = opts.radius ?? 0.16; const turns = opts.turns ?? 6; const n = opts.n ?? 240;
  const h = H * (1 - 0.72 * s.melt) * (1 - 0.5 * s.x);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n; const a = t * turns * Math.PI * 2;
    const sag = 1 + 0.45 * s.melt * Math.sin(Math.PI * t) + 0.15 * s.x; const lean = 0.12 * s.melt * t * t;
    pts.push([Math.cos(a) * r0 * sag + lean, t * h, Math.sin(a) * r0 * sag]);
  }
  return { pts, top: h, poolRadius: r0 * (0.6 + 2.4 * s.melt) };
}
/** Flame flicker: ≤ 2.5 Hz and ±8 % brightness, so it never counts as flashing (limit 3 Hz). */
export const FLICKER_HZ = 2.5;
export const flicker = (t: number, seed = 0) => 1 + 0.05 * Math.sin(2 * Math.PI * FLICKER_HZ * t + seed) + 0.03 * Math.sin(2 * Math.PI * 1.3 * t + seed * 2.1);

// ---------- torn smoke mesh round a metal cylinder ----------
function hash(x: number, y: number, z: number) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z); const f = (u: number) => u * u * (3 - 2 * u);
  const u = f(x - xi); const v = f(y - yi); const w = f(z - zi); const L = (a: number, b: number, k: number) => a + (b - a) * k;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export type SmokeMesh = { positions: Float32Array; alphas: Float32Array; indices: number[]; kept: number; total: number };
/**
 * A sheet wrapped round a cylinder of radius r and height h, twisted into a helix (the smoke winds
 * round the metal like a rope), lifted off the surface by noise and torn: a cell is dropped where
 * the noise falls under `tear`. Volatility tears more. `t` drifts the noise upward so it rises.
 */
export function smokeMesh(r: number, h: number, t: number, tear: number, opts: { cols?: number; rows?: number; twist?: number } = {}): SmokeMesh {
  const cols = opts.cols ?? 48; const rows = opts.rows ?? 28; const twist = opts.twist ?? 1.6;
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3); const alphas = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j += 1) for (let i = 0; i <= cols; i += 1) {
    const u = i / cols; const vv = j / rows; const a = u * Math.PI * 2 + vv * twist * Math.PI * 2 + t * 0.35;
    const lift = r * (0.08 + 0.55 * vv * noise3(u * 6, vv * 4 - t * 0.6, 1.7)); const rad = r + lift;
    const k = j * (cols + 1) + i;
    positions[k * 3] = Math.cos(a) * rad; positions[k * 3 + 1] = vv * h * (1 + 0.25 * vv); positions[k * 3 + 2] = Math.sin(a) * rad;
    alphas[k] = (1 - vv) ** 1.4 * (0.35 + 0.65 * noise3(u * 9, vv * 7 - t, 4.2));
  }
  const indices: number[] = []; let kept = 0;
  for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) {
    const hole = noise3(i * 0.45, j * 0.55 - t * 1.2, 9.1) < tear * (0.6 + 0.6 * (j / rows)); // torn more as it rises
    if (hole) continue; kept += 1;
    const a = j * (cols + 1) + i; const b = a + 1; const c = a + cols + 1; const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  return { positions, alphas, indices, kept, total: rows * cols };
}
/** Tear threshold from volatility: calm 0.18 (mostly whole), nervous up to 0.62. */
export const tearFrom = (m: Market) => clamp(0.18 + 0.15 * m.volatility, 0.18, 0.62);

// ---------- two-basis game (BB84-style; a game, not encryption) ----------
export type BasisRound = { bit: 0 | 1; sendBasis: Edition; guessBasis: Edition; eve: Edition | null; read: 0 | 1; kept: boolean };
/**
 * The sender colours each bit in one of two bases (golden or Yamato), the receiver guesses a basis.
 * Only rounds where the bases match are kept. If the dragon (an eavesdropper) reads a puff in the
 * wrong basis it scrambles it, so about a quarter of the kept bits disagree — that is how you notice.
 * This mimics the idea of BB84 for play; nothing here protects real data.
 */
export function basisGame(n: number, rnd: () => number, dragon: boolean): { rounds: BasisRound[]; kept: number; errors: number; errorRate: number } {
  const pick = (): Edition => (rnd() < 0.5 ? 'golden' : 'yamato'); const rounds: BasisRound[] = [];
  for (let i = 0; i < n; i += 1) {
    const bit: 0 | 1 = rnd() < 0.5 ? 0 : 1; const sendBasis = pick(); const guessBasis = pick();
    let travelBit = bit; let travelBasis = sendBasis; let eve: Edition | null = null;
    if (dragon) { eve = pick(); if (eve !== sendBasis) travelBit = rnd() < 0.5 ? 0 : 1; travelBasis = eve; }
    const read: 0 | 1 = guessBasis === travelBasis ? (travelBit as 0 | 1) : (rnd() < 0.5 ? 0 : 1);
    rounds.push({ bit, sendBasis, guessBasis, eve, read, kept: guessBasis === sendBasis });
  }
  const kept = rounds.filter((r) => r.kept); const errors = kept.filter((r) => r.read !== r.bit).length;
  return { rounds, kept: kept.length, errors, errorRate: kept.length ? errors / kept.length : 0 };
}
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
