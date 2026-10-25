import type { FieldKind } from '@/lib/fieldModels';

export type MarketAssetClass =
  | 'agriculture'
  | 'energy'
  | 'metal'
  | 'equity'
  | 'currency'
  | 'crypto'
  | 'index'
  | 'rates'
  | 'economic';

export type MarketTimeframe = '1s' | '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1M' | 'event';
export type MarketSourceKind = 'official_api' | 'public_dataset' | 'licensed_vendor' | 'synthetic';
export type MarketField = FieldKind;

export type MatrixRole = {
  arcanaId: number;
  arcanaName: string;
  function: string;
  fields: readonly MarketField[];
  candy: {
    mass: number;
    rigidity: number;
    vibration: number;
    radialScale: number;
  };
};

export type MarketCandidate = {
  symbol: string;
  label: string;
  assetClass: MarketAssetClass;
  providerSymbols: Readonly<Partial<Record<'twelveData' | 'alphaVantage' | 'coinGecko' | 'fred', string>>>;
  fields: readonly MarketField[];
  roleIds: readonly number[];
  candidateTimeframes: readonly MarketTimeframe[];
  preferredTimeframe: MarketTimeframe;
  sourceKinds: readonly MarketSourceKind[];
  currency: string;
  notes: string;
};

export type MarketDataContract = {
  symbol: string;
  value: number;
  currency: string;
  timeframe: MarketTimeframe;
  source: { kind: MarketSourceKind; provider: string; instrument?: string };
  observedAt: number;
  receivedAt: number;
  expectedIntervalMs: number;
  maxAgeMs: number;
  quality: 'live' | 'delayed' | 'stale' | 'synthetic';
  composition?: { version: string; coverage: number; contributors: readonly string[] };
};

export type ContractStatus = {
  valid: boolean;
  fresh: boolean;
  ageMs: number;
  reason?: 'invalid-value' | 'invalid-timestamp' | 'invalid-contract' | 'future-observation' | 'stale-observation';
};

export type SyntheticConstituent = {
  symbol: string;
  weight: number;
  basePrice: number;
  currencyDirection?: 1 | -1;
};

export type SyntheticIndexDefinition = {
  symbol: string;
  name: string;
  version: string;
  baseValue: number;
  timeframe: MarketTimeframe;
  maxAgeMs: number;
  minimumCoverage: number;
  constituents: readonly SyntheticConstituent[];
  rule: 'weighted-log-return';
};

export type SyntheticIndexResult = {
  value: number;
  returnLog: number;
  coverage: number;
  timestamp: number;
  contributions: Array<{ symbol: string; normalizedWeight: number; logReturn: number }>;
};

export function timeframeIntervalMs(timeframe: MarketTimeframe): number {
  switch (timeframe) {
    case '1s': return 1_000;
    case '1m': return 60_000;
    case '5m': return 5 * 60_000;
    case '15m': return 15 * 60_000;
    case '1h': return 60 * 60_000;
    case '1d': return 24 * 60 * 60_000;
    case '1w': return 7 * 24 * 60 * 60_000;
    case '1M': return 30 * 24 * 60 * 60_000;
    case 'event': return 0;
  }
}

const liquidIntraday: readonly MarketTimeframe[] = ['1m', '5m', '15m', '1h', '1d'];
const slowMarkets: readonly MarketTimeframe[] = ['1d', '1w', '1M'];
const cryptoTimeframes: readonly MarketTimeframe[] = ['1s', '1m', '5m', '15m', '1h', '1d'];

