// The cube ladder: candles stored in glass cubes, one knot per cube, one rope through them all.
//
// Each cube holds CANDLES_PER_CUBE candles. The rope enters at the centre of the cube's floor and
// leaves at the centre of its ceiling, so stacked cubes make one continuous rope; inside, it ties
// exactly one knot, chosen from the candles (knot types from the knots3d.com catalogue):
//
//   coil     コイル          strong trend: the rope spirals up untied                 crossings 0
//   hitch    ひと結び         a wick tip hits a rung and is rejected: turns round it  crossings 0 (a hitch needs its post)
//   loop     もやい（輪）      range: one fixed loop                                    crossings 1
//   bend     ベンド（つなぎ）   a gap from the previous cube: two hooks joined           crossings 2
//   stopper  止め結び          one sharp reversal (V or Λ): an open trefoil             crossings 3
//   figure8  8 の字結び        two reversals (double top / bottom): open figure-eight  crossings 4
//
// The crossing numbers are what the front view of each drawn curve really has, verified with the
// repo's own crossing counter (knotCrossings.ts, mirror of knot_crossings.py). Prediction draws many
// synthetic futures and reports how often each knot comes out — a distribution, not a promise.

import { createCrossingStore, findCrossings, setSegment, MAX_SEGMENTS } from './knotCrossings';

export const CANDLES_PER_CUBE = 8;
export const RUNGS = 8;
export type Candle = { o: number; h: number; l: number; c: number };
export type KnotType = 'coil' | 'hitch' | 'loop' | 'bend' | 'stopper' | 'figure8';
export const KNOT_INFO: Record<KnotType, { name: string; meaning: string; crossings: number; color: string }> = {
  coil: { name: 'コイル', meaning: '強いトレンド：ほどけたまま螺旋で上る', crossings: 0, color: '#3dff8f' },
  hitch: { name: 'ひと結び（ヒッチ）', meaning: 'ひげ先が段に触れて押し返された：段に巻きつく', crossings: 0, color: '#ff2bd6' },
  loop: { name: 'もやい結び（輪）', meaning: 'レンジ：固定の輪をひとつ', crossings: 1, color: '#00e5ff' },
  bend: { name: 'ベンド（つなぎ）', meaning: '前の立方体から窓を開けた：二本をつなぐ', crossings: 2, color: '#ffb000' },
  stopper: { name: '止め結び', meaning: '鋭い反転ひとつ（V か Λ）：開いた三葉結び目', crossings: 3, color: '#ff4d4d' },
  figure8: { name: '8 の字結び', meaning: '反転ふたつ（ダブルトップ／ボトム）', crossings: 4, color: '#c084fc' },
};
export const KNOT_TYPES = Object.keys(KNOT_INFO) as KnotType[];

export type P3 = [number, number, number];

/**
 * The knot as a curve in the unit cube [−0.5, 0.5]³ from the floor centre (0, −0.5, 0) to the
 * ceiling centre (0, 0.5, 0). `rung` (−0.5 … 0.5) is where a hitch wraps.
 */
