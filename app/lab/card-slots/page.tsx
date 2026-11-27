'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { anomalyPattern, metalChance, planMassInsertion, stageAt, type Pattern, type Scheduled, type Slot } from '@/lib/cardSlots';
import { MATRIX_ROLES } from '@/lib/marketCatalog';

const ROWS = 6; const CELL = 40; const PAD = 34; const SCALE = 0.62;
const hue = (role: number) => (role * 360) / 22;

/** Draw the anomaly pattern of one cell at its local time. */
function Anomaly({ p, t, role }: { p: Pattern; t: number; role: number }) {
  const st = stageAt(p, t); const s = (q: { x: number; y: number }) => `${(q.x * SCALE).toFixed(1)},${(q.y * SCALE).toFixed(1)}`;
  const ringPts = p.ring.map(s).join(' '); const spiralPts = p.spiral.map(s).join(' ');
  const after = (stage: string) => ['ring', 'spiral', 'pebble', 'bounce', 'ripple', 'done'].indexOf(st.stage) > ['ring', 'spiral', 'pebble', 'bounce', 'ripple', 'done'].indexOf(stage);
  const sp = { x: p.spiralPoint.x * SCALE, y: p.spiralPoint.y * SCALE };
  let pebble: { x: number; y: number } | null = null;
  if (st.stage === 'pebble') { const i = Math.min(p.pebble.path.length - 1, Math.floor(st.k * (p.pebble.path.length - 1))); pebble = { x: p.pebble.path[i].p.x * SCALE, y: p.pebble.path[i].p.y * SCALE }; }
  if (st.stage === 'bounce') { const b = st.k * p.pebble.bounces; const hop = Math.abs(Math.sin(b * Math.PI)) * 6 * (1 - st.k); pebble = { x: sp.x, y: sp.y - hop }; }
  if (st.stage === 'ripple' || st.stage === 'done') pebble = sp;
  return (
    <g pointerEvents="none">
      <circle r={10 * SCALE * 0.95} fill="url(#chrome-end)" stroke="#ddd" strokeWidth={0.6} />
      {/* 1. octagon ring traced round the rim, looping */}
      <polyline points={ringPts} fill="none" stroke={`hsl(${hue(role)} 95% 65%)`} strokeWidth={1.2} pathLength={1} strokeDasharray={`${st.stage === 'ring' ? st.k : 1} 1`} opacity={st.stage === 'done' ? 0.45 : 1} />
      {/* 2. golden spiral out of one corner */}
      {(st.stage === 'spiral' || after('spiral') || st.stage === 'pebble') && <polyline points={spiralPts} fill="none" stroke="#ffe600" strokeWidth={0.8} strokeDasharray="2 1.5" pathLength={1} opacity={st.stage === 'done' ? 0.35 : 0.9} />}
      <circle cx={sp.x} cy={sp.y} r={1.6} fill="#ffe600" opacity={st.stage === 'ring' ? 0 : 1} />
      {/* 3. the pebble, 4. ripples */}
      {pebble && <circle cx={pebble.x} cy={pebble.y} r={2.4} fill="#9aa0a8" stroke="#222" strokeWidth={0.5} />}
      {st.stage === 'ripple' && Array.from({ length: p.ripples.count }, (_, k) => { const kk = Math.max(0, st.k - k * 0.18); return kk > 0 ? <circle key={k} cx={sp.x} cy={sp.y} r={kk * p.ripples.amplitude * SCALE * 1.4} fill="none" stroke="#7ff3ff" strokeWidth={0.8} opacity={1 - kk} /> : null; })}
    </g>
  );
}

/**
 * Card slots on candies: lay a face-down card on every candy of the 22-role matrix at once. A rope
 * ties as expected; a metal cylinder in a rope slot runs the anomaly pattern (octagon ring → golden
 * spiral point → thrown pebble → ripples), shaped by that candy's role physics. Lanes cap how many
 * anomalies play at once.
 */
