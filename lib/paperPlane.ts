// Mente · paper-plane aviator: how the shape a person folds sets the "multiplier".
//
// Here the multiplier is physics, not a payout: flight distance ÷ launch height. A thrown paper
// plane turns its height and its throw speed into distance; how many times its height it travels
// depends on its glide ratio (lift ÷ drag) and on whether it flies steadily. That is where the
// people differ: span and wing area (aspect ratio), how much paper is folded into the nose (centre
// of gravity → static margin), dihedral, sweep, extra weight.
//
// Model (textbook glide estimates, deliberately simple — real planes will scatter around it):
//   AR       = b² / S                                   aspect ratio
//   e        = 0.85 · cos(sweep) · (1 − 0.1·|dihedral−8°|/8)    span efficiency (rough)
//   CD0      = 0.022 + 0.004·creases + 0.01·(thick nose)   paper is rough and the folds add drag
//   (L/D)max = ½ · √(π · e · AR / CD0)
//   stability: static margin SM (fraction of mean chord the CG sits ahead of the neutral point)
//              SM ≤ 0 → stalls and loops; rising to steady by 0.05; 0.05–0.15 steady; > 0.25 nose-heavy dive
//   distance = G_eff · (h + η · v₀² / 2g), η = 0.5   (only part of the throw's speed becomes glide)
//   multiplier = distance / h
// Nothing is measured here; people enter what their plane did, and the page compares.

export type Shape = {
  name: string; maker: string;
  span: number;      // cm
  area: number;      // cm², both wings
  mass: number;      // g
  margin: number;    // static margin, fraction of chord (CG ahead of neutral point)
  dihedral: number;  // degrees
  sweep: number;     // degrees
  creases: number;   // fold count
  nose: boolean;     // thick folded nose
};
export type Throw = { height: number; speed: number }; // m, m/s
export type Measured = { distance: number; height: number }; // what the person saw (m)
export type Entry = { shape: Shape; measured?: Measured; synthetic?: boolean };

const RHO = 1.2; const G = 9.81; const ETA = 0.5;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const rad = (d: number) => (d * Math.PI) / 180;

export const aspect = (s: Shape) => (s.span * s.span) / s.area;
export const efficiency = (s: Shape) => clamp(0.85 * Math.cos(rad(s.sweep)) * (1 - (0.1 * Math.abs(s.dihedral - 8)) / 8), 0.3, 0.95);
export const cd0 = (s: Shape) => 0.022 + 0.004 * s.creases + (s.nose ? 0.01 : 0);
export const ldMax = (s: Shape) => 0.5 * Math.sqrt((Math.PI * efficiency(s) * aspect(s)) / cd0(s));
/** Wing loading in N/m² and the best-glide speed (m/s). */
export function speedOf(s: Shape) {
  const W = (s.mass / 1000) * G; const S = s.area / 10000; const cl = Math.sqrt(cd0(s) * Math.PI * efficiency(s) * aspect(s));
  return { loading: W / S, cl, v: Math.sqrt((2 * W) / (RHO * S * cl)) };
}
/** How much of the ideal glide survives the plane's stability (1 = all). */
export function stability(margin: number) {
  if (margin <= 0) return { factor: 0.25, word: '不安定：失速して宙返り' };
  if (margin < 0.05) return { factor: 0.25 + 0.75 * (margin / 0.05), word: 'ややふらつく' };
  if (margin <= 0.15) return { factor: 1, word: '安定：まっすぐ滑空' };
  if (margin <= 0.25) return { factor: 1 - 2.5 * (margin - 0.15), word: 'やや頭が重い' };
  return { factor: clamp(0.75 - 2 * (margin - 0.25), 0.3, 0.75), word: '頭が重すぎ：突っ込む' };
}
export function predict(s: Shape, t: Throw) {
  const ld = ldMax(s); const st = stability(s.margin); const geff = ld * st.factor;
  const energyHeight = t.height + (ETA * t.speed * t.speed) / (2 * G); const distance = geff * energyHeight;
  return { aspect: aspect(s), e: efficiency(s), cd0: cd0(s), ld, stability: st, glide: geff, distance, multiplier: distance / t.height, ...speedOf(s) };
}

