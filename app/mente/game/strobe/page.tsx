'use client';

import { useEffect, useState } from 'react';
import ByteBlocks from '@/components/strobe/ByteBlocks';
import EmojiFluid from '@/components/strobe/EmojiFluid';
import MiniHockey from '@/components/strobe/MiniHockey';

const TABS = [['bytes', '▦ バイト枠'], ['fluid', '🫧 絵文字の流体'], ['hockey', '🏒 ミニホッケー']] as const;
type Tab = (typeof TABS)[number][0];

/** Strobe lab: a byte-frame falling-blocks toy, an emoji fluid, and a minimal hockey (ice / ground). */
export default function Strobe() {
  const [tab, setTab] = useState<Tab>('bytes');
  const [reduced, setReduced] = useState(false);
  useEffect(() => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setReduced(m.matches); const f = () => setReduced(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">ストロボの実験室</p>
        <h1 className="text-xl font-bold">一マスの中のバイト、流れる絵文字、ミニマルなホッケー</h1>
        <p className="text-[11px] text-stone-500">点滅は小さな一マスだけ、1 秒に 2 回まで（光に敏感な人のための目安の 3 回より少ない）。端末の「視差効果を減らす」設定では、ストロボと回転を止める。</p>
      </header>
      <nav className="flex gap-1 text-sm">{TABS.map(([id, name]) => <button key={id} type="button" data-testid={`tab-${id}`} onClick={() => setTab(id)} className="border px-3 py-1" style={{ borderColor: tab === id ? '#1f1f1f' : '#d6d3d1', background: tab === id ? 'white' : 'transparent', fontWeight: tab === id ? 600 : 400 }}>{name}</button>)}</nav>
      {tab === 'bytes' && <ByteBlocks reduced={reduced} />}
      {tab === 'fluid' && <EmojiFluid reduced={reduced} />}
      {tab === 'hockey' && <MiniHockey reduced={reduced} />}
    </main>
  );
}
