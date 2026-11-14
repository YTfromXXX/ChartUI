'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import FibWheel from '@/components/flight/FibWheel';
import type { DropKind } from '@/components/flight/SkyFlight';
import { PARTS } from '@/lib/cockpitParts';
import { autopilot, contrailLikely, deg, initialFlight, isaTemp, layerAt, turnRate, type Controls, type Flight } from '@/lib/flightModel';
import { COLOUR_DICE, contrastHex } from '@/lib/faceContour';
import { PALETTES } from '@/lib/skyPalettes';

const SkyFlight = dynamic(() => import('@/components/flight/SkyFlight'), { ssr: false });

const LUNA = [
  'ようこそ、操縦席へ。案内は Luna。いつもはフォンを操縦しているけれど、今日は右の席にいる。',
  '窓の上の串が、水平線。左の操縦輪を左右に回すと傾いて、上下に引くと機首が動く。手を離すと、輪は中央へ戻る。',
  '近くでキラキラしているのは氷の粒（ミクロ層、数メートル先）。遠くの白い線は、ほかの飛行機の飛行機雲（メソ層、数十キロ先）。氷の粒をつまんで、サイコロの目へ運んでみて。',
  '下の八つの枠が、本物の計器と同じ数字。いまは高度およそ 10,600 m、巡航のところ。キーボードなら ← → で傾き、↓ で機首上げ（引く）・↑ で機首下げ（押す）、W・S で推力。',
];
const fmt = (n: number, d = 0) => n.toLocaleString('ja-JP', { maximumFractionDigits: d, minimumFractionDigits: d });

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
  const [last, setLast] = useState<DropKind | null>(null);
  const [luna, setLuna] = useState(0);
  const [tel, setTel] = useState<Flight>(initialFlight);
  const [thrust, setThrust] = useState(0.62);
  const controls = useRef<Controls>({ pitchCmd: 0, rollCmd: 0, thrust: 0.62 });
  const [ap, setAp] = useState(false);
  const [mcp, setMcp] = useState({ alt: 10600, hdg: 90, spd: 235 });
  const telRef = useRef<Flight>(initialFlight()); telRef.current = tel;
  useEffect(() => { // the autopilot flies by setting the same controls a hand would
    if (!ap) return undefined;
    const t = window.setInterval(() => { const c = autopilot(telRef.current, mcp); controls.current.pitchCmd = c.pitchCmd; controls.current.rollCmd = c.rollCmd; controls.current.thrust = c.thrust; setThrust(c.thrust); }, 50);
    return () => window.clearInterval(t);
  }, [ap, mcp]);
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const onDrop = useCallback((k: DropKind) => { setLast(k); if (k === 'perfect') setChecks((c) => c + 1); }, []);
  const onWheel = useCallback((r: number, p: number) => { if (Math.abs(r) > 0.05 || Math.abs(p) > 0.05) setAp(false); controls.current.rollCmd = r; controls.current.pitchCmd = p; }, []); // a hand on the wheel disconnects the autopilot
  const setT = (v: number) => { const x = Math.max(0, Math.min(1, v)); controls.current.thrust = x; setThrust(x); };
  useEffect(() => {
    if (!inside) return undefined;
    const held = new Set<string>();
    const apply = () => { controls.current.rollCmd = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0); controls.current.pitchCmd = (held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0); };
    const kd = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) { e.preventDefault(); held.add(e.key); setAp(false); apply(); } if (e.key === 'w') setT(controls.current.thrust + 0.05); if (e.key === 's') setT(controls.current.thrust - 0.05); };
    const ku = (e: KeyboardEvent) => { if (held.delete(e.key)) apply(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [inside]);
  const temp = isaTemp(tel.alt); const mach = tel.speed / (20.05 * Math.sqrt(temp + 273.15)); const layer = layerAt(tel.alt);
  const PARAMS: [string, string, string][] = [
    ['ピッチ', `${fmt(deg(tel.pitch), 1)}°`, '機首の上げ下げ'], ['ロール', `${fmt(deg(tel.roll), 1)}°`, `旋回 ${fmt(deg(turnRate(tel.roll, tel.speed)), 1)}°/秒`],
    ['推力', `${Math.round(thrust * 100)}%`, 'W・S か下のレバー'], ['速度', `${fmt(tel.speed)} m/s`, `${fmt(tel.speed * 3.6)} km/h・M${fmt(mach, 2)}`],
    ['高度', `${fmt(tel.alt)} m`, `FL${Math.round(tel.alt / 0.3048 / 100)}${layer ? `・${layer.name}の中` : ''}`], ['昇降率', `${fmt(tel.vs, 1)} m/s`, tel.vs > 0.5 ? '上昇' : tel.vs < -0.5 ? '降下' : '水平'],
    ['方位', `${String(Math.round(deg(tel.heading))).padStart(3, '0')}°`, '北が 000'], ['外気温', `${fmt(temp, 1)} °C`, contrailLikely(tel.alt) ? '飛行機雲ができやすい（−40 °C 以下）' : '飛行機雲はできにくい'],
  ];
  const sky = PALETTES[0];

  return (
    <main className="mx-auto max-w-4xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">メタ視点 → コックピット</p>
        <h1 className="text-xl font-bold">串の姿勢計を、空へ — 操縦席</h1>
        <p className="text-sm">雲の上の飛行機に、外から近づいて、操縦席に入る。サイコロの指示器「IND-01 串の姿勢計」は窓の空へ移り、串が水平線になる（傾きと機首に合わせて動き、サイコロは速さに合わせて回る）。中央には PermanentY の操縦輪。色はアリミノガール（機長席）とアリミノボーイ（副操縦士席）の決まりで塗り分ける。</p>
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
          {/* windshield: the sky, with IND-01 moved onto it as the HUD horizon */}
          <div className="relative" style={{ background: INK }}>
            <SkyFlight controls={controls} onTelemetry={setTel} onDrop={onDrop} reduced={reduced} />
            <div className="pointer-events-none absolute inset-y-0 left-[30%] w-3 -skew-x-6" style={{ background: INK }} />
            <div className="pointer-events-none absolute inset-y-0 right-[30%] w-3 skew-x-6" style={{ background: INK }} />
            {luna < LUNA.length && (
              <div className="absolute bottom-2 left-2 right-2 flex items-start gap-2 rounded-sm border-2 border-[#22b8c8] bg-[#1f1f1fee] p-2 text-xs text-white sm:right-auto sm:max-w-md" data-testid="luna">
                <span className="text-lg" aria-hidden>🌙</span>
                <div className="space-y-1"><p className="font-semibold text-[#22b8c8]">Luna</p><p>{LUNA[luna]}</p>
                  <div className="flex gap-2"><button type="button" data-testid="luna-next" onClick={() => setLuna((k) => k + 1)} className="min-h-[32px] border border-white/50 px-2">{luna + 1 < LUNA.length ? 'つぎ' : '操縦を始める'}</button><button type="button" onClick={() => setLuna(LUNA.length)} className="text-white/60">とばす</button></div></div>
              </div>)}
          </div>
          {/* glare shield: the MCP (autopilot) */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[10px] text-white" style={{ background: INK, boxShadow: '0 4px 0 #0005' }} data-testid="mcp">
            <span className="font-mono tracking-widest text-[#aaa]">MCP</span>
            {([['spd', '速さ m/s', 5], ['hdg', '方位 °', 10], ['alt', '高度 m', 300]] as const).map(([key, label, stepv]) => (
              <span key={key} className="flex items-center gap-1 rounded-sm bg-[#2a2c30] px-1.5 py-1">{label}
                <button type="button" onClick={() => setMcp((m) => ({ ...m, [key]: key === 'hdg' ? (m.hdg - stepv + 360) % 360 : m[key] - stepv }))} className="h-6 w-6 rounded-sm bg-[#3a3d42]" aria-label={`${label}を下げる`}>−</button>
                <b className="w-12 text-center font-mono text-[#fff27a]" data-testid={`mcp-${key}`}>{mcp[key]}</b>
                <button type="button" onClick={() => setMcp((m) => ({ ...m, [key]: key === 'hdg' ? (m.hdg + stepv) % 360 : m[key] + stepv }))} className="h-6 w-6 rounded-sm bg-[#3a3d42]" aria-label={`${label}を上げる`}>＋</button>
              </span>))}
            <button type="button" data-testid="ap" onClick={() => setAp((x) => !x)} className="min-h-[32px] rounded-sm border-2 px-2 font-semibold" style={{ borderColor: ap ? '#7fd36b' : '#555', color: ap ? '#7fd36b' : '#ccc' }}>A/P {ap ? 'ON' : 'OFF'}</button>
            <span className="text-[#888]">操縦輪かキーを動かすと外れる</span>
          </div>
          {/* main panel */}
          <div className="grid gap-3 p-3 md:grid-cols-[1fr_2fr_1fr]" style={{ background: PANEL }}>
            <SidePlate who="アリミノガール（仮）" cols={GIRL} side="L" />
            <div className="space-y-2">
              <div className="relative rounded-md border-4 p-2" style={{ borderColor: '#3a3d42', background: INK }} data-testid="ind-01">
                <Screw x="4px" y="4px" /><Screw x="calc(100% - 14px)" y="4px" /><Screw x="4px" y="calc(100% - 14px)" /><Screw x="calc(100% - 14px)" y="calc(100% - 14px)" />
                <FibWheel onChange={onWheel} color={GIRL[0].hex} />
              </div>
              <div className="flex items-center justify-between rounded-sm p-2 text-[10px] text-white" style={{ background: INK }}>
                <span className="rounded-sm bg-[#3a3d42] px-1.5 py-0.5 font-mono tracking-widest">IND-01（空へ移した）</span>
                <span>確認の印 <b data-testid="checks">{checks}</b>{last === 'near' ? '（もう少し目の中心へ）' : last === 'miss' ? '（サイコロまで運ぶ）' : ''}</span>
              </div>
              <label className="flex items-center gap-2 rounded-sm p-2 text-[10px] text-white" style={{ background: INK }}>スラストレバー<input type="range" min={0} max={1} step={0.01} value={thrust} onChange={(e) => setT(Number(e.target.value))} className="flex-1" data-testid="thrust" />{Math.round(thrust * 100)}%</label>
            </div>
            <SidePlate who="アリミノボーイ（仮）" cols={BOY} side="R" />
          </div>
          {/* bottom: reserved for flight parameters */}
          <div className="space-y-1 p-3" style={{ background: INK }} data-testid="flight-params">
            <p className="text-[11px] font-semibold text-white">操縦パラメーター（下部）</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{PARAMS.map(([name, v, sub], k) => (
              <div key={name} className="min-h-[56px] rounded-sm border p-1.5 text-white" style={{ borderColor: k < 4 ? GIRL[0].hex : BOY[0].hex }} data-testid={`param-${k + 1}`}>
                <p className="text-[9px] text-[#aaa]">{k + 1}・{name}</p><p className="font-mono text-sm">{v}</p><p className="text-[9px] text-[#999]">{sub}</p>
              </div>))}</div>
            <p className="text-[10px] text-[#999]">1〜4 は機長席の側（入力に近い値）、5〜8 は副操縦士席の側（確かめる値）。外気温は標準大気（ISA）からの計算。</p>
          </div>
        </section>
      )}

      <section className="space-y-1 text-xs" data-testid="parts">
        <p className="font-semibold">写真から回収した部品（考え方だけを使う。配置や商標は写さない）</p>
        <div className="grid gap-1 sm:grid-cols-2">{PARTS.map((p) => (
          <div key={p.name} className="flex gap-2 border border-stone-300 bg-white p-1.5">
            <span className="shrink-0 rounded-sm px-1 text-[10px] text-white" style={{ background: p.use === 'now' ? '#2f6b1a' : p.use === 'next' ? '#2b3a67' : '#78716c' }}>{p.use === 'now' ? '使用中' : p.use === 'next' ? '次' : 'あとで'}</span>
            <span><b>{p.area}・{p.name}</b>：{p.does}{p.game ? ` → ${p.game}` : ''}</span>
          </div>))}</div>
      </section>

      <section className="space-y-1 text-xs" data-testid="id-rules">
        <p className="font-semibold">インダストリアルデザインの要件（この計器の実用性）</p>
        <ul className="grid gap-1 sm:grid-cols-2">{RULES.map(([h, b]) => <li key={h} className="border border-stone-300 bg-white p-2"><b>{h}</b>：{b}</li>)}</ul>
      </section>
    </main>
  );
}
