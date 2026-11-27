// ChoiceForgeKit — surfaces the 『{A} or {B}』 text parameters.
// The base pair comes from the pattern analysis (lib/cureKit); the sensory spice level
// picks a sharper or softer wording of each side. Kit ids and pages stay fixed so the
// choice always leads to the same retro-grid page and kit cell.

import { PATTERN_ANALYSIS, type ChoiceOption, type Pattern } from '@/lib/cureKit';
import type { Spice } from '../SensorySpiceKit';

const LEXICON: Record<Pattern, Record<'A' | 'B', Record<Spice, string>>> = {
  '⚪︎': {
    A: { mild: '鼓動に合わせて打つ', medium: '鼓動の頭で打ち込む', hot: '心臓の拍で撃ち抜く' },
    B: { mild: '呼吸に合わせて吸う', medium: '呼吸の底で待つ', hot: '息の周期に溶ける' },
  },
  '◻︎': {
    A: { mild: '角で撃ち抜く', medium: '角ごとに照準を固定する', hot: 'すべての角を速射で抜く' },
    B: { mild: '檻の直線で耐える', medium: '直線の上で静かに保つ', hot: '檻の中心で微動だにしない' },
  },
  '(expand)': {
    A: { mild: '目を閉じて飛ぶ', medium: '目を閉じて境界ごと膨らむ', hot: '目を閉じたまま風船と飛ぶ' },
    B: { mild: '皮膚で境界に触れる', medium: '化粧水の膜で境界を感じる', hot: '皮膚一枚で全方位を受ける' },
  },
  '(extend)': {
    A: { mild: '龍のうねりに乗る', medium: 'うねりの頂点で加速する', hot: '龍の背で Ω を上げ続ける' },
    B: { mild: 'ジーニーのランプで鎮める', medium: 'ランプの包絡でサイン波へ戻す', hot: 'ランプに Ω をすべて吸わせる' },
  },
};

export type ForgedChoice = { title: string; prompt: string; a: ChoiceOption; b: ChoiceOption };

export function forgeChoice(pattern: Pattern, spice: Spice): ForgedChoice {
  const analysis = PATTERN_ANALYSIS[pattern];
  const [baseA, baseB] = analysis.choice;
  const a = { ...baseA, text: LEXICON[pattern].A[spice] };
  const b = { ...baseB, text: LEXICON[pattern].B[spice] };
  return { title: `『{${a.text}} or {${b.text}}』`, prompt: analysis.prompt, a, b };
}
