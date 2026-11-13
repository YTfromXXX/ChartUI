'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MenteNudge from '@/components/story/MenteNudge';
import { shouldNudge, type NudgeEvent, type NudgeReason } from '@/lib/menteNudge';
import { keccak256 } from '@/lib/meshMetaV2';
import { CRASH } from '@/lib/storyYears';
import { ASK_LINES, NUDGE_FALLBACK, NUDGE_HINTS, flagEffects, sceneById, type Flag, type Scene } from '@/lib/storyYear1';

const RUN_KEY = 'chartui-golden-run-v1';
type Run = { flags: Flag[]; copy?: number };
const loadRun = (): Run => { try { const v = JSON.parse(window.localStorage.getItem(RUN_KEY) ?? 'null'); if (v && Array.isArray(v.flags)) return v; } catch { /* blocked or broken */ } return { flags: [] }; };
const saveRun = (r: Run) => { try { window.localStorage.setItem(RUN_KEY, JSON.stringify(r)); } catch { /* per-viewer only */ } };

/** The crash chart on the wall: covered by a cloth, a corner lifted, or the part drawn so far. */
function WallChart({ mode }: { mode?: Scene['chart'] }) {
  if (!mode) return null;
  const n = mode === 'covered' ? 0 : mode === 'peek' ? 11 : 19;
  const W = 240; const H = 110; const lo = 30; const hi = 104;
  const pts = CRASH.slice(0, n).map((v, i) => `${(i / 47) * W},${H - ((v - lo) / (hi - lo)) * H}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full max-w-xs border border-stone-300 bg-white" aria-label={mode === 'covered' ? '布をかけた紙' : 'ある一晩のチャート（作りもの）'} data-testid="wall-chart">
      {n > 0 && <polyline points={pts} fill="none" stroke="#1f1f1f" strokeWidth={1.4} />}
      {n > 13 && <polyline points={CRASH.slice(13, n).map((v, i) => `${((i + 13) / 47) * W},${H - ((v - lo) / (hi - lo)) * H}`).join(' ')} fill="none" stroke="#c8001a" strokeWidth={1.6} />}
      {mode === 'covered' && <rect x={0} y={0} width={W} height={H} fill="#d6d3d1" />}
      {mode === 'peek' && <path d={`M${W * 0.25} 0H${W}V${H}H0V${H * 0.35}Z`} fill="#d6d3d1" />}
    </svg>
  );
}

const SIMILAR: Record<string, string[]> = { 0: ['D', '8', 'C'], 1: ['7', '4', 'F'], 2: ['7', '3', 'A'], 3: ['8', 'B', '5'], 4: ['A', '1', '9'], 5: ['6', '3', 'E'], 6: ['B', '5', '8'], 7: ['1', 'F', '2'], 8: ['B', '3', '0'], 9: ['4', '8', 'A'], A: ['4', '9', 'D'], B: ['8', '6', 'D'], C: ['0', 'E', '6'], D: ['0', 'B', 'A'], E: ['F', 'C', '3'], F: ['E', '7', '1'] };
const enc = new TextEncoder();
const fp = (s: string) => Array.from(keccak256(enc.encode(s)).slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const LETTERS = ['一通目：追放から一年。島の名はハニカム。', '二通目：島に春が来た。', '三通目：Luna が貝を数えている。'];

/** Year 2 mini-game: copy the previous letter's fingerprint into the next, one character at a time, 4 look-alike options each. */
function CopyGame({ onDone, onPick }: { onDone: (copy: number) => void; onPick?: (ok: boolean) => void }) {
  const rounds = useMemo(() => {
    const out: { from: string; fp: string }[] = []; let prev = LETTERS[0];
    for (let k = 0; k < 3; k += 1) { const f = fp(prev); out.push({ from: prev, fp: f }); prev = `${LETTERS[k + 1] ?? '四通目：'}${f}`; }
    return out;
  }, []);
  const [picks, setPicks] = useState<string[]>([]);
  const r = Math.floor(picks.length / 4); const c = picks.length % 4;
  const done = picks.length >= 12;
  const target = rounds.map((x) => x.fp).join('');
  const options = useMemo(() => {
    if (done) return [];
    const ch = rounds[r].fp[c]; const opts = [ch, ...SIMILAR[ch]];
    const seed = keccak256(enc.encode(`${r}/${c}`)); return opts.map((o, i) => ({ o, k: seed[i] })).sort((a, b) => a.k - b.k).map((x) => x.o);
  }, [r, c, done, rounds]);
  const correct = picks.filter((p, i) => p === target[i]).length;
  useEffect(() => { if (done) onDone(correct); }, [done, correct, onDone]);

  return (
    <div className="space-y-2 text-xs" data-testid="copy-game">
      <p>前の手紙の指紋を、次の手紙に一文字ずつ書き写す（3 通 × 4 文字）。よく似た 4 つの候補から選ぶ。</p>
      {!done && (
        <div className="space-y-2">
          <div className="copy-sway inline-block space-y-2 border border-stone-300 bg-[#fffdf7] p-3">
            <p className="text-stone-600">前の手紙：{rounds[r].from}</p>
            <p>指紋：<span className="text-base font-semibold tracking-[0.3em]" data-testid="copy-target">{rounds[r].fp}</span></p>
          </div>
          <p>書き写し：<span className="tracking-[0.3em]">{picks.slice(r * 4).join('')}<span className="text-stone-400">{'＿＿＿＿'.slice(c)}</span></span>（{c + 1} 文字目）</p>
          <div className="flex gap-2">{options.map((o) => <button key={o} type="button" data-testid={`copy-opt-${o}`} onClick={() => { onPick?.(o === rounds[r].fp[c]); setPicks((p) => [...p, o]); }} className="h-9 w-9 border border-[#1f1f1f] bg-white text-base">{o}</button>)}</div>
        </div>
      )}
      {done && <p data-testid="copy-result">書き写せた文字：{correct} / 12</p>}
      <style>{'.copy-sway{animation:copy-sway 4s ease-in-out infinite;transform-origin:50% 100%}@keyframes copy-sway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}@media (prefers-reduced-motion: reduce){.copy-sway{animation:none}}'}</style>
    </div>
  );
}

/**
 * Year 1 → 2: scenes advance by 2- or 4-choices. The 4-choice is "アリミノボーイに聞く":
 * "たぶん {~} のあいだ。正確には分からないが——" with ~ picked from a/b/c/d.
 */
export default function Year1() {
  const router = useRouter();
  const [id, setId] = useState('y1-open');
  const [run, setRun] = useState<Run>({ flags: [] });
  const [asked, setAsked] = useState(false);
  const [gameDone, setGameDone] = useState<number | null>(null);
  useEffect(() => { setRun(loadRun()); }, []);
  const scene = sceneById(id)!;
  // Mente nudge: watch only this page's own events; offer "アリミノボーイに聞く" softly.
  const events = useRef<NudgeEvent[]>([{ t: Date.now(), type: 'shown' }]);
  const beatsSince = useRef(99);
  const [nudge, setNudge] = useState<NudgeReason | null>(null);
  const check = useCallback(() => { if (nudge) return; const r = shouldNudge(events.current, Date.now(), beatsSince.current); if (r) { setNudge(r); beatsSince.current = 0; } }, [nudge]);
  const log = useCallback((type: NudgeEvent['type']) => { events.current = [...events.current.slice(-40), { t: Date.now(), type }]; check(); }, [check]);
  useEffect(() => { const t = window.setInterval(check, 5000); return () => window.clearInterval(t); }, [check]);
  const hint = NUDGE_HINTS[id] ?? NUDGE_FALLBACK;

  const go = (to: string, set?: Flag) => {
    if (to === 'years') { router.push('/mente/game/years'); return; }
    log('picked'); beatsSince.current += 1; events.current.push({ t: Date.now(), type: 'shown' });
    if (set) setRun((r) => { const next = { ...r, flags: r.flags.includes(set) ? r.flags : [...r.flags, set] }; saveRun(next); return next; });
    setAsked(false); setId(to);
  };
  const restart = () => { log('restart'); const r = { flags: [] }; saveRun(r); setRun(r); setGameDone(null); setAsked(false); setId('y1-open'); };

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>イーサリアムの黄金のアイコンを探せ（仮）· {scene.year} 年目</span>
          <span className="flex gap-3"><button type="button" onClick={restart} className="underline">最初から</button><Link href="/mente/game/years" className="underline">12 年の進行</Link><Link href="/mente/game" className="underline">タイトルへ</Link></span>
        </p>

        <section className="grid gap-3 border border-stone-200 bg-[#fafaf9] p-3 sm:grid-cols-[1fr_auto]" aria-label="背景" data-testid="backdrop">
          <p className="text-[11px] text-stone-600">場所：{scene.place}</p>
          <WallChart mode={scene.chart} />
        </section>

        <section className="space-y-2 border-l-4 border-[#1f1f1f] pl-3" aria-live="polite" data-testid="dialogue">
          <p className="text-xs font-semibold text-stone-600">{scene.speaker}</p>
          {scene.text.map((t) => <p key={t} className="text-sm leading-7">{t}</p>)}
        </section>

        {scene.kind === 'game' && <CopyGame onPick={(ok) => log(ok ? 'hit' : 'miss')} onDone={(n) => { if (gameDone !== null) return; setGameDone(n); setRun((r) => { const next = { ...r, copy: n }; saveRun(next); return next; }); }} />}

        <section className="space-y-2" aria-label="選ぶ" data-testid="choices">
          {scene.kind === 'four' && !asked && <button type="button" data-testid="ask-boy" onClick={() => setAsked(true)} className="border border-[#22b8c8] px-3 py-1 text-sm">アリミノボーイに聞く</button>}
          {scene.kind === 'four' && asked && (
            <>
              <p className="text-sm">「たぶん <span className="border-b border-dotted border-[#c8001a]">{'{ ～ }'}</span> のあいだ。正確には分からないが——」</p>
              <div className="grid gap-2 sm:grid-cols-2">{scene.choices.map((c, i) => <button key={c.to} type="button" data-testid={`choice-${'abcd'[i]}`} onClick={() => go(c.to, c.set)} className="border border-[#1f1f1f] px-3 py-2 text-left text-sm hover:bg-[#1f1f1f] hover:text-white">{c.label}</button>)}</div>
            </>
          )}
          {scene.kind === 'two' && <div className="grid gap-2 sm:grid-cols-2">{scene.choices.map((c, i) => <button key={c.to} type="button" data-testid={`choice-${i + 1}`} onClick={() => go(c.to, c.set)} className="border border-[#1f1f1f] px-3 py-2 text-left text-sm hover:bg-[#1f1f1f] hover:text-white">{c.label}</button>)}</div>}
          {(scene.kind === 'next' || (scene.kind === 'game' && gameDone !== null)) && <button type="button" data-testid="next" onClick={() => go(scene.choices[0].to, scene.choices[0].set)} className="border border-[#1f1f1f] bg-[#1f1f1f] px-3 py-1 text-sm text-white">{scene.choices[0].label} ▶</button>}
        </section>

        {id === 'y2-end' && (
          <section className="space-y-1 border border-stone-200 p-3 text-xs" data-testid="effects">
            <p className="font-semibold">最後の面で変わること</p>
            {run.copy !== undefined && <p>書き写せた文字 {run.copy} / 12 → 高度計の正直さ {Math.round((run.copy / 12) * 100)}%（低いほど、高度計に暴落のチャートが重なる）</p>}
            {flagEffects(run.flags).map((t) => <p key={t}>・{t}</p>)}
          </section>
        )}

        <p className="text-[11px] text-stone-500">背景の 4 つ（{ASK_LINES.map((l) => l.key).join('・')}）は、1 回の 1 年目で一つしか聞けません。ほかを聞くには「最初から」。</p>
        {nudge && <MenteNudge reason={nudge} between={hint.between} after={hint.after} onClose={() => setNudge(null)} />}
        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          架空の物語です。チャートは作りもので、実在の銘柄ではありません。<br />
          取引や暮らしのことでつらいときは、ひとりで抱えずに：よりそいホットライン 0120-279-338（24 時間・無料）／いのちの電話 0570-783-556
        </footer>
      </div>
    </main>
  );
}
