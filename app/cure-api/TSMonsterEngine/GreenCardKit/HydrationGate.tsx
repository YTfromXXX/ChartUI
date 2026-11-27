'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

// GreenCardKit · server/client fair play.
//
// The Cure-API store is persisted in localStorage and shared by every tab and frame of the
// same origin. Opening retro-grid A and B side by side (split view) makes the stored state a
// composite of both pages, so the server render (defaults) can never equal the first client
// render (the composite) — React reports it as a hydration mismatch ("1 Issue").
// The gate renders the same neutral fallback on the server and during hydration, and the
// real tree only after hydration has completed. The store is never written before it is read,
// so nothing persisted is lost.

const subscribe = () => () => {};

/** false on the server and during hydration, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export default function HydrationGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useHydrated() ? <>{children}</> : <>{fallback}</>;
}
