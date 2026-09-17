'use client';

import { ArrowLeft, LockKeyhole, Radio, SlidersHorizontal, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import StrategySandbox from '@/components/3d/StrategySandbox';
import { STRATEGY_CONTRACT_KEY, type CourtCard } from '@/lib/strategy';

const courtCards: CourtCard[] = ['Knight', 'Queen', 'King'];

export default function StrategyPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol ?? '').toUpperCase();
  const [manaLimit, setManaLimit] = useState(42);
  const [syncLevel, setSyncLevel] = useState(68);
  const [courtCard, setCourtCard] = useState<CourtCard>('Knight');
  const [isStrategyLocked, setIsStrategyLocked] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const hexagramBinary = Array.from({ length: 6 }, (_, index) => syncLevel >= (index + 1) * (100 / 6) ? '1' : '0').join('');

  useEffect(() => {
    if (!isStrategyLocked) return;
    const countdownTimer = window.setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000);
    const routeTimer = window.setTimeout(() => router.push(`/live/${encodeURIComponent(symbol)}?transition=lens`), 3000);
    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(routeTimer);
    };
  }, [isStrategyLocked, router, symbol]);

  function lockStrategy() {
    setCountdown(3);
    window.sessionStorage.setItem(STRATEGY_CONTRACT_KEY, JSON.stringify({
      symbol,
      manaLimit,
      syncLevel,
      courtCard,
      hexagramBinary,
      lockedAt: Date.now(),
    }));
    setIsStrategyLocked(true);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#02070c] text-stone-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_22%_42%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_80%_50%,rgba(245,158,11,0.08),transparent_30%)]" />
      <div className="relative mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <Link href="/gallery" className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 transition-colors hover:text-cyan-200"><ArrowLeft className="h-3 w-3" /> Arcana gallery</Link>
            <div className="flex items-center gap-3"><Radio className="h-4 w-4 text-cyan-300" /><p className="font-mono text-[10px] uppercase tracking-[0.36em] text-cyan-100/55">Strategy contest / {symbol}</p></div>
            <h1 className="mt-2 text-3xl tracking-[0.08em] text-stone-100 sm:text-5xl">AUTOMATED TRADE LOGIC</h1>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">Gallery → Strategy → Turbulence chart</div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="relative border border-cyan-200/15 bg-white/[0.025] p-3 sm:p-5" aria-label="3D strategy sandbox">
            <div className="mb-4 flex items-center justify-between font-mono">
              <div><p className="text-[9px] uppercase tracking-[0.3em] text-cyan-200/55">Logic geometry</p><h2 className="mt-1 text-lg tracking-[0.1em]">RISK FIELD / {symbol}</h2></div>
              <span className={`border px-2 py-1 text-[9px] uppercase tracking-[0.16em] ${isStrategyLocked ? 'border-amber-200/50 text-amber-100' : 'border-cyan-200/20 text-cyan-100/55'}`}>{isStrategyLocked ? 'knot forming' : 'sandbox open'}</span>
            </div>
            <StrategySandbox isStrategyLocked={isStrategyLocked} hexagramBinary={hexagramBinary} className="h-[56vh] min-h-[430px] w-full" />
            <div className="mt-4 grid gap-3 font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500 sm:grid-cols-3">
              <div className="border-l border-cyan-300/50 px-3"><span className="block text-cyan-200/75">Blue node</span>Entry / yin trigger</div>
              <div className="border-l border-red-300/50 px-3"><span className="block text-red-200/75">Red node</span>Exit / yang trigger</div>
              <div className="border-l border-amber-200/50 px-3"><span className="block text-amber-100/75">Golden line</span>Locked knot route</div>
            </div>
          </section>

          <aside className="border border-white/15 bg-white/[0.07] p-5 shadow-[0_0_60px_rgba(34,211,238,0.06)] backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-amber-200/65"><SlidersHorizontal className="h-3 w-3" /> Execution parameters</div>
            <h2 className="mt-3 text-2xl tracking-[0.06em]">CONTEST CONFIG</h2>
            <p className="mt-3 font-mono text-[10px] leading-5 text-stone-400">Shape the entry and exit relationship before the live turbulence stream begins.</p>

            <div className="mt-8 space-y-7">
              <label className="block"><span className="flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-stone-300"><span>Mana consumption cap</span><span className="text-cyan-200">{manaLimit}%</span></span><input className="mt-3 w-full accent-cyan-300" type="range" min="5" max="100" value={manaLimit} onChange={(event) => setManaLimit(Number(event.target.value))} /></label>
              <label className="block"><span className="flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-stone-300"><span>I Ching sync level</span><span className="text-amber-100">{syncLevel}%</span></span><input className="mt-3 w-full accent-amber-200" type="range" min="0" max="100" value={syncLevel} onChange={(event) => setSyncLevel(Number(event.target.value))} /></label>
              <label className="block"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-300">Court execution card</span><select className="mt-3 w-full border border-white/15 bg-[#071018] px-3 py-3 font-mono text-xs text-stone-100 outline-none focus:border-cyan-200/60" value={courtCard} onChange={(event) => setCourtCard(event.target.value as CourtCard)}>{courtCards.map((card) => <option key={card}>{card}</option>)}</select></label>
            </div>

            <div className="mt-8 border border-white/10 bg-black/20 p-4 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-500">
              <div className="flex items-center justify-between"><span>Entry / exit spread</span><span className="text-cyan-200">{Math.max(1, Math.round((100 - syncLevel) / 10))} units</span></div>
              <div className="mt-3 flex items-center justify-between"><span>Risk enclosure</span><span className="text-amber-100">{manaLimit < 35 ? 'tight' : manaLimit < 70 ? 'balanced' : 'wide'}</span></div>
              <div className="mt-3 flex items-center justify-between"><span>Court directive</span><span className="text-red-200">{courtCard}</span></div>
              <div className="mt-3 flex items-center justify-between"><span>Yin / yang sequence</span><span className="text-amber-100">{hexagramBinary}</span></div>
            </div>

            <button type="button" onClick={lockStrategy} disabled={isStrategyLocked} className="mt-8 flex w-full items-center justify-center gap-2 border border-amber-100/50 bg-amber-100/10 px-4 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-100/20 disabled:cursor-wait disabled:opacity-70"><LockKeyhole className="h-4 w-4" /> {isStrategyLocked ? `Knot locked / chart in ${countdown}s` : 'Lock strategy and observe'}</button>
            {isStrategyLocked && <p className="mt-4 flex items-center justify-center gap-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200/70"><Sparkles className="h-3 w-3" /> Entry and exit nodes converging</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
