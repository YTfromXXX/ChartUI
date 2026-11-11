import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_initial import SPLIT_TOTAL, InitialSignals, analyse, router

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
