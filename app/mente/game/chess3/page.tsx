'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { DEVICES, NEWS, PEOPLE, ROOMS, TURNS, sideName, type Filter } from '@/lib/chessGame3';
import { FLOORS, SIZE, cpuPrompt, initialPieces, legalMoves, parsePrompt, resolveTurn, same, sqName, type Piece, type Sq, type TurnEvent } from '@/lib/promptChess';

const FILTER_COLOR: Record<Filter, string> = { 事実: '#1f1f1f', 噂: '#2b3a67', 感情: '#c8001a' };
const CELL = 40; const PAD = 22; const FLOOR_W = SIZE * CELL + PAD * 2;

type LogEntry = { turn: number; lines: { side: string; device: string; prompt: string; why: string }[]; events: TurnEvent[]; acts: string[]; harmony: number; note: string };

/** Game 3: the chalk room. Every move comes from a prompt sent from a device or a meta view. */
export default function ChessGame3() {
  const [pieces, setPieces] = useState<Piece[]>(() => initialPieces());
  const [turn, setTurn] = useState(0);
  const [device, setDevice] = useState<string | null>(null);
  const [camera, setCamera] = useState(7);
  const [prompt, setPrompt] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [harmony, setHarmony] = useState(0);
  const [warn, setWarn] = useState('');
  const rnd = useRef(() => Math.random());
  const done = turn >= TURNS;
  const news = NEWS[Math.min(turn, TURNS - 1)];
  const targets = useMemo(() => { const p = pieces.find((q) => q.id === picked); return p ? legalMoves(p, pieces) : []; }, [picked, pieces]);

  const send = () => {
    if (done) return;
    if (!device) { setWarn('決まり：手は、デバイスかメタ視点からのプロンプトで送ります。まずデバイスを選んでください。'); return; }
    if (!prompt.trim()) { setWarn('プロンプトが空です。駒を押して行き先を押すと、プロンプトの下書きが入ります。'); return; }
    setWarn('');
    const dev = DEVICES.find((d) => d.id === device)!;
    const white = parsePrompt(prompt, 'white', pieces);
    const cpuDev = DEVICES[Math.floor(rnd.current() * DEVICES.length)];
    const blackText = cpuPrompt('black', pieces, rnd.current);
    const black = parsePrompt(blackText, 'black', pieces);
    const { pieces: next, events } = resolveTurn(pieces, white.move, black.move);
    const crashed = events.some((e) => e.kind === 'crash');
    const delta = crashed ? -1 : dev.id !== cpuDev.id ? 1 : 0;
    const acts = [white.move, black.move].flatMap((m) => (m ? [`${PEOPLE[m.id].name}（${PEOPLE[m.id].role}）は、${PEOPLE[m.id].act[turn % 3]}。`] : []));
    const devLabel = (d: typeof dev) => (d.meta ? `${d.icon} エーリアル ${d.id === dev.id ? camera : 1 + Math.floor(rnd.current() * 22)} のメタ視点` : `${d.icon} ${d.name}`);
    setLog((l) => [{ turn: turn + 1, lines: [
      { side: sideName('white'), device: devLabel(dev), prompt, why: white.why },
      { side: sideName('black'), device: devLabel(cpuDev), prompt: blackText, why: black.why },
    ], events, acts, harmony: delta, note: crashed ? '同じマスでぶつかった。読み方が衝突して、調和が一つ減った。' : delta > 0 ? `違うデバイスから、同じニュースを読んだ。${news.harmony}` : '同じデバイスから読んだ。調和は増えも減りもしない。' }, ...l]);
    setHarmony((h) => h + delta); setPieces(next); setTurn((t) => t + 1); setPrompt(''); setPicked(null);
  };
  const reset = () => { setPieces(initialPieces()); setTurn(0); setLog([]); setHarmony(0); setPrompt(''); setPicked(null); setDevice(null); setWarn(''); };
  const clickCell = (s: Sq) => {
    if (done) return;
    const here = pieces.find((p) => p.alive && same(p.at, s));
    if (here && here.color === 'white') { setPicked(here.id); return; }
    if (picked && targets.some((t) => same(t, s))) setPrompt(`${picked} を ${sqName(s)} へ`);
  };

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-6xl space-y-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>フィジカルプロンプトチェス · 3 ゲーム目</span>
          <span className="flex gap-3"><button type="button" onClick={reset} className="underline">最初から</button><Link href="/lab/prompt-chess" className="underline">プロンプトチェス（基本）</Link><Link href="/mente/game" className="underline">タイトルへ</Link></span>
        </p>
        <header className="border-b border-stone-200 pb-2">
          <h1 className="text-lg">チョークの部屋 — ニュースを解体して、調和を探す</h1>
          <p className="border-l-4 border-[#c8001a] pl-2 text-xs" data-testid="rule">決まり：すべての手は、<strong>デバイスかメタ視点からのプロンプト</strong>で進む。何も、ひとりでには動かない。</p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-2" aria-label="ニュースの解体" data-testid="news">
            <p className="text-[11px] text-stone-500">{done ? 'すべてのターンが終わった' : `ターン ${turn + 1} / ${TURNS} · NEWS`}</p>
            {!done && <>
              <p className="text-base font-semibold">「{news.headline}」</p>
              <div className="flex flex-wrap gap-2">{news.parts.map((p) => <span key={p.label} className="border px-2 py-0.5 text-xs" style={{ borderColor: FILTER_COLOR[p.filter], color: FILTER_COLOR[p.filter] }}>{p.label}：{p.text}<span className="ml-1 text-[10px]">［{p.filter}］</span></span>)}</div>
              <div className="grid gap-1 sm:grid-cols-3" data-testid="posts">{news.posts.map((p) => <div key={p.handle} className="border border-stone-200 bg-[#fafaf9] p-2 text-[11px]"><p className="text-stone-500">▶ {p.handle} · {p.views}</p><p>{p.text}</p><p className="text-[10px]" style={{ color: FILTER_COLOR[p.kind] }}>［{p.kind}］</p></div>)}</div>
              <p className="text-[11px] text-stone-600">事実のフィルターに強い駒：{Object.values(PEOPLE).filter((p) => p.filter === '事実').map((p) => p.name).join('・')} ／ 噂：{Object.values(PEOPLE).filter((p) => p.filter === '噂').map((p) => p.name).join('・')} ／ 感情：{Object.values(PEOPLE).filter((p) => p.filter === '感情').map((p) => p.name).join('・')}</p>
            </>}

            <svg viewBox={`0 0 ${FLOOR_W * FLOORS} ${SIZE * CELL + PAD * 2 + 14}`} className="w-full rounded bg-[#2f2f2f]" aria-label="チョークで描いた 3 つの階" data-testid="board">
              {Array.from({ length: FLOORS }, (_, f) => (
                <g key={f} transform={`translate(${f * FLOOR_W + PAD} ${PAD})`}>
                  <text x={0} y={-8} fontSize={11} fill="#f5f5f4" opacity={0.8}>{['1 階 ロビー', '2 階 トレーディングフロア', '3 階 屋上'][f]}</text>
                  {Array.from({ length: SIZE + 1 }, (_, k) => <g key={k}><line x1={k * CELL} x2={k * CELL} y1={0} y2={SIZE * CELL} stroke="#f5f5f4" strokeOpacity={0.35} strokeDasharray="5 2 1 2" /><line y1={k * CELL} y2={k * CELL} x1={0} x2={SIZE * CELL} stroke="#f5f5f4" strokeOpacity={0.35} strokeDasharray="5 2 1 2" /></g>)}
                  {ROOMS.filter((r) => r.f === f).map((r) => <text key={r.name} x={r.x * CELL + 3} y={(SIZE - 1 - r.y) * CELL + CELL - 4} fontSize={8} fill="#f5f5f4" opacity={0.65}>{r.name}</text>)}
                  {Array.from({ length: SIZE * SIZE }, (_, k) => { const s = { x: k % SIZE, y: Math.floor(k / SIZE), f }; const tgt = targets.some((t) => same(t, s)); return <rect key={k} x={s.x * CELL} y={(SIZE - 1 - s.y) * CELL} width={CELL} height={CELL} fill={tgt ? '#f5f5f41a' : 'transparent'} stroke={tgt ? '#fde68a' : 'none'} strokeDasharray="3 3" onClick={() => clickCell(s)} style={{ cursor: 'pointer' }} />; })}
                  {pieces.filter((p) => p.alive && p.at.f === f).map((p) => (
                    <g key={p.id} transform={`translate(${p.at.x * CELL + CELL / 2} ${(SIZE - 1 - p.at.y) * CELL + CELL / 2})`} onClick={() => clickCell(p.at)} style={{ cursor: p.color === 'white' ? 'pointer' : 'default' }} data-testid={`piece-${p.id}`}>
                      <circle r={14} fill={p.color === 'white' ? '#f5f5f4' : '#1f1f1f'} stroke={picked === p.id ? '#fde68a' : '#f5f5f4'} strokeWidth={picked === p.id ? 3 : 1.2} />
                      <text y={4} textAnchor="middle" fontSize={10} fill={p.color === 'white' ? '#1f1f1f' : '#f5f5f4'}>{PEOPLE[p.id].name.slice(0, 2)}</text>
                      <title>{`${p.id} ${PEOPLE[p.id].name}（${PEOPLE[p.id].role}）· ${PEOPLE[p.id].attire}`}</title>
                    </g>
                  ))}
                </g>
              ))}
            </svg>
            <p className="text-[10px] text-stone-500">白：アクティブギャング（あなた）· 黒：サンクチュアリ（画面）。白い駒を押すと、跳べる区画がチョークの点線で出ます。区画を押すとプロンプトの下書きが入ります（送るのは、デバイスから）。</p>
          </section>

          <aside className="space-y-2" aria-label="プロンプト">
            <p className="text-xs font-semibold">プロンプトを送るデバイス</p>
            <div className="grid grid-cols-2 gap-1 text-xs">{DEVICES.map((d) => <button key={d.id} type="button" data-testid={`dev-${d.id}`} onClick={() => setDevice(d.id)} className="border px-2 py-1 text-left" style={{ borderColor: device === d.id ? '#c8001a' : '#d6d3d1', background: device === d.id ? '#fff1f2' : 'white' }}>{d.icon} {d.name}</button>)}</div>
            {device === 'ariel' && <label className="block text-xs">エーリアル <input type="number" min={1} max={22} value={camera} onChange={(e) => setCamera(Math.max(1, Math.min(22, Number(e.target.value) || 1)))} className="w-14 border border-stone-400 px-1" /> / 22 から見る</label>}
            <textarea data-testid="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="例：W1 を c3@2F へ" className="w-full border border-stone-400 bg-white px-2 py-1 text-sm text-[#1f1f1f]" disabled={done} />
            <button type="button" data-testid="send" onClick={send} disabled={done} className="w-full border border-[#1f1f1f] bg-[#1f1f1f] py-1.5 text-sm text-white disabled:opacity-40">送る</button>
            {warn && <p className="text-[11px] text-[#c8001a]" role="alert" data-testid="warn">{warn}</p>}
            <p className="text-sm" data-testid="harmony">調和：{harmony}</p>
            {done && <p className="border border-stone-200 bg-[#fafaf9] p-2 text-xs" data-testid="end">六つのニュースを解体した。調和は {harmony}。同じ出来事を、違うデバイスで読むほど、ぶつからずに並べる。</p>}
          </aside>
        </div>

        <section className="space-y-2" aria-label="記録" data-testid="log">
          {log.map((e) => (
            <div key={e.turn} className="border-l-4 pl-3 text-xs" style={{ borderColor: e.harmony > 0 ? '#2f6b1a' : e.harmony < 0 ? '#c8001a' : '#d6d3d1' }}>
              <p className="font-semibold">ターン {e.turn}</p>
              {e.lines.map((l) => <p key={l.side}>{l.side} · {l.device}：「{l.prompt}」 → {l.why}</p>)}
              {e.events.map((ev, k) => <p key={k} className="text-stone-600">・{ev.text}</p>)}
              {e.acts.map((a) => <p key={a} className="text-stone-600">{a}</p>)}
              <p style={{ color: e.harmony > 0 ? '#2f6b1a' : e.harmony < 0 ? '#c8001a' : '#57534e' }}>{e.note}</p>
            </div>
          ))}
        </section>
        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">架空の会社・人物・投稿・数字です。再生回数は値段ではありません。売り買いのすすめや賭けはありません。</footer>
      </div>
    </main>
  );
}
