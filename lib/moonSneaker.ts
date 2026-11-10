// Fibonacci moon sneakers (PowerPoint request A): an automatic sneaker-parameter generator.
// Each type's build follows Fibonacci numbers; cushioning breathes with the moon's phase;
// a "scent intervention" index estimates how strongly smell steers the walk (nose kit #9).
// A parameter vector for simulation and feature experiments — not product, health or
// trading advice.

const SYNODIC_DAYS = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

/** Moon age in days (mean synodic month, so within about half a day) and phase in [0, 1] (0 = new, 0.5 = full). */
export function moonPhase(date: Date) {
  const age = ((((date.getTime() - REFERENCE_NEW_MOON) / 86_400_000) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const phase = age / SYNODIC_DAYS;
  return { age, phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
}

const fib = (n: number) => { let a = 0; let b = 1; for (let i = 0; i < n; i += 1) [a, b] = [b, a + b]; return a; };

export const SNEAKER_TYPES = [
  { key: 'A', type: 'Boots Type', note: '足首まで包む。安定と重み', filled: false },
  { key: 'B', type: 'Runner Type', note: '前へ転がる軽さ', filled: true },
  { key: 'C', type: 'Dance Type', note: '回転と踏み替え（Famiポート 2 のダンサー）', filled: true },
  { key: 'D', type: 'Slip-on Type', note: '脱ぎ履きの速さ。散歩用', filled: true },
] as const;

export type SneakerParams = {
  key: string; type: string;
  soleLayers: number; stackMm: number; dropMm: number; laceHoles: number;
  cushion: number; scentIntervention: number;
};

/** k = 0..3 for A..D. `scent` 0..1 comes from the nose (e.g. sensory intensity). */
export function sneakerParams(k: number, date: Date, scent = 0.5): SneakerParams {
  const { illumination } = moonPhase(date);
  const t = SNEAKER_TYPES[k];
  return {
    key: t.key,
    type: t.type,
    soleLayers: fib(k + 3), // 2, 3, 5, 8
    stackMm: fib(k + 7) - (k === 0 ? 0 : fib(k + 4)), // A 13 · B 16 · C 26 · D 42
    dropMm: fib(k + 4) - 1, // 2, 4, 7, 12
    laceHoles: k === 3 ? 0 : fib(k + 5) - 1, // 4, 7, 12, 0
    cushion: Number((0.5 + 0.35 * (illumination - 0.5) + 0.05 * k).toFixed(3)),
    scentIntervention: Number(Math.min(1, scent * (0.6 + 0.4 * illumination) * (k === 3 ? 1.2 : 1)).toFixed(3)),
  };
}
