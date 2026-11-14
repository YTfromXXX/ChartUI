// From a quantum baby to a character (game). The steps, each pure and repeatable from one seed:
//  1. the BABY: a bundle of paths leaving one point (the paths a particle could take before it is measured);
//  2. MEASURE with ミュウの規則: the bundle collapses to one path, and the strain is decided (29 種 or 92 種);
//  3. COLOUR: two hair colours (left, right) are drawn from the cast's four chosen colours;
//  4. CHARACTER: a name from kana syllables, a temperament from the strain, and one line from the path's shape.
// The same seed always gives the same character (checked by sameCharacter).
import type { Strain } from '@/lib/museum';

export type Baby = { seed: number; paths: { a: number; curl: number }[]; chosen: number };
export type Character = { seed: number; name: string; strain: Strain; left: string; right: string; trait: string; line: string; baby: Baby };

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function baby(seed: number): Baby {
  const r = rng(seed); const n = 5 + Math.floor(r() * 4);
  const paths = Array.from({ length: n }, () => ({ a: r() * Math.PI * 2, curl: (r() - 0.5) * 2 }));
  return { seed, paths, chosen: Math.floor(r() * n) };
}

const KANA = ['ア', 'リ', 'ミ', 'ノ', 'ル', 'ナ', 'ペ', 'ト', 'ネ', 'ヨ', 'ス', 'ケ', 'ソ', 'ラ', 'キ', 'ハ', 'セ', 'ユ'];
const TRAIT: Record<Strain, string[]> = {
  29: ['返事が早い', '忘れるのも早い', '高い声で数を読む', '答えを先に言いたがる'],
  92: ['同じことを三回たしかめる', '低い声でゆっくり話す', '間違いを数えるのが上手い', '布をめくらない'],
};

/** The full chain, from one seed and the cast's four colours. */
export function makeCharacter(seed: number, four: string[]): Character {
  const b = baby(seed); const r = rng(seed ^ 0x9e3779b9);
  const p = b.paths[b.chosen];
  const strain: Strain = p.curl < 0 ? 29 : 92; // measuring: a path curling left becomes 29 種, right becomes 92 種
  const left = four[Math.floor(r() * four.length)]; let right = four[Math.floor(r() * four.length)]; if (right === left) right = four[(four.indexOf(left) + 1) % four.length];
  const len = 3 + Math.floor(r() * 2); const name = Array.from({ length: len }, () => KANA[Math.floor(r() * KANA.length)]).join('');
  const trait = TRAIT[strain][Math.floor(r() * 4)];
  const line = Math.abs(p.curl) > 0.6 ? 'ぐるりと回ってから、ここに来た。' : Math.abs(p.curl) > 0.25 ? '少し曲がって、ここに来た。' : 'まっすぐ、ここに来た。';
  return { seed, name, strain, left, right, trait, line, baby: b };
}

export const sameCharacter = (seed: number, four: string[]) => JSON.stringify(makeCharacter(seed, four)) === JSON.stringify(makeCharacter(seed, four));