export const MATRIX_ROLES: readonly MatrixRole[] = [
  { arcanaId: 0, arcanaName: 'The Fool', function: 'volatility extremes and regime transitions', fields: ['crypto', 'animal'], candy: { mass: 0.65, rigidity: 0.15, vibration: 0.95, radialScale: 1.12 } },
  { arcanaId: 1, arcanaName: 'The Magician', function: 'liquidity and cross-asset impulse', fields: ['crypto', 'meta'], candy: { mass: 0.9, rigidity: 0.35, vibration: 0.65, radialScale: 1.04 } },
  { arcanaId: 2, arcanaName: 'The High Priestess', function: 'latent volatility and delayed information', fields: ['metal', 'meta'], candy: { mass: 0.8, rigidity: 0.55, vibration: 0.28, radialScale: 0.98 } },
  { arcanaId: 3, arcanaName: 'The Empress', function: 'agricultural growth and soft commodities', fields: ['animal'], candy: { mass: 1.05, rigidity: 0.3, vibration: 0.32, radialScale: 1.08 } },
  { arcanaId: 4, arcanaName: 'The Emperor', function: 'high-rigidity benchmark and policy anchors', fields: ['meta'], candy: { mass: 1.55, rigidity: 0.95, vibration: 0.08, radialScale: 0.96 } },
  { arcanaId: 5, arcanaName: 'The Hierophant', function: 'rates, rules, and regulated markets', fields: ['meta', 'metal'], candy: { mass: 1.3, rigidity: 0.8, vibration: 0.12, radialScale: 0.98 } },
  { arcanaId: 6, arcanaName: 'The Lovers', function: 'paired-market correlation and spread behavior', fields: ['animal', 'meta'], candy: { mass: 0.95, rigidity: 0.45, vibration: 0.36, radialScale: 1.02 } },
  { arcanaId: 7, arcanaName: 'The Chariot', function: 'directional momentum and trend persistence', fields: ['animal', 'crypto'], candy: { mass: 1.1, rigidity: 0.62, vibration: 0.5, radialScale: 1.1 } },
  { arcanaId: 8, arcanaName: 'Strength', function: 'depth, resilience, and drawdown recovery', fields: ['metal', 'meta'], candy: { mass: 1.45, rigidity: 0.85, vibration: 0.12, radialScale: 1.02 } },
  { arcanaId: 9, arcanaName: 'The Hermit', function: 'slow signals and long-horizon observations', fields: ['metal', 'meta'], candy: { mass: 1.1, rigidity: 0.7, vibration: 0.06, radialScale: 0.94 } },
  { arcanaId: 10, arcanaName: 'Wheel of Fortune', function: 'cyclical regimes and cross-market rotation', fields: ['animal', 'crypto', 'meta'], candy: { mass: 0.95, rigidity: 0.4, vibration: 0.55, radialScale: 1.08 } },
  { arcanaId: 11, arcanaName: 'Justice', function: 'relative value and mean-reversion balance', fields: ['meta', 'metal'], candy: { mass: 1.2, rigidity: 0.76, vibration: 0.14, radialScale: 0.98 } },
  { arcanaId: 12, arcanaName: 'The Hanged Man', function: 'stale prints, halted markets, and liquidity gaps', fields: ['metal', 'animal', 'meta'], candy: { mass: 0.75, rigidity: 0.5, vibration: 0.22, radialScale: 0.9 } },
  { arcanaId: 13, arcanaName: 'Death', function: 'structural breaks and rapid regime change', fields: ['metal', 'crypto'], candy: { mass: 1.35, rigidity: 0.2, vibration: 0.85, radialScale: 1.16 } },
  { arcanaId: 14, arcanaName: 'Temperance', function: 'diversification and volatility dampening', fields: ['animal', 'meta'], candy: { mass: 1.25, rigidity: 0.78, vibration: 0.1, radialScale: 0.96 } },
  { arcanaId: 15, arcanaName: 'The Devil', function: 'leverage, crowded positioning, and squeeze risk', fields: ['crypto', 'metal'], candy: { mass: 1.05, rigidity: 0.22, vibration: 0.78, radialScale: 1.14 } },
  { arcanaId: 16, arcanaName: 'The Tower', function: 'flash crashes, dislocations, and shock propagation', fields: ['metal', 'crypto', 'animal'], candy: { mass: 1.5, rigidity: 0.12, vibration: 1, radialScale: 1.2 } },
  { arcanaId: 17, arcanaName: 'The Star', function: 'recovery, breadth, and risk appetite', fields: ['crypto', 'meta'], candy: { mass: 0.9, rigidity: 0.5, vibration: 0.28, radialScale: 1.05 } },
  { arcanaId: 18, arcanaName: 'The Moon', function: 'uncertainty, sentiment, and noisy discovery', fields: ['animal', 'crypto'], candy: { mass: 0.7, rigidity: 0.18, vibration: 0.9, radialScale: 1.1 } },
  { arcanaId: 19, arcanaName: 'The Sun', function: 'breadth confirmation and synchronized advance', fields: ['animal', 'meta'], candy: { mass: 1.15, rigidity: 0.68, vibration: 0.3, radialScale: 1.08 } },
  { arcanaId: 20, arcanaName: 'Judgement', function: 'macro releases and event repricing', fields: ['metal', 'meta', 'animal'], candy: { mass: 1.25, rigidity: 0.58, vibration: 0.64, radialScale: 1.06 } },
  { arcanaId: 21, arcanaName: 'The World', function: 'global breadth and completed market cycles', fields: ['meta', 'animal', 'crypto'], candy: { mass: 1.4, rigidity: 0.82, vibration: 0.16, radialScale: 1 } },
];

