'use client';

import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, type PointerEvent } from 'react';
import * as THREE from 'three';
import { useCureAPIStore, type ProjectionVector } from '@/lib/cureApiStore';
import { calculateVortexBpm, digestProjectionSnapshot, Gravity } from '@/lib/cureProjection';

type ProjectionMetrics = {
  bpm: number;
  sliceTilt: number;
  lensScroll: number;
  noise: number;
};

function MatrixField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setProjectionMetrics = useCureAPIStore((state) => state.setProjectionMetrics);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const side = 11;
    const size = 330;
    const cell = size / side;
    let frame = 0;
    let lastBpm = 0;

    const draw = (now: number) => {
      context.clearRect(0, 0, size, size);
      for (let y = 0; y < side; y += 1) {
        for (let x = 0; x < side; x += 1) {
          const cornerDistance = Math.min(
            Math.hypot(x, y),
            Math.hypot(side - 1 - x, y),
            Math.hypot(x, side - 1 - y),
            Math.hypot(side - 1 - x, side - 1 - y),
          );
          const phase = now * 0.001 + cornerDistance * Gravity * 12;
          const pulse = 0.12 + Math.abs(Math.sin(phase)) * 0.56;
          const corner = x < side / 2 ? (y < side / 2 ? '#fbbf24' : '#22d3ee') : (y < side / 2 ? '#a78bfa' : '#fb7185');
          context.fillStyle = corner;
          context.globalAlpha = pulse;
          context.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
          context.globalAlpha = 1;
          context.strokeStyle = 'rgba(255,255,255,.13)';
          context.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
        }
      }
      const bpm = calculateVortexBpm(now);
      if (bpm !== lastBpm) {
        lastBpm = bpm;
        setProjectionMetrics({ bpm });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [setProjectionMetrics]);

  return <canvas ref={canvasRef} width={330} height={330} className="h-full w-full" aria-label="11 by 11 vortex matrix" />;
}

function LensBackdrop({ metrics }: { metrics: ProjectionMetrics }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: metrics.lensScroll },
      uNoise: { value: metrics.noise },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScroll;
      uniform float uNoise;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float radius = length(p);
        float lens = 1.0 + (0.12 + uScroll * 0.34) * exp(-radius * 4.0);
        vec2 warped = p * lens;
        float grid = step(0.94, fract((warped.x + 0.5) * 22.0)) + step(0.94, fract((warped.y + 0.5) * 22.0));
        float shimmer = 0.5 + 0.5 * sin(uTime * 1.8 + warped.y * 35.0);
        vec3 color = mix(vec3(0.02, 0.12, 0.18), vec3(0.1, 0.48, 0.55), shimmer * 0.32 + uNoise * 0.2);
        color += vec3(0.18, 0.58, 0.75) * min(grid, 1.0) * 0.13;
        gl_FragColor = vec4(color, 0.72);
      }
    `,
  }), []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uScroll.value = metrics.lensScroll;
    material.uniforms.uNoise.value = metrics.noise;
  });
  return (
    <mesh position={[0, 0, -1.5]} material={material}>
      <planeGeometry args={[7, 5]} />
    </mesh>
  );
}

function SliceStack({ metrics }: { metrics: ProjectionMetrics }) {
  const groupRef = useRef<THREE.Group>(null);
  const simulationMode = useCureAPIStore((state) => state.simulationMode);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const target = (simulationMode === 'hypothesisB' ? 0.22 : 0.035) + metrics.sliceTilt * 0.4;
    groupRef.current.rotation.x += (target + Math.sin(clock.elapsedTime * metrics.bpm / 60) * 0.06 - groupRef.current.rotation.x) * 0.04;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.08;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 22 }, (_, index) => (
        <Slice key={index} index={index} metrics={metrics} />
      ))}
    </group>
  );
}

function Slice({ index, metrics }: { index: number; metrics: ProjectionMetrics }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIndex: { value: index },
      uNoise: { value: metrics.noise },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIndex;
      uniform float uNoise;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p);
        float ring = smoothstep(0.43, 0.34, abs(r - (0.14 + mod(uIndex, 6.0) * 0.045)));
        float pulse = 0.4 + 0.6 * sin(uTime * 1.8 + uIndex * 0.31);
        float alpha = ring * (0.09 + pulse * 0.12 + uNoise * 0.08);
        gl_FragColor = vec4(0.27, 0.83, 0.97, alpha);
      }
    `,
  }), [index]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uNoise.value = metrics.noise;
  });
  return (
    <mesh position={[0, 0, -0.5 + index * 0.045]} scale={1 - index * 0.009} material={material}>
      <circleGeometry args={[1.3, 64]} />
    </mesh>
  );
}

