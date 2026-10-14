export type CandyPoint = {
  id: string;
  cell_index: number;
  layer: 'surge' | 'continuation' | 'range' | 'plunge';
  pole: 'upper' | 'lower';
  t: number;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  contact_distance: number;
  probability: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  tarot: {
    id: number;
    name: string;
    variance_multiplier: number;
    directional_bias: number;
  };
};

export type CandyPointsResponse = {
  meta: {
    cell_count: number;
    layers: string[];
    poles: string[];
    total_points: number;
    current_price: number;
    radius: number;
    turns: number;
    momentum?: number;
    volatility?: number;
  };
  candies: CandyPoint[];
};

export const LAYER_COLORS: Record<CandyPoint['layer'], { base: string; emissive: string; hex: number }> = {
  surge: { base: '#ffd700', emissive: '#ffaa00', hex: 0xffd700 },
  continuation: { base: '#00f5ff', emissive: '#00a3ff', hex: 0x00f5ff },
  range: { base: '#38ef7d', emissive: '#10b981', hex: 0x38ef7d },
  plunge: { base: '#f43f5e', emissive: '#a855f7', hex: 0xf43f5e },
};

export const LAYER_CONFIG: Record<CandyPoint['layer'], { slope: number; rangeFactor: number; phase: number }> = {
  surge: { slope: 1.85, rangeFactor: 1.35, phase: 0 },
  continuation: { slope: 1.0, rangeFactor: 0.95, phase: Math.PI / 2 },
  range: { slope: 0.0, rangeFactor: 0.58, phase: Math.PI },
  plunge: { slope: -1.85, rangeFactor: 1.35, phase: (3 * Math.PI) / 2 },
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function generateLocalCandyPoints(currentPrice = 65000, radius = 2.4, turns = 3.0): CandyPoint[] {
  const cells: Array<[number, number, number]> = [];
  for (let i = 0; i < 48; i++) {
    const z = 1.0 - (2.0 * (i + 0.5)) / 48;
    const rXy = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = GOLDEN_ANGLE * i;
    cells.push([rXy * Math.cos(theta), rXy * Math.sin(theta), z]);
  }

  const layers: CandyPoint['layer'][] = ['surge', 'continuation', 'range', 'plunge'];
  const poles: CandyPoint['pole'][] = ['upper', 'lower'];
  const candies: CandyPoint[] = [];

  const tarotNames = [
    'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
    'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
    'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
    'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World',
  ];

  layers.forEach((layer, layerIndex) => {
    const config = LAYER_CONFIG[layer];
    const drift = Math.tanh(config.slope);

    cells.forEach((cell, cellIndex) => {
      poles.forEach((pole, poleIndex) => {
        // Deterministic parameter t based on cell and pole
        const t = Math.max(0.05, Math.min(0.98, ((cellIndex * 7 + layerIndex * 13 + poleIndex * 23) % 97) / 97));
        const zStar = drift * t;
        const rXyStar = Math.sqrt(Math.max(0, 1 - zStar * zStar));
        const phiStar = config.phase + 2 * Math.PI * turns * t;
        const nx = rXyStar * Math.cos(phiStar);
        const ny = rXyStar * Math.sin(phiStar);
        const nz = zStar;

        const growth = 1.0 + config.rangeFactor * 0.45 * t;
        const arcanaId = (cellIndex * 4 + layerIndex * 2 + poleIndex) % tarotNames.length;
        const probability = 0.4 + 0.55 * Math.sin(t * Math.PI) * (0.8 + (cellIndex % 5) * 0.05);

        candies.push({
          id: `candy-${layer}-${cellIndex.toString().padStart(2, '0')}-${pole}`,
          cell_index: cellIndex,
          layer,
          pole,
          t,
          position: {
            x: nx * growth * radius,
            y: nz * growth * radius,
            z: ny * growth * radius,
          },
          normal: {
            x: nx,
            y: nz,
            z: ny,
          },
          contact_distance: 0.15 + 0.25 * ((cellIndex + layerIndex) % 4) / 4,
          probability: Math.max(0.1, Math.min(0.98, probability)),
          direction: nz > 0.08 ? 'bullish' : nz < -0.08 ? 'bearish' : 'neutral',
          tarot: {
            id: arcanaId,
            name: tarotNames[arcanaId],
            variance_multiplier: 0.85,
            directional_bias: nz,
          },
        });
      });
    });
  });

  return candies;
}