/** A gentle glide path for drawing: straight descent plus a phugoid wobble that grows as the margin shrinks. */
export function path(s: Shape, t: Throw, n = 80) {
  const p = predict(s, t); const wob = 0.12 * t.height * (s.margin < 0.05 ? 3 - 40 * s.margin : 0.6);
  return Array.from({ length: n + 1 }, (_, i) => { const k = i / n; return { x: p.distance * k, y: Math.max(0, t.height * (1 - k) + wob * Math.sin(k * Math.PI * 5) * (1 - k)) }; });
}

// Generic fold types (no brand designs): the numbers are typical of A4 copy paper (≈ 5 g).
export const PRESETS: Shape[] = [
  { name: 'ダーツ型', maker: '見本', span: 12, area: 120, mass: 5, margin: 0.10, dihedral: 4, sweep: 55, creases: 7, nose: true },
  { name: 'グライダー型', maker: '見本', span: 24, area: 150, mass: 5, margin: 0.08, dihedral: 8, sweep: 15, creases: 5, nose: false },
  { name: 'イカ型', maker: '見本', span: 18, area: 170, mass: 5.5, margin: 0.12, dihedral: 10, sweep: 30, creases: 9, nose: true },
  { name: '長い翼', maker: '見本', span: 34, area: 190, mass: 6, margin: 0.06, dihedral: 6, sweep: 5, creases: 6, nose: false },
];
export const THROW: Throw = { height: 1.6, speed: 5 };

// ---------- the human-side analysis ----------
export const FEATURES = [
  { key: 'aspect', label: '翼の縦横比 AR', get: (s: Shape) => aspect(s) },
  { key: 'margin', label: '重心の余裕 SM', get: (s: Shape) => s.margin },
  { key: 'loading', label: '翼面荷重', get: (s: Shape) => speedOf(s).loading },
  { key: 'dihedral', label: '上反角', get: (s: Shape) => s.dihedral },
  { key: 'sweep', label: '後退角', get: (s: Shape) => s.sweep },
  { key: 'creases', label: '折り目の数', get: (s: Shape) => s.creases },
] as const;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1; };
export function corr(xs: number[], ys: number[]) { const mx = mean(xs); const my = mean(ys); let a = 0; let b = 0; let c = 0; xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); b += (x - mx) ** 2; c += (ys[i] - my) ** 2; }); return b && c ? a / Math.sqrt(b * c) : 0; }

/**
 * Which shape difference moves the measured multiplier most: the correlation of each feature with
 * log(multiplier), and the residual each person's plane shows against the model (positive = it flew
 * better than its shape predicts — throwing and folding skill, or air the model leaves out).
 */
export function analyse(entries: Entry[], t: Throw) {
  const used = entries.filter((e) => e.measured && e.measured.height > 0);
  const y = used.map((e) => Math.log((e.measured as Measured).distance / (e.measured as Measured).height));
  const features = FEATURES.map((f) => ({ key: f.key, label: f.label, r: used.length >= 3 ? corr(used.map((e) => f.get(e.shape)), y) : 0 }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const residuals = used.map((e) => { const m = e.measured as Measured; const p = predict(e.shape, { height: m.height, speed: t.speed }); return { name: e.shape.name, maker: e.shape.maker, measured: m.distance / m.height, predicted: p.multiplier, residual: Math.log((m.distance / m.height) / p.multiplier) }; });
  return { n: used.length, features, residuals, spread: used.length ? sd(y) : 0 };
}

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
/** Made-up example flights (clearly marked synthetic) so the analysis has something to show before people add their own. */
export function syntheticCrowd(seed = 8, n = 12): Entry[] {
  const r = rng(seed); const names = ['あおい', 'けん', 'みお', 'そう', 'ゆい', 'りく', 'はる', 'なぎ', 'るか', 'こう', 'さき', 'たく'];
  return Array.from({ length: n }, (_, i) => {
    const base = PRESETS[i % PRESETS.length];
    const shape: Shape = { ...base, name: `${base.name}`, maker: `${names[i]}（架空）`, span: base.span * (0.85 + 0.3 * r()), area: base.area * (0.9 + 0.2 * r()), margin: clamp(base.margin + (r() - 0.5) * 0.14, -0.02, 0.32), dihedral: base.dihedral + (r() - 0.5) * 10, creases: base.creases + Math.round((r() - 0.5) * 4) };
    const p = predict(shape, THROW); const skill = Math.exp((r() - 0.5) * 0.5);
    return { shape, measured: { distance: Number((p.distance * skill).toFixed(2)), height: THROW.height }, synthetic: true };
  });
}
