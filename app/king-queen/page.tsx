'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { KingQueenKit, SensorySpiceKit } from '@/app/cure-api/TSMonsterEngine';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { useMenteInbox } from '@/lib/menteInbox';

const { HUB_ARCANA, REELS, SUITS, hubForLap, leverOn, wildcardsFor } = KingQueenKit;
const SELECT_OPTIONS = [...SUITS.map((s) => `${s}の 7`), 'ペイジ', 'ナイト', 'クイーン', 'キング'];
const SYMBOL_COLOR: Record<string, string> = { VII戦車: '#38bdf8', XVI塔: '#f43f5e', KING: '#fbbf24', QUEEN: '#e879f9' };

/** ./King&Queen — entry layer (meta view): hub, wildcards and the slot that notifies Mente. */
export default function KingQueenPage() {
  const [lap, setLap] = useState(0);
  const [select, setSelect] = useState(SELECT_OPTIONS[0]);
  const [game, setGame] = useState(0);
  const [carpet, setCarpet] = useState(0);
  const [log, setLog] = useState<ReturnType<typeof leverOn>[]>([]);
  const notify = useMenteInbox((s) => s.notify);
  const pattern = useCureAPIStore((s) => s.placeholderState);
  const oddField = useCureAPIStore((s) => s.oddField);

  const hub = hubForLap(lap, select);
  const sense = useMemo(() => SensorySpiceKit.senseSpice({ pattern: pattern === 'idle' ? '⚪︎' : pattern, tension: oddField?.tension, oddRatio: oddField?.oddRatio }), [pattern, oddField]);
  const wildcards = wildcardsFor(sense.texture);
  const last = log[0];

  const pull = () => {
    const result = leverOn(game + 1, carpet);
    setGame(result.game);
    setLog((l) => [result, ...l].slice(0, 12));
    for (const event of result.events) {
      notify({ source: 'kingqueen', title: event.title, body: `G${result.game} · ${event.body}`, href: '/king-queen' });
    }
  };

  return (
    <main className="min-h-screen bg-[#05020a] px-4 py-6 font-mono text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-amber-300/20 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300">./King&amp;Queen · KingQueenKit · 導入部（メタ視点）</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[0.2em] text-amber-200 [text-shadow:3px_3px_0_#7c2d12]">KING &amp; QUEEN</h1>
            <p className="text-[11px] text-slate-400">Dirty FOOL JOKER SYSTEM · 78-Deck Infinite Loop</p>
          </div>
          <nav className="flex gap-3 text-xs">
            <Link href="/mente" className="text-rose-300 hover:text-white">Mente の通知 →</Link>
            <Link href="/cure-api" className="text-slate-400 hover:text-white">Cure-API</Link>
          </nav>
        </header>

        <p className="max-w-3xl text-[12px] leading-6 text-slate-300">
          カードレフェリーの視点から：7 ならべの中央「7 のマス」は 3 つの枠でできている。周回ごとにアルカナ枠と記号枠が巡り、SELECT 枠だけがプレイヤーの手に残る。ワイルドカードは Cure-API の感覚装置が決める。リールを回すと、出来事は Mente に通知として届く。
        </p>

        {/* A. Central 7 hub */}
        <section aria-label="Seven hub" className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">A · 中央「7 のマス」（ChartUI 基本設備）· 周回 {lap}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="border border-amber-300/40 p-3"><p className="text-[10px] text-slate-400">アルカナ枠</p><p className="text-lg text-amber-100">{hub.arcana.name}</p><p className="text-[10px] text-slate-500">{hub.arcana.role}</p></div>
            <div className="border border-amber-300/40 p-3"><p className="text-[10px] text-slate-400">{'{記号}'}枠</p><p className="text-lg text-amber-100">{hub.symbol}</p><p className="text-[10px] text-slate-500">この周回の起点スート</p></div>
            <label className="border border-amber-300/40 p-3"><span className="block text-[10px] text-slate-400">SELECT 枠</span>
              <select value={select} onChange={(e) => setSelect(e.target.value)} className="mt-1 w-full border border-white/15 bg-black px-1 py-1 text-amber-100">
                {SELECT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={() => setLap((n) => n + 1)} className="border border-amber-300/50 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-300/10">次の周回へ（アルカナ {HUB_ARCANA.length} × 記号 {SUITS.length} ＝ 12 周で一巡）</button>
        </section>

        {/* B. Wildcards by the sensory device */}
        <section aria-label="Wildcards" className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">B · ワイルドカード（Cure-API の感覚装置に依存）</p>
          <p className="text-[11px] text-slate-400">SensorySpiceKit：パターン {pattern === 'idle' ? '⚪︎（未選択）' : pattern} → {sense.texture} · {sense.spice} · intensity {sense.intensity.toFixed(2)}</p>
          <ul className="space-y-1">{wildcards.map((w) => <li key={w.card} className="text-[12px]"><span className="text-amber-100">{w.card}</span> — {w.rule}</li>)}</ul>
        </section>

        {/* Slot: lever-on sends events to Mente */}
        <section aria-label="Slot" className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">スロット（シミュレーション）· G{game} · デビル・カーペット {carpet} 枚 · 予言カットイン 1/{carpet >= 5 ? 343 : 2048}</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid grid-cols-3 gap-1 border-4 border-amber-900 bg-black p-1">
              {[0, 1, 2].map((r) => (
                <div key={r} className="w-24 border border-white/10">
                  {[-1, 0, 1].map((d) => {
                    const sym = REELS[r][((last?.stops[r] ?? 0) + d + 20) % 20];
                    return <p key={d} className={`px-1 py-1 text-center text-[12px] ${d === 0 ? 'bg-white/10' : 'opacity-40'}`} style={{ color: SYMBOL_COLOR[sym] ?? '#e2e8f0' }}>{sym}</p>;
                  })}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={pull} className="border-2 border-amber-300 px-4 py-2 font-bold text-amber-100 hover:bg-amber-300/10">レバーオン</button>
              <button type="button" onClick={() => setCarpet((c) => c + 1)} className="border border-white/15 px-3 py-1 text-[11px] text-slate-300">パスをストック（＋1 枚）</button>
              <button type="button" onClick={() => notify({ source: 'kingqueen', title: 'テスト通知', body: `周回 ${lap} · ハブ（${hub.arcana.name}, ${hub.symbol}, ${hub.select}）`, href: '/king-queen' })} className="text-[10px] text-slate-500 underline">テスト：イベント通知を送る</button>
            </div>
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {log.map((r) => (
              <li key={r.game} className={r.events.length ? 'text-amber-100' : 'text-slate-500'}>
                G{r.game} · {r.symbols.join(' / ')}{r.events.length ? ` → ${r.events.map((e) => e.title).join('・')}（Mente に通知）` : ''}
              </li>
            ))}
          </ul>
          <p className="text-[9px] text-slate-600">演出と数理のシミュレーション。メダル・お金・オッズ・換金は扱わない。</p>
        </section>
      </div>
    </main>
  );
}
