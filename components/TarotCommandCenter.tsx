"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Crown, Radio, ShieldAlert, Sparkles, Wifi, WifiOff } from "lucide-react";
import { CandlestickSeries, ColorType, createChart, LineSeries, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortfolioMock } from "@/hooks/useMarketStream";
import SingularityOverload from "@/components/SingularityOverload";

type Phase = "WATER" | "WOOD" | "FIRE" | "EARTH" | "METAL";
type Status = { macro: string; meso: string; micro: string };
type ChartData = { time: number; open: number; high: number; low: number; close: number; sma20: number };
type Signal = { symbol: string; wuxing_phase: Phase; status: Status; minor_arcana?: string; chart_data?: ChartData };

type Archetype = "FOOL" | "TOWER" | "EMPEROR";

const phaseStyle: Record<Phase, { panel: string; border: string; accent: string; label: string }> = {
  WATER: { panel: "from-cyan-950/85 via-slate-950 to-slate-950", border: "border-cyan-400/70", accent: "text-cyan-300", label: "WATER / 水" },
  WOOD: { panel: "from-emerald-950/85 via-slate-950 to-slate-950", border: "border-emerald-400/70", accent: "text-emerald-300", label: "WOOD / 木" },
  FIRE: { panel: "from-red-950/85 via-slate-950 to-slate-950", border: "border-red-400/70", accent: "text-red-300", label: "FIRE / 火" },
  EARTH: { panel: "from-yellow-950/85 via-slate-950 to-slate-950", border: "border-yellow-400/70", accent: "text-yellow-300", label: "EARTH / 土" },
  METAL: { panel: "from-zinc-700/85 via-slate-950 to-slate-950", border: "border-zinc-300/70", accent: "text-zinc-200", label: "METAL / 金" },
};

const demoChart: ChartData = { time: 1724017200, open: 64000, high: 64100, low: 63950, close: 64050, sma20: 63980.5 };
const demoSignal: Signal = {
  symbol: "BTCUSD",
  wuxing_phase: "FIRE",
  status: { macro: "DOWN", meso: "KNOT", micro: "FILLING" },
  chart_data: demoChart,
};

const slotPositions = [
  "left-1/2 top-0 -translate-x-1/2",
  "left-[14%] top-[16%]",
  "right-[14%] top-[16%]",
  "left-[14%] bottom-[16%]",
  "right-[14%] bottom-[16%]",
  "left-1/2 bottom-0 -translate-x-1/2",
  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  "right-[-2%] top-1/2 -translate-y-1/2",
];

const particleSeeds = Array.from({ length: 22 }, (_, index) => ({
  angle: (index / 22) * Math.PI * 2,
  distance: 32 + (index % 5) * 12,
  delay: (index % 7) * 0.045,
}));

function archetypeFor(status: Status): Archetype {
  if (status.meso === "BREAKOUT" || status.micro === "BREAKOUT") return "TOWER";
  if (status.macro === "DOWN" && status.meso === "KNOT" && status.micro === "FILLING") return "EMPEROR";
  return "FOOL";
}

function normalizeSignal(payload: Record<string, unknown>, preferredSymbol?: string): Signal | null {
  const nested = (payload.data ?? payload) as Record<string, unknown>;
  const symbols = nested.symbols as Record<string, Record<string, unknown>> | undefined;
  const source = symbols?.[preferredSymbol ?? ""] ?? symbols?.BTCUSD ?? (symbols ? Object.values(symbols)[0] : undefined) ?? nested;
  const status = (source.status ?? source.tri_layer ?? nested.status ?? nested.tri_layer ?? { macro: "UNKNOWN", meso: "UNKNOWN", micro: "NOISE" }) as Partial<Status>;
  const phase = String(source.wuxing_phase ?? nested.wuxing_phase ?? "WATER").toUpperCase() as Phase;
  if (!(phase in phaseStyle)) return null;
  return {
    symbol: String(source.symbol ?? nested.symbol ?? "BTCUSD"),
    wuxing_phase: phase,
    minor_arcana: String(source.minor_arcana ?? nested.minor_arcana ?? ""),
    status: { macro: String(status.macro ?? "UNKNOWN"), meso: String(status.meso ?? "UNKNOWN"), micro: String(status.micro ?? "NOISE") },
    chart_data: (source.chart_data ?? nested.chart_data) as ChartData | undefined,
  };
}

function mockSignal(symbol: string): Signal {
  return {
    symbol,
    wuxing_phase: "WATER",
    status: { macro: "UP", meso: "KNOT", micro: "FILLING" },
    minor_arcana: "1S / KNOT BIRTH",
    chart_data: { ...demoChart, close: demoChart.close + 240, high: demoChart.high + 260, sma20: demoChart.sma20 + 120 },
  };
}

