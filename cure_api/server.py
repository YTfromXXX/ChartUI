"""Cure-API mock server — FastAPI implementation.

Endpoints
---------
QPU layer (Cure-API):
  POST /qpu/run         — run on the pool's current default backend
  POST /qpu/select      — score the pool and SELECT the best backend
  POST /qpu/create      — build a synthetic QPU from noise_model, run, return counts
  GET  /pool/status     — live pool telemetry (loaded from pool_config.json)

Oracle layer (METADOGG-ORACLE-API):
  GET  /oracle/predict/{symbol}  — QPU signal → direction + score for a symbol pair
  POST /oracle/certify           — verify a contract nonce (P3)
  GET  /oracle/accounts          — 48-account pool status
  POST /oracle/accounts/reset    — reset all 48 accounts

Usage
-----
    pip install fastapi uvicorn
    uvicorn cure_api.server:app --port 8700 --reload

Pool config lives in cure_api/pool_config.json — edit it to simulate live telemetry.
Smart-contract nonce: sha256(str(round_num) + top_bitstring + str(qpu_seconds) + session_id)
"""

from __future__ import annotations

import hashlib
import json
import math
import pathlib
import random
import time
from typing import Any

try:
    from fastapi import FastAPI, Header, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, RedirectResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
    _HAS_FASTAPI = True
except ImportError:
    _HAS_FASTAPI = False

from cure_api.scoring import select_best, score_backend
from cure_api.oracle import (
    AccountPool,
    build_predict_response,
    parse_bitstring,
    verify_nonce,
)

_POOL_CONFIG = pathlib.Path(__file__).parent / "pool_config.json"

# ── QPU pool — loaded from pool_config.json (P2 live telemetry) ───────────────
def _load_pool() -> list[dict]:
    """Load QPU pool from pool_config.json; fall back to static defaults."""
    try:
        return json.loads(_POOL_CONFIG.read_text())
    except Exception:
        return [
            {"name": "cure_synth_eagle_r3",  "queue_len": 4,  "avg_gate_error": 0.004, "latency_ms": 420,  "available_shots": 2000, "operational": True},
            {"name": "cure_synth_heron_r2",  "queue_len": 11, "avg_gate_error": 0.002, "latency_ms": 680,  "available_shots": 1800, "operational": True},
            {"name": "cure_synth_falcon_r1", "queue_len": 2,  "avg_gate_error": 0.012, "latency_ms": 210,  "available_shots": 2000, "operational": True},
            {"name": "cure_synth_ideal_v1",  "queue_len": 0,  "avg_gate_error": 0.000, "latency_ms": 80,   "available_shots": 9999, "operational": True},
        ]

QPU_POOL: list[dict] = _load_pool()

DEFAULT_BACKEND = "cure_synth_eagle_r3"
N_QUBITS = 13

# 48-account pool singleton
_ACCOUNT_POOL = AccountPool()
_round_counter: int = 0


# ── noise simulation ──────────────────────────────────────────────────────────

def _h_probs_with_noise(error_rate: float = 0.0) -> list[float]:
    """Return per-qubit flip probability for a noisy Hadamard."""
    p_ideal = 0.5
    p_error = error_rate / 2
    return [p_ideal + random.gauss(0, p_error) for _ in range(N_QUBITS)]


def _sample_counts(probs: list[float], shots: int) -> dict[str, int]:
    """Monte-Carlo measurement: returns counts dict (MSB-first strings)."""
    counts: dict[str, int] = {}
    for _ in range(shots):
        bits = "".join("1" if random.random() < p else "0" for p in reversed(probs))
        counts[bits] = counts.get(bits, 0) + 1
    # keep top-32 to match Qiskit behaviour
    return dict(sorted(counts.items(), key=lambda kv: -kv[1])[:32])


def _apply_thermal(T1_us: float, T2_us: float, gate_time_ns: float, shots: int) -> dict[str, int]:
    decay = 1 - math.exp(-gate_time_ns / (T1_us * 1000))
    dephase = 1 - math.exp(-gate_time_ns / (T2_us * 1000))
    error_rate = max(decay, dephase)
    return _sample_counts(_h_probs_with_noise(error_rate), shots)


