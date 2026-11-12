'use client';

import { HeartPulse, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GLOBAL, ROLES, type CourtRole } from '@/app/cure-api/params';
import MenteNotifySettings from '@/components/mente/MenteNotifySettings';
import { useCureAPIStore, type PlaceholderState } from '@/lib/cureApiStore';
import { alleleString, birth, genomeOfRole, portraitOf, type Genome } from '@/lib/designerGene';
import { mulberry32 } from '@/lib/retroGrid';

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


/** A face drawn only from a genome (lib/designerGene): every feature comes from one locus. */
export function GenePortrait({ genome, size = 44 }: { genome: Genome; size?: number }) {
  const p = portraitOf(genome); const c = (l: number) => `hsl(${p.hue} 70% ${l}%)`;
  const curl = Array.from({ length: 9 }, (_, i) => `${i ? 'L' : 'M'}${-26 + i * 6.5} ${-30 + Math.sin(i * 1.3 + p.hairCurl * 3) * 4 * Math.abs(p.hairCurl)}`).join(' ');
  const spikes = Array.from({ length: p.crown }, (_, k) => `L${-14 + (28 * (k + 1)) / (p.crown + 1) - 3} -42 L${-14 + (28 * (k + 1)) / (p.crown + 1)} -50 L${-14 + (28 * (k + 1)) / (p.crown + 1) + 3} -42`).join(' ');
  return (
    <svg viewBox="-40 -52 80 92" width={size} height={size * 1.15} aria-label={`遺伝子 ${alleleString(genome)} の肖像`} data-genome={alleleString(genome)}>
      <g transform={`scale(${p.size})`}>
        {p.crown > 0 && <path d={`M-14 -40 L-14 -46 ${spikes} L14 -46 L14 -40 Z`} fill="#fde68a" stroke="#a16207" strokeWidth="0.8" />}
        <ellipse rx={30 * p.headW} ry={34 * p.headH} fill={c(78)} stroke={c(40)} />
        <path d={curl} fill="none" stroke={c(28)} strokeWidth="5" strokeLinecap="round" />
        {[-1, 1].map((s) => <circle key={s} cx={s * 60 * p.eyeGap} cy={-4} r={3.2} fill="#1f2937" />)}
        {Array.from({ length: p.freckles }, (_, k) => <circle key={k} cx={(k % 2 ? 1 : -1) * (8 + (k % 3) * 3)} cy={6 + (k % 2) * 3} r={0.9} fill={c(50)} />)}
        <path d="M-8 14 Q0 20 8 14" fill="none" stroke="#7f1d1d" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const ROLE_GENES = Object.fromEntries(ROLE_KEYS.map((k) => [k, genomeOfRole(k, ROLES[k])])) as Record<CourtRole, Genome>;

/**
 * CELL CONVERGENCE // DIAGNOSTIC as one component: the /cure-api header and the global header
 * pop-up both use it. Retest = re-seed and measure again how long the last EX cell takes to heal —
 * the answer that always arrives later. Healing is memoryless, so however long you have already
 * waited, the expected remaining wait is still 1 / cure rate.
 */
export default function CellConvergence({ compact = false }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [density, setDensity] = useState(GLOBAL.density);
  const [cureRate, setCureRate] = useState(GLOBAL.cureRate);
  const [stats, setStats] = useState<Record<CourtRole, number> & { inside: number }>({ KING: 0, QUEEN: 0, KNIGHT: 0, PAGE: 0, EX: 0, inside: 0 });
  const [exTrace, setExTrace] = useState<ExTrace>({ start: 0, lastOneAt: null, zeroAt: null, elapsed: 0 });
  const live = useRef({ density, cureRate });
  live.current = { density, cureRate };
  const trace = useRef<ExTrace>({ start: 0, lastOneAt: null, zeroAt: null, elapsed: 0 });
  const onZero = useRef<(c: Record<CourtRole, number>) => void>(() => {});

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
        onZero.current(counts);
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
  const [tails, setTails] = useState<number[]>([]);
  const [baby, setBaby] = useState<Genome | null>(null);
  const birthRand = useMemo(() => mulberry32(2026), []);
  onZero.current = (c) => {
    setBaby(birth(c, ROLE_GENES, birthRand));
    const tr = trace.current;
    if (tr.lastOneAt !== null && tr.zeroAt !== null) { const d = tr.zeroAt - tr.lastOneAt; setTails((xs) => [...xs, d].slice(-12)); }
  };
  const retest = () => { reseed(); setBaby(null); };
  const waiting = exTrace.lastOneAt !== null && exTrace.zeroAt === null ? exTrace.elapsed - exTrace.lastOneAt : null;
  const meanTail = tails.length ? tails.reduce((a, b) => a + b, 0) / tails.length : null;

  return (
    <div className="space-y-3 font-mono text-slate-100" data-testid="cell-convergence">
      <h2 className={`flex items-center gap-2 tracking-[0.3em] text-rose-300 ${compact ? 'text-sm' : 'text-lg sm:text-xl'}`}><HeartPulse size={compact ? 14 : 18} className="animate-pulse" /> CELL CONVERGENCE // DIAGNOSTIC</h2>
      <div className={`grid gap-3 ${compact ? 'md:grid-cols-[minmax(0,1fr)_17rem]' : 'lg:grid-cols-[minmax(0,1fr)_19rem]'}`}>
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
          <div className="grid grid-cols-5 gap-1" data-testid="role-portraits">
            {ROLE_KEYS.map((key) => (
              <div key={key} title={`shell ${ROLES[key].shell} · pull ${ROLES[key].pull} · ${ROLES[key].archetype} · 遺伝子 ${key === 'EX' ? '—' : alleleString(ROLE_GENES[key])}`} className="flex flex-col items-center rounded border border-white/10 bg-white/5 p-1 text-center" style={{ borderTop: `3px solid hsl(${ROLES[key].hue} 85% 55%)` }}>
                {key === 'EX' ? <p className="py-2 text-lg">{ROLES[key].glyph}</p> : <GenePortrait genome={ROLE_GENES[key]} size={30} />}
                <p className="text-[9px] text-slate-400">{ROLES[key].glyph} {key}</p>
                <p className="font-mono">{stats[key]}</p>
              </div>
            ))}
          </div>
          <div className={`rounded border p-2 text-[10px] ${stats.EX === 0 ? 'border-emerald-300/40 text-emerald-200' : stats.EX === 1 ? 'border-rose-300/60 text-rose-200' : 'border-white/10 text-slate-400'}`}>
            <p className="font-semibold">{stats.EX === 0 ? 'EX = 0 · 誕生 — loop binder unlocked below' : stats.EX === 1 ? 'EX = 1 · last rupture cell (ringed)' : `EX ${stats.EX} / start ${exTrace.start}`}</p>
            <p className="mt-0.5 text-slate-500">tail {tail === null ? '—' : `${tail.toFixed(1)} s`} · expected ≈ {Number.isFinite(expectedTail) ? `${expectedTail.toFixed(0)} s` : '∞ (cure 0)'} · inside {stats.inside}/{total}</p>
          </div>
          {baby && (
            <div className="flex items-center gap-2 rounded border border-pink-300/40 bg-pink-300/5 p-2 text-[10px]" data-testid="baby">
              <GenePortrait genome={baby} size={44} />
              <div>
                <p className="text-pink-200">誕生 {baby.name}</p>
                <p>遺伝子 {alleleString(baby)} · 親 {baby.parents?.map((r) => ROLES[r].glyph).join(' × ')}</p>
                {baby.mutations.length > 0 && <p className="text-slate-400">変異：{baby.mutations.join(', ')}</p>}
              </div>
            </div>
          )}
          <div className="rounded border border-white/10 p-2 text-[10px]" data-testid="paradox">
            <p className="text-slate-300">先行と後攻：最後の EX は、待つほど早く治るわけではない（記憶のない待ち時間）。</p>
            <p className="text-slate-500">{waiting !== null ? `いま ${waiting.toFixed(1)} s 待っている — それでも残りの期待値は ≈ ${Number.isFinite(expectedTail) ? expectedTail.toFixed(0) : '∞'} s のまま` : 'EX が 1 個になると計り始めます'}</p>
            <p className="text-slate-500">retest {tails.length} 回 · 平均の tail {meanTail === null ? '—' : `${meanTail.toFixed(1)} s`}（理論 {Number.isFinite(expectedTail) ? `${expectedTail.toFixed(0)} s` : '∞'}）</p>
          </div>
          {!compact && <MenteNotifySettings />}
          <button type="button" data-testid="retest" onClick={retest} className="flex w-full items-center justify-center gap-1 rounded border border-rose-300/30 py-1 text-[10px] text-rose-200 hover:bg-rose-300/10"><RotateCcw size={11} /> retest — reseed cells (EX → 1)</button>
        </aside>
      </div>
    </div>
  );
}
