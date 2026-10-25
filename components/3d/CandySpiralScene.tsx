'use client';

import { OrbitControls, Text } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { createXRStore, XR } from '@react-three/xr';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { KnotFieldStyle } from '@/components/2d/KnotChart';
import type { FieldDiagnostics } from '@/lib/fieldModels';
import { ARCANA_ATTRACTORS } from '@/lib/arcanaMatrix';
import { useKnotSelection } from '@/hooks/useKnotSelection';
import {
  LAYER_COLORS,
  LAYER_CONFIG,
  generateLocalCandyPoints,
  type CandyPoint,
  type CandyPointsResponse,
} from '@/lib/candyPoints';
import AnimalIndicators from './AnimalIndicators';
import { AnimalVoxelBackdrop, KumoBand, MetalHoneycombBackdrop } from './FieldBackdrop';
import CandyXRPhysics from './CandyXRPhysics';
import { CandyInstancedMesh, CryptoPointCloud, CyberpunkPriceSphere } from './CandySpiralMesh';

type CandySpiralSceneProps = {
  currentPrice?: number;
  symbol?: string;
  className?: string;
  height?: number;
  wuxingPhase?: string;
  fieldName?: string;
  fieldStyle?: KnotFieldStyle;
  fieldDiagnostics?: FieldDiagnostics;
};

function SpiralEyeCamera({ enabled }: { enabled: boolean }) {
  const wasEnabled = useRef(false);
  const savedPosition = useRef(new THREE.Vector3());
  const savedQuaternion = useRef(new THREE.Quaternion());
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const eyePosition = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame(({ camera, clock }) => {
    if (enabled && !wasEnabled.current) {
      savedPosition.current.copy(camera.position);
      savedQuaternion.current.copy(camera.quaternion);
    }
    if (enabled) {
      camera.position.lerp(eyePosition, 0.12);
      const time = clock.getElapsedTime();
      const yaw = Math.sin(time * 0.12) * 0.16;
      lookTarget.set(Math.sin(yaw), Math.sin(time * 0.09) * 0.08, -Math.cos(yaw));
      camera.lookAt(lookTarget);
    } else if (wasEnabled.current) {
      camera.position.lerp(savedPosition.current, 0.15);
      camera.quaternion.slerp(savedQuaternion.current, 0.15);
    }
    wasEnabled.current = enabled;
  });

  return null;
}

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

