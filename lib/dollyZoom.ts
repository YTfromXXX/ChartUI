// Super dolly zoom (the "vertigo" shot): the camera travels toward a subject while the
// focal length grows in proportion, so the subject keeps its size and screen position and
// everything behind it stretches. The camera looks down at a fixed pitch; the subject sits
// at the centre of the frame.

export type DollyCamera = { x: number; y: number; z: number; f: number; sin: number; cos: number };

/** Camera looking at (tx, 0, tz) from distance d along a pitch of `pitch` radians. f = f0 · d / d0. */
export function dollyCamera(tx: number, tz: number, d: number, d0: number, f0: number, pitch = 0.62): DollyCamera {
  const sin = Math.sin(pitch); const cos = Math.cos(pitch);
  return { x: tx, y: d * sin, z: tz - d * cos, f: f0 * (d / d0), sin, cos };
}

/** Project a world point; null when it is behind the camera. */
export function project(cam: DollyCamera, x: number, y: number, z: number, w: number, h: number) {
  const vx = x - cam.x; const vy = y - cam.y; const vz = z - cam.z;
  const depth = -vy * cam.sin + vz * cam.cos;
  if (depth < 0.15) return null;
  const up = vy * cam.cos + vz * cam.sin;
  return { x: w / 2 + (cam.f * vx) / depth, y: h / 2 - (cam.f * up) / depth, s: cam.f / depth };
}

/** Push-in amount over one shot: 0 rest → 1 in → hold → back to 0 (ease in-out). */
export function dollyAmount(t: number) {
  const k = t < 0.45 ? t / 0.45 : t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
  return k * k * (3 - 2 * k);
}
