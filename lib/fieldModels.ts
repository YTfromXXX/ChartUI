import type { KnotFieldStyle, KnotFutureProjection, KnotTick } from '@/components/2d/KnotChart';
import type { TrueGravityTensor } from '@/components/2d/GravityHoneycomb';
import { findResonatingArcana, type ArcanaAttractor, type MatrixPoint, type ResonanceResult } from '@/lib/arcanaMatrix';

export type FieldKind = 'metal' | 'crypto' | 'animal' | 'meta';

export type FieldStep = {
  tick: KnotTick;
  gravityTensor: TrueGravityTensor;
  projection: KnotFutureProjection;
  style: KnotFieldStyle;
  diagnostics?: FieldDiagnostics;
};

export type FieldDiagnostics = {
  tension: number;
  angularVelocity: number;
  mass: number;
  phase: number;
  dailyStep: number;
  poissonJump: boolean;
  animalSync?: boolean;
  kuramotoOrder?: number;
  meanCorrelation?: number;
  trendAgreement?: number;
  directionalStrength?: number;
  basketReturn?: number;
  cryptoDampedDisplacement?: number;
  cryptoDampedVelocity?: number;
  cryptoFractionalNoise?: number;
  cryptoHighFrequency?: number;
  metaRelativeAssets?: MetaRelativeAssetDiagnostic[];
  metaMeanCorrelation?: number;
  metaRelativeDispersion?: number;
  matrixDistance?: number;
  resonanceArcanaId?: number;
  resonanceStrength?: number;
  matrixTension?: number;
  xauUsdPrice?: number;
  jumpIntensity?: number;
  metaMicroTremor?: number;
  usdIndex?: number;
  btcProxyPrice?: number;
  btcVolatility?: number;
  btcTension?: number;
  usdVolatility?: number;
  xauVolatility?: number;
  xauTension?: number;
};

export type MetaRelativeAssetDiagnostic = {
  symbol: string;
  assetClass: 'equity' | 'currency';
  normalizedIndex: number;
  peerRelativePercent: number;
  rollingCorrelation: number;
};

export type FieldSimulator = (now: number, anchorPrice?: number) => FieldStep;

export type RelativeAsset = {
  symbol: string;
  assetClass: 'equity' | 'currency';
  group: string;
  weight: number;
  usdDirection: 1 | -1;
};

export type RelativeAnalysisDesign = {
  baseIndex: number;
  returnWindow: number;
  correlationWindow: number;
  normalizeToBasket: true;
  comparisonBasis: 'oriented-log-return-excess';
  assets: readonly RelativeAsset[];
};

export type ButterworthCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

export type ButterworthFilter = {
  coefficients: ButterworthCoefficients;
  push(value: number): number;
  reset(value?: number): void;
};

export type MatrixPriceState = {
  value: number;
  referenceValue: number;
  volatility?: number;
  tension?: number;
  mass?: number;
};

export type MatrixPosition = MatrixPoint & {
  asset: string;
};

export type MatrixPairAnalysis = {
  asset: string;
  counterAsset: string;
  assetPosition: MatrixPosition;
  counterPosition: MatrixPosition;
  distance: number;
  midpoint: MatrixPoint;
  resonance: ResonanceResult;
};

export type CandyMatrixInvasion = {
  distance: number;
  tension: number;
  resonanceArcana: ArcanaAttractor;
  strength: number;
};

export type FieldConfig = {
  kind: FieldKind;
  symbol: string;
  title: string;
  subtitle: string;
  intervalMs: number;
  basePrice: number;
  feedLabel: string;
  physics: string[];
  relativeAnalysis?: RelativeAnalysisDesign;
};

export const ANIMAL_INITIAL_UNIVERSE = [
  { symbol: 'SOYBEAN', label: 'Soybeans', group: 'grains' },
  { symbol: 'WHEAT', label: 'Wheat', group: 'grains' },
  { symbol: 'CORN', label: 'Corn', group: 'grains' },
  { symbol: 'WTI', label: 'WTI crude oil', group: 'energy' },
  { symbol: 'NATGAS', label: 'Natural gas', group: 'energy' },
] as const;

export const ANIMAL_CORRELATION_MATRIX = [
  [1, 0.82, 0.79, 0.34, 0.21],
  [0.82, 1, 0.84, 0.31, 0.18],
  [0.79, 0.84, 1, 0.37, 0.25],
  [0.34, 0.31, 0.37, 1, 0.66],
  [0.21, 0.18, 0.25, 0.66, 1],
] as const;

const ANIMAL_ASSET_WEIGHTS = [0.22, 0.19, 0.21, 0.23, 0.15] as const;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type AnimalSyncDiagnostics = {
  orderParameter: number;
  meanCorrelation: number;
  trendAgreement: number;
  directionalStrength: number;
  alert: boolean;
};

export const META_RELATIVE_ANALYSIS: RelativeAnalysisDesign = {
  baseIndex: 100,
  returnWindow: 1,
  correlationWindow: 60,
  normalizeToBasket: true,
  comparisonBasis: 'oriented-log-return-excess',
  assets: [
    { symbol: 'SPX', assetClass: 'equity', group: 'us-equity', weight: 0.3, usdDirection: 1 },
    { symbol: 'SX5E', assetClass: 'equity', group: 'europe-equity', weight: 0.2, usdDirection: 1 },
    { symbol: 'NKY', assetClass: 'equity', group: 'asia-equity', weight: 0.2, usdDirection: 1 },
    { symbol: 'DXY', assetClass: 'currency', group: 'usd', weight: 0.15, usdDirection: 1 },
    { symbol: 'EURUSD', assetClass: 'currency', group: 'major-fx', weight: 0.075, usdDirection: -1 },
    { symbol: 'USDJPY', assetClass: 'currency', group: 'major-fx', weight: 0.075, usdDirection: 1 },
  ],
};

