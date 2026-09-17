'use client';

import { ContactShadows, Environment, Float, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type WuxingElement = 'fire' | 'water' | 'wind' | 'earth' | 'metal';

export type SuperRealKnotProps = {
  pressure?: number;
  mass?: number;
  element?: WuxingElement;
  className?: string;
  color?: string;
};

type MaterialProfile = {
  color: string;
  emissive: string;
  transmission: number;
  roughness: number;
  metalness: number;
  thickness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  ior: number;
  reflectivity: number;
  envMapIntensity: number;
  bumpScale: number;
};

function getElementProfile(element: WuxingElement, pressure: number, mass: number): MaterialProfile {
  const p = THREE.MathUtils.clamp(pressure, 0, 1);
  const m = THREE.MathUtils.clamp(mass, 0, 1);

  const palette: Record<WuxingElement, { base: string; emissive: string }> = {
    fire: { base: '#ff7a18', emissive: '#ff4d5a' },
    water: { base: '#58c4ff', emissive: '#0b5fff' },
    wind: { base: '#7ef9d1', emissive: '#4ef3ff' },
    earth: { base: '#8d8a70', emissive: '#ad9f6c' },
    metal: { base: '#d7dfe9', emissive: '#88a4c6' },
  };

  const hue = palette[element] ?? palette.fire;
  const plasmaBoost = 0.46 + p * 1.1;
  const densityBoost = 0.25 + m * 0.9;

  return {
    color: hue.base,
    emissive: hue.emissive,
    transmission: element === 'fire' || element === 'wind' ? 0.28 + p * 0.62 : 0.05 + (1 - m) * 0.18,
    roughness: element === 'metal' || element === 'earth' ? 0.42 + (1 - p) * 0.28 : 0.12 + (1 - p) * 0.35,
    metalness: element === 'metal' ? 0.85 + m * 0.12 : element === 'earth' ? 0.54 + m * 0.2 : 0.12 + m * 0.22,
    thickness: 0.2 + plasmaBoost * 1.8,
    clearcoat: element === 'fire' || element === 'wind' ? 0.75 + p * 0.22 : 0.18 + m * 0.32,
    clearcoatRoughness: element === 'metal' ? 0.3 : 0.08 + (1 - p) * 0.25,
    ior: element === 'fire' ? 1.3 + p * 0.32 : 1.1 + densityBoost * 0.15,
    reflectivity: 0.2 + densityBoost * 0.8,
    envMapIntensity: 0.8 + p * 1.6,
    bumpScale: 0.07 + m * 0.28,
  };
}

function KnotCore({ pressure, mass, element, color }: { pressure: number; mass: number; element: WuxingElement; color: string }) {
  const group = useRef<THREE.Group>(null);
  const profile = useMemo(() => getElementProfile(element, pressure, mass), [element, mass, pressure]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * (0.8 + pressure * 2.6)) * (0.08 + pressure * 0.12);
    group.current.rotation.x = t * 0.7;
    group.current.rotation.y = t * 0.9;
    group.current.rotation.z = Math.sin(t * 1.2) * 0.25;
    group.current.scale.setScalar(pulse);
  });

  return (
    <group ref={group}>
      <mesh castShadow receiveShadow>
        <torusKnotGeometry args={[1.2, 0.42, 220, 34]} />
        <meshPhysicalMaterial
          color={color || profile.color}
          emissive={profile.emissive}
          emissiveIntensity={0.25 + pressure * 2.1}
          roughness={profile.roughness}
          metalness={profile.metalness}
          clearcoat={profile.clearcoat}
          clearcoatRoughness={profile.clearcoatRoughness}
          transmission={profile.transmission}
          thickness={profile.thickness}
          ior={profile.ior}
          reflectivity={profile.reflectivity}
          envMapIntensity={profile.envMapIntensity}
          transparent={profile.transmission > 0.12}
          opacity={0.96}
          bumpScale={profile.bumpScale}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh scale={[1.15, 1.12, 1.15]}>
        <torusKnotGeometry args={[1.0, 0.22, 180, 24]} />
        <meshPhysicalMaterial
          color={profile.color}
          emissive={profile.emissive}
          emissiveIntensity={0.35 + pressure * 2.6}
          transparent
          opacity={0.36 + pressure * 0.38}
          transmission={0.55 + pressure * 0.25}
          roughness={Math.max(0.04, profile.roughness - 0.2)}
          metalness={Math.max(0.08, profile.metalness - 0.15)}
          clearcoat={1}
          thickness={1.2}
          ior={1.32}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function SuperRealKnot({ pressure = 0.7, mass = 0.55, element = 'fire', className = 'h-[500px] w-full', color }: SuperRealKnotProps) {
  const accent = color ?? getElementProfile(element, pressure, mass).color;

  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0.2, 6.2], fov: 34 }} shadows dpr={[1, 2]}>
        <color attach="background" args={['#050816']} />
        <fog attach="fog" args={['#050816', 6, 20]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 4]} intensity={2.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <pointLight position={[0, 2.5, 2]} intensity={18} color={accent} />
        <Float speed={1.4} rotationIntensity={0.8} floatIntensity={0.9}>
          <KnotCore pressure={pressure} mass={mass} element={element} color={accent} />
        </Float>
        <ContactShadows position={[0, -2.3, 0]} scale={12} opacity={0.7} blur={2.4} far={6} />
        <Environment preset="city" />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.55} />
      </Canvas>
    </div>
  );
}
