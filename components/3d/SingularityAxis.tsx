'use client';

import { Text } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

export const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618] as const;

type SingularityAxisProps = {
  /** Current price: the zero point of the axis. */
  currentPrice?: number;
  /** Price distance represented by ratio 1.0 (the 100% fibonacci extension). */
  priceRange?: number;
  /** World units that ratio 1.0 occupies on the Y axis. */
  unitHeight?: number;
  color?: string;
};

function formatPrice(value: number): string {
  const abs = Math.abs(value);
  return value.toLocaleString('en-US', { maximumFractionDigits: abs >= 1000 ? 0 : abs >= 1 ? 2 : 5 });
}

/** Glowing vertical price-division line with fibonacci ticks. Y = price, origin = current price. */
export default function SingularityAxis({
  currentPrice = 100,
  priceRange = 10,
  unitHeight = 6,
  color = '#22d3ee',
}: SingularityAxisProps) {
  const extent = FIB_RATIOS[FIB_RATIOS.length - 1] * unitHeight * 1.08;

  const lineMaterials = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
    ],
    [color],
  );

  const ticks = useMemo(() => {
    const list = [{ ratio: 0, label: 'NOW', price: currentPrice, y: 0, major: true }];
    FIB_RATIOS.forEach((ratio) => {
      const major = ratio === 0.5 || ratio === 0.618 || ratio === 1;
      [1, -1].forEach((side) => {
        list.push({
          ratio: side * ratio,
          label: `${side > 0 ? '+' : '-'}${(ratio * 100).toFixed(1)}%`,
          price: currentPrice + side * ratio * priceRange,
          y: side * ratio * unitHeight,
          major,
        });
      });
    });
    return list;
  }, [currentPrice, priceRange, unitHeight]);

  return (
    <group>
      <mesh material={lineMaterials[0]}>
        <cylinderGeometry args={[0.012, 0.012, extent * 2, 8, 1, true]} />
      </mesh>
      <mesh material={lineMaterials[1]}>
        <cylinderGeometry args={[0.07, 0.07, extent * 2, 16, 1, true]} />
      </mesh>

      {ticks.map((tick) => {
        const bright = tick.ratio > 0 ? '#93c5fd' : tick.ratio < 0 ? '#fb7185' : '#ffffff';
        const half = tick.major ? 0.28 : 0.16;
        return (
          <group key={tick.label + tick.y} position={[0, tick.y, 0]}>
            <mesh position={[half / 2, 0, 0]}>
              <planeGeometry args={[half, 0.012]} />
              <meshBasicMaterial color={bright} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <Text
              position={[half + 0.08, 0.035, 0]}
              fontSize={tick.major ? 0.16 : 0.12}
              color={bright}
              anchorX="left"
              anchorY="middle"
              letterSpacing={0.12}
              outlineWidth={0.004}
              outlineColor="#020617"
            >
              {`${tick.label}  ${formatPrice(tick.price)}`}
            </Text>
          </group>
        );
      })}

      <Text position={[0, extent + 0.3, 0]} fontSize={0.14} color={color} anchorX="center" letterSpacing={0.3}>
        SINGULARITY AXIS // PRICE
      </Text>
    </group>
  );
}
