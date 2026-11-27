'use client';

// One wave-die layout shared by the Tetra Arcana room and FamiDance (and across open tabs):
// rearranging the faces in one place moves the dancers in the other.
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LAYOUT } from '@/lib/waveDie';

const KEY = 'wave-die-layout-v1';
const valid = (l: unknown): l is number[] => Array.isArray(l) && l.length === 6 && [...l].sort().join() === '1,2,3,4,5,6';

export function useWaveLayout(): [number[], (l: number[]) => void] {
  const [layout, setState] = useState<number[]>(DEFAULT_LAYOUT);
  useEffect(() => {
    const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (valid(v)) setState(v); } catch { /* storage unavailable */ } };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) read(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const set = useCallback((l: number[]) => { if (!valid(l)) return; setState(l); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage unavailable */ } }, []);
  return [layout, set];
}
