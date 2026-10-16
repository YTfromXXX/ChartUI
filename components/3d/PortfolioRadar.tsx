'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, extend, useFrame, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { angularGaussianBump, fitSphericalHarmonics, planeDistances } from '@/lib/distortionField';
import { cellAngles } from '@/lib/projectionGrid';
import { debugMetrics, reportBarrier } from '@/lib/debugMetrics';
import { positionDirection, type PortfolioProfile } from '@/lib/portfolio';

// ==========================================
// 1. Distortion shader: displaces a UV sphere along its normal by the fitted
//    SH coefficients, and colors it with a Plasma-style heatmap keyed to the
//    displacement (i.e. how far the portfolio's "energy sphere" protrudes
//    through the fixed 48-face polyhedron barrier at radius 1).
// ==========================================
const DistortionMaterial = shaderMaterial(
  { uC00: 0, uC10: 0, uC20: 0, uC22: 0, uTime: 0, uBaseRadius: 1 },
  `
    varying float vDisplacement;
    uniform float uC00, uC10, uC20, uC22, uTime, uBaseRadius;
    const float PI = 3.14159265359;
    float sh00() { return 0.5 * sqrt(1.0 / PI); }
    float sh10(float theta) { return 0.5 * sqrt(3.0 / PI) * cos(theta); }
    float sh20(float theta) { return 0.25 * sqrt(5.0 / PI) * (3.0 * cos(theta) * cos(theta) - 1.0); }
    float sh22(float theta, float phi) { return 0.25 * sqrt(15.0 / PI) * sin(theta) * sin(theta) * cos(2.0 * phi); }
    void main() {
      vec3 dir = normalize(position);
      float theta = acos(clamp(dir.y, -1.0, 1.0));
      float phi = atan(dir.z, dir.x);
      float wobble = sin(uTime * 0.55 + theta * 3.1 + phi * 2.0) * 0.012;
      float radius = uBaseRadius + uC00 * sh00() + uC10 * sh10(theta) + uC20 * sh20(theta) + uC22 * sh22(theta, phi) + wobble;
      vDisplacement = radius - uBaseRadius;
      vec3 displaced = dir * radius;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  `
    varying float vDisplacement;
    vec3 plasma(float t) {
      vec3 c0 = vec3(0.050, 0.030, 0.528);
      vec3 c1 = vec3(0.494, 0.012, 0.658);
      vec3 c2 = vec3(0.798, 0.280, 0.470);
      vec3 c3 = vec3(0.973, 0.585, 0.254);
      vec3 c4 = vec3(0.940, 0.975, 0.131);
      float x = clamp(t, 0.0, 1.0);
      if (x < 0.25) return mix(c0, c1, x / 0.25);
      if (x < 0.5) return mix(c1, c2, (x - 0.25) / 0.25);
      if (x < 0.75) return mix(c2, c3, (x - 0.5) / 0.25);
      return mix(c3, c4, (x - 0.75) / 0.25);
    }
    void main() {
      float t = clamp(vDisplacement * 3.4 + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(plasma(t), 0.94);
    }
  `,
);

extend({ DistortionMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    distortionMaterial: ThreeElement<typeof DistortionMaterial>;
  }
}


// ==========================================
// 2. Fluid shader (stateless, GPU-only; no ping-pong buffers, so memory use is
//    one static attribute set). The velocity field is
//        u = curl(psi) + sum_i  Gamma_i * swirl_i(x)
//    which is divergence-free by construction (curl of a vector potential and
//    rotational jets), i.e. an incompressible Navier-Stokes velocity field.
//    Each particle is advected through a short RK-style march of that field
//    every frame. The 48-face barrier is an SDF d(x) = |x| - r(dir): the normal
//    velocity is cancelled inside a boundary layer (no-penetration) and the
//    removed momentum is turned into tangential vorticity (n x u), which rolls
//    particles into vortices along the barrier.
// ==========================================
const FLUID_PARTICLES = 6000;
const FLUID_JETS = 4;

const FluidMaterial = shaderMaterial(
  {
    uTime: 0,
    uC00: 0,
    uC10: 0,
    uC20: 0,
    uC22: 0,
    uJets: Array.from({ length: FLUID_JETS }, () => new THREE.Vector4()),
    uViscosity: 0.35,
    uPixel: 2.2,
  },
  `
    attribute vec4 aSeed;
    uniform float uTime, uC00, uC10, uC20, uC22, uViscosity, uPixel;
    uniform vec4 uJets[${FLUID_JETS}];
    varying float vSpeed;
    varying float vNear;
    const float PI = 3.14159265359;
    const int STEPS = 8;

    float barrierRadius(vec3 p) {
      vec3 d = normalize(p);
      float theta = acos(clamp(d.y, -1.0, 1.0));
      float phi = atan(d.z, d.x);
      float c = cos(theta);
      return 1.0 + uC00 * 0.5 * sqrt(1.0 / PI) + uC10 * 0.5 * sqrt(3.0 / PI) * c
        + uC20 * 0.25 * sqrt(5.0 / PI) * (3.0 * c * c - 1.0)
        + uC22 * 0.25 * sqrt(15.0 / PI) * sin(theta) * sin(theta) * cos(2.0 * phi);
    }
    float sdf(vec3 p) { return length(p) - barrierRadius(p); }
    vec3 sdfNormal(vec3 p) {
      vec2 e = vec2(0.02, 0.0);
      return normalize(vec3(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx)));
    }

    // analytic curl of curlPotential
    vec3 curlField(vec3 p, float t) {
      vec3 q = p * 1.7;
      float k = 1.7;
      float dAz_dy = -sin(q.x - t * 0.21) * sin(q.y + t * 0.29) * k;
      float dAy_dz = cos(q.z + t * 0.27) * cos(q.x + t * 0.19) * k;
      float dAx_dz = -sin(q.y + t * 0.31) * sin(q.z - t * 0.23) * k;
      float dAz_dx = cos(q.x - t * 0.21) * cos(q.y + t * 0.29) * k;
      float dAy_dx = -sin(q.z + t * 0.27) * sin(q.x + t * 0.19) * k;
      float dAx_dy = cos(q.y + t * 0.31) * cos(q.z - t * 0.23) * k;
      return vec3(dAz_dy - dAy_dz, dAx_dz - dAz_dx, dAy_dx - dAx_dy);
    }

    vec3 velocity(vec3 p, float t) {
      vec3 u = 0.55 * curlField(p, t);
      for (int i = 0; i < ${FLUID_JETS}; i++) {
        vec3 axis = normalize(uJets[i].xyz + 1e-4);
        float gamma = uJets[i].w;
        vec3 r = p - axis * dot(p, axis);
        float rho2 = dot(r, r) + 0.08;
        // Lamb-Oseen-like rotational jet (inflow > 0, outflow < 0) plus axial drive
        u += gamma * (cross(axis, r) / rho2) * (1.0 - exp(-rho2 / 0.35)) * 0.35;
        u += gamma * axis * exp(-rho2 * 1.6) * 0.25;
      }
      float d = sdf(p);
      vec3 n = sdfNormal(p);
      float layer = exp(-abs(d) * 6.0);
      float vn = dot(u, n);
      vec3 tangential = u - n * vn;
      u = tangential * (1.0 - 0.6 * layer) + cross(n, tangential) * layer * uViscosity * 2.0;
      if (d < 0.0) u += n * (-d) * 6.0;
      return u;
    }

    void main() {
      float life = fract(aSeed.w + uTime * 0.045);
      float seedAngle = aSeed.x * 2.0 * PI;
      float z = aSeed.y * 2.0 - 1.0;
      float rr = sqrt(max(0.0, 1.0 - z * z));
      vec3 p = vec3(rr * cos(seedAngle), z, rr * sin(seedAngle)) * (1.15 + aSeed.z * 1.5);
      float t0 = uTime - life * 8.0;
      float dt = life * 8.0 / float(STEPS);
      vec3 u = vec3(0.0);
      for (int i = 0; i < STEPS; i++) {
        float tt = t0 + dt * float(i);
        u = velocity(p, tt);
        vec3 mid = p + 0.5 * dt * u;
        p += dt * velocity(mid, tt + 0.5 * dt);
        float d = sdf(p);
        if (d < 0.0) p += sdfNormal(p) * (-d + 0.01);
      }
      vSpeed = clamp(length(u) * 1.4, 0.0, 1.0);
      vNear = exp(-abs(sdf(p)) * 7.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uPixel * (1.0 + vNear) * (4.0 / -mv.z) * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.9, 1.0, life));
    }
  `,
  `
    varying float vSpeed;
    varying float vNear;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.0, length(c));
      vec3 slow = vec3(0.10, 0.45, 0.95);
      vec3 fast = vec3(0.98, 0.55, 0.25);
      vec3 col = mix(slow, fast, vSpeed) + vec3(0.6, 0.3, 0.9) * vNear * 0.5;
      gl_FragColor = vec4(col, a * (0.35 + 0.5 * vNear));
    }
  `,
);

extend({ FluidMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    fluidMaterial: ThreeElement<typeof FluidMaterial>;
  }
}

/** Signed per-asset fund flow: positive = inflow (volatility-weighted), the
 * long/short direction of the symbol decides which way the jet swirls. */
function usePortfolioJets(portfolio: PortfolioProfile) {
  return useMemo(() => {
    const jets = Array.from({ length: FLUID_JETS }, () => new THREE.Vector4());
    const ranked = [...portfolio.positions].sort((a, b) => b.volatility - a.volatility).slice(0, FLUID_JETS);
    ranked.forEach((position, index) => {
      const { theta, phi } = positionDirection(position.symbol);
      const flow = Math.tanh(((Number.isFinite(position.volatility) ? position.volatility : 0) - 0.4) * 3.2);
      jets[index].set(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi), flow);
    });
    return jets;
  }, [portfolio]);
}

function FluidParticles({ portfolio }: { portfolio: PortfolioProfile }) {
  const materialRef = useRef<any>(null);
  const coefficients = usePortfolioCoefficients(portfolio);
  const jets = usePortfolioJets(portfolio);
  const seeds = useMemo(() => {
    const data = new Float32Array(FLUID_PARTICLES * 4);
    let state = 1337;
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < data.length; i += 1) data[i] = rand();
    return data;
  }, []);
  const positions = useMemo(() => new Float32Array(FLUID_PARTICLES * 3), []);

  useEffect(() => {
    debugMetrics.particles = FLUID_PARTICLES;
    return () => {
      debugMetrics.particles = 0;
      debugMetrics.minDk = 1;
      debugMetrics.pressure = 0;
    };
  }, []);

  useFrame((_, delta) => {
    const m = materialRef.current;
    if (!m) return;
    m.uTime += Math.min(delta, 0.05);
    m.uC00 = THREE.MathUtils.lerp(m.uC00, coefficients.c00, 0.06);
    m.uC10 = THREE.MathUtils.lerp(m.uC10, coefficients.c10, 0.06);
    m.uC20 = THREE.MathUtils.lerp(m.uC20, coefficients.c20, 0.06);
    m.uC22 = THREE.MathUtils.lerp(m.uC22, coefficients.c22, 0.06);
    for (let i = 0; i < FLUID_JETS; i += 1) m.uJets[i].lerp(jets[i], 0.05);
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 4]} />
      </bufferGeometry>
      <fluidMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

type PortfolioRadarProps = { portfolio: PortfolioProfile; className?: string };

/** Fits (c00, c10, c20, c22) to a Gaussian energy bump field built from the
 * portfolio's positions -- one bump per symbol, weighted by |volatility|,
 * placed at a deterministic direction. This is the "surface fitting" step:
 * discrete positions -> continuous distorted-sphere field. */
function usePortfolioCoefficients(portfolio: PortfolioProfile) {
  return useMemo(() => {
    const bumps = portfolio.positions.map((position) => ({
      ...positionDirection(position.symbol),
      weight: Math.min(2, Math.max(0, Number.isFinite(position.volatility) ? position.volatility : 0)) * 1.4,
    }));
    const samples = Array.from({ length: 48 }, (_, index) => {
      const { theta, phi } = cellAngles(index);
      const value = bumps.reduce(
        (sum, bump) => sum + bump.weight * angularGaussianBump(theta, phi, bump.theta, bump.phi, 0.55),
        0,
      );
      return { theta, phi, value };
    });
    return fitSphericalHarmonics(samples);
  }, [portfolio]);
}

function DistortedEnergySphere({ portfolio }: { portfolio: PortfolioProfile }) {
  const materialRef = useRef<any>(null);
  const coefficients = usePortfolioCoefficients(portfolio);

  useEffect(() => {
    reportBarrier(planeDistances(coefficients, 1));
  }, [coefficients]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    materialRef.current.uTime += delta;
    materialRef.current.uC00 = THREE.MathUtils.lerp(materialRef.current.uC00, coefficients.c00, 0.06);
    materialRef.current.uC10 = THREE.MathUtils.lerp(materialRef.current.uC10, coefficients.c10, 0.06);
    materialRef.current.uC20 = THREE.MathUtils.lerp(materialRef.current.uC20, coefficients.c20, 0.06);
    materialRef.current.uC22 = THREE.MathUtils.lerp(materialRef.current.uC22, coefficients.c22, 0.06);
  });

  return (
    <mesh>
      <sphereGeometry args={[1, 96, 72]} />
      <distortionMaterial ref={materialRef} uBaseRadius={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** 48-face polyhedron barrier: a fixed radius-1 wireframe cage, colored per
 * face-group by how far the energy sphere protrudes through it (Dk < 0). */
function PolyhedronBarrier({ portfolio }: { portfolio: PortfolioProfile }) {
  const coefficients = usePortfolioCoefficients(portfolio);
  const distances = useMemo(() => planeDistances(coefficients, 1), [coefficients]);
  const intrusionRatio = distances.filter((distance) => distance < 0).length / distances.length;
  const barrierColor = intrusionRatio > 0.3 ? '#f97316' : intrusionRatio > 0.1 ? '#facc15' : '#38bdf8';

  return (
    <mesh>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={barrierColor} wireframe transparent opacity={0.55} />
    </mesh>
  );
}

function RadarScene({ portfolio }: { portfolio: PortfolioProfile }) {
  return (
    <>
      <color attach="background" args={['#020712']} />
      <ambientLight intensity={0.9} />
      <pointLight position={[4, 4, 4]} intensity={1.4} />
      <DistortedEnergySphere portfolio={portfolio} />
      <PolyhedronBarrier portfolio={portfolio} />
      <FluidParticles portfolio={portfolio} />
      <OrbitControls enablePan={false} minDistance={2.4} maxDistance={7} autoRotate autoRotateSpeed={0.6} />
    </>
  );
}

export default function PortfolioRadar({ portfolio, className }: PortfolioRadarProps) {
  return (
    <div className={className ?? 'h-[520px] w-full'}>
      <Canvas camera={{ position: [0, 0.6, 3.4], fov: 50 }}>
        <RadarScene portfolio={portfolio} />
      </Canvas>
    </div>
  );
}
