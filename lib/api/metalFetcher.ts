export type MetalFeedQuote = {
  price: number;
  timestamp: number;
  provider: string;
  source: 'LIVE';
};

export class MetalFeedError extends Error {
  constructor(
    readonly code: 'not_configured' | 'unsupported_provider' | 'rate_limited' | 'upstream_error' | 'invalid_payload',
  ) {
    super(code);
    this.name = 'MetalFeedError';
  }
}

type MetalsApiResponse = {
  success?: boolean;
  timestamp?: number;
  rates?: Record<string, unknown>;
};

type RapidApiResponse = {
  timestamp?: number | string;
  updated_at?: number | string;
  symbol?: string;
  currency?: string;
  unit?: string;
  bid?: unknown;
  ask?: unknown;
  mid?: unknown;
  price?: unknown;
  spot_price?: unknown;
  goldPrice?: unknown;
  xauUsd?: unknown;
  xau_usd?: unknown;
  usdXau?: unknown;
  USDXAU?: unknown;
  base?: string;
  rates?: Record<string, unknown>;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
  gold?: Record<string, unknown> | unknown;
  items?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
};

type PriceRecord = Record<string, unknown>;

function toPositivePrice(value: unknown): number | undefined {
  const price = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

function asPriceRecord(value: unknown): PriceRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as PriceRecord : undefined;
}

function isUsdGoldRecord(record: PriceRecord): boolean {
  const currency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : undefined;
  if (currency && currency !== 'USD') return false;

  const symbol = typeof record.symbol === 'string' ? record.symbol.trim().toUpperCase() : undefined;
  if (symbol && !['AU', 'XAU', 'GOLD', 'XAUUSD', 'XAU/USD'].includes(symbol)) return false;

  const unit = typeof record.unit === 'string' ? record.unit.trim().toLowerCase() : undefined;
  if (unit && !['ounce', 'ounces', 'troy ounce', 'troy ounces', 'oz', 'ozt'].includes(unit)) return false;
  return true;
}

function parseQuoteRecord(record: PriceRecord): number | undefined {
  if (!isUsdGoldRecord(record)) return undefined;

  const mid = toPositivePrice(record.mid);
  if (mid !== undefined) return mid;
  const bid = toPositivePrice(record.bid);
  const ask = toPositivePrice(record.ask);
  if (bid !== undefined && ask !== undefined) return (bid + ask) / 2;

  for (const key of ['spot_price', 'price', 'goldPrice', 'gold_price', 'xauUsd', 'xau_usd', 'usdXau', 'USDXAU']) {
    const price = toPositivePrice(record[key]);
    if (price !== undefined) return price;
  }
  return undefined;
}

function parseRapidApiPrice(payload: RapidApiResponse): number | undefined {
  const records = [
    payload as PriceRecord,
    asPriceRecord(payload.data),
    asPriceRecord(payload.result),
    asPriceRecord(payload.gold),
    payload.results?.[0],
    payload.items?.[0],
  ].filter((record): record is PriceRecord => record !== undefined);

  for (const record of records) {
    const price = parseQuoteRecord(record);
    if (price !== undefined) return price;
  }

  const rates = asPriceRecord(payload.rates);
  if (rates && payload.base?.toUpperCase() === 'XAU') {
    return toPositivePrice(rates.USD);
  }
  if (rates && payload.base?.toUpperCase() === 'USD') {
    const xauPerUsd = toPositivePrice(rates.XAU);
    if (xauPerUsd !== undefined) return 1 / xauPerUsd;
  }
  return undefined;
}

