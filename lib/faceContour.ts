// Face-shape difference device: a base face as a height map z(x, y), three faces made by changing
// it step by step from coarse to fine, their contour lines, and the difference Δz = z_face − z_base.
//
// Order of personality (coarse → fine, i.e. from wide contour spacing to narrow):
//   1 輪郭       outline of the face (the outermost contour)
//   2 量感       forehead, cheeks and jaw (how tightly the contours crowd)
//   3 鼻と眉     nose and brow ridge (where the peaks sit)
//   4 口とあご先  mouth and chin tip (small valleys and hills, seen only at fine spacing)
//   5 髪の生え際  hairline, drawn as a plateau above the forehead (not a cap on top)
// At step s, each face uses its own values for the features of steps ≤ s and the base values for
// the rest, so you can watch the personality arrive one layer at a time.
// The heights are a drawing model (sums of smooth bumps), not anatomy.

export type Bump = { x: number; y: number; sx: number; sy: number; a: number };
export type FaceParams = {
  rx: number; ry: number;                 // 1 outline: half-width and half-height of the face dome
  forehead: number; cheek: number; jaw: number; // 2 masses (bump heights)
  nose: number; noseY: number; brow: number;    // 3 nose height and position, brow ridge
  mouth: number; chin: number;                  // 4 mouth valley depth, chin-tip bump
  hairline: number; hairRise: number;           // 5 where the hair plateau starts (y), and its height
};
export const STEPS = [
  { step: 1, name: '輪郭', keys: ['rx', 'ry'] },
  { step: 2, name: '量感（額・頬・あご）', keys: ['forehead', 'cheek', 'jaw'] },
  { step: 3, name: '鼻と眉', keys: ['nose', 'noseY', 'brow'] },
  { step: 4, name: '口とあご先', keys: ['mouth', 'chin'] },
  { step: 5, name: '髪の生え際', keys: ['hairline', 'hairRise'] },
] as const;

export const BASE: FaceParams = { rx: 0.78, ry: 1.02, forehead: 0.15, cheek: 0.1, jaw: 0.06, nose: 0.24, noseY: -0.1, brow: 0.08, mouth: 0.06, chin: 0.07, hairline: 0.62, hairRise: 0.1 };
/** Three faces: 1 stays close to the base; 2 differs most in the jaw; 3 in the forehead and brow. */
/**
 * Four figures, left to right, with provisional names (仮). Made "cute" by the usual baby-face cues:
 * a rounder outline (height ÷ width 1.15–1.4), a larger forehead, a smaller and lower nose,
 * a soft jaw, a small chin and fuller cheeks. Each keeps one outline cue of its own:
 *   ポニーテール  round, fullest cheeks
 *   ボブ          the roundest and shortest (the youngest look), biggest forehead
 *   アリミノガール（2 体目）  a slim oval (still short of long), the clearest chin
 *   アリミノボーイ（1 体目）  heart-shaped: wide cheekbones, tiny jaw, pointed chin
 */
export const FIGURE_NAMES = ['ポニーテール（仮）', 'ボブ（仮）', 'アリミノガール（仮）', 'アリミノボーイ（仮）'] as const;
/** Types for the colour rule (lib/colourRule.ts): the ponytail stays neutral (ink). */
export const FIGURE_TYPES = ['neutral', 'girl', 'girl', 'boy'] as const;
export const PONY_FIGURE = 0;
export const FACES: FaceParams[] = [
  { ...BASE, rx: 0.84, ry: 0.98, forehead: 0.2, cheek: 0.15, jaw: 0.03, nose: 0.14, noseY: -0.18, brow: 0.05, mouth: 0.04, chin: 0.04, hairline: 0.52, hairRise: 0.14 },
  { ...BASE, rx: 0.83, ry: 0.94, forehead: 0.25, cheek: 0.14, jaw: 0.02, nose: 0.12, noseY: -0.2, brow: 0.04, mouth: 0.035, chin: 0.03, hairline: 0.5, hairRise: 0.12 },
  { ...BASE, rx: 0.74, ry: 1.04, forehead: 0.17, cheek: 0.1, jaw: 0.06, nose: 0.17, noseY: -0.16, brow: 0.06, mouth: 0.05, chin: 0.08, hairline: 0.6, hairRise: 0.1 },
  { ...BASE, rx: 0.8, ry: 1.0, forehead: 0.19, cheek: 0.17, jaw: 0.0, nose: 0.15, noseY: -0.17, brow: 0.05, mouth: 0.045, chin: 0.07, hairline: 0.56, hairRise: 0.12 },
];

