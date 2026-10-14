// Crossing detection + over/under bookkeeping for the 2D knot diagram.
// Mirrors knot_crossings.py (the tested reference implementation).

export const MAX_SEGMENTS = 8;
export const MAX_CROSSINGS = MAX_SEGMENTS * MAX_SEGMENTS;
const INTERIOR_EPS = 1e-6;

export interface CrossingStore {
  segmentCount: number;
  // x1,y1,x2,y2 per segment
  segments: Float32Array;
  count: number;
  // x,y per crossing
  points: Float32Array;
  // segment indices (over, under) per crossing
  over: Int8Array;
  under: Int8Array;
  // parameter along the over line (0..1) used for ordering
  order: Float32Array;
  // Alexander-style crossing sign (+1 / -1) per crossing
  signs: Int8Array;
}

export function createCrossingStore(): CrossingStore {
  return {
    segmentCount: 0,
    segments: new Float32Array(MAX_SEGMENTS * 4),
    count: 0,
    points: new Float32Array(MAX_CROSSINGS * 2),
    over: new Int8Array(MAX_CROSSINGS),
    under: new Int8Array(MAX_CROSSINGS),
    order: new Float32Array(MAX_CROSSINGS),
    signs: new Int8Array(MAX_CROSSINGS),
  };
}

export function setSegment(store: CrossingStore, index: number, x1: number, y1: number, x2: number, y2: number) {
  const o = index * 4;
  store.segments[o] = x1;
  store.segments[o + 1] = y1;
  store.segments[o + 2] = x2;
  store.segments[o + 3] = y2;
  if (index + 1 > store.segmentCount) store.segmentCount = index + 1;
}

// Proper (interior) intersection only; T-junctions and shared endpoints are not crossings.
export function findCrossings(store: CrossingStore): number {
  const s = store.segments;
  let count = 0;
  for (let a = 0; a < store.segmentCount; a += 1) {
    const ax = s[a * 4];
    const ay = s[a * 4 + 1];
    const adx = s[a * 4 + 2] - ax;
    const ady = s[a * 4 + 3] - ay;
    for (let b = a + 1; b < store.segmentCount; b += 1) {
      const bx = s[b * 4];
      const by = s[b * 4 + 1];
      const bdx = s[b * 4 + 2] - bx;
      const bdy = s[b * 4 + 3] - by;
      const denom = adx * bdy - ady * bdx;
      if (Math.abs(denom) < 1e-9) continue;
      const t = ((bx - ax) * bdy - (by - ay) * bdx) / denom;
      const u = ((bx - ax) * ady - (by - ay) * adx) / denom;
      if (t <= INTERIOR_EPS || t >= 1 - INTERIOR_EPS || u <= INTERIOR_EPS || u >= 1 - INTERIOR_EPS) continue;
      store.points[count * 2] = ax + adx * t;
      store.points[count * 2 + 1] = ay + ady * t;
      store.over[count] = a;
      store.under[count] = b;
      store.order[count] = t;
      store.signs[count] = adx * bdy - ady * bdx > 0 ? 1 : -1;
      count += 1;
    }
  }
  store.count = count;
  assignOverUnder(store);
  return count;
}

// Alternating over/under along segment 0's traversal (every alternating diagram
// has the Alexander-polynomial checkerboard property); other crossings follow
// the global crossing order so the pattern is stable frame to frame.
function assignOverUnder(store: CrossingStore) {
  const n = store.count;
  for (let i = 0; i < n; i += 1) {
    let rank = 0;
    const key = store.order[i];
    for (let j = 0; j < n; j += 1) {
      if (j !== i && (store.order[j] < key || (store.order[j] === key && j < i))) rank += 1;
    }
    if (rank % 2 === 1) {
      const tmp = store.over[i];
      store.over[i] = store.under[i];
      store.under[i] = tmp;
      store.signs[i] = -store.signs[i] as 1 | -1;
    }
  }
}

// Alexander-style crossing contribution matrix entries are +/-1; the writhe is
// their sum and is cheap enough to compute per frame.
export function writhe(store: CrossingStore): number {
  let sum = 0;
  for (let i = 0; i < store.count; i += 1) sum += store.signs[i];
  return sum;
}

export function snapHalfPixel(value: number): number {
  return Math.round(value - 0.5) + 0.5;
}

// Even-odd clip: full-canvas rect minus 2*epsilon squares (aligned to the over
// line) around every crossing where `segment` passes under.
export function clipUnderGaps(ctx: CanvasRenderingContext2D, store: CrossingStore, segment: number, epsilon: number, width: number, height: number): boolean {
  let any = false;
  for (let i = 0; i < store.count; i += 1) {
    if (store.under[i] !== segment) continue;
    if (!any) {
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      any = true;
    }
    const o = store.over[i] * 4;
    const dx = store.segments[o + 2] - store.segments[o];
    const dy = store.segments[o + 3] - store.segments[o + 1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = (dx / len) * epsilon;
    const uy = (dy / len) * epsilon;
    const cx = store.points[i * 2];
    const cy = store.points[i * 2 + 1];
    ctx.moveTo(cx - ux + uy, cy - uy - ux);
    ctx.lineTo(cx + ux + uy, cy + uy - ux);
    ctx.lineTo(cx + ux - uy, cy + uy + ux);
    ctx.lineTo(cx - ux - uy, cy - uy + ux);
    ctx.closePath();
  }
  if (any) ctx.clip('evenodd');
  return any;
}

export function drawSegmentsWithGaps(ctx: CanvasRenderingContext2D, store: CrossingStore, epsilon: number, width: number, height: number) {
  for (let seg = 0; seg < store.segmentCount; seg += 1) {
    ctx.save();
    clipUnderGaps(ctx, store, seg, epsilon, width, height);
    ctx.beginPath();
    ctx.moveTo(store.segments[seg * 4], store.segments[seg * 4 + 1]);
    ctx.lineTo(store.segments[seg * 4 + 2], store.segments[seg * 4 + 3]);
    ctx.stroke();
    ctx.restore();
  }
}
