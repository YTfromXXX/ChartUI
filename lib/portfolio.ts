export type TransitionRoute = 'voxel' | 'lens';

export type PortfolioProfile = {
  diversification: number;
  volatility: number;
  totalAssetDeviation: number;
  positions: Array<{
    symbol: string;
    phase: string;
    volatility: number;
  }>;
};

export type ResonanceMarket = {
  symbol?: string;
  s15Delta?: number;
  renderedPhysics?: { complexity_c?: number };
  isEmperorSynchronized?: boolean;
};

export const demoPortfolio: PortfolioProfile = {
  diversification: 0.72,
  volatility: 0.46,
  totalAssetDeviation: 0.18,
  positions: [
    { symbol: 'BTCUSD', phase: 'FIRE', volatility: 0.72 },
    { symbol: 'EURUSD', phase: 'WATER', volatility: 0.24 },
    { symbol: 'XAUUSD', phase: 'EARTH', volatility: 0.18 },
  ],
};

export function calculateResonance(portfolio: PortfolioProfile, market?: ResonanceMarket): number {
  if (!market) return 0.34;

  const deltaSignal = Math.min(Math.abs(market.s15Delta ?? 0) / 100, 1);
  const complexitySignal = Math.min(Math.abs(market.renderedPhysics?.complexity_c ?? 0), 1);
  const synchronizationBonus = market.isEmperorSynchronized ? 0.18 : 0;
  const stability = 1 - Math.min(Math.abs(portfolio.volatility - (deltaSignal * 0.55 + complexitySignal * 0.45)), 1);

  return Math.max(0, Math.min(1, stability * 0.62 + portfolio.diversification * 0.2 + synchronizationBonus));
}

export function getTransitionRoute(resonance: number): TransitionRoute {
  return resonance >= 0.58 ? 'lens' : 'voxel';
}