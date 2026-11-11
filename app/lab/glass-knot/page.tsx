'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import LedBoard from '@/components/glass/LedBoard';
import { SynthApi, paramsOf, DEFAULT_POSE } from '@/lib/famiDance';
import { RATIO, buildPath, cameraAngles, crosses, heightOf, makeBox, priceOf, scoreForecast, type Box, type PathOpts, type RatioKey, type V3 } from '@/lib/glassKnot';

type Material = 'smoke' | 'metal' | 'glass';
const STEPS_PER_LAP = 44; const WINDOW = 132; const FUTURE = 22; const RUNGS = 12;
const v = (p: V3) => new THREE.Vector3(p.x, p.y, p.z);

/** A curve that follows the path points exactly (no smoothing that could leave the glass). */
class Polyline extends THREE.Curve<THREE.Vector3> {
  constructor(private pts: THREE.Vector3[]) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const f = Math.max(0, Math.min(1, t)) * (this.pts.length - 1); const i = Math.min(this.pts.length - 2, Math.floor(f));
    return target.copy(this.pts[i]).lerp(this.pts[i + 1], f - i);
  }
}

/**
 * Glass knot lab: the price is a smoky tube tied around the side faces of a glass cuboid fixed to
 * the golden or Yamato ratio. Draw the forecast on the glass, drop candies on the strobe ladder,
 * feel the dragon's wind when you touch the tube, and watch it from 22 broadcast angles on an LED
 * board — or step in with VR / MR where the device supports it. Synthetic prices only.
 */
