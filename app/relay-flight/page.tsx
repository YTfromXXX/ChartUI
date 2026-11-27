'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Die3D from '@/components/relay/Die3D';
import FlightMap from '@/components/relay/FlightMap';
import SceneFlash from '@/components/relay/SceneFlash';
import { download } from '@/lib/menteExport';
import {
  ARCHETYPES, BOARD_LEN, SEATS, TRAITS, archetypeCounts, bodyOf, butLine, captainLine, catLine, headOf, makeBoard, optionText, shuffledDeck, tally,
  type Archetype, type OwOption, type OwQuestion, type Player, type Vehicle, type World,
} from '@/lib/relayFlight';
import { sceneSpec } from '@/lib/sceneSpec';

type Phase = 'setup' | 'roll' | 'question' | 'comment' | 'booth' | 'end';
type Comment = { who: '機長' | 'パーサー' | '窓際の猫'; text: string };
const ARCH_COLOR: Record<Archetype, string> = { '攻撃/革新': '#ef4444', '調和/保守': '#22c55e', '論理/分析': '#38bdf8', '情緒/美学': '#e879f9' };
const PAX = ['#f87171', '#60a5fa', '#facc15', '#a78bfa'];

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return undefined; }
    setN(0); const id = window.setInterval(() => setN((k) => { if (k >= text.length) { window.clearInterval(id); return k; } return k + 2; }), 22);
    return () => window.clearInterval(id);
  }, [text]);
  return <>{text.slice(0, n)}<span className="sr-only">{text.slice(n)}</span></>;
}

/**
 * Relay sugoroku on a night flight. Passengers take turns: roll a die, fly along the in-flight
 * map, and the square's scenario appears at once through the window (TEXT → picture in one frame,
 * with a traced outline of the subject). Each answer gets a "〜だけれど" line from the commentary
 * booth, handed to the next passenger as the baton.
 */
