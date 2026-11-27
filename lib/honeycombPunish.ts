// Honeycomb Punish: throw a transparent ball through a row of glass plates cut with honeycomb holes.
//
// A transparent world: the plates are glass with water droplets on them, goldfish swim between
// them, and a wind chime (風鈴) hangs over each plate and sways when the ball gets through.
//
// The throw is a baseball pitch. The mouse drag sets the aim and the speed; the pitch type sets the
// spin (rpm and axis), and a curved drag adds side spin. The ball flies under gravity and the
// Magnus force a = k (ω × v), so a four-seamer rises against gravity, a curve drops, a slider breaks
// sideways and a splitter falls. At each plate the whole ball must fit inside an open hexagon;
// touching glass is the "punish": the ball stops there and the plate rings.
//
// Units: metres, seconds, rad/s. The ball flies along +z; plates stand at z = PLATE_Z[i].

export type V3 = { x: number; y: number; z: number };
export const GRAVITY = 9.8; export const MAGNUS_K = 0.0012; export const BALL_R = 0.06;
export const PLATE_Z = [1.5, 3, 4.5, 6, 7.5];
export const HEX_A = 0.2; // apothem of a hole (centre to the middle of a side)
export const rpm = (r: number) => (r * 2 * Math.PI) / 60;

export type Pitch = { key: string; label: string; rpm: number; axis: V3; speed: number };
// axis is the spin axis (unit); ω × v with v ≈ +z: −x → lift, +x → drop, +y → break toward +x.
export const PITCHES: Pitch[] = [
  { key: 'four', label: 'ストレート（バックスピン）', rpm: 2300, axis: { x: -1, y: 0, z: 0 }, speed: 16 },
  { key: 'curve', label: 'カーブ（トップスピン）', rpm: 2200, axis: { x: 0.7, y: -0.7, z: 0 }, speed: 14 },
  { key: 'slider', label: 'スライダー（横回転）', rpm: 2400, axis: { x: -0.2, y: 0.98, z: 0 }, speed: 14 },
  { key: 'split', label: 'フォーク（少ない回転）', rpm: 900, axis: { x: -1, y: 0, z: 0 }, speed: 14 },
];

const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: V3) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

export type Hole = { x: number; y: number };
export type Plate = { z: number; holes: Hole[]; droplets: Hole[] };
export type Fish = { z: number; y: number; amp: number; speed: number; phase: number; r: number };
export type World = { plates: Plate[]; fish: Fish[] };

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Honeycomb cell centres (flat-topped rows) covering the plate, centred on (0, 1). */
export function honeycomb(cols = 7, rows = 5, a = HEX_A + 0.02): Hole[] {
  const out: Hole[] = []; const R = (2 * a) / Math.sqrt(3); // circumradius
  for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) {
    const x = (c - (cols - 1) / 2) * 1.5 * R; const y = 1 + (r - (rows - 1) / 2) * 2 * a + (c % 2 ? a : 0);
    out.push({ x, y });
  }
  return out;
}

/**
 * A world: on each plate about 35 % of the cells are open; droplets sit on the glass. One hidden
 * reference pitch is flown first and the cells it goes through are opened, so every world has at
 * least one way through (the goldfish may still get in the way).
 */
export function makeWorld(seed: number): World {
  const r = rng(seed); const cells = honeycomb();
  const fish = PLATE_Z.slice(0, -1).map((z) => ({ z: z + 0.75, y: 0.6 + r() * 0.8, amp: 0.6 + r() * 0.5, speed: 0.4 + r() * 0.5, phase: r() * Math.PI * 2, r: 0.09 }));
  const open: Plate[] = PLATE_Z.map((z) => ({ z, holes: cells, droplets: [] }));
  let route: Hole[] = [];
  for (let tries = 0; tries < 400 && route.length < PLATE_Z.length; tries += 1) {
    const pitch = PITCHES[Math.floor(r() * PITCHES.length)];
    const f = fly({ aim: { x: (r() - 0.5) * 0.4, y: (r() - 0.3) * 0.4 }, speed: pitch.speed, pitch, sideSpin: Math.round((r() - 0.5) * 2) }, { plates: open, fish: [] }, 0, 1 / 300);
    route = f.events.filter((e) => e.kind === 'pass').map((e) => cells.find((h) => fitsHex(e.at, h)) as Hole);
  }
  const plates = PLATE_Z.map((z, i) => {
    const holes = cells.filter((h) => h === route[i] || r() < 0.35);
    const droplets = Array.from({ length: 9 }, () => ({ x: (r() - 0.5) * 2.2, y: 0.3 + r() * 1.4 }));
    return { z, holes, droplets };
  });
  return { plates, fish };
}
export const fishAt = (f: Fish, t: number): V3 => ({ x: f.amp * Math.sin(f.speed * t + f.phase), y: f.y + 0.05 * Math.sin(3 * f.speed * t), z: f.z });

/** Is the whole ball (radius b) inside the flat-topped hexagon of apothem a centred at h? */
export function fitsHex(p: { x: number; y: number }, h: Hole, a = HEX_A, b = BALL_R) {
  const dx = p.x - h.x; const dy = p.y - h.y;
  for (const ang of [Math.PI / 2, Math.PI / 6, -Math.PI / 6]) if (Math.abs(dx * Math.cos(ang) + dy * Math.sin(ang)) > a - b) return false;
  return true;
}

