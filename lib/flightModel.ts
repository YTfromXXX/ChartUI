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
export type Flight = { pitch: number; roll: number; heading: number; speed: number; alt: number; vs: number; thrust: number; x: number; z: number;
  onGround?: boolean; gear?: boolean; flaps?: number; event?: string; eventN?: number };
export type Controls = { pitchCmd: number; rollCmd: number; thrust: number; gear?: boolean; flaps?: number; brake?: boolean; trim?: number; reset?: Flight }; // trim: pitch bias in degrees // pitchCmd −1..1, rollCmd −1..1, thrust 0..1, flaps 0..1

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

// ---- the runway: heading 000 (north = −z), threshold at z = 0, 3,000 m long, 45 m wide, aim point 300 m in ----
export const RWY = { width: 45, length: 3000, aimZ: -300, name: '36' };
export const VR = 72; // rotate (m/s, about 140 kt)
export const stallSpeed = (flaps: number) => 68 - 12 * flaps; // m/s: flaps lower it
const A_DRAG = 3.435e-5; const B_INDUCED = 4800; // parasitic ∝ V², induced ∝ 1/V² (bigger when slow)
const drag = (v: number, flaps: number, gear: boolean) => A_DRAG * v * v * (1 + 0.5 * flaps + (gear ? 0.3 : 0)) + B_INDUCED / Math.max(30, v) ** 2;
/** PAPI: four lights beside the aim point. On the 3° path: two white, two red. All white = too high, all red = too low. */
export function papi(f: Flight) { const dist = f.z - RWY.aimZ; if (dist <= 0) return null; const ang = deg(Math.atan2(f.alt + 4, dist)); return { ang, white: [2.5, 2.83, 3.17, 3.5].filter((t) => ang > t).length }; }
export const onRunway = (f: Flight) => Math.abs(f.x) <= RWY.width / 2 && f.z <= 0 && f.z >= -RWY.length;

export const takeoffStart = (): Flight => ({ pitch: 0, roll: 0, heading: 0, speed: 0, alt: 0, vs: 0, thrust: 0, x: 0, z: -60, onGround: true, gear: true, flaps: 0.5, event: '滑走路 36 の端。推力を上げて走りだす。VR（約 72 m/s）で機首を上げる。', eventN: 1 });
export const approachStart = (): Flight => { const d = 9000; return { pitch: rad(-3), roll: 0, heading: 0, speed: 76, alt: Math.tan(rad(3)) * (d - RWY.aimZ) - 4, vs: -76 * Math.sin(rad(3)), thrust: 0.2, x: 0, z: d, onGround: false, gear: true, flaps: 1, event: '最終進入、滑走路まで 9 km。PAPI を白 2・赤 2 に保って降りる。地面の 10 m ほど手前で、少しだけ引く（フレア）とやわらかく降りられる。', eventN: 1 }; };

