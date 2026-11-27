"""Tests for cure_oracle/mesh_score.py and Phase J endpoints.

Phase J: cure-{era}-r2 — free-curve mesh → musical note converter.

Coverage
--------
  TestGridConfig        — defaults, beat_range, total_beats
  TestRawPoint          — clamping at [0,1]
  TestMeshStroke        — validity, spans, mean, path_length, curvature, oscillation
  TestYToRegister       — all 4 zones + boundary conditions
  TestClassifyMotif     — all 5 motif types
  TestStrokeHelpers     — x_to_beat, duration, intensity
  TestStrokesToScore    — empty, single, multi, sort, era validation
  TestEraFromMente      — all 5 era thresholds
  TestMeshScoreEndpoint — POST /candy/sonnet/mesh-score (FastAPI TestClient)
  TestVersionEndpoint   — GET /candy/sonnet/version
"""

from __future__ import annotations

import json
import math
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from cure_oracle.mesh_score import (
    CURRENT_REV,
    ERA_MENTE_LOWER,
    VALID_ERAS,
    GridConfig,
    MeshStroke,
    NoteEvent,
    RawPoint,
    _classify_motif,
    _stroke_intensity,
    _x_to_beat,
    _xspan_to_duration,
    _y_to_register,
    era_from_mente,
    stroke_from_dict,
    strokes_to_score,
)

# ── auth fixture ──────────────────────────────────────────────────────────────

_TEST_TOKEN = "phj-test-token"


@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch):
    monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_TOKEN: "operator"}))


def _headers():
    return {"Authorization": f"Bearer {_TEST_TOKEN}"}


@pytest.fixture()
def client():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    from cure_oracle.security import SecurityAuditMiddleware
    app = FastAPI()
    app.add_middleware(SecurityAuditMiddleware)
    app.include_router(router)
    return TestClient(app, raise_server_exceptions=True)


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_stroke(*xy: tuple[float, float]) -> MeshStroke:
    return MeshStroke([RawPoint(x, y) for x, y in xy])


def _horizontal(n=5, x0=0.0, x1=0.8, y=0.1) -> MeshStroke:
    pts = [RawPoint(x0 + (x1 - x0) * i / (n - 1), y) for i in range(n)]
    return MeshStroke(pts)


def _zigzag(n=10, y_lo=0.1, y_hi=0.3) -> MeshStroke:
    pts = [RawPoint(i / (n - 1), y_lo if i % 2 == 0 else y_hi) for i in range(n)]
    return MeshStroke(pts)


def _arc(n=8) -> MeshStroke:
    pts = [
        RawPoint(0.5 + 0.4 * math.cos(math.pi * i / (n - 1)),
                 0.5 + 0.3 * math.sin(math.pi * i / (n - 1)))
        for i in range(n)
    ]
    return MeshStroke(pts)


# ── TestGridConfig ─────────────────────────────────────────────────────────────

class TestGridConfig:
    def test_defaults(self):
        cfg = GridConfig()
        assert cfg.cols == 16
        assert cfg.rows == 12
        assert cfg.bpm == 120
        assert cfg.bars == 4
        assert cfg.beats_per_bar == 4

    def test_beat_range_start(self):
        cfg = GridConfig(bars=4, beats_per_bar=4)
        lo, hi = cfg.beat_range()
        assert lo == 1.0

    def test_beat_range_end(self):
        cfg = GridConfig(bars=4, beats_per_bar=4)
        lo, hi = cfg.beat_range()
        assert hi == 17.0

    def test_total_beats(self):
        cfg = GridConfig(bars=2, beats_per_bar=3)
        assert cfg.total_beats() == 6


# ── TestRawPoint ───────────────────────────────────────────────────────────────

class TestRawPoint:
    def test_valid_range(self):
        p = RawPoint(0.5, 0.5)
        assert p.x == 0.5 and p.y == 0.5

    def test_clamp_above_one(self):
        p = RawPoint(1.5, 2.0)
        assert p.x == 1.0 and p.y == 1.0

    def test_clamp_below_zero(self):
        p = RawPoint(-0.5, -1.0)
        assert p.x == 0.0 and p.y == 0.0

    def test_timestamp_default(self):
        p = RawPoint(0.3, 0.3)
        assert p.t == 0.0


# ── TestMeshStroke ─────────────────────────────────────────────────────────────

