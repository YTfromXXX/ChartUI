// Crystal Baby battle: lift jelly-crystal babies out of the super-fusion box with a UFO claw.
//
// The box is split by a mirror (like the 2D mirror of Animal Crash): Mente plays the left half,
// FamiDance the right, and the right half is the exact mirror image of the left, so both face the
// same puzzle. Each half holds 7 capsules on a 7-point cloud (a hexagon plus its centre — one cell
// of a honeycomb). Inside each capsule sits a baby whose "gene" is its own 7-point cloud; the gene
// sets where the baby's centre of mass leans.
//
// The lift is decided by geometry, not luck. The UFO (an octagonal mahjong-table saucer) drops
// three prongs 120° apart that close straight inward. For each prong:
//   • it must hit the capsule at all;
//   • the push makes an angle θ with the surface normal; the prong holds only while the force it
//     needs — sideways F·sinθ and a third of the weight upward — fits inside the friction cone μ·F·cosθ;
// and the baby's centre of mass must lie inside the triangle of the three contacts, or it tips out.
// μ comes from the friction between retro-grid pages A and B (0 = they move together … 1 = against).
//
// The two sides keep their own design approach:
//   Mente     — calm and exact: remote-control steps, a fixed firm grip.
//   FamiDance — free drag, released on the beat: the closer to the beat, the stronger the grip.
// BINGO: each player's card is a 7-point cloud of the same 7 numbers in a different order; a lifted
// baby marks its number. Any line through the centre (3 in a row) is BINGO.

export type P2 = { x: number; y: number };
export type Capsule = { id: number; side: 'mente' | 'fami'; c: P2; r: number; mass: number; gene: P2[]; com: P2; number: number; lifted: boolean; nudges: number };
export type Card = { numbers: number[]; marked: boolean[] };

export const PRONGS = 3;
export const G = 1; // weight unit: a baby of mass 1 weighs 1
export const MENTE_FORCE = 1.6;
export const FAMI_FORCE_MAX = 2.1;
export const BPM = 120;
export const BINGO_LINES: [number, number, number][] = [[1, 0, 4], [2, 0, 5], [3, 0, 6]]; // index 0 = centre, 1–6 = ring

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Hexagon + centre: the 7-point cloud. */
export function heptad(c: P2, s: number): P2[] {
  return [c, ...Array.from({ length: 6 }, (_, k) => ({ x: c.x + s * Math.cos((k * Math.PI) / 3), y: c.y + s * Math.sin((k * Math.PI) / 3) }))];
}
export const mirror = (p: P2): P2 => ({ x: -p.x, y: p.y });
export const muFromFriction = (f: number) => 0.15 + 0.85 * Math.max(0, Math.min(1, f));

