'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CAP, KINDS, lineage, newSwarm, proliferate, roughSteps, screenStep, type Member, type Swarm } from '@/lib/swarm';

const TICK_MS = 2500;
const COLOR = { BA: '#7a5c12', PE: '#2f6b1a' } as const; // both ≥ 4.5:1 on white

/**
 * Story event (years 6–7): the bottle-collectors multiply. Click one to make more of it (player side);
 * the screen also makes more on its own clock (screen side). Names are BA-/PE- + 4 hex digits of
 * keccak-256 of the parent's name. Over the cap, the oldest leave to climb the spiral staircase;
 * the number of steps is never shown exactly — アリミノボーイ only knows it roughly.
 */
export default function SwarmEvent() {
  const [s, setS] = useState<Swarm>(() => newSwarm());
  const [running, setRunning] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [boySays, setBoySays] = useState<string | null>(null);
  const reduce = useRef(false);

  useEffect(() => { reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }, []);
  useEffect(() => {
    if (!running) return undefined;
    const t = window.setInterval(() => setS((x) => screenStep(x)), TICK_MS);
    return () => window.clearInterval(t);
  }, [running]);

  const tap = (m: Member) => { setS((x) => proliferate(x, m.id, 'player')); setPicked(m.id); };
  const last = s.climbed[s.climbed.length - 1];
  const counts = { BA: s.members.filter((m) => m.kind === 'BA').length, PE: s.members.filter((m) => m.kind === 'PE').length };
  const byPlayer = s.members.filter((m) => m.by === 'player').length;
  const byScreen = s.members.filter((m) => m.by === 'screen').length;

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-5xl space-y-4">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>イーサリアムの黄金のアイコンを探せ（仮）· 6〜7 年目のイベント</span>
          <span className="flex gap-3"><Link href="/mente/game" className="underline">タイトルへ</Link><Link href="/mente" className="underline">Mente に戻る</Link></span>
        </p>
        <header className="border-b border-stone-200 pb-2">
          <h1 className="text-lg">瓶を拾う者たち — 増える BA と PE</h1>
          <p className="text-xs text-stone-600">アリミノガール（語り）：本土の浜では、瓶を拾う者がいつのまにか増えていた。誰が増やしたのか、浜の誰にも分からなかった。</p>
        </header>

        <section className="flex flex-wrap items-center gap-3 text-xs" aria-label="操作">
          <button type="button" data-testid="swarm-run" onClick={() => setRunning((r) => !r)} className="border border-[#1f1f1f] px-2 py-0.5">{running ? '⏸ 画面側の増殖を止める' : '▶ 画面側の増殖を動かす'}</button>
          <button type="button" onClick={() => { setS(newSwarm()); setPicked(null); setBoySays(null); }} className="border border-stone-400 px-2 py-0.5">最初から</button>
          <span data-testid="swarm-counts">浜：BA {counts.BA} · PE {counts.PE}（上限 {CAP}）</span>
          <span className="text-stone-600">浜にいるうち、増やしたのは：あなた ▲ {byPlayer} · 画面 ● {byScreen}</span>
        </section>
        <p className="text-[11px] text-stone-600">一匹を押すと、その仲間が増えます（BA は 1 匹ずつ、PE は 2 つずつ）。押さなくても、画面が {TICK_MS / 1000} 秒ごとに自分で増やします。名前は親の名前から keccak-256 で作る 16 進の 4 桁なので、どの名前も親を指しています。</p>

        <section className="flex flex-wrap gap-1.5 border border-stone-200 bg-[#fafaf9] p-2" aria-label="浜" data-testid="swarm-beach">
          {s.members.map((m) => (
            <button key={m.id} type="button" data-testid={`m-${m.id}`} onClick={() => tap(m)} title={`${KINDS[m.kind].name} · 第 ${m.gen} 世代`}
              className={`border bg-white px-1.5 py-0.5 text-[11px] ${reduce.current ? '' : 'swarm-in'}`}
              style={{ borderColor: picked === m.id ? '#c8001a' : COLOR[m.kind], color: COLOR[m.kind] }}>
              {m.id}<span className="ml-1 text-[9px] text-stone-500">{m.by === 'player' ? '▲' : m.by === 'screen' ? '●' : '◆'}</span>
            </button>
          ))}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="space-y-1 border border-stone-200 p-2 text-xs" aria-label="指紋の鎖" data-testid="swarm-lineage">
            <h2 className="font-semibold">名前の鎖（押した一匹から、最初の一匹まで）</h2>
            {picked ? <p className="break-all">{lineage(s, picked).join(' ← ')}</p> : <p className="text-stone-500">一匹を押すと、ここに鎖が出ます。</p>}
          </section>
          <section className="space-y-1 border border-stone-200 p-2 text-xs" aria-label="螺旋階段" data-testid="swarm-stairs">
            <h2 className="font-semibold">螺旋階段（音のない層）</h2>
            <p>浜があふれると、いちばん古い者の影が階段を登っていく。登った段数：<span className="font-semibold" data-testid="swarm-steps">？</span></p>
            {last && <p className="text-stone-600">眠っている水夫たちの寝言：「最後に登ったのは……{last.id}、だった気がする」</p>}
            <button type="button" data-testid="ask-boy" onClick={() => setBoySays(roughSteps(s.climbed.length))} className="border border-[#22b8c8] px-2 py-0.5">アリミノボーイに聞く</button>
            {boySays && <p data-testid="boy-says">アリミノボーイ：「{boySays}。正確には分からない。でも、（彼のモノ）を船で読んだから、だいたいは分かる」</p>}
          </section>
        </div>

        <p className="text-[11px] text-stone-600">BA と PE には値段がありません。売ることも、買うことも、換金することもできません。増えるのは名前と鎖だけです。</p>
        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          架空の物語です。登場する名前・鍵・指紋はすべて作りものです。実在の人物や作品のキャラクターを描くものではありません。<br />
          取引や暮らしのことでつらいときは、ひとりで抱えずに：よりそいホットライン 0120-279-338（24 時間・無料）／いのちの電話 0570-783-556
        </footer>
      </div>
      <style>{'.swarm-in{animation:swarm-in 400ms ease-out}@keyframes swarm-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'}</style>
    </main>
  );
}