export default function RelayFlightPage() {
  const [data, setData] = useState<Map<number, OwQuestion> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [vehicle, setVehicle] = useState<Vehicle>('plane');
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [current, setCurrent] = useState(0);
  const [deck, setDeck] = useState<number[]>([]);
  const [deckPos, setDeckPos] = useState(0);
  const [die, setDie] = useState({ value: 1, spin: 0 });
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState<{ q: OwQuestion; world: World; square: number } | null>(null);
  const [baton, setBaton] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [prediction, setPrediction] = useState<{ by: number; archetype: Archetype } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [renderMs, setRenderMs] = useState<number[]>([]);
  const [announce, setAnnounce] = useState('');
  const board = useMemo(() => makeBoard(vehicle), [vehicle]);
  const live = useRef({ phase, rolling });
  live.current = { phase, rolling };

  useEffect(() => {
    fetch('/data/ow_data.json').then((r) => r.json()).then((j: { questions: OwQuestion[] }) => setData(new Map(j.questions.map((q) => [q.id, q])))).catch(() => setLoadError('質問データを読み込めませんでした'));
  }, []);

  const start = () => {
    setPlayers(Array.from({ length: count }, (_, i) => ({ seat: SEATS[i], name: names[i].trim() || `${SEATS[i]}席`, pos: 0, answers: [], predictions: [] })));
    setDeck(shuffledDeck(Date.now() % 1e9)); setDeckPos(0); setCurrent(0); setBaton(''); setPrediction(null); setTurn(null); setRenderMs([]);
    setComments([{ who: '機長', text: vehicle === 'plane' ? 'ご搭乗ありがとうございます。本日はイスタンブール発、ワンダーランド行きの夜間便です。' : '相乗りバス、イスタンブール発ワンダーランド行き、まもなく発車します。' }]);
    setPhase('roll');
  };

  const roll = useCallback(() => {
    if (live.current.phase !== 'roll' || live.current.rolling || !data) return;
    const n = 1 + Math.floor(Math.random() * 6);
    setRolling(true); setDie((d) => ({ value: n, spin: d.spin + 1 }));
    window.setTimeout(() => {
      setRolling(false);
      const me = players[current];
      let pos = Math.min(BOARD_LEN - 1, me.pos + n); const landed = board[pos]; let effect = '';
      if (landed.kind === 'tailwind') { pos = Math.min(BOARD_LEN - 1, pos + 3); effect = vehicle === 'plane' ? '追い風に乗って 3 マス先へ。' : '青信号が続いて 3 つ先へ。'; }
      if (landed.kind === 'turbulence') { pos = Math.max(0, pos - 2); effect = vehicle === 'plane' ? '乱気流です。シートベルト着用サインが点灯、2 マス戻ります。' : '渋滞です。2 つ戻ります。'; }
      const sq = board[pos];
      setPlayers((ps) => ps.map((p, i) => (i === current ? { ...p, pos } : p)));
      const cap = captainLine(vehicle, me.name, sq, n, effect);
      setAnnounce(`${me.name}、サイコロは ${n}。${sq.name}。${effect}`);
      if (sq.kind === 'goal') { setComments([{ who: '機長', text: `${cap} ${vehicle === 'plane' ? '当機はまもなく着陸します。' : '終点です。'}${me.name}さんが最初に到着しました。` }]); setPhase('end'); return; }
      if (landed.kind === 'booth') {
        setComments([{ who: '機長', text: `${cap} ${me.name}さん、実況席へどうぞ。次の${players[(current + 1) % players.length].name}さんの答えを予想してください。` }]);
        setPhase('booth'); return;
      }
      const q = data.get(deck[deckPos % deck.length])!; setDeckPos((k) => k + 1);
      setTurn({ q, world: sq.world, square: pos }); setShowOriginal(false);
      setComments([{ who: '機長', text: cap }]);
      setPhase('question');
    }, 750);
  }, [data, players, current, board, vehicle, deck, deckPos]);

  const answer = useCallback((o: OwOption) => {
    if (live.current.phase !== 'question' || !turn) return;
    const me = players[current];
    const line = butLine(me.name, turn.q, turn.world, o, me.answers[me.answers.length - 1]);
    let cat = catLine(o.archetype, turn.q.id);
    let ps = players.map((p, i) => (i === current ? { ...p, answers: [...p.answers, { qid: turn.q.id, world: turn.world, option: o, square: turn.square }] } : p));
    if (prediction && prediction.by !== current) {
      const hit = prediction.archetype === o.archetype;
      ps = ps.map((p, i) => (i === prediction.by ? { ...p, predictions: [...p.predictions, { hit }] } : p));
      cat = `${players[prediction.by].name}の予想（${prediction.archetype}）は${hit ? '当たった' : '外れた'}にゃ。${cat}`;
      setPrediction(null);
    }
    setPlayers(ps); setBaton(line);
    setComments((c) => [c[0], { who: 'パーサー', text: line }, { who: '窓際の猫', text: cat }]);
    setAnnounce(line);
    setPhase('comment');
  }, [turn, players, current, prediction]);

  const predict = (a: Archetype) => {
    if (phase !== 'booth') return;
    setPrediction({ by: current, archetype: a });
    setComments((c) => [c[0], { who: 'パーサー', text: `${players[current].name}さんは「${a}」と予想。だけれど、人は予想どおりには答えない。` }]);
    next();
  };
  const next = () => { setCurrent((i) => (i + 1) % players.length); setTurn(null); setPhase('roll'); };

  // Keyboard: Space / Enter rolls or passes the baton; 1–4 answer or predict.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLInputElement | null; if (el?.tagName === 'INPUT' && el.type === 'text') return;
      if (el?.tagName === 'INPUT' && e.key === ' ') el.blur();
      if (e.key === ' ' || e.key === 'Enter') { if (phase === 'roll') { e.preventDefault(); roll(); } else if (phase === 'comment') { e.preventDefault(); next(); } }
      const k = Number(e.key);
      if (k >= 1 && k <= 4) { if (phase === 'question' && turn) answer(turn.q.options[k - 1]); if (phase === 'booth') predict(ARCHETYPES[k - 1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const spec = useMemo(() => {
    if (turn) { const sc = turn.q.scenarios[turn.world]; return sceneSpec(`${sc.title} ${sc.theme} ${sc.description}`, turn.world); }
    const sq = board[players[current]?.pos ?? 0];
    return sceneSpec(sq.name, sq.world);
  }, [turn, board, players, current]);
  const onTiming = useCallback((ms: number) => setRenderMs((r) => [...r.slice(-19), ms]), []);

  const saveResults = () => download('relay-flight.json', JSON.stringify({
    note: '性格を判定しない遊び。質問は性格テストの項目を物語に置き換えたデータ（ow_data.json）。',
    vehicle, players: players.map((p) => ({ seat: p.seat, name: p.name, answers: p.answers.map((a) => ({ qid: a.qid, world: a.world, option: a.option.id, archetype: a.option.archetype })), traits: tally(p.answers), predictions: p.predictions })),
  }, null, 2), 'application/json');

  const me = players[current];
  const glass = 'rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur';
  const avg = renderMs.length ? renderMs.reduce((a, b) => a + b, 0) / renderMs.length : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1b2a44,#05070d_70%)] px-4 py-5 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-cyan-300/80">RELAY SUGOROKU · NIGHT FLIGHT</p>
            <h1 className="text-2xl font-semibold">リレーすごろく · {vehicle === 'plane' ? '夜間飛行' : '相乗りバス'}</h1>
            <p className="text-xs text-slate-400">200 問 × 2 つの世界（オスマンの細密画工房／不思議の国）。答えるたびに実況席が「〜だけれど」と返し、その一言が次の人へのバトンになる。</p>
          </div>
          <nav className="flex gap-2 text-xs"><Link href="/cure-api" className={`${glass} px-3 py-1`}>Cure-API</Link><Link href="/mente" className={`${glass} px-3 py-1`}>Mente</Link></nav>
        </header>
        <p aria-live="polite" className="sr-only" data-testid="announce">{announce}</p>

        {phase === 'setup' && (
          <section aria-label="Setup" className={`${glass} space-y-3 p-4`}>
            {loadError && <p role="alert" className="text-red-400">{loadError}</p>}
            <p className="text-sm">{data ? `質問データ ${data.size} 問を読み込みました。` : '質問データを読み込み中…'}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>乗り物</span>
              {(['plane', 'bus'] as const).map((v) => <button key={v} type="button" aria-pressed={vehicle === v} onClick={() => setVehicle(v)} className={`rounded-full border px-3 py-1 ${vehicle === v ? 'border-cyan-300 bg-cyan-300/20' : 'border-white/20'}`}>{v === 'plane' ? '飛行機（夜間便）' : '相乗りバス'}</button>)}
              <span className="ml-4">乗客</span>
              {[1, 2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`h-8 w-8 rounded-full border ${count === n ? 'border-cyan-300 bg-cyan-300/20' : 'border-white/20'}`}>{n}</button>)}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {Array.from({ length: count }, (_, i) => (
                <label key={SEATS[i]} className="flex items-center gap-2 text-sm"><span className="rounded px-1.5 font-mono text-black" style={{ background: PAX[i] }}>{SEATS[i]}</span>
                  <input aria-label={`Name ${SEATS[i]}`} value={names[i]} maxLength={10} onChange={(e) => setNames((ns) => ns.map((x, j) => (j === i ? e.target.value : x)))} placeholder="呼び名（任意）" className="min-w-0 flex-1 rounded border border-white/20 bg-black/30 px-2 py-1" /></label>
              ))}
            </div>
            <p className="text-xs text-slate-400">元の質問は性格テストの項目を物語に置き換えたもの。この遊びは性格を判定しない。答えは端末の中だけにあり、保存するかどうかは自分で決める。</p>
            <button type="button" disabled={!data} onClick={start} className="rounded-lg bg-[#d6001c] px-5 py-2 font-semibold disabled:opacity-40">搭乗する</button>
          </section>
        )}

        {phase !== 'setup' && (
          <>
            <FlightMap board={board} players={players} current={current} vehicle={vehicle} />
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-3 lg:col-span-3">
                <SceneFlash spec={spec} vehicle={vehicle} onTiming={onTiming} />
                {phase === 'question' && turn && (
                  <section aria-label="Question" className={`${glass} space-y-2 p-3`}>
                    {baton && <p className="border-l-2 border-[#d6001c] pl-2 text-xs italic text-slate-300" data-testid="baton">前の席から受け取ったバトン：{baton}</p>}
                    <p className="text-[10px] tracking-[0.3em] text-cyan-300/80">{turn.world === 'ottoman' ? 'OTTOMAN · 細密画工房' : 'WONDERLAND · 不思議の国'} · Q{turn.q.id}</p>
                    <h2 className="text-lg font-semibold" data-testid="q-title">{turn.q.scenarios[turn.world].title}</h2>
                    <p className="text-sm leading-relaxed text-slate-200">{turn.q.scenarios[turn.world].description}</p>
                    <label className="flex items-center gap-1 text-xs text-slate-400"><input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} /> 物語の下にある元の質問を見る</label>
                    {showOriginal && <p className="rounded bg-black/40 px-2 py-1 text-xs" data-testid="original">{turn.q.original_oca_question}</p>}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {turn.q.options.map((o, i) => (
                        <button key={o.id} type="button" onClick={() => answer(o)} className="rounded-lg border border-white/15 bg-black/30 p-2 text-left text-xs hover:border-white/40">
                          <span className="mb-1 flex items-center gap-2"><kbd className="rounded bg-white/10 px-1 font-mono">{i + 1}</kbd><span className="font-semibold" style={{ color: ARCH_COLOR[o.archetype] }}>「{headOf(optionText(o, turn.world))}」</span></span>
                          <span className="text-slate-300">{bodyOf(optionText(o, turn.world))}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {phase === 'booth' && (
                  <section aria-label="Booth" className={`${glass} space-y-2 p-3`}>
                    <p className="text-sm">実況席に招かれました。次の人は、どの答えを選ぶと思う？</p>
                    <div className="flex flex-wrap gap-2">{ARCHETYPES.map((a, i) => <button key={a} type="button" onClick={() => predict(a)} className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: ARCH_COLOR[a] }}><kbd className="mr-1 font-mono text-xs">{i + 1}</kbd>{a}</button>)}</div>
                  </section>
                )}
              </div>

              <aside className="space-y-3 lg:col-span-2">
                <section aria-label="Turn" className={`${glass} flex items-center gap-4 p-3`}>
                  <Die3D value={die.value} spin={die.spin} />
                  <div className="space-y-1">
                    {me && <p className="text-sm"><span className="rounded px-1.5 font-mono text-black" style={{ background: PAX[current] }}>{me.seat}</span> {me.name} の番</p>}
                    {phase === 'roll' && <button type="button" onClick={roll} disabled={rolling} className="rounded-lg bg-[#d6001c] px-4 py-1.5 font-semibold disabled:opacity-50">サイコロ（Space）</button>}
                    {phase === 'comment' && <button type="button" onClick={next} className="rounded-lg border border-white/30 px-4 py-1.5 font-semibold">バトンを渡す（Space）</button>}
                    <p className="font-mono text-[10px] text-slate-400" data-testid="render-ms">TEXT → 絵：平均 {avg.toFixed(1)} ms（{renderMs.length} 枚）</p>
                  </div>
                </section>
                <section aria-label="Commentary booth" className={`${glass} space-y-2 p-3`}>
                  <p className="text-[10px] tracking-[0.3em] text-cyan-300/80">COMMENTARY BOOTH · 実況席{vehicle === 'plane' ? '（最前列）' : '（運転席の後ろ）'}</p>
                  {comments.map((c, i) => (
                    <div key={`${c.who}-${i}`} className="flex gap-2" data-testid={`comment-${c.who}`}>
                      <span className="mt-0.5 h-fit shrink-0 rounded bg-white/10 px-1.5 text-[10px]">{c.who}</span>
                      <p className="text-sm leading-snug"><Typewriter text={c.text} /></p>
                    </div>
                  ))}
                </section>
                <section aria-label="Cabin" className={`${glass} p-3`}>
                  <p className="mb-1 text-[10px] tracking-[0.3em] text-cyan-300/80">CABIN · 乗客</p>
                  <div className="grid grid-cols-2 gap-2">
                    {players.map((p, i) => (
                      <div key={p.seat} className={`rounded-lg border p-2 text-xs ${i === current ? 'border-white/50 bg-white/10' : 'border-white/10'}`}>
                        <p><span className="rounded px-1 font-mono text-black" style={{ background: PAX[i] }}>{p.seat}</span> {p.name}</p>
                        <p className="text-slate-400">{board[p.pos].name} · 回答 {p.answers.length}</p>
                        <div className="mt-1 flex h-1.5 overflow-hidden rounded bg-white/10">{ARCHETYPES.map((a) => { const c = archetypeCounts(p.answers)[a]; return c ? <span key={a} style={{ flex: c, background: ARCH_COLOR[a] }} /> : null; })}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}

        {phase === 'end' && (
          <section aria-label="Results" className={`${glass} space-y-3 p-4`}>
            <h2 className="text-lg font-semibold">{vehicle === 'plane' ? '着陸しました' : '終点です'} · 乗客それぞれの航跡</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {players.map((p, i) => {
                const t = tally(p.answers); const max = Math.max(1, ...Object.values(t).map(Math.abs));
                return (
                  <div key={p.seat} className="rounded-lg border border-white/10 p-3 text-xs" data-testid={`result-${p.seat}`}>
                    <p className="text-sm"><span className="rounded px-1 font-mono text-black" style={{ background: PAX[i] }}>{p.seat}</span> {p.name} · 回答 {p.answers.length} · 予想 {p.predictions.filter((x) => x.hit).length}/{p.predictions.length} 的中</p>
                    <div className="mt-2 space-y-0.5">
                      {TRAITS.map((k) => (
                        <div key={k} className="flex items-center gap-2"><span className="w-10 font-mono text-slate-400">軸 {k}</span>
                          <div className="relative h-2 flex-1 rounded bg-white/5"><span className="absolute top-0 h-2 rounded" style={{ left: t[k] < 0 ? `${50 + (t[k] / max) * 50}%` : '50%', width: `${(Math.abs(t[k]) / max) * 50}%`, background: t[k] < 0 ? '#60a5fa' : '#f87171' }} /><span className="absolute left-1/2 top-[-2px] h-3 w-px bg-white/30" /></div>
                          <span className="w-8 text-right font-mono">{t[k].toFixed(1)}</span></div>
                      ))}
                    </div>
                    <p className="mt-2 text-slate-300">{ARCHETYPES.map((a) => `${a} ${archetypeCounts(p.answers)[a]}`).join(' · ')}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">軸 A〜J はデータの重みを足しただけの数字で、性格や能力の判定ではない。同じ人でも、世界（オスマン／不思議の国）や前の人のバトンで答えは変わる。</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveResults} className="rounded-lg bg-[#d6001c] px-4 py-1.5 font-semibold">航跡を保存（JSON）</button>
              <button type="button" onClick={() => setPhase('setup')} className="rounded-lg border border-white/30 px-4 py-1.5">もう一度搭乗する</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