const candidate = (
  symbol: string,
  label: string,
  assetClass: MarketAssetClass,
  fields: readonly MarketField[],
  roleIds: readonly number[],
  providerSymbols: MarketCandidate['providerSymbols'],
  supportedTimeframes: readonly MarketTimeframe[],
  preferredTimeframe: MarketTimeframe,
  notes: string,
): MarketCandidate => ({
  symbol, label, assetClass, fields, roleIds, providerSymbols, candidateTimeframes: supportedTimeframes,
  preferredTimeframe, sourceKinds: ['official_api', 'licensed_vendor', 'synthetic'], currency: 'USD', notes,
});

export const MARKET_CANDIDATE_CATALOG: readonly MarketCandidate[] = [
  candidate('SOYBEAN', 'Soybeans', 'agriculture', ['animal'], [3, 6, 10, 19], { twelveData: 'SOYBEAN', alphaVantage: 'SOYBEAN' }, slowMarkets, '1d', 'Commodity venue and vendor symbol availability varies; confirm before enabling a live adapter.'),
  candidate('WHEAT', 'Wheat', 'agriculture', ['animal'], [3, 6, 12, 19], { twelveData: 'WHEAT', alphaVantage: 'WHEAT' }, slowMarkets, '1d', 'Commodity benchmark; use a licensed futures or delayed-data feed where required.'),
  candidate('CORN', 'Corn', 'agriculture', ['animal'], [3, 6, 10, 19], { twelveData: 'CORN', alphaVantage: 'CORN' }, slowMarkets, '1d', 'Commodity benchmark; continuous futures construction must be documented.'),
  candidate('OATS', 'Oats', 'agriculture', ['animal'], [3, 12, 18], { twelveData: 'OATS' }, slowMarkets, '1d', 'Thinly covered contract; retain source and roll methodology.'),
  candidate('SUGAR', 'Sugar', 'agriculture', ['animal'], [3, 10, 20], { alphaVantage: 'SUGAR' }, slowMarkets, '1d', 'Soft commodity; public availability and delay depend on provider plan.'),
  candidate('COFFEE', 'Coffee', 'agriculture', ['animal'], [3, 7, 18], { alphaVantage: 'COFFEE' }, slowMarkets, '1d', 'Soft commodity benchmark.'),
  candidate('WTI', 'WTI crude oil', 'energy', ['animal', 'metal'], [6, 7, 10, 16], { twelveData: 'WTI', alphaVantage: 'WTI' }, slowMarkets, '1d', 'Energy proxy; spot and futures series are not interchangeable.'),
  candidate('BRENT', 'Brent crude oil', 'energy', ['animal', 'meta'], [6, 10, 20], { alphaVantage: 'BRENT' }, slowMarkets, '1d', 'Global oil benchmark; note provider benchmark methodology.'),
  candidate('NATGAS', 'Natural gas', 'energy', ['animal', 'metal'], [0, 13, 16], { twelveData: 'NATGAS', alphaVantage: 'NATURAL_GAS' }, slowMarkets, '1d', 'High-volatility seasonal commodity; contract roll creates discontinuities.'),
  candidate('XAUUSD', 'Gold / USD', 'metal', ['metal', 'meta'], [2, 5, 8, 9, 11, 13, 16], { twelveData: 'XAU/USD', alphaVantage: 'XAU' }, ['1m', '5m', '15m', '1h', '1d'], '1h', 'Spot quote unit and timestamp semantics must be checked against the specific provider.'),
  candidate('XAGUSD', 'Silver / USD', 'metal', ['metal'], [8, 13, 15, 16], { twelveData: 'XAG/USD', alphaVantage: 'XAG' }, liquidIntraday, '1h', 'Spot and futures series are separate instruments.'),
  candidate('XPTUSD', 'Platinum / USD', 'metal', ['metal'], [5, 8, 13, 20], { twelveData: 'XPT/USD' }, slowMarkets, '1d', 'Less liquid than gold; prefer hourly/daily monitoring.'),
  candidate('XPDUSD', 'Palladium / USD', 'metal', ['metal'], [13, 15, 16], { twelveData: 'XPD/USD' }, slowMarkets, '1d', 'Supply concentration and thin liquidity may dominate price behavior.'),
  candidate('COPPER', 'Copper', 'metal', ['metal', 'animal'], [3, 6, 7, 19, 20], { twelveData: 'COPPER', alphaVantage: 'COPPER' }, slowMarkets, '1d', 'Copper spot, LME cash, and futures are distinct pricing bases.'),
  candidate('ALUMINUM', 'Aluminum', 'metal', ['metal'], [5, 8, 9, 20], { alphaVantage: 'ALUMINUM' }, slowMarkets, '1d', 'Reference series may be daily/monthly; do not interpolate as live ticks.'),
  candidate('LITHIUM_PROXY', 'Lithium market proxy', 'metal', ['metal'], [2, 12, 13, 20], {}, ['1d', '1w', '1M'], '1w', 'Catalog-only proxy until an explicitly licensed assessment source is selected.'),
  candidate('RARE_EARTH_PROXY', 'Rare-earth price basket', 'metal', ['metal'], [2, 9, 12, 20], {}, ['1d', '1w', '1M'], '1w', 'Synthetic basket candidate; constituents and assessment methodology must be published.'),
  candidate('AAPL', 'Apple', 'equity', ['meta'], [1, 4, 8, 11, 17, 19], { twelveData: 'AAPL', alphaVantage: 'AAPL' }, liquidIntraday, '5m', 'US equity session calendar and provider entitlement apply.'),
  candidate('NVDA', 'NVIDIA', 'equity', ['meta', 'crypto'], [0, 1, 7, 15, 17], { twelveData: 'NVDA', alphaVantage: 'NVDA' }, liquidIntraday, '5m', 'Large-cap semiconductor; volatility is not a direct crypto proxy.'),
  candidate('TSLA', 'Tesla', 'equity', ['meta'], [0, 7, 15, 18], { twelveData: 'TSLA', alphaVantage: 'TSLA' }, liquidIntraday, '5m', 'High beta; split-adjusted history matters for long windows.'),
  candidate('MSFT', 'Microsoft', 'equity', ['meta'], [4, 5, 8, 14, 21], { twelveData: 'MSFT', alphaVantage: 'MSFT' }, liquidIntraday, '5m', 'Large-cap equity; use adjusted prices for return series.'),
  candidate('IWM', 'Russell 2000 ETF', 'index', ['meta'], [0, 6, 7, 10, 17, 19], { twelveData: 'IWM', alphaVantage: 'IWM' }, liquidIntraday, '5m', 'ETF proxy, not the underlying Russell 2000 index value.'),
  candidate('SPY', 'S&P 500 ETF', 'index', ['meta'], [4, 8, 11, 14, 19, 21], { twelveData: 'SPY', alphaVantage: 'SPY' }, liquidIntraday, '5m', 'ETF proxy includes trading-hours effects and tracking error.'),
  candidate('QQQ', 'Nasdaq-100 ETF', 'index', ['meta', 'crypto'], [0, 1, 7, 15, 17], { twelveData: 'QQQ', alphaVantage: 'QQQ' }, liquidIntraday, '5m', 'ETF proxy; holdings concentration should be visible in index metadata.'),
  candidate('SPX', 'S&P 500 index', 'index', ['meta'], [4, 8, 11, 14, 19, 21], { alphaVantage: 'SPX' }, liquidIntraday, '1h', 'Index entitlement and provider-specific symbol mapping must be checked.'),
  candidate('SX5E', 'EURO STOXX 50 index', 'index', ['meta'], [5, 6, 11, 14, 20, 21], { twelveData: 'SX5E' }, liquidIntraday, '1h', 'Regional trading hours differ from US constituents.'),
  candidate('NKY', 'Nikkei 225 index', 'index', ['meta'], [5, 6, 10, 11, 20, 21], { twelveData: 'NKY' }, liquidIntraday, '1h', 'Regional trading hours and currency exposure differ from US constituents.'),
  candidate('VIX', 'CBOE Volatility Index', 'index', ['meta', 'crypto'], [0, 12, 13, 16, 18], { alphaVantage: 'VIX' }, ['1m', '5m', '15m', '1h', '1d'], '5m', 'Index calculation and vendor licensing apply; not a directly tradable asset.'),
  candidate('DXY', 'US Dollar Index', 'currency', ['metal', 'meta'], [5, 9, 11, 20], { twelveData: 'DXY', alphaVantage: 'DXY' }, liquidIntraday, '1h', 'Index vendor symbols and licensing differ; document exact instrument.'),
  candidate('EURUSD', 'Euro / US dollar', 'currency', ['meta'], [6, 11, 14, 21], { twelveData: 'EUR/USD', alphaVantage: 'EUR' }, liquidIntraday, '15m', 'FX quote orientation matters when normalizing basket returns.'),
  candidate('USDJPY', 'US dollar / Japanese yen', 'currency', ['meta'], [6, 11, 20], { twelveData: 'USD/JPY', alphaVantage: 'JPY' }, liquidIntraday, '15m', 'FX is near-24h on weekdays; account for weekend gaps.'),
  candidate('US10Y', '10-year Treasury yield', 'rates', ['meta'], [4, 5, 9, 11, 20], { fred: 'DGS10' }, ['1d', '1w', '1M', 'event'], '1d', 'Yield is a rate, not an asset price; model changes in basis points or normalized returns.'),
  candidate('CPIAUCSL', 'US CPI', 'economic', ['meta'], [2, 5, 9, 12, 20], { fred: 'CPIAUCSL' }, ['1M', 'event'], '1M', 'Monthly release series; preserve observation date and release/vintage date.'),
  candidate('FEDFUNDS', 'Federal funds rate', 'rates', ['meta'], [4, 5, 11, 20], { fred: 'FEDFUNDS' }, ['1M', 'event'], '1M', 'Monthly series; release-time updates are events, not continuous samples.'),
  candidate('BTCUSD', 'Bitcoin / USD', 'crypto', ['crypto', 'meta'], [0, 1, 7, 10, 13, 15, 16, 17, 18, 21], { twelveData: 'BTC/USD', coinGecko: 'bitcoin' }, cryptoTimeframes, '1m', 'Continuous market; exchange venue and quote currency must be explicit.'),
  candidate('ETHUSD', 'Ethereum / USD', 'crypto', ['crypto'], [0, 1, 6, 7, 10, 15, 17], { twelveData: 'ETH/USD', coinGecko: 'ethereum' }, cryptoTimeframes, '1m', 'Use a consistent exchange or index methodology for comparisons.'),
  candidate('SOLUSD', 'Solana / USD', 'crypto', ['crypto'], [0, 7, 13, 15, 16, 18], { twelveData: 'SOL/USD', coinGecko: 'solana' }, cryptoTimeframes, '1m', 'Venue and token-market coverage can vary materially.'),
  candidate('XRPUSD', 'XRP / USD', 'crypto', ['crypto'], [1, 6, 13, 15, 18], { twelveData: 'XRP/USD', coinGecko: 'ripple' }, cryptoTimeframes, '1m', 'Document venue, stablecoin/fiat quote basis, and symbol mapping.'),
  candidate('DOGEUSD', 'Dogecoin / USD', 'crypto', ['crypto'], [0, 13, 15, 16, 18], { twelveData: 'DOGE/USD', coinGecko: 'dogecoin' }, cryptoTimeframes, '1m', 'Sentiment-sensitive asset; use robust outlier handling.'),
  candidate('TOTAL_CRYPTO_PROXY', 'Crypto market-cap basket', 'crypto', ['crypto', 'meta'], [10, 17, 19, 21], { coinGecko: 'global' }, ['5m', '1h', '1d'], '1h', 'Composite definition and market-cap weighting must be versioned.'),
  candidate('ANIMAL_BASKET', 'Animal ecosystem synthetic index', 'agriculture', ['animal'], [3, 6, 7, 10, 14, 19], {}, ['1m', '5m', '15m', '1h', '1d'], '15m', 'Synthetic, normalized weighted-log-return basket; constituent weights are versioned below.'),
  candidate('META_RELATIVE_BASKET', 'Macro relative synthetic index', 'index', ['meta'], [4, 5, 11, 14, 20, 21], {}, ['5m', '15m', '1h', '1d'], '1h', 'Synthetic index of normalized equity, FX, and rate factors; no claim of tradability.'),
];

