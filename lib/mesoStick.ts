// MESO STICK (customer D): dance on top of a vaulting box while it climbs into the sky
// through the prediction cloud.
//
// Prediction cloud: log returns of the synthetic BTCUSD line give a drift μ and volatility σ
// per tick; at horizon h the 80 % band is μh ± 1.28σ√h. Altitude is read as horizon, so the
// higher you climb, the further ahead — and the thicker, more turbulent the cloud. The
// band's drift becomes a crosswind.
// Balance: the dancer is an inverted pendulum, θ'' = 4·sin θ + wind + turbulence − 6·u − (1 + 6·cushion)·θ',
// where u ∈ [−1, 1] is the stick. Fall when |θ| exceeds the limit.

export type Forecast = { mu: number; sigma: number };

export function forecastOf(series: number[]): Forecast {
  const r: number[] = [];
  for (let i = 1; i < series.length; i += 1) if (series[i] > 0 && series[i - 1] > 0) r.push(Math.log(series[i] / series[i - 1]));
  if (r.length < 2) return { mu: 0, sigma: 0.001 };
  const mu = r.reduce((s, v) => s + v, 0) / r.length;
  const sigma = Math.sqrt(r.reduce((s, v) => s + (v - mu) ** 2, 0) / (r.length - 1)) || 0.001;
  return { mu, sigma };
}

/** 80 % band of the log price change at horizon h (in ticks). */
export const cone = (f: Forecast, h: number) => ({ mid: f.mu * h, half: 1.28 * f.sigma * Math.sqrt(Math.max(0, h)) });

export const FALL = 0.9; // radians
export const TIER_SECONDS = 4;

export type Stick = {
  theta: number; omega: number;
  altitude: number; tiers: number; balanced: number;
  score: number; danceCombo: number; fallen: boolean; time: number;
  bpm: number; cloud: number; wind: number;
};

export const initStick = (): Stick => ({ theta: 0.02, omega: 0, altitude: 0, tiers: 3, balanced: 0, score: 0, danceCombo: 0, fallen: false, time: 0, bpm: 70, cloud: 0, wind: 0 });

/** Altitude (m) → horizon (ticks) of the forecast. */
export const horizonAt = (altitude: number) => altitude * 2;

/**
 * One physics step. `u` is the stick in [−1, 1]; `damping` comes from the sneaker's cushion;
 * `f` is the forecast. Turbulence is a smooth sum of sines scaled by the cloud thickness.
 */
export function step(s: Stick, dt: number, u: number, damping: number, f: Forecast): Stick {
  if (s.fallen) return s;
  const time = s.time + dt;
  const c = cone(f, horizonAt(s.altitude));
  // Normalise the band against a 1 % move: 0 = clear sky, 1 = thick cloud.
  const cloud = Math.min(1, c.half / 0.01);
  const wind = Math.max(-1, Math.min(1, c.mid / 0.005));
  const narrow = 1 + s.tiers * 0.04; // the box top narrows as it grows
  const warmup = Math.min(1, time / 2); // the first two seconds ease in
  const turbulence = warmup * (0.7 + 7 * cloud) * (Math.sin(time * 2.3) * 0.6 + Math.sin(time * 5.1 + 1.3) * 0.3 + Math.sin(time * 9.7 + 0.4) * 0.1);
  const alpha = 4 * narrow * Math.sin(s.theta) + 1.6 * warmup * wind + turbulence - 6 * Math.max(-1, Math.min(1, u)) - (1 + 6 * damping) * s.omega;
  const omega = s.omega + alpha * dt;
  const theta = s.theta + omega * dt;
  const fallen = Math.abs(theta) > FALL;
  const upright = Math.abs(theta) < 0.25;
  const balanced = upright ? s.balanced + dt : Math.max(0, s.balanced - dt * 0.5);
  const grow = balanced >= TIER_SECONDS;
  const altitude = s.altitude + (upright ? dt * (0.6 + s.tiers * 0.05) : 0);
  return {
    ...s, time, theta, omega, fallen, cloud, wind,
    balanced: grow ? 0 : balanced,
    tiers: s.tiers + (grow ? 1 : 0),
    altitude,
    score: s.score + (upright ? dt * 10 * (1 + cloud) : 0) + (grow ? 100 : 0),
    bpm: Math.round(70 + 110 * Math.min(1, Math.abs(theta) / FALL)),
  };
}

/** Dance on the box top: near-upright earns a combo; otherwise it destabilises. */
export function dance(s: Stick): Stick {
  if (s.fallen) return s;
  if (Math.abs(s.theta) < 0.15) {
    const danceCombo = s.danceCombo + 1;
    return { ...s, danceCombo, score: s.score + 25 * danceCombo, omega: s.omega + (danceCombo % 2 ? 0.35 : -0.35) };
  }
  return { ...s, danceCombo: 0, omega: s.omega + Math.sign(s.theta || 1) * 0.9 };
}
