'use client';

// Collects the four initial signals of the cybernetics table on the initial page:
//   A header  · time to the first click and clicks per second (first 10 s)
//   B bottom  · tiny pointer movements while a button is held (the "handle torque"), 0–1
//   C side    · how many parameter panels deep the customer went (call openPanel / closePanel)
//   D popup   · time with the eyes closed (hold the "目を閉じる" control, or the tab hidden)
// Nothing is sent anywhere until the page calls requestInitialAnalysis with consent.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InitialSignals } from '@/lib/cureInitial';

export function useInitialSignals() {
  const t0 = useRef(0);
  const clicks = useRef<number[]>([]);
  const jitter = useRef({ sum: 0, n: 0, last: null as null | { x: number; y: number }, held: false });
  const depth = useRef({ now: 0, max: 0 });
  const eyes = useRef({ closedAt: 0, total: 0 });
  const [, bump] = useState(0);

  useEffect(() => {
    t0.current = performance.now();
    const onDown = () => { clicks.current.push(performance.now() - t0.current); jitter.current.held = true; jitter.current.last = null; bump((n) => n + 1); };
    const onUp = () => { jitter.current.held = false; };
    const onMove = (e: PointerEvent) => {
      const j = jitter.current; if (!j.held) return;
      if (j.last) { const d = Math.hypot(e.clientX - j.last.x, e.clientY - j.last.y); if (d < 12) { j.sum += d; j.n += 1; } } // only tiny moves count as torque
      j.last = { x: e.clientX, y: e.clientY };
    };
    const onVis = () => { if (document.hidden) eyes.current.closedAt = performance.now(); else if (eyes.current.closedAt) { eyes.current.total += performance.now() - eyes.current.closedAt; eyes.current.closedAt = 0; } };
    window.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp); window.addEventListener('pointermove', onMove);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const openPanel = useCallback(() => { const d = depth.current; d.now += 1; d.max = Math.max(d.max, d.now); bump((n) => n + 1); }, []);
  const closePanel = useCallback(() => { depth.current.now = Math.max(0, depth.current.now - 1); }, []);
  const closeEyes = useCallback(() => { eyes.current.closedAt = performance.now(); }, []);
  const openEyes = useCallback(() => { const e = eyes.current; if (e.closedAt) { e.total += performance.now() - e.closedAt; e.closedAt = 0; bump((n) => n + 1); } }, []);

  /** A snapshot of the signals so far (consent is added by the caller). */
  const snapshot = useCallback((): Omit<InitialSignals, 'consent'> => {
    const c = clicks.current; const within = c.filter((t) => t <= 10000);
    const j = jitter.current; const e = eyes.current;
    return {
      first_click_ms: c.length ? Math.round(c[0]) : null,
      click_rate: within.length ? Math.round((within.length / 10) * 100) / 100 : 0,
      handle_torque: j.n ? Math.min(1, Math.round((j.sum / j.n / 6) * 1000) / 1000) : 0,
      panel_depth: Math.min(10, depth.current.max),
      eyes_closed_ms: Math.round(e.total + (e.closedAt ? performance.now() - e.closedAt : 0)),
    };
  }, []);

  return { snapshot, openPanel, closePanel, closeEyes, openEyes };
}
