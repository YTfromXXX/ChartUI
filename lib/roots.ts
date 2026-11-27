// Roots that take hold in the ground, and the free curves drawn through them.
// Geometry (botany, simplified):
//  • the primary root grows downward: gravitropism (the root cap senses gravity) pulls its direction down;
//  • lateral roots branch off at a wide angle, then keep a slanted "gravitropic set-point angle" instead of
//    going straight down; second-order laterals are shorter and thinner;
//  • roots taper toward the tips; wobble comes from soil (here: from the data's day-to-day change).
// Free curves through the grown points: 折れ線 (the raw steps), Catmull–Rom (passes through every point;
// can overshoot), uniform cubic B-spline (smoother, C², but does not pass through the points).
export type Pt = [number, number];
export type Root = { pts: Pt[]; width: number; order: number };
export type RootParams = { depth: number; wobble: number; branch: number; lean: number; seed: number };

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function growRoots(x0: number, y0: number, p: RootParams): Root[] {
  const r = rng(p.seed); const out: Root[] = []; const STEP = 5;
  const grow = (start: Pt, dir: Pt, steps: number, order: number, setpoint: number) => {
    const pts: Pt[] = [start]; let [dx, dy] = dir; let [x, y] = start;
    for (let i = 0; i < steps; i += 1) {
      // pull toward the set-point direction (straight down for the primary root, slanted for laterals)
      const side = Math.sign(dx) || 1; const tx = Math.sin(setpoint) * side; const ty = Math.cos(setpoint);
      const g = order === 0 ? 0.18 : 0.08;
      dx += (tx - dx) * g + (r() - 0.5) * p.wobble + (order === 0 ? p.lean * 0.02 : 0); dy += (ty - dy) * g + (r() - 0.5) * p.wobble * 0.5;
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n; x += dx * STEP * (order ? 0.8 : 1); y += dy * STEP * (order ? 0.8 : 1);
      pts.push([x, y]);
      if (order < 2 && i > 3 && i < steps - 3 && r() < p.branch * (order ? 0.5 : 1)) {
        const s = r() < 0.5 ? -1 : 1; const a = (55 + r() * 30) * (Math.PI / 180) * s; // laterals leave at 55–85°
        const bx = dx * Math.cos(a) - dy * Math.sin(a); const by = dx * Math.sin(a) + dy * Math.cos(a);
        grow([x, y], [bx, by], Math.round((steps - i) * (order ? 0.35 : 0.55)), order + 1, (40 + r() * 25) * (Math.PI / 180));
      }
    }
    out.push({ pts, width: [2.6, 1.4, 0.8][order], order });
  };
  grow([x0, y0], [0, 1], Math.round(p.depth), 0, 0);
  return out.sort((a, b) => b.order - a.order);
}

const f = (n: number) => n.toFixed(1);
export const polyline = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
/** Catmull–Rom through every point, written as cubic Bézier segments. */
export function catmullRom(pts: Pt[]) {
  if (pts.length < 3) return polyline(pts);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
/** Uniform cubic B-spline (approximating), written as cubic Bézier segments; also returns its control polygon. */
export function bspline(pts: Pt[]) {
  if (pts.length < 4) return { d: polyline(pts), ctrl: pts };
  const P = [pts[0], pts[0], ...pts, pts[pts.length - 1], pts[pts.length - 1]]; let d = '';
  for (let i = 1; i < P.length - 2; i += 1) {
    const [a, b, c, e] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const s: Pt = [(a[0] + 4 * b[0] + c[0]) / 6, (a[1] + 4 * b[1] + c[1]) / 6]; const t: Pt = [(b[0] + 4 * c[0] + e[0]) / 6, (b[1] + 4 * c[1] + e[1]) / 6];
    const c1: Pt = [(2 * b[0] + c[0]) / 3, (2 * b[1] + c[1]) / 3]; const c2: Pt = [(b[0] + 2 * c[0]) / 3, (b[1] + 2 * c[1]) / 3];
    d += `${d ? '' : `M${f(s[0])} ${f(s[1])}`} C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(t[0])} ${f(t[1])}`;
  }
  return { d, ctrl: pts };
}
