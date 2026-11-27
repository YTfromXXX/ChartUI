// Earphone channel for the shared needle: a soft continuous tone whose pitch follows the signal,
// and a small bell at each response peak. Web Audio only starts after a user gesture.

export class NeedleSound {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  volume = 0.5;

  start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.osc = this.ctx.createOscillator(); this.osc.type = 'sine';
    this.gain = this.ctx.createGain(); this.gain.gain.value = 0;
    this.osc.connect(this.gain).connect(this.ctx.destination);
    this.osc.start();
  }

  /** Map the level (0..1) to pitch 180–440 Hz and a quiet, steady volume. */
  update(level: number, muted: boolean) {
    if (!this.ctx || !this.osc || !this.gain) return;
    const now = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(180 + 260 * level, now, 0.15);
    this.gain.gain.setTargetAtTime(muted ? 0 : (0.03 + 0.07 * level) * this.volume, now, 0.2);
  }

  /** A soft bell at a response peak, louder for stronger responses. */
  bell(strength: number, muted: boolean) {
    if (!this.ctx || muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 660 + 220 * strength;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.12 * strength * this.volume, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    o.connect(g).connect(this.ctx.destination); o.start(now); o.stop(now + 1.3);
  }

  stop() {
    this.osc?.stop(); void this.ctx?.close();
    this.ctx = null; this.osc = null; this.gain = null;
  }
}
