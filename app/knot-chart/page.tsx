'use client';

import { Activity, Archive, Gauge, MousePointer2, Pause, Play, RotateCcw, ScanLine, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import KnotChart, { type GuidePointer, type KnotTick, type KnotTimelineLayer, type ProjectionGesture } from '@/components/2d/KnotChart';
import KnotGlyphPalette from '@/components/KnotGlyphPalette';
import type { TrueGravityTensor } from '@/components/2d/GravityHoneycomb';
import { useMarketStream } from '@/hooks/useMarketStream';

const MAX_TICKS = 256;
const SYMBOL = 'BTCUSD';

const timelineLayers: Array<{ key: keyof KnotTimelineLayerState; label: string; color: string; description: string }> = [
  { key: 't40m', label: 'T-40m', color: '#38bdf8', description: 'noise / momentum' },
  { key: 't4h', label: 'T-4h', color: '#f8d66d', description: 'meso trend' },
  { key: 'target', label: 'T-target', color: '#fb7185', description: 'baseline' },
  { key: 'best', label: 'T-best', color: '#a78bfa', description: 'ideal fractal' },
];

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

export default function KnotChartPage() {
  const router = useRouter();
  const { marketDataMap, isConnected: isBackendConnected, burstEvent } = useMarketStream(
    process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/signals',
    SYMBOL,
  );
  const { ticker, isConnected: isExchangeConnected } = useBtcUsdTicker();
  const liveData = marketDataMap[SYMBOL];
  const [history, setHistory] = useState<KnotTick[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [visible, setVisible] = useState<KnotTimelineLayerState>({ t40m: true, t4h: true, target: true, best: true });
  const [burstCount, setBurstCount] = useState(0);
  const [isGuideTracking, setIsGuideTracking] = useState(false);
  const [guidePointer, setGuidePointer] = useState<GuidePointer>({ x: 0.72, y: 0.22 });
  const [selectedKnotIds, setSelectedKnotIds] = useState<number[]>([]);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [gridTimeScale, setGridTimeScale] = useState(1);
  const [shellScale, setShellScale] = useState(1);
  const [intrusionRotation, setIntrusionRotation] = useState(0);
  const [patternOffset, setPatternOffset] = useState(0);
  const lastTickTimestamp = useRef<number | undefined>(undefined);

  useEffect(() => {
    const backendTick = liveData ? liveTick(liveData) : undefined;
    const previous = history.at(-1);
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
    const next = backendTick ?? exchangeTick;
    if (!next || !isRunning || next.timestamp === lastTickTimestamp.current) return;
    lastTickTimestamp.current = next.timestamp;
    setHistory((current) => [...current.slice(-(MAX_TICKS - 1)), next]);
  }, [history, isRunning, liveData, ticker]);

  useEffect(() => {
    if (burstEvent) setBurstCount((current) => current + 1);
  }, [burstEvent]);

  const latestTick = history.at(-1);
  const timeline = useMemo(() => latestTick ? createTimeline(latestTick, visible) : undefined, [latestTick, visible]);
  const gravityTensor: TrueGravityTensor | undefined = liveData?.true_gravity_tensor;
  const isConnected = isBackendConnected || isExchangeConnected;
  const memoryBytes = MAX_TICKS * (8 * 3 + 4 * 4 + 1);
  const bufferPercent = Math.round((history.length / MAX_TICKS) * 100);

  function resetChart() {
    lastTickTimestamp.current = undefined;
    setHistory([]);
  }

  function updateGuidePointer(pointer: GuidePointer) {
    setGuidePointer((current) => Math.abs(current.x - pointer.x) > 0.005 || Math.abs(current.y - pointer.y) > 0.005 ? pointer : current);
  }

  function updateGuideCoordinate(axis: keyof GuidePointer, percent: number) {
    setGuidePointer((current) => ({ ...current, [axis]: Math.max(0, Math.min(1, percent / 100)) }));
    setIsGuideTracking(true);
  }

  function toggleKnot(id: number) {
    if (!selectionLocked) setSelectedKnotIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
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
            <div><p className="font-mono text-[9px] uppercase tracking-[0.38em] text-cyan-200/60">Native projection workspace</p><h1 className="mt-1 text-xl tracking-[0.14em] text-cyan-50 sm:text-2xl">BTCUSD / KNOT PROJECTION</h1></div>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500"><Link href="/tickets" className="border border-white/10 px-2 py-1 text-stone-400 hover:border-cyan-200/45 hover:text-cyan-100">Ticket ledger</Link><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isConnected && isRunning ? 'bg-emerald-300 shadow-[0_0_12px_#6ee7b7]' : 'bg-stone-600'}`} /> {isRunning ? isConnected ? `live / ${liveData ? 'BTCUSD API' : 'BTC-USD exchange'}` : 'awaiting BTCUSD feed' : 'paused'}</span><span className="hidden text-stone-700 sm:inline">canvas / requestAnimationFrame</span></div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex min-h-[calc(100vh-75px)] flex-col p-4 sm:p-6 lg:p-8">
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['price', latestTick?.price.toFixed(2) ?? '--'],
                ['volatility', latestTick ? `${Math.round(latestTick.volatility * 100)}%` : '--'],
                ['tension', latestTick ? `${Math.round(latestTick.tension * 100)}%` : '--'],
                ['burst events', String(burstCount)],
              ].map(([label, value]) => <div key={label} className="border border-white/10 bg-white/[0.025] px-3 py-2"><p className="font-mono text-[8px] uppercase tracking-[0.22em] text-stone-600">{label}</p><p className="mt-1 font-mono text-sm text-cyan-100">{value}</p></div>)}
            </div>
            <div className="grid flex-none gap-4 xl:grid-cols-[minmax(0,1fr)_184px]">
              <div className="relative h-[620px] min-h-[520px] overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#030a12]/90 shadow-[0_0_90px_rgba(34,211,238,0.09)]">
              <KnotChart tick={latestTick} timeline={timeline} history={history} gravityTensor={gravityTensor} futureProjection={liveData?.spiral_cube} guideTracking={isGuideTracking} guidePointer={guidePointer} onGuideTrackingChange={setIsGuideTracking} onGuidePointerChange={updateGuidePointer} selectedKnotIds={selectedKnotIds} gridTimeScale={gridTimeScale} shellScale={shellScale} intrusionRotation={intrusionRotation} patternOffset={patternOffset} onGesture={handleGesture} className="h-full min-h-[520px] w-full" height={620} maxTicks={MAX_TICKS} />
              {!latestTick && <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/50">Awaiting live BTCUSD market data</div>}
              <div className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">P<tspan className="normal-case">t</tspan> / live projection</div>
              <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-600">T-2 history / T-1 echo / crossing margin ε</div>
              </div>
              <KnotGlyphPalette selectedIds={selectedKnotIds} onToggle={toggleKnot} onClear={() => setSelectedKnotIds([])} page={inventoryPage} onPageChange={(delta) => setInventoryPage((current) => (current + delta + 4) % 4)} locked={selectionLocked} />
            </div>
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
