// The proliferation event: リトルの連れのサル達 (BA-xxxx) and リトルグリーン (PE-xxxx).
// Both the player (clicking one) and the screen (on its own clock) can make more of them.
// Every new member's machine-like name is 4 hex digits of keccak-256 (Ethereum's hash) of its
// parent's name and a counter, so each name points back at its parent — a fingerprint chain.
// When the island is full, the oldest member's shadow leaves to climb the spiral staircase.
// The number of steps climbed is kept, but the page never shows it exactly: アリミノボーイ only
// gives a rough range. Nothing here has a price, and nothing can be bought, sold or cashed out.
import { keccak256 } from '@/lib/meshMetaV2';

export type Kind = 'BA' | 'PE';
export type By = 'player' | 'screen' | 'origin';
export type Member = { id: string; kind: Kind; parent: string | null; gen: number; by: By; born: number; children: number };
export type Swarm = { members: Member[]; climbed: Member[]; tick: number; used: Set<string> };

export const CAP = 40;
export const KINDS: Record<Kind, { name: string; burst: number; note: string }> = {
  BA: { name: 'リトルの連れのサル達', burst: 1, note: '一度に 1 匹ずつ、二つに分かれる' },
  PE: { name: 'リトルグリーン', burst: 2, note: '一度に 2 つずつ、まとめて増える' },
};

const enc = new TextEncoder();
const hex4 = (s: string) => Array.from(keccak256(enc.encode(s)).slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** The child's name: keccak-256 of "parent/n", first 4 hex digits; n moves on if the name is taken. */
export function childId(parent: string, kind: Kind, used: Set<string>, start = 0): string {
  for (let n = start; ; n += 1) { const id = `${kind}-${hex4(`${parent}/${n}`)}`; if (!used.has(id)) return id; }
}

export function newSwarm(): Swarm {
  const used = new Set<string>(); const members: Member[] = [];
  for (const kind of ['BA', 'PE'] as Kind[]) { const id = `${kind}-${hex4(`origin/${kind}`)}`; used.add(id); members.push({ id, kind, parent: null, gen: 0, by: 'origin', born: 0, children: 0 }); }
  return { members, climbed: [], tick: 0, used };
}

/** One member makes more of its kind (BA: 1, PE: 2). Over the cap, the oldest leave for the stairs. */
export function proliferate(s: Swarm, parentId: string, by: By): Swarm {
  const p = s.members.find((m) => m.id === parentId); if (!p) return s;
  const used = new Set(s.used); const born: Member[] = [];
  for (let k = 0; k < KINDS[p.kind].burst; k += 1) {
    const id = childId(p.id, p.kind, used, p.children + k); used.add(id);
    born.push({ id, kind: p.kind, parent: p.id, gen: p.gen + 1, by, born: s.tick, children: 0 });
  }
  let members = s.members.map((m) => (m.id === p.id ? { ...m, children: m.children + born.length } : m)).concat(born);
  const climbed = s.climbed.slice();
  while (members.length > CAP) { climbed.push(members[0]); members = members.slice(1); }
  return { members, climbed, tick: s.tick, used };
}

/** The screen's own move: the member with the fewest children (ties: the oldest) proliferates. Kinds alternate each tick. */
export function screenStep(s: Swarm): Swarm {
  const kind: Kind = s.tick % 2 === 0 ? 'BA' : 'PE';
  const pool = s.members.filter((m) => m.kind === kind); const t = { ...s, tick: s.tick + 1 };
  if (!pool.length) return t;
  const pick = pool.reduce((a, b) => (b.children < a.children ? b : a));
  return proliferate(t, pick.id, 'screen');
}

/** アリミノボーイ's rough count: never the exact number, a range of width 10 that contains it. */
export function roughSteps(n: number): string { if (n === 0) return 'まだ誰も登っていない、と思う'; const lo = Math.floor(n / 10) * 10; return `たぶん ${lo}〜${lo + 10} 段のあいだ`; }

/** Lineage back to the origin: the fingerprint chain of names. */
export function lineage(s: Swarm, id: string): string[] {
  const all = new Map([...s.climbed, ...s.members].map((m) => [m.id, m])); const out: string[] = [];
  for (let m = all.get(id); m; m = m.parent ? all.get(m.parent) : undefined) out.push(m.id);
  return out;
}
