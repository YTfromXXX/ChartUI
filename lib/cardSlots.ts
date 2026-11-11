// Card slots on candies, and what happens when the wrong thing lands in one.
//
// Every candy carries a card slot that expects a ROPE (a knot to tie). When a METAL CYLINDER lands
// there instead, the slot runs the anomaly pattern:
//   1. octagon ring — an octagon traced round the cylinder's rim, looping (a graph loop);
//   2. spiral point — from one octagon corner a golden spiral (×φ per quarter turn) leads out;
//   3. pebble       — a pebble is thrown in an arc onto the spiral point;
//   4. ripples      — rings spread from where it lands.
// The candy's matrix role (MATRIX_ROLES: mass, rigidity, vibration, radialScale) sets the physics:
// more vibration → more loops and ripples, more mass → a lower, slower throw, more rigidity → more
// bounces, radialScale → the size of the ring.
//
// Mass insertion lays a card face-down on every slot in golden-angle order. A cap on simultaneous
// anomaly animations keeps hundreds of cards watchable: a card waits until a lane is free.

export type ItemKind = 'rope' | 'metal';
export type CandyPhysics = { mass: number; rigidity: number; vibration: number; radialScale: number };
export type Slot = { id: string; role: number; expects: ItemKind; physics: CandyPhysics };
export type Pt = { x: number; y: number };

export const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_B = Math.log(PHI) / (Math.PI / 2); // r = r0·e^(bθ): ×φ every quarter turn

export type Pattern = {
  ring: Pt[]; loops: number; ringMs: number;
  spiral: Pt[]; spiralPoint: Pt;
  pebble: { from: Pt; path: { p: Pt; t: number }[]; flightMs: number; apex: number; bounces: number };
  ripples: { count: number; amplitude: number; ms: number };
  totalMs: number;
};

/** Octagon round a circle of radius r (vertex radius r / cos 22.5° so the sides touch the rim). */
export function octagon(r: number, rotation = Math.PI / 8): Pt[] {
  const R = r / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, k) => { const a = rotation + (k * Math.PI) / 4; return { x: Math.cos(a) * R, y: Math.sin(a) * R }; });
}

/** The anomaly pattern for a metal cylinder of radius r in a slot of this role. */
export function anomalyPattern(role: number, ph: CandyPhysics, r = 10): Pattern {
  const rr = r * ph.radialScale;
  const oct = octagon(rr); const loops = 1 + Math.round(ph.vibration * 2);
  const ring: Pt[] = []; for (let l = 0; l < loops; l += 1) for (const v of oct) ring.push(v); ring.push(oct[0]);
  // Golden spiral from corner (role mod 8) outward for half a turn.
  const k = role % 8; const v0 = oct[k]; const a0 = Math.atan2(v0.y, v0.x); const r0 = Math.hypot(v0.x, v0.y);
  const spiral: Pt[] = []; for (let i = 0; i <= 24; i += 1) { const th = (i / 24) * Math.PI; const rad = r0 * Math.exp(GOLDEN_B * th); spiral.push({ x: Math.cos(a0 + th) * rad, y: Math.sin(a0 + th) * rad }); }
  const spiralPoint = spiral[spiral.length - 1];
  // The throw: from the upper left, heavier = lower apex and longer flight.
  const from = { x: -3.2 * rr, y: -3.2 * rr }; const apex = (1.7 - ph.mass * 0.6) * rr * 1.6; const flightMs = Math.round(450 + ph.mass * 380);
  const path: { p: Pt; t: number }[] = [];
  for (let i = 0; i <= 30; i += 1) { const t = i / 30; path.push({ t, p: { x: from.x + (spiralPoint.x - from.x) * t, y: from.y + (spiralPoint.y - from.y) * t - 4 * apex * t * (1 - t) } }); }
  const bounces = Math.round(ph.rigidity * 2);
  const ripples = { count: 1 + Math.round(ph.vibration * 3), amplitude: rr * (0.8 + ph.vibration), ms: 700 };
  const ringMs = 260 * loops;
  return { ring, loops, ringMs, spiral, spiralPoint, pebble: { from, path, flightMs, apex, bounces }, ripples, totalMs: ringMs + 300 + flightMs + bounces * 180 + ripples.ms };
}

