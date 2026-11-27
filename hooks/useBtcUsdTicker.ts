'use client';

import { useEffect, useRef, useState } from 'react';

export type BtcUsdTicker = { price: number; timestamp: number };

type BtcUsdActivity = {
  volatility: number;
  range: number;
  priceVelocity: number;
};

const EMPTY_ACTIVITY: BtcUsdActivity = { volatility: 0, range: 0, priceVelocity: 0 };
const MAX_SAMPLES = 48;
const TICKER_STALE_MS = 15_000;

export function useBtcUsdTicker() {
  const [ticker, setTicker] = useState<BtcUsdTicker>();
  const [isConnected, setIsConnected] = useState(false);
  const [activity, setActivity] = useState(EMPTY_ACTIVITY);
  const samples = useRef<BtcUsdTicker[]>([]);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let staleTimer: number | undefined;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      socket.onopen = () => {
        setIsConnected(true);
        socket?.send(JSON.stringify({
          type: 'subscribe',
          product_ids: ['BTC-USD'],
          channels: ['ticker'],
        }));
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string; price?: string; time?: string };
          const price = Number(payload.price);
          if (payload.type !== 'ticker' || !Number.isFinite(price) || price <= 0) return;

          const next = { price, timestamp: Date.parse(payload.time ?? '') || Date.now() };
          const history = [...samples.current, next].slice(-MAX_SAMPLES);
          samples.current = history;
          setTicker(next);
          if (staleTimer !== undefined) window.clearTimeout(staleTimer);
          staleTimer = window.setTimeout(() => {
            setTicker(undefined);
            setActivity(EMPTY_ACTIVITY);
            samples.current = [];
          }, TICKER_STALE_MS);

          const returns = history.slice(1).map((sample, index) => {
            const previous = history[index];
            const elapsed = Math.max((sample.timestamp - previous.timestamp) / 1000, 0.001);
            return { value: Math.log(sample.price / previous.price), elapsed };
          });
          const meanReturn = returns.length
            ? returns.reduce((sum, item) => sum + item.value, 0) / returns.length
            : 0;
          const variance = returns.length
            ? returns.reduce((sum, item) => sum + (item.value - meanReturn) ** 2, 0) / returns.length
            : 0;
          const range = history.length > 1
            ? (Math.max(...history.map((sample) => sample.price)) - Math.min(...history.map((sample) => sample.price))) / price
            : 0;
          const latestReturn = returns.at(-1);
          setActivity({
            volatility: Math.min(1, Math.sqrt(variance) * 1600),
            range: Math.min(1, range * 100),
            priceVelocity: latestReturn
              ? Math.min(2.5, Math.abs(latestReturn.value) / latestReturn.elapsed * 1600)
              : 0,
          });
        } catch {
          // Ignore malformed exchange messages and continue with the next ticker update.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        setIsConnected(false);
        setTicker(undefined);
        setActivity(EMPTY_ACTIVITY);
        samples.current = [];
        if (!stopped) reconnectTimer = window.setTimeout(connect, 2_000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (staleTimer !== undefined) window.clearTimeout(staleTimer);
      socket?.close();
    };
  }, []);

  return { ticker, isConnected, activity };
}
