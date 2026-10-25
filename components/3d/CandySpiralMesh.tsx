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
  onHoverCandy?: (candy: CandyPoint | null, index?: number, particleSample?: number) => void;
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
    () => {
      const geometry = new THREE.TorusKnotGeometry(0.062, 0.021, 48, 8, 2, 3);
      geometry.setAttribute(
        'aCandyCellIndex',
        new THREE.InstancedBufferAttribute(
          new Float32Array(candies.map((candy) => candy.cell_index)),
          1,
        ),
      );
      return geometry;
    },
    [candies],
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
    uMetalSparkCell: { value: -1 },
    uMetalSparkIntensity: { value: 0 },
    uCandyVibration: { value: 0 },
    uCandyVibrationFrequency: { value: 1 },
    uCandyEmissive: { value: 0.8 },
    uAnimalTime: { value: 0 },
    uAnimalSync: { value: 0 },
    uAnimalPhase: { value: 0 },
    uAnimalBraid: { value: 0 },
    uMetaTime: { value: 0 },
    uMetaRippleAge: { value: 1000 },
    uMetaRippleStrength: { value: 0 },
    uMetaCrackIntensity: { value: 0 },
    uMetaPulsarMass: { value: 1 },
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
uniform float uMetalSparkCell;
uniform float uMetalSparkIntensity;
attribute float aCandyCellIndex;
uniform float uCandyVibration;
uniform float uCandyVibrationFrequency;
uniform float uAnimalTime;
uniform float uAnimalSync;
uniform float uAnimalPhase;
uniform float uAnimalBraid;
uniform float uMetaTime;
uniform float uMetaRippleAge;
uniform float uMetaRippleStrength;
uniform float uMetaCrackIntensity;
uniform float uMetaPulsarMass;
varying float vSynapsePulse;
varying float vMetaRipple;
varying float vMetaCrack;
varying float vMetalFlash;
varying float vMetalSpark;`,
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float metalLayerPhase = position.y * 92.0 + uMetalLayerGrowth * 180.0 + uMetalTime * 0.45;
float metalLayer = sin(metalLayerPhase) * 0.003;
float crystalRidge = pow(max(0.0, cos(metalLayerPhase)), 10.0) * 0.006;
float crackField = sin(position.x * 51.0 + position.y * 67.0 + position.z * 43.0 + sin(position.y * 18.0) * 2.0);
float crackLine = 1.0 - smoothstep(0.015, 0.09, abs(crackField));
float flashEnvelope = exp(-max(0.0, uMetalTime - uMetalJumpTime) * 2.8);
float crackDisplacement = crackLine * flashEnvelope * 0.03;
float fieldVibration = sin(uMetalTime * uCandyVibrationFrequency * 12.0 + position.y * 36.0) * uCandyVibration * 0.004;
transformed += normalize(position) * (metalLayer + crystalRidge + crackDisplacement + sin(uMetalTime * 18.0 + position.y * 36.0) * uMetalMicroTremor * 0.002 + fieldVibration);
vMetalFlash = flashEnvelope * max(crackLine, uMetalMicroTremor * 0.4);
float sparkCellMatch = 1.0 - step(0.5, abs(aCandyCellIndex - uMetalSparkCell));
float sparkDivisionLine = smoothstep(0.76, 0.98, abs(sin(position.x * 52.0 + position.y * 37.0 + position.z * 44.0)));
vMetalSpark = sparkCellMatch * sparkDivisionLine * uMetalSparkIntensity;
float rippleRadius = uMetaRippleAge * 2.8;
float rippleWave = sin((length(instanceMatrix[3].xyz) - rippleRadius) * 18.0);
float rippleEnvelope = exp(-max(0.0, uMetaRippleAge) * 1.8) * uMetaRippleStrength;
float pulsarRipple = rippleWave * rippleEnvelope * (0.0015 + uMetaPulsarMass * 0.0008);
float horizonCrack = step(0.94, abs(sin(position.x * 31.0 + sin(position.y * 27.0) * 2.1 + position.z * 19.0)));
float crackDisplacementMeta = horizonCrack * uMetaCrackIntensity * (0.004 + uMetaPulsarMass * 0.001);
transformed += normalize(position) * (pulsarRipple + crackDisplacementMeta);
vMetaRipple = abs(rippleWave) * rippleEnvelope;
vMetaCrack = horizonCrack * uMetaCrackIntensity;
#ifdef USE_INSTANCING
vec3 synapsePosition = instanceMatrix[3].xyz;
float synapseRadius = max(length(synapsePosition.xz), 0.001);
float goldenSpiralCoordinate = atan(synapsePosition.z, synapsePosition.x) - log(synapseRadius) * 2.39996323;
float synapsePhase = goldenSpiralCoordinate * 3.0 - uAnimalTime * 7.0 + uAnimalPhase;
float pulseWave = 0.5 + 0.5 * cos(synapsePhase);
float braidWave = sin(synapsePhase * 0.55 + position.y * 38.0);
transformed += vec3(cos(synapsePhase), braidWave, sin(synapsePhase)) * uAnimalBraid * 0.012;
vSynapsePulse = pow(pulseWave, 8.0) * max(uAnimalSync, uAnimalBraid * 0.4);
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
uniform float uMetalSparkIntensity;
uniform float uCandyEmissive;
uniform float uMetaTime;
uniform float uMetaCrackIntensity;
varying float vSynapsePulse;
varying float vMetaRipple;
varying float vMetaCrack;
varying float vMetalFlash;
varying float vMetalSpark;`,
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float metalFlash = exp(-max(0.0, uMetalTime - uMetalJumpTime) * 2.8);
vec3 metalSparkColor = mix(vec3(1.0, 0.48, 0.08), vec3(1.0, 0.97, 0.76), clamp(vMetalSpark, 0.0, 1.0));
diffuseColor.rgb = mix(diffuseColor.rgb, metalSparkColor, clamp(vMetalSpark, 0.0, 1.0));
float crystalBand = sin(vViewPosition.y * 32.0 + uMetalLayerGrowth * 120.0 + uMetalTime * 0.45);
vec3 interference = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + crystalBand * 2.0 + uMetalTime * 3.6);
float metalCrackLine = 1.0 - smoothstep(0.015, 0.11, abs(sin(vViewPosition.x * 51.0 + vViewPosition.y * 67.0 + vViewPosition.z * 43.0)));
diffuseColor.rgb = mix(diffuseColor.rgb, interference, clamp(vMetalFlash * (0.72 + metalCrackLine * 0.8), 0.0, 1.0));
diffuseColor.rgb += interference * metalCrackLine * vMetalFlash * 0.7;
float metaCrack = step(0.82, abs(sin(vViewPosition.x * 34.0 + sin(vViewPosition.y * 19.0 + vViewPosition.z * 11.0) * 2.4)));
float crackPulse = 0.55 + 0.45 * sin(uMetaTime * 6.0 + vViewPosition.y * 9.0);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.86, 1.0), clamp(vMetaRipple * 0.9, 0.0, 0.9));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.34, 0.12), metaCrack * vMetaCrack * crackPulse);
vec3 actionPotential = mix(vec3(0.08, 0.8, 1.0), vec3(1.0, 0.88, 0.48), clamp(vSynapsePulse, 0.0, 1.0));
diffuseColor.rgb = mix(diffuseColor.rgb, actionPotential, clamp(vSynapsePulse * 0.92, 0.0, 0.92));
diffuseColor.rgb *= 1.0 + 0.2 * crystalBand + uCandyEmissive * 0.035 + vSynapsePulse * 0.9 + uMetaCrackIntensity * 0.12;`,
      );
    };
    material.customProgramCacheKey = () => 'field-candy-synapse-pulsar-v7';
    return material;
  }, [crystalUniforms]);
  const lastJumpTime = useRef(-1000);
  const lastMetalEventTimestamp = useRef(0);
  const metalEventStartTime = useRef(-1000);
  const metalEventStrength = useRef(0);
  const lastMetaRippleTimestamp = useRef(0);
  const metaRippleStartedAt = useRef(-1000);
  const metaRippleEventStrength = useRef(0);
  const previousJump = useRef(false);
  useEffect(() => () => candyMaterial.dispose(), [candyMaterial]);
  useEffect(() => {
    const isMeta = fieldStyle?.metaPulsarMass !== undefined;
    const isMetal = fieldStyle?.metalLayerGrowth !== undefined;
    const isAnimal = fieldStyle?.animalBraidStrength !== undefined;
    const nextFlatShading = isMeta || isMetal;
    const nextRoughness = isMeta ? 0.42 : isMetal ? 0.2 : isAnimal ? 0.14 : 0.08;
    const nextMetalness = isMeta ? 0.72 : isMetal ? 0.48 : isAnimal ? 0.22 : 0.12;
    if (candyMaterial.flatShading !== nextFlatShading || candyMaterial.roughness !== nextRoughness || candyMaterial.metalness !== nextMetalness) {
      candyMaterial.flatShading = nextFlatShading;
      candyMaterial.roughness = nextRoughness;
      candyMaterial.metalness = nextMetalness;
      candyMaterial.needsUpdate = true;
    }
  }, [candyMaterial, fieldStyle?.animalBraidStrength, fieldStyle?.metaPulsarMass, fieldStyle?.metalLayerGrowth]);

  // Initialize instance colors based on the 4 timeline layers
  const colorsInitialized = useRef(false);
  const colorSignature = useRef('');
  useFrame(() => {
    const signature = `${count}:${fieldStyle?.resonanceArcanaId ?? -1}:${fieldStyle?.metaTargetArcanaId ?? -1}:${Math.round((fieldStyle?.invasionStrength ?? 0) * 10)}:${Math.round((fieldStyle?.candyHueShift ?? 0) * 10)}`;
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
      const resonanceId = fieldStyle?.metaTargetArcanaId ?? fieldStyle?.resonanceArcanaId;
      if (resonanceId === candy.tarot.id) {
        tempColor.lerp(new THREE.Color(fieldStyle?.metaCrackIntensity ? '#f97316' : (fieldStyle?.invasionStrength ?? 0) > 0.72 ? '#fb7185' : '#fbbf24'), 0.35 + (fieldStyle?.invasionStrength ?? 0) * 0.5);
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
  const kumoBreakSeen = useRef(0);
  const collapseSeen = useRef(0);
  const collapseStart = useRef(-1000);
  const animalPhaseClock = useRef(0);
  const metalSparkCell = useRef(-1);
  const lastCleaveTimestamp = useRef(0);
  const metalStepLevel = useRef(0);
  const metalFallVelocity = useRef(0);
  const metalWasUpper = useRef(true);
  useFrame(({ clock }, delta) => {
    if (!meshRef.current || count === 0) return;
    const elapsed = clock.getElapsedTime();
    const invasion = THREE.MathUtils.clamp(fieldStyle?.invasionStrength ?? 0, 0, 1);
    const spinModifier = THREE.MathUtils.clamp(fieldStyle?.candySpinModifier ?? 1, 0.7, 1.6);
    const massScale = THREE.MathUtils.clamp(fieldStyle?.candyMass ?? 1, 0.6, 2.5);
    const radialScale = THREE.MathUtils.clamp(fieldStyle?.candyRadialScale ?? 1, 0.85, 1.2);
    const angularVelocity = THREE.MathUtils.clamp(fieldStyle?.candyAngularVelocity ?? 0, -8, 8);
    const vibration = THREE.MathUtils.clamp(fieldStyle?.vibration ?? 0, 0, 2);
    const rigidMeta = fieldStyle?.metaPulsarMass !== undefined;
    const metaAngle = fieldStyle?.metaQuantizedAngle ?? 0;
    const jump = fieldStyle?.metalJump ?? false;
    if (jump && !previousJump.current) lastJumpTime.current = elapsed;
    const metalEventTimestamp = fieldStyle?.metalLightningTimestamp ?? 0;
    if (metalEventTimestamp > 0 && metalEventTimestamp !== lastMetalEventTimestamp.current) {
      lastMetalEventTimestamp.current = metalEventTimestamp;
      metalEventStartTime.current = elapsed;
      metalSparkCell.current = fieldStyle?.metalFractureCell ?? -1;
      metalEventStrength.current = THREE.MathUtils.clamp(fieldStyle?.metalLightningIntensity ?? 0, 0, 1);
      lastJumpTime.current = elapsed;
    }
    const kumoBreak = fieldStyle?.metalFieldActive ? fieldStyle.kumoBreakTimestamp ?? 0 : 0;
    if (kumoBreak > 0 && kumoBreak !== kumoBreakSeen.current) {
      kumoBreakSeen.current = kumoBreak;
      lastJumpTime.current = elapsed;
      metalEventStartTime.current = elapsed;
      metalEventStrength.current = 1;
    }
    const collapseStamp = fieldStyle?.animalCollapseTimestamp ?? 0;
    if (collapseStamp > 0 && collapseStamp !== collapseSeen.current) {
      collapseSeen.current = collapseStamp;
      collapseStart.current = elapsed;
    }
    const chaos = Math.exp(-Math.max(0, elapsed - collapseStart.current) / 2.5);
    animalPhaseClock.current += Math.min(delta, 0.05) * (7 + THREE.MathUtils.clamp(fieldStyle?.animalOrderRise ?? 0, 0, 1) * 9);
    const macdHeight = THREE.MathUtils.clamp(fieldStyle?.macdDistortionHeight ?? 0, -1, 1);
    const cleaveTimestamp = fieldStyle?.metalCleaveCrossTimestamp ?? 0;
    if (cleaveTimestamp > 0 && cleaveTimestamp !== lastCleaveTimestamp.current) {
      lastCleaveTimestamp.current = cleaveTimestamp;
      metalEventStartTime.current = elapsed;
      metalSparkCell.current = fieldStyle?.metalCleaveCrossCell ?? -1;
      metalEventStrength.current = Math.max(metalEventStrength.current * 0.5, 0.75);
    }
    previousJump.current = jump;
    const metalBand = fieldStyle?.metalFieldActive
      ? THREE.MathUtils.clamp((fieldStyle.bollingerBandwidth ?? 0) * 40, 0.05, 1)
      : 0;
    const metalUpper = (fieldStyle?.bollingerPercentB ?? 0.5) > 0.5;
    const dt = Math.min(delta, 0.05);
    if (metalBand > 0) {
      if (metalUpper) {
        metalFallVelocity.current = 0;
        metalStepLevel.current = Math.min(metalBand, metalStepLevel.current + dt * 0.6);
      } else {
        if (metalWasUpper.current) metalFallVelocity.current = 0.05;
        metalFallVelocity.current += dt * 3.2;
        metalStepLevel.current = Math.max(-metalBand, metalStepLevel.current - metalFallVelocity.current * dt);
        if (metalStepLevel.current <= -metalBand) metalFallVelocity.current = 0;
      }
    } else {
      metalStepLevel.current = 0;
    }
    metalWasUpper.current = metalUpper;
    const rigidStep = Math.round(metalStepLevel.current * 8) / 8;
    const wormhole = THREE.MathUtils.clamp(fieldStyle?.animalWormhole ?? 0, 0, 1);
    crystalUniforms.uMetalTime.value = elapsed;
    crystalUniforms.uMetalLayerGrowth.value = THREE.MathUtils.clamp((fieldStyle?.metalLayerGrowth ?? 0) * 40, -1, 1);
    crystalUniforms.uMetalJumpTime.value = lastJumpTime.current;
    crystalUniforms.uMetalMicroTremor.value = THREE.MathUtils.clamp(Math.abs(fieldStyle?.metalMicroTremor ?? 0), 0, 1);
    crystalUniforms.uMetalSparkCell.value = metalSparkCell.current;
    crystalUniforms.uMetalSparkIntensity.value = metalEventStrength.current
      * Math.exp(-Math.max(0, elapsed - metalEventStartTime.current) * 2.8);
    crystalUniforms.uCandyVibration.value = vibration * 0.025;
    crystalUniforms.uCandyVibrationFrequency.value = THREE.MathUtils.clamp(fieldStyle?.candyVibrationFrequency ?? 1, 0.2, 5);
    crystalUniforms.uCandyEmissive.value = THREE.MathUtils.clamp(fieldStyle?.candyEmissive ?? 0.8, 0, 2);
    crystalUniforms.uAnimalTime.value = animalPhaseClock.current / 7;
    crystalUniforms.uAnimalSync.value = THREE.MathUtils.clamp(fieldStyle?.animalPulseStrength ?? 0, 0, 1);
    crystalUniforms.uAnimalPhase.value = THREE.MathUtils.clamp(fieldStyle?.animalPulsePhase ?? 0, -Math.PI, Math.PI);
    crystalUniforms.uAnimalBraid.value = THREE.MathUtils.clamp(fieldStyle?.animalBraidStrength ?? 0, 0, 1) * (1 - chaos);
    crystalUniforms.uMetaTime.value = elapsed;
    crystalUniforms.uMetaPulsarMass.value = THREE.MathUtils.clamp(fieldStyle?.metaPulsarMass ?? 0, 0, 3);
    crystalUniforms.uMetaCrackIntensity.value = THREE.MathUtils.clamp(fieldStyle?.metaCrackIntensity ?? 0, 0, 1);
    const rippleTimestamp = fieldStyle?.metaRippleTimestamp ?? 0;
    if (rippleTimestamp > 0 && rippleTimestamp !== lastMetaRippleTimestamp.current) {
      lastMetaRippleTimestamp.current = rippleTimestamp;
      metaRippleStartedAt.current = elapsed;
      metaRippleEventStrength.current = THREE.MathUtils.clamp(fieldStyle?.metaRippleStrength ?? 0, 0, 1);
    }
    crystalUniforms.uMetaRippleAge.value = elapsed - metaRippleStartedAt.current;
    crystalUniforms.uMetaRippleStrength.value = metaRippleEventStrength.current
      * Math.exp(-Math.max(0, elapsed - metaRippleStartedAt.current) * 1.8);

    for (let i = 0; i < count; i++) {
      const candy = candies[i];
      const config = LAYER_CONFIG[candy.layer];
      const role = MATRIX_ROLES[candy.cell_index % MATRIX_ROLES.length];
      const drift = Math.tanh(config.slope);
      const t = candy.t;

      // Orbital phase advances smoothly with elapsed time
      const layerOffset = config.phase;
      const phi = layerOffset + 2 * Math.PI * 3.0 * t + (rigidMeta ? metaAngle : elapsed * orbitSpeed)
        + (rigidMeta ? 0 : fieldStyle?.candyPhaseOffset ?? 0)
        + (rigidMeta ? 0 : Math.sin(elapsed * 0.62 + candy.cell_index * 0.21) * invasion * 0.075);
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
      const braidStrength = THREE.MathUtils.clamp(fieldStyle?.animalBraidStrength ?? 0, 0, 1) * (1 - chaos);
      const braidAngle = braidStrength * (t - 0.5) * 0.48 + (fieldStyle?.animalPulsePhase ?? 0) * braidStrength * 0.08;
      const braidRadiusScale = 1 - braidStrength * 0.3;
      const braidedX = tempPosition.x * braidRadiusScale;
      const braidedZ = tempPosition.z * braidRadiusScale;
      tempPosition.x = braidedX * Math.cos(braidAngle) - braidedZ * Math.sin(braidAngle);
      tempPosition.z = braidedX * Math.sin(braidAngle) + braidedZ * Math.cos(braidAngle);
      if (chaos > 0.02) {
        const seed = candy.cell_index * 12.9898 + candy.t * 78.233;
        tempPosition.x += Math.sin(seed + elapsed * 3.1) * chaos * radius * 0.12;
        tempPosition.y += Math.cos(seed * 1.3 + elapsed * 2.7) * chaos * radius * 0.1;
        tempPosition.z += Math.sin(seed * 0.7 + elapsed * 3.7) * chaos * radius * 0.12;
      }
      if (macdHeight !== 0) tempPosition.y += macdHeight * radius * 0.09 * Math.sin(candy.cell_index * 0.9 + elapsed * 0.8);
      if (rigidStep !== 0) {
        const layerStep = Math.floor(candy.t * 6) / 6;
        const lift = rigidStep > 0 ? rigidStep * (0.35 + layerStep) : rigidStep * (0.6 + (candy.cell_index % 6) * 0.1);
        tempPosition.y += lift * radius * 0.22;
        const outward = 1 + Math.max(0, rigidStep) * layerStep * 0.18;
        tempPosition.x *= outward;
        tempPosition.z *= outward;
      }
      if (wormhole > 0) {
        const throat = 1 - wormhole * wormhole * 0.5 * (1 - ny * ny);
        const peristalsis = 1 + 0.05 * wormhole * Math.sin(ny * 9 - elapsed * 3);
        const taper = throat * peristalsis;
        const swirl = wormhole * ny * 0.9;
        const wx = tempPosition.x * taper;
        const wz = tempPosition.z * taper;
        tempPosition.x = wx * Math.cos(swirl) - wz * Math.sin(swirl);
        tempPosition.z = wx * Math.sin(swirl) + wz * Math.cos(swirl);
        tempPosition.y = tempPosition.y * (1 + wormhole * 0.25)
          + Math.sin(elapsed * 0.8 + candy.cell_index) * wormhole * radius * 0.01;
      }

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
      const localSpinAngle = rigidMeta
        ? metaAngle * (1.0 + (candy.cell_index % 4) * 0.25) + candy.t * 8
        : elapsed * spinSpeed * spinModifier * roleAngularScale * (1.0 + (candy.cell_index % 4) * 0.25) + candy.t * 8;
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
          onHoverCandy?.(candies[e.instanceId], e.instanceId);
        }
      }}
      onPointerOut={() => onHoverCandy?.(null)}
    >
      <primitive object={candyMaterial} attach="material" />
    </instancedMesh>
  );
}

type CryptoPointCloudProps = {
  candies: CandyPoint[];
  radius?: number;
  fieldStyle?: KnotFieldStyle;
  onHoverCandy?: (candy: CandyPoint | null, index?: number, particleSample?: number) => void;
};

export function CryptoPointCloud({ candies, radius = 2, fieldStyle, onHoverCandy }: CryptoPointCloudProps) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHurst: { value: 0.35 },
    uAmplitude: { value: 0 },
    uHighFrequency: { value: 0 },
    uOscillator: { value: 0 },
    uPairIntensity: { value: 0 },
    uPairEventTime: { value: -1000 },
    uResonancePoint: { value: new THREE.Vector3() },
    uLensStrength: { value: 0 },
    uResonanceArcanaId: { value: -1 },
  }), []);
  const geometry = useMemo(() => {
    const samplesPerCandy = 8;
    const count = candies.length * samplesPerCandy;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const arcanaIds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const candy = candies[Math.floor(index / samplesPerCandy)];
      const sample = index % samplesPerCandy;
      const seed = ((index * 1664525 + 1013904223) >>> 0) / 4294967296;
      const angle = sample * 2.39996323 + seed * Math.PI * 2;
      const vertical = 1 - 2 * ((sample + seed) / samplesPerCandy);
      const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      const baseRadius = radius * (0.38 + seed * 0.58);
      positions[index * 3] = (candy?.position.x ?? 0) * 0.35 + Math.cos(angle) * radial * baseRadius * 0.28;
      positions[index * 3 + 1] = (candy?.position.y ?? 0) * 0.35 + vertical * baseRadius * 0.28;
      positions[index * 3 + 2] = (candy?.position.z ?? 0) * 0.35 + Math.sin(angle) * radial * baseRadius * 0.28;
      seeds[index] = seed;
      arcanaIds[index] = candy?.tarot.id ?? -1;
    }
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    pointGeometry.setAttribute('aCandyArcanaId', new THREE.BufferAttribute(arcanaIds, 1));
    return pointGeometry;
  }, [candies, radius]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uHurst;
      uniform float uAmplitude;
      uniform float uHighFrequency;
      uniform float uOscillator;
      uniform float uPairIntensity;
      uniform float uPairEventTime;
      uniform vec3 uResonancePoint;
      uniform float uLensStrength;
      uniform float uResonanceArcanaId;
      attribute float aSeed;
      attribute float aCandyArcanaId;
      varying float vAlpha;
      varying float vResonance;
      void main() {
        vec3 p = position;
        float flutter = sin(uTime * (4.0 + uHurst * 12.0) + aSeed * 83.0) * (0.006 + uAmplitude * 0.018);
        float phase = aSeed * 6.2831853 + uTime * 2.0 + uHighFrequency * 0.8;
        float pairAge = max(0.0, uTime - uPairEventTime);
        float pairFlash = exp(-pairAge * 2.7) * uPairIntensity;
        float pairSign = mod(floor(aSeed * 97.0), 2.0) * 2.0 - 1.0;
        p += normalize(p + vec3(0.0001)) * (flutter + pairSign * pairFlash * 0.16 * (0.3 + aSeed));
        p += vec3(cos(phase), sin(phase * 1.31), cos(phase * 0.77)) * (0.004 + abs(uOscillator) * 0.007);
        vec3 lensDelta = p - uResonancePoint;
        float lensDistance = length(lensDelta);
        float lensWeight = exp(-lensDistance * lensDistance * 2.2) * uLensStrength;
        p += normalize(lensDelta + vec3(0.0001)) * lensWeight * 0.12;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((1.5 + aSeed * 2.2 + pairFlash * 9.0 + lensWeight * 3.0) * (1.0 / max(0.5, -mvPosition.z)), 1.0, 13.0);
        float flicker = 0.35 + 0.65 * abs(sin(uTime * (8.0 + aSeed * 14.0) + aSeed * 91.0));
        float candySync = 1.0 - step(0.5, abs(aCandyArcanaId - uResonanceArcanaId));
        vAlpha = flicker * (0.32 + uAmplitude * 0.18 + pairFlash * 0.85 + candySync * uLensStrength * 0.24);
        vResonance = max(lensWeight, candySync * uLensStrength);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vResonance;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float radial = length(centered);
        float cloud = 1.0 - smoothstep(0.05, 0.5, radial);
        float grain = step(0.18, fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453));
        float alpha = cloud * vAlpha * grain;
        if (alpha < 0.035) discard;
        vec3 color = mix(vec3(0.20, 0.78, 1.0), vec3(0.82, 0.58, 1.0), clamp(vResonance, 0.0, 1.0));
        color = mix(color, vec3(1.0, 0.94, 0.72), clamp(vAlpha - 0.65, 0.0, 0.65));
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [uniforms]);
  const lastPairEventTimestamp = useRef<number>(0);
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    uniforms.uTime.value = elapsed;
    uniforms.uHurst.value = THREE.MathUtils.clamp(fieldStyle?.cryptoHurstExponent ?? 0.35, 0.05, 0.49);
    uniforms.uAmplitude.value = THREE.MathUtils.clamp(fieldStyle?.cryptoNoiseAmplitude ?? 0, 0, 4);
    uniforms.uHighFrequency.value = THREE.MathUtils.clamp(fieldStyle?.cryptoHighFrequencyNoise ?? 0, -2, 2);
    uniforms.uOscillator.value = THREE.MathUtils.clamp(fieldStyle?.cryptoOscillatorDisplacement ?? 0, -1.5, 1.5);
    const pairEventTimestamp = fieldStyle?.cryptoPairEventTimestamp ?? 0;
    if (pairEventTimestamp > 0 && pairEventTimestamp !== lastPairEventTimestamp.current) {
      lastPairEventTimestamp.current = pairEventTimestamp;
      uniforms.uPairEventTime.value = elapsed;
      uniforms.uPairIntensity.value = THREE.MathUtils.clamp(Math.abs(fieldStyle?.cryptoPairCreation ?? 0) / 2, 0.25, 1);
    }
    const resonancePoint = fieldStyle?.cryptoResonancePoint;
    if (resonancePoint) {
      uniforms.uResonancePoint.value.set(
        THREE.MathUtils.clamp(resonancePoint.x, -1, 1) * radius,
        THREE.MathUtils.clamp(resonancePoint.y, -1, 1) * radius,
        THREE.MathUtils.clamp(resonancePoint.z ?? 0, -1, 1) * radius,
      );
    }
    uniforms.uLensStrength.value = THREE.MathUtils.clamp(fieldStyle?.cryptoResonanceStrength ?? 0, 0, 1);
    uniforms.uResonanceArcanaId.value = fieldStyle?.cryptoResonanceArcanaId ?? -1;
  });
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      onPointerMove={(event) => {
        const pointIndex = event.index;
        if (pointIndex !== undefined) {
          const candyIndex = Math.floor(pointIndex / 8);
          if (candyIndex >= 0 && candyIndex < candies.length) onHoverCandy?.(candies[candyIndex], candyIndex, pointIndex % 8);
        }
      }}
      onPointerOut={() => onHoverCandy?.(null)}
    />
  );
}
