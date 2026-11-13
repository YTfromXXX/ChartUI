// Designer-baby genes for the portrait icons of CELL CONVERGENCE // DIAGNOSTIC.
//
// Each court role (KING ♚, QUEEN ♛, KNIGHT ♞, PAGE ♟) gets a genome of exactly 7 loci — the
// 7-point cloud again — read straight from its simulation parameters, so the icon is computed,
// not hand-drawn. Every locus has an allele A–D (the four quarters of that parameter's range, the
// same A–D as the .meshmeta triangles) and the raw value.
//
// When EX reaches 0 the diagnostic releases its balloon; that is the moment of birth. The baby's
// genome is crossed from two roles drawn in proportion to their cell counts at that moment: each locus comes from
// one parent (a coin flip), with a small chance of mutating to the neighbouring allele. The same
// genome always draws the same face. These are fictional UI genes for icons, not biology.

import type { CourtRole, RoleParams } from '@/app/cure-api/params';
import { EMOJI20 } from './quantumWish';

export type Allele = 'A' | 'B' | 'C' | 'D';
export const LOCI = ['shell', 'pull', 'swirl', 'jitter', 'hue', 'weight', 'crown'] as const;
export type LocusName = (typeof LOCI)[number];
export type Locus = { name: LocusName; allele: Allele; value: number };
/** Exactly seven loci, in LOCI order. */
export type Genome = {
  kind: 'role' | 'baby';
  role: CourtRole | 'BABY';
  loci: [Locus, Locus, Locus, Locus, Locus, Locus, Locus];
  parents: [CourtRole, CourtRole] | null;
  /** Baby only: the d6 rolled for each locus (1–3 → parent A, 4–6 → parent B), in LOCI order. */
  dice?: number[];
  inherit?: ('A' | 'B')[];
  mutations: LocusName[];
  name: string; // the alleles hashed into four emoji-20 digits
};
export type Portrait = { headW: number; headH: number; hue: number; eyeGap: number; hairCurl: number; freckles: number; crown: 0 | 1 | 2 | 3; size: number };

/** Range of each locus, so a value maps to an allele by quarters. */
export const RANGE: Record<LocusName, [number, number]> = {
  shell: [0, 1], pull: [0, 1.6], swirl: [-1, 1], jitter: [0, 0.2], hue: [0, 360], weight: [0, 0.4], crown: [0, 4],
};
const ALLELES: Allele[] = ['A', 'B', 'C', 'D'];
export function alleleOf(name: LocusName, value: number): Allele {
  const [lo, hi] = RANGE[name]; const q = Math.floor(((value - lo) / (hi - lo)) * 4); return ALLELES[Math.max(0, Math.min(3, q))];
}
const CROWN: Record<CourtRole, number> = { KING: 3.5, QUEEN: 2.5, KNIGHT: 1.5, PAGE: 0.5, EX: 0 };

function nameOf(loci: Locus[]): string {
  let h = 2166136261; for (const l of loci) for (const ch of `${l.name}${l.allele}${l.value.toFixed(3)}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h >>>= 0; return Array.from({ length: 4 }, (_, i) => EMOJI20[Math.floor(h / 20 ** i) % 20]).join('');
}
const pack = (loci: Locus[]) => loci as Genome['loci'];

export function genomeOfRole(role: CourtRole, p: RoleParams): Genome {
  const values: Record<LocusName, number> = { shell: p.shell, pull: p.pull, swirl: p.swirl, jitter: p.jitter, hue: p.hue, weight: p.weight, crown: CROWN[role] };
  const loci = LOCI.map((name) => ({ name, value: values[name], allele: alleleOf(name, values[name]) }));
  return { kind: 'role', role, loci: pack(loci), parents: null, mutations: [], name: nameOf(loci) };
}

/** Cross two genomes: each locus from one parent; with probability `mutation` it steps one allele over. */
export function cross(a: Genome, b: Genome, rnd: () => number, mutation = 0.08): Genome {
  const mutations: LocusName[] = []; const dice: number[] = []; const inherit: ('A' | 'B')[] = [];
  const loci = LOCI.map((name, i) => {
    const face = 1 + Math.floor(rnd() * 6); dice.push(face); inherit.push(face <= 3 ? 'A' : 'B');
    const from = face <= 3 ? a.loci[i] : b.loci[i]; let value = from.value;
    if (rnd() < mutation) { const [lo, hi] = RANGE[name]; value = Math.max(lo, Math.min(hi, value + (rnd() < 0.5 ? -1 : 1) * (hi - lo) / 4)); mutations.push(name); }
    return { name, value, allele: alleleOf(name, value) };
  });
  return { kind: 'baby', role: 'BABY', loci: pack(loci), parents: [a.role as CourtRole, b.role as CourtRole], mutations, name: nameOf(loci), dice, inherit };
}

/** Birth at EX = 0: two different parents drawn in proportion to their cell counts (kings and queens are rare parents). */
export function birth(counts: Partial<Record<CourtRole, number>>, genomes: Record<CourtRole, Genome>, rnd: () => number): Genome {
  const pick = (pool: CourtRole[]) => { const total = pool.reduce((a, r) => a + Math.max(1, counts[r] ?? 0), 0); let u = rnd() * total; for (const r of pool) { u -= Math.max(1, counts[r] ?? 0); if (u <= 0) return r; } return pool[pool.length - 1]; };
  const living: CourtRole[] = ['KING', 'QUEEN', 'KNIGHT', 'PAGE']; const a = pick(living); const b = pick(living.filter((r) => r !== a));
  return cross(genomes[a], genomes[b], rnd);
}

/** Genome → face: every feature is a function of one locus, so the icon is fully computable. */
export function portraitOf(g: Genome): Portrait {
  const v = Object.fromEntries(g.loci.map((l) => [l.name, l.value])) as Record<LocusName, number>;
  return {
    headW: 0.62 + 0.3 * v.shell, headH: 0.78 + 0.18 * (1 - v.shell), hue: v.hue, eyeGap: 0.16 + 0.12 * (v.pull / 1.6),
    hairCurl: v.swirl, freckles: Math.round((v.jitter / 0.2) * 6), crown: Math.max(0, Math.min(3, Math.floor(v.crown))) as Portrait['crown'], size: 0.85 + 0.6 * (v.weight / 0.4),
  };
}
/** The two dice the birth shows: 色サイコロ (the hue locus) and アイコンサイコロ (the crown locus). */
export const COLOUR_DIE = LOCI.indexOf('hue'); export const ICON_DIE = LOCI.indexOf('crown');
export const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
/** The name's emoji digits as numbers (base 20): 🎲 is the digit 18, 🌑 is 0. */
export const nameDigits = (name: string) => Array.from(name).map((c) => EMOJI20.indexOf(c));
export const alleleString = (g: Genome) => g.loci.map((l) => l.allele).join('');
