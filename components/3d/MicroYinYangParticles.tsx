'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type MicroYinYangParticlesProps = {
  /** Total particle count, split between yang (buy) and yin (sell) by `balance`. */
  count?: number;
  /** Buy share of the pressure, 0..1 (0.5 = balanced). */
  balance?: number;
  /** Market heat multiplier for flow speed and turbulence. */
  heat?: number;
  /** Half height of the column (world units). */
  height?: number;
  /** Outer radius of the particle cloud around the axis. */
  radius?: number;
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeat;
  uniform float uHeight;
  uniform float uRadiusMax;
  uniform float uPixelRatio;
  attribute float aSide;    // +1 yang (buy), -1 yin (sell)
  attribute float aSeed;
  attribute vec3 aRand;     // x: angle, y: radius factor, z: speed factor
  varying float vSide;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float speed = (0.05 + 0.07 * aRand.z) * uHeat;
    // phase 0..1 along the flow; yang climbs, yin sinks.
    float phase = fract(aSeed + uTime * speed);
    float flow = aSide > 0.0 ? phase : 1.0 - phase;
    float y = (flow * 2.0 - 1.0) * uHeight;

    // Spiral: tightens toward the axis at both ends, swirls opposite for yin.
    float envelope = sin(phase * 3.14159265);
    float angle = aRand.x * 6.2831853 + aSide * (y * 1.7 + uTime * (0.6 + 0.8 * aRand.z) * uHeat);
    float rad = mix(0.08, uRadiusMax, aRand.y * aRand.y) * (0.25 + 0.75 * envelope);

    // Cheap curl-like turbulence from layered sines.
    float t = uTime * 0.7 * uHeat;
    vec3 turb = vec3(
      sin(y * 2.1 + t + aSeed * 40.0),
      sin(angle * 1.3 + t * 1.3) * 0.4,
      cos(y * 1.8 - t + aSeed * 31.0)
    ) * 0.09 * uHeat * (0.4 + envelope);

    vec3 pos = vec3(cos(angle) * rad, y, sin(angle) * rad) + turb;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.5 + 2.2 * aRand.z) * uPixelRatio * (6.0 / -mv.z);

    vSide = aSide;
    vHeat = uHeat;
    vAlpha = envelope * (0.35 + 0.65 * aRand.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vSide;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    vec3 yang = mix(vec3(0.35, 0.65, 1.0), vec3(0.9, 0.97, 1.0), soft);   // blue-white
    vec3 yin = mix(vec3(0.5, 0.02, 0.05), vec3(0.12, 0.0, 0.02), 1.0 - soft); // red-black
    vec3 color = vSide > 0.0 ? yang : yin;
    float alpha = vAlpha * soft * (vSide > 0.0 ? 0.9 : 0.8) * clamp(0.6 + 0.4 * vHeat, 0.0, 1.5);
    gl_FragColor = vec4(color, alpha);
  }
`;

/** Tens of thousands of GPU-animated points: buy pressure rises (blue-white), sell pressure sinks (red-black). */
export default function MicroYinYangParticles({
  count = 40000,
  balance = 0.5,
  heat = 1,
  height = 7,
  radius = 1.6,
}: MicroYinYangParticlesProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const side = new Float32Array(count);
    const seed = new Float32Array(count);
    const rand = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      side[i] = Math.random() < balance ? 1 : -1;
      seed[i] = Math.random();
      rand[i * 3] = Math.random();
      rand[i * 3 + 1] = Math.random();
      rand[i * 3 + 2] = Math.random();
    }
    // Positions are computed in the vertex shader; this dummy attribute only sets the vertex count.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 3));
    // The shader displaces points, so the bounding sphere must cover the whole column.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(height, radius) * 1.2);
    return geo;
  }, [count, balance, height, radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uHeat: { value: heat },
          uHeight: { value: height },
          uRadiusMax: { value: radius },
          uPixelRatio: { value: 1 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);

  useEffect(() => {
    material.uniforms.uHeat.value = heat;
    material.uniforms.uHeight.value = height;
    material.uniforms.uRadiusMax.value = radius;
  }, [material, heat, height, radius]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
