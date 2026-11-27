// The unified colour rule (design-rules §9, decided 2026-11-13).
// 1. Three types. A figure's MAIN hair colour comes from its type's family:
//      girl type → warm family (pinks, reds, oranges: hue 300°–60°)
//      boy type  → cool family (cyans, blues, indigos: hue 160°–260°)
//      neutral   → no hue (ink, greys)
//    The second colour (accent, other side, dice) is free.
// 2. Charts keep the app's own convention (LiveChartView): up = green, down = red.
//    Figure colours are never drawn on a chart, and chart colours are never used as a figure's main colour.
// 3. Contrast: a figure drawn on white needs ≥ 3:1 against white; light colours go on an ink tile.
export type FigureType = 'girl' | 'boy' | 'neutral';
export const FAMILY_NAME: Record<FigureType, string> = { girl: '暖色の族（ピンク・赤・オレンジ）', boy: '寒色の族（シアン・青・藍）', neutral: '色なし（墨・灰）' };
export const CHART = { up: '#55e6bd', down: '#fb6475' } as const;

export function hueOf(hex: string): number | null {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const M = Math.max(r, g, b); const m = Math.min(r, g, b); const d = M - m; if (d < 0.08) return null;
  const h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
export function inFamily(hex: string, t: FigureType): boolean {
  const h = hueOf(hex);
  if (t === 'neutral') return h === null;
  if (h === null) return false;
  return t === 'girl' ? h >= 300 || h <= 60 : h >= 160 && h <= 260;
}
