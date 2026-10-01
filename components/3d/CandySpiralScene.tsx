'use client';

import { OrbitControls, Text } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  LAYER_COLORS,
  LAYER_CONFIG,
  generateLocalCandyPoints,
  type CandyPoint,
  type CandyPointsResponse,
} from '@/lib/candyPoints';
import { CandyInstancedMesh, CyberpunkPriceSphere } from './CandySpiralMesh';

type CandySpiralSceneProps = {
  currentPrice?: number;
  symbol?: string;
  className?: string;
  height?: number;
  wuxingPhase?: string;
};

function SpiralGuideLines({ radius = 2.0 }: { radius?: number }) {
  const lineObjects = useMemo(() => {
    const layers: CandyPoint['layer'][] = ['surge', 'continuation', 'range', 'plunge'];
    return layers.map((layer) => {
      const config = LAYER_CONFIG[layer];
      const drift = Math.tanh(config.slope);
      const points: THREE.Vector3[] = [];
      const steps = 140;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const phi = config.phase + 2 * Math.PI * 3.0 * t;
        const zStar = drift * t;
        const rXy = Math.sqrt(Math.max(0, 1 - zStar * zStar));
        const growth = 1.0 + config.rangeFactor * 0.45 * t;
        const r = radius * growth;
        points.push(new THREE.Vector3(rXy * Math.cos(phi) * r, zStar * r, rXy * Math.sin(phi) * r));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: LAYER_COLORS[layer].base,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
      return {
        layer,
        line: new THREE.Line(geometry, material),
      };
    });
  }, [radius]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.24;
    }
  });

  return (
    <group ref={groupRef}>
      {lineObjects.map(({ layer, line }) => (
        <primitive key={layer} object={line} />
      ))}
    </group>
  );
}

