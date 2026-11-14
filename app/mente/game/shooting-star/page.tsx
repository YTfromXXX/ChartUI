'use client';

import { useEffect, useRef, useState } from 'react';
import { ELEMENTS, ESSAY, PAPER, RULES, type Rule } from '@/lib/shootingStar';

type Meteor = { x: number; y: number; vx: number; vy: number; life: number; mix: number[]; seed: number };

/** 『流れ星に色規則を与える装置の魔法』: the device, (a) the fable, (b) the paper draft. */
export default function ShootingStar() {
  const [tab, setTab] = useState<'device' | 'fable' | 'paper'>('device');
  const [rule, setRule] = useState<Rule>('elements');
  const [scope, setScope] = useState(false); // look through the spectroscope: split each meteor into its lines
  const [last, setLast] = useState<number[] | null>(null);
  const ref = useRef<HTMLCanvasElement>(null); const live = useRef({ rule, scope }); live.current = { rule, scope };
  useEffect(() => {
    if (tab !== 'device') return undefined;
    const cv = ref.current; if (!cv) return undefined; const g = cv.getContext('2d')!; const W = cv.width; const H = cv.height;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stars = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.9, r: Math.random() * 1.2 + 0.2 }));
    const ms: Meteor[] = []; let raf = 0; let next = 30;
    const spawn = () => { const mix = ELEMENTS.map(() => Math.random()); const s = mix.reduce((a, b) => a + b, 0); const m = { x: Math.random() * W * 0.8 + W * 0.2, y: Math.random() * H * 0.3, vx: -(3 + Math.random() * 3), vy: 1.5 + Math.random() * 2, life: 1, mix: mix.map((v) => v / s), seed: Math.random() }; ms.push(m); setLast(m.mix); };
    const colorOf = (m: Meteor) => { const r = RULES[live.current.rule]; if (live.current.rule === 'elements') { const k = m.mix.indexOf(Math.max(...m.mix)); return r.colors[k]; } return r.colors[Math.floor(m.seed * r.colors.length)]; };
    const frame = () => {
      g.fillStyle = '#070b1a'; g.fillRect(0, 0, W, H);
      const grd = g.createLinearGradient(0, H * 0.75, 0, H); grd.addColorStop(0, '#070b1a00'); grd.addColorStop(1, '#1b2a4a'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffffffcc'; for (const s of stars) { g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill(); }
      next -= reduced ? 0.4 : 1; if (next <= 0) { spawn(); next = 70 + Math.random() * 90; }
      for (const m of ms) {
        m.x += m.vx * (reduced ? 0.4 : 1); m.y += m.vy * (reduced ? 0.4 : 1); m.life -= 0.012 * (reduced ? 0.4 : 1);
        const len = 70; const c = colorOf(m);
        if (live.current.scope && live.current.rule === 'elements') { // the spectroscope: one thin line per element, offset sideways
          ELEMENTS.forEach((e, k) => { if (m.mix[k] < 0.08) return; g.strokeStyle = e.color; g.globalAlpha = Math.max(0, m.life) * Math.min(1, m.mix[k] * 2.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(m.x + k * 3, m.y - k * 2); g.lineTo(m.x - m.vx * len / 6 + k * 3, m.y - m.vy * len / 6 - k * 2); g.stroke(); });
        } else {
          const tail = g.createLinearGradient(m.x, m.y, m.x - m.vx * len / 6, m.y - m.vy * len / 6); tail.addColorStop(0, c); tail.addColorStop(1, `${c}00`);
          g.strokeStyle = tail; g.globalAlpha = Math.max(0, m.life); g.lineWidth = 2.5; g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x - m.vx * len / 6, m.y - m.vy * len / 6); g.stroke();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(m.x, m.y, 1.8, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      }
      for (let i = ms.length - 1; i >= 0; i -= 1) if (ms[i].life <= 0) ms.splice(i, 1);
      raf = requestAnimationFrame(frame);
    };
    spawn(); raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, [tab]);
  const R = RULES[rule];
  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">サブストーリー · 司会者ミュウとルーペの少年期</p>
        <h1 className="text-xl font-bold">流れ星に色規則を与える装置の魔法</h1>
      </header>
      <nav className="flex flex-wrap gap-1 text-sm">{([['device', '🔭 装置'], ['fable', 'a. 寓話'], ['paper', 'b. 論文用']] as const).map(([k, l]) => <button key={k} type="button" data-testid={`tab-${k}`} onClick={() => setTab(k)} className="border px-3 py-1" style={{ borderColor: tab === k ? '#1f1f1f' : '#d6d3d1', background: tab === k ? 'white' : 'transparent', fontWeight: tab === k ? 600 : 400 }}>{l}</button>)}</nav>

      {tab === 'device' && (
        <section className="space-y-2" data-testid="device">
          <canvas ref={ref} width={720} height={360} className="w-full rounded-md" aria-label="夜空と流れ星" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(Object.keys(RULES) as Rule[]).map((k) => <button key={k} type="button" data-testid={`rule-${k}`} onClick={() => setRule(k)} className="border px-2 py-1" style={{ borderColor: rule === k ? '#1f1f1f' : '#d6d3d1', background: 'white' }}>{RULES[k].name}</button>)}
            <label className="flex items-center gap-1"><input type="checkbox" checked={scope} disabled={rule !== 'elements'} onChange={(e) => setScope(e.target.checked)} />分光器でのぞく（元素ごとの線に分ける）</label>
          </div>
          <p className="text-xs">{R.note}{!R.fact && '（ゲームの中の規則）'}</p>
          <div className="flex flex-wrap gap-2 text-[11px]">{rule === 'elements' ? ELEMENTS.map((e, k) => <span key={e.sym} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: e.color, outline: '1px solid #0003' }} />{e.el}（{e.sym}）{e.note}{last && <b className="ml-0.5">{Math.round(last[k] * 100)}%</b>}</span>) : R.colors.map((c) => <span key={c} className="inline-block h-3 w-8 rounded-sm" style={{ background: c }} />)}</div>
          <p className="text-[11px] text-stone-500">流れ星の色は、燃えた物質の光で決まる（色の割合はおおまかな目安）。最後に流れた星の成分を % で表示している。点滅はなく、動きを減らす設定ではゆっくり流れる。</p>
        </section>)}

      {tab === 'fable' && (
        <article className="space-y-3 border border-stone-300 bg-white p-4" data-testid="fable">
          <p className="text-[11px] text-stone-500">{ESSAY.re}</p>
          <h2 className="text-lg font-semibold">{ESSAY.title}</h2>
          <p className="text-xs text-stone-500">{ESSAY.by}</p>
          {ESSAY.body.map((p) => <p key={p} className="text-sm leading-7">{p}</p>)}
        </article>)}

      {tab === 'paper' && (
        <article className="space-y-3 border border-stone-300 bg-white p-4 font-serif" data-testid="paper">
          <h2 className="text-lg font-semibold">{PAPER.title}</h2>
          <p className="text-sm">{PAPER.sub}</p>
          <p className="text-xs text-stone-500">{PAPER.authors}</p>
          <div className="border-l-4 border-stone-400 pl-3 text-sm"><b>要旨</b>　{PAPER.abstract}</div>
          {PAPER.sections.map((s) => (
            <section key={s.h} className="space-y-1">
              <h3 className="font-semibold">{s.h} <span className="rounded-sm border px-1 font-sans text-[10px]" style={{ borderColor: s.fact ? '#2f6b1a' : '#7a5c12', color: s.fact ? '#2f6b1a' : '#7a5c12' }}>{s.fact ? '事実' : 'ゲームの中'}</span></h3>
              {s.p.map((x) => <p key={x} className="text-sm leading-7">{x}</p>)}
            </section>))}
          <section className="space-y-1 text-xs"><h3 className="font-semibold">文献（引用の前に確かめる）</h3><ol className="list-inside list-decimal space-y-0.5">{PAPER.refs.map((r) => <li key={r}>{r}</li>)}</ol></section>
        </article>)}
    </main>
  );
}
