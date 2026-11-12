'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BPM, EMOJI20, GLYPH, POCKETS, TAPS, drawPair, drawPocket, pocketWeights, readRhythm, recordId, rhythmEmoji, fromEmoji20, sha256, signRecord, verifyRecord, type QRecord, type Rhythm, type Source } from '@/lib/quantumWish';

// Keep one signing key per browser in IndexedDB; the private half is not extractable.
function idb<T>(op: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('chartui-q', 1); open.onupgradeneeded = () => open.result.createObjectStore('keys');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const tx = open.result.transaction('keys', mode); const req = op(tx.objectStore('keys')); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); };
  });
}
async function myKey(): Promise<CryptoKeyPair> {
  try { const k = await idb<CryptoKeyPair | undefined>((s) => s.get('signer') as IDBRequest<CryptoKeyPair | undefined>, 'readonly'); if (k) return k; } catch { /* no IndexedDB: fall through */ }
  const k = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  try { await idb((s) => s.put(k, 'signer'), 'readwrite'); } catch { /* keep it for this visit only */ }
  return k;
}
const LAST = 'chartui-q-last-v1';

/** The animator from strata a/b: a virtual icon who hands you back to trading. */
function Animator({ line }: { line: string }) {
  return (
    <div className="flex items-center gap-3" data-testid="animator">
      <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" aria-label="地層 ab のスーパーアニメーター">
        <rect x="6" y="10" width="52" height="44" rx="10" fill="#1f1530" stroke="#c4b5fd" />
        <path d="M6 30 Q32 22 58 30 L58 40 Q32 32 6 40 Z" fill="#a78bfa55" /><path d="M6 40 Q32 32 58 40 L58 54 L6 54 Z" fill="#f9a8d433" />
        <text x="12" y="27" fontSize="8" fill="#c4b5fd" fontFamily="monospace">a</text><text x="12" y="50" fontSize="8" fill="#f9a8d4" fontFamily="monospace">b</text>
        <circle cx="24" cy="20" r="3.5" fill="#fff" /><circle cx="40" cy="20" r="3.5" fill="#fff" /><circle cx="25" cy="20" r="1.6" fill="#111" /><circle cx="41" cy="20" r="1.6" fill="#111" />
        <path d="M44 6 l6 -4 M50 10 l6 -2" stroke="#fde68a" strokeWidth="1.5" />
      </svg>
      <p className="rounded-lg border border-violet-300/30 bg-black/30 px-3 py-2">{line}</p>
    </div>
  );
}

/**
 * Hidden game: wish on a quantum result. Tap a rhythm, spin the 22-pocket roulette (drawn from the
 * recorded QAOA distribution), and keep the wish as a signed .q file chained to the previous one.
 * Type the glyph into the wish to unlock two balls (a Bell pair with two dials).
 */