export function knotCurve(type: KnotType, n = 90, rung = 0): P3[] {
  const pts: P3[] = []; const lerp = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const floor: P3 = [0, -0.5, 0]; const ceil: P3 = [0, 0.5, 0];
  const body = (f: (t: number) => P3, from: number, to: number, m: number) => { for (let k = 0; k <= m; k += 1) pts.push(f(from + ((to - from) * k) / m)); };
  const tail = (a: P3, b: P3, m: number) => { for (let k = 1; k < m; k += 1) pts.push(lerp(a, b, k / m)); };
  if (type === 'coil') {
    // A helix round the vertical axis: its front view is a wave, so no crossings.
    body((t) => { const a = t * Math.PI * 4; return [0.2 * Math.sin(a), -0.5 + t, 0.2 * (Math.cos(a) - 1)]; }, 0, 1, n);
  } else if (type === 'hitch') {
    const y0 = Math.max(-0.3, Math.min(0.3, rung)); const r = 0.1;
    pts.push(floor); tail(floor, [-0.3, y0 - r, 0], 8);
    body((th) => [-0.3 + 0.04 * th, y0 - r * Math.cos(th), r * Math.sin(th)], 0, Math.PI * 3, n - 20); // 1.5 turns round the rung
    tail(pts[pts.length - 1], ceil, 10); pts.push(ceil);
  } else if (type === 'loop' || type === 'bend') {
    // A prolate cycloid: m turns, each crossing itself once (2πmR > 1), turns kept apart (2R < 1/m).
    const m = type === 'loop' ? 1 : 2; const R = type === 'loop' ? 0.2 : 0.1;
    body((t) => { const a = 2 * Math.PI * m * t; return [R * Math.sin(a), -0.5 + t + R * (1 - Math.cos(a)) * (t < 1 ? 1 : 0), 0.1 * Math.sin(a / 2)]; }, 0, 1, n);
  } else {
    // Open trefoil (overhand knot) and open figure-eight knot, cut where the tails can leave cleanly.
    const tre = (t: number): P3 => [0.11 * (Math.sin(t) + 2 * Math.sin(2 * t)), 0.11 * (Math.cos(t) - 2 * Math.cos(2 * t)), 0.11 * -Math.sin(3 * t)];
    const fig = (t: number): P3 => [0.09 * (2 + Math.cos(2 * t)) * Math.cos(3 * t), 0.09 * (2 + Math.cos(2 * t)) * Math.sin(3 * t), 0.09 * Math.sin(4 * t)];
    const f = type === 'stopper' ? tre : fig;
    const cut = type === 'stopper' ? CUT.stopper : CUT.figure8; const gap = 0.12;
    const a = f(cut + gap); const b = f(cut + Math.PI * 2 - gap);
    // Tails leave like a real rope: out past the knot's outer radius, then down (or up) outside it.
    const out = (q: P3): P3 => { const r = Math.hypot(q[0], q[1]) || 1; return [(q[0] / r) * 0.44, (q[1] / r) * 0.44, q[2] * 0.5]; };
    const A = out(a); const B = out(b);
    pts.push(floor); tail(floor, [A[0], -0.5, 0], 6); tail([A[0], -0.5, 0], A, 6); tail(A, a, 6);
    body(f, cut + gap, cut + Math.PI * 2 - gap, n - 36);
    tail(b, B, 6); tail(B, [B[0], 0.5, 0], 6); tail([B[0], 0.5, 0], ceil, 6); pts.push(ceil);
  }
  return pts;
}
/** Where the closed knot is opened (chosen so the tails add no crossings; see the tests). */
export const CUT = { stopper: -0.8, figure8: Math.PI }; // centres of the widest valid ranges (−1.449…−0.157 and around π)

/** Crossings of the front view (x, y) of a curve, with the repo's crossing counter. */
export function frontCrossings(pts: P3[]) {
  const step = Math.max(1, Math.ceil((pts.length - 1) / MAX_SEGMENTS));
  const sampled = pts.filter((_, i) => i % step === 0); if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);
  const store = createCrossingStore(); let k = 0;
  for (let i = 1; i < sampled.length && k < MAX_SEGMENTS; i += 1, k += 1) setSegment(store, k, sampled[i - 1][0], sampled[i - 1][1], sampled[i][0], sampled[i][1]);
  return findCrossings(store);
}

// ------------------------------------------------------------------ reading candles
export function cubeRange(cs: Candle[]) { return { lo: Math.min(...cs.map((c) => c.l)), hi: Math.max(...cs.map((c) => c.h)) }; }
export function rungLevels(cs: Candle[]) { const { lo, hi } = cubeRange(cs); return Array.from({ length: RUNGS }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / RUNGS); }

