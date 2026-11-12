'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { EDITIONS } from '@/lib/smokeCandle';
import {
  BINGO_LINES, BPM, MENTE_FORCE, beatForce, grip, heptad, isBingo, makeRound, mark, muFromFriction, nudge,
  type Capsule, type Card, type P2,
} from '@/lib/crystalBaby';

type Side = 'mente' | 'fami';
type Ufo = { p: P2; angle: number };
type Lift = { id: number; side: Side; t0: number };
const W = 960; const H = 540; const SCALE = 430; // world x ∈ [−1.1, 1.1]
const toPx = (p: P2) => ({ x: W / 2 + p.x * SCALE, y: H / 2 + p.y * SCALE });
const toWorld = (x: number, y: number): P2 => ({ x: (x - W / 2) / SCALE, y: (y - H / 2) / SCALE });
const STEP = 0.011; const TURN = Math.PI / 24;
const COL: Record<Side, { ink: string; soft: string; name: string }> = {
  mente: { ink: EDITIONS.golden.wax[1], soft: EDITIONS.golden.wax[2], name: 'Mente（黄金比・墨と藍）' },
  fami: { ink: EDITIONS.yamato.wax[1], soft: EDITIONS.yamato.wax[2], name: 'FamiDance（大和比・炎と蝋）' },
};

function CardView({ card, side }: { card: Card; side: Side }) {
  const pts = heptad({ x: 60, y: 60 }, 40); const bingo = isBingo(card);
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" data-testid={`card-${side}`} aria-label={`${side} のカード${bingo ? '（BINGO）' : ''}`}>
      {BINGO_LINES.map((l, i) => { const done = l.every((k) => card.marked[k]); return <line key={i} x1={pts[l[0]].x} y1={pts[l[0]].y} x2={pts[l[2]].x} y2={pts[l[2]].y} stroke={done ? COL[side].ink : '#ffffff22'} strokeWidth={done ? 4 : 1} />; })}
      {pts.map((p, i) => (
        <g key={i}><circle cx={p.x} cy={p.y} r={14} fill={card.marked[i] ? COL[side].ink : '#0d1118'} stroke={COL[side].ink} />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill={card.marked[i] ? '#111' : '#e5e7eb'} fontFamily="monospace">{card.numbers[i]}</text></g>
      ))}
    </svg>
  );
}

/**
 * Crystal Baby battle. Lift the babies out of the super-fusion glass box with a UFO claw; the
 * geometry decides (see lib/crystalBaby.ts). Left: Mente — keys / remote buttons, exact steps.
 * Right: FamiDance — drag the saucer and let go on the beat. μ follows the retro-grid A|B friction.
 */
