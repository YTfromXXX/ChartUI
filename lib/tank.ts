// "The big water tank" — a water Cherenkov detector modelled on public facts about Super-Kamiokande
// (no logo or branding copied). Facts used:
//  • a cylinder about 39 m across and 41 m tall, 50,000 t of very pure water, about 1,000 m underground;
//  • about 11,000 large photomultiplier tubes (PMTs) on the inner wall;
//  • a fast charged particle in water makes a cone of Cherenkov light at about 42°; on the wall it is a ring;
//  • a muon makes a sharp ring, an electron a fuzzy one (it showers) — that is how μ-like and e-like are told apart;
//  • atmospheric neutrinos: roughly two muon-type for one electron-type at low energies; those coming up
//    through the Earth (~13,000 km) lose muon-type more than those from above (~15 km): oscillation (1998);
//  • cosmic-ray muons still reach the tank through the rock, about 2 per second.
// The event rate here is fast-forwarded; the real atmospheric-neutrino rate is about ten per day.
export const R = 19.65; export const HH = 20.7; // radius, half-height (m)
export const CHERENKOV = (42 * Math.PI) / 180;

export type Pmt = { x: number; y: number; z: number; part: 'top' | 'barrel' | 'bottom'; u: number; v: number };
/** A thinned PMT layout (about 3,000 drawn of ~11,000) with unrolled coordinates u, v in 0..1. */
export function pmts(): Pmt[] {
  const out: Pmt[] = []; const cols = 84; const rows = 40;
  for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
    const a = (i / cols) * Math.PI * 2; const z = -HH + ((j + 0.5) / rows) * 2 * HH;
    out.push({ x: R * Math.cos(a), y: R * Math.sin(a), z, part: 'barrel', u: i / cols, v: 1 - (j + 0.5) / rows });
  }
  const step = 1.9;
  for (let x = -R; x <= R; x += step) for (let y = -R; y <= R; y += step) {
    if (x * x + y * y > (R - 0.6) ** 2) continue;
    out.push({ x, y, z: HH, part: 'top', u: x / R, v: y / R }); out.push({ x, y, z: -HH, part: 'bottom', u: x / R, v: y / R });
  }
  return out;
}

export type Flavor = 'mu' | 'e';
export type Ev = { id: number; kind: 'atm' | 'cosmic'; flavor: Flavor; cosZ: number; energy: number; vertex: [number, number, number]; dir: [number, number, number]; L: number };

const RE = 6371; const H_ATM = 15;
/** Distance a neutrino travels from where it was made in the air (cosZ = +1: from straight above). */
export const baseline = (cosZ: number) => Math.sqrt((RE + H_ATM) ** 2 - RE * RE * (1 - cosZ * cosZ)) - RE * cosZ;
/** Muon-neutrino survival, two flavours, maximal mixing, Δm² = 2.5 × 10⁻³ eV². */
export const survive = (L: number, E: number) => 1 - Math.sin(1.27 * 2.5e-3 * L / E) ** 2;

let nextId = 1;
export function makeEvent(rnd: () => number, oscillate: boolean): Ev {
  if (rnd() < 0.35) { // a cosmic-ray muon: from above, entering through the top
    const a = rnd() * Math.PI * 2; const c = 0.7 + rnd() * 0.3; const s = Math.sqrt(1 - c * c);
    return { id: nextId++, kind: 'cosmic', flavor: 'mu', cosZ: c, energy: 50, vertex: [(rnd() - 0.5) * R, (rnd() - 0.5) * R, HH - 0.5], dir: [s * Math.cos(a), s * Math.sin(a), -c], L: 0 };
  }
  const cosZ = rnd() * 2 - 1; const E = 0.5 + rnd() * 6; const L = baseline(cosZ);
  const flavor: Flavor = rnd() < 2 / 3 ? 'mu' : 'e';
  // oscillation: a muon-type that changed (mostly into τ-type, which this detector rarely sees) simply goes missing
  if (flavor === 'mu' && oscillate && rnd() > survive(L, E)) return makeEvent(rnd, oscillate);
  const a = rnd() * Math.PI * 2; const s = Math.sqrt(1 - cosZ * cosZ);
  const r = Math.sqrt(rnd()) * (R - 4); const b = rnd() * Math.PI * 2;
  return { id: nextId++, kind: 'atm', flavor, cosZ, energy: E, L, vertex: [r * Math.cos(b), r * Math.sin(b), (rnd() * 2 - 1) * (HH - 4)], dir: [-s * Math.cos(a), -s * Math.sin(a), -cosZ] };
}

/** PMT hits: on the Cherenkov ring, sharp for μ, fuzzy for e. Returns charge (0..1) and time (ns) per hit PMT. */
export function hits(ev: Ev, P: Pmt[], dead: Set<number>, rnd: () => number) {
  const out: { k: number; q: number; t: number }[] = []; const width = ev.flavor === 'mu' ? 0.035 : 0.13;
  P.forEach((p, k) => {
    if (dead.has(k)) return;
    const dx = p.x - ev.vertex[0]; const dy = p.y - ev.vertex[1]; const dz = p.z - ev.vertex[2]; const d = Math.hypot(dx, dy, dz);
    const cos = (dx * ev.dir[0] + dy * ev.dir[1] + dz * ev.dir[2]) / d; const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
    const off = Math.abs(ang - CHERENKOV); let q = Math.exp(-((off / width) ** 2));
    if (ev.flavor === 'mu' && ang < CHERENKOV) q = Math.max(q, 0.25 * (1 - (CHERENKOV - ang) / CHERENKOV) * (ev.kind === 'cosmic' ? 1 : 0.5)); // a muon's ring fills in as it travels
    q *= 0.6 + 0.4 * rnd(); if (rnd() < 0.004) q = Math.max(q, 0.12); // dark noise
    if (q > 0.12) out.push({ k, q, t: d / 0.225 }); // light in water ≈ 0.225 m/ns
  });
  return out;
}
