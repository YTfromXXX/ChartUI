'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import PixelSprite from '@/components/fami/PixelSprite';
import { SPRITES, type SpriteName } from '@/lib/famiSprites';
import { FAMI_PORTS } from '@/lib/idlecrash';
import { cipher } from '@/lib/retroBlocks';

// Mente's colour request, drawn on the retro-grid loop as a side menu.
// 24 pairs = 48 cells (the spiral grid's 48 base cells): 26 blanks, and exactly 22 marked
// cells = the 22 Fami ports — ports 1–17 as protagonist pixel icons, port 18 (学園の保健室)
// as LIFE[ABCD], ports 19–22 (still on the drawing board) as "88 紐" noise: ペンを握るべし.
type Cell = { kind: 'blank' } | { kind: 'icon'; port: number } | { kind: 'life'; port: number } | { kind: 'noise'; port: number };

const ROWS: ('e' | 'i' | 'L' | 'n')[][] = [
  ['e', 'e', 'e', 'e'],
  ['i', 'i', 'i', 'L'],
  ['e', 'e', 'e', 'e'],
  ['i', 'i', 'i'],
  ['e', 'e', 'e'],
  ['i', 'i', 'n', 'n'],
  ['e', 'e'],
];

const PORT_SPRITE: Record<number, SpriteName> = {
  1: 'dancer', 2: 'dancer', 3: 'eye', 4: 'vet', 5: 'yoga', 6: 'cat', 7: 'sneaker', 8: 'flower', 9: 'vet',
  10: 'yoga', 11: 'dancer', 12: 'skull', 13: 'nose', 14: 'sneaker', 15: 'dancer', 16: 'cat', 17: 'nose',
};

function buildLayout(): Cell[][][] {
  let icon = 1; let noise = 19;
  return ROWS.map((row) => row.map((kind): Cell[] => {
    if (kind === 'e') return [{ kind: 'blank' }, { kind: 'blank' }];
    if (kind === 'n') return [{ kind: 'noise', port: noise++ }, { kind: 'noise', port: noise++ }];
    if (kind === 'L') return [{ kind: 'life', port: 18 }, { kind: 'icon', port: icon++ }];
    return [{ kind: 'icon', port: icon++ }, { kind: 'icon', port: icon++ }];
  }));
}

function NoiseString({ port, tick }: { port: number; tick: number }) {
  // 88 strings: short seeded wavy lines across the cell.
  const lines = Array.from({ length: 88 }, (_, i) => {
    const h = cipher(port, i, tick);
    const y = (h % 1000) / 1000 * 32; const amp = ((h >>> 10) % 100) / 100 * 3;
    return `M0 ${y.toFixed(1)} Q8 ${(y - amp).toFixed(1)} 16 ${y.toFixed(1)} T32 ${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <rect width="32" height="32" fill="#120a14" />
      {lines.map((d, i) => <path key={i} d={d} fill="none" stroke={i % 3 ? '#f5d0fe' : '#d6001c'} strokeWidth={0.25} opacity={0.55} />)}
      <text x="16" y="19" textAnchor="middle" fontSize="4.2" fill="#fff" stroke="#000" strokeWidth="0.6" paintOrder="stroke">ペンを握るべし</text>
    </svg>
  );
}

/** "サイドメニューを開く?" → yes → the 22 famicom side menu over the retro grid. */
export default function FamiSideMenu() {
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const layout = useMemo(buildLayout, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sidemenu') === 'ask') setAsking(true);
  }, []);

  // The noise strings re-weave slowly (well under the 3 Hz flash limit).
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => setTick((t) => t + 1), 900);
    return () => window.clearInterval(timer);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className="fixed bottom-4 left-4 z-[95] border border-fuchsia-300/60 bg-[#140812] px-3 py-1.5 font-mono text-[11px] text-fuchsia-100 hover:bg-fuchsia-300/10">サイドメニューを開く?</button>

      {asking && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Open side menu">
          <div className="space-y-3 border-4 border-white bg-[#120a14] p-5 text-center font-mono text-white shadow-[8px_8px_0_#d6001c]">
            <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-200">Mente からの色彩の要求</p>
            <p className="text-lg">サイドメニューを開く?</p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => { setAsking(false); setOpen(true); }} className="bg-white px-4 py-1 font-bold text-black">▶ YES</button>
              <button type="button" onClick={() => setAsking(false)} className="border border-white/50 px-4 py-1">NO</button>
            </div>
          </div>
        </div>
      )}

      <aside
        aria-label="22 famicom side menu"
        aria-hidden={!open}
        className="fixed bottom-0 left-0 top-0 z-[110] w-[min(100vw,22rem)] overflow-y-auto border-r-4 border-[#d6001c] bg-[#f5d0fe] p-3 font-mono transition-transform duration-500"
        style={{ transform: open ? 'translateX(0)' : 'translateX(-105%)' }}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="bg-black px-2 py-0.5 text-xs font-bold italic text-white">22 ファミコン · SIDE MENU</p>
          <button type="button" onClick={() => setOpen(false)} className="border-2 border-black bg-white px-2 text-xs font-bold text-black" aria-label="Close side menu">×</button>
        </div>
        <div className="space-y-1.5">
          {layout.map((row, r) => (
            <div key={r} className="flex flex-wrap gap-2">
              {row.map((pair, p) => (
                <div key={p} className="flex gap-0.5">
                  {pair.map((cell, c) => {
                    const base = 'h-9 w-9 border border-black/30';
                    if (cell.kind === 'blank') return <span key={c} className={`${base} bg-white/40`} title="{}" />;
                    const port = FAMI_PORTS[cell.port - 1];
                    if (cell.kind === 'noise') return <span key={c} className={base} title={`${port.no}. ${port.title} — 88 紐ノイズ（設計中）`}><NoiseString port={port.no} tick={tick} /></span>;
                    if (cell.kind === 'life') {
                      return (
                        <span key={c} className={`${base} grid grid-cols-2 bg-black p-0.5`} title={`LIFE[ABCD] · ${port.no}. ${port.title}`}>
                          {['A', 'B', 'C', 'D'].map((l) => <span key={l} className="relative"><PixelSprite sprite={SPRITES.heart} className="h-full w-full" /><span className="absolute inset-0 grid place-items-center text-[6px] font-bold text-white">{l}</span></span>)}
                        </span>
                      );
                    }
                    if (port.no === 12) return <Link key={c} href="/gaikotsu" className={`${base} block bg-black p-0.5`} title={`${port.no}. ${port.title} → 骸骨電鉄`}><PixelSprite sprite={SPRITES.skull} className="h-full w-full" /></Link>;
                    return <span key={c} className={`${base} bg-[#120a14] p-0.5`} title={`${port.no}. ${port.title}`}><PixelSprite sprite={SPRITES[PORT_SPRITE[port.no] ?? 'dancer']} className="h-full w-full" /></span>;
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-black/70">48 マス ＝ 空白 26 ＋ ファミポート 22（アイコン 1–17 · LIFE 18 · 88 紐ノイズ 19–22「ペンを握るべし」＝設計中）</p>
      </aside>
    </>
  );
}