export const SYNTHETIC_INDEX_DEFINITIONS: Readonly<Record<'ANIMAL_BASKET' | 'META_RELATIVE_BASKET', SyntheticIndexDefinition>> = {
  ANIMAL_BASKET: {
    symbol: 'ANIMAL_BASKET',
    name: 'Animal ecosystem synthetic index',
    version: 'animal-basket-v1',
    baseValue: 100,
    timeframe: '15m',
    maxAgeMs: 45 * 60_000,
    minimumCoverage: 0.7,
    rule: 'weighted-log-return',
    constituents: [
      { symbol: 'SOYBEAN', weight: 0.22, basePrice: 100 },
      { symbol: 'WHEAT', weight: 0.19, basePrice: 100 },
      { symbol: 'CORN', weight: 0.21, basePrice: 100 },
      { symbol: 'WTI', weight: 0.23, basePrice: 100 },
      { symbol: 'NATGAS', weight: 0.15, basePrice: 100 },
    ],
  },
  META_RELATIVE_BASKET: {
    symbol: 'META_RELATIVE_BASKET',
    name: 'Macro relative synthetic index',
    version: 'meta-relative-basket-v1',
    baseValue: 100,
    timeframe: '1h',
    maxAgeMs: 36 * 60 * 60_000,
    minimumCoverage: 0.75,
    rule: 'weighted-log-return',
    constituents: [
      { symbol: 'SPX', weight: 0.3, basePrice: 100 },
      { symbol: 'SX5E', weight: 0.2, basePrice: 100 },
      { symbol: 'NKY', weight: 0.2, basePrice: 100 },
      { symbol: 'DXY', weight: 0.15, basePrice: 100 },
      { symbol: 'EURUSD', weight: 0.075, basePrice: 100, currencyDirection: -1 },
      { symbol: 'USDJPY', weight: 0.075, basePrice: 100 },
    ],
  },
};

