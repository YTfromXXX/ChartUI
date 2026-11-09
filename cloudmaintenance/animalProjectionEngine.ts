import { REGIONS } from '@/lib/retroGrid';
import type { ArcanaParameter, CureTimeframe, PlaceholderState } from '@/lib/cureApiStore';

export type AnimalProjectionInput = {
  volatility: number;
  tension: number;
  syncOrder: number;
  attractorStrength: number;
  braidTension: number;
  meanPhase: number;
  directionalStrength: number;
};

export type AnimalCandyInput = {
  volatilityIndex: number;
  timeframe: CureTimeframe;
  placeholderState: PlaceholderState;
  arcanaParameters: readonly Pick<ArcanaParameter, 'id' | 'name' | 'angle' | 'volatilityAffinity' | 'tensionAffinity'>[];
};

export type ReverseTrackedCandy = {
  id: string;
  sourceCellId: number;
  layer: 'surge' | 'continuation' | 'range' | 'plunge';
  polarity: 'upper' | 'lower';
  arcanaId: number;
  arcanaName: string;
  x: number;
  y: number;
  radius: number;
  phase: number;
  energy: number;
  hue: number;
};

export type AnimalMirrorCell = {
  id: number;
  side: -1 | 1;
  x: number;
  y: number;
  phase: number;
  energy: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LAYER_NAMES = ['surge', 'continuation', 'range', 'plunge'] as const;
const TIMEFRAME_SPEED: Record<CureTimeframe, number> = {
  '1m': 1.8,
  '5m': 1.45,
  '15m': 1.1,
  '1H': 0.72,
  '4H': 0.42,
  '1D': 0.2,
};

export function getCureTimeframeSpeed(timeframe: CureTimeframe): number {
  return TIMEFRAME_SPEED[timeframe];
}

export const RETROGRID_VERTICAL_PLAY = {
  top: REGIONS.header.share / 2,
  bottom: REGIONS.bottom.share,
} as const;

export function calculateAnimalProjectionAcceleration(input: AnimalProjectionInput): number {
  const volatility = clamp(input.volatility, 0, 1);
  const tension = clamp(input.tension, 0, 1);
  const syncOrder = clamp(input.syncOrder, 0, 1);
  const attractorStrength = clamp(input.attractorStrength, 0, 1);
  const braidTension = clamp(input.braidTension, 0, 1);
  const directionalStrength = clamp(input.directionalStrength, 0, 1);

  return clamp(
    0.65
      + volatility * 1.15
      + tension * 0.55
      + syncOrder * 0.9
      + attractorStrength * 0.85
      + braidTension * 0.35
      + directionalStrength * 0.55,
    0.5,
    4.5,
  );
}

export function buildAnimalMirrorCells(
  width: number,
  height: number,
  input: AnimalProjectionInput,
): AnimalMirrorCell[] {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const countPerSide = 24;
  const axisX = safeWidth / 2;
  const maxReach = Math.max(20, Math.min(safeWidth * 0.34, 190));
  const maxY = safeHeight * (1 - RETROGRID_VERTICAL_PLAY.bottom);
  const minY = safeHeight * RETROGRID_VERTICAL_PLAY.top;
  const phaseOrigin = Number.isFinite(input.meanPhase) ? input.meanPhase : 0;
  const braidTension = clamp(input.braidTension, 0, 1);
  const attractorStrength = clamp(input.attractorStrength, 0, 1);
  const directionalStrength = clamp(input.directionalStrength, 0, 1);

  return Array.from({ length: countPerSide * 2 }, (_, id) => {
    const side: -1 | 1 = id < countPerSide ? -1 : 1;
    const localIndex = id % countPerSide;
    const normalized = localIndex / (countPerSide - 1);
    const sharedPhase = phaseOrigin + localIndex * 2.399963229728653;
    const phase = sharedPhase + side * braidTension * 0.7;
    const spread = 0.24 + attractorStrength * 0.2
      + (0.5 + 0.5 * Math.sin(sharedPhase)) * (0.36 + braidTension * 0.2);
    const reach = maxReach * spread;

    return {
      id,
      side,
      x: axisX + side * reach,
      y: minY + normalized * (maxY - minY),
      phase,
      energy: clamp(
        0.18 + attractorStrength * 0.42 + directionalStrength * 0.22
          + Math.abs(Math.sin(phase)) * 0.18,
        0,
        1,
      ),
    };
  });
}

export function reverseDetectAnimalCandies(
  width: number,
  height: number,
  projection: AnimalProjectionInput,
  cure: AnimalCandyInput,
): ReverseTrackedCandy[] {
  const cells = buildAnimalMirrorCells(width, height, projection);
  const arcana = cure.arcanaParameters.length > 0
    ? cure.arcanaParameters
    : [{ id: 0, name: 'Unresolved Arcana', angle: 0, volatilityAffinity: 0.5, tensionAffinity: 0.5 }];
  const volatility = clamp(cure.volatilityIndex, 0, 1);
  const timeframeSpeed = TIMEFRAME_SPEED[cure.timeframe];
  const placeholderScale = cure.placeholderState === '(expand)' ? 1.32
    : cure.placeholderState === '(extend)' ? 1.18
      : cure.placeholderState === '◻︎' ? 0.76
        : cure.placeholderState === '⚪︎' ? 0.9 : 1;
  const radialCapacity = Math.max(12, Math.min(width * 0.055, 34));
  const verticalCapacity = height * (RETROGRID_VERTICAL_PLAY.top + RETROGRID_VERTICAL_PLAY.bottom) * 0.34;
  const tension = clamp(projection.tension, 0, 1);

  return cells.flatMap((cell, cellIndex) => {
    const z = 1 - (2 * (cellIndex + 0.5)) / 48;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const baseAngle = GOLDEN_ANGLE * cellIndex;

    return LAYER_NAMES.flatMap((layer, layerIndex) =>
      ([['upper', 1], ['lower', -1]] as const).map(([polarity, polaritySign]) => {
        const sourceCellId = (cellIndex * 7 + layerIndex * 13 + (polaritySign < 0 ? 23 : 0)) % 48;
        const host = cells[sourceCellId] ?? cell;
        const arcanaIndex = (cellIndex * 4 + layerIndex * 2 + (polaritySign < 0 ? 1 : 0)) % arcana.length;
        const archetype = arcana[arcanaIndex]!;
        const angle = baseAngle
          + layerIndex * Math.PI / 2
          + polaritySign * (0.28 + tension * 0.24)
          + (archetype.angle * Math.PI / 180) * 0.08;
        const affinity = clamp(
          archetype.volatilityAffinity * volatility + archetype.tensionAffinity * tension,
          0,
          1,
        );
        const scatter = radialCapacity
          * (0.3 + volatility * 0.42 + affinity * 0.28)
          * placeholderScale;
        const mirrorOffset = Math.cos(angle) * scatter;
        const phase = projection.meanPhase
          + angle
          + layerIndex * timeframeSpeed * 0.17;
        const yJitter = Math.sin(phase) * verticalCapacity
          * (0.22 + volatility * 0.42 + affinity * 0.28)
          * placeholderScale;
        const x = clamp(
          host.x + mirrorOffset + Math.sin(phase) * scatter * 0.28,
          2,
          Math.max(2, width - 2),
        );
        const y = clamp(
          host.y + yJitter,
          height * RETROGRID_VERTICAL_PLAY.top,
          height * (1 - RETROGRID_VERTICAL_PLAY.bottom),
        );
        const energy = clamp(
          0.2 + host.energy * 0.38 + affinity * 0.25
            + Math.abs(Math.sin(phase)) * 0.17,
          0,
          1,
        );

        return {
          id: `animal-candy-${cellIndex}-${layer}-${polarity}`,
          sourceCellId,
          layer,
          polarity,
          arcanaId: archetype.id,
          arcanaName: archetype.name,
          x,
          y,
          radius: 1.25 + energy * 1.9,
          phase,
          energy,
          hue: (archetype.angle + 360 + (layerIndex - 1.5) * 17) % 360,
        };
      }),
    );
  });
}
