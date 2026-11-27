"""Tests for cure_oracle/mente.py and /api/v1/qpu/mente/* endpoints."""

import os
import pathlib
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from cure_oracle.qpu_router import router
from cure_oracle.mente import (
    MENTE_CONST,
    HEAVENLY_KINGS,
    check_mente,
    issue_birth_on_mente,
    MenteCheckResult,
    MenteBirthResult,
)

_TEST_OPERATOR_TOKEN = "test-operator-token-for-ci"
os.environ.setdefault(
    "CURE_API_TOKENS",
    f'{{"{_TEST_OPERATOR_TOKEN}":"operator"}}',
)
_OPERATOR_HEADERS = {"Authorization": f"Bearer {_TEST_OPERATOR_TOKEN}"}

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ── fixtures ──────────────────────────────────────────────────────────────────

FOUR_KINGS_TRIS = [
    {"q": 0.80, "label": "A"},   # S4 広目天
    {"q": 0.60, "label": "B"},   # S1 多聞天
    {"q": 0.35, "label": "C"},   # S3 持国天
    {"q": 0.10, "label": "D"},   # S2 増長天
]

LOW_TRIS = [
    {"q": 0.05, "label": "A"},
]

def _local_round_result() -> dict:
    from cure_oracle.round_circuit import round_circuit
    return round_circuit(1, mode="local", shots=50)


# ── TestMenteConst ────────────────────────────────────────────────────────────

class TestMenteConst:
    def test_mente_const_value(self):
        import math
        assert abs(MENTE_CONST - 1.618 * math.sqrt(2)) < 1e-9

    def test_mente_const_approx(self):
        assert abs(MENTE_CONST - 2.2882) < 0.001

    def test_heavenly_kings_four(self):
        assert len(HEAVENLY_KINGS) == 4

    def test_heavenly_kings_slots(self):
        assert set(HEAVENLY_KINGS.keys()) == {"S1", "S2", "S3", "S4"}

    def test_heavenly_kings_names(self):
        assert HEAVENLY_KINGS["S1"] == "多聞天"
        assert HEAVENLY_KINGS["S2"] == "増長天"
        assert HEAVENLY_KINGS["S3"] == "持国天"
        assert HEAVENLY_KINGS["S4"] == "広目天"


# ── TestCheckMente ────────────────────────────────────────────────────────────

class TestCheckMente:
    def test_four_kings_achieved(self):
        result = check_mente(FOUR_KINGS_TRIS)
        assert result.mente_achieved is True
        assert result.mente_total > MENTE_CONST

    def test_four_kings_no_missing(self):
        result = check_mente(FOUR_KINGS_TRIS)
        assert result.missing_kings == []

    def test_four_kings_all_slots_present(self):
        result = check_mente(FOUR_KINGS_TRIS)
        slots = {s.slot for s in result.slots}
        assert slots == {"S1", "S2", "S3", "S4"}

    def test_four_kings_king_names(self):
        result = check_mente(FOUR_KINGS_TRIS)
        kings = {s.king for s in result.slots}
        assert kings == set(HEAVENLY_KINGS.values())

    def test_low_q_not_achieved(self):
        result = check_mente(LOW_TRIS)
        assert result.mente_achieved is False
        assert result.mente_total < MENTE_CONST

    def test_missing_kings_reported(self):
        result = check_mente(LOW_TRIS)
        # low q → S2 only, so S1/S3/S4 are missing
        assert len(result.missing_kings) > 0

    def test_returns_check_result_type(self):
        result = check_mente(FOUR_KINGS_TRIS)
        assert isinstance(result, MenteCheckResult)

    def test_slot_fields_populated(self):
        result = check_mente(FOUR_KINGS_TRIS)
        for s in result.slots:
            assert s.sig != ""
            assert s.mente > 0
            assert s.epsilon > 0
            assert s.shape != ""

    def test_mente_const_in_result(self):
        result = check_mente(FOUR_KINGS_TRIS)
        assert abs(result.mente_const - round(MENTE_CONST, 6)) < 1e-9

    def test_single_triangle(self):
        result = check_mente([{"q": 0.80, "label": "A"}])
        assert len(result.slots) == 1
        assert result.slots[0].label == "A"


# ── TestIssueBirthOnMente ─────────────────────────────────────────────────────

