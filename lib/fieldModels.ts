import type { KnotFieldStyle, KnotFutureProjection, KnotTick } from '@/components/2d/KnotChart';
import type { TrueGravityTensor } from '@/components/2d/GravityHoneycomb';
import { ARCANA_ATTRACTORS, findResonatingArcana, type ArcanaAttractor, type MatrixPoint, type ResonanceResult } from '@/lib/arcanaMatrix';
import {
  calculateSyntheticIndex,
  createSyntheticMarketDataContract,
  SYNTHETIC_INDEX_DEFINITIONS,
  type MarketDataContract,
} from '@/lib/marketCatalog';

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
  kuramotoMeanPhase?: number;
  animalPhases?: number[];
  animalRsis?: number[];
  animalRsiSpread?: number;
  animalCorrelationMatrix?: number[][];
  animalAttractorArcanaId?: number;
  animalAttractorDistance?: number;
  animalAttractorStrength?: number;
  animalCentroid?: MatrixPoint;
  animalBraidTension?: number;
  animalSynapseStrength?: number;
  meanCorrelation?: number;
  trendAgreement?: number;
  directionalStrength?: number;
  basketReturn?: number;
  cryptoDampedDisplacement?: number;
  cryptoDampedVelocity?: number;
  cryptoFractionalNoise?: number;
  cryptoHighFrequency?: number;
  cryptoHurstExponent?: number;
  cryptoNoiseAmplitude?: number;
  cryptoPairCreation?: boolean;
  cryptoResonanceArcanaId?: number;
  cryptoResonanceDistance?: number;
  cryptoResonanceStrength?: number;
  cryptoResonancePoint?: MatrixPoint;
  cryptoPointCloudBounds?: CryptoPointCloudBounds;
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
  metaPulsarMass?: number;
  metaQuantizedAngle?: number;
  metaQuantizedStep?: boolean;
  metaQuantizedStepIndex?: number;
  metaPhaseShift?: boolean;
  metaXauUsdDistance?: number;
  metaCrackIntensity?: number;
  metaRippleStrength?: number;
  metaRippleTimestamp?: number;
  metaPreviousArcanaId?: number;
  metaTargetArcanaId?: number;
  usdIndex?: number;
  btcProxyPrice?: number;
  btcVolatility?: number;
  btcTension?: number;
  usdVolatility?: number;
  xauVolatility?: number;
  xauTension?: number;
  resonanceForcedJump?: boolean;
  resonanceTargetArcanaId?: number;
  resonanceTargetDistance?: number;
  dataContract?: MarketDataContract;
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