class TestMeshStroke:
    def test_valid_two_points(self):
        s = _make_stroke((0.0, 0.0), (1.0, 1.0))
        assert s.is_valid()

    def test_invalid_one_point(self):
        s = MeshStroke([RawPoint(0.5, 0.5)])
        assert not s.is_valid()

    def test_x_span(self):
        s = _make_stroke((0.1, 0.5), (0.9, 0.5))
        assert abs(s.x_span() - 0.8) < 1e-9

    def test_y_span(self):
        s = _make_stroke((0.5, 0.2), (0.5, 0.8))
        assert abs(s.y_span() - 0.6) < 1e-9

    def test_mean_x(self):
        s = _make_stroke((0.0, 0.5), (1.0, 0.5))
        assert abs(s.mean_x() - 0.5) < 1e-9

    def test_mean_y(self):
        s = _make_stroke((0.5, 0.2), (0.5, 0.8))
        assert abs(s.mean_y() - 0.5) < 1e-9

    def test_path_length_straight(self):
        s = _make_stroke((0.0, 0.0), (1.0, 0.0))
        assert abs(s.path_length() - 1.0) < 1e-9

    def test_curvature_straight_line(self):
        s = _horizontal()
        assert s.curvature_index() < 0.05  # nearly 0 for a straight line

    def test_curvature_arc_high(self):
        s = _arc()
        assert s.curvature_index() > 0.1

    def test_oscillation_monotone(self):
        s = _horizontal()
        assert s.oscillation_index() < 0.1

    def test_oscillation_zigzag(self):
        s = _zigzag(n=20)
        assert s.oscillation_index() > 0.5


# ── TestYToRegister ───────────────────────────────────────────────────────────

class TestYToRegister:
    def test_top_zone_daikou(self):
        assert _y_to_register(0.10) == "大甲音"

    def test_second_zone_kou(self):
        assert _y_to_register(0.37) == "甲音"

    def test_third_zone_ryo(self):
        assert _y_to_register(0.62) == "呂音"

    def test_bottom_zone_bass(self):
        assert _y_to_register(0.90) == "呂音-bass"

    def test_boundary_025(self):
        assert _y_to_register(0.25) == "甲音"

    def test_boundary_050(self):
        assert _y_to_register(0.50) == "呂音"

    def test_boundary_075(self):
        assert _y_to_register(0.75) == "呂音-bass"

    def test_top_exactly_zero(self):
        assert _y_to_register(0.0) == "大甲音"


# ── TestClassifyMotif ─────────────────────────────────────────────────────────

class TestClassifyMotif:
    def test_scale_run_long_horizontal(self):
        s = _horizontal(n=10, x0=0.0, x1=0.9)
        assert _classify_motif(s) == "scale_run"

    def test_tremolo_zigzag(self):
        s = _zigzag(n=20)
        assert _classify_motif(s) == "tremolo"

    def test_arpeggio_arc(self):
        s = _arc(n=12)
        assert _classify_motif(s) == "arpeggio"

    def test_staccato_very_short(self):
        s = _make_stroke((0.50, 0.1), (0.54, 0.12))
        assert _classify_motif(s) == "staccato_burst"

    def test_block_chord_vertical(self):
        pts = [RawPoint(0.5, 0.1 * i / 9) for i in range(10)]
        s = MeshStroke(pts)
        assert _classify_motif(s) == "block_chord"

    def test_invalid_stroke_defaults_scale_run(self):
        s = MeshStroke([])
        assert _classify_motif(s) == "scale_run"


# ── TestStrokeHelpers ──────────────────────────────────────────────────────────

class TestStrokeHelpers:
    def test_x_to_beat_zero(self):
        cfg = GridConfig(bars=4, beats_per_bar=4)
        assert _x_to_beat(0.0, cfg) == 1.0

    def test_x_to_beat_one(self):
        cfg = GridConfig(bars=4, beats_per_bar=4)
        assert _x_to_beat(1.0, cfg) == 17.0

    def test_xspan_to_duration_half(self):
        cfg = GridConfig(bars=4, beats_per_bar=4)
        dur = _xspan_to_duration(0.5, cfg)
        assert abs(dur - 8.0) < 1e-9

    def test_xspan_minimum_duration(self):
        cfg = GridConfig()
        dur = _xspan_to_duration(0.001, cfg)
        assert dur == 0.25

    def test_intensity_longer_stroke_louder(self):
        short = _make_stroke((0.0, 0.5), (0.1, 0.5))
        long_ = _horizontal(n=10, x0=0.0, x1=0.9)
        assert _stroke_intensity(long_) >= _stroke_intensity(short)

    def test_intensity_range(self):
        s = _horizontal()
        v = _stroke_intensity(s)
        assert 0.1 <= v <= 1.0


# ── TestStrokesToScore ────────────────────────────────────────────────────────

