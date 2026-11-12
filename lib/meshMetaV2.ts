// .meshmeta v2 — mirror of meshmeta_v2.py (spec: docs/meshmeta-v2.md).
// Keccak-256 Merkle tree over the STL's 50-byte triangle records (OpenZeppelin-compatible sorted
// pairs, double-hashed leaves that include the index), RFC 8785 canonical JSON with NFC strings,
// and an array of signatures (Ed25519 checked with Web Crypto; other algorithms reserved).
// No dependencies.

import { analyse, parseData, type Tri, type V3 } from './meshMeta';

export const VERSION = '2.0';
export const EMOJI = { start: '⏸️', length: '▶️' } as const; // ⏸️ ▶️ exact code points
export const RECORD = 50; export const HEADER = 84;

// ---------- Keccak-256 (Ethereum's; not NIST SHA3-256) ----------
const RC = ([
  '0000000000000001', '0000000000008082', '800000000000808a', '8000000080008000', '000000000000808b', '0000000080000001',
  '8000000080008081', '8000000000008009', '000000000000008a', '0000000000000088', '0000000080008009', '000000008000000a',
  '000000008000808b', '800000000000008b', '8000000000008089', '8000000000008003', '8000000000008002', '8000000000000080',
  '000000000000800a', '800000008000000a', '8000000080008081', '8000000000008080', '0000000080000001', '8000000080008008',
]).map((h) => BigInt(`0x${h}`)); // BigInt() calls, not 1n literals: the app compiles below ES2020
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const B = (n: number) => BigInt(n); const Z = B(0); const B8 = B(8); const FF = B(0xff);
const M64 = (B(1) << B(64)) - B(1);
const rol = (x: bigint, n: number) => (n ? ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64 : x);

function keccakF(a: bigint[][]) {
  for (const rc of RC) {
    const c = [0, 1, 2, 3, 4].map((x) => a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4]);
    const d = [0, 1, 2, 3, 4].map((x) => c[(x + 4) % 5] ^ rol(c[(x + 1) % 5], 1));
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) a[x][y] ^= d[x];
    const b = [0, 1, 2, 3, 4].map(() => [Z, Z, Z, Z, Z]);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) b[y][(2 * x + 3 * y) % 5] = rol(a[x][y], ROT[x][y]);
    for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) a[x][y] = b[x][y] ^ (~b[(x + 1) % 5][y] & M64 & b[(x + 2) % 5][y]);
    a[0][0] ^= rc;
  }
}

export function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136; const len = data.length + 1; const padded = new Uint8Array(len + ((rate - (len % rate)) % rate));
  padded.set(data); padded[data.length] = 0x01; padded[padded.length - 1] |= 0x80;
  const a = [0, 1, 2, 3, 4].map(() => [Z, Z, Z, Z, Z]);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i += 1) { let w = Z; for (let k = 7; k >= 0; k -= 1) w = (w << B8) | BigInt(padded[off + 8 * i + k]); a[i % 5][Math.floor(i / 5)] ^= w; }
    keccakF(a);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i += 1) { let w = a[i % 5][Math.floor(i / 5)]; for (let k = 0; k < 8; k += 1) { out[8 * i + k] = Number(w & FF); w >>= B8; } }
  return out;
}

export const toHex = (b: Uint8Array) => `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
export const fromHex = (h: string) => new Uint8Array((h.replace(/^0x/, '').match(/../g) ?? []).map((x) => parseInt(x, 16)));
const concat = (...xs: Uint8Array[]) => { const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of xs) { o.set(x, p); p += x.length; } return o; };
const cmp = (a: Uint8Array, b: Uint8Array) => { for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };

// ---------- RFC 8785 (JCS) with NFC strings ----------
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const nfc = (v: Json): Json => (typeof v === 'string' ? v.normalize('NFC') : Array.isArray(v) ? v.map(nfc) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k.normalize('NFC'), nfc(x)])) : v);
const utf16Less = (a: string, b: string) => { for (let i = 0; i < Math.min(a.length, b.length); i += 1) { const d = a.charCodeAt(i) - b.charCodeAt(i); if (d) return d; } return a.length - b.length; };
function jcs(v: Json): string {
  if (v === null || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'number') { if (!Number.isInteger(v)) throw new Error('v2 allows no floating-point numbers; write them as strings'); if (Math.abs(v) > Number.MAX_SAFE_INTEGER) throw new Error('integer too large'); return String(v); }
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jcs).join(',')}]`;
  return `{${Object.keys(v).sort(utf16Less).map((k) => `${JSON.stringify(k)}:${jcs(v[k])}`).join(',')}}`;
}
export const canonical = (v: unknown) => new TextEncoder().encode(jcs(nfc(v as Json)));

