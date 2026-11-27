// "Which book first?" — a vote among three voices, and how the reading order changes their minds.
//
// The voices are Nancy, Grace and Roman: the three words in the name of the Nancy Grace Roman
// Space Telescope, played as three fictional characters (they are not Dr Nancy Grace Roman, the
// astronomer the telescope honours). The books:
//   Neuromancer — William Gibson, 1984. The Sprawl, console cowboys, "cyberspace".
//   Snow Crash  — Neal Stephenson, 1992. Hiro Protagonist, the Metaverse, avatars.
// No text of either book is reproduced.
//
// The order effect: each voice has a taste (how much it values mood vs. play vs. ideas), and a
// book's appeal is the taste-weighted mix of the book's profile. Then memory plays its part:
//   primacy > 0 — the first impression sticks: the first book gains 0.2·primacy, the second loses it;
//   primacy < 0 — the latest wins: the first book fades and the second shines.
// A voice whose two appeals are close can end up preferring whichever book the order favoured.
// When the preferred book flips between reading orders, the interview camera does a Hitchcock
// (dolly) zoom on that voice.

export type BookId = 'neuromancer' | 'snowcrash';
export type Profile = { mood: number; play: number; ideas: number; colour: string };
export const BOOKS: Record<BookId, { title: string; ja: string; author: string; year: number; profile: Profile; note: string }> = {
  neuromancer: { title: 'Neuromancer', ja: 'ニューロマンサー', author: 'William Gibson', year: 1984, profile: { mood: 0.9, play: 0.3, ideas: 0.7, colour: '#2dd4bf' }, note: 'スプロール、コンソール・カウボーイ、「サイバースペース」' },
  snowcrash: { title: 'Snow Crash', ja: 'スノウ・クラッシュ', author: 'Neal Stephenson', year: 1992, profile: { mood: 0.4, play: 0.9, ideas: 0.8, colour: '#f472b6' }, note: 'ヒロ・プロタゴニスト、メタヴァース、アバター' },
};

export type Voice = { id: 'nancy' | 'grace' | 'roman'; name: string; ja: string; taste: { mood: number; play: number; ideas: number }; primacy: number; band: string; spaceColour: string };
/** Each voice also "sees" in its own band — the colour science they bring to the interview. */
export const VOICES: Voice[] = [
  { id: 'nancy', name: 'Nancy', ja: 'ナンシー', taste: { mood: 0.8, play: 0.2, ideas: 0.5 }, primacy: 0.5, band: '可視光（0.4–0.7 µm）', spaceColour: '#93c5fd' },
  { id: 'grace', name: 'Grace', ja: 'グレース', taste: { mood: 0.3, play: 0.8, ideas: 0.4 }, primacy: 0.2, band: '近赤外（Roman の観測帯 0.48–2.3 µm）', spaceColour: '#fca5a5' },
  { id: 'roman', name: 'Roman', ja: 'ローマン', taste: { mood: 0.5, play: 0.5, ideas: 0.9 }, primacy: -0.4, band: '赤方偏移（遠いほど赤へずれる）', spaceColour: '#fcd34d' },
];

export const appeal = (v: Voice, b: BookId) => { const p = BOOKS[b].profile; const t = v.taste; return (t.mood * p.mood + t.play * p.play + t.ideas * p.ideas) / (t.mood + t.play + t.ideas); };

export type Reading = { order: [BookId, BookId]; after1: number; after2: Record<BookId, number>; prefers: BookId };
export function read(v: Voice, order: [BookId, BookId]): Reading {
  const [a, b] = order; const A = appeal(v, a); const B = appeal(v, b); const m = 0.2 * v.primacy;
  const after2 = { [a]: A + m, [b]: B - m } as Record<BookId, number>;
  return { order, after1: A, after2, prefers: after2.neuromancer >= after2.snowcrash ? 'neuromancer' : 'snowcrash' };
}
/** Did the reading order change what this voice prefers? */
export function flips(v: Voice) { const x = read(v, ['neuromancer', 'snowcrash']); const y = read(v, ['snowcrash', 'neuromancer']); return { flip: x.prefers !== y.prefers, nFirst: x, sFirst: y }; }

/** The vote "which book first?" before reading: the voice votes for the book it expects to like more. */
export const vote = (v: Voice): BookId => (appeal(v, 'neuromancer') >= appeal(v, 'snowcrash') ? 'neuromancer' : 'snowcrash');

export type Line = { who: string; text: string; zoom?: boolean };
/** The interview script for one reading order, built from the numbers (deterministic). */
export function interview(order: [BookId, BookId]): Line[] {
  const [a, b] = order; const A = BOOKS[a]; const B = BOOKS[b]; const lines: Line[] = [];
  lines.push({ who: 'Mente', text: `今日の順番は『${A.ja}』（${A.year}）→『${B.ja}』（${B.year}）。宇宙の色で答えてください。` });
  for (const v of VOICES) {
    const r = read(v, order); const f = flips(v).flip;
    lines.push({ who: v.ja, text: `先に読むなら『${BOOKS[vote(v)].ja}』に一票。わたしの目は${v.band}。` });
    lines.push({ who: v.ja, text: `『${A.ja}』のあと：${Math.round(r.after1 * 100)} 点。${A.note}が、${v.id === 'grace' ? '熱として' : v.id === 'roman' ? '遠くの光として' : '色として'}残る。` });
    lines.push({ who: v.ja, text: `『${B.ja}』のあと：${Math.round(r.after2[b] * 100)} 点。${v.primacy > 0 ? `最初の『${A.ja}』の印象が消えない（${Math.round(r.after2[a] * 100)} 点に上がった）` : `最初の『${A.ja}』は薄れてきた（${Math.round(r.after2[a] * 100)} 点）`}。いまは『${BOOKS[r.prefers].ja}』派。`, zoom: f });
    if (f) lines.push({ who: 'Mente', text: `${v.ja}さんは、順番が逆なら逆の本を選んでいました — 引きのズーム。` });
  }
  return lines;
}
