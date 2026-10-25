'use client';

import { Activity, Archive, Gauge, MousePointer2, Pause, Play, RotateCcw, ScanLine, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import KnotChart, { type KnotFieldStyle, type GuidePointer, type KnotTick, type KnotTimelineLayer, type ProjectionGesture } from '@/components/2d/KnotChart';
import KnotGlyphPalette from '@/components/KnotGlyphPalette';
import CandySpiralScene from '@/components/3d/CandySpiralScene';
import MatrixGridExplorer from '@/components/MatrixGridExplorer';
import type { TrueGravityTensor } from '@/components/2d/GravityHoneycomb';
import { ARCANA_ATTRACTORS } from '@/lib/arcanaMatrix';
import { useMarketStream } from '@/hooks/useMarketStream';
import { useMetalFeed, type MetalQuote } from '@/hooks/useMetalFeed';
import { ANIMAL_INITIAL_UNIVERSE, adaptMetalJumpIntensity, analyzeMatrixPair, accelerateJumpIntensity, atrJumpSize, calculateAtr, calculateRsi, calculateVortexSearch, calculateBollingerHalfVariance, calculateIchimoku, calculateIndicatorVelocity, calculateMacdPendulum, calculateOrderParameterMacd, detectEcosystemCollapse, applyMatrixInvasionToGeometry, checkMetalResonance, createFieldSimulator, samplePoissonCount, type FieldConfig, type FieldDiagnostics, type FieldStep } from '@/lib/fieldModels';
import { useKnotSelection, type AnimalSyncTrace, type CryptoQuantumTrace } from '@/hooks/useKnotSelection';
import { METAL_INSTRUMENT_CATALOG } from '@/lib/metalMarketData';

const MAX_TICKS = 256;
const DEFAULT_SYMBOL = 'BTCUSD';

const timelineLayers: Array<{ key: keyof KnotTimelineLayerState; label: string; color: string; description: string }> = [
  { key: 't40m', label: 'T-40m', color: '#38bdf8', description: 'noise / momentum' },
  { key: 't4h', label: 'T-4h', color: '#f8d66d', description: 'meso trend' },
  { key: 'target', label: 'T-target', color: '#fb7185', description: 'baseline' },
  { key: 'best', label: 'T-best', color: '#a78bfa', description: 'ideal fractal' },
];

type MetalPhaseSample = FieldDiagnostics & { timestamp: number };

type KnotTimelineLayerState = {
  t40m: boolean;
  t4h: boolean;
  target: boolean;
  best: boolean;
};

type BtcUsdTicker = { price: number; timestamp: number };

type GuideInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function GuideInput({ label, value, min, max, step, suffix, onChange }: GuideInputProps) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[8px] uppercase tracking-[0.16em] text-stone-600">{label}</span>
      <div className="flex items-center border border-white/10 bg-black/20 focus-within:border-cyan-200/50">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
          }}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-[11px] text-cyan-50 outline-none"
        />
        {suffix && <span className="pr-2 font-mono text-[8px] text-stone-600">{suffix}</span>}
      </div>
    </label>
  );
}

