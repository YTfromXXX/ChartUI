'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import PixelSprite from '@/components/fami/PixelSprite';
import FibonacciMirror from '@/components/stoic/FibonacciMirror';
import { useSyntheticBtc } from '@/hooks/useSyntheticBtc';
import { SPRITES } from '@/lib/famiSprites';
import { CARTRIDGES, aaGrid, chakraName, initRoom, insert, settle, synthesize, taskOff, taskOn, thesesFor, tick, type RoomState } from '@/lib/stoicRoom';

const TICK_MS = 300;
const SPIN_TICKS = 5;

/** THE STOIC ROOM — Cybernetics-API (virtual METADOGG-ORACLE-API), Fami port 10. */
export default function StoicRoomPage() {
  const btc = useSyntheticBtc();
  const [room, setRoom] = useState<RoomState>(initRoom);
  const price = useRef(btc.price);
  price.current = btc.price;

  // The room clock: frames and slots advance; the spin ends in TASKON; the lag settles by itself.
  useEffect(() => {
    const timer = window.setInterval(() => setRoom((r) => {
      let next = tick(r);
      if (next.phase === 'spin' && next.frame >= SPIN_TICKS) next = taskOn(next, price.current);
      if (next.phase === 'lag') next = settle(next, price.current);
      return next;
    }), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // TAB issues the synthetic data; A–D chooses the thesis.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') { event.preventDefault(); setRoom((r) => synthesize(r)); return; }
      const k = event.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(k)) setRoom((r) => taskOff(r, k as 'A' | 'B' | 'C' | 'D'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const c = room.cartridge;
  return (
    <main className="min-h-screen bg-[#0b0b10] px-3 py-5 font-mono text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Cybernetics-API · 仮想 METADOGG-ORACLE-API · Famiポート 10</p>
            <h1 className="text-2xl font-bold tracking-[0.2em]">THE STOIC ROOM</h1>
          </div>
          <div className="text-right text-[11px]" aria-label="BTCUSD synthetic price">
            <p>BTCUSD 合成価格 <span className="text-lg text-amber-200">{btc.price.toFixed(5)}</span></p>
            <p className={btc.source === 'SYNTHETIC' ? 'text-slate-500' : 'text-emerald-300'}>{btc.source}{btc.btc ? ` · BTC $${btc.btc.toLocaleString()}` : ' · CoinGecko に届かないため合成ウォーク'}</p>
          </div>
        </header>

        {/* Cartridge shelf: always new */}
        <section aria-label="Cartridge shelf" className="border-4 border-[#5a3a22] bg-[#2b1d12] p-2">
          <p className="mb-1 text-[10px] text-amber-100/70">カセット棚 · 0〜22（タロットの 22 のアルカナ ＋ 0 の愚者 · 双六の周回 mesh）· すべて常に新品</p>
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-12 lg:grid-cols-[repeat(23,minmax(0,1fr))]">
            {CARTRIDGES.map((cart) => (
              <button
                key={cart.no}
                type="button"
                disabled={room.phase !== 'shelf'}
                onClick={() => setRoom((r) => insert(r, cart.no))}
                title={cart.name}
                className={`flex h-16 flex-col items-center justify-between rounded-t-sm border-2 px-0.5 py-1 text-[9px] ${c === cart.no ? 'border-amber-300 bg-amber-300/20' : 'border-black bg-[#8c8c8c] text-black hover:bg-[#a5a5a5]'} disabled:cursor-not-allowed`}
              >
                <span className="font-bold">{cart.no}</span>
                <span className="w-full truncate text-center leading-none">{cart.name.split(' ').slice(-1)[0]}</span>
                <span className="h-1 w-3/4 bg-black/40" />
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <section aria-label="Console" className="space-y-2 border-2 border-white/20 p-3 text-[11px]">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">phase · {room.phase.toUpperCase()}</p>
            <pre className="bg-black p-3 text-center text-lg leading-6 text-amber-100" aria-label="8x8 grid">{aaGrid(c ?? 0, room.frame, room.phase)}</pre>
            {room.phase === 'shelf' && <p>棚からカセットを選んで差し込む。</p>}
            {room.phase === 'spin' && <p>双六の駒とタロットのシャッフルが高速駆動……</p>}
            {room.phase === 'taskon' && (
              <div className="space-y-1">
                <p>TASKON：未確定ボトルがスロット {room.bottle?.slot} へプール中。</p>
                <button type="button" onClick={() => setRoom((r) => synthesize(r))} className="flex w-full items-center justify-center gap-2 border border-amber-300/60 py-1"><PixelSprite sprite={SPRITES.cat} className="h-6 w-6" /> 愛猫に給餌（または TAB）</button>
              </div>
            )}
            {room.phase === 'lag' && <p>データラグ：スロット {room.slotNow} / {room.bottle?.slot} で精算</p>}
            {room.phase === 'taskoff' && c !== null && (
              <div className="grid gap-1">
                <p>精算 {room.bip} BIP · 論文を選ぶ（A〜D キー）</p>
                {thesesFor(c).map((t) => <button key={t.key} type="button" onClick={() => setRoom((r) => taskOff(r, t.key))} className="border border-white/20 px-2 py-1 text-left hover:border-amber-200/60"><span className="text-amber-200">{t.key}</span> {t.text}</button>)}
              </div>
            )}
            <div aria-label="Kundalini">
              <p>クンダリーニ：第 {room.kundalini + 1} チャクラ（{chakraName(room.kundalini)}）· ループ {room.loops}</p>
              <div className="mt-1 flex gap-1">{Array.from({ length: 7 }, (_, i) => <span key={i} className={`h-2 flex-1 ${i <= room.kundalini ? 'bg-amber-300' : 'bg-white/10'}`} />)}</div>
            </div>
          </section>

          <section aria-label="Diary" className="max-h-[32rem] space-y-2 overflow-y-auto border-2 border-white/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">応答ログ（Diary）· 新しい順</p>
            {room.diary.length === 0 ? <p className="text-[11px] text-slate-500">入力のたびにログが追加される。</p> : room.diary.map((d, i) => <pre key={room.diary.length - i} className="whitespace-pre-wrap text-[11px] leading-5 text-slate-200">{d}</pre>)}
          </section>
        </div>

        <FibonacciMirror series={btc.history} />

        <nav className="flex gap-3 text-xs text-slate-400">
          <Link href="/gaikotsu" className="hover:text-white">髑髏電鉄</Link>
          <Link href="/mente" className="hover:text-white">Mente</Link>
          <Link href="/retro-grid?page=A" className="hover:text-white">Retro Grid</Link>
        </nav>
      </div>
    </main>
  );
}
