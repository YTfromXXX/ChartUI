'use client';

import { useState } from 'react';
import type { Filter } from '@/lib/chessGame3';
import { BIG, BLOOD_QUIZ, VEIN } from '@/lib/bloodline';
import { MENTE_CARDS } from '@/lib/menteCards';

const BLOOD = '#8b0000';
const KIND_COLOR = { vein: BLOOD, quantum: '#2b3a67', fiction: '#7a5c00', chart: '#1f1f1f' } as const;

/** Sub-mission "サトシとトトシ": the cypherpunk vein beside the big holder's chart, year by year. */
export default function Bloodline() {
  const years = Array.from(new Set([...VEIN.map((v) => v.year), ...BIG.map((b) => b.year)])).sort((a, b) => a - b);
  const [answers, setAnswers] = useState<Record<number, Filter>>({});
  const solved = BLOOD_QUIZ.every((q, k) => answers[k] === q.filter);
  const card = MENTE_CARDS[6];
  return (
    <main className="mx-auto max-w-4xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">サブミッション</p>
        <h1 className="text-xl font-bold">サトシとトトシ — 血脈とドルの山</h1>
        <p className="text-sm">左は、サイファーパンクから鎖へ流れる血脈と、量子計算機の試練、そしてゲームの中のサンクチュアリ構想。右は、トトシ中元（ドルを積む、架空の大口）が見たチャート。同じ年を、横に並べて読む。</p>
        <p className="text-[11px] text-stone-500">年のついた出来事は公開の記録の大筋。トトシは架空の人物で、実在の投資家ではない。投資の助言ではない。</p>
      </header>

      <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-3 text-xs" data-testid="bloodline">
        <div /><p className="font-semibold" style={{ color: BLOOD }}>🩸 血脈（サトシの側）</p><p className="font-semibold">💵 トトシ中元（大口の側）</p>
        {years.map((y) => (
          <div key={y} className="contents">
            <p className="pt-2 font-mono text-stone-500">{y}</p>
            <div className="border-l-4 py-1 pl-2" style={{ borderColor: BLOOD }}>
              {VEIN.filter((v) => v.year === y).map((v) => (
                <div key={v.title} className="mb-1" data-testid="vein">
                  <p className="font-semibold" style={{ color: KIND_COLOR[v.kind] }}>{v.kind === 'quantum' ? '⚛ ' : v.kind === 'fiction' ? '◇ ' : '● '}{v.title}</p>
                  <p>{v.body}</p>
                </div>))}
            </div>
            <div className="border-l border-stone-300 py-1 pl-2">
              {BIG.filter((b) => b.year === y).map((b) => (
                <div key={b.title} className="mb-1" data-testid="big">
                  <p className="font-semibold" style={{ color: KIND_COLOR[b.kind] }}>{b.kind === 'fiction' ? '◇ ' : '▲ '}{b.title}</p>
                  <p>{b.body}</p>
                </div>))}
            </div>
          </div>))}
      </div>

      <section className="space-y-2 border border-stone-400 bg-white p-3 text-sm" data-testid="blood-quiz">
        <p className="font-semibold">ミッション：三つの声を、正しいフィルターに通す</p>
        {BLOOD_QUIZ.map((q, k) => (
          <div key={q.text} className="space-y-1">
            <p>「{q.text}」</p>
            <div className="flex gap-1 text-xs">{(['事実', '噂', '感情'] as Filter[]).map((f) => (
              <button key={f} type="button" data-testid={`q${k}-${f}`} onClick={() => setAnswers((a) => ({ ...a, [k]: f }))} className="border px-2" style={{ borderColor: answers[k] === f ? BLOOD : '#a8a29e', background: answers[k] === f ? '#fff1f2' : 'white' }}>{f}</button>))}
              {answers[k] && <span className={answers[k] === q.filter ? 'text-[#2f6b1a]' : 'text-[#c8001a]'}>{answers[k] === q.filter ? '○' : '×'}</span>}
            </div>
          </div>))}
      </section>

      {solved && (
        <div className="space-y-1 border-2 border-black bg-white p-3 text-xs shadow-[4px_4px_0_#0003]" data-testid="card7">
          <p className="inline-block bg-black px-1.5 text-[10px] font-bold italic text-white">MENTE · 公開 · {card.tag}</p>
          <p className="font-semibold">{card.title}</p>
          {card.body.map((b) => <p key={b}>{b}</p>)}
        </div>)}

      <section className="space-y-1 text-xs" data-testid="script-note">
        <p className="font-semibold">血脈のシェルスクリプト</p>
        <p>リポジトリの <code>scripts/bloodline.sh</code> を端末で動かすと、上の血脈が一行ずつ、前の行の指紋（SHA-256）を抱いて流れる。鎖の考え方だけをまねたゲームの台本で、サトシのコード（C++）の写しではない。最後に、量子の試練（ハッシュは残り、署名は移る）を通る。</p>
      </section>
    </main>
  );
}
