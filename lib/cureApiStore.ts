'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ARCANA_ATTRACTORS } from '@/lib/arcanaMatrix';
import type { MatrixBuildResult } from '@/lib/matrixBuilder';
import type { OddField } from '@/lib/cureOrbit';

export type CureTimeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D';
export type PlaceholderState = 'idle' | '⚪︎' | '◻︎' | '(expand)' | '(extend)';
export type CureHypothesis = 'A' | 'B';
export type SimulationMode = 'hypothesisA' | 'hypothesisB';
export type ProjectionVector = [number, number, number];
/** The customer's answer to the two-choice intuition popup (kept locally in this browser). */
export type IntuitionChoice = {
  pattern: Exclude<PlaceholderState, 'idle'>;
  page: 'A' | 'B';
  kitId: number;
  text: string;
  at: number;
};
export type ProjectionBlock = {
  id: string;
  createdAt: number;
  digest: string;
  previousDigest: string;
  bpm: number;
  sliceTilt: number;
  lensScroll: number;
  noise: number;
};

export type ExperimentFeedback = {
  id: string;
  hypothesis: CureHypothesis;
  createdAt: string;
  digest: string;
  polarity: 'LONG' | 'SHORT';
  energy: number;
  targetOffset: number;
  contactArea: number;
  contactLuminance: number;
};

export type ArcanaParameter = {
  id: number;
  name: string;
  symbol: string;
  /** Stable icon key for the lens silhouette, independent of its rendered glyph. */
  silhouetteId: string;
  angle: number;
  archetype: string;
  volatilityAffinity: number;
  tensionAffinity: number;
  rigidityAffinity: number;
  destructiveAffinity: number;
};

export const DEFAULT_ARCANA_PARAMETERS: ArcanaParameter[] = ARCANA_ATTRACTORS.map((arcana) => ({
  id: arcana.id,
  name: arcana.name,
  symbol: arcana.symbol,
  silhouetteId: `arcana-${String(arcana.id).padStart(2, '0')}`,
  angle: Number((Math.atan2(arcana.y, arcana.x) * 180 / Math.PI).toFixed(2)),
  archetype: arcana.archetype,
  volatilityAffinity: arcana.volatilityAffinity,
  tensionAffinity: arcana.tensionAffinity,
  rigidityAffinity: arcana.rigidityAffinity,
  destructiveAffinity: arcana.destructiveAffinity,
}));

export const CURE_TIMEFRAMES: readonly CureTimeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D'];

export const TIMEFRAME_ORBIT_SPEED: Record<CureTimeframe, number> = {
  '1m': 1.8,
  '5m': 1.45,
  '15m': 1.1,
  '1H': 0.72,
  '4H': 0.42,
  '1D': 0.2,
};

export const TIMEFRAME_STROBE_INTERVAL_MS: Record<CureTimeframe, number> = {
  '1m': 80,
  '5m': 140,
  '15m': 220,
  '1H': 380,
  '4H': 620,
  '1D': 1000,
};

export type HeaderItems = { instrument: boolean; collision: boolean; view: boolean; engine: boolean };
export const DEFAULT_HEADER_ITEMS: HeaderItems = { instrument: true, collision: true, view: true, engine: true };

