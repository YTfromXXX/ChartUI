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
  varying float vSeed;

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
    vSeed = aSeed;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vSide;
  varying float vAlpha;
  varying float vHeat;
  varying float vSeed;

  void main() {
    vec2 point = (gl_PointCoord - 0.5) * 2.0;
    float radius = length(point);
    if (radius > 1.0) discard;

    // Shade each point as a tiny sphere, with a soft atmospheric halo.
    float sphereDepth = sqrt(max(1.0 - radius * radius, 0.0));
    vec3 normal = normalize(vec3(point, sphereDepth));
    vec3 lightDirection = normalize(vec3(-0.42, 0.58, 0.72));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float rim = pow(1.0 - sphereDepth, 2.2);
    float core = exp(-radius * radius * 9.0);
    float halo = exp(-radius * radius * 3.2);
    float pulse = 0.88 + 0.12 * sin(vSeed * 31.0 + vHeat * 2.0);

    vec3 rimColor = vSide > 0.0 ? vec3(0.12, 0.38, 0.95) : vec3(0.19, 0.008, 0.025);
    vec3 bodyColor = vSide > 0.0 ? vec3(0.30, 0.68, 1.0) : vec3(0.68, 0.035, 0.075);
    vec3 coreColor = vSide > 0.0 ? vec3(0.91, 0.97, 1.0) : vec3(1.0, 0.24, 0.29);
    vec3 color = mix(rimColor, bodyColor, clamp(diffuse * 0.72 + (1.0 - rim) * 0.28, 0.0, 1.0));
    color = mix(color, coreColor, core * 0.92);

    vec2 highlightOffset = point - vec2(-0.18, 0.2);
    float highlight = exp(-dot(highlightOffset, highlightOffset) * 110.0);
    color += (vSide > 0.0 ? vec3(0.72, 0.86, 1.0) : vec3(1.0, 0.42, 0.38)) * highlight * 0.7;
    color += (vSide > 0.0 ? vec3(0.12, 0.42, 1.0) : vec3(0.62, 0.015, 0.045)) * rim * 0.6;

    float sideGain = vSide > 0.0 ? 0.92 : 0.78;
    float alpha = vAlpha * (core * 0.76 + halo * 0.24) * sideGain * pulse;
    alpha *= clamp(0.72 + 0.28 * vHeat, 0.0, 1.35);
    gl_FragColor = vec4(color * (0.82 + diffuse * 0.28), alpha);
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
        toneMapped: false,
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
