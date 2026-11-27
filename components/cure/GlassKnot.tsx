'use client';

import { useEffect, useRef } from 'react';

type Props = {
  /** Measurement events so far (0..22): each reveals one of 22 knot segments. */
  events: number;
  /** Labels drawn at each event's segment start. */
  labels: string[];
  /** 0..1 collision shake. */
  shake?: number;
  className?: string;
};

const SEGMENTS = 22;
const RING = 14; // micro layer: points around the tube cross-section
const ALONG = 18; // samples per segment along the knot (meso layer)

/** Trefoil (2,3) torus knot with a free-curve wobble that grows with each event. */
function knot(t: number, wobble: number): [number, number, number] {
  const r = 2 + Math.cos(3 * t) + wobble * 0.25 * Math.sin(7 * t);
  return [r * Math.cos(2 * t), r * Math.sin(2 * t), -Math.sin(3 * t) + wobble * 0.2 * Math.cos(5 * t)];
}

/**
 * Glass-tube knot as a point cloud. Each tube ring (micro) is sampled around the knot
 * curve (meso); points facing sideways to the viewer are brighter (a Fresnel-like rim), so
 * the tube reads as hollow glass.
 */
export default function GlassKnot({ events, labels, shake = 0, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ events, labels, shake });
  live.current = { events, labels, shake };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    const frame = (now: number) => {
      const { events: ev, labels: lb, shake: sh } = live.current;
      const w = canvas.width; const h = canvas.height;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05020a'; ctx.fillRect(0, 0, w, h);
      const rot = reduced ? 0.6 : now / 4000;
      const cy = Math.cos(rot); const sy = Math.sin(rot);
      const tilt = 0.5; const ct = Math.cos(tilt); const st = Math.sin(tilt);
      const scale = Math.min(w, h) / 8.2;
      const jx = sh * Math.sin(now / 23) * 8; const jy = sh * Math.cos(now / 19) * 8;
      const wobble = ev / SEGMENTS;
      const project = ([x, y, z]: [number, number, number]) => {
        const x1 = x * cy - z * sy; const z1 = x * sy + z * cy;
        const y2 = y * ct - z1 * st; const z2 = y * st + z1 * ct;
        return { x: w / 2 + x1 * scale + jx, y: h / 2 + y2 * scale + jy, z: z2 };
      };

      ctx.globalCompositeOperation = 'lighter';
      const total = SEGMENTS * ALONG;
      for (let i = 0; i < total; i += 1) {
        const seg = Math.floor(i / ALONG);
        const revealed = seg < ev;
        const t = (i / total) * Math.PI * 2;
        const p = knot(t, wobble);
        const q = knot(t + 0.01, wobble);
        const tangent = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        const tl = Math.hypot(tangent[0], tangent[1], tangent[2]) || 1;
        const T = tangent.map((v) => v / tl);
        // Normal frame from the tangent and the z axis.
        let N = [T[1], -T[0], 0]; const nl = Math.hypot(N[0], N[1]) || 1; N = N.map((v) => v / nl);
        const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
        const radius = 0.32;
        for (let k = 0; k < RING; k += 1) {
          const a = (k / RING) * Math.PI * 2;
          const off = [N[0] * Math.cos(a) + B[0] * Math.sin(a), N[1] * Math.cos(a) + B[1] * Math.sin(a), N[2] * Math.cos(a) + B[2] * Math.sin(a)];
          const s = project([p[0] + off[0] * radius, p[1] + off[1] * radius, p[2] + off[2] * radius]);
          // Rim: the offset's view-space z near 0 = seen edge-on = brighter glass edge.
          const vz = off[0] * sy * ct + off[1] * st + off[2] * cy * ct;
          const rim = 1 - Math.min(1, Math.abs(vz));
          const alpha = revealed ? 0.08 + 0.5 * rim * rim : 0.025;
          ctx.fillStyle = revealed ? `rgba(${seg % 2 ? '167,243,208' : '186,230,253'},${alpha.toFixed(3)})` : `rgba(148,163,184,${alpha})`;
          ctx.fillRect(s.x, s.y, 1.6, 1.6);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '14px "Noto Sans Cuneiform", "Segoe UI Historic", sans-serif';
      ctx.textAlign = 'center';
      for (let e = 0; e < Math.min(ev, lb.length); e += 1) {
        const s = project(knot(((e + 0.5) / SEGMENTS) * Math.PI * 2, wobble));
        ctx.fillStyle = 'rgba(253,230,138,.9)';
        ctx.fillText(lb[e], s.x, s.y - 10);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={520} height={420} className={className} aria-label={`Glass-tube knot, ${events} of ${SEGMENTS} segments measured`} role="img" />;
}
