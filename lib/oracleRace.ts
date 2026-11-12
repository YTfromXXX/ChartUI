// METADOGG ORACLE race: the four fictional companies race as sports cars, for a live-stream screen.
//
// Each car's pace comes from its company's synthetic price: a rising price pushes the throttle,
// volatility makes the line wobble, and news hits (from the activist sugoroku headlines) give a
// short boost or a stumble. Viewers answer a four-choice question each lap ("who leads next
// lap?"), which is the first, simple form of the planned prediction market. All prices and news
// are synthetic; the companies are fictional; nothing here is advice.

import { COMPANIES, targetScore, type Company } from './activistSugoroku';

export const LAP_M = 2400; export const LAPS = 5; // about three minutes of broadcast
export type Livery = { body: string; stripe: string; number: number; logo: string };
export const LIVERIES: Record<string, Livery> = {
  MNT: { body: '#c1121f', stripe: '#f5f5f5', number: 17, logo: '₿' },
  KZE: { body: '#1d4ed8', stripe: '#facc15', number: 22, logo: '$' },
  HSG: { body: '#0f766e', stripe: '#e5e7eb', number: 7, logo: '¥' },
  TKR: { body: '#f59e0b', stripe: '#111827', number: 3, logo: 'Au' },
};

export type CarState = { company: Company; livery: Livery; dist: number; speed: number; lane: number; price: number; ret: number; vol: number; boost: number; history: number[] };
export type RaceNews = { t: number; ticker: string; text: string; effect: number };
export type Race = { t: number; cars: CarState[]; news: RaceNews[]; seed: number; finished: boolean; votes: Record<number, Record<string, number>> };

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function newRace(seed = 1): Race {
  return {
    t: 0, seed, finished: false, news: [], votes: {},
    cars: COMPANIES.map((company, i) => ({ company, livery: LIVERIES[company.ticker], dist: -i * 9, speed: 0, lane: [-1.8, 1.8, -0.6, 0.6][i], price: 100, ret: 0, vol: 0.01, boost: 0, history: [100] })),
  };
}

const HEADLINES: [string, number][] = [
  ['{name}、自社株買いを発表', 0.6], ['{name} に物言う株主が 5% 超', 0.4], ['{name} 社長「短期的な要求には応じない」', -0.3],
  ['{name} の委任状争奪戦が激化', -0.2], ['{name}、増配を発表', 0.5], ['{name} にホワイトナイトの観測', 0.2], ['{name} 総会で質問が相次ぐ', -0.1],
];

/** Advance the race by dt seconds. Pace: base 62 m/s, + drift from the price, − wobble from volatility, + news boost. */
export function step(r0: Race, dt: number): Race {
  const r: Race = { ...r0, cars: r0.cars.map((c) => ({ ...c, history: c.history })), news: r0.news };
  const rnd = rng(r.seed * 100003 + Math.floor(r.t * 10));
  r.t += dt;
  for (const c of r.cars) {
    if (c.dist >= LAP_M * LAPS) { c.speed *= 0.97; continue; }
    // price: drift tilted by how attractive the company is to activists (fundamentals), plus noise
    const drift = (targetScore(c.company) - 0.4) * 0.0006; const shock = (rnd() - 0.5) * 0.004;
    c.ret = drift + shock; c.price *= Math.exp(c.ret * dt * 10); c.vol = 0.95 * c.vol + 0.05 * Math.abs(shock);
    if (Math.floor(r.t * 2) !== Math.floor((r.t - dt) * 2)) { c.history = [...c.history.slice(-119), c.price]; }
    c.boost *= Math.exp(-dt / 2.5);
    // Pace follows momentum (the last ~10 s of price), not the price level, so no car stalls for good.
    const ref = c.history[Math.max(0, c.history.length - 20)]; const mom = Math.log(c.price / ref);
    const clampN = (x: number, a: number) => Math.max(-a, Math.min(a, x));
    const target = 62 + clampN(mom * 400, 8) + c.boost * 14 - Math.min(6, c.vol * 300);
    c.speed += (target - c.speed) * Math.min(1, dt * 0.8); c.dist += c.speed * dt;
  }
  // A news hit roughly every 6 s.
  if (rnd() < dt / 6) {
    const car = r.cars[Math.floor(rnd() * r.cars.length)]; const [tpl, eff] = HEADLINES[Math.floor(rnd() * HEADLINES.length)];
    car.boost += eff; r.news = [{ t: r.t, ticker: car.company.ticker, text: tpl.replace('{name}', car.company.name), effect: eff }, ...r.news].slice(0, 20);
  }
  r.finished = r.cars.every((c) => c.dist >= LAP_M * LAPS);
  return r;
}

export const order = (r: Race) => [...r.cars].sort((a, b) => b.dist - a.dist);
export const lapOf = (c: CarState) => Math.max(0, Math.min(LAPS, Math.floor(c.dist / LAP_M) + 1));
/** Gap to the leader in seconds, at the car's own speed. */
export const gapS = (leader: CarState, c: CarState) => (leader === c ? 0 : (leader.dist - c.dist) / Math.max(1, c.speed));
/** km/h shown on the broadcast (cars run at 55–75 m/s ≈ 200–270 km/h). */
export const kmh = (c: CarState) => Math.round(c.speed * 3.6);

/** Viewer prediction for a lap: one vote per viewer per lap, counted by ticker. */
export function castVote(r: Race, lap: number, ticker: string): Race { const v = { ...(r.votes[lap] ?? {}) }; v[ticker] = (v[ticker] ?? 0) + 1; return { ...r, votes: { ...r.votes, [lap]: v } }; }
/** Was the crowd right? The leader at the end of `lap` vs the most-voted ticker for it. */
export function crowdCall(r: Race, lap: number) {
  const v = r.votes[lap] ?? {}; const top = Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { top, total: Object.values(v).reduce((a, b) => a + b, 0) };
}