function useBtcUsdTicker() {
  const [ticker, setTicker] = useState<BtcUsdTicker>();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
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
          if (payload.type === 'ticker' && Number.isFinite(price)) {
            setTicker({ price, timestamp: Date.parse(payload.time ?? '') || Date.now() });
          }
        } catch {
          // Ignore malformed third-party exchange messages and await the next tick.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        setIsConnected(false);
        if (!stopped) reconnectTimer = window.setTimeout(connect, 2_000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return { ticker, isConnected };
}

function createTimeline(tick: KnotTick, visible: KnotTimelineLayerState): Record<keyof KnotTimelineLayerState, KnotTimelineLayer | undefined> {
  const base = tick.angle;
  const layers: Record<keyof KnotTimelineLayerState, KnotTimelineLayer> = {
    t40m: { price: tick.price, volatility: Math.min(1, tick.volatility * 1.25), angle: base - 0.35, color: '#38bdf8', opacity: 0.36 },
    t4h: { price: tick.price, volatility: Math.min(1, tick.volatility * 0.92), angle: base + 0.62, color: '#f8d66d', opacity: 0.32 },
    target: { price: tick.price, volatility: tick.volatility, angle: base, color: '#fb7185', opacity: 0.42 },
    best: { price: tick.price, volatility: Math.max(0.08, tick.volatility * 0.68), angle: base - 0.88, color: '#a78bfa', opacity: 0.28 },
  };
  return {
    t40m: visible.t40m ? layers.t40m : undefined,
    t4h: visible.t4h ? layers.t4h : undefined,
    target: visible.target ? layers.target : undefined,
    best: visible.best ? layers.best : undefined,
  };
}

function liveTick(data: {
  timestamp?: string;
  current_price?: number;
  chart_data?: { time: number; close: number };
  rendered_physics?: { complexity_c: number; tornado_tilt_deg: number; tension_t: number };
  elastic_energy?: number;
  volume_mass?: number;
  s15_delta: number;
  physics_event?: 'knot_burst' | 'stable';
}): KnotTick | undefined {
  const price = data.current_price ?? data.chart_data?.close;
  if (typeof price !== 'number' || !Number.isFinite(price)) return undefined;
  const complexity = Math.abs(data.rendered_physics?.complexity_c ?? 0);
  const tension = Math.abs(data.rendered_physics?.tension_t ?? data.s15_delta);
  return {
    timestamp: Date.parse(data.timestamp ?? '') || (data.chart_data?.time ?? Date.now() / 1000) * 1000,
    price,
    volatility: Math.min(1, complexity),
    angle: ((data.rendered_physics?.tornado_tilt_deg ?? 0) * Math.PI) / 180,
    magicLength: Math.min(3, Math.abs(data.elastic_energy ?? data.volume_mass ?? 0) / 100),
    tension: Math.min(1, tension / 100),
    jump: data.physics_event === 'knot_burst',
  };
}

export default function KnotChartWorkspace({ field }: { field?: FieldConfig }) {
  const SYMBOL = field?.symbol ?? DEFAULT_SYMBOL;
  const router = useRouter();
  const { marketDataMap, isConnected: isBackendConnected, burstEvent } = useMarketStream(
    process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/signals',
    SYMBOL,
  );
  const { ticker, isConnected: isExchangeConnected } = useBtcUsdTicker();
  const metalFeed = useMetalFeed(field?.kind === 'metal' || field?.kind === 'meta');
  const liveData = field ? undefined : marketDataMap[SYMBOL];
  const [fieldStep, setFieldStep] = useState<FieldStep | undefined>(undefined);
  const [metalPhaseHistory, setMetalPhaseHistory] = useState<MetalPhaseSample[]>([]);
  const lastPhaseTimestamp = useRef<number | undefined>(undefined);
  const tickerRef = useRef<number | undefined>(undefined);
  const [history, setHistory] = useState<KnotTick[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [visible, setVisible] = useState<KnotTimelineLayerState>({ t40m: true, t4h: true, target: true, best: true });
  const [burstCount, setBurstCount] = useState(0);
  const [isGuideTracking, setIsGuideTracking] = useState(false);
  const [guidePointer, setGuidePointer] = useState<GuidePointer>({ x: 0.72, y: 0.22 });
  const [selectedKnotIds, setSelectedKnotIds] = useState<number[]>([]);
  const metalFractureCount = useKnotSelection((state) => state.metalFractures.length);
  const animalSyncEventCount = useKnotSelection((state) => state.animalSyncEvents.length);
  const animalSyncEvents = useKnotSelection((state) => state.animalSyncEvents);
  const cryptoQuantumEvents = useKnotSelection((state) => state.cryptoQuantumEvents);
  const metaPhaseShifts = useKnotSelection((state) => state.metaPhaseShifts);
  const [animalReplayEvent, setAnimalReplayEvent] = useState<AnimalSyncTrace | undefined>(undefined);
  const [cryptoReplayEvent, setCryptoReplayEvent] = useState<CryptoQuantumTrace | undefined>(undefined);
  const [metalFeedJumpEvent, setMetalFeedJumpEvent] = useState(false);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [gridTimeScale, setGridTimeScale] = useState(1);
  const [shellScale, setShellScale] = useState(1);
  const [intrusionRotation, setIntrusionRotation] = useState(0);
  const [patternOffset, setPatternOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'split'>('split');
  const lastTickTimestamp = useRef<number | undefined>(undefined);
  const lastMetalDebugTimestamp = useRef<number | undefined>(undefined);
  const lastProcessedMetalQuote = useRef<MetalQuote | undefined>(undefined);
  const lastMetalQuoteTimestamp = useRef<number | undefined>(undefined);
  const metalJumpResetTimer = useRef<number | undefined>(undefined);
  const animalResonanceRecorded = useRef(false);
  const [metalCleaveCross, setMetalCleaveCross] = useState<{ cell: number; line: number; timestamp: number } | undefined>(undefined);
  const cryptoExtremeRecorded = useRef(false);
  const metaInterferenceRecorded = useRef(false);

  useEffect(() => {
    tickerRef.current = ticker?.price;
  }, [ticker]);

  useEffect(() => {
    if (!field || !isRunning) return;
    const simulate = createFieldSimulator(field.kind);
    const id = window.setInterval(() => {
      const step = simulate(Date.now(), field.kind === 'crypto' || field.kind === 'meta' ? tickerRef.current : undefined);
      setFieldStep(step);
    }, field.intervalMs);
    return () => window.clearInterval(id);
  }, [field, isRunning]);

  useEffect(() => {
    const backendTick = field ? fieldStep?.tick : liveData ? liveTick(liveData) : undefined;
    const previous = history.at(-1);
    const metalPrice = field?.kind === 'metal'
      ? metalFeed.quote?.price ?? fieldStep?.diagnostics?.xauUsdPrice
      : undefined;
    const metalTick = backendTick && metalPrice
      ? {
        ...backendTick,
        price: metalPrice,
        angle: backendTick.angle + Math.atan(metalFeed.angularVelocity) * 0.12,
        volatility: metalFeed.quote ? metalFeed.volatility : fieldStep?.diagnostics?.xauVolatility ?? backendTick.volatility,
      }
      : backendTick;
    const price = ticker?.price;
    const tickerTimestamp = ticker?.timestamp;
    const exchangeTick = typeof price === 'number' && typeof tickerTimestamp === 'number'
      ? {
        timestamp: tickerTimestamp,
        price,
        volatility: Math.min(1, Math.abs(price - (previous?.price ?? price)) / Math.max(price, 1) * 180),
        angle: price >= (previous?.price ?? price) ? -Math.PI / 4 : Math.PI / 4,
        magicLength: Math.min(3, Math.abs(price - (previous?.price ?? price)) / Math.max(price * 0.001, 1)),
        tension: Math.min(1, Math.abs(price - (previous?.price ?? price)) / Math.max(price * 0.0015, 1)),
        jump: false,
      } satisfies KnotTick
      : undefined;
    const next = metalTick ?? (field ? undefined : exchangeTick);
    if (!next || !isRunning || next.timestamp === lastTickTimestamp.current) return;
    lastTickTimestamp.current = next.timestamp;
    setHistory((current) => [...current.slice(-(MAX_TICKS - 1)), next]);
  }, [field, fieldStep, history, isRunning, liveData, metalFeed, ticker]);

  useEffect(() => {
    if (burstEvent) setBurstCount((current) => current + 1);
  }, [burstEvent]);

  useEffect(() => {
    const diagnostics = fieldStep?.diagnostics;
    const timestamp = fieldStep?.tick.timestamp;
    if (field?.kind !== 'metal' || !diagnostics || timestamp === undefined || timestamp === lastPhaseTimestamp.current) return;
    lastPhaseTimestamp.current = timestamp;
    setMetalPhaseHistory((current) => [...current.slice(-119), { ...diagnostics, timestamp }]);
  }, [field?.kind, fieldStep]);

  useEffect(() => {
    if (field?.kind !== 'crypto') {
      cryptoExtremeRecorded.current = false;
      return;
    }
    const diagnostics = fieldStep?.diagnostics;
    const resonanceId = diagnostics?.cryptoResonanceArcanaId;
    const bounds = diagnostics?.cryptoPointCloudBounds;
    const point = diagnostics?.cryptoResonancePoint;
    const amplitude = diagnostics?.cryptoNoiseAmplitude ?? 0;
    if (amplitude < 0.8) cryptoExtremeRecorded.current = false;
    if (!diagnostics || resonanceId === undefined || !bounds || !point || amplitude < 1.15
      || cryptoExtremeRecorded.current) return;
    const arcana = ARCANA_ATTRACTORS.find((item) => item.id === resonanceId);
    if (!arcana || (arcana.id !== 1 && arcana.id !== 18)) return;
    useKnotSelection.getState().recordCryptoQuantumEvent({
      timestamp: fieldStep.tick.timestamp ?? Date.now(),
      price: fieldStep.tick.price,
      hurstExponent: diagnostics.cryptoHurstExponent ?? 0.35,
      maxNoiseAmplitude: amplitude,
      highFrequencyNoise: diagnostics.cryptoHighFrequency ?? 0,
      oscillatorDisplacement: diagnostics.cryptoDampedDisplacement ?? 0,
      oscillatorVelocity: diagnostics.cryptoDampedVelocity ?? 0,
      resonanceArcanaId: arcana.id,
      resonanceArcanaName: arcana.name,
      resonanceArcanaPosition: { x: arcana.x, y: arcana.y, z: arcana.z },
      resonancePoint: { x: point.x, y: point.y, z: point.z ?? 0 },
      pointCloudBounds: {
        min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z ?? 0 },
        max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z ?? 0 },
      },
    });
    cryptoExtremeRecorded.current = true;
    console.info('[crypto-quantum-resonance]', {
      timestamp: fieldStep.tick.timestamp,
      hurstExponent: diagnostics.cryptoHurstExponent,
      maxNoiseAmplitude: amplitude,
      arcana: arcana.roman,
      pointCloudBounds: bounds,
    });
  }, [field?.kind, fieldStep]);

  useEffect(() => {
    if (field?.kind !== 'animal') {
      animalResonanceRecorded.current = false;
      return;
    }
    const diagnostics = fieldStep?.diagnostics;
    if (!diagnostics
      || (diagnostics.kuramotoOrder ?? 0) < 0.95
      || (diagnostics.animalAttractorDistance ?? Number.POSITIVE_INFINITY) > 0.08
      || !diagnostics.animalCentroid
      || !diagnostics.animalCorrelationMatrix
      || !diagnostics.animalPhases) {
      if ((diagnostics?.kuramotoOrder ?? 0) < 0.9) animalResonanceRecorded.current = false;
      return;
    }
    if (animalResonanceRecorded.current) return;
    const arcana = ARCANA_ATTRACTORS.find((item) => item.id === diagnostics.animalAttractorArcanaId);
    if (!arcana || (arcana.id !== 10 && arcana.id !== 21)) return;
    useKnotSelection.getState().recordAnimalSyncEvent({
      timestamp: fieldStep.tick.timestamp ?? Date.now(),
      price: fieldStep.tick.price,
      orderParameter: diagnostics.kuramotoOrder ?? 0,
      meanPhase: diagnostics.kuramotoMeanPhase ?? 0,
      phases: diagnostics.animalPhases,
      correlationMatrix: diagnostics.animalCorrelationMatrix,
      braidTension: diagnostics.animalBraidTension ?? 0,
      attractorStrength: diagnostics.animalAttractorStrength ?? 0,
      arcanaId: arcana.id,
      arcanaName: arcana.name,
      arcanaPosition: { x: arcana.x, y: arcana.y, z: arcana.z },
      centroid: {
        x: diagnostics.animalCentroid.x,
        y: diagnostics.animalCentroid.y,
        z: diagnostics.animalCentroid.z ?? 0,
      },
    });
    animalResonanceRecorded.current = true;
    console.info('[animal-synapse-resonance]', {
      orderParameter: diagnostics.kuramotoOrder,
      meanPhase: diagnostics.kuramotoMeanPhase,
      arcana: arcana.roman,
      braidTension: diagnostics.animalBraidTension,
      timestamp: fieldStep.tick.timestamp,
    });
  }, [field?.kind, fieldStep]);

  const latestTick = history.at(-1);
  const timeline = useMemo(() => latestTick ? createTimeline(latestTick, visible) : undefined, [latestTick, visible]);
  const gravityTensor: TrueGravityTensor | undefined = field ? fieldStep?.gravityTensor : liveData?.true_gravity_tensor;
  const futureProjection = field ? fieldStep?.projection : liveData?.spiral_cube;
  const matrixAnalysis = useMemo(() => {
    const currentPrice = latestTick?.price ?? field?.basePrice ?? 65000;
    const currentVolatility = latestTick?.volatility ?? 0.25;
    const currentTension = latestTick?.tension ?? 0.25;
    const diagnostics = fieldStep?.diagnostics;
    const mass = diagnostics?.mass ?? 0.8;
    const usdIndex = fieldStep?.diagnostics?.usdIndex ?? 100;
    const metalPrice = metalFeed.quote?.price ?? diagnostics?.xauUsdPrice ?? 2650;
    const metalVolatility = metalFeed.quote
      ? metalFeed.volatility
      : diagnostics?.xauVolatility ?? 0;
    const [asset, assetState, source] = field?.kind === 'metal'
      ? [
        'XAU',
        { value: metalPrice, referenceValue: 2650, volatility: metalVolatility, tension: metalFeed.quote ? Math.min(1, 0.42 + metalVolatility * 0.3) : diagnostics?.xauTension ?? 0.42, mass: 1.1 },
        metalFeed.quote?.source === 'LIVE' ? `LIVE / ${metalFeed.quote.provider}` : `SYNTHETIC / ${metalFeed.fallbackReason ?? metalFeed.quote?.fallbackReason ?? 'field model'}`,
      ] as const
      : field?.kind === 'animal'
        ? [
          'ANIMAL BASKET',
          { value: currentPrice, referenceValue: field.basePrice, volatility: currentVolatility, tension: currentTension, mass },
          'synthetic five-commodity basket',
        ] as const
        : field?.kind === 'meta'
          ? [
            'BTC',
            { value: diagnostics?.btcProxyPrice ?? ticker?.price ?? 65000, referenceValue: 65000, volatility: diagnostics?.btcVolatility ?? 0, tension: diagnostics?.btcTension ?? 0.28, mass: 0.95 },
            diagnostics?.btcProxyPrice && !ticker ? 'synthetic BTC proxy' : 'Coinbase BTC-USD when available',
          ] as const
          : field?.kind === 'crypto'
            ? [
              'BTC',
              { value: ticker?.price ?? currentPrice, referenceValue: 65000, volatility: currentVolatility, tension: currentTension, mass },
              ticker ? 'Coinbase BTC-USD' : 'synthetic BTC proxy',
            ] as const
            : [
              'BTC',
              { value: currentPrice, referenceValue: 65000, volatility: currentVolatility, tension: currentTension, mass },
              'BTC chart state',
            ] as const;
    return {
      analysis: analyzeMatrixPair(asset, assetState, 'USD', {
        value: usdIndex,
        referenceValue: 100,
        volatility: diagnostics?.usdVolatility ?? 0.18,
        tension: field?.kind === 'meta' ? 0.36 : 0.3,
        mass: field?.kind === 'meta' ? 2.5 : 2.3,
      }),
      source,
    };
  }, [field, fieldStep, latestTick, metalFeed, ticker]);
  const metalResonance = useMemo(
    () => field?.kind === 'metal' ? checkMetalResonance(matrixAnalysis.analysis) : undefined,
    [field?.kind, matrixAnalysis],
  );
  const indicatorPrices = useMemo(() => history.map((tick) => tick.price), [history]);
  const macdState = useMemo(
    () => field?.kind === 'metal' || field?.kind === 'animal' ? calculateMacdPendulum(indicatorPrices) : undefined,
    [field?.kind, indicatorPrices],
  );
  const ichimokuState = useMemo(
    () => field?.kind === 'metal' || field?.kind === 'animal' ? calculateIchimoku(indicatorPrices) : undefined,
    [field?.kind, indicatorPrices],
  );
  const orderHistory = useRef<number[]>([]);
  const animalOrderMacd = useMemo(() => {
    if (field?.kind !== 'animal') {
      orderHistory.current = [];
      return undefined;
    }
    const order = fieldStep?.diagnostics?.kuramotoOrder;
    if (order !== undefined) orderHistory.current = [...orderHistory.current, order].slice(-96);
    return {
      macd: calculateOrderParameterMacd(orderHistory.current),
      collapse: detectEcosystemCollapse(orderHistory.current),
    };
  }, [field?.kind, fieldStep]);
  const rsiState = useMemo(
    () => field?.kind === 'metal' || field?.kind === 'animal' ? calculateRsi(indicatorPrices) : undefined,
    [field?.kind, indicatorPrices],
  );
  const atrState = useMemo(
    () => field?.kind === 'metal' || field?.kind === 'animal' ? calculateAtr(indicatorPrices) : undefined,
    [field?.kind, indicatorPrices],
  );
  const [indicatorInput, setIndicatorInput] = useState(0);
  const [indicatorEvents, setIndicatorEvents] = useState({ crossTimestamp: 0, crossDirection: 0, kumoBreakTimestamp: 0, kumoBreakDirection: 0, collapseTimestamp: 0 });
  const lastIndicatorTick = useRef(0);
  useEffect(() => {
    const stamp = latestTick?.timestamp ?? history.length;
    if (!ichimokuState || stamp === lastIndicatorTick.current) return;
    lastIndicatorTick.current = stamp;
    const now = Date.now();
    setIndicatorEvents((current) => ({
      ...current,
      ...(ichimokuState.cross !== 0 ? { crossTimestamp: now, crossDirection: ichimokuState.cross } : {}),
      ...(ichimokuState.cloudBreak !== 0 ? { kumoBreakTimestamp: now, kumoBreakDirection: ichimokuState.cloudBreak } : {}),
      ...(animalOrderMacd?.collapse?.collapsed ? { collapseTimestamp: now } : {}),
    }));
  }, [animalOrderMacd, history.length, ichimokuState, latestTick?.timestamp]);
  const indicatorVelocity = useMemo(
    () => calculateIndicatorVelocity(indicatorPrices.at(-1) ?? 0, macdState, ichimokuState, indicatorInput),
    [ichimokuState, indicatorInput, indicatorPrices, macdState],
  );
  const metalJumpIntensity = useMemo(
    () => field?.kind === 'metal' ? accelerateJumpIntensity(adaptMetalJumpIntensity(1 / 90, matrixAnalysis.analysis), macdState) : 0,
    [field?.kind, macdState, matrixAnalysis],
  );
  const metalJumpActive = field?.kind === 'metal'
    && (Boolean(fieldStep?.diagnostics?.poissonJump) || metalFeedJumpEvent);
  const metaXauUsdAnalysis = useMemo(() => {
    if (field?.kind !== 'meta') return undefined;
    const diagnostics = fieldStep?.diagnostics;
    const xauPrice = metalFeed.quote?.price ?? diagnostics?.xauUsdPrice ?? 2650;
    const xauVolatility = metalFeed.quote?.source === 'LIVE'
      ? metalFeed.volatility
      : diagnostics?.xauVolatility ?? 0.12;
    const usdIndex = diagnostics?.usdIndex ?? 100;
    return analyzeMatrixPair(
      'XAU',
      { value: xauPrice, referenceValue: 2650, volatility: xauVolatility, tension: diagnostics?.xauTension ?? 0.42, mass: 1.15 },
      'USD',
      { value: usdIndex, referenceValue: 100, volatility: diagnostics?.usdVolatility ?? 0.18, tension: 0.36, mass: 2.5 },
    );
  }, [field?.kind, fieldStep, metalFeed]);
  const metaInterferenceActive = field?.kind === 'meta' && (metaXauUsdAnalysis?.distance ?? 0) >= 1.08;
  const fieldStyle: KnotFieldStyle | undefined = useMemo(() => {
    if (!field || !fieldStep) return undefined;
    if (field.kind === 'meta') {
      const distance = metaXauUsdAnalysis?.distance ?? fieldStep.diagnostics?.metaXauUsdDistance ?? 0;
      const crackIntensity = distance >= 1.08 ? Math.max(0, Math.min(1, (distance - 1.08) / 0.75)) : 0;
      const analysisArcana = metaXauUsdAnalysis?.resonance.arcana.id;
      const targetArcana = ARCANA_ATTRACTORS.find((arcana) => arcana.id === analysisArcana);
      return {
        ...fieldStep.style,
        metaXauUsdDistance: distance,
        metaCrackIntensity: crackIntensity,
        metaPhaseShift: metaInterferenceActive || fieldStep.style.metaPhaseShift,
        metaTargetArcanaId: metaInterferenceActive && targetArcana
          ? targetArcana.id
          : fieldStep.style.metaTargetArcanaId,
        metaQuantizedAngle: metaInterferenceActive && targetArcana
          ? Math.atan2(targetArcana.y, targetArcana.x)
          : fieldStep.style.metaQuantizedAngle,
        candyPhaseOffset: metaInterferenceActive && targetArcana
          ? Math.atan2(targetArcana.y, targetArcana.x) * 0.025
          : fieldStep.style.candyPhaseOffset,
        metaPulsarMass: fieldStep.diagnostics?.metaPulsarMass ?? fieldStep.style.metaPulsarMass,
      };
    }
    if (field.kind !== 'metal') return fieldStep.style;
    const diagnostics = fieldStep.diagnostics;
    const invasion = applyMatrixInvasionToGeometry(
      'metal',
      { tension: metalFeed.quote ? Math.min(1, 0.42 + metalFeed.volatility * 0.3) : diagnostics?.xauTension ?? 0.42, rigidity: fieldStep.style.rigidity ?? 0.2, angle: latestTick?.angle ?? 0 },
      matrixAnalysis.analysis,
      (latestTick?.timestamp ?? Date.now()) / 1000,
    );
    return {
      ...fieldStep.style,
      vibration: 0.15 + invasion.invasionStrength * 0.2,
      rigidity: invasion.rigidity,
      invasionStrength: invasion.invasionStrength,
      candySpinModifier: 1 + matrixAnalysis.analysis.distance * 0.2,
      matrixDistance: matrixAnalysis.analysis.distance,
      resonanceArcanaId: matrixAnalysis.analysis.resonance.arcana.id,
      metalJump: metalJumpActive,
      metalFieldActive: true,
      metalFractureCell: Math.abs(
        Math.floor(matrixAnalysis.analysis.distance * 1000)
        + matrixAnalysis.analysis.resonance.arcana.id * 7,
      ) % 48,
      metalFractureLine: matrixAnalysis.analysis.resonance.arcana.id % 6,
      metalLightningIntensity: metalJumpActive
        ? Math.min(1, 0.55 + metalJumpIntensity * 0.25 + invasion.invasionStrength * 0.2)
        : 0,
      metalLightningTimestamp: metalJumpActive
        ? latestTick?.timestamp ?? fieldStep.tick.timestamp ?? Date.now()
        : 0,
      metalLayerGrowth: diagnostics?.dailyStep ?? 0,
      metalMicroTremor: metalFeed.quote?.source === 'LIVE'
        ? Math.min(1, Math.abs(metalFeed.angularVelocity) * 4)
        : 0,
    };
  }, [field, fieldStep, latestTick, matrixAnalysis, metaInterferenceActive, metaXauUsdAnalysis, metalFeed, metalJumpActive]);
  useEffect(() => {
    if (field?.kind !== 'meta') {
      metaInterferenceRecorded.current = false;
      return;
    }
    const diagnostics = fieldStep?.diagnostics;
    const distance = metaXauUsdAnalysis?.distance ?? diagnostics?.metaXauUsdDistance ?? 0;
    if (distance < 0.96) metaInterferenceRecorded.current = false;
    const triggered = Boolean(diagnostics?.metaPhaseShift)
      || (metaInterferenceActive && !metaInterferenceRecorded.current);
    if (!triggered || !diagnostics || !fieldStep) return;
    const previousId = diagnostics.metaPreviousArcanaId ?? 11;
    let targetId = metaInterferenceActive
      ? metaXauUsdAnalysis?.resonance.arcana.id ?? diagnostics.metaTargetArcanaId ?? 11
      : diagnostics.metaTargetArcanaId ?? 11;
    if (targetId === previousId) targetId = previousId === 4 ? 11 : 4;
    const previousArcana = ARCANA_ATTRACTORS.find((arcana) => arcana.id === previousId);
    const targetArcana = ARCANA_ATTRACTORS.find((arcana) => arcana.id === targetId);
    if (!previousArcana || !targetArcana) return;
    useKnotSelection.getState().recordMetaPhaseShift({
      timestamp: fieldStep.tick.timestamp ?? Date.now(),
      indexPrice: fieldStep.tick.price,
      pulsarMass: diagnostics.metaPulsarMass ?? diagnostics.mass,
      quantizedAngle: diagnostics.metaQuantizedAngle ?? fieldStep.tick.angle,
      quantizedStepIndex: diagnostics.metaQuantizedStepIndex ?? Math.floor(fieldStep.tick.angle / (Math.PI / 12)),
      previousArcanaId: previousId,
      previousArcanaPosition: { x: previousArcana.x, y: previousArcana.y, z: previousArcana.z },
      targetArcanaId: targetId,
      targetArcanaPosition: { x: targetArcana.x, y: targetArcana.y, z: targetArcana.z },
      xauUsdDistance: distance,
      crackIntensity: Math.max(0, Math.min(1, (distance - 1.08) / 0.75)),
    });
    metaInterferenceRecorded.current = true;
    console.warn('[meta-spacetime-phase-shift]', {
      timestamp: fieldStep.tick.timestamp,
      pulsarMass: diagnostics.metaPulsarMass,
      quantizedAngle: diagnostics.metaQuantizedAngle,
      xauUsdDistance: distance,
      from: previousArcana.roman,
      to: targetArcana.roman,
      source: metalFeed.quote?.source ?? 'SYNTHETIC',
    });
  }, [field?.kind, fieldStep, metaInterferenceActive, metaXauUsdAnalysis, metalFeed.quote?.source]);
  const bollinger = useMemo(() => {
    if (field?.kind !== 'metal' && field?.kind !== 'animal') return undefined;
    const prices = history.map((tick) => tick.price);
    if (field.kind === 'metal') {
      const jump = fieldStep?.diagnostics?.jumpIntensity ?? 0;
      const reference = prices.at(-1) ?? 0;
      return calculateBollingerHalfVariance(prices, { jumpIntensity: jump, jumpSize: atrJumpSize(reference, atrState) });
    }
    const order = fieldStep?.diagnostics?.kuramotoOrder ?? 0;
    return calculateBollingerHalfVariance(prices, { phaseVariance: 1 - order * order });
  }, [atrState, field?.kind, fieldStep, history]);
  const vortex = useMemo(
    () => calculateVortexSearch(indicatorPrices.at(-1) ?? 0, rsiState, atrState, indicatorVelocity),
    [atrState, indicatorPrices, indicatorVelocity, rsiState],
  );
  const bollingerStyle = useMemo(() => {
    if (!fieldStyle || !bollinger) return fieldStyle;
    return {
      ...fieldStyle,
      bollingerPercentB: bollinger.percentB,
      bollingerBandwidth: bollinger.bandwidth,
      bollingerSigmaUp: bollinger.sigmaUp,
      bollingerSigmaDown: bollinger.sigmaDown,
      macdDistortionHeight: macdState?.distortionHeight ?? 0,
      macdAcceleration: macdState?.acceleration ?? 0,
      macdPhaseDifference: macdState?.phaseDifference ?? 0,
      ichimokuCrossTimestamp: indicatorEvents.crossTimestamp,
      ichimokuCrossDirection: indicatorEvents.crossDirection,
      kumoBreakTimestamp: indicatorEvents.kumoBreakTimestamp,
      kumoBreakDirection: indicatorEvents.kumoBreakDirection,
      kumoCenter: ichimokuState && indicatorPrices.at(-1) ? ((ichimokuState.cloudTop + ichimokuState.cloudBottom) / 2 - indicatorPrices.at(-1)!) / indicatorPrices.at(-1)! : 0,
      kumoThickness: ichimokuState && indicatorPrices.at(-1) ? ichimokuState.cloudThickness / indicatorPrices.at(-1)! : 0,
      rsiValue: rsiState?.value ?? 50,
      rsiOmega: rsiState?.omega ?? 0,
      rsiOverheat: rsiState?.overheat ?? 0,
      atrPulse: atrState?.pulse ?? 0,
      atrFaultDepth: atrState?.faultDepth ?? 1,
      animalRsiSpread: fieldStep?.diagnostics?.animalRsiSpread ?? 0,
      vortexSpeed: vortex.rotationSpeed,
      vortexSingularity: vortex.singularityPrice,
      vortexAcceleration: vortex.accelerationZone ? 1 : 0,
      vortexHighlight: vortex.highlightIndex,
      indicatorVelocity: indicatorVelocity.indicator_velocity,
      targetPriceProjection: indicatorVelocity.target_price_projection,
      animalOrderRise: animalOrderMacd?.macd?.riseStrength ?? 0,
      animalCollapseTimestamp: indicatorEvents.collapseTimestamp,
      ...(field?.kind === 'metal' && metalCleaveCross ? {
        metalCleaveCrossCell: metalCleaveCross.cell,
        metalCleaveCrossLine: metalCleaveCross.line,
        metalCleaveCrossTimestamp: metalCleaveCross.timestamp,
      } : {}),
    };
  }, [animalOrderMacd, atrState, bollinger, field?.kind, fieldStep, fieldStyle, ichimokuState, indicatorEvents, indicatorPrices, indicatorVelocity, macdState, metalCleaveCross, rsiState, vortex]);
  const visualFieldStyle = useMemo(() => {
    if (!bollingerStyle) return bollingerStyle;
    const fieldStyle = bollingerStyle;
    if (field?.kind === 'animal' && animalReplayEvent) {
      return {
        ...fieldStyle,
        animalPulseStrength: animalReplayEvent.orderParameter,
        animalPulsePhase: animalReplayEvent.meanPhase,
        animalBraidStrength: animalReplayEvent.braidTension,
        animalAttractorArcanaId: animalReplayEvent.arcanaId,
      };
    }
    if (field?.kind === 'crypto' && cryptoReplayEvent) {
      return {
        ...fieldStyle,
        cryptoHurstExponent: cryptoReplayEvent.hurstExponent,
        cryptoNoiseAmplitude: cryptoReplayEvent.maxNoiseAmplitude,
        cryptoHighFrequencyNoise: cryptoReplayEvent.highFrequencyNoise,
        cryptoOscillatorDisplacement: cryptoReplayEvent.oscillatorDisplacement,
        cryptoResonanceStrength: 1,
        cryptoResonanceArcanaId: cryptoReplayEvent.resonanceArcanaId,
        cryptoResonancePoint: cryptoReplayEvent.resonancePoint,
      };
    }
    return fieldStyle;
  }, [animalReplayEvent, bollingerStyle, cryptoReplayEvent, field?.kind]);
  useEffect(() => {
    const quote = metalFeed.quote;
    const resonance = metalResonance;
    if (field?.kind !== 'metal' || quote?.source !== 'LIVE' || quote === lastProcessedMetalQuote.current) return;
    lastProcessedMetalQuote.current = quote;
    const previousTimestamp = lastMetalQuoteTimestamp.current;
    const receivedAt = Date.now();
    lastMetalQuoteTimestamp.current = receivedAt;
    const elapsedSeconds = previousTimestamp === undefined
      ? 0
      : Math.min(120, Math.max(0, (receivedAt - previousTimestamp) / 1000));
    const poissonEvents = samplePoissonCount(Math.random, metalJumpIntensity, elapsedSeconds);
    const forcedByResonance = Boolean(resonance?.shouldForceJump);
    if (!forcedByResonance && poissonEvents === 0) return;

    setMetalFeedJumpEvent(true);
    if (metalJumpResetTimer.current !== undefined) window.clearTimeout(metalJumpResetTimer.current);
    metalJumpResetTimer.current = window.setTimeout(() => setMetalFeedJumpEvent(false), 2500);
    const analysis = matrixAnalysis.analysis;
    const arcana = forcedByResonance ? resonance!.arcana : analysis.resonance.arcana;
    const crossingPathOffset = Math.hypot(
      analysis.assetPosition.x - analysis.counterPosition.x,
      analysis.assetPosition.y - analysis.counterPosition.y,
    );
    useKnotSelection.getState().recordMetalFracture({
      timestamp: quote.timestamp,
      price: quote.price,
      source: quote.provider,
      matrixDistance: analysis.distance,
      distanceTensor: {
        x: analysis.assetPosition.x - analysis.counterPosition.x,
        y: analysis.assetPosition.y - analysis.counterPosition.y,
        z: (analysis.assetPosition.z ?? 0) - (analysis.counterPosition.z ?? 0),
      },
      crossingPathOffset,
      arcanaId: arcana.id,
      arcanaName: arcana.name,
      arcanaSymbol: arcana.roman,
      arcanaPosition: { x: arcana.x, y: arcana.y, z: arcana.z },
    });
    console.warn('[metal-resonance-fracture]', {
      price: quote.price,
      matrixDistance: analysis.distance,
      arcana: arcana.roman,
      jumpIntensity: metalJumpIntensity,
      poissonEvents,
      forcedByResonance,
      crossingPathOffset,
    });
  }, [field?.kind, matrixAnalysis, metalFeed.quote, metalJumpIntensity, metalResonance]);
  useEffect(() => () => {
    if (metalJumpResetTimer.current !== undefined) window.clearTimeout(metalJumpResetTimer.current);
  }, []);
  useEffect(() => {
    const quote = metalFeed.quote;
    if (field?.kind !== 'metal' || quote?.source !== 'LIVE' || quote.timestamp === lastMetalDebugTimestamp.current) return;
    lastMetalDebugTimestamp.current = quote.timestamp;
    console.info('[metal-live-geometry]', {
      priceUsdPerOunce: quote.price,
      provider: quote.provider,
      matrixDistance: matrixAnalysis.analysis.distance,
      resonance: matrixAnalysis.analysis.resonance.arcana.name,
      priceVelocityUsdPerSecond: metalFeed.priceVelocity,
      angularVelocityRadiansPerSecond: metalFeed.angularVelocity,
      invasionStrength: fieldStyle?.invasionStrength ?? 0,
      candySpinModifier: fieldStyle?.candySpinModifier ?? 1,
      radialDeformationCoefficient: 0.035 * (fieldStyle?.invasionStrength ?? 0),
      jumpIntensity: metalJumpIntensity,
      forcedResonanceJump: metalResonance?.shouldForceJump ?? false,
    });
  }, [field?.kind, fieldStyle, matrixAnalysis, metalFeed, metalJumpIntensity, metalResonance]);
  const isConnected = field ? true : isBackendConnected || isExchangeConnected;
  const streamLabel = field?.kind === 'metal'
    ? `XAU/USD ${metalFeed.quote?.source ?? 'SYNTHETIC'}`
    : field ? field.feedLabel : liveData ? 'BTCUSD API' : 'BTC-USD exchange';
  const memoryBytes = MAX_TICKS * (8 * 3 + 4 * 4 + 1);
  const bufferPercent = Math.round((history.length / MAX_TICKS) * 100);

  function resetChart() {
    lastTickTimestamp.current = undefined;
    lastPhaseTimestamp.current = undefined;
    setHistory([]);
    setMetalPhaseHistory([]);
  }

  function updateGuidePointer(pointer: GuidePointer) {
    setGuidePointer((current) => Math.abs(current.x - pointer.x) > 0.005 || Math.abs(current.y - pointer.y) > 0.005 ? pointer : current);
  }

  function updateGuideCoordinate(axis: keyof GuidePointer, percent: number) {
    setGuidePointer((current) => ({ ...current, [axis]: Math.max(0, Math.min(1, percent / 100)) }));
    setIsGuideTracking(true);
  }

  function toggleKnot(id: number) {
    if (selectionLocked) return;
    const isSelected = selectedKnotIds.includes(id);
    if (!isSelected && latestTick) {
      const arcana = matrixAnalysis.analysis.resonance.arcana;
      useKnotSelection.getState().recordKnotTrace(id, {
        timestamp: Date.now(),
        assetPair: `${matrixAnalysis.analysis.asset}/${matrixAnalysis.analysis.counterAsset}`,
        matrixDistance: matrixAnalysis.analysis.distance,
        resonanceArcanaId: arcana.id,
        resonanceArcanaName: arcana.name,
        tension: latestTick.tension,
        price: latestTick.price,
        invasionDistance: matrixAnalysis.analysis.distance,
        resonatingArcana: arcana.name,
      });
    }
    setSelectedKnotIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function handleGesture(gesture: ProjectionGesture) {
    switch (gesture.type) {
      case 'toggle-selection-lock':
        setSelectionLocked((current) => !current);
        break;
      case 'time-scale':
        setGridTimeScale((current) => Math.max(0.55, Math.min(1.75, current + gesture.delta)));
        break;
      case 'rotate-intrusion':
        setIntrusionRotation((current) => current + gesture.delta);
        break;
      case 'set-shell-scale':
        setShellScale(Math.max(0.65, Math.min(1.45, gesture.scale)));
        break;
      case 'open-ticket':
        router.push(`/tickets?intent=${gesture.intent}&knots=${selectedKnotIds.join(',')}`);
        break;
      case 'cycle-pattern':
        setPatternOffset((current) => (current + gesture.delta + 4) % 4);
        break;
      case 'change-inventory-page':
        setInventoryPage((current) => (current + gesture.delta + 4) % 4);
        break;
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#02060d] text-stone-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(14,116,144,0.18),transparent_34%),linear-gradient(145deg,#020617_0%,#07111b_52%,#030712_100%)]" />
      <div className="relative flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-100/10 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/30 bg-amber-100/[0.06] text-amber-200"><Activity className="h-5 w-5" /></div>
            <div><p className="font-mono text-[9px] uppercase tracking-[0.38em] text-cyan-200/60">Native projection workspace</p><h1 className="mt-1 text-xl tracking-[0.14em] text-cyan-50 sm:text-2xl">{field?.title ?? 'BTCUSD / KNOT PROJECTION'}</h1></div>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500"><Link href="/tickets" className="border border-white/10 px-2 py-1 text-stone-400 hover:border-cyan-200/45 hover:text-cyan-100">Ticket ledger</Link><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isConnected && isRunning && (field?.kind !== 'metal' || metalFeed.quote?.source === 'LIVE') ? 'bg-emerald-300 shadow-[0_0_12px_#6ee7b7]' : field?.kind === 'metal' && isRunning ? 'bg-amber-300' : 'bg-stone-600'}`} /> {isRunning ? isConnected ? `${field?.kind === 'metal' && metalFeed.quote?.source !== 'LIVE' ? 'fallback' : 'live'} / ${streamLabel}` : 'awaiting BTCUSD feed' : 'paused'}</span><span className="hidden text-stone-700 sm:inline">canvas / requestAnimationFrame</span></div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex min-h-[calc(100vh-75px)] flex-col p-4 sm:p-6 lg:p-8">
            <MatrixGridExplorer
              analysis={matrixAnalysis.analysis}
              label={field?.kind === 'metal' ? 'XAU / USD MATRIX DISTANCE' : `${matrixAnalysis.analysis.asset} / USD MATRIX DISTANCE`}
              source={matrixAnalysis.source}
              height={188}
              animalCentroid={field?.kind === 'animal' ? fieldStep?.diagnostics?.animalCentroid : undefined}
              animalAttractorArcanaId={field?.kind === 'animal' ? fieldStep?.diagnostics?.animalAttractorArcanaId : undefined}
              animalAttractorStrength={field?.kind === 'animal' ? fieldStep?.diagnostics?.animalAttractorStrength : undefined}
              cryptoResonancePoint={field?.kind === 'crypto' ? cryptoReplayEvent?.resonancePoint ?? fieldStep?.diagnostics?.cryptoResonancePoint : undefined}
              cryptoResonanceArcanaId={field?.kind === 'crypto' ? cryptoReplayEvent?.resonanceArcanaId ?? fieldStep?.diagnostics?.cryptoResonanceArcanaId : undefined}
              cryptoResonanceStrength={field?.kind === 'crypto' ? (cryptoReplayEvent ? 1 : fieldStep?.diagnostics?.cryptoResonanceStrength) : undefined}
            />
            {field?.kind === 'metal' && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-amber-200/15 bg-amber-100/[0.025] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.12em] text-stone-500">
                <span className="text-amber-100/75">Metal data catalog / {METAL_INSTRUMENT_CATALOG.length} benchmark symbols</span>
                <span>Exchange stream + OTC daily assessments + 17 rare-earth benchmarks</span>
                <span className={metalFeed.quote?.source === 'LIVE' ? 'text-emerald-200/80' : 'text-rose-200/75'}>
                  {metalFeed.quote?.source ?? 'SYNTHETIC'} / XAU {metalFeed.quote?.price.toFixed(2) ?? fieldStep?.diagnostics?.xauUsdPrice?.toFixed(2) ?? '--'} USD
                  {metalFeed.fallbackReason && ` / ${metalFeed.fallbackReason}`}
                </span>
                <span className={metalResonance?.shouldForceJump ? 'text-rose-200' : 'text-stone-500'}>
                  λ {metalJumpIntensity.toFixed(4)} / {metalResonance?.arcana.roman} {metalResonance?.arcana.name}
                  {metalResonance?.shouldForceJump ? ' / FRACTURE' : ''} / INVENTORY {metalFractureCount}
                </span>
              </div>
            )}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['price', latestTick?.price.toFixed(2) ?? '--'],
                ['volatility', latestTick ? `${Math.round(latestTick.volatility * 100)}%` : '--'],
                ['tension', latestTick ? `${Math.round(latestTick.tension * 100)}%` : '--'],
                ['burst events', String(burstCount)],
              ].map(([label, value]) => <div key={label} className="border border-white/10 bg-white/[0.025] px-3 py-2"><p className="font-mono text-[8px] uppercase tracking-[0.22em] text-stone-600">{label}</p><p className="mt-1 font-mono text-sm text-cyan-100">{value}</p></div>)}
            </div>
            {field?.kind === 'metal' && (
              <section className="mb-4 border border-amber-200/20 bg-[#080b12]/85 px-3 py-2" aria-label="Metal tension angular velocity phase plane">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-100/80">Metal / tension–angular velocity phase plane</p>
                    <p className="mt-1 font-mono text-[8px] text-stone-600">SMM-like daily Heaviside steps + LME-like 1s reversion / Poisson jump intensity λ = 1/90 s⁻¹</p>
                  </div>
                  <p className="font-mono text-[8px] text-stone-500">
                    T {fieldStep?.diagnostics?.tension.toFixed(2) ?? '--'} / ω {fieldStep?.diagnostics?.angularVelocity.toFixed(3) ?? '--'} rad·s⁻¹
                    {fieldStep?.diagnostics?.poissonJump && <span className="ml-2 text-rose-300">POISSON JUMP</span>}
                  </p>
                </div>
                <svg viewBox="0 0 600 128" className="mt-2 h-24 w-full" role="img" aria-label="Metal tension versus angular velocity history">
                  <path d="M28 12V104H586 M28 58H586" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
                  <text x="30" y="121" fill="#64748b" fontSize="8">TENSION →</text>
                  <text x="30" y="10" fill="#64748b" fontSize="8">ANGULAR VELOCITY ω</text>
                  {metalPhaseHistory.length > 1 && (
                    <polyline
                      points={metalPhaseHistory.map((sample) => {
                        const x = 30 + sample.tension * 550;
                        const y = 58 - Math.max(-3, Math.min(3, sample.angularVelocity)) * 14;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  )}
                  {metalPhaseHistory.map((sample) => {
                    const x = 30 + sample.tension * 550;
                    const y = 58 - Math.max(-3, Math.min(3, sample.angularVelocity)) * 14;
                    return <circle key={sample.timestamp} cx={x} cy={y} r={sample.poissonJump ? 3.5 : 1.7} fill={sample.poissonJump ? '#fb7185' : '#67e8f9'} />;
                  })}
                </svg>
              </section>
            )}
            {field?.kind === 'animal' && (
              <section
                className={`mb-4 border px-3 py-2 ${fieldStep?.diagnostics?.animalSync ? 'border-amber-300/60 bg-amber-200/[0.08]' : 'border-emerald-200/20 bg-[#080b12]/85'}`}
                aria-label="Animal commodity ecosystem synchronization"
                aria-live="polite"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`font-mono text-[9px] uppercase tracking-[0.2em] ${fieldStep?.diagnostics?.animalSync ? 'text-amber-200' : 'text-emerald-100/80'}`}>
                    {fieldStep?.diagnostics?.animalSync ? 'Kuramoto sync alert / projection ornament' : 'Commodity ecosystem / phase coherence'}
                  </p>
                  <p className="font-mono text-[8px] text-stone-500">
                    r {fieldStep?.diagnostics?.kuramotoOrder?.toFixed(2) ?? '--'}
                    {' '} / ψ {fieldStep?.diagnostics?.kuramotoMeanPhase?.toFixed(2) ?? '--'}
                    {' '} / corr {fieldStep?.diagnostics?.meanCorrelation?.toFixed(2) ?? '--'}
                    {' '} / braid T {fieldStep?.diagnostics?.animalBraidTension?.toFixed(2) ?? '--'}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ANIMAL_INITIAL_UNIVERSE.map(({ symbol, group }) => (
                    <span key={symbol} className="border border-white/10 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-stone-400">
                      {symbol} / {group}
                    </span>
                  ))}
                  {fieldStep?.diagnostics?.animalSync && (
                    <span className="border border-amber-200/50 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-amber-100">
                      synchronized / golden-angle projection
                    </span>
                  )}
                  {fieldStep?.diagnostics?.animalAttractorArcanaId !== undefined && (
                    <span className={`border px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${
                      (fieldStep.diagnostics.animalAttractorDistance ?? 1) < 0.08
                        ? 'border-cyan-200/60 text-cyan-100'
                        : 'border-white/10 text-stone-500'
                    }`}>
                      attractor {fieldStep.diagnostics.animalAttractorArcanaId === 10 ? 'X / wheel' : 'XXI / world'}
                      {' '} / D {fieldStep.diagnostics.animalAttractorDistance?.toFixed(3) ?? '--'}
                    </span>
                  )}
                  <span className="border border-white/10 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-stone-500">
                    synapse inventory / {animalSyncEventCount}
                  </span>
                  <button
                    type="button"
                    disabled={animalSyncEvents.length === 0}
                    onClick={() => setAnimalReplayEvent((current) => current ? undefined : animalSyncEvents.at(-1))}
                    className="border border-cyan-200/25 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-cyan-100 enabled:hover:bg-cyan-300/10 disabled:opacity-40"
                  >
                    {animalReplayEvent ? 'Stop sync replay' : 'Replay latest sync'}
                  </button>
                </div>
                {animalReplayEvent && (
                  <div className="mt-2 border border-cyan-200/20 bg-cyan-200/[0.035] p-2 font-mono text-[8px] text-cyan-50/70" aria-live="polite">
                    <p>
                      REPLAY / {new Date(animalReplayEvent.timestamp).toLocaleString()} / r {animalReplayEvent.orderParameter.toFixed(3)}
                      {' '} / ψ {animalReplayEvent.meanPhase.toFixed(3)} / {animalReplayEvent.arcanaId === 10 ? 'X WHEEL' : 'XXI WORLD'}
                      {' '} / braid T {animalReplayEvent.braidTension.toFixed(3)}
                    </p>
                    <p className="mt-1 text-stone-500">
                      PHASES [{animalReplayEvent.phases.map((phase) => phase.toFixed(2)).join(' · ')}]
                      {' '} / CORR [{animalReplayEvent.correlationMatrix.map((row) => row.map((value) => value.toFixed(1)).join(',')).join(' / ')}]
                    </p>
                  </div>
                )}
                {fieldStep?.diagnostics?.dataContract && (
                  <p className="mt-2 border-t border-white/10 pt-2 font-mono text-[8px] text-stone-500">
                    {fieldStep.diagnostics.dataContract.symbol} / {fieldStep.diagnostics.dataContract.source.provider}
                    {' '}· {fieldStep.diagnostics.dataContract.timeframe}
                    {' '}· coverage {Math.round((fieldStep.diagnostics.dataContract.composition?.coverage ?? 0) * 100)}%
                    {' '}· {fieldStep.diagnostics.dataContract.composition?.contributors.length ?? 0} constituents
                    {' '}· {fieldStep.diagnostics.dataContract.composition?.version}
                  </p>
                )}
              </section>
            )}
            {field?.kind === 'crypto' && (
              <section className="mb-4 border border-violet-200/20 bg-[#080b12]/85 px-3 py-2" aria-label="Crypto fBm and spoof oscillator diagnostics">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-violet-100/80">Crypto / fractional noise × damped spoof oscillator</p>
                  <p className="font-mono text-[8px] text-stone-500">
                    H 0.35 / ζ 0.48 / f₀ 1.25 Hz
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] text-stone-500 sm:grid-cols-4">
                  <span>fBm ε / {fieldStep?.diagnostics?.cryptoFractionalNoise?.toFixed(2) ?? '--'}</span>
                  <span>HF sin/cos / {fieldStep?.diagnostics?.cryptoHighFrequency?.toFixed(2) ?? '--'}</span>
                  <span>book x / {fieldStep?.diagnostics?.cryptoDampedDisplacement?.toFixed(2) ?? '--'}</span>
                  <span>book v / {fieldStep?.diagnostics?.cryptoDampedVelocity?.toFixed(2) ?? '--'}</span>
                  <span>resonance / {fieldStep?.diagnostics?.cryptoResonanceArcanaId === 1 ? 'I MAGICIAN' : fieldStep?.diagnostics?.cryptoResonanceArcanaId === 18 ? 'XVIII MOON' : '—'}</span>
                  <span>cloud bounds / {fieldStep?.diagnostics?.cryptoPointCloudBounds ? 'captured' : '—'}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-stone-500">quantum inventory / {cryptoQuantumEvents.length}</span>
                  <button
                    type="button"
                    disabled={cryptoQuantumEvents.length === 0}
                    onClick={() => setCryptoReplayEvent((current) => current ? undefined : cryptoQuantumEvents.at(-1))}
                    className="border border-violet-200/25 px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-violet-100 enabled:hover:bg-violet-300/10 disabled:opacity-40"
                  >
                    {cryptoReplayEvent ? 'Stop state replay' : 'Replay latest state'}
                  </button>
                </div>
                {cryptoReplayEvent && (
                  <div className="mt-2 border border-violet-200/20 bg-violet-200/[0.035] p-2 font-mono text-[8px] text-violet-50/70" aria-live="polite">
                    <p>
                      REPLAY / {new Date(cryptoReplayEvent.timestamp).toLocaleString()} / H {cryptoReplayEvent.hurstExponent.toFixed(3)}
                      {' '} / εmax {cryptoReplayEvent.maxNoiseAmplitude.toFixed(3)} / ARCANA {cryptoReplayEvent.resonanceArcanaId === 1 ? 'I MAGICIAN' : cryptoReplayEvent.resonanceArcanaId === 18 ? 'XVIII MOON' : 'NONE'}
                      {cryptoReplayEvent.candyId && ` / ${cryptoReplayEvent.candyId}`}
                      {cryptoReplayEvent.candySync !== undefined && ` / ${cryptoReplayEvent.candySync ? 'SYNC' : 'PHASED'}`}
                    </p>
                    <p className="mt-1 text-stone-500">
                      Bounds X [{cryptoReplayEvent.pointCloudBounds.min.x.toFixed(2)}, {cryptoReplayEvent.pointCloudBounds.max.x.toFixed(2)}]
                      {' '} Y [{cryptoReplayEvent.pointCloudBounds.min.y.toFixed(2)}, {cryptoReplayEvent.pointCloudBounds.max.y.toFixed(2)}]
                      {' '} Z [{cryptoReplayEvent.pointCloudBounds.min.z.toFixed(2)}, {cryptoReplayEvent.pointCloudBounds.max.z.toFixed(2)}]
                    </p>
                    <svg viewBox="0 0 220 76" className="mt-1 h-14 w-full" role="img" aria-label="Replayed quantum point-cloud bounding box">
                      <rect x="12" y="8" width="196" height="58" fill="none" stroke="rgba(196,181,253,0.35)" />
                      {Array.from({ length: 42 }, (_, index) => {
                        const seed = ((index + 1) * 16807) % 2147483647 / 2147483647;
                        const ratioX = cryptoReplayEvent.pointCloudBounds.min.x === cryptoReplayEvent.pointCloudBounds.max.x
                          ? 0.5
                          : seed;
                        const ratioY = cryptoReplayEvent.pointCloudBounds.min.y === cryptoReplayEvent.pointCloudBounds.max.y
                          ? 0.5
                          : ((seed * 3.71) % 1);
                        return <circle key={index} cx={14 + ratioX * 192} cy={10 + ratioY * 54} r={index % 7 === 0 ? 1.8 : 1} fill={index % 2 ? '#a78bfa' : '#67e8f9'} fillOpacity="0.72" />;
                      })}
                    </svg>
                  </div>
                )}
              </section>
            )}
            {field?.kind === 'meta' && (
              <section className="mb-4 border border-cyan-200/20 bg-[#080b12]/85 px-3 py-2" aria-label="Meta relative equity and currency constituents">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-100/80">Meta / relative constituent matrix · base 100</p>
                  <p className="font-mono text-[8px] text-stone-500">
                    BTC/USD D {fieldStep?.diagnostics?.matrixDistance?.toFixed(2) ?? '--'} / Δθ {((fieldStep?.diagnostics?.metaMicroTremor ?? 0) * 180 / Math.PI).toFixed(2)}° / corr {fieldStep?.diagnostics?.metaMeanCorrelation?.toFixed(2) ?? '--'}
                  </p>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1.5 font-mono text-[8px] text-stone-500 sm:grid-cols-4">
                  <span>Pulsar mass / {fieldStep?.diagnostics?.metaPulsarMass?.toFixed(3) ?? '--'}</span>
                  <span>Filtered index / {latestTick?.price.toFixed(2) ?? '--'} · 2nd-order Butterworth</span>
                  <span>Rigid angle / {((fieldStep?.diagnostics?.metaQuantizedAngle ?? 0) * 180 / Math.PI).toFixed(1)}° / 15° + hysteresis</span>
                  <span>XAU/USD D / {metaXauUsdAnalysis?.distance.toFixed(3) ?? '--'} / {metalFeed.quote?.source === 'LIVE' ? 'LIVE' : 'SYNTHETIC'}</span>
                  <span className={metaInterferenceActive ? 'text-orange-300' : ''}>
                    Horizon / {metaInterferenceActive ? `CRACK ${((fieldStyle?.metaCrackIntensity ?? 0) * 100).toFixed(0)}%` : 'stable'}
                    {' '}· {ARCANA_ATTRACTORS.find((arcana) => arcana.id === fieldStyle?.metaTargetArcanaId)?.roman ?? '--'}
                    {' '} {ARCANA_ATTRACTORS.find((arcana) => arcana.id === fieldStyle?.metaTargetArcanaId)?.name ?? ''}
                  </span>
                  <span>Gravity ripple / {fieldStep?.diagnostics?.metaQuantizedStep ? 'PULSE' : 'quiet'} · phase shifts {metaPhaseShifts.length}</span>
                </div>
                {metaPhaseShifts.at(-1) && (
                  <p className="mt-1 font-mono text-[8px] text-orange-200/80">
                    LAST PHASE SHIFT / {ARCANA_ATTRACTORS.find((arcana) => arcana.id === metaPhaseShifts.at(-1)?.previousArcanaId)?.roman ?? '--'}
                    {' '}→ {ARCANA_ATTRACTORS.find((arcana) => arcana.id === metaPhaseShifts.at(-1)?.targetArcanaId)?.roman ?? '--'}
                    {' '}· M {metaPhaseShifts.at(-1)?.pulsarMass.toFixed(3)}
                    {' '}· D {metaPhaseShifts.at(-1)?.xauUsdDistance.toFixed(3)}
                  </p>
                )}
                <p className="mt-1 font-mono text-[8px] text-stone-600">
                  Relative dispersion {fieldStep?.diagnostics?.metaRelativeDispersion?.toFixed(3) ?? '--'} / filtered index + floor quantizer with boundary hysteresis / XAU-USD rupture threshold 1.08
                </p>
                {fieldStep?.diagnostics?.dataContract && (
                  <p className="mt-1 font-mono text-[8px] text-stone-500">
                    {fieldStep.diagnostics.dataContract.symbol} / {fieldStep.diagnostics.dataContract.source.provider}
                    {' '}· {fieldStep.diagnostics.dataContract.timeframe}
                    {' '}· coverage {Math.round((fieldStep.diagnostics.dataContract.composition?.coverage ?? 0) * 100)}%
                    {' '}· {fieldStep.diagnostics.dataContract.composition?.contributors.length ?? 0} constituents
                    {' '}· {fieldStep.diagnostics.dataContract.composition?.version}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {(fieldStep?.diagnostics?.metaRelativeAssets ?? []).map((asset) => (
                    <span key={asset.symbol} className="border border-white/10 px-1.5 py-1 font-mono text-[8px] text-stone-400">
                      <span className="text-stone-200">{asset.symbol}</span> / {asset.assetClass} / {asset.normalizedIndex.toFixed(2)}
                      <span className={asset.peerRelativePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                        {' '}Δpeer {asset.peerRelativePercent >= 0 ? '+' : ''}{asset.peerRelativePercent.toFixed(3)}% / ρ {asset.rollingCorrelation.toFixed(2)}
                      </span>
                    </span>
                  ))}
                </div>
              </section>
            )}
            {/* View Mode Bar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-cyan-500/20 bg-black/40 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200">View</span>
                <button
                  type="button"
                  onClick={() => setViewMode('2d')}
                  className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition ${
                    viewMode === '2d'
                      ? 'border border-cyan-400 bg-cyan-400/15 text-cyan-100'
                      : 'border border-white/10 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  2D Live Projection
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition ${
                    viewMode === '3d'
                      ? 'border border-amber-400 bg-amber-400/15 text-amber-100'
                      : 'border border-white/10 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  3D Candy Spiral (384 Knots)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition ${
                    viewMode === 'split'
                      ? 'border border-violet-400 bg-violet-400/15 text-violet-100'
                      : 'border border-white/10 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Dual Split View
                </button>
              </div>
              <span className="hidden font-mono text-[8px] uppercase tracking-[0.16em] text-stone-500 sm:inline">
                48-Cell Fibonacci • 4 Timeline Spirals • InstancedMesh
              </span>
            </div>

            {viewMode === 'split' ? (
              <div className="space-y-4">
                <div className="grid flex-none gap-4 xl:grid-cols-[minmax(0,1fr)_184px]">
                  <div className="relative h-[560px] min-h-[480px] overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#030a12]/90 shadow-[0_0_90px_rgba(34,211,238,0.09)]">
                    <KnotChart onMetalCleaveCross={setMetalCleaveCross} tick={latestTick} timeline={timeline} history={history} gravityTensor={gravityTensor} futureProjection={futureProjection} fieldStyle={visualFieldStyle} guideTracking={isGuideTracking} guidePointer={guidePointer} onGuideTrackingChange={setIsGuideTracking} onGuidePointerChange={updateGuidePointer} selectedKnotIds={selectedKnotIds} gridTimeScale={gridTimeScale} shellScale={shellScale} intrusionRotation={intrusionRotation} patternOffset={patternOffset} onGesture={handleGesture} className="h-full min-h-[480px] w-full" height={560} maxTicks={MAX_TICKS} />
                    {!latestTick && <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/50">Awaiting live market data</div>}
                    <div className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">P<tspan className="normal-case">t</tspan> / live projection</div>
                    {(field?.kind === 'metal' || field?.kind === 'animal') && (
                  <label className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-300">
                    velocity {indicatorVelocity.indicator_velocity.toFixed(2)} → {indicatorVelocity.target_price_projection.toFixed(2)}
                    <input type="range" min={-1} max={1} step={0.05} value={indicatorInput} onChange={(event) => setIndicatorInput(Number(event.target.value))} aria-label="Indicator velocity input" />
                  </label>
                )}
                <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-600">T-2 history / T-1 echo / crossing margin ε</div>
                  </div>
                  <KnotGlyphPalette selectedIds={selectedKnotIds} onToggle={toggleKnot} onClear={() => setSelectedKnotIds([])} page={inventoryPage} onPageChange={(delta) => setInventoryPage((current) => (current + delta + 4) % 4)} locked={selectionLocked} />
                </div>
                <div className="mt-4">
                  <CandySpiralScene currentPrice={latestTick?.price ?? 65000} symbol={SYMBOL} height={560} fieldName={field?.kind} fieldStyle={visualFieldStyle} fieldDiagnostics={fieldStep?.diagnostics} />
                </div>
              </div>
            ) : viewMode === '3d' ? (
              <div className="space-y-4">
                <CandySpiralScene currentPrice={latestTick?.price ?? 65000} symbol={SYMBOL} height={620} fieldName={field?.kind} fieldStyle={visualFieldStyle} fieldDiagnostics={fieldStep?.diagnostics} />
              </div>
            ) : (
              <div className="grid flex-none gap-4 xl:grid-cols-[minmax(0,1fr)_184px]">
                <div className="relative h-[620px] min-h-[520px] overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#030a12]/90 shadow-[0_0_90px_rgba(34,211,238,0.09)]">
                <KnotChart tick={latestTick} timeline={timeline} history={history} gravityTensor={gravityTensor} futureProjection={futureProjection} fieldStyle={visualFieldStyle} guideTracking={isGuideTracking} guidePointer={guidePointer} onGuideTrackingChange={setIsGuideTracking} onGuidePointerChange={updateGuidePointer} selectedKnotIds={selectedKnotIds} gridTimeScale={gridTimeScale} shellScale={shellScale} intrusionRotation={intrusionRotation} patternOffset={patternOffset} onGesture={handleGesture} className="h-full min-h-[520px] w-full" height={620} maxTicks={MAX_TICKS} />
                {!latestTick && <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/50">Awaiting live market data</div>}
                <div className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">P<tspan className="normal-case">t</tspan> / live projection</div>
                <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-600">T-2 history / T-1 echo / crossing margin ε</div>
                </div>
                <KnotGlyphPalette selectedIds={selectedKnotIds} onToggle={toggleKnot} onClear={() => setSelectedKnotIds([])} page={inventoryPage} onPageChange={(delta) => setInventoryPage((current) => (current + delta + 4) % 4)} locked={selectionLocked} />
              </div>
            )}
            <section className="mt-4 border border-cyan-200/20 bg-[#020814]/85 p-3 backdrop-blur-sm" aria-label="Mouse guide controls">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><MousePointer2 className={`h-3.5 w-3.5 ${isGuideTracking ? 'text-cyan-200' : 'text-stone-600'}`} /><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-stone-300">Mouse guide / bottom control</span></div>
                <button type="button" onClick={() => setIsGuideTracking((current) => !current)} className={`border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] ${isGuideTracking ? 'border-cyan-200/50 bg-cyan-100/10 text-cyan-100' : 'border-white/15 text-stone-500 hover:border-cyan-200/35 hover:text-cyan-100'}`}>{isGuideTracking ? 'Tracking / on' : 'Tracking / off'}</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <GuideInput label="Cursor X" value={Math.round(guidePointer.x * 100)} min={0} max={100} step={1} suffix="%" onChange={(value) => updateGuideCoordinate('x', value)} />
                <GuideInput label="Cursor Y" value={Math.round(guidePointer.y * 100)} min={0} max={100} step={1} suffix="%" onChange={(value) => updateGuideCoordinate('y', value)} />
                <GuideInput label="Time density" value={Number(gridTimeScale.toFixed(2))} min={0.55} max={1.75} step={0.05} suffix="×" onChange={setGridTimeScale} />
                <GuideInput label="Shell scale" value={Number(shellScale.toFixed(2))} min={0.65} max={1.45} step={0.05} suffix="×" onChange={setShellScale} />
                <GuideInput label="Intrusion angle" value={Math.round(intrusionRotation * 180 / Math.PI)} min={-180} max={180} step={1} suffix="°" onChange={(value) => setIntrusionRotation(value * Math.PI / 180)} />
                <GuideInput label="Pattern" value={patternOffset + 1} min={1} max={4} step={1} suffix="/4" onChange={(value) => setPatternOffset(Math.round(value) - 1)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-stone-500">
                <span className="flex items-center gap-1"><ScanLine className="h-3 w-3 text-violet-300" /> L∞ square projection / 4 chromatic bands</span>
                <span>Center / {Math.round(guidePointer.x * 100)}%, {Math.round(guidePointer.y * 100)}% / {selectionLocked ? 'Selection locked' : 'Selection fluid'}</span>
              </div>
              <p className="mt-2 font-mono text-[8px] leading-4 text-stone-600">X/Y updates immediately position the guide cursor and enable tracking. Double-click the projection to toggle pointer tracking. Touch gestures remain available for density, intrusion, shell, pattern, and inventory control.</p>
            </section>
          </section>

          <aside className="border-l border-cyan-100/10 bg-[#050b13]/90 p-4 sm:p-6">
            <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4"><Gauge className="h-4 w-4 text-amber-200" /><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-stone-300">Control memory</p></div>
            <div className="space-y-2">
              <button type="button" onClick={() => setIsRunning((current) => !current)} className="flex w-full items-center justify-between border border-cyan-200/25 bg-cyan-100/[0.05] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-50 hover:bg-cyan-100/10">{isRunning ? 'Pause stream' : 'Resume stream'}{isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
              <div className="flex w-full items-center justify-between border border-rose-200/25 bg-rose-100/[0.04] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-100">Live burst events<Zap className="h-4 w-4" /></div>
              <button type="button" onClick={resetChart} className="flex w-full items-center justify-between border border-white/10 px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 hover:border-white/30 hover:text-white">Reset projection<RotateCcw className="h-4 w-4" /></button>
            </div>

            <div className="mt-8 border-t border-white/10 pt-5"><p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-stone-500">Timeline layers</p><div className="space-y-2">{timelineLayers.map((layer) => <button key={layer.key} type="button" onClick={() => setVisible((current) => ({ ...current, [layer.key]: !current[layer.key] }))} className="flex w-full items-center gap-3 border border-white/5 bg-black/10 px-3 py-2 text-left hover:border-white/20"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color, opacity: visible[layer.key] ? 1 : 0.28 }} /><span className={`font-mono text-[10px] ${visible[layer.key] ? 'text-stone-200' : 'text-stone-600'}`}><span className="block">{layer.label}</span><span className="text-[8px] text-stone-600">{layer.description}</span></span></button>)}</div></div>

            <div className="mt-8 border-t border-white/10 pt-5"><div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500"><span><Archive className="mr-1 inline h-3 w-3" /> Ring buffer</span><span>{history.length}/{MAX_TICKS}</span></div><div className="h-1.5 bg-white/10"><div className="h-full bg-cyan-300 transition-[width] duration-500" style={{ width: `${bufferPercent}%` }} /></div><p className="mt-2 font-mono text-[9px] leading-5 text-stone-600">Fixed Float arrays / approx. {(memoryBytes / 1024).toFixed(1)} KB reserved / GC resistant path.</p></div>

            <div className="mt-8 border-t border-white/10 pt-5"><p className="font-mono text-[9px] uppercase tracking-[0.24em] text-stone-500">Geometry legend</p><div className="mt-3 space-y-2 font-mono text-[9px] text-stone-500"><p><span className="mr-2 text-emerald-200">□</span>T-1 / energy echo</p><p><span className="mr-2 text-slate-300">⬡</span>T-2+ / rigid gravity node</p><p><span className="mr-2 text-rose-300">┄</span>jump / communication gap</p><p><span className="mr-2 text-amber-200">◌</span>P<tspan className="normal-case">t</tspan> / current price</p></div></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
