'use client';

import { Text } from '@react-three/drei';
import { RigidBodyType } from '@dimforge/rapier3d-compat';
import {
  BallCollider,
  CuboidCollider,
  InstancedRigidBodies,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LAYER_COLORS, LAYER_CONFIG, type CandyPoint } from '@/lib/candyPoints';

type CandyXRPhysicsProps = {
  candies: CandyPoint[];
  onGrabChange?: (grabbed: boolean) => void;
  onImpact?: (targetId: string) => void;
};

type TargetDefinition = {
  id: string;
  layer: CandyPoint['layer'];
  side: CandyPoint['pole'];
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
};

type BurstData = {
  id: number;
  position: THREE.Vector3;
  color: string;
};

const CANDY_RADIUS = 2;
const KNOT_GEOMETRY = new THREE.TorusKnotGeometry(0.062, 0.021, 40, 7, 2, 3);
const TIMELINE_LAYERS: CandyPoint['layer'][] = ['surge', 'continuation', 'range', 'plunge'];

function candyPose(candy: CandyPoint, index: number, elapsed: number) {
  const config = LAYER_CONFIG[candy.layer];
  const drift = Math.tanh(config.slope);
  const t = candy.t;
  const phi = config.phase + Math.PI * 6 * t + elapsed * 0.24;
  const z = drift * t;
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  const orbitRadius = CANDY_RADIUS * (1 + config.rangeFactor * 0.45 * t);
  const scale = 0.75 + candy.probability * 0.5;
  const rotation = [
    Math.sin(elapsed * 1.8 + index * 0.15) * 0.4,
    elapsed * 1.8 + index * 0.07 + TIMELINE_LAYERS.indexOf(candy.layer),
    Math.cos(elapsed * 1.4 + index * 0.13) * 0.4,
  ] as const;
  return {
    x: radial * Math.cos(phi) * orbitRadius,
    y: z * orbitRadius,
    z: radial * Math.sin(phi) * orbitRadius,
    rotation,
    scale,
  };
}

function makeTargets(): TargetDefinition[] {
  return TIMELINE_LAYERS.flatMap((layer, index) => {
    const angle = index * Math.PI / 2;
    return (['upper', 'lower'] as const).map((side) => ({
      id: `${layer}-${side}`,
      layer,
      side,
      position: [
        Math.cos(angle) * (side === 'upper' ? 3.05 : 2.85),
        side === 'upper' ? 0.72 : -0.72,
        Math.sin(angle) * (side === 'upper' ? 3.05 : 2.85),
      ] as [number, number, number],
      rotation: [0, -angle, 0] as [number, number, number],
      color: LAYER_COLORS[layer].base,
    }));
  });
}

function ImpactBurst({ burst, onComplete }: { burst: BurstData; onComplete: (id: number) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startedAt = useRef<number | null>(null);
  const shardCount = 18;
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const velocities = useMemo(() => Array.from({ length: shardCount }, (_, index) => {
    const y = 1 - 2 * (index + 0.5) / shardCount;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    return new THREE.Vector3(radial * Math.cos(angle), y, radial * Math.sin(angle)).multiplyScalar(1.4 + (index % 4) * 0.35);
  }), []);
  const origin = useMemo(() => burst.position.clone(), [burst]);

  useEffect(() => {
    const timeout = window.setTimeout(() => onComplete(burst.id), 1100);
    return () => window.clearTimeout(timeout);
  }, [burst.id, onComplete]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const age = clock.elapsedTime - startedAt.current;
    const fade = Math.max(0, 1 - age / 1.1);
    for (let index = 0; index < shardCount; index++) {
      position.copy(origin).addScaledVector(velocities[index], age);
      position.y -= 0.6 * age * age;
      quaternion.setFromEuler(new THREE.Euler(age * (index + 1), age * (index + 2), age * (index + 3)));
      const size = fade * (0.035 + (index % 3) * 0.009);
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale);
      meshRef.current.setMatrixAt(index, matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, shardCount]} count={shardCount}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={burst.color} emissive={burst.color} emissiveIntensity={3.5} toneMapped={false} />
    </instancedMesh>
  );
}

