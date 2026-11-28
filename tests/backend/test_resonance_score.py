"""tests/backend/test_resonance_score.py — Phase M: Resonance-Score tests.

cure-{era}-r5 — 24 tests in 2 classes:
  TestResonanceScoreModule   (16 tests) — unit tests for resonance_score.py
  TestResonanceStreamEndpoint (8 tests) — FastAPI /candy/resonance/stream SSE
"""

from __future__ import annotations

import json
import os
import sys
from typing import Iterator
from unittest.mock import AsyncMock, MagicMock, patch

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


@pytest.fixture()
def _patch_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch asyncio.sleep in qpu_router to a no-op coroutine."""
    async def _noop(_delay: float) -> None:
        pass
    monkeypatch.setattr("cure_oracle.qpu_router.asyncio.sleep", _noop)


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_sim_result():
    """Return a minimal QuantumSimResult-like mock for resonance_score tests."""
    score_mock = MagicMock()
    score_mock.bpm  = 120
    score_mock.bars = 4
    score_mock.events = []

    r = MagicMock()
    r.era            = "baroque"
    r.mente_total    = 1.5
    r.mente_achieved = False
    r.fused_shapes   = ["LINE", "CUBE"]
    r.fusion_note    = "test fusion"
    r.score          = score_mock
    return r


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestResonanceScoreModule ───────────────────────────────────────────────────

class TestResonanceScoreModule:
    """Unit tests for cure_oracle/resonance_score.py (cure-{era}-r5)."""

    def test_current_rev_is_5(self):
        from cure_oracle.resonance_score import CURRENT_REV
        assert CURRENT_REV == 5

    def test_coin_labels_length(self):
        from cure_oracle.resonance_score import COIN_LABELS
        assert len(COIN_LABELS) == 6

    def test_coin_labels_values(self):
        from cure_oracle.resonance_score import COIN_LABELS
        assert COIN_LABELS == ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"]

    def test_ppqn_480(self):
        from cure_oracle.resonance_score import _PPQN
        assert _PPQN == 480

    def test_build_returns_resonance_frame(self):
        from cure_oracle.resonance_score import build_resonance_frame, ResonanceFrame
        frame = build_resonance_frame(_make_sim_result())
        assert isinstance(frame, ResonanceFrame)

    def test_frame_has_frame_id(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert frame.frame_id and len(frame.frame_id) > 8

    def test_frame_version_contains_r5(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert frame.version.endswith("-r5")

    def test_frame_era_matches_sim(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert frame.era == "baroque"

    def test_frame_cut_value_positive(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert frame.cut_value > 0.0

    def test_frame_has_6_notes(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert len(frame.notes) == 6

    def test_frame_has_4_channels(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert len(frame.channels) == 4

    def test_partition_covers_all_coins(self):
        from cure_oracle.resonance_score import build_resonance_frame, COIN_LABELS
        frame = build_resonance_frame(_make_sim_result())
        combined = set(frame.partition_0) | set(frame.partition_1)
        assert combined == set(COIN_LABELS)

    def test_channel_indices_0_to_3(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        indices = {c.index for c in frame.channels}
        assert indices == {0, 1, 2, 3}

    def test_note_velocities_in_range(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        for n in frame.notes:
            assert 0 <= n.velocity <= 127

    def test_fusion_note_non_empty(self):
        from cure_oracle.resonance_score import build_resonance_frame
        frame = build_resonance_frame(_make_sim_result())
        assert frame.fusion_note and len(frame.fusion_note) > 0

    def test_custom_bits_respected(self):
        from cure_oracle.resonance_score import build_resonance_frame
        # all group-0 → p1 empty
        frame = build_resonance_frame(_make_sim_result(), bits=[0, 0, 0, 0, 0, 0])
        assert frame.partition_1 == []
        assert len(frame.partition_0) == 6


# ── TestResonanceStreamEndpoint ───────────────────────────────────────────────

class TestResonanceStreamEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/resonance/stream."""

    def test_stream_200_ok(self, _patch_sleep):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "LINE", "token": "testtoken123", "frames": 1},
        )
        assert resp.status_code == 200

    def test_stream_requires_token_401(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "LINE", "frames": 1},
        )
        assert resp.status_code in (401, 403, 422)

    def test_stream_content_type_sse(self, _patch_sleep):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "LINE", "token": "testtoken123", "frames": 1},
        )
        assert "text/event-stream" in resp.headers.get("content-type", "")

    def test_stream_has_resonance_update_event(self, _patch_sleep):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "LINE", "token": "testtoken123", "frames": 1},
        )
        assert "event: resonance_update" in resp.text

    def test_stream_resonance_update_has_cut_value(self, _patch_sleep):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "LINE", "token": "testtoken123", "frames": 1},
        )
        lines = resp.text.splitlines()
        data_lines = [l for l in lines if l.startswith("data:") and "resonance_update" in l]
        assert len(data_lines) >= 1
        payload = json.loads(data_lines[0][len("data:"):].strip())
        assert "cut_value" in payload["data"]

    def test_stream_has_stream_end(self, _patch_sleep):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "LINE", "token": "testtoken123", "frames": 1},
        )
        assert "event: stream_end" in resp.text

    def test_stream_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/resonance/stream",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123", "frames": 1},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_resonance_stream(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        endpoint_map = resp.json().get("endpoint_map", {})
        assert "resonance_stream" in endpoint_map
