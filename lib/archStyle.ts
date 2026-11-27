// Architecture signature from a camera frame — the lightest "MR filter" that still says something
// about style. Sobel gradients give an orientation for every edge pixel; a 12-bin histogram of
// those orientations is the signature. Vertical edges dominate Gothic fronts and minarets,
// horizontal ones modernist slabs and library shelving, and arches and domes spread energy into
// the diagonals. Comparing signatures needs nothing but a dot product. All processing stays on
// the device; frames are never uploaded.

export const BINS = 12; // 15° each, over 0–180°

/** Hue (0..1) → RGB, used to colour each edge by its orientation. */
export function hueRgb(h: number): [number, number, number] {
  const f = (n: number) => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}

/** Orientation histogram (normalised) and the edge density of an RGBA frame. */
export function orientationHist(rgba: Uint8ClampedArray, w: number, h: number, threshold = 60, overlay?: Uint8ClampedArray) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  const hist = new Array<number>(BINS).fill(0); let edges = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = (dx: number, dy: number) => g[(y + dy) * w + x + dx];
      const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
      const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
      const m = Math.hypot(gx, gy);
      if (m < threshold) continue;
      edges += 1;
      let a = Math.atan2(gy, gx); if (a < 0) a += Math.PI; // gradient direction, 0..π
      hist[Math.min(BINS - 1, Math.floor((a / Math.PI) * BINS))] += m;
      if (overlay) { const [r, gg, b] = hueRgb(a / Math.PI); const o = (y * w + x) * 4; overlay[o] = r; overlay[o + 1] = gg; overlay[o + 2] = b; overlay[o + 3] = Math.min(255, m * 1.5); }
    }
  }
  const sum = hist.reduce((s, v) => s + v, 0) || 1;
  return { hist: hist.map((v) => v / sum), density: edges / (w * h) };
}

/** Shares of vertical edges (gradient ≈ 0°/180°), horizontal edges (≈ 90°) and everything else. */
export function shares(hist: number[]) {
  const vertical = hist[0] + hist[BINS - 1];
  const horizontal = hist[BINS / 2 - 1] + hist[BINS / 2];
  return { vertical, horizontal, diagonal: Math.max(0, 1 - vertical - horizontal) };
}

export type StyleGuess = { key: 'gothic' | 'modern' | 'dome' | 'classical'; name: string; why: string };
export function guessStyle(hist: number[]): StyleGuess {
  const s = shares(hist);
  if (s.diagonal > 0.45) return { key: 'dome', name: '曲線・ドーム（モスク／バロック）', why: `斜めと曲線が ${(s.diagonal * 100).toFixed(0)}%` };
  if (s.vertical > 0.6 && s.vertical > s.horizontal * 2) return { key: 'gothic', name: '垂直性（ゴシック／尖塔）', why: `垂直の輪郭が ${(s.vertical * 100).toFixed(0)}%` };
  if (s.horizontal > 0.6 && s.horizontal > s.vertical * 2) return { key: 'modern', name: '水平性（モダニズム／書架）', why: `水平の輪郭が ${(s.horizontal * 100).toFixed(0)}%` };
  return { key: 'classical', name: '均衡（古典：柱と梁）', why: `垂直 ${(s.vertical * 100).toFixed(0)}%・水平 ${(s.horizontal * 100).toFixed(0)}%` };
}

export const cosine = (a: number[], b: number[]) => {
  let d = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
};

/** Sample façades for trying the filter without a camera. */
export function drawFacade(ctx: CanvasRenderingContext2D, kind: StyleGuess['key'], w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fb3d9'); sky.addColorStop(1, '#e8eef4');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b9ad98'; ctx.strokeStyle = '#3a3226'; ctx.lineWidth = 2;
  const base = h * 0.92;
  if (kind === 'gothic') {
    for (let i = 0; i < 7; i += 1) {
      const x = w * 0.12 + i * w * 0.11; const top = base - h * (i === 3 ? 0.8 : 0.55 + (i % 2) * 0.1);
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top + 30); ctx.lineTo(x + w * 0.04, top); ctx.lineTo(x + w * 0.08, top + 30); ctx.lineTo(x + w * 0.08, base); ctx.fill(); ctx.stroke();
      for (let k = 0; k < 4; k += 1) { ctx.beginPath(); ctx.moveTo(x + w * 0.02 + k * 6, base - 20); ctx.lineTo(x + w * 0.02 + k * 6, top + 60); ctx.stroke(); }
    }
  } else if (kind === 'modern') {
    ctx.fillRect(w * 0.08, base - h * 0.55, w * 0.84, h * 0.55); ctx.strokeRect(w * 0.08, base - h * 0.55, w * 0.84, h * 0.55);
    for (let k = 1; k < 9; k += 1) { ctx.beginPath(); ctx.moveTo(w * 0.08, base - k * h * 0.06); ctx.lineTo(w * 0.92, base - k * h * 0.06); ctx.stroke(); }
    ctx.fillStyle = '#4b6a84'; for (let k = 1; k < 8; k += 1) ctx.fillRect(w * 0.1, base - k * h * 0.06 - h * 0.035, w * 0.8, h * 0.02);
  } else if (kind === 'dome') {
    ctx.fillRect(w * 0.2, base - h * 0.3, w * 0.6, h * 0.3);
    for (const [cx, r] of [[0.5, 0.22], [0.3, 0.1], [0.7, 0.1]] as const) { ctx.beginPath(); ctx.ellipse(w * cx, base - h * 0.3, w * r, h * r * 1.3, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); }
    for (let k = 0; k < 10; k += 1) { ctx.beginPath(); ctx.arc(w * (0.25 + k * 0.055), base - h * 0.12, w * 0.02, Math.PI, 0); ctx.stroke(); }
  } else {
    ctx.fillRect(w * 0.12, base - h * 0.62, w * 0.76, h * 0.08); ctx.strokeRect(w * 0.12, base - h * 0.62, w * 0.76, h * 0.08);
    ctx.beginPath(); ctx.moveTo(w * 0.1, base - h * 0.62); ctx.lineTo(w * 0.5, base - h * 0.8); ctx.lineTo(w * 0.9, base - h * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 6; i += 1) { const x = w * 0.16 + i * w * 0.13; ctx.fillRect(x, base - h * 0.54, w * 0.05, h * 0.5); ctx.strokeRect(x, base - h * 0.54, w * 0.05, h * 0.5); }
    ctx.fillRect(w * 0.08, base - h * 0.04, w * 0.84, h * 0.04); ctx.strokeRect(w * 0.08, base - h * 0.04, w * 0.84, h * 0.04);
  }
}
