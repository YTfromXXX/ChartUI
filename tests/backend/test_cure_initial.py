import json
import math
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_initial import (
    SPLIT_TOTAL,
    InitialSignals,
    _MENTE_CONST,
    _q_to_sig_parts,
    analyse,
    router,
)

FIXTURES = json.loads((Path(__file__).parents[1] / "fixtures" / "cure_initial_cases.json").read_text(encoding="utf-8"))


def client():
    app = FastAPI(); app.include_router(router); return TestClient(app)


@pytest.mark.parametrize("case", FIXTURES["cases"], ids=lambda c: c["name"])
def test_fixtures_match_expected(case):
    got = analyse(InitialSignals(**case["signals"])).model_dump()
    exp = case["expected"]
    assert got["grade"] == exp["grade"]
    assert got["scores"] == exp["scores"]
    assert got["confidence"] == exp["confidence"]
    assert [d["value"] for d in got["sync"]] == exp["sync"]
    assert [p["budget_ms"] for p in got["split"]] == exp["split"]


def test_grades_follow_the_table():
    names = {c["name"]: analyse(InitialSignals(**c["signals"])).grade for c in FIXTURES["cases"]}
    assert names == {"fast clicker": "A", "scalper hand": "B", "panel diver": "C", "eyes closed": "D", "nothing measured": "C", "tie A and B": "A"}


def test_split_is_2_4_6_7_of_19():
    a = analyse(InitialSignals(consent=True, haptic_budget_ms=19))
    assert SPLIT_TOTAL == 19
    assert [(p.key, p.layer, p.budget_ms) for p in a.split] == [("relax", 2, 2.0), ("drift", 4, 4.0), ("counter", 6, 6.0), ("oracle", 7, 7.0)]
    assert abs(sum(p.share for p in a.split) - 1) < 1e-5


def test_endpoint_round_trip_and_privacy():
    res = client().post("/api/v1/cure/initial-analysis", json={"consent": True, "eyes_closed_ms": 9000})
    assert res.status_code == 200
    body = res.json()
    assert body["schema_version"] == "cure-initial/1" and body["grade"] == "D" and body["level"] == "極"
    assert body["wallet_free"] is True and body["stored"] is False
    rest = {k: v for k, v in body.items() if k != "wallet_free"}
    assert not any(k in json.dumps(rest) for k in ("wallet", "address", "account_id"))


def test_consent_and_validation():
    c = client()
    assert c.post("/api/v1/cure/initial-analysis", json={"consent": False}).status_code == 422
    assert c.post("/api/v1/cure/initial-analysis", json={"consent": True, "handle_torque": 2}).status_code == 422
    assert c.post("/api/v1/cure/initial-analysis", json={"consent": True, "schema_version": "cure-initial/0"}).status_code == 422
    with pytest.raises(ValueError):
        analyse(InitialSignals(consent=False))


# ═══ meshmeta q → SIG conversion tests ════════════════════════════════════════

