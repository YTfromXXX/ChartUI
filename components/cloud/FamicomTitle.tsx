'use client';

import { useEffect, useRef } from 'react';
import type { SkyPalette } from '@/lib/skyPalettes';

// A cute, deep-looking 8-bit style title: 256×224 drawn at low resolution and scaled up with crisp pixels.
// Depth comes from three cloud layers drifting at different speeds and a title extruded toward the back.
// "PRESS START" fades gently (once every 2 s) instead of blinking; still with reduced motion.
const W = 256; const H = 224;

function pixelText(text: string, size: number, color: string) {
  const c = document.createElement('canvas'); const g = c.getContext('2d')!;
  g.font = `bold ${size}px "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 4; c.width = w; c.height = size + 6;
  g.font = `bold ${size}px "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", system-ui, sans-serif`; g.textBaseline = 'top'; g.fillStyle = color; g.fillText(text, 2, 2);
  const d = g.getImageData(0, 0, c.width, c.height); // threshold the edges: pixels are on or off
  for (let k = 3; k < d.data.length; k += 4) d.data[k] = d.data[k] > 110 ? 255 : 0;
  g.putImageData(d, 0, 0); return c;
}

export default function FamicomTitle({ palette, reduced, onStart }: { palette: SkyPalette; reduced: boolean; onStart: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined; const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false;
    const layers = [[0.15, 3, '#ffffff'], [0.35, 4, '#f4fbff'], [0.7, 5, '#ffffff']] as const;
    const clouds = layers.map(([speed, n, col], li) => Array.from({ length: n }, (_, k) => ({ x: (k * 97 + li * 41) % W, y: 24 + li * 46 + ((k * 37) % 30), s: 0.6 + li * 0.35, speed, col })));
    const line1 = pixelText('雲のなかに', 22, '#ffffff'); const line2 = pixelText('電池を作れ', 26, '#ffffff');
    const shade1 = pixelText('雲のなかに', 22, '#2b3a67'); const shade2 = pixelText('電池を作れ', 26, '#2b3a67');
    const press = pixelText('PRESS START', 10, '#2b3a67');
    let raf = 0; let t = 0;
    const cloud = (x: number, y: number, s: number, col: string) => {
      g.fillStyle = col;
      for (const [dx, dy, r] of [[0, 0, 10], [12, -5, 12], [24, 0, 10], [12, 4, 10]] as const) { g.beginPath(); g.arc(Math.round(x + dx * s), Math.round(y + dy * s), r * s, 0, Math.PI * 2); g.fill(); }
    };
    const battery = (x: number, y: number, bob: number) => {
      const yy = Math.round(y + bob);
      cloud(x - 18, yy + 8, 1.5, '#ffffff');
      g.fillStyle = '#2b3a67'; g.fillRect(x - 1, yy - 1, 26, 14); g.fillRect(x + 25, yy + 3, 3, 6); // outline + cap
      g.fillStyle = '#fff27a'; g.fillRect(x + 1, yy + 1, 22, 10);
      g.fillStyle = '#7fd36b'; g.fillRect(x + 1, yy + 1, 14, 10); // charge
      g.fillStyle = '#2b3a67'; g.fillRect(x + 6, yy + 4, 2, 2); g.fillRect(x + 14, yy + 4, 2, 2); g.fillRect(x + 9, yy + 8, 4, 1); // a face
      g.fillStyle = '#ff8fcf'; g.fillRect(x + 4, yy + 7, 2, 1); g.fillRect(x + 16, yy + 7, 2, 1); // cheeks
    };
    const frame = () => {
      t += reduced ? 0 : 1 / 60;
      const sky = palette.sky; const band = H / sky.length; // banded sky, like a limited palette
      sky.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, Math.floor(k * band), W, Math.ceil(band) + 1); });
      for (let y = 0; y < H; y += 2) for (let x = (y / 2) % 2; x < W; x += 4) { const k = Math.floor(y / band); if (k + 1 < sky.length && y % band > band - 8) { g.fillStyle = sky[k + 1]; g.fillRect(x, y, 1, 1); } } // dither between bands
      clouds.forEach((layer) => layer.forEach((c) => { const x = ((c.x - t * c.speed * 20) % (W + 60) + W + 60) % (W + 60) - 40; cloud(x, c.y, c.s, c.col); }));
      const depth = 4; const tx1 = Math.round((W - line1.width) / 2); const tx2 = Math.round((W - line2.width) / 2);
      for (let d = depth; d >= 1; d -= 1) { g.drawImage(shade1, tx1 + d, 46 + d); g.drawImage(shade2, tx2 + d, 74 + d); }
      g.drawImage(line1, tx1, 46); g.drawImage(line2, tx2, 74);
      battery(W / 2 - 13, 132, reduced ? 0 : Math.round(Math.sin(t * 2) * 2));
      g.globalAlpha = reduced ? 1 : 0.55 + 0.45 * Math.cos(t * Math.PI); g.drawImage(press, Math.round((W - press.width) / 2), 182); g.globalAlpha = 1;
      g.fillStyle = '#2b3a6799'; g.font = '8px monospace'; g.fillText('© 20XX CHARTUI', W / 2 - 34, 212);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter') onStart(); };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  }, [palette, reduced, onStart]);
  return <canvas ref={ref} width={W} height={H} onClick={onStart} className="w-full max-w-[512px] cursor-pointer border-4 border-[#2b3a67]" style={{ imageRendering: 'pixelated' }} data-testid="title" aria-label="雲のなかに電池を作れ — タイトル。押すか Enter で始まる" />;
}