/** One step of dt seconds. Bank and pitch follow the commands with a little lag (no real aerodynamics). */
export function step(f: Flight, c: Controls, dt: number): Flight {
  const gear = c.gear ?? f.gear ?? true; const flaps = c.flaps ?? f.flaps ?? 0;
  const thrust = f.thrust + (c.thrust - f.thrust) * Math.min(1, dt * 0.8);
  let event = f.event; let eventN = f.eventN ?? 0; const say = (m: string) => { event = m; eventN += 1; };
  if (f.onGround) {
    const pitchTarget = f.speed > VR - 3 ? rad(10) * Math.max(0, c.pitchCmd) : 0;
    const pitch = f.pitch + (pitchTarget - f.pitch) * Math.min(1, dt * 1.2);
    const acc = thrust * 3.2 - A_DRAG * f.speed * f.speed * (1 + 0.5 * flaps + (gear ? 0.3 : 0)) - (f.speed > 0.1 ? 0.2 : 0) - (c.brake && f.speed > 0 ? 2.8 : 0); // on the wheels: no lift, so no induced drag
    const speed = Math.max(0, Math.min(120, f.speed + acc * dt));
    const heading = (f.heading + c.rollCmd * 0.05 * Math.min(1, speed / 15) * dt + Math.PI * 2) % (Math.PI * 2); // nose-wheel steering / rudder
    const g = speed * dt; let onGround = true; let alt = 0; let vs = 0;
    if (speed >= VR && pitch > rad(3)) { onGround = false; alt = 0.5; vs = speed * Math.sin(pitch); say(`離陸（${Math.round(speed)} m/s）。上昇を確かめたら、車輪を上げる（G）。`); }
    if (!onRunway(f) && f.speed > 5) say('滑走路を外れた — 止まってやり直し（R）');
    return { ...f, pitch, roll: 0, heading, speed, alt, vs, thrust, x: f.x + Math.sin(heading) * g, z: f.z - Math.cos(heading) * g, onGround, gear, flaps, event, eventN };
  }
  const roll = f.roll + (rad(35) * c.rollCmd - f.roll) * Math.min(1, dt * 1.5);
  const pitch = f.pitch + (rad(10) * c.pitchCmd + rad(c.trim ?? 0) - f.pitch) * Math.min(1, dt * 1.2);
  const acc = thrust * 3.2 - drag(f.speed, flaps, gear) - G * Math.sin(pitch);
  const speed = Math.max(40, Math.min(260, f.speed + acc * dt));
  const heading = (f.heading + turnRate(roll, speed) * dt + Math.PI * 2) % (Math.PI * 2);
  const stall = stallSpeed(flaps);
  let path = pitch; if (speed < stall) { path = Math.min(pitch, -((stall - speed) / stall) * 0.6); if (f.event !== '失速の警告 — 機首を下げて、推力を上げる') say('失速の警告 — 機首を下げて、推力を上げる'); }
  const vs = speed * Math.sin(path);
  let alt = Math.min(12500, f.alt + vs * dt); let onGround = false;
  const g = speed * Math.cos(path) * dt; const x = f.x + Math.sin(heading) * g; const z = f.z - Math.cos(heading) * g;
  if (alt <= 0) {
    if (!gear) { alt = 3; say('車輪が出ていない！ 推力を上げて上がり、車輪を下ろす（G）'); }
    else {
      onGround = true; alt = 0; const sink = -vs;
      const where = onRunway({ ...f, x, z }) ? '' : '（滑走路の外の草地 — やり直し R）';
      say(`${sink <= 1.5 ? 'やわらかい接地' : sink <= 3 ? 'ふつうの接地' : 'かたい接地（点検の記録をつける）'}：沈下 ${sink.toFixed(1)} m/s${where}。逆噴射の代わりに推力を絞って、ブレーキ（B）。`);
      return { ...f, pitch: 0, roll: 0, heading, speed, alt, vs: 0, thrust, x, z, onGround, gear, flaps, event, eventN };
    }
  }
  return { ...f, pitch, roll, heading, speed, alt, vs, thrust, x, z, onGround, gear, flaps, event, eventN };
}

/** The layer we are flying through (or between). */
export const layerAt = (alt: number) => LAYERS.find((l) => alt >= l.base && alt <= l.top) ?? null;
/** Micro- or meso-scale label for a distance in metres. */
export const scaleOf = (m: number) => (m < 2000 ? 'ミクロ層' : m <= 2_000_000 ? 'メソ層' : '大規模');

/** Autopilot (MCP): hold a target altitude, heading and speed with gentle proportional commands.
 *  Real autopilots are far richer (LNAV/VNAV, approach modes); this is the idea only. */
export type ApTarget = { alt: number; hdg: number; spd: number };
export function autopilot(f: Flight, t: ApTarget): Controls {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  let err = rad(t.hdg) - f.heading; while (err > Math.PI) err -= Math.PI * 2; while (err < -Math.PI) err += Math.PI * 2;
  return { pitchCmd: clamp((t.alt - f.alt) / 800 - f.vs / 25), rollCmd: clamp(err / rad(25)) * 0.72, thrust: Math.max(0, Math.min(1, 0.62 + (t.spd - f.speed) / 30)) };
}
