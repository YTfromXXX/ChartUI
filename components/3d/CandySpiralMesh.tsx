'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  LAYER_COLORS,
  LAYER_CONFIG,
  type CandyPoint,
} from '@/lib/candyPoints';

type CyberpunkPriceSphereProps = {
  radius?: number;
  price?: number;
  symbol?: string;
  wuxingPhase?: string;
};

/**
 * Requirement 1: Center price sphere with 48 inner cells and a translucent
 * cyberpunk glass/wireframe shell.
 */
export function CyberpunkPriceSphere({
  radius = 2.0,
  price,
  symbol = 'BTCUSD',
  wuxingPhase = 'WATER',
}: CyberpunkPriceSphereProps) {
  const outerSphereRef = useRef<THREE.Mesh>(null);
  const innerCellsRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  // 8 widthSegments x 6 heightSegments = exactly 48 quad cells on the sphere
  const cellGeometry = useMemo(() => new THREE.SphereGeometry(radius * 0.94, 8, 6), [radius]);
  const cellEdges = useMemo(() => new THREE.EdgesGeometry(cellGeometry), [cellGeometry]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    if (innerCellsRef.current) {
      innerCellsRef.current.rotation.y = elapsed * 0.08;
      innerCellsRef.current.rotation.x = Math.sin(elapsed * 0.15) * 0.08;
    }

    if (outerSphereRef.current) {
      const pulse = 1.0 + Math.sin(elapsed * 2.2) * 0.02;
      outerSphereRef.current.scale.setScalar(pulse);
    }

    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = elapsed * 0.45;
      ring1Ref.current.rotation.x = Math.PI / 3 + Math.sin(elapsed * 0.3) * 0.15;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -elapsed * 0.35;
      ring2Ref.current.rotation.y = Math.PI / 4 + Math.cos(elapsed * 0.25) * 0.2;
    }

    if (coreRef.current) {
      const corePulse = 0.95 + Math.sin(elapsed * 3.6) * 0.08;
      coreRef.current.scale.setScalar(corePulse);
    }
  });

  const coreColor = wuxingPhase === 'FIRE' ? '#ff385c' : '#00f0ff';

  return (
    <group>
      {/* 48-cell faceted inner shell */}
      <mesh ref={innerCellsRef} geometry={cellGeometry}>
        <meshPhysicalMaterial
          color="#04182b"
          emissive="#004d73"
          emissiveIntensity={0.65}
          roughness={0.2}
          metalness={0.7}
          transmission={0.45}
          thickness={0.8}
          transparent
          opacity={0.65}
          flatShading
        />
      </mesh>

      {/* 48-cell luminous neon wireframe grid */}
      <lineSegments geometry={cellEdges}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.65} depthWrite={false} />
      </lineSegments>

      {/* Outer translucent cyberpunk glass sphere */}
      <mesh ref={outerSphereRef}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshPhysicalMaterial
          color="#020d1a"
          emissive="#00e5ff"
          emissiveIntensity={0.35}
          roughness={0.08}
          metalness={0.15}
          clearcoat={1.0}
          clearcoatRoughness={0.06}
          transmission={0.78}
          thickness={1.4}
          ior={1.45}
          reflectivity={0.95}
          transparent
          opacity={0.82}
        />
      </mesh>

      {/* Pulsing central core with current price energy */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[radius * 0.35, 2]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={2.5}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>

      {/* Cyberpunk scanning latitude ring */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[radius * 1.18, 0.012, 16, 64]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.7} depthWrite={false} />
      </mesh>

      {/* Cyberpunk tilted meridian scanning ring */}
      <mesh ref={ring2Ref}>
        <torusGeometry args={[radius * 1.28, 0.009, 16, 64]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

type CandyInstancedMeshProps = {
  candies: CandyPoint[];
  radius?: number;
  orbitSpeed?: number;
  spinSpeed?: number;
  onHoverCandy?: (candy: CandyPoint | null) => void;
};

/**
 * Requirements 2, 3, 4:
 * - 384 candy points rendered via THREE.InstancedMesh
 * - Compact TorusKnotGeometry with MeshPhysicalMaterial for neon jelly-candy finish
 * - DNA-like self-rotation + orbital revolution along the 4 prediction spirals in useFrame
 */
export function CandyInstancedMesh({
  candies,
  radius = 2.0,
  orbitSpeed = 0.24,
  spinSpeed = 1.8,
  onHoverCandy,
}: CandyInstancedMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = candies.length;

  // Compact, glossy knot candy geometry
  const knotGeometry = useMemo(
    () => new THREE.TorusKnotGeometry(0.062, 0.021, 48, 8, 2, 3),
    [],
  );

  // Scratch memory objects reused every frame (0 allocations per frame)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempNormal = useMemo(() => new THREE.Vector3(), []);
  const tempTangent = useMemo(() => new THREE.Vector3(), []);
  const spinQuat = useMemo(() => new THREE.Quaternion(), []);
  const alignQuat = useMemo(() => new THREE.Quaternion(), []);
  const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // Initialize instance colors based on the 4 timeline layers
  const colorsInitialized = useRef(false);
  useFrame(() => {
    if (!meshRef.current || colorsInitialized.current || count === 0) return;
    const tempColor = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const candy = candies[i];
      const layerColor = LAYER_COLORS[candy.layer];
      tempColor.set(layerColor.base);
      // Brighten upper pole, deep saturated hue on lower pole
      if (candy.pole === 'upper') {
        tempColor.lerp(new THREE.Color('#ffffff'), 0.22);
      } else {
        tempColor.lerp(new THREE.Color('#1e1b4b'), 0.15);
      }
      meshRef.current.setColorAt(i, tempColor);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    colorsInitialized.current = true;
  });

  // Requirement 4: DNA-like self-rotation + orbital revolution along 4 prediction spirals
  useFrame(({ clock }) => {
    if (!meshRef.current || count === 0) return;
    const elapsed = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const candy = candies[i];
      const config = LAYER_CONFIG[candy.layer];
      const drift = Math.tanh(config.slope);
      const t = candy.t;

      // Orbital phase advances smoothly with elapsed time
      const layerOffset = config.phase;
      const phi = layerOffset + 2 * Math.PI * 3.0 * t + elapsed * orbitSpeed;
      const zStar = drift * t;
      const radiusXy = Math.sqrt(Math.max(0, 1 - zStar * zStar));

      // Calculate unit surface normal along spiral
      const nx = radiusXy * Math.cos(phi);
      const nz = radiusXy * Math.sin(phi);
      const ny = zStar; // Y is the vertical price axis

      tempNormal.set(nx, ny, nz);

      // Radial growth factor (distance from center)
      const growth = 1.0 + config.rangeFactor * 0.45 * t;
      const r = radius * growth;

      // Position in world coordinates
      tempPosition.set(nx * r, ny * r, nz * r);

      // DNA-like helical tangent vector
      tempTangent.set(
        -radiusXy * Math.sin(phi) * 2 * Math.PI * 3.0,
        drift,
        radiusXy * Math.cos(phi) * 2 * Math.PI * 3.0,
      ).normalize();

      // Align base orientation to outward surface normal
      alignQuat.setFromUnitVectors(upVector, tempNormal);

      // DNA-like self-rotation around local normal + tangent twist
      const localSpinAngle = elapsed * spinSpeed * (1.0 + (candy.cell_index % 4) * 0.25) + candy.t * 8;
      spinQuat.setFromAxisAngle(tempTangent, localSpinAngle);
      tempQuat.multiplyQuaternions(alignQuat, spinQuat);

      // Size modulated by prediction probability and slight pulsing
      const pulse = 1.0 + Math.sin(elapsed * 3.0 + i * 0.15) * 0.08;
      const scaleVal = (0.75 + candy.probability * 0.5) * pulse;
      tempScale.set(scaleVal, scaleVal, scaleVal);

      tempMatrix.compose(tempPosition, tempQuat, tempScale);
      meshRef.current.setMatrixAt(i, tempMatrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[knotGeometry, undefined, count]}
      castShadow
      receiveShadow
      onPointerMove={(e) => {
        if (e.instanceId !== undefined && e.instanceId < count) {
          onHoverCandy?.(candies[e.instanceId]);
        }
      }}
      onPointerOut={() => onHoverCandy?.(null)}
    >
      <meshPhysicalMaterial
        roughness={0.08}
        metalness={0.12}
        clearcoat={1.0}
        clearcoatRoughness={0.06}
        transmission={0.42}
        thickness={0.85}
        ior={1.48}
        reflectivity={0.92}
        emissive="#0a1a2e"
        emissiveIntensity={0.8}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
