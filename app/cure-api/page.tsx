'use client';

import { ArrowLeft, HeartPulse, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/retroGrid';
import CureApiInitialMenu from '@/components/CureApiInitialMenu';
import { useCureAPIStore, type PlaceholderState } from '@/lib/cureApiStore';
import { GLOBAL, ROLES, type CourtRole } from './params';

type Cell = { role: CourtRole; x: number; y: number; z: number; a: number; b: number };

const ROLE_KEYS = Object.keys(ROLES) as CourtRole[];
/** The convergence sphere lives in the page header, so it is drawn at a reduced scale. */
const HEADER_SCALE = 0.62;
const CANVAS_W = 1100;
const CANVAS_H = 340;

const BALLOON_INFLATE = 1.4;
const BALLOON_FLIGHT = 3.6;

/**
 * EX = 0 release: a balloon inflates from 0 to 1 at the sphere center, then drifts up and away.
 * Its shape follows the placeholder intervention pattern.
 */
function drawBalloon(ctx: CanvasRenderingContext2D, w: number, h: number, R: number, age: number, pattern: PlaceholderState) {
  const inflate = Math.min(1, age / BALLOON_INFLATE);
  const scale = 1 - (1 - inflate) ** 3;
  const flight = Math.max(0, (age - BALLOON_INFLATE) / BALLOON_FLIGHT);
  const x = w / 2 + Math.sin(age * 2.6) * R * 0.22 * flight + flight * R * 0.7;
  const y = h / 2 - flight * flight * (h / 2 + R * 1.3);
  const alpha = 1 - Math.max(0, (flight - 0.7) / 0.3);
  let size = R * 0.42 * scale;
  let sx = 1; let sy = 1.15;
  if (pattern === '(expand)') { size *= 1.35 + 0.05 * Math.sin(age * 8); sy = 1.05; }
  if (pattern === '(extend)') { sx = 1.6; sy = 0.8; }
  if (pattern === '⚪︎') sy = 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  // String
  ctx.strokeStyle = 'rgba(253,164,175,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + size * sy);
  ctx.quadraticCurveTo(x + Math.sin(age * 5) * 10, y + size * sy + 30, x - 4, y + size * sy + 60); ctx.stroke();
  // Body
  const gradient = ctx.createRadialGradient(x - size * 0.3, y - size * 0.4, size * 0.1, x, y, size * 1.4);
  gradient.addColorStop(0, '#ffe4e6'); gradient.addColorStop(0.45, '#fb7185'); gradient.addColorStop(1, '#a21caf');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  if (pattern === '◻︎') {
    const half = size * 0.95; const r = size * 0.3;
    ctx.roundRect(x - half, y - half, half * 2, half * 2, r);
  } else {
    ctx.ellipse(x, y, size * sx, size * sy, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(scale.toFixed(2), x, y + 4);
  ctx.restore();
}

type ExTrace = { start: number; lastOneAt: number | null; zeroAt: number | null; elapsed: number };

function pickRole(rand: () => number): CourtRole {
  const total = ROLE_KEYS.reduce((sum, key) => sum + ROLES[key].weight, 0);
  let t = rand() * total;
  for (const key of ROLE_KEYS) { t -= ROLES[key].weight; if (t <= 0) return key; }
  return 'PAGE';
}

function spawn(role: CourtRole, rand: () => number, radius: number): Cell {
  // Start scattered far outside the sphere.
  const u = rand() * 2 - 1; const phi = rand() * Math.PI * 2; const s = Math.sqrt(1 - u * u);
  const dist = radius * (1.6 + rand() * 1.4);
  return { role, x: s * Math.cos(phi) * dist, y: u * dist, z: s * Math.sin(phi) * dist, a: rand(), b: rand() };
}

export default function CureApiPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [density, setDensity] = useState(GLOBAL.density);
  const [cureRate, setCureRate] = useState(GLOBAL.cureRate);
  const [stats, setStats] = useState<Record<CourtRole, number> & { inside: number }>({ KING: 0, QUEEN: 0, KNIGHT: 0, PAGE: 0, EX: 0, inside: 0 });
  const [exTrace, setExTrace] = useState<ExTrace>({ start: 0, lastOneAt: null, zeroAt: null, elapsed: 0 });
  const live = useRef({ density, cureRate });
  live.current = { density, cureRate };
  const trace = useRef<ExTrace>({ start: 0, lastOneAt: null, zeroAt: null, elapsed: 0 });

  const seedRand = useMemo(() => mulberry32(777), []);
  const cells = useRef<Cell[]>([]);
  if (cells.current.length === 0) {
    cells.current = Array.from({ length: GLOBAL.cellCount }, () => spawn(pickRole(seedRand), seedRand, GLOBAL.sphereRadius * HEADER_SCALE));
  }

  const reseed = () => {
    const rand = mulberry32(Date.now() % 1_000_000);
    cells.current = Array.from({ length: GLOBAL.cellCount }, () => spawn(pickRole(rand), rand, GLOBAL.sphereRadius * HEADER_SCALE));
    trace.current = { start: 0, lastOneAt: null, zeroAt: null, elapsed: 0 };
    setExTrace(trace.current);
    useCureAPIStore.getState().setExParameter(1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const R = GLOBAL.sphereRadius * HEADER_SCALE;
    let lastEx = -1;
    let balloonStart: number | null = null;
    let raf = 0; let last = performance.now(); let t = 0; let statTimer = 0;
    const rand = mulberry32(4242);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; statTimer += dt;
      const { density: d, cureRate: cure } = live.current;
      const breath = 1 + GLOBAL.breathDepth * Math.sin((t / GLOBAL.breathPeriod) * Math.PI * 2);

      // Cure: some EX cells are re-seeded as PAGE cells at the outside and spiral back in.
      const healCount = Math.floor(cure * dt * cells.current.length + rand());
      for (let i = 0; i < healCount; i += 1) {
        const target = cells.current[Math.floor(rand() * cells.current.length)];
        if (target.role === 'EX') Object.assign(target, spawn('PAGE', rand, R));
      }

      const cosY = Math.cos(t * GLOBAL.rotationSpeed); const sinY = Math.sin(t * GLOBAL.rotationSpeed);
      const w = canvas.width; const h = canvas.height;
      ctx.fillStyle = 'rgba(12,5,16,0.28)'; ctx.fillRect(0, 0, w, h);

      let inside = 0;
      const counts: Record<CourtRole, number> = { KING: 0, QUEEN: 0, KNIGHT: 0, PAGE: 0, EX: 0 };
      for (const cell of cells.current) {
        const p = ROLES[cell.role];
        counts[cell.role] += 1;
        const dist = Math.hypot(cell.x, cell.y, cell.z) || 1;
        const targetR = p.shell * R * breath;
        // Radial pull toward the role shell + tangential swirl around Y.
        const k = (targetR - dist) * p.pull * d * dt * 2.2;
        cell.x += (cell.x / dist) * k; cell.y += (cell.y / dist) * k; cell.z += (cell.z / dist) * k;
        const ang = p.swirl * d * dt * (1.2 + cell.a);
        const cs = Math.cos(ang); const sn = Math.sin(ang);
        const nx = cell.x * cs - cell.z * sn; const nz = cell.x * sn + cell.z * cs;
        cell.x = nx + (rand() - 0.5) * p.jitter * R * dt * 6; cell.z = nz + (rand() - 0.5) * p.jitter * R * dt * 6;
        cell.y += (rand() - 0.5) * p.jitter * R * dt * 6;
        if (dist <= R * 1.02) inside += 1;

        const rx = cell.x * cosY - cell.z * sinY; const rz = cell.x * sinY + cell.z * cosY;
        const persp = 600 / (600 + rz);
        const sx = w / 2 + rx * persp; const sy = h / 2 + cell.y * persp;
        const lightness = 45 + 20 * (rz / R);
        ctx.fillStyle = `hsla(${p.hue}, 85%, ${Math.max(25, Math.min(80, lightness))}%, ${cell.role === 'KING' ? 1 : 0.8})`;
        const size = (cell.role === 'KING' ? 3.2 : cell.role === 'QUEEN' ? 2.6 : 1.8) * persp;
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        if (cell.role === 'EX' && lastEx === 1) {
          // The last surviving EX cell: the coupon-collector tail made visible.
          ctx.strokeStyle = 'rgba(251,113,133,0.9)';
          ctx.beginPath(); ctx.arc(sx, sy, 9 + 3 * Math.sin(t * 6), 0, Math.PI * 2); ctx.stroke();
        }
      }

      ctx.strokeStyle = 'rgba(251,113,133,0.3)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, R * breath, 0, Math.PI * 2); ctx.stroke();
      if (balloonStart !== null) {
        const age = t - balloonStart;
        if (age > BALLOON_INFLATE + BALLOON_FLIGHT) balloonStart = null;
        else drawBalloon(ctx, w, h, R, age, useCureAPIStore.getState().placeholderState);
      }

      const ex = counts.EX;
      const tr = trace.current;
      if (tr.start === 0 && ex > 0) tr.start = ex;
      if (ex === 1 && tr.lastOneAt === null) tr.lastOneAt = t;
      if (ex === 0 && lastEx > 0) {
        tr.zeroAt = t;
        balloonStart = t;
        useCureAPIStore.getState().setExParameter(0);
      }
      tr.elapsed = t;
      lastEx = ex;
      if (statTimer > 0.5) { statTimer = 0; setStats({ ...counts, inside }); setExTrace({ ...tr }); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = cells.current.length;

  const tail = exTrace.lastOneAt === null ? null : (exTrace.zeroAt ?? exTrace.elapsed) - exTrace.lastOneAt;
  const expectedTail = cureRate > 0 ? 1 / cureRate : Infinity;

  return (
    <>
      <header className="border-b border-rose-300/20 bg-[#0c0510] px-4 py-4 font-mono text-slate-100 sm:px-6">
        <div className="mx-auto max-w-[1500px] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-lg tracking-[0.3em] text-rose-300 sm:text-xl"><HeartPulse size={18} className="animate-pulse" /> CELL CONVERGENCE // DIAGNOSTIC</h1>
            <div className="flex gap-3">
              <Link href="/retro-grid?page=A" className="text-sm text-fuchsia-200 hover:text-white">Retro Grid A</Link>
              <Link href="/retro-grid?page=B" className="text-sm text-amber-200 hover:text-white">Retro Grid B</Link>
              <Link href="/cure-api/experiments" className="text-sm text-emerald-200 hover:text-white">Hypothesis Lab</Link>
              <Link href="/oracle-api" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Oracle</Link>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="w-full rounded border border-rose-400/30 bg-black" />
            <aside className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">density <span className="float-right">{density.toFixed(2)}</span>
                  <input type="range" min={0} max={1.5} step={0.01} value={density} onChange={(event) => setDensity(Number(event.target.value))} className="w-full accent-rose-300" />
                </label>
                <label className="block">cure rate <span className="float-right">{cureRate.toFixed(2)}/s</span>
                  <input type="range" min={0} max={0.3} step={0.005} value={cureRate} onChange={(event) => setCureRate(Number(event.target.value))} className="w-full accent-emerald-300" />
                </label>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {ROLE_KEYS.map((key) => (
                  <div key={key} title={`shell ${ROLES[key].shell} · pull ${ROLES[key].pull} · ${ROLES[key].archetype}`} className="rounded border border-white/10 bg-white/5 p-1 text-center" style={{ borderTop: `3px solid hsl(${ROLES[key].hue} 85% 55%)` }}>
                    <p className="text-sm">{ROLES[key].glyph}</p>
                    <p className="text-[9px] text-slate-400">{key}</p>
                    <p className="font-mono">{stats[key]}</p>
                  </div>
                ))}
              </div>
              <div className={`rounded border p-2 text-[10px] ${stats.EX === 0 ? 'border-emerald-300/40 text-emerald-200' : stats.EX === 1 ? 'border-rose-300/60 text-rose-200' : 'border-white/10 text-slate-400'}`}>
                <p className="font-semibold">{stats.EX === 0 ? 'EX = 0 · loop binder unlocked below' : stats.EX === 1 ? 'EX = 1 · last rupture cell (ringed)' : `EX ${stats.EX} / start ${exTrace.start}`}</p>
                <p className="mt-0.5 text-slate-500">
                  tail {tail === null ? '—' : `${tail.toFixed(1)} s`} · expected ≈ {Number.isFinite(expectedTail) ? `${expectedTail.toFixed(0)} s` : '∞ (cure 0)'} · inside {stats.inside}/{total}
                </p>
              </div>
              <button type="button" onClick={reseed} className="flex w-full items-center justify-center gap-1 rounded border border-rose-300/30 py-1 text-[10px] text-rose-200 hover:bg-rose-300/10"><RotateCcw size={11} /> reseed cells (EX → 1)</button>
            </aside>
          </div>
        </div>
      </header>
      <CureApiInitialMenu />
    </>
  );
}
