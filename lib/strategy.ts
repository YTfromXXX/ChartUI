export type CourtCard = 'Knight' | 'Queen' | 'King';

export type StrategyContract = {
  symbol: string;
  manaLimit: number;
  syncLevel: number;
  courtCard: CourtCard;
  hexagramBinary: string;
  lockedAt: number;
};

export const STRATEGY_CONTRACT_KEY = 'chartui.strategy.contract';

function isCourtCard(value: unknown): value is CourtCard {
  return value === 'Knight' || value === 'Queen' || value === 'King';
}

export function parseStrategyContract(value: string | null): StrategyContract | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const contract = parsed as Record<string, unknown>;
    if (
      typeof contract.symbol !== 'string' ||
      typeof contract.manaLimit !== 'number' ||
      typeof contract.syncLevel !== 'number' ||
      !isCourtCard(contract.courtCard) ||
      typeof contract.hexagramBinary !== 'string' ||
      typeof contract.lockedAt !== 'number'
    ) return null;

    return {
      symbol: contract.symbol,
      manaLimit: contract.manaLimit,
      syncLevel: contract.syncLevel,
      courtCard: contract.courtCard,
      hexagramBinary: contract.hexagramBinary,
      lockedAt: contract.lockedAt,
    };
  } catch {
    return null;
  }
}