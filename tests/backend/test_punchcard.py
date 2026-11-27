"""tests/backend/test_punchcard.py — Phase P: Punchcard Engine tests.

cure-{era}-r8 — 24 tests in 2 classes:
  TestPunchcardModule    (16 tests) — unit tests for punchcard.py
  TestPunchcardEndpoint   (8 tests) — FastAPI GET /candy/punchcard/frame
"""

from __future__ import annotations

import math
from typing import Iterator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURE_API_TOKENS", "op:OPERATOR:testtoken123")


@pytest.fixture(autouse=True)
def _mock_qiskit() -> Iterator[None]:
    """Prevent any real Qiskit / IBM QPU calls during tests."""
    va_mock = MagicMock()
    va_mock.run.return_value = MagicMock(
        runs=[], synthesized=MagicMock(
            mente_total=1.5, mente_achieved=False, four_kings=False,
            missing_slots=["S1", "S2"], slots={},
        ),
        observe_receipt={}, run_id="test-run-id",
        born_at="2026-01-01T00:00:00+00:00",
    )
    with (
        patch("cure_oracle.accelerator.VirtualAccelerator.run", va_mock.run),
        patch("cure_oracle.round_circuit.round_circuit", MagicMock(
            return_value={"result": "mocked", "era": "baroque"}
        )),
        patch("cure_oracle.round_circuit.spiral_preview", MagicMock(return_value="mock_b64")),
    ):
        yield


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_sim_result(mente_total: float = 1.5, era: str = "baroque"):
    r = MagicMock()
    r.era           = era
    r.mente_total   = mente_total
    r.fused_shapes  = ["LINE"]
    return r


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestPunchcardModule ───────────────────────────────────────────────────────

class TestPunchcardModule:
    """Unit tests for cure_oracle/punchcard.py (cure-{era}-r8)."""

    def test_current_rev_is_8(self):
        from cure_oracle.punchcard import CURRENT_REV
        assert CURRENT_REV == 8

    def test_phi_golden_ratio(self):
        from cure_oracle.punchcard import PHI
        assert abs(PHI - (1 + 5 ** 0.5) / 2) < 1e-9

    def test_phi_inv_reciprocal(self):
        from cure_oracle.punchcard import PHI, PHI_INV
        assert abs(PHI * PHI_INV - 1.0) < 1e-9

    def test_mente_const_value(self):
        from cure_oracle.punchcard import MENTE_CONST, PHI
        assert abs(MENTE_CONST - PHI * math.sqrt(2)) < 1e-9

    def test_select_theta_disp_mode_phi(self):
        from cure_oracle.punchcard import select_theta_disp_mode
        assert select_theta_disp_mode(0.80) == "φ.618"

    def test_select_theta_disp_mode_pi(self):
        from cure_oracle.punchcard import select_theta_disp_mode
        assert select_theta_disp_mode(0.60) == "π.785"

    def test_select_theta_disp_mode_sqrt(self):
        from cure_oracle.punchcard import select_theta_disp_mode
        assert select_theta_disp_mode(0.30) == "√.414"

    def test_build_returns_punchcard_frame(self):
        from cure_oracle.punchcard import build_punchcard_frame, PunchcardFrame
        frame = build_punchcard_frame(_make_sim_result())
        assert isinstance(frame, PunchcardFrame)

    def test_frame_version_contains_r8(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert frame.version.endswith("-r8")

    def test_frame_era_matches(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert frame.era == "baroque"

    def test_frame_has_frame_id(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert frame.frame_id and len(frame.frame_id) > 8

    def test_dynamic_a_grid_shape(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert frame.dynamic_a.tracks == 8
        assert frame.dynamic_a.steps  == 16
        assert len(frame.dynamic_a.bits) == 8
        assert all(len(row) == 16 for row in frame.dynamic_a.bits)

    def test_dynamic_b_grid_shape(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert frame.dynamic_b.tracks == 8
        assert len(frame.dynamic_b.bits) == 8

    def test_static_a_claim_record_contains_shape(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert "LINE" in frame.static_a.claim_record

    def test_static_a_merkle_root_hex(self):
        from cure_oracle.punchcard import build_punchcard_frame
        frame = build_punchcard_frame(_make_sim_result())
        assert frame.static_a.merkle_root.startswith("0x")
        assert len(frame.static_a.merkle_root) == 2 + 64   # "0x" + 64 hex chars

    def test_static_b_disclosure_mask_public_slots(self):
        from cure_oracle.punchcard import build_punchcard_frame, _DISCLOSURE
        frame = build_punchcard_frame(_make_sim_result())
        for label, is_public in _DISCLOSURE.items():
            assert frame.static_b.disclosure_mask[label] == is_public


# ── TestPunchcardEndpoint ─────────────────────────────────────────────────────

class TestPunchcardEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/punchcard/frame."""

    def test_frame_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_frame_requires_token_401(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_frame_has_frame_id(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "frame_id" in resp.json()

    def test_frame_version_r8(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["version"].endswith("-r8")

    def test_frame_has_dynamic_a(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "dynamic_a" in resp.json()
        assert "bits" in resp.json()["dynamic_a"]

    def test_frame_has_static_a_merkle_root(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["static_a"]["merkle_root"].startswith("0x")

    def test_frame_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/punchcard/frame",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_punchcard(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        endpoint_map = resp.json().get("endpoint_map", {})
        assert "punchcard" in endpoint_map