/** Use the face's own values up to step s, the base's beyond it. */
export function atStep(face: FaceParams, s: number, base: FaceParams = BASE): FaceParams {
  const out = { ...base };
  for (const st of STEPS) if (st.step <= s) for (const k of st.keys) (out as Record<string, number>)[k] = face[k as keyof FaceParams];
  return out;
}

const gauss = (x: number, y: number, b: Bump) => b.a * Math.exp(-(((x - b.x) / b.sx) ** 2 + ((y - b.y) / b.sy) ** 2) / 2);
export function height(p: FaceParams, x: number, y: number): number {
  const e = 1 - (x / p.rx) ** 2 - (y / p.ry) ** 2; if (e <= 0) return 0;
  let z = 0.9 * Math.sqrt(e);
  const bumps: Bump[] = [
    { x: 0, y: 0.55, sx: 0.4, sy: 0.18, a: p.forehead },
    { x: -0.42, y: -0.2, sx: 0.16, sy: 0.18, a: p.cheek }, { x: 0.42, y: -0.2, sx: 0.16, sy: 0.18, a: p.cheek },
    { x: -0.4, y: -0.72, sx: 0.16, sy: 0.12, a: p.jaw }, { x: 0.4, y: -0.72, sx: 0.16, sy: 0.12, a: p.jaw },
    { x: -0.3, y: 0.26, sx: 0.16, sy: 0.05, a: p.brow }, { x: 0.3, y: 0.26, sx: 0.16, sy: 0.05, a: p.brow },
    { x: -0.3, y: 0.12, sx: 0.12, sy: 0.07, a: -0.12 }, { x: 0.3, y: 0.12, sx: 0.12, sy: 0.07, a: -0.12 },
    { x: 0, y: p.noseY, sx: 0.06, sy: 0.22, a: p.nose }, { x: 0, y: p.noseY - 0.22, sx: 0.09, sy: 0.07, a: p.nose * 0.4 },
    { x: 0, y: -0.52, sx: 0.18, sy: 0.035, a: -p.mouth }, { x: 0, y: -0.82, sx: 0.15, sy: 0.08, a: p.chin },
  ];
  for (const b of bumps) z += gauss(x, y, b);
  // Hair: a soft plateau that starts at the hairline and rises above the forehead (part of the same map).
  if (y > p.hairline) z += p.hairRise * Math.min(1, (y - p.hairline) / 0.12);
  return z;
}

export type Grid = { nx: number; ny: number; x0: number; x1: number; y0: number; y1: number; z: Float64Array };
export function sample(f: (x: number, y: number) => number, nx = 80, ny = 100, x0 = -1, x1 = 1, y0 = -1.25, y1 = 1.25): Grid {
  const z = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) z[j * nx + i] = f(x0 + ((x1 - x0) * i) / (nx - 1), y1 - ((y1 - y0) * j) / (ny - 1));
  return { nx, ny, x0, x1, y0, y1, z };
}
export const faceGrid = (p: FaceParams, nx?: number, ny?: number) => sample((x, y) => height(p, x, y), nx, ny);
export function diffGrid(a: Grid, b: Grid): Grid { const z = new Float64Array(a.z.length); for (let k = 0; k < z.length; k += 1) z[k] = a.z[k] - b.z[k]; return { ...a, z }; }
export const extent = (g: Grid) => { let lo = Infinity; let hi = -Infinity; for (const v of g.z) { if (v < lo) lo = v; if (v > hi) hi = v; } return { lo, hi }; };

/**
 * Marching squares: line segments of the contour z = level, in grid coordinates (i, j).
 * The two saddle cases are split by the cell's centre value.
 */
