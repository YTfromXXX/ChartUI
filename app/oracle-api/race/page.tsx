'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildSportsCar, type CarRig } from '@/components/race/sportsCar';
import { LAPS, LAP_M, castVote, gapS, kmh, lapOf, newRace, order, step, type Race } from '@/lib/oracleRace';
import { bumpY, loadY, type PlayerY } from '@/lib/permanentY';
import { rng } from '@/lib/smokeCandle';

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#2b2d31'; g.fillRect(0, 0, 256, 512);
  const r = rng(3); for (let i = 0; i < 4000; i += 1) { const v = 35 + Math.floor(r() * 30); g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(r() * 256, r() * 512, 1.5, 1.5); }
  g.fillStyle = '#e5e7eb'; g.fillRect(6, 0, 5, 512); g.fillRect(245, 0, 5, 512);
  for (const x of [70, 128, 186]) for (let y = 0; y < 512; y += 128) g.fillRect(x - 2, y, 4, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 8); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d') as CanvasRenderingContext2D;
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0b1026'); gr.addColorStop(0.55, '#3b2a5a'); gr.addColorStop(0.8, '#e0795b'); gr.addColorStop(1, '#f6c27a');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * METADOGG ORACLE race broadcast. Four fictional companies race as sports cars seen from behind;
 * their pace follows synthetic price momentum and news. Built as a 16:9 screen for capturing into
 * OBS and streaming to YouTube or Discord. Synthetic data; not advice.
 */