export default function CardSlotsLab() {
  const [seed, setSeed] = useState(7);
  const [lanes, setLanes] = useState(8);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(-1); // ms since the deal started; −1 = not started
  const [pick, setPick] = useState<Slot | null>(null);
  const slots: Slot[] = useMemo(() => MATRIX_ROLES.flatMap((r) => Array.from({ length: ROWS }, (_, i) => ({ id: `${r.arcanaId}-${i}`, role: r.arcanaId, expects: 'rope' as const, physics: r.candy }))), []);
  const plan = useMemo(() => planMassInsertion(slots, seed, { lanes }), [slots, seed, lanes]);
  const byId = useMemo(() => new Map(plan.schedule.map((s) => [s.slot.id, s])), [plan]);
  const run = useRef({ speed }); run.current.speed = speed;

  useEffect(() => {
    if (t < 0 || t > plan.totalMs) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setT(plan.totalMs + 1); return undefined; }
    let raf = 0; let last = performance.now();
    // A frame's timestamp can predate the effect, so elapsed time is never allowed to go negative.
    const frame = (now: number) => { const dt = Math.max(0, now - last) * run.current.speed; last = Math.max(last, now); setT((x) => (x < 0 ? x : Math.min(plan.totalMs + 1, x + dt))); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t >= 0, t > plan.totalMs, plan.totalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = t >= 0;
  const dealt = started ? plan.schedule.filter((s) => s.start <= t).length : 0;
  const active = started ? plan.schedule.filter((s) => s.result.kind === 'anomaly' && s.start <= t && t < s.end).length : 0;
  const waiting = started ? plan.schedule.filter((s) => s.waited > 0 && s.order * 45 <= t && t < s.start).length : 0;
  const anomaliesSoFar = started ? plan.schedule.filter((s) => s.result.kind === 'anomaly' && s.start <= t).length : 0;
  const W = PAD + MATRIX_ROLES.length * CELL + 10; const H = PAD + ROWS * (CELL + 8) + 10;
  const detail = pick ? byId.get(pick.id) : null; const role = pick ? MATRIX_ROLES[pick.role] : null;

  const cell = (s: Scheduled | undefined, slot: Slot, x: number, y: number) => {
    const local = started && s ? t - s.start : -1; const landed = local >= 0;
    const drop = started && s && local > -260 && local < 0 ? (local + 260) / 260 : null; // the card falls face-down
    const r = 7 * slot.physics.radialScale;
    return (
      <g key={slot.id} transform={`translate(${x + CELL / 2},${y + CELL / 2})`} onClick={() => setPick(slot)} style={{ cursor: 'pointer' }} data-slot={slot.id} data-state={!landed ? 'empty' : s!.result.kind}>
        <rect x={-CELL / 2 + 2} y={-CELL / 2 + 2} width={CELL - 4} height={CELL + 4} rx={4} fill={pick?.id === slot.id ? '#ffffff14' : '#ffffff05'} stroke="#ffffff10" />
        <circle cy={-6} r={r} fill={`hsl(${hue(slot.role)} 80% 55%)`} opacity={0.9} />
        <circle cx={-r * 0.3} cy={-6 - r * 0.3} r={r * 0.3} fill="#fff" opacity={0.35} />
        {/* the card slot under the candy: dashed until a card lands */}
        <rect x={-8} y={6} width={16} height={11} rx={1.5} fill={landed ? '#2a1640' : 'none'} stroke={landed ? '#c084fc' : '#ffffff40'} strokeDasharray={landed ? undefined : '2 2'} />
        {landed && <path d="M-6 8 l12 7 M6 8 l-12 7" stroke="#c084fc" strokeWidth={0.6} opacity={0.6} />}
        {drop !== null && <rect x={-8} y={6 - (1 - drop) * 30} width={16} height={11} rx={1.5} fill="#2a1640" stroke="#c084fc" transform={`rotate(${(1 - drop) * 40} 0 ${11 - (1 - drop) * 30})`} />}
        {landed && s!.result.kind === 'tie' && <path d="M-4 22 q4 -6 8 0 q-4 6 -8 0" fill="none" stroke="#b3122a" strokeWidth={1.4} opacity={Math.min(1, local / 300)} />}
        {landed && s!.result.kind === 'anomaly' && <g transform="translate(0,-6)"><Anomaly p={s!.result.pattern} t={local} role={slot.role} /></g>}
      </g>
    );
  };

  return (
    <main className="min-h-screen bg-[#05050a] px-4 py-5 font-mono text-slate-100 sm:px-8">
      <div className="mx-auto max-w-[1100px] space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-fuchsia-300">LAB · CARD SLOTS × MATRIX ROLES</p>
            <h1 className="text-2xl font-bold">キャンディーのカードスロットに、一斉にカードを伏せる</h1>
            <p className="text-xs text-slate-400">本来ロープを置くスロットに金属の円筒が入ると、円筒の外縁にオクタゴンの輪を描いてループし、スパイラル地点へ石ころを投げる。動き方はキャンディーのロール（22 のアルカナ）の物理で決まる。</p>
          </div>
          <nav className="flex gap-2 text-xs"><Link href="/lab/knot-ladder" className="border border-white/20 px-3 py-1">結び目のはしご</Link></nav>
        </header>

        <section aria-label="Controls" className="flex flex-wrap items-center gap-3 rounded border border-white/15 p-2 text-xs">
          <button type="button" onClick={() => setT(0)} className="bg-[#c084fc] px-3 py-1 font-bold text-black">一斉に伏せる（{slots.length} 枚）</button>
          <button type="button" onClick={() => setT(-1)} className="border border-white/30 px-2 py-1">戻す</button>
          <label className="flex items-center gap-1">同時に動く異常（レーン）<input aria-label="Lanes" type="range" min={1} max={16} value={lanes} onChange={(e) => { setLanes(Number(e.target.value)); setT(-1); }} /> {lanes}</label>
          <label className="flex items-center gap-1">速さ <select aria-label="Speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="border border-white/30 bg-black px-1">{[0.5, 1, 3, 8].map((v) => <option key={v} value={v}>{v}×</option>)}</select></label>
          <button type="button" onClick={() => { setSeed((s) => s + 1); setT(-1); }} className="border border-white/30 px-2 py-1">配り直す（seed {seed}）</button>
          <span className="ml-auto" data-testid="stats">伏せた {dealt}/{slots.length} ・ 異常 {anomaliesSoFar}/{plan.anomalies} ・ いま動作中 {active} ・ 最大同時 {plan.peak}/{lanes} ・ 待機 {waiting} ・ 全体 {(plan.totalMs / 1000).toFixed(1)} 秒</span>
        </section>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-white/10 bg-[radial-gradient(ellipse_at_center,#120a1f,#05050a)]" role="img" aria-label="Matrix of card slots" data-testid="matrix">
          <defs><radialGradient id="chrome-end"><stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#9aa0a8" /><stop offset="1" stopColor="#2a2d34" /></radialGradient></defs>
          {MATRIX_ROLES.map((r, c) => <text key={r.arcanaId} x={PAD + c * CELL + CELL / 2} y={16} textAnchor="middle" fontSize={8} fill={`hsl(${hue(r.arcanaId)} 80% 70%)`}>{r.arcanaId}</text>)}
          {Array.from({ length: ROWS }, (_, i) => <text key={i} x={10} y={PAD + i * (CELL + 8) + CELL / 2} fontSize={8} fill="#64748b">#{i + 1}</text>)}
          {slots.map((slot) => { const c = slot.role; const i = Number(slot.id.split('-')[1]); return cell(byId.get(slot.id), slot, PAD + c * CELL, PAD - 8 + i * (CELL + 8)); })}
        </svg>

        <div className="grid gap-3 md:grid-cols-2">
          <section aria-label="Detail" className="rounded border border-white/15 p-2 text-xs" data-testid="detail">
            {pick && role ? (() => { const p = anomalyPattern(pick.role, pick.physics); return (<>
              <p className="text-sm" style={{ color: `hsl(${hue(pick.role)} 80% 70%)` }}>{role.arcanaId} · {role.arcanaName}</p>
              <p className="text-slate-400">{role.function}</p>
              <p>質量 {role.candy.mass} ・ 剛性 {role.candy.rigidity} ・ 振動 {role.candy.vibration} ・ 半径倍率 {role.candy.radialScale} ・ 金属が来る確率 {(metalChance(role.candy) * 100).toFixed(0)}%</p>
              <p>異常のとき：オクタゴンを {p.loops} 周 → 黄金螺旋で半周（×φ²）→ 石ころの頂点 {p.pebble.apex.toFixed(1)}・飛行 {p.pebble.flightMs} ms・跳ね {p.pebble.bounces} 回 → 波紋 {p.ripples.count} 重（全 {(p.totalMs / 1000).toFixed(2)} 秒）</p>
              <p className="text-slate-400">このマス：{detail ? (detail.item === 'metal' ? `金属の円筒（${detail.waited ? `${(detail.waited / 1000).toFixed(1)} 秒レーン待ち` : '待ちなし'}）` : 'ロープ（ふつうに結ぶ）') : '—'}</p>
            </>); })() : <p className="text-slate-400">マスを押すと、そのキャンディーのロールと異常の形が出る。</p>}
          </section>
          <section aria-label="Legend" className="space-y-1 rounded border border-white/15 p-2 text-[11px] text-slate-300">
            <p>① 外縁のオクタゴン：円筒の縁に接する八角形を、振動が大きいほど多く周回する（グラフループ）。</p>
            <p>② スパイラル地点：八角形の角（ロール番号 mod 8）から黄金螺旋を半周、半径は φ² ≈ 2.618 倍。</p>
            <p>③ 石ころ：左上から投げる。重いロールほど低く遅い。剛性が高いほど跳ねる。</p>
            <p>④ 波紋：振動が大きいほど多重に広がり、隣のマスにかかる。</p>
            <p>大量投入：黄金角の順に 45 ms ごとに伏せる。異常はレーンをひとつ使い、空きがなければ待つ。</p>
          </section>
        </div>
      </div>
    </main>
  );
}
