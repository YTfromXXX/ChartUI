"""Regenerate tests/fixtures/meshmeta_v2_tetra.json (python tests/fixtures/make_meshmeta_v2.py).

A tetrahedron plus a square pyramid: 10 triangles, so the Merkle tree has odd levels (10 → 5 → 3
→ 2 → 1). Signed with a fixed test key (bytes 0..31) — never use it for anything real.
"""

import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
import meshmeta_v2 as m2  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

V = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1), (4, 0, 0), (6, 0, 0), (6, 0, 2), (4, 0, 2), (5, 2, 1)]
T = [(0, 1, 2), (0, 3, 1), (0, 2, 3), (1, 3, 2), (4, 5, 8), (5, 6, 8), (6, 7, 8), (7, 4, 8), (4, 6, 5), (4, 7, 6)]
JCS_CASE = {"b": 1, "a": "⏸️", "é": "é", "\U0001f600": "smile", "": "private use", "list": [True, None, -3, "▶️"]}

if __name__ == "__main__":
    stl, meta = m2.build(V, T)
    meta = m2.sign_ed25519(meta, Ed25519PrivateKey.from_private_bytes(bytes(range(32))))
    out = {
        "vertices": V, "triangles": T, "stl_hex": stl.hex(), "meta": meta,
        "signing_sha256": hashlib.sha256(m2.signing_bytes(meta)).hexdigest(),
        "jcs_case": JCS_CASE, "jcs_expected": m2.canonical(JCS_CASE).decode("utf-8"),
    }
    path = pathlib.Path(__file__).with_name("meshmeta_v2_tetra.json")
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(path, meta["merkle"]["root"], len(meta["pointers"]), "pointers")