export default function OracleRace() {
  const mount = useRef<HTMLDivElement>(null);
  const [race, setRace] = useState<Race>(() => newRace(1));
  const [focus, setFocus] = useState(0);
  const [stream, setStream] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [y, setY] = useState<PlayerY | null>(null);
  const [myVote, setMyVote] = useState<Record<number, string>>({});
  const [called, setCalled] = useState<{ lap: number; leader: string; mine?: string; hit?: boolean } | null>(null);
  // The simulation lives in a ref the render never overwrites; React state is only a 10 Hz snapshot for the overlay.
  const sim = useRef<Race>(race); const focusRef = useRef(focus); focusRef.current = focus;
  const seedRef = useRef(1);

  useEffect(() => {
    setY(loadY());
    // ?focus=0..3 picks the camera car (the quantum-wish roulette hands you over this way).
    const f = Number(new URLSearchParams(window.location.search).get('focus')); if (Number.isInteger(f) && f >= 0 && f < 4) setFocus(f);
  }, []);

  useEffect(() => {
    const el = mount.current; if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = el.clientWidth; const H = Math.round(W * 9 / 16);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace; el.prepend(renderer.domElement);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    const scene = new THREE.Scene(); scene.background = skyTexture(); scene.fog = new THREE.Fog('#8a5a6a', 40, 220);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 400);
    scene.add(new THREE.HemisphereLight('#ffd9b0', '#1a1420', 0.9)); const sun = new THREE.DirectionalLight('#ffb27a', 2.4); sun.position.set(-30, 18, -60); scene.add(sun);
    const rim = new THREE.DirectionalLight('#9fb4ff', 0.8); rim.position.set(20, 10, 30); scene.add(rim);
    const roadTex = roadTexture();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 400), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05 })); road.rotation.x = -Math.PI / 2; road.position.z = -150; scene.add(road);
    const verge = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#2a3324', roughness: 1 })); verge.rotation.x = -Math.PI / 2; verge.position.set(0, -0.01, -150); scene.add(verge);
    // Guard rails and light posts that stream past.
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8); const postMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.3 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, 80); scene.add(posts);
    const lampGeo = new THREE.SphereGeometry(0.18, 10, 8); const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: '#ffe8b0' }), 20); scene.add(lamps);
    for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 400), new THREE.MeshStandardMaterial({ color: '#9ca3af', metalness: 0.9, roughness: 0.25 })); rail.position.set(sx * 4.9, 0.6, -150); scene.add(rail); }
    // Hills far away.
    for (let i = 0; i < 9; i += 1) { const h = new THREE.Mesh(new THREE.ConeGeometry(18 + i * 3, 14 + (i % 3) * 6, 5), new THREE.MeshStandardMaterial({ color: '#2b2440', roughness: 1 })); h.position.set((i - 4) * 32, 4, -230 - (i % 2) * 30); scene.add(h); }

    // Keep the drawing buffer matched to the element when it grows (stream mode) or the window resizes.
    const ro = new ResizeObserver(() => { const w = el.clientWidth; if (w > 0) renderer.setSize(w, Math.round((w * 9) / 16), false); });
    ro.observe(el);
    const rigs: CarRig[] = sim.current.cars.map((c) => { const r = buildSportsCar(c.livery); scene.add(r.group); return r; });
    const m = new THREE.Matrix4(); let last = performance.now(); let ui = 0; let shake = 0; const prevSpeed = rigs.map(() => 0);
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000); last = Math.max(last, now);
      const r = step(sim.current, dt); sim.current = r;
      const f = r.cars[focusRef.current];
      r.cars.forEach((c, i) => {
        const g = rigs[i].group; const z = Math.max(-140, Math.min(30, -(c.dist - f.dist) * 0.3));
        g.position.set(c.lane + Math.sin(r.t * 0.7 + i) * 0.25 * (1 + c.vol * 40), 0, z); g.visible = z < 1; // cars behind the focused one would fill the lens
        g.rotation.y = Math.cos(r.t * 0.7 + i) * 0.02;
        // Wheels drawn turning 50× slower than real, so the spokes never strobe.
        for (const w of rigs[i].wheels) w.rotation.x -= (c.speed / 0.34) * dt * 0.02;
        rigs[i].setBrake(prevSpeed[i] - c.speed > 0.02 ? 1 : 0); prevSpeed[i] = c.speed;
      });
      roadTex.offset.y = (f.dist / 50) % 1;
      for (let k = 0; k < 40; k += 1) { const zz = -((k * 10 - (f.dist % 10)) ) + 20; for (const sx of [-1, 1]) { m.makeTranslation(sx * 5.2, 0.5, zz); posts.setMatrixAt(k * 2 + (sx > 0 ? 1 : 0), m); } }
      for (let k = 0; k < 10; k += 1) { const zz = -((k * 40 - (f.dist % 40))) + 20; for (const sx of [-1, 1]) { m.makeTranslation(sx * 5.2, 5.5, zz); lamps.setMatrixAt(k * 2 + (sx > 0 ? 1 : 0), m); } }
      posts.instanceMatrix.needsUpdate = true; lamps.instanceMatrix.needsUpdate = true;
      shake = reduce ? 0 : Math.sin(r.t * 13) * 0.015 * (f.speed / 60);
      const fx = rigs[focusRef.current].group.position.x;
      camera.position.set(fx * 0.6, 1.75 + shake, 7.6); camera.lookAt(fx * 0.35, 0.9, -12);
      renderer.render(scene, camera);
      ui += dt; if (ui > 0.1) { ui = 0; setRace(r); }
    });
    return () => { ro.disconnect(); renderer.setAnimationLoop(null); rigs.forEach((x) => x.dispose()); renderer.dispose(); pmrem.dispose(); renderer.domElement.remove(); };
  }, []);

  // Lap calls: when the leader starts a new lap, compare the leader of the finished lap with Y's vote.
  const ord = order(race); const leader = ord[0]; const lap = lapOf(leader);
  useEffect(() => {
    const done = lap - 1; if (done < 1 || called?.lap === done) return;
    const mine = myVote[done]; const hit = mine ? mine === leader.company.ticker : undefined;
    setCalled({ lap: done, leader: leader.company.ticker, mine, hit });
    if (mine) setY(bumpY({ hits: hit ? 1 : 0 }));
  }, [lap]); // eslint-disable-line react-hooks/exhaustive-deps

  const vote = (ticker: string) => {
    if (myVote[lap]) return;
    setMyVote((v) => ({ ...v, [lap]: ticker })); setY(bumpY({ votes: 1 }));
    sim.current = castVote(sim.current, lap, ticker); setRace(sim.current);
  };
  // A synthetic audience: votes lean toward the cars with the best price momentum.
  const crowd = race.cars.map((c, i) => Math.round(40 + 30 * Math.tanh((c.price - 100) / 10) + 10 * Math.sin(lap * 1.3 + i)) + (myVote[lap] === c.company.ticker ? 1 : 0));
  const crowdTotal = crowd.reduce((a, b) => a + b, 0);
  const restart = () => { seedRef.current += 1; const r = newRace(seedRef.current); sim.current = r; setRace(r); setMyVote({}); setCalled(null); setY(bumpY({ games: 1 })); };
  const f = race.cars[focus];

  const screen = (
    <div className="relative w-full overflow-hidden bg-black [container-type:inline-size]" style={{ aspectRatio: '16 / 9' }} data-testid="screen">
      <div ref={mount} className="absolute inset-0" />
      {overlay && (
        <div className="pointer-events-none absolute inset-0 font-mono text-white">
          <div className="absolute left-[2cqw] top-[2cqw] flex items-center gap-[1cqw]">
            <span className="rounded-[0.4cqw] bg-[#c1121f] px-[0.8cqw] py-[0.3cqw] text-[1.3cqw] font-bold">● LIVE</span>
            <span className="text-[1.8cqw] font-bold tracking-widest drop-shadow">METADOGG ORACLE</span>
            <span className="text-[0.9cqw] text-white/70">合成データ · 架空の 4 社</span>
          </div>
          <div className="absolute right-[2cqw] top-[2cqw] rounded-[0.4cqw] bg-black/55 px-[1cqw] py-[0.4cqw] text-right">
            <p className="text-[1.6cqw] font-bold" data-testid="lap">LAP {Math.min(LAPS, lap)}/{LAPS}</p><p className="text-[0.9cqw] text-white/70">{race.finished ? 'FINISH' : `${Math.floor(race.t / 60)}:${String(Math.floor(race.t % 60)).padStart(2, '0')}`}</p>
          </div>
          <ol className="absolute left-[2cqw] top-[6.5cqw] w-[24cqw] space-y-[0.3cqw]" data-testid="tower">
            {ord.map((c, i) => (
              <li key={c.company.ticker} className="flex items-center gap-[0.6cqw] rounded-[0.3cqw] bg-black/60 px-[0.6cqw] py-[0.3cqw] text-[1.05cqw]" style={{ borderLeft: `0.4cqw solid ${c.livery.body}` }}>
                <span className="w-[1.6cqw] font-bold">{i + 1}</span>
                <span className="rounded-[0.2cqw] px-[0.4cqw] font-bold" style={{ background: c.livery.body }}>{c.livery.logo}{c.livery.number}</span>
                <span className="flex-1">{c.company.name}</span>
                <span className="w-[5cqw] text-right text-white/80">{i ? `+${gapS(leader, c).toFixed(1)}s` : 'LEADER'}</span>
                <span className="w-[4cqw] text-right" style={{ color: c.ret >= 0 ? '#86efac' : '#fca5a5' }}>{c.price.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          <div className="absolute bottom-[7cqw] right-[2cqw] w-[13cqw] rounded-full border-[0.3cqw] border-white/30 bg-black/50 p-[1cqw] text-center" style={{ aspectRatio: '1' }}>
            <p className="mt-[2.4cqw] text-[3.2cqw] font-bold leading-none" data-testid="speed">{kmh(f)}</p><p className="text-[0.9cqw] text-white/70">km/h · {f.livery.logo}{f.livery.number}</p>
            <p className="text-[0.8cqw] text-white/60">{f.company.name}</p>
          </div>
          <svg viewBox="-50 -50 100 100" className="absolute bottom-[7cqw] left-[2cqw] w-[9cqw]">
            <circle r="40" fill="#00000088" stroke="#ffffff55" strokeWidth="3" />
            {race.cars.map((c) => { const a = ((c.dist % LAP_M) / LAP_M) * Math.PI * 2 - Math.PI / 2; return <circle key={c.company.ticker} cx={40 * Math.cos(a)} cy={40 * Math.sin(a)} r="5" fill={c.livery.body} stroke="#fff" strokeWidth="1" />; })}
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex h-[5cqw] items-center gap-[1cqw] bg-black/70 px-[2cqw] text-[1.1cqw]">
            <span className="rounded-[0.2cqw] bg-white px-[0.6cqw] font-bold text-black">NEWS</span>
            <span className="flex-1 truncate" data-testid="news">{race.news[0] ? `${race.news[0].text}（${race.news[0].effect >= 0 ? '追い風' : '向かい風'}）` : 'スタートを待っています'}</span>
            <span className="text-white/60">視聴者予想 L{Math.min(LAPS, lap)}：{race.cars.map((c, i) => `${LETTERS[i]} ${Math.round((crowd[i] / crowdTotal) * 100)}%`).join(' · ')}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#120f14] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">METADOGG ORACLE-API · レース中継</p>
            <h1 className="text-2xl font-semibold">架空の 4 社のスポーツカー — 背後からの中継</h1>
            <p className="max-w-3xl text-sm text-slate-300">速さは各社の合成株価の勢いとニュースで決まります。16:9 の画面を OBS で取り込み、YouTube や Discord に配信する想定です。会社は架空、数字は合成で、投資の助言ではありません。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/activist" className="border border-white/20 px-3 py-1">アクティビスト双六</Link><Link href="/oracle-api" className="border border-white/20 px-3 py-1">ORACLE-API</Link></nav>
        </header>

        {/* A retro game-console frame (an original design, rebooted): cream shell, maroon trim, cartridge slot, pads. */}
        <div className="rounded-[18px] border-4 border-[#5b1b1b] bg-[#e9dfcf] p-3 shadow-[0_18px_40px_rgba(0,0,0,.5)]" data-testid="console">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="h-3 w-40 rounded bg-[#5b1b1b]/80" title="カートリッジの差し込み口" />
            <span className="font-mono text-xs font-bold tracking-[0.3em] text-[#5b1b1b]">ORACLE-80</span>
            <span className="font-mono text-[10px] text-[#5b1b1b]">POWER ●</span>
          </div>
          {/* Stream mode keeps this same element (so the 3D canvas stays attached) and pins it full screen. */}
          <div className={stream ? 'fixed inset-0 z-[200] flex items-center justify-center bg-black' : 'rounded-lg border-8 border-[#2b2b2b] bg-black'} data-testid={stream ? 'stream-mode' : undefined}>
            <div className={stream ? 'w-[min(100vw,177.78vh)]' : 'w-full'}>{screen}</div>
            {stream && <button type="button" onClick={() => setStream(false)} className="absolute right-2 top-2 rounded bg-white/10 px-2 py-1 font-mono text-[10px] text-white/50 hover:text-white">配信モードを出る</button>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#5b1b1b] px-4 py-3 text-[#f4ead6]">
            <div className="grid grid-cols-3 gap-0.5" aria-label="十字キー：カメラの車">
              <span /><button type="button" onClick={() => setOverlay((o) => !o)} className="h-7 w-7 rounded-sm bg-[#1b1b1b] text-xs" title="上：中継の文字を出す・消す">▲</button><span />
              <button type="button" data-testid="cam-prev" onClick={() => setFocus((x) => (x + 3) % 4)} className="h-7 w-7 rounded-sm bg-[#1b1b1b] text-xs" title="左：前の車">◀</button><span className="h-7 w-7 rounded-sm bg-[#1b1b1b]" /><button type="button" data-testid="cam-next" onClick={() => setFocus((x) => (x + 1) % 4)} className="h-7 w-7 rounded-sm bg-[#1b1b1b] text-xs" title="右：次の車">▶</button>
              <span /><button type="button" onClick={restart} className="h-7 w-7 rounded-sm bg-[#1b1b1b] text-xs" title="下：新しいレース">▼</button><span />
            </div>
            <div className="flex-1 text-xs">
              <p className="mb-1 font-mono">次のラップのトップは？（4 択 · 予測市場のはじまり）</p>
              <div className="flex flex-wrap gap-1">{race.cars.map((c, i) => (
                <button key={c.company.ticker} type="button" data-testid={`vote-${LETTERS[i]}`} onClick={() => vote(c.company.ticker)} disabled={!!myVote[lap] || race.finished}
                  className="rounded-full border-2 px-3 py-1 font-mono disabled:opacity-60" style={{ borderColor: c.livery.body, background: myVote[lap] === c.company.ticker ? c.livery.body : 'transparent' }}>{LETTERS[i]} {c.livery.logo}{c.livery.number} {c.company.name}</button>
              ))}</div>
              <p className="mt-1 font-mono text-[11px]" data-testid="call">{called ? `L${called.lap} のトップは ${called.leader}${called.mine ? ` — Y の予想 ${called.mine}：${called.hit ? '的中' : '外れ'}` : ''}` : 'ラップが終わると答え合わせ'}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStream(true)} data-testid="stream" className="h-12 w-12 rounded-full bg-[#c1121f] font-mono text-[10px] font-bold shadow" title="A：配信モード（画面だけを全面に）">A<br />配信</button>
              <button type="button" onClick={() => setOverlay((o) => !o)} className="h-12 w-12 rounded-full bg-[#c1121f] font-mono text-[10px] font-bold shadow" title="B：中継の文字">B<br />文字</button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <p className="rounded border border-white/10 p-2" data-testid="player-y">プレイヤー Y（パーマネント）{y ? `· 予想 ${y.votes} 回 · 的中 ${y.hits} 回 · レース ${y.games} 回 · ${y.createdAt.slice(0, 10)} から` : ''}</p>
          <p className="rounded border border-white/10 p-2 text-slate-400">配信のしかた：A ボタンで配信モードにし、OBS の「ウィンドウキャプチャ」か「ブラウザソース」でこのページを取り込み、YouTube Live や Discord の画面共有へ。ホイールの回転は実際の 50 分の 1 で描いています（スポークがちらつかないように）。</p>
        </div>
      </div>
    </main>
  );
}