async function fetchRapidApiMetalPrice(apiKey: string): Promise<MetalFeedQuote> {
  const providerSetting = cleanEnvValue(process.env.RAPIDAPI_METAL_SENTINEL_FEED_PROVIDER)?.toLowerCase();
  const providerHost = providerSetting?.endsWith('.p.rapidapi.com') ? providerSetting : undefined;
  const host = (
    cleanEnvValue(process.env.RAPIDAPI_METAL_SENTINEL_HOST)
    ?? providerHost
    ?? cleanEnvValue(process.env.RAPIDAPI_HOST)
  )?.toLowerCase();
  const endpoint = cleanEnvValue(process.env.RAPIDAPI_METAL_SENTINEL_URL)
    ?? cleanEnvValue(process.env.RAPIDAPI_URL);
  if (!host || !endpoint) throw new MetalFeedError('not_configured');
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new MetalFeedError('not_configured');
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== host) {
    throw new MetalFeedError('not_configured');
  }
  if (url.pathname.replace(/\/+$/, '').endsWith('/metal-quote') && !url.searchParams.has('symbol')) {
    url.searchParams.set('symbol', 'AU');
  }
  if (url.pathname.replace(/\/+$/, '').endsWith('/metal-quote') && !url.searchParams.has('currency')) {
    url.searchParams.set('currency', 'USD');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': host,
      },
    });
  } catch {
    throw new MetalFeedError('upstream_error');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) throw new MetalFeedError('rate_limited');
  if (!response.ok) throw new MetalFeedError('upstream_error');

  let payload: RapidApiResponse;
  try {
    payload = await response.json() as RapidApiResponse;
  } catch {
    throw new MetalFeedError('invalid_payload');
  }

  const price = parseRapidApiPrice(payload);
  if (price === undefined) throw new MetalFeedError('invalid_payload');
  const rawTimestamp = Number(payload.timestamp ?? payload.updated_at ?? payload.results?.[0]?.timestamp);
  const timestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0
    ? rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp
    : Date.now();
  return { price, timestamp, provider: 'rapidapi-metals', source: 'LIVE' };
}

function cleanEnvValue(value: string | undefined): string | undefined {
  const unquoted = value?.trim().replace(/^(['"])(.*)\1$/, '$2');
  const withoutComment = unquoted?.split(/\s+#/, 1)[0]?.trim();
  return withoutComment || undefined;
}

export async function fetchMetalPrice(): Promise<MetalFeedQuote> {
  const configuredProvider = cleanEnvValue(process.env.RAPIDAPI_METAL_SENTINEL_FEED_PROVIDER)
    ?? cleanEnvValue(process.env.METAL_FEED_PROVIDER);
  const normalizedProvider = configuredProvider?.toLowerCase();
  if (!normalizedProvider) throw new MetalFeedError('not_configured');
  if (normalizedProvider === 'rapidapi-metals' || normalizedProvider.endsWith('.p.rapidapi.com')) {
    const apiKey = cleanEnvValue(process.env.RAPIDAPI_METAL_SENTINEL_API_KEY)
      ?? cleanEnvValue(process.env.RAPIDAPI_KEY);
    if (!apiKey) throw new MetalFeedError('not_configured');
    return fetchRapidApiMetalPrice(apiKey);
  }

  const apiKey = cleanEnvValue(process.env.METALS_API_KEY);
  if (!apiKey) throw new MetalFeedError('not_configured');
  if (!['metals-api', 'metalsapi', 'metals_api', 'metalsapi.com'].includes(normalizedProvider)) {
    throw new MetalFeedError('unsupported_provider');
  }

  const url = new URL('https://metals-api.com/api/latest');
  url.searchParams.set('access_key', apiKey);
  url.searchParams.set('base', 'USD');
  url.searchParams.set('symbols', 'XAU');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', signal: controller.signal });
  } catch {
    throw new MetalFeedError('upstream_error');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) throw new MetalFeedError('rate_limited');
  if (!response.ok) throw new MetalFeedError('upstream_error');

  let payload: MetalsApiResponse;
  try {
    payload = await response.json() as MetalsApiResponse;
  } catch {
    throw new MetalFeedError('invalid_payload');
  }

  const usdPerOunce = Number(payload.rates?.XAU);
  const price = usdPerOunce > 0 ? 1 / usdPerOunce : Number.NaN;
  if (payload.success === false || !Number.isFinite(price) || price <= 0) {
    throw new MetalFeedError('invalid_payload');
  }

  const upstreamTimestamp = Number(payload.timestamp);
  return {
    price,
    timestamp: Number.isFinite(upstreamTimestamp) && upstreamTimestamp > 0 ? upstreamTimestamp * 1000 : Date.now(),
    provider: 'metals-api',
    source: 'LIVE',
  };
}
