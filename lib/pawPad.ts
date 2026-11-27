// PowerPoint A-4 — a paw-pad contact sensor for walks that the cat does not wear.
//
// Stepping pads placed along the walk: low, flush, round-edged, made of soft conductive
// silicone (not cold bare metal), with interdigitated electrodes so a single paw bridges both
// and closes the circuit. Spacing follows the cat's walking stride. Scores are design
// estimates for comparing shapes, not measured safety data; fit and walking plans should be
// checked with a veterinarian, and walks are never forced.

export type PadParams = {
  /** Pad diameter, mm. */
  diameter: number;
  /** Edge radius, mm (rounded edges protect toes and claws). */
  edgeRadius: number;
  /** Height above the path, mm (low = no tripping). */
  height: number;
  /** Gap between the interdigitated electrodes, mm. */
  gap: number;
  /** Distance between pads along the path, cm. */
  spacing: number;
};

export const PAD_DEFAULTS: PadParams = { diameter: 70, edgeRadius: 6, height: 4, gap: 2, spacing: 28 };

/** Rough adult-cat references used by the estimates (individual cats vary widely). */
export const CAT = { pawWidthMm: 35, strideCm: [20, 35] as [number, number] };

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export type PadScore = { injury: number; mobility: number; data: number; overall: number; notes: string[] };

export function scorePad(p: PadParams): PadScore {
  const notes: string[] = [];
  const sharp = clamp(1 - p.edgeRadius / 6);
  const trip = clamp((p.height - 3) / 12);
  const injury = clamp(0.05 + 0.5 * sharp + 0.45 * trip);
  if (p.edgeRadius < 3) notes.push('角が鋭い：爪や指先を引っかけやすい');
  if (p.height > 8) notes.push('高さがある：つまずきやすく、歩き方が変わる');
  const [lo, hi] = CAT.strideCm;
  const offStride = p.spacing < lo ? (lo - p.spacing) / lo : p.spacing > hi ? (p.spacing - hi) / hi : 0;
  const mobility = clamp(1 - 0.6 * trip - 1.2 * offStride);
  if (offStride > 0) notes.push(`置く間隔が歩幅（およそ ${lo}〜${hi} cm）から外れている：歩幅を合わせにくい`);
  const coverage = clamp((p.diameter - CAT.pawWidthMm) / 40);
  const bridge = clamp(1 - (p.gap - 1) / 4);
  const data = clamp(0.15 + 0.55 * coverage + 0.3 * bridge);
  if (p.diameter < 50) notes.push('直径が小さい：肉球が載り切らず、接触が不安定');
  if (p.gap > 3.5) notes.push('電極の間隔が広い：1 枚の肉球で両極にまたがりにくい');
  const overall = clamp(0.4 * (1 - injury) + 0.3 * mobility + 0.3 * data);
  return { injury, mobility, data, overall, notes };
}

/** Wearable alternatives, as fixed design estimates for comparison. */
export const WEARABLES = [
  { name: 'ブーツ型（足全体を覆う）', injury: 0.35, mobility: 0.25, data: 0.7, note: '多くの猫が嫌がり、歩き方が崩れる。蒸れと擦れ' },
  { name: 'つま先キャップ型', injury: 0.3, mobility: 0.5, data: 0.6, note: '爪の出し入れを妨げる。外れやすい' },
  { name: '足首バンド＋パッド型', injury: 0.2, mobility: 0.65, data: 0.45, note: '締めすぎに注意。パッドがずれると接触が途切れる' },
] as const;

/** Interdigitated electrode fingers for a pad, in mm from the pad centre. */
function fingers(p: PadParams) {
  const r = p.diameter / 2 - p.edgeRadius - 2;
  const pitch = p.gap + 3;
  const out: { x: number; y: number; w: number; h: number; side: 0 | 1 }[] = [];
  let i = 0;
  for (let x = -r; x <= r; x += pitch, i += 1) {
    const half = Math.sqrt(Math.max(0, r * r - x * x));
    const h = half * 2 - 3;
    if (h < 2) continue; // too close to the rim for a finger
    out.push({ x, y: -half + (i % 2 ? 3 : 0), w: 3, h, side: (i % 2) as 0 | 1 });
  }
  return out;
}

/** Self-contained SVG drawing: top view, side profile, and the path layout. */
export function pawPadSvg(p: PadParams): string {
  const s = 2.2; // px per mm for the top view
  const R = (p.diameter / 2) * s;
  const cx = 30 + R; const cy = 30 + R;
  const fin = fingers(p).map((f) => `<rect x="${(cx + f.x * s).toFixed(1)}" y="${(cy + f.y * s).toFixed(1)}" width="${(f.w * s).toFixed(1)}" height="${(f.h * s).toFixed(1)}" fill="${f.side ? '#d6001c' : '#1f1f1f'}" opacity="0.85"/>`).join('');
  const sideX = cx * 2 + 40; const sideY = cy;
  const w = p.diameter * s; const h = Math.max(2, p.height * s); const er = Math.min(p.edgeRadius * s, h, w / 2);
  const side = `<path d="M${sideX},${sideY + h} L${sideX},${sideY + er} Q${sideX},${sideY} ${sideX + er},${sideY} L${sideX + w - er},${sideY} Q${sideX + w},${sideY} ${sideX + w},${sideY + er} L${sideX + w},${sideY + h} Z" fill="#cfcfcf" stroke="#1f1f1f" stroke-width="1.5"/><line x1="${sideX - 20}" y1="${sideY + h}" x2="${sideX + w + 20}" y2="${sideY + h}" stroke="#1f1f1f"/>`;
  const pathY = cy * 2 + 40; const step = p.spacing * 2.4;
  const pads = Array.from({ length: 6 }, (_, i) => `<circle cx="${(40 + i * step).toFixed(1)}" cy="${(pathY + (i % 2 ? 16 : -16)).toFixed(1)}" r="${(p.diameter / 2 * 0.5).toFixed(1)}" fill="#d6001c" opacity="0.8"/>`).join('');
  // Leave room for the side-view label (about 260 px) as well as the drawing itself.
  const width = Math.max(sideX + w + 40, sideX + 280, 60 + 5 * step + 40);
  const height = pathY + 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" font-family="sans-serif" font-size="11">
<rect width="100%" height="100%" fill="#f2f2f2"/>
<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R.toFixed(1)}" fill="#e6e6e6" stroke="#1f1f1f" stroke-width="2"/>
<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(R - p.edgeRadius * s).toFixed(1)}" fill="none" stroke="#1f1f1f" stroke-dasharray="3 3"/>
${fin}
<text x="${(cx - R).toFixed(1)}" y="18">上面：直径 ${p.diameter} mm・くし歯電極 間隔 ${p.gap} mm（黒＝＋／赤＝−）</text>
${side}
<text x="${sideX}" y="${(sideY - 10).toFixed(1)}">側面：高さ ${p.height} mm・角 R${p.edgeRadius}（導電性シリコン）</text>
<line x1="20" y1="${pathY}" x2="${(width - 20).toFixed(0)}" y2="${pathY}" stroke="#9a9a9a" stroke-width="22" opacity="0.35"/>
${pads}
<text x="20" y="${(pathY + 44).toFixed(1)}">散歩道の配置：${p.spacing} cm ごと（左右交互）</text>
</svg>`;
}
