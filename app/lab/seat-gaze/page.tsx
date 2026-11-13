'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DECK, HAND, abs, arg, asciiTable, ease, gazeAngle, makeSeats, ratio, type Seat } from '@/lib/seatGaze';
import { rng } from '@/lib/smokeCandle';

type Folder = { id: string; label: string; icon: string; area: number; mass: number; note: string };
const FOLDERS: Folder[] = [
  { id: 'river', label: '河のカード', icon: '📂', area: 1, mass: 0, note: '表面積 +1（見せた牌）' },
  { id: 'hand', label: '手牌', icon: '📁', area: 0, mass: 1, note: '質量 +1（抱える牌）' },
  { id: 'reveal', label: '手を見せる', icon: '🗂', area: 1, mass: -1, note: '質量 −1・表面積 +1' },
];
const NAMES = ['Y', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const R = 120; const CX = 170; const CY = 170;
const px = (re: number, im: number) => ({ x: CX + re * R, y: CY - im * R });

/**
 * Seat icons for a 4- or 8-player tarot sugoroku table: each player is a point on the complex plane
 * with a colour, a gaze direction and a value (表面積 : 質量) that is given slowly. You are Y, at a
 * Mac split 5:5 — folders on the left (drag them onto a seat), a terminal with the table in ASCII on
 * the right — and your gaze follows the half you are working in.
 */
export default function SeatGaze() {
  const [n, setN] = useState<4 | 8>(8);
  const [decks, setDecks] = useState(2);
  const [seats, setSeats] = useState<Seat[]>(() => makeSeats(8));
  const [ascii, setAscii] = useState('');
  const [drawing, setDrawing] = useState('  _/\\_\n <(oo)>  Y\n  /  \\');
  const [hover, setHover] = useState<number | null>(null);
  const live = useRef(seats); live.current = seats;
  const rnd = useRef(rng(5));

  useEffect(() => { setSeats(makeSeats(n)); setDecks(n === 8 ? 2 : decks); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slow giving: values ease toward their targets; the ASCII redraws twice a second; CPU gazes drift every 5 s.
  useEffect(() => {
    let last = performance.now(); let raf = 0; let asciiClock = 0; let gazeClock = 0;
    const f = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000); last = Math.max(last, now); asciiClock += dt; gazeClock += dt;
      let next = ease(live.current, dt);
      if (gazeClock > 5) {
        gazeClock = 0;
        const heaviest = next.reduce((a, s) => (s.mass > a.mass ? s : a), next[0]).k;
        next = next.map((s) => (s.k === 0 ? s : { ...s, gaze: rnd.current() < 0.6 || heaviest === s.k ? { kind: 'table' } : { kind: 'seat', to: heaviest } }));
      }
      setSeats(next);
      if (asciiClock > 0.5) { asciiClock = 0; setAscii(asciiTable(next, NAMES)); }
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, []);

  const setYGaze = (half: 'left' | 'right') => setSeats((ss) => ss.map((s) => (s.k === 0 ? { ...s, gaze: { kind: 'screen', half } } : s)));
  const give = (k: number, f: Folder) => setSeats((ss) => ss.map((s) => (s.k === k ? { ...s, target: { area: Math.max(1, s.target.area + f.area), mass: Math.max(0, s.target.mass + f.mass) } } : s)));
  const round = () => setSeats((ss) => ss.map((s) => ({ ...s, target: { ...s.target, area: s.target.area + 1 } })));
  const onDrop = (k: number) => (e: React.DragEvent) => { e.preventDefault(); const f = FOLDERS.find((x) => x.id === e.dataTransfer.getData('text/plain')); if (f) give(k, f); setHover(null); };
  const cards = decks * DECK;

  return (
    <main className="min-h-screen bg-[#0d0d12] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-amber-300/80">LAB · 席と目線 · タロット双六</p>
            <h1 className="text-2xl font-semibold">現場のプレイヤーの色と目線 — 複素平面の点に（表面積：質量）</h1>
            <p className="max-w-3xl text-sm text-slate-300">各席は複素平面の点 z = e^(iθ)。色は席の風、矢印の扇は目線。点の大きさが表面積（河に見せた牌 + 1）、濃さが質量（手に抱えた牌）。値は約 3 秒かけてゆっくり届きます。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/architect/tetra" className="border border-white/20 px-3 py-1">テトラアルカナ</Link><Link href="/lab/backlog" className="border border-white/20 px-3 py-1">やることボード</Link></nav>
        </header>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {([4, 8] as const).map((k) => <button key={k} type="button" data-testid={`players-${k}`} onClick={() => setN(k)} className="rounded border px-3 py-1" style={{ borderColor: n === k ? '#fcd34d' : '#ffffff33' }}>{k} 人</button>)}
          <span className="ml-2">ノイマンルール · デッキ</span>
          {[1, 2].map((d) => <button key={d} type="button" onClick={() => setDecks(d)} disabled={n === 8 && d === 1} className="rounded border px-2 py-0.5 disabled:opacity-30" style={{ borderColor: decks === d ? '#fcd34d' : '#ffffff33' }}>{d} つ</button>)}
          <span data-testid="deck">{cards} 枚 · 配る {n * HAND} 枚 · 山に {cards - n * HAND} 枚{n === 8 ? '（8 人はデッキ 2 つ）' : ''}</span>
          <button type="button" data-testid="round" onClick={round} className="ml-auto rounded border border-white/20 px-3 py-1">1 巡進める（全員が 1 枚捨てる）</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <svg viewBox="0 0 340 340" className="w-full rounded border border-white/10 bg-[#111118]" data-testid="plane" aria-label="複素平面の卓">
            <line x1="10" x2="330" y1={CY} y2={CY} stroke="#ffffff22" /><line y1="10" y2="330" x1={CX} x2={CX} stroke="#ffffff22" />
            <text x="322" y={CY - 4} fontSize="9" fill="#64748b">Re</text><text x={CX + 4} y="18" fontSize="9" fill="#64748b">Im</text>
            <circle cx={CX} cy={CY} r={R} fill="#1b1b26" stroke="#ffffff33" />
            <text x={CX} y={CY + 4} textAnchor="middle" fontSize="11" fill="#94a3b8">{cards} 枚</text>
            {seats.map((s) => {
              const p = px(s.z.re, s.z.im); const a = gazeAngle(s, seats); const half = (15 * Math.PI) / 180; const L = 46;
              const w1 = { x: p.x + L * Math.cos(a - half), y: p.y - L * Math.sin(a - half) }; const w2 = { x: p.x + L * Math.cos(a + half), y: p.y - L * Math.sin(a + half) };
              const rad = 6 + 4 * Math.sqrt(s.area); const op = 0.15 + 0.85 * Math.min(1, s.mass / HAND);
              return (
                <g key={s.k} data-testid={`seat-${s.k}`} onDragOver={(e) => { e.preventDefault(); setHover(s.k); }} onDragLeave={() => setHover(null)} onDrop={onDrop(s.k)}>
                  <path d={`M${p.x} ${p.y} L${w1.x} ${w1.y} L${w2.x} ${w2.y} Z`} fill={s.colour} opacity="0.22" style={{ transition: 'd 1.5s ease' }} />
                  <circle cx={p.x} cy={p.y} r={rad + (hover === s.k ? 4 : 0)} fill={s.colour} fillOpacity={op} stroke={s.colour} strokeWidth="2" />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0d0d12" pointerEvents="none">{NAMES[s.k]}</text>
                  <text x={p.x} y={p.y + (s.z.im >= 0 ? -rad - 6 : rad + 13)} textAnchor="middle" fontSize="8.5" fill="#cbd5e1" pointerEvents="none">{s.wind} · {s.area.toFixed(1)}:{s.mass.toFixed(1)}</text>
                </g>
              );
            })}
          </svg>

          <section className="space-y-2" aria-label="myMacPC 5:5">
            <p className="font-mono text-xs text-slate-400">myMacPC — 画面を 5:5 に分割（左：フォルダー、右：ターミナル）。Y の目線は、作業している半分を向きます。</p>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/15" data-testid="mac">
              <div className="space-y-2 bg-[#ececf1] p-3 text-black" onMouseEnter={() => setYGaze('left')}>
                <p className="text-[11px] font-semibold text-slate-600">Finder · 席へドラッグ＆ドロップして値を与える</p>
                {FOLDERS.map((f) => (
                  <div key={f.id} draggable data-testid={`folder-${f.id}`} onDragStart={(e) => { e.dataTransfer.setData('text/plain', f.id); setYGaze('left'); }} className="flex cursor-grab items-center gap-2 rounded bg-white px-2 py-1 text-sm shadow">
                    <span className="text-xl">{f.icon}</span><span>{f.label}</span><span className="ml-auto text-[10px] text-slate-500">{f.note}</span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1 pt-1">{seats.map((s) => <span key={s.k} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(s.k)} className="rounded border px-1.5 text-[11px]" style={{ borderColor: s.colour, color: '#111' }}>{NAMES[s.k]} {ratio(s).toFixed(2)}</span>)}</div>
                <p className="text-[10px] text-slate-500">数字は 表面積 ÷ 質量（どれだけ見せて、どれだけ抱えているか）</p>
              </div>
              <div className="bg-black p-3 font-mono text-[11px] leading-[1.15] text-lime-300" onMouseEnter={() => setYGaze('right')}>
                <p className="text-slate-500">y@myMacPC:~/tarot-sugoroku $ watch table</p>
                <pre data-testid="ascii" className="overflow-x-auto">{ascii}</pre>
                <p className="mt-1 text-slate-500">y@myMacPC:~/tarot-sugoroku $ vim me.txt</p>
                <textarea data-testid="draw" value={drawing} onFocus={() => setYGaze('right')} onChange={(e) => setDrawing(e.target.value.replace(/[^\x20-\x7e\n]/g, ''))} rows={5} className="w-full resize-none bg-black text-lime-200 outline-none" spellCheck={false} aria-label="アスキーアートを描く" />
              </div>
            </div>
            <p className="text-xs text-slate-400" data-testid="y-gaze">Y の目線：{seats[0]?.gaze.kind === 'screen' ? (seats[0].gaze.half === 'left' ? '左半分（フォルダー）' : '右半分（ターミナル）') : '卓の中心'} · 複素数で z = {abs(seats[0]?.z ?? { re: 0, im: 1 }).toFixed(0)}∠{Math.round(((arg(seats[0]?.z ?? { re: 0, im: 1 }) * 180) / Math.PI))}°</p>
          </section>
        </div>
      </div>
    </main>
  );
}
