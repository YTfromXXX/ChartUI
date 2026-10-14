'use client';

import { create } from 'zustand';

export type TrapTriggerReason = 'breakout' | 'deceleration';

export type ArcanaTrapEvent = {
  id: number;
  planeIndex: number;
  arcanaId: number;
  reason: TrapTriggerReason;
  distance: number;
  timestamp: number;
};

type TrapRecord = { arcanaId: number; armedAt: number; history: Array<{ distance: number; time: number }> };

type ArcanaTrapsState = {
  traps: Record<number, TrapRecord>;
  events: ArcanaTrapEvent[];
  armTrap: (planeIndex: number, arcanaId: number) => void;
  disarmTrap: (planeIndex: number) => void;
  recordDistances: (distances: readonly number[], time: number) => void;
  acknowledgeEvent: (id: number) => void;
  clearTraps: () => void;
};

const HISTORY_LIMIT = 5;
// Dk(t) converging to zero => the arcana wall is being assimilated (breakout).
const BREAKOUT_EPSILON = 0.045;
// Ak(t) < 0 => the approach toward the wall is accelerating, not just drifting.
const ACCELERATION_EPSILON = -0.0025;

let eventSequence = 0;

function estimateAcceleration(history: Array<{ distance: number; time: number }>): number | undefined {
  if (history.length < 3) return undefined;
  const [a, b, c] = history.slice(-3);
  const dt1 = Math.max(1, b.time - a.time);
  const dt2 = Math.max(1, c.time - b.time);
  const velocity1 = (b.distance - a.distance) / dt1;
  const velocity2 = (c.distance - b.distance) / dt2;
  return (velocity2 - velocity1) / Math.max(1, (dt1 + dt2) / 2);
}

export const useArcanaTraps = create<ArcanaTrapsState>((set, get) => ({
  traps: {},
  events: [],
  armTrap: (planeIndex, arcanaId) =>
    set((state) => ({
      traps: { ...state.traps, [planeIndex]: { arcanaId, armedAt: performance.now(), history: [] } },
    })),
  disarmTrap: (planeIndex) =>
    set((state) => {
      const next = { ...state.traps };
      delete next[planeIndex];
      return { traps: next };
    }),
  recordDistances: (distances, time) => {
    const { traps } = get();
    const planeIndices = Object.keys(traps);
    if (planeIndices.length === 0) return;
    const nextTraps: Record<number, TrapRecord> = { ...traps };
    const newEvents: ArcanaTrapEvent[] = [];
    for (const key of planeIndices) {
      const planeIndex = Number(key);
      const record = traps[planeIndex];
      const distance = distances[planeIndex];
      if (!Number.isFinite(distance)) continue;
      const history = [...record.history, { distance, time }].slice(-HISTORY_LIMIT);
      const acceleration = estimateAcceleration(history);
      const breakout = distance <= BREAKOUT_EPSILON;
      const decelerating = acceleration !== undefined && acceleration < ACCELERATION_EPSILON;
      if (breakout || decelerating) {
        newEvents.push({
          id: ++eventSequence,
          planeIndex,
          arcanaId: record.arcanaId,
          reason: breakout ? 'breakout' : 'deceleration',
          distance,
          timestamp: time,
        });
        delete nextTraps[planeIndex];
      } else {
        nextTraps[planeIndex] = { ...record, history };
      }
    }
    if (newEvents.length === 0) {
      set({ traps: nextTraps });
      return;
    }
    set((state) => ({ traps: nextTraps, events: [...state.events, ...newEvents].slice(-8) }));
  },
  acknowledgeEvent: (id) => set((state) => ({ events: state.events.filter((event) => event.id !== id) })),
  clearTraps: () => set({ traps: {}, events: [] }),
}));