export type Throw = { aim: { x: number; y: number }; speed: number; pitch: Pitch; sideSpin: number }; // sideSpin −1…1 from the drag's curve
export type FlightEvent = { t: number; kind: 'pass' | 'punish' | 'fish' | 'drop' | 'floor'; index: number; at: V3 };
export type Flight = { path: { t: number; p: V3 }[]; events: FlightEvent[]; passed: number; spin: V3 };

/** Spin vector of a throw: the pitch's axis plus side spin from the drag. */
export function spinOf(th: Throw): V3 {
  const side = { x: 0, y: th.sideSpin, z: 0 }; const ax = norm({ x: th.pitch.axis.x + side.x, y: th.pitch.axis.y + side.y, z: 0 });
  const w = rpm(th.pitch.rpm * (1 + 0.3 * Math.abs(th.sideSpin))); return { x: ax.x * w, y: ax.y * w, z: 0 };
}

/** Fly the ball from (0, 1, 0) launched at time t0 (fish keep swimming meanwhile). */
export function fly(th: Throw, world: World, t0 = 0, dt = 1 / 600): Flight {
  const dir = norm({ x: th.aim.x, y: th.aim.y, z: 1 }); let v: V3 = { x: dir.x * th.speed, y: dir.y * th.speed, z: dir.z * th.speed };
  let p: V3 = { x: 0, y: 1, z: 0 }; const w = spinOf(th); const path = [{ t: 0, p }]; const events: FlightEvent[] = [];
  let plate = 0; const fishDone = new Set<number>(); let t = 0;
  while (t < 3 && p.z < PLATE_Z[PLATE_Z.length - 1] + 1) {
    const m = cross(w, v); const a = { x: MAGNUS_K * m.x, y: MAGNUS_K * m.y - GRAVITY, z: MAGNUS_K * m.z };
    v = { x: v.x + a.x * dt, y: v.y + a.y * dt, z: v.z + a.z * dt };
    const q = { x: p.x + v.x * dt, y: p.y + v.y * dt, z: p.z + v.z * dt }; t += dt;
    if (q.y < BALL_R) { events.push({ t, kind: 'floor', index: -1, at: q }); path.push({ t, p: q }); break; }
    world.fish.forEach((f, i) => {
      if (fishDone.has(i)) return; const fp = fishAt(f, t0 + t);
      if (Math.hypot(q.x - fp.x, q.y - fp.y, q.z - fp.z) < f.r + BALL_R) { fishDone.add(i); events.push({ t, kind: 'fish', index: i, at: q }); v = { x: v.x + Math.sign(q.x - fp.x || 1) * 1.5, y: v.y + 0.5, z: v.z * 0.85 }; }
    });
    if (plate < world.plates.length && p.z < world.plates[plate].z && q.z >= world.plates[plate].z) {
      const k = (world.plates[plate].z - p.z) / (q.z - p.z); const hit = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: world.plates[plate].z };
      const pl = world.plates[plate];
      if (pl.holes.some((h) => fitsHex(hit, h))) {
        events.push({ t, kind: 'pass', index: plate, at: hit });
        pl.droplets.forEach((d, j) => { if (Math.hypot(d.x - hit.x, d.y - hit.y) < HEX_A * 1.6) events.push({ t, kind: 'drop', index: plate * 100 + j, at: { x: d.x, y: d.y, z: pl.z } }); });
        plate += 1;
      } else { events.push({ t, kind: 'punish', index: plate, at: hit }); path.push({ t, p: hit }); break; }
    }
    p = q; if (path.length === 0 || t - path[path.length - 1].t >= 1 / 120) path.push({ t, p });
  }
  return { path, events, passed: events.filter((e) => e.kind === 'pass').length, spin: w };
}

/** Score: 100 per plate, +30 per droplet shaken loose, −40 per goldfish bumped; all plates = ×2. */
export function score(f: Flight) {
  const s = 100 * f.passed + 30 * f.events.filter((e) => e.kind === 'drop').length - 40 * f.events.filter((e) => e.kind === 'fish').length;
  return f.passed === PLATE_Z.length ? s * 2 : Math.max(0, s);
}

/** Drag on screen → throw. Up the screen is +y, right is +x; a longer drag is a faster pitch. */
export function throwFromDrag(points: { x: number; y: number }[], pitch: Pitch, px = 600): Throw {
  const a = points[0]; const b = points[points.length - 1]; const dx = (b.x - a.x) / px; const dy = (a.y - b.y) / px; const len = Math.hypot(dx, dy);
  let area = 0; for (let i = 1; i < points.length; i += 1) area += (points[i - 1].x - a.x) * (points[i].y - a.y) - (points[i].x - a.x) * (points[i - 1].y - a.y);
  const side = Math.max(-1, Math.min(1, area / (px * px * 0.05)));
  return { aim: { x: dx * 0.35, y: dy * 0.35 - 0.05 }, speed: pitch.speed * Math.max(0.6, Math.min(1.3, 0.6 + len)), pitch, sideSpin: side };
}
