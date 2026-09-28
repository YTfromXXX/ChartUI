'use client';

import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { animated, useSpring } from '@react-spring/three';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OracleBranch, Vector3Tuple } from '@/hooks/useMarketStream';

export type SquareArcPoint = {
  trajectory: 'surge' | 'continuation' | 'range' | 'plunge';
  side: 'buy_stop' | 'sell_stop';
  x: number;
  y: number;
  z: number;
};

export type SquareArcTarget = {
  trajectory: SquareArcPoint['trajectory'];
  buy_stop: Pick<SquareArcPoint, 'x' | 'y' | 'z'>;
  sell_stop: Pick<SquareArcPoint, 'x' | 'y' | 'z'>;
  box_volume: number;
};

type ProbabilityBranchesProps = {
  origin?: Vector3Tuple;
  branches: OracleBranch[];
  squareArcTargets?: SquareArcTarget[];
  currentPrice?: number;
  standardDeviation?: number;
};

const BRANCHES = [
  { id: 'wands', trajectory: 'surge', label: 'SURGE', color: '#ffd700', offset: -0.72, direction: [0.2, 3.6, 0] as Vector3Tuple },
  { id: 'swords', trajectory: 'continuation', label: 'TREND', color: '#00ffff', offset: -0.24, direction: [1.1, 2.2, 0.15] as Vector3Tuple },
  { id: 'cups', trajectory: 'range', label: 'RANGE', color: '#ffffff', offset: 0.24, direction: [1.7, 0.55, 0.1] as Vector3Tuple },
  { id: 'pentacles', trajectory: 'plunge', label: 'DROP', color: '#a855f7', offset: 0.72, direction: [0.6, -3.2, -0.2] as Vector3Tuple },
] as const;

function makeBranchCurve(branch: (typeof BRANCHES)[number], origin: THREE.Vector3) {
  const [dx, dy, dz] = branch.direction;
  const start = origin.clone().add(new THREE.Vector3(branch.offset, 0, 0));
  const end = start.clone().add(new THREE.Vector3(dx, dy, dz));
  const control = start.clone().lerp(end, 0.5).add(new THREE.Vector3(branch.id === 'cups' ? 0.35 : -0.1, branch.id === 'cups' ? 0.35 : 0, 0.25));
  return new THREE.CatmullRomCurve3([start, control, end]);
}

function Laser({ branch, probability, curve }: { branch: (typeof BRANCHES)[number]; probability: number; curve: THREE.CatmullRomCurve3 }) {
  const warningRef = useRef<THREE.Group>(null);
  const radius = 0.012 + Math.max(0, Math.min(100, probability)) / 100 * 0.045;
  const opacity = 0.16 + Math.max(0, Math.min(100, probability)) / 100 * 0.84;
  const isWarning = branch.id === 'pentacles' && probability > 30;

  useFrame(({ clock }) => {
    if (warningRef.current) warningRef.current.visible = !isWarning || Math.sin(clock.elapsedTime * 12) > -0.2;
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 32, radius, 6, false]} />
        <meshBasicMaterial color={branch.color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={warningRef} position={curve.getPointAt(0.92, new THREE.Vector3())}>
        <Text fontSize={0.16} color={isWarning ? '#ff355d' : branch.color} anchorX="center" anchorY="middle" outlineColor="#050816" outlineWidth={0.012} fillOpacity={opacity}>
          [{probability.toFixed(1)}%]
        </Text>
        <Text position={[0, -0.19, 0]} fontSize={0.075} color={isWarning ? '#ff355d' : branch.color} anchorX="center" anchorY="middle" fillOpacity={0.72}>
          {branch.label}
        </Text>
      </group>
    </group>
  );
}

function CurrentPriceSphere({ origin }: { origin: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.08;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef} position={origin}>
      <sphereGeometry args={[0.18, 24, 24]} />
      <meshStandardMaterial color="#e0fbff" emissive="#00eaff" emissiveIntensity={2.2} metalness={0.72} roughness={0.16} />
    </mesh>
  );
}