def _simulate(noise_model: dict | None, shots: int) -> tuple[dict[str, int], float]:
    """Simulate a 13-qubit H circuit with noise_model, return (counts, qpu_s)."""
    t0 = time.monotonic()

    if noise_model is None:
        nm_type = "depolarizing"
        probs = _h_probs_with_noise(0.003)
        counts = _sample_counts(probs, shots)
    else:
        nm_type = noise_model.get("type", "depolarizing")
        if nm_type == "ideal":
            probs = [0.5] * N_QUBITS
            counts = _sample_counts(probs, shots)
        elif nm_type == "thermal":
            counts = _apply_thermal(
                noise_model.get("T1_us", 100),
                noise_model.get("T2_us", 80),
                noise_model.get("gate_time_ns", 35),
                shots,
            )
        elif nm_type == "custom":
            ge = noise_model.get("gate_errors", {})
            er = ge.get("h", 0.0) + ge.get("measure", 0.0)
            counts = _sample_counts(_h_probs_with_noise(er), shots)
        else:  # depolarizing (default)
            er = noise_model.get("error_rate", 0.003)
            counts = _sample_counts(_h_probs_with_noise(er), shots)

    qpu_s = round(time.monotonic() - t0 + random.uniform(0.05, 0.4), 4)
    return counts, qpu_s


