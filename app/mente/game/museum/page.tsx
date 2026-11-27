'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LAYERS_OF_MU, SEGMENTS, SENSES, STAGES, STRAINS, search, type Segment } from '@/lib/museum';

/** The museum and the ELECTRON BOX kiosk: search the host's stages and project them, ~15 s each. */
export default function Museum() {
  const [q, setQ] = useState('');
  const [sec, setSec] = useState(15);
  const [cur, setCur] = useState<Segment>(SEGMENTS[0]);
  const [playing, setPlaying] = useState(false);
  const [auto, setAuto] = useState(false);
  const [t, setT] = useState(0);
  const [night, setNight] = useState(false);
  const [reduced, setReduced] = useState(false);
  const results = useMemo(() => search(q), [q]);
  const startAt = useRef(0); const raf = useRef(0);
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const per = sec / cur.lines.length;
  const line = Math.min(cur.lines.length - 1, Math.floor(t / per));
  useEffect(() => {
    if (!playing) return undefined;
    startAt.current = performance.now() - t * 1000;
    const tick = () => {
      const x = (performance.now() - startAt.current) / 1000;
      if (x >= sec) {
        if (auto) { const k = (SEGMENTS.indexOf(cur) + 1) % SEGMENTS.length; setCur(SEGMENTS[k]); setT(0); startAt.current = performance.now(); }
        else { setPlaying(false); setT(sec); return; }
      } else setT(x);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [playing, auto, sec, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const project = (s: Segment) => { setCur(s); setT(0); setPlaying(true); };
  const C = night ? { bg: '#14161c', card: '#1f2229', text: '#ece9e2', sub: '#9aa0ab', line: '#3a3f4a' } : { bg: '#faf7f2', card: '#ffffff', text: '#1f1f1f', sub: '#78716c', line: '#d6d3d1' };
  const sc = STRAINS[cur.strain].color;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4" style={{ background: C.bg, color: C.text }}>
      <header className="space-y-1">
        <p className="text-xs" style={{ color: C.sub }}>博物館 · {night ? '夜（大人の社交場）' : '昼'}</p>
        <h1 className="text-xl font-bold">司会者 トンネル・ヨウスケ（:ミュウ）の展示室</h1>
        <p className="text-sm">ミュウは μ（ミュー粒子）。物質を通り抜ける粒の名前。年はとらない。季節ごとに、29 種か 92 種の同じ顔が交代し、記憶は 15 秒ずつの文節で受け渡される。ここは、その文節を投影する展示室。</p>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} data-testid="night" />夜の博物館にする（大人が集まり、投影のあとに自分の話をする時間）</label>
      </header>

      {/* the kiosk */}
      <section className="grid gap-3 md:grid-cols-[1fr_1.3fr]" data-testid="kiosk">
        <div className="space-y-2 rounded-xl border-4 p-3" style={{ borderColor: '#2b3a67', background: C.card }}>
          <p className="font-mono text-xs tracking-widest" style={{ color: night ? '#86bce8' : '#2b3a67' }}>ELECTRON BOX · エレクトロンボックス</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="さがす（例：ルーペ、92、養成期、確率）" className="w-full rounded-sm border px-2 py-1 text-sm" style={{ borderColor: C.line, background: night ? '#0f1116' : 'white', color: C.text }} data-testid="kiosk-search" />
          <p className="text-[10px]" style={{ color: C.sub }}>{results.length} 件 · 二つの種 × 四つの時期 = 八つの文節</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto">{results.map((s) => (
            <li key={`${s.strain}-${s.stage}`}><button type="button" onClick={() => project(s)} className="w-full rounded-sm border px-2 py-1 text-left text-xs" style={{ borderColor: cur === s ? STRAINS[s.strain].color : C.line }} data-testid={`seg-${s.strain}-${s.stage}`}>
              <span className="mr-1 rounded-sm px-1 text-[10px] text-white" style={{ background: STRAINS[s.strain].color }}>{STRAINS[s.strain].name}</span>{STAGES.find((x) => x.id === s.stage)!.name}・{s.title}
            </button></li>))}</ul>
        </div>

        {/* the projection */}
        <div className="space-y-2">
          <div className="relative aspect-video overflow-hidden rounded-md border-2" style={{ borderColor: sc, background: '#0d0f14' }} data-testid="projection">
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 120%, ${sc}55, transparent 60%)` }} />
            {!reduced && <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff1 0 1px, transparent 1px 3px)' }} />}
            <div className="absolute left-3 top-2 text-[10px] text-white/70">{STRAINS[cur.strain].name} · {STAGES.find((x) => x.id === cur.stage)!.name} · {cur.title}</div>
            <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-base text-white" style={{ textShadow: `0 0 12px ${sc}` }} data-testid="proj-line">{cur.lines[line]}</div>
            <div className="absolute bottom-0 left-0 h-1" style={{ width: `${(t / sec) * 100}%`, background: sc }} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={() => (playing ? setPlaying(false) : (t >= sec ? project(cur) : setPlaying(true)))} className="min-h-[40px] rounded-sm border-2 px-3 font-semibold" style={{ borderColor: sc }} data-testid="play">{playing ? '❚❚ とめる' : '▶ 投影する'}</button>
            <label className="flex items-center gap-1"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />随時投影（八つを順に）</label>
            <label className="flex items-center gap-1">文節の長さ<input type="range" min={10} max={20} value={sec} onChange={(e) => setSec(Number(e.target.value))} data-testid="sec" />{sec} 秒</label>
          </div>
          <p className="text-[11px]" style={{ color: C.sub }} data-testid="avg">平均的な装置：一つの文節 {sec} 秒 ÷ {cur.lines.length} 行 = 1 行 {per.toFixed(1)} 秒。八つ全部で {sec * SEGMENTS.length} 秒（{(sec * SEGMENTS.length / 60).toFixed(1)} 分）。{STRAINS[cur.strain].note}</p>
        </div>
      </section>

      {/* taken apart */}
      <section className="space-y-1 text-xs" data-testid="dissection">
        <p className="text-sm font-semibold">解体の結果：ミュウの質感（外から内へ）</p>
        <ol className="space-y-1">{LAYERS_OF_MU.map((l, i) => (
          <li key={l.layer} className="flex gap-2 rounded-sm border p-2" style={{ borderColor: C.line, background: C.card, marginLeft: i * 8 }}><b className="w-20 shrink-0">{l.layer}</b><span>{l.texture}</span></li>))}</ol>
      </section>

      {/* XV senses */}
      <section className="space-y-1 text-xs" data-testid="senses">
        <p className="text-sm font-semibold">XV を表皮につなぎ、ブレイン装置と連携したあとの感覚の予測</p>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead><tr style={{ color: C.sub }}><th className="border-b p-1" style={{ borderColor: C.line }}>感覚</th><th className="border-b p-1" style={{ borderColor: C.line }}>研究で知られていること（事実）</th><th className="border-b p-1" style={{ borderColor: C.line }}>このゲームの予測</th></tr></thead>
          <tbody>{SENSES.map((s) => <tr key={s.sense}><td className="border-b p-1 align-top font-semibold" style={{ borderColor: C.line }}>{s.sense}</td><td className="border-b p-1 align-top" style={{ borderColor: C.line }}>{s.known}</td><td className="border-b p-1 align-top" style={{ borderColor: C.line }}>{s.predict}</td></tr>)}</tbody>
        </table></div>
        <p style={{ color: C.sub }}>予測はゲームの中のもの。医療や健康の助言ではない。</p>
      </section>
    </main>
  );
}
