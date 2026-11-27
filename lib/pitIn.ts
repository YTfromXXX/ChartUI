// "new-cpu-pit-in": the Cure-API B car (USD axis) drives the sugoroku line exactly, and a CPU car
// runs beside it on a parallel lane, diving into the pit lane when its cruising range runs low.
//
// The sugoroku line is a closed loop of 22 squares (the 22 Fami ports), laid out as a stadium.
// Positions are parametrised by arc length, so a car at distance s is ON the line by construction;
// the lane is the same loop offset along the normal by a fixed width. The KING & QUEEN keyhole's
// three reels stop on the symbols of the squares the B car passes — the reels run "normally" when
// what they show equals the track.

export type Pt = { x: number; y: number };
export const SQUARES = 22;
export const LANE = 14; // CPU lane offset (px)
const REEL_SYMBOLS = ['♔', '♕', '7', '♠', '♥', '♦', '♣', '★', 'BAR', '🍒', '🔑'];
export const squareSymbol = (i: number) => REEL_SYMBOLS[((i % SQUARES) + SQUARES) % SQUARES % REEL_SYMBOLS.length];

/** A stadium loop: two straights joined by half circles. */
export function stadium(cx: number, cy: number, half: number, r: number, n = 240): Pt[] {
  const pts: Pt[] = []; const straight = 2 * half; const arc = Math.PI * r; const total = 2 * straight + 2 * arc;
  for (let i = 0; i < n; i += 1) {
    let s = (i / n) * total;
    if (s < straight) { pts.push({ x: cx - half + s, y: cy + r }); continue; } s -= straight;
    if (s < arc) { const a = Math.PI / 2 - s / r; pts.push({ x: cx + half + Math.cos(a) * r, y: cy + Math.sin(a) * r }); continue; } s -= arc;
    if (s < straight) { pts.push({ x: cx + half - s, y: cy - r }); continue; } s -= straight;
    const a = -Math.PI / 2 - s / r; pts.push({ x: cx - half + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export type Track = { pts: Pt[]; cum: number[]; length: number };
export function makeTrack(pts: Pt[]): Track {
  const cum = [0];
  for (let i = 1; i <= pts.length; i += 1) { const a = pts[i - 1]; const b = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y)); }
  return { pts, cum, length: cum[cum.length - 1] };
}

/** Point, unit tangent and left normal at arc length s (wraps around). */
export function at(track: Track, s: number) {
  const L = track.length; const u = ((s % L) + L) % L;
  let lo = 0; let hi = track.pts.length; // binary search the segment
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (track.cum[mid] <= u) lo = mid; else hi = mid; }
  const a = track.pts[lo]; const b = track.pts[(lo + 1) % track.pts.length]; const seg = track.cum[lo + 1] - track.cum[lo] || 1;
  const t = (u - track.cum[lo]) / seg; const tx = (b.x - a.x) / seg; const ty = (b.y - a.y) / seg;
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, t: { x: tx, y: ty }, n: { x: ty, y: -tx } };
}
export const squareAt = (track: Track, s: number) => Math.floor((((s % track.length) + track.length) % track.length) / (track.length / SQUARES));

/** Distance from a point to the polyline (used by the self-test). */
export function distanceToTrack(track: Track, p: Pt) {
  let best = Infinity;
  for (let i = 0; i < track.pts.length; i += 1) {
    const a = track.pts[i]; const b = track.pts[(i + 1) % track.pts.length]; const vx = b.x - a.x; const vy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t)));
  }
  return best;
}

/** Cruising range in squares: fuel left ÷ consumption per square (consumption grows with volatility). */
export function cruisingRange(fuel: number, volatility: number) {
  const perSquare = 0.6 + 2.4 * Math.max(0, Math.min(1, volatility)); // % of tank per square
  return { perSquare, squares: fuel / perSquare };
}

export type CpuState = { s: number; fuel: number; pit: null | { until: number }; pits: number };
export const PIT_SQUARE = 0; // pit lane entry at the start / finish line
/** Squares of range the CPU wants in hand when it passes the pit entry: one more lap plus a margin. */
export const PIT_RESERVE = SQUARES + 2;
/**
 * One step of the CPU car: it follows the B car's pace on the lane and burns fuel. Each time it
 * passes the pit entry it asks "can I finish another lap?" — if its range is under one lap plus a
 * margin it pits and refuels for `pitMs`, so the tank never runs dry on the track.
 */
export function stepCpu(c: CpuState, track: Track, dsB: number, vol: number, nowMs: number, pitMs = 1600): CpuState {
  if (c.pit) return nowMs >= c.pit.until ? { ...c, pit: null, fuel: 100 } : c;
  const ds = dsB * 1.04; const sq = track.length / SQUARES;
  const before = squareAt(track, c.s); const s = c.s + ds; const after = squareAt(track, s);
  const fuel = Math.max(0, c.fuel - (cruisingRange(c.fuel, vol).perSquare * ds) / sq);
  if (after !== before && after === PIT_SQUARE && cruisingRange(fuel, vol).squares < PIT_RESERVE) return { s, fuel, pit: { until: nowMs + pitMs }, pits: c.pits + 1 };
  return { s, fuel, pit: null, pits: c.pits };
}

/** Sonar: correlation of log returns → friction (0 together … 1 against). */
export function corrFriction(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length); if (n < 12) return null;
  const ra: number[] = []; const rb: number[] = [];
  for (let i = a.length - n + 1; i < a.length; i += 1) ra.push(Math.log(a[i] / a[i - 1]));
  for (let i = b.length - n + 1; i < b.length; i += 1) rb.push(Math.log(b[i] / b[i - 1]));
  const m = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length; const ma = m(ra); const mb = m(rb);
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < ra.length; i += 1) { sab += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
  if (saa < 1e-18 || sbb < 1e-18) return null;
  return (1 - sab / Math.sqrt(saa * sbb)) / 2;
}
