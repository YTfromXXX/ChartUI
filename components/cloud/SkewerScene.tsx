'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SkyPalette } from '@/lib/skyPalettes';

// -[]-[]- : two dice turning on one skewer, filmed with a minimal DOLLY ZOOM (the camera backs away
// while the lens narrows, so the skewer keeps its size and the world behind it stretches).
// Behind them, a spiral wound on a torus (a (p, q) torus knot) is never built as a mesh: it is only
// drawn as points that leave the knot and spread like splashes or soap bubbles, coloured from inside.
export type DropResult = { kind: 'perfect' | 'near' | 'miss'; color: string; die?: number; face?: number };
export type SceneOpts = { palette: SkyPalette; mode: 'bubble' | 'splash'; p: number; q: number; dolly: number; auto: boolean; reduced: boolean; onDrop?: (r: DropResult) => void };

const SUBJECT_W = 7; // width kept constant at the subject (the skewer is 6 long)
const N = 1800;

// Pip centres on a 128×128 face (canvas coordinates), and their radius.
export const PIPS: Record<number, [number, number][]> = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] };
const pipR = (n: number) => (n === 1 ? 16 : 11);
const FACE_NUMS = [1, 6, 2, 5, 3, 4]; // BoxGeometry material order (+x, −x, +y, −y, +z, −z)
function diceFace(n: number, bg: string, cols: Record<number, string> = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#00000022'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  PIPS[n].forEach(([x, y], k) => { g.fillStyle = cols[k] ?? (n === 1 ? '#c8001a' : '#2b3a67'); g.beginPath(); g.arc(x, y, pipR(n), 0, Math.PI * 2); g.fill(); if (cols[k]) { g.strokeStyle = '#1f1f1f'; g.lineWidth = 2; g.stroke(); } });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function skyTexture(cols: string[]) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, 256);
  cols.forEach((col, k) => gr.addColorStop(k / (cols.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const knotAt = (t: number, p: number, q: number, out: THREE.Vector3) => { const R = 5; const a = 2; const r = R + a * Math.cos(q * t); return out.set(r * Math.cos(p * t), r * Math.sin(p * t), a * Math.sin(q * t)); };

export default function SkewerScene({ opts }: { opts: SceneOpts }) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(opts); live.current = opts;
  useEffect(() => {
    const el = host.current; if (!el) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfd8ee, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 6, 8); scene.add(sun);

    // the skewer and two dice
    let palId = '';
    const stickMat = new THREE.MeshStandardMaterial({ color: '#c89b62', roughness: 0.8 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 16), stickMat); stick.rotation.z = Math.PI / 2; scene.add(stick);
    const dice: THREE.Mesh[] = []; let diceMats: THREE.MeshStandardMaterial[][] = []; let diceBg = '#ffffff';
    let pipCols: Record<number, string>[][] = [];
    const makeDice = (bg: string) => {
      diceBg = bg; pipCols = [0, 1].map(() => FACE_NUMS.map(() => ({})));
      dice.forEach((d) => scene.remove(d)); dice.length = 0; diceMats.flat().forEach((m) => { m.map?.dispose(); m.dispose(); });
      diceMats = [0, 1].map(() => [1, 6, 2, 5, 3, 4].map((n) => new THREE.MeshStandardMaterial({ map: diceFace(n, bg), roughness: 0.45 })));
      [-1.3, 1.3].forEach((x, k) => { const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), diceMats[k]); d.position.x = x; scene.add(d); dice.push(d); });
    };

    // the spiral on the torus: points only (no mesh, no net)
    const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3); const size = new Float32Array(N); const life = new Float32Array(N);
    const vel = new Float32Array(N * 3); const tpar = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('life', new THREE.BufferAttribute(life, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { bubble: { value: 1 }, scale: { value: 300 } },
      vertexShader: `uniform float scale; attribute float size; attribute float life; attribute vec3 color; varying vec3 vC; varying float vL;
        void main(){ vC = color; vL = life; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float bubble; varying vec3 vC; varying float vL;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
          float a; vec3 c = vC;
          if (bubble > 0.5) { // a soap film: thin, brighter at the rim, a sheen that turns with the angle
            float rim = smoothstep(0.65, 0.98, r); float ang = atan(d.y, d.x);
            vec3 sheen = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + ang * 2.0 + r * 6.0);
            c = mix(vC, sheen, 0.35 * rim) + vec3(0.9) * smoothstep(0.18, 0.0, length(d - vec2(-0.18, 0.18)));
            a = (0.12 + 0.75 * rim) * vL;
          } else { a = smoothstep(1.0, 0.6, r) * vL; c = vC * (0.85 + 0.3 * (1.0 - r)); }
          gl_FragColor = vec4(c, a); }`,
    });
    const pts = new THREE.Points(geo, mat); pts.position.z = -14; scene.add(pts);
    let head = 0; let next = 0; const tmp = new THREE.Vector3(); const tmp2 = new THREE.Vector3(); const knotCols: THREE.Color[] = [];
    const spawn = (i: number, o: SceneOpts) => {
      head += 0.0105; const t = head; tpar[i] = t;
      knotAt(t, o.p, o.q, tmp); knotAt(t + 0.01, o.p, o.q, tmp2); tmp2.sub(tmp).normalize();
      pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
      const out = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); // spread away from the knot
      const sp = o.mode === 'bubble' ? 0.006 + Math.random() * 0.01 : 0.02 + Math.random() * 0.04;
      vel[i * 3] = out.x * sp + tmp2.x * 0.004; vel[i * 3 + 1] = out.y * sp + tmp2.y * 0.004; vel[i * 3 + 2] = out.z * sp + tmp2.z * 0.004;
      // the colour from inside the knot: where along the spiral, and how deep inside the tube (q-phase)
      const u = ((t * o.p) / (Math.PI * 2)) % 1; const inside = 0.5 + 0.5 * Math.cos(o.q * t);
      const a = knotCols[Math.floor(u * knotCols.length) % knotCols.length]; const b = knotCols[(Math.floor(u * knotCols.length) + 1) % knotCols.length];
      const c = a.clone().lerp(b, (u * knotCols.length) % 1).lerp(new THREE.Color('#ffffff'), inside * 0.25);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = o.mode === 'bubble' ? 0.25 + Math.random() * 0.25 : 0.08 + Math.random() * 0.08; life[i] = 1;
    };

    // ---- drag & drop: pick a bubble or splash from the background, drop it on a die's pip ----
    el.style.position = 'relative';
    const ghost = document.createElement('div');
    Object.assign(ghost.style, { position: 'absolute', width: '28px', height: '28px', marginLeft: '-14px', marginTop: '-14px', borderRadius: '50%', pointerEvents: 'none', display: 'none', boxShadow: '0 2px 6px #0003' });
    el.appendChild(ghost);
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 14);
    let held: { color: string } | null = null; let attract: THREE.Vector3 | null = null;
    const cv = renderer.domElement; cv.style.touchAction = 'none';
    const at = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
    const showGhost = (x: number, y: number) => { ghost.style.left = `${x}px`; ghost.style.top = `${y}px`; };
    const down = (e: PointerEvent) => {
      const p = at(e); let best = -1; let bd = 30 * 30; const v = new THREE.Vector3();
      for (let i = 0; i < N; i += 1) {
        if (life[i] <= 0.15) continue;
        v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(pts.matrixWorld).project(camera);
        if (v.z > 1) continue;
        const dx = ((v.x + 1) / 2) * p.w - p.x; const dy = ((1 - v.y) / 2) * p.h - p.y; const d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = i; }
      }
      if (best < 0) return;
      const color = `#${new THREE.Color(col[best * 3], col[best * 3 + 1], col[best * 3 + 2]).getHexString()}`;
      life[best] = 0; held = { color };
      ghost.style.background = live.current.mode === 'bubble' ? `radial-gradient(circle at 35% 35%, #ffffffee 0 18%, ${color}55 40%, ${color}cc 92%)` : color;
      ghost.style.border = live.current.mode === 'bubble' ? `2px solid ${color}` : '2px solid #ffffffaa';
      ghost.style.display = 'block'; showGhost(p.x, p.y); cv.setPointerCapture(e.pointerId); el.dataset.held = '1';
    };
    const move = (e: PointerEvent) => {
      if (!held) return; const p = at(e); showGhost(p.x, p.y);
      ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1); ray.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, hit)) attract = pts.worldToLocal(hit); // the background follows the finger
    };
    const up = (e: PointerEvent) => {
      if (!held) return; const p = at(e); const color = held.color; held = null; attract = null; ghost.style.display = 'none'; el.dataset.held = '';
      ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1); ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(dice, false)[0];
      let res: DropResult = { kind: 'miss', color };
      if (hit && hit.face && hit.uv) {
        const die = dice.indexOf(hit.object as THREE.Mesh); const m = hit.face.materialIndex; const n = FACE_NUMS[m];
        const px = hit.uv.x * 128; const py = (1 - hit.uv.y) * 128; let k = -1; let kd = Infinity;
        PIPS[n].forEach(([x, y], j) => { const d = Math.hypot(x - px, y - py); if (d < kd) { kd = d; k = j; } });
        if (kd <= pipR(n) + 6) { // a little slack for fingers
          pipCols[die][m][k] = color; const mat = diceMats[die][m]; mat.map?.dispose(); mat.map = diceFace(n, diceBg, pipCols[die][m]); mat.needsUpdate = true;
          res = { kind: 'perfect', color, die, face: n };
        } else if (kd <= pipR(n) * 2.6) res = { kind: 'near', color, die, face: n };
      }
      live.current.onDrop?.(res);
    };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    let raf = 0; let clock = 0; let lastMode = '';
    const resize = () => { const w = el.clientWidth; const h = Math.round(w * 0.62); renderer.setSize(w, h); camera.aspect = w / h; };
    resize(); window.addEventListener('resize', resize);
    const frame = () => {
      const o = live.current; const speed = o.reduced ? 0.3 : 1; clock += 1 / 60;
      if (o.palette.id !== palId) {
        palId = o.palette.id; if (scene.background instanceof THREE.Texture) scene.background.dispose(); scene.background = skyTexture(o.palette.sky);
        stickMat.color.set(o.palette.stick); makeDice(o.palette.dice); knotCols.length = 0; o.palette.knot.forEach((h) => knotCols.push(new THREE.Color(h)));
      }
      mat.uniforms.bubble.value = o.mode === 'bubble' ? 1 : 0;
      if (o.mode !== lastMode) { lastMode = o.mode; life.fill(0); }
      // two dice turning on the skewer's axis (x), at different speeds and the other way round
      if (dice[0]) { dice[0].rotation.x += 0.02 * speed; dice[1].rotation.x -= 0.031 * speed; }
      // the knot: emit along the spiral, then spread
      for (let k = 0; k < 6; k += 1) { spawn(next, o); next = (next + 1) % N; }
      for (let i = 0; i < N; i += 1) {
        if (life[i] <= 0) continue;
        if (attract) { const dx = attract.x - pos[i * 3]; const dy = attract.y - pos[i * 3 + 1]; const dz = attract.z - pos[i * 3 + 2]; const d = Math.hypot(dx, dy, dz) || 1; if (d < 7) { const f = 0.0016 * speed * (1 - d / 7); vel[i * 3] += (dx / d) * f; vel[i * 3 + 1] += (dy / d) * f; vel[i * 3 + 2] += (dz / d) * f; } }
        pos[i * 3] += vel[i * 3] * speed * 3; pos[i * 3 + 1] += vel[i * 3 + 1] * speed * 3 - (o.mode === 'splash' ? 0.002 * (1 - life[i]) * 3 : 0); pos[i * 3 + 2] += vel[i * 3 + 2] * speed * 3;
        if (o.mode === 'bubble') size[i] += 0.0008 * speed;
        life[i] -= (o.mode === 'bubble' ? 0.0028 : 0.006) * speed;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.life.needsUpdate = true;
      pts.rotation.y += 0.0015 * speed; pts.rotation.x = 0.5;
      // the dolly zoom: distance d; the lens narrows so SUBJECT_W stays the same width on screen
      const s = o.auto && !o.reduced ? 0.5 - 0.5 * Math.cos((clock / 9) * Math.PI * 2) : o.dolly;
      const d = 4 + s * 26; camera.position.set(0, 0.6, d); camera.lookAt(0, 0, 0);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((SUBJECT_W / camera.aspect) / (2 * d))); camera.updateProjectionMatrix(); mat.uniforms.scale.value = camera.projectionMatrix.elements[5] * renderer.domElement.height / 2; // sizes in world units, so the dolly zoom shows on the points too
      (el.dataset as DOMStringMap).fov = camera.fov.toFixed(1); (el.dataset as DOMStringMap).dist = d.toFixed(1);
      renderer.render(scene, camera); raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); el.removeChild(ghost); renderer.dispose(); geo.dispose(); mat.dispose(); el.removeChild(renderer.domElement); };
  }, []);
  return <div ref={host} className="w-full overflow-hidden border border-stone-300" data-testid="scene" />;
}
