// Cure-API right-region split: one selected output cell divided by [2 : 4 : 6 : 7] (total 19).
// `layer` doubles as the CSS z-index of each part, so the same array orders rendering
// priority, the retro-grid table of contents and the spiral-noise segments.

import { mulberry32 } from '@/lib/retroGrid';

export const SELECTED_OUTPUT_CELL = {
  id: 'API-B',
  title: 'API-B（脳内API）',
  detail: '目を閉じた際の皮膚感覚・固有感覚ハプティクスフィードバック出力',
} as const;

export type SplitKey = 'relax' | 'drift' | 'counter' | 'oracle';

export type SplitPart = {
  key: SplitKey;
  /** Ratio weight and CSS z-index of the part. */
  layer: 2 | 4 | 6 | 7;
  title: string;
  detail: string;
  color: string;
};

export const CURE_SPLIT: readonly SplitPart[] = [
  { key: 'relax', layer: 2, title: '基礎緊張緩和（境界解体）', detail: '閉眼の瞬間に環境ノイズをカットし、弛緩状態を作る最小限のハプティクスパルス', color: '#fda4af' },
  { key: 'drift', layer: 4, title: '縦回転グラフのズレ知覚', detail: 'Cure-API が検知した並列チャートの歪みを、手のひらの微弱な刺激として皮膚へマッピング', color: '#e879f9' },
  { key: 'counter', layer: 6, title: 'ハンドル微動へのカウンター・フィードバック', detail: '指先の固有感覚（筋抵抗）をリアルタイムに書き換え、カオスを維持する骨格制御', color: '#fbbf24' },
  { key: 'oracle', layer: 7, title: 'API-A 最優先調整ループ', detail: 'METADOGG ORACLE API（API-A）への最優先フィードバック経路', color: '#34d399' },
];

export const SPLIT_TOTAL = CURE_SPLIT.reduce((sum, part) => sum + part.layer, 0); // 19

export const splitShare = (part: SplitPart) => part.layer / SPLIT_TOTAL;

/** Cumulative [start, end) share of each part, in CURE_SPLIT order (center → rim). */
export function splitBounds(): { part: SplitPart; start: number; end: number }[] {
  let start = 0;
  return CURE_SPLIT.map((part) => {
    const end = start + splitShare(part);
    const bounds = { part, start, end };
    start = end;
    return bounds;
  });
}

/**
 * Archimedean spiral around a Cure center, cut into the 4 split segments.
 * Segment i spans the parameter range of its share; its radial noise grows with its layer,
 * so the API-A loop (layer 7) is the most agitated band.
 */
export function splitSpiralPaths(
  cx: number,
  cy: number,
  radius: number,
  options: { turns?: number; noise?: number; seed?: number; frame?: number; samples?: number } = {},
): { part: SplitPart; d: string }[] {
  const { turns = 2.5, noise = 0.2, seed = 1, frame = 0, samples = 160 } = options;
  const rand = mulberry32(seed + frame * 7919);
  return splitBounds().map(({ part, start, end }) => {
    const steps = Math.max(4, Math.round(samples * (end - start)));
    const amp = radius * 0.12 * noise * (part.layer / 7);
    const points: string[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = start + ((end - start) * i) / steps;
      const theta = t * turns * Math.PI * 2;
      const r = radius * (0.06 + 0.94 * t) + (rand() - 0.5) * 2 * amp;
      points.push(`${(cx + Math.cos(theta) * r).toFixed(2)},${(cy + Math.sin(theta) * r).toFixed(2)}`);
    }
    return { part, d: `M${points.join(' L')}` };
  });
}

/** Infinite exploration loop between the Cure menu, retro-grid pages A/B and the Oracle. */
export const EXPLORATION_LOOP = [
  { id: 'cure', label: 'Cure-API 総合メニュー', href: '/cure-api' },
  { id: 'retroA', label: 'Retro Grid A · BTCUSD', href: '/retro-grid?page=A' },
  { id: 'retroB', label: 'Retro Grid B · XAUUSD', href: '/retro-grid?page=B' },
  { id: 'oracle', label: 'METADOGG ORACLE API', href: '/oracle-api' },
] as const;

export type LoopStopId = (typeof EXPLORATION_LOOP)[number]['id'];

export function nextLoopStop(id: LoopStopId) {
  const index = EXPLORATION_LOOP.findIndex((stop) => stop.id === id);
  return EXPLORATION_LOOP[(index + 1) % EXPLORATION_LOOP.length];
}
