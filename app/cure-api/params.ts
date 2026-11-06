// Free-form parameter sheet for /cure-api (experimental, tune freely).
// A "cell" is a point that converges into the sphere; its court role decides the shell
// it settles on, how strongly it is pulled, and its colour.

export type CourtRole = 'KING' | 'QUEEN' | 'KNIGHT' | 'PAGE' | 'EX';

export type RoleParams = {
  glyph: string;
  /** Share of cells assigned to the role (normalised at runtime). */
  weight: number;
  /** Shell radius as a fraction of the sphere radius (0 = core, 1 = surface). */
  shell: number;
  /** Pull strength toward the shell; higher converges faster. */
  pull: number;
  /** Tangential swirl; positive = clockwise seen from +Y. */
  swirl: number;
  /** Position jitter, as a fraction of the sphere radius. */
  jitter: number;
  hue: number;
  /** Matrix effect each role maps to (lib/arcanaMatrix archetypes). */
  archetype: 'inertia' | 'equilibrium' | 'flow' | 'volatility' | 'rupture';
};

export const ROLES: Record<CourtRole, RoleParams> = {
  KING: { glyph: '♚', weight: 0.08, shell: 0.12, pull: 1.4, swirl: 0.1, jitter: 0.03, hue: 48, archetype: 'inertia' },
  QUEEN: { glyph: '♛', weight: 0.12, shell: 0.3, pull: 1.1, swirl: -0.25, jitter: 0.05, hue: 300, archetype: 'equilibrium' },
  KNIGHT: { glyph: '♞', weight: 0.25, shell: 0.62, pull: 0.8, swirl: 0.9, jitter: 0.08, hue: 190, archetype: 'flow' },
  PAGE: { glyph: '♟', weight: 0.35, shell: 0.85, pull: 0.55, swirl: 0.35, jitter: 0.1, hue: 140, archetype: 'volatility' },
  EX: { glyph: '✕', weight: 0.2, shell: 1.0, pull: 0.3, swirl: -0.7, jitter: 0.18, hue: 0, archetype: 'rupture' },
};

export const GLOBAL = {
  cellCount: 1800,
  /** Sphere radius in px at zoom 1. */
  sphereRadius: 220,
  /** Core density -> overall convergence speed multiplier. */
  density: 0.6,
  /** Seconds for the full cycle of the breathing (diastole/systole) of the shell. */
  breathPeriod: 9,
  breathDepth: 0.08,
  /** Self-healing: fraction of EX cells re-seeded each second into the PAGE shell. */
  cureRate: 0.04,
  rotationSpeed: 0.12,
};

export type CureState = typeof GLOBAL;
