'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { COLOUR_DICE, contrastHex } from '@/lib/faceContour';
import { PALETTES } from '@/lib/skyPalettes';
import type { DropResult } from '@/components/cloud/SkewerScene';

const SkewerScene = dynamic(() => import('@/components/cloud/SkewerScene'), { ssr: false });

const INK = '#1f1f1f'; const PANEL = '#26282b'; const WARN = '#c8001a';
const GIRL = COLOUR_DICE[2].start.map((k) => COLOUR_DICE[2].faces[k]); // アリミノガール（仮）：オレンジ + 黄緑
const BOY = COLOUR_DICE[3].start.map((k) => COLOUR_DICE[3].faces[k]); // アリミノボーイ（仮）：シアン + 黄

const RULES: [string, string][] = [
  ['色の意味は一つずつ', `オレンジ＝機長席の入力（アリミノガール）、シアン＝副操縦士席の入力（アリミノボーイ）、赤＝警告だけ、白＝読む値。`],
  ['明るい色は墨の上', '明るい色は、必ず墨のタイルの上に置く（コントラスト 3：1 以上）。文字は 4.5：1 以上。'],
  ['手袋の指で届く', 'つまみ・ボタン・つまむ泡は 44px 以上。サイコロの目は、少し外れても拾う（ゆとり 6px）。'],
  ['光らない・揺れない', '計器の外は動かさない。点滅しない。ドリーズームは自動を切り、手で動かす。'],
  ['両側から読める', '中央の計器は、左右どちらの席からも斜めに読める位置に。ラベルは計器の下、同じ高さ。'],
  ['ねじが見える', '四隅のねじと型番の札：交換できる部品であることが、見て分かる。'],
];