function MetalFractureEffect({
  cellIndex,
  intensity,
  eventTimestamp,
  sparkBoost = 0,
}: {
  sparkBoost?: number;
  cellIndex: number;
  intensity: number;
  eventTimestamp: number;
}) {
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const sparkMaterialRef = useRef<THREE.PointsMaterial>(null);
  const flashStart = useRef(-1);
  const flashStrength = useRef(0);
  const lastTimestamp = useRef(0);

  const { boltGeometry, sparkGeometry } = useMemo(() => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - ((cellIndex + 0.5) / 48) * 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = cellIndex * goldenAngle;
    const target = new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial).multiplyScalar(2.12);
    const start = new THREE.Vector3(target.x * 0.45, 4.2, target.z * 0.45);
    const boltPoints: THREE.Vector3[] = [];
    const segments = 22;
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      const envelope = Math.sin(Math.PI * t);
      const jitterX = Math.sin(step * 12.9898 + cellIndex * 78.233) * 0.13 * envelope;
      const jitterZ = Math.cos(step * 7.123 + cellIndex * 31.71) * 0.13 * envelope;
      boltPoints.push(new THREE.Vector3(
        THREE.MathUtils.lerp(start.x, target.x, t) + jitterX,
        THREE.MathUtils.lerp(start.y, target.y, t),
        THREE.MathUtils.lerp(start.z, target.z, t) + jitterZ,
      ));
    }
    const boltVertices: number[] = [];
    for (let step = 0; step < boltPoints.length - 1; step += 1) {
      boltVertices.push(...boltPoints[step].toArray(), ...boltPoints[step + 1].toArray());
      if (step > 3 && step % 5 === 0) {
        const branchEnd = boltPoints[step].clone().add(new THREE.Vector3(
          Math.sin(step * 4.1) * 0.35,
          -0.34,
          Math.cos(step * 3.4) * 0.35,
        ));
        boltVertices.push(...boltPoints[step].toArray(), ...branchEnd.toArray());
      }
    }
    const bolt = new THREE.BufferGeometry();
    bolt.setAttribute('position', new THREE.Float32BufferAttribute(boltVertices, 3));

    const sparkPositions: number[] = [];
    for (let spark = 0; spark < 48; spark += 1) {
      const phase = spark * goldenAngle;
      const spread = 0.04 + ((spark * 17) % 11) * 0.012;
      sparkPositions.push(
        target.x + Math.cos(phase) * spread,
        target.y + Math.sin(phase * 1.7) * spread,
        target.z + Math.sin(phase) * spread,
      );
    }
    const sparks = new THREE.BufferGeometry();
    sparks.setAttribute('position', new THREE.Float32BufferAttribute(sparkPositions, 3));
    return { boltGeometry: bolt, sparkGeometry: sparks };
  }, [cellIndex]);

  useEffect(() => () => {
    boltGeometry.dispose();
    sparkGeometry.dispose();
  }, [boltGeometry, sparkGeometry]);

  useFrame(({ clock }) => {
    if (eventTimestamp > 0 && eventTimestamp !== lastTimestamp.current) {
      lastTimestamp.current = eventTimestamp;
      flashStart.current = clock.getElapsedTime();
      flashStrength.current = THREE.MathUtils.clamp(intensity, 0, 1);
    }
    const age = flashStart.current < 0 ? Number.POSITIVE_INFINITY : clock.getElapsedTime() - flashStart.current;
    const opacity = flashStrength.current * Math.exp(-Math.max(0, age) * 3.4);
    if (lineMaterialRef.current) {
      lineMaterialRef.current.opacity = opacity;
      lineMaterialRef.current.visible = opacity > 0.015;
    }
    if (sparkMaterialRef.current) {
      sparkMaterialRef.current.opacity = opacity * 0.9;
      sparkMaterialRef.current.visible = opacity > 0.02;
      sparkMaterialRef.current.size = 0.035 + opacity * 0.075;
    }
    sparkGeometry.setDrawRange(0, 12 + Math.round(THREE.MathUtils.clamp(sparkBoost, 0, 1) * 36));
  });

  return (
    <group>
      <lineSegments geometry={boltGeometry} renderOrder={1}>
        <lineBasicMaterial ref={lineMaterialRef} color="#fff3bb" transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <points geometry={sparkGeometry} renderOrder={2}>
        <pointsMaterial ref={sparkMaterialRef} color="#ffd166" size={0.08} transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
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
  fieldName,
  fieldStyle,
  fieldDiagnostics,
}: CandySpiralSceneProps) {
  const [candies, setCandies] = useState<CandyPoint[]>(() => generateLocalCandyPoints(currentPrice, 2.0, 3.0));
  const [hoveredCandy, setHoveredCandy] = useState<CandyPoint | null>(null);
  const [hoveredCandyIndex, setHoveredCandyIndex] = useState<number | undefined>();
  const [hoveredParticleSample, setHoveredParticleSample] = useState<number | undefined>();
  const [orbitSpeed, setOrbitSpeed] = useState(0.24);
  const [spinSpeed, setSpinSpeed] = useState(1.8);
  const [showSpirals, setShowSpirals] = useState(true);
  const [spiralEyeMode, setSpiralEyeMode] = useState(false);
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const [isCandyGrabbed, setIsCandyGrabbed] = useState(false);
  const [impactCount, setImpactCount] = useState(0);
  const [xrMode, setXRMode] = useState<XRSessionMode | null>(null);
  const [xrError, setXRError] = useState('');
  // XR v6 mounts its default controller and hand models/pointers from the store configuration.
  const [xrStore] = useState(() => createXRStore({
    handTracking: true,
    controller: true,
    hand: true,
    offerSession: false,
    emulate: false,
  }));

  useEffect(() => xrStore.subscribe((state) => setXRMode(state.mode)), [xrStore]);
  const hoverCandy = (candy: CandyPoint | null, index?: number, particleSample?: number) => {
    setHoveredCandy(candy);
    setHoveredCandyIndex(candy ? index : undefined);
    setHoveredParticleSample(candy ? particleSample : undefined);
  };

  function saveHoveredQuantumState() {
    if (fieldName !== 'crypto' || !hoveredCandy || hoveredCandyIndex === undefined) return;
    const diagnostics = fieldDiagnostics;
    const resonanceId = diagnostics?.cryptoResonanceArcanaId ?? -1;
    const arcana = ARCANA_ATTRACTORS.find((item) => item.id === resonanceId);
    const resonancePoint = diagnostics?.cryptoResonancePoint ?? hoveredCandy.position;
    const bounds = diagnostics?.cryptoPointCloudBounds ?? {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 1, y: 1, z: 1 },
    };
    const localPhase = hoveredCandy.t * Math.PI * 2 + hoveredCandy.cell_index * 2.39996323;
    const localNoiseFactor = 0.75 + 0.25 * Math.abs(Math.sin(localPhase));
    const amplitude = fieldStyle?.cryptoNoiseAmplitude ?? 0;
    const synchronized = resonanceId >= 0 && hoveredCandy.tarot.id === resonanceId;
    useKnotSelection.getState().recordCryptoQuantumEvent({
      timestamp: Date.now(),
      price: currentPrice,
      hurstExponent: fieldStyle?.cryptoHurstExponent ?? 0.35,
      maxNoiseAmplitude: amplitude * localNoiseFactor,
      highFrequencyNoise: fieldStyle?.cryptoHighFrequencyNoise ?? 0,
      oscillatorDisplacement: fieldStyle?.cryptoOscillatorDisplacement ?? 0,
      oscillatorVelocity: diagnostics?.cryptoDampedVelocity ?? 0,
      resonanceArcanaId: resonanceId,
      resonanceArcanaName: arcana?.name ?? 'No active resonance',
      resonanceArcanaPosition: arcana
        ? { x: arcana.x, y: arcana.y, z: arcana.z }
        : { x: resonancePoint.x, y: resonancePoint.y, z: resonancePoint.z ?? 0 },
      resonancePoint: { x: resonancePoint.x, y: resonancePoint.y, z: resonancePoint.z ?? 0 },
      pointCloudBounds: {
        min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z ?? 0 },
        max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z ?? 0 },
      },
      candyId: hoveredCandy.id,
      candyLayer: hoveredCandy.layer,
      candyCellIndex: hoveredCandy.cell_index,
      candyArcanaId: hoveredCandy.tarot.id,
      candySync: synchronized,
      candyLocalNoise: amplitude * localNoiseFactor,
      particleSample: hoveredParticleSample ?? 0,
    });
  }

  async function enterXRSession(mode: 'immersive-ar' | 'immersive-vr') {
    try {
      setXRError('');
      const session = mode === 'immersive-ar' ? await xrStore.enterAR() : await xrStore.enterVR();
      if (!session) setXRError(`${mode === 'immersive-ar' ? 'MR' : 'VR'} session is unavailable in this browser/device.`);
    } catch (error) {
      setXRError(error instanceof Error ? error.message : 'Unable to start the XR session.');
    }
  }

  async function togglePhysicsMode() {
    if (physicsEnabled && xrStore.getState().session) {
      try {
        await xrStore.getState().session?.end();
      } catch (error) {
        setXRError(error instanceof Error ? error.message : 'Unable to end the XR session.');
        return;
      }
    }
    setPhysicsEnabled((current) => !current);
    setXRError('');
  }

  // Fetch true gravity candy points from backend
  useEffect(() => {
    if (physicsEnabled) return;
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
  }, [currentPrice, physicsEnabled]);

  async function endXRSession() {
    try {
      await xrStore.getState().session?.end();
      setXRError('');
    } catch (error) {
      setXRError(error instanceof Error ? error.message : 'Unable to end the XR session.');
    }
  }

  return (
    <div
      className={className ?? 'relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#020611] shadow-[0_0_80px_rgba(6,182,212,0.12)]'}
      style={{ height }}
    >
      {/* 3D WebGL Canvas */}
      <Canvas
        camera={{ position: [0, 1.2, 6.2], fov: 45, near: 0.01, far: 100 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <XR store={xrStore}>
          <SpiralEyeCamera enabled={spiralEyeMode && !xrMode} />
          {!(physicsEnabled && xrMode === 'immersive-ar') && <color attach="background" args={['#020611']} />}
          {!(physicsEnabled && xrMode === 'immersive-ar') && <fog attach="fog" args={['#020611', 8, 26]} />}

          <ambientLight intensity={0.55} />
          <pointLight position={[5, 6, 5]} intensity={24} distance={22} color="#ffffff" />
          <pointLight position={[-5, -4, -4]} intensity={18} distance={20} color="#00f5ff" />
          <pointLight position={[0, 8, 0]} intensity={15} distance={18} color="#ffd700" />
          <pointLight position={[0, -6, 2]} intensity={12} distance={15} color="#ec4899" />

          <OrbitControls
            enabled={!xrMode && !spiralEyeMode}
            autoRotate={isAutoRotate && !physicsEnabled && !spiralEyeMode}
            autoRotateSpeed={0.35}
            enableDamping
            dampingFactor={0.06}
            minDistance={3.5}
            maxDistance={12.0}
          />

          <CyberpunkPriceSphere radius={2.0} price={currentPrice} symbol={symbol} wuxingPhase={wuxingPhase} eyeMode={spiralEyeMode && !xrMode} />
          {!spiralEyeMode && <FloatingPriceTag price={currentPrice} radius={2.0} />}
          {showSpirals && <SpiralGuideLines radius={2.0} />}
          {(fieldName === 'metal' || fieldName === 'animal') && (fieldStyle?.kumoThickness ?? 0) > 0 && (
            <KumoBand
              field={fieldName}
              center={fieldStyle?.kumoCenter ?? 0}
              thickness={fieldStyle?.kumoThickness ?? 0}
              breakTimestamp={fieldStyle?.kumoBreakTimestamp ?? 0}
              collapseTimestamp={fieldStyle?.animalCollapseTimestamp ?? 0}
            />
          )}
          {fieldName === 'metal' && (
            <MetalFractureEffect
              sparkBoost={fieldStyle?.macdAcceleration ?? 0}
              cellIndex={fieldStyle?.metalFractureCell ?? 0}
              intensity={fieldStyle?.metalLightningIntensity ?? 0}
              eventTimestamp={Math.max(fieldStyle?.metalLightningTimestamp ?? 0, fieldStyle?.kumoBreakTimestamp ?? 0)}
            />
          )}

          {fieldName === 'metal' && (
            <MetalHoneycombBackdrop
              distortionHeight={fieldStyle?.macdDistortionHeight ?? 0}
              fractureCell={fieldStyle?.metalFractureCell ?? 0}
              crossCell={fieldStyle?.metalCleaveCrossCell ?? 0}
              crossTimestamp={fieldStyle?.metalCleaveCrossTimestamp ?? 0}
              percentB={fieldStyle?.bollingerPercentB ?? 0.5}
            />
          )}
          {fieldName === 'animal' && (
            <AnimalVoxelBackdrop
              order={fieldStyle?.animalPulseStrength ?? 0}
              phaseSigma={fieldStyle?.animalPhaseSigma ?? 0}
              phase={fieldStyle?.animalPulsePhase ?? 0}
            />
          )}
          {fieldName === 'animal' && (
            <AnimalIndicators
              order={fieldStyle?.animalPulseStrength ?? 0}
              alert={fieldStyle?.syncAlert ?? false}
              phase={fieldStyle?.animalPulsePhase ?? 0}
              correlations={fieldStyle?.animalCorrelations ?? fieldDiagnostics?.animalCorrelationMatrix?.flat() ?? []}
            />
          )}

          {physicsEnabled ? (
            <CandyXRPhysics
              candies={candies}
              onGrabChange={setIsCandyGrabbed}
              onImpact={() => setImpactCount((count) => count + 1)}
              onHoverCandy={hoverCandy}
            />
          ) : fieldName === 'crypto' ? (
            <CryptoPointCloud candies={candies} radius={2.0} fieldStyle={fieldStyle} onHoverCandy={hoverCandy} />
          ) : (
            <CandyInstancedMesh
              candies={candies}
              radius={2.0}
              orbitSpeed={orbitSpeed}
              spinSpeed={spinSpeed}
              onHoverCandy={hoverCandy}
              fieldStyle={fieldStyle}
            />
          )}
        </XR>
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
        {fieldName && <span className="text-[8px] tracking-[0.14em] text-amber-100/70">{fieldName.toUpperCase()} / MATRIX INFLOW {((fieldStyle?.invasionStrength ?? 0) * 100).toFixed(0)}%</span>}
        {fieldName === 'crypto' && (
          <span className="text-[8px] tracking-[0.14em] text-cyan-100/70">
            CLOUD CHAMBER / H {fieldStyle?.cryptoHurstExponent?.toFixed(2) ?? '0.35'}
            {' '} / NOISE {fieldStyle?.cryptoNoiseAmplitude?.toFixed(2) ?? '0.00'}
            {(fieldStyle?.cryptoResonanceArcanaId ?? -1) >= 0 && ` / ARCANA ${fieldStyle?.cryptoResonanceArcanaId === 1 ? 'I' : 'XVIII'}`}
          </span>
        )}
        <span className="text-[8px] tracking-[0.14em] text-stone-400">HOVER A CANDY TO INSPECT ITS FIELD PARAMETERS</span>
        {spiralEyeMode && !xrMode && <span className="text-[8px] tracking-[0.14em] text-violet-200">SPIRAL EYE / CORE ORIGIN VIEW</span>}
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

      <div className="absolute left-4 top-[4.5rem] z-10 max-w-[min(92%,34rem)] rounded-xl border border-cyan-300/20 bg-[#020611]/85 p-2.5 font-mono text-[9px] text-stone-300 shadow-[0_0_24px_rgba(0,245,255,0.08)] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSpiralEyeMode((value) => !value)}
            disabled={Boolean(xrMode)}
            className={`rounded-lg border px-2.5 py-1.5 uppercase transition ${
              spiralEyeMode ? 'border-violet-300/60 bg-violet-500/15 text-violet-100' : 'border-white/10 bg-black/50 text-stone-400 hover:border-violet-200/40'
            } disabled:opacity-40`}
          >
            Spiral Eye {spiralEyeMode ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={togglePhysicsMode}
            className={`rounded-md border px-2.5 py-1.5 uppercase tracking-[0.12em] transition ${
              physicsEnabled ? 'border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100' : 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/70'
            }`}
          >
            {physicsEnabled ? 'Physics / XR ON' : 'Enable XR Physics'}
          </button>
          <button
            type="button"
            onClick={() => void enterXRSession('immersive-ar')}
            disabled={!physicsEnabled || Boolean(xrMode)}
            className="rounded-md border border-emerald-300/35 px-2.5 py-1.5 uppercase tracking-[0.12em] text-emerald-100 enabled:hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter MR
          </button>
          <button
            type="button"
            onClick={() => void enterXRSession('immersive-vr')}
            disabled={!physicsEnabled || Boolean(xrMode)}
            className="rounded-md border border-violet-300/35 px-2.5 py-1.5 uppercase tracking-[0.12em] text-violet-100 enabled:hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter VR
          </button>
          {xrMode && (
            <button
              type="button"
              onClick={() => void endXRSession()}
              className="rounded-md border border-rose-300/35 px-2.5 py-1.5 uppercase tracking-[0.12em] text-rose-100 hover:bg-rose-400/10"
            >
              Exit XR
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[8px] uppercase tracking-[0.12em] text-stone-500">
          {xrMode ? `${xrMode} • hand tracking + controller grab` : physicsEnabled ? 'Pinch / squeeze or mouse-drag a candy, then release to throw' : 'Enable physics to activate 384 grab-ready candy bodies'}
          {isCandyGrabbed ? ' • candy held' : ''}
          {impactCount > 0 ? ` • ${impactCount} target impacts` : ''}
        </p>
        {xrError && <p role="status" className="mt-1 text-[8px] text-rose-300">{xrError}</p>}
      </div>

      {/* Bottom left hover candy inspector */}
      {hoveredCandy && (
        <div className="absolute bottom-4 left-4 z-10 max-h-[70%] w-72 overflow-y-auto rounded-xl border border-cyan-400/30 bg-black/90 p-3.5 font-mono text-[10px] text-stone-200 shadow-[0_0_24px_rgba(0,245,255,0.2)] backdrop-blur-md">
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
            <div className="flex justify-between">
              <span>Prediction direction:</span>
              <span className="text-stone-300">{hoveredCandy.direction.toUpperCase()} / {hoveredCandy.pole}</span>
            </div>
            <div className="flex justify-between">
              <span>Arcana / variance:</span>
              <span className="text-stone-300">{hoveredCandy.tarot.name} / {hoveredCandy.tarot.variance_multiplier.toFixed(2)}</span>
            </div>
            {fieldName === 'crypto' ? (
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                <p className="text-violet-200">CRYPTO / CLOUD CHAMBER · PARTICLE {hoveredParticleSample ?? '--'}</p>
                <div className="flex justify-between"><span>Hurst / local ε:</span><span className="text-violet-100">{(fieldStyle?.cryptoHurstExponent ?? 0.35).toFixed(3)} / {((fieldStyle?.cryptoNoiseAmplitude ?? 0) * (0.75 + 0.25 * Math.abs(Math.sin(hoveredCandy.t * Math.PI * 2 + hoveredCandy.cell_index * 2.39996323)))).toFixed(3)}</span></div>
                <div className="flex justify-between"><span>HF / oscillator:</span><span className="text-violet-100">{(fieldStyle?.cryptoHighFrequencyNoise ?? 0).toFixed(3)} / {(fieldStyle?.cryptoOscillatorDisplacement ?? 0).toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Resonance sync:</span><span className="text-violet-100">{fieldStyle?.cryptoResonanceArcanaId !== undefined && fieldStyle.cryptoResonanceArcanaId >= 0 ? `${hoveredCandy.tarot.id === fieldStyle.cryptoResonanceArcanaId ? 'SYNC' : 'PHASED'} / ${fieldStyle.cryptoResonanceArcanaId === 1 ? 'I MAGICIAN' : 'XVIII MOON'}` : 'NO ACTIVE RESONANCE'}</span></div>
                <button
                  type="button"
                  onClick={saveHoveredQuantumState}
                  className="mt-1 w-full border border-violet-200/30 px-2 py-1.5 text-violet-100 hover:bg-violet-300/10"
                >
                  Save hovered quantum state to Inventory
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                <p className="text-cyan-200">{(fieldName ?? 'MARKET').toUpperCase()} / CANDY FIELD PARAMETERS</p>
                <div className="flex justify-between"><span>Mass / spin:</span><span className="text-stone-200">{(fieldStyle?.candyMass ?? 1).toFixed(3)} / {(fieldStyle?.candyAngularVelocity ?? 0).toFixed(3)}</span></div>
                <div className="flex justify-between"><span>Rigidity / vibration:</span><span className="text-stone-200">{(fieldStyle?.rigidity ?? 0).toFixed(3)} / {(fieldStyle?.vibration ?? 0).toFixed(3)}</span></div>
                {fieldName === 'metal' && <div className="flex justify-between"><span>Layer / jump / tremor:</span><span className="text-amber-100">{(fieldStyle?.metalLayerGrowth ?? 0).toFixed(3)} / {fieldStyle?.metalJump ? 'FRACTURE' : 'STABLE'} / {(fieldStyle?.metalMicroTremor ?? 0).toFixed(3)}</span></div>}
                {fieldName === 'animal' && <div className="flex justify-between"><span>Sync / braid / attractor:</span><span className="text-emerald-100">{(fieldStyle?.animalPulseStrength ?? 0).toFixed(3)} / {(fieldStyle?.animalBraidStrength ?? 0).toFixed(3)} / {fieldStyle?.animalAttractorArcanaId ?? '--'}</span></div>}
                {fieldName === 'meta' && (
                  <>
                    <div className="flex justify-between"><span>Pulsar mass / quantized:</span><span className="text-cyan-100">{(fieldStyle?.metaPulsarMass ?? fieldStyle?.candyMass ?? 1).toFixed(3)} / {((fieldStyle?.metaQuantizedAngle ?? 0) * 180 / Math.PI).toFixed(1)}°</span></div>
                    <div className="flex justify-between"><span>XAU/USD D / crack:</span><span className="text-cyan-100">{(fieldStyle?.metaXauUsdDistance ?? fieldStyle?.matrixDistance ?? 0).toFixed(3)} / {((fieldStyle?.metaCrackIntensity ?? 0) * 100).toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span>Ripple / phase shift:</span><span className="text-cyan-100">{(fieldStyle?.metaRippleStrength ?? 0).toFixed(2)} / {fieldStyle?.metaPhaseShift ? 'JUMP' : 'stable'}</span></div>
                    <div className="flex justify-between"><span>Anchor / tremor:</span><span className="text-cyan-100">{fieldStyle?.metaTargetArcanaId ?? '--'} / {(fieldDiagnostics?.metaMicroTremor ?? 0).toFixed(4)}</span></div>
                  </>
                )}
                <div className="flex justify-between"><span>Matrix resonance:</span><span className="text-stone-200">{fieldStyle?.resonanceArcanaId ?? '--'} / {(fieldStyle?.invasionStrength ?? 0).toFixed(3)}</span></div>
              </div>
            )}
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