export type CureAPIState = {
  timeframe: CureTimeframe;
  volatilityIndex: number;
  placeholderState: PlaceholderState;
  placeholderActive: boolean;
  newsFeedText: string;
  exParameter: number;
  arcanaParameters: ArcanaParameter[];
  simulationSpeed: number;
  freezeFrame: number;
  collisionParameters: { friction: number; gravityWell: number; fractalRestitution: number };
  experimentFeedback: ExperimentFeedback[];
  latestMatrix: MatrixBuildResult | null;
  simulationMode: SimulationMode;
  projectionGlitchNonce: number;
  projectionMetrics: { bpm: number; sliceTilt: number; lensScroll: number; noise: number };
  projectionBlocks: ProjectionBlock[];
  decoherenceVector: ProjectionVector | null;
  decoherenceNonce: number;
  unlockedPredictionCell: number;
  /** Odd-return field measured on the retro grid; drives the Cure mover's free orbit. */
  oddField: OddField | null;
  intuitionChoice: IntuitionChoice | null;
  /** TODAY event fired from Cure's strobe point (the SPIRAL EYE origin). */
  architectFire: { at: number; date: string } | null;
  /** What has been handed to the [():()] device. */
  parenInputs: { library: boolean; museum: boolean; galaxy: { arms: number; twist: number } | null };
  /** The TEST TO ZERO header: shown or hidden (the bike icon in the corner turns it back on). */
  headerVisible: boolean;
  /** Which parts of the header are shown. */
  headerItems: HeaderItems;
  setHeaderVisible: (visible: boolean) => void;
  setHeaderItem: (key: keyof HeaderItems, on: boolean) => void;
  setTimeframe: (timeframe: CureTimeframe) => void;
  setVolatilityIndex: (value: number) => void;
  setNewsFeedText: (text: string) => void;
  setExParameter: (value: number) => void;
  setArcanaAngle: (id: number, angle: number) => void;
  activatePlaceholder: () => void;
  setPlaceholderState: (state: Exclude<PlaceholderState, 'idle'>) => void;
  closePlaceholder: () => void;
  resetArcanaParameters: () => void;
  setSimulationSpeed: (value: number) => void;
  setFreezeFrame: (value: number) => void;
  setCollisionParameter: (key: 'friction' | 'gravityWell' | 'fractalRestitution', value: number) => void;
  recordExperiment: (feedback: ExperimentFeedback, matrix: MatrixBuildResult) => void;
  setSimulationMode: (mode: SimulationMode) => void;
  setProjectionMetrics: (metrics: Partial<CureAPIState['projectionMetrics']>) => void;
  appendProjectionBlock: (block: ProjectionBlock) => void;
  observeSingularity: (vector: ProjectionVector) => void;
  setOddField: (field: OddField | null) => void;
  setIntuitionChoice: (choice: IntuitionChoice | null) => void;
  fireArchitect: () => void;
  passToParen: (what: 'library' | 'museum', galaxy?: { arms: number; twist: number } | null) => void;
  resetParen: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useCureAPIStore = create<CureAPIState>()(
  persist(
    (set) => ({
      timeframe: '15m',
      volatilityIndex: 0.25,
      placeholderState: 'idle',
      placeholderActive: false,
      newsFeedText: 'CURE API // MATRIX FIELD READY // ORACLE MODEL OUTPUT IS SIMULATED UNTIL A LIVE FEED IS CONNECTED',
      exParameter: 1,
      arcanaParameters: DEFAULT_ARCANA_PARAMETERS,
      simulationSpeed: 1,
      freezeFrame: 0,
      collisionParameters: { friction: 0.18, gravityWell: 0.35, fractalRestitution: 0.72 },
      experimentFeedback: [],
      latestMatrix: null,
      simulationMode: 'hypothesisA',
      projectionGlitchNonce: 0,
      projectionMetrics: { bpm: 72, sliceTilt: 0, lensScroll: 0, noise: 0.15 },
      projectionBlocks: [],
      decoherenceVector: null,
      decoherenceNonce: 0,
      unlockedPredictionCell: -1,
      oddField: null,
      intuitionChoice: null,
      architectFire: null,
      parenInputs: { library: false, museum: false, galaxy: null },
      headerVisible: true,
      headerItems: DEFAULT_HEADER_ITEMS,
      setHeaderVisible: (headerVisible) => set({ headerVisible }),
      setHeaderItem: (key, on) => set((state) => ({ headerItems: { ...state.headerItems, [key]: on } })),
      setTimeframe: (timeframe) => set({ timeframe }),
      setVolatilityIndex: (value) => set({ volatilityIndex: clamp(value, 0, 1) }),
      setNewsFeedText: (newsFeedText) => set({ newsFeedText }),
      setExParameter: (value) => set((state) => ({
        exParameter: clamp(value, 0, 1),
        ...(value <= 0 ? { placeholderActive: true } : {}),
        ...(value <= 0 && state.placeholderState === 'idle' ? { placeholderState: 'idle' as const } : {}),
      })),
      setArcanaAngle: (id, angle) => set((state) => ({
        arcanaParameters: state.arcanaParameters.map((arcana) => arcana.id === id
          ? { ...arcana, angle: clamp(angle, -180, 180) }
          : arcana),
      })),
      activatePlaceholder: () => set({ placeholderActive: true }),
      setPlaceholderState: (placeholderState) => set({ placeholderState, placeholderActive: false }),
      closePlaceholder: () => set({ placeholderActive: false }),
      resetArcanaParameters: () => set({ arcanaParameters: DEFAULT_ARCANA_PARAMETERS }),
      setSimulationSpeed: (value) => set({ simulationSpeed: clamp(value, 0, 100) }),
      setFreezeFrame: (value) => set({ freezeFrame: clamp(value, 0, 1) }),
      setCollisionParameter: (key, value) => set((state) => ({
        collisionParameters: { ...state.collisionParameters, [key]: clamp(value, 0, 1) },
      })),
      recordExperiment: (feedback, latestMatrix) => set((state) => ({
        experimentFeedback: [feedback, ...state.experimentFeedback].slice(0, 50),
        latestMatrix,
      })),
      setSimulationMode: (simulationMode) => set((state) => ({
        simulationMode,
        projectionGlitchNonce: state.projectionGlitchNonce + 1,
      })),
      setProjectionMetrics: (metrics) => set((state) => ({
        projectionMetrics: { ...state.projectionMetrics, ...metrics },
      })),
      appendProjectionBlock: (block) => set((state) => ({
        projectionBlocks: [block, ...state.projectionBlocks].slice(0, 128),
      })),
      observeSingularity: (decoherenceVector) => set((state) => ({
        decoherenceVector,
        decoherenceNonce: state.decoherenceNonce + 1,
        unlockedPredictionCell: (state.unlockedPredictionCell + 1) % 48,
      })),
      setOddField: (oddField) => set({ oddField }),
      setIntuitionChoice: (intuitionChoice) => set({ intuitionChoice }),
      passToParen: (what, galaxy) => set((state) => ({
        parenInputs: { ...state.parenInputs, [what]: true, ...(galaxy !== undefined ? { galaxy } : {}) },
      })),
      resetParen: () => set({ parenInputs: { library: false, museum: false, galaxy: null } }),
      fireArchitect: () => set({ architectFire: { at: Date.now(), date: new Date().toISOString().slice(0, 10) } }),
    }),
    {
      name: 'chartui-cure-api-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        timeframe: state.timeframe,
        volatilityIndex: state.volatilityIndex,
        placeholderState: state.placeholderState,
        newsFeedText: state.newsFeedText,
        exParameter: state.exParameter,
        arcanaParameters: state.arcanaParameters,
        simulationSpeed: state.simulationSpeed,
        freezeFrame: state.freezeFrame,
        collisionParameters: state.collisionParameters,
        experimentFeedback: state.experimentFeedback,
        latestMatrix: state.latestMatrix,
        simulationMode: state.simulationMode,
        projectionMetrics: state.projectionMetrics,
        projectionBlocks: state.projectionBlocks,
        decoherenceVector: state.decoherenceVector,
        decoherenceNonce: state.decoherenceNonce,
        unlockedPredictionCell: state.unlockedPredictionCell,
        oddField: state.oddField,
        intuitionChoice: state.intuitionChoice,
        architectFire: state.architectFire,
        parenInputs: state.parenInputs,
        headerVisible: state.headerVisible,
        headerItems: state.headerItems,
      }),
    },
  ),
);