// ---------- Merkle tree over triangle records ----------
export function leaf(index: number, record: Uint8Array) {
  if (record.length !== RECORD) throw new Error('a triangle record is 50 bytes');
  const idx = new Uint8Array(32); let n = BigInt(index); for (let i = 31; i >= 0; i -= 1) { idx[i] = Number(n & FF); n >>= B8; }
  return keccak256(keccak256(concat(idx, record)));
}
const pair = (a: Uint8Array, b: Uint8Array) => keccak256(cmp(a, b) <= 0 ? concat(a, b) : concat(b, a));
export function records(stl: Uint8Array) {
  const n = new DataView(stl.buffer, stl.byteOffset, stl.byteLength).getUint32(80, true);
  if (HEADER + RECORD * n !== stl.length) throw new Error('v2 pointers address a binary STL');
  return Array.from({ length: n }, (_, i) => stl.slice(HEADER + RECORD * i, HEADER + RECORD * (i + 1)));
}
export function tree(stl: Uint8Array): Uint8Array[][] {
  let level = records(stl).map((r, i) => leaf(i, r)); if (!level.length) throw new Error('empty STL');
  const levels = [level];
  while (level.length > 1) { const next: Uint8Array[] = []; for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? pair(level[i], level[i + 1]) : level[i]); level = next; levels.push(level); }
  return levels;
}
export function proof(levels: Uint8Array[][], index: number) { const out: Uint8Array[] = []; let i = index; for (const level of levels.slice(0, -1)) { const s = i ^ 1; if (s < level.length) out.push(level[s]); i = Math.floor(i / 2); } return out; }
export function verifyProof(root: Uint8Array, index: number, record: Uint8Array, path: Uint8Array[]) { let h = leaf(index, record); for (const p of path) h = pair(h, p); return cmp(h, root) === 0; }

// ---------- build / verify ----------
export type Pointer = { part: string; rank: string; label: string; quality: string; index: number; start: number; length: number; vertices: [number, number]; data: string; proof: string[] };
export type Signature = { alg: string; signer: string; sig: string };
export type MeshMetaV2 = { version: string; emoji: Record<string, string>; stl_sha256: string; triangles: number; merkle: { hash: string; leaf: string; node: string; root: string }; pointers: Pointer[]; signatures: Signature[] };

/** Web Crypto wants an ArrayBuffer-backed view; ours always are. */
const bs = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;
async function sha256Hex(b: Uint8Array) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bs(b))); return toHex(d).slice(2); }

export async function build(vs: V3[], ts: Tri[], sharpDeg: number | null = 40): Promise<{ stl: Uint8Array; meta: MeshMetaV2 }> {
  const a = analyse(vs, ts, sharpDeg); const stl = new Uint8Array(a.stl); const levels = tree(stl);
  const pointers: Pointer[] = [];
  for (const [part, body] of Object.entries(a.meta)) for (const t of body.Top_Triangles) {
    const [vstart, vlen] = parseData(t.Data); const index = (vstart - 12 - HEADER) / RECORD;
    pointers.push({ part, rank: t.Rank, label: t.Label, quality: t.Quality, index, start: HEADER + RECORD * index, length: RECORD, vertices: [vstart, vlen], data: t.Data, proof: proof(levels, index).map(toHex) });
  }
  return { stl, meta: { version: VERSION, emoji: { [EMOJI.start]: 'start', [EMOJI.length]: 'length' }, stl_sha256: await sha256Hex(stl), triangles: levels[0].length,
    merkle: { hash: 'keccak256', leaf: 'keccak256(keccak256(uint256 index ++ record50))', node: 'sorted-pair', root: toHex(levels[levels.length - 1][0]) }, pointers, signatures: [] } };
}

export const signingBytes = (meta: MeshMetaV2) => canonical(Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'signatures')));

export type Report = { stl_sha256: boolean; merkle_root: boolean; pointers: boolean[]; signatures: (boolean | null)[]; ok: boolean };
/** Check the STL hash, the Merkle root, every pointer's proof, and each Ed25519 signature. */
export async function verify(stl: Uint8Array, meta: MeshMetaV2, trusted?: string[]): Promise<Report> {
  const shaOk = (await sha256Hex(stl)) === meta.stl_sha256;
  let levels: Uint8Array[][] | null = null; try { levels = tree(stl); } catch { levels = null; }
  const rootOk = !!levels && toHex(levels[levels.length - 1][0]) === meta.merkle?.root;
  const recs = levels ? records(stl) : [];
  const pointers = meta.pointers.map((p) => rootOk && p.start === HEADER + RECORD * p.index && p.length === RECORD && !!recs[p.index] && verifyProof(fromHex(meta.merkle.root), p.index, recs[p.index], p.proof.map(fromHex)));
  const msg = signingBytes(meta); const signatures: (boolean | null)[] = [];
  for (const s of meta.signatures ?? []) {
    if (s.alg !== 'Ed25519') { signatures.push(null); continue; }
    if (trusted && !trusted.includes(s.signer)) { signatures.push(false); continue; }
    try { const key = await crypto.subtle.importKey('raw', bs(fromHex(s.signer)), { name: 'Ed25519' }, false, ['verify']); signatures.push(await crypto.subtle.verify({ name: 'Ed25519' }, key, bs(fromHex(s.sig)), bs(msg))); } catch { signatures.push(false); }
  }
  const ok = shaOk && rootOk && pointers.every(Boolean) && (signatures.length === 0 || signatures.some((x) => x === true)) && !signatures.some((x) => x === false);
  return { stl_sha256: shaOk, merkle_root: rootOk, pointers, signatures, ok };
}
