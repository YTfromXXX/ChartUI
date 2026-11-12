'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import MeshMetaV2Panel from '@/components/mesh/MeshMetaV2Panel';
import { LABELS, analyse, readPointer, readStl, sampleScene, type Analysis, type V3 } from '@/lib/meshMeta';

const glass = 'rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur';
const PART_COLORS = ['#ff6b3d', '#22d3a6', '#7c6cff', '#f5c542', '#ff4f8b', '#3dd6ff', '#9be15d', '#e879f9'];
const LABEL_COLORS = ['#ffffff', '#ffe066', '#7ef9ff', '#ff9ad5'];

function save(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fmt = (v: V3) => `(${v.map((x) => x.toFixed(3)).join(', ')})`;

/**
 * Mesh parts and best triangles. Split a mesh into parts, score every triangle by q = 2r/R
 * (1 = equilateral), and keep the best four per part as A–D. The result is a binary STL plus a
 * .meshmeta JSON whose emoji pointers address each triangle's 36 bytes in that STL; the table reads
 * every pointer back from the bytes to prove it.
 */
export default function MeshLabPage() {
  const [source, setSource] = useState(() => ({ name: 'sample', ...sampleScene() }));
  const [sharp, setSharp] = useState<number | null>(40);
  const [selected, setSelected] = useState(0);
  const [heat, setHeat] = useState(false);
  const [error, setError] = useState('');
  const { result, ms } = useMemo(() => { const t = performance.now(); const r: Analysis = analyse(source.vs, source.ts, sharp); return { result: r, ms: performance.now() - t }; }, [source, sharp]);
  const sel = Math.min(selected, result.parts.length - 1);

  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return undefined;
    const w = mount.clientWidth; const h = 420;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(w, h);
    mount.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#070a12');
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.8;
    scene.add(new THREE.HemisphereLight('#ffffff', '#202030', 1.1)); const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(3, 5, 2); scene.add(sun);

    const { vs, ts, parts, tops } = result;
    const partOf = new Int32Array(ts.length); parts.forEach((p, i) => p.forEach((t) => { partOf[t] = i; }));
    const topRank = new Map<number, number>(); tops.forEach((top) => top.forEach(({ t }, i) => topRank.set(t, i)));
    const quality = new Map<number, number>(); tops.forEach((top) => top.forEach(({ t, q }) => quality.set(t, q)));
    const pos = new Float32Array(ts.length * 9); const col = new Float32Array(ts.length * 9); const c = new THREE.Color();
    ts.forEach((tri, t) => {
      tri.forEach((vi, k) => { pos.set(vs[vi], t * 9 + k * 3); });
      if (heat) { const [a, b, d] = tri.map((i) => vs[i]); const q = quality.get(t) ?? qualityOf(a, b, d); c.setHSL(q * 0.33, 0.85, 0.5); }
      else { c.set(PART_COLORS[partOf[t] % PART_COLORS.length]); c.multiplyScalar(partOf[t] === sel ? 1 : 0.45); }
      if (topRank.has(t) && (partOf[t] === sel || heat)) c.set(LABEL_COLORS[topRank.get(t)!]);
      for (let k = 0; k < 3; k += 1) col.set([c.r, c.g, c.b], t * 9 + k * 3);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.1 }));
    scene.add(mesh);
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35 })); scene.add(wire);
    geo.computeBoundingSphere(); const bs = geo.boundingSphere!;
    camera.position.set(bs.center.x + bs.radius * 1.6, bs.center.y + bs.radius * 1.1, bs.center.z + bs.radius * 1.9); controls.target.copy(bs.center);

    // Label anchors: centroids of the selected part's A–D.
    const anchors = (tops[sel] ?? []).map(({ t }) => { const [a, b, d] = ts[t].map((i) => vs[i]); return new THREE.Vector3((a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3); });
    let raf = 0; const v = new THREE.Vector3();
    const loop = () => {
      controls.update(); renderer.render(scene, camera);
      anchors.forEach((p, i) => {
        const el = labelRefs.current[i]; if (!el) return;
        v.copy(p).project(camera); const visible = v.z < 1;
        el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, calc(-140% - ${i * 20}px))`; el.style.opacity = visible ? '1' : '0';
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); controls.dispose(); geo.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [result, sel, heat]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { const { vs, ts } = readStl(await f.arrayBuffer()); if (!ts.length) throw new Error('三角形が見つかりませんでした'); setError(''); setSelected(0); setSource({ name: f.name.replace(/\.stl$/i, ''), vs, ts }); }
    catch (e) { setError(`STL を読めませんでした：${(e as Error).message}`); }
  };
  const base = source.name.replace(/[^\w.-]+/g, '_') || 'mesh';
  const metaText = JSON.stringify(result.meta, null, 2);
  const partKeys = Object.keys(result.meta);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#14324a,#05070d_70%)] px-4 py-5 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-cyan-300/80">LAB · MESH PARTS & BEST TRIANGLES</p>
            <h1 className="text-2xl font-semibold">メッシュの部品分割と、正三角形に近い三角形 A〜D</h1>
            <p className="text-xs text-slate-400">品質 q = 2r ÷ R（内接円の半径 r、外接円の半径 R）。正三角形で 1.000、つぶれるほど 0 へ。</p>
          </div>
          <nav className="flex gap-2 text-xs"><Link href="/lab/silicon" className={`${glass} px-3 py-1`}>シリコン LAB</Link><Link href="/lab/colorcube" className={`${glass} px-3 py-1`}>博物館</Link></nav>
        </header>

        <section aria-label="Controls" className={`${glass} flex flex-wrap items-center gap-3 p-3 text-xs`}>
          <button type="button" onClick={() => { setSelected(0); setSource({ name: 'sample', ...sampleScene() }); }} className="rounded-full border border-white/20 px-3 py-1">見本（球・円柱・ゆがんだ板）</button>
          <label className="cursor-pointer rounded-full border border-white/20 px-3 py-1">STL を選ぶ<input aria-label="STL file" type="file" accept=".stl" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} /></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={sharp !== null} onChange={(e) => setSharp(e.target.checked ? 40 : null)} /> 鋭い辺でも分ける</label>
          {sharp !== null && <label className="flex items-center gap-1">しきい角 <input aria-label="Sharp angle" type="range" min={10} max={90} value={sharp} onChange={(e) => setSharp(Number(e.target.value))} /> {sharp}°</label>}
          <label className="flex items-center gap-1"><input type="checkbox" checked={heat} onChange={(e) => setHeat(e.target.checked)} /> 品質の色（赤＝悪い → 緑＝良い）</label>
          <span className="font-mono text-slate-400" data-testid="summary">{result.ts.length} 三角形 · {result.vs.length} 頂点 · {result.parts.length} 部品 · {ms.toFixed(1)} ms</span>
          {error && <span role="alert" className="text-amber-300">{error}</span>}
        </section>

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div ref={mountRef} className="relative overflow-hidden rounded-xl border border-white/10" aria-label="3D view">
            {LABELS.map((l, i) => (
              <span key={l} ref={(el) => { labelRefs.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-black shadow" style={{ background: LABEL_COLORS[i], display: (result.tops[sel]?.length ?? 0) > i ? 'block' : 'none' }}>No.{i + 1} {l}</span>
            ))}
          </div>
          <section aria-label="Parts" className={`${glass} max-h-[420px] space-y-1 overflow-y-auto p-3 text-xs`}>
            <p className="mb-1 text-[10px] tracking-[0.3em] text-cyan-300/80">PARTS · 部品（三角形の数・いちばん良い q）</p>
            {result.parts.map((p, i) => (
              <button key={partKeys[i]} type="button" onClick={() => setSelected(i)} aria-pressed={i === sel} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${i === sel ? 'bg-white/15' : 'hover:bg-white/5'}`}>
                <span className="h-3 w-3 rounded-sm" style={{ background: PART_COLORS[i % PART_COLORS.length] }} />
                <span className="font-mono">{partKeys[i]}</span><span className="text-slate-400">{p.length} 枚</span>
                <span className="ml-auto font-mono">q {result.tops[i][0]?.q.toFixed(3)}</span>
              </button>
            ))}
          </section>
        </div>

        <section aria-label="Top triangles" className={`${glass} space-y-2 p-3`}>
          <p className="text-sm font-semibold">{partKeys[sel]} の A〜D と、ポインターから読み戻した座標</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]" data-testid="top-table">
              <thead className="text-slate-400"><tr><th className="pr-3">順位</th><th className="pr-3">品質</th><th className="pr-3">Data（⏸️ = STL 内の開始位置、▶️ = 長さ）</th><th>STL のその位置から読んだ 3 頂点</th><th className="pl-2">一致</th></tr></thead>
              <tbody>
                {result.meta[partKeys[sel]]?.Top_Triangles.map((e, i) => {
                  const back = readPointer(result.stl, e.Data); const tri = result.ts[result.tops[sel][i].t].map((k) => result.vs[k]);
                  const ok = back.every((p, k) => p.every((x, j) => Math.abs(x - tri[k][j]) < 1e-5));
                  return (
                    <tr key={e.Rank} className="border-t border-white/5">
                      <td className="pr-3"><span className="rounded px-1 text-black" style={{ background: LABEL_COLORS[i] }}>{e.Rank} {e.Label}</span></td>
                      <td className="pr-3">{e.Quality}</td><td className="pr-3 whitespace-nowrap">{e.Data}</td>
                      <td className="text-slate-300">{back.map(fmt).join(' ')}</td><td className="pl-2" data-testid={`ok-${i}`}>{ok ? '✓' : '✗'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => save(`${base}.stl`, result.stl, 'model/stl')} className="rounded-full bg-[#22d3a6] px-3 py-1 font-semibold text-black">{base}.stl を保存</button>
            <button type="button" onClick={() => save(`${base}.meshmeta`, metaText, 'application/json')} className="rounded-full bg-[#f5c542] px-3 py-1 font-semibold text-black">{base}.meshmeta を保存</button>
            <span className="text-slate-400">2 つは同じ名前で並べて置く。.meshmeta のポインターは、その .stl のバイト位置を指す。</span>
          </div>
          <details className="text-xs"><summary className="cursor-pointer text-slate-300">.meshmeta の中身</summary><pre className="mt-1 max-h-64 overflow-auto rounded bg-black/40 p-2" data-testid="meta-json">{metaText}</pre></details>
        </section>

        <MeshMetaV2Panel vs={source.vs} ts={source.ts} sharp={sharp} base={base} />
      </div>
    </main>
  );
}

function qualityOf(a: V3, b: V3, c: V3) {
  const l = (p: V3, q: V3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const x = l(b, c); const y = l(a, c); const z = l(a, b); const s = (x + y + z) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - x) * (s - y) * (s - z)));
  return x * y * z ? Math.min(1, (8 * area * area) / (s * x * y * z)) : 0;
}
