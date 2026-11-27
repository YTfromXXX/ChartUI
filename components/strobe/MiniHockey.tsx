'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal hockey: you (bottom) against the CPU (top). Two looks to compare colour:
//  • ICE: a white rink, red centre line, blue lines, light-blue goal creases, a black puck; slides far.
//  • GROUND: striped green turf, white lines and shooting circles, a yellow ball; rolls shorter.
type Mode = 'ice' | 'ground';
const W = 300; const H = 500; const GOAL = 110; const PR = 10; const MR = 20;
const LOOK = {
  ice: { bg: '#eef4f8', stripe: null, line: '#c8001a', blue: '#1d4ed8', crease: '#bfdbfe', board: '#1f2937', puck: '#111111', me: '#c8001a', cpu: '#2b3a67', friction: 0.996, bounce: 0.92, label: 'アイスホッケー形式' },
  ground: { bg: '#2f7d32', stripe: '#2a7030', line: '#ffffff', blue: '#ffffff', crease: null, board: '#14532d', puck: '#facc15', me: '#f97316', cpu: '#6366f1', friction: 0.982, bounce: 0.7, label: 'グラウンド形式' },
} as const;

export default function MiniHockey({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('ice');
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [over, setOver] = useState('');
  const [round, setRound] = useState(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d')!; const L = LOOK[mode];
    const puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    const me = { x: W / 2, y: H - 60, vx: 0, vy: 0, tx: W / 2, ty: H - 60 };
    const cpu = { x: W / 2, y: 60, vx: 0, vy: 0 };
    let sc: [number, number] = [0, 0]; let raf = 0; let pause = 40;
    const serve = (toward: 1 | -1) => { puck.x = W / 2; puck.y = H / 2; puck.vx = 0; puck.vy = 0; pause = 40; puck.vy = toward * 0.01; };
    const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); me.tx = ((e.clientX - r.left) / r.width) * W; me.ty = ((e.clientY - r.top) / r.height) * H; };
    cv.addEventListener('pointermove', pos); cv.addEventListener('pointerdown', pos);
    const hit = (m: { x: number; y: number; vx: number; vy: number }) => {
      const dx = puck.x - m.x; const dy = puck.y - m.y; const d = Math.hypot(dx, dy); if (d >= PR + MR || d === 0) return;
      const nx = dx / d; const ny = dy / d; puck.x = m.x + nx * (PR + MR); puck.y = m.y + ny * (PR + MR);
      const rel = (puck.vx - m.vx) * nx + (puck.vy - m.vy) * ny; if (rel < 0) { puck.vx -= 1.9 * rel * nx; puck.vy -= 1.9 * rel * ny; }
      puck.vx += m.vx * 0.4; puck.vy += m.vy * 0.4;
    };
    const draw = () => {
      ctx.fillStyle = L.bg; ctx.fillRect(0, 0, W, H);
      if (L.stripe) { ctx.fillStyle = L.stripe; for (let y = 0; y < H; y += 50) ctx.fillRect(0, y, W, 25); }
      ctx.lineWidth = 3; ctx.strokeStyle = L.line; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2); ctx.stroke();
      if (mode === 'ice') { ctx.strokeStyle = L.blue; for (const y of [H / 3, (2 * H) / 3]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.fillStyle = L.crease!; for (const [y, a0, a1] of [[0, 0, Math.PI], [H, Math.PI, Math.PI * 2]] as const) { ctx.beginPath(); ctx.arc(W / 2, y, 45, a0, a1); ctx.fill(); } }
      else { ctx.strokeStyle = L.line; ctx.lineWidth = 2; for (const [y, a0, a1] of [[0, 0, Math.PI], [H, Math.PI, Math.PI * 2]] as const) { ctx.beginPath(); ctx.arc(W / 2, y, 95, a0, a1); ctx.stroke(); } ctx.setLineDash([6, 6]); for (const y of [H / 4, (3 * H) / 4]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.setLineDash([]); }
      ctx.lineWidth = 6; ctx.strokeStyle = L.board; ctx.strokeRect(0, 0, W, H);
      ctx.fillStyle = mode === 'ice' ? '#c8001a' : '#ffffff'; ctx.fillRect((W - GOAL) / 2, 0, GOAL, 6); ctx.fillRect((W - GOAL) / 2, H - 6, GOAL, 6);
      for (const [m, c] of [[cpu, L.cpu], [me, L.me]] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(m.x, m.y, MR, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.arc(m.x, m.y, MR * 0.45, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = L.puck; ctx.beginPath(); ctx.arc(puck.x, puck.y, PR, 0, Math.PI * 2); ctx.fill();
      if (mode === 'ground') { ctx.strokeStyle = '#a16207'; ctx.lineWidth = 1; ctx.stroke(); }
    };
    const step = () => {
      const slow = reduced ? 0.6 : 1;
      // you: follow the pointer inside your half
      const tx = Math.max(MR, Math.min(W - MR, me.tx)); const ty = Math.max(H / 2 + MR, Math.min(H - MR, me.ty));
      me.vx = (tx - me.x) * 0.35; me.vy = (ty - me.y) * 0.35; me.x += me.vx; me.y += me.vy;
      // CPU: guard the goal, go for the puck when it is in its half
      const home = puck.y < H / 2 ? { x: puck.x, y: Math.max(MR, puck.y - 18) } : { x: W / 2 + (puck.x - W / 2) * 0.5, y: 60 };
      const max = 3.2 * slow; cpu.vx = Math.max(-max, Math.min(max, (home.x - cpu.x) * 0.12)); cpu.vy = Math.max(-max, Math.min(max, (home.y - cpu.y) * 0.12));
      cpu.x = Math.max(MR, Math.min(W - MR, cpu.x + cpu.vx)); cpu.y = Math.max(MR, Math.min(H / 2 - MR, cpu.y + cpu.vy));
      if (pause > 0) { pause -= 1; } else {
        puck.x += puck.vx * slow; puck.y += puck.vy * slow; puck.vx *= L.friction; puck.vy *= L.friction;
        const sp = Math.hypot(puck.vx, puck.vy); if (sp > 13) { puck.vx *= 13 / sp; puck.vy *= 13 / sp; }
        if (puck.x < PR) { puck.x = PR; puck.vx = Math.abs(puck.vx) * L.bounce; } if (puck.x > W - PR) { puck.x = W - PR; puck.vx = -Math.abs(puck.vx) * L.bounce; }
        const inMouth = Math.abs(puck.x - W / 2) < GOAL / 2;
        if (puck.y < PR) { if (inMouth) { sc = [sc[0] + 1, sc[1]]; setScore(sc); serve(1); } else { puck.y = PR; puck.vy = Math.abs(puck.vy) * L.bounce; } }
        if (puck.y > H - PR) { if (inMouth) { sc = [sc[0], sc[1] + 1]; setScore(sc); serve(-1); } else { puck.y = H - PR; puck.vy = -Math.abs(puck.vy) * L.bounce; } }
        hit(me); hit(cpu);
      }
      draw();
      if (sc[0] >= 5 || sc[1] >= 5) { setOver(sc[0] >= 5 ? 'あなたの勝ち' : 'CPU の勝ち'); return; }
      raf = requestAnimationFrame(step);
    };
    setScore([0, 0]); setOver(''); serve(1); raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointermove', pos); cv.removeEventListener('pointerdown', pos); };
  }, [mode, round, reduced]);
  const L = LOOK[mode];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(['ice', 'ground'] as Mode[]).map((m) => <button key={m} type="button" data-testid={`hockey-${m}`} onClick={() => setMode(m)} className="border px-3 py-1" style={{ borderColor: mode === m ? '#1f1f1f' : '#d6d3d1', background: mode === m ? '#f5f5f4' : 'white' }}>{m === 'ice' ? '🧊 アイス' : '🌱 グラウンド'}</button>)}
        <button type="button" onClick={() => setRound((r) => r + 1)} className="border border-stone-400 bg-white px-2 py-1">もう一度</button>
        <span className="font-semibold" data-testid="hockey-score">あなた {score[0]} − {score[1]} CPU</span>
        {over && <span className="font-semibold text-[#c8001a]" data-testid="hockey-over">{over}</span>}
      </div>
      <canvas ref={ref} width={W} height={H} className="w-full max-w-[300px] touch-none" style={{ cursor: 'none' }} data-testid="hockey" aria-label={L.label} />
      <p className="text-[11px] text-stone-500">{L.label}：手前の半分で、指かマウスでスティックを動かす。5 点先取。{mode === 'ice' ? '氷はよく滑り、壁でよく跳ねる。' : '芝は転がりが短く、壁で弾みにくい。'}</p>
    </div>
  );
}
