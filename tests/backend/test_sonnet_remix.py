"""Tests for the Sonnet-Score remix endpoint and BMI mapping logic.

All tests run fully offline — no GEMINI_API_KEY, Qiskit, or live server needed.
CURE_API_TOKENS is monkeypatched per class via an autouse fixture.
Endpoint tests mock SonnetScore.compute_offline to avoid the Qiskit dependency.
"""

from __future__ import annotations

import json
import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_oracle.sonnet_remix import (
    BmiState,
    RemixLayer,
    compute_remix,
    _bmi_influence_text,
    VALID_REMIX_STYLES,
    _INSTRUMENT_TABLE,
    _ERA_LOOP_SIG,
    _TEMPO_CALM_MAX_SHIFT,
)
from cure_oracle.sonnet_score import (
    SonnetScoreResult,
    DriveBoard,
    DRIVE_BOARD_1_COLS, DRIVE_BOARD_1_ROWS,
    DRIVE_BOARD_2_COLS, DRIVE_BOARD_2_ROWS,
)
from cure_oracle.qpu_router import router

# ── shared app / client ───────────────────────────────────────────────────────

_TEST_TOKEN = "remix-test-operator-9f2b"

app = FastAPI()
app.include_router(router)
_client = TestClient(app)
_AUTH   = {"Authorization": f"Bearer {_TEST_TOKEN}"}


def _make_mock_result(era: str = "classical", bpm: int = 120) -> SonnetScoreResult:
    r = SonnetScoreResult(
        score_id=str(uuid.uuid4()),
        bpm=bpm,
        bars=4,
        tilt_rate=50.0,
        ascent_rate=42.5,
        mente_total=1.145,
        mente_achieved=False,
        key="D",
        mode_name="dorian",
        era=era,
        events=[],
        embellishments=[],
        commentary="mock",
        observe_receipt={"merkle": {"root": "0xdeadbeef"}},
    )
    r.board_1 = DriveBoard("drive_board_1", DRIVE_BOARD_1_COLS, DRIVE_BOARD_1_ROWS)
    r.board_2 = DriveBoard("drive_board_2", DRIVE_BOARD_2_COLS, DRIVE_BOARD_2_ROWS)
    return r


@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch):
    monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_TOKEN: "operator"}))


# ── BmiState tests ────────────────────────────────────────────────────────────

class TestBmiState:
    def test_from_none_uses_defaults(self):
        b = BmiState.from_dict(None)
        assert b.focus == 0.5
        assert b.calm  == 0.5
        assert b.energy == 0.5

    def test_from_dict_full(self):
        b = BmiState.from_dict({"focus": 0.72, "calm": 0.55, "energy": 0.80})
        assert b.focus  == pytest.approx(0.72)
        assert b.calm   == pytest.approx(0.55)
        assert b.energy == pytest.approx(0.80)

    def test_from_dict_partial_uses_defaults(self):
        b = BmiState.from_dict({"focus": 0.9})
        assert b.focus  == pytest.approx(0.9)
        assert b.calm   == 0.5
        assert b.energy == 0.5

    def test_clamp_above_one(self):
        b = BmiState(focus=1.5, calm=2.0, energy=-0.1)
        b._clamp()
        assert b.focus  == 1.0
        assert b.calm   == 1.0
        assert b.energy == 0.0

    def test_clamp_at_boundaries(self):
        b = BmiState(focus=0.0, calm=1.0, energy=0.5)
        b._clamp()
        assert b.focus  == 0.0
        assert b.calm   == 1.0
        assert b.energy == 0.5


# ── tempo_modifier mapping ────────────────────────────────────────────────────