export type InsertResult = { kind: 'tie'; ms: number } | { kind: 'anomaly'; pattern: Pattern };
export function insert(slot: Slot, item: ItemKind): InsertResult {
  if (slot.expects === 'rope' && item === 'metal') return { kind: 'anomaly', pattern: anomalyPattern(slot.role, slot.physics) };
  return { kind: 'tie', ms: 320 };
}

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Chance that the card dealt onto this slot is a metal cylinder (heavy, rigid roles attract metal). */
export const metalChance = (ph: CandyPhysics) => Math.max(0.03, Math.min(0.45, 0.04 + 0.28 * ph.rigidity * (ph.mass / 1.5)));

export type Scheduled = { slot: Slot; item: ItemKind; order: number; start: number; end: number; result: InsertResult; waited: number };

/**
 * Lay one face-down card on every slot. Cards are dealt in golden-angle order every `everyMs`;
 * anomalies hold one of `lanes` animation lanes until they finish, and a card whose anomaly finds
 * no free lane waits for the earliest one to open.
 */
export function planMassInsertion(slots: Slot[], seed: number, opts: { everyMs?: number; lanes?: number } = {}) {
  const every = opts.everyMs ?? 45; const lanes = opts.lanes ?? 8; const r = rng(seed);
  const n = slots.length; const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => ((a * PHI) % 1) - ((b * PHI) % 1));
  const laneFree = new Array(lanes).fill(0); const out: Scheduled[] = [];
  order.forEach((idx, k) => {
    const slot = slots[idx]; const item: ItemKind = r() < metalChance(slot.physics) ? 'metal' : 'rope';
    const result = insert(slot, item); let start = k * every; let waited = 0;
    if (result.kind === 'anomaly') {
      const lane = laneFree.indexOf(Math.min(...laneFree));
      if (laneFree[lane] > start) { waited = laneFree[lane] - start; start = laneFree[lane]; }
      laneFree[lane] = start + result.pattern.totalMs;
      out.push({ slot, item, order: k, start, end: start + result.pattern.totalMs, result, waited });
    } else out.push({ slot, item, order: k, start, end: start + result.ms, result, waited });
  });
  const events = out.filter((s) => s.result.kind === 'anomaly').flatMap((s) => [[s.start, 1], [s.end, -1]] as [number, number][]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0; let peak = 0; for (const [, d] of events) { cur += d; peak = Math.max(peak, cur); }
  return { schedule: out, anomalies: out.filter((s) => s.result.kind === 'anomaly').length, peak, totalMs: Math.max(...out.map((s) => s.end)) };
}

/** Where the pattern is at time t (ms since the card landed): which stage, and its progress 0–1. */
export function stageAt(p: Pattern, t: number): { stage: 'ring' | 'spiral' | 'pebble' | 'bounce' | 'ripple' | 'done'; k: number } {
  const s1 = p.ringMs; const s2 = s1 + 300; const s3 = s2 + p.pebble.flightMs; const s4 = s3 + p.pebble.bounces * 180; const s5 = s4 + p.ripples.ms;
  if (t < s1) return { stage: 'ring', k: t / s1 };
  if (t < s2) return { stage: 'spiral', k: (t - s1) / 300 };
  if (t < s3) return { stage: 'pebble', k: (t - s2) / p.pebble.flightMs };
  if (t < s4) return { stage: 'bounce', k: (t - s3) / Math.max(1, s4 - s3) };
  if (t < s5) return { stage: 'ripple', k: (t - s4) / p.ripples.ms };
  return { stage: 'done', k: 1 };
}
