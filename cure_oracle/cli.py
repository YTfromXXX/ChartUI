"""The ``cure`` command.

    cure version
    cure meshmeta in.stl out [--key key.pem]   → out.stl + out.meshmeta (signed with --key)
    cure verify out.stl out.meshmeta [--pub HEX]
"""

from __future__ import annotations

import argparse
import json
import sys

from cure_oracle import __version__


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="cure", description="ChartUI / METADOGG ORACLE core tools")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("version")
    m = sub.add_parser("meshmeta", help="segment an STL and write .stl + .meshmeta")
    m.add_argument("stl"); m.add_argument("out"); m.add_argument("--key", help="Ed25519 private key (PEM) to sign with")
    v = sub.add_parser("verify", help="check a signed .meshmeta against its STL")
    v.add_argument("stl"); v.add_argument("meshmeta"); v.add_argument("--pub", help="expected public key (hex)")
    a = p.parse_args(argv)
    if a.cmd == "version":
        print(__version__); return 0
    import mesh_meta as mm
    if a.cmd == "meshmeta":
        with open(a.stl, "rb") as f:
            vs, ts = mm.read_stl(f.read())
        stl, meta = mm.build_meshmeta(vs, ts)
        if a.key:
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
            with open(a.key, "rb") as f:
                meta = mm.sign_meshmeta(stl, meta, load_pem_private_key(f.read(), password=None))
        with open(a.out + ".stl", "wb") as f:
            f.write(stl)
        with open(a.out + ".meshmeta", "w", encoding="utf-8") as f:
            f.write(mm.dumps_meshmeta(meta))
        print(f"{sum(k.startswith('MeshPart_') for k in meta)} parts → {a.out}.stl / {a.out}.meshmeta" + (" (signed)" if a.key else ""))
        return 0
    with open(a.stl, "rb") as f:
        stl = f.read()
    with open(a.meshmeta, encoding="utf-8") as f:
        meta = json.load(f)
    ok = mm.verify_meshmeta(stl, meta, a.pub)
    print("OK" if ok else "INVALID"); return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
