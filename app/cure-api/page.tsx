'use client';

import { ArrowLeft, HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32 } from '@/lib/retroGrid';
import { GLOBAL, ROLES, type CourtRole } from './params';

type Cell = { role: CourtRole; x: number; y: number; z: number; a: number; b: number };

const ROLE_KEYS = Object.keys(ROLES) as CourtRole[];

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
  const live = useRef({ density, cureRate });
  live.current = { density, cureRate };

  const seedRand = useMemo(() => mulberry32(777), []);
  const cells = useRef<Cell[]>([]);
  if (cells.current.length === 0) {
    cells.current = Array.from({ length: GLOBAL.cellCount }, () => spawn(pickRole(seedRand), seedRand, GLOBAL.sphereRadius));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const R = GLOBAL.sphereRadius;
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
      ctx.fillStyle = 'rgba(3,2,10,0.28)'; ctx.fillRect(0, 0, w, h);

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
      }

      ctx.strokeStyle = 'rgba(240,171,252,0.25)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, R * breath, 0, Math.PI * 2); ctx.stroke();

      if (statTimer > 0.5) { statTimer = 0; setStats({ ...counts, inside }); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = cells.current.length;

  return (
    <main className="min-h-screen bg-[#03020a] p-6 font-mono text-slate-100">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl tracking-[0.3em] text-rose-300"><HeartPulse size={18} /> CURE API // CELL CONVERGENCE</h1>
          <Link href="/oracle-api" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Oracle</Link>
        </header>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
          <canvas ref={canvasRef} width={720} height={620} className="w-full rounded border border-rose-400/30 bg-black" />
          <aside className="space-y-3 text-xs">
            <label className="block">density <span className="float-right">{density.toFixed(2)}</span>
              <input type="range" min={0} max={1.5} step={0.01} value={density} onChange={(event) => setDensity(Number(event.target.value))} className="w-full" />
            </label>
            <label className="block">cure rate <span className="float-right">{cureRate.toFixed(2)}/s</span>
              <input type="range" min={0} max={0.3} step={0.005} value={cureRate} onChange={(event) => setCureRate(Number(event.target.value))} className="w-full" />
            </label>
            <p className="text-slate-400">inside sphere: {stats.inside} / {total}</p>
            {ROLE_KEYS.map((key) => (
              <div key={key} className="rounded border border-white/10 bg-white/5 p-2" style={{ borderLeft: `4px solid hsl(${ROLES[key].hue} 85% 55%)` }}>
                <p className="text-sm">{ROLES[key].glyph} {key} <span className="float-right">{stats[key]}</span></p>
                <p className="text-slate-400">shell {ROLES[key].shell} · pull {ROLES[key].pull} · {ROLES[key].archetype}</p>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
}
