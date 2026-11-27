'use client';

import { useEffect, useRef } from 'react';

/** A stadium-style LED dot-matrix board (5×7 font). Unlit dots stay faintly visible; no flashing. */
const FONT: Record<string, number[]> = {
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17], Y: [17, 17, 17, 10, 4, 4, 4], '/': [1, 1, 2, 4, 8, 16, 16], ':': [0, 12, 12, 0, 12, 12, 0],
  '%': [24, 25, 2, 4, 8, 19, 3], '+': [0, 4, 4, 31, 4, 4, 0], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ' ': [0, 0, 0, 0, 0, 0, 0], '|': [4, 4, 4, 4, 4, 4, 4],
};

export default function LedBoard({ lines, cols = 34 }: { lines: { text: string; color: string }[]; cols?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = lines.map((l) => l.text + l.color).join('\n');
  useEffect(() => {
    const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
    const dot = 4; const gap = 1; const cell = dot + gap; const rowsPer = 9;
    c.width = cols * 6 * cell + 8; c.height = lines.length * rowsPer * cell + 8;
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, c.width, c.height);
    lines.forEach((line, li) => {
      const text = line.text.toUpperCase().padEnd(cols).slice(0, cols);
      for (let ci = 0; ci < cols; ci += 1) {
        const g = FONT[text[ci]] ?? FONT[' '];
        for (let y = 0; y < 7; y += 1) for (let x = 0; x < 6; x += 1) {
          const on = x < 5 && (g[y] >> (4 - x)) & 1;
          ctx.fillStyle = on ? line.color : '#1a1a1a';
          ctx.beginPath(); ctx.arc(4 + (ci * 6 + x) * cell + dot / 2, 4 + (li * rowsPer + y + 1) * cell + dot / 2, dot / 2, 0, Math.PI * 2); ctx.fill();
          if (on) { ctx.fillStyle = `${line.color}33`; ctx.beginPath(); ctx.arc(4 + (ci * 6 + x) * cell + dot / 2, 4 + (li * rowsPer + y + 1) * cell + dot / 2, dot, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    });
  }, [key, cols, lines]);
  return <canvas ref={ref} className="w-full rounded border-4 border-[#222]" style={{ imageRendering: 'pixelated' }} role="img" aria-label={lines.map((l) => l.text).join(' / ')} data-testid="led" />;
}
