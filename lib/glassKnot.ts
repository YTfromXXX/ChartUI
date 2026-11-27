// Glass knot: a price line tied like a string around the side faces of a glass cuboid.
//
// The cuboid's edges are in geometric progression 1 : r : r² with r = φ (golden ratio) or √2
// (Yamato ratio): width r, depth 1, height r², scaled to fit. Time runs around the perimeter of
// the four side faces (one lap every `stepsPerLap` steps) and price is the height, so the line is a
// noisy spiral that always lies on a side face. Sharp turns are tied as small loops lying flat in
// the face plane (catching the snake's neck), so even the knots stay on the surface. The tube's
// centreline sits one radius outward along the face normal: it touches the glass, never cuts it.
// Forecasting is drawing: drawn heights become the future part of the same surface spiral.

export type V3 = { x: number; y: number; z: number };
export type RatioKey = 'golden' | 'yamato';
export const RATIO: Record<RatioKey, { r: number; name: string }> = {
  golden: { r: (1 + Math.sqrt(5)) / 2, name: '黄金比 1 : φ : φ²（φ ≈ 1.618）' },
  yamato: { r: Math.SQRT2, name: '大和比 1 : √2 : 2（√2 ≈ 1.414）' },
};

export type Box = { w: number; d: number; h: number; perimeter: number };
/** Width r, depth 1, height r², scaled so the height is `height`. */
export function makeBox(key: RatioKey, height = 2.4): Box {
  const r = RATIO[key].r; const k = height / (r * r);
  const w = r * k; const d = 1 * k; return { w, d, h: r * r * k, perimeter: 2 * (w + d) };
}

/**
 * The point at perimeter position u (0 … perimeter) and height y on the side faces, with its outward
 * normal and the face tangent (direction of increasing u). Faces in order: front (+z), right (+x),
 * back (−z), left (−x); the box is centred on the origin with its base at y = 0.
 */
export function onSide(box: Box, u: number, y: number) {
  const P = box.perimeter; let s = ((u % P) + P) % P; const hw = box.w / 2; const hd = box.d / 2;
  if (s < box.w) return { p: { x: -hw + s, y, z: hd }, n: { x: 0, y: 0, z: 1 }, t: { x: 1, y: 0, z: 0 }, face: 0, edge: Math.min(s, box.w - s) }; s -= box.w;
  if (s < box.d) return { p: { x: hw, y, z: hd - s }, n: { x: 1, y: 0, z: 0 }, t: { x: 0, y: 0, z: -1 }, face: 1, edge: Math.min(s, box.d - s) }; s -= box.d;
  if (s < box.w) return { p: { x: hw - s, y, z: -hd }, n: { x: 0, y: 0, z: -1 }, t: { x: -1, y: 0, z: 0 }, face: 2, edge: Math.min(s, box.w - s) }; s -= box.w;
  return { p: { x: -hw, y, z: -hd + s }, n: { x: -1, y: 0, z: 0 }, t: { x: 0, y: 0, z: 1 }, face: 3, edge: Math.min(s, box.d - s) };
}

/** Distance from a point to the box's side surface (0 on a side face). */
export function sideDistance(box: Box, p: V3) {
  const hw = box.w / 2; const hd = box.d / 2;
  const dx = Math.abs(p.x) - hw; const dz = Math.abs(p.z) - hd;
  if (dx <= 1e-12 && dz <= 1e-12) return Math.min(-dx, -dz); // inside: distance to the nearer face
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}

export type PathOpts = { stepsPerLap: number; margin: number; lo: number; hi: number; knotRadius: number; knotThreshold: number; tube: number; u0?: number };
export const heightOf = (box: Box, price: number, o: PathOpts) => o.margin + ((price - o.lo) / (o.hi - o.lo || 1)) * (box.h - 2 * o.margin);
export const priceOf = (box: Box, y: number, o: PathOpts) => o.lo + ((y - o.margin) / (box.h - 2 * o.margin)) * (o.hi - o.lo);
export const uOf = (box: Box, i: number, o: PathOpts) => (o.u0 ?? 0) + (i / o.stepsPerLap) * box.perimeter;

