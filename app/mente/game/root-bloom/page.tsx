'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MU } from '@/lib/colorRules';
import { COINS, analyse, fetchCoinGecko, solveCut, synthetic, type Series } from '@/lib/marketResonance';
import { bspline, catmullRom, growRoots, polyline, type Root } from '@/lib/roots';

const BG = '#0a0a0a'; const PANEL = '#161514'; const TEXT = '#f4f1ec'; const SUB = '#a8a29e'; const LINE = '#2a2826';
const W = 860; const H = 520; const GROUND = 300; const PAD_X = 70;
const PETALS = [3, 5, 8, 13, 5, 8];
const GROUP = [MU.strain92.hex, MU.strain29.hex]; // group 0 = orange (アリミノガール側), group 1 = cyan (アリミノボーイ側)
type Curve = 'poly' | 'cr' | 'bs';

function Flower({ x, y, n, color, s }: { x: number; y: number; n: number; color: string; s: number }) {
  if (s <= 0) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1="0" y1="0" x2="0" y2="-34" stroke="#7fd36b" strokeWidth="2" />
      <g transform="translate(0 -40)">{Array.from({ length: n }, (_, k) => <ellipse key={k} cx="0" cy="-8" rx="3.4" ry="8" fill={color} transform={`rotate(${n > 8 ? k * 137.5 : (k * 360) / n})`} />)}<circle r="3" fill={BG} /><circle r="1.6" fill={color} /></g>
    </g>
  );
}

