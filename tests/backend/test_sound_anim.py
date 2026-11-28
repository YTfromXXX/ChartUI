"""tests/backend/test_sound_anim.py — Phase S: Audio → Animation Hint tests.

cure-{era}-r11 — 24 tests in 2 classes:
  TestSoundAnimModule  (16 tests) — unit tests for sound_anim.py
  TestSoundAnimInBmi    (8 tests) — integration with cure_bmi.build_cure_bmi_frame
"""

from __future__ import annotations

import re
from typing import Iterator
from unittest.mock import MagicMock, patch

import pytest


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
    r.era         = era
    r.mente_total = mente_total
    r.fused_shapes = ["LINE"]
    return r


_HINT_RE = re.compile(r"^\[[\w]+:[\w_]+:\d{2,3}\]$")


# ── TestSoundAnimModule ───────────────────────────────────────────────────────

class TestSoundAnimModule:
    """Unit tests for cure_oracle/sound_anim.py."""

    def test_current_rev_is_11(self):
        from cure_oracle.sound_anim import CURRENT_REV
        assert CURRENT_REV == 11

    def test_returns_anim_hint_dataclass(self):
        from cure_oracle.sound_anim import AnimHint, predict_anim_hint
        h = predict_anim_hint("ALPHA", 0.5, 0.5, 0.5, 1.0, "trading", 1.0)
        assert isinstance(h, AnimHint)

    def test_soccer_high_energy_goal_celebration(self):
        from cure_oracle.sound_anim import predict_anim_hint
        # GAMMA + high energy + high focus → action_score ≈ 0.95 → goal_celebration
        h = predict_anim_hint("GAMMA", 1.0, 1.0, 0.0, 2.0, "soccer", 1.0)
        assert h.label == "goal_celebration"

    def test_soccer_low_energy_idle(self):
        from cure_oracle.sound_anim import predict_anim_hint
        # DELTA + low energy + low focus → action_score ≈ 0.0 → idle
        h = predict_anim_hint("DELTA", 0.0, 0.0, 1.0, 0.5, "soccer", 1.0)
        assert h.label == "idle"

    def test_surfing_high_action_tube_ride(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("GAMMA", 1.0, 1.0, 0.0, 1.5, "surfing", 1.0)
        assert h.label == "tube_ride"

    def test_climbing_high_action_top_out(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("GAMMA", 1.0, 1.0, 0.0, 1.5, "climbing", 1.0)
        assert h.label == "top_out"

    def test_live_high_action_crowd_surge(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("GAMMA", 1.0, 1.0, 0.0, 1.5, "live", 1.0)
        assert h.label == "crowd_surge"

    def test_trading_high_action_breakout(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("GAMMA", 1.0, 1.0, 0.0, 1.5, "trading", 1.0)
        assert h.label == "breakout"

    def test_hint_str_bracket_format(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("ALPHA", 0.5, 0.5, 0.5, 1.0, "soccer", 1.0)
        assert _HINT_RE.match(h.hint_str), f"bad format: {h.hint_str!r}"

    def test_scene_in_hint_str(self):
        from cure_oracle.sound_anim import predict_anim_hint
        for scene in ("soccer", "surfing", "climbing", "live", "trading"):
            h = predict_anim_hint("ALPHA", 0.5, 0.5, 0.5, 1.0, scene, 1.0)
            assert h.hint_str.startswith(f"[{scene}:")

    def test_confidence_range(self):
        from cure_oracle.sound_anim import predict_anim_hint
        for coh in (0.0, 0.5, 1.5, 3.0, 10.0):
            h = predict_anim_hint("ALPHA", 0.5, 0.5, 0.5, coh, "trading", 1.0)
            assert 0 <= h.confidence <= 100

    def test_gamma_band_boosts_action_vs_delta(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h_gamma = predict_anim_hint("GAMMA", 0.5, 0.5, 0.5, 1.0, "soccer", 1.0)
        h_delta = predict_anim_hint("DELTA", 0.5, 0.5, 0.5, 1.0, "soccer", 1.0)
        assert h_gamma.intensity > h_delta.intensity

    def test_intensity_in_unit_range(self):
        from cure_oracle.sound_anim import predict_anim_hint
        for band in ("DELTA", "THETA", "ALPHA", "BETA", "GAMMA"):
            h = predict_anim_hint(band, 0.5, 0.5, 0.5, 1.0, "trading", 1.0)
            assert 0.0 <= h.intensity <= 1.0

    def test_motion_class_not_empty(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("BETA", 0.7, 0.6, 0.4, 1.2, "climbing", 1.0)
        assert len(h.motion_class) > 0

    def test_unknown_scene_falls_back_to_trading(self):
        from cure_oracle.sound_anim import predict_anim_hint
        h = predict_anim_hint("ALPHA", 0.5, 0.5, 0.5, 1.0, "UNKNOWN_SCENE", 1.0)
        # should not raise; label comes from trading vocab
        assert h.label in ("breakout", "momentum_up", "reversal",
                            "momentum_down", "consolidation", "idle")

    def test_to_dict_has_expected_keys(self):
        from cure_oracle.sound_anim import predict_anim_hint
        d = predict_anim_hint("ALPHA", 0.5, 0.5, 0.5, 1.0, "soccer", 1.0).to_dict()
        for key in ("label", "scene", "confidence", "motion_class", "intensity", "hint_str"):
            assert key in d, f"missing key: {key}"


# ── TestSoundAnimInBmi ────────────────────────────────────────────────────────

class TestSoundAnimInBmi:
    """Integration tests: AnimHint wired into CureBmiFrame via build_cure_bmi_frame."""

    def test_phase_s_version_r11(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim())
        assert frame.version.endswith("-r11")

    def test_build_frame_has_anim_hint(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim())
        assert len(frame.sport_scene.audio_to_anim_hint) > 0

    def test_hint_str_bracket_format_in_frame(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim())
        assert _HINT_RE.match(frame.sport_scene.audio_to_anim_hint)

    def test_soccer_frame_hint_contains_soccer(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim(), scene="soccer")
        assert frame.sport_scene.audio_to_anim_hint.startswith("[soccer:")

    def test_trading_frame_hint_contains_trading(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim(), scene="trading")
        assert frame.sport_scene.audio_to_anim_hint.startswith("[trading:")

    def test_surfing_scene_hint_not_empty(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim(), scene="surfing")
        assert "[surfing:" in frame.sport_scene.audio_to_anim_hint

    def test_climbing_scene_hint_not_empty(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim(), scene="climbing")
        assert "[climbing:" in frame.sport_scene.audio_to_anim_hint

    def test_live_scene_hint_not_empty(self):
        from cure_oracle.cure_bmi import build_cure_bmi_frame
        frame = build_cure_bmi_frame(_make_sim(), scene="live")
        assert "[live:" in frame.sport_scene.audio_to_anim_hint
