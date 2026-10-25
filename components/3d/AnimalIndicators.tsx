'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export const ANIMAL_ASSETS = ['SOY', 'WHEAT', 'CORN', 'WTI', 'NG'] as const;
const GOLDEN_ANGLE = 137.50776405 * Math.PI / 180;
const RADAR_RADIUS = 1.15;
const RADAR_Y = -2.35;
const PAIRS: [number, number][] = [];
for (let a = 0; a < 5; a += 1) for (let b = a + 1; b < 5; b += 1) PAIRS.push([a, b]);

type AnimalIndicatorsProps = {
  order?: number;
  alert?: boolean;
  phase?: number;
  correlations?: readonly number[];
  vortexSpeed?: number;
  vortexHighlight?: number;
  vortexAcceleration?: boolean;
  atrPulse?: number;
  hackLocked?: boolean;
  limitCycle?: number;
};

/** Central Kuramoto ring: radius follows r, turns gold above r = 0.85. */
function KuramotoRing({ order, phase }: { order: number; phase: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 1,
    metalness: 0.6,
    roughness: 0.25,
    toneMapped: false,
  }), []);
  const cool = useMemo(() => new THREE.Color('#38bdf8'), []);
  const gold = useMemo(() => new THREE.Color('#ffd23f'), []);
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const r = THREE.MathUtils.clamp(order, 0, 1);
    const target = 1.25 - 0.8 * r;
    mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x || target, target, 0.12));
    mesh.rotation.z = clock.getElapsedTime() * (0.3 + r) + phase;
    const golden = r > 0.85;
    material.color.copy(cool).lerp(gold, golden ? 1 : r * 0.4);
    material.emissive.copy(material.color);
    material.emissiveIntensity = golden ? 2.2 + Math.sin(clock.getElapsedTime() * 8) * 0.5 : 0.6 + r;
  });
  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]} material={material}>
      <torusGeometry args={[1, 0.03, 12, 96]} />
    </mesh>
  );
}

