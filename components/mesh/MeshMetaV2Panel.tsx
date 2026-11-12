'use client';

import { useEffect, useState } from 'react';
import { build, newTestKey, signEd25519, verify, type MeshMetaV2, type Report } from '@/lib/meshMetaV2';
import type { Tri, V3 } from '@/lib/meshMeta';

type Tamper = 'none' | 'flip' | 'move' | 'stranger';
const TAMPER: Record<Tamper, string> = { none: 'そのまま', flip: 'STL の 1 ビットを反転', move: 'ポインター A の位置を 1 つずらす', stranger: '知らない鍵だけを信頼する' };

function Light({ ok, label, testid }: { ok: boolean | null; label: string; testid?: string }) {
  const c = ok === null ? '#94a3b8' : ok ? '#22c55e' : '#ef4444';
  return (
    <span data-testid={testid} data-ok={ok === null ? 'unknown' : String(ok)} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]" style={{ borderColor: `${c}88`, background: `${c}22` }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{label}{ok === null ? ' ?' : ok ? ' ✓' : ' ✗'}
    </span>
  );
}

const save = (name: string, data: BlobPart, type: string) => { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };

/**
 * .meshmeta v2 check for the mesh on screen: builds the v2 file (Merkle root and a proof per
 * pointer), signs it with a throw-away Ed25519 key made in this page, verifies it, and shows each
 * check in green or red. Tamper buttons show what turns red. You can also check your own pair.
 */
export default function MeshMetaV2Panel({ vs, ts, sharp, base }: { vs: V3[]; ts: Tri[]; sharp: number | null; base: string }) {
  const [made, setMade] = useState<{ stl: Uint8Array; meta: MeshMetaV2; ms: number } | null>(null);
  const [tamper, setTamper] = useState<Tamper>('none');
  const [report, setReport] = useState<Report | null>(null);
  const [own, setOwn] = useState<{ stl?: Uint8Array; meta?: MeshMetaV2; name?: string; report?: Report; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false; setBusy(true); setReport(null);
    (async () => {
      const t = performance.now(); const b = await build(vs, ts, sharp);
      let meta = b.meta;
      try { meta = await signEd25519(meta, await newTestKey()); setNote(''); } catch { setNote('このブラウザは Web Crypto の Ed25519 に対応していないため、署名なしで検証します'); }
      if (!cancelled) { setMade({ stl: b.stl, meta, ms: performance.now() - t }); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [vs, ts, sharp]);

  useEffect(() => {
    if (!made) return;
    let stl = made.stl; let meta = made.meta; let trusted: string[] | undefined;
    if (tamper === 'flip') { stl = stl.slice(); stl[84 + 20] ^= 1; }
    if (tamper === 'move') { meta = structuredClone(meta); const p = meta.pointers[0]; p.index = (p.index + 1) % meta.triangles; p.start = 84 + 50 * p.index; }
    if (tamper === 'stranger') trusted = ['00'.repeat(32)];
    void verify(stl, meta, trusted).then(setReport);
  }, [made, tamper]);

  const loadOwn = async (files: FileList | null) => {
    if (!files) return; const next = { ...own };
    for (const f of Array.from(files)) {
      if (/\.stl$/i.test(f.name)) next.stl = new Uint8Array(await f.arrayBuffer());
      else { try { next.meta = JSON.parse(await f.text()) as MeshMetaV2; next.name = f.name; } catch { next.error = `${f.name} は JSON として読めません`; } }
    }
    if (next.stl && next.meta) {
      if (next.meta.version !== '2.0') next.error = 'v2 の .meshmeta ではありません（version が 2.0 でない）';
      else { next.error = undefined; next.report = await verify(next.stl, next.meta); }
    }
    setOwn(next);
  };

  const r = report; const meta = made?.meta;
  return (
    <section aria-label=".meshmeta v2" className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs backdrop-blur" data-testid="v2-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">.meshmeta v2 の検証 <span className="font-normal text-slate-400">（Merkle 根・ポインターごとの証明・署名）</span></p>
        <span className="font-mono text-slate-400">{busy ? '作成中…' : made ? `${made.meta.triangles} 三角形 · ${made.ms.toFixed(0)} ms` : ''}</span>
      </div>
      {meta && r && (
        <>
          <div className="flex flex-wrap gap-2" data-testid="v2-summary">
            <Light ok={r.ok} label="総合" testid="v2-ok" />
            <Light ok={r.stl_sha256} label="STL の SHA-256" />
            <Light ok={r.merkle_root} label="Merkle 根" />
            <Light ok={r.pointers.every(Boolean)} label={`ポインター ${r.pointers.filter(Boolean).length}/${r.pointers.length}`} />
            {r.signatures.map((s, i) => <Light key={i} ok={s} label={`署名 ${meta.signatures[i]?.alg ?? ''}`} />)}
            {!r.signatures.length && <Light ok={null} label="署名なし" />}
          </div>
          <div className="flex flex-wrap gap-1" data-testid="v2-pointers">
            {meta.pointers.map((p, i) => (
              <span key={`${p.part}-${p.rank}`} title={`${p.part} ${p.rank} index ${p.index} · 証明 ${p.proof.length} 段`} className="rounded px-1.5 py-0.5 font-mono text-[10px] text-black" style={{ background: r.pointers[i] ? '#86efac' : '#fca5a5' }}>
                {p.part.replace('MeshPart_', 'P')}·{p.label}
              </span>
            ))}
          </div>
          <p className="break-all font-mono text-[10px] text-slate-400">root {meta.merkle.root}</p>
        </>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-slate-400">改ざんを試す：</span>
        {(Object.keys(TAMPER) as Tamper[]).map((k) => (
          <button key={k} type="button" data-testid={`tamper-${k}`} onClick={() => setTamper(k)} aria-pressed={tamper === k} className="rounded-full border px-2 py-0.5" style={{ borderColor: tamper === k ? '#f5c542' : '#ffffff33' }}>{TAMPER[k]}</button>
        ))}
      </div>
      {note && <p className="text-amber-300">{note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {made && <button type="button" onClick={() => save(`${base}.v2.meshmeta`, JSON.stringify(made.meta, null, 2), 'application/json')} className="rounded-full bg-[#a78bfa] px-3 py-1 font-semibold text-black">{base}.v2.meshmeta を保存</button>}
        <label className="cursor-pointer rounded-full border border-white/20 px-3 py-1">手持ちの .stl と v2 .meshmeta を検証<input type="file" multiple accept=".stl,.meshmeta,.json" className="hidden" data-testid="v2-own" onChange={(e) => void loadOwn(e.target.files)} /></label>
        {own.error && <span className="text-amber-300">{own.error}</span>}
        {own.report && <Light ok={own.report.ok} label={`${own.name} の総合`} testid="v2-own-ok" />}
      </div>
      <p className="text-slate-500">署名の鍵は、このページを開くたびにブラウザの中で作る試験用のものです（保存も送信もしません）。テストネットのコントラクトとウォレットの EIP-712 署名は、まだです（docs/meshmeta-README.md）。</p>
    </section>
  );
}
