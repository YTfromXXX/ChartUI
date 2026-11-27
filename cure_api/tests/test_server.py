"""P1 smoke tests — Cure-API server endpoints (requires FastAPI + httpx)."""

import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parents[2]))

import pytest

try:
    from fastapi.testclient import TestClient
    from cure_api.server import app
    _HAS_TESTCLIENT = app is not None
except (ImportError, Exception):
    _HAS_TESTCLIENT = False

pytestmark = pytest.mark.skipif(
    not _HAS_TESTCLIENT,
    reason="FastAPI / httpx not installed",
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── /pool/status ──────────────────────────────────────────────────────────────

def test_pool_status_returns_list(client):
    r = client.get("/pool/status")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    for backend in data:
        assert "name" in backend
        assert "score" in backend
        assert 0 <= backend["score"] <= 100


# ── /qpu/run ──────────────────────────────────────────────────────────────────

def test_qpu_run_basic(client):
    r = client.post("/qpu/run", json={"circuit": "H 0", "shots": 100, "round_num": 1})
    assert r.status_code == 200
    data = r.json()
    assert "counts" in data
    assert "top_bitstring" in data
    assert len(data["top_bitstring"]) == 13
    assert "contract_nonce" in data
    assert len(data["contract_nonce"]) == 64


def test_qpu_run_counts_sum_to_shots(client):
    shots = 200
    r = client.post("/qpu/run", json={"circuit": "", "shots": shots, "round_num": 2})
    assert r.status_code == 200
    total = sum(r.json()["counts"].values())
    # top-32 slice: total <= shots (remaining shots in long-tail bitstrings)
    assert 0 < total <= shots


# ── /qpu/select ───────────────────────────────────────────────────────────────

def test_qpu_select_returns_backend(client):
    r = client.post("/qpu/select", json={"circuit": "", "shots": 100, "round_num": 3})
    assert r.status_code == 200
    data = r.json()
    assert data["backend_name"].startswith("cure_synth_")


def test_qpu_select_ap_zone_prefers_low_latency(client):
    r = client.post(
        "/qpu/select",
        json={"circuit": "", "shots": 100, "round_num": 4},
        headers={"X-Datacenter-Zone": "ap-northeast-1"},
    )
    assert r.status_code == 200
    # falcon_r1 (latency_ms=210) or ideal_v1 (80) should win for ap zone
    assert r.json()["backend_name"] in ("cure_synth_falcon_r1", "cure_synth_ideal_v1")


# ── /qpu/create ───────────────────────────────────────────────────────────────

def test_qpu_create_requires_noise_model(client):
    r = client.post("/qpu/create", json={"circuit": "", "shots": 100, "round_num": 5})
    assert r.status_code == 400


def test_qpu_create_depolarizing(client):
    r = client.post("/qpu/create", json={
        "circuit": "",
        "shots": 100,
        "round_num": 6,
        "noise_model": {"type": "depolarizing", "error_rate": 0.005},
    })
    assert r.status_code == 200
    assert "cure_synth_depolarizing" in r.json()["backend_name"]


def test_qpu_create_thermal(client):
    r = client.post("/qpu/create", json={
        "circuit": "",
        "shots": 100,
        "round_num": 7,
        "noise_model": {"type": "thermal", "T1_us": 250, "T2_us": 150, "gate_time_ns": 35},
    })
    assert r.status_code == 200


def test_qpu_create_ideal(client):
    r = client.post("/qpu/create", json={
        "circuit": "",
        "shots": 50,
        "round_num": 8,
        "noise_model": {"type": "ideal"},
    })
    assert r.status_code == 200
    assert "ideal" in r.json()["backend_name"]


# ── /oracle/predict ───────────────────────────────────────────────────────────

def test_oracle_predict_usdjpy(client):
    r = client.get("/oracle/predict/USD-JPY")
    assert r.status_code == 200
    data = r.json()
    assert data["symbol"] == "USD-JPY"
    assert data["position"] in ("LONG", "SHORT", "HOLD")
    assert "scores" in data
    assert "disclaimer" in data
    assert data["disclaimer"] == "quantum_random_signal_not_financial_advice"


def test_oracle_predict_has_events(client):
    r = client.get("/oracle/predict/EUR-USD")
    assert r.status_code == 200
    events = r.json()["events"]
    for key in ("q10_capture", "q11_crash", "q12_pass"):
        assert key in events
        assert isinstance(events[key], bool)


def test_oracle_predict_scores_in_range(client):
    r = client.get("/oracle/predict/BTC-USD?shots=100")
    assert r.status_code == 200
    scores = r.json()["scores"]
    assert 0 <= scores["be"] <= 200
    assert 0 <= scores["pe"] <= 200
    assert 0 <= scores["total"] <= 200


def test_oracle_predict_increments_round(client):
    r1 = client.get("/oracle/predict/USD-JPY")
    r2 = client.get("/oracle/predict/EUR-USD")
    assert r2.json()["round_num"] > r1.json()["round_num"]


# ── /oracle/certify ───────────────────────────────────────────────────────────

def test_oracle_certify_valid(client):
    # first run a predict to get a real nonce
    pr = client.get("/oracle/predict/USD-JPY", headers={"X-Session-Id": "test_sess"})
    pdata = pr.json()

    cr = client.post("/oracle/certify", json={
        "round_num": pdata["round_num"],
        "bitstring": pdata["bitstring"],
        "qpu_seconds": pdata["qpu_seconds"],
        "session_id": "test_sess",
        "nonce": pdata["contract_nonce"],
    })
    assert cr.status_code == 200
    assert cr.json()["valid"] is True
    assert cr.json()["certified"] is True


def test_oracle_certify_invalid(client):
    r = client.post("/oracle/certify", json={
        "round_num": 999,
        "bitstring": "0000000000000",
        "qpu_seconds": 0.1,
        "session_id": "fake",
        "nonce": "deadbeef" * 8,
    })
    assert r.status_code == 200
    assert r.json()["valid"] is False


# ── /oracle/accounts ──────────────────────────────────────────────────────────

def test_oracle_accounts_returns_48(client):
    r = client.get("/oracle/accounts")
    assert r.status_code == 200
    data = r.json()
    assert len(data["accounts"]) == 48
    assert "summary" in data
    assert data["summary"]["account_count"] == 48


def test_oracle_accounts_reset(client):
    client.post("/oracle/accounts/reset")
    r = client.get("/oracle/accounts")
    s = r.json()["summary"]
    assert s["total_pl"] == 0.0
    assert s["hold_count"] == 48


def test_oracle_account_one(client):
    r = client.get("/oracle/accounts/1")
    assert r.status_code == 200
    assert r.json()["id"] == 1


def test_oracle_account_out_of_range(client):
    r = client.get("/oracle/accounts/99")
    assert r.status_code == 404