export const FIELD_CONFIGS: Record<FieldKind, FieldConfig> = {
  metal: {
    kind: 'metal', symbol: 'METALCRASH', title: 'METALCRASH / RARE METAL KNOT', subtitle: 'LME seconds x SMM daily', intervalMs: 1000, basePrice: 9500,
    feedLabel: 'LME 1s + SMM daily (synthetic)',
    physics: [
      'LME-like 1s layer follows an SMM-like daily Heaviside step baseline',
      'Poisson-distributed discontinuities; low-frequency sine contributes to tension',
      'Tension–angular-velocity phase plane exposes the geometric response to jumps',
    ],
  },
  crypto: {
    kind: 'crypto', symbol: 'CRYPTOCRASH', title: 'CRYPTOCRASH / 24-7 TICK KNOT', subtitle: '24/7 ticks, spoofed book', intervalMs: 120, basePrice: 65000,
    feedLabel: 'synthetic 120ms ticks (BTC-USD anchored when available)',
    physics: [
      'Hurst H=0.35 finite-memory fractional Gaussian noise drives log-price returns',
      'Damped spoof-book oscillator (ζ=0.48, f₀=1.25 Hz) models order creation/cancellation',
      'High-frequency sine/cosine injection sustains layer-by-layer knot vibration',
    ],
  },
  animal: {
    kind: 'animal', symbol: 'ANIMALCRASH', title: 'ANIMALCRASH / HERD SENTIMENT KNOT', subtitle: 'crowd swell, trend lock', intervalMs: 400, basePrice: 0.042,
    feedLabel: 'SNS sentiment swell (synthetic)',
    physics: [
      'Soybeans, wheat, corn, WTI crude, and natural gas; deterministic synthetic basket',
      'Rolling Pearson correlation + aligned trend strength feed a five-oscillator Kuramoto model',
      'Synchronization is latched with hysteresis; the golden-angle log spiral projects directional reach',
    ],
  },
  meta: {
    kind: 'meta', symbol: 'METACRASH', title: 'METACRASH / MACRO INDEX KNOT', subtitle: 'heavy composite index', intervalMs: 500, basePrice: 5200,
    feedLabel: 'equity + FX relative basket (synthetic)',
    physics: [
      'Heaviest mass: minor noise cannot bend the polyhedron; angles remain 15°-quantized',
      'Relative design: 60-sample rolling correlations on oriented log returns',
      'Equity and FX constituents are normalized to base 100, then compared against their peer baskets',
    ],
    relativeAnalysis: META_RELATIVE_ANALYSIS,
  },
};

export function calculateMatrixPosition(asset: string, priceState: MatrixPriceState): MatrixPosition {
  const value = Number.isFinite(priceState.value) && priceState.value > 0 ? priceState.value : priceState.referenceValue;
  const reference = Number.isFinite(priceState.referenceValue) && priceState.referenceValue > 0 ? priceState.referenceValue : 1;
  const logReturn = Math.log(value / reference);
  const volatility = clamp(priceState.volatility ?? 0.25, 0, 1);
  const tension = clamp(priceState.tension ?? 0.25, 0, 1);
  const mass = clamp(priceState.mass ?? 0.5, 0, 3);
  const x = clamp(Math.tanh(logReturn * 1.8), -1, 1);
  const y = clamp((volatility - 0.5) * 1.2 + (tension - 0.5) * 0.8, -1, 1);
  const z = clamp((mass - 1.5) / 1.5, -1, 1);
  return { asset, x, y, z };
}

export function analyzeMatrixPair(
  asset: string,
  assetState: MatrixPriceState,
  counterAsset: string,
  counterState: MatrixPriceState,
): MatrixPairAnalysis {
  const assetPosition = calculateMatrixPosition(asset, assetState);
  const counterPosition = calculateMatrixPosition(counterAsset, counterState);
  const midpoint = {
    x: (assetPosition.x + counterPosition.x) / 2,
    y: (assetPosition.y + counterPosition.y) / 2,
    z: ((assetPosition.z ?? 0) + (counterPosition.z ?? 0)) / 2,
  };
  const distance = Math.hypot(
    assetPosition.x - counterPosition.x,
    assetPosition.y - counterPosition.y,
    (assetPosition.z ?? 0) - (counterPosition.z ?? 0),
  );
  return {
    asset,
    counterAsset,
    assetPosition,
    counterPosition,
    distance,
    midpoint,
    resonance: findResonatingArcana(midpoint),
  };
}

export function applyMatrixInvasionToGeometry(
  field: 'metal' | 'meta',
  base: { tension: number; rigidity: number; angle: number },
  analysis: MatrixPairAnalysis,
  elapsedSeconds: number,
): { tension: number; rigidity: number; angle: number; invasionStrength: number; microTremor: number } {
  const distanceFactor = clamp((analysis.distance - 0.45) / 1.15, 0, 1);
  const resonance = analysis.resonance;
  const invasionStrength = clamp(distanceFactor * (0.35 + resonance.normalizedStrength * 0.65), 0, 1);
  const tension = clamp(base.tension + invasionStrength * (0.15 + resonance.arcana.tensionAffinity * 0.45), 0, 1);
  if (field === 'meta') {
    const microTremor = distanceFactor > 0.4
      ? Math.sin(elapsedSeconds * 19 + resonance.arcana.id) * (distanceFactor - 0.4) * 0.1
      : 0;
    return {
      tension,
      rigidity: clamp(base.rigidity - Math.abs(microTremor) * 1.4, 0.7, 1),
      angle: base.angle + microTremor,
      invasionStrength,
      microTremor,
    };
  }
  return {
    tension,
    rigidity: base.rigidity,
    angle: base.angle,
    invasionStrength,
    microTremor: 0,
  };
}

