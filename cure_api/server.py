"""Cure-API mock server — FastAPI implementation.

Endpoints
---------
POST /qpu/run    — run on the pool's current default backend
POST /qpu/select — score the pool and SELECT the best backend
POST /qpu/create — build a synthetic QPU from noise_model, run, return counts

Usage
-----
    pip install fastapi uvicorn
    uvicorn cure_api.server:app --port 8700 --reload

Then in round_circuit:
    r = round_circuit(5, mode="custom", endpoint="http://localhost:8700/qpu/run", api_key="dev")

Smart-contract nonce is computed server-side and returned in the response:
    sha256(str(round_num) + top_bitstring + str(qpu_seconds) + session_id)
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import time
from typing import Any

try:
    from fastapi import FastAPI, Header, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel
    _HAS_FASTAPI = True
except ImportError:
    _HAS_FASTAPI = False

from cure_api.scoring import select_best, score_backend

# ── QPU pool ──────────────────────────────────────────────────────────────────
# In production, replace with live telemetry. Static for the mock.
QPU_POOL: list[dict] = [
    {"name": "cure_synth_eagle_r3",  "queue_len": 4,  "avg_gate_error": 0.004, "latency_ms": 420,  "available_shots": 2000, "operational": True},
    {"name": "cure_synth_heron_r2",  "queue_len": 11, "avg_gate_error": 0.002, "latency_ms": 680,  "available_shots": 1800, "operational": True},
    {"name": "cure_synth_falcon_r1", "queue_len": 2,  "avg_gate_error": 0.012, "latency_ms": 210,  "available_shots": 2000, "operational": True},
    {"name": "cure_synth_ideal_v1",  "queue_len": 0,  "avg_gate_error": 0.000, "latency_ms": 80,   "available_shots": 9999, "operational": True},
]

DEFAULT_BACKEND = "cure_synth_eagle_r3"
N_QUBITS = 13


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
        return [
            {**b, "score": round(score_backend(b), 2)}
            for b in QPU_POOL
        ]

else:
    # Standalone fallback (no FastAPI installed) — used by tests
    app = None  # type: ignore
