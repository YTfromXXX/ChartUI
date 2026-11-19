"""P1 smoke tests — oracle bit interpretation and nonce logic (no FastAPI required)."""

import hashlib
import json
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parents[2]))

from cure_api.oracle import (
    AccountPool,
    build_predict_response,
    parse_bitstring,
    verify_nonce,
)


# ── parse_bitstring ───────────────────────────────────────────────────────────

def test_all_ones_long():
    r = parse_bitstring("1111111111111")
    assert r["a_direction"] == "LONG"
    assert r["b_direction"] == "LONG"
    assert r["a_count"] == 5
    assert r["b_count"] == 5
    assert r["q10_capture"] is True
    assert r["q11_crash"] is True
    assert r["q12_pass"] is True
    # CRASH overrides to HOLD
    assert r["position"] == "HOLD"


def test_all_zeros_short():
    r = parse_bitstring("0000000000000")
    assert r["a_direction"] == "SHORT"
    assert r["b_direction"] == "SHORT"
    assert r["a_count"] == 0
    assert r["b_count"] == 0
    assert r["q10_capture"] is False
    assert r["position"] == "SHORT"


def test_round4_bitstring():
    """Round 4 cert: 0100110011111 → all 3 events true."""
    r = parse_bitstring("0100110011111")
    assert r["q10_capture"] is True
    assert r["q11_crash"] is True
    assert r["q12_pass"] is True
    assert r["position"] == "HOLD"  # q11 CRASH overrides


def test_long_signal_no_events():
    # q0-q4=11100, q5-q9=11100, q10-q12=000
    r = parse_bitstring("1110011100000")
    assert r["a_direction"] == "LONG"
    assert r["b_direction"] == "LONG"
    assert r["position"] == "LONG"
    assert r["q10_capture"] is False


def test_short_signal():
    # q0-q4=00011, q5-q9=00011, no events
    r = parse_bitstring("0001100011000")
    assert r["a_direction"] == "SHORT"
    assert r["b_direction"] == "SHORT"
    assert r["position"] == "SHORT"


def test_mixed_signals_hold():
    # q0-q4=LONG(11100), q5-q9=SHORT(00011), no events → HOLD
    r = parse_bitstring("1110000011000")
    assert r["a_direction"] == "LONG"
    assert r["b_direction"] == "SHORT"
    assert r["position"] == "HOLD"


def test_scores_range():
    for bits in ["0000000000000", "1111111111111", "0100110011111", "1010101010101"]:
        r = parse_bitstring(bits)
        assert 0.0 <= r["be_score"] <= 200.0
        assert 0.0 <= r["pe_score"] <= 200.0
        assert 0.0 <= r["total_score"] <= 200.0


def test_short_bitstring_zero_padded():
    r = parse_bitstring("101")  # padded to 0000000000101
    assert len(r["a_bits"]) == 5
    assert len(r["b_bits"]) == 5


# ── verify_nonce ──────────────────────────────────────────────────────────────

def test_nonce_roundtrip():
    payload = json.dumps(
        {"round": 4, "bits": "0100110011111", "qpu_s": 0.312, "session": "sess_abc"},
        sort_keys=True,
    )
    expected = hashlib.sha256(payload.encode()).hexdigest()
    assert verify_nonce(4, "0100110011111", 0.312, "sess_abc", expected) is True


def test_nonce_wrong_bitstring():
    payload = json.dumps(
        {"round": 1, "bits": "0000000000000", "qpu_s": 0.1, "session": "s"},
        sort_keys=True,
    )
    correct = hashlib.sha256(payload.encode()).hexdigest()
    assert verify_nonce(1, "1111111111111", 0.1, "s", correct) is False


def test_nonce_wrong_round():
    payload = json.dumps(
        {"round": 1, "bits": "0000000000000", "qpu_s": 0.1, "session": "s"},
        sort_keys=True,
    )
    correct = hashlib.sha256(payload.encode()).hexdigest()
    assert verify_nonce(2, "0000000000000", 0.1, "s", correct) is False


# ── AccountPool ───────────────────────────────────────────────────────────────

def test_account_pool_assign():
    pool = AccountPool()
    acc = pool.assign(1, "LONG", "USD/JPY", 42.0, "nonce_x")
    assert acc["id"] == 1
    assert acc["position"] == "LONG"
    assert acc["pl"] == 42.0
    assert acc["symbol"] == "USD/JPY"


def test_account_pool_round_mod():
    pool = AccountPool()
    # round 1 → account 1, round 49 → account 1 again
    pool.assign(1, "LONG", "USD/JPY", 10.0, "n1")
    pool.assign(49, "SHORT", "EUR/USD", -5.0, "n2")
    # account 1 should now be SHORT with pl = 10 + (-5) = 5
    acc = pool.get_one(1)
    assert acc["position"] == "SHORT"
    assert acc["pl"] == 5.0


def test_account_pool_reset():
    pool = AccountPool()
    pool.assign(1, "LONG", "USD/JPY", 100.0, "n")
    pool.reset()
    acc = pool.get_one(1)
    assert acc["pl"] == 0.0
    assert acc["position"] == "HOLD"


def test_account_pool_summary():
    pool = AccountPool()
    pool.assign(1, "LONG", "X", 10.0, "n")
    pool.assign(2, "SHORT", "Y", -5.0, "n")
    s = pool.summary()
    assert s["long_count"] == 1
    assert s["short_count"] == 1
    assert s["hold_count"] == 46
    assert s["total_pl"] == 5.0


def test_account_pool_all_48():
    pool = AccountPool()
    assert len(pool.get_all()) == 48


# ── build_predict_response ────────────────────────────────────────────────────

def test_predict_response_has_disclaimer():
    parsed = parse_bitstring("0000000000000")
    resp = build_predict_response("USD/JPY", parsed, "0000000000000", "eagle_r3", 0.2, 1, "abc123")
    assert resp["disclaimer"] == "quantum_random_signal_not_financial_advice"
    assert "scores" in resp
    assert "signal" in resp
    assert "events" in resp
