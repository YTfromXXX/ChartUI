// Real (l<=2) spherical-harmonic sphere distortion used across the Arcana
// trap system, Portfolio Radar and the Gallery Explorer lens. Mirrors the
// closed-form basis implemented in `distortion_field.py` on the backend, so a
// canonical calculation exists server-side while this module gives the
// browser a zero-latency copy for 60fps shader/canvas evaluation.
import { PROJECTION_CELL_COUNT, cellAngles } from './projectionGrid';

export type SphericalCoefficients = { c00: number; c10: number; c20: number; c22: number };

const SH00 = 0.5 * Math.sqrt(1 / Math.PI);

function sh10(theta: number): number {
  return 0.5 * Math.sqrt(3 / Math.PI) * Math.cos(theta);
}

function sh20(theta: number): number {
  return 0.25 * Math.sqrt(5 / Math.PI) * (3 * Math.cos(theta) ** 2 - 1);
}

function sh22(theta: number, phi: number): number {
  return 0.25 * Math.sqrt(15 / Math.PI) * Math.sin(theta) ** 2 * Math.cos(2 * phi);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

/** Distorted radius r(theta, phi) of the market-energy sphere at base radius 1. */
export function distortedRadius(theta: number, phi: number, coefficients: SphericalCoefficients, baseRadius = 1): number {
  return (
    baseRadius +
    coefficients.c00 * SH00 +
    coefficients.c10 * sh10(theta) +
    coefficients.c20 * sh20(theta) +
    coefficients.c22 * sh22(theta, phi)
  );
}

/** Maps order-book / spiral-cube pressure readings into SH coefficients. */
export function coefficientsFromMarket(
  verticalPressure: number,
  horizontalPressure: number,
  gravityMagnitude: number,
  netForce: number,
): SphericalCoefficients {
  return {
    c00: 0.15 * clamp01(gravityMagnitude),
    c10: 0.22 * clamp(Number.isFinite(netForce) ? netForce : 0, -1, 1),
    c20: 0.18 * (clamp01(verticalPressure) - clamp01(horizontalPressure)),
    c22: 0.12 * clamp01(horizontalPressure),
  };
}

/**
 * SDF distance from the fixed 48-face barrier (radius = baseRadius) to the
 * distorted sphere along the given grid cell's direction. Positive means the
 * sphere sits safely inside the barrier; it converges toward zero as the
 * sphere bulges through that face (a "breakout").
 */
export function planeDistance(index: number, coefficients: SphericalCoefficients, baseRadius = 1): number {
  const { theta, phi } = cellAngles(index);
  return baseRadius - distortedRadius(theta, phi, coefficients, baseRadius);
}

export function planeDistances(coefficients: SphericalCoefficients, baseRadius = 1): number[] {
  return Array.from({ length: PROJECTION_CELL_COUNT }, (_, index) => planeDistance(index, coefficients, baseRadius));
}

/**
 * Discrete spherical-harmonic transform (quadrature over the 48 sampling
 * directions): fits (c00, c10, c20, c22) to an arbitrary energy field, e.g. a
 * portfolio's per-position Gaussian bump field. This is the "surface fitting"
 * step used by Portfolio Radar to turn discrete positions into a smooth
 * distorted sphere.
 */
export function fitSphericalHarmonics(samples: ReadonlyArray<{ theta: number; phi: number; value: number }>): SphericalCoefficients {
  if (samples.length === 0) return { c00: 0, c10: 0, c20: 0, c22: 0 };
  const weight = (4 * Math.PI) / samples.length;
  let c00 = 0;
  let c10 = 0;
  let c20 = 0;
  let c22 = 0;
  for (const sample of samples) {
    c00 += sample.value * SH00 * weight;
    c10 += sample.value * sh10(sample.theta) * weight;
    c20 += sample.value * sh20(sample.theta) * weight;
    c22 += sample.value * sh22(sample.theta, sample.phi) * weight;
  }
  return { c00, c10, c20, c22 };
}

/** Gaussian angular bump kernel (great-circle distance) for surface fitting. */
export function angularGaussianBump(theta: number, phi: number, sourceTheta: number, sourcePhi: number, sigma: number): number {
  const cosAngle = clamp(
    Math.sin(theta) * Math.sin(sourceTheta) * Math.cos(phi - sourcePhi) + Math.cos(theta) * Math.cos(sourceTheta),
    -1,
    1,
  );
  const angularDistance = Math.acos(cosAngle);
  return Math.exp(-(angularDistance * angularDistance) / (2 * sigma * sigma));
}
