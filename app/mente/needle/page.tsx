'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import KrugerBubble, { KRUGER_FAMILY, KRUGER_FONT } from '@/components/mente/KrugerBubble';
import RealNeedle from '@/components/mente/RealNeedle';
import { EdaSim } from '@/lib/edaSim';
import { download, menteReportHtml } from '@/lib/menteExport';
import { NeedleSound } from '@/lib/sonify';

type Phase = 'consent' | 'live' | 'stopped';
type Mark = { t: number; kind: 'question' | 'self' | 'peak'; text: string; strength?: number };

const QUESTIONS = ['最近うれしかったことは？', '今日いちばん疲れた瞬間は？', '子どものころ好きだった場所は？', '明日やってみたいことは？', 'いま気になっていることは？'];
const HISTORY_S = 60;

/**
 * Mente telephone · shared needle (prototype). Words plus a body signal, shared symmetrically:
 * the speaker and the listener hear, feel and (optionally) see the same signal. Earphone tone and
 * vibration carry it when the eyes are closed or the view blacks out. The signal is simulated
 * EDA until a real sensor is connected; it shows how strongly the body reacted, never whether
 * something is true.
 */
export default function SharedNeedlePage() {
  const [phase, setPhase] = useState<Phase>('consent');
  const [consent, setConsent] = useState({ speaker: false, listener: false });
  const [blackout, setBlackout] = useState(false);
  const [muted, setMuted] = useState(false);
  const [haptic, setHaptic] = useState(true);
  const [custom, setCustom] = useState('');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [history, setHistory] = useState<{ t: number; v: number }[]>([]);
  const [lastPeak, setLastPeak] = useState<Mark | null>(null);
  const [announce, setAnnounce] = useState('');
  const level = useRef(0.25);
  const sim = useRef<EdaSim | null>(null);
  const sound = useRef<NeedleSound | null>(null);
  const t0 = useRef(0);
  const live = useRef({ muted, haptic });
  live.current = { muted, haptic };
  const now = () => (performance.now() - t0.current) / 1000;

  const start = () => {
    sim.current = new EdaSim(Date.now() % 100000);
    sound.current = new NeedleSound(); sound.current.start();
    t0.current = performance.now();
    setMarks([]); setHistory([]); setLastPeak(null); setPhase('live');
  };
  const stop = useCallback(() => { sound.current?.stop(); sound.current = null; setPhase((p) => (p === 'live' ? 'stopped' : p)); }, []);

  // The speaker can stop at any moment.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop]);
  useEffect(() => () => sound.current?.stop(), []);

  // Clock: signal → needle, earphone tone, peaks → bell + vibration + spoken-text announcement.
  useEffect(() => {
    if (phase !== 'live') return undefined;
    let raf = 0; let lastSample = 0;
    const frame = () => {
      const t = now(); const s = sim.current!;
      level.current = s.level(t);
      sound.current?.update(level.current, live.current.muted);
      for (const p of s.takePeaks(t)) {
        sound.current?.bell(p.amp, live.current.muted);
        if (live.current.haptic && typeof navigator.vibrate === 'function') navigator.vibrate(Math.round(60 + p.amp * 240));
        const mark: Mark = { t, kind: 'peak', text: p.cause, strength: p.amp };
        setMarks((m) => [...m, mark]); setLastPeak(mark);
        setAnnounce(`反応がありました。強さ ${Math.round(p.amp * 10)}（10 段階）。きっかけ：${p.cause}`);
      }
      if (t - lastSample > 0.1) { lastSample = t; const v = level.current; setHistory((h) => [...h, { t, v }].slice(-HISTORY_S * 10)); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const ask = (q: string) => { if (!q.trim() || !sim.current) return; const t = now(); sim.current.stimulate(t, q); setMarks((m) => [...m, { t, kind: 'question', text: q }]); setCustom(''); };
  const selfReport = () => { const t = now(); setMarks((m) => [...m, { t, kind: 'self', text: '話し手：反応を感じた' }]); };

  // Summary: how often the speaker's own sense and the needle agreed (within 4 s).
  const peaks = marks.filter((m) => m.kind === 'peak'); const selfs = marks.filter((m) => m.kind === 'self');
  const agreed = selfs.filter((s) => peaks.some((p) => Math.abs(p.t - s.t) < 4)).length;
  const save = (kind: 'html' | 'json') => {
    const lines = marks.map((m) => `${m.t.toFixed(1)} s · ${m.kind === 'question' ? '質問' : m.kind === 'self' ? '自己申告' : `反応（強さ ${((m.strength ?? 0) * 10).toFixed(0)}）`} · ${m.text}`);
    if (kind === 'json') download('mente-shared-needle.json', JSON.stringify({ simulated: true, marks, agreed, selfReports: selfs.length, peaks: peaks.length }, null, 2), 'application/json');
    else download('mente-shared-needle.html', menteReportHtml('テレフォン · 針の共有（試作）', [{ title: '記録（シミュレーション信号）', lines: lines.length ? lines : ['記録なし'] }, { title: '自己申告と針', lines: [`自己申告 ${selfs.length} 回のうち、4 秒以内に針の反応があったのは ${agreed} 回`, '針は反応の強さだけを示し、意味や真偽は示さない。'] }]), 'text/html');
  };

  // Curve and markers share one time axis: now at the right edge, 60 s ago at the left.
  const W = 600;
  const tNow = phase === 'live' ? now() : 0;
  const xOf = (t: number) => W - (tNow - t) * (W / HISTORY_S);
  const pts = history.filter((h) => tNow - h.t < HISTORY_S).map((h) => `${xOf(h.t).toFixed(1)},${(100 - h.v * 90).toFixed(1)}`).join(' ');

  const pane = (role: 'speaker' | 'listener') => (
    <div className="space-y-2 border-4 border-black bg-white/70 p-3" aria-label={role === 'speaker' ? '話し手の画面' : '聞き手の画面'}>
      <p className="inline-block bg-black px-2 py-0.5 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>{role === 'speaker' ? '話し手' : '聞き手'} · 同じ信号</p>
      <RealNeedle levelRef={level} blackout={blackout} label={role === 'speaker' ? 'あなたの反応' : '相手の反応（相手にも同じ針）'} />
      {role === 'speaker' ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={selfReport} className="border-2 border-black px-3 py-1 font-bold">反応を感じた（自己申告）</button>
          <button type="button" onClick={stop} className="bg-[#d6001c] px-4 py-1 font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>STOP（Esc）</button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">{QUESTIONS.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="border-2 border-black bg-white px-2 py-0.5 text-xs">{q}</button>)}</div>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); ask(custom); }}>
            <input aria-label="Question" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="自分の言葉で質問する" className="min-w-0 flex-1 border-2 border-black bg-white px-2 py-0.5 text-sm" />
            <button type="submit" className="border-2 border-black px-2 py-0.5 font-bold">質問する</button>
          </form>
        </div>
      )}
      {lastPeak && (
        <KrugerBubble
          name={role === 'speaker' ? 'あなたへ' : '聞き手へ'}
          text={role === 'speaker' ? `体が反応しました（強さ ${((lastPeak.strength ?? 0) * 10).toFixed(0)}）。言葉にしなくても大丈夫。止めたいときは STOP。` : '反応がありましたね。どう感じましたか？（針は真偽を示さない。判定に使わない）'}
          align="full"
        />
      )}
    </div>
  );

  return (
    <main className={`${KRUGER_FONT} min-h-screen bg-[repeating-linear-gradient(180deg,#9a9a9a_0_80px,#d0d0d0_80px_190px)] px-4 py-5 text-[#1f1f1f] sm:px-8`}>
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-serif text-4xl font-bold italic text-[#7a0f22]">Mente</p>
            <p className="inline-block bg-black px-2 py-1 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>テレフォン · 針の共有（試作）</p>
          </div>
          <nav className="flex gap-2 text-sm"><Link href="/mente" className="border-2 border-black bg-white/70 px-3 py-1">Mente</Link><Link href="/mente/research" className="border-2 border-black bg-white/70 px-3 py-1">研究 A / B</Link></nav>
        </header>
        <p aria-live="polite" className="sr-only">{announce}</p>

        {phase === 'consent' && (
          <section className="space-y-3 border-4 border-black bg-white/70 p-4" aria-label="Consent">
            <KrugerBubble name="この試作について" text="話し手と聞き手が、言葉と一緒に「体の反応の強さ」を同じように共有する。目を閉じても、イヤホンの音の高さと振動で伝わる。信号はいまはシミュレーション。針は反応の強さだけを示し、本当か嘘かは示さない。" align="full" />
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={consent.speaker} onChange={(e) => setConsent((c) => ({ ...c, speaker: e.target.checked }))} /> 話し手：反応を共有することに同意する。いつでも止められる</label>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={consent.listener} onChange={(e) => setConsent((c) => ({ ...c, listener: e.target.checked }))} /> 聞き手：針を判定に使わず、聞き返しの手がかりにとどめる</label>
            <p className="text-xs text-slate-700">記録はこのブラウザの中だけ。終わったら保存も削除もできる。イヤホンを推奨（音は小さめ）。</p>
            <button type="button" disabled={!consent.speaker || !consent.listener} onClick={start} className="bg-[#d6001c] px-5 py-2 font-bold italic text-white disabled:opacity-40" style={{ fontFamily: KRUGER_FAMILY }}>2 人の同意で始める</button>
          </section>
        )}

        {phase === 'live' && (
          <>
            <section aria-label="Channels" className="flex flex-wrap items-center gap-3 border-4 border-black bg-white/70 p-2 text-sm">
              <span className="bg-black px-2 py-0.5 font-bold italic text-white">対称：同じ信号を 2 人で共有中</span>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} /> 耳（イヤホン）</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={haptic} onChange={(e) => setHaptic(e.target.checked)} /> 振動</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={blackout} onChange={(e) => setBlackout(e.target.checked)} /> ブラックアウト（目を使わない）</label>
              <span className="ml-auto font-mono">{tNow.toFixed(0)} s · 信号 {level.current.toFixed(2)}（シミュレーション）</span>
            </section>
            <div className="grid gap-4 md:grid-cols-2">{pane('speaker')}{pane('listener')}</div>
            <section aria-label="Shared timeline" className="border-4 border-black bg-white/70 p-2">
              <svg viewBox={`0 0 ${W} 110`} className="w-full" role="img" aria-label="Last 60 seconds">
                {!blackout && <polyline points={pts} fill="none" stroke="#d6001c" strokeWidth={2} />}
                {marks.filter((m) => tNow - m.t < HISTORY_S).map((m, i) => (
                  <g key={i}>
                    <line x1={xOf(m.t)} x2={xOf(m.t)} y1={0} y2={104} stroke={m.kind === 'question' ? '#000' : m.kind === 'self' ? '#2563eb' : '#d6001c'} strokeDasharray={m.kind === 'peak' ? '2 3' : undefined} />
                    <text x={xOf(m.t) + 2} y={m.kind === 'question' ? 10 : m.kind === 'self' ? 22 : 34} fontSize={8}>{m.kind === 'question' ? `Q ${m.text.slice(0, 10)}` : m.kind === 'self' ? '自己申告' : '反応'}</text>
                  </g>
                ))}
              </svg>
              <p className="text-xs text-slate-700">黒＝質問、青＝話し手の自己申告、赤の点線＝針の反応（質問の数秒後に遅れて出る）。</p>
            </section>
          </>
        )}

        {phase === 'stopped' && (
          <section aria-label="Summary" className="space-y-2 border-4 border-black bg-white/70 p-4">
            <KrugerBubble name="終了" text={`質問 ${marks.filter((m) => m.kind === 'question').length} 回・針の反応 ${peaks.length} 回・自己申告 ${selfs.length} 回（そのうち 4 秒以内に針も反応 ${agreed} 回）。針と本人の感覚は、いつも一致するとは限らない。`} align="full" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => save('html')} className="bg-[#d6001c] px-3 py-1 font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>記録を保存（HTML）</button>
              <button type="button" onClick={() => save('json')} className="border-2 border-black px-3 py-1 font-bold">記録を保存（JSON）</button>
              <button type="button" onClick={() => { setMarks([]); setHistory([]); setLastPeak(null); }} className="border-2 border-black px-3 py-1">記録を消す</button>
              <button type="button" onClick={() => { setConsent({ speaker: false, listener: false }); setPhase('consent'); }} className="border-2 border-black px-3 py-1">最初から（同意し直す）</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