export type HystereticQuantization = {
  angle: number;
  stepIndex: number;
  changed: boolean;
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

export type MetalResonanceCheck = {
  shouldForceJump: boolean;
  arcana: ArcanaAttractor;
  distance: number;
  threshold: number;
};

const METAL_DESTRUCTIVE_ATTRACTORS = ARCANA_ATTRACTORS.filter((arcana) => arcana.id === 13 || arcana.id === 16);
const ANIMAL_SYNC_ATTRACTORS = ARCANA_ATTRACTORS.filter((arcana) => arcana.id === 10 || arcana.id === 21);
const CRYPTO_RESONANCE_ATTRACTORS = ARCANA_ATTRACTORS.filter((arcana) => arcana.id === 1 || arcana.id === 18);

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

const ANIMAL_INDEX_DEFINITION = SYNTHETIC_INDEX_DEFINITIONS.ANIMAL_BASKET;
const META_INDEX_DEFINITION = SYNTHETIC_INDEX_DEFINITIONS.META_RELATIVE_BASKET;
const ANIMAL_ASSET_WEIGHTS = ANIMAL_INDEX_DEFINITION.constituents.map((constituent) => constituent.weight);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type AnimalSyncDiagnostics = {
  orderParameter: number;
  meanPhase: number;
  meanCorrelation: number;
  trendAgreement: number;
  directionalStrength: number;
  alert: boolean;
  phases: number[];
  correlationMatrix: number[][];
};

export type AnimalKuramotoDiagnostics = {
  orderParameter: number;
  meanPhase: number;
  phases: number[];
  correlationMatrix: number[][];
};

export type CryptoPointCloudBounds = {
  min: MatrixPoint;
  max: MatrixPoint;
};

export type QuantumFluctuation = {
  hurstExponent: number;
  fractionalNoise: number;
  highFrequency: number;
  oscillatorDisplacement: number;
  oscillatorVelocity: number;
  amplitude: number;
};

export type CryptoResonance = {
  active: boolean;
  arcana: ArcanaAttractor;
  distance: number;
  strength: number;
  point: MatrixPoint;
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

export function checkMetalResonance(
  analysis: MatrixPairAnalysis,
  threshold = 0.28,
): MetalResonanceCheck {
  let closest = METAL_DESTRUCTIVE_ATTRACTORS[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const attractor of METAL_DESTRUCTIVE_ATTRACTORS) {
    const current = Math.hypot(
      analysis.midpoint.x - attractor.x,
      analysis.midpoint.y - attractor.y,
      (analysis.midpoint.z ?? 0) - attractor.z,
    );
    if (current < distance) {
      closest = attractor;
      distance = current;
    }
  }
  return {
    shouldForceJump: distance <= threshold,
    arcana: closest,
    distance,
    threshold,
  };
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

export function calculateQuantumFluctuation(
  innovations: readonly number[],
  timeSeconds: number,
  oscillatorDisplacement: number,
  oscillatorVelocity: number,
  hurstExponent = 0.35,
): QuantumFluctuation {
  if (!Number.isFinite(timeSeconds) || !Number.isFinite(oscillatorDisplacement)
    || !Number.isFinite(oscillatorVelocity) || !Number.isFinite(hurstExponent)
    || hurstExponent <= 0 || hurstExponent >= 0.5) {
    throw new RangeError('Quantum fluctuation requires finite inputs and a Hurst exponent in (0, 0.5)');
  }
  const fractionalNoise = fractionalGaussianNoise(innovations, hurstExponent, 32).at(-1) ?? 0;
  const highFrequency = Math.sin(timeSeconds * 2.17) + 0.65 * Math.cos(timeSeconds * 1.43);
  const amplitude = Math.min(4, Math.hypot(
    fractionalNoise,
    highFrequency * 0.55,
    oscillatorDisplacement * 0.35,
    oscillatorVelocity * 0.08,
  ));
  return {
    hurstExponent,
    fractionalNoise,
    highFrequency,
    oscillatorDisplacement,
    oscillatorVelocity,
    amplitude: Number.isFinite(amplitude) ? amplitude : 0,
  };
}

export function checkCryptoResonance(
  amplitude: number,
  highFrequency: number,
  phase: number,
  threshold = 1.15,
): CryptoResonance {
  if (![amplitude, highFrequency, phase, threshold].every(Number.isFinite) || amplitude < 0 || threshold <= 0) {
    throw new RangeError('Crypto resonance inputs must be finite and the threshold must be positive');
  }
  const volatilityCoordinate: MatrixPoint = {
    x: clamp(Math.tanh(highFrequency * 0.55), -1, 1),
    y: clamp(Math.tanh(amplitude * 0.7 - 0.4), -1, 1),
    z: clamp(Math.sin(phase) * 0.35, -0.35, 0.35),
  };
  let arcana = CRYPTO_RESONANCE_ATTRACTORS[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const target of CRYPTO_RESONANCE_ATTRACTORS) {
    const candidateDistance = Math.hypot(
      volatilityCoordinate.x - target.x,
      volatilityCoordinate.y - target.y,
      (volatilityCoordinate.z ?? 0) - target.z,
    );
    if (candidateDistance < distance) {
      arcana = target;
      distance = candidateDistance;
    }
  }
  const active = amplitude >= threshold;
  const strength = active ? 0.25 + 0.75 * clamp((amplitude - threshold) / 0.9, 0, 1) : 0;
  return {
    active,
    arcana,
    distance,
    strength,
    point: volatilityCoordinate,
  };
}

export function createCryptoPointCloudBounds(amplitude: number, resonanceStrength: number): CryptoPointCloudBounds {
  if (![amplitude, resonanceStrength].every(Number.isFinite) || amplitude < 0) {
    throw new RangeError('Point cloud bounds require finite non-negative amplitude and finite resonance');
  }
  const radius = clamp(0.62 + amplitude * 0.08 + resonanceStrength * 0.18, 0.62, 1.25);
  return {
    min: { x: -radius, y: -radius * 0.82, z: -radius },
    max: { x: radius, y: radius * 0.82, z: radius },
  };
}

export function quantizeAngleFloor(angle: number, step = Math.PI / 12): number {
  if (!Number.isFinite(angle) || !Number.isFinite(step) || step <= 0) {
    throw new RangeError('Angle and quantization step must be finite; step must be positive');
  }
  return Math.floor(angle / step) * step;
}

export function calculatePulsarMass(
  filteredIndex: number,
  referenceIndex: number,
  relativeDispersion: number,
  meanCorrelation: number,
): number {
  if (![filteredIndex, referenceIndex, relativeDispersion, meanCorrelation].every(Number.isFinite)
    || filteredIndex <= 0 || referenceIndex <= 0 || relativeDispersion < 0) {
    throw new RangeError('Pulsar mass requires positive index levels and finite, non-negative dispersion');
  }
  const indexStability = Math.exp(-Math.abs(Math.log(filteredIndex / referenceIndex)) * 3);
  const coherence = clamp((meanCorrelation + 1) / 2, 0, 1);
  const structuralWeight = clamp(relativeDispersion / 2, 0, 1);
  return clamp(1.8 + indexStability * 0.72 + coherence * 0.34 + structuralWeight * 0.14, 0, 3);
}

export function quantizeAngleWithHysteresis(
  angle: number,
  previousStepIndex: number,
  step = Math.PI / 12,
  hysteresis = step / 12,
): HystereticQuantization {
  if (![angle, previousStepIndex, step, hysteresis].every(Number.isFinite)
    || !Number.isInteger(previousStepIndex) || step <= 0 || hysteresis < 0 || hysteresis >= step / 2) {
    throw new RangeError('Angle quantization requires finite inputs, an integer prior step, and valid hysteresis');
  }
  let stepIndex = previousStepIndex;
  const desiredStep = Math.floor(angle / step);
  if (stepIndex < desiredStep && angle >= (stepIndex + 1) * step + hysteresis) stepIndex += 1;
  else if (stepIndex > desiredStep && angle < stepIndex * step - hysteresis) stepIndex -= 1;
  return { angle: stepIndex * step, stepIndex, changed: stepIndex !== previousStepIndex };
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

export function calculateKuramotoSynchronization(priceVectors: readonly (readonly number[])[]): AnimalKuramotoDiagnostics {
  const returnVectors = priceVectors.map((prices) => {
    const returns: number[] = [];
    for (let index = 1; index < prices.length; index += 1) {
      const previous = prices[index - 1];
      const current = prices[index];
      if (Number.isFinite(previous) && previous > 0 && Number.isFinite(current) && current > 0) {
        returns.push(Math.log(current / previous));
      }
    }
    return returns.slice(-48);
  });
  const phases = returnVectors.map((returns) => {
    if (returns.length < 2) return 0;
    const current = returns.at(-1) ?? 0;
    const previous = returns.at(-2) ?? 0;
    return Math.atan2(current, previous);
  });
  const real = phases.length ? phases.reduce((sum, phase) => sum + Math.cos(phase), 0) / phases.length : 0;
  const imaginary = phases.length ? phases.reduce((sum, phase) => sum + Math.sin(phase), 0) / phases.length : 0;
  const hasMotion = returnVectors.some((returns) => returns.slice(-2).some((value) => Math.abs(value) > 1e-12));
  const hasEnoughHistory = returnVectors.length >= ANIMAL_INITIAL_UNIVERSE.length
    && returnVectors.every((returns) => returns.length >= 2);
  return {
    orderParameter: hasMotion && hasEnoughHistory ? clamp(Math.hypot(real, imaginary), 0, 1) : 0,
    meanPhase: hasMotion && hasEnoughHistory ? Math.atan2(imaginary, real) : 0,
    phases,
    correlationMatrix: calculateAnimalCorrelationMatrix(returnVectors),
  };
}

export function analyzeAnimalSynchronization(
  returns: readonly (readonly number[])[],
  phases: readonly number[],
  trendDirections: readonly number[],
  directionalStrengths: readonly number[],
  wasSynchronized = false,
  priceVectors?: readonly (readonly number[])[],
): AnimalSyncDiagnostics {
  const count = Math.min(ANIMAL_INITIAL_UNIVERSE.length, returns.length, phases.length, trendDirections.length, directionalStrengths.length);
  if (count === 0) return {
    orderParameter: 0,
    meanPhase: 0,
    meanCorrelation: 0,
    trendAgreement: 0,
    directionalStrength: 0,
    alert: false,
    phases: [],
    correlationMatrix: [],
  };

  const kuramoto = priceVectors ? calculateKuramotoSynchronization(priceVectors) : undefined;
  const correlationMatrix = kuramoto?.correlationMatrix ?? calculateAnimalCorrelationMatrix(returns);
  const pairCorrelations: number[] = [];
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 1; right < count; right += 1) {
      pairCorrelations.push(correlationMatrix[left][right]);
    }
  }
  const meanCorrelation = pairCorrelations.length
    ? pairCorrelations.reduce((sum, value) => sum + value, 0) / pairCorrelations.length
    : 0;
  const measuredPhases = kuramoto?.phases.slice(0, count) ?? phases.slice(0, count);
  const orderParameter = kuramoto?.orderParameter ?? calculateKuramotoOrder(measuredPhases);
  const meanPhase = kuramoto?.meanPhase ?? Math.atan2(
    measuredPhases.reduce((sum, phase) => sum + Math.sin(phase), 0),
    measuredPhases.reduce((sum, phase) => sum + Math.cos(phase), 0),
  );
  const directionSum = trendDirections.slice(0, count).reduce((sum, direction) => sum + Math.sign(direction), 0);
  const trendAgreement = Math.abs(directionSum) / count;
  const directionalStrength = directionalStrengths.slice(0, count).reduce((sum, value) => sum + clamp(value, 0, 1), 0) / count;
  const aligned = trendAgreement >= 0.8 && directionalStrength >= 0.18;
  const activationThreshold = wasSynchronized ? 0.7 : 0.82;
  const alert = aligned && meanCorrelation >= 0.55 && orderParameter >= activationThreshold;

  return {
    orderParameter,
    meanPhase,
    meanCorrelation,
    trendAgreement,
    directionalStrength,
    alert,
    phases: measuredPhases,
    correlationMatrix,
  };
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
    const resonanceCheck = checkMetalResonance(preEventAnalysis);
    const poissonEvents = samplePoissonCount(rand, jumpIntensity, dt);
    const jumpEvents = resonanceCheck.shouldForceJump ? Math.max(1, poissonEvents) : poissonEvents;
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
      resonanceForcedJump: resonanceCheck.shouldForceJump,
      resonanceTargetArcanaId: resonanceCheck.arcana.id,
      resonanceTargetDistance: resonanceCheck.distance,
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
        metalJump: jumped,
        metalLayerGrowth: dailyStep,
        candyMass: 0.85 + clamp(0.8 + Math.abs(basis) * 12 + jumpFlash * 0.6, 0, 3) * 0.12,
        candyAngularVelocity: angularVelocity,
        candyVibrationFrequency: 1 + Math.min(1.5, Math.abs(angularVelocity) * 0.04),
        candyRadialScale: clamp(1 + jumpFlash * 0.06 + invasion.invasionStrength * 0.025, 0.92, 1.12),
        candyPhaseOffset: lowFrequencyPhase * 0.08,
        candyHueShift: 0.1 + invasion.invasionStrength * 0.025,
        candyEmissive: 0.5 + jumpFlash * 0.8 + invasion.invasionStrength * 0.2,
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
    const quantum = calculateQuantumFluctuation(
      innovations,
      frame,
      oscillatorDisplacement,
      oscillatorVelocity,
      0.35,
    );
    const resonance = checkCryptoResonance(
      quantum.amplitude,
      quantum.highFrequency,
      Math.atan2(oscillatorVelocity, oscillatorDisplacement || 1e-9),
    );
    const pointCloudBounds = createCryptoPointCloudBounds(quantum.amplitude, resonance.strength);

    const logReturn = clamp(
      anchorDrift
        + quantum.fractionalNoise * 0.00019 * Math.sqrt(dt / 0.12)
        + quantum.highFrequency * 0.000035
        + oscillatorDisplacement * 0.000035,
      -0.015,
      0.015,
    );
    price = Math.max(1, price * Math.exp(logReturn));

    const tick = {
      ...makeTick(now, price, previous, 0.00075, false),
      angle: Math.atan2(logReturn * 750, 0.4 + Math.cos(frame * 1.43)),
      volatility: clamp(Math.abs(logReturn) * 450, 0, 1),
      tension: clamp(0.18 + Math.abs(quantum.fractionalNoise) * 0.1 + Math.abs(quantum.highFrequency) * 0.16 + Math.abs(oscillatorDisplacement) * 0.2, 0, 1),
      magicLength: clamp(0.2 + Math.abs(oscillatorVelocity) * 0.08 + Math.abs(quantum.fractionalNoise) * 0.2, 0.1, 3),
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
      cryptoFractionalNoise: quantum.fractionalNoise,
      cryptoHighFrequency: quantum.highFrequency,
      cryptoHurstExponent: quantum.hurstExponent,
      cryptoNoiseAmplitude: quantum.amplitude,
      cryptoPairCreation: impulse !== 0,
      cryptoResonanceArcanaId: resonance.active ? resonance.arcana.id : undefined,
      cryptoResonanceDistance: resonance.distance,
      cryptoResonanceStrength: resonance.strength,
      cryptoResonancePoint: resonance.point,
      cryptoPointCloudBounds: pointCloudBounds,
    };
    return {
      tick,
      gravityTensor: buildGravity(price, price * 0.006, walls),
      projection: buildProjection(net >= 0 ? 1 : -1, 0.58 + Math.min(0.38, Math.abs(net) * 0.04), 0.3 + Math.abs(oscillatorDisplacement) * 0.12, 0.09, oscillatorDisplacement > 0.35 ? 'figure_eight' : 'trefoil'),
      style: {
        strokeScale: 0.9,
        vibration: 1.15 + Math.abs(oscillatorVelocity) * 0.1 + Math.abs(quantum.highFrequency) * 0.15,
        rigidity: 0,
        projectionStretch: 0.1,
        candyMass: 0.8 + clamp(0.8 + Math.abs(net) * 0.24, 0, 3) * 0.12,
        candyAngularVelocity: logReturn / dt,
        candyVibrationFrequency: 1.2 + Math.abs(quantum.highFrequency) * 1.4 + Math.abs(oscillatorVelocity) * 0.1,
        candyRadialScale: clamp(1 + oscillatorDisplacement * 0.035, 0.94, 1.06),
        candyPhaseOffset: Math.atan2(oscillatorVelocity, oscillatorDisplacement || 1e-9) * 0.04,
        candyHueShift: 0.76,
        candyEmissive: 0.95 + Math.abs(quantum.highFrequency) * 0.35,
        cryptoHurstExponent: quantum.hurstExponent,
        cryptoNoiseAmplitude: quantum.amplitude,
        cryptoHighFrequencyNoise: quantum.highFrequency,
        cryptoOscillatorDisplacement: oscillatorDisplacement,
        cryptoPairCreation: impulse,
        cryptoPairEventTimestamp: impulse !== 0 ? now : 0,
        cryptoResonanceStrength: resonance.active ? resonance.strength : 0,
        cryptoResonanceArcanaId: resonance.active ? resonance.arcana.id : -1,
        cryptoResonancePoint: resonance.point,
      },
      diagnostics,
    };
  };
}

function animalSimulator(seed: number): FieldSimulator {
  const rand = mulberry32(seed);
  const count = ANIMAL_INITIAL_UNIVERSE.length;
  const prices = ANIMAL_INITIAL_UNIVERSE.map(() => FIELD_CONFIGS.animal.basePrice);
  const priceHistories: number[][] = ANIMAL_INITIAL_UNIVERSE.map(() => [FIELD_CONFIGS.animal.basePrice]);
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
    const previousConstituentPrices = [...prices];

    for (let index = 0; index < count; index += 1) {
      const returnValue = innovations[index] + sentiment * (index < 3 ? 0.00028 : 0.0002);
      prices[index] *= Math.exp(returnValue);
      priceHistories[index].push(prices[index]);
      if (priceHistories[index].length > 49) priceHistories[index].shift();
      returnHistory[index].push(returnValue);
      if (returnHistory[index].length > 48) returnHistory[index].shift();
      trendHistory[index].push(returnValue);
      if (trendHistory[index].length > 20) trendHistory[index].shift();

      const targetFrequency = Math.sign(returnValue) * Math.min(1, Math.abs(returnValue) / 0.0005) * 0.42;
      frequencies[index] += (targetFrequency - frequencies[index]) * Math.min(1, dt * 0.8);
    }

    const assetRsis = priceHistories.map((history) => calculateRsi(history)?.value ?? 50);
    const rsiMean = assetRsis.reduce((sum, value) => sum + value, 0) / count;
    const rsiPerturbation = assetRsis.map((value) => clamp((value - rsiMean) / 50, -1, 1) * 0.12);
    const rsiSpread = Math.sqrt(assetRsis.reduce((sum, value) => sum + (value - rsiMean) ** 2, 0) / count) / 50;
    const coupling = 0.9;
    const dynamicCorrelationMatrix = calculateAnimalCorrelationMatrix(returnHistory);
    const phaseVelocities = phases.map((phase, index) => {
      const interaction = phases.reduce((sum, otherPhase, otherIndex) => {
        if (index === otherIndex) return sum;
        return sum + dynamicCorrelationMatrix[index][otherIndex] * Math.sin(otherPhase - phase);
      }, 0) / (count - 1);
      return frequencies[index] + rsiPerturbation[index] + coupling * interaction;
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
      priceHistories,
    );
    synchronized = sync.alert;
    const alignment = trendDirections.reduce((sum, direction) => sum + direction, 0);
    const direction = Math.sign(alignment) || Math.sign(sentiment) || 1;
    const syncStrength = clamp((sync.orderParameter - 0.48) / 0.52, 0, 1)
      * clamp((sync.meanCorrelation + 0.2) / 0.9, 0, 1)
      * sync.trendAgreement
      * (0.45 + sync.directionalStrength * 0.55);
    const attractor = ANIMAL_SYNC_ATTRACTORS.find((item) => item.id === (Math.cos(sync.meanPhase) >= 0 ? 10 : 21)) ?? ANIMAL_SYNC_ATTRACTORS[0];
    const rawCentroid: MatrixPoint = {
      x: 0.72 * sync.orderParameter * Math.cos(sync.meanPhase),
      y: 0.72 * sync.orderParameter * Math.sin(sync.meanPhase),
      z: clamp((directionalStrengths.reduce((sum, strength, index) => sum + strength * trendDirections[index], 0) / count) * 0.35, -0.35, 0.35),
    };
    const animalAttractorStrength = clamp((sync.orderParameter - 0.85) / 0.15, 0, 1);
    const animalCentroid: MatrixPoint = {
      x: rawCentroid.x + (attractor.x - rawCentroid.x) * animalAttractorStrength,
      y: rawCentroid.y + (attractor.y - rawCentroid.y) * animalAttractorStrength,
      z: (rawCentroid.z ?? 0) + (attractor.z - (rawCentroid.z ?? 0)) * animalAttractorStrength,
    };
    const animalAttractorDistance = Math.hypot(
      animalCentroid.x - attractor.x,
      animalCentroid.y - attractor.y,
      (animalCentroid.z ?? 0) - attractor.z,
    );
    const animalBraidTension = clamp(sync.orderParameter * sync.meanCorrelation * sync.trendAgreement, 0, 1);
    const animalIndex = calculateSyntheticIndex(
      ANIMAL_INDEX_DEFINITION,
      Object.fromEntries(ANIMAL_INDEX_DEFINITION.constituents.map((constituent, index) => [
        constituent.symbol,
        { currentPrice: prices[index], previousPrice: previousConstituentPrices[index], observedAt: now },
      ])),
      previousBasket,
      now,
    );
    if (!animalIndex) throw new Error('Animal simulation did not produce a valid synthetic index observation');
    const price = animalIndex.value;
    const dataContract = createSyntheticMarketDataContract(ANIMAL_INDEX_DEFINITION, animalIndex, now);
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
      kuramotoMeanPhase: sync.meanPhase,
      animalPhases: sync.phases,
      animalRsis: assetRsis,
      animalRsiSpread: rsiSpread,
      animalCorrelationMatrix: sync.correlationMatrix,
      animalAttractorArcanaId: attractor.id,
      animalAttractorDistance,
      animalAttractorStrength,
      animalCentroid,
      animalBraidTension,
      animalSynapseStrength: animalBraidTension,
      meanCorrelation: sync.meanCorrelation,
      trendAgreement: sync.trendAgreement,
      directionalStrength: sync.directionalStrength,
      dataContract,
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
        candyMass: 0.8 + syncStrength * 0.75,
        candyAngularVelocity: angularVelocity,
        candyVibrationFrequency: 0.65 + (1 - syncStrength) * 0.7,
        candyRadialScale: clamp(1 + syncStrength * 0.09 + sync.directionalStrength * 0.03, 0.96, 1.15),
        candyPhaseOffset: phases.reduce((sum, value) => sum + Math.sin(value), 0) / count * 0.08,
        candyHueShift: sync.alert ? 0.12 : 0.25,
        candyEmissive: 0.55 + syncStrength * 0.7,
        animalPulseStrength: syncStrength,
        animalPulsePhase: sync.meanPhase,
        animalBraidStrength: animalBraidTension,
        animalAttractorArcanaId: attractor.id,
        animalPhaseSigma: Math.sqrt(Math.max(0, 1 - syncStrength * syncStrength)),
        animalWormhole: syncStrength,
        animalCorrelations: sync.correlationMatrix.flat(),
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
  let quantizedStepIndex = Math.floor(quantizedAngle / (Math.PI / 12));
  let quantizedStepInitialized = false;
  let syntheticXauUsd = 2650;
  let syntheticBtcPrice = 65000;
  let metaCurrentArcanaId = 11;
  let metaInterferenceLatched = false;
  filter.reset(index);

  return (now, btcAnchor) => {
    const commonEquity = gauss(rand) * 0.00042 + 0.000025;
    const commonUsd = gauss(rand) * 0.00024;
    const commonGlobal = gauss(rand) * 0.00017;
    const usdIndex = clamp(100 * Math.exp(commonUsd), 80, 120);
    syntheticXauUsd *= Math.exp(commonGlobal * 0.12 - commonUsd * 0.35 + gauss(rand) * 0.00011);
    syntheticBtcPrice *= Math.exp(commonGlobal + gauss(rand) * 0.00045);
    if (btcAnchor && Number.isFinite(btcAnchor) && btcAnchor > 0) {
      syntheticBtcPrice += (btcAnchor - syntheticBtcPrice) * 0.2;
    }
    const previousLevels = [...levels];
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

    const metaIndex = calculateSyntheticIndex(
      META_INDEX_DEFINITION,
      Object.fromEntries(design.assets.map((asset, assetIndex) => [
        asset.symbol,
        {
          currentPrice: levels[assetIndex],
          previousPrice: previousLevels[assetIndex],
          observedAt: now,
        },
      ])),
      index,
      now,
    );
    if (!metaIndex) throw new Error('Meta simulation did not produce a valid synthetic index observation');
    const basketReturn = metaIndex.returnLog;
    const rawPrevious = index;
    index = metaIndex.value;
    const dataContract = createSyntheticMarketDataContract(META_INDEX_DEFINITION, metaIndex, now);
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

    const pulsarMass = calculatePulsarMass(filteredIndex, FIELD_CONFIGS.meta.basePrice, relativeDispersion, meanCorrelation);
    const rawAngle = Math.atan2(filteredReturn * 1600, 0.35 + relativeDispersion * 0.08);
    const quantization = quantizedStepInitialized
      ? quantizeAngleWithHysteresis(rawAngle, quantizedStepIndex)
      : {
        angle: Math.floor(rawAngle / (Math.PI / 12)) * (Math.PI / 12),
        stepIndex: Math.floor(rawAngle / (Math.PI / 12)),
        changed: false,
      };
    quantizedStepInitialized = true;
    quantizedAngle = quantization.angle;
    quantizedStepIndex = quantization.stepIndex;
    const xauUsdAnalysis = analyzeMatrixPair(
      'XAU',
      {
        value: syntheticXauUsd,
        referenceValue: 2650,
        volatility: clamp(Math.abs(commonGlobal - commonUsd * 0.35) * 800, 0, 1),
        tension: 0.42 + clamp(relativeDispersion * 0.04, 0, 0.2),
        mass: 1.15,
      },
      'USD',
      { value: usdIndex, referenceValue: 100, volatility: Math.abs(commonUsd) * 400, tension: 0.36, mass: 2.5 },
    );
    const interferenceThreshold = 1.08;
    const interferenceActive = xauUsdAnalysis.distance >= interferenceThreshold;
    const interferenceStarted = interferenceActive && !metaInterferenceLatched;
    const interferenceEnded = !interferenceActive && metaInterferenceLatched;
    const previousArcanaId = metaCurrentArcanaId;
    const defaultAnchorId = meanCorrelation > 0.35 ? 4 : 11;
    if (interferenceStarted) {
      const midpoint = xauUsdAnalysis.midpoint;
      const nextAttractor = ARCANA_ATTRACTORS
        .filter((arcana) => arcana.id !== metaCurrentArcanaId)
        .sort((left, right) => (
          Math.hypot(left.x - midpoint.x, left.y - midpoint.y, left.z - (midpoint.z ?? 0))
          - Math.hypot(right.x - midpoint.x, right.y - midpoint.y, right.z - (midpoint.z ?? 0))
        ))[0];
      if (nextAttractor) metaCurrentArcanaId = nextAttractor.id;
    } else if (interferenceEnded) {
      metaCurrentArcanaId = defaultAnchorId;
    } else if (!interferenceActive) {
      metaCurrentArcanaId = defaultAnchorId;
    }
    metaInterferenceLatched = interferenceActive;
    const phaseShift = interferenceStarted;
    const crackIntensity = interferenceActive
      ? clamp((xauUsdAnalysis.distance - interferenceThreshold) / 0.75, 0, 1)
      : 0;
    const microTremor = interferenceActive
      ? Math.sin(now / 1000 * 17 + metaCurrentArcanaId) * (0.012 + crackIntensity * 0.065)
      : 0;
    const matrixAnalysis = analyzeMatrixPair(
      'BTC',
      { value: syntheticBtcPrice, referenceValue: 65000, volatility: clamp(Math.abs(commonGlobal) * 500, 0, 1), tension: 0.28 + relativeDispersion * 0.04, mass: 0.95 },
      'USD',
      { value: usdIndex, referenceValue: 100, volatility: Math.abs(commonUsd) * 400, tension: 0.36, mass: 2.5 },
    );
    const invasion = applyMatrixInvasionToGeometry(
      'meta',
      { tension: 0.28 + relativeDispersion * 0.04, rigidity: 0.97, angle: quantizedAngle },
      xauUsdAnalysis,
      now / 1000,
    );
    const metaArcana = ARCANA_ATTRACTORS.find((arcana) => arcana.id === metaCurrentArcanaId) ?? ARCANA_ATTRACTORS[11];
    const rippleStrength = quantization.changed ? clamp(0.5 + pulsarMass * 0.16, 0, 1) : 0;
    const projectedAngle = phaseShift
      ? Math.atan2(metaArcana.y, metaArcana.x)
      : quantizedAngle + microTremor;
    const tick: KnotTick = {
      ...makeTick(now, filteredIndex, rawPrevious, 0.0015, false),
      angle: projectedAngle,
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
      phase: projectedAngle,
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
      metaMicroTremor: microTremor,
      metaPulsarMass: pulsarMass,
      metaQuantizedAngle: projectedAngle,
      metaQuantizedStep: quantization.changed,
      metaQuantizedStepIndex: quantization.stepIndex,
      metaPhaseShift: phaseShift,
      metaXauUsdDistance: xauUsdAnalysis.distance,
      metaCrackIntensity: crackIntensity,
      metaRippleStrength: rippleStrength,
      metaRippleTimestamp: quantization.changed ? now : 0,
      metaPreviousArcanaId: phaseShift ? previousArcanaId : metaArcana.id,
      metaTargetArcanaId: metaArcana.id,
      usdIndex,
      xauUsdPrice: syntheticXauUsd,
      xauVolatility: clamp(Math.abs(commonGlobal - commonUsd * 0.35) * 800, 0, 1),
      xauTension: 0.42 + clamp(relativeDispersion * 0.04, 0, 0.2),
      btcProxyPrice: syntheticBtcPrice,
      btcVolatility: clamp(Math.abs(commonGlobal) * 500, 0, 1),
      btcTension: 0.28 + relativeDispersion * 0.04,
      usdVolatility: Math.abs(commonUsd) * 400,
      dataContract,
    };
    return {
      tick,
      gravityTensor: buildGravity(filteredIndex, filteredIndex * 0.012, walls),
      projection: buildProjection(Math.sign(filteredReturn) || 1, 0.32 + tick.tension * 0.3, 0.42, 0.05, 'spiral'),
      style: {
        strokeScale: 1.5,
        vibration: Math.abs(microTremor) * 18,
        rigidity: interferenceActive ? clamp(invasion.rigidity, 0.88, 1) : 0.97,
        projectionStretch: 0,
        invasionStrength: interferenceActive ? clamp(invasion.invasionStrength + crackIntensity * 0.2, 0, 1) : 0,
        candySpinModifier: 1 + (quantization.changed ? 0.08 : 0) + crackIntensity * 0.05,
        matrixDistance: xauUsdAnalysis.distance,
        resonanceArcanaId: metaArcana.id,
        candyMass: clamp(pulsarMass, 0.6, 3),
        candyAngularVelocity: filteredReturn / (FIELD_CONFIGS.meta.intervalMs / 1000),
        candyVibrationFrequency: 0.45,
        candyRadialScale: clamp(0.98 + invasion.rigidity * 0.025 + Math.abs(microTremor) * 0.05, 0.98, 1.06),
        candyPhaseOffset: projectedAngle * 0.025,
        candyHueShift: 0.58,
        candyEmissive: 0.38 + crackIntensity * 0.42,
        metaPulsarMass: pulsarMass,
        metaQuantizedAngle: quantizedAngle,
        metaQuantizedStep: quantization.changed,
        metaQuantizedStepIndex: quantization.stepIndex,
        metaPhaseShift: phaseShift,
        metaXauUsdDistance: xauUsdAnalysis.distance,
        metaCrackIntensity: crackIntensity,
        metaRippleStrength: rippleStrength,
        metaRippleTimestamp: quantization.changed ? now : 0,
        metaPreviousArcanaId: phaseShift ? previousArcanaId : metaArcana.id,
        metaTargetArcanaId: metaArcana.id,
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

export type BollingerHalfVariance = {
  mean: number;
  sigmaUp: number;
  sigmaDown: number;
  upper: number;
  lower: number;
  percentB: number;
  bandwidth: number;
  samples: number;
};

export type BollingerOptions = {
  window?: number;
  k?: number;
  /** Metal: lambda * E[J^2] is added to the upper half-variance only. */
  jumpIntensity?: number;
  jumpSize?: number;
  /** Animal: replaces price deviation with the Kuramoto phase variance 1 - r^2. */
  phaseVariance?: number;
};

/**
 * Bollinger band built from two half-variances split at the moving average.
 * sigma+ uses deviations above the mean, sigma- those below it.
 */
export function calculateBollingerHalfVariance(
  prices: readonly number[],
  { window = 20, k = 2, jumpIntensity = 0, jumpSize = 0, phaseVariance }: BollingerOptions = {},
): BollingerHalfVariance | undefined {
  const sample = prices.slice(-Math.max(3, window)).filter(Number.isFinite);
  if (sample.length < 3) return undefined;
  const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length;
  if (!(Math.abs(mean) > 1e-12)) return undefined;
  let upSquares = 0;
  let downSquares = 0;
  for (const value of sample) {
    const deviation = value - mean;
    if (deviation >= 0) upSquares += deviation * deviation;
    else downSquares += deviation * deviation;
  }
  let sigmaUp: number;
  let sigmaDown: number;
  if (phaseVariance !== undefined) {
    const phaseSigma = Math.abs(mean) * 0.02 * Math.sqrt(clamp(phaseVariance, 0, 1));
    sigmaUp = phaseSigma;
    sigmaDown = phaseSigma;
  } else {
    sigmaUp = Math.sqrt(upSquares / sample.length * 2 + Math.max(0, jumpIntensity) * jumpSize * jumpSize);
    sigmaDown = Math.sqrt(downSquares / sample.length * 2);
  }
  const upper = mean + k * sigmaUp;
  const lower = mean - k * sigmaDown;
  const width = Math.max(upper - lower, Math.abs(mean) * 1e-9);
  const price = sample[sample.length - 1];
  return {
    mean,
    sigmaUp,
    sigmaDown,
    upper,
    lower,
    percentB: clamp((price - lower) / width, -0.5, 1.5),
    bandwidth: width / Math.abs(mean),
    samples: sample.length,
  };
}

function emaSeries(values: readonly number[], period: number): number[] {
  const alpha = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((value, index) => {
    out.push(index === 0 ? value : out[index - 1] + alpha * (value - out[index - 1]));
  });
  return out;
}

export type MacdPendulum = {
  macd: number;
  signal: number;
  histogram: number;
  histogramRate: number;
  /** Double-pendulum arm angles: theta1 follows the fast EMA, theta2 the slow EMA, relative to the price scale. */
  theta1: number;
  theta2: number;
  phaseDifference: number;
  /** Normalised Z-axis distortion height in [-1, 1]. */
  distortionHeight: number;
  /** Positive while the histogram is expanding away from zero. */
  acceleration: number;
};

/** MACD recast as a double-pendulum phase difference (fast arm vs slow arm). */
export function calculateMacdPendulum(
  values: readonly number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPendulum | undefined {
  if (values.length < 4) return undefined;
  const fastEma = emaSeries(values, fast);
  const slowEma = emaSeries(values, slow);
  const macdLine = fastEma.map((value, index) => value - slowEma[index]);
  const signalLine = emaSeries(macdLine, signalPeriod);
  const last = values.length - 1;
  const histogram = macdLine[last] - signalLine[last];
  const previousHistogram = macdLine[last - 1] - signalLine[last - 1];
  const scale = Math.max(Math.abs(slowEma[last]) * 0.002, 1e-9);
  const theta1 = Math.atan((values[last] - fastEma[last]) / scale + (fastEma[last] - slowEma[last]) / scale);
  const theta2 = Math.atan((fastEma[last] - slowEma[last]) / scale);
  const histogramRate = (histogram - previousHistogram) / scale;
  const expanding = Math.sign(histogram) === Math.sign(histogram - previousHistogram) && Math.abs(histogram) > Math.abs(previousHistogram);
  return {
    macd: macdLine[last],
    signal: signalLine[last],
    histogram,
    histogramRate,
    theta1,
    theta2,
    phaseDifference: theta1 - theta2,
    distortionHeight: clamp(Math.tanh(histogram / scale), -1, 1),
    acceleration: expanding ? clamp(Math.abs(histogramRate), 0, 4) / 4 : 0,
  };
}

/** Poisson intensity lifted by MACD histogram acceleration (jump acceleration). */
export function accelerateJumpIntensity(baseLambda: number, macd: MacdPendulum | undefined): number {
  return baseLambda * (1 + 3 * (macd?.acceleration ?? 0));
}

export type IchimokuState = {
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  cloudTop: number;
  cloudBottom: number;
  cloudThickness: number;
  /** +1 golden cross (tenkan over kijun), -1 dead cross, 0 none on the latest sample. */
  cross: -1 | 0 | 1;
  /** +1 broke above the cloud, -1 broke below, 0 none on the latest sample. */
  cloudBreak: -1 | 0 | 1;
  position: 'above' | 'inside' | 'below';
};

const midRange = (values: readonly number[], period: number, end: number) => {
  const slice = values.slice(Math.max(0, end - period + 1), end + 1);
  return (Math.max(...slice) + Math.min(...slice)) / 2;
};

/** Ichimoku on a close-only series (9 / 26 / 52, cloud evaluated from the lagged window). */
export function calculateIchimoku(
  values: readonly number[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouBPeriod = 52,
): IchimokuState | undefined {
  if (values.length < tenkanPeriod + 2) return undefined;
  const at = (end: number) => {
    const tenkan = midRange(values, tenkanPeriod, end);
    const kijun = midRange(values, Math.min(kijunPeriod, end + 1), end);
    const senkouA = (tenkan + kijun) / 2;
    const senkouB = midRange(values, Math.min(senkouBPeriod, end + 1), end);
    return { tenkan, kijun, senkouA, senkouB, top: Math.max(senkouA, senkouB), bottom: Math.min(senkouA, senkouB) };
  };
  const last = values.length - 1;
  const lag = Math.min(kijunPeriod, Math.max(1, Math.floor(last / 2)));
  const now = at(last);
  const previous = at(last - 1);
  // The plotted cloud at "now" was produced `lag` samples ago.
  const cloudNow = at(last - lag);
  const cloudBefore = at(Math.max(0, last - lag - 1));
  const price = values[last];
  const previousPrice = values[last - 1];
  const sideOf = (p: number, top: number, bottom: number) => (p > top ? 1 : p < bottom ? -1 : 0);
  const sideNow = sideOf(price, cloudNow.top, cloudNow.bottom);
  const sidePrevious = sideOf(previousPrice, cloudBefore.top, cloudBefore.bottom);
  const diffNow = now.tenkan - now.kijun;
  const diffPrevious = previous.tenkan - previous.kijun;
  return {
    tenkan: now.tenkan,
    kijun: now.kijun,
    senkouA: cloudNow.senkouA,
    senkouB: cloudNow.senkouB,
    cloudTop: cloudNow.top,
    cloudBottom: cloudNow.bottom,
    cloudThickness: cloudNow.top - cloudNow.bottom,
    cross: diffPrevious <= 0 && diffNow > 0 ? 1 : diffPrevious >= 0 && diffNow < 0 ? -1 : 0,
    cloudBreak: sideNow !== sidePrevious && sideNow !== 0 && sidePrevious !== sideNow ? (sideNow as 1 | -1) : 0,
    position: sideNow > 0 ? 'above' : sideNow < 0 ? 'below' : 'inside',
  };
}

export type IndicatorVelocity = {
  indicator_velocity: number;
  target_price_projection: number;
};

/**
 * Internal state for the honeycomb velocity input. `userInput` in [-1, 1] is the
 * up/neutral/down control; histogram height and cloud thickness scale the response.
 */
export function calculateIndicatorVelocity(
  price: number,
  macd: MacdPendulum | undefined,
  ichimoku: IchimokuState | undefined,
  userInput = 0,
): IndicatorVelocity {
  const height = macd?.distortionHeight ?? 0;
  const cloudRatio = ichimoku && Math.abs(price) > 1e-9 ? ichimoku.cloudThickness / Math.abs(price) : 0;
  const direction = clamp(userInput, -1, 1);
  const velocity = direction * (0.25 + Math.abs(height)) + height * 0.35;
  const reach = Math.abs(price) * (0.0015 + cloudRatio * 0.5);
  return {
    indicator_velocity: velocity,
    target_price_projection: price + velocity * reach * 10,
  };
}

export type AnimalOrderMacd = {
  macd: number;
  signal: number;
  histogram: number;
  /** 0..1, grows while the histogram is positive and expanding (sync build-up). */
  riseStrength: number;
};

/** MACD on the Kuramoto order parameter r (short MA minus long MA). */
export function calculateOrderParameterMacd(orders: readonly number[], shortPeriod = 5, longPeriod = 20): AnimalOrderMacd | undefined {
  if (orders.length < 4) return undefined;
  const shortMa = emaSeries(orders, shortPeriod);
  const longMa = emaSeries(orders, longPeriod);
  const line = shortMa.map((value, index) => value - longMa[index]);
  const signal = emaSeries(line, 5);
  const last = orders.length - 1;
  const histogram = line[last] - signal[last];
  const previous = line[last - 1] - signal[last - 1];
  const growing = histogram > 0 && histogram > previous;
  return {
    macd: line[last],
    signal: signal[last],
    histogram,
    riseStrength: growing ? clamp(histogram * 12, 0, 1) : histogram > 0 ? clamp(histogram * 4, 0, 0.4) : 0,
  };
}

/** Ecosystem collapse: r leaves the stability zone (cloud) built from its lagged mean +/- range. */
export function detectEcosystemCollapse(orders: readonly number[], lag = 10): { collapsed: boolean; stableTop: number; stableBottom: number } | undefined {
  if (orders.length < lag + 4) return undefined;
  const window = orders.slice(-(lag + 12), -lag);
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const spread = Math.max(0.03, (Math.max(...window) - Math.min(...window)) / 2);
  const stableTop = Math.min(1, mean + spread);
  const stableBottom = Math.max(0, mean - spread);
  const last = orders[orders.length - 1];
  const previous = orders[orders.length - 2];
  const inside = (value: number) => value >= stableBottom && value <= stableTop;
  return { collapsed: inside(previous) && !inside(last) && last < previous, stableTop, stableBottom };
}

export type RsiState = {
  value: number;
  /** 0..1, how far beyond the 70/30 band (scaled to the 100/0 extremes). */
  overheat: number;
  /** Signed angular velocity input in [-1, 1] derived from (RSI - 50) / 50. */
  omega: number;
};

/** Wilder RSI on a close-only series. */
export function calculateRsi(values: readonly number[], period = 14): RsiState | undefined {
  if (values.length < 3) return undefined;
  const window = Math.min(period, values.length - 1);
  let gain = 0;
  let loss = 0;
  const start = values.length - 1 - window;
  for (let index = start + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  const value = loss <= 1e-12 ? (gain <= 1e-12 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  const extreme = Math.max(0, Math.abs(value - 50) - 20) / 30;
  return { value, overheat: clamp(extreme, 0, 1), omega: clamp((value - 50) / 50, -1, 1) };
}

/** Spark threshold drops as RSI overheats (lower threshold = sparks fire more easily). */
export function rsiSparkThreshold(base: number, rsi: RsiState | undefined): number {
  return base * (1 - 0.8 * (rsi?.overheat ?? 0));
}

export type AtrState = {
  atr: number;
  /** ATR relative to price. */
  ratio: number;
  /** 0..1 pulse amplitude (breathing). */
  pulse: number;
  /** Fault depth scale >= 1 for the honeycomb crack / Poisson jump width. */
  faultDepth: number;
};

/** ATR on a close-only series (true range approximated by the absolute close-to-close change). */
export function calculateAtr(values: readonly number[], period = 14): AtrState | undefined {
  if (values.length < 3) return undefined;
  const window = Math.min(period, values.length - 1);
  let total = 0;
  for (let index = values.length - window; index < values.length; index += 1) {
    total += Math.abs(values[index] - values[index - 1]);
  }
  const atr = total / window;
  const price = Math.abs(values[values.length - 1]);
  const ratio = price > 1e-12 ? atr / price : 0;
  const pulse = clamp(Math.tanh(ratio * 400), 0, 1);
  return { atr, ratio, pulse, faultDepth: 1 + pulse * 2.5 };
}

/** Poisson jump width (fault depth) scaled by ATR. */
export function atrJumpSize(basePrice: number, atr: AtrState | undefined): number {
  return Math.abs(basePrice) * 0.0015 * (atr?.faultDepth ?? 1);
}

export type VortexState = {
  /** Rotation rate in rad/s for the 7-point cloud vortex. */
  rotationSpeed: number;
  /** Pulsation amplitude 0..1 from ATR. */
  pulse: number;
  /** Singularity (target price) the vortex funnels toward. */
  singularityPrice: number;
  /** True while the manual velocity and RSI omega agree and the histogram accelerates. */
  accelerationZone: boolean;
  /** Signed normalised index of the highlighted 7-point hole (0..6). */
  highlightIndex: number;
};

/** Couples RSI omega, ATR pulse and the manual up/neutral/down velocity into the Animal vortex search state. */
export function calculateVortexSearch(
  price: number,
  rsi: RsiState | undefined,
  atr: AtrState | undefined,
  velocity: IndicatorVelocity,
): VortexState {
  const omega = rsi?.omega ?? 0;
  const manual = clamp(velocity.indicator_velocity, -2, 2);
  const rotationSpeed = 0.4 + omega * 1.2 + manual * 1.6;
  const reach = Math.abs(price) * (0.002 + (atr?.ratio ?? 0) * 3);
  const singularityPrice = price + Math.sign(rotationSpeed - 0.4 || manual) * reach * (1 + Math.abs(manual));
  const accelerationZone = Math.sign(omega) === Math.sign(manual) && Math.abs(manual) > 0.3 && Math.abs(omega) > 0.2;
  const highlightIndex = ((Math.round((velocity.target_price_projection - price) / Math.max(reach, 1e-9)) % 7) + 7) % 7;
  return { rotationSpeed, pulse: atr?.pulse ?? 0, singularityPrice, accelerationZone, highlightIndex };
}

export type VolumeWell = { price: number; depth: number };
export type VolumeWellState = {
  wells: VolumeWell[];
  maxDepth: number;
  deepest?: VolumeWell;
  source: 'volume' | 'orderbook' | 'dwell-proxy';
};

/**
 * Mass tensor along price: real volume / order-book strength when supplied,
 * otherwise a dwell-time proxy (time spent at a price, weighted by activity).
 */
export function calculateVolumeWells(
  prices: readonly number[],
  options: { volumes?: readonly number[]; bookCenters?: readonly { price: number; strength: number }[]; bins?: number } = {},
): VolumeWellState {
  const clean = prices.filter(Number.isFinite);
  if (clean.length < 4) return { wells: [], maxDepth: 0, source: 'dwell-proxy' };
  const bins = Math.max(6, options.bins ?? 16);
  const lo = Math.min(...clean);
  const hi = Math.max(...clean);
  const span = Math.max(hi - lo, Math.abs(hi) * 1e-6, 1e-9);
  const mass = new Array<number>(bins).fill(0);
  const hasVolume = Boolean(options.volumes && options.volumes.length === prices.length && options.volumes.some((v) => v > 0));
  prices.forEach((price, index) => {
    if (!Number.isFinite(price)) return;
    const bin = Math.min(bins - 1, Math.floor(((price - lo) / span) * bins));
    const activity = index > 0 && Number.isFinite(prices[index - 1]) ? 1 + Math.abs(price - prices[index - 1]) / span * bins : 1;
    mass[bin] += hasVolume ? Math.max(0, options.volumes![index]) : activity;
  });
  let source: VolumeWellState['source'] = hasVolume ? 'volume' : 'dwell-proxy';
  for (const center of options.bookCenters ?? []) {
    if (!Number.isFinite(center.price) || !Number.isFinite(center.strength)) continue;
    const bin = Math.min(bins - 1, Math.max(0, Math.floor(((center.price - lo) / span) * bins)));
    mass[bin] += Math.max(0, center.strength) * (Math.max(...mass) || 1) * 0.5;
    source = hasVolume ? source : 'orderbook';
  }
  const peak = Math.max(...mass, 1e-9);
  const wells = mass
    .map((value, bin) => ({ price: lo + ((bin + 0.5) / bins) * span, depth: value / peak }))
    .filter((well) => well.depth >= 0.35)
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 4);
  return { wells, maxDepth: wells[0]?.depth ?? 0, deepest: wells[0], source };
}

export type TensionOmegaState = {
  ready: boolean;
  points: { x: number; y: number }[];
  symmetry: number;
  limitCycle: number;
  stability: number;
  chaos: boolean;
};

/** Phase-plane (T, ω) trajectory: point-reflection symmetry plus limit-cycle steadiness. */
export function calculateTensionOmegaLissajous(tensions: readonly number[], angles: readonly number[], window = 48): TensionOmegaState {
  const n = Math.min(tensions.length, angles.length, window + 1);
  const empty: TensionOmegaState = { ready: false, points: [], symmetry: 1, limitCycle: 1, stability: 1, chaos: false };
  if (n < 14) return empty;
  const t = tensions.slice(-n);
  const a = angles.slice(-n);
  const omega: number[] = [];
  for (let i = 1; i < n; i += 1) {
    let d = a[i] - a[i - 1];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    omega.push(d);
  }
  const tt = t.slice(1);
  const norm = (values: number[]) => {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
    return values.map((v) => (v - mean) / sd);
  };
  const xs = norm(tt);
  const ys = norm(omega);
  const points = xs.map((x, i) => ({ x, y: ys[i] }));
  const radii = points.map((p) => Math.hypot(p.x, p.y));
  const meanR = radii.reduce((s, v) => s + v, 0) / radii.length || 1;
  const cv = Math.sqrt(radii.reduce((s, v) => s + (v - meanR) ** 2, 0) / radii.length) / meanR;
  const steps: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.atan2(points[i].y, points[i].x) - Math.atan2(points[i - 1].y, points[i - 1].x);
    steps.push(Math.atan2(Math.sin(d), Math.cos(d)));
  }
  const meanStep = steps.reduce((s, v) => s + v, 0) / steps.length;
  const sdStep = Math.sqrt(steps.reduce((s, v) => s + (v - meanStep) ** 2, 0) / steps.length);
  const steadiness = clamp(1 - sdStep / (Math.abs(meanStep) + 0.35), 0, 1);
  let mirrored = 0;
  for (const p of points) {
    let best = Infinity;
    for (const q of points) best = Math.min(best, Math.hypot(-p.x - q.x, -p.y - q.y));
    mirrored += best;
  }
  const symmetry = 1 / (1 + (3 * mirrored) / points.length / meanR);
  const limitCycle = clamp(0.5 / (1 + cv * 2) + 0.5 * steadiness, 0, 1);
  const stability = clamp(0.55 * symmetry + 0.45 * limitCycle, 0, 1);
  return { ready: true, points, symmetry, limitCycle, stability, chaos: stability < 0.55 };
}

export type HackingState = {
  alignment: number;
  components: { well: number; macd: number; vortex: number; stability: number };
  locked: boolean;
  singularityPrice: number;
  highlightIndex: number;
};

/** The manual velocity must match wells, MACD height, vortex and phase-plane stability to reveal the true singularity. */
export function evaluateHackingSingularity(input: {
  price: number;
  velocity: IndicatorVelocity;
  vortex: VortexState;
  wells: VolumeWellState;
  macdHeight: number;
  lissajous: TensionOmegaState;
  field: 'metal' | 'animal';
}): HackingState {
  const v = input.velocity.indicator_velocity;
  const direction = Math.sign(v);
  const strong = Math.abs(v) > 0.3;
  const ahead = input.wells.wells
    .filter((well) => direction !== 0 && Math.sign(well.price - input.price) === direction)
    .sort((a, b) => Math.abs(a.price - input.price) - Math.abs(b.price - input.price))[0];
  const well = strong && ahead ? clamp(ahead.depth / 0.7, 0, 1) : 0;
  const macd = strong && Math.sign(input.macdHeight) === direction ? clamp(0.6 + Math.abs(input.macdHeight) * 2, 0, 1) : 0;
  const vortex = input.vortex.accelerationZone ? 1 : strong ? 0.35 : 0;
  const stability = input.field === 'metal'
    ? (input.lissajous.chaos ? 0 : input.lissajous.stability)
    : input.lissajous.limitCycle;
  const components = { well, macd, vortex, stability };
  const alignment = (well + macd + vortex + stability) / 4;
  const locked = strong && Object.values(components).every((value) => value >= 0.55) && alignment >= 0.75;
  return {
    alignment,
    components,
    locked,
    singularityPrice: ahead?.price ?? input.vortex.singularityPrice,
    highlightIndex: input.vortex.highlightIndex,
  };
}

export type ObserverDirection = 'long' | 'short';
export type ObserverInput = { price: number; size: number; direction: ObserverDirection };
export type CloudBoundsLike = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
export type CloudObservation = {
  valid: boolean;
  /** Observer price offset from the recorded singularity, in units of the cloud half-width. */
  offset: number;
  /** Direction-aware displacement of the observed price from the singularity, in cloud widths (+ = in favour). Not realised P&L. */
  pnlRatio: number;
  /** 0..1 chance-like score that the observer sits inside the recorded probability cloud (Gaussian over the box). */
  inCloud: number;
  /** Orbit shell: radius grows with size, inclination follows direction and offset. */
  orbitRadius: number;
  inclination: number;
  /** 0..1, how close the observer is to the cloud edge on the adverse side. */
  edgeRisk: number;
  /** Observer position in the cloud's normalised box (x: -1..1, y: -1..1). */
  box: { x: number; y: number };
  collapsed: boolean;
};

/**
 * Observer overlay on a recorded quantum trace: the manual price/size/direction is
 * placed inside the stored point-cloud box. Simulated position, not a real order.
 */
export function observeQuantumCloud(
  trace: { price: number; pointCloudBounds: CloudBoundsLike; maxNoiseAmplitude: number },
  observer: ObserverInput,
): CloudObservation {
  const invalid: CloudObservation = { valid: false, offset: 0, pnlRatio: 0, inCloud: 0, orbitRadius: 0, inclination: 0, edgeRisk: 0, box: { x: 0, y: 0 }, collapsed: false };
  if (![trace.price, observer.price, observer.size].every(Number.isFinite) || trace.price <= 0 || observer.price <= 0 || observer.size <= 0) return invalid;
  const { min, max } = trace.pointCloudBounds;
  const halfY = Math.max((max.y - min.y) / 2, 1e-6);
  // Cloud half-width in price terms: noise amplitude scaled to the recorded price.
  const halfWidth = Math.max(trace.price * (Math.abs(trace.maxNoiseAmplitude) * 0.002 + halfY * 0.0005), trace.price * 1e-4);
  const sign = observer.direction === 'long' ? 1 : -1;
  const offset = (observer.price - trace.price) / halfWidth;
  const pnlRatio = (sign * (observer.price - trace.price)) / (2 * halfWidth);
  const inCloud = Math.exp(-0.5 * offset * offset);
  const adverseDistance = Math.max(0, -sign * offset);
  const edgeRisk = clamp(adverseDistance / 2, 0, 1);
  return {
    valid: true,
    offset,
    pnlRatio,
    inCloud,
    orbitRadius: 0.4 + Math.log10(1 + observer.size) * 0.6,
    inclination: sign * clamp(offset / 3, -1, 1) * (Math.PI / 3),
    edgeRisk,
    box: { x: 0, y: clamp(-offset / 3, -1, 1) },
    collapsed: edgeRisk >= 1,
  };
}

export type CryptoPositionSource = 'glyph' | 'manual' | 'hybrid';

/** Simulated Crypto position: a recalled glyph/singularity overlaid with manual direction, size and prices. */
export interface CryptoPositionState {
  source: CryptoPositionSource;
  glyphId: number | null;
  glyphLabel: string;
  direction: ObserverDirection;
  size: number;
  entryPrice: number;
  targetPrice: number | null;
  liquidationPrice: number | null;
}

export type CryptoPositionMetrics = {
  valid: boolean;
  sign: 1 | -1;
  pnlRatio: number;
  tilt: number;
  radius: number;
  blinkHz: number;
  liquidationPrice: number;
  liquidationProximity: number;
  annihilation: number;
};

/** Default liquidation assumes roughly 10x leverage when none is entered. */
export function defaultLiquidationPrice(entry: number, direction: ObserverDirection) {
  return direction === 'long' ? entry * 0.9 : entry * 1.1;
}

export function calculateCryptoPositionMetrics(position: CryptoPositionState, currentPrice: number): CryptoPositionMetrics {
  const sign: 1 | -1 = position.direction === 'long' ? 1 : -1;
  const valid = [position.entryPrice, position.size, currentPrice].every((value) => Number.isFinite(value) && value > 0);
  if (!valid) return { valid: false, sign, pnlRatio: 0, tilt: 0, radius: 0, blinkHz: 0, liquidationPrice: 0, liquidationProximity: 0, annihilation: 0 };
  const liquidation = position.liquidationPrice !== null && Number.isFinite(position.liquidationPrice) && position.liquidationPrice > 0
    && (sign === 1 ? position.liquidationPrice < position.entryPrice : position.liquidationPrice > position.entryPrice)
    ? position.liquidationPrice
    : defaultLiquidationPrice(position.entryPrice, position.direction);
  const pnlRatio = sign * (currentPrice - position.entryPrice) / position.entryPrice;
  const loss = -sign * (currentPrice - position.entryPrice);
  const liquidationProximity = Math.max(0, Math.min(1, loss / Math.abs(position.entryPrice - liquidation)));
  return {
    valid,
    sign,
    pnlRatio,
    tilt: sign * Math.PI / 5,
    radius: 1.1 + 1.9 * (1 - Math.exp(-position.size / 2)),
    blinkHz: 0.6 + 6 * Math.min(1, Math.abs(pnlRatio) / 0.05),
    liquidationPrice: liquidation,
    liquidationProximity,
    annihilation: Math.max(0, Math.min(1, (liquidationProximity - 0.6) / 0.4)),
  };
}

export const DETECTOR_EDGE_NAMES = ['LR', 'B', 'LL', 'UL', 'T', 'UR'] as const;