export function adaptMetalJumpIntensity(baseIntensity: number, analysis: MatrixPairAnalysis): number {
  const divergence = clamp(analysis.distance / Math.sqrt(12), 0, 1);
  const destructive = analysis.resonance.arcana.destructiveAffinity * analysis.resonance.normalizedStrength;
  return clamp(baseIntensity * (1 + divergence * 2 + destructive * 8), baseIntensity, 1.5);
}

export function samplePoissonCount(rand: () => number, ratePerSecond: number, deltaSeconds: number): number {
  if (!Number.isFinite(ratePerSecond) || ratePerSecond < 0 || !Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError('Poisson rate and elapsed time must be finite and non-negative');
  }
  const mean = ratePerSecond * deltaSeconds;
  if (mean === 0) return 0;
  const threshold = Math.exp(-mean);
  let product = 1;
  let events = 0;
  do {
    events += 1;
    product *= Math.max(Number.MIN_VALUE, rand());
  } while (product > threshold);
  return events - 1;
}

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

export function calculateKuramotoOrder(phases: readonly number[]): number {
  if (phases.length === 0 || phases.some((phase) => !Number.isFinite(phase))) return 0;
  const real = phases.reduce((sum, phase) => sum + Math.cos(phase), 0) / phases.length;
  const imaginary = phases.reduce((sum, phase) => sum + Math.sin(phase), 0) / phases.length;
  return clamp(Math.hypot(real, imaginary), 0, 1);
}

export function calculatePearsonCorrelation(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length < 2) return 0;
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / left.length;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let varianceLeft = 0;
  let varianceRight = 0;
  for (let index = 0; index < left.length; index += 1) {
    const deltaLeft = left[index] - meanLeft;
    const deltaRight = right[index] - meanRight;
    covariance += deltaLeft * deltaRight;
    varianceLeft += deltaLeft * deltaLeft;
    varianceRight += deltaRight * deltaRight;
  }
  const denominator = Math.sqrt(varianceLeft * varianceRight);
  return denominator > 1e-12 ? clamp(covariance / denominator, -1, 1) : 0;
}

export function createButterworthLowPass(cutoffHz: number, sampleRateHz: number): ButterworthFilter {
  if (!Number.isFinite(cutoffHz) || !Number.isFinite(sampleRateHz) || cutoffHz <= 0 || sampleRateHz <= 0 || cutoffHz >= sampleRateHz / 2) {
    throw new RangeError('Butterworth cutoff must be greater than zero and below the Nyquist frequency');
  }
  const omega = 2 * Math.PI * cutoffHz / sampleRateHz;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * (1 / Math.sqrt(2)));
  const a0 = 1 + alpha;
  const coefficients: ButterworthCoefficients = {
    b0: ((1 - cosine) / 2) / a0,
    b1: (1 - cosine) / a0,
    b2: ((1 - cosine) / 2) / a0,
    a1: (-2 * cosine) / a0,
    a2: (1 - alpha) / a0,
  };
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return {
    coefficients,
    push(value: number) {
      if (!Number.isFinite(value)) throw new RangeError('Butterworth input must be finite');
      const result = coefficients.b0 * value + coefficients.b1 * x1 + coefficients.b2 * x2
        - coefficients.a1 * y1 - coefficients.a2 * y2;
      if (!Number.isFinite(result)) throw new RangeError('Butterworth filter state became non-finite');
      x2 = x1;
      x1 = value;
      y2 = y1;
      y1 = result;
      return y1;
    },
    reset(value = 0) {
      if (!Number.isFinite(value)) throw new RangeError('Butterworth reset value must be finite');
      x1 = value;
      x2 = value;
      y1 = value;
      y2 = value;
    },
  };
}

export function fractionalGaussianNoise(innovations: readonly number[], hurst = 0.35, memory = 32): number[] {
  if (!Number.isFinite(hurst) || hurst <= 0 || hurst >= 1) {
    throw new RangeError('Hurst exponent must be between zero and one');
  }
  if (!Number.isInteger(memory) || memory < 1) throw new RangeError('fBm memory must be a positive integer');
  const weights = [1];
  for (let lag = 1; lag < memory; lag += 1) {
    weights.push(Math.pow(lag + 1, hurst - 0.5) - Math.pow(lag, hurst - 0.5));
  }
  const norm = Math.sqrt(weights.reduce((sum, weight) => sum + weight * weight, 0));
  return innovations.map((_, index) => {
    let value = 0;
    for (let lag = 0; lag < Math.min(memory, index + 1); lag += 1) {
      value += weights[lag] * innovations[index - lag];
    }
    return value / norm;
  });
}

export function quantizeAngleFloor(angle: number, step = Math.PI / 12): number {
  if (!Number.isFinite(angle) || !Number.isFinite(step) || step <= 0) {
    throw new RangeError('Angle and quantization step must be finite; step must be positive');
  }
  return Math.floor(angle / step) * step;
}

export function calculateAnimalCorrelationMatrix(returns: readonly (readonly number[])[]): number[][] {
  const count = ANIMAL_INITIAL_UNIVERSE.length;
  return Array.from({ length: count }, (_, left) => Array.from({ length: count }, (_, right) => {
    if (left === right) return 1;
    const observed = calculatePearsonCorrelation(returns[left] ?? [], returns[right] ?? []);
    if ((returns[left]?.length ?? 0) < 3 || (returns[right]?.length ?? 0) < 3) {
      return ANIMAL_CORRELATION_MATRIX[left][right];
    }
    return clamp(0.35 * ANIMAL_CORRELATION_MATRIX[left][right] + 0.65 * observed, -1, 1);
  }));
}

