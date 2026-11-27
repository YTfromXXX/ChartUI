// FX quote orientation for the USD axis, and the cross-check (照合) that every table agrees.
//
// A pair BASEQUOTE prices one BASE in QUOTE. "USD strength" rises when USD is the base and the pair
// rises (USDJPY ↑), or when USD is the quote and the pair falls (EURUSD ↓). So:
//   usdDirection(USDJPY) = +1, usdDirection(EURUSD) = −1, usdDirection(JPYUSD) = −1.
// JPYUSD is not quoted by the market; it is derived as 1 / USDJPY, so its log return is exactly the
// negative of USDJPY's.

export type FxPair = 'EURUSD' | 'USDJPY' | 'JPYUSD';
export const USD_AXIS_CHOICES: { pair: Exclude<FxPair, 'USDJPY'>; label: string }[] = [
  { pair: 'EURUSD', label: 'EURUSD（ユーロ／ドル）' },
  { pair: 'JPYUSD', label: 'JPYUSD（円／ドル ＝ 1 ÷ USDJPY）' },
];

export function split(pair: string) { return { base: pair.slice(0, 3), quote: pair.slice(3, 6) }; }
export function usdDirection(pair: string): 1 | -1 | 0 {
  const { base, quote } = split(pair); return base === 'USD' ? 1 : quote === 'USD' ? -1 : 0;
}
/** Price of `pair` from the market-quoted USDJPY / EURUSD values. */
export function priceOf(pair: FxPair, quotes: { EURUSD: number; USDJPY: number }) {
  return pair === 'JPYUSD' ? 1 / quotes.USDJPY : quotes[pair];
}
/** Turn a price series into a USD-strength series (rises when USD strengthens). */
export function toUsdStrength(pair: string, prices: number[]) {
  const d = usdDirection(pair); return d === -1 ? prices.map((p) => 1 / p) : prices;
}

export type Check = { name: string; ok: boolean; detail: string };

/**
 * Cross-check the orientation stored in each table against the pair's own spelling, and the
 * derived JPYUSD against USDJPY. Tables are passed in so this stays a pure function.
 */
export function crossCheck(tables: { name: string; rows: { symbol: string; dir?: number }[] }[], usdJpySample: number[]): Check[] {
  const out: Check[] = [];
  for (const t of tables) for (const r of t.rows) {
    const want = usdDirection(r.symbol); if (want === 0) continue;
    const got = r.dir ?? 1;
    out.push({ name: `${t.name} · ${r.symbol}`, ok: got === want, detail: `表 ${got > 0 ? '+1' : '−1'} ／ 綴りから ${want > 0 ? '+1' : '−1'}` });
  }
  // JPYUSD = 1 / USDJPY  ⇒  log returns are exact negatives.
  let worst = 0;
  for (let i = 1; i < usdJpySample.length; i += 1) {
    const r1 = Math.log(usdJpySample[i] / usdJpySample[i - 1]);
    const r2 = Math.log((1 / usdJpySample[i]) / (1 / usdJpySample[i - 1]));
    worst = Math.max(worst, Math.abs(r1 + r2));
  }
  out.push({ name: 'JPYUSD ＝ 1 ÷ USDJPY（対数リターンが正反対）', ok: worst < 1e-12, detail: `最大誤差 ${worst.toExponential(1)}` });
  out.push({ name: 'USD 強さの向き：EURUSD と JPYUSD は −1、USDJPY は +1', ok: usdDirection('EURUSD') === -1 && usdDirection('JPYUSD') === -1 && usdDirection('USDJPY') === 1, detail: '綴りの規則' });
  return out;
}
