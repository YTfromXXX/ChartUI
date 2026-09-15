'use client';

import { Edges, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Line2 } from 'three-stdlib';

export type StrategySandboxProps = {
  isStrategyLocked: boolean;
  className?: string;
};

type StrategyFieldProps = Pick<StrategySandboxProps, 'isStrategyLocked'>;

function StrategyField({ isStrategyLocked }: StrategyFieldProps) {
  const entryRef = useRef<THREE.Mesh>(null);
  const exitRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<Line2>(null);
  const entryAngle = useRef(0.2);
  const exitAngle = useRef(Math.PI * 1.3);
  const knotProgress = useRef(0);
  const wasLocked = useRef(false);
  const curvePoints = useMemo(() => Array.from({ length: 24 }, () => new THREE.Vector3()), []);

  useEffect(() => {
    if (isStrategyLocked && !wasLocked.current) knotProgress.current = 0;
    wasLocked.current = isStrategyLocked;
  }, [isStrategyLocked]);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const radius = 2.1;
    const targetProgress = isStrategyLocked ? 1 : 0;
    knotProgress.current = THREE.MathUtils.damp(knotProgress.current, targetProgress, 2.5, delta);
    const orbitSpeed = isStrategyLocked ? 0.7 : 0.16;
    entryAngle.current += delta * orbitSpeed;
    exitAngle.current -= delta * orbitSpeed * 0.8;

    const separation = THREE.MathUtils.lerp(Math.PI, 0.16, knotProgress.current);
    const entryAngleValue = entryAngle.current;
    const exitAngleValue = entryAngleValue + separation + Math.sin(elapsed * 0.8) * 0.04;
    const entry = new THREE.Vector3(Math.cos(entryAngleValue) * radius, 0.18 + Math.sin(elapsed * 1.8) * 0.06, Math.sin(entryAngleValue) * radius);
    const exit = new THREE.Vector3(Math.cos(exitAngleValue) * radius, 0.18 + Math.cos(elapsed * 1.5) * 0.06, Math.sin(exitAngleValue) * radius);

    entryRef.current?.position.lerp(entry, 1 - Math.exp(-delta * 8));
    exitRef.current?.position.lerp(exit, 1 - Math.exp(-delta * 8));
    entryRef.current?.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.08);
    exitRef.current?.scale.setScalar(1 + Math.sin(elapsed * 3 + 1) * 0.08);

    const entryPosition = entryRef.current?.position ?? entry;
    const exitPosition = exitRef.current?.position ?? exit;
    for (let index = 0; index < curvePoints.length; index += 1) {
      const point = curvePoints[index];
      const progress = index / (curvePoints.length - 1);
      const arc = Math.sin(progress * Math.PI) * (0.25 + knotProgress.current * 0.8);
      point.set(
        THREE.MathUtils.lerp(entryPosition.x, exitPosition.x, progress),
        THREE.MathUtils.lerp(entryPosition.y, exitPosition.y, progress) + arc,
        THREE.MathUtils.lerp(entryPosition.z, exitPosition.z, progress),
      );
    }
    lineRef.current?.geometry.setPositions(curvePoints.flatMap((point) => [point.x, point.y, point.z]));
    lineRef.current?.computeLineDistances();
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 4, 4]} intensity={18} color="#55e6bd" />
      <pointLight position={[-3, 2, -3]} intensity={14} color="#f38ba8" />
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[7.4, 0.18, 7.4]} />
        <meshBasicMaterial color="#03141b" transparent opacity={0.35} />
        <Edges color="#5eead4" threshold={15} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[2.1, 0.025, 12, 96]} />
        <meshBasicMaterial color={isStrategyLocked ? '#f5d06f' : '#38d9d0'} transparent opacity={0.8} />
      </mesh>
      <mesh ref={entryRef} position={[2, 0.2, 0]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color="#55b7ff" emissive="#0b4e8c" emissiveIntensity={2} metalness={0.4} roughness={0.2} />
      </mesh>
      <mesh ref={exitRef} position={[-2, 0.2, 0]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color="#f38ba8" emissive="#8f183f" emissiveIntensity={2} metalness={0.4} roughness={0.2} />
      </mesh>
      <Line ref={lineRef} points={curvePoints} color="#f5d06f" lineWidth={isStrategyLocked ? 2.2 : 0.4} transparent opacity={isStrategyLocked ? 0.9 : 0.12} />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={5} maxDistance={13} target={[0, 0, 0]} />
    </>
  );
}

export default function StrategySandbox({ isStrategyLocked, className }: StrategySandboxProps) {
  return (
    <div className={className ?? 'h-[520px] w-full overflow-hidden border border-cyan-200/20 bg-[#02080d]'}>
      <Canvas camera={{ position: [0, 5.5, 7.8], fov: 42, near: 0.1, far: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#02080d']} />
        <fog attach="fog" args={['#02080d', 8, 24]} />
        <StrategyField isStrategyLocked={isStrategyLocked} />
      </Canvas>
    </div>
  );
}
