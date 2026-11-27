// Engine menu: four cars, one per symbol, as dashboard instruments — the first step toward
// plugging FamiDance's matrix grid into the Cure-API main menu.
//
//   A 車 = BTC axis · B 車 = USD axis · C 車 = XAU axis · D 車 = CPU axis
//
// Inputs come from FamiDance (saved poses → synthetic-API parameters; the friction matrix and last
// prices it measured). Each car turns them into a speedometer: speed from the median move of the
// forecast fan, gear from its direction, RPM from friction, temperature from the width of the fan.
// Synthetic and educational: these are not forecasts of real prices.

import { DEFAULT_POSE, constrain, fan, paramsOf, type DanceParams, type Pose } from '@/lib/famiDance';

export type CarSym = 'BTC' | 'USD' | 'XAU' | 'CPU';
export type Car = { letter: 'A' | 'B' | 'C' | 'D'; sym: CarSym; name: string; cell: number; primary: string; secondary: string; accent: string; start: number; digits: number };

export const CARS: Car[] = [
  { letter: 'A', sym: 'BTC', name: 'A 車 · BTC 軸', cell: 0, primary: '#ff2bd6', secondary: '#3dff8f', accent: '#ffe600', start: 100000, digits: 0 },
  { letter: 'B', sym: 'USD', name: 'B 車 · USD 軸', cell: 1, primary: '#00e5ff', secondary: '#ff6b3d', accent: '#d9ff3d', start: 100, digits: 2 },
  { letter: 'C', sym: 'XAU', name: 'C 車 · XAU 軸', cell: 2, primary: '#ffcc00', secondary: '#7c5cff', accent: '#ff4d4d', start: 2650, digits: 1 },
  { letter: 'D', sym: 'CPU', name: 'D 車 · CPU 軸', cell: 3, primary: '#3d7bff', secondary: '#ff4fa3', accent: '#00ffa3', start: 50, digits: 2 },
];

// ------------------------------------------------------------------ inputs shared with FamiDance
export const POSES_KEY = 'famidance-poses-v1';
export const ENGINE_KEY = 'famidance-engine-v1';
export type EngineFeed = { at: number; port: number; bone: string; friction: Record<string, number | null>; prices: Partial<Record<CarSym, number>>; mode: 'yoga' | 'dance' };

export function readEngineInputs(): { poses: Partial<Record<CarSym, Pose>>; feed: EngineFeed | null } {
  let poses: Partial<Record<CarSym, Pose>> = {}; let feed: EngineFeed | null = null;
  try { const p = JSON.parse(localStorage.getItem(POSES_KEY) ?? 'null'); if (p) poses = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, constrain(v as Pose)])); } catch { /* storage unavailable */ }
  try { feed = JSON.parse(localStorage.getItem(ENGINE_KEY) ?? 'null'); } catch { /* storage unavailable */ }
  return { poses, feed };
}
export function writeEngineFeed(feed: EngineFeed) { try { localStorage.setItem(ENGINE_KEY, JSON.stringify(feed)); } catch { /* storage unavailable */ } }

// ------------------------------------------------------------------ one car's instruments
export type CarReading = {
  params: DanceParams; fan: ReturnType<typeof fan>; start: number; move: number;
  speed: number; gear: 'D' | 'N' | 'R'; rpm: number | null; temp: number;
};
export const MAX_SPEED = 300; export const MAX_RPM = 8;

export function readCar(car: Car, pose: Pose | undefined, feed: EngineFeed | null): CarReading {
  const params = paramsOf(pose ?? DEFAULT_POSE);
  const start = feed?.prices[car.sym] ?? car.start;
  const f = fan(params, start, 32, 240, 11 + car.cell);
  const move = f[32].p50 / start - 1; // median move over 32 beats
  const speed = Math.min(MAX_SPEED, Math.abs(move) * 1500);
  const gear = move > 0.005 ? 'D' : move < -0.005 ? 'R' : 'N';
  // RPM: this car's mean friction with the other three (×1000 on the dial).
  const mine = feed ? Object.entries(feed.friction).filter(([k, v]) => k.split('|').includes(car.sym) && v !== null).map(([, v]) => v as number) : [];
  const rpm = mine.length ? (mine.reduce((a, b) => a + b, 0) / mine.length) * MAX_RPM : null;
  const temp = Math.min(1, (f[32].p95 - f[32].p5) / start / 0.6);
  return { params, fan: f, start, move, speed, gear, rpm, temp };
}

// ------------------------------------------------------------------ colour rules, checked
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export function hueOf(hex: string) {
  const [r, g, b] = hexRgb(hex); const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn;
  if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360;
}
const lum = (hex: string) => { const c = hexRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a: string, b: string) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const hueGap = (a: string, b: string) => { const d = Math.abs(hueOf(a) - hueOf(b)) % 360; return Math.min(d, 360 - d); };
export const PANEL_BG = '#07060f';

export const DESIGN_RULES = [
  '各車は主色・副色・差し色の 3 色。主色と副色は色相を 90° 以上離す',
  '速度の帯は全車共通：0–120 緑・120–240 黄・240–300 赤（意味の色は車の色より優先）',
  '数字と文字は、背景とのコントラスト比 4.5 以上の色だけを使う',
  '点滅させない。動くのは針の揺れ（波のサイコロ）と枠のグラデーションの流れだけ',
  '予測の帯は主色 30%、中央の線は差し色、いまの値は白い点',
];

export function checkRules(car: Car) {
  return [
    { rule: '主色と副色の色相差 ≥ 90°', value: `${hueGap(car.primary, car.secondary).toFixed(0)}°`, ok: hueGap(car.primary, car.secondary) >= 90 },
    { rule: '主色の文字のコントラスト ≥ 4.5', value: contrast(car.primary, PANEL_BG).toFixed(1), ok: contrast(car.primary, PANEL_BG) >= 4.5 },
    { rule: '差し色の文字のコントラスト ≥ 4.5', value: contrast(car.accent, PANEL_BG).toFixed(1), ok: contrast(car.accent, PANEL_BG) >= 4.5 },
  ];
}
