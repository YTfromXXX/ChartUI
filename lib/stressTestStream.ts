// TypeScript mirror of tests/backend/mocks/geometric_stress_generator.py.
import type { KnotTick } from '@/components/2d/KnotChart';
import type { TrueGravityTensor } from '@/components/2d/GravityHoneycomb';
import type { PortfolioProfile } from '@/lib/portfolio';

export type StressMode = 'knot-overload' | 'sdf-breakthrough' | 'long-term-spiral';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type StressState = { price: number; direction: number; step: number; rng: () => number };

export function createStressState(seed: number): StressState {
  return { price: 100, direction: 1, step: 0, rng: mulberry32(seed) };
}

/** Whipsaw tick: reversals 85% of the time, producing endless crossings. */
export function nextOverloadTick(state: StressState, amplitude = 0.04): KnotTick {
  const { rng } = state;
  if (rng() < 0.85) state.direction = -state.direction;
  const previous = state.price;
  state.price = Math.max(0.01, previous + state.direction * amplitude * previous * (0.2 + 0.8 * rng()));
  const move = Math.abs(state.price - previous) / previous;
  state.step += 1;
  return {
    timestamp: state.step,
    price: state.price,
    volatility: Math.min(1, move * 25),
    angle: (rng() * 2 - 1) * Math.PI,
    magicLength: 0.2 + rng() * 3.8,
    tension: Math.min(1, 0.3 + move * 20),
    jump: move > amplitude * 0.8,
  };
}

/** Long-term drift tick: log scale grows without bound (compressed 1 tick = 1 trading day). */
export function nextSpiralTick(state: StressState, drift = 0.09): KnotTick {
  const { rng } = state;
  let shock = (rng() + rng() + rng() - 1.5) * 0.02;
  if (rng() < 1 / 1260) shock += (rng() < 0.5 ? -1 : 1) * (0.05 + rng() * 0.15);
  state.price *= Math.exp(drift / 252 + shock);
  state.step += 1;
  return {
    timestamp: state.step,
    price: state.price,
    volatility: Math.min(1, Math.abs(shock) * 20),
    angle: Math.log(state.price) % (2 * Math.PI),
    magicLength: 1 + Math.log1p(state.price),
    tension: Math.min(1, 0.2 + Math.abs(shock) * 15),
    jump: Math.abs(shock) > 0.05,
  };
}

/** Per-asset signed flow frame with a `spike`x mass jump at `spikeAt`, then aftershock decay. */
export function sdfBreakthroughFlows(step: number, assets: number, rng: () => number, spike = 5000, spikeAt = 120) {
  const scale = step >= spikeAt ? 1 + (spike - 1) * Math.exp(-(step - spikeAt) / 18) : 1;
  return Array.from({ length: assets }, (_, i) => {
    const flow = (rng() * 2 - 1) * scale;
    return step >= spikeAt && i === 0 ? -Math.abs(flow) * 2.2 : flow;
  });
}

const SYMBOLS = ['USDJPY', 'GBPUSD', 'EURUSD', 'USDCHF', 'XAUUSD', 'BTCUSD'] as const;

/** Raw (unsanitised) portfolio so PortfolioRadar's own clamping is what gets exercised. */
export function flowsToPortfolio(flows: readonly number[]): PortfolioProfile {
  const gross = flows.reduce((sum, f) => sum + Math.abs(f), 0) || 1;
  return {
    diversification: 1 - Math.max(...flows.map((f) => Math.abs(f))) / gross,
    volatility: gross,
    totalAssetDeviation: Math.abs(flows.reduce((s, f) => s + f, 0)) / gross,
    positions: flows.map((flow, i) => ({
      symbol: SYMBOLS[i % SYMBOLS.length],
      phase: flow >= 0 ? 'FIRE' : 'WATER',
      volatility: Math.abs(flow),
    })),
  };
}

/** Crossings of the delay-embedded knot diagram (price[i], price[i+1]) path: a
 * whipsaw stream wraps this curve around itself, so the count saturates fast. */
export function countDelayCrossings(history: readonly KnotTick[], cap = 100000): number {
  const n = history.length - 1;
  let count = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const ax = history[i].price;
    const ay = history[i + 1].price;
    const adx = history[i + 1].price - ax;
    const ady = history[i + 2 < history.length ? i + 2 : i + 1].price - ay;
    for (let j = i + 2; j < n - 1; j += 1) {
      const bx = history[j].price;
      const by = history[j + 1].price;
      const bdx = history[j + 1].price - bx;
      const bdy = history[j + 2 < history.length ? j + 2 : j + 1].price - by;
      const denom = adx * bdy - ady * bdx;
      if (Math.abs(denom) < 1e-12) continue;
      const t = ((bx - ax) * bdy - (by - ay) * bdx) / denom;
      const u = ((bx - ax) * ady - (by - ay) * adx) / denom;
      if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 && (count += 1) >= cap) return cap;
    }
  }
  return count;
}

/** Gravity tensor synthesised from a tick so the honeycomb has something to bend around. */
export function syntheticGravityTensor(tick: KnotTick | undefined): TrueGravityTensor | undefined {
  if (!tick) return undefined;
  const force = Math.sin(tick.angle) * tick.tension;
  return {
    net_force: force,
    magnitude: Math.abs(force) + tick.volatility,
    gradient: { x: Math.cos(tick.angle) * tick.volatility, y: force },
    centers: [
      { side: 'bid', price: tick.price * 0.99, strength: 0.002 + tick.volatility * 0.02, normalized_position: 0.3 },
      { side: 'ask', price: tick.price * 1.01, strength: 0.002 + tick.tension * 0.02, normalized_position: 0.7 },
    ],
  };
}
