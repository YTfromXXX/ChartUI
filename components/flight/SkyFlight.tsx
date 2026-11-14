'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LAYERS, RWY, contrailLikely, deg, initialFlight, layerAt, papi, step, type Controls, type Flight } from '@/lib/flightModel';

// The cockpit window. Units are metres; the camera stays at the origin and the world is drawn relative to
// the aircraft, so far things stay steady. What you see:
//  • a sky dome whose zenith deepens with altitude, haze at the horizon, fields far below;
//  • three cloud layers at their usual heights (cumulus, altostratus, cirrus);
//  • MESO layer (km away): other aircraft drawing contrails where the standard atmosphere is colder than −40 °C,
//    and game-only "electromagnetic" curves — mesh fragments that glitter (not a real phenomenon);
//  • MICRO layer (metres away): ice crystals streaming past the window, glinting (a real sight in cold air).
// Glints shimmer slowly (under 2 Hz per point); nothing flashes.
// The HUD: IND-01 moved onto the sky — the skewer is the horizon line (banks with roll, moves with pitch),
// the two dice spin faster with airspeed. Drag an ice crystal onto a die's pip to leave a check mark.
export type DropKind = 'perfect' | 'near' | 'miss';
const PIPS: Record<number, [number, number][]> = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };

function Die({ id, n, squash, cols }: { id: number; n: number; squash: number; cols: Record<string, string> }) {
  return (
    <svg viewBox="0 0 100 100" className="h-12 w-12" style={{ transform: `scaleY(${squash})` }} data-die={id}>
      <rect x="4" y="4" width="92" height="92" rx="14" fill="#fbfbf8" stroke="#1f1f1f" strokeWidth="4" />
      {PIPS[n].map(([x, y], k) => { const key = `${id}-${n}-${k}`; return <circle key={key} cx={x} cy={y} r={n === 1 ? 13 : 9} fill={cols[key] ?? (n === 1 ? '#c8001a' : '#2b3a67')} stroke={cols[key] ? '#1f1f1f' : 'none'} strokeWidth="3" data-pip={key} />; })}
    </svg>
  );
}

const twinkleVert = `uniform float scale; uniform float time; attribute float phase; attribute float sz; varying float vA;
  void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vA = 0.55 + 0.45 * sin(time * (2.0 + phase) + phase * 7.0);
    gl_PointSize = max(1.5, sz * scale / -mv.z) * (0.8 + 0.4 * vA); gl_Position = projectionMatrix * mv; }`;
const twinkleFrag = `uniform vec3 color; varying float vA;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
    float star = max(0.0, 1.0 - abs(d.x) * 10.0) * max(0.0, 1.0 - abs(d.y) * 1.6) + max(0.0, 1.0 - abs(d.y) * 10.0) * max(0.0, 1.0 - abs(d.x) * 1.6);
    float a = (smoothstep(1.0, 0.0, r) * 0.7 + star * 0.6) * vA; gl_FragColor = vec4(color + vec3(0.3) * star, a); }`;

