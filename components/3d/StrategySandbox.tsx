'use client';

import { Edges, Line, OrbitControls, Trail } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Line2, OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type StrategySandboxProps = {
  isStrategyLocked: boolean;
  hexagramBinary?: string;
  className?: string;
};

type StrategyFieldProps = Pick<StrategySandboxProps, 'isStrategyLocked' | 'hexagramBinary'>;

function StrategyField({ isStrategyLocked, hexagramBinary = '000000' }: StrategyFieldProps) {
  const { camera } = useThree();
  const entryRef = useRef<THREE.Mesh>(null);
  const exitRef = useRef<THREE.Mesh>(null);
  const torusRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Group>(null);
  const frameMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const torusMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const tornadoRef = useRef<THREE.Points>(null);
  const tornadoMaterialRef = useRef<THREE.PointsMaterial>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lineRef = useRef<Line2>(null);
  const entryAngle = useRef(0.2);
  const knotProgress = useRef(0);
  const wasLocked = useRef(false);
  const lockStartedAt = useRef<number | null>(null);
  const transitionCameraStart = useRef(new THREE.Vector3());
  const curvePoints = useMemo(() => Array.from({ length: 24 }, () => new THREE.Vector3()), []);
  const tornadoPositions = useMemo(() => {
    const positions = new Float32Array(2400 * 3);
    for (let index = 0; index < 2400; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 2.5;
      const offset = index * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = (Math.random() - 0.5) * 12;
      positions[offset + 2] = Math.sin(angle) * radius;
    }
    return positions;
  }, []);
  const safeBinary = /^[01]{6}$/.test(hexagramBinary) ? hexagramBinary : '000000';
  const yangCount = safeBinary.split('').filter((bit) => bit === '1').length;
  const yangRatio = yangCount / 6;
  const yinRatio = 1 - yangRatio;
  const baseRadius = THREE.MathUtils.lerp(0.42, 3.3, yangRatio);
  const baseSpeed = THREE.MathUtils.lerp(0.12, 2.4, yangRatio);

  useEffect(() => {
    if (isStrategyLocked && !wasLocked.current) knotProgress.current = 0;
    if (!isStrategyLocked) lockStartedAt.current = null;
    wasLocked.current = isStrategyLocked;
  }, [isStrategyLocked]);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    if (isStrategyLocked && lockStartedAt.current === null) {
      lockStartedAt.current = elapsed;
      transitionCameraStart.current.copy(camera.position);
    }
    const transitionElapsed = lockStartedAt.current === null ? -1 : elapsed - lockStartedAt.current;
    const collapseProgress = transitionElapsed < 1 ? 0 : THREE.MathUtils.clamp((transitionElapsed - 1) / 1.5, 0, 1);
    const cameraProgress = THREE.MathUtils.smoothstep(collapseProgress, 0, 1);
    const targetCamera = new THREE.Vector3(0, 0.15, -13);
    const targetLookAt = new THREE.Vector3(0, 0, -18);
    const radialBreath = 1 + Math.sin(elapsed * (0.35 + yangRatio * 0.8)) * (0.025 + yangRatio * 0.1);
    const radius = baseRadius * radialBreath;
    const targetProgress = transitionElapsed < 0 ? (isStrategyLocked ? 1 : 0) : 0;
    knotProgress.current = THREE.MathUtils.damp(knotProgress.current, targetProgress, 2.5, delta);
    const orbitSpeed = transitionElapsed >= 0 ? 0 : baseSpeed;
    entryAngle.current += delta * orbitSpeed;
    const collapseScale = 1 + collapseProgress * 8;
    if (frameRef.current) {
      frameRef.current.scale.setScalar(collapseScale);
      frameRef.current.rotation.z = collapseProgress * Math.PI * 0.32;
    }
    frameMaterialRef.current && (frameMaterialRef.current.opacity = 0.35 * (1 - collapseProgress));
    torusMaterialRef.current && (torusMaterialRef.current.opacity = 0.8 * (1 - collapseProgress));
    torusRef.current?.scale.setScalar((radius / 2.1) * collapseScale);

    if (transitionElapsed >= 0) {
      if (controlsRef.current) controlsRef.current.enabled = false;
      camera.position.lerpVectors(transitionCameraStart.current, targetCamera, cameraProgress);
      camera.lookAt(targetLookAt);
    } else if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    const tornadoOpacity = THREE.MathUtils.clamp((transitionElapsed - 1) / 1.5, 0, 1);
    if (tornadoMaterialRef.current) tornadoMaterialRef.current.opacity = tornadoOpacity;
    if (tornadoRef.current) {
      tornadoRef.current.rotation.y += delta * (0.4 + tornadoOpacity * 4.5);
      tornadoRef.current.rotation.z = Math.sin(elapsed * 0.5) * 0.12;
      tornadoRef.current.scale.setScalar(0.35 + tornadoOpacity * 1.25);
      tornadoRef.current.position.z = -2 - tornadoOpacity * 5;
    }

    const separation = THREE.MathUtils.lerp(Math.PI, 0.16, knotProgress.current);
    const entryAngleValue = entryAngle.current;
    const exitAngleValue = entryAngleValue + separation + Math.sin(elapsed * 0.8) * 0.04;
    const gravityLift = 0.18 + yinRatio * 0.04;
    const entry = new THREE.Vector3(Math.cos(entryAngleValue) * radius, gravityLift + Math.sin(elapsed * 1.8) * 0.06, Math.sin(entryAngleValue) * radius);
    const exit = new THREE.Vector3(Math.cos(exitAngleValue) * radius, gravityLift + Math.cos(elapsed * 1.5) * 0.06, Math.sin(exitAngleValue) * radius);

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
      <group ref={frameRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[7.4, 0.18, 7.4]} />
          <meshBasicMaterial ref={frameMaterialRef} color="#03141b" transparent opacity={0.35} />
          <Edges color="#5eead4" threshold={15} />
        </mesh>
      </group>
      <mesh ref={torusRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[2.1, 0.025, 12, 96]} />
        <meshBasicMaterial ref={torusMaterialRef} color={isStrategyLocked ? '#f5d06f' : '#38d9d0'} transparent opacity={0.8} />
      </mesh>
      <Trail width={0.7 + yangRatio * 1.4} length={3 + yangCount * 0.8} color="#55b7ff" attenuation={(value) => value * value}>
        <mesh ref={entryRef} position={[baseRadius, 0.2, 0]}>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color="#55b7ff" emissive="#0b4e8c" emissiveIntensity={2} metalness={0.4} roughness={0.2} />
        </mesh>
      </Trail>
      <Trail width={0.7 + yangRatio * 1.4} length={3 + yangCount * 0.8} color="#f38ba8" attenuation={(value) => value * value}>
        <mesh ref={exitRef} position={[-baseRadius, 0.2, 0]}>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color="#f38ba8" emissive="#8f183f" emissiveIntensity={2} metalness={0.4} roughness={0.2} />
        </mesh>
      </Trail>
      <Line ref={lineRef} points={curvePoints} color="#f5d06f" lineWidth={isStrategyLocked ? 2.2 : 0.4} transparent opacity={isStrategyLocked ? 0.9 : 0.12} />
      <points ref={tornadoRef} position={[0, 0, -2]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[tornadoPositions, 3]} count={2400} array={tornadoPositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial ref={tornadoMaterialRef} color="#67e8f9" size={0.045} sizeAttenuation transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={13} target={[0, 0, 0]} />
    </>
  );
}

export default function StrategySandbox({ isStrategyLocked, hexagramBinary = '000000', className }: StrategySandboxProps) {
  return (
    <div className={className ?? 'h-[520px] w-full overflow-hidden border border-cyan-200/20 bg-[#02080d]'}>
      <Canvas camera={{ position: [0, 5.5, 7.8], fov: 42, near: 0.1, far: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#02080d']} />
        <fog attach="fog" args={['#02080d', 8, 24]} />
        <StrategyField isStrategyLocked={isStrategyLocked} hexagramBinary={hexagramBinary} />
      </Canvas>
    </div>
  );
}
