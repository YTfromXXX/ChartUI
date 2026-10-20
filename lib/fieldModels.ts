import type { KnotFieldStyle, KnotFutureProjection, KnotTick } from '@/components/2d/KnotChart';
import type { TrueGravityTensor } from '@/components/2d/GravityHoneycomb';

export type FieldKind = 'metal' | 'crypto' | 'animal' | 'meta';

export type FieldStep = {
  tick: KnotTick;
  gravityTensor: TrueGravityTensor;
  projection: KnotFutureProjection;
  style: KnotFieldStyle;
};

export type FieldSimulator = (now: number, anchorPrice?: number) => FieldStep;

export type FieldConfig = {
  kind: FieldKind;
  symbol: string;
  title: string;
  subtitle: string;
  intervalMs: number;
  basePrice: number;
  feedLabel: string;
  physics: string[];
};

export const FIELD_CONFIGS: Record<FieldKind, FieldConfig> = {
  metal: {
    kind: 'metal', symbol: 'METALCRASH', title: 'METALCRASH / RARE METAL KNOT', subtitle: 'LME seconds x SMM daily', intervalMs: 1000, basePrice: 9500,
    feedLabel: 'LME 1s + SMM daily (synthetic)',
    physics: ['Two-frequency layers: LME second noise on a SMM daily step', 'Overnight discontinuous jumps (trade-restriction spikes)'],
  },
  crypto: {
    kind: 'crypto', symbol: 'CRYPTOCRASH', title: 'CRYPTOCRASH / 24-7 TICK KNOT', subtitle: '24/7 ticks, spoofed book', intervalMs: 120, basePrice: 65000,
    feedLabel: 'high-frequency ticks (BTC-USD anchored when live)',
    physics: ['Flickering spoof walls: strongest gravity distortion', 'Constant high-frequency knot vibration'],
  },
  animal: {
    kind: 'animal', symbol: 'ANIMALCRASH', title: 'ANIMALCRASH / HERD SENTIMENT KNOT', subtitle: 'crowd swell, trend lock', intervalMs: 400, basePrice: 0.042,
    feedLabel: 'SNS sentiment swell (synthetic)',
    physics: ['OU sentiment swell drives the price', 'Trend lock: one thick bundle and a one-sided stretched prediction box'],
  },
  meta: {
    kind: 'meta', symbol: 'METACRASH', title: 'METACRASH / MACRO INDEX KNOT', subtitle: 'heavy composite index', intervalMs: 500, basePrice: 5200,
    feedLabel: 'multi-asset composite index (synthetic)',
    physics: ['Heaviest mass: minor noise cannot bend the polyhedron', 'Rigid spiral cube: quantized, locked angles'],
  },
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

function gauss(rand: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
}

function makeTick(timestamp: number, price: number, previous: number, scale: number, jump: boolean): KnotTick {
  const move = (price - previous) / Math.max(Math.abs(previous), 1e-9);
  const relative = Math.abs(move) / scale;
  return {
    timestamp,
    price,
    volatility: clamp(relative, 0, 1),
    angle: move >= 0 ? -Math.PI / 4 : Math.PI / 4,
    magicLength: clamp(relative * 3, 0, 3),
    tension: clamp(relative, 0, 1),
    jump,
  };
}

type Wall = { side: 'bid' | 'ask'; offset: number; strength: number };

function buildGravity(price: number, spread: number, walls: Wall[]): TrueGravityTensor {
  const centers = walls.map((wall) => ({
    side: wall.side,
    price: price + wall.offset * spread,
    strength: wall.strength,
    normalized_position: clamp(0.5 + wall.offset * 0.5, 0, 1),
  }));
  const net = walls.reduce((sum, wall) => sum + (wall.side === 'bid' ? 1 : -1) * wall.strength, 0);
  const magnitude = walls.reduce((sum, wall) => sum + wall.strength, 0);
  return { net_force: net, magnitude, gradient: { x: 0, y: -clamp(net, -1.5, 1.5) * 0.4 }, centers } as TrueGravityTensor;
}

function buildProjection(direction: number, vertical: number, horizontal: number, reach: number, topology: string): KnotFutureProjection {
  return {
    vertical_pressure: clamp(vertical, 0, 1),
    horizontal_pressure: clamp(horizontal, 0, 1),
    topology,
    coordinates: Array.from({ length: 5 }, (_, index) => ({
      x: 0.5 + Math.sin(index * 1.15) * 0.05,
      y: clamp(0.5 + direction * index * reach, 0, 1),
      z: 0.5 + Math.cos(index * 1.15) * 0.05,
    })),
  };
}

function metalSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  let smm = 9500;
  let lme = 9500;
  let step = 0;
  let nextJump = 70 + Math.floor(rand() * 60);
  let jumpFlash = 0;
  return (now) => {
    step += 1;
    // SMM prints once per compressed "day"; LME ticks every second around it.
    if (step % 30 === 0) smm *= 1 + gauss(rand) * 0.004;
    let jumped = false;
    if (step >= nextJump) {
      const size = (0.03 + rand() * 0.04) * (rand() < 0.5 ? -1 : 1);
      smm *= 1 + size;
      lme *= 1 + size;
      nextJump = step + 70 + Math.floor(rand() * 90);
      jumped = true;
      jumpFlash = 1;
    }
    const previous = lme;
    lme += (smm - lme) * 0.08 + gauss(rand) * smm * 0.0007;
    jumpFlash *= 0.93;
    const tick = makeTick(now, lme, previous, 0.003, jumped);
    const basis = (smm - lme) / smm;
    const walls: Wall[] = [
      { side: 'bid', offset: -0.5 + basis * 20, strength: 0.7 + jumpFlash },
      { side: 'ask', offset: 0.45 + basis * 20, strength: 0.6 + jumpFlash * (basis > 0 ? 0.2 : 1) },
    ];
    return {
      tick,
      gravityTensor: buildGravity(lme, lme * 0.01, walls),
      projection: buildProjection(Math.sign(smm - lme) || 1, 0.45 + jumpFlash * 0.45, 0.35, 0.07 + jumpFlash * 0.05, jumpFlash > 0.4 ? 'trefoil' : 'spiral'),
      style: { strokeScale: 1 + jumpFlash * 0.6, vibration: 0.15, rigidity: 0.2, projectionStretch: jumpFlash * 0.5 },
    };
  };
}

function cryptoSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  let price = FIELD_CONFIGS.crypto.basePrice;
  let frame = 0;
  return (now, anchor) => {
    frame += 1;
    const previous = price;
    if (anchor && Number.isFinite(anchor)) price += (anchor - price) * 0.05;
    price += gauss(rand) * price * 0.00045 + Math.sin(frame * 0.9) * price * 0.00012;
    const tick = makeTick(now, price, previous, 0.0009, false);
    // Spoof walls appear and vanish every few frames, so the tensor never settles.
    const walls: Wall[] = Array.from({ length: 4 }, (_, index) => ({
      side: index % 2 === 0 ? 'bid' : 'ask',
      offset: (index % 2 === 0 ? -1 : 1) * (0.2 + rand() * 0.7),
      strength: rand() < 0.45 ? 0.2 : 1.1 + rand() * 1.4,
    }));
    const net = walls.reduce((sum, wall) => sum + (wall.side === 'bid' ? 1 : -1) * wall.strength, 0);
    return {
      tick,
      gravityTensor: buildGravity(price, price * 0.006, walls),
      projection: buildProjection(net >= 0 ? 1 : -1, 0.6 + rand() * 0.35, 0.3 + rand() * 0.4, 0.09, rand() < 0.5 ? 'figure_eight' : 'trefoil'),
      style: { strokeScale: 0.9, vibration: 1.1 + Math.abs(net) * 0.25, rigidity: 0, projectionStretch: 0.1 },
    };
  };
}

function animalSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  let price = FIELD_CONFIGS.animal.basePrice;
  let sentiment = 0;
  let lock = 0;
  let lockDirection = 0;
  let lockStrength = 0;
  return (now) => {
    sentiment += -sentiment * 0.04 + gauss(rand) * 0.12;
    if (lock <= 0 && Math.abs(sentiment) > 0.55) {
      lock = 40 + Math.floor(rand() * 40);
      lockDirection = Math.sign(sentiment);
    }
    if (lock > 0) {
      lock -= 1;
      sentiment = lockDirection * Math.max(Math.abs(sentiment), 0.7);
      lockStrength += (1 - lockStrength) * 0.15;
    } else {
      lockStrength *= 0.9;
    }
    const previous = price;
    price *= 1 + sentiment * 0.0035 + gauss(rand) * 0.0006 * (1 - lockStrength);
    const tick = makeTick(now, price, previous, 0.004, false);
    const walls: Wall[] = [
      { side: 'bid', offset: -0.4, strength: 0.6 + Math.max(0, sentiment) * 1.2 },
      { side: 'ask', offset: 0.4, strength: 0.6 + Math.max(0, -sentiment) * 1.2 },
    ];
    return {
      tick,
      gravityTensor: buildGravity(price, price * 0.02, walls),
      projection: buildProjection(sentiment >= 0 ? 1 : -1, 0.3 + lockStrength * 0.65, 0.5 - lockStrength * 0.3, 0.07 + lockStrength * 0.16, lockStrength > 0.5 ? 'trefoil' : 'spiral'),
      style: { strokeScale: 1 + lockStrength * 2.6, vibration: 0.25 * (1 - lockStrength), rigidity: lockStrength * 0.6, projectionStretch: lockStrength * 1.6 },
    };
  };
}

function metaSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  const components = [0, 0, 0, 0, 0];
  let index = FIELD_CONFIGS.meta.basePrice;
  return (now) => {
    for (let i = 0; i < components.length; i += 1) components[i] = components[i] * 0.97 + gauss(rand) * 0.0008;
    const composite = components.reduce((sum, value) => sum + value, 0) / components.length;
    const previous = index;
    index *= 1 + composite * 0.25 + 0.00004;
    const raw = makeTick(now, index, previous, 0.0015, false);
    // Index moves are heavy: damped and the knot angle is locked to 15 degree steps.
    const step = Math.PI / 12;
    const tick: KnotTick = {
      ...raw,
      angle: Math.round(raw.angle / step) * step,
      magicLength: raw.magicLength * 0.5,
      tension: raw.tension * 0.4,
      volatility: raw.volatility * 0.5,
    };
    const walls: Wall[] = [
      { side: 'bid', offset: -0.55, strength: 2.2 },
      { side: 'ask', offset: 0.55, strength: 2.0 + composite * 40 },
    ];
    return {
      tick,
      gravityTensor: buildGravity(index, index * 0.012, walls),
      projection: buildProjection(composite >= 0 ? 1 : -1, 0.42, 0.42, 0.05, 'spiral'),
      style: { strokeScale: 1.5, vibration: 0, rigidity: 0.95, projectionStretch: 0 },
    };
  };
}

export function createFieldSimulator(kind: FieldKind, seed = 20261020): FieldSimulator {
  switch (kind) {
    case 'metal': return metalSimulator(seed);
    case 'crypto': return cryptoSimulator(seed);
    case 'animal': return animalSimulator(seed);
    case 'meta': return metaSimulator(seed);
  }
}
