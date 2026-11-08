'use client';

import { Pause, Play, RotateCcw, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Candy = {
  index: number;
  cell: number;
  waveform: string;
  polarity: 'UP' | 'DOWN';
  direction: 'LONG' | 'SHORT';
  risk_reward_ratio: number;
  time_to_target_hrs: number;
  gravity: { nearest_market: string };
};

type MarketFilter = 'ALL' | 'METAL' | 'ANIMAL' | 'CRYPTO' | 'META';
type Playback = 'IDLE' | 'ARMED' | 'PLAYING' | 'PAUSED';

const MARKETS: MarketFilter[] = ['ALL', 'METAL', 'ANIMAL', 'CRYPTO', 'META'];
const MARKET_COLORS: Record<string, string> = {
  METAL: '#fbbf24',
  ANIMAL: '#4ade80',
  CRYPTO: '#38bdf8',
  META: '#c084fc',
};
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

type Props = { candies: Candy[]; apiConnected: boolean };

function formatTime(hours: number): string {
  return hours < 1 ? `${Math.round(hours * 60)}m` : hours < 48 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`;
}

/** Educational visualization of model cells. This component does not submit or execute orders. */
export default function SpiralEyeLadder({ candies, apiConnected }: Props) {
  const [market, setMarket] = useState<MarketFilter>('ALL');
  const [timeframe, setTimeframe] = useState('15m');
  const [tempo, setTempo] = useState(4);
  const [playback, setPlayback] = useState<Playback>('IDLE');
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [placedIndex, setPlacedIndex] = useState<number | null>(null);

  const visible = useMemo(
    () => candies.filter((candy) => market === 'ALL' || candy.gravity.nearest_market === market),
    [candies, market],
  );
  const current = visible.length ? visible[cursor % visible.length] : undefined;
  const selected = candies.find((candy) => candy.index === selectedIndex);
  const selectedIsVisible = visible.some((candy) => candy.index === selectedIndex);
  const cellCount = Math.max(1, visible.length);
  const cellForSlot = (slot: number) => visible[slot];

  useEffect(() => {
    if (playback !== 'PLAYING' || !visible.length) return undefined;
    const timer = window.setInterval(() => {
      setCursor((position) => (position + 1) % visible.length);
    }, 1000 / tempo);
    return () => window.clearInterval(timer);
  }, [playback, tempo, visible]);

  useEffect(() => {
    setCursor(0);
    if (!selectedIsVisible && visible[0]) setSelectedIndex(visible[0].index);
    setPlacedIndex(null);
  }, [market, selectedIsVisible, visible]);

  return (
    <section className="space-y-4 rounded-xl border border-cyan-300/20 bg-[#050b12] p-4" aria-labelledby="spiral-ladder-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300">SPIRAL EYE EVENT / SIMULATION</p>
          <h2 id="spiral-ladder-title" className="mt-1 text-lg font-semibold">Strobe ladder · 384 model cells</h2>
        </div>
        <span className="rounded border border-amber-300/30 px-2 py-1 font-mono text-[10px] text-amber-200">
          {apiConnected ? 'ORACLE MODEL CONNECTED · NOT A LIVE PRICE FEED' : 'ORACLE API DISCONNECTED'}
        </span>
      </header>

      <p className="text-xs leading-5 text-slate-400">
        Click or tap a cell to inspect it. Arm and place only changes this visual simulation; it never creates an order.
        Timeframe and tempo control the playback display, not market timestamps.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-400">
          Market field
          <select value={market} onChange={(event) => setMarket(event.target.value as MarketFilter)} className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2 text-slate-100">
            {MARKETS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Display timeframe
          <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)} className="mt-1 w-full rounded border border-white/10 bg-slate-950 p-2 text-slate-100">
            {TIMEFRAMES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Strobe tempo <span className="float-right font-mono">{tempo} cells/s</span>
          <input aria-label="Strobe tempo" className="mt-3 w-full accent-cyan-300" type="range" min={1} max={12} value={tempo} onChange={(event) => setTempo(Number(event.target.value))} />
        </label>
        <div className="flex items-end gap-2">
          {playback === 'PLAYING'
            ? <button type="button" onClick={() => setPlayback('PAUSED')} className="flex items-center gap-1 rounded border border-cyan-300/40 px-3 py-2 text-xs text-cyan-100"><Pause size={14} /> Pause</button>
            : <button type="button" disabled={!visible.length} onClick={() => setPlayback('PLAYING')} className="flex items-center gap-1 rounded border border-cyan-300/40 px-3 py-2 text-xs text-cyan-100 disabled:opacity-40"><Play size={14} /> Play</button>}
          <button type="button" onClick={() => { setPlayback('IDLE'); setCursor(0); setPlacedIndex(null); }} className="flex items-center gap-1 rounded border border-white/10 px-3 py-2 text-xs text-slate-300"><RotateCcw size={14} /> Reset</button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Meter label="MINIMALISM / ACTIVE CELLS" value={selected ? `1 / ${cellCount}` : `0 / ${cellCount}`} ratio={selected ? 1 / cellCount : 0} tone="cyan" />
        <Meter label="REALISM / LIVE MARKET FEED" value="N/A · not connected" ratio={0} tone="amber" />
        <Meter
          label="SELECTED MODEL RR · ILLUSTRATIVE"
          value={selected ? `1 : ${selected.risk_reward_ratio.toFixed(2)}` : 'N/A'}
          ratio={selected ? Math.min(1, selected.risk_reward_ratio / 99) : 0}
          tone="violet"
        />
      </div>

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/70 p-3">
        <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
          <span>Past ← simulated {timeframe} steps → Future</span>
          <span>{playback} · {visible.length} visible</span>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }} role="grid" aria-label="384-cell strobe ladder">
          {Array.from({ length: 384 }, (_, slot) => {
            const candy = cellForSlot(slot);
            if (!candy) return <span key={slot} className="aspect-square rounded-sm bg-white/[0.025]" aria-hidden="true" />;
            const active = candy.index === current?.index && playback === 'PLAYING';
            const isSelected = candy.index === selectedIndex;
            const isPlaced = candy.index === placedIndex;
            const color = MARKET_COLORS[candy.gravity.nearest_market] ?? '#94a3b8';
            return (
              <button
                type="button"
                role="gridcell"
                aria-label={`Cell ${candy.index}, ${candy.waveform}, ${candy.polarity}, RR ${candy.risk_reward_ratio.toFixed(2)}`}
                title={`#${candy.index} · ${candy.waveform} ${candy.polarity} · RR ${candy.risk_reward_ratio.toFixed(2)}`}
                key={candy.index}
                onClick={() => { setSelectedIndex(candy.index); setPlayback('ARMED'); }}
                className={`aspect-square rounded-sm transition-all ${active ? 'scale-125 ring-2 ring-white shadow-[0_0_14px_white]' : ''} ${isSelected ? 'ring-2 ring-cyan-200' : ''} ${isPlaced ? 'ring-2 ring-amber-300' : ''}`}
                style={{ backgroundColor: color, opacity: active || isSelected || isPlaced ? 1 : candy.polarity === 'UP' ? 0.72 : 0.38 }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>384-cell model index · not historical time</span>
          <span>{current ? `Pulse ${current.index + 1} / ${visible.length}` : 'No model cells'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-xs">
          <Target size={14} className="text-cyan-300" />
          {selected
            ? <span>Selected #{selected.index} · {selected.waveform} {selected.polarity} · model RR {selected.risk_reward_ratio.toFixed(2)} · model T→target {formatTime(selected.time_to_target_hrs)}</span>
            : <span>Select a cell to inspect model output</span>}
        </div>
        <button type="button" disabled={!selected} onClick={() => { setPlacedIndex(selectedIndex); setPlayback('ARMED'); }} className="rounded border border-amber-300/40 px-3 py-2 text-xs text-amber-100 disabled:opacity-40">
          {placedIndex === selectedIndex ? 'Cell staged · simulation only' : 'Stage cell · simulation only'}
        </button>
      </div>
    </section>
  );
}

function Meter({ label, value, ratio, tone }: { label: string; value: string; ratio: number; tone: 'cyan' | 'amber' | 'violet' }) {
  const colors = { cyan: 'bg-cyan-300', amber: 'bg-amber-300', violet: 'bg-violet-300' };
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[9px] tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xs text-slate-200">{value}</p>
      <div className="mt-2 h-1 overflow-hidden rounded bg-white/10"><div className={`h-full ${colors[tone]}`} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} /></div>
    </div>
  );
}
