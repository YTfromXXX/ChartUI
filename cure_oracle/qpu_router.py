"""FastAPI router: /api/v1/qpu/*

POST /api/v1/qpu/benchmark
    Run a SIG benchmark circuit (local Aer, fake-chip, or real IBM QPU).
    IBM mode requires IBM_QUANTUM_TOKEN + IBM_QUANTUM_INSTANCE env vars
    and the confirm field set to the CONFIRM constant.

Security controls
-----------------
- Role-based access: OPERATOR for local/fake, QPU_ADMIN for ibm mode
- cert_path: filename-only, resolved inside CERT_BASE_DIR (path traversal fix)
- Exception messages sanitized before returning (no token/CRN leakage)
- MenteTriangle.label restricted to A-D
- shots capped per mode (local/fake ≤ 100k, ibm ≤ 20k)
- All operations logged to tamper-evident Keccak-256 audit chain
"""

from __future__ import annotations

import os
import platform
import sys
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from cure_oracle.benchmark import (
    CAMPAIGN_SHAPES,
    CONFIRM,
    SHAPE_CIRCUIT_MAP,
    BenchmarkResult,
    get_eps_code,
    issue_sig_if_passed,
    run_benchmark,
)
from cure_oracle.mente import (
    MENTE_CONST,
    HEAVENLY_KINGS,
    check_mente,
    issue_birth_on_mente,
)
from cure_oracle.security import (
    AuditLogger,
    Role,
    require_role,
    safe_cert_path,
    sanitize_error,
    secure_write_json,
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
    label: str = Field(..., pattern=r"^[A-Da-d]$",
                       description="Label A / B / C / D")


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
        pattern=r"^[\w\-. ]+\.json$",
        description="Filename only (no directory component)",
    )


class MenteBirthResponse(BaseModel):
    mente_achieved: bool
    mente_total:    float
    mente_const:    float
    cert:           Optional[dict] = None
    receipts:       Optional[list[dict]] = None
    cert_path:      Optional[str] = None
    html_path:      Optional[str] = None


# ── audit chain endpoint ──────────────────────────────────────────────────────

class AuditEventResponse(BaseModel):
    event_id:  str
    timestamp: str
    role:      str
    action:    str
    resource:  str
    outcome:   str
    detail:    dict
    prev_hash: str
    sig:       str


@router.get("/audit/chain", response_model=list[AuditEventResponse])
def get_audit_chain(
    _role: Role = Depends(require_role(Role.OPERATOR)),
) -> list[AuditEventResponse]:
    """Return the most recent 50 audit events (tamper-evident Keccak-256 chain)."""
    from dataclasses import asdict
    return [AuditEventResponse(**asdict(e)) for e in AuditLogger.get().get_chain(50)]


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/benchmark/shapes", response_model=list[CampaignShape])
def list_benchmark_shapes() -> list[CampaignShape]:
    """Return the five canonical SIG benchmark shapes."""
    return [
        CampaignShape(
            shape=c["shape"],
            circuit_family=SHAPE_CIRCUIT_MAP[c["shape"]],
            theta_disp=c["theta_disp"],
            eps_code=get_eps_code(c["theta_disp"]),
        )
        for c in CAMPAIGN_SHAPES
    ]


