import { ARCANA_ATTRACTORS } from './arcanaMatrix';
import type { FieldDiagnostics } from './fieldModels';
import { validateMarketDataContract } from './marketCatalog';

export type FeedbackKind = 'crypto' | 'meta';
export type FeedbackLevel = 'idle' | 'active' | 'alert';

export type FeedbackRow = {
  part: string;
  metric: string;
  value: string;
  level: FeedbackLevel;
};

export type ExtensionRow = {
  indicator: string;
  crypto: string;
  meta: string;
  status: 'live' | 'planned';
};

/** Extension table: each indicator mapped onto Crypto (quantum cloud) and Meta (pulsar / LIGO) parts. */
export const CRYPTO_META_EXTENSION_TABLE: readonly ExtensionRow[] = [
  { indicator: 'fBm / damped oscillator', crypto: 'Cloud-chamber noise, pair creation / annihilation', meta: '-', status: 'live' },
  { indicator: 'Butterworth + 15° quantizer', crypto: '-', meta: 'Pulsar mass, rigid leap, ripple', status: 'live' },
  { indicator: 'Arcana resonance', crypto: 'I Magician / XVIII Moon lensing', meta: 'IV Emperor / VIII Justice anchor, leap', status: 'live' },
  { indicator: 'Matrix distance (XAU-USD)', crypto: 'BTC-USD resonance point', meta: 'Micro-tremor / crack threshold', status: 'live' },
  { indicator: 'Bollinger half-variance', crypto: 'Hurst-scaled band: noise amplitude as sigma', meta: 'Band on low-pass mass; leap on band break', status: 'planned' },
  { indicator: 'MACD double pendulum', crypto: 'Oscillator phase difference drives pair-creation rate', meta: 'Fast/slow mass gap drives quantized step rate', status: 'planned' },
  { indicator: 'Ichimoku kumo', crypto: 'Probability cloud bounding box as the cloud', meta: 'Event-horizon band; cloud exit = phase shift', status: 'planned' },
  { indicator: 'RSI / ATR', crypto: 'RSI to cloud boil speed, ATR to noise radius', meta: 'RSI to rotation rate, ATR to ripple amplitude', status: 'planned' },
  { indicator: 'Volume well / Tension-ω', crypto: 'Order-book wells pull the cloud, spoof decay', meta: 'Index-mass wells, rigid limit cycle', status: 'planned' },
];

function arcanaRoman(id: number | undefined): string {
  if (id === undefined) return '--';
  return ARCANA_ATTRACTORS.find((arcana) => arcana.id === id)?.roman ?? '--';
}

const fixed = (value: number | undefined, digits = 3) => (Number.isFinite(value) ? (value as number).toFixed(digits) : '--');

function contractRow(diagnostics: FieldDiagnostics | undefined, now: number): FeedbackRow {
  const contract = diagnostics?.dataContract;
  if (!contract) return { part: 'Data contract', metric: 'source / freshness', value: 'no contract', level: 'idle' };
  const status = validateMarketDataContract(contract, now);
  const age = Number.isFinite(status.ageMs) ? `${Math.max(0, Math.round(status.ageMs / 1000))}s` : 'n/a';
  return {
    part: 'Data contract',
    metric: `${contract.source.provider} / ${contract.timeframe ?? 'tick'}`,
    value: status.fresh ? `fresh ${age}` : `${status.reason ?? 'stale'} ${age}`,
    level: status.fresh ? 'active' : 'alert',
  };
}

export function buildMatrixFeedback(
  kind: FeedbackKind,
  diagnostics: FieldDiagnostics | undefined,
  extras: { inventoryCount: number; now?: number },
): FeedbackRow[] {
  const now = extras.now ?? Date.now();
  if (!diagnostics) {
    return [{ part: 'Feed', metric: 'diagnostics', value: 'awaiting field data', level: 'idle' }];
  }
  if (kind === 'crypto') {
    const bounds = diagnostics.cryptoPointCloudBounds;
    const resonant = diagnostics.cryptoResonanceArcanaId !== undefined && (diagnostics.cryptoResonanceStrength ?? 0) > 0.5;
    return [
      { part: 'Quantum fluctuation', metric: 'Hurst H', value: fixed(diagnostics.cryptoHurstExponent), level: 'idle' },
      { part: 'Quantum fluctuation', metric: 'noise amplitude', value: fixed(diagnostics.cryptoNoiseAmplitude), level: (diagnostics.cryptoNoiseAmplitude ?? 0) > 1 ? 'active' : 'idle' },
      { part: 'Damped oscillator', metric: 'displacement / velocity', value: `${fixed(diagnostics.cryptoDampedDisplacement)} / ${fixed(diagnostics.cryptoDampedVelocity)}`, level: diagnostics.cryptoPairCreation ? 'active' : 'idle' },
      { part: 'Cloud chamber', metric: 'pair creation', value: diagnostics.cryptoPairCreation ? 'BOILING' : 'quiet', level: diagnostics.cryptoPairCreation ? 'alert' : 'idle' },
      { part: 'Arcana resonance', metric: `${arcanaRoman(diagnostics.cryptoResonanceArcanaId)} strength`, value: fixed(diagnostics.cryptoResonanceStrength), level: resonant ? 'alert' : 'idle' },
      { part: 'Probability cloud', metric: 'bounding box', value: bounds ? `${fixed(bounds.max.x - bounds.min.x, 2)} × ${fixed(bounds.max.y - bounds.min.y, 2)}` : '--', level: bounds ? 'active' : 'idle' },
      { part: 'Knot inventory', metric: 'quantum traces', value: String(extras.inventoryCount), level: extras.inventoryCount > 0 ? 'active' : 'idle' },
      contractRow(diagnostics, now),
    ];
  }
  const shift = Boolean(diagnostics.metaPhaseShift);
  return [
    { part: 'Pulsar mass', metric: 'low-pass mass', value: fixed(diagnostics.metaPulsarMass), level: 'idle' },
    { part: 'Quantizer', metric: 'angle / step', value: `${fixed(diagnostics.metaQuantizedAngle, 0)}° / #${diagnostics.metaQuantizedStepIndex ?? '--'}`, level: diagnostics.metaQuantizedStep ? 'active' : 'idle' },
    { part: 'Gravity ripple', metric: 'strength', value: fixed(diagnostics.metaRippleStrength), level: (diagnostics.metaRippleStrength ?? 0) > 0.05 ? 'active' : 'idle' },
    { part: 'XAU-USD interference', metric: 'distance / micro-tremor', value: `${fixed(diagnostics.metaXauUsdDistance)} / ${fixed(diagnostics.metaMicroTremor)}`, level: (diagnostics.metaCrackIntensity ?? 0) > 0 ? 'alert' : 'idle' },
    { part: 'Arcana anchor', metric: 'previous → target', value: `${arcanaRoman(diagnostics.metaPreviousArcanaId)} → ${arcanaRoman(diagnostics.metaTargetArcanaId)}`, level: shift ? 'alert' : 'idle' },
    { part: 'Cross-asset', metric: 'mean corr / dispersion', value: `${fixed(diagnostics.metaMeanCorrelation, 2)} / ${fixed(diagnostics.metaRelativeDispersion, 2)}`, level: 'idle' },
    { part: 'Knot inventory', metric: 'phase shifts', value: String(extras.inventoryCount), level: extras.inventoryCount > 0 ? 'active' : 'idle' },
    contractRow(diagnostics, now),
  ];
}
