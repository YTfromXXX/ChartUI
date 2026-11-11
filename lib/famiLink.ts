// Linking the wave die, the FamiDance skeleton, the 22 Fami ports and a customer's matrix grid.
//
// The die's 2 × 3 grid is read as a body:   [左手][ 頭 ][右手]
//                                           [左足][ 腰 ][右足]
// Each cell's wave moves its joint; the face dragged into a cell sets how far that joint moves
// (face 6 = the biggest sway). On every beat the die is read at the beat time and the top cell's
// joint leads (moves twice as far).
//
// Each Fami port reads exactly one bone of the skeleton. Friction between two dancers is measured
// on that bone: (1 − correlation of the bone's angle changes) / 2, so 0 = they move together and
// 1 = they move against each other. A customer who holds USD and only trades against BTC has one
// real cell in the matrix; the others are built virtually from dancers that move off-screen, and
// the guide points to the next pair worth trying. Synthetic and educational: not advice.

import { constrain, midJoint, neckOf, SEG, type Joint, type P, type Pose } from '@/lib/famiDance';

export const CELL_JOINT: Joint[] = ['lHand', 'head', 'rHand', 'lFoot', 'hip', 'rFoot'];
export const CELL_JOINT_LABEL = ['左手', '頭', '右手', '左足', '腰', '右足'];
const SWAY: Record<Joint, P> = { head: { x: 6, y: 0 }, lHand: { x: 0, y: 12 }, rHand: { x: 0, y: 12 }, hip: { x: 0, y: 5 }, lFoot: { x: 6, y: 0 }, rFoot: { x: -6, y: 0 } };

/** Move each joint by its cell's wave; `waveAt(cell)` is in −1 … 1, `lead` doubles one cell. */
export function waveOffsets(pose: Pose, layout: number[], waveAt: (cell: number) => number, gain = 1, lead: number | null = null): Pose {
  const out = { ...pose };
  CELL_JOINT.forEach((j, cell) => {
    const k = (layout[cell] / 6) * gain * (lead === cell ? 2 : 1) * waveAt(cell);
    out[j] = { x: pose[j].x + SWAY[j].x * k, y: pose[j].y + SWAY[j].y * k };
  });
  return constrain(out);
}

export type Bone = 'head' | 'spine' | 'lUpper' | 'lFore' | 'rUpper' | 'rFore' | 'lThigh' | 'lShin' | 'rThigh' | 'rShin';
export const BONE_LABEL: Record<Bone, string> = {
  head: '頭（首→頭）', spine: '背骨（首→腰）', lUpper: '左上腕', lFore: '左前腕', rUpper: '右上腕', rFore: '右前腕', lThigh: '左腿', lShin: '左脛', rThigh: '右腿', rShin: '右脛',
};

/** Angle (radians) of one bone in a pose. */
export function boneAngle(p: Pose, bone: Bone) {
  const neck = neckOf(p);
  const lE = midJoint(neck, p.lHand, SEG.ARM, -1); const rE = midJoint(neck, p.rHand, SEG.ARM, 1);
  const lK = midJoint(p.hip, p.lFoot, SEG.LEG, 1); const rK = midJoint(p.hip, p.rFoot, SEG.LEG, -1);
  const seg: Record<Bone, [P, P]> = {
    head: [neck, p.head], spine: [neck, p.hip], lUpper: [neck, lE], lFore: [lE, p.lHand], rUpper: [neck, rE], rFore: [rE, p.rHand],
    lThigh: [p.hip, lK], lShin: [lK, p.lFoot], rThigh: [p.hip, rK], rShin: [rK, p.rFoot],
  };
  const [a, b] = seg[bone]; return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Which bone each of the 22 Fami ports reads, and why. */
export const PORT_BONE: Record<number, { bone: Bone; why: string }> = {
  1: { bone: 'rFore', why: 'スロットのレバーを引く腕' }, 2: { bone: 'rFore', why: '片腕でもいいからシンクロを得る' }, 3: { bone: 'lThigh', why: '奇数と偶数で左右の足を踏み替える' },
  4: { bone: 'head', why: '話す頭' }, 5: { bone: 'spine', why: 'ループそのものの軸' }, 6: { bone: 'lShin', why: '動物の歩幅' },
  7: { bone: 'spine', why: '皆で乗る飛行機の胴体' }, 8: { bone: 'lFore', why: '翼になる腕' }, 9: { bone: 'spine', why: '柱' },
  10: { bone: 'head', why: '絵日記を書く視線' }, 11: { bone: 'lUpper', why: '制服の肩' }, 12: { bone: 'head', why: '髑髏' },
  13: { bone: 'rUpper', why: 'メッシュの接合点（肩）' }, 14: { bone: 'lUpper', why: '巨人の腕' }, 15: { bone: 'rShin', why: 'ほぼサッカー：蹴る脛' },
  16: { bone: 'rUpper', why: 'ロボットの肩関節' }, 17: { bone: 'spine', why: 'ボディメンテナンス' }, 18: { bone: 'rThigh', why: '保健室のベッドに向かう足' },
  19: { bone: 'head', why: 'クイズに答える頭' }, 20: { bone: 'rFore', why: '王冠を掲げる腕' }, 21: { bone: 'lShin', why: '地図をたどる足' },
  22: { bone: 'rThigh', why: 'バイクにまたがる腿' },
};

/** Friction from two angle series: (1 − Pearson correlation of their changes) / 2, or null. */
export function friction(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length); if (n < 30) return null;
  const da: number[] = []; const db: number[] = [];
  for (let i = a.length - n + 1; i < a.length; i += 1) da.push(a[i] - a[i - 1]);
  for (let i = b.length - n + 1; i < b.length; i += 1) db.push(b[i] - b[i - 1]);
  const m = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const ma = m(da); const mb = m(db); let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < da.length; i += 1) { sab += (da[i] - ma) * (db[i] - mb); saa += (da[i] - ma) ** 2; sbb += (db[i] - mb) ** 2; }
  if (saa < 1e-9 || sbb < 1e-9) return null;
  return (1 - sab / Math.sqrt(saa * sbb)) / 2;
}

export const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/**
 * Guide a customer from the pairs they actually trade to the virtual pairs next to them (sharing a
 * symbol), ranked by how different their friction is from what the customer already knows.
 */
export function guide(symbols: string[], traded: Set<string>, f: (a: string, b: string) => number | null) {
  const known = [...traded].map((k) => f(...(k.split('|') as [string, string]))).filter((v): v is number => v !== null);
  const base = known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0.5;
  const tradedSyms = new Set([...traded].flatMap((k) => k.split('|')));
  const out: { a: string; b: string; friction: number; contrast: number }[] = [];
  for (let i = 0; i < symbols.length; i += 1) for (let j = i + 1; j < symbols.length; j += 1) {
    const a = symbols[i]; const b = symbols[j]; const k = pairKey(a, b);
    if (traded.has(k) || !(tradedSyms.has(a) || tradedSyms.has(b))) continue;
    const v = f(a, b); if (v === null) continue;
    out.push({ a, b, friction: v, contrast: Math.abs(v - base) });
  }
  return { base, suggestions: out.sort((x, y) => y.contrast - x.contrast) };
}
