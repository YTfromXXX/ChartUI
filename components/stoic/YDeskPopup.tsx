'use client';

import { useEffect, useState } from 'react';
import { loadY, type PlayerY } from '@/lib/permanentY';

// An original pixel scene (not taken from any game): a summer evening, a young person (Cybernetics C)
// sitting sideways at a Mac split 5:5 — folders on the left, a terminal on the right — chin in hand,
// a little stuck. A fan, a wind chime, the orange window. Each character of the map is one pixel.
const MAP = [
  '................................................',
  '.WWWWWWWWWWWWWWWW...............................',
  '.WSSSSSSSSSSSSSSW.........g.....................',
  '.WSSSSSSSSSSSSSSW.........G.....................',
  '.WSSSSSSSSSSSSSSW.........G.....................',
  '.WSOOOOOOOOOOOOSW.......................FFFFF...',
  '.WSOOOOOOOOOOOOSW......................F.....F..',
  '.WOOOOOOOOOOOOOOW......................F..+..F..',
  '.WOOOOOOOOOOOOOOW......................F.....F..',
  '.WWWWWWWWWWWWWWWW.......................FFFFF...',
  '.........................................|......',
  '.....................hhhh.....MMMMMMMMMMMMM.|...',
  '....................hhhhhh....MLLLLLLKKKKKKM|...',
  '....................hssssh....MLyyLLLKgKKKKM|...',
  '....................hsesss....MLLLLLLKKgKKKM|...',
  '.....................ssss.....MLyyLLLKKKKKKM|...',
  '......................ss.a....MLLLLLLKgggKKM|...',
  '....................tttttaa...MMMMMMMMMMMMM.|...',
  '...................tttttttaa........MM.....bbb..',
  '...................ttttttt.a.....MMMMMMMM..bbb..',
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
  '..................ppppppp.....................d.',
  '..................pp...pp.....................d.',
  '..................pp...pp.....................d.',
];
const PAL: Record<string, string> = {
  W: '#5b3a22', S: '#ffb36b', O: '#ff7e45', g: '#f9a8d4', G: '#e2e8f0', F: '#94a3b8', '+': '#cbd5e1', '|': '#64748b',
  h: '#2b1d12', s: '#f2c9a0', e: '#1f2937', a: '#f2c9a0', t: '#3b82f6', M: '#d4d4d8', L: '#f4f4f5', y: '#facc15', K: '#0b0b10',
  b: '#a16207', D: '#7c4a24', p: '#1e3a8a', d: '#5b3a22',
};

function Scene({ px = 6 }: { px?: number }) {
  return (
    <svg viewBox={`0 0 ${MAP[0].length * px} ${MAP.length * px}`} className="w-full" shapeRendering="crispEdges" aria-label="パソコンを前に少し悩む青年（ドット絵）" data-testid="y-scene">
      <rect width="100%" height="100%" fill="#2a2140" />
      {MAP.flatMap((row, y) => Array.from(row).map((c, x) => (PAL[c] ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={PAL[c]} /> : null)))}
      <text x={27 * px} y={2 * px} fontSize={px * 1.4} fill="#e2e8f0" fontFamily="monospace">ﾁﾘﾝ</text>
      <text x={3 * px} y={20.5 * px} fontSize={px * 1.3} fill="#fde68a" fontFamily="monospace">ミーン…</text>
    </svg>
  );
}

type Page = { kind: 'error'; title: string; body: string; choices: [string, string] } | { kind: 'report' };
const PAGES: Page[] = [
  { kind: 'error', title: 'エラー 0x0505', body: 'フォルダーを席へドラッグしている途中で、ターミナルの絵が描きかけのままです。どちらを先に仕上げますか？', choices: ['フォルダーを置く（左）', '絵を描き上げる（右）'] },
  { kind: 'error', title: 'エラー 0x0822', body: '夏休みの宿題（ストイックルームの日記）が 1 日分足りません。どうしますか？', choices: ['今日の分を正直に書く', '明日まとめて書く'] },
  { kind: 'report' },
];

/** Grades for the report card, from the permanent player Y's own record (this browser only). */
function grades(y: PlayerY | null, picks: number[]) {
  const votes = y?.votes ?? 0; const hits = y?.hits ?? 0; const games = y?.games ?? 0;
  const g = (x: number) => (x >= 0.67 ? 'よくできました' : x >= 0.34 ? 'できました' : 'もうすこし');
  return [
    { subject: '先を読む力（レースの予想）', grade: votes ? g(hits / votes) : 'まだ記録なし', note: `予想 ${votes} 回・的中 ${hits} 回` },
    { subject: 'ねばり強さ', grade: g(Math.min(1, games / 5)), note: `レース ${games} 回` },
    { subject: 'まっすぐさ（エラーの選び方）', grade: picks[1] === 0 ? 'よくできました' : picks[1] === 1 ? 'もうすこし' : '—', note: picks[1] === 0 ? '日記を今日書いた' : picks[1] === 1 ? '明日にまわした' : '' },
  ];
}

/**
 * Y at the desk, in the Stoic Room: a retro error box with two choices (NEXT after choosing), then a
 * simple report card (NEXT closes). A wistful summer-evening scene in original pixel art.
 */
export default function YDeskPopup({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [y, setY] = useState<PlayerY | null>(null);
  useEffect(() => { setY(loadY()); }, []);
  const p = PAGES[page]; const chosen = picks[page];
  const next = () => (page + 1 < PAGES.length ? setPage(page + 1) : onClose());

  return (
    <div role="dialog" aria-label="Y の姿" data-testid="y-popup" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl border-4 border-[#e5e5e5] bg-[#1b1b2a] shadow-[8px_8px_0_#000]">
        <div className="flex items-center justify-between bg-[#3a3aa8] px-2 py-1 font-mono text-xs text-white"><span>{p.kind === 'error' ? p.title : 'つうしんぼ — Cybernetics C'}</span><span>{page + 1}/{PAGES.length}</span></div>
        <Scene />
        <div className="space-y-2 p-3 font-mono text-sm text-slate-100">
          {p.kind === 'error' ? (
            <>
              <p data-testid="y-error">⚠ {p.body}</p>
              <div className="grid grid-cols-2 gap-2">{p.choices.map((c, i) => (
                <button key={c} type="button" data-testid={`y-choice-${i}`} onClick={() => setPicks((xs) => { const n = [...xs]; n[page] = i; return n; })} className="border-2 px-2 py-1 text-left text-xs" style={{ borderColor: chosen === i ? '#facc15' : '#64748b', background: chosen === i ? '#facc1522' : 'transparent' }}>{chosen === i ? '▶ ' : '　'}{c}</button>
              ))}</div>
            </>
          ) : (
            <table className="w-full text-xs" data-testid="y-report"><tbody>
              {grades(y, picks).map((r) => <tr key={r.subject} className="border-b border-white/10"><td className="py-1">{r.subject}</td><td className="text-amber-200">{r.grade}</td><td className="text-right text-slate-400">{r.note}</td></tr>)}
              <tr><td colSpan={3} className="pt-2 text-[11px] text-slate-300">先生から：画面の左と右をいったりきたりしながら、ちゃんと最後まで考えていました。迷った時間も、夏の宿題のうちです。</td></tr>
            </tbody></table>
          )}
          <button type="button" data-testid="y-next" onClick={next} disabled={p.kind === 'error' && chosen === undefined} className="w-full border-2 border-white bg-white py-1 font-bold text-black disabled:opacity-40">{page + 1 < PAGES.length ? 'NEXT ▶' : 'とじる'}</button>
        </div>
      </div>
    </div>
  );
}
