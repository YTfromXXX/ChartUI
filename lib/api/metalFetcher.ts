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
  price?: unknown;
  goldPrice?: unknown;
  xauUsd?: unknown;
  xau_usd?: unknown;
  base?: string;
  rates?: Record<string, unknown>;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
  gold?: Record<string, unknown> | unknown;
  items?: Array<Record<string, unknown>>;
};

function toPositivePrice(value: unknown): number | undefined {
  const price = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

function parseRapidApiPrice(payload: RapidApiResponse): number | undefined {
  const recordPrice = (value: unknown): number | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    return toPositivePrice(record.price ?? record.xauUsd ?? record.xau_usd ?? record.goldPrice ?? record.gold_price);
  };
  const gold = payload.gold;
  const candidates = [
    toPositivePrice(payload.price),
    toPositivePrice(payload.goldPrice),
    toPositivePrice(payload.xauUsd),
    toPositivePrice(payload.xau_usd),
    recordPrice(payload.data),
    recordPrice(payload.result),
    recordPrice(gold),
    payload.items?.length ? recordPrice(payload.items[0]) : undefined,
  ];
  const directPrice = candidates.find((value): value is number => value !== undefined);
  if (directPrice !== undefined) return directPrice;

  const usdPerXau = toPositivePrice(payload.rates?.USD);
  if (payload.base?.toUpperCase() === 'XAU' && usdPerXau !== undefined) return usdPerXau;
  const xauPerUsd = toPositivePrice(payload.rates?.XAU);
  if (payload.base?.toUpperCase() === 'USD' && xauPerUsd !== undefined) return 1 / xauPerUsd;
  return undefined;
}

async function fetchRapidApiMetalPrice(apiKey: string): Promise<MetalFeedQuote> {
  const host = process.env.RAPIDAPI_HOST?.trim().toLowerCase();
  const endpoint = process.env.RAPIDAPI_URL?.trim();
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
  const rawTimestamp = Number(payload.timestamp ?? payload.updated_at);
  const timestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0
    ? rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp
    : Date.now();
  return { price, timestamp, provider: 'rapidapi-metals', source: 'LIVE' };
}

export async function fetchMetalPrice(): Promise<MetalFeedQuote> {
  const configuredProvider = process.env.METAL_FEED_PROVIDER?.trim().toLowerCase();
  if (!configuredProvider) throw new MetalFeedError('not_configured');
  if (configuredProvider === 'rapidapi-metals') {
    const apiKey = process.env.RAPIDAPI_KEY?.trim();
    if (!apiKey) throw new MetalFeedError('not_configured');
    return fetchRapidApiMetalPrice(apiKey);
  }

  const apiKey = process.env.METALS_API_KEY?.trim();
  if (!apiKey) throw new MetalFeedError('not_configured');
  if (!['metals-api', 'metalsapi', 'metals_api', 'metalsapi.com'].includes(configuredProvider)) {
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