class TestTempoModifier:
    def test_full_calm_no_shift(self):
        remix = compute_remix("classical", bmi_state={"focus": 0.5, "calm": 1.0, "energy": 0.5})
        assert remix.tempo_modifier == pytest.approx(1.0, abs=1e-4)

    def test_zero_calm_max_shift(self):
        remix = compute_remix("classical", bmi_state={"focus": 0.5, "calm": 0.0, "energy": 0.5})
        assert remix.tempo_modifier == pytest.approx(1.0 + _TEMPO_CALM_MAX_SHIFT, abs=1e-4)

    def test_mid_calm_half_shift(self):
        remix = compute_remix("classical", bmi_state={"focus": 0.5, "calm": 0.5, "energy": 0.5})
        expected = 1.0 + 0.5 * _TEMPO_CALM_MAX_SHIFT
        assert remix.tempo_modifier == pytest.approx(expected, abs=1e-4)

    def test_tempo_modifier_range(self):
        for calm in [0.0, 0.25, 0.5, 0.75, 1.0]:
            remix = compute_remix("baroque", bmi_state={"calm": calm, "focus": 0.5, "energy": 0.5})
            assert 1.0 <= remix.tempo_modifier <= 1.0 + _TEMPO_CALM_MAX_SHIFT + 1e-9

    def test_default_bmi_tempo(self):
        remix = compute_remix("classical", bmi_state=None)
        expected = 1.0 + 0.5 * _TEMPO_CALM_MAX_SHIFT
        assert remix.tempo_modifier == pytest.approx(expected, abs=1e-4)


# ── layer_intensity from energy ───────────────────────────────────────────────

class TestLayerIntensity:
    def test_energy_maps_directly(self):
        for energy in [0.0, 0.25, 0.5, 0.80, 1.0]:
            remix = compute_remix("romantic", bmi_state={"energy": energy, "focus": 0.5, "calm": 0.5})
            assert remix.layer_intensity == pytest.approx(energy, abs=1e-4)

    def test_default_energy_half(self):
        remix = compute_remix("baroque", bmi_state=None)
        assert remix.layer_intensity == pytest.approx(0.5, abs=1e-4)


# ── instrument set by era × style ────────────────────────────────────────────

class TestInstrumentSet:
    def test_all_eras_have_all_styles(self):
        for era in _INSTRUMENT_TABLE:
            for style in VALID_REMIX_STYLES:
                assert style in _INSTRUMENT_TABLE[era], f"missing {style} for {era}"

    def test_baroque_orchestral(self):
        remix = compute_remix("baroque", remix_style="orchestral")
        assert "harpsichord" in remix.instrument_set
        assert "violin"      in remix.instrument_set
        assert "cello"       in remix.instrument_set

    def test_inner_world_ambient(self):
        remix = compute_remix("inner_world", remix_style="ambient")
        assert "infinite_drone" in remix.instrument_set

    def test_inner_world_electronic(self):
        remix = compute_remix("inner_world", remix_style="electronic")
        assert "glitch"    in remix.instrument_set
        assert "sub_bass"  in remix.instrument_set

    def test_romantic_orchestral(self):
        remix = compute_remix("romantic", remix_style="orchestral")
        assert "grand_piano" in remix.instrument_set
        assert "orchestra"   in remix.instrument_set

    def test_beethoven_electronic(self):
        remix = compute_remix("beethoven", remix_style="electronic")
        assert "epic_synth" in remix.instrument_set
        assert "drums"      in remix.instrument_set

    def test_unknown_style_falls_back_to_orchestral(self):
        remix = compute_remix("classical", remix_style="INVALID")
        assert remix.instrument_set == _INSTRUMENT_TABLE["classical"]["orchestral"]

    def test_unknown_era_falls_back_to_classical(self):
        remix = compute_remix("unknown_era", remix_style="orchestral")
        assert remix.instrument_set == _INSTRUMENT_TABLE["classical"]["orchestral"]


# ── loop signature ────────────────────────────────────────────────────────────

class TestLoopSignature:
    def test_inner_world_is_5_4(self):
        remix = compute_remix("inner_world")
        assert remix.loop_signature == "5/4"

    def test_classical_is_3_4(self):
        remix = compute_remix("classical")
        assert remix.loop_signature == "3/4"

    def test_baroque_is_4_4(self):
        remix = compute_remix("baroque")
        assert remix.loop_signature == "4/4"

    def test_all_eras_have_valid_sig(self):
        for era in _ERA_LOOP_SIG:
            sig = _ERA_LOOP_SIG[era]
            assert "/" in sig and len(sig) >= 3


# ── bmi_influence text ────────────────────────────────────────────────────────

