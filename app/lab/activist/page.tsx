'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { COMPANIES, SQUARES, newGame, run, score, targetScore, type Car, type Filter, type State } from '@/lib/activistSugoroku';

const FILTER: Record<Filter, { ja: string; colour: string }> = { fact: { ja: '事実', colour: '#93c5fd' }, rumour: { ja: '噂', colour: '#fca5a5' }, feeling: { ja: '感情', colour: '#f9a8d4' } };

/** A car piece: a shogi-style pentagon holding a taxi in the team's colours, roof light with logo, door number. */
function TaxiPiece({ car, size = 54 }: { car: Car; size?: number }) {
  const c = car.team.colour;
  return (
    <svg viewBox="0 0 60 66" width={size} height={size * 1.1} aria-label={`チーム${car.team.logo} ${car.number} 番`}>
      <path d="M30 2 L52 10 L58 64 L2 64 L8 10 Z" fill="#f4e7c8" stroke="#6b4f2a" strokeWidth="1.5" />
      <rect x="20" y="16" width="20" height="9" rx="2" fill="#111" /><text x="30" y="23.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={c}>{car.team.logo}</text>
      <path d="M10 44 Q12 30 20 28 L40 28 Q48 30 50 44 Z" fill={c} stroke="#222" strokeWidth="1" />
      <rect x="10" y="40" width="40" height="5" fill="#111" />{Array.from({ length: 10 }, (_, i) => <rect key={i} x={10 + i * 4} y={i % 2 ? 40 : 42.5} width="4" height="2.5" fill="#fff" />)}
      <rect x="9" y="45" width="42" height="7" rx="2" fill={c} stroke="#222" strokeWidth="1" />
      <rect x="22" y="31" width="7" height="7" fill="#cde8ff" /><rect x="31" y="31" width="7" height="7" fill="#cde8ff" />
      <circle cx="17" cy="54" r="4" fill="#222" /><circle cx="43" cy="54" r="4" fill="#222" />
      <text x="30" y="51" textAnchor="middle" fontSize="7" fontWeight="700" fill="#111">{car.number}</text>
    </svg>
  );
}

/** Board position of square n (0 = start) on a rounded loop road. */
function spot(n: number) {
  const W = 760; const H = 300; const per = 2 * (W + H); const d = (n / 20) * per; const pad = 50;
  if (d < W) return { x: pad + d, y: pad }; if (d < W + H) return { x: pad + W, y: pad + d - W };
  if (d < 2 * W + H) return { x: pad + W - (d - W - H), y: pad + H }; return { x: pad, y: pad + H - (d - 2 * W - H) };
}

/**
 * Activist sugoroku: an activist campaign as a 19-square board, played with taxi pieces. Type
 * .sh-style commands; `git push` moves every car at once. Fictional companies, synthetic news.
 */
