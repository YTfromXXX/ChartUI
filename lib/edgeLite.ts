// A few lines of what OpenCV would do, in plain TypeScript: grayscale → Sobel gradient →
// threshold. Small enough to run on a 320×200 frame in a couple of milliseconds, so the outline
// of the subject (a cat, a teacup…) can be traced before the full picture fades in.

export type Edges = { mag: Float32Array; w: number; h: number };

export function sobel(rgba: Uint8ClampedArray, w: number, h: number): Edges {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = (dx: number, dy: number) => g[(y + dy) * w + x + dx];
      const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
      const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
      mag[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return { mag, w, h };
}

/** Edge pixels above a threshold, ordered by angle around their centroid (for a sweep reveal). */
export function edgePoints(e: Edges, threshold: number) {
  const pts: [number, number][] = [];
  for (let y = 0; y < e.h; y += 1) for (let x = 0; x < e.w; x += 1) if (e.mag[y * e.w + x] > threshold) pts.push([x, y]);
  if (!pts.length) return { pts, box: null };
  let cx = 0; let cy = 0; let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of pts) { cx += x; cy += y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  cx /= pts.length; cy /= pts.length;
  pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  return { pts, box: { x0, y0, x1, y1 } };
}

/** Edge map as a white-on-transparent image (for the line-art stage of the reveal). */
export function edgeImage(e: Edges, threshold: number, rgb: [number, number, number]): ImageData {
  const img = new ImageData(e.w, e.h);
  for (let i = 0; i < e.w * e.h; i += 1) {
    const a = Math.min(1, Math.max(0, (e.mag[i] - threshold) / (threshold * 2)));
    img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = Math.round(a * 255);
  }
  return img;
}