function SquareArcZone({
  point,
  target,
  curve,
  color,
  currentPrice,
  standardDeviation,
}: {
  point: SquareArcPoint;
  target: SquareArcTarget;
  curve: THREE.CatmullRomCurve3;
  color: string;
  currentPrice: number;
  standardDeviation: number;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const impactRef = useRef(0);
  const normalizedPrice = (point.y - currentPrice) / standardDeviation;
  const anchor = useMemo(
    () => curve.getPointAt(
      THREE.MathUtils.clamp(
        (point.side === 'buy_stop' ? 0.72 : 0.84) + Math.tanh(normalizedPrice) * 0.09,
        0.52,
        0.96,
      ),
      new THREE.Vector3(),
    ),
    [curve, normalizedPrice, point.side],
  );
  const normalizedSpan = Math.abs(target.buy_stop.y - target.sell_stop.y) / standardDeviation;
  const pointOffset = Math.abs(normalizedPrice);
  const width = THREE.MathUtils.clamp(0.08 + normalizedSpan * 0.09, 0.08, 0.7);
  const depth = THREE.MathUtils.clamp(0.07 + Math.abs(point.z) * 0.05, 0.07, 0.38);
  const height = THREE.MathUtils.clamp(0.08 + (normalizedSpan + pointOffset) * 0.055, 0.08, 0.56);
  const targetPosition = useMemo<[number, number, number]>(() => [anchor.x, anchor.y, anchor.z], [anchor]);
  const targetScale = useMemo<[number, number, number]>(() => [width, height, depth], [depth, height, width]);
  const [spring, api] = useSpring(() => ({
    x: targetPosition[0],
    y: targetPosition[1],
    z: targetPosition[2],
    scaleX: targetScale[0],
    scaleY: targetScale[1],
    scaleZ: targetScale[2],
    config: { mass: 0.52, tension: 270, friction: 19, clamp: false },
  }));

  useEffect(() => {
    api.start({
      x: targetPosition[0],
      y: targetPosition[1],
      z: targetPosition[2],
      scaleX: targetScale[0],
      scaleY: targetScale[1],
      scaleZ: targetScale[2],
      config: { mass: 0.52, tension: 270, friction: 19, clamp: false },
      onRest: () => { impactRef.current = 1; },
    });
  }, [api, targetPosition, targetScale]);

  useFrame(({ clock }, delta) => {
    impactRef.current = Math.max(0, impactRef.current - delta * 1.85);
    if (!materialRef.current) return;
    const flash = impactRef.current * (0.7 + Math.sin(clock.elapsedTime * 42) * 0.3);
    materialRef.current.emissiveIntensity = 0.9 + flash * 7.2;
    materialRef.current.opacity = 0.56 + flash * 0.44;
  });

  return (
    <animated.mesh
      position-x={spring.x}
      position-y={spring.y}
      position-z={spring.z}
      scale-x={spring.scaleX}
      scale-y={spring.scaleY}
      scale-z={spring.scaleZ}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial ref={materialRef} color={color} emissive={color} wireframe transparent opacity={0.56} depthWrite={false} />
    </animated.mesh>
  );
}

export default function ProbabilityBranches({
  origin = [0, 0, 0],
  branches,
  squareArcTargets = [],
  currentPrice,
  standardDeviation,
}: ProbabilityBranchesProps) {
  const originVector = useMemo(() => new THREE.Vector3(...origin), [origin]);
  const curves = useMemo(
    () => new Map(BRANCHES.map((branch) => [branch.trajectory, makeBranchCurve(branch, originVector)])),
    [originVector],
  );
  const canRenderTargets = Number.isFinite(currentPrice) && Number.isFinite(standardDeviation) && (standardDeviation ?? 0) > 0;

  return (
    <group>
      <CurrentPriceSphere origin={originVector} />
      {BRANCHES.map((branch, index) => (
        <Laser
          key={branch.id}
          branch={branch}
          probability={branches.find((item) => item.id === branch.id)?.probability ?? branches[index]?.probability ?? 0}
          curve={curves.get(branch.trajectory)!}
        />
      ))}
      {canRenderTargets && squareArcTargets.flatMap((target) => {
        const branch = BRANCHES.find((candidate) => candidate.trajectory === target.trajectory);
        const curve = curves.get(target.trajectory);
        if (!branch || !curve) return [];
        return (['buy_stop', 'sell_stop'] as const).map((side) => (
          <SquareArcZone
            key={`${target.trajectory}-${side}`}
            point={{ trajectory: target.trajectory, side, ...target[side] }}
            target={target}
            curve={curve}
            color={side === 'buy_stop' ? '#5eead4' : '#fb7185'}
            currentPrice={currentPrice!}
            standardDeviation={standardDeviation!}
          />
        ));
      })}
    </group>
  );
}