def _nonce(round_num: int, bitstring: str, qpu_seconds: float, session_id: str) -> str:
    payload = json.dumps({
        "round": round_num,
        "bits": bitstring,
        "qpu_s": qpu_seconds,
        "session": session_id,
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


# ── FastAPI app ───────────────────────────────────────────────────────────────

if _HAS_FASTAPI:

    app = FastAPI(
        title="Cure-API Mock",
        description="Synthetic QPU endpoint for MothBlast round_circuit mode='custom'",
        version="1.0.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Static files (homepage) ──────────────────────────────────────────────
    _PUBLIC = pathlib.Path(__file__).parents[1] / "public"
    if _PUBLIC.exists():
        app.mount("/public", StaticFiles(directory=str(_PUBLIC)), name="public")

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/public/metadogg_home.html")

    class RunRequest(BaseModel):
        circuit: str
        shots: int = 500
        round_num: int = 0
        noise_model: dict[str, Any] | None = None

    def _auth(authorization: str | None) -> None:
        if authorization and not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Bearer token required")

    def _build_response(
        counts: dict[str, int],
        backend_name: str,
        qpu_s: float,
        round_num: int,
        x_session_id: str = "",
    ) -> dict:
        top = max(counts, key=counts.get)
        return {
            "counts": counts,
            "backend_name": backend_name,
            "qpu_seconds": qpu_s,
            "top_bitstring": top,
            "contract_nonce": _nonce(round_num, top, qpu_s, x_session_id),
        }

    @app.post("/qpu/run")
    def qpu_run(
        req: RunRequest,
        authorization: str | None = Header(default=None),
        x_session_id: str = Header(default=""),
    ):
        _auth(authorization)
        counts, qpu_s = _simulate(None, req.shots)
        return _build_response(counts, DEFAULT_BACKEND, qpu_s, req.round_num, x_session_id)

    @app.post("/qpu/select")
    def qpu_select(
        req: RunRequest,
        authorization: str | None = Header(default=None),
        x_session_id: str = Header(default=""),
        x_datacenter_zone: str = Header(default=""),
    ):
        _auth(authorization)
        # Zone hint: prefer low-latency pool for ap-northeast
        weights = {"latency": 2.0} if "ap" in x_datacenter_zone else None
        best = select_best(QPU_POOL, weights)
        counts, qpu_s = _simulate(None, req.shots)
        return _build_response(counts, best["name"], qpu_s, req.round_num, x_session_id)

    @app.post("/qpu/create")
    def qpu_create(
        req: RunRequest,
        authorization: str | None = Header(default=None),
        x_session_id: str = Header(default=""),
    ):
        _auth(authorization)
        if not req.noise_model:
            raise HTTPException(status_code=400, detail="noise_model required for /qpu/create")
        nm_type = req.noise_model.get("type", "depolarizing")
        backend_name = f"cure_synth_{nm_type}_v1"
        counts, qpu_s = _simulate(req.noise_model, req.shots)
        return _build_response(counts, backend_name, qpu_s, req.round_num, x_session_id)

    @app.get("/pool/status")
    def pool_status():
        """Return live pool telemetry (re-reads pool_config.json each call)."""
        pool = _load_pool()
        return [
            {**b, "score": round(score_backend(b), 2)}
            for b in pool
        ]

    # ── Oracle endpoints (P1 / P2 / P3) ─────────────────────────────────────

    class PredictQuery(BaseModel):
        symbol: str = "USD/JPY"
        shots: int = 500
        noise_model: dict[str, Any] | None = None

    class CertifyRequest(BaseModel):
        round_num: int
        bitstring: str
        qpu_seconds: float
        session_id: str
        nonce: str

    @app.get("/oracle/predict/{symbol:path}")
    def oracle_predict(
        symbol: str,
        shots: int = 500,
        authorization: str | None = Header(default=None),
        x_session_id: str = Header(default=""),
        x_datacenter_zone: str = Header(default=""),
    ):
        """P1 — QPU signal for a symbol. Internally calls qpu/select logic."""
        _auth(authorization)
        global _round_counter
        _round_counter += 1
        round_num = _round_counter

        # select best backend (zone-aware)
        weights = {"latency": 2.0} if "ap" in x_datacenter_zone else None
        best = select_best(_load_pool(), weights)

        counts, qpu_s = _simulate(None, shots)
        top = max(counts, key=counts.get)
        nonce = _nonce(round_num, top, qpu_s, x_session_id)

        parsed = parse_bitstring(top)

        # update 48-account pool (P2)
        base = 20.83
        pnl_delta = 0.0
        pos = parsed["position"]
        if pos == "LONG":
            pnl_delta = round(base * 10 * (parsed["a_strength"] - 0.5) * random.uniform(0.5, 1.5), 2)
        elif pos == "SHORT":
            pnl_delta = round(-base * 10 * (parsed["b_strength"] - 0.5) * random.uniform(0.5, 1.5), 2)

        _ACCOUNT_POOL.assign(round_num, pos, symbol, pnl_delta, nonce)

        return build_predict_response(
            symbol=symbol,
            parsed=parsed,
            bitstring=top,
            backend_name=best["name"],
            qpu_seconds=qpu_s,
            round_num=round_num,
            contract_nonce=nonce,
        )

    @app.post("/oracle/certify")
    def oracle_certify(
        req: CertifyRequest,
        authorization: str | None = Header(default=None),
    ):
        """P3 — verify a contract nonce against the QPU round parameters."""
        _auth(authorization)
        valid = verify_nonce(
            req.round_num, req.bitstring, req.qpu_seconds, req.session_id, req.nonce
        )
        return {
            "valid": valid,
            "round_num": req.round_num,
            "certified": valid,
            "disclaimer": "quantum_random_signal_not_financial_advice",
        }

    @app.get("/oracle/accounts")
    def oracle_accounts(
        authorization: str | None = Header(default=None),
    ):
        """P2 — 48-account pool status."""
        _auth(authorization)
        return {
            "accounts": _ACCOUNT_POOL.get_all(),
            "summary": _ACCOUNT_POOL.summary(),
        }

    @app.get("/oracle/accounts/{account_id}")
    def oracle_account_one(account_id: int, authorization: str | None = Header(default=None)):
        _auth(authorization)
        acc = _ACCOUNT_POOL.get_one(account_id)
        if acc is None:
            raise HTTPException(status_code=404, detail=f"account {account_id} not found")
        return acc

    @app.post("/oracle/accounts/reset")
    def oracle_accounts_reset(authorization: str | None = Header(default=None)):
        _auth(authorization)
        global _round_counter
        _round_counter = 0
        _ACCOUNT_POOL.reset()
        return {"reset": True, "accounts": 48}

else:
    # Standalone fallback (no FastAPI installed) — used by tests
    app = None  # type: ignore
