'use client';

import { Activity, Archive, Gauge, Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import KnotChart, { type KnotTick, type KnotTimelineLayer } from '@/components/2d/KnotChart';

const MAX_TICKS = 256;
const START_PRICE = 67_420;

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

function makeTick(index: number, previousPrice: number, burst = false): KnotTick {
  const wave = Math.sin(index * 0.31) * 0.45 + Math.sin(index * 0.071) * 0.7;
  const jump = burst ? (index % 2 === 0 ? 1 : -1) * 28 : wave;
  const price = previousPrice + jump;
  const volatility = Math.min(1, 0.18 + Math.abs(wave) * 0.22 + (burst ? 0.52 : 0));
  return {
    timestamp: (Date.now() - (120 - index) * 1000),
    price,
    volatility,
    angle: Math.sin(index * 0.19) * 1.8,
    magicLength: 0.35 + volatility * 1.8,
    tension: Math.min(1, volatility * 0.7 + Math.abs(wave) * 0.12 + (burst ? 0.25 : 0)),
    jump: burst || Math.abs(jump) > 18,
  };
}

function createHistory(): KnotTick[] {
  const result: KnotTick[] = [];
  let price = START_PRICE;
  for (let index = 0; index < 120; index += 1) {
    const tick = makeTick(index, price);
    result.push(tick);
    price = tick.price;
  }
  return result;
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

export default function KnotChartPage() {
  const [history, setHistory] = useState<KnotTick[]>(() => createHistory());
  const [isRunning, setIsRunning] = useState(true);
  const [visible, setVisible] = useState<KnotTimelineLayerState>({ t40m: true, t4h: true, target: true, best: true });
  const [burstCount, setBurstCount] = useState(0);
  const priceRef = useRef(history.at(-1)?.price ?? START_PRICE);
  const burstRef = useRef(false);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => {
      const next = makeTick(Date.now(), priceRef.current, burstRef.current);
      burstRef.current = false;
      priceRef.current = next.price;
      setHistory((current) => [...current.slice(-(MAX_TICKS - 1)), next]);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const latestTick = history.at(-1) ?? makeTick(0, START_PRICE);
  const timeline = useMemo(() => createTimeline(latestTick, visible), [latestTick, visible]);
  const memoryBytes = MAX_TICKS * (8 * 3 + 4 * 4 + 1);
  const bufferPercent = Math.round((history.length / MAX_TICKS) * 100);

  function resetChart() {
    const nextHistory = createHistory();
    setHistory(nextHistory);
    priceRef.current = nextHistory.at(-1)?.price ?? START_PRICE;
    burstRef.current = false;
  }

  function triggerBurst() {
    burstRef.current = true;
    setBurstCount((current) => current + 1);
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
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-300 shadow-[0_0_12px_#6ee7b7]' : 'bg-stone-600'}`} /> {isRunning ? 'streaming / 1s' : 'paused'}</span><span className="hidden text-stone-700 sm:inline">canvas / requestAnimationFrame</span></div>
        </header>

        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex min-h-[calc(100vh-75px)] flex-col p-4 sm:p-6 lg:p-8">
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['price', latestTick.price.toFixed(2)],
                ['volatility', `${Math.round(latestTick.volatility * 100)}%`],
                ['tension', `${Math.round(latestTick.tension * 100)}%`],
                ['burst events', String(burstCount)],
              ].map(([label, value]) => <div key={label} className="border border-white/10 bg-white/[0.025] px-3 py-2"><p className="font-mono text-[8px] uppercase tracking-[0.22em] text-stone-600">{label}</p><p className="mt-1 font-mono text-sm text-cyan-100">{value}</p></div>)}
            </div>
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#030a12]/90 shadow-[0_0_90px_rgba(34,211,238,0.09)]">
              <KnotChart tick={latestTick} timeline={timeline} history={history} className="h-full min-h-[520px] w-full" height={620} maxTicks={MAX_TICKS} />
              <div className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">P<tspan className="normal-case">t</tspan> / live projection</div>
              <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-600">T-2 history / T-1 echo / crossing margin ε</div>
            </div>
          </section>

          <aside className="border-l border-cyan-100/10 bg-[#050b13]/90 p-4 sm:p-6">
            <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4"><Gauge className="h-4 w-4 text-amber-200" /><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-stone-300">Control memory</p></div>
            <div className="space-y-2">
              <button type="button" onClick={() => setIsRunning((current) => !current)} className="flex w-full items-center justify-between border border-cyan-200/25 bg-cyan-100/[0.05] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-50 hover:bg-cyan-100/10">{isRunning ? 'Pause stream' : 'Resume stream'}{isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
              <button type="button" onClick={triggerBurst} className="flex w-full items-center justify-between border border-rose-200/25 bg-rose-100/[0.04] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-100 hover:bg-rose-100/10">Inject knot burst<Zap className="h-4 w-4" /></button>
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
