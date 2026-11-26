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
from cure_oracle.mente import (
    MENTE_CONST,
    HEAVENLY_KINGS,
    check_mente,
    issue_birth_on_mente,
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


# ── MENTE models ──────────────────────────────────────────────────────────────

class MenteTriangle(BaseModel):
    q: float = Field(..., ge=0.0, le=1.0,
                     description="Triangle quality q = 2r/R")
    label: str = Field(..., description="Label A / B / C / D")


class MenteSlotResponse(BaseModel):
    label:   str
    slot:    str
    king:    str
    sig:     str
    mente:   float
    epsilon: float
    shape:   str


class MenteCheckRequest(BaseModel):
    triangles: list[MenteTriangle] = Field(
        ..., min_length=1, max_length=4,
        description="1–4 triangles; pass all 4 slots (A–D) for 四天王全顕現",
    )


class MenteCheckResponse(BaseModel):
    slots:          list[MenteSlotResponse]
    mente_total:    float
    mente_achieved: bool
    mente_const:    float
    missing_kings:  list[str]


class MenteBirthRequest(BaseModel):
    triangles:    list[MenteTriangle] = Field(..., min_length=1, max_length=4)
    round_result: dict = Field(
        ...,
        description="dict returned by round_circuit() or POST /api/v1/qpu/round",
    )
    cert_path: str = Field(
        "cure_birth_certificate.json",
        description="Where to write the certificate on the server",
    )


class MenteBirthResponse(BaseModel):
    mente_achieved: bool
    mente_total:    float
    mente_const:    float
    cert:           Optional[dict] = None
    receipts:       Optional[list[dict]] = None
    cert_path:      Optional[str] = None
    html_path:      Optional[str] = None


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


@router.post("/mente/check", response_model=MenteCheckResponse)
def mente_check_endpoint(req: MenteCheckRequest) -> MenteCheckResponse:
    """
    Calculate the MENTE score for a batch of mesh triangles.

    Pass 1–4 triangles (labels A–D, q = radius ratio 2r/R).
    When **mente_achieved** is True all four 四天王 have appeared —
    call `/mente/birth` to auto-issue the birth certificate.
    """
    tris = [{"q": t.q, "label": t.label} for t in req.triangles]
    try:
        result = check_mente(tris)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MenteCheckResponse(
        slots=[
            MenteSlotResponse(
                label=s.label, slot=s.slot, king=s.king,
                sig=s.sig, mente=s.mente,
                epsilon=s.epsilon, shape=s.shape,
            )
            for s in result.slots
        ],
        mente_total=result.mente_total,
        mente_achieved=result.mente_achieved,
        mente_const=result.mente_const,
        missing_kings=result.missing_kings,
    )


@router.post("/mente/birth", response_model=MenteBirthResponse)
def mente_birth_endpoint(req: MenteBirthRequest) -> MenteBirthResponse:
    """
    Issue a birth certificate when MENTE is achieved (四天王全顕現).

    Requires a `round_result` from a QPU or local/fake round run.
    When **mente_achieved** is False nothing is written and the response
    carries only the MENTE calculation (no cert / receipts).
    """
    tris = [{"q": t.q, "label": t.label} for t in req.triangles]
    try:
        birth = issue_birth_on_mente(tris, req.round_result, req.cert_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if birth is None:
        # MENTE not achieved — return the check result only
        try:
            check = check_mente(tris)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return MenteBirthResponse(
            mente_achieved=False,
            mente_total=check.mente_total,
            mente_const=check.mente_const,
        )

    return MenteBirthResponse(
        mente_achieved=True,
        mente_total=birth.check.mente_total,
        mente_const=birth.check.mente_const,
        cert=birth.cert,
        receipts=birth.receipts,
        cert_path=birth.cert_path,
        html_path=birth.html_path,
    )
