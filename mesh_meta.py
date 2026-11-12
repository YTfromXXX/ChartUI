"""Mesh part segmentation, triangle quality ranking and the emoji byte-pointer format (.meshmeta).

Pipeline
--------
1. Weld duplicate vertices (STL stores every triangle separately).
2. Split into parts: connected components over shared edges, then optionally split each component
   again at sharp edges (dihedral angle above ``sharp_deg``).
3. Score every triangle with the normalised radius ratio ``q = 2 r / R`` (r = inradius,
   R = circumradius). q = 1 for an equilateral triangle and falls to 0 as it degenerates.
4. Keep the best four per part as No.1–No.4 / A–D.

File format
-----------
The triangles are written as a binary STL: an 80-byte header, a uint32 count, then 50 bytes per
triangle (normal 12 B, three vertices 36 B, attribute 2 B). A ``.meshmeta`` JSON next to it points at
each chosen triangle's vertex block::

    "Data": "[⏸️ (バイト): \"0x00A1\", ▶️ (バイト): \"36\"]"

⏸️ is the start offset in that STL (hex), ▶️ the length in bytes (36 = 3 vertices × 3 axes × float32).
Another program can seek straight to those bytes and read the triangle without parsing the mesh.
Pure Python, no third-party dependencies — except the optional signature below.

Signature
---------
``sign_meshmeta`` adds a ``"Signature"`` entry: an Ed25519 signature over
``SHA-256(stl) || canonical JSON of the meta without "Signature"`` (keys sorted, no spaces,
UTF-8). Anyone holding the public key can check that neither the STL bytes nor the pointers were
changed. It needs the ``cryptography`` package (already installed for python-jose).
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from typing import Iterable, Sequence

Vec = tuple[float, float, float]
Tri = tuple[int, int, int]

STL_HEADER = 80
STL_STRIDE = 50
VERTEX_BLOCK = 36
DATA_RE = re.compile(r'\[⏸️ \(バイト\): "(.*?)",\s*▶️ \(バイト\): "(.*?)"\]')
LABELS = ("A", "B", "C", "D")


# ---------------------------------------------------------------- geometry helpers
def _sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a: Vec, b: Vec) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a: Vec) -> float:
    return math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])


def _unit_normal(p: Vec, q: Vec, r: Vec) -> Vec:
    n = _cross(_sub(q, p), _sub(r, p))
    length = _norm(n)
    return (0.0, 0.0, 0.0) if length == 0 else (n[0] / length, n[1] / length, n[2] / length)


def triangle_quality(p: Vec, q: Vec, r: Vec) -> float:
    """Normalised radius ratio 2r/R in [0, 1]; 1 for an equilateral triangle."""
    a, b, c = _norm(_sub(q, r)), _norm(_sub(p, r)), _norm(_sub(p, q))
    area = _norm(_cross(_sub(q, p), _sub(r, p))) / 2
    if area <= 0 or a * b * c == 0:
        return 0.0
    s = (a + b + c) / 2
    return min(1.0, 8 * area * area / (s * a * b * c))


# ---------------------------------------------------------------- welding and parts
def weld(vertices: Sequence[Vec], triangles: Sequence[Tri], eps: float = 1e-6) -> tuple[list[Vec], list[Tri]]:
    """Merge vertices closer than ``eps`` × bounding-box size (STL has no shared vertices)."""
    if not vertices:
        return [], []
    span = max(max(v[i] for v in vertices) - min(v[i] for v in vertices) for i in range(3)) or 1.0
    step = eps * span
    index: dict[tuple[int, int, int], int] = {}
    remap: list[int] = []
    out: list[Vec] = []
    for v in vertices:
        key = (round(v[0] / step), round(v[1] / step), round(v[2] / step))
        if key not in index:
            index[key] = len(out)
            out.append(v)
        remap.append(index[key])
    return out, [(remap[a], remap[b], remap[c]) for a, b, c in triangles]


def segment(vertices: Sequence[Vec], triangles: Sequence[Tri], sharp_deg: float | None = None) -> list[list[int]]:
    """Parts as lists of triangle indices: connected over shared edges, split at sharp edges."""
    parent = list(range(len(triangles)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    normals = [_unit_normal(vertices[a], vertices[b], vertices[c]) for a, b, c in triangles]
    cos_limit = math.cos(math.radians(sharp_deg)) if sharp_deg is not None else -2.0
    edges: dict[tuple[int, int], list[int]] = {}
    for t, (a, b, c) in enumerate(triangles):
        for u, v in ((a, b), (b, c), (c, a)):
            edges.setdefault((min(u, v), max(u, v)), []).append(t)
    for faces in edges.values():
        for i in range(len(faces)):
            for j in range(i + 1, len(faces)):
                n1, n2 = normals[faces[i]], normals[faces[j]]
                if n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] >= cos_limit:
                    parent[find(faces[i])] = find(faces[j])
    groups: dict[int, list[int]] = {}
    for t in range(len(triangles)):
        groups.setdefault(find(t), []).append(t)
    return sorted(groups.values(), key=lambda g: (-len(g), g[0]))


def top_triangles(vertices: Sequence[Vec], triangles: Sequence[Tri], part: Iterable[int], k: int = 4) -> list[tuple[int, float]]:
    """Best ``k`` triangles of a part as (triangle index, quality), best first; ties by index."""
    scored = [(t, triangle_quality(*(vertices[i] for i in triangles[t]))) for t in part]
    # Rank on q rounded to 9 digits so last-bit float noise never reorders ties (same as meshMeta.ts).
    scored.sort(key=lambda x: (-round(x[1] * 1e9), x[0]))
    return scored[:k]


# ---------------------------------------------------------------- binary STL
def vertex_offset(triangle_index: int) -> int:
    """Byte offset of a triangle's 36-byte vertex block inside a binary STL."""
    return STL_HEADER + 4 + STL_STRIDE * triangle_index + 12


