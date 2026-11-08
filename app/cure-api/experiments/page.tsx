'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { solveBallSkeletonContact, sampleContactLuminance, hashExperimentRecord } from '@/lib/collisionEngine';
import { build48Matrix, createMockCameraCaptures } from '@/lib/matrixBuilder';
import { useCureAPIStore, type CureHypothesis } from '@/lib/cureApiStore';
import type { GraphPattern } from '@/components/cure/HypothesisScene';

const HypothesisCanvas = dynamic(() => import('@/components/cure/HypothesisCanvas'), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-xl bg-slate-900" />,
});

const PATTERNS: { id: GraphPattern; label: string }[] = [
  { id: 'SQUEEZE', label: 'Squeeze · 収束' },
  { id: 'REVERSAL', label: 'Reversal · 反転' },
  { id: 'EXPANDING', label: 'Expanding · 拡張' },
  { id: 'EXTENDED', label: 'Extended · Pixel/Spiral' },
];

export default function CureExperimentsPage() {
  const [hypothesis, setHypothesis] = useState<CureHypothesis>('A');
  const [pattern, setPattern] = useState<GraphPattern>('SQUEEZE');
  const [triggerId, setTriggerId] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const speed = useCureAPIStore((state) => state.simulationSpeed);
  const setSpeed = useCureAPIStore((state) => state.setSimulationSpeed);
  const stress = useCureAPIStore((state) => state.volatilityIndex);
  const setStress = useCureAPIStore((state) => state.setVolatilityIndex);
  const freezeFrame = useCureAPIStore((state) => state.freezeFrame);
  const setFreezeFrame = useCureAPIStore((state) => state.setFreezeFrame);
  const collisionParameters = useCureAPIStore((state) => state.collisionParameters);
  const setCollisionParameter = useCureAPIStore((state) => state.setCollisionParameter);
  const experimentFeedback = useCureAPIStore((state) => state.experimentFeedback);
  const latestMatrix = useCureAPIStore((state) => state.latestMatrix);
  const recordExperiment = useCureAPIStore((state) => state.recordExperiment);
  const timeframe = useCureAPIStore((state) => state.timeframe);
  const simulationMode = useCureAPIStore((state) => state.simulationMode);
  const setSimulationMode = useCureAPIStore((state) => state.setSimulationMode);
  const projectionBlocks = useCureAPIStore((state) => state.projectionBlocks);
  const unlockedPredictionCell = useCureAPIStore((state) => state.unlockedPredictionCell);

  const [lastCollision, setLastCollision] = useState<{ area: number; energy: number; collided: boolean } | null>(null);

  useEffect(() => setHypothesis(simulationMode === 'hypothesisA' ? 'A' : 'B'), [simulationMode]);

  const collision = useMemo(() => solveBallSkeletonContact(
    {
      ballCenter: { x: 0, y: 0, z: 0 },
      ballRadius: 0.72,
      skeletonStart: { x: -0.9, y: -0.3, z: 0 },
      skeletonEnd: { x: 0.9, y: 0.3, z: 0 },
      skeletonRadius: 0.16,
    },
    collisionParameters,
    { x: 0.15, y: -1, z: 0.08 },
  ), [collisionParameters]);

  const capture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setFeedbackError('');
    try {
      const event = solveBallSkeletonContact(
        {
          ballCenter: hypothesis === 'A' ? { x: -0.08, y: 0.12, z: 0 } : { x: 0, y: 0, z: 0 },
          ballRadius: 0.72,
          skeletonStart: { x: -0.9, y: -0.3, z: 0 },
          skeletonEnd: { x: 0.9, y: 0.3, z: 0 },
          skeletonRadius: 0.16,
        },
        collisionParameters,
        { x: 0.15, y: hypothesis === 'A' ? -1 : 0.4, z: 0.08 },
      );
      setLastCollision({ area: event.contactArea, energy: event.energyRelease, collided: event.collided });

      const seed = Date.now() % 1_000_000;
      const captures = createMockCameraCaptures(seed, event.contactArea, event.energyRelease + stress * 2);
      const matrix = build48Matrix(captures);
      const luminance = sampleContactLuminance(event.contactArea, event.energyRelease);
      const record = {
        hypothesis,
        capturedAt: new Date().toISOString(),
        timeframe,
        stress,
        collisionParameters,
        contactArea: event.contactArea,
        contactLuminance: luminance,
        energy: matrix.energy,
        polarity: matrix.polarity,
        targetOffset: matrix.targetOffset,
        captures,
        matrix: matrix.cells,
      };
      const digest = await hashExperimentRecord(record);
      recordExperiment({
        id: `${seed}-${hypothesis}`,
        hypothesis,
        createdAt: record.capturedAt,
        digest,
        polarity: matrix.polarity,
        energy: matrix.energy,
        targetOffset: matrix.targetOffset,
        contactArea: event.contactArea,
        contactLuminance: luminance.mean,
      }, matrix);
      setTriggerId((value) => value + 1);
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : 'Experiment capture failed.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#05070d] p-5 text-slate-100 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300">Cure API / Retrogrid Multiview Lab</p>
            <h1 className="mt-1 text-2xl font-semibold">Dual Hypothesis Simulator</h1>
          </div>
          <nav className="flex gap-2 text-xs">
            <a href="/cure-api" className="border border-white/15 px-3 py-2 hover:border-cyan-200/50">Cure menu</a>
            <a href="/matrix" className="border border-white/15 px-3 py-2 hover:border-cyan-200/50">48 Matrix</a>
            <a href="/knot-chart" className="border border-white/15 px-3 py-2 hover:border-cyan-200/50">Knot Chart</a>
          </nav>
        </header>

        <p className="rounded border border-amber-300/20 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80">
          Research visualization only. Motion, camera observations, trend polarity and target offset are generated simulations,
          not measured market data, trading signals, orders, or predictions of actual prices. SHA-256 below is a tamper-evident
          digest, not encryption; records are persisted locally in this browser.
        </p>

        <div className="flex flex-wrap gap-2">
          {([
            ['A', 'Hypothesis A · skeleton collision / lightning'],
            ['B', 'Hypothesis B · vacuum tube / egg breakout'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setHypothesis(id); setSimulationMode(id === 'A' ? 'hypothesisA' : 'hypothesisB'); }} className={`border px-4 py-2 text-xs ${hypothesis === id ? 'border-cyan-200/60 bg-cyan-200/10 text-cyan-100' : 'border-white/10 text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-xl border border-cyan-200/15 bg-black">
            <div className="h-[420px] sm:h-[520px]">
              <HypothesisCanvas
                hypothesis={hypothesis}
                pattern={pattern}
                speed={speed}
                stress={stress}
                fracture={Math.min(1, stress * 0.72 + (lastCollision?.collided ? 0.28 : 0))}
                freezeFrame={hypothesis === 'B' ? freezeFrame : 0}
                triggerId={triggerId}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3 text-xs">
              <span className="text-slate-400">{hypothesis === 'A' ? 'Collision SDF / intersection + difference visualization' : 'Vacuum tube / stress fracture / 22 camera viewpoints'}</span>
              <button type="button" onClick={() => void capture()} disabled={isCapturing || (hypothesis === 'B' && stress < 0.72)} className="border border-cyan-200/40 bg-cyan-100/10 px-4 py-2 text-cyan-100 hover:bg-cyan-100/20 disabled:opacity-50">
                {isCapturing ? 'Capturing…' : hypothesis === 'A' ? 'Run collision & capture' : 'Trigger laser / capture 22 views'}
              </button>
            </div>
          </section>

          <aside className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <label className="flex justify-between text-xs">Simulation speed <span>{speed.toFixed(1)}×</span></label>
              <input aria-label="Simulation speed" className="mt-2 w-full accent-cyan-300" type="range" min="0" max="100" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
              <div className="flex justify-between text-[9px] text-slate-600"><span>0× freeze</span><span>100× fast-forward</span></div>
            </div>

            {hypothesis === 'A' ? (
              <>
                <div>
                  <p className="mb-2 text-xs text-slate-300">WebGL graph generator</p>
                  <div className="grid grid-cols-2 gap-1">
                    {PATTERNS.map((item) => <button key={item.id} type="button" onClick={() => setPattern(item.id)} className={`border px-2 py-2 text-[10px] ${pattern === item.id ? 'border-orange-300/60 bg-orange-300/10 text-orange-100' : 'border-white/10 text-slate-400'}`}>{item.label}</button>)}
                  </div>
                </div>
                <Parameter label="Friction" value={collisionParameters.friction} onChange={(value) => setCollisionParameter('friction', value)} />
                <Parameter label="Gravity well" value={collisionParameters.gravityWell} onChange={(value) => setCollisionParameter('gravityWell', value)} />
                <Parameter label="Fractal restitution" value={collisionParameters.fractalRestitution} onChange={(value) => setCollisionParameter('fractalRestitution', value)} />
              </>
            ) : (
              <>
                <div className="rounded border border-cyan-100/10 p-3">
                  <p className="text-xs text-slate-300">Freeze-frame scanner</p>
                  <input aria-label="Freeze frame position" className="mt-2 w-full accent-fuchsia-300" type="range" min="0" max="1" step="0.001" value={freezeFrame} onChange={(event) => setFreezeFrame(Number(event.target.value))} />
                  <div className="flex items-center justify-between text-[9px] text-slate-500"><span>Live</span><span>Frame {freezeFrame.toFixed(3)}</span><button type="button" onClick={() => setFreezeFrame(freezeFrame > 0 ? 0 : 0.5)} className="text-fuchsia-200">{freezeFrame > 0 ? 'Resume' : 'Freeze'}</button></div>
                </div>
                <Parameter label="Shell stress / volatility proxy" value={stress} onChange={setStress} />
                <div className={`rounded border p-3 text-xs ${stress >= 0.72 ? 'border-rose-300/50 text-rose-200' : 'border-white/10 text-slate-400'}`}>
                  {stress >= 0.72 ? 'Critical shell stress · trigger is available' : `Below visual trigger threshold · ${(stress * 100).toFixed(0)}%`}
                </div>
                <p className="text-[9px] text-slate-500">Laser capture is enabled only above the stress threshold.</p>
              </>
            )}

            {lastCollision && (
              <div className="rounded border border-white/10 p-3 text-[10px] text-slate-400">
                <p>Contact: {lastCollision.collided ? 'DETECTED' : 'NONE'}</p>
                <p>Approx. area: {lastCollision.area.toFixed(4)} · energy proxy: {lastCollision.energy.toFixed(4)}</p>
              </div>
            )}
            {feedbackError && <p role="alert" className="text-xs text-rose-300">{feedbackError}</p>}
          </aside>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm">48-cell matrix reconstruction</h2>
              <p className="text-[10px] text-slate-500">22 synthetic camera captures → Fibonacci sphere bins · simulated direction only</p>
            </div>
            {latestMatrix && <p className="font-mono text-xs text-cyan-100">{latestMatrix.polarity} · energy {latestMatrix.energy.toFixed(2)} · offset {latestMatrix.targetOffset.toFixed(3)}</p>}
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-12 md:grid-cols-16">
            {Array.from({ length: 48 }, (_, id) => {
              const cell = latestMatrix?.cells[id];
              const strength = cell ? Math.min(1, cell.energy / Math.max(1, latestMatrix.energy / 8)) : 0.08;
              return <div key={id} title={cell ? `Cell ${id} · ${cell.sigil} · ${cell.polarity} · energy ${cell.energy.toFixed(3)} · ${cell.cameraCoverage}/22 views` : `Cell ${id} · awaiting capture`} className="flex aspect-square items-center justify-center rounded border border-white/10 font-mono text-[9px]" style={{ color: cell?.polarity === 'LONG' ? '#67e8f9' : '#fda4af', backgroundColor: cell ? cell.polarity === 'LONG' ? `rgba(34,211,238,${0.08 + strength * 0.4})` : `rgba(251,113,133,${0.08 + strength * 0.4})` : 'rgba(255,255,255,0.025)' }}>{cell ? cell.arcanaId : id}</div>;
            })}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h2 className="text-sm">Local experiment digest ledger</h2>
          <p className="mb-2 text-[10px] text-slate-500">SHA-256 integrity digest; luminance is sampled from an analytic mask (not GPU readback). Not encryption or a server-side record.</p>
          {experimentFeedback.length === 0 ? <p className="text-xs text-slate-600">No captures yet.</p> : (
            <div className="space-y-2">
              {experimentFeedback.slice(0, 5).map((item) => (
                <div key={item.id} className="grid gap-1 border-t border-white/5 pt-2 text-[10px] sm:grid-cols-[1fr_auto]">
                  <span>{item.hypothesis === 'A' ? 'Collision' : 'Egg breakout'} · {item.polarity} · energy {item.energy.toFixed(3)} · contact {item.contactArea.toFixed(3)} · luminance {typeof item.contactLuminance === 'number' ? item.contactLuminance.toFixed(3) : 'N/A (legacy record)'}</span>
                  <time className="text-slate-500">{new Date(item.createdAt).toLocaleTimeString()}</time>
                  <code className="break-all text-cyan-300/60 sm:col-span-2">{item.digest}</code>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-100/15 bg-cyan-100/[0.025] p-4">
          <div>
            <h2 className="text-sm">KNOT INVENTORY / decoherence gate</h2>
            <p className="mt-1 text-[10px] text-slate-500">
              {unlockedPredictionCell >= 0 ? `Next simulated cell ${String(unlockedPredictionCell + 1).padStart(2, '0')} is unlocked by Layer D observation.` : 'Touch the red singularity on /cure-api to resolve a direction vector and unlock the next cell.'}
            </p>
            <p className="mt-1 text-[9px] text-slate-600">Projection ledger blocks: {projectionBlocks.length} · local digest metadata only.</p>
          </div>
          <a href="/knot-chart" className={`border px-3 py-2 text-xs ${unlockedPredictionCell >= 0 ? 'border-cyan-200/50 text-cyan-100 hover:bg-cyan-100/10' : 'border-white/10 text-slate-500'}`}>
            {unlockedPredictionCell >= 0 ? `Open cell ${String(unlockedPredictionCell + 1).padStart(2, '0')}` : 'Open Knot Chart'}
          </a>
        </section>
      </div>
    </main>
  );
}

function Parameter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-slate-300">{label}<span className="float-right font-mono">{value.toFixed(2)}</span>
      <input className="mt-2 w-full accent-orange-300" type="range" min="0" max="1" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
