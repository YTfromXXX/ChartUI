export type MetalDataFamily = 'exchange' | 'otc-assessment' | 'rare-earth-benchmark';
export type MetalUpdateCadence = 'licensed-stream' | 'minute-poll' | 'daily-assessment';

export type MetalInstrument = {
  symbol: string;
  name: string;
  family: MetalDataFamily;
  cadence: MetalUpdateCadence;
  quoteCurrency: 'USD' | 'CNY' | 'USD-or-CNY';
  benchmarkSources: readonly string[];
  requiresLicense: boolean;
  status: 'provider-required' | 'synthetic-preview';
};

const exchangeNames = [
  ['XAUUSD', 'Gold spot', 'USD'],
  ['XAGUSD', 'Silver spot', 'USD'],
  ['XPTUSD', 'Platinum spot', 'USD'],
  ['XPDUSD', 'Palladium spot', 'USD'],
  ['CU', 'Copper', 'USD-or-CNY'],
  ['AL', 'Aluminium', 'USD-or-CNY'],
  ['ZN', 'Zinc', 'USD-or-CNY'],
  ['PB', 'Lead', 'USD-or-CNY'],
  ['NI', 'Nickel', 'USD-or-CNY'],
  ['SN', 'Tin', 'USD-or-CNY'],
  ['CO', 'Cobalt', 'USD-or-CNY'],
  ['LIC', 'Lithium carbonate', 'USD-or-CNY'],
  ['LIH', 'Lithium hydroxide', 'USD-or-CNY'],
] as const;

const otcNames = [
  ['GA', 'Gallium'], ['GE', 'Germanium'], ['IN', 'Indium'], ['SB', 'Antimony'],
  ['BI', 'Bismuth'], ['W', 'Tungsten'], ['MO', 'Molybdenum'], ['TI', 'Titanium sponge'],
  ['V', 'Vanadium pentoxide'], ['MG', 'Magnesium'], ['SI', 'Silicon metal'], ['TE', 'Tellurium'],
  ['SE', 'Selenium'], ['ZR', 'Zirconium'], ['TA', 'Tantalum'], ['NB', 'Niobium'],
  ['HF', 'Hafnium'],
] as const;

const rareEarthNames = [
  ['SC', 'Scandium'], ['Y', 'Yttrium'], ['LA', 'Lanthanum'], ['CE', 'Cerium'],
  ['PR', 'Praseodymium'], ['ND', 'Neodymium'], ['PM', 'Promethium'], ['SM', 'Samarium'],
  ['EU', 'Europium'], ['GD', 'Gadolinium'], ['TB', 'Terbium'], ['DY', 'Dysprosium'],
  ['HO', 'Holmium'], ['ER', 'Erbium'], ['TM', 'Thulium'], ['YB', 'Ytterbium'],
  ['LU', 'Lutetium'],
] as const;

export const METAL_INSTRUMENT_CATALOG: readonly MetalInstrument[] = [
  ...exchangeNames.map(([symbol, name, quoteCurrency]) => ({
    symbol,
    name,
    family: 'exchange' as const,
    cadence: symbol.startsWith('X') ? 'minute-poll' as const : 'licensed-stream' as const,
    quoteCurrency,
    benchmarkSources: symbol.startsWith('X') ? ['licensed spot provider'] : ['LME (licensed)', 'SMM (assessment, where applicable)'],
    requiresLicense: true,
    status: 'provider-required' as const,
  })),
  ...otcNames.map(([symbol, name]) => ({
    symbol,
    name,
    family: 'otc-assessment' as const,
    cadence: 'daily-assessment' as const,
    quoteCurrency: 'USD-or-CNY' as const,
    benchmarkSources: ['SMM', 'Fastmarkets', 'Asian Metal (licensed assessment)'],
    requiresLicense: true,
    status: 'provider-required' as const,
  })),
  ...rareEarthNames.map(([symbol, name]) => ({
    symbol,
    name: `${name} benchmark`,
    family: 'rare-earth-benchmark' as const,
    cadence: 'daily-assessment' as const,
    quoteCurrency: 'USD-or-CNY' as const,
    benchmarkSources: ['SMM', 'Fastmarkets', 'Asian Metal (licensed assessment)'],
    requiresLicense: true,
    status: 'provider-required' as const,
  })),
];

export type MetalQuote = {
  symbol: string;
  price: number;
  quoteCurrency: 'USD' | 'CNY';
  unit: string;
  observedAt: string;
  source: string;
  cadence: MetalUpdateCadence;
  isSynthetic: boolean;
};

export const METAL_INGESTION_POLICY = {
  exchange: {
    targetCadence: 'licensed-stream' as const,
    permittedFallback: 'minute-poll' as const,
    retainRawPayload: true,
  },
  otcAssessment: {
    targetCadence: 'daily-assessment' as const,
    retainPublicationTimestamp: true,
    retainAssessmentMethod: true,
  },
  normalization: {
    storeOriginalUnitAndCurrency: true,
    deriveCrossAssetReturnsAfterFxConversion: true,
    doNotForwardFillAcrossPublicationGaps: true,
    keepSourceAndSyntheticFlags: true,
  },
} as const;

export function validateMetalQuote(input: MetalQuote): MetalQuote {
  if (!METAL_INSTRUMENT_CATALOG.some((instrument) => instrument.symbol === input.symbol)) {
    throw new RangeError(`Unknown metal instrument: ${input.symbol}`);
  }
  if (!Number.isFinite(input.price) || input.price <= 0) throw new RangeError('Metal price must be finite and positive');
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new RangeError('Metal quote observedAt must be an ISO timestamp');
  if (!input.source.trim() || !input.unit.trim()) throw new RangeError('Metal quote must identify its source and unit');
  if (!['USD', 'CNY'].includes(input.quoteCurrency)) throw new RangeError('Unsupported quote currency');
  return input;
}
