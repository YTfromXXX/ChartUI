'use client';

import { useEffect, useRef, useState } from 'react';

export type MashReading = {
  /** 0..1 metallic finish driven by the tap rate. */
  metal: number;
  /** 0..1 short impulse of the last tap (the board jolts). */
  impulse: number;
  rate: number;
  /** Coefficient of variation of the tap intervals (0 = perfectly even). */
  cv: number;
  /** Peirce's reading of the rhythm. */
  sign: 'シンボル（規則）' | 'インデックス（因果）' | 'イコン（模倣）' | '—';
  relax: number;
};

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'];
const WINDOW_MS = 2500;

/**
 * 連打装置 (relax device): mash any key or the pad. The tap rate polishes the stations into
 * metal; the evenness of the rhythm is the relax score and is read as a Peircean sign —
 * a time series for semiotics on the time axis.
 */
export default function MashDevice({ onReading }: { onReading: (r: MashReading) => void }) {
  const taps = useRef<number[]>([]);
  const metal = useRef(0);
  const [reading, setReading] = useState<MashReading>({ metal: 0, impulse: 0, rate: 0, cv: 0, sign: '—', relax: 0 });
  const [pressed, setPressed] = useState<number | null>(null);
  const [series, setSeries] = useState<number[]>([]);
  const report = useRef(onReading);
  report.current = onReading;

  const tap = (keyIndex: number) => {
    const now = performance.now();
    const prev = taps.current[taps.current.length - 1];
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS), now];
    if (prev !== undefined && now - prev < 2000) setSeries((s) => [...s, now - prev].slice(-24));
    setPressed(keyIndex);
    window.setTimeout(() => setPressed((p) => (p === keyIndex ? null : p)), 90);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'Tab') return;
      const i = KEYS.indexOf(event.key.toUpperCase());
      tap(i >= 0 ? i : Math.abs(event.key.charCodeAt(0)) % KEYS.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Integrate: metal rises with the tap rate and slowly oxidises back when idle.
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const recent = taps.current.filter((t) => now - t < WINDOW_MS);
      const rate = recent.length / (WINDOW_MS / 1000);
      metal.current = Math.min(1, Math.max(0, metal.current + (Math.min(1, rate / 8) - metal.current) * dt * 1.8));
      const lastTap = recent[recent.length - 1];
      const impulse = lastTap ? Math.max(0, 1 - (now - lastTap) / 220) : 0;
      const gaps = recent.slice(1).map((t, i) => t - recent[i]);
      const mean = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
      const cv = gaps.length > 2 && mean > 0 ? Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length) / mean : 0;
      const sign: MashReading['sign'] = gaps.length < 3 ? '—' : cv < 0.15 ? 'シンボル（規則）' : cv < 0.4 ? 'インデックス（因果）' : 'イコン（模倣）';
      const r: MashReading = { metal: metal.current, impulse, rate, cv, sign, relax: gaps.length < 3 ? 0 : Math.max(0, 1 - cv / 0.6) };
      report.current(r);
      setReading((prev) => (Math.abs(prev.metal - r.metal) > 0.01 || prev.sign !== r.sign || Math.abs(prev.rate - r.rate) > 0.2 || Math.abs(prev.impulse - r.impulse) > 0.2 ? r : prev));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const maxGap = Math.max(1, ...series);
  return (
    <section aria-label="Mash device" className="space-y-2 border-4 border-white p-3 text-[11px]">
      <p className="font-bold">連打装置（リラックス装置）· どのキーでも、パッドでも</p>
      <div className="flex flex-wrap gap-1" style={{ transform: `skewX(${(-reading.impulse * 6).toFixed(2)}deg)` }}>
        {KEYS.map((k, i) => {
          const v = Math.round(90 + 150 * reading.metal);
          return (
            <button
              key={k}
              type="button"
              aria-label={`mash ${k}`}
              onPointerDown={() => tap(i)}
              className="relative grid h-12 w-11 place-items-center border-2 border-black text-[10px] font-bold text-black transition-transform duration-75"
              style={{
                background: `linear-gradient(135deg, rgb(${v},${v},${v}), rgb(${v - 70},${v - 70},${v - 70}) 55%, rgb(${Math.min(255, v + 20)},${Math.min(255, v + 20)},${Math.min(255, v + 20)}))`,
                transform: pressed === i ? `translateY(3px) skewX(${i % 2 ? 8 : -8}deg) scale(.94)` : 'none',
                boxShadow: pressed === i ? 'inset 0 2px 0 rgba(0,0,0,.6)' : '0 4px 0 #444',
              }}
            >
              <span className="absolute left-1 top-0.5 text-[8px]">{k}</span>
              <span className="text-base leading-none">☠</span>
            </button>
          );
        })}
      </div>
      <p>金属 {(reading.metal * 100).toFixed(0)}% · {reading.rate.toFixed(1)} 打/秒 · ばらつき {reading.cv.toFixed(2)} · リラックス {(reading.relax * 100).toFixed(0)}% · 記号：{reading.sign}</p>
      <svg viewBox="0 0 240 40" className="h-10 w-full border border-white/30" aria-label="Tap interval time series">
        {series.map((g, i) => <rect key={i} x={i * 10 + 1} y={40 - (g / maxGap) * 38} width={8} height={(g / maxGap) * 38} fill="#fff" opacity={0.4 + 0.6 * (i / Math.max(1, series.length - 1))} />)}
      </svg>
      <p className="text-[10px] text-white/60">打鍵の間隔の時系列。均等な連打ほど落ち着き（リラックス）、パースの記号分類で シンボル → インデックス → イコン と読む。金属の光沢は連打の速さで上がり、手を止めるとゆっくり曇る。</p>
    </section>
  );
}