function KnotBirth({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden="true">
      <motion.div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_24px_8px_rgba(255,255,255,.9)]" initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.8, 0.5], opacity: [1, 0.95, 0] }} transition={{ duration: 0.85, ease: "easeOut" }} />
      {particleSeeds.map((particle, index) => (
        <motion.i key={index} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} initial={{ x: 0, y: 0, scale: 0, opacity: 0 }} animate={{ x: Math.cos(particle.angle) * particle.distance, y: Math.sin(particle.angle) * particle.distance, scale: [0, 1.4, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: particle.delay, ease: "easeOut" }} />
      ))}
      <motion.div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut" }} />
    </div>
  );
}

type PositionSnapshot = { symbol: string; phase: Phase; delta: number; state: string };

function PositionField({ positions }: { positions: PositionSnapshot[] }) {
  const isTensionField = positions.length <= 3;
  const radius = positions.length <= 1 ? 0 : 31;
  const points = positions.map((_, index) => {
    if (positions.length === 1) return { x: 50, y: 50 };
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / positions.length;
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
  });
  const links = isTensionField
    ? positions.flatMap((_, source) => positions.slice(source + 1).map((__, offset) => [source, source + offset + 1] as const))
    : positions.length >= 4 && positions.length <= 7
      ? Array.from({ length: positions.length }, (_, index) => [index, (index + 2) % positions.length] as const)
      : [];

  return (
    <div className="relative mx-auto h-[330px] max-w-[620px] perspective-[900px] sm:h-[390px]">
      <div className="absolute inset-[15%] rounded-full border border-cyan-200/10 bg-black/20 shadow-[inset_0_0_80px_rgba(34,211,238,.08)] [transform:rotateX(58deg)]" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        {links.map(([source, target]) => <motion.line key={`${source}-${target}`} x1={points[source].x} y1={points[source].y} x2={points[target].x} y2={points[target].y} stroke={isTensionField ? '#f6d365' : '#67e8f9'} strokeWidth={isTensionField ? 1.2 : 0.65} strokeDasharray={isTensionField ? '2 1' : '1 2'} initial={{ pathLength: 0 }} animate={{ pathLength: 1, opacity: isTensionField ? [0.35, 1, 0.35] : [0.35, 0.7, 0.35] }} transition={{ duration: isTensionField ? 1.1 : 2.4, repeat: Infinity }} />)}
      </svg>
      {positions.map((position, index) => {
        const point = points[index];
        const positive = position.delta >= 0;
        return <motion.div
          key={position.symbol}
          className={`absolute z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none flex-col items-center justify-center border bg-black/75 text-center shadow-[0_0_32px_rgba(34,211,238,.2)] active:cursor-grabbing ${positive ? 'border-teal-200/65' : 'border-rose-300/75'}`}
          style={{ left: `${point.x}%`, top: `${point.y}%`, perspective: 600 }}
          drag
          dragConstraints={{ left: -120, right: 120, top: -100, bottom: 100 }}
          dragElastic={0.22}
          whileHover={{ scale: 1.12, rotateX: -12, boxShadow: positive ? '0 0 42px rgba(45,212,191,.55)' : '0 0 42px rgba(251,113,133,.55)' }}
          animate={{ y: positive ? [0, -3, 0] : [0, 3, -2, 0], rotateZ: positive ? 0 : [0, -2, 2, 0] }}
          transition={{ duration: positive ? 2.4 : 0.55, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className={`font-mono text-[10px] font-bold tracking-[0.12em] ${phaseStyle[position.phase].accent}`}>{position.symbol.replace('USD', '')}</span>
          <span className={`mt-1 font-mono text-[10px] ${positive ? 'text-teal-200' : 'text-rose-200'}`}>{positive ? '+' : ''}{position.delta.toFixed(1)}</span>
          <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-stone-500">{position.state}</span>
        </motion.div>;
      })}
      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.24em] text-stone-500">{isTensionField ? 'direct knot manipulation / drag nodes' : 'hexagram geometry / balance field'}</p>
    </div>
  );
}

function PortfolioHex({ portfolio, pendingSymbol, birthSymbol, onAdd }: { portfolio: ReturnType<typeof usePortfolioMock>["portfolio"]; pendingSymbol: string | null; birthSymbol: string | null; onAdd: () => void }) {
  const slots = pendingSymbol && portfolio.length < 8 ? [...portfolio, { symbol: pendingSymbol, phase: "WATER", state: "pending" as const }] : portfolio;
  const canAdd = portfolio.length < 8 && !pendingSymbol;

  return (
    <section className="relative border-t border-white/10 px-5 py-6 sm:px-8" aria-label="Portfolio hexagram">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone-500">Portfolio / hexagram field</p><h2 className="mt-1 text-xl font-medium text-stone-100">{portfolio.length} active nodes <span className="font-mono text-xs text-stone-500">/ {pendingSymbol ? "new branch forming" : "authenticated mock"}</span></h2></div>
        <button type="button" onClick={onAdd} disabled={!canAdd} className="inline-flex items-center gap-2 border border-amber-200/70 bg-amber-100 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-stone-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">+ 新規銘柄追加</button>
      </div>
      <div className="relative mx-auto h-[330px] max-w-[620px] sm:h-[390px]">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <motion.path d="M50 50 C35 35 25 27 17 22 M50 50 C65 35 75 27 83 22 M50 50 C36 65 26 73 17 78 M50 50 C64 65 74 73 83 78 M50 50 C50 32 50 19 50 8 M50 50 C50 68 50 81 50 92" fill="none" stroke="#f6d365" strokeWidth="0.45" strokeDasharray="2 2" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: pendingSymbol ? 1 : 0.55, opacity: pendingSymbol ? 0.95 : 0.28 }} transition={{ duration: pendingSymbol ? 1.15 : 0.8 }} />
          <AnimatePresence>{pendingSymbol && <motion.path d="M50 50 C64 47 78 48 96 50" fill="none" stroke="#fff8cf" strokeWidth="0.7" strokeDasharray="1.5 1.5" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 0.8] }} exit={{ opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} />}</AnimatePresence>
        </svg>
        {slots.map((slot, index) => {
          const isPending = slot.state === "pending";
          const isBorn = birthSymbol === slot.symbol;
          const phase = phaseStyle[slot.phase as Phase] ?? phaseStyle.WATER;
          return (
            <motion.div key={slot.symbol} className={`absolute ${slotPositions[index]} z-10 flex h-16 w-16 flex-col items-center justify-center border ${isPending ? "border-dashed border-amber-200/80 bg-amber-100/10" : `${phase.border} bg-black/60`} shadow-[0_0_22px_rgba(255,255,255,.07)] sm:h-20 sm:w-20`} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: isPending ? [1, 1.08, 1] : 1 }} transition={{ duration: 0.55, delay: index * 0.04, repeat: isPending ? Infinity : 0 }}>
              {isBorn && <KnotBirth color={phase.accent.includes("cyan") ? "#67e8f9" : "#f6d365"} />}
              <span className={`relative z-10 font-mono text-[9px] tracking-wider ${isPending ? "text-amber-100" : phase.accent}`}>{isPending ? "WAIT" : slot.symbol.replace("USD", "")}</span>
              <span className="relative z-10 mt-1 text-[8px] uppercase tracking-[0.18em] text-stone-600">{isPending ? "1s feed" : "online"}</span>
            </motion.div>
          );
        })}
        <AnimatePresence>{pendingSymbol && <motion.div className="absolute right-[-2%] top-1/2 z-10 flex h-16 w-16 -translate-y-1/2 items-center justify-center border border-dashed border-amber-100/40 text-center font-mono text-[8px] uppercase tracking-widest text-amber-100/70 sm:h-20 sm:w-20" initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.2 }} transition={{ duration: 0.6 }}>listening</motion.div>}</AnimatePresence>
      </div>
      {pendingSymbol && <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.25em] text-amber-100/70">Rhizome route established / awaiting {pendingSymbol} one-second packet</p>}
      {birthSymbol && <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-200">1s knot born / {birthSymbol} joined the field</p>}
    </section>
  );
}

