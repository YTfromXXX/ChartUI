'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { DEVICES, PEOPLE, ROOMS, sideName, type Filter, type Look, type News, type Scene } from '@/lib/chessGame3';
import { FLOORS, SIZE, cpuPrompt, initialPieces, legalMoves, parsePrompt, resolveTurn, same, sqName, type Color, type Piece, type Sq, type TurnEvent } from '@/lib/promptChess';
import { keccak256 } from '@/lib/meshMetaV2';
import { BRAIN_RULE, drift, faultChance, floorSlip, interceptor, newsPrint, parseFree, randomMove } from '@/lib/chessWild';
import { MENTE_CARDS } from '@/lib/menteCards';
import { curated, sparkPath, symbolAt, symbolFromPost, type Sym, type Theme } from '@/lib/syntheticSymbols';

/** 住まい symbols and the Sanctuary resident each one suits: together they count double and forge a key fragment. */
const DWELLING_MATCH: Record<string, string> = { 定住指数: 'B3', 近所の返信率: 'B3', 庭の手入れ指数: 'B1', 窓の灯り指数: 'B4', 朝と夜の投稿の幅: 'B2', 同じ景色の写真の数: 'B2' };
const enc = new TextEncoder();
const hex4 = (s: string) => Array.from(keccak256(enc.encode(s)).slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
type KeyFragment = { hex: string; prev: string; ticker: string; who: string; turn: number };
/** The mirage room: a corner of the lobby that can be seen but not entered (Stoic hides there). */
const MIRAGE: Sq[] = [{ x: 4, y: 4, f: 0 }, { x: 3, y: 4, f: 0 }];
const inMirage = (s: Sq) => MIRAGE.some((m) => same(m, s));

const FILTER_COLOR: Record<Filter, string> = { 事実: '#1f1f1f', 噂: '#2b3a67', 感情: '#c8001a' };
const CELL = 40; const PAD = 22; const FLOOR_W = SIZE * CELL + PAD * 2;
const THEME_ROOM: Record<Theme, string> = { ホテル: '窓（港）', 港: '受付', 準備の金庫: '金庫室', 温室: '温室の入口', 動画: '動画の壁', 鉄道: '帳簿の部屋', 住まい: '庭', ミーム: '動画の壁' };
type LogEntry = { turn: number; lines: { side: string; device: string; prompt: string; why: string }[]; events: TurnEvent[]; acts: string[]; harmony: number; notes: string[] };

/** A stiff mannequin figure (head, torso, arms at fixed angles) — original, simple shapes. */
function Mannequin({ x, name, k }: { x: number; name: string; k: number }) {
  const arm = [-35, 20, -10, 45][k % 4];
  return (
    <g transform={`translate(${x} 0)`}>
      <circle cx={0} cy={22} r={9} fill="#d9cbb6" stroke="#8a7a63" />
      <path d="M-11 34h22l-4 34h-14z" fill="#d9cbb6" stroke="#8a7a63" />
      <line x1={-11} y1={38} x2={-11 - 16 * Math.cos((arm * Math.PI) / 180)} y2={38 + 16 * Math.sin((arm * Math.PI) / 180)} stroke="#8a7a63" strokeWidth={4} strokeLinecap="round" />
      <line x1={11} y1={38} x2={27} y2={44} stroke="#8a7a63" strokeWidth={4} strokeLinecap="round" />
      <line x1={-5} y1={68} x2={-6} y2={92} stroke="#8a7a63" strokeWidth={5} /><line x1={5} y1={68} x2={6} y2={92} stroke="#8a7a63" strokeWidth={5} />
      <text x={0} y={106} fontSize={9} textAnchor="middle" fill="#57534e">{name}</text>
    </g>
  );
}

/** The turn's scene: mannequin still frames (cut, never faded) or ad-realism, frame by frame. */
function ScenePanel({ scene }: { scene: Scene }) {
  const [k, setK] = useState(0);
  const frame = scene.frames[Math.min(k, scene.frames.length - 1)];
  const look: Look = frame.style ?? (scene.style === 'switch' ? 'mannequin' : scene.style);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || k >= scene.frames.length - 1) return undefined;
    const t = window.setTimeout(() => setK((x) => x + 1), 3600); return () => window.clearTimeout(t);
  }, [k, scene]);
  const speakers = frame.lines.map(([w]) => w.replace(/（.*）/, ''));
  return (
    <div className="space-y-1" data-testid="scene" data-look={look}>
      {look === 'mannequin' ? (
        <div className="border border-[#d6c9b4] bg-[#efe7dc]">
          <svg viewBox="0 0 360 112" className="h-28 w-full" aria-label="マネキンの止まった絵">{(speakers.length ? speakers : ['', '', '']).map((n, i, a) => <Mannequin key={i} k={k + i} x={(360 / (a.length + 1)) * (i + 1)} name={n} />)}</svg>
          <p className="px-3 text-[11px] italic text-stone-600">{frame.pose}</p>
          <div className="mt-1 space-y-0.5 bg-black/80 px-3 py-1.5 text-center text-sm text-white" data-testid="captions">{frame.lines.length ? frame.lines.map(([w, t]) => <p key={t}>{w}「{t}」</p>) : <p className="text-white/60">（無言）</p>}</div>
        </div>
      ) : (
        <div className="space-y-2 rounded-md bg-white p-3 shadow-[0_2px_14px_#0000001a] ring-1 ring-stone-200">
          <p className="text-[11px] text-stone-500">{frame.pose}</p>
          {frame.lines.map(([w, t]) => <p key={t} className="text-sm"><span className="mr-2 font-semibold">{w}</span>「{t}」</p>)}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-stone-500">
        <span>{look === 'mannequin' ? 'マネキン形式' : '広告リアリズム形式'} · 絵 {Math.min(k, scene.frames.length - 1) + 1} / {scene.frames.length}</span>
        {k < scene.frames.length - 1 && <button type="button" data-testid="next-frame" onClick={() => setK((x) => x + 1)} className="border border-stone-400 px-2">次の絵 ▶</button>}
      </div>
    </div>
  );
}

/** Endless strip of synthetic symbols (loads 12 more whenever its end scrolls into view). */
function SymbolStrip({ prefer, held, onHold, groups }: { prefer?: Theme; held: Sym | null; onHold: (s: Sym | null) => void; groups: { label: string; syms: Sym[] }[] }) {
  const extra = groups.flatMap((g) => g.syms); const starts = new Map<number, string>(); let at = 0; for (const g of groups) { if (g.syms.length) starts.set(at, g.label); at += g.syms.length; }
  const [count, setCount] = useState(12);
  const box = useRef<HTMLDivElement>(null); const end = useRef<HTMLDivElement>(null);
  const syms = useMemo(() => Array.from({ length: count }, (_, i) => symbolAt(i, prefer)), [count, prefer]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setCount((c) => Math.min(600, c + 12)); }, { root: box.current, rootMargin: '120px' });
    if (end.current) io.observe(end.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">合成の銘柄（無限スクロール）</p>
      <p className="text-[10px] text-stone-500">駒かチームへドラッグ＆ドロップ。押して持ってから、駒やチームを押しても渡せる。</p>
      <div ref={box} className="h-[26rem] space-y-1 overflow-y-auto border border-stone-200 p-1" data-testid="symbols" aria-label="合成の銘柄の列">
        {[...extra, ...syms].map((s, n) => (<Fragment key={`${s.i}-${n}`}>
          {starts.has(n) && <p className="px-1 pt-1 text-[10px] font-semibold text-[#2b3a67]" data-testid={n === 0 ? 'post-symbols' : undefined}>{starts.get(n)}</p>}
          {n === extra.length && extra.length > 0 && <p className="px-1 pt-1 text-[10px] font-semibold text-stone-500">ほかの合成の銘柄</p>}
          <button type="button" draggable data-testid={`sym-${s.i}`} onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(s.i)); onHold(s); }} onClick={() => onHold(held?.i === s.i ? null : s)}
            className="flex w-full items-center gap-2 border px-1.5 py-1 text-left text-[11px]" style={{ borderColor: held?.i === s.i ? '#c8001a' : '#e7e5e4', background: held?.i === s.i ? '#fff1f2' : 'white' }}>
            <span className="w-11 font-semibold">{s.ticker}</span>
            <svg viewBox="0 0 80 22" className="h-5 w-16 shrink-0" aria-hidden><path d={sparkPath(s.series)} fill="none" stroke={s.signal === '上向きの交差' ? '#2f6b1a' : s.signal === '下向きの交差' ? '#c8001a' : '#78716c'} strokeWidth={1.2} /></svg>
            <span className="min-w-0 flex-1 truncate">{s.name}<br /><span className="text-stone-500">{s.theme} · {s.signal} · ［{s.filter}］</span></span>
          </button>
        </Fragment>))}
        <div ref={end} className="py-2 text-center text-[10px] text-stone-400">…まだ続く…</div>
      </div>
    </div>
  );
}

