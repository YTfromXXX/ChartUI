'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BINS, cosine, drawFacade, guessStyle, hueRgb, orientationHist, shares, type StyleGuess } from '@/lib/archStyle';
import { COLS, DIE_H, DIE_W, ROWS, TILE, UNITS, UNIT_INFO, areaShares, paintDie, scanDie, simCredits, type Unit } from '@/lib/dieScan';
import { LoadMeter, TASKS, placeTask, type LoadSample } from '@/lib/loadMeter';

const glass = 'rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur';
const SNAP_COLORS = ['#ff6b3d', '#22d3a6', '#7c6cff', '#f5c542'];
const FW = 160; const FH = 120;
const hex = (h: number) => { const [r, g, b] = hueRgb(h); return `rgb(${r},${g},${b})`; };

/** Polar "rose" of the orientation histogram, mirrored to a full circle; snapshots as outlines. */
function Rose({ hist, snaps }: { hist: number[]; snaps: { hist: number[]; color: string }[] }) {
  const R = 90; const max = Math.max(0.2, ...hist, ...snaps.flatMap((s) => s.hist));
  const petal = (i: number, v: number, k: number) => {
    const a0 = ((i + k * BINS) / (BINS * 2)) * Math.PI * 2 - Math.PI / 2; const a1 = a0 + Math.PI / BINS; const r = (v / max) * R;
    return `M100,100 L${100 + Math.cos(a0) * r},${100 + Math.sin(a0) * r} A${r},${r} 0 0 1 ${100 + Math.cos(a1) * r},${100 + Math.sin(a1) * r} Z`;
  };
  const outline = (h: number[]) => Array.from({ length: BINS * 2 }, (_, j) => { const v = h[j % BINS]; const a = ((j + 0.5) / (BINS * 2)) * Math.PI * 2 - Math.PI / 2; const r = (v / max) * R; return `${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px]" role="img" aria-label="Orientation rose">
      {[0.33, 0.66, 1].map((f) => <circle key={f} cx={100} cy={100} r={R * f} fill="none" stroke="#ffffff22" />)}
      {[0, 1].flatMap((k) => hist.map((v, i) => <path key={`${k}-${i}`} d={petal(i, v, k)} fill={hex(i / BINS)} opacity={0.85} />))}
      {snaps.map((s) => <polygon key={s.color} points={outline(s.hist)} fill="none" stroke={s.color} strokeWidth={1.6} />)}
      <text x={100} y={10} textAnchor="middle" fontSize={8} fill="#cbd5e1">垂直の輪郭</text>
      <text x={196} y={103} textAnchor="end" fontSize={8} fill="#cbd5e1">水平の輪郭</text>
    </svg>
  );
}

export default function SiliconLabPage() {
  // ---------- A. Architecture MR filter ----------
  const viewRef = useRef<HTMLCanvasElement>(null); const videoRef = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<'sample' | 'camera' | 'image'>('sample');
  const [sample, setSample] = useState<StyleGuess['key']>('gothic');
  const [hist, setHist] = useState<number[]>(new Array(BINS).fill(1 / BINS));
  const [guess, setGuess] = useState<StyleGuess | null>(null);
  const [snaps, setSnaps] = useState<{ label: string; hist: number[]; color: string }[]>([]);
  const [camError, setCamError] = useState('');
  const [archMs, setArchMs] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const analyse = useCallback((draw: (ctx: CanvasRenderingContext2D) => void) => {
    const view = viewRef.current; if (!view) return;
    const small = document.createElement('canvas'); small.width = FW; small.height = FH; const s = small.getContext('2d', { willReadFrequently: true })!;
    draw(s);
    const t = performance.now();
    const frame = s.getImageData(0, 0, FW, FH); const over = new ImageData(FW, FH);
    const res = orientationHist(frame.data, FW, FH, 60, over.data);
    setArchMs(performance.now() - t);
    const v = view.getContext('2d')!; v.imageSmoothingEnabled = true;
    v.filter = 'brightness(.45) saturate(.6)'; v.drawImage(small, 0, 0, view.width, view.height); v.filter = 'none';
    const o = document.createElement('canvas'); o.width = FW; o.height = FH; o.getContext('2d')!.putImageData(over, 0, 0);
    v.globalCompositeOperation = 'lighter'; v.drawImage(o, 0, 0, view.width, view.height); v.globalCompositeOperation = 'source-over';
    setHist(res.hist); setGuess(guessStyle(res.hist));
  }, []);

  useEffect(() => { if (source === 'sample') analyse((ctx) => drawFacade(ctx, sample, FW, FH)); }, [source, sample, analyse]);
  useEffect(() => {
    if (source !== 'camera') return undefined;
    let stream: MediaStream | null = null; let raf = 0; let last = 0; let alive = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 }, audio: false })
      .then((st) => {
        if (!alive) { st.getTracks().forEach((tr) => tr.stop()); return; }
        stream = st; const v = videoRef.current!; v.srcObject = st; void v.play();
        const loop = (now: number) => { if (now - last > 66 && v.readyState >= 2) { last = now; analyse((ctx) => ctx.drawImage(v, 0, 0, FW, FH)); } raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
      })
      .catch(() => setCamError('カメラを使えませんでした（許可・HTTPS・端末を確認）。見本かファイルで試せます。'));
    return () => { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((tr) => tr.stop()); };
  }, [source, analyse]);

  const onImage = (f: File | undefined) => {
    if (!f) return;
    const img = new Image(); img.onload = () => { imageRef.current = img; setSource('image'); analyse((ctx) => ctx.drawImage(img, 0, 0, FW, FH)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };
  const snap = () => setSnaps((ss) => [...ss.slice(-(SNAP_COLORS.length - 1)), { label: source === 'sample' ? sample : `${source} ${ss.length + 1}`, hist, color: '' }].map((x, i) => ({ ...x, color: SNAP_COLORS[i] })));
  const sh = shares(hist);

  // ---------- B. Die scan ----------
  const dieRef = useRef<HTMLCanvasElement>(null);
  const dieImage = useRef<HTMLCanvasElement | null>(null);
  const [truth, setTruth] = useState<Unit[] | null>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [scanT, setScanT] = useState(1);
  const [dieMm2, setDieMm2] = useState(120);
  const [scanMs, setScanMs] = useState(0);
  const [seed, setSeed] = useState(7);

  useEffect(() => {
    const c = document.createElement('canvas'); c.width = DIE_W; c.height = DIE_H;
    setTruth(paintDie(c.getContext('2d')!, seed)); dieImage.current = c; setUnits(null); setScanT(1);
  }, [seed]);
  const onDie = (f: File | undefined) => {
    if (!f) return;
    const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); c.width = DIE_W; c.height = DIE_H; c.getContext('2d')!.drawImage(img, 0, 0, DIE_W, DIE_H);
      dieImage.current = c; setTruth(null); setUnits(null); URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  const scan = () => {
    const c = dieImage.current; if (!c) return;
    const t = performance.now(); const res = scanDie(c.getContext('2d')!.getImageData(0, 0, DIE_W, DIE_H).data); setScanMs(performance.now() - t);
    setUnits(res.units); setScanT(0);
  };
  useEffect(() => { // sweep animation
    if (scanT >= 1) return undefined;
    const id = requestAnimationFrame(() => setScanT((v) => Math.min(1, v + 0.02)));
    return () => cancelAnimationFrame(id);
  }, [scanT]);
  const shareMap = units ? areaShares(units) : null;
  const accuracy = units && truth ? units.filter((u, i) => u === truth[i]).length / units.length : null;
  const credits = shareMap ? simCredits(shareMap, dieMm2) : null;
  const mistakes = units && truth ? Object.entries(units.reduce<Record<string, number>>((acc, u, i) => { if (u !== truth[i]) { const k = `${UNIT_INFO[truth[i]].name} → ${UNIT_INFO[u].name}`; acc[k] = (acc[k] ?? 0) + 1; } return acc; }, {})).sort((a, b) => b[1] - a[1]) : [];

  // ---------- C. Activity monitor ----------
  const meter = useRef<LoadMeter | null>(null);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<LoadSample[]>([]);
  const [cpuStress, setCpuStress] = useState(0); const [gpuStress, setGpuStress] = useState(false);
  const [gpuInfo, setGpuInfo] = useState({ ok: true, soft: false });
  const latest = samples[samples.length - 1] ?? { cpu: 0, gpu: 0, cpuMs: 0, gpuMs: 0, t: 0 };
  const loads = useRef({ cpu: 0, gpu: 0 }); loads.current = { cpu: latest.cpu, gpu: latest.gpu };
  const toggleMeter = () => {
    if (running) { meter.current?.stop(); meter.current = null; setRunning(false); setCpuStress(0); setGpuStress(false); return; }
    const m = new LoadMeter((s) => setSamples((ss) => [...ss.slice(-149), s])); m.start(); meter.current = m;
    setGpuInfo({ ok: m.gpuAvailable, soft: m.softwareGpu }); setSamples([]); setRunning(true);
  };
  useEffect(() => { meter.current?.setCpuStress(cpuStress); }, [cpuStress]);
  useEffect(() => { meter.current?.setGpuStress(gpuStress); }, [gpuStress]);
  useEffect(() => () => meter.current?.stop(), []);

  // Die canvas: scan overlay (B) and live heat + task symbols (C) in one animation.
  const view = useRef({ units, scanT, running }); view.current = { units, scanT, running };
  useEffect(() => {
    const c = dieRef.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return undefined;
    const centroid = (u: Unit, us: Unit[]) => { let x = 0; let y = 0; let n = 0; us.forEach((k, i) => { if (k === u) { x += (i % COLS) + 0.5; y += Math.floor(i / COLS) + 0.5; n += 1; } }); return n ? { x: (x / n) * TILE, y: (y / n) * TILE } : { x: DIE_W / 2, y: DIE_H / 2 }; };
    const pos = TASKS.map(() => ({ x: DIE_W / 2, y: DIE_H / 2 }));
    let raf = 0;
    const frame = (now: number) => {
      const sec = now / 1000; const { units: us, scanT: st, running: run } = view.current;
      ctx.globalAlpha = 1; ctx.filter = run ? 'brightness(.55)' : 'none';
      if (dieImage.current) ctx.drawImage(dieImage.current, 0, 0); ctx.filter = 'none';
      if (us) {
        const sweepRow = st * ROWS;
        us.forEach((u, i) => {
          const tx = i % COLS; const ty = Math.floor(i / COLS); if (ty > sweepRow) return;
          let a = 0.32;
          if (run) {
            const l = u === 'cpu' ? loads.current.cpu : u === 'gpu' ? loads.current.gpu : u === 'sram' ? (loads.current.cpu + loads.current.gpu) / 2 : u === 'io' ? 0.25 : 0;
            a = 0.12 + 0.7 * l * (0.75 + 0.25 * Math.sin(sec * 6 + tx * 0.7 + ty * 0.9));
          }
          ctx.globalAlpha = a; ctx.fillStyle = UNIT_INFO[u].color; ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
        });
        ctx.globalAlpha = 1;
        if (st < 1) { const y = sweepRow * TILE; const g = ctx.createLinearGradient(0, y - 40, 0, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.7)'); ctx.fillStyle = g; ctx.fillRect(0, y - 40, DIE_W, 40); }
        if (run) {
          const home = { cpu: centroid('cpu', us), gpu: centroid('gpu', us) };
          TASKS.forEach((task, i) => {
            const side = placeTask(task.aff, loads.current.cpu, loads.current.gpu); const h = home[side];
            const tx = h.x + Math.cos(i * 0.8 + sec * 0.6) * 46; const ty = h.y + Math.sin(i * 1.3 + sec * 0.5) * 34;
            pos[i].x += (tx - pos[i].x) * 0.06; pos[i].y += (ty - pos[i].y) * 0.06;
          });
          ctx.lineWidth = 1; // symbols sharing a side are linked: symbiosis
          for (let i = 0; i < TASKS.length; i += 1) for (let j = i + 1; j < TASKS.length; j += 1) {
            const d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y); if (d > 90) continue;
            ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - d / 90)})`; ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y); ctx.stroke();
          }
          TASKS.forEach((task, i) => {
            ctx.fillStyle = hex(i / TASKS.length); ctx.beginPath(); ctx.arc(pos[i].x, pos[i].y, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0b0b10'; ctx.font = 'bold 15px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(task.sym, pos[i].x, pos[i].y + 1);
          });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [truth]);

  const diff = latest.cpu - latest.gpu;
  const CW = 600; const CH = 140;
  const tNow = latest.t; const xOf = (t: number) => CW - (tNow - t) * (CW / 60);
  const yOf = (v: number) => CH / 2 - v * (CH / 2 - 6);
  const vis = samples.filter((s) => tNow - s.t < 60);
  const line = (k: 'cpu' | 'gpu') => vis.map((s) => `${xOf(s.t).toFixed(1)},${(CH - 6 - s[k] * (CH - 12)).toFixed(1)}`).join(' ');
  const gauge = (v: number, label: string, ms: number, c0: string, c1: string) => (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label={`${label} ${(v * 100).toFixed(0)}%`}>
        <defs><linearGradient id={`g-${label}`} x1="0" x2="1"><stop offset="0" stopColor={c0} /><stop offset="1" stopColor={c1} /></linearGradient></defs>
        <circle cx={50} cy={50} r={40} fill="none" stroke="#ffffff14" strokeWidth={10} />
        <circle cx={50} cy={50} r={40} fill="none" stroke={`url(#g-${label})`} strokeWidth={10} strokeLinecap="round" pathLength={100} strokeDasharray={`${v * 100} 100`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 300ms' }} />
        <text x={50} y={50} textAnchor="middle" fontSize={18} fill="#fff" fontWeight="bold">{(v * 100).toFixed(0)}%</text>
        <text x={50} y={66} textAnchor="middle" fontSize={8} fill="#94a3b8">{ms.toFixed(1)} ms</text>
      </svg>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#2a1b44,#05070d_70%)] px-4 py-5 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-fuchsia-300/80">LAB · SILICON & STONE</p>
            <h1 className="text-2xl font-semibold">建築の MR フィルター · 半導体スキャン · CPU : GPU 稼働率</h1>
            <p className="text-xs text-slate-400">どれも端末の中だけで計算する。画像もカメラ映像も外へ送らない。</p>
          </div>
          <nav className="flex gap-2 text-xs"><Link href="/lab/colorcube" className={`${glass} px-3 py-1`}>博物館</Link><Link href="/lab/library" className={`${glass} px-3 py-1`}>図書館</Link><Link href="/relay-flight" className={`${glass} px-3 py-1`}>リレーすごろく</Link></nav>
        </header>

        <section aria-label="Architecture filter" className={`${glass} space-y-3 p-4`}>
          <h2 className="font-semibold">A. 建築様式の MR フィルター（輪郭の向きのスペクトル）</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(['gothic', 'modern', 'dome', 'classical'] as const).map((k) => <button key={k} type="button" aria-pressed={source === 'sample' && sample === k} onClick={() => { setSource('sample'); setSample(k); }} className={`rounded-full border px-3 py-1 ${source === 'sample' && sample === k ? 'border-fuchsia-300 bg-fuchsia-300/20' : 'border-white/20'}`}>見本：{{ gothic: 'ゴシック', modern: 'モダニズム', dome: 'ドーム', classical: '古典' }[k]}</button>)}
            <button type="button" onClick={() => { setCamError(''); setSource('camera'); }} className="rounded-full border border-cyan-300/60 px-3 py-1">カメラ（MR）</button>
            <label className="cursor-pointer rounded-full border border-white/20 px-3 py-1">写真を選ぶ<input aria-label="Architecture photo" type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} /></label>
            <button type="button" onClick={snap} className="rounded-full bg-[#ff6b3d] px-3 py-1 font-semibold text-black">比較に追加</button>
          </div>
          {camError && <p role="alert" className="text-xs text-amber-300">{camError}</p>}
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <div className="relative"><canvas ref={viewRef} width={480} height={360} className="w-full rounded-lg bg-black" role="img" aria-label="Edges coloured by orientation" /><video ref={videoRef} className="hidden" playsInline muted /><span className="absolute bottom-1 right-2 font-mono text-[10px] text-slate-300">{FW}×{FH} · {archMs.toFixed(1)} ms</span></div>
            <div className="flex flex-col items-center gap-1"><Rose hist={hist} snaps={snaps} /><p className="text-center text-sm font-semibold" data-testid="style-guess">{guess?.name}</p><p className="text-xs text-slate-400">{guess?.why}</p></div>
            <div className="space-y-2 text-xs">
              {([['垂直', sh.vertical, '#ff6b3d'], ['水平', sh.horizontal, '#22d3a6'], ['斜め・曲線', sh.diagonal, '#7c6cff']] as const).map(([n, v, c]) => (
                <div key={n}><div className="flex justify-between"><span>{n}</span><span className="font-mono">{(v * 100).toFixed(0)}%</span></div><div className="h-2 rounded bg-white/10"><div className="h-2 rounded" style={{ width: `${v * 100}%`, background: c }} /></div></div>
              ))}
              {snaps.length > 1 && (
                <table className="mt-2 w-full font-mono text-[10px]" data-testid="similarity"><tbody>
                  {snaps.map((a) => <tr key={a.color}><td style={{ color: a.color }}>{a.label}</td>{snaps.map((b) => <td key={b.color} className="text-right" style={{ opacity: 0.4 + cosine(a.hist, b.hist) * 0.6 }}>{cosine(a.hist, b.hist).toFixed(2)}</td>)}</tr>)}
                </tbody></table>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">輪郭の色は向き（赤＝垂直の輪郭 → 緑・青 → 紫）。160×120 に縮めて 1 枚数 ms。見えるのは輪郭の幾何だけで、建物の名前や中の人は識別しない。人の顔や私有地の内部は写さない。</p>
        </section>

        <section aria-label="Die scan" className={`${glass} space-y-3 p-4`}>
          <h2 className="font-semibold">B. 半導体スキャン（タイルの質感で CPU・GPU・SRAM・I/O を塗り分け）</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={() => setSeed((s) => s + 1)} className="rounded-full border border-white/20 px-3 py-1">合成ダイを作り直す</button>
            <label className="cursor-pointer rounded-full border border-white/20 px-3 py-1">ダイ写真を選ぶ<input aria-label="Die photo" type="file" accept="image/*" className="hidden" onChange={(e) => onDie(e.target.files?.[0])} /></label>
            <button type="button" onClick={scan} className="rounded-full bg-[#22d3a6] px-4 py-1 font-semibold text-black">スキャン</button>
            <label className="flex items-center gap-1">ダイ面積 <input aria-label="Die area" type="number" min={10} max={900} value={dieMm2} onChange={(e) => setDieMm2(Number(e.target.value) || 0)} className="w-20 rounded border border-white/20 bg-black/30 px-1" /> mm²</label>
            {units && <span className="font-mono text-slate-400">{COLS * ROWS} タイル · {scanMs.toFixed(0)} ms</span>}
          </div>
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <canvas ref={dieRef} width={DIE_W} height={DIE_H} className="w-full rounded-lg" role="img" aria-label="Die" />
            <div className="space-y-2 text-xs">
              {UNITS.map((u) => (
                <div key={u}><div className="flex justify-between"><span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: UNIT_INFO[u].color }} />{UNIT_INFO[u].name}</span><span className="font-mono">{shareMap ? `${(shareMap[u] * 100).toFixed(0)}% · ${(shareMap[u] * dieMm2).toFixed(1)} mm²` : '—'}</span></div>
                  <div className="h-2 rounded bg-white/10"><div className="h-2 rounded transition-all duration-700" style={{ width: `${(shareMap?.[u] ?? 0) * 100}%`, background: UNIT_INFO[u].color }} /></div></div>
              ))}
              {accuracy !== null && <p data-testid="accuracy">合成ダイの正解との一致：<span className="font-mono">{(accuracy * 100).toFixed(0)}%</span>{mistakes.length > 0 && <span className="block text-slate-400" data-testid="mistakes">外れ：{mistakes.slice(0, 3).map(([k, n]) => `${k} ${n}`).join('／')}</span>}</p>}
              {credits && (
                <div className="rounded-lg border border-white/10 p-2" data-testid="credits">
                  <p className="font-semibold">シミュレーション・クレジット（概算）：{credits.total.toFixed(0)} / 秒</p>
                  <p className="text-slate-400">C の稼働率モニターでこのダイを 1 秒ぶん動かす計算量の目安（アプリ内の単位、mm² × 種類ごとの重み）。実物のチップを複製する費用ではない。</p>
                  <div className="mt-1 flex h-3 overflow-hidden rounded">{credits.parts.filter((p) => p.credits > 0).map((p) => <span key={p.u} style={{ flex: p.credits, background: UNIT_INFO[p.u].color }} title={`${UNIT_INFO[p.u].name} ${p.credits.toFixed(0)}`} />)}</div>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">判定はタイルの質感だけ：細かい格子が自分とずれて重なる→SRAM、2 タイル先と同じ模様→GPU のシェーダー単位、縞か外周→I/O、それ以外の密で不規則な模様→CPU。本物のダイ写真では大まかな下書きになる。</p>
        </section>

        <section aria-label="Activity monitor" className={`${glass} space-y-3 p-4`}>
          <h2 className="font-semibold">C. CPU : GPU 稼働率の差引き（ベンチマークの遅れで測る）</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button type="button" onClick={toggleMeter} className={`rounded-full px-4 py-1 font-semibold text-black ${running ? 'bg-slate-300' : 'bg-[#f5c542]'}`}>{running ? '停止' : '計測を始める'}</button>
            <label className="flex items-center gap-1">CPU に負荷 <input aria-label="CPU stress" type="range" min={0} max={4} value={cpuStress} disabled={!running} onChange={(e) => setCpuStress(Number(e.target.value))} /> {cpuStress} スレッド</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={gpuStress} disabled={!running} onChange={(e) => setGpuStress(e.target.checked)} /> GPU に負荷</label>
            {!units && <span className="text-amber-300">B でスキャンすると、ダイの上に稼働が光る</span>}
          </div>
          {running && !gpuInfo.ok && <p className="text-xs text-amber-300">WebGL2 が使えないため GPU は 0% のまま。</p>}
          {running && gpuInfo.soft && <p className="text-xs text-amber-300">この端末の WebGL はソフトウェア描画（GPU なし）なので、GPU の値も CPU の上で測られ、2 つが連動しやすい。</p>}
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="flex gap-4">{gauge(latest.cpu, 'CPU', latest.cpuMs, '#ffb03d', '#ff3d6b')}{gauge(latest.gpu, 'GPU', latest.gpuMs, '#3dd6ff', '#22d3a6')}</div>
            <div>
              <p className="text-sm" data-testid="diff">CPU − GPU = <span className="font-mono font-bold" style={{ color: diff >= 0 ? '#ff8a3d' : '#3dd6ff' }}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}</span>（{Math.abs(diff) < 0.1 ? 'ほぼ均衡' : diff > 0 ? 'CPU 寄り' : 'GPU 寄り'}）</p>
              <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full rounded-lg bg-black/30" role="img" aria-label="CPU minus GPU over 60 seconds">
                <defs><linearGradient id="diffg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a3d" stopOpacity={0.7} /><stop offset="0.5" stopColor="#ffffff" stopOpacity={0.05} /><stop offset="1" stopColor="#3dd6ff" stopOpacity={0.7} /></linearGradient></defs>
                <line x1={0} x2={CW} y1={CH / 2} y2={CH / 2} stroke="#ffffff33" />
                {vis.length > 1 && <polygon points={`${xOf(vis[0].t)},${CH / 2} ${vis.map((s) => `${xOf(s.t).toFixed(1)},${yOf(s.cpu - s.gpu).toFixed(1)}`).join(' ')} ${xOf(vis[vis.length - 1].t)},${CH / 2}`} fill="url(#diffg)" />}
                <polyline points={line('cpu')} fill="none" stroke="#ff6b3d" strokeWidth={1.2} opacity={0.8} />
                <polyline points={line('gpu')} fill="none" stroke="#22d3a6" strokeWidth={1.2} opacity={0.8} />
                <text x={6} y={12} fontSize={9} fill="#ff8a3d">CPU 寄り ↑</text><text x={6} y={CH - 4} fontSize={9} fill="#3dd6ff">GPU 寄り ↓</text>
              </svg>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {TASKS.map((t, i) => { const side = placeTask(t.aff, latest.cpu, latest.gpu); return (
                  <span key={t.sym} className="rounded-full px-2 py-0.5 text-black" style={{ background: hex(i / TASKS.length) }} data-testid={`task-${i}`}>{t.sym} {t.name} → {side.toUpperCase()}</span>
                ); })}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400">ブラウザは OS のアクティビティモニターを読めないので、CPU は Worker の固定計算、GPU は WebGL の固定シェーダーを 0.4 秒ごとに走らせ、いちばん速かった時間との差（負荷 ≈ 1 − 最速 ÷ いま）で測る。8 つの記号はタスク：それぞれの得意（CPU 寄り／GPU 寄り）と、いまの差引きから、空いている側へ移る。同じ側にいる記号どうしは線でつながる（共生）。</p>
        </section>
      </div>
    </main>
  );
}
