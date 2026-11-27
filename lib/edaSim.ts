// Simulated electrodermal activity (EDA) for the shared-needle prototype.
//
// A slow tonic level plus phasic responses. A question schedules a response that starts after a
// short latency (1.5–3 s), rises over ~1.5 s and decays over several seconds — the usual shape of
// a skin-conductance response. Amplitude is random: the signal says how strongly the body
// reacted, never what the reaction means. A real sensor can replace `level()` later.

import { mulberry32 } from '@/lib/retroGrid';

export type Response = { onset: number; amp: number; rise: number; decay: number; cause: string; peaked: boolean };

export class EdaSim {
  private rand: () => number;
  private tonic = 0.25;
  private lastT = 0;
  responses: Response[] = [];

  constructor(seed = 7) { this.rand = mulberry32(seed); }

  /** A stimulus (a question) at time t (s). */
  stimulate(t: number, cause: string, strength = 1) {
    const amp = Math.min(1, (0.3 + this.rand() * 0.7) * strength);
    this.responses.push({ onset: t + 1.5 + this.rand() * 1.5, amp, rise: 1.2 + this.rand() * 0.8, decay: 4 + this.rand() * 4, cause, peaked: false });
  }

  /** Signal in [0, 1] at time t (s). Also advances the slow tonic drift. */
  level(t: number) {
    const dt = Math.max(0, t - this.lastT); this.lastT = t;
    this.tonic = Math.min(0.5, Math.max(0.1, this.tonic + (this.rand() - 0.5) * 0.02 * Math.sqrt(dt * 10) + (0.25 - this.tonic) * 0.02 * dt));
    let phasic = 0;
    for (const r of this.responses) {
      const x = t - r.onset;
      if (x <= 0) continue;
      phasic += r.amp * (1 - Math.exp(-x / (r.rise / 2))) * Math.exp(-x / r.decay);
    }
    return Math.min(1, this.tonic + phasic * 0.95);
  }

  /** Responses whose peak was just passed (each reported once). Peak ≈ onset + rise. */
  takePeaks(t: number): Response[] {
    const out: Response[] = [];
    for (const r of this.responses) if (!r.peaked && t >= r.onset + r.rise) { r.peaked = true; out.push(r); }
    return out;
  }
}
