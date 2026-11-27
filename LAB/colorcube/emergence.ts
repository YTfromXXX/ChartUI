// Color emergence program for the colorcube LAB.
//
// Color appears on a sheet of graph paper the way water spreads: a first drop makes a
// paired stream (interference doublet), the next wave lands twice as far away, a
// horizontal spread crosses them, the first wave washes the crossing white, a cut
// interrupts the far stream, a fold gathers a star at the center, and cure glyphs
// scatter like droplets. Each step is one verb (process-as-sculpture, after Richard
// Serra's idea that the action itself defines the form).
//
// Reference geometry (seed 0) was measured from the 48 × 36 study sheet:
// green pair at columns 9 and 11, blue at 27 (= 9 + 2 × 9), horizontal band at rows 7–8.

import { mulberry32 } from '@/lib/retroGrid';

export const SHEET = { cols: 48, rows: 36, cell: 20 } as const;

export const PALETTE = {
  paper: '#ffffff',
  rule: '#c8c8c8',
  green: '#1db100',
  blue: '#5ac8fa',
  navy: '#0b1f33',
  red: '#b3260f',
  black: '#000000',
  gray: '#d4d4d4',
  ink: '#0a74c4',
  amber: '#f5a623',
} as const;

export type Verb = 'lay' | 'drop' | 'pair' | 'wave' | 'spread' | 'wash' | 'cut' | 'fold' | 'scatter';

export type Layer =
  | { kind: 'grid'; cols: number; rows: number }
  | { kind: 'vband'; col: number; color: string; wave: 1 | 2 }
  | { kind: 'hband'; row: number; rows: 2; top: [string, string]; bottom: [string, string] }
  | { kind: 'wash'; col: number; row: number }
  | { kind: 'cut'; col: number; row: number; fill: string }
  | { kind: 'fold'; cx: number; cy: number; size: number }
  | { kind: 'glyph'; col: number; row: number; color: string; glyph: 'cure' | 'btc' | 'dot' | 'equals' };

export type EmergenceStep = {
  index: number;
  verb: Verb;
  /** What emerges, in the order of a reading of the sheet. */
  note: string;
  layers: Layer[];
};

export function buildEmergenceProgram(seed = 0): EmergenceStep[] {
  const rand = mulberry32(1000 + seed);
  const jitter = (span: number) => (seed === 0 ? 0 : Math.round((rand() - 0.5) * 2 * span));
  const { cols, rows } = SHEET;

  // Water-like regularity: the first drop sets the wavelength, the next wave lands 2λ away.
  const c0 = Math.min(15, Math.max(4, 9 + jitter(3))); // keeps the far wave (3 × c0) on the sheet
  const pairGap = 2;
  const c2 = Math.min(cols - 3, c0 + 2 * c0);
  const hr = Math.max(3, 7 + jitter(2));
  const cx = Math.round((c0 + pairGap + c2) / 2) + 4;
  const cy = Math.round(rows * 0.47) + jitter(2);
  const cutRow = Math.min(rows - 5, cy + 10 + jitter(2));

  const washCols = [c0 - 1, c0, c0 + 1, c0 + pairGap];
  const cureCluster: Layer[] = [
    [c2 - 1, cy + 7, PALETTE.red], [c2, cy + 7, PALETTE.ink], [c2 + 1, cy + 7, PALETTE.red], [c2 + 2, cy + 7, PALETTE.red],
    [c2, cy + 8, PALETTE.ink], [c2 + 1, cy + 8, PALETTE.red], [c2 + 2, cy + 8, PALETTE.green], [c2 + 3, cy + 8, PALETTE.red],
  ].map(([col, row, color]) => ({ kind: 'glyph', col: col as number, row: row as number, color: color as string, glyph: 'cure' }));

  return [
    { index: 0, verb: 'lay', note: '方眼紙を敷く（白い水面）', layers: [{ kind: 'grid', cols, rows }] },
    { index: 1, verb: 'drop', note: `最初の一滴が列 ${c0} に縦の流れをつくる`, layers: [{ kind: 'vband', col: c0, color: PALETTE.green, wave: 1 }] },
    { index: 2, verb: 'pair', note: `干渉で ${pairGap} 列隣に双子の流れ（偶数間隔の対）`, layers: [{ kind: 'vband', col: c0 + pairGap, color: PALETTE.green, wave: 1 }] },
    { index: 3, verb: 'wave', note: `次の波は 2λ 先の列 ${c2} に届く（色が変わる）`, layers: [{ kind: 'vband', col: c2, color: PALETTE.blue, wave: 2 }] },
    {
      index: 4,
      verb: 'spread',
      note: `行 ${hr}–${hr + 1} に横の広がり（上は夜の青、下は赤い沈殿）`,
      layers: [{ kind: 'hband', row: hr, rows: 2, top: [PALETTE.navy, PALETTE.blue], bottom: [PALETTE.red, PALETTE.black] }],
    },
    {
      index: 5,
      verb: 'wash',
      note: '最初の波との交差点だけが白く洗い流される（後の波は覆われる）',
      layers: washCols.flatMap((col) => [{ kind: 'wash', col, row: hr } as Layer, { kind: 'wash', col, row: hr + 1 } as Layer]),
    },
    {
      index: 6,
      verb: 'cut',
      note: '遠い流れが一度切断される（白・黒・白）',
      layers: [
        { kind: 'cut', col: c2, row: cutRow, fill: PALETTE.paper },
        { kind: 'cut', col: c2, row: cutRow + 1, fill: PALETTE.black },
        { kind: 'cut', col: c2, row: cutRow + 2, fill: PALETTE.paper },
      ],
    },
    { index: 7, verb: 'fold', note: '中心で紙が折れ、三角の星が立ち上がる', layers: [{ kind: 'fold', cx, cy, size: 3 }] },
    {
      index: 8,
      verb: 'scatter',
      note: '星の左下に Cure の聴診器が一列に並ぶ',
      layers: [0, 1, 2, 3].map((i) => ({ kind: 'glyph', col: cx - 6 + i, row: cy + 3, color: PALETTE.ink, glyph: 'cure' }) as Layer),
    },
    { index: 9, verb: 'scatter', note: '遠い流れの下流で聴診器が群れる（赤・青・緑）', layers: cureCluster },
    {
      index: 10,
      verb: 'scatter',
      note: '星の周りに単独の記号（₿・=・点）が浮かぶ',
      layers: [
        { kind: 'glyph', col: cx - 3, row: cy + 1, color: PALETTE.amber, glyph: 'cure' },
        { kind: 'glyph', col: cx, row: cy + 2, color: PALETTE.amber, glyph: 'btc' },
        { kind: 'glyph', col: cx + 1, row: cy + 3, color: PALETTE.green, glyph: 'cure' },
        { kind: 'glyph', col: cx + 2, row: cy + 1, color: PALETTE.red, glyph: 'cure' },
        { kind: 'glyph', col: cx + 2, row: cy, color: PALETTE.black, glyph: 'equals' },
        { kind: 'glyph', col: cx - 2, row: cy - 3, color: PALETTE.ink, glyph: 'dot' },
        { kind: 'glyph', col: cx - 2, row: cy - 1, color: PALETTE.red, glyph: 'dot' },
        { kind: 'glyph', col: cx - 2, row: cy + 3, color: PALETTE.ink, glyph: 'dot' },
      ],
    },
  ];
}

/** All layers visible after `upTo` steps (inclusive). */
export function layersUpTo(program: EmergenceStep[], upTo: number): Layer[] {
  return program.slice(0, Math.max(0, upTo) + 1).flatMap((step) => step.layers);
}
