"""tests/backend/test_cure_bmi.py — Phase R: Cure-BMI × KnotScore Integration tests.

cure-{era}-r10 — 24 tests in 2 classes:
  TestCureBmiModule    (16 tests) — unit tests for cure_bmi.py
  TestCureBmiEndpoint   (8 tests) — FastAPI GET /candy/cure-bmi/session

BMI → KnotScore mappings tested:
  band (dominant_hz) → knot_pitch_offset  DELTA=-2 / THETA=-1 / ALPHA=0 / BETA=+1 / GAMMA=+2
  focus  → velocity_scale   0.5 + focus
  calm   → bow_mod          (1-calm) × BOW_CALM_SHIFT
  energy → gb_density
  coherence_score → arc_radius  1.0 + clamp(coh/MENTE_CONST)
"""

from __future__ import annotations

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
    r.era          = era
    r.mente_total  = mente_total
    r.fused_shapes = ["LINE"]
    return r


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestCureBmiModule ─────────────────────────────────────────────────────────

class TestCureBmiModule:
    """Unit tests for cure_oracle/cure_bmi.py (cure-{era}-r10)."""

    def test_current_rev_is_11(self):
        from cure_oracle.cure_bmi import CURRENT_REV
        assert CURRENT_REV == 11

    def test_build_returns_cure_bmi_frame(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame, CureBmiFrame
        frame = build_cure_bmi_frame(_make_sim_result())
        assert isinstance(frame, CureBmiFrame)

    def test_frame_version_contains_r11(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result())
        assert frame.version.endswith("-r11")

    def test_alpha_band_zero_offset(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result(), dominant_hz=10.0)  # ALPHA
        assert frame.band == "ALPHA"
        assert frame.bmi_effect.knot_pitch_offset == 0

    def test_gamma_band_plus2_offset(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result(), dominant_hz=35.0)  # GAMMA
        assert frame.band == "GAMMA"
        assert frame.bmi_effect.knot_pitch_offset == 2

    def test_delta_band_minus2_offset(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result(), dominant_hz=1.0)   # DELTA
        assert frame.band == "DELTA"
        assert frame.bmi_effect.knot_pitch_offset == -2

    def test_focus_velocity_scale(self):
        from cure_oracle.cure_bmi import compute_bmi_effect
        eff = compute_bmi_effect("ALPHA", 3, 1.5, focus=1.0, calm=0.5, energy=0.5, base_bow=1.0)
        assert abs(eff.velocity_scale - 1.5) < 0.01

    def test_calm_zero_max_bow_mod(self):
        from cure_oracle.cure_bmi import compute_bmi_effect, BOW_CALM_SHIFT
        eff = compute_bmi_effect("ALPHA", 3, 1.5, focus=0.5, calm=0.0, energy=0.5, base_bow=0.5)
        assert abs(eff.bow_mod - BOW_CALM_SHIFT) < 0.01

    def test_effective_bow_clamped(self):
        from cure_oracle.cure_bmi import compute_bmi_effect
        eff = compute_bmi_effect("ALPHA", 3, 1.5, focus=0.5, calm=0.0, energy=0.5, base_bow=1.0)
        assert eff.effective_bow <= 1.0

    def test_arc_radius_range(self):
        from cure_oracle.cure_bmi import compute_bmi_effect
        eff_lo = compute_bmi_effect("ALPHA", 3, 0.0, 0.5, 0.5, 0.5, 1.0)
        eff_hi = compute_bmi_effect("ALPHA", 3, 10.0, 0.5, 0.5, 0.5, 1.0)
        assert eff_lo.arc_radius == pytest.approx(1.0, abs=0.01)
        assert eff_hi.arc_radius == pytest.approx(2.0, abs=0.01)

    def test_sport_scene_trading(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result(), scene="trading")
        assert frame.sport_scene.scene == "trading"
        assert frame.sport_scene.spatial_mode == "underwater"

    def test_sport_scene_soccer(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result(), scene="soccer")
        assert frame.sport_scene.scene == "soccer"
        assert frame.sport_scene.spatial_mode == "stadium"

    def test_bmi_influence_text_not_empty(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim_result())
        assert len(frame.bmi_influence) > 0

    def test_frame_has_knot_score(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        from cure_oracle.knot_score import KnotScoreFrame
        frame = build_cure_bmi_frame(_make_sim_result())
        assert isinstance(frame.knot_score, KnotScoreFrame)

    def test_to_dict_has_all_top_keys(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        d = build_cure_bmi_frame(_make_sim_result()).to_dict()
        for key in ["frame_id", "born_at", "era", "version", "band", "band_sig",
                    "bmi_effect", "knot_score", "bmi_influence", "tempo_mod",
                    "layer_intensity", "pitch_shift_st", "sport_scene"]:
            assert key in d, f"missing key: {key}"

    def test_throw_arc_radius_scaled(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        # high coherence → arc radius > 1.0; throw_arc points are (theta, r, t) tuples
        frame = build_cure_bmi_frame(_make_sim_result(), coherence_q=1.0)
        for theta, r, t in frame.knot_score.magic_circle.throw_arc:
            assert r >= 1.0


# ── TestCureBmiEndpoint ───────────────────────────────────────────────────────

class TestCureBmiEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/cure-bmi/session."""

    def test_session_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_session_requires_token(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_session_has_frame_id(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "frame_id" in resp.json()

    def test_session_version_r11(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["version"].endswith("-r11")

    def test_session_has_bmi_effect(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "bmi_effect" in resp.json()
        assert "velocity_scale" in resp.json()["bmi_effect"]

    def test_session_soccer_scene(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "LINE", "token": "testtoken123", "scene": "soccer"},
        )
        assert resp.status_code == 200
        assert resp.json()["sport_scene"]["scene"] == "soccer"

    def test_session_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/cure-bmi/session",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_cure_bmi(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        endpoint_map = resp.json().get("endpoint_map", {})
        assert "cure_bmi" in endpoint_map
