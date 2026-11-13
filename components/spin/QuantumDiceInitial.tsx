'use client';

import { useEffect, useState } from 'react';
import { ACCENTS, QUADRANTS, WHITEOUT, blackout, checks, roll, stacking, zOf, type Roles } from '@/lib/blackout';
import type { Source } from '@/lib/quantumWish';

const SAVE = 'chartui-blackout-v1';
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** A small menu header drawn with a set of colour roles, so the two versions can be compared. */
function Preview({ r, title }: { r: Roles; title: string }) {
  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: r.line, background: r.bg, color: r.text }} data-testid={`preview-${title}`}>
      <div className="flex items-center gap-1 border-b px-2 py-1 text-[10px]" style={{ background: r.panel, borderColor: r.line, color: r.sub }}><span className="h-2 w-2 rounded-full bg-[#ff5f57]" /><span className="h-2 w-2 rounded-full bg-[#febc2e]" /><span className="h-2 w-2 rounded-full bg-[#28c840]" /><span className="ml-1">ChartUI {title} — ./menu</span></div>
      <div className="space-y-1 p-2 text-xs">
        <p className="font-semibold">ChartUI <span style={{ color: r.accent }}>{title}</span></p>
        <div className="flex gap-1">{['Cure-API', 'Mente', 'retest'].map((x) => <span key={x} className="border px-1.5 text-[10px]" style={{ borderColor: r.accent, color: r.accent }}>{x}</span>)}</div>
        <p className="text-[10px]" style={{ color: r.sub }}>22 binder · ♞ パーマネントナイト</p>
      </div>
    </div>
  );
}

/**
 * Quantum dice · initial page: tune the whiteout ⇄ blackout colour rules. The dice draws an outcome
 * from a recorded QAOA distribution; its face picks the blackout accent and the same outcome stacks
 * the four quadrants of the blackout screen by z-index.
 */
export default function QuantumDiceInitial({ sources, onClose }: { sources: Source[]; onClose: () => void }) {
  const [srcId, setSrcId] = useState(sources[0]?.id ?? '');
  const src = sources.find((s) => s.id === srcId) ?? sources[0];
  const [res, setRes] = useState<{ k: number; face: number; order: string[] }>({ k: 0, face: 1, order: stacking(0) });
  const [saved, setSaved] = useState(false);
  useEffect(() => { try { const s = JSON.parse(window.localStorage.getItem(SAVE) ?? 'null'); if (s?.face) setRes({ k: s.k, face: s.face, order: stacking(s.k) }); } catch { /* ignore */ } }, []);
  const black = blackout(res.face); const z = zOf(res.order);
  const throwDice = () => { if (!src) return; const u = new Uint32Array(1); crypto.getRandomValues(u); setRes(roll(src.probabilities, u[0] / 2 ** 32)); setSaved(false); };
  const keep = () => { try { window.localStorage.setItem(SAVE, JSON.stringify({ k: res.k, face: res.face, accent: black.accent, order: res.order })); setSaved(true); } catch { /* ignore */ } };
  const bits = src ? res.k.toString(2).padStart(Math.round(Math.log2(src.probabilities.length)), '0') : '';
  // Quadrant boxes overlap a little at the centre so the stacking order is visible; each label sits in its own outer corner.
  const box: Record<string, React.CSSProperties> = { HEADER: { left: '0%', top: '0%' }, 'SIDE MENU': { left: '46%', top: '0%' }, BOTTOM: { left: '0%', top: '46%' }, 'POP UP': { left: '46%', top: '46%' } };

  return (
    <div role="dialog" aria-label="クオンタムダイス イニシャルページ" data-testid="qdice" className="fixed inset-0 z-[160] overflow-y-auto bg-black/80 p-4">
      <div className="mx-auto max-w-4xl space-y-3 rounded-xl border border-violet-300/40 bg-[#0e0b16] p-4 text-sm text-slate-100">
        <div className="flex items-center justify-between"><p className="font-mono text-violet-200">クオンタムダイス · イニシャルページ（ホワイトアウト版 ⇄ ブラックアウト版）</p><button type="button" onClick={onClose} className="rounded border border-white/20 px-2 text-xs">✕</button></div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={srcId} onChange={(e) => setSrcId(e.target.value)} className="rounded border border-white/20 bg-black px-2 py-1 text-xs">{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <button type="button" data-testid="qdice-roll" onClick={throwDice} className="rounded-full bg-violet-300 px-4 py-1 font-semibold text-black">振る</button>
          <span className="text-4xl leading-none" data-testid="qdice-face">{FACES[res.face - 1]}</span>
          <span className="font-mono text-xs" data-testid="qdice-k">観測 k = {res.k}（{bits}）→ 面 {res.face} · アクセント {ACCENTS[res.face - 1]}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Preview r={WHITEOUT} title="ホワイトアウト版" />
            <table className="w-full font-mono text-[11px]"><tbody>{checks(WHITEOUT).map((c) => <tr key={c.role}><td>{c.role}</td><td className="text-right">{c.value.toFixed(2)}</td><td className="text-right">{c.ok ? '✓' : '✗'}</td></tr>)}</tbody></table></div>
          <div className="space-y-1"><Preview r={black} title="ブラックアウト版" />
            <table className="w-full font-mono text-[11px]" data-testid="qdice-checks"><tbody>{checks(black).map((c) => <tr key={c.role}><td>{c.role}</td><td className="text-right">{c.value.toFixed(2)}</td><td className="text-right">{c.ok ? '✓' : '✗'}</td></tr>)}</tbody></table></div>
        </div>
        <div>
          <p className="mb-1 font-mono text-xs text-slate-400">ブラックアウト版の画面 · z-index で四分割（手前から {res.order.join(' > ')}）</p>
          <div className="relative h-64 overflow-hidden rounded border" style={{ background: black.bg, borderColor: black.line }} data-testid="qdice-quadrants">
            {QUADRANTS.map((q) => (
              <div key={q} data-testid={`quad-${q}`} data-z={z[q]} className={`absolute flex h-[54%] w-[54%] justify-between rounded border-2 p-2 font-mono text-xs shadow-[0_6px_18px_rgba(0,0,0,.6)] ${q === 'SIDE MENU' || q === 'POP UP' ? 'items-end text-right' : 'items-start'} ${q === 'BOTTOM' || q === 'POP UP' ? 'flex-col-reverse' : 'flex-col'}`} style={{ ...box[q], zIndex: z[q], background: z[q] === 40 ? '#1f1d1c' : black.panel, borderColor: z[q] === 40 ? black.accent : '#4a4744', color: black.text }}>
                <span style={{ color: z[q] === 40 ? black.accent : black.text }}>{q} <span className="text-[10px]" style={{ color: black.sub }}>z-index {z[q]}</span></span>
                <span />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" data-testid="qdice-keep" onClick={keep} className="rounded border border-violet-300/60 px-3 py-1 text-xs">このブラックアウト版で準備する</button>
          {saved && <span className="text-xs text-emerald-300">保存しました（このブラウザ）</span>}
          <span className="ml-auto text-[10px] text-slate-500">結果は記録された量子の結果の確率で重みづけし、ブラウザの乱数で引きます。</span>
        </div>
      </div>
    </div>
  );
}
