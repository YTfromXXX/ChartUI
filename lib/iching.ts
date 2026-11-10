// The 384 axis: the I Ching's 64 hexagrams × 6 lines (爻) = 384 — the same count as the
// spiral candy grid. Lines are read bottom to top; 1 = yang (—), 0 = yin (- -).
// From the Great Ultimate (太極) come the two modes (両儀), the four images (四象) and the
// eight trigrams (八卦): one country that splits into four.

export const TRIGRAMS: Record<string, { name: string; glyph: string; image: string }> = {
  '111': { name: '乾', glyph: '☰', image: '天' },
  '110': { name: '兌', glyph: '☱', image: '沢' },
  '101': { name: '離', glyph: '☲', image: '火' },
  '100': { name: '震', glyph: '☳', image: '雷' },
  '011': { name: '巽', glyph: '☴', image: '風' },
  '010': { name: '坎', glyph: '☵', image: '水' },
  '001': { name: '艮', glyph: '☶', image: '山' },
  '000': { name: '坤', glyph: '☷', image: '地' },
};

/** The four images (四象) = the four countries. Key: lower line, upper line. */
export const FOUR_IMAGES: { key: string; name: string; note: string }[] = [
  { key: '11', name: '老陽（太陽）', note: '満ちきった陽。次は陰へ反転する' },
  { key: '10', name: '少陰', note: '陽の上に陰が芽生える' },
  { key: '01', name: '少陽', note: '陰の上に陽が芽生える' },
  { key: '00', name: '老陰（太陰）', note: '満ちきった陰。次は陽へ反転する' },
];

const POSITION = ['初', '二', '三', '四', '五', '上'];
const YANG = '九'; const YIN = '六';

/** Classical line name, e.g. 初九 (yang in the first place), 六二 (yin in the second). */
export function lineName(position: number, yang: boolean) {
  const n = yang ? YANG : YIN;
  return position === 0 || position === 5 ? `${POSITION[position]}${n}` : `${n}${POSITION[position]}`;
}

/** A short text effect for each place (written for the game; not a translation). */
const PLACE_EFFECT = [
  '地中に潜む。まだ動かない',
  '畑に現れる。仲間が見つかる',
  '昼も夜も励む。危うさを知る',
  '淵で躍る。進むか退くか',
  '天を飛ぶ。最も強い位置',
  '昇りすぎる。悔いが残る',
];

export function lineEffect(position: number, yang: boolean) {
  return `${lineName(position, yang)}：${PLACE_EFFECT[position]}${yang ? '（陽：攻める）' : '（陰：受け止める）'}`;
}

export type Reading = {
  /** Lines of the current (possibly partial) hexagram, bottom to top. */
  lines: (0 | 1)[];
  lower?: (typeof TRIGRAMS)[string];
  upper?: (typeof TRIGRAMS)[string];
  /** Binary (Fu Xi) order 0–63 of a completed hexagram, bottom line = least significant. */
  binary?: number;
  /** Position on the 384 axis = all lines cast so far, mod 384. */
  axis: number;
  latest?: string;
};

export function readLines(all: (0 | 1)[]): Reading {
  const done = all.length % 6;
  const lines = done === 0 && all.length ? all.slice(-6) : all.slice(all.length - done);
  const tri = (part: (0 | 1)[]) => (part.length === 3 ? TRIGRAMS[part.join('')] : undefined);
  const binary = lines.length === 6 ? lines.reduce<number>((n, v, i) => n | (v << i), 0) : undefined;
  const last = all.length ? all[all.length - 1] : undefined;
  return {
    lines,
    lower: tri(lines.slice(0, 3)),
    upper: tri(lines.slice(3, 6)),
    binary,
    axis: all.length % 384,
    latest: last === undefined ? undefined : lineEffect((all.length - 1) % 6, last === 1),
  };
}
