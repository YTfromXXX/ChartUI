"""Tests for cure_oracle/quantum_sim.py and Phase K endpoint.

Phase K: cure-{era}-r3 — Gemini-Candy ⟷ Sonnet-Score auto-fusion loop.

Coverage
--------
  TestQuantumSimModule   — run_quantum_sim() unit-level (offline mode, Qiskit mocked)
  TestQuantumSimEndpoint — POST /candy/quantum-sim (FastAPI TestClient)
"""

from __future__ import annotations

import json
import uuid
import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from cure_oracle.quantum_sim import CURRENT_REV, run_quantum_sim
from cure_oracle.accelerator import AcceleratorRun, AcceleratorResult, SynthesizedResult

# ── auth fixture ──────────────────────────────────────────────────────────────

_TEST_TOKEN = "phk-test-token"


@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch):
    monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_TOKEN: "operator"}))


def _headers():
    return {"Authorization": f"Bearer {_TEST_TOKEN}"}


# ── mock AcceleratorResult factory ────────────────────────────────────────────

def _fake_run(shape="LINE") -> AcceleratorRun:
    return AcceleratorRun(
        shape=shape, q=0.85, slot="S1", delta=0.15,
        passed=True, sig_code="RING-φ.618-ε.001",
        backend="fake/statevector", shots=512,
        theta_disp="φ.618", circuit_hash="abc123",
    )


def _fake_acc_result(shapes=None) -> AcceleratorResult:
    shapes = shapes or ["LINE"]
    runs = [_fake_run(s) for s in shapes]
    synth = SynthesizedResult(
        slots={"S1": runs[0]},
        mente_total=0.57,
        mente_achieved=False,
        four_kings=False,
        missing_slots=["S2", "S3", "S4"],
    )
    return AcceleratorResult(
        runs=runs,
        synthesized=synth,
        observe_receipt={"merkle": {"root": "deadbeef"}},
        run_id=str(uuid.uuid4()),
        born_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )


def _fake_round_circuit(*args, **kwargs) -> dict:
    return {
        "round": kwargs.get("round_num", args[0] if args else 1),
        "mode": "local",
        "backend": "statevector",
        "when": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "qpu_seconds": None,
        "size": {"qubits": 13, "depth": 2},
        "guide_bits": [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        "active_guides_a": ["スハル-A0", "スハル-A2", "スハル-A4"],
        "active_guides_b": ["リナリス-B1", "リナリス-B3"],
        "teleport_angle_a": 180.0,
        "teleport_angle_b": 180.0,
        "events": {"entanglement_shot": False, "superposition_dash": True, "luna_event": False},
        "counts": {"0000000000000": 128},
    }


@pytest.fixture(autouse=True)
def _mock_qiskit(monkeypatch):
    """Patch all Qiskit-dependent functions so no Qiskit install is required."""
    from cure_oracle.accelerator import VirtualAccelerator

    monkeypatch.setattr(VirtualAccelerator, "run",
                        lambda self, shapes, **kw: _fake_acc_result(shapes))
    # round_circuit is lazy-imported inside gemini_candy methods, so patch the source
    import cure_oracle.round_circuit as _rc
    monkeypatch.setattr(_rc, "round_circuit", _fake_round_circuit)
    monkeypatch.setattr(_rc, "spiral_preview", lambda result: "[fake spiral]")


@pytest.fixture()
def client():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    from cure_oracle.security import SecurityAuditMiddleware
    app = FastAPI()
    app.add_middleware(SecurityAuditMiddleware)
    app.include_router(router)
    return TestClient(app, raise_server_exceptions=True)


# ── TestQuantumSimModule ──────────────────────────────────────────────────────

class TestQuantumSimModule:
    def test_returns_quantum_sim_result(self):
        result = run_quantum_sim(["LINE"], offline=True)
        assert result.sim_id
        assert result.born_at

    def test_version_contains_rev3(self):
        result = run_quantum_sim(["LINE"], offline=True)
        assert f"r{CURRENT_REV}" in result.version

    def test_era_in_valid_set(self):
        from cure_oracle.mesh_score import VALID_ERAS
        result = run_quantum_sim(["CUBE"], offline=True)
        assert result.era in VALID_ERAS

    def test_fused_shapes_non_empty(self):
        result = run_quantum_sim(["RING"], offline=True)
        assert len(result.fused_shapes) >= 1

    def test_input_shapes_preserved(self):
        result = run_quantum_sim(["STAR", "CUBE"], offline=True)
        assert result.input_shapes == ["STAR", "CUBE"]

    def test_gemini_recommendation_present(self):
        result = run_quantum_sim(["LINE"], offline=True)
        assert result.gemini.recommendation.suggested_shapes

    def test_score_has_events(self):
        result = run_quantum_sim(["CUBE", "RING"], offline=True)
        assert isinstance(result.score.events, list)

    def test_fusion_note_non_empty(self):
        result = run_quantum_sim(["LINE"], offline=True)
        assert len(result.fusion_note) > 0

    def test_mente_total_float(self):
        result = run_quantum_sim(["LINE"], offline=True)
        assert isinstance(result.mente_total, float)

    def test_offline_model_is_stub(self):
        result = run_quantum_sim(["LINE"], offline=True)
        assert result.gemini.recommendation.model_used == "offline-stub"

    def test_multiple_shapes(self):
        result = run_quantum_sim(["CUBE", "RING", "TREE"], offline=True)
        assert result.sim_id
        assert result.score.bpm > 0

    def test_bars_parameter(self):
        result = run_quantum_sim(["LINE"], bars=8, offline=True)
        assert result.score.bars == 8


# ── TestQuantumSimEndpoint ────────────────────────────────────────────────────

class TestQuantumSimEndpoint:
    def _body(self, shapes=None, offline=True, **kw):
        body = {"shapes": shapes or ["LINE"], "offline": offline}
        body.update(kw)
        return body

    def test_returns_200(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert r.status_code == 200

    def test_response_has_sim_id(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert "sim_id" in r.json()

    def test_response_version_r3(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert f"r{CURRENT_REV}" in r.json()["version"]

    def test_response_has_gemini_layer(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert "gemini" in r.json()
        assert "suggested_shapes" in r.json()["gemini"]

    def test_response_has_score_layer(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert "score" in r.json()
        assert "events" in r.json()["score"]

    def test_fused_shapes_in_response(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(shapes=["CUBE"]), headers=_headers())
        data = r.json()
        assert "fused_shapes" in data
        assert len(data["fused_shapes"]) >= 1

    def test_input_shapes_preserved(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(shapes=["STAR", "RING"]), headers=_headers())
        assert r.json()["input_shapes"] == ["STAR", "RING"]

    def test_fusion_note_present(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert r.json()["fusion_note"]

    def test_observe_receipt_present(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert "observe_receipt" in r.json()

    def test_unauthenticated_4xx(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim", json=self._body())
        assert r.status_code in (401, 403)

    def test_invalid_shape_422(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(shapes=["INVALID"]), headers=_headers())
        assert r.status_code == 422

    def test_ibm_mode_rejected(self, client):
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(mode="ibm"), headers=_headers())
        assert r.status_code == 422

    def test_bmi_state_accepted(self, client):
        body = self._body()
        body["bmi_state"] = {"focus": 0.8, "calm": 0.3, "energy": 0.9}
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=body, headers=_headers())
        assert r.status_code == 200

    def test_era_field_valid(self, client):
        from cure_oracle.mesh_score import VALID_ERAS
        r = client.post("/api/v1/qpu/candy/quantum-sim",
                        json=self._body(), headers=_headers())
        assert r.json()["era"] in VALID_ERAS

    def test_version_endpoint_has_quantum_sim(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version")
        assert "quantum_sim" in r.json()["endpoint_map"]
