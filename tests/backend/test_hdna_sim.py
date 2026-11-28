"""tests/backend/test_hdna_sim.py — .hdna Music Simulation Engine tests.

cure-{era}-r13 — B地点第十六画面 (Phase U) — 24 tests in 2 classes:
  TestHdnaSimModule     (16) — unit tests for hdna_sim.py
  TestHdnaSimEndpoint    (8) — FastAPI GET /candy/hdna/sim
"""

from __future__ import annotations

import base64
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

def _make_card(bpm: int = 120, era: str = "baroque", scene: str = "trading",
               note_count: int = 4):
    """Build a minimal HdnaCard for unit tests."""
    from cure_oracle.hdna import (
        HdnaCard, HeadChunk, MdnaChunk, VartChunk, LinkChunk, NoteEvent,
        _ERA_IDS, _BAND_IDS, _SCENE_IDS,
    )
    notes = [
        NoteEvent(pitch=60 + i, velocity=80, start_tick=i * 480, dur_ticks=240)
        for i in range(note_count)
    ]
    return HdnaCard(
        head=HeadChunk(),
        mdna=MdnaChunk(bpm=bpm, key_pc=0, era_id=_ERA_IDS.get(era, 0),
                       mente_total=1.5, timbre_id=10, notes=notes),
        vart=VartChunk(rarity=1, circle_seed=42,
                       band_id=_BAND_IDS["ALPHA"],
                       scene_id=_SCENE_IDS.get(scene, 0),
                       theta_q=0.65),
        link=LinkChunk(),
    )


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestHdnaSimModule ─────────────────────────────────────────────────────────

class TestHdnaSimModule:
    """Unit tests for cure_oracle/hdna_sim.py."""

    def test_current_rev_is_13(self):
        from cure_oracle.hdna_sim import CURRENT_REV
        assert CURRENT_REV == 13

    def test_simulate_returns_hdna_sim_result(self):
        from cure_oracle.hdna_sim import HdnaSimResult, simulate
        assert isinstance(simulate(_make_card()), HdnaSimResult)

    def test_bpm_in_result_matches_card(self):
        from cure_oracle.hdna_sim import simulate
        assert simulate(_make_card(bpm=140)).bpm == 140

    def test_instrument_baroque_is_harpsichord(self):
        from cure_oracle.hdna_sim import simulate
        assert simulate(_make_card(era="baroque")).instrument == "harpsichord"

    def test_instrument_romantic_is_strings(self):
        from cure_oracle.hdna_sim import simulate
        assert simulate(_make_card(era="romantic")).instrument == "strings"

    def test_scene_soccer_reverb_has_room_size(self):
        from cure_oracle.hdna_sim import simulate
        reverb = simulate(_make_card(scene="soccer")).reverb
        assert "roomSize" in reverb
        assert reverb["roomSize"] > 0.5

    def test_notes_list_not_empty(self):
        from cure_oracle.hdna_sim import simulate
        assert len(simulate(_make_card(note_count=4)).notes) == 4

    def test_note_names_are_strings(self):
        from cure_oracle.hdna_sim import simulate
        for n in simulate(_make_card()).notes:
            assert isinstance(n.note_name, str)
            assert len(n.note_name) >= 2    # e.g. "C4", "A#3"

    def test_time_sec_non_negative(self):
        from cure_oracle.hdna_sim import simulate
        for n in simulate(_make_card()).notes:
            assert n.time_sec >= 0.0

    def test_duration_sec_positive(self):
        from cure_oracle.hdna_sim import simulate
        for n in simulate(_make_card()).notes:
            assert n.duration_sec > 0.0

    def test_velocity_normalized_range(self):
        from cure_oracle.hdna_sim import simulate
        for n in simulate(_make_card()).notes:
            assert 0.0 <= n.velocity_normalized <= 1.0

    def test_tone_js_has_transport_key(self):
        from cure_oracle.hdna_sim import simulate
        seq = simulate(_make_card()).tone_js_sequence
        assert "transport" in seq
        assert seq["transport"]["bpm"] == 120

    def test_tone_js_has_notes_key(self):
        from cure_oracle.hdna_sim import simulate
        seq = simulate(_make_card()).tone_js_sequence
        assert "notes" in seq
        assert len(seq["notes"]) > 0

    def test_midi_starts_with_mthd(self):
        from cure_oracle.hdna_sim import to_midi_bytes
        midi = to_midi_bytes(_make_card())
        assert midi[:4] == b"MThd"

    def test_midi_b64_is_string(self):
        from cure_oracle.hdna_sim import simulate
        b64 = simulate(_make_card()).midi_b64
        assert isinstance(b64, str)
        # must be valid base64 starting with MIDI header
        raw = base64.b64decode(b64)
        assert raw[:4] == b"MThd"

    def test_to_dict_has_expected_keys(self):
        from cure_oracle.hdna_sim import simulate
        d = simulate(_make_card()).to_dict()
        for key in ("spec_rev", "era", "band", "scene", "rarity", "bpm",
                    "instrument", "reverb", "note_count", "duration_sec",
                    "notes", "tone_js_sequence", "midi_b64"):
            assert key in d, f"missing key: {key}"


# ── TestHdnaSimEndpoint ───────────────────────────────────────────────────────

class TestHdnaSimEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/hdna/sim."""

    def test_sim_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_sim_requires_token(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_sim_has_tone_js_sequence(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "tone_js_sequence" in data
        assert "transport" in data["tone_js_sequence"]

    def test_sim_has_midi_b64(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "midi_b64" in resp.json()

    def test_sim_midi_starts_with_mthd_b64(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        raw = base64.b64decode(resp.json()["midi_b64"])
        assert raw[:4] == b"MThd"

    def test_sim_has_bpm(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        bpm = resp.json().get("bpm")
        assert isinstance(bpm, int)
        assert bpm > 0

    def test_sim_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/sim",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_hdna_sim(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        assert "hdna_sim" in resp.json().get("endpoint_map", {})
