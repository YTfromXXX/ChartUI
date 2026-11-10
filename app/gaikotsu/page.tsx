'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import GaikotsuBoard from '@/components/gaikotsu/GaikotsuBoard';
import { STATIONS, YEARS, assets, cpuStep, decide, judge, newGame, philosophy, priceOf, roll, settleDevil, type GameState, type PlayerId } from '@/lib/gaikotsu';
import { useMenteInbox } from '@/lib/menteInbox';

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const CPU_DELAY = 1300;

/** 骸骨電鉄 (Fami port 12): monochrome super mini game — philosophy against money. */
export default function GaikotsuPage() {
  const [seed, setSeed] = useState(1);
  const [game, setGame] = useState<GameState>(() => newGame(1));
  const notify = useMenteInbox((s) => s.notify);
  const reported = useRef(false);
  const now = () => performance.now();

  // 老婆 (CPU, money faction) plays her turn after a beat.
  useEffect(() => {
    if (game.current !== 'obaa' || game.phase === 'over') return undefined;
    const timer = window.setTimeout(() => setGame((g) => cpuStep(g, now())), CPU_DELAY);
    return () => window.clearTimeout(timer);
  }, [game]);

  // Game over: Mente receives the verdict.
  useEffect(() => {
    if (game.phase !== 'over' || reported.current) return;
    reported.current = true;
    notify({ source: 'mente', title: '骸骨電鉄 · 終着', body: judge(game), href: '/gaikotsu' });
  }, [game, notify]);

  const restart = () => { const next = seed + 1; setSeed(next); reported.current = false; setGame(newGame(next)); };
  const yourTurn = game.current === 'you';
  const here = STATIONS[game.players.you.pos];
  const total = (p: PlayerId) => assets(game, p) + philosophy(game, p);
  const balance = total('you') / Math.max(1, total('you') + total('obaa'));

  return (
    <main className="min-h-screen bg-black px-3 py-5 font-mono text-white sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="space-y-1 border-b-4 border-white pb-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">FamiDance · TEXT</p>
          <p className="text-[12px] italic">“ピクセル形状が急激にリアリズムな描写にテンポよく挿入する、スーパードーリーズームを描画する解析に備えよ”</p>
          <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
            <h1 className="text-4xl font-black tracking-[0.25em] [text-shadow:4px_4px_0_#555]">骸骨電鉄</h1>
            <nav className="flex gap-3 text-xs text-white/70">
              <Link href="/mente" className="hover:text-white">Mente</Link>
              <Link href="/retro-grid?page=A" className="hover:text-white">Retro Grid</Link>
            </nav>
          </div>
          <p className="text-[11px] text-white/60">Famiポート 12 · #Mente からの要求 · 双六のマス目と物件取引の寓話 · 架空通貨「骨貨」のシミュレーション（実際のお金は扱わない）</p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <GaikotsuBoard state={game} />

          <aside className="space-y-3 text-[11px]">
            {(['you', 'obaa'] as const).map((p) => {
              const pl = game.players[p];
              return (
                <div key={p} className={`border-2 p-2 ${game.current === p ? 'border-white' : 'border-white/30'}`}>
                  <p className="font-bold">{pl.name}{game.devil.rider === p ? ' · XV 同乗中' : ''}</p>
                  <p>骨貨 {pl.money} · 資産 {assets(game, p)} · {pl.laps}/{YEARS} 年</p>
                  <p>知 {pl.philo} · 人材 {pl.hr} · 哲学 {philosophy(game, p)}</p>
                  <p className="text-white/50">物件 {game.owner.filter((o) => o === p).length}</p>
                </div>
              );
            })}
            <div>
              <p className="mb-1 text-[10px] text-white/60">哲学派 ⇄ 貨幣派（資産＋哲学）</p>
              <div className="h-3 border border-white"><div className="h-full bg-white" style={{ width: `${balance * 100}%` }} /></div>
            </div>
            <p className="text-[10px] text-white/60">物件価格 ×{game.priceMul.toFixed(2)}（X 運命の輪で ×φ / ×1/φ）</p>
          </aside>
        </div>

        {/* Controls */}
        <section aria-label="Controls" className="flex flex-wrap items-center gap-3 border-4 border-white p-3 text-sm">
          <span className="text-3xl">{game.dice.map((d) => DIE[d - 1]).join(' ') || '🎲'}</span>
          {game.phase === 'over' ? (
            <>
              <span className="font-bold">終着：{judge(game)}</span>
              <button type="button" onClick={restart} className="border-2 border-white px-3 py-1 hover:bg-white hover:text-black">もう一度乗る</button>
            </>
          ) : !yourTurn ? (
            <span className="text-white/70">老婆の手番……</span>
          ) : game.phase === 'devil' ? (
            <button type="button" onClick={() => setGame((g) => settleDevil(g, now()))} className="border-2 border-white bg-white px-3 py-1 font-bold text-black">悪魔をサイコロ 2 個で清算する（7 なら追い払う）</button>
          ) : game.phase === 'buy' ? (
            <>
              <span>{here.name}：{priceOf(game, here.id)} 骨貨</span>
              <button type="button" disabled={game.players.you.money < priceOf(game, here.id)} onClick={() => setGame((g) => decide(g, true))} className="border-2 border-white px-3 py-1 hover:bg-white hover:text-black disabled:opacity-40">買う</button>
              <button type="button" onClick={() => setGame((g) => decide(g, false))} className="border-2 border-white/50 px-3 py-1">見送る（知 +1）</button>
            </>
          ) : (
            <button type="button" onClick={() => setGame((g) => roll(g, now()))} className="border-2 border-white bg-white px-4 py-1 font-bold text-black">サイコロを振る</button>
          )}
        </section>

        {/* Manga panels */}
        <section aria-label="Panels" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {game.log.slice(0, 9).map((panel, i) => (
            <article
              key={`${game.turn}-${i}`}
              className="relative min-h-[7rem] overflow-hidden border-4 border-white p-3"
              style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.18) 1px, transparent 1.2px)', backgroundSize: '6px 6px', transform: `rotate(${(i % 3) - 1}deg)` }}
            >
              <p className="absolute right-2 top-1 rotate-6 text-2xl font-black italic text-white/80">{panel.sfx}</p>
              <p className="inline-block bg-white px-1.5 text-xs font-bold text-black">{panel.title}</p>
              <p className="mt-2 text-[12px] leading-5">{panel.text}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
