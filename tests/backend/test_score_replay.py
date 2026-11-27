"""tests/backend/test_score_replay.py — Phase O: Score Replay tests.

cure-{era}-r7 — 24 tests in 2 classes:
  TestScoreReplayModule    (16 tests) — unit tests for score_replay.py
  TestScoreReplayEndpoint   (8 tests) — FastAPI GET /candy/score-replay/frames
"""

from __future__ import annotations

import struct
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

def _make_midi_bytes_with_note() -> bytes:
    """Build a minimal MIDI Format 0 file with one note (C4, ch0, tick=0, dur=240)."""
    from cure_oracle.midi_export import events_to_midi_bytes
    return events_to_midi_bytes(
        [{"tick": 0, "channel": 0, "note": 60, "velocity": 80, "duration_ticks": 240}],
        bpm=120, ppqn=480,
    )


def _make_export_result(midi_bytes=None):
    r = MagicMock()
    r.era              = "baroque"
    r.bpm              = 120
    r.ppqn             = 480
    r.bars             = 4
    r.source           = "midi_viz"
    r.event_count      = 1
    r.duration_ticks   = 480 * 4 * 4
    r.duration_seconds = 4.0
    r.midi_bytes       = midi_bytes if midi_bytes is not None else _make_midi_bytes_with_note()
    return r


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestScoreReplayModule ─────────────────────────────────────────────────────

class TestScoreReplayModule:
    """Unit tests for cure_oracle/score_replay.py (cure-{era}-r7)."""

    def test_current_rev_is_7(self):
        from cure_oracle.score_replay import CURRENT_REV
        assert CURRENT_REV == 7

    def test_midi_note_name_c4(self):
        from cure_oracle.score_replay import midi_note_name
        assert midi_note_name(60) == "C4"

    def test_midi_note_name_a4(self):
        from cure_oracle.score_replay import midi_note_name
        assert midi_note_name(69) == "A4"

    def test_midi_note_name_c_sharp(self):
        from cure_oracle.score_replay import midi_note_name
        assert "C#" in midi_note_name(61)

    def test_midi_note_name_out_of_range(self):
        from cure_oracle.score_replay import midi_note_name
        assert midi_note_name(200).startswith("?")

    def test_build_returns_score_replay_frame(self):
        from cure_oracle.score_replay import build_score_replay_frame, ScoreReplayFrame
        frame = build_score_replay_frame(_make_export_result())
        assert isinstance(frame, ScoreReplayFrame)

    def test_frame_version_contains_r7(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        assert frame.version.endswith("-r7")

    def test_frame_era_matches(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        assert frame.era == "baroque"

    def test_frame_has_frame_id(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        assert frame.frame_id and len(frame.frame_id) > 8

    def test_frame_parses_one_note(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        assert len(frame.notes) == 1

    def test_note_label_c4(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        assert frame.notes[0].label == "C4"

    def test_piano_roll_non_empty(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        assert len(frame.piano_roll) >= 1

    def test_piano_roll_pitch_class_range(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        for c in frame.piano_roll:
            assert 0 <= c.pitch_class <= 11

    def test_piano_roll_bar_range(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result())
        for c in frame.piano_roll:
            assert c.bar >= 0

    def test_history_index_stored(self):
        from cure_oracle.score_replay import build_score_replay_frame
        frame = build_score_replay_frame(_make_export_result(), history_index=3)
        assert frame.history_index == 3

    def test_empty_midi_bytes_gives_empty_notes(self):
        from cure_oracle.score_replay import build_score_replay_frame
        ex = _make_export_result(midi_bytes=b"")
        frame = build_score_replay_frame(ex)
        assert frame.notes == []


# ── TestScoreReplayEndpoint ───────────────────────────────────────────────────

class TestScoreReplayEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/score-replay/frames."""

    def test_frames_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_frames_requires_token_401(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_frames_has_frame_id(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "frame_id" in resp.json()

    def test_frames_version_r7(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["version"].endswith("-r7")

    def test_frames_has_piano_roll_key(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "piano_roll" in resp.json()

    def test_frames_has_notes_key(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "notes" in resp.json()

    def test_frames_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/score-replay/frames",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_score_replay(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        endpoint_map = resp.json().get("endpoint_map", {})
        assert "score_replay" in endpoint_map