export default function RootBloom() {
  const [series, setSeries] = useState<Series[]>(() => synthetic());
  const [source, setSource] = useState<'synthetic' | 'live'>('synthetic');
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const [t, setT] = useState(0); const [launched, setLaunched] = useState(false);
  const [curve, setCurve] = useState<Curve>('cr'); const [ctrl, setCtrl] = useState(false);
  const raf = useRef(0);
  const a = useMemo(() => analyse(series), [series]);
  const cut = useMemo(() => solveCut(a.C, COINS.map((c) => c.label)), [a]);
  const xs = COINS.map((_, i) => 190 + i * 118);
  const roots: Root[][] = useMemo(() => COINS.map((_, i) => growRoots(xs[i], GROUND, {
    depth: Math.min(40, 18 + a.dds[i] * 60), wobble: Math.max(0.12, Math.min(0.8, a.vols[i] * 14)), branch: Math.max(0.04, Math.min(0.2, 0.03 + a.vols[i] * 3)),
    lean: Math.sign(a.R[i].reduce((p, q) => p + q, 0)), seed: 97 * i + 1,
  })), [a]); // eslint-disable-line react-hooks/exhaustive-deps
  const launch = () => {
    cancelAnimationFrame(raf.current); setLaunched(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setT(1); return; }
    const t0 = performance.now(); const tick = () => { const x = Math.min(1, (performance.now() - t0) / 7000); setT(x); if (x < 1) raf.current = requestAnimationFrame(tick); }; raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const live = async () => {
    setLoading(true); setErr('');
    try { const s = await fetchCoinGecko(); setSeries(s); setSource('live'); } catch (e) { setErr(`CoinGecko に届かなかったので、合成データのまま（${(e as Error).message}）。`); } finally { setLoading(false); }
  };
  const seedT = Math.min(1, t / 0.25); const bloom = Math.max(0, Math.min(1, (t - 0.25) / 0.15)); const rootT = Math.max(0, Math.min(1, (t - 0.35) / 0.65));
  const pathOf = (r: Root) => (curve === 'poly' ? polyline(r.pts) : curve === 'cr' ? catmullRom(r.pts) : bspline(r.pts).d);
  const btcEth = a.C[0][1];

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-4" style={{ background: BG, color: TEXT }}>
      <header className="space-y-1">
        <p className="text-xs" style={{ color: SUB }}>MENTE · 共鳴の宴をローンチパッドに · 根と自由曲線 · 市場の共鳴と計算機</p>
        <h1 className="text-xl font-bold">共鳴する根 — 宴から花を打ち上げ、地面に根を張る</h1>
        <p className="text-sm" style={{ color: SUB }}>宴のテスラコイルから、六つの種を打ち上げる。一つの種は一つのコイン。地面に落ちると花が咲き、根を張る。根の形は、そのコインの 90 日の値動きの「形」から（日々の変化の大きさ → 根のゆらぎと枝分かれ、いちばん深い下げ → 根の深さ）。花と根の色は、量子計算機の Max-Cut が決めた二つの組（オレンジ／シアン）。投資の助言ではない。</p>
      </header>

      <section className="rounded-md border" style={{ borderColor: LINE }} data-testid="scene">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="打ち上げられた種が花と根になる">
          <defs><linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1d12" /><stop offset="1" stopColor="#140d07" /></linearGradient></defs>
          <rect width={W} height={GROUND} fill={BG} />
          <rect y={GROUND} width={W} height={H - GROUND} fill="url(#soil)" />
          {Array.from({ length: 140 }, (_, i) => <circle key={i} cx={(i * 97) % W} cy={GROUND + 8 + ((i * 53) % (H - GROUND - 10))} r={(i % 3) * 0.6 + 0.4} fill="#3b2a1a" />)}
          <line x1="0" y1={GROUND} x2={W} y2={GROUND} stroke="#5a4330" strokeWidth="2" />
          {/* the launchpad: the feast's Tesla coil */}
          <g transform={`translate(${PAD_X} ${GROUND})`}><rect x="-9" y="-70" width="18" height="70" fill="#3a2f1e" />{Array.from({ length: 14 }, (_, i) => <line key={i} x1="-9" y1={-68 + i * 4.8} x2="9" y2={-68 + i * 4.8} stroke="#c8873a" strokeWidth="1.4" />)}<ellipse cx="0" cy="-78" rx="22" ry="7" fill="none" stroke="#c9ced6" strokeWidth="5" /><text x="0" y="16" textAnchor="middle" fontSize="10" fill={SUB}>宴のコイル</text></g>
          {/* roots (drawn as they grow) */}
          {launched && roots.map((rs, i) => rs.map((r, k) => <path key={`${i}-${k}`} d={pathOf(r)} pathLength={1} fill="none" stroke={GROUP[cut.groups[i]]} strokeOpacity={r.order === 0 ? 0.95 : r.order === 1 ? 0.7 : 0.45} strokeWidth={r.width} strokeLinecap="round" strokeDasharray="1" strokeDashoffset={1 - Math.min(1, rootT * (r.order === 0 ? 1.2 : r.order === 1 ? 1.5 : 2) - (r.order ? 0.3 : 0))} />))}
          {launched && ctrl && curve === 'bs' && roots.map((rs, i) => { const r0 = rs.find((r) => r.order === 0)!; return <path key={`c${i}`} d={polyline(r0.pts)} fill="none" stroke="#ffffffb0" strokeDasharray="3 3" strokeWidth="1" />; })}
          {/* seeds in flight, then flowers */}
          {launched && COINS.map((c, i) => {
            const x = PAD_X + (xs[i] - PAD_X) * seedT; const y = GROUND - 80 - Math.sin(Math.PI * seedT) * (140 + i * 12) + seedT * 80;
            return <g key={c.id}>{seedT < 1 && <circle cx={x} cy={y} r="3.5" fill="#fff1b8" />}<Flower x={xs[i]} y={GROUND} n={PETALS[i]} color={GROUP[cut.groups[i]]} s={bloom} />{bloom > 0 && <text x={xs[i]} y={GROUND - 66} textAnchor="middle" fontSize="11" fill={TEXT}>{c.label}</text>}</g>;
          })}
        </svg>
      </section>

      <section className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" data-testid="launch" onClick={launch} className="min-h-[40px] rounded-sm border-2 px-4 font-semibold" style={{ borderColor: '#fff1b8', color: '#fff1b8' }}>🚀 宴から打ち上げる</button>
        <span style={{ color: SUB }}>曲線：</span>
        {([['poly', '折れ線（育った点そのまま）'], ['cr', 'Catmull–Rom（点を通る）'], ['bs', 'B-スプライン（点の近くを、なめらかに）']] as const).map(([k, l]) => <button key={k} type="button" data-testid={`curve-${k}`} onClick={() => setCurve(k)} className="rounded-sm border px-2 py-1" style={{ borderColor: curve === k ? '#fff1b8' : LINE }}>{l}</button>)}
        {curve === 'bs' && <label className="flex items-center gap-1"><input type="checkbox" checked={ctrl} onChange={(e) => setCtrl(e.target.checked)} />制御点の多角形を見せる</label>}
      </section>

      <section className="grid gap-3 md:grid-cols-2" data-testid="experiment">
        <div className="space-y-2 rounded-md border p-3 text-xs" style={{ borderColor: LINE, background: PANEL }}>
          <p className="font-semibold">データ：{source === 'live' ? 'CoinGecko（ライブ）' : '合成（90 日）'}</p>
          <button type="button" data-testid="live" onClick={live} disabled={loading} className="rounded-sm border px-2 py-1" style={{ borderColor: LINE }}>{loading ? '読み込み中…' : 'CoinGecko から読む（このブラウザから）'}</button>
          {err && <p style={{ color: '#ff8a8a' }} data-testid="err">{err}</p>}
          <p style={{ color: SUB }}>値段そのものは使わない。日々の変化（対数の変化）の形だけ。{source === 'live' && 'Data provided by CoinGecko.'}</p>
          <p>共鳴（日々の変化の相関）：BTC と ETH <b>{(btcEth * 100).toFixed(0)}%</b></p>
          <div className="grid w-fit gap-px" style={{ gridTemplateColumns: `2.5rem repeat(${COINS.length}, 1.8rem)` }} data-testid="heat">
            <span />{COINS.map((c) => <span key={c.id} className="text-center text-[9px]">{c.label}</span>)}
            {COINS.map((c, i) => [<span key={`l${c.id}`} className="text-[9px]">{c.label}</span>, ...COINS.map((d, j) => { const v = a.C[i][j]; return <span key={`${c.id}-${d.id}`} className="h-6 text-center text-[8px] leading-6" style={{ background: `rgba(${v >= 0 ? '242,155,48' : '34,184,200'},${Math.abs(v)})`, color: Math.abs(v) > 0.6 ? '#000' : TEXT }}>{v.toFixed(1)}</span>; })])}
          </div>
        </div>
        <div className="space-y-2 rounded-md border p-3 text-xs" style={{ borderColor: LINE, background: PANEL }} data-testid="cut">
          <p className="font-semibold">共鳴する計算機：Max-Cut（6 コイン＝ 6 量子ビット、1 層）</p>
          <p>動きの似ていない組み合わせ（重み 1 − 相関）を切り離すように、二つの組に分ける。</p>
          <p><span className="rounded-sm px-1 text-black" style={{ background: GROUP[0] }}>組 0</span> {COINS.filter((_, i) => cut.groups[i] === 0).map((c) => c.label).join('・')}　<span className="rounded-sm px-1 text-black" style={{ background: GROUP[1] }}>組 1</span> {COINS.filter((_, i) => cut.groups[i] === 1).map((c) => c.label).join('・') || '—'}</p>
          <p>総当たり（64 通り）の最適と、手元の状態ベクトルで測った QAOA（1 層）：最適の組分けが出る確率 <b>{(cut.qaoaOptimal * 100).toFixed(1)}%</b>（でたらめなら {(cut.randomOptimal * 100).toFixed(1)}%）。</p>
          <p style={{ color: SUB }}>次の一歩：同じ 6 量子ビットの回路を、IBM 量子キャンペーン（11-20〜12-17）の実機で一度だけ回し、手元の結果と並べる。鍵はオーナーの手元だけに置く。</p>
        </div>
      </section>
    </main>
  );
}
