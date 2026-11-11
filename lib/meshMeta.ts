// TypeScript twin of `mesh_meta.py`: weld → split into parts (connected over shared edges, then at
// sharp edges) → score triangles with q = 2r/R (1 = equilateral) → best four per part as A–D →
// binary STL + a .meshmeta JSON whose emoji pointers address each triangle's 36-byte vertex block:
//   [⏸️ (バイト): "0x0060", ▶️ (バイト): "36"]   (⏸️ = start offset in the STL, ▶️ = length)

export type V3 = [number, number, number];
export type Tri = [number, number, number];

export const STL_HEADER = 80; export const STL_STRIDE = 50; export const VERTEX_BLOCK = 36;
export const DATA_RE = /\[⏸️ \(バイト\): "(.*?)",\s*▶️ \(バイト\): "(.*?)"\]/;
export const LABELS = ['A', 'B', 'C', 'D'] as const;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); // same formula as mesh_meta.py
const unitNormal = (p: V3, q: V3, r: V3): V3 => { const n = cross(sub(q, p), sub(r, p)); const l = len(n); return l ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 0]; };

/** Normalised radius ratio 2r/R in [0, 1]; 1 for an equilateral triangle. */
export function triangleQuality(p: V3, q: V3, r: V3) {
  const a = len(sub(q, r)); const b = len(sub(p, r)); const c = len(sub(p, q));
  const area = len(cross(sub(q, p), sub(r, p))) / 2;
  if (area <= 0 || a * b * c === 0) return 0;
  const s = (a + b + c) / 2;
  return Math.min(1, (8 * area * area) / (s * a * b * c));
}

export function weld(vs: V3[], ts: Tri[], eps = 1e-6): { vs: V3[]; ts: Tri[] } {
  if (!vs.length) return { vs: [], ts: [] };
  const span = Math.max(...[0, 1, 2].map((i) => Math.max(...vs.map((v) => v[i])) - Math.min(...vs.map((v) => v[i])))) || 1;
  const step = eps * span; const index = new Map<string, number>(); const out: V3[] = [];
  const remap = vs.map((v) => { const k = `${Math.round(v[0] / step)},${Math.round(v[1] / step)},${Math.round(v[2] / step)}`; let i = index.get(k); if (i === undefined) { i = out.length; index.set(k, i); out.push(v); } return i; });
  return { vs: out, ts: ts.map(([a, b, c]) => [remap[a], remap[b], remap[c]] as Tri) };
}

/** Parts as lists of triangle indices, largest first. */
export function segment(vs: V3[], ts: Tri[], sharpDeg: number | null = null): number[][] {
  const parent = ts.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const normals = ts.map(([a, b, c]) => unitNormal(vs[a], vs[b], vs[c]));
  const cosLimit = sharpDeg === null ? -2 : Math.cos((sharpDeg * Math.PI) / 180);
  const edges = new Map<string, number[]>();
  ts.forEach(([a, b, c], t) => { for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = u < v ? `${u}_${v}` : `${v}_${u}`; const l = edges.get(k); if (l) l.push(t); else edges.set(k, [t]); } });
  for (const faces of edges.values()) for (let i = 0; i < faces.length; i += 1) for (let j = i + 1; j < faces.length; j += 1) {
    const n1 = normals[faces[i]]; const n2 = normals[faces[j]];
    if (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] >= cosLimit) parent[find(faces[i])] = find(faces[j]);
  }
  const groups = new Map<number, number[]>();
  ts.forEach((_, t) => { const r = find(t); const g = groups.get(r); if (g) g.push(t); else groups.set(r, [t]); });
  return [...groups.values()].sort((x, y) => y.length - x.length || x[0] - y[0]);
}

/** Quality rounded to 9 digits for ranking, so last-bit float noise never reorders ties. */
const rank = (q: number) => Math.round(q * 1e9);

export function topTriangles(vs: V3[], ts: Tri[], part: number[], k = 4) {
  return part.map((t) => ({ t, q: triangleQuality(vs[ts[t][0]], vs[ts[t][1]], vs[ts[t][2]]) })).sort((x, y) => rank(y.q) - rank(x.q) || x.t - y.t).slice(0, k);
}

export const vertexOffset = (i: number) => STL_HEADER + 4 + STL_STRIDE * i + 12;
export const formatData = (start: number, length = VERTEX_BLOCK) => `[⏸️ (バイト): "0x${start.toString(16).toUpperCase().padStart(4, '0')}", ▶️ (バイト): "${length}"]`;
export function parseData(field: string): [number, number] {
  const m = DATA_RE.exec(field); if (!m) throw new Error(`not a byte pointer: ${field}`);
  return [Number(m[1]), Number(m[2])]; // Number() reads "0x00A1" and "161" alike
}

export function writeStl(vs: V3[], ts: Tri[]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + STL_STRIDE * ts.length); const dv = new DataView(buf);
  new TextEncoder().encode('ChartUI mesh_meta').forEach((b, i) => dv.setUint8(i, b));
  dv.setUint32(80, ts.length, true);
  ts.forEach(([a, b, c], i) => {
    const o = 84 + STL_STRIDE * i; const floats = [...unitNormal(vs[a], vs[b], vs[c]), ...vs[a], ...vs[b], ...vs[c]];
    floats.forEach((f, k) => dv.setFloat32(o + 4 * k, f, true));
  });
  return buf;
}

