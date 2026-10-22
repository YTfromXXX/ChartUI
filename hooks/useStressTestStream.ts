'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KnotTick } from '@/components/2d/KnotChart';
import type { PortfolioProfile } from '@/lib/portfolio';
import { debugMetrics } from '@/lib/debugMetrics';
import {
  countDelayCrossings,
  createStressState,
  flowsToPortfolio,
  nextOverloadTick,
  nextSpiralTick,
  sdfBreakthroughFlows,
  type StressMode,
} from '@/lib/stressTestStream';

type Options = {
  mode: StressMode;
  enabled?: boolean;
  seed?: number;
  intervalMs?: number;
  maxTicks?: number;
  assets?: number;
  spikeAt?: number;
  spike?: number;
};

/**
 * Debug hook: feeds deterministic chaos data to KnotChart (`tick`, `history`)
 * and PortfolioRadar (`portfolio`). History is a fixed-size ring that is
 * copied only once per emit, and the timer is always cleared on unmount, so
 * the stream itself cannot leak.
 */
export function useStressTestStream({ mode, enabled = true, seed = 7, intervalMs = 50, maxTicks = 256, assets = 4, spikeAt = 120, spike = 5000 }: Options) {
  const [tick, setTick] = useState<KnotTick | undefined>();
  const [history, setHistory] = useState<readonly KnotTick[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioProfile | undefined>();
  const [step, setStep] = useState(0);
  const stateRef = useRef(createStressState(seed));
  const ringRef = useRef<KnotTick[]>([]);
  const flowRngRef = useRef(createStressState(seed + 1).rng);
  const stepRef = useRef(0);

  const reset = useCallback(() => {
    stateRef.current = createStressState(seed);
    flowRngRef.current = createStressState(seed + 1).rng;
    ringRef.current = [];
    stepRef.current = 0;
    setTick(undefined);
    setHistory([]);
    setPortfolio(undefined);
    setStep(0);
    debugMetrics.streamCrossings = 0;
  }, [seed]);

  useEffect(() => {
    reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      const current = stepRef.current;
      stepRef.current += 1;
      if (mode === 'sdf-breakthrough') {
        setPortfolio(flowsToPortfolio(sdfBreakthroughFlows(current, assets, flowRngRef.current, spike, spikeAt)));
      } else {
        const next = mode === 'knot-overload' ? nextOverloadTick(stateRef.current) : nextSpiralTick(stateRef.current);
        const ring = ringRef.current;
        ring.push(next);
        if (ring.length > maxTicks) ring.shift();
        setTick(next);
        setHistory(ring.slice());
        debugMetrics.streamCrossings = countDelayCrossings(ring);
      }
      setStep(current + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, mode, intervalMs, maxTicks, assets, spike, spikeAt]);

  return { tick, history, portfolio, step, reset };
}
