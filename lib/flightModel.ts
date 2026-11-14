// A small, fact-based flight model for the cockpit window (a game, not a training simulator).
// Facts used (textbook values):
//  • ISA atmosphere: 15 °C at sea level, −6.5 °C per km up to 11 km, then −56.5 °C.
//  • Coordinated turn: turn rate ω = g·tan(bank) / V. A "standard rate" turn is 3°/s.
//  • Contrails (Schmidt–Appleman): usually form when the air is colder than about −40 °C (with enough
//    humidity), which in the standard atmosphere is above roughly 8.5 km. They persist in ice-supersaturated air.
//  • Typical cloud heights (mid-latitudes): cumulus bases 0.5–2 km, altostratus 2–7 km, cirrus 6–12 km.
//  • The sky looks deeper blue the higher you fly (less air above to scatter light).
//  • Scales in meteorology (Orlanski 1975): microscale under ~2 km, mesoscale ~2–2000 km.
//  • Airliners cruise around 10–12 km at about Mach 0.78–0.85 (roughly 230–250 m/s true airspeed).
export type Flight = { pitch: number; roll: number; heading: number; speed: number; alt: number; vs: number; thrust: number; x: number; z: number };
export type Controls = { pitchCmd: number; rollCmd: number; thrust: number }; // pitchCmd −1..1, rollCmd −1..1, thrust 0..1

export const G = 9.81;
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const isaTemp = (altM: number) => (altM < 11000 ? 15 - 6.5 * (altM / 1000) : -56.5);
export const contrailLikely = (altM: number) => isaTemp(altM) <= -40;
export const turnRate = (bankRad: number, v: number) => (G * Math.tan(bankRad)) / Math.max(60, v); // rad/s

export const LAYERS = [
  { name: '積雲（低い雲）', base: 1200, top: 2000, kind: 'cumulus' as const },
  { name: '高層雲（中くらいの雲）', base: 4500, top: 5200, kind: 'altostratus' as const },
  { name: '巻雲（高い雲）', base: 9000, top: 10500, kind: 'cirrus' as const },
];

export const initialFlight = (): Flight => ({ pitch: 0, roll: 0, heading: 0, speed: 235, alt: 10600, vs: 0, thrust: 0.62, x: 0, z: 0 });

/** One step of dt seconds. Bank and pitch follow the commands with a little lag (no real aerodynamics). */
export function step(f: Flight, c: Controls, dt: number): Flight {
  const roll = f.roll + (rad(35) * c.rollCmd - f.roll) * Math.min(1, dt * 1.5);
  const pitch = f.pitch + (rad(10) * c.pitchCmd - f.pitch) * Math.min(1, dt * 1.2);
  const thrust = f.thrust + (c.thrust - f.thrust) * Math.min(1, dt * 0.8);
  // speed: thrust against drag (∝ V²) and the part of gravity along the path
  const acc = thrust * 3.2 - 3.2 * 0.62 * (f.speed / 235) ** 2 - G * Math.sin(pitch);
  const speed = Math.max(120, Math.min(260, f.speed + acc * dt));
  const heading = (f.heading + turnRate(roll, speed) * dt + Math.PI * 2) % (Math.PI * 2);
  const vs = speed * Math.sin(pitch);
  const alt = Math.max(300, Math.min(12500, f.alt + vs * dt));
  const ground = speed * Math.cos(pitch) * dt;
  return { pitch, roll, heading, speed, alt, vs, thrust, x: f.x + Math.sin(heading) * ground, z: f.z - Math.cos(heading) * ground };
}

/** The layer we are flying through (or between). */
export const layerAt = (alt: number) => LAYERS.find((l) => alt >= l.base && alt <= l.top) ?? null;
/** Micro- or meso-scale label for a distance in metres. */
export const scaleOf = (m: number) => (m < 2000 ? 'ミクロ層' : m <= 2_000_000 ? 'メソ層' : '大規模');
