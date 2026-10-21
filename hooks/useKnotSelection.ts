'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type KnotResonanceTrace = {
  timestamp: number;
  assetPair: string;
  matrixDistance: number;
  resonanceArcanaId: number;
  resonanceArcanaName: string;
  tension: number;
  price: number;
};

type KnotSelectionState = {
  selectedKnots: number[];
  tracesByKnot: Record<number, KnotResonanceTrace[]>;
  toggleKnot: (knotId: number) => void;
  clearKnots: () => void;
  recordKnotTrace: (knotId: number, trace: KnotResonanceTrace) => void;
};

export const MAJOR_ARCANA_KNOTS = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant',
  'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
  'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star',
  'The Moon', 'The Sun', 'Judgement', 'The World',
] as const;

export const useKnotSelection = create<KnotSelectionState>()(persist((set) => ({
  selectedKnots: [],
  tracesByKnot: {},
  toggleKnot: (knotId) => {
    if (!Number.isInteger(knotId) || knotId < 0 || knotId >= MAJOR_ARCANA_KNOTS.length) return;
    set((state) => ({
      selectedKnots: state.selectedKnots.includes(knotId)
        ? state.selectedKnots.filter((id) => id !== knotId)
        : [...state.selectedKnots, knotId],
    }));
  },
  clearKnots: () => set({ selectedKnots: [] }),
  recordKnotTrace: (knotId, trace) => {
    if (!Number.isInteger(knotId) || knotId < 0 || knotId >= 88) return;
    if (![trace.timestamp, trace.matrixDistance, trace.resonanceArcanaId, trace.tension, trace.price].every(Number.isFinite)) return;
    set((state) => {
      const traces = state.tracesByKnot[knotId] ?? [];
      const last = traces.at(-1);
      if (last?.assetPair === trace.assetPair && last.resonanceArcanaId === trace.resonanceArcanaId
        && Math.abs(last.matrixDistance - trace.matrixDistance) < 0.015) return state;
      return { tracesByKnot: { ...state.tracesByKnot, [knotId]: [...traces.slice(-23), trace] } };
    });
  },
}), {
  name: 'chartui-knot-inventory-v1',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ selectedKnots: state.selectedKnots, tracesByKnot: state.tracesByKnot }),
}));