export function validateMarketDataContract(contract: MarketDataContract, now = Date.now()): ContractStatus {
  if (!Number.isFinite(contract.value) || contract.value <= 0) {
    return { valid: false, fresh: false, ageMs: Number.POSITIVE_INFINITY, reason: 'invalid-value' };
  }
  if (!Number.isFinite(contract.observedAt) || !Number.isFinite(contract.receivedAt) || !Number.isFinite(now)) {
    return { valid: false, fresh: false, ageMs: Number.POSITIVE_INFINITY, reason: 'invalid-timestamp' };
  }
  if (!contract.symbol.trim() || !contract.currency.trim() || !contract.source.provider.trim()
    || !Number.isFinite(contract.expectedIntervalMs) || contract.expectedIntervalMs < 0
    || !Number.isFinite(contract.maxAgeMs) || contract.maxAgeMs < 0) {
    return { valid: false, fresh: false, ageMs: Number.POSITIVE_INFINITY, reason: 'invalid-contract' };
  }
  const ageMs = now - contract.observedAt;
  const futureTolerance = Math.max(1_000, contract.expectedIntervalMs * 0.1);
  if (ageMs < -futureTolerance || contract.receivedAt - now > futureTolerance) {
    return { valid: true, fresh: false, ageMs, reason: 'future-observation' };
  }
  if (contract.quality === 'stale' || ageMs > contract.maxAgeMs) {
    return { valid: true, fresh: false, ageMs, reason: 'stale-observation' };
  }
  return { valid: true, fresh: true, ageMs };
}