@router.post("/benchmark", response_model=BenchmarkResponse)
def run_benchmark_endpoint(
    req: BenchmarkRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> BenchmarkResponse:
    """
    Run a SIG benchmark circuit and return the TVD result.

    - **local**: Qiskit Aer statevector simulator (OPERATOR+)
    - **fake**: FakeTorino noise model (OPERATOR+)
    - **ibm**: real QPU — QPU_ADMIN role required; reads IBM_QUANTUM_TOKEN
      and IBM_QUANTUM_INSTANCE from environment variables
    """
    audit = AuditLogger.get()
    resource = f"{req.shape}/{req.mode}"

    if req.shape not in SHAPE_CIRCUIT_MAP:
        audit.log(role.value, "benchmark.run", resource, "failure",
                  {"reason": "unknown_shape"})
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

    # shots mode-aware limits
    if req.mode in ("local", "fake") and req.shots > 100_000:
        raise HTTPException(422, "shots > 100,000 not allowed for local/fake mode")
    if req.mode == "ibm" and req.shots > 20_000:
        raise HTTPException(422, "shots > 20,000 not allowed for ibm mode")

    # QPU_ADMIN required for ibm mode
    if req.mode == "ibm" and role != Role.QPU_ADMIN:
        audit.log(role.value, "benchmark.run", resource, "denied",
                  {"reason": "insufficient_role"})
        raise HTTPException(status_code=403, detail="QPU_ADMIN role required for ibm mode")

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
        kwargs["confirm"] = req.confirm

    try:
        result: BenchmarkResult = run_benchmark(**kwargs)
    except PermissionError as exc:
        audit.log(role.value, "benchmark.run", resource, "denied",
                  {"error_type": "PermissionError"})
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        audit.log(role.value, "benchmark.run", resource, "failure",
                  {"error_type": "ValueError"})
        raise HTTPException(status_code=422, detail=sanitize_error(exc)) from exc
    except Exception as exc:
        audit.log(role.value, "benchmark.run", resource, "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="internal server error") from exc

    sig = issue_sig_if_passed(result)
    audit.log(role.value, "benchmark.run", resource, "success",
              {"passed": result.passed, "delta": round(result.delta, 6)})
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
def mente_check_endpoint(
    req: MenteCheckRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> MenteCheckResponse:
    """
    Calculate the MENTE score for a batch of mesh triangles.

    Pass 1–4 triangles (labels A–D, q = radius ratio 2r/R).
    When **mente_achieved** is True all four 四天王 have appeared —
    call `/mente/birth` to auto-issue the birth certificate.
    """
    audit = AuditLogger.get()
    tris = [{"q": t.q, "label": t.label} for t in req.triangles]
    try:
        result = check_mente(tris)
    except Exception as exc:
        audit.log(role.value, "mente.check", "mente", "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(status_code=422, detail=sanitize_error(exc)) from exc

    audit.log(role.value, "mente.check", "mente", "success",
              {"mente_achieved": result.mente_achieved,
               "mente_total": round(result.mente_total, 4)})
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
def mente_birth_endpoint(
    req: MenteBirthRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> MenteBirthResponse:
    """
    Issue a birth certificate when MENTE is achieved (四天王全顕現).

    Requires a `round_result` from a QPU or local/fake round run.
    When **mente_achieved** is False nothing is written and the response
    carries only the MENTE calculation (no cert / receipts).
    """
    audit = AuditLogger.get()
    tris = [{"q": t.q, "label": t.label} for t in req.triangles]

    # Resolve safe path before any heavy computation
    try:
        cert_path = safe_cert_path(req.cert_path)
    except ValueError as exc:
        audit.log(role.value, "cert.birth", "cert", "failure",
                  {"reason": "invalid_cert_path"})
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        birth = issue_birth_on_mente(tris, req.round_result, str(cert_path))
    except Exception as exc:
        audit.log(role.value, "cert.birth", "cert", "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="internal server error") from exc

    if birth is None:
        # MENTE not achieved — return the check result only
        try:
            check = check_mente(tris)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=sanitize_error(exc)) from exc
        audit.log(role.value, "cert.birth", "cert", "success",
                  {"mente_achieved": False})
        return MenteBirthResponse(
            mente_achieved=False,
            mente_total=check.mente_total,
            mente_const=check.mente_const,
        )

    # Overwrite the cert file with secure permissions
    secure_write_json(cert_path, birth.cert)

    audit.log(role.value, "cert.birth", "cert", "success",
              {"mente_achieved": True, "cert_path": str(cert_path)})
    return MenteBirthResponse(
        mente_achieved=True,
        mente_total=birth.check.mente_total,
        mente_const=birth.check.mente_const,
        cert=birth.cert,
        receipts=birth.receipts,
        cert_path=str(cert_path),
        html_path=birth.html_path,
    )


# ── Observe endpoint: A地点/B地点 OS識別 + MENTE座標空間 ────────────────────────

class _OSInfo(BaseModel):
    system:     str
    release:    str
    machine:    str
    python:     str
    role:       str   # "quantum_state" (A) or "observer" (B)


class MenteCoordAxis(BaseModel):
    slot:       str
    king:       str
    q_min:      float
    q_max:      float
    description: str


class ObserveResponse(BaseModel):
    point_a:            _OSInfo                 # server / quantum state
    point_b:            _OSInfo                 # client / observer
    mente_const:        float
    coordinate_space:   list[MenteCoordAxis]    # 4 axes S1–S4
    basis:              str                     # "四天王座標系 φ×√2"


_MENTE_AXES: list[MenteCoordAxis] = [
    MenteCoordAxis(slot="S4", king="広目天", q_min=0.75, q_max=1.0,
                   description="最高位 — 広く遠くを見通す (q ≥ 0.75)"),
    MenteCoordAxis(slot="S1", king="多聞天", q_min=0.50, q_max=0.75,
                   description="全てを聴く — 情報の受信軸 (0.50 ≤ q < 0.75)"),
    MenteCoordAxis(slot="S3", king="持国天", q_min=0.25, q_max=0.50,
                   description="国を守る — 安定化軸 (0.25 ≤ q < 0.50)"),
    MenteCoordAxis(slot="S2", king="増長天", q_min=0.0,  q_max=0.25,
                   description="成長を促す — 初期観測軸 (q < 0.25)"),
]


@router.get("/observe", response_model=ObserveResponse)
def observe_endpoint(
    request: Request,
    _role: Role = Depends(require_role(Role.VIEWER)),
) -> ObserveResponse:
    """
    A地点 (量子状態 / server) と B地点 (観察者OS / client) を識別し
    MENTE座標空間を返す。

    - **A地点**: FastAPI バックエンド OS — 量子回路を実行する側
    - **B地点**: クライアント (Flet/Kivyデバイス) — 観察者OS
    - **四天王座標系**: q値によって 4軸(S1–S4)に射影、mente_total ≥ φ×√2 で全顕現
    """
    ua = request.headers.get("user-agent", "unknown")
    client_host = getattr(request.client, "host", "unknown") if request.client else "unknown"

    point_a = _OSInfo(
        system=platform.system(),
        release=platform.release(),
        machine=platform.machine(),
        python=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        role="quantum_state",
    )
    point_b = _OSInfo(
        system=ua,
        release=client_host,
        machine=platform.machine(),
        python="observer",
        role="observer",
    )

    AuditLogger.get().log(
        "viewer", "observe", "system",
        "success", {"client_host": client_host},
    )
    return ObserveResponse(
        point_a=point_a,
        point_b=point_b,
        mente_const=round(MENTE_CONST, 6),
        coordinate_space=_MENTE_AXES,
        basis="四天王座標系 φ×√2",
    )