export default function ActivistSugoroku() {
  const [s, setS] = useState<State>(() => newGame(7));
  const [term, setTerm] = useState<string[]>(['ナギ（₿#17）のターミナルです。help で一覧。まず roll か git commit -m "…"、次に git push。']);
  const [line, setLine] = useState('');
  const [bone, setBone] = useState<number | null>(null);
  const out = useRef<HTMLDivElement>(null);
  useEffect(() => { out.current?.scrollTo({ top: out.current.scrollHeight }); }, [term]);
  const exec = (cmd: string) => { const o = run(s, cmd); setS(o.state); setTerm((t) => [...t, `nagi@board:~$ ${cmd}`, ...o.lines].slice(-200)); setLine(''); };
  const done = s.cars.every((c) => c.done);
  const ranking = [...s.cars].sort((a, b) => score(b) - score(a));

  return (
    <main className="min-h-screen bg-[#14110c] px-4 py-6 text-[#f4ead6]">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-[#c8b48a]">LAB · アクティビスト双六</p>
            <h1 className="text-2xl font-semibold">取締役会への道 — 19 マスの骨格と、車の駒</h1>
            <p className="max-w-3xl text-sm text-[#e2d5b8]">物言う株主のキャンペーンを双六にしました（『アクティビスト 取締役会の野蛮な侵入者』オーウェン・ウォーカー を読んだ着想から。本文は使っていません）。各マスのニュースは 3 つのフィルター（事実・噂・感情）で骨格 n/19 に回収され、止まった運転手の性格を変えます。会社と人物はすべて架空、数字は合成です。投資の助言ではありません。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/prompt-chess" className="border border-white/20 px-3 py-1">プロンプトチェス</Link><Link href="/lab/backlog" className="border border-white/20 px-3 py-1">やることボード</Link></nav>
        </header>

        <svg viewBox="0 0 860 400" className="w-full rounded border border-white/10 bg-[#1d1811]" data-testid="board">
          <rect x="50" y="50" width="760" height="300" rx="30" fill="none" stroke="#3b3326" strokeWidth="46" />
          <rect x="50" y="50" width="760" height="300" rx="30" fill="none" stroke="#f4ead633" strokeWidth="1.5" strokeDasharray="10 10" />
          {SQUARES.map((sq) => { const p = spot(sq.no); const b = s.bones[sq.no - 1]; const n = b.fact.length + b.rumour.length + b.feeling.length; return (
            <g key={sq.no} onClick={() => setBone(sq.no)} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r="17" fill={bone === sq.no ? '#f4ead6' : '#2a241a'} stroke={FILTER[sq.kind].colour} strokeWidth={1.5 + Math.min(4, n)} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontFamily="monospace" fill={bone === sq.no ? '#111' : '#f4ead6'}>{sq.no}</text>
              <text x={p.x} y={p.y + (p.y < 100 ? -24 : p.y > 300 ? 34 : 30)} textAnchor="middle" fontSize="8.5" fill="#c8b48a">{sq.title.length > 9 ? `${sq.title.slice(0, 9)}…` : sq.title}</text>
            </g>
          ); })}
          <text x={spot(0).x} y={spot(0).y + 4} textAnchor="middle" fontSize="10" fill="#c8b48a">START</text>
          {s.cars.map((c, i) => { const p = spot(c.pos); return <g key={c.team.id} transform={`translate(${p.x - 26 + (i % 2) * 22} ${p.y + 10 + Math.floor(i / 2) * 6 - (p.y > 300 ? 90 : 0)})`} style={{ transition: 'transform 700ms ease' }}><TaxiPiece car={c} size={34} /></g>; })}
          <text x="430" y="200" textAnchor="middle" fontSize="14" fill="#c8b48a">{done ? `決着 — 1 位 チーム${ranking[0].team.logo}` : `ターン ${s.turn}`}</text>
          <text x="430" y="222" textAnchor="middle" fontSize="10" fill="#8f7f5f">マスを押すと、その骨格に回収されたテキスト</text>
        </svg>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <section className="space-y-2">
            <div ref={out} data-testid="terminal" className="h-64 overflow-y-auto rounded border border-white/10 bg-black/70 p-2 font-mono text-[11px] leading-5 text-[#d9f99d]">
              {term.map((t, i) => <div key={i} className={t.startsWith('nagi@') ? 'text-white' : t.startsWith('!') ? 'text-rose-300' : ''}>{t}</div>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); exec(line); }} className="flex gap-2 font-mono text-xs">
              <span className="py-1 text-[#d9f99d]">$</span>
              <input data-testid="cmd" value={line} onChange={(e) => setLine(e.target.value)} className="flex-1 rounded border border-white/20 bg-black/60 px-2 py-1" placeholder='git commit -m "MNT を買い集める"' />
              <button type="submit" className="rounded border border-white/20 px-2">⏎</button>
            </form>
            <div className="flex flex-wrap gap-1 font-mono text-[11px]">{['roll', 'git push', 'git log', 'status', 'egosearch ₿', 'ask gemini 次は？', 'ask claude 次は？', 'help'].map((c) => <button key={c} type="button" data-testid={`quick-${c.replace(/\s+/g, '-')}`} onClick={() => exec(c)} className="rounded border border-white/15 px-2 py-0.5">{c}</button>)}
              <button type="button" onClick={() => { setS(newGame(s.seed + 1)); setTerm(['新しいキャンペーン。']); }} className="rounded border border-white/15 px-2 py-0.5">新しいゲーム</button></div>
          </section>

          <section className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              {s.cars.map((c) => (
                <div key={c.team.id} className="flex gap-2 rounded border p-2" style={{ borderColor: `${c.team.colour}66` }} data-testid={`car-${c.team.id}`}>
                  <TaxiPiece car={c} size={40} />
                  <div><p style={{ color: c.team.colour }}>{c.team.driver} · {c.pos}/19</p><p className="text-[10px] text-[#c8b48a]">{COMPANIES.find((x) => x.ticker === c.target)?.name} · 株 {c.stake}% · 席 {c.seats}</p>
                    <p className="text-[10px]">忍耐 {c.traits.patience.toFixed(2)} · 大胆 {c.traits.boldness.toFixed(2)} · 魅力 {c.traits.charm.toFixed(2)}</p></div>
                </div>
              ))}
            </div>
            <div className="rounded border border-pink-300/30 p-2" data-testid="drama">
              <p className="mb-1 text-pink-200">ナギ × ルカ　{'♥'.repeat(Math.round(s.romance * 5))}{'♡'.repeat(5 - Math.round(s.romance * 5))}</p>
              {s.drama.slice(0, 3).map((d, i) => <p key={i} className={i ? 'text-[#c8b48a]' : ''}>{d}</p>)}
            </div>
            {bone && (
              <div className="rounded border border-white/15 p-2" data-testid="bone">
                <p className="mb-1">骨格 {bone}/19 · {SQUARES[bone - 1].title}</p>
                {(['fact', 'rumour', 'feeling'] as Filter[]).map((f) => <div key={f}><span style={{ color: FILTER[f].colour }}>{FILTER[f].ja}</span> {s.bones[bone - 1][f].length} 件{s.bones[bone - 1][f].slice(0, 2).map((t, i) => <p key={i} className="pl-3 text-[#c8b48a]">{t}</p>)}</div>)}
              </div>
            )}
          </section>
        </div>

        <section className="space-y-1 text-xs" data-testid="news">
          <h2 className="font-semibold">ニュース（次の銘柄へ視野をまわす材料）</h2>
          {s.news.slice(0, 8).map((n, i) => <p key={i}><span className="mr-2 font-mono" style={{ color: FILTER[n.kind].colour }}>[{FILTER[n.kind].ja}]</span>t{n.turn} · マス {n.square} · {n.text}</p>)}
          <p className="pt-2 text-[#8f7f5f]">標的の点数（PBR が低い・現金が多い・持ち合い株が多いほど高い）：{COMPANIES.map((c) => `${c.name} ${(targetScore(c) * 100).toFixed(0)}`).join(' · ')}</p>
        </section>
      </div>
    </main>
  );
}
