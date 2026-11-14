'use client';

import { useEffect, useRef } from 'react';
import type { Ev, Pmt } from '@/lib/tank';

// The tank unrolled: top cap (circle), barrel (rectangle), bottom cap (circle). Each dot is a PMT.
// View "angle": colour by arrival time (early = warm, late = cool) and a mark at the ring's centre.
// View "information" with ミュウの規則: the ring is white until measured; then μ-like = 水色 (29 種), e-like = 橙 (92 種).
export type View = 'angle' | 'info';
const W = 640; const H = 520;

export default function EventDisplay({ P, ev, hit, dead, view, measured }: { P: Pmt[]; ev: Ev | null; hit: { k: number; q: number; t: number }[]; dead: Set<number>; view: View; measured: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d'); if (!g) return;
    const capR = 95; const bx = 20; const bw = W - 40; const by = 2 * capR + 20; const bh = H - 4 * capR - 40;
    const pos = (p: Pmt): [number, number] => p.part === 'barrel' ? [bx + p.u * bw, by + p.v * bh] : p.part === 'top' ? [W / 2 + p.u * capR, capR + 8 + p.v * capR] : [W / 2 + p.u * capR, H - capR - 8 - p.v * capR];
    g.fillStyle = '#05070d'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1f2a3a'; g.lineWidth = 1; g.strokeRect(bx, by, bw, bh);
    g.beginPath(); g.arc(W / 2, capR + 8, capR, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(W / 2, H - capR - 8, capR, 0, Math.PI * 2); g.stroke();
    P.forEach((p, k) => { const [x, y] = pos(p); g.fillStyle = dead.has(k) ? '#3a1d1d' : '#1a2230'; g.fillRect(x - 1, y - 1, 2, 2); });
    if (!ev) return;
    const ts = hit.map((h) => h.t); const t0 = Math.min(...ts); const t1 = Math.max(...ts) || t0 + 1;
    const ringCol = ev.flavor === 'mu' ? '#22b8c8' : '#f29b30';
    for (const h of hit) {
      const [x, y] = pos(P[h.k]); const r = 1.2 + h.q * 3.2;
      let col: string;
      if (view === 'angle') { const f = (h.t - t0) / (t1 - t0 || 1); col = `hsl(${20 + f * 200}, 90%, ${55 + h.q * 15}%)`; }
      else col = measured ? ringCol : `rgba(255,255,255,${0.4 + h.q * 0.6})`;
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    if (view === 'angle') { // where the particle was heading: the ring's centre on the wall
      const [dx, dy, dz] = ev.dir; let best: Pmt | null = null; let bd = -2;
      for (const p of P) { const vx = p.x - ev.vertex[0]; const vy = p.y - ev.vertex[1]; const vz = p.z - ev.vertex[2]; const d = Math.hypot(vx, vy, vz); const c = (vx * dx + vy * dy + vz * dz) / d; if (c > bd) { bd = c; best = p; } }
      if (best) { const [x, y] = pos(best); g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke(); }
    }
    g.fillStyle = '#9aa7b8'; g.font = '11px monospace';
    g.fillText(`EVENT ${ev.id}  ${ev.kind === 'cosmic' ? '宇宙線ミューオン' : '大気ニュートリノ'}  ${hit.length} PMT`, 8, 16);
    g.fillText(view === 'angle' ? '視点：角度（時間の色・十字は進む向き）' : `視点：情報（ミュウの規則）${measured ? (ev.flavor === 'mu' ? '→ μ 型・29 種（水色）' : '→ e 型・92 種（橙）') : '→ まだ測っていない'}`, 8, H - 8);
  }, [P, ev, hit, dead, view, measured]);
  return <canvas ref={ref} width={W} height={H} className="w-full rounded-md border border-[#1f2a3a]" data-testid="event-display" aria-label="展開した水のタンクと、光電子増倍管のヒット" />;
}
