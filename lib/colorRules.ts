// The colour rules, kept in one place (the saved form). Pages import from here.
//  • ARIMINO_4: the four colours of the two seats — アリミノガール（機長席）orange + yellow-green,
//    アリミノボーイ（副操縦士席）cyan + yellow. These are the starting faces of their colour dice (lib/faceContour.ts).
//  • MU: ミュウの規則 — 29 種 = cyan, 92 種 = orange; white until measured. (The same cyan and orange as ARIMINO_4.)
//  • GOLDEN: 黄金のアイコンの規則 — four golds for petals, and a small ✦ at the centre of 13-petal flowers.
// Every colour must read on the black page (#0a0a0a) at 3 : 1 or more; see contrastOnBlack.
import { contrast } from '@/lib/smokeCandle';

export type Swatch = { hex: string; name: string; note?: string };
export const ARIMINO_4: Swatch[] = [
  { hex: '#f29b30', name: 'オレンジ', note: 'アリミノガール・機長席' }, { hex: '#a9c62a', name: '黄緑', note: 'アリミノガール・機長席' },
  { hex: '#22b8c8', name: 'シアン', note: 'アリミノボーイ・副操縦士席' }, { hex: '#ece055', name: '黄', note: 'アリミノボーイ・副操縦士席' },
];
export const MU = { strain29: { hex: '#22b8c8', name: '29 種の水色' } as Swatch, strain92: { hex: '#f29b30', name: '92 種の橙' } as Swatch, bud: { hex: '#f4f1ec', name: 'つぼみの白（測る前）' } as Swatch };
export const GOLDEN: Swatch[] = [
  { hex: '#f5c542', name: '黄金' }, { hex: '#ffd76a', name: '明るい金' }, { hex: '#e0a82e', name: '古い金' }, { hex: '#fff1b8', name: '金の光' },
];
export const BLACK = '#0a0a0a';
export const contrastOnBlack = (hex: string) => contrast(hex, BLACK);

/** Every swatch you can pick for a cast (deduplicated by colour). */
export const PICKABLE: Swatch[] = [...ARIMINO_4, ...GOLDEN, MU.bud].filter((s, i, a) => a.findIndex((x) => x.hex === s.hex) === i);

// ---- saving a chosen rule in this browser (a convenience; it may be unavailable, so every access is guarded) ----
const KEY = 'mente-color-rules';
export function loadRules(): Record<string, string[]> { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } }
export function saveRule(name: string, colors: string[]) { try { const r = loadRules(); r[name] = colors; localStorage.setItem(KEY, JSON.stringify(r)); return true; } catch { return false; } }
