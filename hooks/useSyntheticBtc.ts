'use client';

import { useEffect, useRef, useState } from 'react';

// BTCUSD for the retest: the synthetic price starts at 0.04 and follows the live BTCUSD
// move from the CoinGecko simple-price API (polled every 30 s). When CoinGecko cannot be
// reached (offline, blocked, rate-limited), a seeded random walk stands in and is labelled
// as such. A simulation input, not a quote for trading.

const URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
export const SYNTH_START = 0.04;

export type SynthBtc = { price: number; btc: number | null; source: 'LIVE (CoinGecko)' | 'SYNTHETIC'; updatedAt: number; history: number[] };

export function useSyntheticBtc(): SynthBtc {
  const [state, setState] = useState<SynthBtc>({ price: SYNTH_START, btc: null, source: 'SYNTHETIC', updatedAt: 0, history: [SYNTH_START] });
  const base = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let walk = SYNTH_START;
    const push = (price: number, btc: number | null, source: SynthBtc['source']) => {
      setState((s) => ({ price, btc, source, updatedAt: Date.now(), history: [...s.history, price].slice(-240) }));
    };
    const poll = async () => {
      try {
        const res = await fetch(URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const btc = Number((await res.json())?.bitcoin?.usd);
        if (!Number.isFinite(btc) || btc <= 0) throw new Error('bad payload');
        base.current ??= btc;
        if (!stopped) push(SYNTH_START * (btc / base.current), btc, 'LIVE (CoinGecko)');
      } catch {
        // Fallback: a small random walk around the last value.
        walk = Math.max(0.001, walk * (1 + (Math.random() - 0.5) * 0.004));
        if (!stopped) push(walk, null, 'SYNTHETIC');
      }
    };
    void poll();
    const live = window.setInterval(poll, 30_000);
    // Between polls the synthetic walk keeps ticking so the lag has something to settle against.
    const tick = window.setInterval(() => {
      setState((s) => {
        if (s.source !== 'SYNTHETIC') return s;
        const price = Math.max(0.001, s.price * (1 + (Math.random() - 0.5) * 0.004));
        walk = price;
        return { ...s, price, updatedAt: Date.now(), history: [...s.history, price].slice(-240) };
      });
    }, 1000);
    return () => { stopped = true; window.clearInterval(live); window.clearInterval(tick); };
  }, []);

  return state;
}
