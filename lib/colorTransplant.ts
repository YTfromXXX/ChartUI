// Eye → nose colour transplant (Mente). Statistical colour transfer in CIE Lab
// (after Reinhard et al., "Color Transfer between Images", 2001): every target pixel is
// standardised by the target's mean / spread and re-scaled to the source's, per channel.
// The nose keeps its own internal shading (its ranking of light and dark) while taking on
// the iris's colour distribution as faithfully as possible.

import { FACE, FAMI_PALETTE, IRIS, NOSE } from '@/lib/famiSprites';

type Lab = [number, number, number];

const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
const WHITE = [0.95047, 1, 1.08883];
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fInv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));

export function rgbToLab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const xyz = [0.4124 * r + 0.3576 * g + 0.1805 * b, 0.2126 * r + 0.7152 * g + 0.0722 * b, 0.0193 * r + 0.1192 * g + 0.9505 * b];
  const [fx, fy, fz] = xyz.map((v, i) => f(v / WHITE[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToHex([L, a, b]: Lab): string {
  const fy = (L + 16) / 116; const fx = fy + a / 500; const fz = fy - b / 200;
  const [x, y, z] = [fInv(fx), fInv(fy), fInv(fz)].map((v, i) => v * WHITE[i]);
  const rgb = [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z].map(toSrgb);
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const stats = (labs: Lab[]) => {
  const mean = [0, 1, 2].map((k) => labs.reduce((s, p) => s + p[k], 0) / labs.length) as Lab;
  const sd = [0, 1, 2].map((k) => Math.sqrt(labs.reduce((s, p) => s + (p[k] - mean[k]) ** 2, 0) / labs.length) || 1e-6) as Lab;
  return { mean, sd };
};

const deltaE = (p: Lab, q: Lab) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/** Spearman-style check that the nose's light/dark order survived: share of pixel pairs with the same L ordering. */
function orderKept(before: Lab[], after: Lab[]) {
  let same = 0; let total = 0;
  for (let i = 0; i < before.length; i += 1) for (let k = i + 1; k < before.length; k += 1) {
    const d0 = before[i][0] - before[k][0]; const d1 = after[i][0] - after[k][0];
    if (Math.abs(d0) < 1e-6) continue;
    total += 1; if (Math.sign(d0) === Math.sign(d1)) same += 1;
  }
  return total ? same / total : 1;
}

export type Transplant = {
  /** Per-pixel colours of the face after the transplant (null = transparent). */
  colors: (string | null)[];
  /** Per-pixel colours before. */
  original: (string | null)[];
  sourceMean: Lab;
  resultMean: Lab;
  /** ΔE*ab between the iris mean and the transplanted nose mean (0 = identical colour). */
  fidelity: number;
  /** Share of nose pixel pairs whose light/dark order is preserved. */
  structure: number;
  nosePixels: number;
};

/** t ∈ [0, 1]: 0 = original nose, 1 = full transplant (Lab interpolation in between). */
export function transplantEyeToNose(t = 1): Transplant {
  const cells = FACE.rows.flatMap((row) => [...row]);
  const original = cells.map((ch) => (ch === '.' ? null : FAMI_PALETTE[ch]));
  const source = cells.filter((ch) => IRIS.has(ch)).map((ch) => rgbToLab(FAMI_PALETTE[ch]));
  const noseIdx = cells.map((ch, i) => (NOSE.has(ch) ? i : -1)).filter((i) => i >= 0);
  const target = noseIdx.map((i) => rgbToLab(original[i]!));
  const s = stats(source); const g = stats(target);
  const moved = target.map((p) => p.map((v, k) => (v - g.mean[k]) / g.sd[k] * s.sd[k] + s.mean[k]) as Lab);
  const blended = target.map((p, i) => p.map((v, k) => v + (moved[i][k] - v) * t) as Lab);
  const colors = [...original];
  noseIdx.forEach((cell, i) => { colors[cell] = labToHex(blended[i]); });
  const resultMean = stats(blended).mean;
  return { colors, original, sourceMean: s.mean, resultMean, fidelity: deltaE(s.mean, resultMean), structure: orderKept(target, blended), nosePixels: noseIdx.length };
}
