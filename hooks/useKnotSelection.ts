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
  invasionDistance?: number;
  resonatingArcana?: string;
};

export type MetalFractureTrace = {
  timestamp: number;
  price: number;
  source: string;
  matrixDistance: number;
  distanceTensor: { x: number; y: number; z: number };
  crossingPathOffset: number;
  arcanaId: number;
  arcanaName: string;
  arcanaSymbol: string;
  arcanaPosition: { x: number; y: number; z: number };
};

export type AnimalSyncTrace = {
  timestamp: number;
  price: number;
  orderParameter: number;
  meanPhase: number;
  phases: number[];
  correlationMatrix: number[][];
  braidTension: number;
  attractorStrength: number;
  arcanaId: number;
  arcanaName: string;
  arcanaPosition: { x: number; y: number; z: number };
  centroid: { x: number; y: number; z: number };
};

export type CryptoQuantumTrace = {
  timestamp: number;
  price: number;
  hurstExponent: number;
  maxNoiseAmplitude: number;
  highFrequencyNoise: number;
  oscillatorDisplacement: number;
  oscillatorVelocity: number;
  resonanceArcanaId: number;
  resonanceArcanaName: string;
  resonanceArcanaPosition: { x: number; y: number; z: number };
  resonancePoint: { x: number; y: number; z: number };
  pointCloudBounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  candyId?: string;
  candyLayer?: 'surge' | 'continuation' | 'range' | 'plunge';
  candyCellIndex?: number;
  candyArcanaId?: number;
  candySync?: boolean;
  candyLocalNoise?: number;
  particleSample?: number;
};

export type MetaPhaseShiftTrace = {
  timestamp: number;
  indexPrice: number;
  pulsarMass: number;
  quantizedAngle: number;
  quantizedStepIndex: number;
  previousArcanaId: number;
  previousArcanaPosition: { x: number; y: number; z: number };
  targetArcanaId: number;
  targetArcanaPosition: { x: number; y: number; z: number };
  xauUsdDistance: number;
  crackIntensity: number;
};