export default function SkyFlight({ controls, onTelemetry, onDrop, reduced }: { controls: React.MutableRefObject<Controls>; onTelemetry: (f: Flight) => void; onDrop: (k: DropKind) => void; reduced: boolean }) {
  const host = useRef<HTMLDivElement>(null); const hud = useRef<HTMLDivElement>(null); const ghost = useRef<HTMLDivElement>(null);
  const [faces, setFaces] = useState<[number, number, number, number]>([1, 3, 1, 1]); // n0, n1, squash0, squash1 (×100)
  const [cols, setCols] = useState<Record<string, string>>({});
  const cb = useRef({ onTelemetry, onDrop }); cb.current = { onTelemetry, onDrop };
  useEffect(() => {
    const el = host.current; if (!el) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.prepend(renderer.domElement); renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.display = 'block';
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(55, 2, 1, 400000); camera.rotation.order = 'YXZ';
    let f = initialFlight();

    // sky dome
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      uniforms: { zen: { value: new THREE.Color('#2f6db5') }, hor: { value: new THREE.Color('#d4e8f5') }, low: { value: new THREE.Color('#b9c9bf') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 zen; uniform vec3 hor; uniform vec3 low; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, zen, pow(y, 0.45)) : mix(hor, low, pow(-y, 0.5)); gl_FragColor = vec4(c, 1.0); }' }));
    scene.add(sky);
    // ground: fields, far below
    const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d')!;
    for (let i = 0; i < 64; i += 1) { gg.fillStyle = ['#7f9f63', '#9bb06f', '#6f8f5a', '#b7b07a', '#86a37a'][i % 5]; gg.fillRect((i % 8) * 32, Math.floor(i / 8) * 32, 32, 32); }
    gg.strokeStyle = '#5a6b4a'; gg.lineWidth = 1; for (let k = 0; k <= 256; k += 32) { gg.beginPath(); gg.moveTo(k, 0); gg.lineTo(k, 256); gg.moveTo(0, k); gg.lineTo(256, k); gg.stroke(); }
    const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(400, 400); gt.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400000, 400000), new THREE.MeshBasicMaterial({ map: gt })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    scene.fog = new THREE.Fog('#d4e8f5', 20000, 160000);
    // the runway (36): asphalt, threshold "piano keys", the number, aiming-point bars, touchdown-zone bars, centre-line dashes
    const rc = document.createElement('canvas'); rc.width = 128; rc.height = 2048; const rg = rc.getContext('2d')!; const my = (m: number) => 2048 - (m / RWY.length) * 2048; const mx = (m: number) => (m / RWY.width) * 128;
    rg.fillStyle = '#3b3d40'; rg.fillRect(0, 0, 128, 2048); rg.fillStyle = '#f4f4f0';
    for (let k = 0; k < 8; k += 1) { rg.fillRect(mx(3 + k * 5.2), my(36), mx(3), my(6) - my(36)); } // piano keys (6–36 m)
    rg.font = 'bold 26px sans-serif'; rg.textAlign = 'center'; rg.save(); rg.translate(64, my(60)); rg.fillText('36', 0, 0); rg.restore();
    for (const z of [150, 450, 600, 750]) { rg.fillRect(mx(6), my(z + 22), mx(4), my(z) - my(z + 22)); rg.fillRect(mx(35), my(z + 22), mx(4), my(z) - my(z + 22)); } // touchdown zone
    rg.fillRect(mx(5), my(345), mx(9), my(300) - my(345)); rg.fillRect(mx(31), my(345), mx(9), my(300) - my(345)); // aiming point (300 m)
    for (let z = 120; z < RWY.length - 60; z += 60) rg.fillRect(63, my(z + 30), 2, my(z) - my(z + 30)); // centre line
    rg.fillRect(0, 0, 3, 2048); rg.fillRect(125, 0, 3, 2048); // edges
    const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8;
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(RWY.width, RWY.length), new THREE.MeshBasicMaterial({ map: rt })); runway.rotation.x = -Math.PI / 2; scene.add(runway);
    // PAPI: four lights left of the aim point (nearest the runway first)
    const papiGeo = new THREE.BufferGeometry(); papiGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); papiGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12), 3));
    const papiPts = new THREE.Points(papiGeo, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, fog: false })); scene.add(papiPts);

    // clouds: soft puffs on a 60 km tile that wraps around the aircraft
    const puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffffee'); gr.addColorStop(0.5, '#ffffff88'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    const TILE = 60000;
    const cloudSets = LAYERS.map((L, li) => {
      const n = L.kind === 'cumulus' ? 700 : L.kind === 'altostratus' ? 500 : 600; const base = new Float32Array(n * 3);
      for (let k = 0; k < n; k += 1) {
        const cx = Math.random() * TILE; const cz = Math.random() * TILE;
        base[k * 3] = L.kind === 'cirrus' ? cx + Math.sin(cz / 3000) * 2000 : cx; base[k * 3 + 1] = L.base + Math.random() * (L.top - L.base); base[k * 3 + 2] = cz;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = new THREE.PointsMaterial({ map: puff, size: L.kind === 'cumulus' ? 900 : L.kind === 'altostratus' ? 1400 : 700, transparent: true, depthWrite: false, opacity: L.kind === 'cirrus' ? 0.5 : 0.85, fog: true, color: li === 1 ? '#eef2f6' : '#ffffff' });
      const pts = new THREE.Points(geo, mat); scene.add(pts); return { base, geo, n };
    });
    const wrap = (v: number, c: number) => { let d = (v - c) % TILE; if (d < -TILE / 2) d += TILE; if (d > TILE / 2) d -= TILE; return d; };

    const twinkle = (color: string, additive = true) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 300 }, time: { value: 0 }, color: { value: new THREE.Color(color) } }, vertexShader: twinkleVert, fragmentShader: twinkleFrag });
    const twMats: THREE.ShaderMaterial[] = [];

    // MESO: other aircraft with contrails
    const TRAIL = 260;
    const others = [0, 1, 2].map((k) => {
      const alt = [10100, 11200, 8000][k]; const hd = [1.2, 3.6, 5.4][k];
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
      geo.setAttribute('phase', new THREE.BufferAttribute(Float32Array.from({ length: TRAIL }, () => Math.random() * 6), 1));
      geo.setAttribute('sz', new THREE.BufferAttribute(Float32Array.from({ length: TRAIL }, (_, i) => 60 + i * 0.6), 1));
      const mat = twinkle('#ffffff', false); twMats.push(mat); const trail = new THREE.Points(geo, mat); scene.add(trail);
      const body = new THREE.Mesh(new THREE.SphereGeometry(40, 8, 6), new THREE.MeshBasicMaterial({ color: '#cfd6dc' })); scene.add(body);
      return { x: (k - 1) * 9000, z: -14000 - k * 6000, alt, hd, hist: [] as [number, number, number][], geo, trail, body };
    });
    // MESO (game only): glittering "electromagnetic" curves — fragments of a mesh drifting far away
    const emGroup = new THREE.Group(); scene.add(emGroup);
    const emCurves = [0, 1, 2, 3].map((k) => {
      const n = 160; const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 1) { const t = i / (n - 1); p[i * 3] = (t - 0.5) * 9000; p[i * 3 + 1] = Math.sin(t * Math.PI * (3 + k)) * 500; p[i * 3 + 2] = Math.cos(t * Math.PI * 2) * 800; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      geo.setAttribute('phase', new THREE.BufferAttribute(Float32Array.from({ length: n }, () => Math.random() * 6), 1)); geo.setAttribute('sz', new THREE.BufferAttribute(new Float32Array(n).fill(55), 1));
      const mat = twinkle(['#9fe8ff', '#ffb3e6', '#fff27a', '#b3ffd9'][k]); twMats.push(mat);
      const g = new THREE.Group(); g.add(new THREE.Points(geo, mat)); g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ['#9fe8ff', '#ffb3e6', '#fff27a', '#b3ffd9'][k], transparent: true, opacity: 0.25 })));
      g.userData = { x: Math.cos(k * 1.7) * 20000, z: -16000 - k * 7000, dy: 600 + k * 400, rot: k }; emGroup.add(g); return g;
    });
    // MICRO: ice crystals by the window
    const NI = 260; const ice = new Float32Array(NI * 3);
    for (let i = 0; i < NI; i += 1) { ice[i * 3] = (Math.random() - 0.5) * 60; ice[i * 3 + 1] = (Math.random() - 0.5) * 30; ice[i * 3 + 2] = -Math.random() * 80 - 4; }
    const iceGeo = new THREE.BufferGeometry(); iceGeo.setAttribute('position', new THREE.BufferAttribute(ice, 3));
    iceGeo.setAttribute('phase', new THREE.BufferAttribute(Float32Array.from({ length: NI }, () => Math.random() * 6), 1)); iceGeo.setAttribute('sz', new THREE.BufferAttribute(Float32Array.from({ length: NI }, () => 0.25 + Math.random() * 0.35), 1));
    const iceMat = twinkle('#e8f6ff'); twMats.push(iceMat); const icePts = new THREE.Points(iceGeo, iceMat); camera.add(icePts); scene.add(camera); // crystals ride with the camera, streaming past

    // drag an ice crystal onto a die's pip
    let held = -1; const cv = renderer.domElement;
    const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
    const down = (e: PointerEvent) => {
      const p = local(e); let best = -1; let bd = 32 * 32; const v = new THREE.Vector3();
      for (let i = 0; i < NI; i += 1) { v.set(ice[i * 3], ice[i * 3 + 1], ice[i * 3 + 2]).applyMatrix4(icePts.matrixWorld).project(camera); if (v.z > 1) continue; const dx = ((v.x + 1) / 2) * p.w - p.x; const dy = ((1 - v.y) / 2) * p.h - p.y; if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; } }
      if (best < 0) return; held = best; ice[best * 3 + 2] = -9999; cv.setPointerCapture(e.pointerId);
      if (ghost.current) { ghost.current.style.display = 'block'; ghost.current.style.left = `${p.x}px`; ghost.current.style.top = `${p.y}px`; }
    };
    const move = (e: PointerEvent) => { if (held < 0 || !ghost.current) return; const p = local(e); ghost.current.style.left = `${p.x}px`; ghost.current.style.top = `${p.y}px`; };
    const up = (e: PointerEvent) => {
      if (held < 0) return; ice[held * 3 + 2] = -84; held = -1; if (ghost.current) ghost.current.style.display = 'none';
      cv.style.pointerEvents = 'none'; const target = document.elementFromPoint(e.clientX, e.clientY); cv.style.pointerEvents = '';
      const pip = target?.closest('[data-pip]')?.getAttribute('data-pip'); const die = target?.closest('[data-die]');
      if (pip) { setCols((c) => ({ ...c, [pip]: ['#9fe8ff', '#ffb3e6', '#fff27a', '#b3ffd9'][Object.keys(c).length % 4] })); cb.current.onDrop('perfect'); }
      else cb.current.onDrop(die ? 'near' : 'miss');
    };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    const resize = () => { const w = el.clientWidth; const h = Math.round(Math.min(w * 0.5, 420)); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener('resize', resize);
    let raf = 0; let last = performance.now(); let t = 0; let spin0 = 0; let spin1 = 0; let tele = 0; let lastFaces = '';
    const zenLow = new THREE.Color('#4f8fd6'); const zenHigh = new THREE.Color('#1d4f9c');
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const sp = reduced ? 0.5 : 1; t += dt * sp;
      if (controls.current.reset) { f = controls.current.reset; controls.current.reset = undefined; }
      f = step(f, controls.current, dt);
      camera.rotation.set(f.pitch, -f.heading, -f.roll); camera.updateMatrixWorld();
      (sky.material as THREE.ShaderMaterial).uniforms.zen.value.copy(zenLow).lerp(zenHigh, Math.min(1, f.alt / 12000));
      const eye = 4; ground.position.y = -f.alt - eye - 0.2;
      runway.position.set(-f.x, -f.alt - eye, -RWY.length / 2 - f.z);
      { const pp = papi(f); const pa = papiGeo.attributes.position.array as Float32Array; const pc = papiGeo.attributes.color.array as Float32Array;
        for (let i = 0; i < 4; i += 1) { pa[i * 3] = -RWY.width / 2 - 15 - i * 9 - f.x; pa[i * 3 + 1] = -f.alt - eye + 1; pa[i * 3 + 2] = RWY.aimZ - f.z; const white = pp ? i >= 4 - pp.white : false; pc[i * 3] = 1; pc[i * 3 + 1] = white ? 1 : 0.15; pc[i * 3 + 2] = white ? 1 : 0.1; }
        papiGeo.attributes.position.needsUpdate = true; papiGeo.attributes.color.needsUpdate = true; }
      icePts.visible = f.alt > 6000 || !!layerAt(f.alt); gt.offset.set((f.x / 1000) % 1, (-f.z / 1000) % 1);
      for (const s of cloudSets) { const a = s.geo.attributes.position.array as Float32Array; for (let k = 0; k < s.n; k += 1) { a[k * 3] = wrap(s.base[k * 3], f.x); a[k * 3 + 1] = s.base[k * 3 + 1] - f.alt; a[k * 3 + 2] = wrap(s.base[k * 3 + 2], f.z); } s.geo.attributes.position.needsUpdate = true; }
      for (const o of others) {
        o.x += Math.sin(o.hd) * 230 * dt; o.z -= Math.cos(o.hd) * 230 * dt;
        if (Math.hypot(o.x - f.x, o.z - f.z) > 70000) { o.x = f.x + Math.sin(f.heading + 0.4) * 30000; o.z = f.z - Math.cos(f.heading + 0.4) * 30000; o.hist = []; }
        o.hist.unshift([o.x, o.alt, o.z]); if (o.hist.length > TRAIL) o.hist.pop();
        o.body.position.set(o.x - f.x, o.alt - f.alt, o.z - f.z);
        const a = o.geo.attributes.position.array as Float32Array; const on = contrailLikely(o.alt);
        for (let i = 0; i < TRAIL; i += 1) { const h = o.hist[Math.min(o.hist.length - 1, i * 2)] ?? [o.x, o.alt, o.z]; a[i * 3] = h[0] - f.x + Math.sin(i * 0.3) * i * 0.4; a[i * 3 + 1] = on && i > 3 ? h[1] - f.alt : -1e7; a[i * 3 + 2] = h[2] - f.z; }
        o.geo.attributes.position.needsUpdate = true;
      }
      for (const g of emCurves) { const u = g.userData; g.position.set(u.x - f.x, u.dy + 10600 - f.alt, u.z - f.z); g.rotation.y = t * 0.05 + u.rot; }
      // ice crystals stream past at our speed (they are close, so they move fast)
      for (let i = 0; i < NI; i += 1) { if (i === held) continue; ice[i * 3 + 2] += f.speed * dt * 0.12 * sp; if (ice[i * 3 + 2] > -3) { ice[i * 3] = (Math.random() - 0.5) * 60; ice[i * 3 + 1] = (Math.random() - 0.5) * 30; ice[i * 3 + 2] = -84; } }
      iceGeo.attributes.position.needsUpdate = true;
      const scale = camera.projectionMatrix.elements[5] * renderer.domElement.height / 2; for (const m of twMats) { m.uniforms.time.value = t; m.uniforms.scale.value = scale; }
      renderer.render(scene, camera);
      // HUD: the skewer horizon
      const pxPerDeg = el.clientHeight / camera.fov;
      if (hud.current) hud.current.style.transform = `translate(-50%, -50%) translateY(${deg(f.pitch) * pxPerDeg}px) rotate(${-deg(f.roll)}deg)`;
      spin0 += (f.speed / 235) * dt * 2.2 * sp; spin1 -= (f.speed / 235) * dt * 3.1 * sp;
      const fc = (s: number) => [1, 2, 3, 5, 6, 4][((Math.floor(s / (Math.PI / 2)) % 6) + 6) % 6]; const sq = (s: number) => Math.round(Math.abs(Math.cos(s)) * 8) * 10 + 20; // a few steps only (fewer re-renders)
      const nf = `${fc(spin0)},${fc(spin1)},${sq(spin0)},${sq(spin1)}`; if (nf !== lastFaces) { lastFaces = nf; setFaces(nf.split(',').map(Number) as [number, number, number, number]); }
      tele += dt; if (tele > 0.1) { tele = 0; cb.current.onTelemetry(f); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); renderer.dispose(); cv.remove(); };
  }, [controls, reduced]);

  return (
    <div ref={host} className="relative w-full overflow-hidden" data-testid="sky-flight">
      <div ref={hud} className="pointer-events-none absolute left-1/2 top-1/2 flex w-[70%] items-center justify-center" data-testid="hud-horizon">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#c89b62] shadow-[0_0_6px_#fff8]" />
        <div className="pointer-events-auto relative flex w-full justify-around"><Die id={0} n={faces[0]} squash={faces[2] / 100} cols={cols} /><Die id={1} n={faces[1]} squash={faces[3] / 100} cols={cols} /></div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-10 -translate-x-1/2 bg-[#fff27a]" aria-hidden />
      <div ref={ghost} className="pointer-events-none absolute hidden h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#e8f6ff]" style={{ boxShadow: '0 0 10px #fff' }} />
    </div>
  );
}
