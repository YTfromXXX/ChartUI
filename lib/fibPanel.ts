// Fibonacci magnet control panel for the finale. 34 magnets (a Fibonacci number) laid out like
// sunflower seeds: magnet i sits at the golden angle × i, radius √(i / 33). The control puck snaps
// to the nearest magnet. x = turn (left −, right +), y = climb (down −, up +), both in −1…1.
// When the player is struggling, Luna takes the other hand: her own magnet points toward the deck,
// and the plane follows the average of the two hands.
export const MAGNETS = 34;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5°
export const magnets: [number, number][] = Array.from({ length: MAGNETS }, (_, i) => { const r = Math.sqrt(i / (MAGNETS - 1)); const a = i * GOLDEN_ANGLE; return [r * Math.cos(a), r * Math.sin(a)]; });
export const SNAP = 0.12;

export function nearest(x: number, y: number): number { let best = 0; let bd = Infinity; magnets.forEach(([mx, my], i) => { const d = Math.hypot(mx - x, my - y); if (d < bd) { bd = d; best = i; } }); return best; }
/** Snap to a magnet when close enough (the "magnet" feel while dragging). */
export function snap(x: number, y: number): [number, number] { const i = nearest(x, y); const [mx, my] = magnets[i]; return Math.hypot(mx - x, my - y) < SNAP ? [mx, my] : [x, y]; }

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
/** Luna's hand: steer toward the tower deck and to deck height, then rest on the nearest magnet. */
export function lunaHand(p: { x: number; y: number; z: number; hd: number }, deckZ: number): [number, number] {
  const want = Math.atan2(-p.y, -p.x); const err = Math.atan2(Math.sin(want - p.hd), Math.cos(want - p.hd));
  const d = Math.hypot(p.x, p.y); const targetZ = d < 0.8 ? deckZ + 0.07 : 1.3;
  return magnets[nearest(clamp(-err * 1.2), clamp((targetZ - p.z) * 3))];
}

/** Signs the player is struggling in flight: touched the tower twice in a minute, turned back and forth, or no progress for 40 s. */
export type FlightLog = { touches: number[]; flips: number[]; lastProgress: number };
export function struggling(log: FlightLog, now: number): string | null {
  if (log.touches.filter((t) => now - t < 60_000).length >= 2) return '塔に二回触れた';
  if (log.flips.filter((t) => now - t < 10_000).length >= 6) return '左右に何度も切り返している';
  if (now - log.lastProgress > 40_000) return 'しばらく塔に近づけていない';
  return null;
}
