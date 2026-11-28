"""tests/backend/test_knot_score.py — Phase Q: Knot Score Engine tests.

cure-{era}-r9 — 24 tests in 2 classes:
  TestKnotScoreModule    (16 tests) — unit tests for knot_score.py
  TestKnotScoreEndpoint   (8 tests) — FastAPI GET /candy/knot-score/frame

Reference: 246 knots (knots3d.com) × 12 pitch classes × 4 vertical strip voices
  (fig 13) × Magic Circle 12×16 (fig 9/14) × GarageBand 2×8 grid (fig 14).
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
    r.era         = era
    r.mente_total = mente_total
    r.fused_shapes = ["LINE"]
    return r


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestKnotScoreModule ───────────────────────────────────────────────────────

class TestKnotScoreModule:
    """Unit tests for cure_oracle/knot_score.py (cure-{era}-r9)."""

    def test_current_rev_is_9(self):
        from cure_oracle.knot_score import CURRENT_REV
        assert CURRENT_REV == 9

    def test_pitch_names_12(self):
        from cure_oracle.knot_score import PITCH_NAMES
        assert len(PITCH_NAMES) == 12
        assert PITCH_NAMES[0] == "C"
        assert PITCH_NAMES[11] == "B"

    def test_classify_moyai_is_loop(self):
        from cure_oracle.knot_score import classify_knot_pitch
        assert classify_knot_pitch("もやい結び") == 1   # C# (loop)

    def test_classify_hitch(self):
        from cure_oracle.knot_score import classify_knot_pitch
        assert classify_knot_pitch("巻き結び") == 2   # D (simple hitch)

    def test_classify_trefoil_topology(self):
        from cure_oracle.knot_score import classify_knot_pitch
        assert classify_knot_pitch("三葉結び目") == 11  # B (topological)

    def test_classify_coil(self):
        from cure_oracle.knot_score import classify_knot_pitch
        assert classify_knot_pitch("ギャスケット・コイル") == 10  # A#

    def test_bow_to_filter_hz_normale(self):
        from cure_oracle.knot_score import bow_to_filter_hz
        assert abs(bow_to_filter_hz(0.0) - 4000.0) < 1

    def test_bow_to_filter_hz_underwater(self):
        from cure_oracle.knot_score import bow_to_filter_hz
        assert abs(bow_to_filter_hz(1.0) - 200.0) < 1

    def test_bow_to_filter_hz_midpoint(self):
        from cure_oracle.knot_score import bow_to_filter_hz
        hz = bow_to_filter_hz(0.5)
        assert 500 < hz < 3000

    def test_duration_sec_to_ticks(self):
        from cure_oracle.knot_score import duration_sec_to_ticks
        ticks = duration_sec_to_ticks(1.0, bpm=120, ppqn=480)
        assert ticks == 960  # 1 sec at 120 BPM × 480 PPQN

    def test_build_returns_knot_score_frame(self):
        from cure_oracle.knot_score import build_knot_score_frame, KnotScoreFrame
        frame = build_knot_score_frame(_make_sim_result())
        assert isinstance(frame, KnotScoreFrame)

    def test_frame_version_contains_r9(self):
        from cure_oracle.knot_score import build_knot_score_frame
        frame = build_knot_score_frame(_make_sim_result())
        assert frame.version.endswith("-r9")

    def test_frame_has_4_strips(self):
        from cure_oracle.knot_score import build_knot_score_frame
        frame = build_knot_score_frame(_make_sim_result())
        assert len(frame.strips) == 4

    def test_magic_circle_12x16(self):
        from cure_oracle.knot_score import build_knot_score_frame
        frame = build_knot_score_frame(_make_sim_result())
        mc = frame.magic_circle
        assert mc.positions == 12
        assert mc.t_steps   == 16
        assert len(mc.placements)    == 12
        assert all(len(row) == 16 for row in mc.placements)

    def test_gb_grid_shape(self):
        from cure_oracle.knot_score import build_knot_score_frame
        frame = build_knot_score_frame(_make_sim_result())
        gb = frame.gb_grid
        assert gb.rows == 8
        assert gb.cols == 2
        assert len(gb.cells) == 8
        assert all(len(row) == 2 for row in gb.cells)

    def test_throw_arc_has_16_points(self):
        from cure_oracle.knot_score import build_knot_score_frame
        frame = build_knot_score_frame(_make_sim_result())
        assert len(frame.magic_circle.throw_arc) == 16


# ── TestKnotScoreEndpoint ─────────────────────────────────────────────────────

class TestKnotScoreEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/knot-score/frame."""

    def test_frame_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_frame_requires_token_401(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_frame_has_frame_id(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "frame_id" in resp.json()

    def test_frame_version_r9(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["version"].endswith("-r9")

    def test_frame_has_magic_circle(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "magic_circle" in resp.json()
        assert resp.json()["magic_circle"]["positions"] == 12

    def test_frame_has_gb_grid(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "gb_grid" in resp.json()
        assert resp.json()["gb_grid"]["rows"] == 8

    def test_frame_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/knot-score/frame",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_knot_score(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        endpoint_map = resp.json().get("endpoint_map", {})
        assert "knot_score" in endpoint_map
