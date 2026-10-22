// Mutable metrics bus: render loops write plain numbers (no React state, no
// allocation); the HUD samples it a few times per second.
export type DebugMetrics = {
  chartCrossings: number;
  streamCrossings: number;
  minDk: number;
  pressure: number;
  particles: number;
  gravityMax: number;
};

export const debugMetrics: DebugMetrics = {
  chartCrossings: 0,
  streamCrossings: 0,
  minDk: 1,
  pressure: 0,
  particles: 0,
  gravityMax: 0,
};

export function reportBarrier(distances: readonly number[]) {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < distances.length; i += 1) if (distances[i] < min) min = distances[i];
  debugMetrics.minDk = Number.isFinite(min) ? min : 0;
  debugMetrics.pressure = Math.max(0, -debugMetrics.minDk);
}

export function resetDebugMetrics() {
  debugMetrics.chartCrossings = 0;
  debugMetrics.streamCrossings = 0;
  debugMetrics.minDk = 1;
  debugMetrics.pressure = 0;
  debugMetrics.particles = 0;
  debugMetrics.gravityMax = 0;
}
