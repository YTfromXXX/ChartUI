import json

import pytest

import mesh_meta as mm
from cure_oracle import __version__
from cure_oracle.cli import main


def test_version(capsys):
    assert main(["version"]) == 0
    assert capsys.readouterr().out.strip() == __version__


def test_meshmeta_sign_and_verify(tmp_path, capsys):
    serialization = pytest.importorskip("cryptography.hazmat.primitives.serialization")
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    key = Ed25519PrivateKey.generate()
    (tmp_path / "k.pem").write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    v = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]
    (tmp_path / "in.stl").write_bytes(mm.write_stl(v, [(0, 1, 2), (0, 3, 1), (0, 2, 3), (1, 3, 2)]))
    out = str(tmp_path / "out")
    assert main(["meshmeta", str(tmp_path / "in.stl"), out, "--key", str(tmp_path / "k.pem")]) == 0
    assert main(["verify", out + ".stl", out + ".meshmeta"]) == 0
    meta = json.loads((tmp_path / "out.meshmeta").read_text(encoding="utf-8"))
    meta["MeshPart_01"]["Top_Triangles"][0]["Quality"] = "0.000"
    (tmp_path / "bad.meshmeta").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    assert main(["verify", out + ".stl", str(tmp_path / "bad.meshmeta")]) == 1
    assert "INVALID" in capsys.readouterr().out