export function readStl(buf: ArrayBuffer): { vs: V3[]; ts: Tri[] } {
  const dv = new DataView(buf); const vs: V3[] = [];
  if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * STL_STRIDE === buf.byteLength) {
      for (let i = 0; i < n; i += 1) for (let k = 0; k < 3; k += 1) { const o = vertexOffset(i) + 12 * k; vs.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]); }
      return { vs, ts: Array.from({ length: n }, (_, i) => [3 * i, 3 * i + 1, 3 * i + 2] as Tri) };
    }
  }
  const text = new TextDecoder().decode(buf);
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) vs.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  return { vs, ts: Array.from({ length: Math.floor(vs.length / 3) }, (_, i) => [3 * i, 3 * i + 1, 3 * i + 2] as Tri) };
}

/** Read the triangle a Data field points at, straight from the STL bytes. */
export function readPointer(stl: ArrayBuffer, field: string): V3[] {
  const [start, length] = parseData(field);
  if (length % 12 || start < 0 || start + length > stl.byteLength) throw new Error(`pointer out of range: ${start}+${length}`);
  const dv = new DataView(stl); const out: V3[] = [];
  for (let o = start; o < start + length; o += 12) out.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]);
  return out;
}

export type MeshMeta = Record<string, { Top_Triangles: { Rank: string; Label: string; Quality: string; Data: string }[] }>;
export type Analysis = { vs: V3[]; ts: Tri[]; parts: number[][]; tops: { t: number; q: number }[][]; stl: ArrayBuffer; meta: MeshMeta };

export function analyse(vsIn: V3[], tsIn: Tri[], sharpDeg: number | null = 40): Analysis {
  const { vs, ts } = weld(vsIn, tsIn);
  const parts = segment(vs, ts, sharpDeg);
  const tops = parts.map((p) => topTriangles(vs, ts, p));
  const meta: MeshMeta = {};
  tops.forEach((top, n) => {
    meta[`MeshPart_${String(n + 1).padStart(2, '0')}`] = { Top_Triangles: top.map(({ t, q }, i) => ({ Rank: `No.${i + 1}`, Label: LABELS[i], Quality: q.toFixed(3), Data: formatData(vertexOffset(t)) })) };
  });
  return { vs, ts, parts, tops, stl: writeStl(vs, ts), meta };
}

// ---------------------------------------------------------------- sample meshes
function icosphere(sub: number, c: V3, r: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  let vs: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let ts: Tri[] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const norm = (v: V3): V3 => { const l = len(v); return [v[0] / l, v[1] / l, v[2] / l]; };
  vs = vs.map(norm);
  for (let s = 0; s < sub; s += 1) {
    const mid = new Map<string, number>(); const next: Tri[] = [];
    const m = (a: number, b: number) => { const k = a < b ? `${a}_${b}` : `${b}_${a}`; let i = mid.get(k); if (i === undefined) { i = vs.length; vs.push(norm([(vs[a][0] + vs[b][0]) / 2, (vs[a][1] + vs[b][1]) / 2, (vs[a][2] + vs[b][2]) / 2])); mid.set(k, i); } return i; };
    for (const [a, b, cc] of ts) { const ab = m(a, b); const bc = m(b, cc); const ca = m(cc, a); next.push([a, ab, ca], [b, bc, ab], [cc, ca, bc], [ab, bc, ca]); }
    ts = next;
  }
  return { vs: vs.map((v) => [c[0] + v[0] * r, c[1] + v[1] * r, c[2] + v[2] * r] as V3), ts };
}
function cylinder(n: number, rings: number, c: V3, r: number, h: number) {
  const vs: V3[] = []; const ts: Tri[] = [];
  for (let j = 0; j <= rings; j += 1) for (let i = 0; i < n; i += 1) { const a = (i / n) * Math.PI * 2; vs.push([c[0] + Math.cos(a) * r, c[1] + (j / rings) * h, c[2] + Math.sin(a) * r]); }
  for (let j = 0; j < rings; j += 1) for (let i = 0; i < n; i += 1) { const a = j * n + i; const b = j * n + ((i + 1) % n); ts.push([a, b + n, b], [a, a + n, b + n]); }
  for (const [j, y] of [[0, 0], [rings, h]] as const) { const ci = vs.length; vs.push([c[0], c[1] + y, c[2]]); for (let i = 0; i < n; i += 1) { const a = j * n + i; const b = j * n + ((i + 1) % n); ts.push(j ? [ci, b, a] : [ci, a, b]); } }
  return { vs, ts };
}
function jitterPlate(nx: number, ny: number, c: V3, size: number, seed: number) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const vs: V3[] = []; const ts: Tri[] = [];
  for (let j = 0; j <= ny; j += 1) for (let i = 0; i <= nx; i += 1) {
    const inner = i > 0 && j > 0 && i < nx && j < ny; const jx = inner ? (rnd() - 0.5) * 0.6 : 0; const jy = inner ? (rnd() - 0.5) * 0.6 : 0;
    vs.push([c[0] + ((i + jx) / nx - 0.5) * size, c[1], c[2] + ((j + jy) / ny - 0.5) * size]);
  }
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) { const a = j * (nx + 1) + i; ts.push([a, a + nx + 1, a + 1], [a + 1, a + nx + 1, a + nx + 2]); }
  return { vs, ts };
}

/** A small scene with parts of very different triangle quality. */
export function sampleScene(): { vs: V3[]; ts: Tri[] } {
  const parts = [icosphere(2, [0, 1.2, 0], 1), cylinder(24, 6, [2.6, 0, 0], 0.45, 2.4), jitterPlate(8, 8, [0, -0.2, 0], 5, 7)];
  const vs: V3[] = []; const ts: Tri[] = [];
  for (const p of parts) { const o = vs.length; vs.push(...p.vs); ts.push(...p.ts.map(([a, b, c]) => [a + o, b + o, c + o] as Tri)); }
  return { vs, ts };
}