export function contour(g: Grid, level: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = []; const { nx, ny, z } = g;
  const at = (i: number, j: number) => z[j * nx + i];
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let j = 0; j < ny - 1; j += 1) for (let i = 0; i < nx - 1; i += 1) {
    const a = at(i, j); const b = at(i + 1, j); const c = at(i + 1, j + 1); const d = at(i, j + 1);
    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const top: [number, number] = [i + lerp(a, b), j]; const right: [number, number] = [i + 1, j + lerp(b, c)];
    const bottom: [number, number] = [i + lerp(d, c), j + 1]; const left: [number, number] = [i, j + lerp(a, d)];
    const seg = (p: [number, number], q: [number, number]) => out.push([p[0], p[1], q[0], q[1]]);
    switch (idx) {
      case 1: case 14: seg(left, bottom); break;
      case 2: case 13: seg(bottom, right); break;
      case 3: case 12: seg(left, right); break;
      case 4: case 11: seg(top, right); break;
      case 6: case 9: seg(top, bottom); break;
      case 7: case 8: seg(left, top); break;
      case 5: case 10: { const centre = (a + b + c + d) / 4 > level; if ((idx === 5) === centre) { seg(left, top); seg(bottom, right); } else { seg(left, bottom); seg(top, right); } break; }
      default: break;
    }
  }
  return out;
}

/** Ethereum, for this project: the text glyph Ξ (U+039E, the customary ether sign — there is no Ethereum code point like ₿ U+20BF). */
export const ETH = 'Ξ';

