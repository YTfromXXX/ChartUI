'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PILLARS, RELAY, START, TELESCOPES, beatAt, dollyZoom, magnetGap, pillarIn, timeline, totalMs, type Author, type Beat } from '@/lib/libraryRelay';

const LOGIN_KEY = 'chartui-library-login-v1';
const hsl = (h: number, s = 55, l = 55) => `hsl(${h} ${s}% ${l}%)`;

/** A portrait drawn by ChartUI: head, shoulders and initials — no photographs. */
function Portrait({ a, x = 0, size = 120, flip = false }: { a: Author; x?: number; size?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} 0) scale(${size / 120}) ${flip ? 'translate(120 0) scale(-1 1)' : ''}`}>
      <rect width="120" height="150" rx="6" fill={hsl(a.hue, 30, 18)} />
      <path d="M10 150 Q60 92 110 150 Z" fill={hsl(a.hue, 45, 42)} />
      <ellipse cx="60" cy="62" rx="27" ry="32" fill={hsl(a.hue, 35, 70)} />
      <path d="M33 56 Q60 18 87 56 Q78 38 60 36 Q42 38 33 56 Z" fill={hsl(a.hue, 30, 25)} />
      <text x="60" y="140" textAnchor="middle" fontSize="13" fontFamily="monospace" fill="#fff" transform={flip ? 'translate(120 0) scale(-1 1)' : undefined}>{a.initials}</text>
    </g>
  );
}

/** Title sequence: 7 pillars slide in from the right; the top and bottom edges pull in like magnets. */
function TitleSequence({ text, sub, local }: { text: string; sub: string; local: number }) {
  const gap = magnetGap(local); const z = dollyZoom(local);
  return (
    <svg viewBox="0 0 1000 560" className="pointer-events-none absolute inset-0 h-full w-full" data-testid="title-seq">
      <rect x="0" y="0" width="1000" height={280 * (1 - gap)} fill="#0b0906" />
      <rect x="0" y={280 + 280 * gap} width="1000" height={280 * (1 - gap)} fill="#0b0906" />
      <line x1="0" x2="1000" y1={280 - 280 * gap} y2={280 - 280 * gap} stroke="#d6b36a" strokeWidth="2" />
      <line x1="0" x2="1000" y1={280 + 280 * gap} y2={280 + 280 * gap} stroke="#d6b36a" strokeWidth="2" />
      {Array.from({ length: PILLARS }, (_, k) => {
        const p = pillarIn(local, k); const slot = 140 + k * 120; const x = slot + (1 - p) * (1100 - slot);
        return <g key={k} opacity={0.35 + 0.65 * p}><rect x={x - 14} y={280 - 280 * gap} width="28" height={560 * gap} fill="#e8dcc0" /><rect x={x - 20} y={280 - 280 * gap} width="40" height="10" fill="#cbb98f" /><rect x={x - 20} y={270 + 280 * gap} width="40" height="10" fill="#cbb98f" /></g>;
      })}
      <g opacity={Math.min(1, local / 400)}>
        <text x="500" y="292" textAnchor="middle" fontSize="54" fontWeight="700" fill="#fff8e6" stroke="#0b0906" strokeWidth="6" paintOrder="stroke" letterSpacing={2 + 10 * z.k}>{text}</text>
        <text x="500" y="330" textAnchor="middle" fontSize="16" fontFamily="monospace" fill="#d6b36a" stroke="#0b0906" strokeWidth="4" paintOrder="stroke">{sub}</text>
      </g>
    </svg>
  );
}

function CardA({ i }: { i: number }) {
  const b = RELAY[i];
  return (
    <svg viewBox="0 0 520 260" className="h-full w-full" data-testid="card-A">
      <rect width="520" height="260" fill="#f6efe1" />
      <text x="20" y="28" fontSize="13" fontFamily="monospace" fill="#7a5b2a">A · 複合ツーショット</text>
      <g transform="translate(165 38)"><Portrait a={b.from} size={110} /></g>
      <g transform="translate(250 46)" opacity="0.92"><Portrait a={b.to} size={110} flip /></g>
      <text x="20" y="232" fontSize="15" fill="#2a1d0c">{b.from.ja} × {b.to.ja}</text>
      <text x="20" y="250" fontSize="11" fill="#6b5a3e">{b.link}</text>
    </svg>
  );
}

function CardB({ i }: { i: number }) {
  const b = RELAY[i]; const lines = b.work.ja.split('（');
  return (
    <svg viewBox="0 0 520 260" className="h-full w-full" data-testid="card-B">
      <rect width="520" height="260" fill="#f6efe1" />
      <text x="20" y="28" fontSize="13" fontFamily="monospace" fill="#7a5b2a">B · 次の作者に選ばれた著作物</text>
      <g transform="translate(40 44)">
        <rect width="140" height="196" rx="3" fill={hsl(b.to.hue, 45, 30)} /><rect x="10" width="6" height="196" fill={hsl(b.to.hue, 40, 20)} />
        <text x="76" y="70" textAnchor="middle" fontSize="15" fill="#fff8e6">{lines[0]}</text>
        {lines[1] && <text x="76" y="92" textAnchor="middle" fontSize="9" fill="#fff8e6">（{lines[1]}</text>}
        <text x="76" y="150" textAnchor="middle" fontSize="10" fontStyle="italic" fill="#f3e3c3">{b.work.title}</text>
        <text x="76" y="180" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#f3e3c3">{b.work.year}</text>
      </g>
      <g transform="translate(220 44)"><Portrait a={b.to} size={120} /></g>
      <text x="360" y="80" fontSize="17" fill="#2a1d0c">{b.to.ja}</text>
      <text x="360" y="100" fontSize="11" fill="#6b5a3e">{b.to.name}</text>
      <text x="360" y="118" fontSize="11" fontFamily="monospace" fill="#6b5a3e">{b.to.years}</text>
      <text x="360" y="150" fontSize="10" fill="#6b5a3e">形式：{({ book: '本', unfinished: '未完の草稿', poems: '詩集', tales: '短編', stories: '短編集', novel: '長編小説' } as const)[b.work.format]}</text>
    </svg>
  );
}

/**
 * Library entrance. The telescopes walk in; whoever logs in (choose a telescope, then VR / MR on a
 * capable device) receives the memory bookmarks, relayed from A Thousand Plateaus through seven
 * authors and back. Title beats run a dolly zoom on the room behind the logo.
 */
export default function LibraryEntrance() {
  const mount = useRef<HTMLDivElement>(null);
  const beats = useMemo(() => timeline(), []);
  const [now, setNow] = useState<{ beat: Beat; local: number }>({ beat: beats[0], local: 0 });
  const [login, setLogin] = useState<string | null>(null);
  const [xrNote, setXrNote] = useState('');
  const [paused, setPaused] = useState(false);
  const live = useRef({ paused }); live.current = { paused };
  const clock = useRef(0);
  const skip = () => { const { beat } = beatAt(beats, clock.current); const i = beats.indexOf(beat); clock.current = i + 1 < beats.length ? beats[i + 1].startMs + 1 : 0; };

  useEffect(() => { try { setLogin(window.localStorage.getItem(LOGIN_KEY)); } catch { /* storage may be blocked */ } }, []);
  const choose = (id: string) => { setLogin(id); try { window.localStorage.setItem(LOGIN_KEY, id); } catch { /* ignore */ } };

  useEffect(() => {
    const el = mount.current; if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = el.clientWidth; const H = Math.round(W * 0.56);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true; el.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a140d'); scene.fog = new THREE.Fog('#1a140d', 10, 34);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 80);
    scene.add(new THREE.HemisphereLight('#ffe9c4', '#2a1d0c', 0.9));
    // Hall: floor, two long walls of shelves, lamps.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 40), new THREE.MeshStandardMaterial({ color: '#5b3d22', roughness: 0.4, metalness: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -12; scene.add(floor);
    const shelfMat = new THREE.MeshStandardMaterial({ color: '#3a2716', roughness: 0.7 });
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.32, 0.24), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 2 * 30 * 6 * 9);
    const m = new THREE.Matrix4(); const c = new THREE.Color(); let n = 0;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 34), shelfMat); wall.position.set(side * 3.2, 2.1, -12); scene.add(wall);
      for (let s = 0; s < 6; s += 1) for (let seg = 0; seg < 30; seg += 1) for (let k = 0; k < 9; k += 1) {
        const z = -28 + seg * 1.07 + k * 0.1; const y = 0.4 + s * 0.62;
        m.makeTranslation(side * 2.95, y + 0.16, z); books.setMatrixAt(n, m); c.setHSL(((seg * 37 + k * 11 + s * 53) % 360) / 360, 0.45, 0.32 + ((k * 7) % 5) * 0.04); books.setColorAt(n, c); n += 1;
      }
    }
    books.count = n; scene.add(books);
    for (let i = 0; i < 6; i += 1) { const lamp = new THREE.PointLight('#ffcf8a', 3, 8); lamp.position.set(0, 3.6, -i * 5); scene.add(lamp); }
    // Telescopes: tube + sunshade + tripod, walking in a line down the aisle.
    const scopes = TELESCOPES.map((t, i) => {
      const g = new THREE.Group(); const hue = (i * 137.5) % 360;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12 + t.aperture * 0.04, 0.16 + t.aperture * 0.04, 0.9, 24), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.25, 0.75), metalness: 0.8, roughness: 0.25 }));
      tube.rotation.x = -0.5; tube.position.y = 1.0; g.add(tube);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2 + t.aperture * 0.04, 0.2 + t.aperture * 0.04, 0.12, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#d6b36a', metalness: 1, roughness: 0.3, side: THREE.DoubleSide }));
      shade.position.set(0, 1.42, -0.22); shade.rotation.x = -0.5; g.add(shade);
      for (let k = 0; k < 3; k += 1) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), new THREE.MeshStandardMaterial({ color: '#222' })); const a = (k * 2 * Math.PI) / 3; leg.position.set(Math.cos(a) * 0.18, 0.42, Math.sin(a) * 0.18); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(leg); }
      scene.add(g); return { g, t };
    });

    // WebXR: VR / MR entry where supported (the dolly zoom is switched off inside a headset).
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    if (xr) {
      void Promise.all([xr.isSessionSupported('immersive-vr').catch(() => false), xr.isSessionSupported('immersive-ar').catch(() => false)]).then(async ([vr, ar]) => {
        if (vr) { const { VRButton } = await import('three/examples/jsm/webxr/VRButton.js'); const b = VRButton.createButton(renderer); b.style.position = 'absolute'; el.appendChild(b); }
        if (ar) { const { ARButton } = await import('three/examples/jsm/webxr/ARButton.js'); const b = ARButton.createButton(renderer); b.style.position = 'absolute'; b.style.bottom = '60px'; el.appendChild(b); }
        setXrNote(vr || ar ? `${vr ? 'VR' : ''}${vr && ar ? ' / ' : ''}${ar ? 'MR' : ''} で入場できます` : 'この端末は VR / MR 非対応 — 画面で入場します');
      });
    } else setXrNote('WebXR なし — 画面で入場します（VR / MR は対応端末で）');

    let last = performance.now(); let hudClock = 0;
    renderer.setAnimationLoop((nowMs) => {
      const dt = Math.min(0.05, Math.max(0, nowMs - last) / 1000); last = Math.max(last, nowMs);
      if (!live.current.paused) clock.current += dt * 1000;
      const t = clock.current; const { beat, local } = beatAt(beats, t);
      // Telescopes walk in during the entrance, then stand in a row; the one of the current bookmark steps forward.
      scopes.forEach(({ g }, i) => {
        const enter = beat.kind === 'enter' ? Math.min(1, Math.max(0, (local - i * 220) / 1800)) : 1;
        const z = 2 - enter * (10 + i * 1.6); const x = (i % 2 ? 1 : -1) * (0.7 + 0.25 * (i % 3));
        const front = beat.index === i && beat.kind !== 'enter' ? 0.8 : 0;
        g.position.set(x * enter + (1 - enter) * 0, Math.abs(Math.sin(t / (reduce ? 900 : 260) + i)) * 0.05 * (enter < 1 ? 1 : 0), z + front);
      });
      if (!renderer.xr.isPresenting) {
        const titleBeat = beat.kind === 'title' || beat.kind === 'enter';
        const dz = titleBeat && !reduce ? dollyZoom(local) : { distance: 3, fovDeg: (2 * Math.atan(2.4 / 6) * 180) / Math.PI };
        camera.position.set(0, 1.6, -4 + dz.distance); camera.fov = dz.fovDeg; camera.updateProjectionMatrix(); camera.lookAt(0, 1.4, -6);
      }
      hudClock += dt; if (hudClock > 1 / 30) { hudClock = 0; setNow({ beat, local }); }
      renderer.render(scene, camera);
    });
    return () => { renderer.setAnimationLoop(null); renderer.dispose(); pmrem.dispose(); renderer.domElement.remove(); el.querySelectorAll('button').forEach((b) => b.remove()); };
  }, [beats]);

  const b = now.beat; const total = totalMs(beats);
  const titleText = b.kind === 'enter' ? START.ja : b.title;
  const sub = b.kind === 'enter' ? 'Mille plateaux · 1980 — 思い出のしおり、ここから' : b.index % 2 === 0 ? `${RELAY[b.index].work.title} · ${RELAY[b.index].work.year}` : `${RELAY[b.index].to.name} · ${RELAY[b.index].to.years}`;

  return (
    <main className="min-h-screen bg-[#120d08] px-4 py-6 text-[#f3e7cf]">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-[#b89d6a]">LAB · 図書館 · 入口</p>
            <h1 className="text-2xl font-semibold">望遠鏡たちの入場 — 思い出のしおりのリレー</h1>
            <p className="max-w-3xl text-sm text-[#d9c9a8]">望遠鏡を一台選んでログインすると、『千のプラトー』から始まるしおりのリレーが流れます。各しおりは A（次の作者との複合ツーショット）と B（次の作者に選ばれた著作物：本とプロフィール）の 2 枚です。肖像と表紙は ChartUI が描いたもので、写真や実物の表紙ではありません。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/library" className="border border-[#b89d6a]/50 px-3 py-1">図書館</Link><Link href="/lab/crystal-baby" className="border border-[#b89d6a]/50 px-3 py-1">クリスタルベイビー対決</Link></nav>
        </header>

        <section className="flex flex-wrap items-center gap-2 font-mono text-xs" aria-label="ログイン">
          <span>ログインする望遠鏡：</span>
          {TELESCOPES.map((t) => <button key={t.id} type="button" data-testid={`login-${t.id}`} onClick={() => choose(t.id)} className="rounded border px-2 py-1" style={{ borderColor: login === t.id ? '#d6b36a' : '#ffffff33', color: login === t.id ? '#d6b36a' : undefined }}>{t.name}（{t.orbit}）</button>)}
          <span data-testid="login" className="ml-2">{login ? `ログイン中：${TELESCOPES.find((t) => t.id === login)?.name}` : '未ログイン'}</span>
          <span className="text-[#b89d6a]">· {xrNote}</span>
        </section>

        <div className="relative w-full overflow-hidden rounded border border-[#b89d6a]/30" style={{ aspectRatio: '1000 / 560' }}>
          <div ref={mount} className="absolute inset-0" />
          {(b.kind === 'title' || b.kind === 'enter') && <TitleSequence key={`${b.kind}-${b.index}`} text={titleText} sub={sub} local={now.local} />}
          {(b.kind === 'A' || b.kind === 'B') && (
            <div className="absolute inset-x-[12%] bottom-[6%] top-[18%] shadow-2xl" style={{ opacity: Math.min(1, now.local / 300), transform: `translateX(${(1 - Math.min(1, now.local / 450)) * 40}px)` }}>
              {b.kind === 'A' ? <CardA i={b.index} /> : <CardB i={b.index} />}
            </div>
          )}
          {!login && <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm">望遠鏡を選んでログインしてください（入場のアニメーションは裏で流れています）</div>}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <button type="button" data-testid="pause" onClick={() => setPaused((p) => !p)} className="rounded border border-[#b89d6a]/50 px-2 py-1">{paused ? '▶️ 再生' : '⏸️ 一時停止'}</button>
          <button type="button" data-testid="skip" onClick={skip} className="rounded border border-[#b89d6a]/50 px-2 py-1">⏭ 次へ</button>
          <span data-testid="beat">{b.kind === 'enter' ? '入場' : `しおり ${b.index + 1}/${RELAY.length} · ${b.kind === 'title' ? 'タイトル' : b.kind}`} — {b.title}</span>
          <span className="text-[#b89d6a]">一周 {(total / 1000).toFixed(0)} 秒・ボルヘスから『千のプラトー』へ戻って繰り返します</span>
        </div>

        <ol className="grid gap-2 text-xs sm:grid-cols-2" data-testid="relay">
          {RELAY.map((r, i) => (
            <li key={i} className="rounded border p-2" style={{ borderColor: b.index === i ? '#d6b36a' : '#ffffff1a' }}>
              <span className="font-mono text-[#b89d6a]">{i + 1}.</span> {r.from.ja} → <strong>{r.to.ja}</strong>『{r.work.ja}』（{r.work.year}）<br /><span className="text-[#cbb98f]">{r.link}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
