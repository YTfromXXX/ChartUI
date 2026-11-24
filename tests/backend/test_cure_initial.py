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


class TestSigReceipt:
    CERT = {
        "certificate_id": "eec6d63c3dba2b2e",
        "game_token":     "eec6d63c3dba2b2e",
        "born_at":        "2026-11-18T19:47:43+00:00",
        "backend":        "ibm_sherbrooke",
        "bitstring":      "1010110011011",
        "teleport_angle_a": 42.0,
        "teleport_angle_b": 137.5,
        "active_guides_a":  [],
        "active_guides_b":  [],
        "events":         {},
        "qpu_seconds":    1.23,
        "midwife":        "Luna + エーリアル",
        "round":          1,
    }

    def setup_method(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from cure_initial import router
        app = FastAPI(); app.include_router(router)
        self.c = TestClient(app)

    # ── make_sig_receipt unit tests ────────────────────────────────────────
    def test_receipt_has_correct_structure(self):
        from cure_oracle.birth import make_sig_receipt
        r = make_sig_receipt(self.CERT, "CUBE-φ.618-ε.023", 0.023, 14.0)
        assert r["version"] == "sig-receipt/1"
        assert r["cert_id"] == self.CERT["certificate_id"]
        assert r["sig"] == "CUBE-φ.618-ε.023"
        assert r["merkle"]["hash"] == "keccak256"
        assert r["merkle"]["sig_index"] == 3
        assert r["merkle"]["claims"] == 8
        assert r["merkle"]["root"].startswith("0x")
        assert len(r["merkle"]["root"]) == 66  # 0x + 64 hex chars
        assert r["proof"]["index"] == 3
        assert all(p.startswith("0x") for p in r["proof"]["path"])
        assert r["proof"]["leaf"].startswith("0x")

    def test_proof_is_verifiable(self):
        from cure_oracle.birth import (
            make_sig_receipt, _receipt_leaf, _receipt_pair,
            _claim_record, _SIG_INDEX,
        )
        r = make_sig_receipt(self.CERT, "CUBE-φ.618-ε.023", 0.023, 14.0)
        # Reconstruct leaf from the SIG claim
        rec = _claim_record(3, "CUBE-φ.618-ε.023")
        leaf = _receipt_leaf(_SIG_INDEX, rec)
        assert "0x" + leaf.hex() == r["proof"]["leaf"]
        # Walk the proof path and arrive at root
        h = leaf
        for p_hex in r["proof"]["path"]:
            p = bytes.fromhex(p_hex[2:])
            h = _receipt_pair(h, p)
        assert "0x" + h.hex() == r["merkle"]["root"]

    def test_different_certs_produce_different_roots(self):
        from cure_oracle.birth import make_sig_receipt
        cert2 = {**self.CERT, "certificate_id": "aaaa0000bbbb1111"}
        r1 = make_sig_receipt(self.CERT,  "CUBE-φ.618-ε.023", 0.023, 14.0)
        r2 = make_sig_receipt(cert2,       "CUBE-φ.618-ε.023", 0.023, 14.0)
        assert r1["merkle"]["root"] != r2["merkle"]["root"]

    def test_no_signature_by_default(self):
        from cure_oracle.birth import make_sig_receipt
        r = make_sig_receipt(self.CERT, "TRI-π.785-ε.028", 0.028, 3.0)
        assert "signature" not in r

    # ── /api/v1/cure/sig-receipt endpoint ──────────────────────────────────
    def test_endpoint_with_q(self):
        payload = {"cert": self.CERT, "q": 0.9, "label": "A"}
        res = self.c.post("/api/v1/cure/sig-receipt", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["sig"] == "CUBE-π.785-ε.019"
        assert body["backend"] == "ibm_sherbrooke"
        assert body["merkle"]["root"].startswith("0x")
        assert len(body["proof"]["path"]) > 0

    def test_endpoint_with_explicit_sig(self):
        payload = {"cert": self.CERT, "sig": "OCT-φ.618-ε.023"}
        res = self.c.post("/api/v1/cure/sig-receipt", json=payload)
        assert res.status_code == 200
        assert res.json()["sig"] == "OCT-φ.618-ε.023"

    def test_endpoint_requires_q_or_sig(self):
        res = self.c.post("/api/v1/cure/sig-receipt", json={"cert": self.CERT})
        assert res.status_code == 422

    # ── receipt_html_section ───────────────────────────────────────────────
    def test_receipt_html_contains_key_elements(self):
        from cure_oracle.birth import make_sig_receipt, receipt_html_section
        r = make_sig_receipt(self.CERT, "CUBE-φ.618-ε.023", 0.023, 14.0)
        html = receipt_html_section(r)
        assert "Merkle証明付き SIG 領収証" in html
        assert "CUBE-φ.618-ε.023" in html
        assert r["merkle"]["root"] in html
        assert r["proof"]["leaf"] in html

    def test_certificate_html_includes_receipt_section(self):
        from cure_oracle.birth import make_sig_receipt, certificate_html
        r = make_sig_receipt(self.CERT, "CUBE-φ.618-ε.023", 0.023, 14.0)
        html_with    = certificate_html(self.CERT, receipt=r)
        html_without = certificate_html(self.CERT)
        assert "Merkle証明付き SIG 領収証" in html_with
        assert "Merkle証明付き SIG 領収証" not in html_without
