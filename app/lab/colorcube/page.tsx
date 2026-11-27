'use client';

import { Pause, Play } from 'lucide-react';
import Link from 'next/link';
import PassToParen from '@/components/cure/PassToParen';
import { useEffect, useMemo, useState } from 'react';
import EmergenceCanvas from '@/LAB/colorcube/EmergenceCanvas';
import SerraPlate from '@/LAB/colorcube/SerraPlate';
import { buildEmergenceProgram, layersUpTo } from '@/LAB/colorcube/emergence';
import { MUSEUM } from '@/LAB/colorcube/museum';
import { NAME_OS_RULES, deriveNameOs } from '@/LAB/colorcube/nameOs';
import { kitItem } from '@/lib/cureKit';

export default function ColorcubeLabPage() {
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [showOs, setShowOs] = useState(false);
  const program = useMemo(() => buildEmergenceProgram(seed), [seed]);
  const layers = useMemo(() => layersUpTo(program, step), [program, step]);
  const os = useMemo(() => deriveNameOs(layers), [layers]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setStep((value) => (value + 1) % program.length), 1200);
    return () => window.clearInterval(timer);
  }, [playing, program.length]);

  const wings = (['骨格棟', '内部棟'] as const).map((wing) => ({ wing, rooms: MUSEUM.filter((room) => room.wing === wing) }));

  return (
    <main className="min-h-screen bg-[#f4f1ec] px-4 py-6 font-mono text-stone-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-300 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-stone-500">./LAB / ./colorcube</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-wide">色彩の出現と鋼板の博物館</h1>
          </div>
          <nav className="flex gap-3 text-xs">
            <Link href="/cure-api" className="text-rose-700 hover:underline">Cure-API</Link>
            <Link href="/lab/library" className="hover:underline">図書館 →</Link>
            <Link href="/retro-grid?page=A" className="hover:underline">Retro Grid A</Link>
            <Link href="/retro-grid?page=B" className="hover:underline">Retro Grid B</Link>
          </nav>
        </header>

        <PassToParen what="museum" />

        <section aria-label="Color emergence" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <h2 className="mr-auto text-sm font-semibold">1 · 色彩の出現（水のような規則性）</h2>
            <button type="button" onClick={() => setPlaying((p) => !p)} className="flex items-center gap-1 border border-stone-400 px-2 py-1 hover:bg-white">{playing ? <Pause size={12} /> : <Play size={12} />}{playing ? 'pause' : 'play'}</button>
            <label className="flex items-center gap-2">step
              <input type="range" min={0} max={program.length - 1} value={step} onChange={(event) => setStep(Number(event.target.value))} className="w-40 accent-stone-800" />
              <span className="w-10">{step + 1}/{program.length}</span>
            </label>
            <label className="flex items-center gap-2">seed
              <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} className="w-16 border border-stone-300 bg-white px-1 py-0.5" />
            </label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={showOs} onChange={(event) => setShowOs(event.target.checked)} /> Name OS overlay</label>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <EmergenceCanvas layers={layers} os={showOs ? os : undefined} className="w-full border border-stone-300 bg-white shadow-sm" />
            <ol className="space-y-1 text-[11px]">
              {program.map((s) => (
                <li key={s.index}>
                  <button type="button" onClick={() => setStep(s.index)} className={`w-full border px-2 py-1 text-left ${s.index === step ? 'border-stone-900 bg-white' : s.index < step ? 'border-stone-300 text-stone-600' : 'border-dashed border-stone-300 text-stone-400'}`}>
                    <span className="font-semibold">{s.index + 1}. to {s.verb}</span> — {s.note}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-label="Name OS" className="space-y-2">
          <h2 className="text-sm font-semibold">2 · 仮想 UI「Name OS」の構築手順</h2>
          <p className="text-[11px] text-stone-600">UI を先に設計せず、出現した層を同じ順で読み取って窓システムの部品にする。現在 {os.length} 要素。</p>
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="text-stone-500"><tr><th className="border-b border-stone-300 p-1">#</th><th className="border-b border-stone-300">verb</th><th className="border-b border-stone-300">→ element</th><th className="border-b border-stone-300">kit</th><th className="border-b border-stone-300">rule</th></tr></thead>
            <tbody>
              {NAME_OS_RULES.map((rule, i) => (
                <tr key={i} className={os.some((e) => e.kind === rule.becomes) ? '' : 'text-stone-400'}>
                  <td className="border-b border-stone-200 p-1">{i + 1}</td>
                  <td className="border-b border-stone-200">to {rule.verb}</td>
                  <td className="border-b border-stone-200">{rule.becomes}</td>
                  <td className="border-b border-stone-200">#{rule.kitId} {kitItem(rule.kitId).name}</td>
                  <td className="border-b border-stone-200">{rule.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-label="Museum" className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">3 · 博物館（骨格 19 ＋ 内部 3）</h2>
            <p className="text-[11px] text-stone-600">リチャード・セラ的な発想：鋼板の重さ・傾き・ねじれそのものが内容で、周りを歩く経路が体験になる。各室は 1 枚の板で写実的描画（ランバート陰影、錆の乱流、落ち影、エッジの鏡面反射、画家のアルゴリズム）を研究する。</p>
          </div>
          {wings.map(({ wing, rooms }) => (
            <div key={wing}>
              <h3 className="mb-2 text-xs uppercase tracking-[0.25em] text-stone-500">{wing} · {rooms.length} rooms</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {rooms.map((room) => (
                  <figure key={room.kit.id} className="overflow-hidden border border-stone-300 bg-white">
                    <SerraPlate room={room} className="aspect-[4/3] w-full" />
                    <figcaption className="space-y-0.5 p-2 text-[10px]">
                      <p className="text-xs font-semibold">#{room.kit.id} {room.kit.name}</p>
                      <p className="text-stone-500">{room.form} · torque {room.torque}° · lean {room.lean}° · rust {(room.oxidation * 100).toFixed(0)}%</p>
                      <p className="text-stone-400">{room.techniques.join(' · ')}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
