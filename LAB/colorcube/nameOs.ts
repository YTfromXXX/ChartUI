// Name OS: rules that turn the emerged color geometry into a virtual Linux-style GUI.
// The UI is not designed up front; each window-system element is read off a layer that
// the emergence program produced, in the same order the color appeared.

import type { Layer, Verb } from './emergence';
import { SHEET } from './emergence';

export type OsElementKind = 'desktop' | 'dock' | 'splitter' | 'panel' | 'launcher' | 'terminal' | 'menu' | 'icon' | 'tray';

export type OsElement = {
  kind: OsElementKind;
  label: string;
  /** Rect in sheet cells. */
  rect: { x: number; y: number; w: number; h: number };
  /** Cure kit item that owns the element (lib/cureKit). */
  kitId: number;
};

export type NameOsRule = { from: Layer['kind']; verb: Verb; becomes: OsElementKind; kitId: number; rule: string };

/** The procedure, in order. */
export const NAME_OS_RULES: readonly NameOsRule[] = [
  { from: 'grid', verb: 'lay', becomes: 'desktop', kitId: 1, rule: '方眼紙全体がデスクトップ（背骨＝共通規格のグリッド）になる' },
  { from: 'vband', verb: 'drop', becomes: 'dock', kitId: 3, rule: '第 1 波の縦流れはドック。双子の流れの間の 1 列がアイコン列' },
  { from: 'vband', verb: 'wave', becomes: 'splitter', kitId: 13, rule: '第 2 波の縦流れはワークスペースの分割線（垂直並行の分割線）' },
  { from: 'hband', verb: 'spread', becomes: 'panel', kitId: 14, rule: '横の広がりはトップパネル。上段がタイトル、下段が状態表示' },
  { from: 'wash', verb: 'wash', becomes: 'launcher', kitId: 2, rule: '白く洗われた交差セルはパネルのランチャーボタン' },
  { from: 'cut', verb: 'cut', becomes: 'terminal', kitId: 18, rule: '切断の黒セルはターミナル（コマンドライン）。白セルはその余白' },
  { from: 'fold', verb: 'fold', becomes: 'menu', kitId: 15, rule: '折れた星はアプリケーションメニュー（星座結線）' },
  { from: 'glyph', verb: 'scatter', becomes: 'icon', kitId: 10, rule: '聴診器の群れはデスクトップアイコン、単独記号は通知トレイ' },
];

const ruleFor = (kind: Layer['kind'], verb?: Verb) =>
  NAME_OS_RULES.find((r) => r.from === kind && (!verb || r.verb === verb)) ?? NAME_OS_RULES[0];

type Cell = { col: number; row: number };

const bbox = (cells: Cell[]) => {
  const xs = cells.map((c) => c.col); const ys = cells.map((c) => c.row);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
};

/** Single-link clustering of cells closer than `gap` (Chebyshev distance). */
function clusters<T extends Cell>(cells: T[], gap = 3): T[][] {
  const groups: T[][] = [];
  for (const cell of cells) {
    const near = groups.filter((g) => g.some((c) => Math.max(Math.abs(c.col - cell.col), Math.abs(c.row - cell.row)) <= gap));
    const merged = near.flat().concat(cell);
    for (const g of near) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups;
}

/** Derive the Name OS elements from the visible layers. Same-kind layers that touch become one element. */
export function deriveNameOs(layers: Layer[]): OsElement[] {
  const of = <K extends Layer['kind']>(kind: K) => layers.filter((l): l is Extract<Layer, { kind: K }> => l.kind === kind);
  const elements: OsElement[] = [];

  const grid = of('grid')[0];
  if (grid) elements.push({ kind: 'desktop', label: 'Name OS desktop', rect: { x: 0, y: 0, w: grid.cols, h: grid.rows }, kitId: ruleFor('grid').kitId });

  const docks = of('vband').filter((b) => b.wave === 1);
  if (docks.length) {
    const box = bbox(docks.map((b) => ({ col: b.col, row: 0 })));
    elements.push({ kind: 'dock', label: `dock (${docks.length} rails)`, rect: { ...box, h: SHEET.rows }, kitId: ruleFor('vband', 'drop').kitId });
  }
  for (const band of of('vband').filter((b) => b.wave === 2)) {
    elements.push({ kind: 'splitter', label: `splitter @${band.col}`, rect: { x: band.col, y: 0, w: 1, h: SHEET.rows }, kitId: ruleFor('vband', 'wave').kitId });
  }
  for (const band of of('hband')) {
    elements.push({ kind: 'panel', label: 'top panel', rect: { x: 0, y: band.row, w: SHEET.cols, h: band.rows }, kitId: ruleFor('hband').kitId });
  }
  const washed = of('wash');
  if (washed.length) {
    const box = bbox(washed);
    elements.push({ kind: 'launcher', label: `${box.w} launchers`, rect: box, kitId: ruleFor('wash').kitId });
  }
  for (const cell of of('cut').filter((c) => c.fill !== '#ffffff')) {
    elements.push({ kind: 'terminal', label: '$ _ terminal', rect: { x: cell.col, y: cell.row, w: 1, h: 1 }, kitId: ruleFor('cut').kitId });
  }
  for (const fold of of('fold')) {
    elements.push({ kind: 'menu', label: 'app menu ★', rect: { x: fold.cx - fold.size, y: fold.cy - fold.size, w: fold.size * 2, h: fold.size * 2 }, kitId: ruleFor('fold').kitId });
  }
  const glyphs = of('glyph');
  const iconGroups = clusters(glyphs.filter((g) => g.glyph === 'cure')).filter((g) => g.length >= 3);
  for (const group of iconGroups) {
    elements.push({ kind: 'icon', label: `${group.length} icons`, rect: bbox(group), kitId: ruleFor('glyph').kitId });
  }
  const grouped = new Set(iconGroups.flat());
  const tray = glyphs.filter((g) => !grouped.has(g));
  if (tray.length) elements.push({ kind: 'tray', label: `${tray.length} tray notices`, rect: bbox(tray), kitId: 21 });
  return elements;
}