/** Which knot a cube's candles tie (rules are checked in this order). */
export function classify(cs: Candle[], prevClose: number | null): { type: KnotType; why: string; rung: number } {
  const { lo, hi } = cubeRange(cs); const range = hi - lo || 1e-9;
  const avgRange = cs.reduce((s, c) => s + (c.h - c.l), 0) / cs.length;
  if (prevClose !== null && Math.abs(cs[0].o - prevClose) > avgRange * 1.2) return { type: 'bend', why: `窓 ${(Math.abs(cs[0].o - prevClose) / avgRange).toFixed(1)} 本分`, rung: 0 };
  const move = (cs[cs.length - 1].c - cs[0].o) / range;
  if (Math.abs(move) >= 0.7) return { type: 'coil', why: `一方向に値幅の ${Math.round(Math.abs(move) * 100)}%`, rung: 0 };
  // Turning points of the closes that swing at least 35 % of the range.
  const closes = [cs[0].o, ...cs.map((c) => c.c)]; const turns: { i: number; kind: 'top' | 'bottom'; v: number }[] = [];
  for (let i = 1; i < closes.length - 1; i += 1) {
    const top = closes[i] > closes[i - 1] && closes[i] >= closes[i + 1]; const bottom = closes[i] < closes[i - 1] && closes[i] <= closes[i + 1];
    if (!top && !bottom) continue;
    const before = Math.abs(closes[i] - (top ? Math.min(...closes.slice(0, i)) : Math.max(...closes.slice(0, i)))) / range;
    const after = Math.abs(closes[i] - (top ? Math.min(...closes.slice(i + 1)) : Math.max(...closes.slice(i + 1)))) / range;
    if (before >= 0.35 && after >= 0.35) turns.push({ i, kind: top ? 'top' : 'bottom', v: closes[i] });
  }
  const tops = turns.filter((t) => t.kind === 'top'); const bottoms = turns.filter((t) => t.kind === 'bottom');
  const twin = (xs: typeof turns) => xs.length >= 2 && Math.abs(xs[0].v - xs[xs.length - 1].v) / range < 0.2;
  if (twin(tops) || twin(bottoms)) return { type: 'figure8', why: twin(tops) ? 'ダブルトップ' : 'ダブルボトム', rung: 0 };
  if (turns.length >= 1) return { type: 'stopper', why: turns[0].kind === 'top' ? 'Λ の反転' : 'V の反転', rung: 0 };
  // A long wick rejected at a rung.
  const levels = rungLevels(cs);
  for (const c of cs) {
    const body = Math.abs(c.c - c.o) || range * 0.01; const upper = c.h - Math.max(c.o, c.c); const lower = Math.min(c.o, c.c) - c.l;
    const tip = upper > lower ? c.h : c.l; const wick = Math.max(upper, lower);
    const near = levels.findIndex((lv) => Math.abs(lv - tip) / range < 0.07);
    if (wick > body * 2 && wick / range > 0.2 && near >= 0) return { type: 'hitch', why: `段 ${near + 1} でひげが押し返された`, rung: (near + 0.5) / RUNGS - 0.5 };
  }
  return { type: 'loop', why: 'レンジ', rung: 0 };
}

// ------------------------------------------------------------------ synthetic candles and prediction
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function nextCandle(prev: number, r: () => number, vol = 0.012, drift = 0): Candle {
  const g = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  let p = prev * (r() < 0.06 ? Math.exp((r() - 0.5) * vol * 6) : 1); const o = p; let h = o; let l = o;
  for (let k = 0; k < 4; k += 1) { p *= Math.exp(drift + vol * 0.5 * g()); h = Math.max(h, p); l = Math.min(l, p); }
  return { o, h: h * (1 + r() * vol * 0.3), l: l * (1 - r() * vol * 0.3), c: p };
}

/**
 * Distribution of a future cube's knot over many synthetic futures. `ahead` = 1 is the next cube;
 * larger values first simulate the cubes in between, so each forecast starts where the earlier
 * simulated cubes ended. The gap test compares the cube's first open with the close just before it.
 */
export function predictKnots(lastClose: number, seed: number, paths = 120, ahead = 1) {
  const counts = Object.fromEntries(KNOT_TYPES.map((k) => [k, 0])) as Record<KnotType, number>;
  for (let p = 0; p < paths; p += 1) {
    const r = rng(seed * 7919 + p); let c = lastClose;
    for (let i = 0; i < (ahead - 1) * CANDLES_PER_CUBE; i += 1) c = nextCandle(c, r).c;
    const before = c; const cs: Candle[] = [];
    for (let i = 0; i < CANDLES_PER_CUBE; i += 1) { const k = nextCandle(c, r); cs.push(k); c = k.c; }
    counts[classify(cs, before).type] += 1;
  }
  const dist = KNOT_TYPES.map((k) => ({ type: k, p: counts[k] / paths })).sort((a, b) => b.p - a.p);
  return { dist, top: dist[0].type };
}
