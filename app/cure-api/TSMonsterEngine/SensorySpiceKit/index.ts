// SensorySpiceKit — turns the shape of an intervention pattern into a sensory profile.
// Research of UI experiences that act directly on perception through form: texture,
// intensity, pulse rate and a "spice" level that later sharpens the choice wording.

import type { Pattern } from '@/lib/cureKit';

export type Texture = 'steady' | 'edged' | 'breathing' | 'surging';
export type Spice = 'mild' | 'medium' | 'hot';

export type SensoryProfile = {
  texture: Texture;
  /** 0..1, how strongly the form presses on perception. */
  intensity: number;
  /** Felt pulse frequency of the form, Hz. */
  pulseHz: number;
  spice: Spice;
  /** One-line sensory cue for the popup. */
  cue: string;
};

const FORM: Record<Pattern, { texture: Texture; base: number; pulseHz: number; cue: string }> = {
  '⚪︎': { texture: 'steady', base: 0.3, pulseHz: 1.2, cue: '一定の拍が胸の奥で反復する' },
  '◻︎': { texture: 'edged', base: 0.5, pulseHz: 0.8, cue: '直線の静けさと角の衝撃が交互に来る' },
  '(expand)': { texture: 'breathing', base: 0.4, pulseHz: 1 / 18, cue: '境界がゆっくり遠ざかり、また戻る' },
  '(extend)': { texture: 'surging', base: 0.6, pulseHz: 0.25, cue: '横へ伸びる大きなうねりが身体を運ぶ' },
};

export function senseSpice(input: { pattern: Pattern; tension?: number; oddRatio?: number }): SensoryProfile {
  const form = FORM[input.pattern];
  const tension = Math.min(1, Math.max(0, input.tension ?? 0));
  // Fewer cells already on odd steps = more unresolved pull = spicier.
  const unresolved = 1 - Math.min(1, Math.max(0, input.oddRatio ?? 0.5));
  const intensity = Math.min(1, form.base + 0.35 * tension + 0.15 * unresolved);
  const spice: Spice = intensity >= 0.7 ? 'hot' : intensity >= 0.45 ? 'medium' : 'mild';
  return { texture: form.texture, intensity, pulseHz: form.pulseHz, spice, cue: form.cue };
}