type KnotSelectionState = {
  selectedKnots: number[];
  tracesByKnot: Record<number, KnotResonanceTrace[]>;
  metalFractures: MetalFractureTrace[];
  animalSyncEvents: AnimalSyncTrace[];
  cryptoQuantumEvents: CryptoQuantumTrace[];
  metaPhaseShifts: MetaPhaseShiftTrace[];
  toggleKnot: (knotId: number) => void;
  clearKnots: () => void;
  recordKnotTrace: (knotId: number, trace: KnotResonanceTrace) => void;
  recordMetalFracture: (trace: MetalFractureTrace) => void;
  recordAnimalSyncEvent: (trace: AnimalSyncTrace) => void;
  recordCryptoQuantumEvent: (trace: CryptoQuantumTrace) => void;
  recordMetaPhaseShift: (trace: MetaPhaseShiftTrace) => void;
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
  metalFractures: [],
  animalSyncEvents: [],
  cryptoQuantumEvents: [],
  metaPhaseShifts: [],
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
  recordMetalFracture: (trace) => {
    const finiteValues = [
      trace.timestamp, trace.price, trace.matrixDistance,
      trace.distanceTensor.x, trace.distanceTensor.y, trace.distanceTensor.z,
      trace.crossingPathOffset, trace.arcanaId,
      trace.arcanaPosition.x, trace.arcanaPosition.y, trace.arcanaPosition.z,
    ];
    if (!finiteValues.every(Number.isFinite)) return;
    set((state) => {
      const last = state.metalFractures.at(-1);
      if (last?.timestamp === trace.timestamp) return state;
      return { metalFractures: [...state.metalFractures.slice(-99), trace] };
    });
  },
  recordAnimalSyncEvent: (trace) => {
    const finiteValues = [
      trace.timestamp,
      trace.price,
      trace.orderParameter,
      trace.meanPhase,
      trace.braidTension,
      trace.attractorStrength,
      trace.arcanaId,
      trace.arcanaPosition.x,
      trace.arcanaPosition.y,
      trace.arcanaPosition.z,
      trace.centroid.x,
      trace.centroid.y,
      trace.centroid.z,
      ...trace.phases,
      ...trace.correlationMatrix.flat(),
    ];
    if (!finiteValues.every(Number.isFinite) || trace.phases.length === 0
      || trace.correlationMatrix.length !== trace.phases.length
      || trace.correlationMatrix.some((row) => row.length !== trace.phases.length)) return;
    set((state) => {
      const last = state.animalSyncEvents.at(-1);
      if (last?.timestamp === trace.timestamp) return state;
      return { animalSyncEvents: [...state.animalSyncEvents.slice(-99), trace] };
    });
  },
  recordCryptoQuantumEvent: (trace) => {
    const finiteValues = [
      trace.timestamp,
      trace.price,
      trace.hurstExponent,
      trace.maxNoiseAmplitude,
      trace.highFrequencyNoise,
      trace.oscillatorDisplacement,
      trace.oscillatorVelocity,
      trace.resonanceArcanaId,
      trace.resonanceArcanaPosition.x,
      trace.resonanceArcanaPosition.y,
      trace.resonanceArcanaPosition.z,
      trace.resonancePoint.x,
      trace.resonancePoint.y,
      trace.resonancePoint.z,
      trace.pointCloudBounds.min.x,
      trace.pointCloudBounds.min.y,
      trace.pointCloudBounds.min.z,
      trace.pointCloudBounds.max.x,
      trace.pointCloudBounds.max.y,
      trace.pointCloudBounds.max.z,
      ...(trace.candyCellIndex === undefined ? [] : [trace.candyCellIndex]),
      ...(trace.candyArcanaId === undefined ? [] : [trace.candyArcanaId]),
      ...(trace.candyLocalNoise === undefined ? [] : [trace.candyLocalNoise]),
      ...(trace.particleSample === undefined ? [] : [trace.particleSample]),
    ];
    if (!finiteValues.every(Number.isFinite) || trace.price <= 0
      || trace.hurstExponent <= 0 || trace.hurstExponent >= 0.5
      || trace.pointCloudBounds.min.x > trace.pointCloudBounds.max.x
      || trace.pointCloudBounds.min.y > trace.pointCloudBounds.max.y
      || trace.pointCloudBounds.min.z > trace.pointCloudBounds.max.z
      || (trace.candyCellIndex !== undefined && (!Number.isInteger(trace.candyCellIndex) || trace.candyCellIndex < 0 || trace.candyCellIndex >= 48))
      || (trace.particleSample !== undefined && (!Number.isInteger(trace.particleSample) || trace.particleSample < 0 || trace.particleSample >= 8))) return;
    set((state) => {
      const last = state.cryptoQuantumEvents.at(-1);
      if (last?.timestamp === trace.timestamp) return state;
      return { cryptoQuantumEvents: [...state.cryptoQuantumEvents.slice(-99), trace] };
    });
  },
  recordMetaPhaseShift: (trace) => {
    const values = [
      trace.timestamp, trace.indexPrice, trace.pulsarMass, trace.quantizedAngle,
      trace.quantizedStepIndex, trace.previousArcanaId, trace.targetArcanaId,
      trace.previousArcanaPosition.x, trace.previousArcanaPosition.y, trace.previousArcanaPosition.z,
      trace.targetArcanaPosition.x, trace.targetArcanaPosition.y, trace.targetArcanaPosition.z,
      trace.xauUsdDistance, trace.crackIntensity,
    ];
    if (!values.every(Number.isFinite) || trace.indexPrice <= 0
      || trace.pulsarMass < 0 || trace.pulsarMass > 3
      || trace.crackIntensity < 0 || trace.crackIntensity > 1
      || !Number.isInteger(trace.quantizedStepIndex)
      || !Number.isInteger(trace.previousArcanaId) || trace.previousArcanaId < 0 || trace.previousArcanaId >= 22
      || !Number.isInteger(trace.targetArcanaId) || trace.targetArcanaId < 0 || trace.targetArcanaId >= 22) return;
    set((state) => {
      const last = state.metaPhaseShifts.at(-1);
      if (last?.timestamp === trace.timestamp) return state;
      return { metaPhaseShifts: [...state.metaPhaseShifts.slice(-99), trace] };
    });
  },
}), {
  name: 'chartui-knot-inventory-v1',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    selectedKnots: state.selectedKnots,
    tracesByKnot: state.tracesByKnot,
    metalFractures: state.metalFractures,
    animalSyncEvents: state.animalSyncEvents,
    cryptoQuantumEvents: state.cryptoQuantumEvents,
    metaPhaseShifts: state.metaPhaseShifts,
  }),
}));