function BurstParticles() {
  const decoherenceNonce = useCureAPIStore((state) => state.decoherenceNonce);
  const decoherenceVector = useCureAPIStore((state) => state.decoherenceVector);
  const previousNonce = useRef(decoherenceNonce);
  const geometry = useMemo(() => {
    const count = 384;
    const directions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const y = 1 - (index / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      directions[index * 3] = Math.cos(angle) * radius;
      directions[index * 3 + 1] = y;
      directions[index * 3 + 2] = Math.sin(angle) * radius;
      speeds[index] = 0.35 + (index % 11) * 0.09;
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
    result.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    return result;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uElapsed: { value: 0 },
      uBurstTime: { value: -10 },
      uActive: { value: 0 },
      uVector: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: `
      attribute vec3 aDirection;
      attribute float aSpeed;
      uniform float uElapsed;
      uniform float uBurstTime;
      uniform float uActive;
      uniform vec3 uVector;
      varying float vLife;
      void main() {
        float age = max(0.0, uElapsed - uBurstTime);
        vec3 positionBurst = aDirection * age * aSpeed + uVector * age * 0.8;
        vec4 mvPosition = modelViewMatrix * vec4(positionBurst, 1.0);
        vLife = uActive * max(0.0, 1.0 - age / 1.8);
        gl_PointSize = (2.0 + mod(aSpeed * 9.0, 4.0)) * vLife * (300.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vLife;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float sparkle = 0.65 + 0.35 * sin((gl_FragCoord.x + gl_FragCoord.y) * 0.17);
        float alpha = smoothstep(0.5, 0.12, r) * vLife * sparkle;
        gl_FragColor = vec4(0.65, 0.93, 1.0, alpha);
      }
    `,
  }), []);
  useFrame(({ clock }) => {
    material.uniforms.uElapsed.value = clock.elapsedTime;
    if (previousNonce.current !== decoherenceNonce) {
      previousNonce.current = decoherenceNonce;
      material.uniforms.uBurstTime.value = clock.elapsedTime;
      material.uniforms.uActive.value = 1;
      const vector = decoherenceVector ?? [0, 0, 0];
      (material.uniforms.uVector.value as THREE.Vector3).set(vector[0], vector[1], vector[2]);
    }
  });
  return <points geometry={geometry} material={material} />;
}

function ProjectionScene({ metrics }: { metrics: ProjectionMetrics }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <LensBackdrop metrics={metrics} />
      <SliceStack metrics={metrics} />
      <BurstParticles />
      <EffectComposer>
        <Bloom intensity={0.65} luminanceThreshold={0.22} luminanceSmoothing={0.25} />
      </EffectComposer>
    </>
  );
}

function ObserverOverlay({ onObserve, vector }: { onObserve: (vector: ProjectionVector) => void; vector: ProjectionVector | null }) {
  const pathRef = useRef<SVGPathElement>(null);
  const points = useRef<Array<{ x: number; y: number }>>([]);
  const wasNearSingularity = useRef(false);
  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const point = { x: x * 1000, y: y * 600 };
    if (pathRef.current) {
      points.current = [...points.current.slice(-78), point];
      pathRef.current.setAttribute('d', points.current.map(({ x: px, y: py }, index) => `${index === 0 ? 'M' : 'L'} ${px} ${py}`).join(' '));
    }

    const dx = x - 0.5;
    const dy = y - 0.5;
    const near = Math.hypot(dx, dy) < 0.075;
    if (near && !wasNearSingularity.current) {
      const length = Math.hypot(dx, dy);
      const directionX = length < 0.001 ? 1 : dx / length;
      const directionY = length < 0.001 ? 0 : dy / length;
      onObserve([Number(directionX.toFixed(4)), Number(directionY.toFixed(4)), Number((1 - Math.hypot(dx, dy)).toFixed(4))]);
    }
    wasNearSingularity.current = near;
  }, [onObserve]);

  const vectorEnd = vector ? `${500 + vector[0] * 180} ${300 + vector[1] * 180}` : '500 300';
  return (
    <svg
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      className="absolute inset-0 z-[7] h-full w-full touch-none"
      aria-label="Observer pointer field; move across the red singularity to collapse the simulated vector"
      onPointerMove={onPointerMove}
      onPointerLeave={() => { points.current = []; wasNearSingularity.current = false; }}
    >
      <path ref={pathRef} fill="none" stroke="rgba(226,232,240,.42)" strokeWidth="2" strokeDasharray="4 7" />
      {vector && <line x1="500" y1="300" x2={vectorEnd.split(' ')[0]} y2={vectorEnd.split(' ')[1]} stroke="#67e8f9" strokeWidth="3" className="animate-pulse" />}
      <circle cx="500" cy="300" r="13" fill="#ef4444" className="drop-shadow-[0_0_16px_rgba(248,113,113,.9)]" />
      <circle cx="500" cy="300" r="28" fill="none" stroke="rgba(248,113,113,.4)" strokeDasharray="3 7" />
    </svg>
  );
}

