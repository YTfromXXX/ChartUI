export type ArcanaArchetype = 'volatility' | 'inertia' | 'flow' | 'rupture' | 'equilibrium';

export type ArcanaAttractor = {
  id: number;
  roman: string;
  name: string;
  symbol: string;
  x: number;
  y: number;
  z: number;
  archetype: ArcanaArchetype;
  volatilityAffinity: number;
  tensionAffinity: number;
  rigidityAffinity: number;
  destructiveAffinity: number;
};

const ARCANA: readonly Omit<ArcanaAttractor, 'x' | 'y' | 'z'>[] = [
  { id: 0, roman: '0', name: 'The Fool', symbol: '✧', archetype: 'volatility', volatilityAffinity: 1, tensionAffinity: 0.75, rigidityAffinity: 0.1, destructiveAffinity: 0.4 },
  { id: 1, roman: 'I', name: 'The Magician', symbol: '⌘', archetype: 'flow', volatilityAffinity: 0.5, tensionAffinity: 0.72, rigidityAffinity: 0.45, destructiveAffinity: 0.15 },
  { id: 2, roman: 'II', name: 'The High Priestess', symbol: '☾', archetype: 'equilibrium', volatilityAffinity: 0.2, tensionAffinity: 0.3, rigidityAffinity: 0.65, destructiveAffinity: 0.05 },
  { id: 3, roman: 'III', name: 'The Empress', symbol: '❋', archetype: 'flow', volatilityAffinity: 0.3, tensionAffinity: 0.55, rigidityAffinity: 0.3, destructiveAffinity: 0.05 },
  { id: 4, roman: 'IV', name: 'The Emperor', symbol: '▣', archetype: 'inertia', volatilityAffinity: 0.1, tensionAffinity: 0.45, rigidityAffinity: 1, destructiveAffinity: 0.1 },
  { id: 5, roman: 'V', name: 'The Hierophant', symbol: '⌂', archetype: 'inertia', volatilityAffinity: 0.18, tensionAffinity: 0.4, rigidityAffinity: 0.8, destructiveAffinity: 0.08 },
  { id: 6, roman: 'VI', name: 'The Lovers', symbol: '⋈', archetype: 'equilibrium', volatilityAffinity: 0.42, tensionAffinity: 0.58, rigidityAffinity: 0.36, destructiveAffinity: 0.12 },
  { id: 7, roman: 'VII', name: 'The Chariot', symbol: '➤', archetype: 'flow', volatilityAffinity: 0.58, tensionAffinity: 0.88, rigidityAffinity: 0.65, destructiveAffinity: 0.22 },
  { id: 8, roman: 'VIII', name: 'Strength', symbol: '∞', archetype: 'inertia', volatilityAffinity: 0.25, tensionAffinity: 0.7, rigidityAffinity: 0.82, destructiveAffinity: 0.12 },
  { id: 9, roman: 'IX', name: 'The Hermit', symbol: '◇', archetype: 'equilibrium', volatilityAffinity: 0.22, tensionAffinity: 0.28, rigidityAffinity: 0.7, destructiveAffinity: 0.06 },
  { id: 10, roman: 'X', name: 'Wheel of Fortune', symbol: '⟳', archetype: 'volatility', volatilityAffinity: 0.88, tensionAffinity: 0.76, rigidityAffinity: 0.32, destructiveAffinity: 0.52 },
  { id: 11, roman: 'XI', name: 'Justice', symbol: '⚖', archetype: 'equilibrium', volatilityAffinity: 0.24, tensionAffinity: 0.5, rigidityAffinity: 0.8, destructiveAffinity: 0.1 },
  { id: 12, roman: 'XII', name: 'The Hanged Man', symbol: '⟲', archetype: 'equilibrium', volatilityAffinity: 0.48, tensionAffinity: 0.35, rigidityAffinity: 0.42, destructiveAffinity: 0.18 },
  { id: 13, roman: 'XIII', name: 'Death', symbol: '†', archetype: 'rupture', volatilityAffinity: 0.92, tensionAffinity: 0.96, rigidityAffinity: 0.18, destructiveAffinity: 0.95 },
  { id: 14, roman: 'XIV', name: 'Temperance', symbol: '⚗', archetype: 'equilibrium', volatilityAffinity: 0.14, tensionAffinity: 0.36, rigidityAffinity: 0.65, destructiveAffinity: 0.04 },
  { id: 15, roman: 'XV', name: 'The Devil', symbol: '⛓', archetype: 'rupture', volatilityAffinity: 0.68, tensionAffinity: 0.9, rigidityAffinity: 0.35, destructiveAffinity: 0.72 },
  { id: 16, roman: 'XVI', name: 'The Tower', symbol: 'ϟ', archetype: 'rupture', volatilityAffinity: 1, tensionAffinity: 1, rigidityAffinity: 0.05, destructiveAffinity: 1 },
  { id: 17, roman: 'XVII', name: 'The Star', symbol: '✦', archetype: 'flow', volatilityAffinity: 0.35, tensionAffinity: 0.48, rigidityAffinity: 0.38, destructiveAffinity: 0.08 },
  { id: 18, roman: 'XVIII', name: 'The Moon', symbol: '☽', archetype: 'volatility', volatilityAffinity: 0.78, tensionAffinity: 0.56, rigidityAffinity: 0.2, destructiveAffinity: 0.4 },
  { id: 19, roman: 'XIX', name: 'The Sun', symbol: '☼', archetype: 'flow', volatilityAffinity: 0.38, tensionAffinity: 0.62, rigidityAffinity: 0.5, destructiveAffinity: 0.08 },
  { id: 20, roman: 'XX', name: 'Judgement', symbol: '⌁', archetype: 'flow', volatilityAffinity: 0.66, tensionAffinity: 0.84, rigidityAffinity: 0.3, destructiveAffinity: 0.48 },
  { id: 21, roman: 'XXI', name: 'The World', symbol: '◎', archetype: 'equilibrium', volatilityAffinity: 0.18, tensionAffinity: 0.58, rigidityAffinity: 0.88, destructiveAffinity: 0.08 },
];

const PHI = (1 + Math.sqrt(5)) / 2;

export const ARCANA_ATTRACTORS: readonly ArcanaAttractor[] = ARCANA.map((arcana) => {
  const radius = 0.82 * Math.sqrt((arcana.id + 0.5) / ARCANA.length);
  const angle = arcana.id * 2 * Math.PI / (PHI * PHI);
  return {
    ...arcana,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: (arcana.id - 10.5) / 10.5 * 0.35,
  };
});

export type MatrixPoint = { x: number; y: number; z?: number };

export type ResonanceResult = {
  arcana: ArcanaAttractor;
  distance: number;
  midpoint: MatrixPoint;
  destructiveAffinity: number;
  normalizedStrength: number;
};

export function findResonatingArcana(midpoint: MatrixPoint): ResonanceResult {
  let closest = ARCANA_ATTRACTORS[0];
  let minimumDistance = Number.POSITIVE_INFINITY;
  for (const attractor of ARCANA_ATTRACTORS) {
    const distance = Math.hypot(
      midpoint.x - attractor.x,
      midpoint.y - attractor.y,
      (midpoint.z ?? 0) - attractor.z,
    );
    if (distance < minimumDistance) {
      closest = attractor;
      minimumDistance = distance;
    }
  }
  return {
    arcana: closest,
    distance: minimumDistance,
    midpoint,
    destructiveAffinity: closest.destructiveAffinity,
    normalizedStrength: Math.max(0, 1 - minimumDistance / 1.25),
  };
}
