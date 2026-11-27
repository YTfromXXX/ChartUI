'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AviatorPopup from '@/components/dualSlot/AviatorPopup';
import { BREAK_EVERY, DEFAULT_SPAN, SPIN_MS, SQUARES, STOPS, STRIPS, distribution, portAt, spin, transformStats, transformsFor, type Spin, type Wingspan } from '@/lib/dualSlot';

const RULES = [
  'お金・メダル・オッズ・換金はありません。結果は双六の駒が何マス進むかだけです。',
  '結果（3 つの停止位置）を先に決め、リールはそれを見せるだけ。止め方の操作はなく、ニアミス（あと少し）の演出もしません。',
  '確率はすべて下の表に公開しています（8 000 通りを数えた値）。',
  'Dual のどちらを選んでも、進むマス数の平均は同じ 3.5。変わるのはばらつきだけです。',
  '1 回押すと 1 回だけ回ります（オート機能なし）。3 本のリールは同時に止まります。',
  `${BREAK_EVERY} 回ごとに休憩のカードが出ます。光は 3 Hz を超えて点滅しません。`,
];

function Reel({ strip, stop, spinning, t, reduce }: { strip: readonly string[]; stop: number; spinning: boolean; t: number; reduce: boolean }) {
  // While spinning the strip scrolls and slows down to land exactly on `stop`; it never pauses on a neighbour.
  const travel = reduce ? 0 : 3 * STOPS; const k = spinning ? 1 - (1 - Math.min(1, t)) ** 3 : 1;
  const pos = stop - travel * (1 - k); const base = Math.floor(pos); const frac = pos - base;
  return (
    <div className="relative h-36 w-20 overflow-hidden rounded-md border-2 border-amber-200/60 bg-[#fbf7ee]" aria-hidden>
      <div style={{ transform: `translateY(${-frac * 48}px)` }}>
        {[-1, 0, 1, 2].map((d) => <div key={d} className="flex h-12 items-center justify-center text-3xl text-[#2b1d0e]">{strip[(((base + d) % STOPS) + STOPS) % STOPS]}</div>)}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-12 h-12 border-y-2 border-red-500/70" />
    </div>
  );
}

/**
 * Dual・パチスロ（慎重に）: a slot machine whose only output is movement on a 22-square sugoroku of
 * the Fami ports. Outcomes are drawn first and shown honestly; probabilities are public; every Dual
 * has the same mean; no auto-play; breaks are built in.
 */
