'use client';

import { useState } from 'react';
import { BEATS, CAST, DECISION, ORDER, SEATS, START, ending, fill, hiddenAt, place, type CastKey, type Decision, type Seat } from '@/lib/flightStory';
import { TOTAL_BEATS } from '@/lib/story200';

const INK = '#1f1f1f';

/** Sub-event "空の最後の輪": beats 184–200 of the 200 [ABCD] package, with the finder assistant ルーペ（仮）. */
export default function AutopilotStory() {
  const [k, setK] = useState(0);
  const [at, setAt] = useState<Record<Seat, CastKey>>(START);
  const [found, setFound] = useState<number[]>([]);
  const [hint, setHint] = useState(false);
  const [miss, setMiss] = useState(-1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const beat = BEATS[k]; const last = beat.n === 200;
  const go = (line: string) => { setLog((l) => [...l, `${beat.n}：${line}`]); setK((x) => x + 1); setHint(false); setMiss(-1); };
  const choose = (who: CastKey) => { const next = place(at, beat.seat, who); setAt(next); go(fill(beat.pick, next).replace('{name}', CAST[who].name)); };
  const decide = (d: Decision) => { setDecision(d); go(DECISION.find((x) => x.key === d)!.label); };
  const end = last ? ending(at, decision ?? 'land', found.length) : null;
  const restart = () => { setK(0); setAt(START); setFound([]); setDecision(null); setLog([]); setHint(false); };
  const colored = (s: string) => fill(s, at).split(new RegExp(`(${Object.values(CAST).map((c) => c.name).join('|')})`)).map((part, i) => { const c = Object.values(CAST).find((x) => x.name === part); return c ? <b key={i} style={{ color: c.color }}>{part}</b> : <span key={i}>{part}</span>; });

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">200［ABCD］· 12 年目の中のサブイベント · 拍 {beat.n} / {TOTAL_BEATS}</p>
        <h1 className="text-xl font-bold">空の最後の輪 — ルーペと一緒に、着陸してみる</h1>
        <p className="text-[11px] text-stone-500">文章は変わらない。変わるのは、誰がどの席にいるかだけ。A〜D でその拍の席に一人を座らせ（座っていた人と入れ替わる）、最後の席順と一つの決断で、六つの終わりのどれかになる。</p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="seats">
        {(Object.keys(SEATS) as Seat[]).map((s) => (
          <div key={s} className="rounded-sm p-2 text-xs text-white" style={{ background: INK, outline: s === beat.seat && !last ? '3px solid #fff27a' : undefined }}>
            <p className="text-[10px] text-[#aaa]">{SEATS[s]}</p>
            <p className="font-semibold" style={{ color: CAST[at[s]].color }} data-testid={`seat-${s}`}>{CAST[at[s]].name}</p>
          </div>))}
      </section>

      {!last ? (
        <section className="space-y-3 border border-stone-300 bg-white p-3" data-testid="beat">
          <p className="text-xs"><span className="mr-2 rounded-sm bg-black px-1.5 font-bold italic text-white">MENTE</span>{beat.mente}</p>
          <p className="text-[11px] text-stone-500">拍 {beat.n}・{beat.phase}{beat.fly && <> · <a href="/mente/game/cockpit" className="underline">操縦席で実際に飛ぶ →</a></>}</p>
          <div className="space-y-1 text-sm">{beat.text.map((t) => <p key={t}>{colored(t)}</p>)}</div>

          <div className="space-y-1 rounded-sm bg-[#eef6fb] p-2 text-xs" data-testid="lupe">
            <p><span aria-hidden>🔍</span> <b>ルーペ（仮）</b>：一緒に、黄金のアイコンの欠片を探してみよう。{hint && <span data-testid="lupe-hint">ヒント：{beat.lupe}</span>}</p>
            <div className="flex flex-wrap gap-1">{Array.from({ length: 12 }, (_, c) => {
              const hit = found.includes(beat.n) && c === hiddenAt(beat.n);
              return <button key={c} type="button" data-testid={`cell-${c}`} onClick={() => { if (found.includes(beat.n)) return; if (c === hiddenAt(beat.n)) setFound((f) => [...f, beat.n]); else setMiss(c); }} className="h-9 w-9 rounded-sm border border-[#86bce8] bg-white text-base" style={{ outline: hint && Math.abs(c - hiddenAt(beat.n)) <= 2 ? '2px dashed #f29b30' : undefined }} aria-label={`雲 ${c + 1}`}>{hit ? '✦' : miss === c ? '·' : '☁️'}</button>;
            })}</div>
            <div className="flex gap-2"><button type="button" onClick={() => setHint(true)} className="border border-stone-400 bg-white px-2">ルーペに聞く</button><span>欠片 {found.length}</span></div>
          </div>

          {beat.decision ? (
            <div className="grid gap-1 sm:grid-cols-2">{DECISION.map((d) => <button key={d.key} type="button" data-testid={`decide-${d.key}`} onClick={() => decide(d.key)} className="min-h-[44px] border-2 border-black bg-white px-2 text-left text-sm">{d.label}{d.note && <span className="block text-[10px] text-stone-500">{d.note}</span>}</button>)}</div>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">{ORDER.map((who, i) => <button key={who} type="button" data-testid={`pick-${'ABCD'[i]}`} onClick={() => choose(who)} className="min-h-[44px] border-2 bg-white px-2 text-left text-sm" style={{ borderColor: CAST[who].color }}>{'ABCD'[i]}. {beat.pick.replace('{name}', CAST[who].name)}{at[beat.seat] === who && <span className="text-[10px] text-stone-500">（いまの席のまま）</span>}</button>)}</div>
          )}
        </section>
      ) : end && (
        <section className="space-y-2 border-2 border-black bg-white p-3 shadow-[4px_4px_0_#0003]" data-testid="ending">
          <p className="inline-block bg-black px-1.5 text-[10px] font-bold italic text-white">MENTE · 拍 200 · 終わり {end.id}</p>
          <p className="text-lg font-semibold">{end.title}</p>
          {end.text.map((t) => <p key={t} className="text-sm">{colored(t)}</p>)}
          <p className="text-[11px] text-stone-500">終わりは六つ（E1 フォンの帰還・E2 数え直しの着陸・E3 語り手が降ろした日・E4 十二年目の着陸・E5 十三年目の輪・E6 やり直しの空）。席を入れ替えて、もう一度。</p>
          <button type="button" data-testid="restart" onClick={restart} className="min-h-[44px] border-2 border-black bg-white px-4">拍 184 からもう一度</button>
        </section>
      )}

      {log.length > 0 && <details className="text-[11px] text-stone-600"><summary>ここまでの選択（{log.length}）</summary><ol className="list-inside list-decimal">{log.map((l) => <li key={l}>{l}</li>)}</ol></details>}
    </main>
  );
}
