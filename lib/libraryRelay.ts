// The library entrance: the telescopes walk in, and each one logs in (VR / MR where the device
// supports it) by receiving a memory bookmark (思い出のしおり). The bookmarks are a relay that starts
// at A Thousand Plateaus and passes from author to author, each step a documented link:
//
//   Deleuze & Guattari → Bergson   Deleuze wrote "Le Bergsonisme" (1966)
//   Bergson → Proust                Proust was best man at Bergson's wedding (1892) to Proust's cousin
//   Proust → Benjamin               Benjamin translated "À la recherche" into German with Franz Hessel
//   Benjamin → Baudelaire           Benjamin translated "Tableaux parisiens" (1923)
//   Baudelaire → Poe                Baudelaire translated Poe's tales into French (from 1856)
//   Poe → Borges                    Borges wrote on Poe as the inventor of the detective story
//   Borges → Deleuze & Guattari     Deleuze cites Borges ("Difference and Repetition", "The Logic of Sense") — the loop closes
//
// Each bookmark has two cards:
//   A. a composite two-shot of this author with the next one;
//   B. the next author's chosen work, as a book and a profile card.
// Portraits and covers are drawn by ChartUI (initials and shapes). No photographs or real covers
// are reproduced; licensed or public-domain images can be dropped into `portrait` later.

export type Author = { id: string; name: string; ja: string; years: string; initials: string; hue: number };
export type Work = { title: string; ja: string; year: string; format: 'book' | 'unfinished' | 'poems' | 'tales' | 'stories' | 'novel' };
export type Bookmark = { from: Author; to: Author; link: string; work: Work };

export const AUTHORS: Author[] = [
  { id: 'dg', name: 'Gilles Deleuze & Félix Guattari', ja: 'ドゥルーズ＝ガタリ', years: '1925–1995 / 1930–1992', initials: 'D&G', hue: 352 },
  { id: 'bergson', name: 'Henri Bergson', ja: 'ベルクソン', years: '1859–1941', initials: 'HB', hue: 210 },
  { id: 'proust', name: 'Marcel Proust', ja: 'プルースト', years: '1871–1922', initials: 'MP', hue: 280 },
  { id: 'benjamin', name: 'Walter Benjamin', ja: 'ベンヤミン', years: '1892–1940', initials: 'WB', hue: 35 },
  { id: 'baudelaire', name: 'Charles Baudelaire', ja: 'ボードレール', years: '1821–1867', initials: 'CB', hue: 140 },
  { id: 'poe', name: 'Edgar Allan Poe', ja: 'ポー', years: '1809–1849', initials: 'EAP', hue: 250 },
  { id: 'borges', name: 'Jorge Luis Borges', ja: 'ボルヘス', years: '1899–1986', initials: 'JLB', hue: 50 },
];

export const START: Work = { title: 'Mille plateaux', ja: '千のプラトー', year: '1980', format: 'book' };

export const RELAY: Bookmark[] = [
  { from: AUTHORS[0], to: AUTHORS[1], link: 'ドゥルーズは『ベルクソニズム』（1966）を書いた', work: { title: 'Matière et mémoire', ja: '物質と記憶', year: '1896', format: 'book' } },
  { from: AUTHORS[1], to: AUTHORS[2], link: 'プルーストはベルクソンの結婚式（1892）で付添人を務めた（花嫁はプルーストのいとこ）', work: { title: 'À la recherche du temps perdu', ja: '失われた時を求めて', year: '1913–1927', format: 'novel' } },
  { from: AUTHORS[2], to: AUTHORS[3], link: 'ベンヤミンはフランツ・ヘッセルと『失われた時を求めて』をドイツ語に訳した', work: { title: 'Das Passagen-Werk', ja: 'パサージュ論', year: '1927–1940（刊行 1982）', format: 'unfinished' } },
  { from: AUTHORS[3], to: AUTHORS[4], link: 'ベンヤミンはボードレールの『パリ情景』を訳した（1923）', work: { title: 'Les Fleurs du mal', ja: '悪の華', year: '1857', format: 'poems' } },
  { from: AUTHORS[4], to: AUTHORS[5], link: 'ボードレールはポーの短編をフランス語に訳した（1856 年から）', work: { title: 'The Purloined Letter', ja: '盗まれた手紙', year: '1844', format: 'tales' } },
  { from: AUTHORS[5], to: AUTHORS[6], link: 'ボルヘスはポーを推理小説の発明者として論じた', work: { title: 'Ficciones', ja: '伝奇集（「バベルの図書館」を収録）', year: '1944', format: 'stories' } },
  { from: AUTHORS[6], to: AUTHORS[0], link: 'ドゥルーズは『差異と反復』『意味の論理学』でボルヘスを引いた — ここで輪が閉じる', work: START },
];

