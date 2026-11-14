'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import FamicomTitle from '@/components/cloud/FamicomTitle';
import { PALETTES, contrast } from '@/lib/skyPalettes';
import type { SceneOpts } from '@/components/cloud/SkewerScene';

const SkewerScene = dynamic(() => import('@/components/cloud/SkewerScene'), { ssr: false });

/** 「雲のなかに電池を作れ」: an 8-bit style title, then -[]-[]- (two dice on a skewer) with a dolly zoom,
 *  a spiral on a torus spreading as splashes or soap bubbles, and a colour test running alongside. */
export default function CloudBattery() {
  const [pal, setPal] = useState(PALETTES[0].id);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<SceneOpts['mode']>('bubble');
  const [pq, setPq] = useState<[number, number]>([2, 3]);
  const [dolly, setDolly] = useState(0.3);
  const [auto, setAuto] = useState(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setReduced(m.matches); if (m.matches) setAuto(false); }, []);
  const palette = PALETTES.find((p) => p.id === pal)!;
  const start = useCallback(() => setStarted(true), []);

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">ファミコン風のタイトルと、色の試験</p>
        <h1 className="text-xl font-bold">雲のなかに電池を作れ</h1>
      </header>

      <FamicomTitle palette={palette} reduced={reduced} onStart={start} />

      <section className="space-y-2" data-testid="colour-test">
        <p className="text-sm font-semibold">色の試験（同時に進む：タイトルと場面の両方に効く）</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PALETTES.map((p) => (
            <button key={p.id} type="button" data-testid={`pal-${p.id}`} onClick={() => setPal(p.id)} className="space-y-1 border bg-white p-2 text-left text-[11px]" style={{ borderColor: pal === p.id ? '#1f1f1f' : '#d6d3d1', borderWidth: pal === p.id ? 2 : 1 }}>
              <p className="font-semibold">{p.name}</p>
              <div className="flex h-6">{p.sky.map((c) => <span key={c} className="flex-1" style={{ background: c }} title={c} />)}</div>
              <div className="flex h-3">{p.knot.map((c) => <span key={c} className="flex-1" style={{ background: c }} title={c} />)}</div>
              <p className="font-mono text-[10px] text-stone-500">{p.sky.join(' ')}</p>
              <p className="text-stone-600">{p.note} 地平の色に濃紺の文字：コントラスト {contrast(p.sky[p.sky.length - 2], '#2b3a67').toFixed(1)}：1</p>
            </button>))}
        </div>
      </section>

      {!started ? <p className="text-sm">タイトルを押すか Enter で、串の場面が始まる。</p> : (
        <section className="space-y-2" data-testid="skewer">
          <p className="text-sm font-semibold">-[]-[]-　串の上で回る、ふたつのサイコロ</p>
          <SkewerScene opts={{ palette, mode, p: pq[0], q: pq[1], dolly, auto, reduced }} />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(['bubble', 'splash'] as const).map((m) => <button key={m} type="button" data-testid={`mode-${m}`} onClick={() => setMode(m)} className="border px-2 py-0.5" style={{ borderColor: mode === m ? '#1f1f1f' : '#d6d3d1', background: 'white' }}>{m === 'bubble' ? '🫧 シャボン玉' : '💦 飛沫'}</button>)}
            <label>結び目 <select value={pq.join(',')} onChange={(e) => setPq(e.target.value.split(',').map(Number) as [number, number])} className="border border-stone-400 bg-white px-1">{[[2, 3], [3, 5], [2, 5], [3, 7], [5, 8]].map(([p, q]) => <option key={`${p},${q}`} value={`${p},${q}`}>({p}, {q})</option>)}</select></label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={auto} disabled={reduced} onChange={(e) => setAuto(e.target.checked)} />ドリーズームを自動で（9 秒でひと往復）</label>
            {!auto && <label>カメラの距離 <input type="range" min={0} max={1} step={0.01} value={dolly} onChange={(e) => setDolly(Number(e.target.value))} data-testid="dolly" /></label>}
          </div>
          <p className="text-[11px] text-stone-600">ドリーズーム：カメラが下がるほどレンズを狭め、串の幅は同じに保つ。後ろの螺旋だけが近づいたり遠のいたりする。酔いやすい人は自動を切って、ゆっくり手で動かしてください。螺旋はトーラスに巻きつく (p, q) の結び目で、網（メッシュ）は作らず、点だけが結び目を離れて広がる。色は、螺旋のどこか（一周の位置）と、管の内側か外側か（q の位相）で決まる。</p>
        </section>)}
    </main>
  );
}
