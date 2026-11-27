'use client';

import { useState } from 'react';
import { MANIFESTO, WORKS, type Work } from '@/lib/artCollective';

const GIRL = '#f29b30'; const GIRL2 = '#a9c62a'; const BOY = '#22b8c8'; const BOY2 = '#ece055'; const INK = '#1f1f1f';
const byColor = (w: Work) => (w.by === 'GIRL' ? GIRL : w.by === 'BOY' ? BOY : '#8a6fd1');

/** Small SVG artworks with slow, gentle motion (none with reduced motion). */
function Art({ id }: { id: string }) {
  const common = { viewBox: '0 0 160 110', className: 'h-full w-full' };
  switch (id) {
    case 'scissors': return (
      <svg {...common} aria-hidden><g transform="translate(40 55)">
        <g className="origin-[0px_0px] motion-safe:animate-[snipA_4s_ease-in-out_infinite]"><path d="M0 0 L100 -8 L100 -3 Z" fill="#c9ced6" stroke={INK} />{Array.from({ length: 10 }, (_, i) => <line key={i} x1={10 + i * 9} y1={-1 - i * 0.7} x2={10 + i * 9} y2={-5 - i * 0.7} stroke={INK} strokeWidth="0.7" />)}</g>
        <g className="origin-[0px_0px] motion-safe:animate-[snipB_4s_ease-in-out_infinite]"><path d="M0 0 L100 8 L100 3 Z" fill="#c9ced6" stroke={INK} />{Array.from({ length: 11 }, (_, i) => <line key={i} x1={10 + i * 8.2} y1={1 + i * 0.6} x2={10 + i * 8.2} y2={4 + i * 0.6} stroke={GIRL} strokeWidth="0.7" />)}</g>
        <circle r="5" fill={GIRL} stroke={INK} /><circle cx="-22" cy="-12" r="11" fill="none" stroke={GIRL} strokeWidth="4" /><circle cx="-22" cy="12" r="11" fill="none" stroke={GIRL2} strokeWidth="4" />
      </g></svg>);
    case 'comb': return (
      <svg {...common} aria-hidden><rect x="20" y="20" width="120" height="12" rx="3" fill={BOY} />{Array.from({ length: 30 }, (_, i) => <rect key={i} x={22 + i * 4} y="32" width="1.6" height="24" fill={BOY} />)}
        {['#ff3b3b', '#ff9a2e', '#ffe23b', '#4bd16b', '#3ba7ff', '#7a5cff'].map((c, i) => <path key={c} d={`M80 60 L${30 + i * 20} 100`} stroke={c} strokeWidth="3" className="motion-safe:animate-[glow_3s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.25}s` }} />)}<path d="M80 6 L80 60" stroke="#fff8" strokeWidth="2" /></svg>);
    case 'helix': return (
      <svg {...common} aria-hidden><g className="motion-safe:animate-[drift_6s_linear_infinite]">{Array.from({ length: 22 }, (_, i) => { const x = 8 + i * 7; const y1 = 55 + Math.sin(i * 0.6) * 30; const y2 = 55 - Math.sin(i * 0.6) * 30; return <g key={i}><line x1={x} y1={y1} x2={x} y2={y2} stroke={i % 10 === 0 ? INK : '#bbb'} strokeWidth={i % 10 === 0 ? 1.6 : 0.8} /><circle cx={x} cy={y1} r="2.6" fill={GIRL} /><circle cx={x} cy={y2} r="2.6" fill={BOY} /></g>; })}</g><text x="8" y="106" fontSize="7" fill={INK}>|— ひとまわり ≈ 3.4 nm（約 10.5 段）—|</text></svg>);
    case 'hair': return (
      <svg {...common} aria-hidden><circle cx="80" cy="60" r="40" fill="#fff" stroke={INK} />{Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (0.85 + i * 0.13); return <line key={i} x1={80 + Math.cos(a) * 34} y1={60 + Math.sin(a) * 34} x2={80 + Math.cos(a) * 40} y2={60 + Math.sin(a) * 40} stroke={INK} />; })}
        <g className="origin-[80px_60px] motion-safe:animate-[needle_5s_ease-in-out_infinite]"><line x1="80" y1="60" x2="80" y2="26" stroke={GIRL} strokeWidth="2" /></g><path d="M80 60 C 100 70, 120 40, 150 8" stroke="#5b3a1a" strokeWidth="1" fill="none" /><text x="58" y="96" fontSize="7">乾 ← 湿り気 → 湿</text></svg>);
    case 'dryer': return (
      <svg {...common} aria-hidden><rect x="14" y="40" width="46" height="26" rx="8" fill={BOY} /><rect x="26" y="64" width="12" height="30" rx="3" fill={BOY} />{[0, 1, 2, 3].map((i) => <path key={i} d={`M62 ${44 + i * 6} q 20 -6 40 0 t 40 0`} stroke="#ffb36b" strokeWidth="1.5" fill="none" className="motion-safe:animate-[flow_2.5s_linear_infinite]" style={{ animationDelay: `${i * 0.3}s` }} />)}<line x1="120" y1="30" x2="120" y2="80" stroke={BOY2} strokeWidth="2" /><text x="104" y="92" fontSize="7">熱線</text></svg>);
    case 'curler': return (
      <svg {...common} aria-hidden><rect width="160" height="110" fill="#eef3f7" />{[[40, 50, 10], [80, 60, 24], [120, 45, 40]].map(([x, y, r], i) => <path key={i} d={Array.from({ length: 40 }, (_, k) => { const a = k * 0.45; const rr = r * (1 - k / 50); return `${k ? 'L' : 'M'}${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr}`; }).join('')} fill="none" stroke={[GIRL, GIRL2, '#888'][i]} strokeWidth="1.4" strokeDasharray="2 1.5" />)}<text x="8" y="104" fontSize="7">軽いほど、きつく巻く（磁石の中）</text></svg>);
    case 'net': return (
      <svg {...common} aria-hidden><rect x="30" y="15" width="100" height="80" fill="none" stroke={INK} strokeWidth="3" />{Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={40 + i * 10} y1="18" x2={40 + i * 10} y2="92" stroke="#999" strokeWidth="0.6" />)}{Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="33" y1={25 + i * 10} x2="127" y2={25 + i * 10} stroke="#999" strokeWidth="0.6" />)}
        {Array.from({ length: 14 }, (_, i) => <circle key={i} cx="0" cy={10 + ((i * 37) % 90)} r="1.4" fill={i % 2 ? BOY : GIRL} className="motion-safe:animate-[pass_3s_linear_infinite]" style={{ animationDelay: `${(i * 0.21) % 3}s` }} />)}</svg>);
    case 'mirror': return (
      <svg {...common} aria-hidden><ellipse cx="34" cy="50" rx="16" ry="22" fill="#dfe9f2" stroke={INK} /><ellipse cx="126" cy="50" rx="16" ry="22" fill="#dfe9f2" stroke={INK} /><rect x="30" y="72" width="8" height="26" fill={GIRL} /><rect x="122" y="72" width="8" height="26" fill={GIRL2} />
        {[0, 1, 2].map((i) => <line key={i} x1="50" y1={44 + i * 6} x2="110" y2={44 + i * 6} stroke="#ff4d6d" strokeWidth="1.2" strokeDasharray="3 3" className="motion-safe:animate-[flow_3s_linear_infinite]" />)}<text x="52" y="104" fontSize="7">重なりで、ずれを読む</text></svg>);
    default: return (
      <svg {...common} aria-hidden><rect width="160" height="110" fill="#f4fbff" />{Array.from({ length: 22 }, (_, i) => <circle key={i} cx={10 + i * 6.8} cy={80 - i * 2.2 + Math.sin(i) * 3} r={1.5 + (i % 3)} fill="#fff" stroke={BOY} className="motion-safe:animate-[glow_4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.12}s` }} />)}<path d="M120 20 q 10 20 30 10" stroke={GIRL} strokeWidth="1.2" fill="none" /></svg>);
  }
}

function Member({ name, color, color2, line }: { name: string; color: string; color2: string; line: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="relative h-16 w-12 motion-safe:animate-[bob_3s_ease-in-out_infinite]" aria-hidden>
        <div className="absolute left-1 top-0 h-9 w-10 rounded-t-full" style={{ background: `linear-gradient(90deg, ${color} 50%, ${color2} 50%)` }} />
        <div className="absolute left-2.5 top-3 h-7 w-7 rounded-full bg-[#ffe3c7]" /><div className="absolute left-[14px] top-[18px] h-1 w-1 rounded-full bg-black" /><div className="absolute left-[25px] top-[18px] h-1 w-1 rounded-full bg-black" />
        <div className="absolute left-1.5 top-10 h-6 w-9 rounded-t-md bg-[#1f1f1f]" />
      </div>
      <p className="mb-6 max-w-xs rounded-xl border-2 bg-white px-2 py-1 text-[11px]" style={{ borderColor: color }}><b>{name}</b>：{line}</p>
    </div>
  );
}

export default function ArtCollective() {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'BOY' | 'GIRL' | 'BOY+GIRL'>('all');
  const shown = WORKS.filter((w) => filter === 'all' || w.by === filter);
  const cur = WORKS.find((w) => w.id === open);
  return (
    <main className="mx-auto max-w-5xl space-y-4 bg-[#f6f3ee] p-4 text-[#1f1f1f]">
      <style>{'@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}@keyframes snipA{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(-12deg)}}@keyframes snipB{0%,100%{transform:rotate(2deg)}50%{transform:rotate(12deg)}}@keyframes glow{0%,100%{opacity:.45}50%{opacity:1}}@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-14px)}}@keyframes needle{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(25deg)}}@keyframes flow{from{stroke-dashoffset:0}to{stroke-dashoffset:-24}}@keyframes pass{from{transform:translateX(0)}to{transform:translateX(160px)}}'}</style>
      <aside className="flex flex-wrap items-center gap-3 rounded-md border-2 border-[#1f1f1f] bg-white p-3 text-xs" data-testid="ibm-intro">
        <span className="rounded-sm bg-[#1f1f1f] px-1.5 py-0.5 font-mono text-[10px] text-white">IBM 量子キャンペーン · 導入</span>
        <span>2026-11-20（金）〜 12-17 の 28 日間。測る道具の展覧会から始めて、量子の実機で「測る」へ進む。</span>
        <span className="text-stone-500">11-20 布 ／ 11-26 髪の割り当て ／ 12-03 クレーターの角度 ／ 12-10 髪をもう一度 ／ 12-17 まとめ</span>
        <a href="/lab/spin" className="ml-auto rounded-sm border-2 border-[#1f1f1f] px-2 py-1 font-semibold" data-testid="to-campaign">キャンペーンへ進む →</a>
        <a href="/mente/game/black-bloom" className="rounded-sm border border-stone-400 px-2 py-1">黒い背景の花 →</a>
      </aside>

      <header className="space-y-2">
        <p className="text-xs tracking-[0.3em] text-stone-500">ART COLLECTIVE</p>
        <h1 className="text-3xl font-black tracking-tight"><span style={{ color: BOY }}>ARIMINOBOY</span><span className="text-stone-400">/</span><span style={{ color: GIRL }}>GIRL</span><span className="ml-2 align-middle text-xs font-normal text-stone-500">（仮）</span></h1>
        <p className="text-sm font-semibold">展覧会「測る道具、整える道具」</p>
        <div className="space-y-0.5 border-l-4 pl-3 text-sm" style={{ borderColor: GIRL }} data-testid="manifesto">{MANIFESTO.map((m) => <p key={m}>{m}</p>)}</div>
        <div className="flex flex-wrap gap-4">
          <Member name="ARIMINOGIRL" color={GIRL} color2={GIRL2} line="鋏も鏡も、もともと測る道具。わたしは、刃の内側に目盛りを刻む係。" />
          <Member name="ARIMINOBOY" color={BOY} color2={BOY2} line="ぼくは数え直す係。櫛の歯も、螺旋の段も、何度でも数える。" />
        </div>
        <p className="text-[11px] text-stone-500">アート集団の名前は仮（実在のヘアケアブランドと同じため、公開前に替える）。作品はゲームの中のアイデア。「本物の計測器」の欄だけが事実。</p>
      </header>

      <nav className="flex flex-wrap gap-1 text-xs">{(['all', 'GIRL', 'BOY', 'BOY+GIRL'] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} data-testid={`filter-${f}`} className="rounded-full border px-3 py-1" style={{ borderColor: filter === f ? INK : '#d6d3d1', background: filter === f ? 'white' : 'transparent' }}>{f === 'all' ? 'すべて' : f === 'BOY+GIRL' ? '共作' : f}</button>)}</nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="gallery">
        {shown.map((w) => (
          <button key={w.id} type="button" onClick={() => setOpen(w.id)} data-testid={`work-${w.id}`} className="group space-y-1 border-[10px] border-white bg-white text-left shadow-[0_2px_10px_#0002] outline outline-1 outline-stone-300">
            <div className="aspect-[16/11] bg-[#fbfaf7]"><Art id={w.id} /></div>
            <div className="px-1 pb-1">
              <p className="font-semibold">{w.title} <span className="text-[10px] font-normal italic text-stone-500">{w.en}</span></p>
              <p className="text-[10px]"><span className="mr-1 rounded-sm px-1 text-white" style={{ background: byColor(w) }}>{w.by === 'BOY+GIRL' ? '共作' : w.by}</span>{w.medium}</p>
              <p className="text-[11px] text-stone-600">測るもの：{w.measures}</p>
            </div>
          </button>))}
      </section>

      {cur && (
        <section className="grid gap-3 border-2 bg-white p-3 md:grid-cols-[1fr_1.2fr]" style={{ borderColor: byColor(cur) }} data-testid="detail">
          <div className="aspect-[16/11] bg-[#fbfaf7]"><Art id={cur.id} /></div>
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold">{cur.title} <span className="text-xs font-normal italic text-stone-500">{cur.en}</span></p>
            <p className="text-xs">作：{cur.by === 'BOY+GIRL' ? 'ARIMINOBOY と ARIMINOGIRL（共作）' : `ARIMINO${cur.by}`}・素材：{cur.medium}</p>
            <p><b>作家のことば</b>　{cur.statement}</p>
            <p className="rounded-sm bg-[#eef6fb] p-2 text-xs"><b>本物の計測器（事実）</b>　{cur.real}</p>
            <button type="button" onClick={() => setOpen(null)} className="min-h-[36px] border border-stone-400 px-3 text-xs">ギャラリーにもどる</button>
          </div>
        </section>)}
    </main>
  );
}
