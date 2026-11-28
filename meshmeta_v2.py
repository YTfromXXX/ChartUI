""".meshmeta v2: canonical JSON (RFC 8785), a Keccak-256 Merkle tree over the STL's triangles,
per-pointer Merkle proofs, and an array of signatures.

Spec: docs/meshmeta-v2.md. Mirror: lib/meshMetaV2.ts (checked against tests/fixtures/meshmeta_v2_tetra.json).

* Leaves: triangle i of the binary STL is the 50-byte record at 84 + 50·i. Its leaf is
  keccak256(keccak256(uint256(i) ‖ record)) — the index is inside the leaf, so a proof also proves
  the position, and the double hash is what OpenZeppelin recommends against second-preimage tricks.
* Nodes: keccak256(min(a, b) ‖ max(a, b)) (sorted pairs), so OpenZeppelin's MerkleProof.verify
  accepts the proofs unchanged. An odd node at the end of a level moves up as it is.
* Canonical bytes: every string NFC-normalised, then RFC 8785 (JCS). The schema only uses strings,
  integers, booleans, arrays and objects, so no floating-point formatting is ever needed.
* Signatures: each entry signs JCS(meta without "signatures"). Ed25519 now; "EIP-712" and post-
  quantum algorithms are reserved names for later entries.

Pure Python; Ed25519 needs the optional ``cryptography`` package.
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
from typing import Any, Sequence

import mesh_meta as mm

VERSION = "2.0"
EMOJI = {"start": "⏸️", "length": "▶️"}  # ⏸️ ▶️ — exact code points, compared as-is
RECORD = 50
HEADER = 84

# ---------------------------------------------------------------- Keccak-256 (Ethereum's, not NIST SHA3-256)
_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
    0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
    0x000000000000800A, 0x800000008000000A, 0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]
_ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
_M = (1 << 64) - 1


def _rol(x: int, n: int) -> int:
    return ((x << n) | (x >> (64 - n))) & _M if n else x


def _keccak_f(a: list[list[int]]) -> None:
    for rc in _RC:
        c = [a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        for x in range(5):
            for y in range(5):
                a[x][y] ^= d[x]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(a[x][y], _ROT[x][y])
        for x in range(5):
            for y in range(5):
                a[x][y] = b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y])
        a[0][0] ^= rc


def keccak256(data: bytes) -> bytes:
    rate = 136
    msg = bytearray(data) + b"\x01"
    msg += b"\x00" * ((-len(msg)) % rate)
    msg[-1] |= 0x80
    a = [[0] * 5 for _ in range(5)]
    for off in range(0, len(msg), rate):
        block = msg[off:off + rate]
        for i in range(rate // 8):
            a[i % 5][i // 5] ^= int.from_bytes(block[8 * i:8 * i + 8], "little")
        _keccak_f(a)
    out = b"".join(a[i % 5][i // 5].to_bytes(8, "little") for i in range(4))
    return out


# ---------------------------------------------------------------- RFC 8785 (JCS), with NFC strings
def _nfc(v: Any) -> Any:
    if isinstance(v, str):
        return unicodedata.normalize("NFC", v)
    if isinstance(v, list):
        return [_nfc(x) for x in v]
    if isinstance(v, dict):
        return {unicodedata.normalize("NFC", k): _nfc(x) for k, x in v.items()}
    return v


def _jcs(v: Any) -> str:
    if v is None or isinstance(v, bool):
        return json.dumps(v)
    if isinstance(v, int):
        if abs(v) > 2**53 - 1:
            raise ValueError("integers above 2^53 − 1 are not interoperable; use a string")
        return str(v)
    if isinstance(v, float):
        raise ValueError("v2 allows no floating-point numbers; write them as strings")
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        return "[" + ",".join(_jcs(x) for x in v) + "]"
    if isinstance(v, dict):
        keys = sorted(v, key=lambda k: k.encode("utf-16-be"))  # JCS sorts by UTF-16 code units
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + _jcs(v[k]) for k in keys) + "}"
    raise TypeError(f"not JSON: {type(v).__name__}")


def canonical(v: Any) -> bytes:
    return _jcs(_nfc(v)).encode("utf-8")


# ---------------------------------------------------------------- Merkle tree over triangle records
def leaf(index: int, record: bytes) -> bytes:
    if len(record) != RECORD:
        raise ValueError("a triangle record is 50 bytes")
    return keccak256(keccak256(index.to_bytes(32, "big") + record))


def _pair(a: bytes, b: bytes) -> bytes:
    return keccak256(a + b if a <= b else b + a)


def records(stl: bytes) -> list[bytes]:
    n = int.from_bytes(stl[80:84], "little")
    if HEADER + RECORD * n != len(stl):
        raise ValueError("v2 pointers address a binary STL; convert ASCII STL first")
    return [stl[HEADER + RECORD * i: HEADER + RECORD * (i + 1)] for i in range(n)]


def tree(stl: bytes) -> list[list[bytes]]:
    level = [leaf(i, r) for i, r in enumerate(records(stl))]
    if not level:
        raise ValueError("empty STL")
    levels = [level]
    while len(level) > 1:
        level = [_pair(level[i], level[i + 1]) if i + 1 < len(level) else level[i] for i in range(0, len(level), 2)]
        levels.append(level)
    return levels


def proof(levels: list[list[bytes]], index: int) -> list[bytes]:
    out: list[bytes] = []
    for level in levels[:-1]:
        sib = index ^ 1
        if sib < len(level):
            out.append(level[sib])
        index //= 2
    return out


def verify_proof(root: bytes, index: int, record: bytes, path: Sequence[bytes]) -> bool:
    h = leaf(index, record)
    for p in path:
        h = _pair(h, p)
    return h == root


# ---------------------------------------------------------------- build / sign / verify
def _hex(b: bytes) -> str:
    return "0x" + b.hex()


def build(vertices, triangles, sharp_deg: float | None = 40.0) -> tuple[bytes, dict]:
    """Analyse a mesh (as v1 does) and return (binary STL, v2 meta without signatures)."""
    stl, v1 = mm.build_meshmeta(vertices, triangles, sharp_deg)
    levels = tree(stl)
    pointers = []
    for part, body in v1.items():
        for t in body["Top_Triangles"]:
            vstart, vlen = mm.parse_data(t["Data"])
            index = (vstart - 12 - HEADER) // RECORD
            start = HEADER + RECORD * index
            pointers.append({
                "part": part, "rank": t["Rank"], "label": t["Label"], "quality": t["Quality"],
                "index": index, "start": start, "length": RECORD, "vertices": [vstart, vlen],
                "data": t["Data"], "proof": [_hex(p) for p in proof(levels, index)],
            })
    meta = {
        "version": VERSION, "emoji": {EMOJI["start"]: "start", EMOJI["length"]: "length"},
        "stl_sha256": hashlib.sha256(stl).hexdigest(), "triangles": len(levels[0]),
        "merkle": {"hash": "keccak256", "leaf": "keccak256(keccak256(uint256 index ++ record50))", "node": "sorted-pair", "root": _hex(levels[-1][0])},
        "pointers": pointers, "signatures": [],
    }
    return stl, meta


def signing_bytes(meta: dict) -> bytes:
    return canonical({k: v for k, v in meta.items() if k != "signatures"})


def sign_ed25519(meta: dict, private_key) -> dict:
    from cryptography.hazmat.primitives import serialization

    pub = private_key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    entry = {"alg": "Ed25519", "signer": pub.hex(), "sig": private_key.sign(signing_bytes(meta)).hex()}
    return {**meta, "signatures": [*meta.get("signatures", []), entry]}


def verify(stl: bytes, meta: dict, trusted: Sequence[str] | None = None) -> dict:
    """Check everything: STL hash, Merkle root, every pointer's proof, and each signature we can check."""
    report: dict = {"stl_sha256": hashlib.sha256(stl).hexdigest() == meta.get("stl_sha256")}
    try:
        levels = tree(stl)
        root_ok = _hex(levels[-1][0]) == meta["merkle"]["root"]
    except (ValueError, KeyError):
        levels, root_ok = None, False
    report["merkle_root"] = root_ok
    recs = records(stl) if levels else []
    root = bytes.fromhex(meta["merkle"]["root"][2:]) if root_ok else b""
    report["pointers"] = [
        bool(root_ok) and p["start"] == HEADER + RECORD * p["index"] and p["length"] == RECORD
        and verify_proof(root, p["index"], recs[p["index"]], [bytes.fromhex(x[2:]) for x in p["proof"]])
        for p in meta.get("pointers", [])
    ]
    sigs = []
    for s in meta.get("signatures", []):
        if s.get("alg") != "Ed25519":
            sigs.append(None)  # reserved algorithms (EIP-712, ML-DSA …) are not checked here yet
            continue
        if trusted is not None and s.get("signer") not in trusted:
            sigs.append(False)
            continue
        try:
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

            Ed25519PublicKey.from_public_bytes(bytes.fromhex(s["signer"])).verify(bytes.fromhex(s["sig"]), signing_bytes(meta))
            sigs.append(True)
        except (InvalidSignature, ValueError, KeyError):
            sigs.append(False)
    report["signatures"] = sigs
    report["ok"] = report["stl_sha256"] and root_ok and all(report["pointers"]) and (not sigs or any(x is True for x in sigs)) and not any(x is False for x in sigs)
    return report


def dumps(meta: dict) -> str:
    return json.dumps(_nfc(meta), ensure_ascii=False, indent=2)
