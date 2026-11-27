// Relay sugoroku on a night flight — a questionnaire board game built on `public/data/ow_data.json`.
//
// 200 questions, each retold in two worlds (an Ottoman miniature workshop and Wonderland) with
// four answers (攻撃/革新, 調和/保守, 論理/分析, 情緒/美学) and trait weights A–J. Players are
// passengers in one cabin; a commentary booth (captain, purser, a cat by the window) reacts to
// every answer with a "〜だけれど" line, and that line is handed to the next player as the
// baton. The trait sums are play, not a personality diagnosis.

import { mulberry32 } from '@/lib/retroGrid';

export type World = 'ottoman' | 'wonderland';
export type Archetype = '攻撃/革新' | '調和/保守' | '論理/分析' | '情緒/美学';
export type OwOption = { id: 'A' | 'B' | 'C' | 'D'; archetype: Archetype; ottoman_text: string; wonderland_text?: string; postmodern_text?: string; weights: Record<string, number> };
export type OwQuestion = { id: number; original_oca_question: string; scenarios: Record<World, { title: string; theme: string; description: string }>; options: OwOption[] };

export const TRAITS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export const ARCHETYPES: Archetype[] = ['攻撃/革新', '調和/保守', '論理/分析', '情緒/美学'];
export type Vehicle = 'plane' | 'bus';

/** Option text in a world (one option in the data uses `postmodern_text` for Wonderland). */
export const optionText = (o: OwOption, w: World) => (w === 'ottoman' ? o.ottoman_text : o.wonderland_text ?? o.postmodern_text ?? o.ottoman_text);
/** The 「…」 heading that opens every option text. */
export const headOf = (text: string) => text.match(/^「([^」]+)」/)?.[1] ?? text.slice(0, 12);
/** The rest of the option text after the heading. */
export const bodyOf = (text: string) => text.replace(/^「[^」]+」/, '');

export type SquareKind = 'question' | 'tailwind' | 'turbulence' | 'booth' | 'goal';
export type Square = { i: number; kind: SquareKind; world: World; name: string };

export const BOARD_LEN = 30;
const OTTOMAN_NAMES = ['イスタンブール離陸', 'ボスポラス上空', 'ガラタ塔の灯', '金角湾', 'トプカプの屋根', 'バザールの灯', '細密画工房の窓', 'アナトリアの砂漠', 'オアシスの点', 'キャラバンの道', '月のミナレット', 'スルタンの航路', '黒海の雲', '帝国の境界', '夜明け前の雲海'];
const WONDER_NAMES = ['うさぎの穴', '落下する本棚', '小さな扉', '涙の池', '帽子屋のお茶会', 'チェシャ猫の木', 'キノコの森', '芋虫の煙', '女王のクロッケー場', 'トランプ兵の列', '法廷の雲', '鏡の向こう', '時計の止まった空', '何でもない日', 'ワンダーランド着陸'];
const SPECIAL: Record<number, SquareKind> = { 4: 'tailwind', 8: 'turbulence', 11: 'booth', 17: 'tailwind', 20: 'turbulence', 23: 'booth', 26: 'turbulence' };

export function makeBoard(vehicle: Vehicle): Square[] {
  return Array.from({ length: BOARD_LEN }, (_, i) => {
    const world: World = i < 15 ? 'ottoman' : 'wonderland';
    const base = (world === 'ottoman' ? OTTOMAN_NAMES : WONDER_NAMES)[i % 15];
    const name = vehicle === 'bus' ? base.replace('上空', '停留所').replace('離陸', '発車').replace('着陸', '終点') : base;
    return { i, kind: i === BOARD_LEN - 1 ? 'goal' : SPECIAL[i] ?? 'question', world, name };
  });
}

export function shuffledDeck(seed: number, n = 200): number[] {
  const r = mulberry32(seed); const ids = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = ids.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids;
}

export type Answer = { qid: number; world: World; option: OwOption; square: number };
export type Player = { seat: string; name: string; pos: number; answers: Answer[]; predictions: { hit: boolean }[] };

export const SEATS = ['1A', '1C', '2A', '2C'];

/** Trait sums for one player (A–J). */
export function tally(answers: Answer[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(TRAITS.map((t) => [t, 0]));
  for (const a of answers) for (const [k, v] of Object.entries(a.option.weights)) { const t = k.replace('trait_', ''); if (t in out) out[t] += v; }
  return out;
}
export function archetypeCounts(answers: Answer[]): Record<Archetype, number> {
  const out = Object.fromEntries(ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>;
  for (const a of answers) out[a.option.archetype] += 1;
  return out;
}

const BUT: Record<Archetype, (who: string, head: string, other: string) => string> = {
  '攻撃/革新': (w, h, o) => `${w}は「${h}」を選んだ。強い一歩だ。だけれど、窓に映ったもう一人の${w}は「${o}」のほうを見ていた。`,
  '調和/保守': (w, h, o) => `${w}は「${h}」を選んだ。やさしい選択だ。だけれど、その静けさの下で「${o}」がまだ小さく燃えている。`,
  '論理/分析': (w, h, o) => `${w}は「${h}」で答えた。計算は合っている。だけれど、計算に入らなかった「${o}」が、機内の温度を少しだけ変えた。`,
  '情緒/美学': (w, h, o) => `${w}は「${h}」に身をまかせた。美しい。だけれど、その美しさの外側で「${o}」が着陸の準備をしている。`,
};

/**
 * The purser's "〜だけれど" line: the chosen heading, turned by one of the headings that were not
 * chosen. If the same seat answered differently last time, that turn opens the line.
 */
export function butLine(who: string, q: OwQuestion, world: World, chosen: OwOption, prev?: Answer): string {
  const others = q.options.filter((o) => o.id !== chosen.id);
  const other = others[q.id % others.length];
  const line = BUT[chosen.archetype](who, headOf(optionText(chosen, world)), headOf(optionText(other, world)));
  if (prev && prev.option.archetype !== chosen.archetype) return `さっきは「${headOf(optionText(prev.option, prev.world))}」だったけれど、今回は違う。${line}`;
  return line;
}

const CAT: Record<Archetype, string[]> = {
  '攻撃/革新': ['しっぽが太くなったにゃ。', '窓ガラスに爪を立てたくなる答えにゃ。'],
  '調和/保守': ['毛布の上で丸くなる答えにゃ。', 'のどがごろごろ鳴ったにゃ。'],
  '論理/分析': ['ひげで距離を測っているにゃ。', '高度計をじっと見ているにゃ。'],
  '情緒/美学': ['月を見上げたまま動かないにゃ。', 'ガラスに映った自分に見とれているにゃ。'],
};
export const catLine = (a: Archetype, n: number) => CAT[a][n % 2];

export function captainLine(vehicle: Vehicle, who: string, sq: Square, roll: number, effect: string) {
  const alt = 9000 + sq.i * 950;
  if (vehicle === 'bus') return `運転席より。${who}さん、${roll} つ進んで「${sq.name}」に到着。${effect}`;
  return `機長より。高度 ${alt.toLocaleString()} フィート。${who}さん、${roll} マス進んで「${sq.name}」を通過中。${effect}`;
}