/** One round: 7 capsules on the left, their mirror images on the right, and two BINGO cards. */
export function makeRound(seed: number, half = 1, r = 0.11) {
  const rnd = rng(seed); const pool = Array.from({ length: 22 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const numbers = pool.slice(0, 7);
  const spots = heptad({ x: -half / 2, y: 0 }, r * 2.6);
  const left: Capsule[] = spots.map((c, i) => {
    // The gene: a 7-point cloud squeezed off-centre; its mean is where the baby's weight sits.
    const lean = { x: (rnd() - 0.5) * r * 0.8, y: (rnd() - 0.5) * r * 0.8 };
    const gene = heptad(lean, r * (0.35 + 0.15 * rnd())).map((p) => ({ x: p.x + (rnd() - 0.5) * r * 0.2, y: p.y + (rnd() - 0.5) * r * 0.2 }));
    const com = { x: gene.reduce((a, p) => a + p.x, 0) / 7, y: gene.reduce((a, p) => a + p.y, 0) / 7 };
    return { id: i, side: 'mente', c, r, mass: 0.6 + 0.8 * rnd(), gene, com, number: numbers[i], lifted: false, nudges: 0 };
  });
  const right: Capsule[] = left.map((k) => ({ ...k, id: k.id + 7, side: 'fami', c: mirror(k.c), gene: k.gene.map(mirror), com: mirror(k.com) }));
  const shuffled = (): Card => { const n = [...numbers]; for (let i = n.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [n[i], n[j]] = [n[j], n[i]]; } return { numbers: n, marked: n.map(() => false) }; };
  return { capsules: [...left, ...right], cards: { mente: shuffled(), fami: shuffled() } };
}

export type ProngContact = { hit: boolean; at?: P2; theta?: number; need?: number; cap?: number; holds: boolean };
export type Grip = { ok: boolean; reason: string; contacts: ProngContact[]; comInside: boolean };

/** Where a prong that starts at distance R from P (direction u) and closes inward first touches the circle. */
function firstHit(P: P2, u: P2, R: number, c: P2, r: number): P2 | null {
  const Q = { x: P.x + u.x * R, y: P.y + u.y * R }; const d = { x: -u.x, y: -u.y };
  const f = { x: Q.x - c.x, y: Q.y - c.y }; const b = f.x * d.x + f.y * d.y; const cc = f.x * f.x + f.y * f.y - r * r; const disc = b * b - cc;
  if (disc < 0) return null; const t = -b - Math.sqrt(disc); if (t < 0 || t > R) return null;
  return { x: Q.x + d.x * t, y: Q.y + d.y * t };
}
const cross = (o: P2, a: P2, b: P2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
export function insideTriangle(p: P2, a: P2, b: P2, c: P2) { const d1 = cross(a, b, p); const d2 = cross(b, c, p); const d3 = cross(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }

/** Can the claw centred at P, turned by `angle`, lift this capsule with grip force F and friction μ? */
export function grip(P: P2, angle: number, cap: Capsule, mu: number, F: number): Grip {
  const R = cap.r * 1.7; const contacts: ProngContact[] = [];
  for (let k = 0; k < PRONGS; k += 1) {
    const a = angle + (k * 2 * Math.PI) / PRONGS; const u = { x: Math.cos(a), y: Math.sin(a) };
    const at = firstHit(P, u, R, cap.c, cap.r);
    if (!at) { contacts.push({ hit: false, holds: false }); continue; }
    const n = { x: (at.x - cap.c.x) / cap.r, y: (at.y - cap.c.y) / cap.r };
    const cos = Math.max(-1, Math.min(1, u.x * n.x + u.y * n.y)); // push −u against the inward normal −n: (−u)·(−n) = u·n
    const theta = Math.acos(cos);
    const need = Math.hypot(F * Math.sin(theta), (cap.mass * G) / PRONGS); const capF = mu * F * Math.max(0, Math.cos(theta));
    contacts.push({ hit: true, at, theta, need, cap: capF, holds: need <= capF });
  }
  const pts = contacts.filter((c) => c.at).map((c) => c.at as P2);
  const com = { x: cap.c.x + cap.com.x, y: cap.c.y + cap.com.y };
  const comInside = pts.length === 3 && insideTriangle(com, pts[0], pts[1], pts[2]);
  let reason = '持ち上がった';
  if (contacts.some((c) => !c.hit)) reason = `爪が外れた（${contacts.filter((c) => !c.hit).length} 本）`;
  else if (!comInside) reason = '重心が爪の三角形の外 — 傾いて落ちた';
  else if (contacts.some((c) => !c.holds)) reason = `滑った（最大の角度 ${Math.round((Math.max(...contacts.map((c) => c.theta ?? 0)) * 180) / Math.PI)}°、摩擦円錐 ${Math.round((Math.atan(mu) * 180) / Math.PI)}°）`;
  return { ok: reason === '持ち上がった', reason, contacts, comInside };
}

/** FamiDance's grip: release on the beat for full strength, 250 ms off the beat for none. */
export function beatForce(nowMs: number, bpm = BPM) {
  const period = 60000 / bpm; const phase = ((nowMs % period) + period) % period; const err = Math.min(phase, period - phase);
  return { err, force: FAMI_FORCE_MAX * Math.max(0, 1 - err / 250) };
}

export function mark(card: Card, n: number): Card { return { numbers: card.numbers, marked: card.numbers.map((x, i) => card.marked[i] || x === n) }; }
export const isBingo = (card: Card) => BINGO_LINES.some((l) => l.every((i) => card.marked[i]));

/** A failed grab shoves the capsule a little toward where the prongs pushed it. */
export function nudge(cap: Capsule, g: Grip): Capsule {
  const pts = g.contacts.filter((c) => c.at).map((c) => c.at as P2); if (!pts.length) return cap;
  const m = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
  const d = { x: cap.c.x - m.x, y: cap.c.y - m.y }; const L = Math.hypot(d.x, d.y) || 1; const s = cap.r * 0.15;
  return { ...cap, c: { x: cap.c.x + (d.x / L) * s, y: cap.c.y + (d.y / L) * s }, nudges: cap.nudges + 1 };
}
