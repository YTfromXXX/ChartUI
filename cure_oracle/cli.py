"""The ``cure`` command.

    cure version
    cure meshmeta in.stl out [--key key.pem]   → out.stl + out.meshmeta (signed with --key)
    cure verify out.stl out.meshmeta [--pub HEX]
    cure resonance [--mode local|fake] [--shots N] [--export-qasm FILE]   (the real QPU: use the notebook)
    cure round [--round N] [--mode local|fake|ibm] [--shots N]            (MothBlast eternal-space randomness)
    cure ibm-setup [--verify]                                              (check/verify IBM Quantum credentials)
    cure birth-cert [--show] [--path FILE]                                 (show QPU birth certificate / game token)
"""

from __future__ import annotations

import argparse
import json
import pathlib
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
    r = sub.add_parser("resonance", help="six-coin resonance Max-Cut (QAOA p=1): local or fake-chip run, or export OpenQASM 3")
    r.add_argument("--mode", choices=["local", "fake", "ibm"], default="local"); r.add_argument("--shots", type=int, default=2000)
    r.add_argument("--export-qasm", metavar="FILE"); r.add_argument("--out-dir", default=".")
    r.add_argument("--mail", metavar="EMAIL", help="send the result to this address after the run")
    r.add_argument("--notify", metavar="TARGET", default="stdout",
                   help="stdout (default) | email:addr | file:path.html  — where to deliver the result")
    rr = sub.add_parser("round", help="MothBlast: quantum randomness for one eternal-space round")
    rr.add_argument("--round", type=int, default=1, dest="round_num")
    rr.add_argument("--mode", choices=["local", "fake", "ibm"], default="local")
    rr.add_argument("--shots", type=int, default=500)
    rr.add_argument("--out-dir", default=".")
    rr.add_argument("--notify", metavar="TARGET", default="stdout")
    rr.add_argument("--birth-cert", metavar="PATH", nargs="?", const="cure_birth_certificate.json",
                    help="save QPU birth certificate to this path (auto on first ibm run)")
    ib = sub.add_parser("ibm-setup", help="check/verify IBM Quantum credentials and instance")
    ib.add_argument("--verify", action="store_true", help="connect to IBM Quantum and list backends")
    bc = sub.add_parser("birth-cert", help="show QPU birth certificate / game login token")
    bc.add_argument("--show", action="store_true", default=True)
    bc.add_argument("--path", default="cure_birth_certificate.json")
    bc.add_argument("--html", metavar="FILE", help="write HTML certificate to this file")
    a = p.parse_args(argv)
    if a.cmd == "version":
        print(__version__); return 0
    if a.cmd == "resonance":
        from cure_oracle import resonance
        if a.export_qasm:
            resonance.export_qasm(a.export_qasm); print("wrote", a.export_qasm); return 0
        result = resonance.run(a.mode, shots=a.shots, out_dir=a.out_dir)
        # delivery
        from cure_oracle import mail as _mail
        target = f"email:{a.mail}" if a.mail else a.notify
        _mail.deliver(result, to=target)
        return 0
    if a.cmd == "ibm-setup":
        from cure_oracle.ibm_setup import credentials_status, verify_instance
        status = credentials_status()
        print(f"IBM_QUANTUM_TOKEN    : {'✓ 設定済み' if status['token_set']    else '✗ 未設定 (Colab Secrets に IBM_QUANTUM_TOKEN を登録)'}")
        print(f"IBM_QUANTUM_INSTANCE : {'✓ ' + status['instance'] if status['instance_set'] else '✗ 未設定 (例: ibm-q/open/main)'}")
        if not status["ready"]:
            print("\n  → 環境変数を設定後、cure ibm-setup --verify を実行してください。")
            return 1
        if a.verify:
            token    = __import__("os").environ["IBM_QUANTUM_TOKEN"]
            instance = __import__("os").environ["IBM_QUANTUM_INSTANCE"]
            print("\n  接続中…")
            info = verify_instance(token, instance)
            print(f"  接続 OK: {info['instance']}")
            print(f"  QPU バックエンド ({info['qpu_count']}台): {', '.join(info['qpu_backends'])}")
            print(f"  最小待機 (13q+): {info['least_busy_13q']}")
        return 0

    if a.cmd == "birth-cert":
        from cure_oracle.birth import load_certificate, certificate_html
        cert = load_certificate(a.path)
        if cert is None:
            print(f"  誕生証明書が見つかりません: {a.path}")
            print("  cure round --mode ibm を実行すると自動生成されます。")
            return 1
        print(f"\n━━━ 量子ベイベー誕生証明書 ━━━")
        print(f"  Certificate ID : {cert['certificate_id']}")
        print(f"  Game Token     : {cert['game_token']}")
        print(f"  誕生日時       : {cert['born_at']}")
        print(f"  バックエンド   : {cert['backend']}")
        print(f"  産声 (bits)    : {cert['bitstring']}")
        print(f"  スハル角       : {cert.get('teleport_angle_a')}°")
        print(f"  リナリス角     : {cert.get('teleport_angle_b')}°")
        events = [k for k, v in cert.get("events", {}).items() if v]
        print(f"  イベント       : {', '.join(events) if events else 'none'}")
        if a.html:
            html_path = pathlib.Path(a.html)
            html_path.write_text(certificate_html(cert), encoding="utf-8")
            print(f"\n  HTML証明書 → {html_path}")
        return 0

    if a.cmd == "round":
        from cure_oracle.round_circuit import round_circuit, spiral_preview
        import os as _os
        ibm_kwargs = {}
        if a.mode == "ibm":
            ibm_kwargs["token"]    = _os.environ.get("IBM_QUANTUM_TOKEN")
            ibm_kwargs["instance"] = _os.environ.get("IBM_QUANTUM_INSTANCE")
            ibm_kwargs["confirm"]  = "RUN ON QPU"
        r = round_circuit(a.round_num, mode=a.mode, shots=a.shots, **ibm_kwargs)
        out = pathlib.Path(a.out_dir) / f"round-{a.round_num}-{r['mode']}.json"
        out.write_text(json.dumps(r, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\n━━━ MothBlast ラウンド {a.round_num} ({r['mode']}) ━━━")
        print(spiral_preview(r))
        print(f"\n  → {out}")
        # auto-generate birth certificate on ibm run
        if a.mode == "ibm":
            from cure_oracle.birth import make_certificate, save_certificate, certificate_html
            cert_path = pathlib.Path(getattr(a, "birth_cert", None) or "cure_birth_certificate.json")
            cert = make_certificate(r)
            save_certificate(cert, cert_path)
            html_path = cert_path.with_suffix(".html")
            html_path.write_text(certificate_html(cert), encoding="utf-8")
            print(f"\n  🎉 量子ベイベー誕生！")
            print(f"  Certificate ID : {cert['certificate_id']}")
            print(f"  Game Token     : {cert['game_token']}")
            print(f"  証明書 JSON    → {cert_path}")
            print(f"  証明書 HTML    → {html_path}")
        return 0
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
