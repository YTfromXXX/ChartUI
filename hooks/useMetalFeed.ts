'use client';

import { useEffect, useRef, useState } from 'react';

export type MetalQuote = {
  price: number;
  timestamp: number;
  provider: string;
  source: 'LIVE' | 'SYNTHETIC';
  fallbackReason?: string;
};

type MetalFeedState = {
  quote?: MetalQuote;
  volatility: number;
  priceVelocity: number;
  angularVelocity: number;
  fallbackReason?: string;
};

const POLL_INTERVAL_MS = 30_000;

export function useMetalFeed(enabled: boolean): MetalFeedState {
  const [state, setState] = useState<MetalFeedState>({ volatility: 0, priceVelocity: 0, angularVelocity: 0 });
  const previousQuote = useRef<MetalQuote | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let timer: number | undefined;
    previousQuote.current = undefined;

    const poll = async () => {
      try {
        const response = await fetch('/api/metal-feed', { cache: 'no-store' });
        if (!response.ok) throw new Error(`metal feed returned HTTP ${response.status}`);
        const quote = await response.json() as MetalQuote;
        if (!Number.isFinite(quote.price) || quote.price <= 0
          || !Number.isFinite(quote.timestamp)
          || (quote.source !== 'LIVE' && quote.source !== 'SYNTHETIC')) {
          throw new Error('metal feed returned an invalid quote');
        }
        if (stopped) return;
        const previous = previousQuote.current;
        const elapsedSeconds = previous
          ? Math.max((quote.timestamp - previous.timestamp) / 1000, 1)
          : POLL_INTERVAL_MS / 1000;
        const logReturn = previous ? Math.log(quote.price / previous.price) : 0;
        const priceVelocity = logReturn * quote.price / elapsedSeconds;
        const angularVelocity = Math.atan(logReturn * 120) / elapsedSeconds;
        const volatility = Math.min(1, Math.abs(logReturn) * 80);
        previousQuote.current = quote;
        setState({ quote, volatility, priceVelocity, angularVelocity, fallbackReason: quote.fallbackReason });
      } catch (error) {
        if (stopped) return;
        const fallbackReason = error instanceof Error ? error.message : 'metal feed unavailable';
        setState((current) => ({ ...current, fallbackReason }));
      } finally {
        if (!stopped) timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      previousQuote.current = undefined;
    };
  }, [enabled]);

  return state;
}