function TargetBox({
  target,
  handleToIndex,
  onCandyImpact,
}: {
  target: TargetDefinition;
  handleToIndex: Map<number, number>;
  onCandyImpact: (target: TargetDefinition, candyIndex: number, position: THREE.Vector3) => boolean;
}) {
  const visualRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const impactTime = useRef(-10);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    elapsedRef.current = clock.elapsedTime;
    if (!visualRef.current) return;
    const intensity = Math.max(0, 1 - (clock.elapsedTime - impactTime.current) / 0.52);
    const crush = intensity * intensity;
    visualRef.current.scale.set(1 + crush * 0.18, 1 - crush * 0.62, 1 + crush * 0.18);
  });

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={target.position}
      rotation={target.rotation}
      onCollisionEnter={({ other }) => {
        const index = other.rigidBody ? handleToIndex.get(other.rigidBody.handle) : undefined;
        if (index === undefined || !other.rigidBody) return;
        const translation = other.rigidBody.translation();
        tempPosition.set(translation.x, translation.y, translation.z);
        if (onCandyImpact(target, index, tempPosition.clone())) {
          impactTime.current = elapsedRef.current;
        }
      }}
    >
      <CuboidCollider args={[0.42, 0.34, 0.16]} />
      <group ref={visualRef}>
        <mesh>
          <boxGeometry args={[0.84, 0.68, 0.06]} />
          <meshPhysicalMaterial
            color={target.color}
            emissive={target.color}
            emissiveIntensity={1.7}
            metalness={0.72}
            roughness={0.18}
            clearcoat={1}
            transparent
            opacity={0.72}
            wireframe
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <boxGeometry args={[0.78, 0.62, 0.045]} />
          <meshBasicMaterial color={target.color} transparent opacity={0.08} depthWrite={false} />
        </mesh>
        <Text position={[0, 0, 0.05]} fontSize={0.095} color={target.color} anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#020611">
          {`${target.layer.toUpperCase()} / ${target.side.toUpperCase()}`}
        </Text>
      </group>
    </RigidBody>
  );
}

