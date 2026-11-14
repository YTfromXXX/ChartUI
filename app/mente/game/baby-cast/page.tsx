'use client';

import { useEffect, useMemo, useState } from 'react';
import { makeCharacter, sameCharacter, type Character } from '@/lib/babyCast';
import { MU, PICKABLE, contrastOnBlack, GOLDEN } from '@/lib/colorRules';
import { STRAINS } from '@/lib/museum';

const BG = '#0a0a0a'; const PANEL = '#161514'; const TEXT = '#f4f1ec'; const SUB = '#a8a29e'; const LINE = '#2a2826';
const SEEDS = [2911, 9203, 2947, 9281, 2963, 9227];
const DEFAULT_FOUR = [MU.strain29.hex, MU.strain92.hex, GOLDEN[0].hex, MU.bud.hex]; // restart from ミュウの規則: its two strains, the golden icon, and the bud's white

function BabySvg({ c, measured }: { c: Character; measured: boolean }) {
  return (
    <svg viewBox="-50 -50 100 100" className="h-24 w-24" aria-hidden>
      {c.baby.paths.map((p, i) => {
        const d = Array.from({ length: 20 }, (_, k) => { const t = k / 19; const a = p.a + p.curl * t * 2.5; const r = t * 42; return `${k ? 'L' : 'M'}${Math.cos(a) * r} ${Math.sin(a) * r}`; }).join('');
        const chosen = i === c.baby.chosen;
        return <path key={i} d={d} fill="none" stroke={measured ? (chosen ? STRAINS[c.strain].color : '#ffffff14') : '#ffffff55'} strokeWidth={measured && chosen ? 2.5 : 1} strokeDasharray={measured && !chosen ? '2 3' : undefined} />;
      })}
      <circle r="3.5" fill="#fff1b8" />
    </svg>
  );
}

function Figure({ c, measured }: { c: Character; measured: boolean }) {
  const l = measured ? c.left : MU.bud.hex; const r = measured ? c.right : MU.bud.hex;
  return (
    <div className="relative h-20 w-14" aria-hidden>
      <div className="absolute left-0.5 top-0 h-11 w-13 rounded-t-full" style={{ width: 52, background: `linear-gradient(90deg, ${l} 50%, ${r} 50%)` }} />
      <div className="absolute left-3 top-4 h-8 w-8 rounded-full bg-[#ffe3c7]" style={{ opacity: measured ? 1 : 0.35 }} />
      {measured && <><div className="absolute left-[18px] top-[30px] h-1 w-1 rounded-full bg-black" /><div className="absolute left-[30px] top-[30px] h-1 w-1 rounded-full bg-black" /></>}
      <div className="absolute left-2 top-12 h-8 w-10 rounded-t-md" style={{ background: measured ? STRAINS[c.strain].color : '#333' }} />
    </div>
  );
}

