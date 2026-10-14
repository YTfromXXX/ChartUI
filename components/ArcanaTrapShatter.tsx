'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { cellRect, computeProjectionGrid } from '@/lib/projectionGrid';
import { useArcanaTraps } from '@/hooks/useArcanaTraps';

const TACTIC_COLORS = ['#38bdf8', '#f8d66d', '#fb7185', '#a78bfa'];
const SHARD_COUNT = 36;
const BURST_DURATION_MS = 760;

function ShatterBurst({ color, onDone }: { color: string; onDone: () => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startedAt = useRef(performance.now());
  const directions = useMemo(
    () =>
      Array.from({ length: SHARD_COUNT }, (_, index) => {
        const angle = (index / SHARD_COUNT) * Math.PI * 2 + Math.sin(index) * 0.4;
        const speed = 1.5 + (index % 7) * 0.3;
        return new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.sin(index * 3.1) - 0.5) * speed);
      }),
    [],
  );

  useFrame(() => {
    const elapsed = performance.now() - startedAt.current;
    const progress = Math.min(elapsed / BURST_DURATION_MS, 1);
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    directions.forEach((direction, index) => {
      position.copy(direction).multiplyScalar(progress);
      const shardScale = 0.16 * (1 - progress * 0.72);
      scale.set(shardScale, shardScale, shardScale);
      matrix.compose(position, new THREE.Quaternion().setFromAxisAngle(direction.clone().normalize(), progress * 6), scale);
      meshRef.current?.setMatrixAt(index, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (progress >= 1) onDone();
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SHARD_COUNT]}>
      <tetrahedronGeometry args={[0.5]} />
      <meshBasicMaterial color={color} transparent opacity={0.92} />
    </instancedMesh>
  );
}

/**
 * Transient WebGL shatter effect for a plane whose armed trap has fired
 * (breakout or deceleration). One small orthographic R3F canvas is mounted
 * per event, positioned over its cell, and unmounts itself once the burst
 * finishes animating.
 */
export default function ArcanaTrapShatter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const events = useArcanaTraps((state) => state.events);
  const acknowledgeEvent = useArcanaTraps((state) => state.acknowledgeEvent);

  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return undefined;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
  }, []);

  const metrics = computeProjectionGrid(size.width, size.height);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      {events.map((event) => {
        const rect = cellRect(event.planeIndex, metrics);
        return (
          <div
            key={event.id}
            className="absolute"
            style={{ left: rect.x + rect.width / 2 - 56, top: rect.y + rect.height / 2 - 56, width: 112, height: 112 }}
          >
            <Canvas orthographic camera={{ zoom: 40, position: [0, 0, 10] }} gl={{ alpha: true }}>
              <ambientLight intensity={1.4} />
              <ShatterBurst color={TACTIC_COLORS[event.arcanaId % 4]} onDone={() => acknowledgeEvent(event.id)} />
            </Canvas>
            <p className="absolute inset-x-0 top-full mt-1 text-center font-mono text-[7px] uppercase tracking-wide text-amber-100">
              {event.reason === 'breakout' ? 'BREAKOUT' : 'DECEL TRIGGER'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
