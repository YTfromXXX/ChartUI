// Colour test for "雲のなかに電池を作れ": one realistic sky and three bright, surreal ones.
// The realistic sky follows how a clear day looks: deepest blue at the zenith, paler and whiter toward
// the horizon (more air to look through scatters more of every colour). Values are our own picks.
export type SkyPalette = { id: string; name: string; note: string; sky: string[]; knot: string[]; dice: string; stick: string };

export const PALETTES: SkyPalette[] = [
  { id: 'real', name: '写実の空（水色の指定）', note: '天頂ほど深く、地平ほど白く。晴れた日の昼の空。',
    sky: ['#2f6db5', '#4f8fd6', '#86bce8', '#cfe6f4', '#eef6fb'], knot: ['#ffffff', '#cfe6f4', '#86bce8', '#f6f1e4'], dice: '#fbfbf8', stick: '#c89b62' },
  { id: 'soda', name: '明るいシュール A「ソーダ」', note: '水色から、レモンの地平へ。',
    sky: ['#4cc3f5', '#7fd8ff', '#bfeeff', '#fff6b0', '#fffbe0'], knot: ['#ff8fcf', '#8ff0c8', '#fff27a', '#9fb8ff'], dice: '#fff5fb', stick: '#ffb36b' },
  { id: 'ramune', name: '明るいシュール B「ラムネ」', note: '水色から、桃色の地平へ。',
    sky: ['#3fb8d9', '#a6f0ff', '#d9f8ff', '#ffd6f0', '#fff0f8'], knot: ['#ff6f61', '#5ce1e6', '#c8a2ff', '#ffe066'], dice: '#f4fbff', stick: '#9be3b0' },
  { id: 'noonmoon', name: '明るいシュール C「真昼の月」', note: '白い月が見える、明るすぎる昼。',
    sky: ['#3d9cf0', '#5fb6ff', '#a9dcff', '#e8fbff', '#ffffff'], knot: ['#ffffff', '#ffb3c7', '#b3ffd9', '#ffe9a8'], dice: '#ffffff', stick: '#d6b4ff' },
];

const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
/** WCAG contrast ratio between two colours (1–21). */
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
