// The 24 auto-trading APIs from the survey (22 arcana squares + EX0/EX1), with provisional
// profiles. Ranks are a qualitative first pass; latency and fee are placeholder design values to
// be replaced by the 19-question survey card (relax 2 · drift 4 · counter 6 · oracle 7). Nothing
// here connects to a real API.

export type JpAccess = 'ok' | 'no' | 'check';
export type SurveyApi = { rank: number; id: string; name: string; kind: string; square: string; symbol: string; jp: JpAccess; latencyMs: number; feeBps: number };

export const SURVEY_APIS: SurveyApi[] = [
  { rank: 1, id: 'ibkr', name: 'Interactive Brokers', kind: '株・先物・FX', square: 'IV 皇帝', symbol: 'US500', jp: 'ok', latencyMs: 60, feeBps: 1 },
  { rank: 2, id: 'binance', name: 'Binance', kind: '暗号資産', square: 'I 魔術師', symbol: 'BTCUSD', jp: 'check', latencyMs: 40, feeBps: 10 },
  { rank: 3, id: 'mt5', name: 'MetaTrader 5', kind: 'FX・CFD', square: 'III 女帝', symbol: 'XAUUSD', jp: 'ok', latencyMs: 80, feeBps: 3 },
  { rank: 4, id: 'ccxt', name: 'CCXT', kind: '取引所の束ね役', square: 'XXI 世界', symbol: 'GER40', jp: 'check', latencyMs: 90, feeBps: 10 },
  { rank: 5, id: 'alpaca', name: 'Alpaca', kind: '米国株・暗号資産', square: 'VII 戦車', symbol: 'NAS100', jp: 'check', latencyMs: 70, feeBps: 0 },
  { rank: 6, id: 'coinbase', name: 'Coinbase Advanced', kind: '暗号資産', square: 'VI 恋人', symbol: 'ETHUSD', jp: 'no', latencyMs: 60, feeBps: 40 },
  { rank: 7, id: 'okx', name: 'OKX', kind: '暗号資産', square: 'X 運命の輪', symbol: 'SOLUSD', jp: 'no', latencyMs: 45, feeBps: 8 },
  { rank: 8, id: 'bybit', name: 'Bybit', kind: '暗号資産の先物', square: 'XV 悪魔', symbol: 'XRPUSD', jp: 'no', latencyMs: 45, feeBps: 6 },
  { rank: 9, id: 'kraken', name: 'Kraken', kind: '暗号資産', square: 'XIII 死神', symbol: 'LTCUSD', jp: 'check', latencyMs: 80, feeBps: 25 },
  { rank: 10, id: 'oanda', name: 'OANDA v20', kind: 'FX', square: 'II 女教皇', symbol: 'EURUSD', jp: 'check', latencyMs: 70, feeBps: 1 },
  { rank: 11, id: 'tradingview', name: 'TradingView Webhook', kind: '合図のみ（発注しない）', square: 'XVIII 月', symbol: 'USDCAD', jp: 'ok', latencyMs: 500, feeBps: 0 },
  { rank: 12, id: 'schwab', name: 'Schwab Trader', kind: '米国株・オプション', square: 'VIII 力', symbol: 'US30', jp: 'no', latencyMs: 120, feeBps: 0 },
  { rank: 13, id: 'lean', name: 'QuantConnect LEAN', kind: 'バックテスト基盤', square: 'XIX 太陽', symbol: 'DAX40', jp: 'ok', latencyMs: 150, feeBps: 0 },
  { rank: 14, id: 'hyperliquid', name: 'Hyperliquid', kind: 'オンチェーン先物', square: '0 愚者', symbol: 'DOGEUSD', jp: 'check', latencyMs: 200, feeBps: 4 },
  { rank: 15, id: 'saxo', name: 'Saxo OpenAPI', kind: '多資産', square: 'V 教皇', symbol: 'GBPUSD', jp: 'check', latencyMs: 100, feeBps: 2 },
  { rank: 16, id: 'ctrader', name: 'cTrader Open API', kind: 'FX・CFD', square: 'XI 正義', symbol: 'AUDUSD', jp: 'check', latencyMs: 70, feeBps: 2 },
  { rank: 17, id: 'freqtrade', name: 'Freqtrade', kind: 'OSS 売買ボット', square: 'XX 審判', symbol: 'ADAUSD', jp: 'ok', latencyMs: 300, feeBps: 0 },
  { rank: 18, id: 'tradestation', name: 'TradeStation', kind: '米国株・先物', square: 'XII 吊るされた男', symbol: 'XAGUSD', jp: 'check', latencyMs: 110, feeBps: 1 },
  { rank: 19, id: 'tastytrade', name: 'tastytrade', kind: 'オプション', square: 'XVII 星', symbol: 'NZDUSD', jp: 'check', latencyMs: 120, feeBps: 1 },
  { rank: 20, id: 'bitflyer', name: 'bitFlyer Lightning', kind: '暗号資産（日本）', square: 'EX0', symbol: 'BTCJPY', jp: 'ok', latencyMs: 90, feeBps: 10 },
  { rank: 21, id: 'kabu', name: 'kabu STATION API', kind: '日本株', square: 'IX 隠者', symbol: 'USDJPY', jp: 'ok', latencyMs: 100, feeBps: 5 },
  { rank: 22, id: 'gmocoin', name: 'GMO コイン', kind: '暗号資産（日本）', square: 'EX1', symbol: 'BTCJPY', jp: 'ok', latencyMs: 90, feeBps: 5 },
  { rank: 23, id: 'dydx', name: 'dYdX v4', kind: 'オンチェーン先物', square: 'XVI 塔', symbol: 'BTCXAU', jp: 'check', latencyMs: 250, feeBps: 5 },
  { rank: 24, id: 'tachibana', name: '立花証券 e支店', kind: '日本株', square: 'XIV 節制', symbol: 'USDCHF', jp: 'ok', latencyMs: 120, feeBps: 5 },
];

export const JP_LABEL: Record<JpAccess, string> = { ok: '日本 ◯', no: '日本 ×', check: '日本 要確認' };
export const MAX_TABLE_APIS = 2;

/** The table's profile: the synthetic API alone, or blended with at most two real API profiles. */
export function tableProfile(ids: string[]) {
  const picked = ids.slice(0, MAX_TABLE_APIS).map((id) => SURVEY_APIS.find((a) => a.id === id)).filter((a): a is SurveyApi => !!a);
  if (!picked.length) return { latencyMs: 0, feeBps: 0, label: '合成 API のみ' };
  return {
    latencyMs: Math.round(picked.reduce((s, a) => s + a.latencyMs, 0) / picked.length),
    feeBps: Math.round((picked.reduce((s, a) => s + a.feeBps, 0) / picked.length) * 10) / 10,
    label: `合成 API ＋ ${picked.map((a) => a.name).join(' ＋ ')}`,
  };
}
