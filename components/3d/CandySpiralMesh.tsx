'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { KnotFieldStyle } from '@/components/2d/KnotChart';
import {
  LAYER_COLORS,
  LAYER_CONFIG,
  type CandyPoint,
} from '@/lib/candyPoints';
import { MATRIX_ROLES } from '@/lib/marketCatalog';

type CyberpunkPriceSphereProps = {
  radius?: number;
  price?: number;
  symbol?: string;
  wuxingPhase?: string;
  eyeMode?: boolean;
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
  eyeMode = false,
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
          opacity={eyeMode ? 0.035 : 0.65}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>

      {/* 48-cell luminous neon wireframe grid */}
      <lineSegments geometry={cellEdges}>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.65} depthWrite={false} />
      </lineSegments>

      {/* Outer translucent cyberpunk glass sphere */}
      {!eyeMode && <mesh ref={outerSphereRef}>
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
      </mesh>}

      {/* Pulsing central core with current price energy */}
      {!eyeMode && <mesh ref={coreRef}>
        <icosahedronGeometry args={[radius * 0.35, 2]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={2.5}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>}

      {/* Cyberpunk scanning latitude ring */}
      {!eyeMode && <mesh ref={ring1Ref}>
        <torusGeometry args={[radius * 1.18, 0.012, 16, 64]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.7} depthWrite={false} />
      </mesh>}

      {/* Cyberpunk tilted meridian scanning ring */}
      {!eyeMode && <mesh ref={ring2Ref}>
        <torusGeometry args={[radius * 1.28, 0.009, 16, 64]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.55} depthWrite={false} />
      </mesh>}
    </group>
  );
}