/** Indices of sharp turns: local extremes whose swing on both sides is at least `threshold` of the range. */
export function knotIndices(prices: number[], o: PathOpts, window = 3) {
  const out: number[] = []; const range = o.hi - o.lo || 1;
  for (let i = window; i < prices.length - window; i += 1) {
    const left = prices.slice(i - window, i); const right = prices.slice(i + 1, i + 1 + window); const v = prices[i];
    const isMax = left.every((x) => x < v) && right.every((x) => x < v); const isMin = left.every((x) => x > v) && right.every((x) => x > v);
    if (!isMax && !isMin) continue;
    // How far the turn reaches beyond the neighbours that lead into and out of it.
    const swing = (isMax ? v - Math.min(...left, ...right) : Math.max(...left, ...right) - v) / range;
    if (swing >= o.knotThreshold) out.push(i);
  }
  return out;
}

export type PathPoint = { surface: V3; center: V3; normal: V3; i: number; knot: boolean };
/**
 * Surface path of a price series (plus knots), sampled finely. `surface` lies exactly on a side
 * face; `center` is the tube centreline, one tube radius outward.
 */
export function buildPath(box: Box, prices: number[], o: PathOpts, sub = 6): PathPoint[] {
  const knots = new Set(knotIndices(prices, o));
  const out: PathPoint[] = [];
  const push = (u: number, y: number, i: number, knot: boolean) => {
    const g = onSide(box, u, Math.max(0, Math.min(box.h, y)));
    out.push({ surface: g.p, normal: g.n, i, knot, center: { x: g.p.x + g.n.x * o.tube, y: g.p.y + g.n.y * o.tube, z: g.p.z + g.n.z * o.tube } });
  };
  for (let i = 0; i < prices.length; i += 1) {
    const u = uOf(box, i, o); const y = heightOf(box, prices[i], o);
    if (i > 0) { // in-between samples so corners are followed exactly
      const u0 = uOf(box, i - 1, o); const y0 = heightOf(box, prices[i - 1], o);
      for (let k = 1; k < sub; k += 1) push(u0 + ((u - u0) * k) / sub, y0 + ((y - y0) * k) / sub, i - 1, false);
    }
    push(u, y, i, false);
    // A knot: one flat loop in the face plane, only where it fits inside the face.
    const g = onSide(box, u, y);
    if (knots.has(i) && g.edge > o.knotRadius * 1.2 && y > o.knotRadius && y < box.h - o.knotRadius) {
      const up = prices[i] >= (prices[i - 1] ?? prices[i]); // loop above a top, below a bottom
      for (let k = 1; k <= 18; k += 1) {
        const a = (k / 18) * Math.PI * 2;
        push(u + Math.sin(a) * o.knotRadius, y + (up ? 1 : -1) * (1 - Math.cos(a)) * o.knotRadius, i, true);
      }
    }
  }
  return out;
}

/** Forecast score: mean absolute error between drawn and revealed prices, as 0–100 points. */
export function scoreForecast(drawn: (number | null)[], actual: number[], range: number) {
  const pairs = drawn.map((d, k) => (d === null || actual[k] === undefined ? null : Math.abs(d - actual[k]) / (range || 1))).filter((x): x is number => x !== null);
  if (!pairs.length) return null;
  const mae = pairs.reduce((s, x) => s + x, 0) / pairs.length;
  return { mae, points: Math.round(100 * Math.max(0, 1 - mae * 4)), n: pairs.length };
}

/** Strobe ladder: did the price cross a rung's level between two steps? */
export const crosses = (a: number, b: number, level: number) => (a - level) * (b - level) <= 0;

/** 22 broadcast camera angles around the box ("1/22"). */
export function cameraAngles(box: Box, n = 22) {
  return Array.from({ length: n }, (_, i) => {
    const az = (i / n) * Math.PI * 2 + Math.PI / 8; const el = [0.15, 0.45, -0.05, 0.75][i % 4]; const dist = 4.2 + (i % 3) * 0.9;
    return { name: ['正面', '斜め上', '低い', '俯瞰'][i % 4], pos: { x: Math.cos(az) * Math.cos(el) * dist, y: box.h / 2 + Math.sin(el) * dist, z: Math.sin(az) * Math.cos(el) * dist } };
  });
}
