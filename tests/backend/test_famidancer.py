"""tests/backend/test_famidancer.py — FAMIDANCER'S Kit tests.

cure-{era}-r12 — B地点第十五画面 — 24 tests in 2 classes:
  TestFamidancerModule    (16 tests) — unit tests for famidancer.py
  TestFamidancerEndpoint   (8 tests) — FastAPI GET /candy/famidancer/session
"""

from __future__ import annotations

import re
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
            missing_slots=[], slots={},
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

def _make_sim(mente_total: float = 1.5, era: str = "baroque"):
    r = MagicMock()
    r.era          = era
    r.mente_total  = mente_total
    r.fused_shapes = ["LINE"]
    return r


def _make_anim_hint(motion_class: str = "peak", intensity: float = 0.8,
                    scene: str = "soccer", confidence: int = 75):
    from cure_oracle.sound_anim import AnimHint
    return AnimHint(
        label=motion_class,
        scene=scene,
        confidence=confidence,
        motion_class=motion_class,
        intensity=intensity,
        hint_str=f"[{scene}:{motion_class}:{confidence:02d}]",
    )


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


_DANCE_HINT_RE = re.compile(r"^\[[\w]+:[\w_]+:\d+\]$")


# ── TestFamidancerModule ──────────────────────────────────────────────────────

class TestFamidancerModule:
    """Unit tests for cure_oracle/famidancer.py."""

    def test_current_rev_is_12(self):
        from cure_oracle.famidancer import CURRENT_REV
        assert CURRENT_REV == 12

    def test_returns_dance_move_dataclass(self):
        from cure_oracle.famidancer import DanceMove, predict_dance_move
        dm = predict_dance_move(_make_anim_hint(), "ALPHA", 100, 140)
        assert isinstance(dm, DanceMove)

    def test_peak_high_intensity_full_spin(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("peak", 0.9), "GAMMA", 120, 160)
        assert dm.move_name == "full_spin"

    def test_peak_low_intensity_jump_sequence(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("peak", 0.3), "ALPHA", 120, 160)
        assert dm.move_name == "jump_sequence"

    def test_dynamic_motion_wave_slide_high(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("dynamic", 0.8), "BETA", 100, 130)
        assert dm.move_name == "wave_slide"

    def test_steady_motion_step_groove(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("steady", 0.7), "ALPHA", 100, 120)
        assert dm.move_name == "step_groove"

    def test_tension_motion_freeze_hold(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("tension", 0.7), "BETA", 90, 110)
        assert dm.move_name == "freeze_hold"

    def test_static_motion_idle_sway(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("static", 0.1), "DELTA", 80, 100)
        assert dm.move_name == "idle_sway"

    def test_contact_motion_dodge_step(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("contact", 0.9), "GAMMA", 110, 140)
        assert dm.move_name == "dodge_step"

    def test_bpm_sync_in_range(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("steady", 0.5), "ALPHA", 100, 140)
        assert 100 <= dm.bpm_sync <= 140

    def test_hint_str_bracket_format(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("peak", 0.8, "soccer"), "GAMMA", 120, 160)
        assert _DANCE_HINT_RE.match(dm.hint_str), f"bad format: {dm.hint_str!r}"

    def test_step_pattern_not_empty(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("dynamic", 0.6), "BETA", 100, 130)
        assert len(dm.step_pattern) > 0

    def test_mirror_hint_true_for_delta(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("static", 0.1), "DELTA", 80, 100)
        assert dm.mirror_hint is True

    def test_mirror_hint_false_for_gamma(self):
        from cure_oracle.famidancer import predict_dance_move
        dm = predict_dance_move(_make_anim_hint("peak", 0.9), "GAMMA", 120, 160)
        assert dm.mirror_hint is False

    def test_energy_level_matches_intensity(self):
        from cure_oracle.famidancer import predict_dance_move
        hint = _make_anim_hint("steady", 0.65)
        dm = predict_dance_move(hint, "ALPHA", 100, 120)
        assert abs(dm.energy_level - 0.65) < 0.01

    def test_to_dict_has_expected_keys(self):
        from cure_oracle.famidancer import predict_dance_move
        d = predict_dance_move(_make_anim_hint(), "ALPHA", 100, 140).to_dict()
        for key in ("move_name", "motion_class", "style", "step_pattern",
                    "bpm_sync", "energy_level", "mirror_hint", "hint_str"):
            assert key in d, f"missing key: {key}"


# ── TestFamidancerEndpoint ────────────────────────────────────────────────────

class TestFamidancerEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/famidancer/session."""

    def test_session_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_session_requires_token(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_session_has_dance_move(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "dance_move" in resp.json()

    def test_session_version_r12(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["version"].endswith("-r12")

    def test_session_has_move_name(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        dm = resp.json()["dance_move"]
        assert len(dm.get("move_name", "")) > 0

    def test_session_soccer_scene(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "LINE", "token": "testtoken123", "scene": "soccer"},
        )
        assert resp.status_code == 200
        assert resp.json()["anim_scene"] == "soccer"

    def test_session_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/famidancer/session",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_famidancer(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        assert "famidancer" in resp.json().get("endpoint_map", {})
