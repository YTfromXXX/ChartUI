"""Tests for GET /api/v1/qpu/observe — A地点/B地点 OS識別 + MENTE座標空間."""

import os
import platform
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_oracle.qpu_router import router
from cure_oracle.mente import MENTE_CONST

os.environ.setdefault("CURE_API_TOKENS", '{}')   # dev mode: any bearer → OPERATOR

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ── TestObserveEndpoint ───────────────────────────────────────────────────────

class TestObserveEndpoint:
    def test_returns_200(self):
        r = client.get("/api/v1/qpu/observe")
        assert r.status_code == 200

    def test_has_point_a(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert "point_a" in data
        assert data["point_a"]["role"] == "quantum_state"

    def test_has_point_b(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert "point_b" in data
        assert data["point_b"]["role"] == "observer"

    def test_point_a_system_matches_server(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert data["point_a"]["system"] == platform.system()

    def test_point_a_python_matches(self):
        data = client.get("/api/v1/qpu/observe").json()
        expected = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        assert data["point_a"]["python"] == expected

    def test_mente_const_correct(self):
        import math
        data = client.get("/api/v1/qpu/observe").json()
        assert abs(data["mente_const"] - round(MENTE_CONST, 6)) < 1e-9

    def test_coordinate_space_has_four_axes(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert len(data["coordinate_space"]) == 4

    def test_coordinate_space_slots(self):
        data = client.get("/api/v1/qpu/observe").json()
        slots = {ax["slot"] for ax in data["coordinate_space"]}
        assert slots == {"S1", "S2", "S3", "S4"}

    def test_coordinate_space_kings(self):
        data = client.get("/api/v1/qpu/observe").json()
        kings = {ax["king"] for ax in data["coordinate_space"]}
        assert kings == {"多聞天", "増長天", "持国天", "広目天"}

    def test_s4_q_min_075(self):
        data = client.get("/api/v1/qpu/observe").json()
        s4 = next(ax for ax in data["coordinate_space"] if ax["slot"] == "S4")
        assert abs(s4["q_min"] - 0.75) < 1e-9
        assert abs(s4["q_max"] - 1.0)  < 1e-9

    def test_s2_q_min_0(self):
        data = client.get("/api/v1/qpu/observe").json()
        s2 = next(ax for ax in data["coordinate_space"] if ax["slot"] == "S2")
        assert abs(s2["q_min"] - 0.0)  < 1e-9
        assert abs(s2["q_max"] - 0.25) < 1e-9

    def test_basis_string(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert data["basis"] == "四天王座標系 φ×√2"

    def test_axes_cover_full_q_range(self):
        data = client.get("/api/v1/qpu/observe").json()
        mins = {ax["q_min"] for ax in data["coordinate_space"]}
        maxs = {ax["q_max"] for ax in data["coordinate_space"]}
        assert 0.0 in mins
        assert 1.0 in maxs

    def test_user_agent_reflected_in_point_b(self):
        r = client.get("/api/v1/qpu/observe",
                       headers={"User-Agent": "PopKivyDevice/1.0"})
        assert r.json()["point_b"]["system"] == "PopKivyDevice/1.0"

    def test_no_auth_still_200_viewer_role(self):
        # VIEWER role is sufficient for /observe
        r = client.get("/api/v1/qpu/observe")
        assert r.status_code == 200
