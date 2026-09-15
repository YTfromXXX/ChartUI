'use client';

import { create } from 'zustand';
import type { MarketData } from '@/hooks/useMarketStream';

export type AffinityPortfolioSlot = {
  symbol: string;
  phase: string;
  volatility: number;
};

export type AffinityResult = {
  score: number;
  reason: string;
};

export type AffinityMarket = Pick<MarketData, 'symbol' | 'rsi_tension' | 's15_delta' | 'wuxing_phase' | 'tarot_attribute' | 'rendered_physics'>;

const initialPortfolio: AffinityPortfolioSlot[] = [
  { symbol: 'BTCUSD', phase: 'FIRE', volatility: 0.72 },
  { symbol: 'DOGEUSD', phase: 'WOOD', volatility: 0.92 },
  { symbol: 'AAPL', phase: 'METAL', volatility: 0.28 },
  { symbol: 'ETHUSD', phase: 'WATER', volatility: 0.65 },
  { symbol: 'XAUUSD', phase: 'EARTH', volatility: 0.18 },
];

export const useAffinityPortfolio = create<{ slots: AffinityPortfolioSlot[] }>(() => ({ slots: initialPortfolio }));

const complementaryPhases: Record<string, string[]> = {
  FIRE: ['WATER', 'EARTH'],
  WATER: ['FIRE', 'METAL'],
  WOOD: ['METAL', 'EARTH'],
  EARTH: ['WOOD', 'WATER'],
  METAL: ['WOOD', 'FIRE'],
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function marketVolatility(market: AffinityMarket): number {
  const tension = Math.abs(market.rsi_tension ?? market.rendered_physics?.tension_t ?? 0);
  const delta = Math.min(Math.abs(market.s15_delta ?? 0) / 100, 1);
  return clamp(tension * 0.7 + delta * 0.3);
}

export function calculateAffinity(slots: AffinityPortfolioSlot[], market?: AffinityMarket): AffinityResult {
  if (!market) return { score: 0, reason: 'Awaiting live signal' };

  const targetPhase = (market.tarot_attribute?.element ?? market.wuxing_phase ?? 'EARTH').toUpperCase();
  const targetVolatility = marketVolatility(market);
  let bestScore = 0;
  let bestReason = 'Balanced signal profile';

  slots.forEach((slot) => {
    const volatilityGap = Math.abs(slot.volatility - targetVolatility);
    const volatilityComplement = clamp(1 - volatilityGap);
    const phaseBonus = complementaryPhases[slot.phase.toUpperCase()]?.includes(targetPhase) ? 0.28 : 0.08;
    const score = clamp(volatilityComplement * 0.62 + phaseBonus + (targetVolatility < 0.45 && slot.volatility > 0.65 ? 0.1 : 0));

    if (score > bestScore) {
      bestScore = score;
      bestReason = targetVolatility < 0.45 && slot.volatility > 0.65
        ? 'Compensates Portfolio Volatility'
        : phaseBonus > 0.1
          ? `${slot.phase} + ${targetPhase} Elemental Synergy`
          : 'Aligned Signal Profile';
    }
  });

  return { score: bestScore, reason: bestReason };
}

export function useAffinityRadar(markets: AffinityMarket[]): Map<string, AffinityResult> {
  const slots = useAffinityPortfolio((state) => state.slots);
  return new Map(markets.map((market) => [market.symbol, calculateAffinity(slots, market)]));
}