def write_stl(vertices: Sequence[Vec], triangles: Sequence[Tri], header: bytes = b"ChartUI mesh_meta") -> bytes:
    out = bytearray(header[:STL_HEADER].ljust(STL_HEADER, b"\0"))
    out += struct.pack("<I", len(triangles))
    for a, b, c in triangles:
        p, q, r = vertices[a], vertices[b], vertices[c]
        # "+ 0.0" turns −0.0 into +0.0, so Python and JS write the same bytes (the sign of zero
        # otherwise depends on the order of operations in each language).
        out += struct.pack("<3f", *(c + 0.0 for c in _unit_normal(p, q, r)))
        out += struct.pack("<9f", *(c + 0.0 for c in (*p, *q, *r)))
        out += b"\0\0"
    return bytes(out)


def read_stl(data: bytes) -> tuple[list[Vec], list[Tri]]:
    """Binary or ASCII STL → (vertices, triangles), unwelded."""
    vertices: list[Vec] = []
    if len(data) >= 84:
        count = struct.unpack_from("<I", data, 80)[0]
        if 84 + count * STL_STRIDE == len(data):
            for i in range(count):
                v = struct.unpack_from("<9f", data, vertex_offset(i))
                vertices += [v[0:3], v[3:6], v[6:9]]
            return vertices, [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(count)]
    for m in re.finditer(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", data):
        vertices.append((float(m[1]), float(m[2]), float(m[3])))
    return vertices, [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(vertices) // 3)]


# ---------------------------------------------------------------- emoji pointer format
def format_data(start: int, length: int = VERTEX_BLOCK) -> str:
    return f'[⏸️ (バイト): "0x{start:04X}", ▶️ (バイト): "{length}"]'


def parse_data(field: str) -> tuple[int, int]:
    """'[⏸️ (バイト): "0x00A1", ▶️ (バイト): "36"]' → (161, 36). Start may be hex or decimal."""
    m = DATA_RE.search(field)
    if not m:
        raise ValueError(f"not a byte pointer: {field!r}")
    return int(m[1], 0), int(m[2], 0)


def read_pointer(stl: bytes, field: str) -> list[Vec]:
    """Read the triangle a Data field points at, straight from the STL bytes."""
    start, length = parse_data(field)
    if length % 12 or start < 0 or start + length > len(stl):
        raise ValueError(f"pointer out of range or not whole vertices: start={start} length={length}")
    floats = struct.unpack_from(f"<{length // 4}f", stl, start)
    return [tuple(floats[i:i + 3]) for i in range(0, len(floats), 3)]  # type: ignore[misc]


def build_meshmeta(vertices: Sequence[Vec], triangles: Sequence[Tri], sharp_deg: float | None = 40.0) -> tuple[bytes, dict]:
    """Analyse a mesh and return (binary STL, .meshmeta dict) whose pointers address that STL."""
    welded_v, welded_t = weld(vertices, triangles)
    parts = segment(welded_v, welded_t, sharp_deg)
    stl = write_stl(welded_v, welded_t)
    meta: dict = {}
    for n, part in enumerate(parts, start=1):
        meta[f"MeshPart_{n:02d}"] = {
            "Top_Triangles": [
                {"Rank": f"No.{i + 1}", "Label": LABELS[i], "Quality": f"{q:.3f}", "Data": format_data(vertex_offset(t))}
                for i, (t, q) in enumerate(top_triangles(welded_v, welded_t, part))
            ]
        }
    return stl, meta


def canonical_bytes(stl: bytes, meta: dict) -> bytes:
    """The bytes that are signed: SHA-256 of the STL, then the meta (without Signature) as canonical JSON."""
    body = {k: v for k, v in meta.items() if k != "Signature"}
    return hashlib.sha256(stl).digest() + json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_meshmeta(stl: bytes, meta: dict, private_key) -> dict:
    """Return a copy of meta with an Ed25519 "Signature" (private_key: cryptography Ed25519PrivateKey)."""
    from cryptography.hazmat.primitives import serialization

    pub = private_key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    sig = private_key.sign(canonical_bytes(stl, meta))
    out = {k: v for k, v in meta.items() if k != "Signature"}
    out["Signature"] = {"Alg": "Ed25519", "STL_SHA256": hashlib.sha256(stl).hexdigest(), "PublicKey": pub.hex(), "Sig": sig.hex()}
    return out


def verify_meshmeta(stl: bytes, meta: dict, public_key_hex: str | None = None) -> bool:
    """True when the signature matches the STL and meta. Pass the expected public key to pin the signer."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    sig = meta.get("Signature")
    if not isinstance(sig, dict) or sig.get("Alg") != "Ed25519":
        return False
    if public_key_hex is not None and sig.get("PublicKey") != public_key_hex:
        return False
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(sig["PublicKey"])).verify(bytes.fromhex(sig["Sig"]), canonical_bytes(stl, meta))
    except (InvalidSignature, ValueError, KeyError):
        return False
    return True


def dumps_meshmeta(meta: dict) -> str:
    return json.dumps(meta, ensure_ascii=False, indent=2)


if __name__ == "__main__":  # python mesh_meta.py in.stl out  →  out.stl + out.meshmeta
    import sys

    if len(sys.argv) != 3:
        sys.exit("usage: python mesh_meta.py input.stl output_basename")
    with open(sys.argv[1], "rb") as f:
        v, t = read_stl(f.read())
    stl_bytes, meta_dict = build_meshmeta(v, t)
    with open(sys.argv[2] + ".stl", "wb") as f:
        f.write(stl_bytes)
    with open(sys.argv[2] + ".meshmeta", "w", encoding="utf-8") as f:
        f.write(dumps_meshmeta(meta_dict))
    print(f"{len(meta_dict)} parts → {sys.argv[2]}.stl / {sys.argv[2]}.meshmeta")