// ---------- hairstyle types (for VR / MR): silhouettes read at a glance ----------
// Techniques read from avant-garde wig competition work (general types only — no single piece is
// copied): one dominant silhouette per head, then one texture, then one accent.
//   tower  縦の塔        a tall updo above the crown, with small bumps for flowers
//   wings  翼・扇        horizontal fans to both sides at temple height
//   bob    ボブと前髪    a plateau round the head with a blunt fringe line across the forehead
//   braids 編み込み      cornrow ridges over the scalp — they read like contour lines
export type HairStyle = 'none' | 'tower' | 'wings' | 'bob' | 'braids' | 'ponytail' | 'buns' | 'cloud' | BobVariant;
/** Four new bob variants, opened from the bob button — for tuning texture and accent per figure. */
export type BobVariant = 'bob-asym' | 'bob-inward' | 'bob-blunt' | 'bob-layer';
export const BOB_VARIANTS: { id: BobVariant; name: string; note: string }[] = [
  { id: 'bob-asym', name: '左右非対称', note: '左は長く、右は短い。前髪は斜め' },
  { id: 'bob-inward', name: '内巻き', note: '毛先が内側へ丸まり、あごの横に小さな山' },
  { id: 'bob-blunt', name: '切りそろえ', note: '外へ張った四角い輪郭と、低い一直線の前髪' },
  { id: 'bob-layer', name: '段（レイヤー）', note: '上から下へ 3 段に薄くなる' },
];
export const isBob = (s: HairStyle) => s === 'bob' || s.startsWith('bob-');
export const HAIR_STYLES: { id: HairStyle; name: string; note: string }[] = [
  { id: 'tower', name: '縦の塔', note: '頭頂から高く。花の小さな山を添える' },
  { id: 'wings', name: '翼・扇', note: 'こめかみの高さで左右へ広げる' },
  { id: 'bob', name: 'ボブと前髪', note: '頭を包む高原と、額を横切る前髪の線' },
  { id: 'braids', name: '編み込み', note: '頭皮の上の細い畝（等高線のように見える）' },
  { id: 'buns', name: '二つの輪', note: '頭の上の左右に、輪にした髪を 2 つ' },
  { id: 'cloud', name: '雲（ふわふわ）', note: '頭全体を包む丸い量。縁が細かく揺れる' },
  { id: 'ponytail', name: 'ポニーテール', note: '頭頂の右から肩へ流れる 7 つの節（下の 7 マス）' },
];
const g2 = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) / 2);
export function hairHeight(style: HairStyle, p: FaceParams, x: number, y: number): number {
  const head = 1 - (x / (p.rx + 0.14)) ** 2 - ((y - 0.08) / (p.ry + 0.12)) ** 2;
  switch (style) {
    case 'tower': return 0.95 * g2(x, y, 0, 1.15, 0.22, 0.32) + 0.12 * (g2(x, y, -0.22, 0.95, 0.07, 0.07) + g2(x, y, 0.2, 1.3, 0.07, 0.07) + g2(x, y, -0.05, 1.45, 0.06, 0.06)) + (head > 0 && y > p.hairline ? 0.12 : 0);
    case 'wings': return 0.55 * (g2(x, y, -0.95, 0.62, 0.32, 0.07) + g2(x, y, 0.95, 0.62, 0.32, 0.07)) + (head > 0 && y > p.hairline ? 0.1 : 0);
    case 'bob': { const helmet = 1 - (x / (p.rx + 0.24)) ** 2 - ((y - 0.06) / (p.ry + 0.12)) ** 2; if (helmet <= 0 || y < -0.5) return 0; const fringe = y > 0.36; const sides = Math.abs(x) > p.rx * 0.78; return fringe || sides ? 0.28 : 0; }
    case 'bob-asym': { const lock = x < -p.rx * 0.74 && x > -(p.rx + 0.34) && y > -0.95 && y < 0.7; if (lock) return 0.28; if (head <= 0) return 0; const fringe = y > 0.36 + 0.18 * x; const right = x > p.rx * 0.8 && y > -0.05; return fringe || right ? 0.28 : 0; }
    case 'bob-inward': { if (head <= 0) return 0.13 * (g2(x, y, -p.rx * 0.95, -0.42, 0.09, 0.07) + g2(x, y, p.rx * 0.95, -0.42, 0.09, 0.07)); const fringe = y > 0.4; const sides = Math.abs(x) > p.rx * 0.8 && y > -0.38; return (fringe || sides ? 0.24 : 0) + 0.13 * (g2(x, y, -p.rx * 0.95, -0.42, 0.09, 0.07) + g2(x, y, p.rx * 0.95, -0.42, 0.09, 0.07)); }
    case 'bob-blunt': { const box = Math.abs(x) < p.rx + 0.3 && y > -0.5 && y < p.ry + 0.32; if (!box) return 0; const fringe = y > 0.22; const sides = Math.abs(x) > p.rx * 0.82; return fringe || sides ? 0.3 : 0; }
    case 'bob-layer': { if (head <= 0) return 0; const sides = Math.abs(x) > p.rx * 0.76; if (y > 0.45) return 0.3; if (sides && y > 0.0) return 0.2; if (sides && y > -0.45) return 0.11; return 0; }
    case 'ponytail': { let z = head > 0 && y > p.hairline ? 0.1 : 0; const t = ponyDist(x, y); if (t.d < t.w) z += (0.3 - 0.12 * t.u) * Math.sqrt(1 - (t.d / t.w) ** 2); return z; }
    case 'buns': { const ring = (cx: number, cy: number) => { const d = Math.hypot(x - cx, y - cy); return 0.3 * Math.exp(-(((d - 0.27) / 0.08) ** 2) / 2); }; return ring(-0.62, 1.22) + ring(0.62, 1.22) + (head > 0 && y > p.hairline ? 0.12 : 0); }
    case 'cloud': { const a = Math.atan2(y - 0.55, x); const r = 1.18 + 0.07 * Math.sin(a * 9) + 0.035 * Math.sin(a * 23); const d = Math.hypot(x, y - 0.55); if (d > r || (y < -0.25 && Math.abs(x) < p.rx * 0.95)) return 0; const inFace = 1 - (x / p.rx) ** 2 - (y / p.ry) ** 2 > 0 && y < p.hairline; return inFace ? 0 : 0.34 * Math.sqrt(1 - (d / r) ** 2) + 0.04; }
    case 'braids': return head > 0 && y > p.hairline - 0.1 ? 0.07 * Math.max(0, Math.sin(x * 22)) + 0.05 : 0;
    default: return 0;
  }
}
/** The ponytail's 7 segments (root → tip), front view: from the crown on the right, out and down past the shoulder. */
export const PONY: [number, number][] = [[0.2, 1.22], [0.6, 1.4], [0.98, 1.28], [1.16, 0.95], [1.2, 0.52], [1.14, 0.08], [1.04, -0.34]];
/** Distance from (x, y) to the tail's centre line, the tail's half-width there (thick root → thin tip) and how far along it is (u: 0 root … 1 tip). */
export function ponyDist(x: number, y: number) {
  let best = { d: Infinity, w: 0.1, u: 0 }; const n = PONY.length - 1;
  for (let k = 0; k < n; k += 1) {
    const [ax, ay] = PONY[k]; const [bx, by] = PONY[k + 1]; const vx = bx - ax; const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    const d = Math.hypot(x - ax - t * vx, y - ay - t * vy); const u = (k + t) / n;
    if (d < best.d) best = { d, w: 0.2 - 0.1 * u + 0.03 * Math.cos(u * n * 2 * Math.PI), u };
  }
  return best;
}
/**
 * The moving parts read from the wig photos, per figure: the fringe (its type and the left : right
 * share at the parting), the side locks in front of the ears (left and right lengths — their ratio
 * is the asymmetry you feel first), a two-tone colour split and one accessory.
 */