class TestStrokesToScore:
    def test_empty_strokes_returns_empty_events(self):
        result = strokes_to_score([])
        assert result["events"] == []
        assert result["stroke_count"] == 0

    def test_single_valid_stroke(self):
        result = strokes_to_score([_horizontal()])
        assert len(result["events"]) == 1

    def test_events_sorted_by_beat(self):
        s1 = _horizontal(x0=0.5, x1=0.9)
        s2 = _horizontal(x0=0.0, x1=0.4)
        result = strokes_to_score([s1, s2])
        beats = [e["beat"] for e in result["events"]]
        assert beats == sorted(beats)

    def test_era_in_response(self):
        result = strokes_to_score([_horizontal()], era="romantic")
        assert result["era"] == "romantic"

    def test_version_string_format(self):
        result = strokes_to_score([_horizontal()], era="classical")
        assert result["version"] == f"cure-classical-r{CURRENT_REV}"

    def test_invalid_era_raises(self):
        with pytest.raises(ValueError, match="Unknown era"):
            strokes_to_score([_horizontal()], era="grunge")

    def test_dict_input_accepted(self):
        raw = [{"x": 0.1, "y": 0.1}, {"x": 0.9, "y": 0.1}]
        result = strokes_to_score([raw])
        assert len(result["events"]) == 1

    def test_event_has_required_keys(self):
        result = strokes_to_score([_horizontal()])
        for ev in result["events"]:
            for k in ("beat", "duration", "register", "motif", "intensity"):
                assert k in ev

    def test_register_top_zone(self):
        s = _horizontal(y=0.10)
        result = strokes_to_score([s])
        assert result["events"][0]["register"] == "大甲音"

    def test_register_bass_zone(self):
        s = _horizontal(y=0.85)
        result = strokes_to_score([s])
        assert result["events"][0]["register"] == "呂音-bass"


# ── TestEraFromMente ──────────────────────────────────────────────────────────

class TestEraFromMente:
    def test_zero_is_baroque(self):
        assert era_from_mente(0.0) == "baroque"

    def test_classical_threshold(self):
        assert era_from_mente(0.57) == "classical"

    def test_beethoven_threshold(self):
        assert era_from_mente(1.14) == "beethoven"

    def test_romantic_threshold(self):
        assert era_from_mente(1.72) == "romantic"

    def test_inner_world_threshold(self):
        assert era_from_mente(2.29) == "inner_world"

    def test_just_below_classical_is_baroque(self):
        assert era_from_mente(0.569) == "baroque"

    def test_high_score_inner_world(self):
        assert era_from_mente(3.0) == "inner_world"


# ── TestMeshScoreEndpoint ─────────────────────────────────────────────────────

class TestMeshScoreEndpoint:
    def _body(self, era="baroque", strokes=None):
        if strokes is None:
            strokes = [[{"x": 0.0, "y": 0.1}, {"x": 0.5, "y": 0.1}, {"x": 0.9, "y": 0.1}]]
        return {"strokes": strokes, "era": era}

    def test_returns_200(self, client):
        r = client.post("/api/v1/qpu/candy/sonnet/mesh-score",
                        json=self._body(), headers=_headers())
        assert r.status_code == 200

    def test_response_has_events(self, client):
        r = client.post("/api/v1/qpu/candy/sonnet/mesh-score",
                        json=self._body(), headers=_headers())
        assert "events" in r.json()

    def test_response_version_field(self, client):
        r = client.post("/api/v1/qpu/candy/sonnet/mesh-score",
                        json=self._body(era="classical"), headers=_headers())
        assert r.json()["version"].startswith("cure-classical-r")

    def test_invalid_era_422(self, client):
        r = client.post("/api/v1/qpu/candy/sonnet/mesh-score",
                        json=self._body(era="grunge"), headers=_headers())
        assert r.status_code == 422

    def test_unauthenticated_4xx(self, client):
        r = client.post("/api/v1/qpu/candy/sonnet/mesh-score", json=self._body())
        assert r.status_code in (401, 403)

    def test_stroke_count_matches(self, client):
        body = self._body(strokes=[
            [{"x": 0.0, "y": 0.1}, {"x": 0.5, "y": 0.1}],
            [{"x": 0.1, "y": 0.6}, {"x": 0.8, "y": 0.6}],
        ])
        r = client.post("/api/v1/qpu/candy/sonnet/mesh-score",
                        json=body, headers=_headers())
        assert r.json()["stroke_count"] == 2


# ── TestVersionEndpoint ───────────────────────────────────────────────────────

class TestVersionEndpoint:
    def test_returns_200(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version")
        assert r.status_code == 200

    def test_default_baroque(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version")
        assert r.json()["era"] == "baroque"

    def test_mente_above_classical(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version?mente_total=0.6")
        assert r.json()["era"] == "classical"

    def test_mente_inner_world(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version?mente_total=2.5")
        assert r.json()["era"] == "inner_world"

    def test_version_string_present(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version?mente_total=1.14")
        data = r.json()
        assert "version" in data
        assert data["version"].startswith("cure-beethoven-r")

    def test_endpoint_map_has_mesh_score(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version")
        endpoints = r.json()["endpoint_map"]
        assert "mesh_score" in endpoints

    def test_rev_is_current(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version")
        assert r.json()["rev"] == CURRENT_REV