export default function BabyCast() {
  const [four, setFour] = useState<string[]>(DEFAULT_FOUR);
  const [measured, setMeasured] = useState<number[]>([]);
  const [cast, setCast] = useState<number[]>([]);
  const [restarted, setRestarted] = useState(false);
  const chars = useMemo(() => SEEDS.map((s) => makeCharacter(s, four)), [four]);
  // default cast: the first 29 種 and the first 92 種 (after measuring)
  useEffect(() => { setRestarted(false); }, [four]);
  const measureAll = () => { setMeasured(SEEDS); const c29 = chars.find((c) => c.strain === 29); const c92 = chars.find((c) => c.strain === 92); setCast([c29, c92].filter(Boolean).map((c) => c!.seed)); };
  const toggleColor = (h: string) => setFour((f) => (f.includes(h) ? (f.length > 1 ? f.filter((x) => x !== h) : f) : f.length < 4 ? [...f, h] : f));
  const toggleCast = (seed: number) => setCast((c) => (c.includes(seed) ? c.filter((x) => x !== seed) : c.length < 2 ? [...c, seed] : [c[1], seed]));
  const checks = [
    { ok: SEEDS.every((s) => sameCharacter(s, four)), text: '同じ種から、いつも同じキャラクターが生まれる（6 / 6）' },
    { ok: chars.every((c) => four.includes(c.left) && four.includes(c.right)), text: '髪の色は、選んだ 4 色の中からだけ' },
    { ok: four.every((h) => contrastOnBlack(h) >= 3), text: `4 色とも黒の背景に 3：1 以上（${four.map((h) => contrastOnBlack(h).toFixed(1)).join('・')}）` },
    { ok: chars.some((c) => c.strain === 29) && chars.some((c) => c.strain === 92), text: `測ると 29 種と 92 種の両方が出る（29 種 ${chars.filter((c) => c.strain === 29).length}・92 種 ${chars.filter((c) => c.strain === 92).length}）` },
  ];
  const restart = () => { try { localStorage.setItem('mente-cast', JSON.stringify({ cast, four })); } catch { /* storage may be unavailable */ } setRestarted(true); };
  const picked = chars.filter((c) => cast.includes(c.seed));

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4" style={{ background: BG, color: TEXT }}>
      <header className="space-y-1">
        <p className="text-xs" style={{ color: SUB }}>MENTE · ミュウの規則から再開する</p>
        <h1 className="text-xl font-bold">ベイベーから、キャラクターが生まれる</h1>
        <p className="text-sm" style={{ color: SUB }}>① クオンタムベイベー（一点から出る経路の束）→ ② ミュウの規則で測る（束が一本になり、左に巻けば 29 種、右に巻けば 92 種）→ ③ 選んだ 4 色から左右の髪の色 → ④ 名前・性格・ひとこと。同じ種からは、いつも同じキャラクター。</p>
      </header>

      <section className="space-y-2 rounded-md border p-3 text-xs" style={{ borderColor: LINE, background: PANEL }} data-testid="four">
        <p className="font-semibold">4 色を選ぶ（いま {four.length} / 4）</p>
        <div className="flex flex-wrap gap-2">{PICKABLE.map((s) => <button key={s.hex} type="button" data-testid={`col-${s.hex.slice(1)}`} onClick={() => toggleColor(s.hex)} className="flex items-center gap-1 rounded-sm border px-2 py-1" style={{ borderColor: four.includes(s.hex) ? s.hex : LINE }}><span className="inline-block h-4 w-4 rounded-full" style={{ background: s.hex }} />{s.name}{four.includes(s.hex) && ' ✓'}</button>)}</div>
        <p style={{ color: SUB }}>はじめの 4 色：ミュウの規則の二色（29 種の水色・92 種の橙）、黄金のアイコンの黄金、測る前のつぼみの白。</p>
      </section>

      <section className="space-y-2" data-testid="candidates">
        <div className="flex items-center gap-2"><p className="text-sm font-semibold">候補（6 つの種）</p><button type="button" data-testid="measure-all" onClick={measureAll} className="rounded-sm border-2 px-3 py-1 text-xs font-semibold" style={{ borderColor: MU.strain29.hex }}>全部を測る</button></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{chars.map((c) => { const m = measured.includes(c.seed); const on = cast.includes(c.seed); return (
          <div key={c.seed} className="flex gap-2 rounded-md border p-2 text-xs" style={{ borderColor: on ? '#fff1b8' : LINE, background: PANEL }} data-testid={`cand-${c.seed}`}>
            <BabySvg c={c} measured={m} /><Figure c={c} measured={m} />
            <div className="flex-1 space-y-0.5">
              <p className="font-mono text-[10px]" style={{ color: SUB }}>種 {c.seed}</p>
              {m ? <><p className="text-sm font-semibold">{c.name} <span className="rounded-sm px-1 text-[10px] text-black" style={{ background: STRAINS[c.strain].color }}>{STRAINS[c.strain].name}</span></p><p>{c.trait}</p><p style={{ color: SUB }}>「{c.line}」</p>
                <button type="button" data-testid={`pick-${c.seed}`} onClick={() => toggleCast(c.seed)} className="mt-1 rounded-sm border px-2 py-0.5" style={{ borderColor: on ? '#fff1b8' : LINE }}>{on ? '選んだ ✓' : 'この人を選ぶ'}</button></>
                : <><p style={{ color: SUB }}>まだ測っていない（白いつぼみ）</p><button type="button" onClick={() => setMeasured((x) => [...x, c.seed])} className="rounded-sm border px-2 py-0.5" style={{ borderColor: LINE }}>測る</button></>}
            </div>
          </div>); })}</div>
      </section>

      <section className="space-y-1 rounded-md border p-3 text-xs" style={{ borderColor: LINE, background: PANEL }} data-testid="verify">
        <p className="font-semibold">処理の確認</p>
        {checks.map((k) => <p key={k.text}>{k.ok ? '✓' : '✗'} {k.text}</p>)}
      </section>

      <section className="space-y-2 rounded-md border-2 p-3" style={{ borderColor: '#fff1b8' }} data-testid="restart">
        <p className="text-sm font-semibold">再開する二人：{picked.length ? picked.map((c) => `${c.name}（${STRAINS[c.strain].name}）`).join(' と ') : 'まだ選んでいない'}</p>
        <button type="button" data-testid="restart-go" disabled={picked.length !== 2} onClick={restart} className="min-h-[40px] rounded-sm border-2 px-4 font-semibold disabled:opacity-40" style={{ borderColor: '#fff1b8', color: '#fff1b8' }}>この二人と 4 色で再開する</button>
        {restarted && picked.length === 2 && (
          <div className="space-y-1 text-sm" data-testid="restart-scene">
            <p className="inline-block bg-white px-1.5 text-[10px] font-bold italic text-black">MENTE · 再開</p>
            <p>黒い背景に、白いつぼみが二つ。測った瞬間、<b style={{ color: picked[0].left }}>{picked[0].name}</b>は{STRAINS[picked[0].strain].name}に、<b style={{ color: picked[1].left }}>{picked[1].name}</b>は{STRAINS[picked[1].strain].name}になった。</p>
            <p>「{picked[0].line}」と{picked[0].name}。{picked[1].name}は少し考えてから、「{picked[1].line}」と言った。</p>
            <p style={{ color: SUB }}>二人の髪には、選ばれた 4 色が左右に分かれて入っている。物語は、ミュウの規則のところから、もう一度始まる。</p>
          </div>)}
      </section>
    </main>
  );
}