/** Five commodity nodes at the spiral root joined by correlation-weighted synapse cords. */
function SynapticArcRadar({ correlations, order }: { correlations: readonly number[]; order: number }) {
  const nodePositions = useMemo(() => ANIMAL_ASSETS.map((_, index) => {
    const angle = index / 5 * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector3(Math.cos(angle) * RADAR_RADIUS, RADAR_Y, Math.sin(angle) * RADAR_RADIUS);
  }), []);
  const lines = useMemo(() => {
    const positions = new Float32Array(PAIRS.length * 6);
    const colors = new Float32Array(PAIRS.length * 6);
    PAIRS.forEach(([a, b], index) => {
      nodePositions[a].toArray(positions, index * 6);
      nodePositions[b].toArray(positions, index * 6 + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.LineSegments(geometry, material);
  }, [nodePositions]);
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const colors = lines.geometry.getAttribute('color') as THREE.BufferAttribute;
    PAIRS.forEach(([a, b], index) => {
      const value = Math.abs(correlations[a * 5 + b] ?? 0);
      const pulse = 0.65 + 0.35 * Math.sin(clock.getElapsedTime() * 4 + index * GOLDEN_ANGLE);
      const level = THREE.MathUtils.clamp(value, 0, 1) * (0.4 + order * 0.9) * pulse;
      const mix = THREE.MathUtils.clamp(value, 0, 1);
      for (let vertex = 0; vertex < 2; vertex += 1) {
        colors.setXYZ(index * 2 + vertex, level * (0.2 + mix * 0.8), level, level * (1 - mix * 0.5));
      }
    });
    colors.needsUpdate = true;
    nodeRefs.current.forEach((mesh, index) => {
      if (mesh) mesh.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3 + index * GOLDEN_ANGLE) * 0.15 * (0.4 + order));
    });
  });
  return (
    <group>
      <primitive object={lines} />
      {nodePositions.map((position, index) => (
        <mesh key={ANIMAL_ASSETS[index]} position={position} ref={(mesh) => { nodeRefs.current[index] = mesh; }}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Logarithmic expansion vector: a golden-angle log-spiral guide with an arrowhead, shown at alert. */
function LogarithmicExpansionVector({ active }: { active: boolean }) {
  const points = 40;
  const line = useMemo(() => {
    const positions = new Float32Array(points * 3);
    for (let index = 0; index < points; index += 1) {
      const t = index / (points - 1);
      const angle = t * GOLDEN_ANGLE * 2.2;
      const radius = 0.12 * Math.exp(0.9 * t * 2.2);
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 1.9 + t * 1.2;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: '#ffd23f', transparent: true, toneMapped: false, depthWrite: false });
    return new THREE.Line(geometry, material);
  }, []);
  const coneRef = useRef<THREE.Mesh>(null);
  const grown = useRef(0);
  useFrame((_, delta) => {
    grown.current = THREE.MathUtils.clamp(grown.current + (active ? delta * 0.7 : -delta * 1.5), 0, 1);
    const count = Math.max(0, Math.floor(grown.current * points));
    line.geometry.setDrawRange(0, count);
    line.visible = count > 1;
    const cone = coneRef.current;
    if (!cone) return;
    cone.visible = count > 1;
    if (count > 1) {
      const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const tip = new THREE.Vector3().fromBufferAttribute(positions, count - 1);
      const before = new THREE.Vector3().fromBufferAttribute(positions, count - 2);
      cone.position.copy(tip);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.sub(before).normalize());
    }
  });
  return (
    <group>
      <primitive object={line} />
      <mesh ref={coneRef} visible={false}>
        <coneGeometry args={[0.07, 0.22, 12]} />
        <meshStandardMaterial color="#ffd23f" emissive="#ffb703" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Seven-point hole cloud spun into a vortex by RSI omega, ATR pulse and the manual velocity. */
function VortexSeven({ speed, highlight, acceleration, pulse, locked }: { speed: number; highlight: number; acceleration: boolean; pulse: number; locked: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const angle = useRef(0);
  useFrame(({ clock }, delta) => {
    angle.current += Math.min(delta, 0.05) * speed;
    const t = clock.getElapsedTime();
    const breathe = 1 + pulse * 0.25 * Math.sin(t * (2 + pulse * 3));
    nodeRefs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const arm = index / 7;
      const theta = angle.current + index * GOLDEN_ANGLE;
      const radius = (0.25 + arm * 0.8) * breathe;
      mesh.position.set(Math.cos(theta) * radius, Math.sin(arm * 6 + t) * 0.03, Math.sin(theta) * radius);
      const marked = index === Math.floor(highlight);
      mesh.scale.setScalar(marked ? (locked ? 3.2 + 0.5 * Math.sin(t * 6) : acceleration ? 2.4 : 1.7) : 1);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(marked ? (locked ? '#ffd740' : acceleration ? '#fef08a' : '#f9a8d4') : '#6ee7b7');
      material.emissive.set(marked ? (locked ? '#ffb300' : acceleration ? '#facc15' : '#ec4899') : '#34d399');
    });
    if (groupRef.current) groupRef.current.rotation.y = -angle.current * 0.15;
  });
  return (
    <group ref={groupRef} position={[0, 0.0, 0]}>
      {Array.from({ length: 7 }, (_, index) => (
        <mesh key={index} ref={(mesh) => { nodeRefs.current[index] = mesh; }}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#6ee7b7" emissive="#34d399" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function AnimalIndicators({ order = 0, alert = false, phase = 0, correlations = [], vortexSpeed = 0, vortexHighlight = 0, vortexAcceleration = false, atrPulse = 0, hackLocked = false }: AnimalIndicatorsProps) {
  return (
    <group>
      <KuramotoRing order={order} phase={phase} />
      <VortexSeven speed={vortexSpeed} highlight={vortexHighlight} acceleration={vortexAcceleration} pulse={atrPulse} locked={hackLocked} />
      <SynapticArcRadar correlations={correlations} order={order} />
      <LogarithmicExpansionVector active={alert || order > 0.85} />
    </group>
  );
}