class TestQToSigParts:
    def test_equilateral_maps_to_cube_marrakesh(self):
        p = _q_to_sig_parts(1.0)
        assert p["shape"] == "CUBE"
        assert p["shape_pts"] == 7
        assert p["backend"] == "ibm_marrakesh"
        assert p["epsilon"] == pytest.approx(0.019)
        assert p["theta_disp"] == "π.785"
        assert p["sig"] == "CUBE-π.785-ε.019"
        assert p["slot"] == "S4"

    def test_degenerate_maps_to_line_brisbane(self):
        p = _q_to_sig_parts(0.0)
        assert p["shape"] == "LINE"
        assert p["shape_pts"] == 2
        assert p["backend"] == "ibm_brisbane"
        assert p["epsilon"] == pytest.approx(0.031)
        assert p["sig"] == "LINE-√.414-ε.031"
        assert p["slot"] == "S2"

    @pytest.mark.parametrize("q,expected_shape", [
        (5/6 + 0.001, "CUBE"),
        (4/6 + 0.001, "OCT"),
        (3/6 + 0.001, "PYR"),
        (2/6 + 0.001, "TET"),
        (1/6 + 0.001, "TRI"),
        (1/6 - 0.001, "LINE"),
    ])
    def test_shape_band_boundaries(self, q, expected_shape):
        assert _q_to_sig_parts(q)["shape"] == expected_shape

    @pytest.mark.parametrize("q,expected_backend", [
        (0.75,  "ibm_marrakesh"),
        (0.749, "ibm_sherbrooke"),
        (0.50,  "ibm_sherbrooke"),
        (0.499, "ibm_kyoto"),
        (0.25,  "ibm_kyoto"),
        (0.249, "ibm_brisbane"),
    ])
    def test_backend_band_boundaries(self, q, expected_backend):
        assert _q_to_sig_parts(q)["backend"] == expected_backend

    def test_sig_string_format(self):
        # All four backends produce the right SIG format
        cases = [
            (0.90, "ibm_marrakesh",  "π.785", "ε.019"),
            (0.60, "ibm_sherbrooke", "φ.618", "ε.023"),
            (0.35, "ibm_kyoto",      "π.785", "ε.028"),
            (0.10, "ibm_brisbane",   "√.414", "ε.031"),
        ]
        for q, backend, theta, eps in cases:
            p = _q_to_sig_parts(q)
            assert p["backend"] == backend
            assert p["sig"].split("-")[1] == theta
            assert p["sig"].split("-")[2] == eps

    def test_mente_is_q_times_pts_times_const(self):
        p = _q_to_sig_parts(0.9)
        expected = round(0.9 * p["shape_pts"] * _MENTE_CONST, 6)
        assert p["mente"] == pytest.approx(expected, rel=1e-5)

    def test_mente_const_is_phi_times_sqrt2(self):
        assert _MENTE_CONST == pytest.approx(1.618 * math.sqrt(2), rel=1e-6)

    def test_label_is_passed_through(self):
        p = _q_to_sig_parts(0.8, label="A")
        assert p["label"] == "A"

    def test_q_clamped_to_unit_interval(self):
        assert _q_to_sig_parts(1.5)["shape"] == "CUBE"
        assert _q_to_sig_parts(-0.5)["shape"] == "LINE"


class TestQToSigEndpoints:
    def setup_method(self):
        app = FastAPI()
        app.include_router(router)
        self.c = TestClient(app)

    def test_single_q_endpoint(self):
        res = self.c.post("/api/v1/cure/q-to-sig", json={"q": 0.9, "label": "A"})
        assert res.status_code == 200
        body = res.json()
        assert body["shape"] == "CUBE"
        assert body["backend"] == "ibm_marrakesh"
        assert body["sig"] == "CUBE-π.785-ε.019"
        assert body["label"] == "A"

    def test_q_out_of_range_is_rejected(self):
        assert self.c.post("/api/v1/cure/q-to-sig", json={"q": 1.5}).status_code == 422
        assert self.c.post("/api/v1/cure/q-to-sig", json={"q": -0.1}).status_code == 422

    def test_meshmeta_batch_endpoint(self):
        payload = {
            "triangles": [
                {"label": "A", "q": 0.95},
                {"label": "B", "q": 0.70},
                {"label": "C", "q": 0.45},
                {"label": "D", "q": 0.20},
            ]
        }
        res = self.c.post("/api/v1/cure/meshmeta-to-sig", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert len(body["sigs"]) == 4
        assert body["sigs"][0]["shape"] == "CUBE"
        assert body["sigs"][1]["backend"] == "ibm_sherbrooke"
        assert body["sigs"][2]["backend"] == "ibm_kyoto"
        assert body["sigs"][3]["backend"] == "ibm_brisbane"
        assert body["mente_const"] == pytest.approx(_MENTE_CONST, rel=1e-5)

    def test_mente_achieved_flag(self):
        # Four CUBE-quality triangles should easily exceed MENTE_CONST
        high = [{"label": lbl, "q": 0.99} for lbl in "ABCD"]
        body = self.c.post("/api/v1/cure/meshmeta-to-sig", json={"triangles": high}).json()
        assert body["mente_achieved"] is True

        # Single degenerate triangle — well below threshold
        low = [{"label": "A", "q": 0.01}]
        body = self.c.post("/api/v1/cure/meshmeta-to-sig", json={"triangles": low}).json()
        assert body["mente_achieved"] is False

    def test_batch_max_4_triangles(self):
        payload = {"triangles": [{"label": str(i), "q": 0.5} for i in range(5)]}
        assert self.c.post("/api/v1/cure/meshmeta-to-sig", json=payload).status_code == 422
