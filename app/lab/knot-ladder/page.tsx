'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import LedBoard from '@/components/glass/LedBoard';
import { CANDLES_PER_CUBE, KNOT_INFO, KNOT_TYPES, RUNGS, classify, cubeRange, frontCrossings, knotCurve, nextCandle, predictKnots, rng, type Candle, type KnotType } from '@/lib/knotLadder';

const SPACING = 1.3; const FUTURE_CUBES = 3; const KEEP = 18; const CANDLE_MS = 1200;
type CubeInfo = { index: number; type: KnotType; why: string; crossings: number; done: boolean };
type Bet = { cube: number; knot: KnotType | null; candies: number[]; levels: number[]; result?: { knotOk: boolean | null; fills: number } };

/** Polyline curve (no smoothing). */
class Poly extends THREE.Curve<THREE.Vector3> {
  constructor(private p: THREE.Vector3[]) { super(); }
  getPoint(t: number, out = new THREE.Vector3()) { const f = Math.max(0, Math.min(1, t)) * (this.p.length - 1); const i = Math.min(this.p.length - 2, Math.floor(f)); return out.copy(this.p[i]).lerp(this.p[i + 1], f - i); }
}

/**
 * Knot ladder: candles stored in glass cubes stacked into a tower. One rope runs through every
 * cube and ties exactly one knot in each, read from that cube's candles. Scroll down to walk the
 * rope back through the past; scroll up to the ghost cubes, where the most likely next knots tie
 * themselves. Wick tips and the cube's grid lines are the ladder: before a cube is finished,
 * predict its knot and drop candies on its rungs. Synthetic prices only.
 */
