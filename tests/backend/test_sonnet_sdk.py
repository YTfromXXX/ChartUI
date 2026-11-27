"""Tests for cure_oracle/sonnet_sdk.py.

All HTTP calls are mocked via pytest-monkeypatch / unittest.mock.
No live server or network access required.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from cure_oracle.sonnet_sdk import SonnetScoreClient, to_midi_events, _PPQN


# ── fixtures ──────────────────────────────────────────────────────────────────

_SCORE_RESPONSE: dict[str, Any] = {
    "score_id":       "test-score-id-001",
    "born_at":        "2026-11-27T00:00:00+00:00",
    "bpm":            120,
    "bars":           4,
    "tilt_rate":      50.0,
    "ascent_rate":    42.5,
    "mente_total":    1.145,
    "mente_achieved": False,
    "key":            "D",
    "mode_name":      "dorian",
    "era":            "classical",
    "events": [
        {
            "beat": 1.0, "duration": 2.0, "register": "大甲音",
            "motif": "scale_run", "intensity": 0.80, "embellishment": None,
        },
        {
            "beat": 3.0, "duration": 1.0, "register": "甲音",
            "motif": "arpeggio", "intensity": 0.55, "embellishment": None,
        },
    ],
    "board_1":        {"name": "drive_board_1", "cols": 4, "rows": 4, "cells": [], "grid": []},
    "board_2":        {"name": "drive_board_2", "cols": 8, "rows": 4, "cells": [], "grid": []},
    "embellishments": [],
    "commentary":     "test commentary",
    "observe_receipt": {"merkle": {"root": "0xdeadbeef"}},
}

_REMIX_RESPONSE: dict[str, Any] = {
    **_SCORE_RESPONSE,
    "remix": {
        "tempo_modifier":  1.135,
        "layer_intensity": 0.80,
        "instrument_set":  ["harp", "strings", "flute"],
        "loop_signature":  "3/4",
        "bmi_influence":   "focus↑ → melody clarity; calm↑ → steady tempo; energy↑ → rhythmic drive",
        "export_hint":     "MIDI-compatible event stream at 480 PPQN",
    },
}


def _make_mock_response(data: dict, status_code: int = 200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.json.return_value = data
    mock.raise_for_status = MagicMock()
    if status_code >= 400:
        from httpx import HTTPStatusError
        mock.raise_for_status.side_effect = HTTPStatusError(
            "error", request=MagicMock(), response=mock
        )
    return mock


# ── SonnetScoreClient initialisation ─────────────────────────────────────────

class TestClientInit:
    def test_default_base_url(self):
        c = SonnetScoreClient()
        assert c._base_url == "http://localhost:8000"

    def test_custom_base_url_strips_slash(self):
        c = SonnetScoreClient(base_url="http://myserver:9000/")
        assert c._base_url == "http://myserver:9000"

    def test_token_stored(self):
        c = SonnetScoreClient(token="abc123")
        assert c._token == "abc123"

    def test_headers_with_token(self):
        c = SonnetScoreClient(token="mytoken")
        h = c._headers()
        assert h["Authorization"] == "Bearer mytoken"
        assert h["Content-Type"] == "application/json"

    def test_headers_without_token(self):
        c = SonnetScoreClient()
        h = c._headers()
        assert "Authorization" not in h


# ── compute() ────────────────────────────────────────────────────────────────

class TestComputeMethod:
    def _client(self):
        return SonnetScoreClient(base_url="http://test", token="tok")

    @patch("httpx.post")
    def test_compute_returns_dict(self, mock_post):
        mock_post.return_value = _make_mock_response(_SCORE_RESPONSE)
        result = self._client().compute(["LINE", "CUBE"])
        assert isinstance(result, dict)
        assert result["score_id"] == "test-score-id-001"

    @patch("httpx.post")
    def test_compute_posts_correct_path(self, mock_post):
        mock_post.return_value = _make_mock_response(_SCORE_RESPONSE)
        self._client().compute(["LINE"])
        url = mock_post.call_args[0][0]
        assert url.endswith("/api/v1/qpu/candy/sonnet")

    @patch("httpx.post")
    def test_compute_payload_contains_shapes(self, mock_post):
        mock_post.return_value = _make_mock_response(_SCORE_RESPONSE)
        self._client().compute(["CUBE", "RING"])
        payload = mock_post.call_args[1]["json"]
        assert payload["shapes"] == ["CUBE", "RING"]

    @patch("httpx.post")
    def test_compute_shots_included_when_given(self, mock_post):
        mock_post.return_value = _make_mock_response(_SCORE_RESPONSE)
        self._client().compute(["LINE"], shots=512)
        payload = mock_post.call_args[1]["json"]
        assert payload["shots"] == 512

    @patch("httpx.post")
    def test_compute_shots_omitted_when_none(self, mock_post):
        mock_post.return_value = _make_mock_response(_SCORE_RESPONSE)
        self._client().compute(["LINE"], shots=None)
        payload = mock_post.call_args[1]["json"]
        assert "shots" not in payload

    @patch("httpx.post")
    def test_compute_default_mode_local(self, mock_post):
        mock_post.return_value = _make_mock_response(_SCORE_RESPONSE)
        self._client().compute(["STAR"])
        payload = mock_post.call_args[1]["json"]
        assert payload["mode"] == "local"


# ── remix() ───────────────────────────────────────────────────────────────────

class TestRemixMethod:
    def _client(self):
        return SonnetScoreClient(base_url="http://test", token="tok")

    @patch("httpx.post")
    def test_remix_returns_dict_with_remix_key(self, mock_post):
        mock_post.return_value = _make_mock_response(_REMIX_RESPONSE)
        result = self._client().remix(["LINE"])
        assert "remix" in result

    @patch("httpx.post")
    def test_remix_posts_correct_path(self, mock_post):
        mock_post.return_value = _make_mock_response(_REMIX_RESPONSE)
        self._client().remix(["CUBE"])
        url = mock_post.call_args[0][0]
        assert url.endswith("/api/v1/qpu/candy/sonnet/remix")

    @patch("httpx.post")
    def test_remix_includes_bmi_state(self, mock_post):
        mock_post.return_value = _make_mock_response(_REMIX_RESPONSE)
        bmi = {"focus": 0.72, "calm": 0.55, "energy": 0.80}
        self._client().remix(["LINE"], bmi_state=bmi)
        payload = mock_post.call_args[1]["json"]
        assert payload["bmi_state"] == bmi

    @patch("httpx.post")
    def test_remix_bmi_state_omitted_when_none(self, mock_post):
        mock_post.return_value = _make_mock_response(_REMIX_RESPONSE)
        self._client().remix(["LINE"], bmi_state=None)
        payload = mock_post.call_args[1]["json"]
        assert "bmi_state" not in payload

    @patch("httpx.post")
    def test_remix_style_forwarded(self, mock_post):
        mock_post.return_value = _make_mock_response(_REMIX_RESPONSE)
        self._client().remix(["RING"], remix_style="electronic")
        payload = mock_post.call_args[1]["json"]
        assert payload["remix_style"] == "electronic"


# ── stream() ─────────────────────────────────────────────────────────────────

class TestStreamMethod:
    def _client(self):
        return SonnetScoreClient(base_url="http://test", token="tok")

    def _make_sse_lines(self, events: list[dict]) -> list[str]:
        lines = []
        for ev in events:
            lines.append(f"data: {json.dumps(ev)}")
            lines.append("")
        return lines

    @patch("httpx.Client")
    def test_stream_calls_callback_for_each_event(self, _mock_client):
        events = [
            {"type": "score_update", "data": {"bpm": 120}},
            {"type": "ascent_tick",  "ascent_rate": 42.5, "bpm": 120, "era": "classical"},
            {"type": "stream_end"},
        ]
        lines = self._make_sse_lines(events)

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.iter_lines.return_value = iter(lines)
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch("httpx.stream", return_value=mock_resp):
            received = []
            self._client().stream(["LINE"], callback=received.append)

        assert len(received) >= 1
        assert received[-1]["type"] == "stream_end"

    @patch("httpx.stream")
    def test_stream_stops_at_stream_end(self, mock_stream):
        events = [
            {"type": "score_update", "data": {}},
            {"type": "stream_end"},
            {"type": "score_update", "data": {}},  # should not be delivered
        ]
        lines = self._make_sse_lines(events)
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.iter_lines.return_value = iter(lines)
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_stream.return_value = mock_resp

        received = []
        self._client().stream(["LINE"], callback=received.append)

        types = [e["type"] for e in received]
        assert "stream_end" in types
        # Events after stream_end should not arrive
        stream_end_idx = types.index("stream_end")
        assert len(types) == stream_end_idx + 1


# ── to_midi_events() ─────────────────────────────────────────────────────────

class TestToMidiEvents:
    def test_returns_list(self):
        result = to_midi_events(_SCORE_RESPONSE)
        assert isinstance(result, list)

    def test_one_event_per_score_event(self):
        result = to_midi_events(_SCORE_RESPONSE)
        assert len(result) == len(_SCORE_RESPONSE["events"])

    def test_midi_event_has_required_keys(self):
        result = to_midi_events(_SCORE_RESPONSE)
        for ev in result:
            for key in ("tick", "channel", "note", "velocity", "duration_ticks"):
                assert key in ev, f"missing key {key}"

    def test_channel_mapping_daikou(self):
        # 大甲音 → channel 0
        result = to_midi_events(_SCORE_RESPONSE)
        daikou = next(ev for ev in result if _SCORE_RESPONSE["events"]
                      [result.index(ev)]["register"] == "大甲音")
        assert daikou["channel"] == 0

    def test_channel_mapping_kouin(self):
        # 甲音 → channel 1
        result = to_midi_events(_SCORE_RESPONSE)
        kouin = next(ev for ev in result if _SCORE_RESPONSE["events"]
                     [result.index(ev)]["register"] == "甲音")
        assert kouin["channel"] == 1

    def test_note_in_midi_range(self):
        result = to_midi_events(_SCORE_RESPONSE)
        for ev in result:
            assert 0 <= ev["note"] <= 127

    def test_velocity_in_midi_range(self):
        result = to_midi_events(_SCORE_RESPONSE)
        for ev in result:
            assert 1 <= ev["velocity"] <= 127

    def test_tick_offset_from_beat(self):
        result = to_midi_events(_SCORE_RESPONSE)
        # beat=1.0 → tick 0
        first = result[0]
        assert first["tick"] == 0

    def test_duration_ticks_from_duration(self):
        result = to_midi_events(_SCORE_RESPONSE)
        # duration=2.0 → 2 × PPQN ticks
        first = result[0]
        assert first["duration_ticks"] == 2 * _PPQN

    def test_empty_events_returns_empty_list(self):
        empty_score = {**_SCORE_RESPONSE, "events": []}
        result = to_midi_events(empty_score)
        assert result == []

    def test_bass_register_negative_octave(self):
        score = {
            **_SCORE_RESPONSE,
            "events": [{
                "beat": 1.0, "duration": 1.0, "register": "呂音-bass",
                "motif": "block_chord", "intensity": 0.5, "embellishment": None,
            }],
        }
        result = to_midi_events(score)
        assert result[0]["channel"] == 3
        assert result[0]["note"] < 60   # bass register is below middle C