export function createSyntheticMarketDataContract(
  definition: SyntheticIndexDefinition,
  result: SyntheticIndexResult,
  receivedAt = Date.now(),
): MarketDataContract {
  return {
    symbol: definition.symbol,
    value: result.value,
    currency: 'USD',
    timeframe: definition.timeframe,
    source: { kind: 'synthetic', provider: 'chartui-synthetic-index', instrument: definition.name },
    observedAt: result.timestamp,
    receivedAt,
    expectedIntervalMs: timeframeIntervalMs(definition.timeframe),
    maxAgeMs: definition.maxAgeMs,
    quality: 'synthetic',
    composition: {
      version: definition.version,
      coverage: result.coverage,
      contributors: result.contributions.map((item) => item.symbol),
    },
  };
}

export function calculateSyntheticIndex(
  definition: SyntheticIndexDefinition,
  observations: Readonly<Record<string, { currentPrice: number; previousPrice: number; observedAt: number }>>,
  previousIndexValue = definition.baseValue,
  now = Date.now(),
): SyntheticIndexResult | undefined {
  if (!Number.isFinite(previousIndexValue) || previousIndexValue <= 0
    || !Number.isFinite(definition.minimumCoverage) || definition.minimumCoverage < 0 || definition.minimumCoverage > 1
    || !Number.isFinite(definition.maxAgeMs) || definition.maxAgeMs < 0
    || definition.constituents.some(({ weight }) => !Number.isFinite(weight) || weight < 0)) return undefined;
  const totalWeight = definition.constituents.reduce((sum, constituent) => sum + constituent.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return undefined;

  const fresh = definition.constituents.flatMap((constituent) => {
    const observation = observations[constituent.symbol];
    if (!observation || !Number.isFinite(observation.currentPrice) || observation.currentPrice <= 0
      || !Number.isFinite(observation.previousPrice) || observation.previousPrice <= 0
      || !Number.isFinite(observation.observedAt)
      || now - observation.observedAt < 0
      || now - observation.observedAt > definition.maxAgeMs) return [];
    const direction = constituent.currencyDirection ?? 1;
    const logReturn = Math.log(observation.currentPrice / observation.previousPrice) * direction;
    return Number.isFinite(logReturn) ? [{ constituent, observation, logReturn }] : [];
  });

  const freshWeight = fresh.reduce((sum, item) => sum + item.constituent.weight, 0);
  const coverage = freshWeight / totalWeight;
  if (coverage < definition.minimumCoverage || freshWeight <= 0) return undefined;

  const contributions = fresh.map(({ constituent, logReturn }) => ({
    symbol: constituent.symbol,
    normalizedWeight: constituent.weight / freshWeight,
    logReturn,
  }));
  const returnLog = contributions.reduce((sum, item) => sum + item.normalizedWeight * item.logReturn, 0);
  const value = previousIndexValue * Math.exp(returnLog);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  return {
    value,
    returnLog,
    coverage,
    timestamp: Math.min(...fresh.map((item) => item.observation.observedAt)),
    contributions,
  };
}

export function getCandidatesForRole(arcanaId: number): readonly MarketCandidate[] {
  return MARKET_CANDIDATE_CATALOG.filter((asset) => asset.roleIds.includes(arcanaId));
}

export function getCandidatesForField(field: MarketField): readonly MarketCandidate[] {
  return MARKET_CANDIDATE_CATALOG.filter((asset) => asset.fields.includes(field));
}

export const MARKET_TIMEFRAME_DEFAULTS = {
  intradayMaxAgeMultiplier: 3,
  dailyMaxAgeMultiplier: 2,
  eventMaxAgeMultiplier: 1.5,
  recommendedMaxPollingSymbolsPerProvider: 12,
} as const;
