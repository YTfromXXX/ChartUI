'use client';

import { create } from 'zustand';

type KnotSelectionState = {
  selectedKnots: number[];
  toggleKnot: (knotId: number) => void;
  clearKnots: () => void;
};

export const MAJOR_ARCANA_KNOTS = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant',
  'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
  'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star',
  'The Moon', 'The Sun', 'Judgement', 'The World',
] as const;

export const useKnotSelection = create<KnotSelectionState>((set) => ({
  selectedKnots: [],
  toggleKnot: (knotId) => {
    if (!Number.isInteger(knotId) || knotId < 0 || knotId >= MAJOR_ARCANA_KNOTS.length) return;
    set((state) => ({
      selectedKnots: state.selectedKnots.includes(knotId)
        ? state.selectedKnots.filter((id) => id !== knotId)
        : [...state.selectedKnots, knotId],
    }));
  },
  clearKnots: () => set({ selectedKnots: [] }),
}));