export type Fringe = 'blunt' | 'swept' | 'cover' | 'thin';
export type HairDetail = { fringe: Fringe; split: number; sideL: number; sideR: number; colorL: keyof typeof ACCENT_COLORS; colorR: keyof typeof ACCENT_COLORS; accent: string };
export const FRINGES: { id: Fringe; name: string }[] = [
  { id: 'blunt', name: 'ぱっつん' }, { id: 'swept', name: '流し' }, { id: 'cover', name: '片目隠し' }, { id: 'thin', name: 'シースルー' },
];
export const DETAILS: HairDetail[] = [
  { fringe: 'swept', split: 0.7, sideL: 0.25, sideR: 0.0, colorL: 'ink', colorR: 'ink', accent: '根元にリボン、毛先へ向かって赤' },
  { fringe: 'blunt', split: 0.5, sideL: 0.75, sideR: 0.75, colorL: 'pink', colorR: 'pink', accent: 'ピンクのボブ、左の耳上に花' },
  { fringe: 'cover', split: 0.2, sideL: 0.35, sideR: 0.85, colorL: 'red', colorR: 'indigo', accent: '輪に赤の差し毛、右だけ長いサイド' },
  { fringe: 'thin', split: 0.45, sideL: 0.6, sideR: 0.45, colorL: 'indigo', colorR: 'bronze', accent: '雲の上に小さな花の冠' },
];
/** Split as the left : right ratio people say ("7:3"). */
export const ratioText = (split: number) => `${Math.round(split * 10)}:${10 - Math.round(split * 10)}`;
export function detailHeight(d: HairDetail, p: FaceParams, x: number, y: number): number {
  let z = 0;
  const xp = -p.rx + 2 * p.rx * (1 - d.split); // parting: a heavier left share puts the parting further right
  const inHead = 1 - (x / (p.rx + 0.06)) ** 2 - ((y - 0.08) / (p.ry + 0.06)) ** 2 > 0;
  if (inHead && y < p.hairline + 0.15) {
    let yb = 0.36;
    if (d.fringe === 'blunt') yb = 0.3;
    if (d.fringe === 'swept') yb = x < xp ? 0.24 + 0.12 * ((xp - x) / p.rx) : 0.42;
    if (d.fringe === 'cover') yb = x > xp ? 0.02 - 0.1 * ((x - xp) / p.rx) : 0.4;
    if (y > yb) z += d.fringe === 'thin' ? 0.12 * Math.max(0, Math.sin(x * 30)) + 0.04 : 0.22;
  }
  // side locks: thin strands just outside the face, from the temple down to the given length
  const lock = (side: number, len: number) => { if (len <= 0) return 0; const cx = side * (p.rx + 0.05); const bottom = 0.35 - len * 1.1; return Math.abs(x - cx) < 0.07 && y < 0.45 && y > bottom ? 0.2 : 0; };
  z += lock(-1, d.sideL) + lock(1, d.sideR);
  return z;
}
/** Face plus hair, sampled on a larger window so towers and wings fit. */
export const headGrid = (p: FaceParams, style: HairStyle, nx = 90, ny = 110, detail?: HairDetail) => sample((x, y) => height(p, x, y) + hairHeight(style, p, x, y) + (detail ? detailHeight(detail, p, x, y) : 0), nx, ny, -1.35, 1.35, -1.3, 1.75);
/** Silhouette (z above a small threshold) and how much two silhouettes overlap (IoU: 1 = identical). */
export const silhouette = (g: Grid, t = 0.02) => Array.from(g.z, (v) => v > t);
export function iou(a: boolean[], b: boolean[]) { let i = 0; let u = 0; for (let k = 0; k < a.length; k += 1) { if (a[k] && b[k]) i += 1; if (a[k] || b[k]) u += 1; } return u ? i / u : 1; }

