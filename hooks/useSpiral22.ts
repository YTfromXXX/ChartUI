'use client';

import { useEffect, useMemo, useState } from 'react';
import { ARCANA_ATTRACTORS } from '@/lib/arcanaMatrix';
import { useCureAPIStore } from '@/lib/cureApiStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type Candy = { r: number; axis_height: number; polarity: 'UP' | 'DOWN'; tarot_archetype: { id: number } | null };

/**
 * Spiral-grid instrument with 22 values (one per Major Arcana, index 0..21).
 * API: mean normalised height (axis_height / r, in [-1, 1]) of the ascending (UP) Spiral
 * Candy positions assigned to each arcana. Offline fallback: the arcana's own spiral position
 * (golden-angle lattice) rotated by its lens angle from the Cure-API store.
 */
export function useSpiral22(scaleDial = 0.3): { values: number[]; source: 'API' | 'LOCAL' } {
  const arcana = useCureAPIStore((state) => state.arcanaParameters);
  const [apiValues, setApiValues] = useState<number[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/v1/oracle/spiral-grid?scale_dial=${scaleDial}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { candies: Candy[] }) => {
        const sums = new Array(22).fill(0);
        const counts = new Array(22).fill(0);
        for (const candy of body.candies) {
          const id = candy.tarot_archetype?.id;
          // DOWN candies mirror UP through the origin, so averaging both would always give 0.
          if (candy.polarity !== 'UP' || id === undefined || id < 0 || id > 21 || !(candy.r > 0)) continue;
          sums[id] += candy.axis_height / candy.r;
          counts[id] += 1;
        }
        setApiValues(sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0)));
      })
      .catch(() => { if (!controller.signal.aborted) setApiValues(null); });
    return () => controller.abort();
  }, [scaleDial]);

  const localValues = useMemo(() => ARCANA_ATTRACTORS.map((attractor) => {
    const radius = Math.hypot(attractor.x, attractor.y);
    const angle = ((arcana.find((a) => a.id === attractor.id)?.angle ?? 0) * Math.PI) / 180;
    return radius * Math.sin(angle);
  }), [arcana]);

  return apiValues ? { values: apiValues, source: 'API' } : { values: localValues, source: 'LOCAL' };
}