export function analyzeAnimalSynchronization(
  returns: readonly (readonly number[])[],
  phases: readonly number[],
  trendDirections: readonly number[],
  directionalStrengths: readonly number[],
  wasSynchronized = false,
): AnimalSyncDiagnostics {
  const count = Math.min(ANIMAL_INITIAL_UNIVERSE.length, returns.length, phases.length, trendDirections.length, directionalStrengths.length);
  if (count === 0) return { orderParameter: 0, meanCorrelation: 0, trendAgreement: 0, directionalStrength: 0, alert: false };

  const correlationMatrix = calculateAnimalCorrelationMatrix(returns);
  const pairCorrelations: number[] = [];
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 1; right < count; right += 1) {
      pairCorrelations.push(correlationMatrix[left][right]);
    }
  }
  const meanCorrelation = pairCorrelations.length
    ? pairCorrelations.reduce((sum, value) => sum + value, 0) / pairCorrelations.length
    : 0;
  const orderParameter = calculateKuramotoOrder(phases.slice(0, count));
  const directionSum = trendDirections.slice(0, count).reduce((sum, direction) => sum + Math.sign(direction), 0);
  const trendAgreement = Math.abs(directionSum) / count;
  const directionalStrength = directionalStrengths.slice(0, count).reduce((sum, value) => sum + clamp(value, 0, 1), 0) / count;
  const aligned = trendAgreement >= 0.8 && directionalStrength >= 0.18;
  const activationThreshold = wasSynchronized ? 0.7 : 0.82;
  const alert = aligned && meanCorrelation >= 0.55 && orderParameter >= activationThreshold;

  return { orderParameter, meanCorrelation, trendAgreement, directionalStrength, alert };
}

export function samplePoissonWaitSeconds(rand: () => number, intensityPerSecond: number): number {
  if (!(intensityPerSecond > 0) || !Number.isFinite(intensityPerSecond)) {
    throw new RangeError('Poisson intensity must be finite and greater than zero');
  }
  return -Math.log(Math.max(Number.MIN_VALUE, 1 - rand())) / intensityPerSecond;
}

export function heaviside(value: number): 0 | 1 {
  return value < 0 ? 0 : 1;
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
  const initialPrice = FIELD_CONFIGS.metal.basePrice;
  const basePoissonIntensity = 1 / 90;
  const simulatedDaySeconds = 30;
  const sinePeriodSeconds = 240;
  let smm = initialPrice;
  let lme = initialPrice;
  let xauUsd = 2650;
  let elapsedSeconds = 0;
  let previousTimestamp: number | undefined;
  let dayIndex = 0;
  let jumpFlash = 0;
  let previousAngle = 0;
  return (now) => {
    const dt = previousTimestamp === undefined ? 1 : clamp((now - previousTimestamp) / 1000, 0.001, 10);
    previousTimestamp = now;
    elapsedSeconds += dt;

    // SMM-like settlement updates only when the Heaviside day boundary advances.
    const nextDayIndex = Math.floor(elapsedSeconds / simulatedDaySeconds);
    let dailyStep = 0;
    while (dayIndex < nextDayIndex) {
      dayIndex += 1;
      const boundary = dayIndex * simulatedDaySeconds;
      if (heaviside(elapsedSeconds - boundary)) {
        const sinePhase = (2 * Math.PI * boundary) / sinePeriodSeconds;
        dailyStep = gauss(rand) * 0.003 + Math.sin(sinePhase) * 0.0015;
        smm *= Math.exp(dailyStep);
      }
    }

    const usdIndex = 100 + 2.5 * Math.sin(elapsedSeconds / 130) + 0.8 * Math.cos(elapsedSeconds / 47);
    const preEventAnalysis = analyzeMatrixPair(
      'XAU',
      { value: xauUsd, referenceValue: 2650, volatility: 0.28 + Math.abs(smm - lme) / smm * 10, tension: 0.42, mass: 1.1 },
      'USD',
      { value: usdIndex, referenceValue: 100, volatility: 0.18, tension: 0.3, mass: 2.3 },
    );
    const jumpIntensity = adaptMetalJumpIntensity(basePoissonIntensity, preEventAnalysis);
    const jumpEvents = samplePoissonCount(rand, jumpIntensity, dt);
    const jumped = jumpEvents > 0;
    for (let event = 0; event < jumpEvents; event += 1) {
      const jumpSize = (0.02 + rand() * 0.035) * (rand() < 0.5 ? -1 : 1);
      smm *= 1 + jumpSize;
      jumpFlash = Math.min(1, jumpFlash + Math.abs(jumpSize) / 0.04);
    }

    const previous = lme;
    const previousXau = xauUsd;
    const lowFrequencyPhase = (2 * Math.PI * elapsedSeconds) / sinePeriodSeconds;
    const lowFrequencyWave = Math.sin(lowFrequencyPhase);
    const meanReversion = (smm - lme) * (1 - Math.exp(-0.08 * dt));
    const highFrequencyNoise = gauss(rand) * smm * 0.00045 * Math.sqrt(dt);
    lme = Math.max(smm * 0.05, lme + meanReversion + highFrequencyNoise);
    const lmeReturn = Math.log(lme / previous);
    xauUsd = Math.max(100, xauUsd * Math.exp(lmeReturn * 0.32 + gauss(rand) * 0.00012 * Math.sqrt(dt)));
    const goldReturn = Math.log(xauUsd / previousXau);

    const basis = (smm - lme) / smm;
    const baseTension = clamp(0.42 + 0.22 * lowFrequencyWave + Math.abs(basis) * 8 + jumpFlash * 0.3, 0, 1);
    const relativeVelocity = Math.log(lme / previous) / dt;
    const angle = Math.atan2(relativeVelocity * 120, 0.25 + Math.cos(lowFrequencyPhase));
    let angleDelta = angle - previousAngle;
    if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
    if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
    const angularVelocity = angleDelta / dt;
    previousAngle = angle;
    const matrixAnalysis = analyzeMatrixPair(
      'XAU',
      { value: xauUsd, referenceValue: 2650, volatility: clamp(Math.abs(goldReturn) * 80, 0, 1), tension: baseTension, mass: 1.1 },
      'USD',
      { value: usdIndex, referenceValue: 100, volatility: 0.18, tension: 0.3, mass: 2.3 },
    );
    const invasion = applyMatrixInvasionToGeometry(
      'metal',
      { tension: baseTension, rigidity: 0.2, angle },
      matrixAnalysis,
      elapsedSeconds,
    );
    const tension = invasion.tension;
    const tick: KnotTick = {
      ...makeTick(now, lme, previous, 0.003, jumped),
      angle: invasion.angle,
      tension,
      volatility: clamp(Math.abs(relativeVelocity) * 120, 0, 1),
      magicLength: clamp(Math.abs(angularVelocity) * 0.2, 0.1, 3),
    };

    const walls: Wall[] = [
      { side: 'bid', offset: -0.5 + basis * 20, strength: 0.7 + jumpFlash },
      { side: 'ask', offset: 0.45 + basis * 20, strength: 0.6 + jumpFlash * (basis > 0 ? 0.2 : 1) },
    ];
    const diagnostics: FieldDiagnostics = {
      tension,
      angularVelocity,
      mass: clamp(0.8 + Math.abs(basis) * 12 + jumpFlash * 0.6, 0, 3),
      phase: lowFrequencyPhase % (2 * Math.PI),
      dailyStep,
      poissonJump: jumped,
      matrixDistance: matrixAnalysis.distance,
      resonanceArcanaId: matrixAnalysis.resonance.arcana.id,
      resonanceStrength: matrixAnalysis.resonance.normalizedStrength,
      matrixTension: invasion.tension,
      xauUsdPrice: xauUsd,
      jumpIntensity,
      usdIndex,
      xauVolatility: clamp(Math.abs(goldReturn) * 80, 0, 1),
      xauTension: baseTension,
    };
    jumpFlash *= Math.exp(-dt / 8);

    return {
      tick,
      gravityTensor: buildGravity(lme, lme * 0.01, walls),
      projection: buildProjection(Math.sign(smm - lme) || 1, 0.45 + jumpFlash * 0.45, 0.35, 0.07 + jumpFlash * 0.05, jumpFlash > 0.4 ? 'trefoil' : 'spiral'),
      style: {
        strokeScale: 1 + jumpFlash * 0.6,
        vibration: 0.15 + invasion.invasionStrength * 0.2,
        rigidity: invasion.rigidity,
        projectionStretch: jumpFlash * 0.5,
        invasionStrength: invasion.invasionStrength,
        candySpinModifier: 1 + matrixAnalysis.distance * 0.2,
        matrixDistance: matrixAnalysis.distance,
        resonanceArcanaId: matrixAnalysis.resonance.arcana.id,
      },
      diagnostics,
    };
  };
}

function cryptoSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  let price = FIELD_CONFIGS.crypto.basePrice;
  let frame = 0;
  const innovations: number[] = [];
  let oscillatorDisplacement = 0;
  let oscillatorVelocity = 0;
  let previousTimestamp: number | undefined;
  return (now, anchor) => {
    frame += 1;
    const dt = previousTimestamp === undefined
      ? FIELD_CONFIGS.crypto.intervalMs / 1000
      : clamp((now - previousTimestamp) / 1000, 0.04, 0.5);
    previousTimestamp = now;
    const previous = price;
    const innovation = gauss(rand);
    innovations.push(innovation);
    if (innovations.length > 32) innovations.shift();
    const fractionalNoise = fractionalGaussianNoise(innovations, 0.35, 32).at(-1) ?? innovation;
    const highFrequency = Math.sin(frame * 2.17) + 0.65 * Math.cos(frame * 1.43);
    const anchorDrift = anchor && Number.isFinite(anchor) && anchor > 0
      ? clamp(Math.log(anchor / price) * 0.035, -0.002, 0.002)
      : 0;

    // Spoof order creation/cancellation is a damped oscillator, not white-noise walls.
    const naturalFrequency = 2 * Math.PI * 1.25;
    const dampingRatio = 0.48;
    const impulse = rand() < 0.16 ? (rand() < 0.5 ? -1 : 1) * (0.7 + rand() * 1.3) : 0;
    const oscillatorAcceleration = impulse
      - 2 * dampingRatio * naturalFrequency * oscillatorVelocity
      - naturalFrequency * naturalFrequency * oscillatorDisplacement;
    oscillatorVelocity = clamp(oscillatorVelocity + oscillatorAcceleration * dt, -5, 5);
    oscillatorDisplacement = clamp(oscillatorDisplacement + oscillatorVelocity * dt, -1.5, 1.5);

    const logReturn = clamp(
      anchorDrift
        + fractionalNoise * 0.00019 * Math.sqrt(dt / 0.12)
        + highFrequency * 0.000035
        + oscillatorDisplacement * 0.000035,
      -0.015,
      0.015,
    );
    price = Math.max(1, price * Math.exp(logReturn));

    const tick = {
      ...makeTick(now, price, previous, 0.00075, false),
      angle: Math.atan2(logReturn * 750, 0.4 + Math.cos(frame * 1.43)),
      volatility: clamp(Math.abs(logReturn) * 450, 0, 1),
      tension: clamp(0.18 + Math.abs(fractionalNoise) * 0.1 + Math.abs(highFrequency) * 0.16 + Math.abs(oscillatorDisplacement) * 0.2, 0, 1),
      magicLength: clamp(0.2 + Math.abs(oscillatorVelocity) * 0.08 + Math.abs(fractionalNoise) * 0.2, 0.1, 3),
    };

    // Order creation and cancellation exchange dominance as the oscillator changes phase.
    const walls: Wall[] = Array.from({ length: 4 }, (_, index) => ({
      side: index % 2 === 0 ? 'bid' : 'ask',
      offset: (index % 2 === 0 ? -1 : 1) * (0.2 + Math.abs(oscillatorDisplacement) * 0.35 + index * 0.12),
      strength: clamp(
        0.35
          + (index % 2 === (oscillatorDisplacement >= 0 ? 0 : 1) ? 1.2 : 0.2)
          + Math.max(0, oscillatorVelocity * (index % 2 === 0 ? 1 : -1)) * 0.35,
        0.12,
        3.5,
      ),
    }));
    const net = walls.reduce((sum, wall) => sum + (wall.side === 'bid' ? 1 : -1) * wall.strength, 0);
    const diagnostics: FieldDiagnostics = {
      tension: tick.tension,
      angularVelocity: logReturn / dt,
      mass: clamp(0.8 + Math.abs(net) * 0.24, 0, 3),
      phase: Math.atan2(oscillatorVelocity, oscillatorDisplacement || 1e-9),
      dailyStep: 0,
      poissonJump: false,
      cryptoDampedDisplacement: oscillatorDisplacement,
      cryptoDampedVelocity: oscillatorVelocity,
      cryptoFractionalNoise: fractionalNoise,
      cryptoHighFrequency: highFrequency,
    };
    return {
      tick,
      gravityTensor: buildGravity(price, price * 0.006, walls),
      projection: buildProjection(net >= 0 ? 1 : -1, 0.58 + Math.min(0.38, Math.abs(net) * 0.04), 0.3 + Math.abs(oscillatorDisplacement) * 0.12, 0.09, oscillatorDisplacement > 0.35 ? 'figure_eight' : 'trefoil'),
      style: { strokeScale: 0.9, vibration: 1.15 + Math.abs(oscillatorVelocity) * 0.1 + Math.abs(highFrequency) * 0.15, rigidity: 0, projectionStretch: 0.1 },
      diagnostics,
    };
  };
}

function animalSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  const count = ANIMAL_INITIAL_UNIVERSE.length;
  const prices = ANIMAL_INITIAL_UNIVERSE.map(() => FIELD_CONFIGS.animal.basePrice);
  const phases = ANIMAL_INITIAL_UNIVERSE.map((_, index) => index * 0.72);
  const frequencies = ANIMAL_INITIAL_UNIVERSE.map(() => (rand() - 0.5) * 0.12);
  const returnHistory: number[][] = ANIMAL_INITIAL_UNIVERSE.map(() => []);
  const trendHistory: number[][] = ANIMAL_INITIAL_UNIVERSE.map(() => []);
  let synchronized = false;
  let previousBasket = FIELD_CONFIGS.animal.basePrice;
  let previousAngle = 0;
  let previousTimestamp: number | undefined;
  return (now) => {
    const dt = previousTimestamp === undefined ? FIELD_CONFIGS.animal.intervalMs / 1000 : clamp((now - previousTimestamp) / 1000, 0.05, 3);
    previousTimestamp = now;
    const sentiment = clamp(0.68 * Math.sin(now / 11500) + 0.32 * Math.sin(now / 37000 + 1.3), -1, 1);
    const commonGrain = gauss(rand) * 0.00055 + sentiment * 0.00035;
    const commonEnergy = gauss(rand) * 0.00065 + sentiment * 0.00025;
    const innovations = [
      0.84 * commonGrain + 0.16 * commonEnergy + gauss(rand) * 0.00024,
      0.88 * commonGrain + gauss(rand) * 0.00022,
      0.86 * commonGrain + 0.12 * commonEnergy + gauss(rand) * 0.0002,
      0.76 * commonEnergy + 0.08 * commonGrain + gauss(rand) * 0.00028,
      0.72 * commonEnergy + gauss(rand) * 0.00034,
    ];
    const basketWeight = ANIMAL_ASSET_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

    for (let index = 0; index < count; index += 1) {
      const returnValue = innovations[index] + sentiment * (index < 3 ? 0.00028 : 0.0002);
      prices[index] *= Math.exp(returnValue);
      returnHistory[index].push(returnValue);
      if (returnHistory[index].length > 48) returnHistory[index].shift();
      trendHistory[index].push(returnValue);
      if (trendHistory[index].length > 20) trendHistory[index].shift();

      const targetFrequency = Math.sign(returnValue) * Math.min(1, Math.abs(returnValue) / 0.0005) * 0.42;
      frequencies[index] += (targetFrequency - frequencies[index]) * Math.min(1, dt * 0.8);
    }

    const coupling = 0.9;
    const dynamicCorrelationMatrix = calculateAnimalCorrelationMatrix(returnHistory);
    const phaseVelocities = phases.map((phase, index) => {
      const interaction = phases.reduce((sum, otherPhase, otherIndex) => {
        if (index === otherIndex) return sum;
        return sum + dynamicCorrelationMatrix[index][otherIndex] * Math.sin(otherPhase - phase);
      }, 0) / (count - 1);
      return frequencies[index] + coupling * interaction;
    });
    for (let index = 0; index < count; index += 1) {
      phases[index] = (phases[index] + phaseVelocities[index] * dt + 2 * Math.PI) % (2 * Math.PI);
    }

    const trendDirections = trendHistory.map((history) => Math.sign(history.reduce((sum, value) => sum + value, 0)));
    const directionalStrengths = trendHistory.map((history) => {
      const magnitude = history.reduce((sum, value) => sum + Math.abs(value), 0);
      return magnitude > 1e-12 ? Math.abs(history.reduce((sum, value) => sum + value, 0)) / magnitude : 0;
    });
    const sync = analyzeAnimalSynchronization(
      returnHistory,
      phases,
      trendDirections,
      directionalStrengths,
      synchronized,
    );
    synchronized = sync.alert;
    const alignment = trendDirections.reduce((sum, direction) => sum + direction, 0);
    const direction = Math.sign(alignment) || Math.sign(sentiment) || 1;
    const syncStrength = clamp((sync.orderParameter - 0.48) / 0.52, 0, 1)
      * clamp((sync.meanCorrelation + 0.2) / 0.9, 0, 1)
      * sync.trendAgreement
      * (0.45 + sync.directionalStrength * 0.55);
    const weightedLogPrice = prices.reduce((sum, value, index) => sum + Math.log(value / FIELD_CONFIGS.animal.basePrice) * ANIMAL_ASSET_WEIGHTS[index], 0) / basketWeight;
    const price = FIELD_CONFIGS.animal.basePrice * Math.exp(weightedLogPrice);
    const relativeMove = Math.log(price / previousBasket);
    const angularVelocityRaw = phaseVelocities.reduce((sum, value, index) => sum + value * ANIMAL_ASSET_WEIGHTS[index], 0) / basketWeight;
    const angle = Math.atan2(direction * Math.abs(angularVelocityRaw) * 5 + relativeMove * 80, 0.25 + sync.orderParameter);
    const tick = {
      ...makeTick(now, price, previousBasket, 0.003, false),
      angle,
      volatility: clamp(Math.abs(relativeMove) * 160, 0, 1),
      tension: clamp(0.24 + syncStrength * 0.76 + Math.abs(sentiment) * 0.08, 0, 1),
      magicLength: clamp(0.25 + syncStrength * 2.5, 0.1, 3),
    };
    let angleDelta = angle - previousAngle;
    if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
    if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
    const angularVelocity = angleDelta / dt;
    previousAngle = angle;
    previousBasket = price;

    const walls: Wall[] = [
      { side: 'bid', offset: -0.4, strength: 0.55 + Math.max(0, direction) * syncStrength * 1.8 },
      { side: 'ask', offset: 0.4, strength: 0.55 + Math.max(0, -direction) * syncStrength * 1.8 },
    ];
    const logSpiralReach = 0.035 + syncStrength * 0.17;
    const coordinates = Array.from({ length: 8 }, (_, index) => {
      const theta = index * GOLDEN_ANGLE;
      const radius = 0.018 * Math.exp(0.22 * index) * (0.35 + syncStrength);
      return {
        x: clamp(0.5 + Math.cos(theta) * radius, 0.05, 0.95),
        y: clamp(0.5 - direction * logSpiralReach * (Math.exp(index * 0.12) - 1) / (Math.exp(7 * 0.12) - 1), 0, 1),
        z: clamp(0.5 + Math.sin(theta) * radius, 0.05, 0.95),
      };
    });
    const diagnostics: FieldDiagnostics = {
      tension: tick.tension,
      angularVelocity,
      mass: clamp(0.6 + syncStrength * 2.4, 0, 3),
      phase: Math.atan2(
        phases.reduce((sum, value) => sum + Math.sin(value), 0),
        phases.reduce((sum, value) => sum + Math.cos(value), 0),
      ),
      dailyStep: 0,
      poissonJump: false,
      animalSync: sync.alert,
      kuramotoOrder: sync.orderParameter,
      meanCorrelation: sync.meanCorrelation,
      trendAgreement: sync.trendAgreement,
      directionalStrength: sync.directionalStrength,
    };

    return {
      tick,
      gravityTensor: buildGravity(price, price * 0.02, walls),
      projection: {
        vertical_pressure: clamp(0.3 + syncStrength * 0.68, 0, 1),
        horizontal_pressure: clamp(0.54 - syncStrength * 0.34, 0, 1),
        topology: sync.alert ? 'golden_log_spiral' : 'spiral',
        topology_label: sync.alert ? 'KURAMOTO SYNC' : 'ECOSYSTEM FLOW',
        coordinates,
      },
      style: {
        strokeScale: 1 + syncStrength * 2.6,
        vibration: 0.25 * (1 - syncStrength),
        rigidity: syncStrength * 0.72,
        projectionStretch: logSpiralReach * 6,
        syncAlert: sync.alert,
        syncStrength,
      },
      diagnostics,
    };
  };
}

function metaSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  const design = META_RELATIVE_ANALYSIS;
  const count = design.assets.length;
  const levels = design.assets.map(() => design.baseIndex);
  const orientedReturnHistories: number[][] = design.assets.map(() => []);
  const filter = createButterworthLowPass(0.08, 2);
  let index = FIELD_CONFIGS.meta.basePrice;
  let previousFilteredIndex = index;
  let quantizedAngle = -Math.PI / 2;
  let syntheticBtcPrice = 65000;
  filter.reset(index);

  return (now, btcAnchor) => {
    const commonEquity = gauss(rand) * 0.00042 + 0.000025;
    const commonUsd = gauss(rand) * 0.00024;
    const commonGlobal = gauss(rand) * 0.00017;
    const usdIndex = clamp(100 * Math.exp(commonUsd), 80, 120);
    syntheticBtcPrice *= Math.exp(commonGlobal + gauss(rand) * 0.00045);
    if (btcAnchor && Number.isFinite(btcAnchor) && btcAnchor > 0) {
      syntheticBtcPrice += (btcAnchor - syntheticBtcPrice) * 0.2;
    }
    const orientedReturns = design.assets.map((asset, assetIndex) => {
      const equityExposure = asset.assetClass === 'equity' ? 1 : 0.12;
      const currencyExposure = asset.group === 'usd' ? 1 : asset.assetClass === 'currency' ? 0.45 : 0.08;
      const independent = gauss(rand) * (asset.assetClass === 'equity' ? 0.00027 : 0.0002);
      const oriented = commonEquity * equityExposure
        + commonGlobal * (0.3 + assetIndex * 0.04)
        + commonUsd * currencyExposure
        + independent;
      const rawReturn = oriented / asset.usdDirection;
      levels[assetIndex] = Math.max(1, levels[assetIndex] * Math.exp(rawReturn));
      orientedReturnHistories[assetIndex].push(oriented);
      if (orientedReturnHistories[assetIndex].length > design.correlationWindow) orientedReturnHistories[assetIndex].shift();
      return oriented;
    });

    const basketReturn = design.assets.reduce((sum, asset, assetIndex) => sum + orientedReturns[assetIndex] * asset.weight, 0);
    const rawPrevious = index;
    index = Math.max(1, index * Math.exp(basketReturn));
    const filteredIndex = filter.push(index);
    const filteredReturn = Math.log(filteredIndex / previousFilteredIndex);
    previousFilteredIndex = filteredIndex;

    const correlations = Array.from({ length: count }, (_, left) => Array.from({ length: count }, (_, right) => (
      left === right ? 1 : calculatePearsonCorrelation(orientedReturnHistories[left], orientedReturnHistories[right])
    )));
    const relativeAssets = design.assets.map((asset, assetIndex) => {
      const peerWeight = design.assets.reduce((sum, peer, peerIndex) => peerIndex === assetIndex ? sum : sum + peer.weight, 0);
      const peerReturn = design.assets.reduce((sum, peer, peerIndex) => (
        peerIndex === assetIndex ? sum : sum + orientedReturns[peerIndex] * peer.weight
      ), 0) / peerWeight;
      const orientedLevel = design.baseIndex * Math.exp(Math.log(levels[assetIndex] / design.baseIndex) * asset.usdDirection);
      const peerRelativePercent = (orientedReturns[assetIndex] - peerReturn) * 100;
      const peerAverageCorrelation = correlations[assetIndex].reduce((sum, value, peerIndex) => peerIndex === assetIndex ? sum : sum + value, 0) / Math.max(1, count - 1);
      return {
        symbol: asset.symbol,
        assetClass: asset.assetClass,
        normalizedIndex: orientedLevel,
        peerRelativePercent,
        rollingCorrelation: peerAverageCorrelation,
      };
    });
    const pairCorrelations = correlations.flatMap((row, left) => row.slice(left + 1));
    const meanCorrelation = pairCorrelations.length ? pairCorrelations.reduce((sum, value) => sum + value, 0) / pairCorrelations.length : 0;
    const relativeDispersion = Math.sqrt(relativeAssets.reduce((sum, asset) => sum + asset.peerRelativePercent ** 2, 0) / count);

    const rawAngle = Math.atan2(filteredReturn * 1600, 0.35 + relativeDispersion * 0.08);
    const floorAngle = quantizeAngleFloor(rawAngle);
    if (floorAngle !== quantizedAngle) quantizedAngle = floorAngle;
    const matrixAnalysis = analyzeMatrixPair(
      'BTC',
      { value: syntheticBtcPrice, referenceValue: 65000, volatility: clamp(Math.abs(commonGlobal) * 500, 0, 1), tension: 0.28 + relativeDispersion * 0.04, mass: 0.95 },
      'USD',
      { value: usdIndex, referenceValue: 100, volatility: Math.abs(commonUsd) * 400, tension: 0.36, mass: 2.5 },
    );
    const invasion = applyMatrixInvasionToGeometry(
      'meta',
      { tension: 0.28 + relativeDispersion * 0.04, rigidity: 0.95, angle: quantizedAngle },
      matrixAnalysis,
      now / 1000,
    );
    const tick: KnotTick = {
      ...makeTick(now, filteredIndex, rawPrevious, 0.0015, false),
      angle: invasion.angle,
      magicLength: clamp(0.3 + relativeDispersion * 0.16, 0.3, 1.2),
      tension: clamp(Math.abs(filteredReturn) * 180 + relativeDispersion * 0.08 + invasion.invasionStrength * 0.12, 0.04, 0.7),
      volatility: clamp(Math.abs(filteredReturn) * 120, 0, 0.45),
    };
    const walls: Wall[] = [
      { side: 'bid', offset: -0.55, strength: 2.2 },
      { side: 'ask', offset: 0.55, strength: 2.0 + clamp(relativeDispersion, 0, 1) * 0.8 },
    ];
    const diagnostics: FieldDiagnostics = {
      tension: tick.tension,
      angularVelocity: filteredReturn / (FIELD_CONFIGS.meta.intervalMs / 1000),
      mass: clamp(2.5 + relativeDispersion * 0.25 + invasion.invasionStrength * 0.15, 0, 3),
      phase: invasion.angle,
      dailyStep: 0,
      poissonJump: false,
      basketReturn,
      metaRelativeAssets: relativeAssets,
      metaMeanCorrelation: meanCorrelation,
      metaRelativeDispersion: relativeDispersion,
      matrixDistance: matrixAnalysis.distance,
      resonanceArcanaId: matrixAnalysis.resonance.arcana.id,
      resonanceStrength: matrixAnalysis.resonance.normalizedStrength,
      matrixTension: invasion.tension,
      metaMicroTremor: invasion.microTremor,
      usdIndex,
      btcProxyPrice: syntheticBtcPrice,
      btcVolatility: clamp(Math.abs(commonGlobal) * 500, 0, 1),
      btcTension: 0.28 + relativeDispersion * 0.04,
      usdVolatility: Math.abs(commonUsd) * 400,
    };
    return {
      tick,
      gravityTensor: buildGravity(filteredIndex, filteredIndex * 0.012, walls),
      projection: buildProjection(Math.sign(filteredReturn) || 1, 0.32 + tick.tension * 0.3, 0.42, 0.05, 'spiral'),
      style: {
        strokeScale: 1.5,
        vibration: Math.abs(invasion.microTremor) * 18,
        rigidity: invasion.rigidity,
        projectionStretch: 0,
        invasionStrength: invasion.invasionStrength,
        candySpinModifier: 1 + invasion.invasionStrength * 0.15,
        matrixDistance: matrixAnalysis.distance,
        resonanceArcanaId: matrixAnalysis.resonance.arcana.id,
      },
      diagnostics,
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