export default function CrystalBabyBattle() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const friction = useCureAPIStore((s) => s.collisionParameters.friction);
  const setParam = useCureAPIStore((s) => s.setCollisionParameter);
  const mu = muFromFriction(friction);
  const [seed, setSeed] = useState(7);
  const [round, setRound] = useState(() => makeRound(7));
  const [ufo, setUfo] = useState<Record<Side, Ufo>>({ mente: { p: { x: -0.5, y: -0.38 }, angle: Math.PI / 2 }, fami: { p: { x: 0.5, y: -0.38 }, angle: Math.PI / 2 } });
  const [log, setLog] = useState<{ side: Side; text: string; ok: boolean }[]>([]);
  const [lifts, setLifts] = useState<Lift[]>([]);
  const [winner, setWinner] = useState<Side | null>(null);
  const drag = useRef(false);
  const state = useRef({ round, ufo, lifts, mu }); state.current = { round, ufo, lifts, mu };

  const reset = (s: number) => { setSeed(s); setRound(makeRound(s)); setLog([]); setLifts([]); setWinner(null); };

  const drop = useCallback((side: Side, force: number, note = '') => {
    if (winner) return;
    const { round: r, ufo: u } = state.current; const U = u[side];
    const mine = r.capsules.filter((c) => c.side === side && !c.lifted);
    if (!mine.length) return;
    const target = mine.reduce((a, c) => (Math.hypot(c.c.x - U.p.x, c.c.y - U.p.y) < Math.hypot(a.c.x - U.p.x, a.c.y - U.p.y) ? c : a));
    const g = grip(U.p, U.angle, target, state.current.mu, force);
    setLog((l) => [{ side, ok: g.ok, text: `${side === 'mente' ? 'Mente' : 'FamiDance'} → ${target.number} 番：${g.reason}${note}` }, ...l].slice(0, 8));
    if (g.ok) {
      setLifts((l) => [...l, { id: target.id, side, t0: performance.now() }]);
      setRound((prev) => {
        const cards = { ...prev.cards, [side]: mark(prev.cards[side], target.number) };
        return { capsules: prev.capsules.map((c) => (c.id === target.id ? { ...c, lifted: true } : c)), cards };
      });
    } else setRound((prev) => ({ ...prev, capsules: prev.capsules.map((c) => (c.id === target.id ? nudge(c, g) : c)) }));
  }, [winner]);

  useEffect(() => {
    if (winner) return;
    const done = (['mente', 'fami'] as Side[]).find((s) => isBingo(round.cards[s]));
    if (done) setWinner(done);
  }, [round, winner]);

  const moveMente = useCallback((dx: number, dy: number, da = 0) => setUfo((u) => ({ ...u, mente: { p: { x: Math.max(-1.05, Math.min(-0.02, u.mente.p.x + dx)), y: Math.max(-0.55, Math.min(0.55, u.mente.p.y + dy)) }, angle: u.mente.angle + da } })), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const m: Record<string, () => void> = {
        w: () => moveMente(0, -STEP), s: () => moveMente(0, STEP), a: () => moveMente(-STEP, 0), d: () => moveMente(STEP, 0),
        q: () => moveMente(0, 0, -TURN), e: () => moveMente(0, 0, TURN), ' ': () => drop('mente', MENTE_FORCE),
      };
      if (m[k]) { e.preventDefault(); m[k](); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [drop, moveMente]);

  // Pointer: FamiDance drags its saucer on the right half and lets go on the beat.
  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>, kind: 'down' | 'move' | 'up') => {
    const el = canvas.current; if (!el) return; const b = el.getBoundingClientRect();
    const w = toWorld(((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H);
    if (kind === 'down') { if (w.x < 0) return; drag.current = true; el.setPointerCapture(e.pointerId); }
    if (!drag.current) return;
    const p = { x: Math.max(0.02, Math.min(1.05, w.x)), y: Math.max(-0.55, Math.min(0.55, w.y)) };
    // The saucer turns with the beat while it is carried, so timing and aim are one gesture.
    setUfo((u) => ({ ...u, fami: { p, angle: Math.PI / 2 + ((performance.now() % (60000 / BPM)) / (60000 / BPM)) * (Math.PI / 6) } }));
    if (kind === 'up') { drag.current = false; const bf = beatForce(performance.now()); drop('fami', bf.force, `（拍から ${Math.round(bf.err)} ms・握力 ${bf.force.toFixed(2)}）`); }
  };

  useEffect(() => {
    const el = canvas.current; if (!el) return undefined; const ctx = el.getContext('2d'); if (!ctx) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1); el.width = W * dpr; el.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    const frame = (now: number) => {
      const { round: r, ufo: u, lifts: L, mu: m } = state.current;
      ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, W, H);
      // Super-fusion glass box with a faint honeycomb.
      ctx.strokeStyle = '#ffffff0d'; ctx.lineWidth = 1; const hx = 26;
      for (let row = 0; row < H / (hx * 1.5) + 1; row += 1) for (let col = 0; col < W / (hx * Math.sqrt(3)) + 1; col += 1) {
        const cx = col * hx * Math.sqrt(3) + (row % 2) * hx * Math.sqrt(3) / 2; const cy = row * hx * 1.5;
        ctx.beginPath(); for (let k = 0; k <= 6; k += 1) { const a = Math.PI / 6 + (k * Math.PI) / 3; const x = cx + hx * Math.cos(a); const y = cy + hx * Math.sin(a); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
      }
      ctx.strokeStyle = '#cfe8ff55'; ctx.lineWidth = 2; ctx.strokeRect(14, 14, W - 28, H - 28);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#ffffff44'; ctx.beginPath(); ctx.moveTo(W / 2, 14); ctx.lineTo(W / 2, H - 14); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff66'; ctx.font = '11px monospace'; ctx.fillText('MIRROR', W / 2 + 6, 30);
      // Capsules, babies and their genes.
      for (const c of r.capsules) {
        const lift = L.find((x) => x.id === c.id); const k = lift ? Math.min(1, (now - lift.t0) / 900) : 0;
        if (c.lifted && k >= 1) continue;
        const pc = toPx(c.c); const rad = c.r * SCALE * (1 + 0.25 * k); const col = COL[c.side];
        ctx.globalAlpha = 1 - k * 0.8;
        ctx.fillStyle = '#000000aa'; ctx.beginPath(); ctx.ellipse(pc.x + 6 + k * 18, pc.y + 8 + k * 18, rad, rad * 0.9, 0, 0, Math.PI * 2); ctx.fill();
        const grad = ctx.createRadialGradient(pc.x - rad * 0.4, pc.y - rad * 0.4, rad * 0.1, pc.x, pc.y, rad);
        grad.addColorStop(0, '#ffffffcc'); grad.addColorStop(0.35, `${col.ink}55`); grad.addColorStop(1, `${col.soft}33`);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(pc.x, pc.y, rad, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1.2; ctx.stroke();
        // Gene: the 7-point cloud (ring + centre), and the centre of mass it implies.
        const gp = c.gene.map((g) => toPx({ x: c.c.x + g.x, y: c.c.y + g.y }));
        ctx.strokeStyle = col.ink; ctx.lineWidth = 1; ctx.beginPath(); gp.slice(1).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
        for (const p of gp) { ctx.fillStyle = col.ink; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); }
        const cm = toPx({ x: c.c.x + c.com.x, y: c.c.y + c.com.y }); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cm.x, cm.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 12px monospace'; ctx.fillText(String(c.number), pc.x - rad - 2, pc.y - rad + 2);
        ctx.globalAlpha = 1;
      }
      // UFO saucers: an octagon with three prongs; a preview of where the prongs would touch.
      (['mente', 'fami'] as Side[]).forEach((side) => {
        const U = u[side]; const pc = toPx(U.p); const col = COL[side];
        const mine = r.capsules.filter((c) => c.side === side && !c.lifted);
        const target = mine.length ? mine.reduce((a, c) => (Math.hypot(c.c.x - U.p.x, c.c.y - U.p.y) < Math.hypot(a.c.x - U.p.x, a.c.y - U.p.y) ? c : a)) : null;
        const R = (target?.r ?? 0.11) * 1.7 * SCALE;
        ctx.strokeStyle = col.ink; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k <= 8; k += 1) { const a = Math.PI / 8 + (k * Math.PI) / 4; const x = pc.x + Math.cos(a) * R * 1.12; const y = pc.y + Math.sin(a) * R * 1.12; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
        if (side === 'fami') { const ph = (now % (60000 / BPM)) / (60000 / BPM); ctx.strokeStyle = `${col.ink}66`; ctx.beginPath(); ctx.arc(pc.x, pc.y, R * (1.2 + 0.1 * ph), 0, Math.PI * 2); ctx.stroke(); }
        const g = target ? grip(U.p, U.angle, target, m, side === 'mente' ? MENTE_FORCE : 2.1) : null;
        for (let k = 0; k < 3; k += 1) {
          const a = U.angle + (k * 2 * Math.PI) / 3; const sx = pc.x + Math.cos(a) * R; const sy = pc.y + Math.sin(a) * R;
          const at = g?.contacts[k]?.at; const e = at ? toPx(at) : { x: pc.x + Math.cos(a) * R * 0.3, y: pc.y + Math.sin(a) * R * 0.3 };
          ctx.strokeStyle = '#d6dde8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(e.x, e.y); ctx.stroke();
          if (at) { ctx.fillStyle = g?.contacts[k].holds ? '#a7f3d0' : '#fca5a5'; ctx.beginPath(); ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.fillStyle = col.ink; ctx.beginPath(); ctx.arc(pc.x, pc.y, 4, 0, Math.PI * 2); ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, []);

  const left = (side: Side) => round.capsules.filter((c: Capsule) => c.side === side && !c.lifted).length;
  const remote: [string, string, () => void][] = [
    ['◀', 'A', () => moveMente(-STEP, 0)], ['▲', 'W', () => moveMente(0, -STEP)], ['▼', 'S', () => moveMente(0, STEP)], ['▶', 'D', () => moveMente(STEP, 0)],
    ['↺', 'Q', () => moveMente(0, 0, -TURN)], ['↻', 'E', () => moveMente(0, 0, TURN)], ['●', 'Space', () => drop('mente', MENTE_FORCE)],
  ];

  return (
    <main className="min-h-screen bg-[#05070a] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">LAB · クリスタルベイビー対決</p>
            <h1 className="text-2xl font-semibold">Mente × FamiDance — UFO で持ち上げろ</h1>
            <p className="max-w-3xl text-sm text-slate-300">スーパーフュージョンのガラス箱から、結晶のベイビーを UFO の 3 本の爪で持ち上げます。持ち上がるかは幾何学で決まります：爪が当たるか、押す角度が摩擦円錐の中か、ベイビーの重心（白い点）が 3 つの接点の三角形の中か。右半分は左半分の鏡像です。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/retro-grid/split" className="border border-white/20 px-3 py-1">レトログリッド A|B</Link><Link href="/lab/candle-smoke" className="border border-white/20 px-3 py-1">蝋燭と煙</Link></nav>
        </header>

        <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
          <label className="flex items-center gap-2">レトログリッド A|B の摩擦 {friction.toFixed(2)}
            <input type="range" min={0} max={1} step={0.01} value={friction} onChange={(e) => setParam('friction', Number(e.target.value))} aria-label="A|B 摩擦" /></label>
          <span data-testid="mu">μ = {mu.toFixed(2)}（摩擦円錐 {Math.round((Math.atan(mu) * 180) / Math.PI)}°）</span>
          <button type="button" className="border border-white/20 px-3 py-1" onClick={() => reset(seed + 1)}>新しいラウンド</button>
        </div>

        <canvas ref={canvas} data-testid="box" className="w-full touch-none select-none rounded border border-white/10" style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={(e) => onPointer(e, 'down')} onPointerMove={(e) => onPointer(e, 'move')} onPointerUp={(e) => onPointer(e, 'up')} />

        {winner && <p data-testid="winner" className="text-center text-xl font-semibold" style={{ color: COL[winner].ink }}>BINGO — {COL[winner].name} の勝ち</p>}

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          {(['mente', 'fami'] as Side[]).map((side) => (
            <section key={side} className="flex gap-3 rounded border p-3" style={{ borderColor: `${COL[side].ink}55` }}>
              <CardView card={round.cards[side]} side={side} />
              <div className="space-y-2 text-xs">
                <h2 className="font-semibold" style={{ color: COL[side].ink }}>{COL[side].name}</h2>
                <p className="text-slate-400">残り {left(side)} 個</p>
                {side === 'mente' ? (
                  <>
                    <p className="text-slate-300">リモコンで 1 目盛り（{STEP}）ずつ、7.5° ずつ回して、● で降ろす。握力は一定 {MENTE_FORCE}。</p>
                    <div className="flex flex-wrap gap-1">{remote.map(([l, k, f]) => <button key={k} type="button" data-testid={`mente-${k}`} onClick={f} className="h-8 min-w-8 rounded border border-white/20 px-2 font-mono" title={k}>{l}</button>)}</div>
                  </>
                ) : (
                  <p className="text-slate-300">右半分で UFO をドラッグし、拍（{BPM} BPM、外側の輪）に合わせて離す。拍ぴったりで握力 2.1、250 ms ずれると 0。</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <ul data-testid="log" className="space-y-1 font-mono text-xs">
          {log.map((l, i) => <li key={i} style={{ color: l.ok ? '#a7f3d0' : '#fca5a5' }}>{l.text}</li>)}
        </ul>
      </div>
    </main>
  );
}