export default function QuantumWish({ sources }: { sources: Source[] }) {
  const [srcId, setSrcId] = useState(sources[0]?.id ?? '');
  const src = sources.find((s) => s.id === srcId) ?? sources[0];
  const [wish, setWish] = useState('');
  const [where, setWhere] = useState('図書館の入口');
  const twoBalls = wish.includes(GLYPH) || wish.includes('{:}{:}');
  const [dials, setDials] = useState({ a: 0, b: Math.PI / 3 });
  const [taps, setTaps] = useState<number[]>([]);
  const [rhythm, setRhythm] = useState<Rhythm | null>(null);
  const [spin, setSpin] = useState<{ a: number; b: number | null; t0: number; same?: boolean } | null>(null);
  const [now, setNow] = useState(0);
  const [record, setRecord] = useState<{ r: QRecord; id: string } | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ name: string; ok: boolean } | null>(null);
  const raf = useRef(0);
  const weights = useMemo(() => (src ? pocketWeights(src) : Array(POCKETS).fill(1 / POCKETS)), [src]);

  useEffect(() => { try { setPrev(window.localStorage.getItem(LAST)); } catch { /* ignore */ } }, []);
  useEffect(() => { const f = (t: number) => { setNow(t); raf.current = requestAnimationFrame(f); }; raf.current = requestAnimationFrame(f); return () => cancelAnimationFrame(raf.current); }, []);

  const tap = () => { const t = performance.now(); const next = [...taps, t].slice(-TAPS); setTaps(next); if (next.length === TAPS) setRhythm(readRhythm(next)); };
  const go = async () => {
    if (!src || !rhythm) return;
    const u = new Uint32Array(2); crypto.getRandomValues(u); const u1 = u[0] / 2 ** 32; const u2 = u[1] / 2 ** 32;
    const pair = twoBalls ? drawPair(src, dials.a, dials.b, u1, u2) : null; const single = drawPocket(src, u1);
    const a = pair ? pair.a : single.pocket; const b = pair ? pair.b : null;
    setSpin({ a, b, t0: performance.now(), same: pair?.same }); setRecord(null);
    const result = new TextEncoder().encode(JSON.stringify(src.probabilities));
    const draft: QRecord = {
      q: '1', glyph: GLYPH, founders: { 'emoji進数': 'オープンソース', 'emoji20進数': 'オープンソース++' },
      when: new Date().toISOString(), where, quantum: { problem: src.id.split('-')[0], source: src.id, backend: src.label, result_sha256: Array.from(await sha256(result), (x) => x.toString(16).padStart(2, '0')).join('') },
      wish: wish || '（無言の願い）', a: `(${a})`, b: b === null ? '()' : `(${b})`, angles: twoBalls ? { a: Math.round(dials.a * 1000), b: Math.round(dials.b * 1000) } : null, // milliradians: the signed JSON allows integers only
      rhythm: { bpm: BPM, steps: rhythm.steps, emoji: rhythmEmoji(rhythm.steps), score: rhythm.score, offsets_ms: rhythm.offsetsMs }, next: prev,
    };
    try { const signed = await signRecord(draft, await myKey()); const id = await recordId(signed); setRecord({ r: signed, id }); setPrev(id); try { window.localStorage.setItem(LAST, id); } catch { /* ignore */ } }
    catch (e) { setRecord({ r: draft, id: `（署名できませんでした：${(e as Error).message}）` }); }
  };
  // File names stay plain hex: no emoji in file names (CONTRIBUTING).
  const save = () => { if (!record) return; const url = URL.createObjectURL(new Blob([JSON.stringify(record.r, null, 2)], { type: 'application/json' })); const el = document.createElement('a'); el.href = url; el.download = `wish-${Array.from(fromEmoji20(record.id).slice(0, 4), (x) => x.toString(16).padStart(2, '0')).join('')}.q`; document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url); };
  const check = async (f?: File) => { if (!f) return; try { const r = JSON.parse(await f.text()) as QRecord; const ok = await verifyRecord(r); setChecked({ name: f.name, ok }); if (ok) { const id = await recordId(r); setPrev(id); } } catch { setChecked({ name: f.name, ok: false }); } };

  // Ball positions: orbit fast, slow down, settle on the pocket over 2.6 s.
  const k = spin ? Math.min(1, (now - spin.t0) / 2600) : 0; const ease = 1 - (1 - k) ** 3;
  const ballAngle = (pocket: number, phase: number) => ((pocket + 0.5) / POCKETS) * Math.PI * 2 + (1 - ease) * (6 * Math.PI + phase) - Math.PI / 2;
  const landed = spin && k >= 1;
  const beat = (now / (60000 / BPM)) % 1;

  return (
    <div className="space-y-3 rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/[0.04] p-3" data-testid="wish">
      <p className="font-mono text-[11px] text-fuchsia-200">{GLYPH}　·　量子に願いをかける（.q）　·　クオンタムファイル OS の創設者：emoji 進数 オープンソース ／ emoji 20 進数 オープンソース++</p>
      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <svg viewBox="-110 -110 220 220" className="h-[260px] w-[260px]" data-testid="roulette" aria-label="22 区画のルーレット">
          {Array.from({ length: POCKETS }, (_, i) => { const a0 = (i / POCKETS) * Math.PI * 2 - Math.PI / 2; const a1 = ((i + 1) / POCKETS) * Math.PI * 2 - Math.PI / 2; const w = weights[i];
            const hit = landed && (spin?.a === i || spin?.b === i);
            return (<g key={i}><path d={`M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 0 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`} fill={hit ? '#f0abfc' : `rgba(196,181,253,${0.08 + Math.min(0.75, w * 6)})`} stroke="#0b0614" strokeWidth="1" />
              <text x={84 * Math.cos((a0 + a1) / 2)} y={84 * Math.sin((a0 + a1) / 2) + 3} textAnchor="middle" fontSize="8" fill="#0b0614" fontFamily="monospace">{i}</text></g>);
          })}
          <circle r="46" fill="#0b0614" stroke="#c4b5fd55" />
          <text y="-6" textAnchor="middle" fontSize="9" fill="#c4b5fd">{landed ? `a = (${spin?.a})` : spin ? '観測中…' : 'a="()"'}</text>
          <text y="10" textAnchor="middle" fontSize="9" fill="#f9a8d4">{twoBalls ? (landed ? `b = (${spin?.b})` : 'b="()"') : 'b="()"'}</text>
          {spin && [0, ...(spin.b !== null ? [1] : [])].map((j) => { const p = j ? (spin.b as number) : spin.a; const ang = ballAngle(p, j * 1.3); const r = 66 + (1 - ease) * 22; return <circle key={j} cx={r * Math.cos(ang)} cy={r * Math.sin(ang)} r="6" fill={j ? '#f9a8d4' : '#fff'} stroke="#0b0614" />; })}
        </svg>
        <div className="space-y-2 text-xs">
          <label className="block">願い<input data-testid="wish-text" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="例：花が三本の主枝で立ちますように" className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1" /></label>
          <label className="block">どこで<input value={where} onChange={(e) => setWhere(e.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1" /></label>
          <label className="block">どの量子に<select value={srcId} onChange={(e) => setSrcId(e.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black/60 px-2 py-1">{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          {twoBalls && (
            <div className="rounded border border-pink-300/40 p-2" data-testid="two-balls">
              <p className="text-pink-200">2 球モード（もつれた 2 つの球）。2 つのダイヤルの角度の差で、同じ区画に落ちる確率 cos²(差/2) が決まります：{(Math.cos((dials.a - dials.b) / 2) ** 2 * 100).toFixed(0)}%</p>
              {(['a', 'b'] as const).map((d) => <label key={d} className="flex items-center gap-2 font-mono">θ{d} {(dials[d] * 180 / Math.PI).toFixed(0)}°<input type="range" min={0} max={Math.PI} step={0.01} value={dials[d]} onChange={(e) => setDials({ ...dials, [d]: Number(e.target.value) })} /></label>)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid="tap" onClick={tap} className="h-14 w-14 rounded-full border-2 border-fuchsia-300 font-mono" style={{ boxShadow: `0 0 0 ${3 + 3 * (1 - beat)}px rgba(240,171,252,.25)` }}>叩く</button>
            <span className="font-mono">{taps.length}/{TAPS} · {BPM} BPM の 4 拍に 8 回</span>
            {rhythm && <span className="font-mono" data-testid="rhythm">{rhythm.steps} {rhythmEmoji(rhythm.steps)} · {rhythm.score} 点 · {rhythm.judges.map((j) => j[0]).join('')}</span>}
          </div>
          <button type="button" data-testid="observe" onClick={() => void go()} disabled={!rhythm || (!!spin && !landed)} className="rounded-full bg-fuchsia-300 px-4 py-1 font-semibold text-black disabled:opacity-40">観測する（ルーレットを回す）</button>
          {!rhythm && <span className="ml-2 text-slate-400">先にリズムを 8 回叩いてください</span>}
        </div>
      </div>
      {landed && record && (
        <div className="space-y-2 text-xs" data-testid="q-record">
          <p className="font-mono">.q の名前（署名した中身の SHA-256 を emoji 20 進数で）：<span className="break-all">{record.id}</span></p>
          <p className="text-slate-400">いつ {record.r.when} · どこで {record.r.where} · どの量子 {record.r.quantum.backend} · {record.r.a} {record.r.b}{spin?.same !== undefined ? (spin.same ? ' · 2 球は同じ区画に' : ' · 2 球は向かい合わせに') : ''} · 前の願い {record.r.next ? `${record.r.next.slice(0, 12)}…` : 'なし（最初の願い）'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} className="rounded-full border border-fuchsia-300/60 px-3 py-1">.q を保存</button>
            <label className="cursor-pointer rounded-full border border-white/20 px-3 py-1">.q を読み込んで確かめる（次の願いの前にする）<input type="file" accept=".q,.json" className="hidden" onChange={(e) => void check(e.target.files?.[0])} /></label>
            {checked && <span style={{ color: checked.ok ? '#86efac' : '#fca5a5' }}>{checked.name}：{checked.ok ? '署名 OK — 次の願いはこれにつながる' : '署名が合わない'}</span>}
          </div>
          <Animator line={`地層 ab のスーパーアニメーター：「区画 ${spin?.a} は ${'ABCD'[(spin?.a ?? 0) % 4]} 車の列。願いは .q に刻んだ。取引の続きは、あの車の背中から。」`} />
          <Link href={`/oracle-api/race?focus=${(spin?.a ?? 0) % 4}`} data-testid="resume" className="inline-block rounded-full bg-violet-300 px-3 py-1 font-semibold text-black">取引の続きへ（{'ABCD'[(spin?.a ?? 0) % 4]} 車のカメラ）</Link>
        </div>
      )}
      <p className="text-[10px] text-slate-500">区画は、記録された量子の結果の確率で重みづけして、ブラウザの乱数で引きます（本物の QPU の乱数そのものではありません）。署名の鍵はこのブラウザの中だけにあります。emoji 20 進数の数字：{EMOJI20.join('')}（🌑 が 0）。</p>
    </div>
  );
}
