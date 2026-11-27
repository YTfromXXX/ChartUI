'use client';

/** A real-looking die: a CSS 3D cube with ivory faces and inset pips. `spin` counts rolls. */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};
// Face placement on the cube and the rotation that brings each face to the front.
const FACE: Record<number, string> = { 1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 3: 'rotateY(90deg)', 4: 'rotateY(-90deg)', 5: 'rotateX(90deg)', 2: 'rotateX(-90deg)' };
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };

export default function Die3D({ value, spin, size = 72 }: { value: number; spin: number; size?: number }) {
  const [rx, ry] = SHOW[value] ?? [0, 0];
  const half = size / 2;
  return (
    <div style={{ width: size, height: size, perspective: 400 }} aria-label={`Die ${value}`} role="img">
      <div
        style={{ width: size, height: size, position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)', transform: `rotateX(${rx - 20 + spin * 720}deg) rotateY(${ry + 25 + spin * 360}deg)` }}
      >
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <div
            key={f}
            style={{ position: 'absolute', inset: 0, transform: `${FACE[f]} translateZ(${half}px)`, borderRadius: size * 0.16, background: 'radial-gradient(circle at 30% 25%, #fffdf6, #e8e1cf 70%, #cfc6b0)', boxShadow: 'inset 0 0 8px rgba(0,0,0,.25)' }}
          >
            {PIPS[f].map(([x, y]) => (
              <span key={`${x}-${y}`} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size * 0.15, height: size * 0.15, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: f === 1 ? 'radial-gradient(circle at 35% 35%, #ff4a5a, #9a0010)' : 'radial-gradient(circle at 35% 35%, #444, #050505)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.6)' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
