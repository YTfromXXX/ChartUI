"""Tests for cure_oracle/qpu_router.py — /api/v1/qpu/* endpoints."""

import os
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from cure_oracle.qpu_router import router
from cure_oracle.benchmark import (
    CONFIRM,
    CAMPAIGN_SHAPES,
    SHAPE_CIRCUIT_MAP,
    BenchmarkResult,
)

# ── auth helpers ──────────────────────────────────────────────────────────────
# Set test tokens before building the TestClient so RBAC dependency sees them.
_TEST_OPERATOR_TOKEN = "test-operator-token-for-ci"
_TEST_ADMIN_TOKEN    = "test-qpu-admin-token-for-ci"
# Unconditionally set so admin token is present even when another test file ran first.
os.environ["CURE_API_TOKENS"] = (
    f'{{"{_TEST_OPERATOR_TOKEN}":"operator","{_TEST_ADMIN_TOKEN}":"qpu_admin"}}'
)

_OPERATOR_HEADERS = {"Authorization": f"Bearer {_TEST_OPERATOR_TOKEN}"}
_ADMIN_HEADERS    = {"Authorization": f"Bearer {_TEST_ADMIN_TOKEN}"}

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_result(**overrides) -> BenchmarkResult:
    defaults = dict(
        shape="LINE", circuit_family="ghz", n_qubits=4,
        theta_disp="√.414", shots=512,
        circuit_hash="0x" + "a" * 64,
        counts={"0000": 256, "1111": 256},
        ideal={"0000": 0.5, "1111": 0.5},
        delta=0.002, eps_threshold=0.01,
        passed=True, sig_code="LINE-√.414-ε.010",
        qasm="OPENQASM 2.0;", backend="aer_simulator",
        job_id=None, qpu_seconds=None,
    )
    defaults.update(overrides)
    return BenchmarkResult(**defaults)


# ── GET /api/v1/qpu/benchmark/shapes ─────────────────────────────────────────

class TestShapesEndpoint:
    def test_returns_200(self):
        r = client.get("/api/v1/qpu/benchmark/shapes", headers=_OPERATOR_HEADERS)
        assert r.status_code == 200

    def test_returns_five_shapes(self):
        r = client.get("/api/v1/qpu/benchmark/shapes", headers=_OPERATOR_HEADERS)
        assert len(r.json()) == 5

    def test_all_shapes_present(self):
        r = client.get("/api/v1/qpu/benchmark/shapes", headers=_OPERATOR_HEADERS)
        shapes = {item["shape"] for item in r.json()}
        assert shapes == set(SHAPE_CIRCUIT_MAP.keys())

    def test_response_has_required_fields(self):
        r = client.get("/api/v1/qpu/benchmark/shapes", headers=_OPERATOR_HEADERS)
        for item in r.json():
            assert "shape" in item
            assert "circuit_family" in item
            assert "theta_disp" in item
            assert "eps_code" in item

    def test_circuit_family_matches_map(self):
        r = client.get("/api/v1/qpu/benchmark/shapes", headers=_OPERATOR_HEADERS)
        for item in r.json():
            assert item["circuit_family"] == SHAPE_CIRCUIT_MAP[item["shape"]]

    def test_eps_code_format(self):
        r = client.get("/api/v1/qpu/benchmark/shapes", headers=_OPERATOR_HEADERS)
        for item in r.json():
            assert item["eps_code"].startswith("ε.")


# ── POST /api/v1/qpu/benchmark ────────────────────────────────────────────────
# run_benchmark is mocked — the real logic is covered by test_benchmark.py;
# here we test routing, serialisation, and error-handling only.