export type ChalkRoomProps = { gameNo: number; title: string; news: News[]; prefer?: Theme; allowArchitect?: boolean; intro?: string; attention?: boolean };

/** The chalk-room chess game, shared by game 1 (hotels) and game 3 (SNS). Every move comes from a device or a meta view. */
export default function ChalkRoomGame({ gameNo, title, news: NEWS, prefer, allowArchitect, intro, attention: showAttention }: ChalkRoomProps) {
  const TURNS = NEWS.length;
  const [side, setSide] = useState<Color>('white');
  const [pieces, setPieces] = useState<Piece[]>(() => initialPieces());
  const [turn, setTurn] = useState(0);
  const [device, setDevice] = useState<string | null>(null);
  const [camera, setCamera] = useState(7);
  const [prompt, setPrompt] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [harmony, setHarmony] = useState(0);
  const [warn, setWarn] = useState('');
  const [held, setHeld] = useState<Sym | null>(null);
  const [badges, setBadges] = useState<Record<string, Sym>>({});
  const [focus, setFocus] = useState<Partial<Record<Color, Sym>>>({});
  const [keys, setKeys] = useState<KeyFragment[]>([]);
  const [attention, setAttention] = useState(0);
  // Bold mode: device faults, tampering with the news, insider-like peeking, and a turn timer.
  const [wild, setWild] = useState(true);
  const [noise, setNoise] = useState(0);
  const [tamper, setTamper] = useState<Record<number, Filter>>({});
  const [peeked, setPeeked] = useState(false);
  const [frozen, setFrozen] = useState<string[]>([]);
  const [fast, setFast] = useState(false);
  const [left, setLeft] = useState(20);
  // Long-press on Ariel's meta view: Ariel advises hiding the architect banner behind a short LINK device.
  const [arielHint, setArielHint] = useState(false);
  // The drone's question from the sky: answer it right to earn one right to intervene (fix one news part without the audit).
  const [right, setRight] = useState(false);
  const [approved, setApproved] = useState<number | null>(null);
  const [skyTried, setSkyTried] = useState(-1);
  const [skyMsg, setSkyMsg] = useState('');
  const [cards, setCards] = useState(0);
  const press = useRef<number | null>(null);
  const longPress = { onPointerDown: () => { press.current = window.setTimeout(() => setArielHint(true), 600); }, onPointerUp: () => { if (press.current) window.clearTimeout(press.current); }, onPointerLeave: () => { if (press.current) window.clearTimeout(press.current); }, onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setArielHint(true); } };
  const [aligned, setAligned] = useState(0);
  const rnd = useRef(() => Math.random());
  const done = turn >= TURNS;
  const news = NEWS[Math.min(turn, TURNS - 1)];
  const foe: Color = side === 'white' ? 'black' : 'white';
  const targets = useMemo(() => { const p = pieces.find((q) => q.id === picked); return p ? legalMoves(p, pieces).filter((t) => !inMirage(t)) : []; }, [picked, pieces]);
  const postSyms = useMemo(() => (done ? [] : news.posts.map((p) => symbolFromPost(p.handle, p.kind, news.theme ?? '住まい'))), [news, done]);
  const lookup = (i: number) => postSyms.find((s) => s.i === i) ?? symbolAt(i, prefer);
  // BA 🐵 and PE 🫛 drum in the live feed when a 四つ打ち / meme coin is dropped or its holder moves (one beat every 0.5 s).
  const [beats, setBeats] = useState<{ who: string; text: string; k: number }[]>([]);
  const beatTimers = useRef<number[]>([]);
  useEffect(() => () => beatTimers.current.forEach((t) => window.clearTimeout(t)), []);
  const drum = (s: Sym, why: string) => {
    if (s.theme !== 'ミーム') return;
    const line = [{ who: '🐵 BA-80BF', text: 'ドン' }, { who: '🫛 PE-05F0', text: 'ぱ' }, { who: '🐵 BA-52FF', text: 'ドン' }, { who: '🫛 PE-4970', text: 'ぱっ' }, { who: '🐵 BA-80BF', text: 'ドン、ドン' }, { who: '🫛 PE-05F0', text: 'ぱ ぱ' }, { who: '🐵 BA-52FF', text: `（${s.ticker} で四つ打ち）` }, { who: '🫛 PE-4970', text: '✨' }];
    setBeats((b) => [...b.slice(-40), { who: '🥁', text: `${s.ticker} ${s.name.replace('（合成）', '')} — ${why}`, k: Date.now() }]);
    line.forEach((l, n) => beatTimers.current.push(window.setTimeout(() => setBeats((b) => [...b.slice(-40), { ...l, k: Date.now() + n }]), 500 * (n + 1))));
  };

  const give = (target: string, s: Sym | null) => {
    if (!s) return;
    if (target === 'white' || target === 'black') setFocus((f) => ({ ...f, [target]: s })); else setBadges((b) => ({ ...b, [target]: s }));
    drum(s, `${target === 'white' || target === 'black' ? sideName(target as Color) : PEOPLE[target].name}に渡した`);
    setHeld(null);
  };
  const dropProps = (target: string) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const i = Number(e.dataTransfer.getData('text/plain')); give(target, Number.isFinite(i) ? lookup(i) : held); },
    onClick: () => give(target, held),
  });

  // The architect's drafting board: three proposals for which symbol a piece should go after.
  const proposals = useMemo(() => {
    if (side !== 'black' || done) return [];
    const theme = news.theme;
    const pool = [...postSyms, ...Array.from({ length: 36 }, (_, i) => symbolAt(i + turn * 3, prefer))].sort((a, b) => Number(b.theme === theme) - Number(a.theme === theme));
    const mine = pieces.filter((p) => p.alive && p.color === 'black');
    const out: { sym: Sym; id: string; to: Sq; room: string }[] = [];
    for (const sym of pool) {
      const room = ROOMS.find((r) => r.name === THEME_ROOM[sym.theme]); if (!room) continue;
      let best: { id: string; to: Sq; d: number } | null = null;
      for (const p of mine) for (const to of legalMoves(p, pieces).filter((t) => !inMirage(t))) { const d = Math.abs(to.x - room.x) + Math.abs(to.y - room.y) + Math.abs(to.f - room.f); if (!best || d < best.d) best = { id: p.id, to, d }; }
      if (best && !out.some((o) => o.id === best!.id && same(o.to, best!.to))) out.push({ sym, id: best.id, to: best.to, room: room.name });
      if (out.length === 3) break;
    }
    return out;
  }, [side, done, turn, pieces, prefer, news, postSyms]);

  const shownNews = { ...news, parts: news.parts.map((x, k) => (tamper[k] ? { ...x, filter: tamper[k] } : x)) };
  const printOrig = newsPrint(news.parts); const printNow = newsPrint(shownNews.parts);
  const cycle = (k: number) => {
    if (right && approved === null) setApproved(k); const order: Filter[] = ['事実', '噂', '感情']; const cur = tamper[k] ?? news.parts[k].filter; const nx = order[(order.indexOf(cur) + 1) % 3]; setTamper((t) => { const n = { ...t }; if (nx === news.parts[k].filter) delete n[k]; else n[k] = nx; return n; }); };

  const send = (timeout = false) => {
    if (done) return;
    if (!timeout && !prompt.trim()) { setWarn('プロンプトが空です。駒を押して行き先を押すと、プロンプトの下書きが入ります。'); return; }
    const devId = device ?? 'brain';
    setWarn(device ? '' : BRAIN_RULE);
    const dev = DEVICES.find((d) => d.id === devId)!; const cpuPool = DEVICES.filter((d) => d.id !== 'brain'); const cpuDev = cpuPool[Math.floor(rnd.current() * cpuPool.length)];
    const guard = (r: ReturnType<typeof parsePrompt>) => (r.move && inMirage(r.move.to) ? { move: null, why: `${r.move.id} は蜃気楼の部屋に入れない（見えるが、鍵がない） — 駐車のまま` } : r);
    const myText = timeout ? '（時間切れ）' : prompt;
    let mineR = timeout ? { move: null, why: '時間切れ — 駐車のまま' } : devId === 'brain' ? parseFree(prompt, side, pieces, inMirage) : guard(parsePrompt(prompt, side, pieces));
    if (mineR.move && frozen.includes(mineR.move.id)) mineR = { move: null, why: `${mineR.move.id} は取り調べ中で動けない — 駐車のまま` };
    const foeText = cpuPrompt(foe, pieces, rnd.current); let foeR = guard(parsePrompt(foeText, foe, pieces));
    const notes: string[] = []; let penalty = 0; let capDevice = false;
    // --- device faults (bold mode) ---
    const chance = faultChance(turn, noise);
    if (wild && rnd.current() < chance) {
      if (devId === 'phone') notes.push('⚠ スプーフィング：スマホに、なりすましの「速報」が届いた。差出人の指紋が、どの投稿も指していない。');
      if (devId === 'terminal') { const hijack = randomMove(side, pieces, inMirage, rnd.current); mineR = { move: hijack, why: `⚠ 不正ログイン：誰かのセッションで、別のプロンプトが実行された（${hijack ? `${hijack.id} → ${sqName(hijack.to)}` : 'どこへも'}）` }; notes.push('⚠ 不正ログイン：ターミナルの古いセッションが、もう一度再生された（リプレイのたとえ）。送った手の代わりに、別の手が走った。'); }
      if (devId === 'radio' && mineR.move) { const ic = interceptor(foe, mineR.move.to, pieces); if (ic) { foeR = { move: ic, why: `⚠ 混信で聞いた先へ ${ic.id} → ${sqName(ic.to)}` }; notes.push('⚠ 混信：あなたの無線のプロンプトが、相手の無線にも流れた（間に誰かがいるたとえ）。相手が同じ区画を狙った。'); } else notes.push('⚠ 混信：雑音が入ったが、相手は聞き取れなかった。'); }
      if (devId === 'ariel') { capDevice = true; notes.push(`⚠ カメラの乗っ取り：エーリアル ${camera} の映像がすり替えられ、別の部屋を映していた。違うデバイスで読んだ得点は数えない。`); }
      if (devId === 'drone' && mineR.move) { const d = floorSlip(mineR.move, pieces, inMirage, rnd.current); if (!same(d.to, mineR.move.to)) { mineR = { move: d, why: `⚠ GPS のなりすまし：${d.id} は ${sqName(d.to)} に着陸した（階がずれた）` }; notes.push('⚠ GPS のなりすまし（たとえ）：ドローンの位置の知らせがすり替えられ、着陸する階がずれた。'); } else notes.push('⚠ GPS のなりすまし：位置がゆらいだが、着陸は無事だった。'); }
      if (devId === 'brain' && mineR.move) { const d = drift(mineR.move, pieces, inMirage, rnd.current); if (!same(d.to, mineR.move.to)) { mineR = { move: d, why: `⚠ 脳波のノイズ：${d.id} は ${sqName(d.to)} に降りた（一マスずれた）` }; notes.push('⚠ 脳波のノイズ：考えた区画から、一マスずれた。'); } }
    }
    const white = side === 'white' ? mineR : foeR; const black = side === 'white' ? foeR : mineR;
    const { pieces: next, events } = resolveTurn(pieces, white.move, black.move);
    const crashed = events.some((e) => e.kind === 'crash');
    let delta = crashed ? -1 : dev.id !== cpuDev.id && !capDevice ? 1 : 0;
    notes.unshift(crashed ? '同じマスでぶつかった。読み方が衝突して、調和が一つ減った。' : delta > 0 ? `違うデバイスから、同じニュースを読んだ。${news.harmony}` : '調和は増えも減りもしない。');
    if (devId === 'phone' && notes.some((n) => n.startsWith('⚠ スプーフィング')) && mineR.move && PEOPLE[mineR.move.id].filter === '噂') { delta -= 1; notes.push(`${PEOPLE[mineR.move.id].name}は噂に強いぶん、なりすましの速報を信じてしまった。調和 −1。`); }
    // --- the audit: tampering and insider-like moves ---
    const unapproved = Object.keys(tamper).filter((k) => Number(k) !== approved);
    if (approved !== null && tamper[approved]) { notes.push(`🛸 介入の権利：空からの問いに答えたので、「${news.parts[approved].label}」の読み方を、監査に見つからずに直した。MENTE のカードが一枚、公開された。`); }
    if (unapproved.length) { penalty += 2; notes.push(`🔎 監査：ニュースの指紋が一致しない（元 ${printOrig} ／ 今 ${printNow}）。介入（改ざん）は、指紋で見つかる。調和 −2。`); }
    if (peeked && mineR.move) { penalty += 2; notes.push(`🔎 監査：公開前のニュースをのぞいてから動いた（先回り）。鎖のタイムスタンプが、公開より前の手を記録している。${PEOPLE[mineR.move.id].name}は次のターン、取り調べで動けない。調和 −2。（現実の市場では、公開前の重要な情報で売り買いすることはインサイダー取引で、法律で禁じられている）`); }
    delta -= penalty;
    const acts: string[] = []; const used: string[] = []; const usedFocus: Color[] = []; const forged: KeyFragment[] = []; let alignedNow = false;
    for (const m of [white.move, black.move]) {
      if (!m) continue; const who = PEOPLE[m.id]; const color: Color = m.id.startsWith('W') ? 'white' : 'black';
      let act = `${who.name}（${who.role}）は、${who.act[turn % 3]}`;
      const b = badges[m.id];
      if (b) drum(b, `${who.name}が動いた`);
      const base = b ? b.name.replace('（合成）', '') : '';
      if (b && b.theme === '住まい' && DWELLING_MATCH[base] === m.id) {
        used.push(m.id); delta += 2; alignedNow = true;
        const prev = (forged.at(-1) ?? keys.at(-1))?.hex ?? '0000'; const hex = hex4(`${prev}/${b.ticker}/${m.id}/${turn}`);
        forged.push({ hex, prev, ticker: b.ticker, who: who.name, turn: turn + 1 });
        notes.push(`${who.name} と「${base}」がそろった（住まいの銘柄 × その住人）。調和 +2。サンクチュアリの鍵のかけら ${hex}（前のかけら ${prev} を指す）が生まれた。`);
      } else if (b) { used.push(m.id); if (b.filter === who.filter) { delta += 1; alignedNow = true; notes.push(`${who.name} が持っていた ${b.ticker} の合図（${b.signal}）と、${who.name} の読み方（${who.filter}）が同じ向きを見た。調和 +1。`); } else notes.push(`${who.name} が持っていた ${b.ticker} の合図は［${b.filter}］、${who.name} の読み方は［${who.filter}］。少しずれた。`); if (b.signal === '下向きの交差') act += '。下向きの合図を気にして、少し慎重に'; }
      const f = focus[color];
      if (f) { usedFocus.push(color); notes.push(`${sideName(color)}は ${f.ticker}（${f.theme}）の${f.signal}を見て、${f.theme}のニュースに集中した。`); if (f.filter === who.filter) { delta += 1; notes.push('チームの集中と、動いた人の読み方がそろった。調和 +1。'); } }
      acts.push(act + '。');
    }
    const devLabel = (d: typeof dev, mine: boolean) => (d.id === 'drone' ? '🛸 ドローン機材（空からの視点）' : d.id === 'brain' ? '🧠 XR ブレインインターフェース' : d.meta ? `${d.icon} エーリアル ${mine ? camera : 1 + Math.floor(rnd.current() * 22)} のメタ視点` : `${d.icon} ${d.name}`);
    const lines = [{ side: sideName(side) + (side === 'black' ? '（あなた＝建築家）' : '（あなた）'), device: devLabel(dev, true), prompt: myText, why: mineR.why }, { side: sideName(foe), device: devLabel(cpuDev, false), prompt: foeText, why: foeR.why }];
    setLog((l) => [{ turn: turn + 1, lines, events, acts, harmony: delta, notes }, ...l]);
    setBadges((b) => { const n = { ...b }; used.forEach((id) => delete n[id]); return n; });
    setFocus((f) => { const n = { ...f }; usedFocus.forEach((c) => delete n[c]); return n; });
    if (delta > 0) alignedNow = true;
    setAttention((a) => a + news.parts.filter((x) => x.filter === '噂').length + news.posts.filter((x) => x.kind === '噂').length * 2);
    setKeys((k) => [...k, ...forged]); setAligned((a) => a + (alignedNow ? 1 : 0));
    setNoise((n) => n + (devId === 'brain' ? 2 : 0));
    setFrozen(peeked && mineR.move ? [mineR.move.id] : []);
    if (approved !== null && tamper[approved]) { setCards((c) => Math.min(MENTE_CARDS.length, c + 1)); setRight(false); }
    setApproved(null); setSkyMsg('');
    setTamper({}); setPeeked(false); setLeft(20);
    setHarmony((h) => h + delta); setPieces(next); setTurn((t) => t + 1); setPrompt(''); setPicked(null);
  };
  const sendRef = useRef(send); sendRef.current = send;
  useEffect(() => {
    if (!fast || done) return undefined;
    const t = window.setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000); // only counts down (no side effects in the updater)
    return () => window.clearInterval(t);
  }, [fast, done]);
  useEffect(() => { if (fast && !done && left === 0) sendRef.current(true); }, [fast, done, left]); // time's up: send once
  const reset = (s: Color = side) => { setSide(s); setPieces(initialPieces()); setTurn(0); setLog([]); setHarmony(0); setPrompt(''); setPicked(null); setDevice(null); setWarn(''); setBadges({}); setFocus({}); setHeld(null); setKeys([]); setAligned(0); setAttention(0); setNoise(0); setTamper({}); setPeeked(false); setFrozen([]); setLeft(20); setRight(false); setApproved(null); setSkyTried(-1); setSkyMsg(''); setCards(0); };
  const clickCell = (s: Sq) => {
    if (done) return;
    const here = pieces.find((p) => p.alive && same(p.at, s));
    if (held && here) { give(here.id, held); return; }
    if (here && here.color === side) { setPicked(here.id); return; }
    if (picked && targets.some((t) => same(t, s))) setPrompt(`${picked} を ${sqName(s)} へ`);
  };

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-7xl space-y-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>フィジカルプロンプトチェス · {gameNo} ゲーム目</span>
          <span className="flex gap-3"><button type="button" onClick={() => reset()} className="underline">最初から</button><Link href="/mente/game" className="underline">タイトルへ</Link></span>
        </p>
        <header className="space-y-1 border-b border-stone-200 pb-2">
          <h1 className="text-lg">{title}</h1>
          {intro && <p className="text-xs text-stone-600">{intro}</p>}
          <p className="border-l-4 border-[#c8001a] pl-2 text-xs" data-testid="rule">決まり：すべての手は、<strong>デバイスかメタ視点からのプロンプト</strong>で進む。デバイスを選ばずに送ると、<strong>XR ブレインインターフェース</strong>で、好きな区画へ自由に動かせる（サンクチュアリ構想の要求。ただし脳波のノイズがたまる）。</p>
          {allowArchitect && (
            <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="side">参加のしかた：
              <button type="button" onClick={() => reset('white')} className="border px-2 py-0.5" style={{ borderColor: side === 'white' ? '#c8001a' : '#d6d3d1' }}>アクティブギャング（白）</button>
              {side === 'black' ? <span className="border border-[#2b3a67] px-2 py-0.5 text-[#2b3a67]">🔗 SNCT として参加中 — 建築家としての私（製図板）：暗号を交換しながらチャートを競う XR サンクチュアリ</span>
                : arielHint ? <button type="button" data-testid="link-sanctuary" onClick={() => reset('black')} className="border border-dashed border-[#2b3a67] px-2 py-0.5 text-left text-[#2b3a67] underline decoration-dotted">🔗 SNCT · 住まいの協同組合（六角温室の共同住宅を運営）<br /><span className="text-[10px] no-underline">建築家としての私（製図板）：暗号を交換しながらチャートを競う XR サンクチュアリ</span></button>
                : <span className="px-1 text-stone-400" aria-hidden>（……）</span>}
            </div>
          )}
        </header>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_17rem_15rem]">
          <section className="space-y-2" aria-label="ニュースと盤">
            <p className="text-[11px] text-stone-500">{done ? 'すべてのターンが終わった' : `ターン ${turn + 1} / ${TURNS} · NEWS`}</p>
            {!done && <>
              <p className="text-base font-semibold" data-testid="headline">「{news.headline}」{news.theme && <span className="ml-2 text-[11px] font-normal text-stone-500">テーマ：{news.theme}</span>}</p>
              {news.scene && <ScenePanel key={turn} scene={news.scene} />}
              <div className="flex flex-wrap gap-2">{shownNews.parts.map((p, k) => <button type="button" key={p.label} data-testid={`part-${k}`} onClick={() => wild && cycle(k)} title={wild ? '押すと、この部品のフィルターを書き換える（介入）' : undefined} className="border px-2 py-0.5 text-left text-xs" style={{ borderColor: FILTER_COLOR[p.filter], color: FILTER_COLOR[p.filter], background: tamper[k] ? '#fff1f2' : 'white' }}>{p.label}：{p.text}<span className="ml-1 text-[10px]">［{p.filter}］{tamper[k] ? '（介入）' : ''}</span></button>)}</div>
              {wild && <p className="text-[11px]" data-testid="news-print">ニュースの指紋：<span className="font-semibold">{printOrig}</span>{printNow !== printOrig && <span className="text-[#c8001a]"> → {printNow}（一致しない：{approved !== null && Object.keys(tamper).every((k) => Number(k) === approved) ? '権利による訂正' : '介入の跡'}）</span>} <span className="text-stone-500">· 部品を押すと、フィルターを書き換えられる（介入）。</span></p>}
              <div className="grid gap-1 sm:grid-cols-3">{news.posts.map((p) => <div key={p.handle} className="border border-stone-200 bg-[#fafaf9] p-2 text-[11px]"><p className="text-stone-500">▶ {p.handle} · {p.views}</p><p>{p.text}</p><p className="text-[10px]" style={{ color: FILTER_COLOR[p.kind] }}>［{p.kind}］</p></div>)}</div>
            </>}
            <svg viewBox={`0 0 ${FLOOR_W * FLOORS} ${SIZE * CELL + PAD * 2 + 14}`} className="w-full rounded bg-[#2f2f2f]" aria-label="チョークで描いた 3 つの階" data-testid="board">
              <defs><linearGradient id="mirage-grad" x1="0" x2="1"><stop offset="0" stopColor="#fde68a" stopOpacity="0.05" /><stop offset="0.5" stopColor="#fde68a" stopOpacity="0.22" /><stop offset="1" stopColor="#fde68a" stopOpacity="0.05" /></linearGradient></defs>
              <style>{'.mirage{animation:mirage 4s ease-in-out infinite}@keyframes mirage{0%,100%{opacity:.55}50%{opacity:1}}@media (prefers-reduced-motion: reduce){.mirage{animation:none}}'}</style>
              {Array.from({ length: FLOORS }, (_, f) => (
                <g key={f} transform={`translate(${f * FLOOR_W + PAD} ${PAD})`}>
                  <text x={0} y={-8} fontSize={11} fill="#f5f5f4" opacity={0.8}>{['1 階 ロビー', '2 階 トレーディングフロア', '3 階 屋上'][f]}</text>
                  {Array.from({ length: SIZE + 1 }, (_, k) => <g key={k}><line x1={k * CELL} x2={k * CELL} y1={0} y2={SIZE * CELL} stroke="#f5f5f4" strokeOpacity={0.35} strokeDasharray="5 2 1 2" /><line y1={k * CELL} y2={k * CELL} x1={0} x2={SIZE * CELL} stroke="#f5f5f4" strokeOpacity={0.35} strokeDasharray="5 2 1 2" /></g>)}
                  {f === 0 && <g data-testid="mirage" aria-label="蜃気楼の部屋（入れない）"><rect className="mirage" x={3 * CELL} y={0} width={2 * CELL} height={CELL} fill="url(#mirage-grad)" /><text x={3 * CELL + 4} y={CELL - 6} fontSize={8} fill="#fde68a">蜃気楼の部屋（入れない）</text>{keys.length >= 3 && <text x={3 * CELL + 4} y={12} fontSize={7} fill="#fde68a">鍵：{keys.slice(-3).map((k) => k.hex).join('')}</text>}</g>}
                  {ROOMS.filter((r) => r.f === f).map((r) => <text key={r.name} x={r.x * CELL + 3} y={(SIZE - 1 - r.y) * CELL + CELL - 4} fontSize={8} fill="#f5f5f4" opacity={0.65}>{r.name}</text>)}
                  {Array.from({ length: SIZE * SIZE }, (_, k) => { const s = { x: k % SIZE, y: Math.floor(k / SIZE), f }; const tgt = targets.some((t) => same(t, s)); return <rect key={k} x={s.x * CELL} y={(SIZE - 1 - s.y) * CELL} width={CELL} height={CELL} fill={tgt ? '#f5f5f41a' : 'transparent'} stroke={tgt ? '#fde68a' : 'none'} strokeDasharray="3 3" onClick={() => clickCell(s)} style={{ cursor: 'pointer' }} />; })}
                  {pieces.filter((p) => p.alive && p.at.f === f).map((p) => (
                    <g key={p.id} transform={`translate(${p.at.x * CELL + CELL / 2} ${(SIZE - 1 - p.at.y) * CELL + CELL / 2})`} onClick={() => clickCell(p.at)} style={{ cursor: 'pointer' }} data-testid={`piece-${p.id}`}>
                      <circle r={14} fill={p.color === 'white' ? '#f5f5f4' : '#1f1f1f'} stroke={picked === p.id ? '#fde68a' : '#f5f5f4'} strokeWidth={picked === p.id ? 3 : 1.2} />
                      <text y={4} textAnchor="middle" fontSize={10} fill={p.color === 'white' ? '#1f1f1f' : '#f5f5f4'}>{PEOPLE[p.id].name.slice(0, 2)}</text>
                      {badges[p.id] && <g transform="translate(9 -15)"><rect x={-2} y={-8} width={30} height={11} rx={2} fill="#fde68a" /><text x={13} y={0} fontSize={7} textAnchor="middle" fill="#1f1f1f">{badges[p.id].ticker}</text></g>}
                      <title>{`${p.id} ${PEOPLE[p.id].name}（${PEOPLE[p.id].role}）· ${PEOPLE[p.id].attire}`}</title>
                    </g>
                  ))}
                </g>
              ))}
            </svg>
            <div className="flex flex-wrap gap-1 text-[11px]" aria-label="銘柄を渡す先" data-testid="drop-targets">
              {(['white', 'black'] as Color[]).map((c) => <span key={c} {...dropProps(c)} data-testid={`drop-${c}`} className="cursor-pointer border-2 border-dashed px-2 py-1" style={{ borderColor: focus[c] ? '#c8001a' : '#a8a29e' }}>{sideName(c)}{focus[c] ? ` ← ${focus[c]!.ticker}` : '（チームへ）'}</span>)}
              {pieces.filter((p) => p.alive).map((p) => <span key={p.id} {...dropProps(p.id)} data-testid={`drop-${p.id}`} className="cursor-pointer border border-dashed px-1.5 py-1" style={{ borderColor: badges[p.id] ? '#c8001a' : '#d6d3d1' }}>{PEOPLE[p.id].name}{badges[p.id] ? ` ← ${badges[p.id].ticker}` : ''}</span>)}
            </div>
            <p className="text-[10px] text-stone-500">{side === 'white' ? '白' : '黒'}があなた。自分の駒を押すと、跳べる区画がチョークの点線で出ます。区画を押すとプロンプトの下書きが入ります（送るのは、デバイスから）。銘柄の合図と駒の読み方（事実・噂・感情）がそろうと、調和が少し増えます。</p>
          </section>

          <aside className="space-y-2" aria-label="プロンプト">
            {side === 'black' && !done && (
              <div className="space-y-1 border border-[#2b3a67] p-2 text-[11px]" data-testid="drafting-board">
                <p className="font-semibold">📐 製図板（建築家の選択案）</p>
                {proposals.map((o, k) => <button key={k} type="button" data-testid={`proposal-${k}`} onClick={() => { setPrompt(`${o.id} を ${sqName(o.to)} へ`); setHeld(o.sym); }} className="block w-full border border-stone-200 px-1.5 py-1 text-left hover:bg-[#f5f5f4]">案 {'ABC'[k]}：{o.sym.ticker} {o.sym.name}（{o.sym.signal}）{o.sym.theme === news.theme && <span className="ml-1 text-[#2b3a67]">· ニュースのテーマ</span>}<br />→ {PEOPLE[o.id].name}を「{o.room}」の方へ（{sqName(o.to)}）</button>)}
                <p className="text-[10px] text-stone-500">案を押すと、プロンプトの下書きと、その銘柄を持った状態になります。駒に渡すかどうかは、あなたが決める。</p>
              </div>
            )}
            <div className="space-y-1 border border-[#c8001a] p-2 text-[11px]" data-testid="wild">
              <label className="flex items-center gap-1"><input type="checkbox" checked={wild} onChange={(e) => setWild(e.target.checked)} />大胆モード（デバイスの不具合・介入・先回り）</label>
              <label className="flex items-center gap-1"><input type="checkbox" data-testid="fast" checked={fast} onChange={(e) => { setFast(e.target.checked); setLeft(20); }} />速いモード（1 ターン 20 秒）{fast && !done && <span className="ml-1 font-semibold" data-testid="timer">残り {left} 秒</span>}</label>
              {wild && <p data-testid="fault">デバイスの不具合の起きやすさ：{Math.round(faultChance(turn, noise) * 100)}% · 脳波のノイズ：{noise}</p>}
              {wild && !done && turn + 1 < TURNS && <button type="button" data-testid="peek" onClick={() => setPeeked(true)} className="border border-stone-400 px-1.5">次のニュースをのぞく（先回り）</button>}
              {peeked && turn + 1 < TURNS && <p className="text-[#c8001a]" data-testid="peeked">公開前：「{NEWS[turn + 1].headline}」— これを見て動くと、監査に記録される。</p>}
              {frozen.length > 0 && <p className="text-[#c8001a]">取り調べ中：{frozen.map((id) => PEOPLE[id].name).join('・')}（このターンは動けない）</p>}
            </div>
            <p className="text-xs font-semibold">プロンプトを送るデバイス</p>
            <div className="grid grid-cols-2 gap-1 text-xs">{DEVICES.map((d) => <button key={d.id} type="button" data-testid={`dev-${d.id}`} onClick={() => setDevice(d.id)} {...(d.id === 'ariel' ? longPress : {})} title={d.id === 'ariel' ? '長押しで、エーリアルの助言' : undefined} className="border px-2 py-1 text-left" style={{ borderColor: device === d.id ? '#c8001a' : '#d6d3d1', background: device === d.id ? '#fff1f2' : 'white' }}>{d.icon} {d.name}</button>)}</div>
            {arielHint && side === 'white' && <div className="border border-[#2b3a67] bg-[#f5f7fb] p-2 text-[11px]" role="note" data-testid="ariel-hint"><p className="font-semibold">👁 エーリアルの助言</p><p>「建築家オスバルド（製図板）としてのサンクチュアリ（黒）」は、バナー（ただの看板）になってしまう可能性がある。誰か一人の名前か、具体的な商いのかたちを短くまとめた、効くリンク装置に変えて、隠しておくといい。</p><p className="mt-1 text-stone-600">→ 参加のしかたの欄に、🔗 のリンク装置を置いた。押すと、建築家として参加できる。</p></div>}
            {wild && device === 'drone' && !done && (() => { const k = turn % news.parts.length; const part = news.parts[k]; return (
              <div className="space-y-1 border border-[#2b3a67] bg-[#f5f7fb] p-2 text-[11px]" data-testid="sky">
                <p className="font-semibold">🛸 空からの問い</p>
                {right ? <p className="text-[#2f6b1a]" data-testid="sky-right">介入の権利あり：ニュースの部品を一つ押して、読み方を直す（監査に見つからない）。{approved !== null ? `→「${news.parts[approved].label}」を直す` : ''}</p> : skyTried === turn ? <p className="text-stone-600">{skyMsg}</p> : <>
                  <p>「{part.label}：{part.text}」は、事実・噂・感情のどれ？</p>
                  <div className="flex gap-1">{(['事実', '噂', '感情'] as Filter[]).map((f) => <button key={f} type="button" data-testid={`sky-${f}`} onClick={() => { setSkyTried(turn); if (f === part.filter) { setRight(true); setSkyMsg('正解。介入の権利を一つ得た。'); } else setSkyMsg(`ちがう（正しくは［${part.filter}］）。このターンは権利なし。`); }} className="border border-stone-400 px-2">{f}</button>)}</div>
                </>}
              </div>); })()}
            {device === 'ariel' && <label className="block text-xs">エーリアル <input type="number" min={1} max={22} value={camera} onChange={(e) => setCamera(Math.max(1, Math.min(22, Number(e.target.value) || 1)))} className="w-14 border border-stone-400 bg-white px-1" /> / 22 から見る</label>}
            <textarea data-testid="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder={side === 'white' ? '例：W1 を c3@2F へ' : '例：B2 を c3@2F へ'} className="w-full border border-stone-400 bg-white px-2 py-1 text-sm text-[#1f1f1f]" disabled={done} />
            <button type="button" data-testid="send" onClick={() => send()} disabled={done} className="w-full border border-[#1f1f1f] bg-[#1f1f1f] py-1.5 text-sm text-white disabled:opacity-40">送る</button>
            {warn && <p className="text-[11px] text-[#c8001a]" role="alert" data-testid="warn">{warn}</p>}
            {held && <p className="text-[11px] text-[#c8001a]" data-testid="held">持っている銘柄：{held.ticker}（駒かチームを押すと渡す）</p>}
            <p className="text-sm" data-testid="harmony">調和：{harmony}</p>
            {showAttention && <div className="border border-[#2f6b1a] p-2 text-[11px]" data-testid="attention"><p>📣 PE 群の注目：{attention}</p><div className="mt-1 h-2 bg-stone-200"><div className="h-2 bg-[#2f6b1a]" style={{ width: `${Math.min(100, attention * 4)}%` }} /></div><p className="mt-1 text-[10px] text-stone-600">注目は値段ではない。噂が増えると注目は増えるが、駒の強さも、銘柄の値打ちも変わらない。</p></div>}
            {beats.length > 0 && <div className="max-h-40 space-y-0.5 overflow-y-auto border border-stone-300 p-2 text-[11px]" data-testid="beats" aria-live="off"><p className="font-semibold">🥁 実況（BA 🐵 と PE 🫛）</p>{beats.map((b) => <p key={b.k}><span className="font-semibold" style={{ color: b.who.includes('BA') ? '#7a5c12' : b.who.includes('PE') ? '#2f6b1a' : '#57534e' }}>{b.who}</span>　{b.text}</p>)}</div>}
            {cards > 0 && <div className="space-y-2" data-testid="mente-cards">{MENTE_CARDS.slice(0, cards).reverse().map((c) => (
              <div key={c.title} className="space-y-1 border-2 border-black bg-white p-2 text-[11px] shadow-[4px_4px_0_#0003]">
                <p className="inline-block bg-black px-1.5 text-[10px] font-bold italic text-white">MENTE · 公開 · {c.tag}</p>
                <p className="font-semibold">{c.title}</p>
                {c.body.map((b) => <p key={b}>{b}</p>)}
              </div>))}<p className="text-[10px] text-stone-500">2026 年後半の公開情報の大筋。ゲームの外で使う前に出典を確かめる。投資の助言ではない。</p></div>}
            <div className="space-y-1 border border-[#2b3a67] p-2 text-[11px]" data-testid="crypto">
              <p className="font-semibold">🔐 サンクチュアリの暗号</p>
              <p data-testid="harmony-rate">調和率：{turn ? Math.round((aligned / turn) * 100) : 0}%（{aligned} / {turn} ターン）</p>
              <p className="text-[10px] text-stone-500">量子の言葉では、二つのチームの読みを測ったとき、同じ向きにそろって出る確率。そろうたびに、鍵の材料が増える。</p>
              <p>鍵のかけら {keys.length} 個（3 個で鍵）：{keys.length ? keys.map((k) => k.hex).join(' ← ') : 'まだない'}</p>
              {keys.length >= 3 && <p className="text-[#2f6b1a]" data-testid="key-done">鍵が組み上がった：{keys.slice(-3).map((k) => k.hex).join('')}（どのかけらも、一つ前のかけらを指している）</p>}
              <p className="text-[10px] text-stone-500">「住まい」の銘柄を、それに合う住人（定住指数・近所の返信率 → ニエベス、庭の手入れ指数 → ペルペトゥア、窓の灯り指数 → チェロ、朝と夜の投稿の幅・同じ景色の写真の数 → オスバルド）に渡して動かすと、調和 +2 と鍵のかけら。</p>
            </div>
            {done && <p className="border border-stone-200 bg-[#fafaf9] p-2 text-xs" data-testid="end">{TURNS} つのニュースを解体した。調和は {harmony}。同じ出来事を、違うデバイスで読むほど、ぶつからずに並べる。</p>}
          </aside>

          <aside><SymbolStrip prefer={prefer} held={held} onHold={setHeld} groups={[{ label: 'このニュースの投稿から生まれた銘柄', syms: postSyms }, { label: '四つ打ち系（略号は固定）', syms: prefer === 'ミーム' ? curated() : [] }]} /></aside>
        </div>

        <section className="space-y-2" aria-label="記録" data-testid="log">
          {log.map((e) => (
            <div key={e.turn} className="border-l-4 pl-3 text-xs" style={{ borderColor: e.harmony > 0 ? '#2f6b1a' : e.harmony < 0 ? '#c8001a' : '#d6d3d1' }}>
              <p className="font-semibold">ターン {e.turn}</p>
              {e.lines.map((l) => <p key={l.side}>{l.side} · {l.device}：「{l.prompt}」 → {l.why}</p>)}
              {e.events.map((ev, k) => <p key={k} className="text-stone-600">・{ev.text}</p>)}
              {e.acts.map((a) => <p key={a} className="text-stone-600">{a}</p>)}
              {e.notes.map((n) => <p key={n} style={{ color: e.harmony > 0 ? '#2f6b1a' : e.harmony < 0 ? '#c8001a' : '#57534e' }}>{n}</p>)}
            </div>
          ))}
        </section>
        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">架空の会社・人物・投稿・数字・銘柄です。合成の銘柄の線は作りもので、値段の予想ではありません。売り買いのすすめや賭けはありません。</footer>
      </div>
    </main>
  );
}