class TestIssueBirthOnMente:
    def test_achieved_returns_birth_result(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        assert result is not None
        assert isinstance(result, MenteBirthResult)

    def test_not_achieved_returns_none(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(LOW_TRIS, rr, cert_path)
        assert result is None

    def test_cert_written_to_disk(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        assert pathlib.Path(cert_path).exists()

    def test_html_written_to_disk(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        assert pathlib.Path(result.html_path).exists()

    def test_cert_has_mente_fields(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        assert result.cert["mente_achieved"] is True
        assert result.cert["mente_total"] > MENTE_CONST
        assert "四天王" in result.cert

    def test_cert_has_all_four_kings(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        four_kings = result.cert["四天王"]
        assert set(four_kings.keys()) == {"S1", "S2", "S3", "S4"}

    def test_receipts_count_matches_slots(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        assert len(result.receipts) == 4

    def test_receipts_have_merkle_proof(self, tmp_path):
        cert_path = str(tmp_path / "cert.json")
        rr = _local_round_result()
        result = issue_birth_on_mente(FOUR_KINGS_TRIS, rr, cert_path)
        for rec in result.receipts:
            assert "merkle" in rec
            assert "proof" in rec


# ── TestMenteCheckEndpoint ────────────────────────────────────────────────────

class TestMenteCheckEndpoint:
    def test_four_kings_returns_200(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": FOUR_KINGS_TRIS,
        })
        assert r.status_code == 200

    def test_four_kings_achieved_true(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": FOUR_KINGS_TRIS,
        })
        data = r.json()
        assert data["mente_achieved"] is True
        assert data["mente_total"] > MENTE_CONST

    def test_four_kings_missing_empty(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": FOUR_KINGS_TRIS,
        })
        assert r.json()["missing_kings"] == []

    def test_four_slots_in_response(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": FOUR_KINGS_TRIS,
        })
        slots = {s["slot"] for s in r.json()["slots"]}
        assert slots == {"S1", "S2", "S3", "S4"}

    def test_low_q_not_achieved(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": LOW_TRIS,
        })
        assert r.json()["mente_achieved"] is False

    def test_response_has_required_fields(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": FOUR_KINGS_TRIS,
        })
        data = r.json()
        for key in ("slots", "mente_total", "mente_achieved",
                    "mente_const", "missing_kings"):
            assert key in data, f"missing key: {key}"

    def test_slot_fields_present(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": FOUR_KINGS_TRIS,
        })
        for s in r.json()["slots"]:
            for key in ("label", "slot", "king", "sig", "mente",
                        "epsilon", "shape"):
                assert key in s, f"missing slot key: {key}"

    def test_too_many_triangles_422(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": [{"q": 0.5, "label": x}
                          for x in ["A", "B", "C", "D", "E"]],
        })
        assert r.status_code == 422

    def test_empty_triangles_422(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={"triangles": []})
        assert r.status_code == 422

    def test_q_out_of_range_422(self):
        r = client.post("/api/v1/qpu/mente/check", headers=_OPERATOR_HEADERS, json={
            "triangles": [{"q": 1.5, "label": "A"}],
        })
        assert r.status_code == 422


# ── TestMenteBirthEndpoint ────────────────────────────────────────────────────

class TestMenteBirthEndpoint:
    def _birth_payload(self, tmp_path=None, tris=None):
        rr = _local_round_result()
        payload = {
            "triangles": tris or FOUR_KINGS_TRIS,
            "round_result": rr,
            "cert_path": "cert.json",
        }
        return payload

    def test_four_kings_returns_200(self, tmp_path):
        r = client.post("/api/v1/qpu/mente/birth", headers=_OPERATOR_HEADERS,
                        json=self._birth_payload(tmp_path))
        assert r.status_code == 200

    def test_four_kings_achieved_true(self, tmp_path):
        r = client.post("/api/v1/qpu/mente/birth", headers=_OPERATOR_HEADERS,
                        json=self._birth_payload(tmp_path))
        assert r.json()["mente_achieved"] is True

    def test_four_kings_cert_in_response(self, tmp_path):
        r = client.post("/api/v1/qpu/mente/birth", headers=_OPERATOR_HEADERS,
                        json=self._birth_payload(tmp_path))
        data = r.json()
        assert data["cert"] is not None
        assert data["receipts"] is not None
        assert len(data["receipts"]) == 4

    def test_four_kings_cert_has_四天王(self, tmp_path):
        r = client.post("/api/v1/qpu/mente/birth", headers=_OPERATOR_HEADERS,
                        json=self._birth_payload(tmp_path))
        cert = r.json()["cert"]
        assert "四天王" in cert
        assert cert["mente_achieved"] is True

    def test_not_achieved_returns_no_cert(self, tmp_path):
        r = client.post("/api/v1/qpu/mente/birth", headers=_OPERATOR_HEADERS,
                        json=self._birth_payload(tmp_path, tris=LOW_TRIS))
        data = r.json()
        assert data["mente_achieved"] is False
        assert data["cert"] is None
        assert data["receipts"] is None

    def test_response_has_required_fields(self, tmp_path):
        r = client.post("/api/v1/qpu/mente/birth", headers=_OPERATOR_HEADERS,
                        json=self._birth_payload(tmp_path))
        for key in ("mente_achieved", "mente_total", "mente_const"):
            assert key in r.json(), f"missing key: {key}"
