"""FastAPI router: /api/v1/qpu/*

POST /api/v1/qpu/benchmark
    Run a SIG benchmark circuit (local Aer, fake-chip, or real IBM QPU).
    IBM mode requires IBM_QUANTUM_TOKEN + IBM_QUANTUM_INSTANCE env vars
    and the confirm field set to the CONFIRM constant.
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cure_oracle.benchmark import (
    CAMPAIGN_SHAPES,
    CONFIRM,
    SHAPE_CIRCUIT_MAP,
    BenchmarkResult,
    issue_sig_if_passed,
    run_benchmark,
    _THETA_INFO,
)

router = APIRouter(prefix="/api/v1/qpu", tags=["qpu"])


# ── request / response models ─────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    shape: str = Field(
        "LINE",
        description="SIG shape: CUBE / RING / TREE / LINE / STAR",
    )
    n_qubits: int = Field(4, ge=2, le=8, description="Circuit width (2–8)")
    theta_disp: str = Field(
        "√.414",
        description="θ_disp code: φ.618 / π.785 / √.414",
    )
    shots: int = Field(4096, ge=1, le=1_000_000, description="Number of shots")
    mode: str = Field(
        "local",
        description="Execution mode: local (Aer) | fake (FakeTorino) | ibm (real QPU)",
    )
    confirm: Optional[str] = Field(
        None,
        description=f'Must equal "{CONFIRM}" to authorise a real-QPU run',
    )


class BenchmarkResponse(BaseModel):
    shape: str
    circuit_family: str
    n_qubits: int
    theta_disp: str
    shots: int
    backend: str
    circuit_hash: str
    delta: float
    eps_threshold: float
    passed: bool
    sig_code: str
    job_id: Optional[str]
    qpu_seconds: Optional[float]
    sig: Optional[str] = Field(None, description="Issued SIG string when passed, else null")


class CampaignShape(BaseModel):
    shape: str
    circuit_family: str
    theta_disp: str
    eps_code: str


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/benchmark/shapes", response_model=list[CampaignShape])
def list_benchmark_shapes() -> list[CampaignShape]:
    """Return the five canonical SIG benchmark shapes."""
    return [
        CampaignShape(
            shape=c["shape"],
            circuit_family=SHAPE_CIRCUIT_MAP[c["shape"]],
            theta_disp=c["theta_disp"],
            eps_code=_THETA_INFO[c["theta_disp"]][2],
        )
        for c in CAMPAIGN_SHAPES
    ]


@router.post("/benchmark", response_model=BenchmarkResponse)
def run_benchmark_endpoint(req: BenchmarkRequest) -> BenchmarkResponse:
    """
    Run a SIG benchmark circuit and return the TVD result.

    - **local**: Qiskit Aer statevector simulator (no credentials needed)
    - **fake**: FakeTorino noise model (no credentials needed)
    - **ibm**: real QPU — reads IBM_QUANTUM_TOKEN and IBM_QUANTUM_INSTANCE
      from environment variables; `confirm` must equal `"RUN ON QPU"`
    """
    if req.shape not in SHAPE_CIRCUIT_MAP:
        raise HTTPException(
            status_code=422,
            detail=f"unknown shape {req.shape!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}",
        )
    if req.theta_disp not in ("φ.618", "π.785", "√.414"):
        raise HTTPException(
            status_code=422,
            detail=f"unknown theta_disp {req.theta_disp!r}; valid: φ.618 / π.785 / √.414",
        )
    if req.mode not in ("local", "fake", "ibm"):
        raise HTTPException(
            status_code=422,
            detail=f"unknown mode {req.mode!r}; valid: local / fake / ibm",
        )

    kwargs: dict = dict(
        shape=req.shape,
        n_qubits=req.n_qubits,
        theta_disp=req.theta_disp,
        shots=req.shots,
        mode=req.mode,
    )
    if req.mode == "ibm":
        token = os.environ.get("IBM_QUANTUM_TOKEN")
        instance = os.environ.get("IBM_QUANTUM_INSTANCE")
        if not token:
            raise HTTPException(
                status_code=503,
                detail="IBM_QUANTUM_TOKEN environment variable is not set",
            )
        if not instance:
            raise HTTPException(
                status_code=503,
                detail="IBM_QUANTUM_INSTANCE environment variable is not set",
            )
        kwargs["token"] = token
        kwargs["instance"] = instance
        kwargs["confirm"] = req.confirm  # PermissionError if wrong

    try:
        result: BenchmarkResult = run_benchmark(**kwargs)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    sig = issue_sig_if_passed(result)
    return BenchmarkResponse(
        shape=result.shape,
        circuit_family=result.circuit_family,
        n_qubits=result.n_qubits,
        theta_disp=result.theta_disp,
        shots=result.shots,
        backend=result.backend,
        circuit_hash=result.circuit_hash,
        delta=round(result.delta, 6),
        eps_threshold=result.eps_threshold,
        passed=result.passed,
        sig_code=result.sig_code,
        job_id=result.job_id,
        qpu_seconds=result.qpu_seconds,
        sig=sig,
    )