export default function DualSlot() {
  const dist = useMemo(() => distribution(), []);
  const [square, setSquare] = useState(0);
  const [picks, setPicks] = useState<Record<number, 0 | 1>>({ 3: 0, 8: 0, 15: 0, 20: 0, 22: 0 });
  const [log, setLog] = useState<Spin[]>([]);
  // Idle position shows no 7 on the pay line (♚ ♛ 🎲): nothing should look like an "almost 777" before a draw.
  const [shown, setShown] = useState<[number, number, number]>([1, 0, 0]);
  const [spinning, setSpinning] = useState(false);
  const [t, setT] = useState(1);
  const [count, setCount] = useState(0);
  const [moved, setMoved] = useState(0);
  const [started] = useState(() => Date.now());
  const [onBreak, setOnBreak] = useState(false);
  const [reveal, setReveal] = useState(6);
  const [span, setSpan] = useState<Wingspan>(DEFAULT_SPAN);
  const [aviator, setAviator] = useState(false);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [reduce, setReduce] = useState(false);
  const raf = useRef(0);
  useEffect(() => { setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches); return () => cancelAnimationFrame(raf.current); }, []);

  const press = () => {
    if (spinning || onBreak || aviator) return;
    const u = new Uint32Array(4); crypto.getRandomValues(u);
    const s = spin(square, picks, [u[0] / 2 ** 32, u[1] / 2 ** 32, u[2] / 2 ** 32, u[3] / 2 ** 32], count, span);
    setShown(s.stops); setSpinning(true); setT(0);
    const t0 = performance.now(); const dur = reduce ? 400 : SPIN_MS;
    const tick = (now: number) => {
      const k = (now - t0) / dur; setT(k);
      if (k < 1) { raf.current = requestAnimationFrame(tick); return; }
      setSpinning(false); setSquare(((s.to % SQUARES) + SQUARES) % SQUARES);
      setVisited((v) => { const n = new Set(v); for (let q = s.from; q <= s.to; q += 1) n.add(((q % SQUARES) + SQUARES) % SQUARES); return n; }); setMoved((m) => m + (s.to - s.from)); setLog((l) => [s, ...l].slice(0, 8));
      if (portAt(s.to).no === 21) setReveal(12);
      if (portAt(s.to).no === 8) setAviator(true);
      const n = count + 1; setCount(n); if (n % BREAK_EVERY === 0) setOnBreak(true);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') { e.preventDefault(); press(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });

  const last = log[0];
  const minutes = Math.floor((Date.now() - started) / 60000);

  return (
    <main className="min-h-screen bg-[#1b1206] px-4 py-6 text-amber-50">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-amber-300/80">LAB · Dual・パチスロ（慎重に） · Fami ポート 3・8・15・20・21・22</p>
            <h1 className="text-2xl font-semibold">サイコロとしてのスロット — 双六のマス目に従う</h1>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/king-queen" className="border border-amber-200/30 px-3 py-1">King ＆ Queen</Link><Link href="/menu" className="border border-amber-200/30 px-3 py-1">総合メニュー</Link></nav>
        </header>

        <section className="rounded-lg border border-amber-200/30 bg-black/30 p-3 text-xs" data-testid="rules">
          <p className="mb-1 font-semibold text-amber-200">慎重に作るための約束</p>
          <ol className="list-decimal space-y-0.5 pl-5">{RULES.map((r) => <li key={r}>{r}</li>)}</ol>
        </section>

        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <section className="space-y-3 rounded-xl border-4 border-[#7c2d12] bg-gradient-to-b from-[#3b1d0a] to-[#1f1206] p-4" aria-label="スロット">
            <div className="flex gap-2" data-testid="reels">{STRIPS.map((strip, i) => <Reel key={i} strip={strip} stop={shown[i]} spinning={spinning} t={t} reduce={reduce} />)}</div>
            <button type="button" data-testid="spin" onClick={press} disabled={spinning || onBreak || aviator} className="w-full rounded-full bg-amber-300 py-2 font-semibold text-[#1b1206] disabled:opacity-40">{spinning ? '回転中…' : '回す（Space）'}</button>
            <p className="text-center font-mono text-sm" data-testid="result">
              {last ? `${last.line.join(' ')} → 出目 ${last.rolled}${last.dual ? `（${last.dual}：${last.moved} マス）` : ''} · マス ${last.from + 1} → ${(((last.to % SQUARES) + SQUARES) % SQUARES) + 1}` : '押すと 1 回だけ回ります'}
            </p>
            {last?.effect && <p className="text-center text-xs text-amber-200">{last.effect}</p>}
            {last?.prophecy && <p className="rounded border border-violet-300/50 p-2 text-center text-xs text-violet-200" data-testid="prophecy">7 7 7 — 魔女の予言（1/2000）。King ＆ Queen の部屋で続きが読めます。何かがもらえるわけではありません。</p>}
          </section>

          <section className="space-y-3">
            {/* Fog: squares beyond the revealed distance that the piece has not passed yet. */}
            <div className="grid grid-cols-11 gap-1" data-testid="board" aria-label="22 マスの双六">
              {Array.from({ length: SQUARES }, (_, i) => { const p = portAt(i); const ahead = (i - square + SQUARES) % SQUARES; const fog = ahead > reveal && !visited.has(i); return (
                <div key={i} className="relative h-16 rounded border p-1 text-[9px] leading-tight" style={{ borderColor: i === square ? '#fcd34d' : '#ffffff22', background: [3, 8, 15, 20, 21, 22].includes(p.no) ? '#78350f55' : '#ffffff08' }} title={fog ? '霧' : p.title}>
                  <span className="font-mono text-amber-300">{p.no}</span> {fog ? '…霧…' : p.title}
                  {i === square && <span className="absolute bottom-0.5 right-1 rounded-full bg-amber-300 px-1 font-mono text-[10px] text-black" data-testid="piece">Y</span>}
                </div>
              ); })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="duals">
              {Object.entries(transformsFor(span)).map(([port, pair]) => (
                <div key={port} className="rounded border border-amber-200/20 p-2 text-xs">
                  <p className="mb-1 text-amber-200">{port}. {portAt(Number(port) - 1).title}</p>
                  <div className="flex gap-1">{pair.map((tr, k) => { const st = transformStats(tr, dist.steps); return (
                    <button key={tr.label} type="button" data-testid={`dual-${port}-${k}`} onClick={() => setPicks((p) => ({ ...p, [port]: k as 0 | 1 }))} className="flex-1 rounded border px-2 py-1 text-left" style={{ borderColor: picks[Number(port)] === k ? '#fcd34d' : '#ffffff22' }}>
                      <span className="font-semibold">{tr.label}</span><br /><span className="text-[10px] text-amber-100/70">{tr.note} · 平均 {st.mean.toFixed(2)} · ばらつき {st.variance.toFixed(2)}</span>
                    </button>
                  ); })}</div>
                  {port === '8' && <button type="button" data-testid="aviator-open" onClick={() => setAviator(true)} className="mt-1 w-full rounded border border-sky-300/40 py-0.5 text-[10px] text-sky-200">✈ ポップアップで初期化（いまの翼 {3.5 - span}–{3.5 + span}）</button>}
                  {port === '3' && <p className="mt-1 text-[10px] text-amber-100/60">奇数を選ぶと「奇数回帰」が有効：偶数マスに止まると次の奇数マスへ滑る（位置が変わるだけ）。</p>}
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <table className="font-mono text-xs" data-testid="odds-table"><caption className="text-left text-amber-200">公開している確率（8 000 通りを数えた値）</caption><tbody>
                {dist.steps.slice(1).map((p, i) => <tr key={i}><td className="pr-3">出目 {i + 1}</td><td>{(p * 100).toFixed(2)}%</td><td className="pl-2"><span className="inline-block h-2 bg-amber-300" style={{ width: `${p * 300}px` }} /></td></tr>)}
                <tr><td className="pr-3">7 7 7</td><td>{(dist.prophecy * 100).toFixed(3)}%（1/{Math.round(1 / dist.prophecy)}）</td><td /></tr>
                <tr><td className="pr-3">平均</td><td>{dist.mean.toFixed(3)} マス</td><td /></tr>
              </tbody></table>
              <div className="text-xs" data-testid="session">
                <p className="text-amber-200">このセッション</p>
                <p>{count} 回 · 進んだマス {moved} · {minutes} 分</p>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-amber-100/80">{log.map((s, i) => <li key={i}>{s.line.join('')} 出目 {s.rolled}{s.dual ? ` ${s.dual}→${s.moved}` : ''}</li>)}</ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      {aviator && <AviatorPopup square={square} pick={picks[8] ?? 0} span={span} onDone={(pk, sp) => { setPicks((x) => ({ ...x, 8: pk })); setSpan(sp); setAviator(false); }} />}

      {onBreak && (
        <div role="dialog" aria-label="休憩" data-testid="break" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-sm space-y-2 rounded-xl border border-amber-200/40 bg-[#1b1206] p-4 text-sm">
            <p className="text-lg font-semibold text-amber-200">ひと休み</p>
            <p>{count} 回まわしました（{minutes} 分）。進んだマスは {moved}、駒はいまマス {square + 1}（{portAt(square).title}）です。</p>
            <p className="text-amber-100/70">このスロットは何も払い出さず、続けても得をするしくみはありません。今日はここで止めても大丈夫です。</p>
            <div className="flex gap-2"><Link href="/menu" className="flex-1 rounded-full border border-amber-200/40 py-1 text-center">今日はここまで</Link><button type="button" data-testid="resume" onClick={() => setOnBreak(false)} className="flex-1 rounded-full bg-amber-300 py-1 font-semibold text-black">あと {BREAK_EVERY} 回だけ</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
