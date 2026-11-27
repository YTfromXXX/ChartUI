"""tests/backend/test_midi_export.py — Phase N: MIDI Export tests.

cure-{era}-r6 — 24 tests in 2 classes:
  TestMidiExportModule    (16 tests) — unit tests for midi_export.py
  TestMidiExportEndpoint   (8 tests) — FastAPI POST /candy/export/midi
"""

from __future__ import annotations

import os
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

def _make_midi_viz_frame():
    """Return a minimal MidiVizFrame-like mock."""
    note = MagicMock()
    note.tick           = 0
    note.channel        = 0
    note.note           = 60
    note.velocity       = 80
    note.duration_ticks = 240

    ch = MagicMock()
    ch.index        = 0
    ch.name         = "大甲音"
    ch.note_count   = 1
    ch.avg_velocity = 80.0
    ch.active       = True

    frame = MagicMock()
    frame.frame_id       = "test-frame-id"
    frame.born_at        = "2026-01-01T00:00:00+00:00"
    frame.era            = "baroque"
    frame.version        = "cure-baroque-r4"
    frame.bpm            = 120
    frame.bars           = 4
    frame.ppqn           = 480
    frame.mente_total    = 1.5
    frame.mente_achieved = False
    frame.fusion_note    = "test fusion"
    frame.fused_shapes   = ["LINE"]
    frame.notes          = [note]
    frame.channels       = [ch]
    return frame


def _make_events():
    return [{"tick": 0, "channel": 0, "note": 60, "velocity": 80, "duration_ticks": 240}]


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestMidiExportModule ──────────────────────────────────────────────────────

class TestMidiExportModule:
    """Unit tests for cure_oracle/midi_export.py (cure-{era}-r6)."""

    def test_current_rev_is_6(self):
        from cure_oracle.midi_export import CURRENT_REV
        assert CURRENT_REV == 6

    def test_vlq_single_byte(self):
        from cure_oracle.midi_export import _vlq
        assert _vlq(0)   == b"\x00"
        assert _vlq(127) == b"\x7f"

    def test_vlq_multibyte(self):
        from cure_oracle.midi_export import _vlq
        assert _vlq(128) == b"\x81\x00"
        assert _vlq(255) == b"\x81\x7f"

    def test_vlq_negative_raises(self):
        from cure_oracle.midi_export import _vlq
        with pytest.raises(ValueError):
            _vlq(-1)

    def test_events_to_midi_bytes_has_mthd(self):
        from cure_oracle.midi_export import events_to_midi_bytes
        data = events_to_midi_bytes(_make_events())
        assert data[:4] == b"MThd"

    def test_events_to_midi_bytes_has_mtrk(self):
        from cure_oracle.midi_export import events_to_midi_bytes
        data = events_to_midi_bytes(_make_events())
        assert b"MTrk" in data

    def test_events_to_midi_bytes_format_0(self):
        from cure_oracle.midi_export import events_to_midi_bytes
        data = events_to_midi_bytes(_make_events())
        # MThd length=6, format=0
        _, length, fmt = struct.unpack(">4sIH", data[:10])
        assert length == 6
        assert fmt == 0

    def test_events_to_midi_bytes_ppqn(self):
        from cure_oracle.midi_export import events_to_midi_bytes
        data = events_to_midi_bytes(_make_events(), ppqn=480)
        ppqn = struct.unpack(">H", data[12:14])[0]
        assert ppqn == 480

    def test_events_to_midi_bytes_empty_events(self):
        from cure_oracle.midi_export import events_to_midi_bytes
        data = events_to_midi_bytes([])
        assert data[:4] == b"MThd"
        assert b"MTrk" in data

    def test_frame_to_midi_returns_result(self):
        from cure_oracle.midi_export import frame_to_midi, MidiExportResult
        result = frame_to_midi(_make_midi_viz_frame())
        assert isinstance(result, MidiExportResult)

    def test_frame_to_midi_version_contains_r6(self):
        from cure_oracle.midi_export import frame_to_midi
        result = frame_to_midi(_make_midi_viz_frame())
        assert result.version.endswith("-r6")

    def test_frame_to_midi_era_matches(self):
        from cure_oracle.midi_export import frame_to_midi
        result = frame_to_midi(_make_midi_viz_frame())
        assert result.era == "baroque"

    def test_frame_to_midi_midi_bytes_non_empty(self):
        from cure_oracle.midi_export import frame_to_midi
        result = frame_to_midi(_make_midi_viz_frame())
        assert isinstance(result.midi_bytes, bytes)
        assert len(result.midi_bytes) > 14  # at least MThd

    def test_frame_to_midi_track_count_1(self):
        from cure_oracle.midi_export import frame_to_midi
        result = frame_to_midi(_make_midi_viz_frame())
        assert result.track_count == 1

    def test_frame_to_midi_event_count(self):
        from cure_oracle.midi_export import frame_to_midi
        result = frame_to_midi(_make_midi_viz_frame())
        assert result.event_count == 1  # one note in mock frame

    def test_frame_to_midi_duration_positive(self):
        from cure_oracle.midi_export import frame_to_midi
        result = frame_to_midi(_make_midi_viz_frame())
        assert result.duration_seconds > 0.0


# ── TestMidiExportEndpoint ────────────────────────────────────────────────────

class TestMidiExportEndpoint:
    """FastAPI integration tests for POST /api/v1/qpu/candy/export/midi."""

    def test_export_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["LINE"], "round_num": 1, "bars": 4, "source": "midi_viz"},
            params={"token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_export_requires_token_401(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["LINE"], "round_num": 1, "bars": 4, "source": "midi_viz"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_export_content_type_audio_midi(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["LINE"], "round_num": 1, "bars": 4, "source": "midi_viz"},
            params={"token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "audio/midi" in resp.headers.get("content-type", "")

    def test_export_body_starts_with_mthd(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["LINE"], "round_num": 1, "bars": 4, "source": "midi_viz"},
            params={"token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.content[:4] == b"MThd"

    def test_export_header_x_export_id(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["LINE"], "round_num": 1, "bars": 4, "source": "midi_viz"},
            params={"token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "x-export-id" in resp.headers

    def test_export_resonance_source(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["LINE"], "round_num": 1, "bars": 4, "source": "resonance"},
            params={"token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.content[:4] == b"MThd"

    def test_export_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/qpu/candy/export/midi",
            json={"shapes": ["INVALID_SHAPE"], "round_num": 1, "bars": 4, "source": "midi_viz"},
            params={"token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_export_midi(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        endpoint_map = resp.json().get("endpoint_map", {})
        assert "export_midi" in endpoint_map
