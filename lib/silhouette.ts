// Red human silhouettes read through the holographic principle.
//
// The holographic principle ('t Hooft 1993, Susskind 1995) says the information content of
// a region is bounded by its boundary area, not its volume (S ≤ A / 4 in Planck units).
// Here, as a playful analogy, each silhouette is rasterised on a grid: its boundary cells
// are the "screen" that encodes the interior cells. Every figure has a single eye — one
// viewpoint from which rays reach the boundary.

export type Pose = 'stand' | 'vet' | 'tree' | 'warrior' | 'jump';

type Capsule = { a: [number, number]; b: [number, number]; r: number };

export const POSES: Record<Pose, { label: string; profession: string }> = {
  stand: { label: '立ち（手を腰に）', profession: '待機' },
  vet: { label: '獣医師（かがんで触診）', profession: '獣医師' },
  tree: { label: '木のポーズ', profession: 'ヨガインストラクター' },
  warrior: { label: '戦士のポーズ II', profession: 'ヨガインストラクター' },
  jump: { label: 'ジャンプ（両腕を水平に）', profession: '跳躍' },
};

/** Body as capsules in a 24 × 40 unit frame (y down). Head is returned separately. */
export function bodyOf(pose: Pose): { head: [number, number]; headR: number; limbs: Capsule[] } {
  const torso = (top: [number, number], hip: [number, number]): Capsule => ({ a: top, b: hip, r: 2.6 });
  switch (pose) {
    case 'vet':
      return { head: [9, 9], headR: 2.6, limbs: [
        torso([10.5, 12.5], [15, 22]),
        { a: [11, 13.5], b: [7, 19], r: 1.1 }, { a: [7, 19], b: [5, 24], r: 1 },
        { a: [12, 13.5], b: [9.5, 20], r: 1.1 }, { a: [9.5, 20], b: [8, 25], r: 1 },
        { a: [15, 22], b: [13, 30], r: 1.5 }, { a: [13, 30], b: [12, 38], r: 1.3 },
        { a: [15.5, 22], b: [18, 30], r: 1.5 }, { a: [18, 30], b: [19, 38], r: 1.3 },
      ] };
    case 'tree':
      return { head: [12, 4.5], headR: 2.5, limbs: [
        torso([12, 8], [12, 20]),
        { a: [11, 9], b: [10, 3], r: 1 }, { a: [13, 9], b: [14, 3], r: 1 }, { a: [10, 3], b: [12, 0.8], r: 0.9 }, { a: [14, 3], b: [12, 0.8], r: 0.9 },
        { a: [12, 20], b: [12, 30], r: 1.5 }, { a: [12, 30], b: [12, 39], r: 1.3 },
        { a: [12.5, 20.5], b: [18, 25], r: 1.4 }, { a: [18, 25], b: [12.8, 28], r: 1.2 },
      ] };
    case 'warrior':
      return { head: [12, 7], headR: 2.4, limbs: [
        torso([12, 10.5], [12, 21]),
        { a: [12, 11.5], b: [1, 11.5], r: 1 }, { a: [12, 11.5], b: [23, 11.5], r: 1 },
        { a: [12, 21], b: [5, 28], r: 1.5 }, { a: [5, 28], b: [4, 38], r: 1.3 },
        { a: [12, 21], b: [20, 30], r: 1.5 }, { a: [20, 30], b: [22.5, 38], r: 1.3 },
      ] };
    case 'jump':
      return { head: [12, 6], headR: 2.4, limbs: [
        torso([12, 9.5], [12, 21]),
        { a: [12, 10.5], b: [0.5, 9.5], r: 0.9 }, { a: [12, 10.5], b: [23.5, 10.8], r: 0.9 },
        { a: [12, 21], b: [9, 28], r: 1.6 }, { a: [9, 28], b: [11, 34], r: 1.3 },
        { a: [12.5, 21], b: [16, 27], r: 1.6 }, { a: [16, 27], b: [15, 33], r: 1.3 },
      ] };
    default:
      return { head: [12, 5], headR: 2.5, limbs: [
        torso([12, 8.5], [12, 20.5]),
        { a: [11, 9.5], b: [7.5, 14.5], r: 1.1 }, { a: [7.5, 14.5], b: [10, 19], r: 1 },
        { a: [13, 9.5], b: [16.5, 14.5], r: 1.1 }, { a: [16.5, 14.5], b: [14, 19], r: 1 },
        { a: [11, 20.5], b: [10, 30], r: 1.5 }, { a: [10, 30], b: [9.5, 39], r: 1.3 },
        { a: [13, 20.5], b: [14, 30], r: 1.5 }, { a: [14, 30], b: [14.5, 39], r: 1.3 },
      ] };
  }
}

const distToSegment = (p: [number, number], a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

export const RASTER = { cols: 24, rows: 40 };

export type Hologram = {
  filled: boolean[];
  boundary: number[];
  area: number;
  /** Boundary cells: the "screen" that encodes the interior. */
  edge: number;
  /** Bound in the analogy: bits ≤ edge / 4 (cf. S ≤ A / 4). */
  bits: number;
  ratio: number;
};

export function hologram(pose: Pose): Hologram {
  const { head, headR, limbs } = bodyOf(pose);
  const { cols, rows } = RASTER;
  const filled = Array.from({ length: cols * rows }, (_, i) => {
    const p: [number, number] = [(i % cols) + 0.5, Math.floor(i / cols) + 0.5];
    return Math.hypot(p[0] - head[0], p[1] - head[1]) <= headR || limbs.some((c) => distToSegment(p, c.a, c.b) <= c.r);
  });
  const boundary: number[] = [];
  filled.forEach((on, i) => {
    if (!on) return;
    const c = i % cols; const r = Math.floor(i / cols);
    const empty = (cc: number, rr: number) => cc < 0 || rr < 0 || cc >= cols || rr >= rows || !filled[rr * cols + cc];
    if (empty(c - 1, r) || empty(c + 1, r) || empty(c, r - 1) || empty(c, r + 1)) boundary.push(i);
  });
  const area = filled.filter(Boolean).length;
  return { filled, boundary, area, edge: boundary.length, bits: Math.floor(boundary.length / 4), ratio: boundary.length / Math.max(1, area) };
}

/** Single eye on the head, looking along the figure's facing. */
export function eyeOf(pose: Pose): [number, number] {
  const { head } = bodyOf(pose);
  return [head[0] + (pose === 'vet' ? -0.9 : 0), head[1] - 0.3];
}

/**
 * Soft-serve event: the swirl follows the figure's proportions (an "ideal mammal form").
 * Tiers come from the figure's height in heads (minus one); the twist from the boundary / area ratio.
 */
export function softServe(pose: Pose) {
  const h = hologram(pose);
  const { headR } = bodyOf(pose);
  const rowsOn = h.filled.map((on, i) => (on ? Math.floor(i / RASTER.cols) : -1)).filter((r) => r >= 0);
  const heads = (Math.max(...rowsOn) - Math.min(...rowsOn) + 1) / (headR * 2);
  return { tiers: Math.max(3, Math.min(7, Math.round(heads) - 1)), heads, twist: Math.min(1, h.ratio * 1.6), width: 0.55 + Math.min(0.35, h.area / 1400) };
}
