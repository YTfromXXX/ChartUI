export type AnimalProjectionInput = {
  volatility: number;
  tension: number;
  syncOrder: number;
  attractorStrength: number;
  braidTension: number;
  meanPhase: number;
  directionalStrength: number;
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
  const maxY = safeHeight * 0.92;
  const minY = safeHeight * 0.08;
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