export default function CureProjectionEngine() {
  const simulationMode = useCureAPIStore((state) => state.simulationMode);
  const metrics = useCureAPIStore((state) => state.projectionMetrics);
  const setProjectionMetrics = useCureAPIStore((state) => state.setProjectionMetrics);
  const appendProjectionBlock = useCureAPIStore((state) => state.appendProjectionBlock);
  const observeSingularity = useCureAPIStore((state) => state.observeSingularity);
  const projectionBlocks = useCureAPIStore((state) => state.projectionBlocks);
  const decoherenceVector = useCureAPIStore((state) => state.decoherenceVector);
  const decoherenceNonce = useCureAPIStore((state) => state.decoherenceNonce);
  const unlockedPredictionCell = useCureAPIStore((state) => state.unlockedPredictionCell);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const handleObserve = useCallback((vector: ProjectionVector) => {
    observeSingularity(vector);
    setProjectionMetrics({ noise: Math.min(1, metricsRef.current.noise + 0.32) });
  }, [observeSingularity, setProjectionMetrics]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const storeState = useCureAPIStore.getState();
      const previousDigest = storeState.projectionBlocks[0]?.digest ?? 'GENESIS';
      const snapshot = { ...metricsRef.current, mode: storeState.simulationMode, previousDigest, timestamp: Date.now() };
      void digestProjectionSnapshot(snapshot).then((digest) => {
        appendProjectionBlock({
          id: `${snapshot.timestamp}`,
          createdAt: snapshot.timestamp,
          digest,
          previousDigest,
          bpm: snapshot.bpm,
          sliceTilt: snapshot.sliceTilt,
          lensScroll: snapshot.lensScroll,
          noise: snapshot.noise,
        });
      }).catch((error: unknown) => console.error('Projection ledger digest failed', error));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [appendProjectionBlock]);

  return (
    <section className="relative z-[4] grid gap-3 overflow-hidden rounded-lg border border-cyan-100/15 bg-[#050910]/90 p-3 lg:grid-cols-[minmax(15rem,.82fr)_minmax(16rem,1fr)_minmax(15rem,.8fr)]" aria-label="Cure API four-layer projection engine">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-200/70">Layer A / static matrix · four-corner vortex</p>
            <p className="mt-1 font-mono text-xs text-stone-300">{metrics.bpm} BPM <span className="text-stone-600">/ Gravity {Gravity.toFixed(3)}</span></p>
          </div>
          <span className="rounded-full border border-cyan-100/20 px-2 py-1 text-[8px] text-cyan-100">11×11 · 121</span>
        </div>
        <div className="aspect-square max-w-[330px] border border-white/10 bg-black/50"><MatrixField /></div>
        <p className="text-[9px] text-stone-600">Corner vortex phase generates tempo; cell pulse is a visual parameter, not market data.</p>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-200/70">Layer B / vacuum fluid slices</p>
            <p className="mt-1 font-mono text-[10px] text-stone-500">{simulationMode === 'hypothesisB' ? '22 Z slices · extend projection' : 'hypothesis A · compact projection'}</p>
          </div>
          <span className="rounded-full border border-cyan-100/20 px-2 py-1 text-[8px] text-cyan-100">22</span>
        </div>
        <div className="relative h-[260px] overflow-hidden border border-white/10 bg-black/50">
          <Canvas camera={{ position: [0, 0, 4], fov: 48 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: false }}>
            <ProjectionScene metrics={metrics} />
          </Canvas>
          <div className="pointer-events-none absolute bottom-2 left-2 z-[6] font-mono text-[8px] uppercase tracking-widest text-cyan-100/60">
            {simulationMode === 'hypothesisB' ? 'VACUUM / 22-SLICE EXTEND' : 'COLLISION / EXPAND'} · {metrics.bpm} BPM
          </div>
        </div>
        <label className="flex items-center gap-2 text-[9px] text-stone-500">
          Slice tilt
          <input aria-label="Slice tilt" type="range" min="0" max="1" step="0.01" value={metrics.sliceTilt} onChange={(event) => setProjectionMetrics({ sliceTilt: Number(event.target.value) })} className="flex-1 accent-cyan-300" />
          <span className="font-mono">{metrics.sliceTilt.toFixed(2)}</span>
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-cyan-200/70">Layer C / holographic lenses</p>
            <p className="mt-1 text-[9px] text-stone-600">Scroll to bend the screen-space lens</p>
          </div>
          <span className="rounded-full border border-cyan-100/20 px-2 py-1 text-[8px] text-cyan-100">22 frames</span>
        </div>
        <div
          className="grid max-h-[260px] grid-cols-2 gap-1 overflow-y-auto border border-white/10 bg-black/50 p-2"
          onScroll={(event) => {
            const element = event.currentTarget;
            const max = element.scrollHeight - element.clientHeight;
            const scroll = max > 0 ? element.scrollTop / max : 0;
            setProjectionMetrics({ lensScroll: scroll });
          }}
          aria-label="Scrollable 22-angle lens frames"
        >
          {Array.from({ length: 22 }, (_, index) => (
            <div key={index} className="relative flex h-16 items-end justify-between overflow-hidden border border-cyan-100/20 bg-[radial-gradient(ellipse_at_50%_35%,rgba(34,211,238,.18),transparent_60%)] p-1.5">
              <span className="font-mono text-[8px] text-cyan-100/80">ANGLE {String(index + 1).padStart(2, '0')}</span>
              <span className="font-mono text-[7px] text-stone-600">{(index * 360 / 22).toFixed(1)}°</span>
              <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/25" />
            </div>
          ))}
        </div>
        <p className="text-[9px] text-stone-600">Lens warp is a local shader visualization; scroll {Math.round(metrics.lensScroll * 100)}%.</p>
      </div>

      <div className="relative min-h-28 overflow-hidden rounded border border-rose-100/15 bg-black/40 lg:col-span-3">
        <p className="pointer-events-none absolute left-2 top-2 z-[8] text-[9px] uppercase tracking-[0.24em] text-rose-200/70">Layer D / observer field · touch singularity</p>
        <div className="pointer-events-none absolute inset-0 z-[2] opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(248,113,113,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(248,113,113,.18) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <svg viewBox="0 0 1000 600" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-[3] h-full w-full opacity-40" aria-hidden="true">
          <path d="M500 300 700 300 562 490 620 110 380 490 438 110 300 300Z" fill="none" stroke="#f87171" strokeDasharray="5 9" />
        </svg>
        <ObserverOverlay onObserve={handleObserve} vector={decoherenceVector} />
        <div className="pointer-events-none absolute bottom-2 left-2 z-[8] font-mono text-[8px] text-stone-500">
          {decoherenceVector ? `DECOHERENCE [${decoherenceVector.map((value) => value.toFixed(2)).join(', ')}] · simulated one-time vector` : 'Entangled field · move pointer through the center'}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[9px] lg:col-span-3">
        <div className="flex items-center gap-3 text-stone-500">
          <span>Local projection ledger · {projectionBlocks.length} blocks</span>
          <span>Digest = integrity metadata, not encryption or blockchain consensus.</span>
        </div>
        <div className="flex items-center gap-2 text-cyan-100">
          <span>KNOT INVENTORY · {unlockedPredictionCell >= 0 ? `cell ${String(unlockedPredictionCell + 1).padStart(2, '0')} unlocked` : 'awaiting observation'}{decoherenceNonce > 0 ? ` · observation ${decoherenceNonce}` : ''}</span>
          {unlockedPredictionCell >= 0 && <a className="border border-cyan-100/30 px-2 py-1 hover:bg-cyan-100/10" href="/knot-chart">Open inventory →</a>}
        </div>
        {projectionBlocks[0] && <code className="max-w-full truncate text-[8px] text-stone-600">{projectionBlocks[0].digest}</code>}
      </div>
    </section>
  );
}