function FloatingPriceTag({ price, radius = 2.0 }: { price?: number; radius?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) {
      ref.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group ref={ref} position={[0, radius * 1.55, 0]}>
      <Text
        fontSize={0.24}
        color="#00f5ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="#020617"
      >
        {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Pt / LIVE PRICE'}
      </Text>
      <Text
        position={[0, -0.2, 0]}
        fontSize={0.095}
        color="#f8fafc"
        fillOpacity={0.65}
        anchorX="center"
        anchorY="middle"
      >
        48 CELLS • 384 CANDY KNOTS
      </Text>
    </group>
  );
}

export default function CandySpiralScene({
  currentPrice = 65420.0,
  symbol = 'BTCUSD',
  className,
  height = 580,
  wuxingPhase = 'WATER',
}: CandySpiralSceneProps) {
  const [candies, setCandies] = useState<CandyPoint[]>(() => generateLocalCandyPoints(currentPrice, 2.0, 3.0));
  const [hoveredCandy, setHoveredCandy] = useState<CandyPoint | null>(null);
  const [orbitSpeed, setOrbitSpeed] = useState(0.24);
  const [spinSpeed, setSpinSpeed] = useState(1.8);
  const [showSpirals, setShowSpirals] = useState(true);
  const [isAutoRotate, setIsAutoRotate] = useState(true);

  // Fetch true gravity candy points from backend
  useEffect(() => {
    let canceled = false;
    const fetchPoints = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/candy-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_price: currentPrice,
            radius: 2.0,
            turns: 3.0,
          }),
        });
        if (!response.ok) return;
        const data: CandyPointsResponse = await response.json();
        if (!canceled && data.candies && data.candies.length === 384) {
          setCandies(data.candies);
        }
      } catch {
        // Retain client-generated 384 points on network failure
      }
    };

    fetchPoints();
    return () => {
      canceled = true;
    };
  }, [currentPrice]);

  return (
    <div
      className={className ?? 'relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#020611] shadow-[0_0_80px_rgba(6,182,212,0.12)]'}
      style={{ height }}
    >
      {/* 3D WebGL Canvas */}
      <Canvas
        camera={{ position: [0, 1.2, 6.2], fov: 45, near: 0.1, far: 100 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#020611']} />
        <fog attach="fog" args={['#020611', 8, 26]} />

        {/* Ambient & Studio Cyberpunk Lights */}
        <ambientLight intensity={0.55} />
        <pointLight position={[5, 6, 5]} intensity={24} distance={22} color="#ffffff" />
        <pointLight position={[-5, -4, -4]} intensity={18} distance={20} color="#00f5ff" />
        <pointLight position={[0, 8, 0]} intensity={15} distance={18} color="#ffd700" />
        <pointLight position={[0, -6, 2]} intensity={12} distance={15} color="#ec4899" />

        {/* Orbit controls */}
        <OrbitControls
          autoRotate={isAutoRotate}
          autoRotateSpeed={0.35}
          enableDamping
          dampingFactor={0.06}
          minDistance={3.5}
          maxDistance={12.0}
        />

        {/* Center Price Sphere with 48 inner cells */}
        <CyberpunkPriceSphere
          radius={2.0}
          price={currentPrice}
          symbol={symbol}
          wuxingPhase={wuxingPhase}
        />

        {/* Floating price header tag */}
        <FloatingPriceTag price={currentPrice} radius={2.0} />

        {/* 4 prediction spiral guide curves */}
        {showSpirals && <SpiralGuideLines radius={2.0} />}

        {/* 384 Candy InstancedMesh with DNA self-rotation & orbit */}
        <CandyInstancedMesh
          candies={candies}
          radius={2.0}
          orbitSpeed={orbitSpeed}
          spinSpeed={spinSpeed}
          onHoverCandy={setHoveredCandy}
        />
      </Canvas>

      {/* Top HUD overlay */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1 font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-200/80">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          48-CELL FIBONACCI LATTICE • 384 CANDY KNOTS
        </span>
        <span className="text-[8px] tracking-[0.16em] text-stone-500">
          SURGE / CONTINUATION / RANGE / PLUNGE (4 SPIRALS × 2 POLES)
        </span>
      </div>

      {/* Top right timeline layer pill indicators */}
      <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2">
        {(['surge', 'continuation', 'range', 'plunge'] as const).map((layer) => {
          const color = LAYER_COLORS[layer];
          return (
            <div
              key={layer}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] backdrop-blur-md"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.base }} />
              <span className="text-stone-300">{layer}</span>
            </div>
          );
        })}
      </div>

      {/* Bottom left hover candy inspector */}
      {hoveredCandy && (
        <div className="absolute bottom-4 left-4 z-10 w-64 rounded-xl border border-cyan-400/30 bg-black/85 p-3.5 font-mono text-[10px] text-stone-200 shadow-[0_0_24px_rgba(0,245,255,0.2)] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-cyan-300 font-bold">{hoveredCandy.id}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-semibold"
              style={{
                backgroundColor: `${LAYER_COLORS[hoveredCandy.layer].base}25`,
                color: LAYER_COLORS[hoveredCandy.layer].base,
              }}
            >
              {hoveredCandy.direction}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-[9px] text-stone-400">
            <div className="flex justify-between">
              <span>Tarot Archetype:</span>
              <span className="text-stone-200">{hoveredCandy.tarot.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Probability:</span>
              <span className="text-emerald-400 font-bold">{(hoveredCandy.probability * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Cell / Pole:</span>
              <span className="text-stone-200">#{hoveredCandy.cell_index} ({hoveredCandy.pole})</span>
            </div>
            <div className="flex justify-between">
              <span>Spiral parameter (t):</span>
              <span className="text-stone-300">{hoveredCandy.t.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom right interactive speed & toggle controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 font-mono text-[9px]">
        <button
          type="button"
          onClick={() => setShowSpirals((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 uppercase transition ${
            showSpirals ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200' : 'border-white/10 bg-black/50 text-stone-500'
          }`}
        >
          Spirals {showSpirals ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => setIsAutoRotate((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 uppercase transition ${
            isAutoRotate ? 'border-amber-400/50 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-black/50 text-stone-500'
          }`}
        >
          Auto-Spin {isAutoRotate ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => setOrbitSpeed((v) => (v > 0.4 ? 0.12 : v + 0.12))}
          className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 uppercase text-stone-300 hover:border-cyan-400/40"
        >
          Orbit: {orbitSpeed.toFixed(2)}x
        </button>
      </div>
    </div>
  );
}
