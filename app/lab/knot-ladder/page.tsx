'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import LedBoard from '@/components/glass/LedBoard';
import { CANDLES_PER_CUBE, KNOT_INFO, KNOT_TYPES, MOORING_CARD, RUNGS, classify, cubeRange, frontCrossings, knotCurve, mooringHitchCurve, nextCandle, predictKnots, rng, type Candle, type KnotType } from '@/lib/knotLadder';

const SPACING = 1.3; const FUTURE_CUBES = 3; const KEEP = 18; const CANDLE_MS = 1200;
type CubeInfo = { index: number; type: KnotType; why: string; crossings: number; done: boolean };
type Bet = { cube: number; knot: KnotType | null; candies: number[]; levels: number[]; moored: number[]; result?: { knotOk: boolean | null; fills: number } };
type Mooring = { phase: 'idle' | 'gravity' | 'cylinder' | 'pillar' | 'tying' | 'moored' | 'released'; cube: number; vine: number; releasedBy: '' | 'pull' | 'plants'; crossings: number };

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
  const [moor, setMoor] = useState<Mooring>({ phase: 'idle', cube: -1, vine: 0, releasedBy: '', crossings: frontCrossings(mooringHitchCurve(-0.45, 0.28)) });
  const ctl = useRef({ focus: 0, follow: true, bet: null as Bet | null, levels: [] as number[], moor: null as null | Mooring, play: () => {}, release: (_by: 'pull' | 'plants') => {} });
  ctl.current.focus = focus; ctl.current.bet = bet; ctl.current.moor = moor;

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
    const newBet = (i: number): Bet => { const pc = candles[i * CANDLES_PER_CUBE - 1]?.c ?? candles[candles.length - 1].c; const pr = cubeRange(cubeCandles(Math.max(0, i - 1))); const span = (pr.hi - pr.lo) * 1.2; return { cube: i, knot: null, candies: [], moored: [], levels: [...Array(RUNGS).keys()].map((k) => pc + ((k + 0.5) / RUNGS - 0.5) * span) }; };
    setBet(newBet(liveIdx()));

    // ---------------- effect card No.17: mooring hitch
    let pendingCarry: number[] = [];
    const red = new THREE.Color('#ff1a3c'); const chrome = new THREE.MeshStandardMaterial({ color: '#f0f0f4', metalness: 1, roughness: 0.12 });
    let fx: null | { g: THREE.Group; start: number; pulse: THREE.Mesh; light: THREE.PointLight; bar: THREE.Mesh; pillar: THREE.Mesh; rope: THREE.Mesh; ropeCount: number; vines: { mesh: THREE.Mesh; count: number; phase: number }[] } = null;
    const XS = -0.45; const YB = 0.28; const PX = -0.88;
    ctl.current.play = () => {
      if (fx) { scene.remove(fx.g); fx = null; }
      const i = liveIdx(); const g = new THREE.Group(); g.position.set(0, i * SPACING, 0.66); scene.add(g);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16), new THREE.MeshBasicMaterial({ color: red, transparent: true, opacity: 0, depthWrite: false })); pulse.position.set(PX + 0.2, YB, 0); g.add(pulse);
      const light = new THREE.PointLight(red, 0, 3); light.position.copy(pulse.position); g.add(light);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.86, 24), chrome); bar.rotation.z = Math.PI / 2; bar.position.set(PX + 0.43, YB, 0); bar.scale.set(1, 0.001, 1); g.add(bar); // spans from the pillar to the cube's left corner
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 24), chrome); pillar.position.set(PX, -0.5, 0); pillar.scale.set(1, 0.001, 1); g.add(pillar);
      const pts = mooringHitchCurve(XS, YB).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const geo = new THREE.TubeGeometry(new Poly(pts), pts.length * 2, 0.022, 10, false); geo.setDrawRange(0, 0);
      const rope = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#b3122a', roughness: 0.55, emissive: '#3a0008' })); g.add(rope);
      // Plants that break the skeleton and dance: three vines climbing round the pillar.
      const vines = [0, 1, 2].map((v) => {
        const vp: THREE.Vector3[] = []; for (let k = 0; k <= 60; k += 1) { const t = k / 60; const a = t * Math.PI * 5 + (v * Math.PI * 2) / 3; vp.push(new THREE.Vector3(PX + Math.cos(a) * (0.08 + 0.02 * v), -0.5 + t * (YB + 0.55), Math.sin(a) * (0.08 + 0.02 * v))); }
        const vg = new THREE.TubeGeometry(new Poly(vp), 120, 0.012, 6, false); vg.setDrawRange(0, 0);
        const mesh = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ color: '#3dff8f', emissive: '#0a5a2a', roughness: 0.6 })); g.add(mesh);
        return { mesh, count: vg.index ? vg.index.count : 0, phase: v };
      });
      fx = { g, start: performance.now(), pulse, light, bar, pillar, rope, ropeCount: geo.index ? geo.index.count : 0, vines };
      setMoor((m) => ({ ...m, phase: 'gravity', cube: i, vine: 0, releasedBy: '' }));
    };
    ctl.current.release = (by) => {
      setMoor((m) => (m.phase === 'moored' || m.phase === 'tying' ? { ...m, phase: 'released', releasedBy: by } : m));
      setBet((b) => (b ? { ...b, moored: [] } : b)); pendingCarry = [];
    };

    // A new candle every 1.2 s; a finished cube scores the bet and opens the next one.
    const timer = window.setInterval(() => {
      // The plants grow one step per candle; at the hitch they untie it.
      const m = ctl.current.moor;
      if (m && m.phase === 'moored') {
        const vine = Math.min(1, m.vine + 1 / MOORING_CARD.plantCandles);
        setMoor({ ...m, vine }); if (vine >= 1) ctl.current.release('plants');
      }
      const k = nextCandle(candles[candles.length - 1].c, r); candles.push(k);
      const i = liveIdx(); const inf = buildCube(i); if (inf) infos[i] = inf;
      if (cubeCandles(i).length === 1 && i > 0) { // the previous cube just completed
        const done = infos[i - 1]; const b = ctl.current.bet;
        if (b && b.cube === i - 1) {
          const cs = cubeCandles(i - 1); const hit = (lv: number) => cs.some((x) => x.l <= lv && lv <= x.h);
          const fills = b.candies.filter((q) => hit(b.levels[q])).length + b.moored.filter(hit).length;
          // Mooring: the candies that did not fill stay tied to the bar and carry into the next cube.
          const m = ctl.current.moor; const carry = m && m.phase === 'moored' ? [...b.candies.map((q) => b.levels[q]), ...b.moored].filter((lv) => !hit(lv)) : [];
          pendingCarry = carry;
          const knotOk = b.knot ? b.knot === done.type : null;
          setScore((s) => ({ points: s.points + (knotOk ? 100 : 0) + fills * 50, knots: s.knots + (knotOk ? 1 : 0), knotTries: s.knotTries + (b.knot ? 1 : 0), fills: s.fills + fills, candies: s.candies + b.candies.length + b.moored.length }));
          setHistory((h) => [{ ...b, result: { knotOk, fills } }, ...h].slice(0, 8));
        }
        setBet({ ...newBet(i), moored: pendingCarry }); pendingCarry = [];
        buildGhosts(i, k.c);
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
    let camY = ctl.current.focus * SPACING; let raf = 0; let lastT = performance.now();
    // Easing by elapsed time (not per frame), so slow and fast screens move at the same pace.
    const follow = (dt: number, rate: number) => (reduce ? 1 : 1 - Math.exp(-dt * rate));
    const frame = (now: number) => {
      const dt = Math.min(0.5, (now - lastT) / 1000); lastT = now;
      camY += (ctl.current.focus * SPACING - camY) * follow(dt, 5);
      const az = reduce ? 0.6 : 0.6 + Math.sin(now / 9000) * 0.35;
      camera.position.set(Math.sin(az) * 3.4, camY + 0.7, Math.cos(az) * 3.4); camera.lookAt(0, camY, 0);
      // Ghost knots tie themselves (draw range grows, then starts again).
      for (const [, gh] of ghosts) { const t = reduce ? 1 : ((now / 2600) % 1.25); gh.tube.geometry.setDrawRange(0, Math.floor(gh.count * Math.min(1, t))); }
      if (fx) {
        const t = reduce ? 99 : (now - fx.start) / 1000; const ease = (x: number) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
        // 0–0.9 s red gravity pressure, 0.9–1.7 s the cylinder, 1.7–2.7 s the pillar is drawn, 2.7–4.2 s the hitch is tied.
        const g1 = t < 0.9 ? Math.sin((t / 0.9) * Math.PI) : 0;
        (fx.pulse.material as THREE.MeshBasicMaterial).opacity = 0.35 * g1; fx.pulse.scale.setScalar(0.6 + t * 0.6); fx.light.intensity = 6 * g1;
        fx.bar.scale.set(1, Math.max(0.001, ease((t - 0.9) / 0.8)), 1);
        const ph = ease((t - 1.7) / 1.0); const ph2 = Math.max(0.001, ph); fx.pillar.scale.set(1, ph2 * (YB + 0.5 + 0.05), 1); fx.pillar.position.y = -0.5 + (ph2 * (YB + 0.55)) / 2;
        fx.rope.geometry.setDrawRange(0, Math.floor(fx.ropeCount * ease((t - 2.7) / 1.5)));
        const m = ctl.current.moor;
        // While moored, the bar and pillar travel with the live cube (they carry the positions forward).
        if (m && m.phase !== 'released') fx.g.position.y += (liveIdx() * SPACING - fx.g.position.y) * follow(dt, 4);
        if (m) {
          const phase = t < 0.9 ? 'gravity' : t < 1.7 ? 'cylinder' : t < 2.7 ? 'pillar' : t < 4.2 ? 'tying' : 'moored';
          if (m.phase !== 'released' && m.phase !== phase && ['gravity', 'cylinder', 'pillar', 'tying'].includes(m.phase)) setMoor({ ...m, phase });
          // Vines grow with the candles and dance (sway) while they climb.
          fx.vines.forEach((v) => { v.mesh.geometry.setDrawRange(0, Math.floor(v.count * m.vine)); v.mesh.rotation.y = reduce ? 0 : Math.sin(now / 700 + v.phase) * 0.25; v.mesh.position.x = reduce ? 0 : Math.sin(now / 900 + v.phase * 2) * 0.03; });
          if (m.phase === 'released') { fx.rope.position.y += (-(0.9) - fx.rope.position.y) * 0.03; (fx.rope.material as THREE.MeshStandardMaterial).opacity = 0.5; (fx.rope.material as THREE.MeshStandardMaterial).transparent = true; }
        }
      }
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
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/glass-knot" className="border border-white/20 px-3 py-1">ガラスの紐 LAB</Link><Link href="/lab/card-slots" className="border border-[#c084fc]/50 px-3 py-1 text-[#e9d5ff]">カードスロット</Link></nav>
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
            <section aria-label="Effect card" className="space-y-1 rounded-lg border-2 border-[#ff1a3c]/60 bg-[linear-gradient(160deg,#1a0508,#05060a)] p-2 font-mono text-[11px]" data-testid="card">
              <div className="flex gap-2">
                <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0 rounded border border-[#ff1a3c]/50 bg-black" role="img" aria-label="Mooring hitch card art">
                  <defs><linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#333" /><stop offset="0.45" stopColor="#fff" /><stop offset="1" stopColor="#222" /></linearGradient></defs>
                  <rect x="14" y="14" width="10" height="100" fill="url(#chrome)" />
                  <rect x="14" y="24" width="92" height="12" rx="6" fill="url(#chrome)" />
                  <path d="M62 120 L62 34 Q66 18 70 34 L70 62 M66 70 a12 12 0 1 0 0.1 0 M54 74 q-26 -10 -26 0 q0 10 26 0 M60 74 L100 76" fill="none" stroke="#c0172f" strokeWidth="4" strokeLinecap="round" />
                  {[0, 1, 2].map((v) => <path key={v} d={`M${18 + v * 3} 116 q${8 - v * 6} -20 ${-2 + v} -40 q${-8 + v * 4} -18 ${4} -36`} fill="none" stroke="#3dff8f" strokeWidth="1.5" opacity={0.4 + moor.vine * 0.6} />)}
                </svg>
                <div className="space-y-0.5">
                  <p className="text-[#ff6b7f]">No.{MOORING_CARD.no} エフェクト</p>
                  <p className="text-sm font-bold">{MOORING_CARD.name}</p>
                  <p className="text-slate-400">{MOORING_CARD.knot}・交点 {moor.crossings}</p>
                  <p className="text-[10px] text-slate-300">{MOORING_CARD.flavor}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">{MOORING_CARD.rule}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => ctl.current.play()} disabled={['gravity', 'cylinder', 'pillar', 'tying', 'moored'].includes(moor.phase)} className="bg-[#ff1a3c] px-3 py-1 font-bold text-black disabled:opacity-40">カードを使う</button>
                <button type="button" onClick={() => ctl.current.release('pull')} disabled={moor.phase !== 'moored'} className="border border-[#ff1a3c]/70 px-2 py-1 text-[#ff8a9a] disabled:opacity-40">端を引く（すぐほどく）</button>
                <span data-testid="moor-phase">{({ idle: '待機', gravity: '赤色重力の圧力…', cylinder: '左隅に金属の円筒', pillar: '金属の柱を描いている', tying: '係留結びを結んでいる', moored: `係留中（立方体 #${moor.cube}）`, released: moor.releasedBy === 'plants' ? '植物が結び目をほどいた' : '端を引いてほどいた' } as Record<string, string>)[moor.phase]}</span>
              </div>
              {moor.phase === 'moored' && <div className="flex items-center gap-1 text-[10px]"><span className="text-[#3dff8f]">植物</span><div className="h-1.5 flex-1 bg-white/10"><div className="h-1.5 bg-[#3dff8f]" style={{ width: `${moor.vine * 100}%` }} /></div><span>{Math.round(moor.vine * 100)}%（100% で結び目に届く）</span></div>}
            </section>
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
              {!!bet?.moored.length && <p className="text-[#ff8a9a]" data-testid="moored">係留中のキャンディー：{bet.moored.map((lv) => lv.toFixed(2)).join('・')}</p>}
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
