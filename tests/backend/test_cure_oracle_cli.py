import json
import pathlib

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


# ── TestBenchmarkCLI ──────────────────────────────────────────────────────────

class TestBenchmarkCLI:
    def test_benchmark_local_exits_zero_or_two(self, tmp_path, capsys):
        rc = main(["benchmark", "--shape", "LINE", "--n-qubits", "4",
                   "--theta-disp", "√.414", "--shots", "512",
                   "--mode", "local", "--out-dir", str(tmp_path)])
        assert rc in (0, 2)

    def test_benchmark_local_prints_json(self, tmp_path, capsys):
        main(["benchmark", "--shape", "LINE", "--shots", "512",
              "--mode", "local", "--out-dir", str(tmp_path)])
        out = capsys.readouterr().out
        # first non-empty line of output starts the JSON object
        json_lines = [l for l in out.splitlines() if l.strip().startswith("{")]
        assert json_lines, "no JSON object in output"

    def test_benchmark_writes_json_file(self, tmp_path, capsys):
        main(["benchmark", "--shape", "LINE", "--shots", "512",
              "--mode", "local", "--out-dir", str(tmp_path)])
        files = list(tmp_path.glob("benchmark-LINE-*.json"))
        assert len(files) == 1
        import json as _json
        data = _json.loads(files[0].read_text(encoding="utf-8"))
        assert data["shape"] == "LINE"
        assert data["backend"] == "aer_simulator"
        assert "delta" in data
        assert "passed" in data
        assert data["job_id"] is None
        assert data["qpu_seconds"] is None

    def test_benchmark_json_has_required_keys(self, tmp_path, capsys):
        main(["benchmark", "--shape", "TREE", "--shots", "256",
              "--mode", "local", "--out-dir", str(tmp_path)])
        import json as _json
        files = list(tmp_path.glob("benchmark-TREE-*.json"))
        data = _json.loads(files[0].read_text(encoding="utf-8"))
        for key in ("shape", "circuit_family", "n_qubits", "theta_disp",
                    "shots", "backend", "circuit_hash", "delta",
                    "eps_threshold", "passed", "sig_code", "job_id", "qpu_seconds"):
            assert key in data, f"missing key: {key}"

    def test_benchmark_circuit_hash_format(self, tmp_path, capsys):
        main(["benchmark", "--shape", "CUBE", "--shots", "256",
              "--mode", "local", "--out-dir", str(tmp_path)])
        import json as _json
        files = list(tmp_path.glob("benchmark-CUBE-*.json"))
        data = _json.loads(files[0].read_text(encoding="utf-8"))
        assert data["circuit_hash"].startswith("0x")
        assert len(data["circuit_hash"]) == 66

    def test_benchmark_prints_pass_or_fail_line(self, tmp_path, capsys):
        main(["benchmark", "--shape", "LINE", "--shots", "131072",
              "--theta-disp", "√.414", "--mode", "local", "--out-dir", str(tmp_path)])
        out = capsys.readouterr().out
        assert ("SIG PASSED" in out) or ("not passed" in out)

    def test_benchmark_default_shape_is_line(self, tmp_path, capsys):
        main(["benchmark", "--shots", "256", "--out-dir", str(tmp_path)])
        import json as _json
        files = list(tmp_path.glob("benchmark-LINE-*.json"))
        assert len(files) == 1

    def test_benchmark_default_out_dir_is_cwd(self, tmp_path, capsys, monkeypatch):
        monkeypatch.chdir(tmp_path)
        main(["benchmark", "--shots", "256"])
        files = list(tmp_path.glob("benchmark-LINE-*.json"))
        assert len(files) == 1