type CandyInstancedMeshProps = {
  candies: CandyPoint[];
  radius?: number;
  orbitSpeed?: number;
  spinSpeed?: number;
  onHoverCandy?: (candy: CandyPoint | null) => void;
  fieldStyle?: KnotFieldStyle;
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
  fieldStyle,
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
  const crystalUniforms = useMemo(() => ({
    uMetalTime: { value: 0 },
    uMetalLayerGrowth: { value: 0 },
    uMetalJumpTime: { value: -1000 },
    uMetalMicroTremor: { value: 0 },
    uCandyVibration: { value: 0 },
    uCandyVibrationFrequency: { value: 1 },
    uCandyEmissive: { value: 0.8 },
    uAnimalTime: { value: 0 },
    uAnimalSync: { value: 0 },
    uAnimalPhase: { value: 0 },
  }), []);
  const candyMaterial = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      roughness: 0.08,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      transmission: 0.42,
      thickness: 0.85,
      ior: 1.48,
      reflectivity: 0.92,
      emissive: '#0a1a2e',
      emissiveIntensity: 0.8,
      toneMapped: false,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, crystalUniforms);
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
uniform float uMetalTime;
uniform float uMetalLayerGrowth;
uniform float uMetalJumpTime;
uniform float uMetalMicroTremor;
uniform float uCandyVibration;
uniform float uCandyVibrationFrequency;
uniform float uAnimalTime;
uniform float uAnimalSync;
uniform float uAnimalPhase;
varying float vSynapsePulse;`,
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float metalLayer = sin(position.y * 92.0 + uMetalLayerGrowth * 180.0) * 0.0015;
float crackField = sin(position.x * 51.0 + position.y * 67.0 + position.z * 43.0);
float flashEnvelope = exp(-max(0.0, uMetalTime - uMetalJumpTime) * 2.8);
float crackDisplacement = step(0.965, crackField) * flashEnvelope * 0.018;
float fieldVibration = sin(uMetalTime * uCandyVibrationFrequency * 12.0 + position.y * 36.0) * uCandyVibration * 0.004;
transformed += normalize(position) * (metalLayer + crackDisplacement + sin(uMetalTime * 18.0 + position.y * 36.0) * uMetalMicroTremor * 0.002 + fieldVibration);
#ifdef USE_INSTANCING
vec3 synapsePosition = instanceMatrix[3].xyz;
float synapseRadius = max(length(synapsePosition.xz), 0.001);
float goldenSpiralCoordinate = atan(synapsePosition.z, synapsePosition.x) - log(synapseRadius) * 2.39996323;
float pulseWave = 0.5 + 0.5 * cos(goldenSpiralCoordinate * 3.0 - uAnimalTime * 7.0 + uAnimalPhase);
vSynapsePulse = pow(pulseWave, 12.0) * uAnimalSync;
#else
vSynapsePulse = 0.0;
#endif`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float uMetalTime;
uniform float uMetalLayerGrowth;
uniform float uMetalJumpTime;
uniform float uCandyEmissive;
varying float vSynapsePulse;`,
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float metalFlash = exp(-max(0.0, uMetalTime - uMetalJumpTime) * 2.8);
float crystalBand = sin(vViewPosition.y * 32.0 + uMetalLayerGrowth * 120.0);
vec3 interference = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + crystalBand * 1.3 + uMetalTime * 2.0);
diffuseColor.rgb = mix(diffuseColor.rgb, interference, metalFlash * 0.78);
vec3 actionPotential = mix(vec3(0.08, 0.8, 1.0), vec3(1.0, 0.88, 0.48), clamp(vSynapsePulse, 0.0, 1.0));
diffuseColor.rgb = mix(diffuseColor.rgb, actionPotential, clamp(vSynapsePulse * 0.92, 0.0, 0.92));
diffuseColor.rgb *= 1.0 + 0.12 * crystalBand + uCandyEmissive * 0.035 + vSynapsePulse * 0.55;`,
      );
    };
    material.customProgramCacheKey = () => 'field-candy-synapse-pulse-v3';
    return material;
  }, [crystalUniforms]);
  const lastJumpTime = useRef(-1000);
  const previousJump = useRef(false);
  useEffect(() => () => candyMaterial.dispose(), [candyMaterial]);

  // Initialize instance colors based on the 4 timeline layers
  const colorsInitialized = useRef(false);
  const colorSignature = useRef('');
  useFrame(() => {
    const signature = `${count}:${fieldStyle?.resonanceArcanaId ?? -1}:${Math.round((fieldStyle?.invasionStrength ?? 0) * 10)}:${Math.round((fieldStyle?.candyHueShift ?? 0) * 10)}`;
    if (!meshRef.current || (colorsInitialized.current && colorSignature.current === signature) || count === 0) return;
    const tempColor = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const candy = candies[i];
      const layerColor = LAYER_COLORS[candy.layer];
      tempColor.set(layerColor.base);
      tempColor.offsetHSL(fieldStyle?.candyHueShift ?? 0, 0, 0);
      // Brighten upper pole, deep saturated hue on lower pole
      if (candy.pole === 'upper') {
        tempColor.lerp(new THREE.Color('#ffffff'), 0.22);
      } else {
        tempColor.lerp(new THREE.Color('#1e1b4b'), 0.15);
      }
      if (fieldStyle?.resonanceArcanaId === candy.cell_index % 22) {
        tempColor.lerp(new THREE.Color((fieldStyle.invasionStrength ?? 0) > 0.72 ? '#fb7185' : '#fbbf24'), 0.35 + (fieldStyle.invasionStrength ?? 0) * 0.5);
      }
      meshRef.current.setColorAt(i, tempColor);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    colorsInitialized.current = true;
    colorSignature.current = signature;
  });

  // Requirement 4: DNA-like self-rotation + orbital revolution along 4 prediction spirals
  useFrame(({ clock }) => {
    if (!meshRef.current || count === 0) return;
    const elapsed = clock.getElapsedTime();
    const invasion = THREE.MathUtils.clamp(fieldStyle?.invasionStrength ?? 0, 0, 1);
    const spinModifier = THREE.MathUtils.clamp(fieldStyle?.candySpinModifier ?? 1, 0.7, 1.6);
    const massScale = THREE.MathUtils.clamp(fieldStyle?.candyMass ?? 1, 0.6, 2.5);
    const radialScale = THREE.MathUtils.clamp(fieldStyle?.candyRadialScale ?? 1, 0.85, 1.2);
    const angularVelocity = THREE.MathUtils.clamp(fieldStyle?.candyAngularVelocity ?? 0, -8, 8);
    const vibration = THREE.MathUtils.clamp(fieldStyle?.vibration ?? 0, 0, 2);
    const jump = fieldStyle?.metalJump ?? false;
    if (jump && !previousJump.current) lastJumpTime.current = elapsed;
    previousJump.current = jump;
    crystalUniforms.uMetalTime.value = elapsed;
    crystalUniforms.uMetalLayerGrowth.value = THREE.MathUtils.clamp((fieldStyle?.metalLayerGrowth ?? 0) * 40, -1, 1);
    crystalUniforms.uMetalJumpTime.value = lastJumpTime.current;
    crystalUniforms.uMetalMicroTremor.value = THREE.MathUtils.clamp(Math.abs(fieldStyle?.metalMicroTremor ?? 0), 0, 1);
    crystalUniforms.uCandyVibration.value = vibration * 0.025;
    crystalUniforms.uCandyVibrationFrequency.value = THREE.MathUtils.clamp(fieldStyle?.candyVibrationFrequency ?? 1, 0.2, 5);
    crystalUniforms.uCandyEmissive.value = THREE.MathUtils.clamp(fieldStyle?.candyEmissive ?? 0.8, 0, 2);
    crystalUniforms.uAnimalTime.value = elapsed;
    crystalUniforms.uAnimalSync.value = THREE.MathUtils.clamp(fieldStyle?.animalPulseStrength ?? 0, 0, 1);
    crystalUniforms.uAnimalPhase.value = THREE.MathUtils.clamp(fieldStyle?.animalPulsePhase ?? 0, -Math.PI, Math.PI);

    for (let i = 0; i < count; i++) {
      const candy = candies[i];
      const config = LAYER_CONFIG[candy.layer];
      const role = MATRIX_ROLES[candy.cell_index % MATRIX_ROLES.length];
      const drift = Math.tanh(config.slope);
      const t = candy.t;

      // Orbital phase advances smoothly with elapsed time
      const layerOffset = config.phase;
      const phi = layerOffset + 2 * Math.PI * 3.0 * t + elapsed * orbitSpeed
        + (fieldStyle?.candyPhaseOffset ?? 0)
        + Math.sin(elapsed * 0.62 + candy.cell_index * 0.21) * invasion * 0.075;
      const zStar = drift * t;
      const radiusXy = Math.sqrt(Math.max(0, 1 - zStar * zStar));

      // Calculate unit surface normal along spiral
      const nx = radiusXy * Math.cos(phi);
      const nz = radiusXy * Math.sin(phi);
      const ny = zStar; // Y is the vertical price axis

      tempNormal.set(nx, ny, nz);

      // Radial growth factor (distance from center)
      const growth = 1.0 + config.rangeFactor * 0.45 * t;
      const r = THREE.MathUtils.clamp(
        radius * growth * radialScale * (1 + Math.sin(elapsed * 0.8 + candy.cell_index * 0.3) * invasion * 0.035),
        radius * 0.8,
        radius * 1.75,
      );

      // Position in world coordinates
      tempPosition.set(nx * r, ny * r, nz * r);
      const braidStrength = THREE.MathUtils.clamp(fieldStyle?.animalBraidStrength ?? 0, 0, 1);
      const braidAngle = braidStrength * (t - 0.5) * 0.22 + (fieldStyle?.animalPulsePhase ?? 0) * braidStrength * 0.025;
      const braidRadiusScale = 1 - braidStrength * 0.22;
      const braidedX = tempPosition.x * braidRadiusScale;
      const braidedZ = tempPosition.z * braidRadiusScale;
      tempPosition.x = braidedX * Math.cos(braidAngle) - braidedZ * Math.sin(braidAngle);
      tempPosition.z = braidedX * Math.sin(braidAngle) + braidedZ * Math.cos(braidAngle);

      // DNA-like helical tangent vector
      tempTangent.set(
        -radiusXy * Math.sin(phi) * 2 * Math.PI * 3.0,
        drift,
        radiusXy * Math.cos(phi) * 2 * Math.PI * 3.0,
      ).normalize();

      // Align base orientation to outward surface normal
      alignQuat.setFromUnitVectors(upVector, tempNormal);

      // DNA-like self-rotation around local normal + tangent twist
      const angularScale = THREE.MathUtils.clamp(1 + Math.abs(angularVelocity) * 0.025, 0.75, 1.5);
      const roleAngularScale = 1 + (angularScale - 1) * (1 - role.candy.rigidity * 0.5);
      const localSpinAngle = elapsed * spinSpeed * spinModifier * roleAngularScale * (1.0 + (candy.cell_index % 4) * 0.25) + candy.t * 8;
      spinQuat.setFromAxisAngle(tempTangent, localSpinAngle);
      tempQuat.multiplyQuaternions(alignQuat, spinQuat);

      // Size modulated by prediction probability and slight pulsing
      const roleMass = THREE.MathUtils.clamp(role.candy.mass, 0.5, 2);
      const roleVibration = THREE.MathUtils.clamp(role.candy.vibration, 0, 1);
      const pulse = 1.0 + Math.sin(elapsed * (2.0 + (fieldStyle?.candyVibrationFrequency ?? 1) * 0.6) + i * 0.15) * (0.03 + roleVibration * 0.025 + vibration * 0.025 + invasion * 0.04);
      const resonantCandy = fieldStyle?.resonanceArcanaId === candy.cell_index % 22;
      const scaleVal = (0.75 + candy.probability * 0.5) * pulse * (0.9 + massScale * 0.07 + roleMass * 0.03)
        * (1 + (role.candy.radialScale - 1) * 0.35) * (1 + braidStrength * 0.24)
        * (resonantCandy ? 1 + invasion * 0.16 : 1);
      tempScale.set(scaleVal * (1 + braidStrength * 0.18), scaleVal, scaleVal * (1 + braidStrength * 0.18));

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
      <primitive object={candyMaterial} attach="material" />
    </instancedMesh>
  );
}
