'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, extend, useFrame, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { angularGaussianBump, fitSphericalHarmonics, planeDistances } from '@/lib/distortionField';
import { cellAngles } from '@/lib/projectionGrid';
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

type PortfolioRadarProps = { portfolio: PortfolioProfile; className?: string };

/** Fits (c00, c10, c20, c22) to a Gaussian energy bump field built from the
 * portfolio's positions -- one bump per symbol, weighted by |volatility|,
 * placed at a deterministic direction. This is the "surface fitting" step:
 * discrete positions -> continuous distorted-sphere field. */
function usePortfolioCoefficients(portfolio: PortfolioProfile) {
  return useMemo(() => {
    const bumps = portfolio.positions.map((position) => ({
      ...positionDirection(position.symbol),
      weight: position.volatility * 1.4,
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