class TestBmiInfluenceText:
    def test_high_focus_contains_melody_clarity(self):
        bmi = BmiState(focus=0.9, calm=0.5, energy=0.5)
        text = _bmi_influence_text(bmi)
        assert "melody clarity" in text
        assert "focus↑" in text

    def test_low_focus_contains_ornamental(self):
        bmi = BmiState(focus=0.1, calm=0.5, energy=0.5)
        text = _bmi_influence_text(bmi)
        assert "ornamental" in text
        assert "focus↓" in text

    def test_high_energy_contains_rhythmic_drive(self):
        bmi = BmiState(focus=0.5, calm=0.5, energy=0.8)
        text = _bmi_influence_text(bmi)
        assert "rhythmic drive" in text

    def test_low_calm_contains_accelerated(self):
        bmi = BmiState(focus=0.5, calm=0.2, energy=0.5)
        text = _bmi_influence_text(bmi)
        assert "accelerated tempo" in text


# ── compute_remix return type ─────────────────────────────────────────────────

class TestComputeRemix:
    def test_returns_remix_layer(self):
        result = compute_remix("romantic")
        assert isinstance(result, RemixLayer)

    def test_to_dict_has_required_keys(self):
        d = compute_remix("classical").to_dict()
        for key in ("tempo_modifier", "layer_intensity", "instrument_set",
                    "loop_signature", "bmi_influence", "export_hint"):
            assert key in d, f"missing key {key}"

    def test_export_hint_mentions_midi(self):
        d = compute_remix("baroque").to_dict()
        assert "MIDI" in d["export_hint"]

    def test_instrument_set_is_list(self):
        d = compute_remix("beethoven").to_dict()
        assert isinstance(d["instrument_set"], list)
        assert len(d["instrument_set"]) >= 1


# ── POST /api/v1/qpu/candy/sonnet/remix endpoint ─────────────────────────────

_MOCK_TARGET = "cure_oracle.qpu_router.SonnetScore"