function Screw({ x, y }: { x: string; y: string }) {
  return <span className="absolute h-2.5 w-2.5 rounded-full border border-[#555] bg-[#8a8a8a]" style={{ left: x, top: y, boxShadow: 'inset 0 0 0 1px #0004' }}><span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 rotate-45 bg-[#333]" /></span>;
}

function SidePlate({ who, cols, side }: { who: string; cols: { hex: string; name: string }[]; side: 'L' | 'R' }) {
  return (
    <div className="space-y-2 rounded-sm p-2 text-[10px] text-white" style={{ background: INK }} data-testid={`seat-${side}`}>
      <p className="font-semibold tracking-wide">{side === 'L' ? '機長席' : '副操縦士席'}・{who}</p>
      <div className="flex gap-1.5">{cols.map((c) => (
        <div key={c.hex} className="flex-1 space-y-0.5">
          <div className="h-11 min-w-[44px] rounded-sm border border-[#000]" style={{ background: c.hex, boxShadow: 'inset 0 -6px 0 #0002' }} />
          <p>{c.name} <span className="font-mono text-[#bbb]">{c.hex}</span></p>
          <p className="text-[#bbb]">墨との比 {contrastHex(c.hex, INK).toFixed(1)}：1</p>
        </div>))}</div>
      <div className="flex items-center gap-2"><span className="inline-block h-11 w-11 rounded-full border-2" style={{ borderColor: cols[0].hex, background: `radial-gradient(circle at 40% 35%, #444, ${INK})` }} /><span>入力のつまみ（{cols[0].name}の縁）</span></div>
    </div>
  );
}

/** Meta view into the cockpit: the dice indicator becomes a centre-panel instrument. Bottom: reserved for flight parameters. */
export default function Cockpit() {
  const [inside, setInside] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [checks, setChecks] = useState(0);
  const [last, setLast] = useState<DropResult | null>(null);
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const onDrop = useCallback((r: DropResult) => { setLast(r); if (r.kind === 'perfect') setChecks((c) => c + 1); }, []);
  const sky = PALETTES[0];

  return (
    <main className="mx-auto max-w-4xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">メタ視点 → コックピット</p>
        <h1 className="text-xl font-bold">串の姿勢計を、運転席の計器へ</h1>
        <p className="text-sm">雲の上の飛行機に、外から近づいて、操縦席に入る。サイコロの指示器は、中央の計器「IND-01 串の姿勢計」になる。色はアリミノガール（機長席）とアリミノボーイ（副操縦士席）の決まりで塗り分ける。</p>
        <p className="text-[11px] text-stone-500">アリミノガール・アリミノボーイは仮の名前（公開前に、オリジナルの名前へ替える）。</p>
      </header>

      {!inside ? (
        <section className="space-y-2" data-testid="meta">
          <svg viewBox="0 0 600 240" className="w-full rounded-sm" role="img" aria-label="メタ視点：飛行機の機首の断面">
            <defs><linearGradient id="msky" x1="0" y1="0" x2="0" y2="1">{sky.sky.map((c, k) => <stop key={c} offset={k / (sky.sky.length - 1)} stopColor={c} />)}</linearGradient></defs>
            <rect width="600" height="240" fill="url(#msky)" />
            {[[90, 190, 1], [460, 200, 1.4], [300, 215, 1.1]].map(([x, y, s]) => <g key={x} fill="#fff" opacity="0.9">{[[0, 0, 22], [26, -10, 26], [54, 0, 22]].map(([dx, dy, r]) => <circle key={dx} cx={x + dx * s} cy={y + dy * s} r={r * s} />)}</g>)}
            <path d="M40 120 Q60 80 160 78 L520 78 Q560 80 560 120 Q560 160 520 162 L160 162 Q60 160 40 120 Z" fill="#f4f6f8" stroke={INK} strokeWidth="3" />
            <path d="M70 104 Q90 84 150 82 L150 110 Q110 112 70 104 Z" fill="#2b3a67" opacity="0.85" />
            <rect x="96" y="112" width="70" height="40" rx="4" fill={PANEL} stroke={WARN} strokeWidth="2" strokeDasharray="4 3" />
            <text x="131" y="136" textAnchor="middle" fontSize="11" fill="#fff">操縦席</text>
            {Array.from({ length: 9 }, (_, k) => <rect key={k} x={200 + k * 36} y="94" width="18" height="14" rx="3" fill="#86bce8" stroke={INK} />)}
            <path d="M300 162 L250 222 L330 222 L360 162 Z" fill="#dfe5ea" stroke={INK} strokeWidth="2" />
            <text x="300" y="40" textAnchor="middle" fontSize="13" fill="#fff">メタ視点：機首を断面で見ている（赤い点線が、これから入る場所）</text>
          </svg>
          <button type="button" data-testid="enter" onClick={() => setInside(true)} className="min-h-[44px] border-2 border-black bg-white px-4 font-semibold">操縦席に潜入する →</button>
        </section>
      ) : (
        <section className="space-y-0 overflow-hidden rounded-sm border-4" style={{ borderColor: INK }} data-testid="cockpit">
          {/* windshield */}
          <div className="relative h-28" style={{ background: `linear-gradient(${sky.sky.join(',')})` }}>
            <div className="absolute inset-y-0 left-1/3 w-3 -skew-x-12" style={{ background: INK }} />
            <div className="absolute inset-y-0 right-1/3 w-3 skew-x-12" style={{ background: INK }} />
            <p className="absolute bottom-1 left-2 text-[10px] text-white/90">風防：写実の空（天頂 {sky.sky[0]} → 地平 {sky.sky[4]}）</p>
          </div>
          {/* glare shield */}
          <div className="h-4" style={{ background: INK, boxShadow: '0 4px 0 #0005' }} />
          {/* main panel */}
          <div className="grid gap-3 p-3 md:grid-cols-[1fr_2fr_1fr]" style={{ background: PANEL }}>
            <SidePlate who="アリミノガール（仮）" cols={GIRL} side="L" />
            <div className="relative rounded-md border-4 p-3" style={{ borderColor: '#3a3d42', background: INK }} data-testid="ind-01">
              <Screw x="4px" y="4px" /><Screw x="calc(100% - 14px)" y="4px" /><Screw x="4px" y="calc(100% - 14px)" /><Screw x="calc(100% - 14px)" y="calc(100% - 14px)" />
              <SkewerScene opts={{ palette: sky, mode: 'bubble', p: 2, q: 3, dolly: 0.35, auto: false, reduced, onDrop }} />
              <div className="mt-2 flex items-center justify-between text-[10px] text-white">
                <span className="rounded-sm bg-[#3a3d42] px-1.5 py-0.5 font-mono tracking-widest">IND-01　串の姿勢計</span>
                <span>確認の印 <b data-testid="checks">{checks}</b>{last && last.kind !== 'perfect' ? '（もう少し目の中心へ）' : ''}</span>
              </div>
              <p className="mt-1 text-[10px] text-[#bbb]">泡をつまんでサイコロの目へ：目が染まれば「確認の印」。左右どちらの席からも届く位置。</p>
            </div>
            <SidePlate who="アリミノボーイ（仮）" cols={BOY} side="R" />
          </div>
          {/* bottom: reserved for flight parameters */}
          <div className="space-y-1 p-3" style={{ background: INK }} data-testid="flight-params">
            <p className="text-[11px] font-semibold text-white">操縦パラメーター（下部・次の作業で設計）</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{Array.from({ length: 8 }, (_, k) => (
              <div key={k} className="flex min-h-[56px] items-center justify-center rounded-sm border border-dashed text-[10px] text-[#888]" style={{ borderColor: k < 4 ? GIRL[0].hex : BOY[0].hex }}>◻︎ {k + 1}</div>))}</div>
            <p className="text-[10px] text-[#999]">1〜4 は機長席の側（オレンジの縁）、5〜8 は副操縦士席の側（シアンの縁）。中身はまだ空。</p>
          </div>
        </section>
      )}

      <section className="space-y-1 text-xs" data-testid="id-rules">
        <p className="font-semibold">インダストリアルデザインの要件（この計器の実用性）</p>
        <ul className="grid gap-1 sm:grid-cols-2">{RULES.map(([h, b]) => <li key={h} className="border border-stone-300 bg-white p-2"><b>{h}</b>：{b}</li>)}</ul>
      </section>
    </main>
  );
}
