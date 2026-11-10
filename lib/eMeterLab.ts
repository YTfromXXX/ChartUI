// PowerPoint A — the e-meter (#8): plate reinforcement and a cat experiment on the sugoroku.
//
// 1. Reinforcement: the museum plate of #8 (a leaning "prop") is the weakest skeleton member.
//    Same model as the [():()] device: stability = cos(lean) · (1 − |torque|/120) · form,
//    fatigue = rust · (1 + |lean|/10). Interventions: straighten, untwist, treat rust, add a
//    brace. The 12° twist is what holds #8 back; a little untwisting is the cheapest way out.
// 2. Cat experiment: an e-meter reads skin conductance (electrodermal activity, EDA), which
//    tracks sympathetic arousal through eccrine sweat glands. Humans have them densely on the
//    palms; cats have them mainly on the paw pads. So the cat version is non-invasive: paw-pad
//    contact, a collar heart rate, behaviour and thermal imaging. Implanting metal is excluded:
//    it would need surgery and anaesthesia on a pet for no gain (it would not measure skin
//    conductance at all), and it conflicts with animal-welfare law and the 3Rs.
//    The 22 sugoroku squares are observation tasks shared by four CPUs at [2:4:6:7] — the cat
//    itself holds the largest share and stops the run when its stress gets too high.

import { MUSEUM, type PlateForm } from '@/LAB/colorcube/museum';
import { mulberry32 } from '@/lib/retroGrid';

const FORM_BASE: Record<PlateForm | 'braced', number> = { slab: 0.9, arc: 1, torqued: 0.85, prop: 0.7, spiral: 0.95, braced: 0.95 };

export const EMETER_ROOM = MUSEUM.find((r) => r.kit.id === 8)!;
export const SKELETON_MEAN = 0.85;

export type Fix = { lean: number; untwist: number; rustTreatment: number; brace: boolean };

export function plateScore(fix: Fix) {
  const r = EMETER_ROOM;
  const lean = r.lean * (1 - fix.lean);
  const rust = r.oxidation * (1 - fix.rustTreatment);
  const torque = r.torque * (1 - fix.untwist);
  const form = fix.brace ? 'braced' : r.form;
  const stability = Math.max(0, Math.cos((lean * Math.PI) / 180) * (1 - Math.abs(torque) / 120) * FORM_BASE[form]);
  const fatigue = Math.min(1, rust * (1 + Math.abs(lean) / 10));
  return { lean, torque, rust, stability, fatigue };
}

/** Cheapest fix (straighten, untwist, treat rust, brace) that brings #8 up to the skeleton mean. */
export function recommendFix(): { fix: Fix; cost: number } | null {
  let best: { fix: Fix; cost: number } | null = null;
  for (const brace of [false, true]) for (let l = 0; l <= 10; l += 1) for (let u = 0; u <= 10; u += 1) for (let t = 0; t <= 10; t += 1) {
    const fix = { lean: l / 10, untwist: u / 10, rustTreatment: t / 10, brace };
    const s = plateScore(fix);
    if (s.stability < SKELETON_MEAN || s.fatigue > 0.5) continue;
    const cost = fix.lean * 3 + fix.untwist * 4 + fix.rustTreatment * 2 + (brace ? 2.5 : 0);
    if (!best || cost < best.cost) best = { fix, cost };
  }
  return best;
}

export type Method = { key: string; name: string; measures: string; quality: number; stress: number; excluded?: string };

export const METHODS: readonly Method[] = [
  { key: 'paw', name: '肉球の接触センサー', measures: '肉球の皮膚電気活動（EDA に近い信号）', quality: 0.55, stress: 0.06 },
  { key: 'collar', name: '首輪の心拍センサー', measures: '心拍と心拍変動', quality: 0.7, stress: 0.03 },
  { key: 'video', name: '行動の観察（耳・尾・瞳孔・姿勢）', measures: '行動上のストレスサイン', quality: 0.6, stress: 0 },
  { key: 'thermal', name: 'サーモカメラ', measures: '体表温度の変化', quality: 0.5, stress: 0 },
  { key: 'implant', name: '金属電極の体内挿入', measures: '（皮膚電気活動は測れない）', quality: 0, stress: 1, excluded: '手術と麻酔の負担・感染の危険があり、皮膚の信号も測れない。愛玩動物には正当化できない（動物愛護管理法・3R）' },
];

export const CPUS = [
  { key: 'obaa', name: '老婆（記録係）', share: 2, role: 'ログと時刻の記録' },
  { key: 'yoga', name: 'ヨガインストラクター', share: 4, role: '呼吸と環境を整え、落ち着かせる' },
  { key: 'vet', name: '獣医師', share: 6, role: '健康状態の判断と安全の確認' },
  { key: 'cat', name: 'ハチワレ猫（本人）', share: 7, role: '参加するかを決める。嫌がったら中止' },
] as const;

export const STOP_STRESS = 0.6;

export type CatRun = {
  log: { square: number; method: string; cpu: string; accepted: boolean; data: number; stress: number }[];
  data: Record<string, number>;
  stress: number;
  stoppedAt: number | null;
  total: number;
};

/** Run the 22-square observation sugoroku; the cat's own CPU can refuse a square and stop the run. */
export function runCatExperiment(seed = 1): CatRun {
  const rand = mulberry32(seed);
  const usable = METHODS.filter((m) => !m.excluded);
  const total19 = CPUS.reduce((s, c) => s + c.share, 0);
  const data: Record<string, number> = Object.fromEntries(CPUS.map((c) => [c.key, 0]));
  const log: CatRun['log'] = [];
  let stress = 0.1; let stoppedAt: number | null = null;
  for (let square = 1; square <= 22; square += 1) {
    const method = usable[(square - 1) % usable.length];
    // Pick the CPU for this square by the [2:4:6:7] split.
    let pick = rand() * total19; let cpu: (typeof CPUS)[number] = CPUS[0];
    for (const c of CPUS) { pick -= c.share; if (pick <= 0) { cpu = c; break; } }
    // The cat accepts more readily when calm; the yoga instructor's squares calm it down.
    const accepted = rand() > stress * 1.2;
    if (accepted) stress = Math.min(1, stress + method.stress * (0.6 + rand() * 0.8));
    if (cpu.key === 'yoga') stress = Math.max(0, stress - 0.08);
    if (cpu.key === 'vet') stress = Math.max(0, stress - 0.03);
    const gained = accepted ? method.quality * (0.7 + rand() * 0.3) : 0;
    data[cpu.key] += gained;
    log.push({ square, method: method.name, cpu: cpu.name, accepted, data: gained, stress });
    if (stress > STOP_STRESS) { stoppedAt = square; break; }
  }
  return { log, data, stress, stoppedAt, total: Object.values(data).reduce((s, v) => s + v, 0) };
}