function MarketChart({ chartData }: { chartData?: ChartData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 330,
      layout: { background: { type: ColorType.Solid, color: "#0b1018" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#17202c" }, horzLines: { color: "#17202c" } },
      rightPriceScale: { borderColor: "#334155" }, timeScale: { borderColor: "#334155", timeVisible: true },
    });
    const candles = chart.addSeries(CandlestickSeries, { upColor: "#d8b56b", downColor: "#e56b6f", borderVisible: false, wickUpColor: "#d8b56b", wickDownColor: "#e56b6f" });
    const sma = chart.addSeries(LineSeries, { color: "#f4d06f", lineWidth: 2, priceLineVisible: false });
    chartRef.current = chart;
    candleRef.current = candles;
    lineRef.current = sma;
    const resize = () => chart.applyOptions({ width: containerRef.current?.clientWidth ?? 600 });
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.remove(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    if (!chartData || !candleRef.current || !lineRef.current) return;
    candleRef.current.update({ time: chartData.time as Time, open: chartData.open, high: chartData.high, low: chartData.low, close: chartData.close });
    lineRef.current.update({ time: chartData.time as Time, value: chartData.sma20 });
    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  return <div ref={containerRef} className="h-[330px] w-full" />;
}

export default function TarotCommandCenter() {
  const [signal, setSignal] = useState<Signal>(demoSignal);
  const [connected, setConnected] = useState(false);
  const [firedAt, setFiredAt] = useState(0);
  const [birthSymbol, setBirthSymbol] = useState<string | null>(null);
  const { portfolio, pendingSymbol, beginAdd, resolveAdd } = usePortfolioMock();
  const [overdrive, setOverdrive] = useState(false);
  const pendingSymbolRef = useRef<string | null>(null);
  const arrivalTimerRef = useRef<number | null>(null);
  const style = phaseStyle[signal.wuxing_phase];
  const archetype = archetypeFor(signal.status);
  const isEmperor = archetype === "EMPEROR";
  const activePositions = useMemo<PositionSnapshot[]>(() => portfolio.map((slot, index) => ({
    symbol: slot.symbol,
    phase: (slot.phase in phaseStyle ? slot.phase : "WATER") as Phase,
    delta: slot.symbol === signal.symbol ? signal.chart_data ? signal.chart_data.close - signal.chart_data.open : 4.2 : (index % 3 === 0 ? 6.4 : index % 3 === 1 ? -3.1 : 2.2),
    state: slot.state === "pending" ? "forming" : slot.symbol === signal.symbol ? signal.status.micro : "ready",
  })), [portfolio, signal]);

  useEffect(() => {
    setOverdrive(portfolio.length >= 11);
  }, [portfolio.length]);

  useEffect(() => {
    pendingSymbolRef.current = pendingSymbol;
  }, [pendingSymbol]);

  const handleAdd = () => {
    const nextSymbol = beginAdd();
    if (!nextSymbol) return;
    if (arrivalTimerRef.current) window.clearTimeout(arrivalTimerRef.current);
    arrivalTimerRef.current = window.setTimeout(() => {
      if (pendingSymbolRef.current !== nextSymbol) return;
      resolveAdd(nextSymbol);
      setSignal(mockSignal(nextSymbol));
      setBirthSymbol(nextSymbol);
      setFiredAt(Date.now());
      window.setTimeout(() => setBirthSymbol(null), 1300);
    }, 1500);
  };

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/signals";
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let stopped = false;
    const connect = () => {
      socket = new WebSocket(url);
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        try {
          const next = normalizeSignal(JSON.parse(event.data) as Record<string, unknown>, pendingSymbolRef.current ?? undefined);
          if (!next) return;
          setSignal(next);
          setFiredAt(Date.now());
          if (pendingSymbolRef.current === next.symbol) {
            resolveAdd(next.symbol);
            setBirthSymbol(next.symbol);
            window.setTimeout(() => setBirthSymbol(null), 1300);
          }
        } catch { /* ignore malformed packets */ }
      };
      socket.onclose = () => { setConnected(false); if (!stopped) retry = window.setTimeout(connect, 3000); };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { stopped = true; if (retry) window.clearTimeout(retry); if (arrivalTimerRef.current) window.clearTimeout(arrivalTimerRef.current); socket?.close(); };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090b0f] px-4 py-6 font-display text-stone-100 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:48px_48px]" />
      {archetype === "TOWER" && <motion.div className="pointer-events-none fixed inset-0 z-20 border-[14px] border-red-500/80" animate={{ opacity: [0.15, 0.9, 0.15] }} transition={{ duration: 0.65, repeat: Infinity }} />}
      {archetype === "FOOL" && <motion.div className="pointer-events-none fixed inset-0 z-20 opacity-20 mix-blend-screen [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,#f8fafc_4px)]" animate={{ opacity: [0.03, 0.25, 0.08, 0.18] }} transition={{ duration: 0.45, repeat: Infinity }} />}

      <section className={`relative mx-auto max-w-7xl overflow-hidden rounded-sm border bg-gradient-to-br ${style.panel} ${style.border} shadow-2xl transition-colors duration-1000 ${isEmperor ? "shadow-[0_0_80px_rgba(222,174,74,0.42)]" : ""}`}>
        <motion.div className="absolute inset-0 pointer-events-none" animate={isEmperor ? { opacity: [0.2, 0.7, 0.25], boxShadow: ["inset 0 0 30px rgba(234,179,8,.15)", "inset 0 0 100px rgba(234,179,8,.4)", "inset 0 0 30px rgba(234,179,8,.15)"] } : { opacity: 0.15 }} transition={{ duration: 2.8, repeat: Infinity }} />
        <header className="relative flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-8">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.4em] text-stone-500">Signal doctrine / 07</p><h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">CHARTUI COMMAND CENTER</h1></div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-stone-400">{connected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-stone-600" />} {connected ? "Live feed" : "Demo relay"}</div>
        </header>

        <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[0.85fr_1.6fr]">
          <aside className="flex min-h-[330px] flex-col justify-between border-l border-white/10 pl-5 sm:pl-7">
            <div><div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-stone-500"><Activity className="h-4 w-4" /> {signal.symbol}</div><p className={`mt-8 text-5xl font-medium tracking-tight ${style.accent}`}>{style.label}</p><p className="mt-3 max-w-xs font-mono text-xs leading-6 text-stone-400">The live field is reading the current pressure architecture across macro, meso, and micro layers.</p></div>
            <div className="space-y-3 font-mono text-xs uppercase tracking-widest text-stone-400">{Object.entries(signal.status).map(([key, value]) => <div className="flex justify-between border-b border-white/10 pb-2" key={key}><span>{key}</span><span className={value === "DOWN" || value === "FILLING" ? "text-amber-200" : "text-stone-200"}>{value}</span></div>)}</div>
          </aside>

          <div className="min-w-0"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-stone-500"><Radio className="h-3 w-3" /> M7 / realtime</div><span className={`font-mono text-[10px] uppercase tracking-widest ${style.accent}`}>{archetype === "EMPEROR" ? "synchronised" : archetype.toLowerCase()}</span></div><div className={`overflow-hidden border bg-black/20 transition-colors duration-1000 ${style.border}`}><MarketChart chartData={signal.chart_data} /></div></div>
        </div>

        <AnimatePresence mode="wait"><motion.div key={archetype} className="relative border-t border-white/10 px-5 py-5 sm:px-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
          <div className="flex items-center justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone-500">Active archetype</p><h2 className={`mt-1 text-2xl font-medium ${archetype === "TOWER" ? "text-red-300" : isEmperor ? "text-amber-200" : "text-stone-100"}`}>{archetype === "FOOL" ? "THE FOOL" : archetype === "TOWER" ? "THE TOWER" : "THE EMPEROR"}</h2></div>{archetype === "TOWER" ? <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-red-300"><ShieldAlert className="h-4 w-4" /> Warning: knot destroyed</div> : archetype === "FOOL" ? <Sparkles className="h-5 w-5 text-fuchsia-300" /> : <Crown className="h-6 w-6 text-amber-300" />}</div>
          {isEmperor && <motion.button className="absolute bottom-5 right-5 border border-amber-200/70 bg-amber-100 px-5 py-3 font-mono text-xs font-bold tracking-[0.25em] text-stone-950 shadow-[0_0_32px_rgba(250,204,21,0.5)]" animate={{ y: [0, -4, 0], boxShadow: ["0 0 20px rgba(250,204,21,.35)", "0 0 45px rgba(250,204,21,.75)", "0 0 20px rgba(250,204,21,.35)"] }} transition={{ duration: 2.2, repeat: Infinity }}>EXECUTE</motion.button>}
          {archetype === "TOWER" && <motion.p className="mt-2 font-mono text-xs text-red-200/70" animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 0.8, repeat: Infinity }}>BREAKOUT EVENT / RECALIBRATE VECTOR</motion.p>}
        </motion.div></AnimatePresence>
          <PortfolioHex portfolio={portfolio} pendingSymbol={pendingSymbol} birthSymbol={birthSymbol} onAdd={handleAdd} />
          <section className="border-t border-white/10 px-5 py-6 sm:px-8" aria-label="Active position physics field">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/55">Position physics / {activePositions.length} knots</p><h2 className="mt-1 text-xl text-stone-100">{activePositions.length <= 3 ? "KNOT SELECTION" : activePositions.length <= 7 ? "ARCANA FORMATION" : "FIELD SATURATION"}</h2></div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-500">hover / drag / observe tension</p>
            </div>
            <PositionField positions={activePositions} />
          </section>
      </section>
      <p className="relative mx-auto mt-4 max-w-7xl text-right font-mono text-[10px] uppercase tracking-[0.25em] text-stone-700">packet {firedAt ? new Date(firedAt).toISOString() : "awaiting transmission"}</p>
      <AnimatePresence>{overdrive && <SingularityOverload positionCount={activePositions.length} onDismiss={() => setOverdrive(false)} />}</AnimatePresence>
    </main>
  );
}
