export type SigilField = 'metal' | 'animal' | 'crypto' | 'meta';
export type SigilSuit = 'Wands' | 'Cups' | 'Swords' | 'Pentacles';
export type SigilBorder = 'none' | 'dashed' | 'double';
export type SigilDirection = 'long' | 'short' | 'flat';
export type SigilSingularity = 'hack-lock' | 'target-reached' | 'liquidation-collapse' | 'shell-slip' | null;

export type SigilInput = {
  field: SigilField;
  /** Kuramoto order parameter r (0..1). */
  kuramotoR: number;
  /** Normalised XAU-USD distance stress (0..1). */
  xauStress: number;
  /** Crypto noise amplitude / high-frequency stress (0..1). */
  noiseStress: number;
  /** Gravity-well depth (0..1). */
  wellDepth: number;
  /** Fault / cloud-break / chaos / crack stress (0..1). */
  faultStress: number;
  /** MACD histogram derivative, normalised (-1..1). */
  macdAcceleration: number;
  /** Ichimoku cloud state; 'none' when the series is still warming up. */
  cloud: 'none' | 'inside' | 'above' | 'below';
  rsi: number;
  /** ATR amplitude, normalised (0..1). */
  atr: number;
  direction: SigilDirection;
  /** Detector edge bitmask for Crypto (6 bits). */
  detectorMask?: number;
  singularity: SigilSingularity;
};

export type Sigil = {
  arcanaId: 1 | 4 | 10 | 16;
  numeral: string;
  suit: SigilSuit;
  suitGlyph: string;
  dots: number;
  border: SigilBorder;
  vortexTurns: number;
  strokeWidth: number;
  direction: SigilDirection;
  directionGlyph: string;
  borderGlyph: string;
  detectorBits: string;
  locked: boolean;
  singularity: SigilSingularity;
  text: string;
};

const ROMAN: Record<number, string> = { 1: 'I', 4: 'IV', 10: 'X', 16: 'XVI' };
const SUITS: Record<SigilField, { suit: SigilSuit; glyph: string }> = {
  metal: { suit: 'Wands', glyph: '⟋' },
  animal: { suit: 'Cups', glyph: '≈' },
  crypto: { suit: 'Swords', glyph: '†' },
  meta: { suit: 'Pentacles', glyph: '⬡' },
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/** Picks the strongest core attractor: I noise, IV rigidity/wells, X synchrony (r>0.85), XVI fault. */
export function pickCoreAttractor(input: SigilInput): Sigil['arcanaId'] {
  const scores: [Sigil['arcanaId'], number][] = [
    [1, input.noiseStress * (input.field === 'crypto' ? 1.15 : 0.7)],
    [4, input.wellDepth * 0.9 + (input.field === 'meta' ? 0.2 : 0)],
    [10, input.kuramotoR > 0.85 ? 1.2 + input.kuramotoR : input.kuramotoR * 0.8],
    [16, Math.max(input.faultStress, input.xauStress * 0.9) * 1.1],
  ];
  return scores.reduce((best, entry) => (entry[1] > best[1] ? entry : best), scores[1])[0];
}

export function generateSigil(input: SigilInput): Sigil {
  const arcanaId = pickCoreAttractor(input);
  const { suit, glyph } = SUITS[input.field];
  const dots = Math.round(clamp(Math.abs(input.macdAcceleration), 0, 1) * 8);
  const border: SigilBorder = input.cloud === 'none' ? 'none' : input.cloud === 'inside' ? 'dashed' : 'double';
  const vortexTurns = Math.round(clamp(Math.abs(input.rsi - 50) / 10, 0, 5));
  const strokeWidth = Number((1 + clamp(input.atr, 0, 1) * 3).toFixed(2));
  const directionGlyph = input.direction === 'long' ? '⤢' : input.direction === 'short' ? '⤡' : '·';
  const borderGlyph = border === 'double' ? '⊗' : border === 'dashed' ? '⊙' : '○';
  const mask = input.detectorMask ?? 0;
  const detectorBits = Array.from({ length: 6 }, (_, edge) => (mask & (1 << edge) ? '1' : '0')).join('');
  const detector = input.field === 'crypto' && mask ? ` |${detectorBits}|` : '';
  const text = `[${ROMAN[arcanaId]}] - (${suit}) ${directionGlyph} ${borderGlyph} ·${dots} @${vortexTurns} w${strokeWidth.toFixed(1)}${detector}`;
  return {
    arcanaId, numeral: ROMAN[arcanaId], suit, suitGlyph: glyph, dots, border, vortexTurns, strokeWidth,
    direction: input.direction, directionGlyph, borderGlyph, detectorBits,
    locked: input.singularity !== null, singularity: input.singularity, text,
  };
}
