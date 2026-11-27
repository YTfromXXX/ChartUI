'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BALL_R, HEX_A, PITCHES, fishAt, fly, makeWorld, score, throwFromDrag, type Flight, type Pitch, type World } from '@/lib/honeycombPunish';

const HEX_R = (2 * HEX_A) / Math.sqrt(3);

function plateGeometry(holes: { x: number; y: number }[]) {
  const s = new THREE.Shape(); s.moveTo(-1.35, 0); s.lineTo(1.35, 0); s.lineTo(1.35, 2); s.lineTo(-1.35, 2); s.lineTo(-1.35, 0);
  for (const h of holes) { const p = new THREE.Path(); for (let k = 0; k < 6; k += 1) { const a = (k * Math.PI) / 3; const x = h.x + HEX_R * Math.cos(a); const y = h.y + HEX_R * Math.sin(a); if (k) p.lineTo(x, y); else p.moveTo(x, y); } p.closePath(); s.holes.push(p); }
  return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 1 });
}

/**
 * Honeycomb Punish: throw a clear ball through glass plates cut with honeycomb holes. Drag on the
 * scene (the length is the speed, a curved drag adds side spin) and pick a pitch for the spin.
 */
export default function HoneycombPunish() {
  const mount = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState(2);
  const [pitch, setPitch] = useState<Pitch>(PITCHES[0]);
  const [guide, setGuide] = useState(true);
  const [sound, setSound] = useState(false);
  const [result, setResult] = useState<{ passed: number; score: number; text: string } | null>(null);
  const [best, setBest] = useState(0);
  const live = useRef({ pitch, guide, sound }); live.current = { pitch, guide, sound };

  useEffect(() => {
    const el = mount.current; if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = el.clientWidth; const H = Math.round(Math.min(560, W * 0.6));
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; el.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#dff3f7'); scene.fog = new THREE.Fog('#dff3f7', 6, 16);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 50); camera.position.set(0, 1.25, -1.6); camera.lookAt(0, 1, 4);
    scene.add(new THREE.HemisphereLight('#ffffff', '#9fd3e0', 1.2)); const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(2, 5, -2); scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), new THREE.MeshStandardMaterial({ color: '#b9e4ec', roughness: 0.15, metalness: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.position.z = 4; scene.add(floor);

    const world: World = makeWorld(seed);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#e8fbff', transmission: 0.92, roughness: 0.05, thickness: 0.05, ior: 1.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const waterMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0, thickness: 0.02, ior: 1.33, transparent: true });
    const plates = world.plates.map((pl) => {
      const g = new THREE.Group(); g.position.z = pl.z; scene.add(g);
      const mesh = new THREE.Mesh(plateGeometry(pl.holes), glass.clone()); g.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color: '#7fb9c9', transparent: true, opacity: 0.6 })); g.add(edges);
      const drops = pl.droplets.map((d) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), waterMat); m.scale.set(1, 1.3, 0.5); m.position.set(d.x, d.y, -0.01); g.add(m); return m; });
      // Wind chime (風鈴): a glass bell with a paper strip, hanging above the plate.
      const chime = new THREE.Group(); chime.position.set(1.1, 2.3, 0); g.add(chime);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), glass); chime.add(bell);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.22), new THREE.MeshStandardMaterial({ color: '#f472b6', side: THREE.DoubleSide })); strip.position.y = -0.22; chime.add(strip);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.3), new THREE.MeshBasicMaterial({ color: '#94a3b8' })); string.position.y = 0.2; chime.add(string);
      return { g, mesh, drops, chime, swing: 0, ring: 0 };
    });
    const fishes = world.fish.map(() => {
      const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#ff6a2b', clearcoat: 1, roughness: 0.3 })); body.scale.set(1.5, 0.8, 0.6); g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 12), new THREE.MeshPhysicalMaterial({ color: '#ffb199', transmission: 0.5, transparent: true, opacity: 0.8 })); tail.rotation.z = Math.PI / 2; tail.position.x = -0.18; g.add(tail);
      scene.add(g); return g;
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0, thickness: 0.12, ior: 1.45, transparent: true }));
    const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 1.01, 0.003, 6, 40), new THREE.MeshBasicMaterial({ color: '#ef4444' })); ball.add(seam);
    ball.position.set(0, 1, 0); scene.add(ball);
    const guideLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#0e7490', dashSize: 0.05, gapSize: 0.04 })); scene.add(guideLine);

    let audio: AudioContext | null = null;
    const chimeSound = () => {
      if (!live.current.sound) return; audio = audio ?? new AudioContext(); const o = audio.createOscillator(); const gn = audio.createGain();
      o.frequency.value = 2400 + Math.random() * 300; gn.gain.setValueAtTime(0.0001, audio.currentTime); gn.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 1.2);
      o.connect(gn).connect(audio.destination); o.start(); o.stop(audio.currentTime + 1.3);
    };

    let flight: Flight | null = null; let launched = 0; let shown = 0; let clock = 0; let drag: { x: number; y: number }[] | null = null;
    const local = (e: PointerEvent) => { const b = renderer.domElement.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const preview = () => {
      if (!drag || drag.length < 2 || !live.current.guide) { guideLine.visible = false; return; }
      const th = throwFromDrag(drag, live.current.pitch); const f = fly(th, { plates: [], fish: [] }, clock, 1 / 240);
      const part = f.path.filter((q) => q.p.z < 1.5); // the guide shows only the run up to the first plate
      guideLine.geometry.dispose(); guideLine.geometry = new THREE.BufferGeometry().setFromPoints(part.map((q) => new THREE.Vector3(q.p.x, q.p.y, q.p.z))); guideLine.computeLineDistances(); guideLine.visible = true;
    };
    const down = (e: PointerEvent) => { if (flight && clock - launched < (flight.path[flight.path.length - 1].t + 0.8)) return; drag = [local(e)]; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drag) return; drag.push(local(e)); preview(); };
    const up = () => {
      if (!drag || drag.length < 3) { drag = null; return; }
      const th = throwFromDrag(drag, live.current.pitch); drag = null; guideLine.visible = false;
      flight = fly(th, world, clock); launched = clock; shown = 0;
      plates.forEach((p) => { p.ring = 0; p.drops.forEach((d) => { d.visible = true; d.position.y = world.plates[plates.indexOf(p)].droplets[p.drops.indexOf(d)].y; }); });
      const ev = flight.events; const last = ev[ev.length - 1];
      const text = flight.passed === world.plates.length ? '全部の板を通り抜けた' : last?.kind === 'punish' ? `${last.index + 1} 枚目のガラスに当たった（パニッシュ）` : last?.kind === 'floor' ? '床に落ちた' : '届かなかった';
      const sc = score(flight); window.setTimeout(() => { setResult({ passed: flight?.passed ?? 0, score: sc, text }); setBest((b) => Math.max(b, sc)); }, (flight.path[flight.path.length - 1].t) * 1000);
    };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up);

    let last = performance.now(); let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000); last = Math.max(last, now); clock += dt;
      world.fish.forEach((f, i) => { const p = fishAt(f, clock); const pPrev = fishAt(f, clock - 0.05); fishes[i].position.set(p.x, p.y, p.z); fishes[i].rotation.y = p.x > pPrev.x ? 0 : Math.PI; fishes[i].children[1].rotation.y = 0.4 * Math.sin(clock * (reduce ? 2 : 6)); });
      if (flight) {
        const t = clock - launched; const path = flight.path; let k = shown; while (k < path.length - 1 && path[k + 1].t <= t) k += 1; shown = k;
        ball.position.set(path[k].p.x, path[k].p.y, path[k].p.z);
        // Show the spin slowed 40× so the seam turns visibly but never strobes.
        ball.rotation.x += (flight.spin.x / 40) * dt; ball.rotation.y += (flight.spin.y / 40) * dt;
        for (const e of flight.events) if (e.t <= t && e.t > t - dt - 1e-6) {
          if (e.kind === 'pass') { plates[e.index].swing = 1; chimeSound(); }
          if (e.kind === 'punish') { plates[e.index].ring = 1; chimeSound(); }
          if (e.kind === 'drop') plates[Math.floor(e.index / 100)].drops[e.index % 100].userData.fall = true;
        }
      }
      for (const p of plates) {
        p.swing *= Math.exp(-dt * 1.2); p.chime.rotation.z = 0.35 * p.swing * Math.sin(clock * 5); p.chime.children[1].rotation.x = 0.6 * p.swing * Math.sin(clock * 4 + 1);
        p.ring *= Math.exp(-dt * 2.5); (p.mesh.material as THREE.MeshPhysicalMaterial).color.setRGB(0.91 + 0.09 * p.ring, 0.98 - 0.25 * p.ring, 1 - 0.3 * p.ring);
        p.mesh.position.x = 0.01 * p.ring * Math.sin(clock * 12);
        for (const d of p.drops) if (d.userData.fall && d.visible) { d.position.y -= dt * 1.2; if (d.position.y < 0.02) { d.visible = false; d.userData.fall = false; } }
      }
      renderer.render(scene, camera); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); void audio?.close(); renderer.dispose(); pmrem.dispose(); renderer.domElement.remove(); };
  }, [seed]);

  return (
    <main className="min-h-screen bg-[#eef9fb] px-4 py-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-500">LAB · ハニカムパニッシュ</p>
            <h1 className="text-2xl font-semibold">透明の玉を、蜂の巣の板に通す</h1>
            <p className="max-w-3xl text-sm text-slate-600">ガラスの板に蜂の巣の穴、板には水滴、間には金魚、上には風鈴。画面をドラッグして投げます（長さ＝球速、曲げて描くと横回転）。球種で回転が変わり、マグヌス力で曲がります。ガラスに触れたらパニッシュ。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/prompt-chess" className="border border-slate-400 px-3 py-1">プロンプトチェス</Link><Link href="/lab/crystal-baby" className="border border-slate-400 px-3 py-1">クリスタルベイビー対決</Link></nav>
        </header>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {PITCHES.map((p) => <button key={p.key} type="button" data-testid={`pitch-${p.key}`} onClick={() => setPitch(p)} className="rounded border px-2 py-1" style={{ borderColor: pitch.key === p.key ? '#0e7490' : '#94a3b8', background: pitch.key === p.key ? '#cffafe' : 'transparent' }}>{p.label} · {p.rpm} rpm</button>)}
          <label className="flex items-center gap-1"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />最初の板までのガイド</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />風鈴の音</label>
          <button type="button" onClick={() => { setSeed((s) => s + 1); setResult(null); }} className="rounded border border-slate-400 px-2 py-1">新しい板</button>
        </div>
        <div ref={mount} data-testid="scene" className="relative w-full cursor-crosshair touch-none overflow-hidden rounded border border-slate-300" />
        <p data-testid="result" className="font-mono text-sm">{result ? `${result.text} — ${result.passed}/5 枚・${result.score} 点` : 'ドラッグして投げてください'}（最高 {best} 点）</p>
        <p className="text-xs text-slate-500">得点：板 1 枚 100 点、落とした水滴 1 つ 30 点、金魚にぶつかると −40 点、5 枚とも通れば 2 倍。回転の表示は 40 分の 1 の速さです（点滅に見えないように）。</p>
      </div>
    </main>
  );
}