function InteractiveCandyBodies({ candies, onGrabChange, onImpact }: CandyXRPhysicsProps) {
  const bodiesRef = useRef<(RapierRigidBody | null)[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const handleToIndex = useRef(new Map<number, number>());
  const grabbed = useRef<{
    index: number;
    pointerId: number;
    offset: THREE.Vector3;
    previous: THREE.Vector3;
    rayDistance: number;
    timestamp: number;
    velocity: THREE.Vector3;
  } | null>(null);
  const thrown = useRef(new Set<number>());
  const impacted = useRef(new Set<number>());
  const [bursts, setBursts] = useState<BurstData[]>([]);
  const nextBurstId = useRef(0);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const rayPosition = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);
  const lightColor = useMemo(() => new THREE.Color('#ffffff'), []);
  const shadowColor = useMemo(() => new THREE.Color('#172554'), []);
  const instanceColor = useMemo(() => new THREE.Color(), []);
  const targets = useMemo(makeTargets, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    candies.forEach((candy, index) => {
      instanceColor.set(LAYER_COLORS[candy.layer].base);
      instanceColor.lerp(candy.pole === 'upper' ? lightColor : shadowColor, 0.2);
      mesh.setColorAt(index, instanceColor);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [candies, instanceColor, lightColor, shadowColor]);

  useFrame(({ clock }) => {
    for (let index = 0; index < candies.length; index++) {
      const body = bodiesRef.current[index];
      if (!body) continue;
      if (!handleToIndex.current.has(body.handle)) handleToIndex.current.set(body.handle, index);
      if (grabbed.current?.index === index || thrown.current.has(index) || impacted.current.has(index)) continue;

      const candy = candies[index];
      const config = LAYER_CONFIG[candy.layer];
      const drift = Math.tanh(config.slope);
      const t = candy.t;
      const phi = config.phase + Math.PI * 6 * t + clock.elapsedTime * 0.24;
      const z = drift * t;
      const radial = Math.sqrt(Math.max(0, 1 - z * z));
      const orbitRadius = CANDY_RADIUS * (1 + config.rangeFactor * 0.45 * t);
      const x = radial * Math.cos(phi) * orbitRadius;
      const y = z * orbitRadius;
      const depth = radial * Math.sin(phi) * orbitRadius;
      euler.set(
        Math.sin(clock.elapsedTime * 1.8 + index * 0.15) * 0.4,
        clock.elapsedTime * 1.8 + index * 0.07 + TIMELINE_LAYERS.indexOf(candy.layer),
        Math.cos(clock.elapsedTime * 1.4 + index * 0.13) * 0.4,
      );
      quaternion.setFromEuler(euler);
      body.setNextKinematicTranslation({ x, y, z: depth });
      body.setNextKinematicRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });
    }
  });

  const handleCandyImpact = useCallback((target: TargetDefinition, index: number, impactPosition: THREE.Vector3) => {
    const body = bodiesRef.current[index];
    if (!body || !thrown.current.has(index) || impacted.current.has(index)) return false;
    impacted.current.add(index);
    thrown.current.delete(index);
    body.setBodyType(RigidBodyType.KinematicPositionBased, true);
    body.setNextKinematicTranslation({ x: 0, y: -20 - index * 0.01, z: 0 });
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const id = nextBurstId.current++;
    setBursts((current) => [...current, { id, position: impactPosition, color: target.color }]);
    onImpact?.(target.id);
    return true;
  }, [onImpact]);

  const releaseGrab = useCallback((event: ThreeEvent<PointerEvent>) => {
    const active = grabbed.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const body = bodiesRef.current[active.index];
    grabbed.current = null;
    onGrabChange?.(false);
    const captureTarget = event.nativeEvent.target;
    if (captureTarget instanceof Element && captureTarget.hasPointerCapture(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId);
    }
    if (!body) return;

    if (active.velocity.length() < 0.45) {
      body.setBodyType(RigidBodyType.KinematicPositionBased, true);
      return;
    }
    active.velocity.clampLength(0, 11.5);
    body.setBodyType(RigidBodyType.Dynamic, true);
    body.setLinvel({ x: active.velocity.x, y: active.velocity.y, z: active.velocity.z }, true);
    body.setAngvel({ x: 2.5, y: 3.8, z: 2.1 }, true);
    thrown.current.add(active.index);
  }, [onGrabChange]);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    const index = event.instanceId;
    if (index === undefined || index >= candies.length || impacted.current.has(index) || grabbed.current) return;
    const body = bodiesRef.current[index];
    if (!body) return;
    event.stopPropagation();
    body.setBodyType(RigidBodyType.KinematicPositionBased, true);
    const current = body.translation();
    const bodyPosition = new THREE.Vector3(current.x, current.y, current.z);
    grabbed.current = {
      index,
      pointerId: event.pointerId,
      offset: bodyPosition.sub(event.point),
      previous: event.point.clone(),
      rayDistance: event.point.distanceTo(event.ray.origin),
      timestamp: performance.now(),
      velocity: new THREE.Vector3(),
    };
    onGrabChange?.(true);
    const captureTarget = event.nativeEvent.target;
    if (captureTarget instanceof Element) captureTarget.setPointerCapture(event.pointerId);
  }, [candies.length, onGrabChange]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const active = grabbed.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const body = bodiesRef.current[active.index];
    if (!body) return;
    const now = performance.now();
    const elapsed = Math.max(0.008, (now - active.timestamp) / 1000);
    event.ray.at(active.rayDistance, rayPosition);
    destination.copy(rayPosition).add(active.offset);
    active.velocity.copy(destination).sub(active.previous).multiplyScalar(1 / elapsed);
    active.previous.copy(destination);
    active.timestamp = now;
    body.setNextKinematicTranslation({ x: destination.x, y: destination.y, z: destination.z });
  }, []);

  const instances = useMemo(() => candies.map((candy, index) => {
    const pose = candyPose(candy, index, 0);
    return {
      key: candy.id,
      position: [pose.x, pose.y, pose.z] as [number, number, number],
      rotation: [...pose.rotation] as [number, number, number],
      scale: [pose.scale, pose.scale, pose.scale] as [number, number, number],
    };
  }), [candies]);

  const completeBurst = useCallback((id: number) => {
    setBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  return (
    <>
      {targets.map((target) => (
        <TargetBox
          key={target.id}
          target={target}
          handleToIndex={handleToIndex.current}
          onCandyImpact={handleCandyImpact}
        />
      ))}
      <InstancedRigidBodies
        ref={bodiesRef}
        instances={instances}
        type="kinematicPosition"
        colliders={false}
        colliderNodes={[<BallCollider key="candy-ball" args={[0.105]} />]}
        linearDamping={0.12}
        angularDamping={0.15}
      >
        <instancedMesh
          ref={meshRef}
          args={[KNOT_GEOMETRY, undefined, candies.length]}
          count={candies.length}
          castShadow
          receiveShadow
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releaseGrab}
          onPointerCancel={releaseGrab}
        >
          <meshPhysicalMaterial
            roughness={0.08}
            metalness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.06}
            transmission={0.35}
            thickness={0.8}
            ior={1.48}
            reflectivity={0.92}
            emissive="#061626"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </instancedMesh>
      </InstancedRigidBodies>
      {bursts.map((burst) => <ImpactBurst key={burst.id} burst={burst} onComplete={completeBurst} />)}
    </>
  );
}

export default function CandyXRPhysics({ candies, onGrabChange, onImpact }: CandyXRPhysicsProps) {
  return (
    <Physics gravity={[0, -1.2, 0]} timeStep="vary" colliders={false}>
      <InteractiveCandyBodies candies={candies} onGrabChange={onGrabChange} onImpact={onImpact} />
    </Physics>
  );
}