export default function GlassKnotLab() {
  const mount = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<RatioKey>('golden');
  const [material, setMaterial] = useState<Material>('smoke');
  const [draw, setDraw] = useState(false);
  const [broadcast, setBroadcast] = useState(true);
  const [cam, setCam] = useState(0);
  const [hud, setHud] = useState({ score: 0, last: null as null | number, fills: 0, candies: 0, misses: 0, wind: 0, hype: 0, knots: 0, price: 0, drawn: 0, xr: '' });
  const live = useRef({ material, draw, broadcast, cam }); live.current = { material, draw, broadcast, cam };
  const api = useRef({ dropCandy: (_x: number, _y: number) => false as boolean, dropAtRung: (_i: number) => false as boolean });
  const [levels, setLevels] = useState<number[]>([]);
  const [dragCandy, setDragCandy] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = mount.current; if (!el) return undefined;
    const W = el.clientWidth; const H = Math.round(Math.min(560, W * 0.62));
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true;
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#06070b');
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 100);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(3, 6, 4); scene.add(sun);

    const box: Box = makeBox(ratio); const target = new THREE.Vector3(0, box.h / 2, 0); controls.target.copy(target);
    // Floor and glass cuboid.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: '#0b0d14', metalness: 0.6, roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const grid = new THREE.GridHelper(12, 24, '#1d2a44', '#121a2c'); grid.position.y = 0.001; scene.add(grid);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), new THREE.MeshPhysicalMaterial({ color: '#f2f8ff', transmission: 1, roughness: 0.04, thickness: 0.35, ior: 1.5, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.y = box.h / 2; scene.add(glass);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.55 })); edges.position.copy(glass.position); scene.add(edges);

    // Synthetic price series (a dancer's default pose drives the synthetic API).
    const synth = new SynthApi(20261111, 100); const params = { ...paramsOf(DEFAULT_POSE), sigma: 0.35 };
    let prices: number[] = []; for (let i = 0; i < 88; i += 1) { synth.nextBeat(params); prices.push(synth.price); }
    let start = 0; // global index of prices[0]
    const drawn = new Map<number, number>(); // global step → drawn price
    let score = 0; let fills = 0; let misses = 0; let wind = 0; let hype = 0; let lastPts: number | null = null;
    const opts = (): PathOpts => {
      const vis = prices; const lo = Math.min(...vis); const hi = Math.max(...vis); const pad = (hi - lo) * 0.25 + 0.5;
      return { stepsPerLap: STEPS_PER_LAP, margin: 0.14, lo: lo - pad, hi: hi + pad, knotRadius: 0.055, knotThreshold: 0.1, tube: 0.028, u0: (start / STEPS_PER_LAP) * box.perimeter };
    };

    const materials: Record<Material, THREE.Material> = {
      smoke: new THREE.MeshPhysicalMaterial({ color: '#16161a', transmission: 0.7, roughness: 0.06, thickness: 0.06, ior: 1.45, attenuationColor: new THREE.Color('#000000'), attenuationDistance: 0.04, clearcoat: 1, clearcoatRoughness: 0.05 }),
      metal: new THREE.MeshStandardMaterial({ color: '#e8e8ec', metalness: 1, roughness: 0.14 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#cfe0ff', transmission: 1, roughness: 0.02, thickness: 0.06, ior: 1.52, clearcoat: 1 }),
    };
    const futureMat = new THREE.MeshPhysicalMaterial({ color: '#ffb000', transmission: 0.5, roughness: 0.1, thickness: 0.05, emissive: '#ff8a00', emissiveIntensity: 0.25 });
    let tube: THREE.Mesh | null = null; let future: THREE.Mesh | null = null; let pathCache = buildPath(box, prices, opts());
    const rebuild = () => {
      const o = opts(); pathCache = buildPath(box, prices, o);
      if (tube) { scene.remove(tube); tube.geometry.dispose(); }
      tube = new THREE.Mesh(new THREE.TubeGeometry(new Polyline(pathCache.map((q) => v(q.center))), Math.min(1800, pathCache.length * 2), o.tube, 12, false), materials[live.current.material]);
      scene.add(tube);
      // The drawn forecast: same surface spiral, from the last revealed step forward.
      if (future) { scene.remove(future); future.geometry.dispose(); future = null; }
      const lastI = start + prices.length - 1; const fut: number[] = [prices[prices.length - 1]];
      for (let k = 1; k <= FUTURE; k += 1) { const d = drawn.get(lastI + k); if (d === undefined) break; fut.push(d); }
      if (fut.length > 1) {
        const fo = { ...o, u0: ((lastI) / STEPS_PER_LAP) * box.perimeter, knotThreshold: 99 };
        const fp = buildPath(box, fut, fo);
        future = new THREE.Mesh(new THREE.TubeGeometry(new Polyline(fp.map((q) => v(q.center))), fp.length * 2, o.tube * 0.8, 10, false), futureMat); scene.add(future);
      }
    };
    rebuild();

    // Strobe ladder on the front-right vertical edge, and the candies dropped on it.
    const ladder = new THREE.Group(); scene.add(ladder);
    const rungMat = () => new THREE.MeshStandardMaterial({ color: '#ff2bd6', emissive: '#ff2bd6', emissiveIntensity: 0.2, metalness: 0.4, roughness: 0.3 });
    const rungs: THREE.Mesh[] = [];
    for (let i = 0; i < RUNGS; i += 1) {
      const y = 0.14 + ((box.h - 0.28) * (i + 0.5)) / RUNGS;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 10), rungMat()); r.rotation.z = Math.PI / 2;
      r.position.set(box.w / 2 + 0.2, y, box.d / 2 + 0.02); r.userData = { y }; ladder.add(r); rungs.push(r);
    }
    for (const x of [box.w / 2 + 0.03, box.w / 2 + 0.37]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, box.h, 8), new THREE.MeshStandardMaterial({ color: '#888', metalness: 1, roughness: 0.2 })); rail.position.set(x, box.h / 2, box.d / 2 + 0.02); ladder.add(rail); }
    const candies: { mesh: THREE.Mesh; level: number; placed: number; filled: boolean; until: number }[] = [];
    const candyGeo = new THREE.SphereGeometry(0.05, 20, 14);

    // Dragon wind particles.
    const gust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#7ff3ff', size: 0.03, transparent: true, opacity: 0.8 }));
    const gustPos = new Float32Array(300); const gustVel = new Float32Array(300); let gustLife = 0;
    gust.geometry.setAttribute('position', new THREE.BufferAttribute(gustPos, 3)); scene.add(gust);
    const blowAt = (p: THREE.Vector3, n: THREE.Vector3, strength: number) => {
      for (let i = 0; i < 100; i += 1) { gustPos.set([p.x, p.y, p.z], i * 3); gustVel.set([n.x * (0.5 + Math.random()) + (Math.random() - 0.5) * 0.6, (Math.random() - 0.3) * 0.6, n.z * (0.5 + Math.random()) + (Math.random() - 0.5) * 0.6].map((x) => x * (0.6 + strength * 2)), i * 3); }
      gustLife = 1; gust.geometry.attributes.position.needsUpdate = true;
    };

    // Pointer: draw the forecast on the glass, or touch the tube for the dragon's wind.
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const toNdc = (cx: number, cy: number) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
    let drawing = false; let drawStartX = 0; let lastVibe = 0;
    const onDown = (e: PointerEvent) => { if (!live.current.draw) return; drawing = true; drawStartX = e.clientX; onMove(e); };
    const onUp = () => { drawing = false; };
    const onMove = (e: PointerEvent) => {
      toNdc(e.clientX, e.clientY);
      if (drawing) {
        const hit = ray.intersectObject(glass)[0]; if (!hit) return;
        const k = 1 + Math.min(FUTURE - 1, Math.floor(Math.abs(e.clientX - drawStartX) / 14));
        const step = start + prices.length - 1 + k; const o = opts();
        drawn.set(step, priceOf(box, hit.point.y, o)); for (let j = 1; j < k; j += 1) if (!drawn.has(step - k + j)) drawn.set(step - k + j, priceOf(box, hit.point.y, o));
        rebuild(); return;
      }
      if (!tube) return;
      const hit = ray.intersectObject(tube)[0]; if (!hit) return;
      // Slope near the touched point → wind pressure.
      let best = 0; let bd = Infinity; pathCache.forEach((q, i) => { const d = (q.center.x - hit.point.x) ** 2 + (q.center.y - hit.point.y) ** 2 + (q.center.z - hit.point.z) ** 2; if (d < bd) { bd = d; best = i; } });
      const i = pathCache[best].i; const o = opts(); const slope = Math.abs((prices[Math.min(prices.length - 1, i + 1)] - prices[Math.max(0, i - 1)]) / (o.hi - o.lo));
      wind = Math.min(1, slope * 6); hype = Math.min(100, hype + wind * 6);
      blowAt(hit.point, v(pathCache[best].normal), wind);
      if (typeof navigator.vibrate === 'function' && performance.now() - lastVibe > 300) { navigator.vibrate(Math.round(20 + wind * 120)); lastVibe = performance.now(); }
    };
    renderer.domElement.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointermove', onMove);
    const placeCandy = (rung: THREE.Object3D) => {
      const y = rung.userData.y as number; const level = priceOf(box, y, opts());
      const m = new THREE.Mesh(candyGeo, new THREE.MeshPhysicalMaterial({ color: ['#ff4fa3', '#ffe600', '#3dff8f', '#00e5ff'][candies.length % 4], roughness: 0.15, clearcoat: 1, transmission: 0.3, thickness: 0.05 }));
      m.position.set(rung.position.x + (Math.random() - 0.5) * 0.2, y + 0.05, rung.position.z + 0.03); scene.add(m);
      candies.push({ mesh: m, level, placed: start + prices.length - 1, filled: false, until: start + prices.length - 1 + FUTURE }); return true;
    };
    api.current.dropCandy = (cx: number, cy: number) => { toNdc(cx, cy); const hit = ray.intersectObjects(rungs)[0]; return hit ? placeCandy(hit.object) : false; };
    api.current.dropAtRung = (i: number) => (rungs[i] ? placeCandy(rungs[i]) : false);

    // XR: VR and MR (AR) where supported; controllers touching the tube feel the wind.
    let xrNote = '';
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    if (xr) {
      void Promise.all([xr.isSessionSupported('immersive-vr').catch(() => false), xr.isSessionSupported('immersive-ar').catch(() => false)]).then(async ([vr, ar]) => {
        if (vr) { const { VRButton } = await import('three/examples/jsm/webxr/VRButton.js'); const b = VRButton.createButton(renderer); b.style.position = 'absolute'; el.appendChild(b); }
        if (ar) { const { ARButton } = await import('three/examples/jsm/webxr/ARButton.js'); const b = ARButton.createButton(renderer); b.style.position = 'absolute'; b.style.bottom = '60px'; el.appendChild(b); }
        xrNote = vr || ar ? `${vr ? 'VR' : ''}${vr && ar ? ' / ' : ''}${ar ? 'MR' : ''} 対応` : 'この端末は VR / MR 非対応';
      });
    } else xrNote = 'WebXR なし（VR / MR は対応端末で）';
    const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)]; controllers.forEach((c) => scene.add(c));

    // Reveal one step every 600 ms: score forecasts, fill candies, slide the window.
    const reveal = window.setInterval(() => {
      const prev = prices[prices.length - 1]; synth.nextBeat(params); const next = synth.price; prices.push(next);
      const step = start + prices.length - 1;
      if (drawn.has(step)) { const o = opts(); const s = scoreForecast([drawn.get(step)!], [next], o.hi - o.lo); if (s) { lastPts = s.points; score += s.points; hype = Math.min(100, hype + s.points / 6); } drawn.delete(step); }
      for (const c of candies) {
        if (c.filled || step > c.until) continue;
        if (crosses(prev, next, c.level)) { c.filled = true; fills += 1; score += 50; hype = Math.min(100, hype + 18); (c.mesh.material as THREE.MeshPhysicalMaterial).emissive = new THREE.Color('#ffffff'); (c.mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.8; }
      }
      for (const c of candies) if (!c.filled && step === c.until + 1) { misses += 1; c.mesh.scale.setScalar(0.5); }
      if (prices.length > WINDOW) { prices = prices.slice(prices.length - WINDOW); start = step - WINDOW + 1; }
      rebuild();
    }, 600);

    // 22 broadcast angles.
    const angles = cameraAngles(box); const camGoal = new THREE.Vector3(); let lastCut = performance.now(); let shownCam = live.current.cam;
    camera.position.set(angles[0].pos.x, angles[0].pos.y, angles[0].pos.z);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let hudT = 0;
    renderer.setAnimationLoop((now) => {
      const L = live.current;
      if (tube && tube.material !== materials[L.material]) tube.material = materials[L.material];
      controls.enabled = !L.draw && !L.broadcast;
      if (L.broadcast && now - lastCut > 4000) { lastCut = now; setCam((c) => (c + 1) % angles.length); }
      if (L.cam !== shownCam || L.broadcast) { shownCam = L.cam; const a = angles[L.cam]; camGoal.set(a.pos.x, a.pos.y, a.pos.z); camera.position.lerp(camGoal, reduce ? 1 : 0.04); camera.lookAt(target); controls.target.copy(target); }
      controls.update();
      // Strobe ladder: rungs near the current price glow at 2 Hz (no faster); steady with reduced motion.
      const o = opts(); const yNow = heightOf(box, prices[prices.length - 1], o);
      rungs.forEach((r) => { const near = Math.abs((r.userData.y as number) - yNow) < (box.h / RUNGS) * 0.6; (r.material as THREE.MeshStandardMaterial).emissiveIntensity = near ? (reduce ? 1 : 0.6 + 0.6 * Math.max(0, Math.sin(now / 1000 * Math.PI * 4))) : 0.15; });
      // Gust decay.
      if (gustLife > 0) { gustLife -= 0.02; for (let i = 0; i < 300; i += 1) gustPos[i] += gustVel[i] * 0.016; gust.geometry.attributes.position.needsUpdate = true; (gust.material as THREE.PointsMaterial).opacity = gustLife; }
      // XR controllers touching the tube: haptic pulse.
      if (renderer.xr.isPresenting) {
        renderer.xr.getSession()?.inputSources.forEach((src, k) => {
          const c = controllers[k]; if (!c) return; const p = c.position;
          const near = pathCache.some((q) => (q.center.x - p.x) ** 2 + (q.center.y - p.y) ** 2 + (q.center.z - p.z) ** 2 < 0.004);
          const act = (src.gamepad as (Gamepad & { hapticActuators?: { pulse: (v: number, ms: number) => void }[] }) | undefined)?.hapticActuators?.[0];
          if (near && act) act.pulse(0.6, 40);
        });
      }
      wind *= 0.97; hype *= 0.995;
      if (now - hudT > 200) { hudT = now; setLevels(rungs.map((r) => priceOf(box, r.userData.y as number, o))); setHud({ score, last: lastPts, fills, candies: candies.length, misses, wind, hype, knots: pathCache.filter((q) => q.knot).length / 18, price: prices[prices.length - 1], drawn: drawn.size, xr: xrNote }); }
      renderer.render(scene, camera);
    });
    return () => {
      window.clearInterval(reveal); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointermove', onMove);
      controls.dispose(); pmrem.dispose(); renderer.dispose(); el.querySelectorAll('canvas, button').forEach((n) => n.remove());
    };
  }, [ratio]);

  const hypeBar = '|'.repeat(Math.round(hud.hype / 5)).padEnd(20, '.');
  const box = makeBox(ratio);

  return (
    <main className="min-h-screen bg-[#030407] px-4 py-5 text-slate-100 sm:px-8"
      onPointerMove={(e) => dragCandy && setDragCandy({ x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => { if (dragCandy) { api.current.dropCandy(e.clientX, e.clientY); setDragCandy(null); } }}>
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-300">LAB · GLASS KNOT · SPORTS TRADING</p>
            <h1 className="font-mono text-2xl font-bold">ガラスの箱に結ぶ価格の紐</h1>
            <p className="text-xs text-slate-400">価格の線は、黄金比／大和比の直方体の側面に必ず沿う。予測とはチャートを描くこと：ガラスに描いた未来が、届いた値動きで採点される。値はすべて合成。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/mesh" className="border border-white/20 px-3 py-1">メッシュ LAB</Link><Link href="/cure-api/engine" className="border border-white/20 px-3 py-1">エンジン</Link></nav>
        </header>

        <section className="flex flex-wrap items-center gap-2 font-mono text-xs" aria-label="Controls">
          {(Object.keys(RATIO) as RatioKey[]).map((k) => <button key={k} type="button" aria-pressed={ratio === k} onClick={() => setRatio(k)} className={`border px-2 py-1 ${ratio === k ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/20'}`}>{RATIO[k].name}</button>)}
          <span className="mx-1 h-5 border-l border-white/15" />
          {([['smoke', '透明に黒（スモークガラス）'], ['metal', '金属（クローム）'], ['glass', '透明ガラス']] as [Material, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={material === k} onClick={() => setMaterial(k)} className={`border px-2 py-1 ${material === k ? 'border-amber-300 bg-amber-300/15' : 'border-white/20'}`}>{l}</button>)}
          <span className="mx-1 h-5 border-l border-white/15" />
          <label className="flex items-center gap-1"><input type="checkbox" checked={draw} onChange={(e) => setDraw(e.target.checked)} /> 予測を描く（ガラスの上を横にドラッグ）</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} /> 中継（4 秒ごとにカメラ切替）</label>
          <button type="button" onClick={() => { setBroadcast(false); setCam((c) => (c + 21) % 22); }} className="border border-white/20 px-2">◀</button>
          <button type="button" onClick={() => { setBroadcast(false); setCam((c) => (c + 1) % 22); }} className="border border-white/20 px-2">▶</button>
        </section>

        <div className="grid gap-3 lg:grid-cols-[1fr_330px]">
          <div ref={mount} className="relative overflow-hidden rounded-lg border border-white/10" aria-label="3D glass box" data-testid="stage" />
          <aside className="space-y-2">
            <LedBoard lines={[
              { text: `CAM ${String(cam + 1).padStart(2, '0')}/22  ${ratio === 'golden' ? 'GOLD' : 'YAMATO'}`, color: '#ffb000' },
              { text: `SCORE ${String(hud.score).padStart(6, ' ')}  LAST ${hud.last ?? '-'}`, color: '#3dff8f' },
              { text: `FILL ${hud.fills}/${hud.candies}  MISS ${hud.misses}`, color: '#ff4fa3' },
              { text: `WIND ${Math.round(hud.wind * 100)}%  KNOT ${Math.round(hud.knots)}`, color: '#00e5ff' },
              { text: `HYPE ${hypeBar}`, color: '#ff3b3b' },
            ]} />
            <section className="space-y-1 rounded border border-white/15 p-2 font-mono text-[11px]" aria-label="Candy box">
              <p className="text-[#ffe600]">お菓子の箱 → ストロボラダー</p>
              <div className="flex gap-1">
                {['🍬', '🍭', '🍬', '🍭'].map((c, i) => (
                  <button key={i} type="button" onPointerDown={(e) => { e.preventDefault(); setDragCandy({ x: e.clientX, y: e.clientY }); }} className="grid h-10 w-10 cursor-grab touch-none place-items-center rounded border border-[#ffe600]/50 bg-black text-2xl" aria-label="キャンディーをつかむ">{c}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-0.5" aria-label="Ladder levels">{[...levels].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => <button key={i} type="button" onClick={() => api.current.dropAtRung(i)} className="border border-[#ff2bd6]/50 px-1 text-[10px] text-[#ff8ae8]" aria-label={`段 ${i + 1}（${l.toFixed(2)}）にキャンディーを入れる`}>{l.toFixed(1)}</button>)}</div>
              <p className="text-slate-400">キャンディーをつかんで、箱の右手前の縁にあるラダーの段に落とす（または上の値段を押して入れる）。その段の値段を価格が 22 歩以内に横切れば FILL（＋50）。光る段は今の価格の近く（最大 2 Hz）。</p>
            </section>
            <section className="space-y-0.5 rounded border border-white/15 p-2 font-mono text-[11px] text-slate-300" aria-label="Notes" data-testid="notes">
              <p>箱：幅 {box.w.toFixed(2)} ・奥行 {box.d.toFixed(2)} ・高さ {box.h.toFixed(2)}（1 : {RATIO[ratio].r.toFixed(3)} : {(RATIO[ratio].r ** 2).toFixed(3)}）</p>
              <p>いまの価格 {hud.price.toFixed(2)} ・ 描いた未来 {hud.drawn} 歩 ・ 予測 1 歩ごとに 0〜100 点</p>
              <p>龍の風圧：マウス（VR ではコントローラー）で紐に触れると、傾きの強さで風と振動。</p>
              <p>{hud.xr}</p>
            </section>
          </aside>
        </div>
      </div>
      {dragCandy && <div className="pointer-events-none fixed z-50 text-3xl" style={{ left: dragCandy.x - 14, top: dragCandy.y - 18 }}>🍬</div>}
    </main>
  );
}
