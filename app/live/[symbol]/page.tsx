'use client';

import { ArrowLeft, CircleDot, Flame, Radio, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import LiveChartView from '@/components/LiveChartView';
import KnotChart, { type KnotTimelineLayer, type KnotTick } from '@/components/2d/KnotChart';
import TarotScene from '@/components/3d/TarotScene';
import { useMarketStream } from '@/hooks/useMarketStream';
import { calculateResonance, demoPortfolio, getTransitionRoute, type TransitionRoute } from '@/lib/portfolio';
import { parseStrategyContract, STRATEGY_CONTRACT_KEY, type StrategyContract } from '@/lib/strategy';

const arcanaBySymbol: Record<string, string> = {
  DOGEUSD: '0_THE_FOOL', BTCUSD: '1_THE_MAGICIAN', EURUSD: '2_THE_HIGH_PRIESTESS', XAUUSD: '3_THE_EMPRESS',
  US500: '4_THE_EMPEROR', GBPUSD: '5_THE_HIEROPHANT', ETHUSD: '6_THE_LOVERS', NAS100: '7_THE_CHARIOT',
  US30: '8_STRENGTH', USDJPY: '9_THE_HERMIT', SOLUSD: '10_WHEEL_OF_FORTUNE', AUDUSD: '11_JUSTICE',
  XAGUSD: '12_THE_HANGED_MAN', LTCUSD: '13_DEATH', USDCHF: '14_TEMPERANCE', XRPUSD: '15_THE_DEVIL',
  BTCXAU: '16_THE_TOWER', NZDUSD: '17_THE_STAR', USDCAD: '18_THE_MOON', DAX40: '19_THE_SUN',
  ADAUSD: '20_JUDGEMENT', GER40: '21_THE_WORLD',
};

export default function LiveSymbolPage() {
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const symbol = decodeURIComponent(params.symbol ?? '').toUpperCase();
  const { marketDataMap, coordinateHistoryMap, isConnected, burstEvent, burstId } = useMarketStream(process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/signals', symbol);
  const data = marketDataMap[symbol];
  const selectedArcana = data?.major_arcana || arcanaBySymbol[symbol] || 'ARCANA_PENDING';
  const physics = data?.rendered_physics;
  const visuals = data?.visual_triggers;
  const queryRoute = searchParams.get('transition');
  const resonance = calculateResonance(demoPortfolio, data);
  const transitionRoute: TransitionRoute = queryRoute === 'voxel' || queryRoute === 'lens' ? queryRoute : getTransitionRoute(resonance);
  const knotTick: KnotTick | undefined = data ? {
    timestamp: (data.chart_data?.time ?? Date.now() / 1000) * 1000,
    price: data.chart_data?.close ?? data.s15_delta,
    volatility: Math.min(1, Math.abs(data.rendered_physics?.complexity_c ?? data.rsi_tension ?? 0.25)),
    angle: ((data.rendered_physics?.tornado_tilt_deg ?? data.curvature ?? 0) * Math.PI) / 180,
    magicLength: Math.min(3, Math.abs(data.elastic_energy ?? data.volume_mass ?? 0) / 100),
    tension: Math.min(1, Math.abs(data.rendered_physics?.tension_t ?? data.s15_delta) / 100),
    jump: data.physics_event === 'knot_burst',
  } : undefined;
  const knotTimeline: Record<'t40m' | 't4h' | 'target' | 'best', KnotTimelineLayer> = {
    t40m: { price: knotTick?.price ?? 0, volatility: Math.min(1, (knotTick?.volatility ?? 0.2) * 1.2), angle: (knotTick?.angle ?? 0) - 0.25, color: '#38bdf8', opacity: 0.3 },
    t4h: { price: knotTick?.price ?? 0, volatility: Math.min(1, (knotTick?.volatility ?? 0.2) * 0.9), angle: (knotTick?.angle ?? 0) + 0.65, color: '#f8d66d', opacity: 0.28 },
    target: { price: knotTick?.price ?? 0, volatility: knotTick?.volatility ?? 0.2, angle: knotTick?.angle ?? 0, color: '#fb7185', opacity: 0.34 },
    best: { price: knotTick?.price ?? 0, volatility: Math.max(0.08, (knotTick?.volatility ?? 0.2) * 0.72), angle: (knotTick?.angle ?? 0) - 0.9, color: '#a78bfa', opacity: 0.24 },
  };
  const [strategy, setStrategy] = useState<StrategyContract | null>(null);
  const [mana, setMana] = useState(0);
  const [knotChain, setKnotChain] = useState(0);

  useEffect(() => {
    const contract = parseStrategyContract(window.sessionStorage.getItem(STRATEGY_CONTRACT_KEY));
    if (contract?.symbol === symbol) {
      setStrategy(contract);
      setMana(contract.manaLimit);
    }
  }, [symbol]);

  useEffect(() => {
    if (!burstEvent || !strategy) return;
    setMana((current) => Math.max(0, current - Math.max(5, Math.round(strategy.syncLevel / 10))));
    setKnotChain((current) => current + 1);
  }, [burstEvent, strategy]);

  return (
    <main className="min-h-screen bg-[#080b10] px-4 py-6 font-display text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-4"><Link href="/gallery" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 transition-colors hover:text-cyan-200"><ArrowLeft className="h-3 w-3" /> Arcana gallery</Link><Link href="/knot-chart" className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/70 transition-colors hover:text-cyan-100">Full-screen knot chart</Link></div>
            <div className="flex items-center gap-3"><Radio className="h-4 w-4 text-cyan-300" /><p className="font-mono text-[10px] uppercase tracking-[0.4em] text-stone-500">Live chart access</p></div>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.04em] text-cyan-100 sm:text-6xl">{symbol || 'UNKNOWN'}</h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">{isConnected ? <Wifi className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-stone-600" />} {isConnected ? 'live transmission' : 'demo relay'}</div>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <div className="border-l border-cyan-300/50 bg-white/[0.03] px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">Selected arcana</p><p className="mt-1 text-sm text-stone-200">{selectedArcana}</p></div>
          <div className="border-l border-amber-200/50 bg-white/[0.03] px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">Wuxing</p><p className="mt-1 text-sm text-amber-100">{data?.wuxing_phase || 'UNKNOWN'}</p></div>
          <div className="border-l border-emerald-300/50 bg-white/[0.03] px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">Micro pressure</p><p className="mt-1 text-sm text-emerald-200">{data?.tri_layer.micro || 'SCANNING'}</p></div>
          <div className="border-l border-red-300/50 bg-white/[0.03] px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone-600">Delta</p><p className="mt-1 text-sm text-red-200">{data ? data.s15_delta.toFixed(4) : '--'}</p></div>
        </div>
        <section className="mb-5 grid gap-3 border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Live physics telemetry">
          {[
            ['R / thickness', physics?.thickness_r],
            ['T / tension', physics?.tension_t],
            ['C / complexity', physics?.complexity_c],
            ['Tilt', physics?.tornado_tilt_deg],
            ['Gravity', physics?.gravity_g],
          ].map(([label, value]) => <div key={label as string}><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-stone-600">{label}</p><p className="mt-1 font-mono text-sm text-cyan-100">{typeof value === 'number' ? value.toFixed(3) : '--'}</p></div>)}
        </section>
        <LiveChartView symbol={symbol} data={data} isConnected={isConnected} />
        <section className="mt-5 overflow-hidden border border-cyan-200/15 bg-[#020814] p-4" aria-label="High frequency knot projection">
          <div className="mb-3 flex items-end justify-between border-b border-white/10 pb-3">
            <div><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/60">Projection / native canvas</p><h2 className="mt-1 text-lg tracking-[0.12em] text-stone-100">FOUR-LAYER KNOT TRACE</h2></div>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-stone-600">ring buffer / 60fps</span>
          </div>
          <KnotChart tick={knotTick} timeline={knotTimeline} height={340} />
        </section>
        {strategy && <section className="mt-5 border border-amber-200/20 bg-amber-100/[0.035] p-4" aria-label="ChartUI strategy contract">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-amber-200" /><div><p className="font-mono text-[9px] uppercase tracking-[0.24em] text-amber-200/65">ChartUI strategy contract</p><p className="mt-1 text-sm text-stone-200">{strategy.courtCard} / hexagram {strategy.hexagramBinary}</p></div></div>
            <div className="text-right font-mono"><p className="text-[9px] uppercase tracking-[0.2em] text-stone-500">Knot chain</p><p className="mt-1 text-lg text-amber-100">{knotChain} <span className="text-xs text-stone-500">confirmed</span></p></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="font-mono text-[9px] uppercase text-stone-500">Mana reserve</p><div className="mt-2 h-2 bg-black/40"><div className="h-full bg-amber-200 transition-[width] duration-700" style={{ width: `${mana}%` }} /></div><p className="mt-1 font-mono text-xs text-amber-100">{mana}%</p></div><div className="border-l border-white/10 pl-3"><p className="font-mono text-[9px] uppercase text-stone-500">Sync field</p><p className="mt-1 font-mono text-sm text-cyan-100">{strategy.syncLevel}%</p></div><div className="border-l border-white/10 pl-3"><p className="font-mono text-[9px] uppercase text-stone-500">Contest rule</p><p className="mt-1 flex items-center gap-1 font-mono text-sm text-red-100"><Flame className="h-3 w-3" /> {mana > 0 ? 'armed / observe' : 'depleted / pause'}</p></div></div>
        </section>}
        <TarotScene
          className="relative mt-5 h-[620px] w-full overflow-hidden border border-cyan-300/20 bg-[#030712] shadow-[0_0_70px_rgba(34,211,238,0.08)]"
          data={{
            cardName: selectedArcana,
            symbol,
            knotType: data?.knot_type,
            wuxingPhase: data?.wuxing_phase ?? 'EARTH',
            isEmperorSynchronized: data?.is_emperor_synchronized ?? false,
            s15Volume: data?.s15_volume ?? 0,
            s15Delta: data?.s15_delta ?? 0,
            hexagramBinary: data?.hexagram_binary,
            elasticEnergy: data?.elastic_energy,
            burstId,
            triggerFirework: visuals?.trigger_firework,
            backgroundHex: visuals?.background_hex,
            iChingHexagramSymbol: visuals?.i_ching_hexagram_symbol,
            trajectory: coordinateHistoryMap[symbol],
            oracleBranches: data?.oracle_branches,
            resonance,
            transitionRoute,
          }}
        />
        {burstEvent && <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-fuchsia-200">Knot burst detected / elastic threshold exceeded</p>}
        <p className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-600"><CircleDot className="h-3 w-3" /> Selected symbol stream / one-second physics refresh {visuals?.i_ching_hexagram_symbol ? `/ ${visuals.i_ching_hexagram_symbol}` : ''}</p>
      </div>
    </main>
  );
}