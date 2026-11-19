"""METADOGG-ORACLE-API — bit interpretation and 48-account logic.

Bit layout (13-qubit MothBlast circuit):
  q0–q4   → Symbol A signal  (5 bits)
  q5–q9   → Symbol B signal  (5 bits)
  q10     → CAPTURE event
  q11     → CRASH event
  q12     → PASS event
"""

from __future__ import annotations

import hashlib
import json

N_GUIDE = 5          # bits per symbol
N_ACCOUNTS = 48
BASE_BALANCE = 20.83  # USD per account ($1000 / 48)
LEVERAGE = 10


def parse_bitstring(bitstring: str) -> dict:
    """Parse a 13-bit QPU bitstring into structured signals."""
    if len(bitstring) < 13:
        bitstring = bitstring.zfill(13)
    bits = [int(b) for b in bitstring[:13]]

    a_bits = bits[0:5]
    b_bits = bits[5:10]
    q10, q11, q12 = bits[10], bits[11], bits[12]

    a_count = sum(a_bits)
    b_count = sum(b_bits)
    a_strength = round(a_count / N_GUIDE, 4)   # 0.0 – 1.0
    b_strength = round(b_count / N_GUIDE, 4)

    a_dir = "LONG" if a_count >= 3 else "SHORT"
    b_dir = "LONG" if b_count >= 3 else "SHORT"

    # Position decision: CRASH overrides to HOLD; CAPTURE amplifies
    if q11:
        position = "HOLD"
    elif q10 and a_dir == "LONG" and b_dir == "LONG":
        position = "LONG"
    elif q10 and a_dir == "SHORT" and b_dir == "SHORT":
        position = "SHORT"
    elif q12:
        position = "HOLD"
    else:
        position = a_dir if a_dir == b_dir else "HOLD"

    # BE / PE composite scores (0–100)
    be_score = round(
        (a_strength + b_strength) / 2 * 100
        * (1.15 if q10 else 1.0)
        * (0.85 if q11 else 1.0),
        2,
    )
    pe_score = round(
        ((1 - a_strength) + (1 - b_strength)) / 2 * 100
        * (1.15 if q11 else 1.0)
        * (0.90 if q12 else 1.0),
        2,
    )
    total_score = round((be_score + pe_score) / 2, 2)

    return {
        "a_bits": a_bits,
        "b_bits": b_bits,
        "a_count": a_count,
        "b_count": b_count,
        "a_strength": a_strength,
        "b_strength": b_strength,
        "a_direction": a_dir,
        "b_direction": b_dir,
        "position": position,
        "q10_capture": bool(q10),
        "q11_crash": bool(q11),
        "q12_pass": bool(q12),
        "be_score": be_score,
        "pe_score": pe_score,
        "total_score": total_score,
    }


def build_predict_response(
    symbol: str,
    parsed: dict,
    bitstring: str,
    backend_name: str,
    qpu_seconds: float,
    round_num: int,
    contract_nonce: str,
) -> dict:
    return {
        "symbol": symbol,
        "round_num": round_num,
        "backend": backend_name,
        "qpu_seconds": qpu_seconds,
        "bitstring": bitstring,
        "signal": {
            "symbol_a": {
                "strength": parsed["a_strength"],
                "direction": parsed["a_direction"],
                "active_qubits": parsed["a_count"],
            },
            "symbol_b": {
                "strength": parsed["b_strength"],
                "direction": parsed["b_direction"],
                "active_qubits": parsed["b_count"],
            },
        },
        "position": parsed["position"],
        "events": {
            "q10_capture": parsed["q10_capture"],
            "q11_crash": parsed["q11_crash"],
            "q12_pass": parsed["q12_pass"],
        },
        "scores": {
            "be": parsed["be_score"],
            "pe": parsed["pe_score"],
            "total": parsed["total_score"],
        },
        "contract_nonce": contract_nonce,
        "disclaimer": "quantum_random_signal_not_financial_advice",
    }


# ── 48-account pool ───────────────────────────────────────────────────────────

class AccountPool:
    """In-memory 48-account pool. round_num mod 48 assigns the active account."""

    def __init__(self) -> None:
        self._accounts: list[dict] = [
            {
                "id": i + 1,
                "position": "HOLD",
                "pl": 0.0,
                "symbol": None,
                "round_num": None,
                "nonce": None,
            }
            for i in range(N_ACCOUNTS)
        ]

    def assign(
        self,
        round_num: int,
        position: str,
        symbol: str,
        pnl_delta: float,
        nonce: str,
    ) -> dict:
        idx = (round_num - 1) % N_ACCOUNTS
        acc = self._accounts[idx]
        acc["position"] = position
        acc["pl"] = round(acc["pl"] + pnl_delta, 2)
        acc["symbol"] = symbol
        acc["round_num"] = round_num
        acc["nonce"] = nonce
        return acc

    def get_all(self) -> list[dict]:
        return list(self._accounts)

    def get_one(self, account_id: int) -> dict | None:
        if 1 <= account_id <= N_ACCOUNTS:
            return self._accounts[account_id - 1]
        return None

    def reset(self) -> None:
        for acc in self._accounts:
            acc["position"] = "HOLD"
            acc["pl"] = 0.0
            acc["symbol"] = None
            acc["round_num"] = None
            acc["nonce"] = None

    def summary(self) -> dict:
        total_pl = round(sum(a["pl"] for a in self._accounts), 2)
        longs = sum(1 for a in self._accounts if a["position"] == "LONG")
        shorts = sum(1 for a in self._accounts if a["position"] == "SHORT")
        holds = N_ACCOUNTS - longs - shorts
        return {
            "total_pl": total_pl,
            "long_count": longs,
            "short_count": shorts,
            "hold_count": holds,
            "account_count": N_ACCOUNTS,
        }


# ── Nonce verification ────────────────────────────────────────────────────────

def verify_nonce(
    round_num: int,
    bitstring: str,
    qpu_seconds: float,
    session_id: str,
    submitted_nonce: str,
) -> bool:
    payload = json.dumps(
        {"round": round_num, "bits": bitstring, "qpu_s": qpu_seconds, "session": session_id},
        sort_keys=True,
    )
    expected = hashlib.sha256(payload.encode()).hexdigest()
    return expected == submitted_nonce