class TestRemixEndpoint:
    def _post(self, payload: dict, era: str = "classical") -> "Response":
        mock_result = _make_mock_result(era=era)
        with patch(_MOCK_TARGET) as MockSS:
            MockSS.return_value.compute_offline.return_value = mock_result
            return _client.post("/api/v1/qpu/candy/sonnet/remix", json=payload, headers=_AUTH)

    def test_basic_request_ok(self):
        resp = self._post({"shapes": ["LINE", "CUBE"], "shots": 512, "mode": "local", "round_num": 1})
        assert resp.status_code == 200
        data = resp.json()
        assert "remix" in data

    def test_remix_has_required_fields(self):
        resp = self._post({"shapes": ["CUBE"], "shots": 256})
        assert resp.status_code == 200
        remix = resp.json()["remix"]
        for key in ("tempo_modifier", "layer_intensity", "instrument_set",
                    "loop_signature", "bmi_influence", "export_hint"):
            assert key in remix, f"missing key {key}"

    def test_bmi_state_affects_remix(self):
        mock_result = _make_mock_result()
        with patch(_MOCK_TARGET) as MockSS:
            MockSS.return_value.compute_offline.return_value = mock_result
            resp_low  = _client.post("/api/v1/qpu/candy/sonnet/remix",
                                     json={"shapes": ["LINE"], "bmi_state": {"focus": 0.1, "calm": 0.0, "energy": 0.1}},
                                     headers=_AUTH)
            resp_high = _client.post("/api/v1/qpu/candy/sonnet/remix",
                                     json={"shapes": ["LINE"], "bmi_state": {"focus": 0.9, "calm": 1.0, "energy": 0.9}},
                                     headers=_AUTH)
        assert resp_low.status_code == resp_high.status_code == 200
        low_remix  = resp_low.json()["remix"]
        high_remix = resp_high.json()["remix"]
        assert low_remix["tempo_modifier"] > high_remix["tempo_modifier"]
        assert low_remix["layer_intensity"] < high_remix["layer_intensity"]

    def test_no_bmi_state_uses_defaults(self):
        resp = self._post({"shapes": ["RING"], "shots": 256})
        assert resp.status_code == 200
        remix = resp.json()["remix"]
        expected_tempo = round(1.0 + 0.5 * _TEMPO_CALM_MAX_SHIFT, 4)
        assert remix["tempo_modifier"] == pytest.approx(expected_tempo, abs=0.01)

    def test_remix_style_orchestral(self):
        resp = self._post({"shapes": ["CUBE"], "remix_style": "orchestral"})
        assert resp.status_code == 200
        remix = resp.json()["remix"]
        assert len(remix["instrument_set"]) >= 1

    def test_remix_style_electronic(self):
        resp = self._post({"shapes": ["STAR"], "remix_style": "electronic"})
        assert resp.status_code == 200

    def test_remix_style_ambient(self):
        resp = self._post({"shapes": ["LINE"], "remix_style": "ambient"})
        assert resp.status_code == 200

    def test_invalid_remix_style_422(self):
        resp = self._post({"shapes": ["LINE"], "remix_style": "INVALID_STYLE"})
        assert resp.status_code == 422

    def test_unknown_shape_422(self):
        resp = self._post({"shapes": ["HEXAGON"]})
        assert resp.status_code == 422

    def test_missing_auth_401(self):
        mock_result = _make_mock_result()
        with patch(_MOCK_TARGET) as MockSS:
            MockSS.return_value.compute_offline.return_value = mock_result
            resp = _client.post("/api/v1/qpu/candy/sonnet/remix", json={"shapes": ["LINE"]})
        assert resp.status_code in (401, 403)

    def test_includes_sonnet_score_fields(self):
        resp = self._post({"shapes": ["LINE", "RING"], "bars": 4})
        assert resp.status_code == 200
        data = resp.json()
        for key in ("score_id", "born_at", "bpm", "bars", "ascent_rate",
                    "mente_total", "era", "events", "board_1", "board_2"):
            assert key in data, f"missing SonnetScore field {key}"

    def test_bars_param_respected(self):
        mock_result = _make_mock_result()
        mock_result.bars = 8
        with patch(_MOCK_TARGET) as MockSS:
            MockSS.return_value.compute_offline.return_value = mock_result
            resp = _client.post("/api/v1/qpu/candy/sonnet/remix",
                                json={"shapes": ["CUBE"], "bars": 8}, headers=_AUTH)
        assert resp.status_code == 200
        assert resp.json()["bars"] == 8

    def test_layer_intensity_in_range(self):
        resp = self._post({"shapes": ["TREE"], "bmi_state": {"energy": 0.75, "focus": 0.5, "calm": 0.5}})
        assert resp.status_code == 200
        remix = resp.json()["remix"]
        assert 0.0 <= remix["layer_intensity"] <= 1.0

    def test_tempo_modifier_at_max_excitement(self):
        resp = self._post({
            "shapes": ["STAR"],
            "bmi_state": {"focus": 0.1, "calm": 0.0, "energy": 1.0},
        })
        assert resp.status_code == 200
        remix = resp.json()["remix"]
        assert remix["tempo_modifier"] == pytest.approx(1.0 + _TEMPO_CALM_MAX_SHIFT, abs=0.01)

    def test_observe_receipt_present(self):
        resp = self._post({"shapes": ["LINE"]})
        assert resp.status_code == 200
        assert "observe_receipt" in resp.json()

    def test_all_shapes_accepted(self):
        for shape in ("CUBE", "RING", "TREE", "LINE", "STAR"):
            resp = self._post({"shapes": [shape]})
            assert resp.status_code == 200, f"shape {shape} failed: {resp.text}"

    def test_era_drives_instruments(self):
        resp = self._post({"shapes": ["STAR"], "remix_style": "orchestral"}, era="inner_world")
        assert resp.status_code == 200
        instruments = resp.json()["remix"]["instrument_set"]
        assert "koto" in instruments

    def test_baroque_era_orchestral_instruments(self):
        resp = self._post({"shapes": ["CUBE"], "remix_style": "orchestral"}, era="baroque")
        assert resp.status_code == 200
        instruments = resp.json()["remix"]["instrument_set"]
        assert "harpsichord" in instruments