// ---------- the ponytail: 7 slots at the bottom (accessories and left/right colour asymmetry) ----------
// The strip is defined as the ponytail: slot k is segment k of the tail (root 1 → tip 7).
// Each slot is one accent idea: where the accessory sits (head coordinates), and the colour of the
// left and right halves of the hair. Slot 7 is left empty on purpose (◻︎ = still open).
// Colours are the page's ink / red / indigo / bronze, all ≥ 3:1 against white (lines and fills).
export const ACCENT_COLORS = { ink: '#1f1f1f', red: '#c8001a', indigo: '#2b3a67', bronze: '#7a5c12', pink: '#d63384' } as const;
export type AccentShape = 'flower' | 'ribbon' | 'comb' | 'pins' | 'feather' | 'beads' | 'open';
export type AccentSlot = { id: number; name: string; shape: AccentShape; at: [number, number][]; left: keyof typeof ACCENT_COLORS; right: keyof typeof ACCENT_COLORS; note: string };
export const ACCENT_SLOTS: AccentSlot[] = [
  { id: 1, name: '花（左）', shape: 'flower', at: [[-0.55, 0.85]], left: 'ink', right: 'ink', note: '色は左右同じ。左上の花だけで片寄せる' },
  { id: 2, name: 'リボン（右）', shape: 'ribbon', at: [[0.7, 0.55]], left: 'ink', right: 'red', note: '右半分だけ赤。リボンも右' },
  { id: 3, name: '櫛（頭頂）', shape: 'comb', at: [[0, 1.2]], left: 'indigo', right: 'ink', note: '左が藍、右が墨。飾りは中央で左右差を受け止める' },
  { id: 4, name: 'ピン 3 本（左）', shape: 'pins', at: [[-0.7, 0.6], [-0.6, 0.45], [-0.5, 0.3]], left: 'ink', right: 'ink', note: '同じ色で、小さな線の数だけ片寄せる' },
  { id: 5, name: '羽（右）', shape: 'feather', at: [[0.75, 1.0]], left: 'bronze', right: 'ink', note: '色は左、飾りは右。重さを交差させる' },
  { id: 6, name: '玉の連なり（両側）', shape: 'beads', at: [[-0.9, 0.2], [-0.92, 0.0], [-0.9, -0.2], [0.9, 0.2], [0.92, 0.0]], left: 'red', right: 'indigo', note: '左 3 個・右 2 個、色も左右で違う' },
  { id: 7, name: '空き', shape: 'open', at: [], left: 'ink', right: 'ink', note: 'まだ決めていないマス（◻︎）' },
];

// ---------- dice colours: only アリミノガール and アリミノボーイ ----------
// Each has a colour die of 6 faces in its own family; two rolls give the left and right colours.
// The starting pair is the one picked on the screenshot (girl: orange + yellow-green, boy: cyan + yellow).
// These are light colours, so they are always shown on an ink tile (contrast ≥ 3:1 for every face).
export const DICE_FIGURES = [2, 3] as const;
export const COLOUR_DICE: Record<number, { faces: { hex: string; name: string }[]; start: [number, number] }> = {
  2: { faces: [{ hex: '#f29b30', name: 'オレンジ' }, { hex: '#a9c62a', name: '黄緑' }, { hex: '#f7b267', name: 'ピーチ' }, { hex: '#c5d93a', name: 'ライム' }, { hex: '#e8772e', name: 'タンジェリン' }, { hex: '#8fb339', name: 'オリーブ' }], start: [0, 1] },
  3: { faces: [{ hex: '#22b8c8', name: 'シアン' }, { hex: '#ece055', name: '黄' }, { hex: '#5ccbe0', name: 'スカイ' }, { hex: '#f2e86d', name: 'レモン' }, { hex: '#1c9fae', name: 'ティール' }, { hex: '#d9c13c', name: 'マスタード' }], start: [0, 1] },
};
/** Relative luminance contrast (WCAG) between two #rrggbb colours. */
export function contrastHex(a: string, b: string) {
  const lum = (h: string) => { const c = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05);
}