class TestBenchmarkEndpoint:
    def test_local_mode_returns_200(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result()) as mock_rb:
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "n_qubits": 4, "theta_disp": "√.414",
                "shots": 512, "mode": "local",
            })
        assert r.status_code == 200

    def test_response_has_required_fields(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result()):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "local",
            })
        data = r.json()
        for key in ("shape", "circuit_family", "n_qubits", "theta_disp",
                    "shots", "backend", "circuit_hash", "delta",
                    "eps_threshold", "passed", "sig_code", "job_id",
                    "qpu_seconds", "sig"):
            assert key in data, f"missing key: {key}"

    def test_local_mode_backend_stored(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(backend="aer_simulator")):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "local",
            })
        assert r.json()["backend"] == "aer_simulator"

    def test_local_mode_job_id_null(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(job_id=None, qpu_seconds=None)):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "local",
            })
        data = r.json()
        assert data["job_id"] is None
        assert data["qpu_seconds"] is None

    def test_circuit_hash_forwarded(self):
        h = "0x" + "b" * 64
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(circuit_hash=h)):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "CUBE", "shots": 256, "mode": "local",
            })
        assert r.json()["circuit_hash"] == h

    def test_passed_true_gives_sig(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(passed=True,
                                             sig_code="LINE-√.414-ε.010")):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "theta_disp": "√.414", "shots": 512, "mode": "local",
            })
        data = r.json()
        assert data["passed"] is True
        assert data["sig"] is not None
        assert data["sig"].startswith("LINE-")

    def test_failed_gives_sig_null(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(passed=False, sig_code="",
                                             delta=0.5)):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "STAR", "shots": 1, "mode": "local",
            })
        assert r.json()["sig"] is None

    def test_delta_forwarded(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(delta=0.123456)):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "local",
            })
        assert abs(r.json()["delta"] - 0.123456) < 1e-5

    @pytest.mark.parametrize("shape", ["CUBE", "RING", "TREE", "LINE", "STAR"])
    def test_all_shapes_accepted(self, shape):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=_make_result(shape=shape,
                                             circuit_family=SHAPE_CIRCUIT_MAP[shape])):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": shape, "shots": 256, "mode": "local",
            })
        assert r.status_code == 200
        assert r.json()["shape"] == shape

    def test_run_benchmark_called_with_correct_args(self):
        mock_result = _make_result()
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=mock_result) as mock_rb:
            client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "TREE", "n_qubits": 4, "theta_disp": "π.785",
                "shots": 1024, "mode": "local",
            })
        mock_rb.assert_called_once()
        call_kwargs = mock_rb.call_args[1] if mock_rb.call_args[1] else {}
        call_args   = mock_rb.call_args[0] if mock_rb.call_args[0] else {}
        # shape is first positional or keyword
        passed = dict(zip(("shape", "n_qubits", "theta_disp", "shots", "mode"),
                          call_args))
        passed.update(call_kwargs)
        assert passed.get("shape") == "TREE"
        assert passed.get("shots") == 1024

    def test_ibm_mode_passes_env_vars(self, monkeypatch):
        monkeypatch.setenv("IBM_QUANTUM_TOKEN", "tok123")
        monkeypatch.setenv("IBM_QUANTUM_INSTANCE", "crn:instance")
        mock_result = _make_result(backend="ibm_torino", job_id="job-abc",
                                   qpu_seconds=1.5)
        with patch("cure_oracle.qpu_router.run_benchmark",
                   return_value=mock_result) as mock_rb:
            r = client.post("/api/v1/qpu/benchmark", headers=_ADMIN_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "ibm",
                "confirm": CONFIRM,
            })
        assert r.status_code == 200
        kw = mock_rb.call_args[1] if mock_rb.call_args[1] else {}
        args = dict(zip(
            ("shape", "n_qubits", "theta_disp", "shots", "mode"),
            mock_rb.call_args[0]))
        args.update(kw)
        assert args.get("token") == "tok123"
        assert args.get("instance") == "crn:instance"
        assert args.get("confirm") == CONFIRM


# ── validation errors ─────────────────────────────────────────────────────────

class TestBenchmarkValidation:
    def test_unknown_shape_returns_422(self):
        r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
            "shape": "BLOB", "shots": 256, "mode": "local",
        })
        assert r.status_code == 422

    def test_unknown_theta_disp_returns_422(self):
        r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
            "shape": "LINE", "theta_disp": "ψ.999", "shots": 256, "mode": "local",
        })
        assert r.status_code == 422

    def test_unknown_mode_returns_422(self):
        r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
            "shape": "LINE", "shots": 256, "mode": "quantum",
        })
        assert r.status_code == 422

    def test_ibm_mode_without_token_returns_503(self, monkeypatch):
        monkeypatch.delenv("IBM_QUANTUM_TOKEN", raising=False)
        monkeypatch.delenv("IBM_QUANTUM_INSTANCE", raising=False)
        r = client.post("/api/v1/qpu/benchmark", headers=_ADMIN_HEADERS, json={
            "shape": "LINE", "shots": 256, "mode": "ibm", "confirm": CONFIRM,
        })
        assert r.status_code == 503
        assert "IBM_QUANTUM_TOKEN" in r.json()["detail"]

    def test_ibm_mode_without_instance_returns_503(self, monkeypatch):
        monkeypatch.setenv("IBM_QUANTUM_TOKEN", "dummy-token")
        monkeypatch.delenv("IBM_QUANTUM_INSTANCE", raising=False)
        r = client.post("/api/v1/qpu/benchmark", headers=_ADMIN_HEADERS, json={
            "shape": "LINE", "shots": 256, "mode": "ibm", "confirm": CONFIRM,
        })
        assert r.status_code == 503
        assert "IBM_QUANTUM_INSTANCE" in r.json()["detail"]

    def test_ibm_mode_wrong_confirm_returns_403(self, monkeypatch):
        monkeypatch.setenv("IBM_QUANTUM_TOKEN", "dummy-token")
        monkeypatch.setenv("IBM_QUANTUM_INSTANCE", "dummy-instance")
        with patch("cure_oracle.qpu_router.run_benchmark",
                   side_effect=PermissionError(
                       f'a real-QPU run requires confirm="{CONFIRM}"')):
            r = client.post("/api/v1/qpu/benchmark", headers=_ADMIN_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "ibm", "confirm": "wrong",
            })
        assert r.status_code == 403
        assert "RUN ON QPU" in r.json()["detail"]

    def test_n_qubits_too_low_returns_422(self):
        r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
            "shape": "LINE", "n_qubits": 1, "shots": 256, "mode": "local",
        })
        assert r.status_code == 422

    def test_n_qubits_too_high_returns_422(self):
        r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
            "shape": "LINE", "n_qubits": 9, "shots": 256, "mode": "local",
        })
        assert r.status_code == 422

    def test_value_error_from_benchmark_returns_422(self):
        with patch("cure_oracle.qpu_router.run_benchmark",
                   side_effect=ValueError("unknown shape")):
            r = client.post("/api/v1/qpu/benchmark", headers=_OPERATOR_HEADERS, json={
                "shape": "LINE", "shots": 256, "mode": "local",
            })
        assert r.status_code == 422