export default function KnotLadderLab() {
  const mount = useRef<HTMLDivElement>(null);
  const [cubes, setCubes] = useState<CubeInfo[]>([]);
  const [focus, setFocus] = useState(0); // cube index the camera looks at
  const [live, setLive] = useState({ cube: 0, candles: 0 });
  const [pred, setPred] = useState<{ type: KnotType; p: number }[][]>([]);
  const [bet, setBet] = useState<Bet | null>(null);
  const [score, setScore] = useState({ points: 0, knots: 0, knotTries: 0, fills: 0, candies: 0 });
  const [history, setHistory] = useState<Bet[]>([]);
  const ctl = useRef({ focus: 0, follow: true, bet: null as Bet | null, levels: [] as number[] });
  ctl.current.focus = focus; ctl.current.bet = bet;

  useEffect(() => {
    const el = mount.current; if (!el) return undefined;
    const W = el.clientWidth; const H = Math.round(Math.min(620, W * 0.75));
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; el.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#05060a'); scene.fog = new THREE.Fog('#05060a', 6, 14);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);
    const key = new THREE.DirectionalLight('#ffffff', 2); key.position.set(3, 8, 5); scene.add(key);

    // Data: synthetic candles, 8 to a cube.
    const r = rng(20261111); const candles: Candle[] = []; let c = 100;
    for (let i = 0; i < CANDLES_PER_CUBE * 12 + 3; i += 1) { const k = nextCandle(c, r); candles.push(k); c = k.c; }
    const groups = new Map<number, THREE.Group>(); const ghosts = new Map<number, { g: THREE.Group; tube: THREE.Mesh; count: number }>();
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#e8f2ff', transmission: 0.9, roughness: 0.05, thickness: 0.2, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const ropeMat = (t: KnotType, ghost = false) => new THREE.MeshPhysicalMaterial({ color: ghost ? '#ffb000' : '#141418', transmission: ghost ? 0.4 : 0.6, roughness: 0.06, thickness: 0.05, clearcoat: 1, emissive: KNOT_INFO[t].color, emissiveIntensity: ghost ? 0.35 : 0.18, transparent: ghost, opacity: ghost ? 0.75 : 1 });

    const cubeCandles = (i: number) => candles.slice(i * CANDLES_PER_CUBE, (i + 1) * CANDLES_PER_CUBE);
    const prevCloseOf = (i: number) => (i > 0 ? candles[i * CANDLES_PER_CUBE - 1]?.c ?? null : null);
    const toWorld = (p: [number, number, number], i: number) => new THREE.Vector3(p[0] * 0.92, i * SPACING + p[1] * SPACING, p[2] * 0.92);

    /** Build (or rebuild) the cube at index i from its candles. */
    const buildCube = (i: number) => {
      const old = groups.get(i); if (old) { scene.remove(old); old.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); }
      const cs = cubeCandles(i); if (!cs.length) return null;
      const g = new THREE.Group(); g.position.y = i * SPACING;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glassMat); g.add(glass);
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.5 })));
      const { lo, hi } = cubeRange(cs); const yOf = (v: number) => -0.42 + ((v - lo) / (hi - lo || 1)) * 0.84;
      // The ladder: grid lines (マス枠) at the 8 rung levels on all four side faces.
      const rungPts: number[] = [];
      for (let k = 0; k < RUNGS; k += 1) { const y = -0.42 + (0.84 * (k + 0.5)) / RUNGS; rungPts.push(-0.5, y, 0.5, 0.5, y, 0.5, 0.5, y, 0.5, 0.5, y, -0.5, 0.5, y, -0.5, -0.5, y, -0.5, -0.5, y, -0.5, -0.5, y, 0.5); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rungPts, 3));
      g.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#ff2bd6', transparent: true, opacity: 0.25 })));
      // Candles on the back plane; wick tips touching a rung glow.
      cs.forEach((k, j) => {
        const x = -0.38 + (0.76 * j) / (CANDLES_PER_CUBE - 1); const up = k.c >= k.o; const col = up ? '#3dff8f' : '#ff4d4d';
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, Math.max(0.006, Math.abs(yOf(k.c) - yOf(k.o))), 0.03), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 }));
        body.position.set(x, (yOf(k.c) + yOf(k.o)) / 2, -0.38); g.add(body);
        const wick = new THREE.Mesh(new THREE.BoxGeometry(0.008, yOf(k.h) - yOf(k.l), 0.008), new THREE.MeshBasicMaterial({ color: col })); wick.position.set(x, (yOf(k.h) + yOf(k.l)) / 2, -0.38); g.add(wick);
        for (const tip of [k.h, k.l]) {
          const ty = yOf(tip); const near = [...Array(RUNGS).keys()].some((q) => Math.abs(-0.42 + (0.84 * (q + 0.5)) / RUNGS - ty) < 0.025);
          if (near) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe600' })); s.position.set(x, ty, -0.38); g.add(s); }
        }
      });
      // The knot (the live cube ties progressively as candles arrive).
      const done = cs.length === CANDLES_PER_CUBE; const info = classify(cs, prevCloseOf(i));
      const curve = knotCurve(info.type, 90, info.rung); const pts = curve.map((p) => new THREE.Vector3(p[0] * 0.92, p[1], p[2] * 0.92));
      const show = done ? pts : pts.slice(0, Math.max(2, Math.round((pts.length * cs.length) / CANDLES_PER_CUBE)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new Poly(show), show.length * 2, 0.026, 10, false), ropeMat(info.type)));
      scene.add(g); groups.set(i, g);
      return { index: i, type: info.type, why: info.why, crossings: frontCrossings(curve), done } as CubeInfo;
    };

    /** Ghost cubes above the live one: the most likely knot ties itself on a loop. */
    const buildGhosts = (from: number, lastClose: number) => {
      for (const [, gh] of ghosts) { scene.remove(gh.g); gh.tube.geometry.dispose(); } ghosts.clear();
      const preds: { type: KnotType; p: number }[][] = [];
      for (let f = 1; f <= FUTURE_CUBES; f += 1) {
        const pr = predictKnots(lastClose, from * 31, 90, f); preds.push(pr.dist);
        const i = from + f; const g = new THREE.Group(); g.position.y = i * SPACING;
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineDashedMaterial({ color: '#ffb000', dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.6 - f * 0.12 })).computeLineDistances());
        const pts = knotCurve(pr.top, 90, 0).map((p) => new THREE.Vector3(p[0] * 0.92, p[1], p[2] * 0.92));
        const geo = new THREE.TubeGeometry(new Poly(pts), pts.length * 2, 0.022, 8, false);
        const tube = new THREE.Mesh(geo, ropeMat(pr.top, true)); g.add(tube); scene.add(g);
        ghosts.set(i, { g, tube, count: geo.index ? geo.index.count : 0 });
      }
      setPred(preds);
    };

    const infos: CubeInfo[] = [];
    const total = () => Math.ceil(candles.length / CANDLES_PER_CUBE);
    for (let i = 0; i < total(); i += 1) { const inf = buildCube(i); if (inf) infos[i] = inf; }
    const liveIdx = () => total() - 1;
    buildGhosts(liveIdx(), candles[candles.length - 1].c);
    setCubes([...infos]); setLive({ cube: liveIdx(), candles: cubeCandles(liveIdx()).length }); setFocus(liveIdx());
    const newBet = (i: number): Bet => { const pc = candles[i * CANDLES_PER_CUBE - 1]?.c ?? candles[candles.length - 1].c; const pr = cubeRange(cubeCandles(Math.max(0, i - 1))); const span = (pr.hi - pr.lo) * 1.2; return { cube: i, knot: null, candies: [], levels: [...Array(RUNGS).keys()].map((k) => pc + ((k + 0.5) / RUNGS - 0.5) * span) }; };
    setBet(newBet(liveIdx()));

    // A new candle every 1.2 s; a finished cube scores the bet and opens the next one.
    const timer = window.setInterval(() => {
      const k = nextCandle(candles[candles.length - 1].c, r); candles.push(k);
      const i = liveIdx(); const inf = buildCube(i); if (inf) infos[i] = inf;
      if (cubeCandles(i).length === 1 && i > 0) { // the previous cube just completed
        const done = infos[i - 1]; const b = ctl.current.bet;
        if (b && b.cube === i - 1) {
          const cs = cubeCandles(i - 1); const fills = b.candies.filter((q) => cs.some((x) => x.l <= b.levels[q] && b.levels[q] <= x.h)).length;
          const knotOk = b.knot ? b.knot === done.type : null;
          setScore((s) => ({ points: s.points + (knotOk ? 100 : 0) + fills * 50, knots: s.knots + (knotOk ? 1 : 0), knotTries: s.knotTries + (b.knot ? 1 : 0), fills: s.fills + fills, candies: s.candies + b.candies.length }));
          setHistory((h) => [{ ...b, result: { knotOk, fills } }, ...h].slice(0, 8));
        }
        setBet(newBet(i)); buildGhosts(i, k.c);
        // Keep the tower bounded.
        for (const [j, g] of groups) if (j < i - KEEP) { scene.remove(g); groups.delete(j); }
        if (ctl.current.follow) setFocus(i);
      }
      setCubes([...infos]); setLive({ cube: i, candles: cubeCandles(i).length });
    }, CANDLE_MS);

    // Scroll: wheel / vertical drag over the tower moves through time.
    let dragY: number | null = null; let dragFocus = 0;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); ctl.current.follow = false; setFocus((f) => Math.max(0, Math.min(liveIdx() + FUTURE_CUBES, f - Math.sign(e.deltaY) * 0.5))); };
    const onDown = (e: PointerEvent) => { dragY = e.clientY; dragFocus = ctl.current.focus; };
    const onMove = (e: PointerEvent) => { if (dragY === null) return; ctl.current.follow = false; setFocus(Math.max(0, Math.min(liveIdx() + FUTURE_CUBES, dragFocus + (e.clientY - dragY) / 90))); };
    const onUp = () => { dragY = null; };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false }); renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let camY = ctl.current.focus * SPACING; let raf = 0;
    const frame = (now: number) => {
      camY += (ctl.current.focus * SPACING - camY) * (reduce ? 1 : 0.08);
      const az = reduce ? 0.6 : 0.6 + Math.sin(now / 9000) * 0.35;
      camera.position.set(Math.sin(az) * 3.4, camY + 0.7, Math.cos(az) * 3.4); camera.lookAt(0, camY, 0);
      // Ghost knots tie themselves (draw range grows, then starts again).
      for (const [, gh] of ghosts) { const t = reduce ? 1 : ((now / 2600) % 1.25); gh.tube.geometry.setDrawRange(0, Math.floor(gh.count * Math.min(1, t))); }
      renderer.render(scene, camera); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); window.clearInterval(timer);
      renderer.domElement.removeEventListener('wheel', onWheel); renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const jump = (to: number, follow = false) => { ctl.current.follow = follow; setFocus(Math.max(0, Math.min(live.cube + FUTURE_CUBES, to))); };
  const locked = live.candles > 3; // predictions close once half the cube is drawn
  const focusLabel = focus > live.cube ? `未来 +${Math.round(focus - live.cube)}` : focus < live.cube - 0.4 ? `過去 −${Math.round(live.cube - focus)}` : '現在';

  return (
    <main className="min-h-screen bg-[#030407] px-4 py-5 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-300">LAB · KNOT LADDER · CUBE TOWER</p>
            <h1 className="font-mono text-2xl font-bold">立方体のはしご：ひとつの箱にひとつの結び目</h1>
            <p className="text-xs text-slate-400">ろうそく足 8 本をひとつのガラスの立方体に入れて積み上げる。下へスクロールで過去の結び目、上へスクロールで予測の結び目。値はすべて合成。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/glass-knot" className="border border-white/20 px-3 py-1">ガラスの紐 LAB</Link></nav>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
          <div className="space-y-2">
            <div ref={mount} className="relative touch-none overflow-hidden rounded-lg border border-white/10" data-testid="tower" aria-label="Cube tower" />
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <button type="button" onClick={() => jump(focus - 1)} className="border border-white/20 px-2 py-1">▼ 過去へ</button>
              <button type="button" onClick={() => jump(live.cube, true)} className="border border-cyan-300/60 px-2 py-1 text-cyan-200">● 現在へ（追従）</button>
              <button type="button" onClick={() => jump(focus + 1)} className="border border-amber-300/60 px-2 py-1 text-amber-200">▲ 未来へ</button>
              <input aria-label="Scroll through time" type="range" min={0} max={live.cube + FUTURE_CUBES} step={0.1} value={focus} onChange={(e) => jump(Number(e.target.value))} className="flex-1" />
              <span data-testid="focus">{focusLabel}</span>
            </div>
          </div>
          <aside className="space-y-2">
            <LedBoard cols={30} lines={[
              { text: `CUBE ${live.cube} LIVE ${live.candles}/8`, color: '#00e5ff' },
              { text: `NEXT ${(pred[0]?.[0]?.type ?? '-').toUpperCase()} ${Math.round((pred[0]?.[0]?.p ?? 0) * 100)}%`, color: '#ffb000' },
              { text: `SCORE ${score.points}`, color: '#3dff8f' },
              { text: `KNOT ${score.knots}/${score.knotTries} FILL ${score.fills}/${score.candies}`, color: '#ff4fa3' },
            ]} />
            <section aria-label="Bet" className="space-y-1 rounded border border-white/15 p-2 font-mono text-[11px]" data-testid="bet">
              <p className="text-[#ffe600]">いまの立方体 #{live.cube} の結び目を予測（{locked ? '締切：半分を過ぎた' : `あと ${4 - live.candles} 本で締切`}）</p>
              <div className="flex flex-wrap gap-1">{KNOT_TYPES.map((t) => (
                <button key={t} type="button" disabled={locked} aria-pressed={bet?.knot === t} onClick={() => setBet((b) => (b ? { ...b, knot: t } : b))}
                  className="border px-1.5 py-0.5 disabled:opacity-40" style={{ borderColor: KNOT_INFO[t].color, background: bet?.knot === t ? `${KNOT_INFO[t].color}33` : undefined, color: KNOT_INFO[t].color }}>{KNOT_INFO[t].name}</button>
              ))}</div>
              <p className="text-[#ff8ae8]">キャンディー（段に置く。その値段をこの立方体のろうそく足が通れば FILL ＋50）</p>
              <div className="flex flex-col-reverse gap-0.5">{bet?.levels.map((lv, q) => (
                <button key={q} type="button" onClick={() => setBet((b) => (b ? { ...b, candies: b.candies.includes(q) ? b.candies.filter((x) => x !== q) : [...b.candies, q] } : b))}
                  className="flex justify-between border border-[#ff2bd6]/40 px-1 text-left" aria-pressed={bet.candies.includes(q)} aria-label={`段 ${q + 1} ${lv.toFixed(2)}`}>
                  <span>段 {q + 1}</span><span>{lv.toFixed(2)}</span><span>{bet.candies.includes(q) ? '🍬' : '·'}</span>
                </button>
              ))}</div>
              {history[0] && <p data-testid="last-result">直前 #{history[0].cube}：{history[0].result?.knotOk === null ? '予測なし' : history[0].result?.knotOk ? '結び目 的中 ＋100' : '結び目 はずれ'} ・ FILL {history[0].result?.fills}/{history[0].candies.length}</p>}
            </section>
            <section aria-label="Cubes" className="max-h-72 space-y-0.5 overflow-y-auto rounded border border-white/15 p-2 font-mono text-[10px]" data-testid="cube-list">
              {pred.map((d, f) => (
                <button key={`f${f}`} type="button" onClick={() => jump(live.cube + f + 1)} className="block w-full text-left text-amber-200">
                  #{live.cube + f + 1}（予測）{d.slice(0, 3).map((x) => `${KNOT_INFO[x.type].name} ${Math.round(x.p * 100)}%`).join(' ・ ')}
                </button>
              )).reverse()}
              {[...cubes].reverse().filter(Boolean).slice(0, 18).map((cb) => (
                <button key={cb.index} type="button" onClick={() => jump(cb.index)} className={`block w-full text-left ${cb.index === live.cube ? 'text-cyan-200' : ''}`}>
                  #{cb.index} <span style={{ color: KNOT_INFO[cb.type].color }}>{KNOT_INFO[cb.type].name}</span> 交点 {cb.crossings} ・ {cb.why}{cb.done ? '' : '（結んでいる途中）'}
                </button>
              ))}
            </section>
          </aside>
        </div>

        <section aria-label="Legend" className="grid gap-1 rounded border border-white/10 p-2 font-mono text-[11px] text-slate-300 md:grid-cols-3">
          {KNOT_TYPES.map((t) => <p key={t}><span style={{ color: KNOT_INFO[t].color }}>■ {KNOT_INFO[t].name}</span>（交点 {KNOT_INFO[t].crossings}）：{KNOT_INFO[t].meaning}</p>)}
        </section>
      </div>
    </main>
  );
}