/** The telescopes that walk in (orbits as planned in mid-2026; see docs/roadmap.md). */
export const TELESCOPES = [
  { id: 'roman', name: 'Roman', orbit: 'L2', aperture: 2.4 },
  { id: 'plato', name: 'PLATO', orbit: 'L2', aperture: 0.12 },
  { id: 'csst', name: 'CSST 巡天', orbit: '低軌道', aperture: 2.0 },
  { id: 'jasmine', name: 'JASMINE', orbit: '低軌道', aperture: 0.36 },
  { id: 'ariel', name: 'ARIEL', orbit: 'L2', aperture: 1.0 },
  { id: 'litebird', name: 'LiteBIRD', orbit: 'L2', aperture: 0.4 },
  { id: 'euclid', name: 'Euclid', orbit: 'L2', aperture: 1.2 },
] as const;

// ---------- the title sequence ----------
export const PILLARS = 7;
export const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return 1 - (1 - t) ** 3; };

/** Pillar k (0 = first in) slides in from the right: 0 = off screen right, 1 = in place. 90 ms apart, 320 ms each. */
export const pillarIn = (tMs: number, k: number) => ease((tMs - k * 90) / 320);

/**
 * Dolly zoom (the Vertigo shot): the camera pulls back from d0 to d1 while the field of view
 * narrows, so the title keeps the same width w on screen and the room behind it stretches.
 * fov = 2·atan(w / 2d).
 */
export function dollyZoom(tMs: number, opts: { startMs?: number; ms?: number; d0?: number; d1?: number; width?: number } = {}) {
  const { startMs = 700, ms = 1600, d0 = 3, d1 = 9, width = 2.4 } = opts;
  const k = ease((tMs - startMs) / ms); const d = d0 + (d1 - d0) * k;
  return { k, distance: d, fovDeg: (2 * Math.atan(width / (2 * d)) * 180) / Math.PI };
}

/**
 * The frame's top and bottom edges act like magnets: as the zoom runs they are pulled toward the
 * title line (the letterbox closes in), then let go a little. Returns the gap as a fraction of
 * the half-height (1 = edges at the frame, 0.28 = closest).
 */
export function magnetGap(tMs: number, startMs = 700, ms = 1600) {
  const k = ease((tMs - startMs) / ms); const release = ease((tMs - startMs - ms) / 500);
  return 1 - 0.72 * k + 0.18 * release;
}

export type Beat = { kind: 'enter' | 'title' | 'A' | 'B'; index: number; startMs: number; ms: number; title: string };
/** The whole relay as a timeline: entrance, then for each bookmark a title, card A and card B. */
export function timeline(opts: { titleMs?: number; cardMs?: number; enterMs?: number } = {}): Beat[] {
  const { titleMs = 2600, cardMs = 3200, enterMs = 3000 } = opts; const out: Beat[] = [{ kind: 'enter', index: -1, startMs: 0, ms: enterMs, title: START.ja }];
  let t = enterMs;
  RELAY.forEach((b, i) => {
    out.push({ kind: 'title', index: i, startMs: t, ms: titleMs, title: i % 2 === 0 ? b.work.ja : b.to.ja }); t += titleMs; // titles alternate: book name / profile
    out.push({ kind: 'A', index: i, startMs: t, ms: cardMs, title: `${b.from.ja} × ${b.to.ja}` }); t += cardMs;
    out.push({ kind: 'B', index: i, startMs: t, ms: cardMs, title: b.work.ja }); t += cardMs;
  });
  return out;
}
export const totalMs = (beats: Beat[]) => beats[beats.length - 1].startMs + beats[beats.length - 1].ms;
/** Which beat is playing at time t; the relay loops forever (Borges hands back to Deleuze & Guattari). */
export function beatAt(beats: Beat[], tMs: number) {
  const T = totalMs(beats); const t = ((tMs % T) + T) % T;
  const beat = beats.find((b) => t >= b.startMs && t < b.startMs + b.ms) ?? beats[0];
  return { beat, local: t - beat.startMs };
}
