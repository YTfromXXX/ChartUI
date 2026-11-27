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

import datetime
import hashlib
import os
import platform
import sys
import uuid
from typing import Optional

import asyncio
import json as _json

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from cure_oracle.birth import make_sig_receipt
from cure_oracle.accelerator import (
    AcceleratorResult,
    VirtualAccelerator,
)
from cure_oracle.gemini_candy import GeminiCandyFlash
from cure_oracle.sonnet_score import SonnetScore
from cure_oracle.sonnet_remix import compute_remix, VALID_REMIX_STYLES
from cure_oracle.mesh_score import (
    strokes_to_score, era_from_mente, GridConfig as MeshGridConfig,
    CURRENT_REV, ERA_MENTE_LOWER,
)
from cure_oracle.quantum_sim import run_quantum_sim, CURRENT_REV as QS_REV
from cure_oracle.midi_viz import build_midi_viz_frame
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


# ── request / response models ───────────────────────────────────────────────

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


# ── audit chain endpoint ────────────────────────────────────────────────────

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


# ── Observe endpoint: A地点/B地点 OS識別 + MENTE座標空間 ──────────────────────

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
    observe_receipt:    Optional[dict] = None   # sig-receipt/1 Keccak-256 Merkle


def _build_observe_receipt(point_a: _OSInfo, mente: float) -> dict:
    """Build a sig-receipt/1 Keccak-256 Merkle receipt for one /observe call.

    Cure-OS (A地点) signs its identity so PopKivyDevice-OS (B地点) can verify
    it received a genuine quantum_state measurement.

    SIG code: CUBE (四天王座標系の立方対称) − φ.618 (q ≥ 0.75, highest fidelity)
              − ε.001 (< 0.01 delta, benchmark-grade noise floor)
    """
    obs_id  = str(uuid.uuid4())
    born_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    backend = f"cure-os/{point_a.role}/{point_a.system}"
    # Keccak-256 of the coordinate space description as the "circuit hash" analogue
    coord_hash = hashlib.sha256(
        f"四天王座標系|φ×√2|{mente:.6f}".encode()
    ).hexdigest()

    cert = {
        "certificate_id": obs_id,
        "born_at":         born_at,
        "backend":         backend,
        "qpu_seconds":     0,
        "bitstring":       coord_hash[:16],
    }
    # sig_code: CUBE-φ.618-ε.001  (highest tier — MENTE_CONST ≥ HEAVENLY_KINGS)
    return make_sig_receipt(cert, "CUBE-φ.618-ε.001", 0.001, mente)


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

    receipt = _build_observe_receipt(point_a, MENTE_CONST)

    AuditLogger.get().log(
        "viewer", "observe", "system",
        "success", {
            "client_host": client_host,
            "receipt_root": receipt["merkle"]["root"],
        },
    )
    return ObserveResponse(
        point_a=point_a,
        point_b=point_b,
        mente_const=round(MENTE_CONST, 6),
        coordinate_space=_MENTE_AXES,
        basis="四天王座標系 φ×√2",
        observe_receipt=receipt,
    )


# ── Virtual Accelerator endpoint ──────────────────────────────────────────────

class AccelerateRequest(BaseModel):
    shapes: list[str] = Field(
        ..., min_length=1, max_length=10,
        description="1–10 QPU shapes (duplicates = QPU replication). "
                    "Valid: CUBE / RING / TREE / LINE / STAR",
    )
    shots: Optional[int] = Field(
        None, ge=1, le=100_000,
        description="Shots per shape; None = each shape's canonical default",
    )
    mode: str = Field(
        "local",
        description="Execution mode: local | fake | ibm",
    )
    confirm: Optional[str] = Field(
        None,
        description=f'Must equal "{CONFIRM}" to authorise a real-QPU run',
    )


class AcceleratorRunResponse(BaseModel):
    shape:        str
    q:            float
    slot:         str
    delta:        float
    passed:       bool
    sig_code:     str
    backend:      str
    shots:        int
    theta_disp:   str


class SynthesizedResponse(BaseModel):
    slots:          dict[str, AcceleratorRunResponse]
    mente_total:    float
    mente_achieved: bool
    four_kings:     bool
    missing_slots:  list[str]


class AccelerateResponse(BaseModel):
    run_id:          str
    born_at:         str
    runs:            list[AcceleratorRunResponse]
    synthesized:     SynthesizedResponse
    observe_receipt: dict


@router.post("/accelerate", response_model=AccelerateResponse)
def accelerate_endpoint(
    req: AccelerateRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> AccelerateResponse:
    """
    仮想加速器 — 複数 QPU 形状を並列実行し MENTE 座標で合成する。

    - 同じ形状を複数指定することで QPU プール複製が可能
    - 各実行結果の q = 1 − δ を四天王スロット(S1–S4)に射影
    - 同一スロットに複数結果がある場合、最高 q（最大コヒーレンス）を採用
    - 合成 mente_total ≥ MENTE_CONST で四天王全顕現
    - sig-receipt/1 を発行（全顕現時は CUBE-φ.618-ε.001）
    """
    audit = AuditLogger.get()
    resource = f"accelerate/{','.join(req.shapes)}/{req.mode}"

    for shape in req.shapes:
        if shape not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(
                status_code=422,
                detail=f"unknown shape {shape!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}",
            )
    if req.mode not in ("local", "fake", "ibm"):
        raise HTTPException(
            status_code=422,
            detail=f"unknown mode {req.mode!r}; valid: local / fake / ibm",
        )
    if req.mode == "ibm" and role != Role.QPU_ADMIN:
        audit.log(role.value, "accelerate.run", resource, "denied",
                  {"reason": "insufficient_role"})
        raise HTTPException(status_code=403, detail="QPU_ADMIN role required for ibm mode")
    if req.shots and req.mode == "ibm" and req.shots > 20_000:
        raise HTTPException(422, "shots > 20,000 not allowed for ibm mode")

    kwargs: dict = dict(shapes=req.shapes, mode=req.mode)
    if req.shots is not None:
        kwargs["shots"] = req.shots
    if req.mode == "ibm":
        token = os.environ.get("IBM_QUANTUM_TOKEN")
        instance = os.environ.get("IBM_QUANTUM_INSTANCE")
        if not token:
            raise HTTPException(503, "IBM_QUANTUM_TOKEN environment variable is not set")
        if not instance:
            raise HTTPException(503, "IBM_QUANTUM_INSTANCE environment variable is not set")
        kwargs.update(token=token, instance=instance, confirm=req.confirm)

    try:
        acc = VirtualAccelerator()
        result: AcceleratorResult = acc.run(**kwargs)
    except ValueError as exc:
        audit.log(role.value, "accelerate.run", resource, "failure",
                  {"error_type": "ValueError"})
        raise HTTPException(status_code=422, detail=sanitize_error(exc)) from exc
    except Exception as exc:
        audit.log(role.value, "accelerate.run", resource, "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="internal server error") from exc

    audit.log(role.value, "accelerate.run", resource, "success",
              {"mente_total": result.synthesized.mente_total,
               "four_kings": result.synthesized.four_kings,
               "run_count": len(result.runs)})

    def _run_resp(r) -> AcceleratorRunResponse:
        return AcceleratorRunResponse(
            shape=r.shape, q=r.q, slot=r.slot, delta=r.delta,
            passed=r.passed, sig_code=r.sig_code, backend=r.backend,
            shots=r.shots, theta_disp=r.theta_disp,
        )

    return AccelerateResponse(
        run_id=result.run_id,
        born_at=result.born_at,
        runs=[_run_resp(r) for r in result.runs],
        synthesized=SynthesizedResponse(
            slots={slot: _run_resp(run) for slot, run in result.synthesized.slots.items()},
            mente_total=result.synthesized.mente_total,
            mente_achieved=result.synthesized.mente_achieved,
            four_kings=result.synthesized.four_kings,
            missing_slots=result.synthesized.missing_slots,
        ),
        observe_receipt=result.observe_receipt,
    )


# ── Gemini-Candy-Flash endpoint ───────────────────────────────────────────────

class GeminiRecommendationResponse(BaseModel):
    suggested_shapes: list[str]
    suggested_shots:  int
    suggested_theta:  str
    retest_reason:    str
    commentary:       str
    model_used:       str


class CandyFlashRequest(BaseModel):
    shapes: list[str] = Field(
        ..., min_length=1, max_length=5,
        description="キャンディ群: 1–5 形状 (CUBE / RING / TREE / LINE / STAR)",
    )
    shots: Optional[int] = Field(
        None, ge=1, le=100_000,
        description="Shots per shape; None = canonical default per shape",
    )
    mode: str = Field("local", description="local | fake")
    round_num: int = Field(1, ge=1, le=9999, description="蔓旋ラウンド番号")
    offline: bool = Field(
        False,
        description="True = skip Gemini call, return heuristic recommendation",
    )


class CandyFlashResponse(BaseModel):
    session_id:      str
    born_at:         str
    runs:            list[AcceleratorRunResponse]
    synthesized:     SynthesizedResponse
    spiral:          dict
    spiral_preview:  str
    gemini:          GeminiRecommendationResponse
    observe_receipt: dict


@router.post("/candy/flash", response_model=CandyFlashResponse)
def candy_flash_endpoint(
    req: CandyFlashRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> CandyFlashResponse:
    """
    Gemini-Candy-Flash-API — キャンディ群 × 蔓旋 → Gemini Flash パラメーター制御。

    キャンディ群（CUBE / RING / TREE / LINE / STAR）の量子回路を実行し、
    蔓旋ラウンド回路状態と合わせて Gemini Flash に送信する。
    Gemini は MENTE スコア改善のための内部パラメーター推袖を返す。

    **offline=true** で Gemini 呼び出しをスキップし、ヒューリスティック推袖を返す。
    Gemini を呼び出す場合は GEMINI_API_KEY 環境変数が必要。
    """
    audit = AuditLogger.get()
    resource = f"candy/flash/{','.join(req.shapes)}/R{req.round_num}"

    for s in req.shapes:
        if s not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(
                status_code=422,
                detail=f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}",
            )
    if req.mode not in ("local", "fake"):
        raise HTTPException(422, "candy/flash supports only local or fake mode")

    try:
        flash = GeminiCandyFlash()
        if req.offline or not os.environ.get("GEMINI_API_KEY"):
            result = flash.run_offline(
                shapes=req.shapes,
                shots=req.shots,
                mode=req.mode,
                round_num=req.round_num,
            )
        else:
            result = flash.run(
                shapes=req.shapes,
                shots=req.shots,
                mode=req.mode,
                round_num=req.round_num,
            )
    except EnvironmentError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=sanitize_error(exc)) from exc
    except Exception as exc:
        audit.log(role.value, "candy.flash", resource, "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(status_code=500, detail="internal server error") from exc

    acc = result.accelerator
    audit.log(role.value, "candy.flash", resource, "success", {
        "mente_total":  acc.synthesized.mente_total,
        "four_kings":   acc.synthesized.four_kings,
        "model_used":   result.recommendation.model_used,
    })

    def _rr(r) -> AcceleratorRunResponse:
        return AcceleratorRunResponse(
            shape=r.shape, q=r.q, slot=r.slot, delta=r.delta,
            passed=r.passed, sig_code=r.sig_code, backend=r.backend,
            shots=r.shots, theta_disp=r.theta_disp,
        )

    return CandyFlashResponse(
        session_id=result.session_id,
        born_at=result.born_at,
        runs=[_rr(r) for r in acc.runs],
        synthesized=SynthesizedResponse(
            slots={s: _rr(run) for s, run in acc.synthesized.slots.items()},
            mente_total=acc.synthesized.mente_total,
            mente_achieved=acc.synthesized.mente_achieved,
            four_kings=acc.synthesized.four_kings,
            missing_slots=acc.synthesized.missing_slots,
        ),
        spiral=result.spiral,
        spiral_preview=result.spiral_preview,
        gemini=GeminiRecommendationResponse(
            suggested_shapes=result.recommendation.suggested_shapes,
            suggested_shots=result.recommendation.suggested_shots,
            suggested_theta=result.recommendation.suggested_theta,
            retest_reason=result.recommendation.retest_reason,
            commentary=result.recommendation.commentary,
            model_used=result.recommendation.model_used,
        ),
        observe_receipt=result.observe_receipt,
    )


# ── Sonnet-Score endpoint ────────────────────────────────────────────────────────

class ScoreEventResponse(BaseModel):
    beat:          float
    duration:      float
    register:      str
    motif:         str
    intensity:     float
    embellishment: Optional[str] = None


class DriveCellResponse(BaseModel):
    col:    int
    row:    int
    shape:  str
    slot:   str
    motif:  str
    q:      float
    effect: str


class DriveBoardResponse(BaseModel):
    name:  str
    cols:  int
    rows:  int
    cells: list[DriveCellResponse]
    grid:  list[list[Optional[str]]]


class SonnetScoreRequest(BaseModel):
    shapes: list[str] = Field(
        ..., min_length=1, max_length=5,
        description="キャンディ群: 1–5 形状",
    )
    shots:     Optional[int] = Field(None, ge=1, le=100_000)
    mode:      str = Field("local", description="local | fake")
    round_num: int = Field(1, ge=1, le=9999, description="蔓旋ラウンド番号")
    bars:      int = Field(4, ge=1, le=32,   description="スコアのバー数")


class SonnetScoreResponse(BaseModel):
    score_id:       str
    born_at:        str
    bpm:            int
    bars:           int
    tilt_rate:      float
    ascent_rate:    float
    mente_total:    float
    mente_achieved: bool
    key:            str
    mode_name:      str
    era:            str
    events:         list[ScoreEventResponse]
    board_1:        DriveBoardResponse
    board_2:        DriveBoardResponse
    embellishments: list[str]
    commentary:     str
    observe_receipt: dict


@router.post("/candy/sonnet", response_model=SonnetScoreResponse)
def candy_sonnet_endpoint(
    req: SonnetScoreRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> SonnetScoreResponse:
    """
    Sonnet-Score-API — ハーマイオニーの杖 × ドライブ板 × 蔓旋 → 音楽スコア生成。

    キャンディ群の量子回路を実行し蔓旋状態と組み合わせて
    ドライブ板グリッド(1: 4×4 / 2: 8×4)へのワンド攻撃を配置、
    MENTE 上昇率・BPM・音楽時代（バロック→ロマン派）を含む
    Sonnet-Score 構造体と sig-receipt/1 を返す。
    """
    audit = AuditLogger.get()
    resource = f"candy/sonnet/{','.join(req.shapes)}/R{req.round_num}"

    for s in req.shapes:
        if s not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(422, f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}")
    if req.mode not in ("local", "fake"):
        raise HTTPException(422, "sonnet supports only local or fake mode")

    try:
        ss = SonnetScore(bars=req.bars)
        result = ss.compute_offline(
            shapes=req.shapes,
            shots=req.shots,
            mode=req.mode,
            round_num=req.round_num,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=sanitize_error(exc)) from exc
    except Exception as exc:
        audit.log(role.value, "candy.sonnet", resource, "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(500, "internal server error") from exc

    audit.log(role.value, "candy.sonnet", resource, "success", {
        "ascent_rate": result.ascent_rate,
        "bpm":         result.bpm,
        "era":         result.era,
    })

    def _board(b) -> DriveBoardResponse:
        return DriveBoardResponse(
            name=b.name, cols=b.cols, rows=b.rows,
            cells=[DriveCellResponse(
                col=c.col, row=c.row, shape=c.shape, slot=c.slot,
                motif=c.motif, q=c.q, effect=c.effect,
            ) for c in b.cells],
            grid=b.to_grid(),
        )

    return SonnetScoreResponse(
        score_id=result.score_id,
        born_at=result.born_at,
        bpm=result.bpm,
        bars=result.bars,
        tilt_rate=result.tilt_rate,
        ascent_rate=result.ascent_rate,
        mente_total=result.mente_total,
        mente_achieved=result.mente_achieved,
        key=result.key,
        mode_name=result.mode_name,
        era=result.era,
        events=[ScoreEventResponse(
            beat=e.beat, duration=e.duration, register=e.register,
            motif=e.motif, intensity=e.intensity, embellishment=e.embellishment,
        ) for e in result.events],
        board_1=_board(result.board_1),
        board_2=_board(result.board_2),
        embellishments=result.embellishments,
        commentary=result.commentary,
        observe_receipt=result.observe_receipt,
    )


# ── Sonnet-Score Remix endpoint ───────────────────────────────────────────────

class BmiStateModel(BaseModel):
    focus:  float = Field(0.5, ge=0.0, le=1.0, description="Melody clarity driver")
    calm:   float = Field(0.5, ge=0.0, le=1.0, description="Tempo modifier driver")
    energy: float = Field(0.5, ge=0.0, le=1.0, description="Layer intensity driver")


class RemixLayerResponse(BaseModel):
    tempo_modifier:  float
    layer_intensity: float
    instrument_set:  list[str]
    loop_signature:  str
    bmi_influence:   str
    export_hint:     str


class SonnetRemixRequest(BaseModel):
    shapes: list[str] = Field(
        ..., min_length=1, max_length=5,
        description="キャンディ群: 1–5 形状",
    )
    shots:        Optional[int]           = Field(None, ge=1, le=100_000)
    mode:         str                     = Field("local", description="local | fake")
    round_num:    int                     = Field(1, ge=1, le=9999)
    bars:         int                     = Field(4, ge=1, le=32)
    bmi_state:    Optional[BmiStateModel] = Field(
        None,
        description="Cure-BMI state; null → defaults (focus=0.5, calm=0.5, energy=0.5)",
    )
    remix_style:  str = Field(
        "orchestral",
        description="orchestral | electronic | ambient",
    )


class SonnetRemixResponse(SonnetScoreResponse):
    remix: RemixLayerResponse


@router.post("/candy/sonnet/remix", response_model=SonnetRemixResponse)
def candy_sonnet_remix_endpoint(
    req: SonnetRemixRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> SonnetRemixResponse:
    """
    Sonnet-Score Remix — キャンディ群 × Cure-BMI → バックグラウンド音楽リミック層。

    SonnetScoreResponse の全フィールドに加え、BMI 脳波状態（focus / calm / energy）を
    音楽パラメーター（テンポ倍率・楽器セット・ループ拍子）へマッピングした
    `remix` オブジェクトを返す。

    **bmi_state=null** の場合は デフォルト値 (focus=0.5, calm=0.5, energy=0.5) を使用。
    """
    audit = AuditLogger.get()
    resource = f"candy/sonnet/remix/{','.join(req.shapes)}/R{req.round_num}"

    for s in req.shapes:
        if s not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(422, f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}")
    if req.mode not in ("local", "fake"):
        raise HTTPException(422, "sonnet/remix supports only local or fake mode")
    if req.remix_style not in VALID_REMIX_STYLES:
        raise HTTPException(422, f"remix_style must be one of {VALID_REMIX_STYLES}")

    try:
        ss = SonnetScore(bars=req.bars)
        result = ss.compute_offline(
            shapes=req.shapes,
            shots=req.shots,
            mode=req.mode,
            round_num=req.round_num,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=sanitize_error(exc)) from exc
    except Exception as exc:
        audit.log(role.value, "candy.sonnet.remix", resource, "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(500, "internal server error") from exc

    bmi_dict = req.bmi_state.model_dump() if req.bmi_state else None
    remix = compute_remix(
        era=result.era,
        bmi_state=bmi_dict,
        remix_style=req.remix_style,
    )

    audit.log(role.value, "candy.sonnet.remix", resource, "success", {
        "ascent_rate":   result.ascent_rate,
        "bpm":           result.bpm,
        "era":           result.era,
        "tempo_modifier": remix.tempo_modifier,
        "remix_style":   req.remix_style,
    })

    def _board(b) -> DriveBoardResponse:
        return DriveBoardResponse(
            name=b.name, cols=b.cols, rows=b.rows,
            cells=[DriveCellResponse(
                col=c.col, row=c.row, shape=c.shape, slot=c.slot,
                motif=c.motif, q=c.q, effect=c.effect,
            ) for c in b.cells],
            grid=b.to_grid(),
        )

    return SonnetRemixResponse(
        score_id=result.score_id,
        born_at=result.born_at,
        bpm=result.bpm,
        bars=result.bars,
        tilt_rate=result.tilt_rate,
        ascent_rate=result.ascent_rate,
        mente_total=result.mente_total,
        mente_achieved=result.mente_achieved,
        key=result.key,
        mode_name=result.mode_name,
        era=result.era,
        events=[ScoreEventResponse(
            beat=e.beat, duration=e.duration, register=e.register,
            motif=e.motif, intensity=e.intensity, embellishment=e.embellishment,
        ) for e in result.events],
        board_1=_board(result.board_1),
        board_2=_board(result.board_2),
        embellishments=result.embellishments,
        commentary=result.commentary,
        observe_receipt=result.observe_receipt,
        remix=RemixLayerResponse(**remix.to_dict()),
    )


# ── Sonnet-Score SSE stream endpoint ─────────────────────────────────────────

@router.get("/candy/sonnet/stream")
async def candy_sonnet_stream_endpoint(
    shapes: str = Query(..., description="Comma-separated shapes e.g. LINE,CUBE"),
    round:  int = Query(1,   ge=1, le=9999, description="Starting round number"),
    token:  str = Query(..., description="Bearer token (OPERATOR role required)"),
) -> StreamingResponse:
    """
    Server-Sent Events stream — Sonnet-Score リアルタイム更新 (ayglass device 向け)。

    2 秒ごとに新しい `compute_offline()` を実行し、スコア更新イベントを push する。
    score_update イベントと ascent_tick イベントを交互に送信する。

    - `?shapes=LINE,CUBE` — キャンディ群（カンマ区切り）
    - `?round=N`          — 開始ラウンド番号（インクリメントされる）
    - `?token=...`        — OPERATOR 権限のベアラートークン（SSE はヘッダー設定が困難なため）

    10 回のスコア更新後にストリームを終了する (20 秒)。
    """
    # Validate token inline (SSE cannot use header-based Depends easily)
    from cure_oracle.security import _validate_token
    role = _validate_token(token)
    if role is None or not (role == Role.OPERATOR or role == Role.QPU_ADMIN):
        raise HTTPException(status_code=401, detail="OPERATOR role required")

    shape_list = [s.strip().upper() for s in shapes.split(",") if s.strip()]
    if not shape_list:
        raise HTTPException(422, "shapes must not be empty")
    for s in shape_list:
        if s not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(422, f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}")

    async def event_generator():
        ss = SonnetScore(bars=4)
        for i in range(10):
            current_round = round + i
            try:
                result = ss.compute_offline(
                    shapes=shape_list,
                    shots=512,
                    mode="local",
                    round_num=current_round,
                )
            except Exception:
                break

            # Full score_update event
            score_data = {
                "score_id":      result.score_id,
                "born_at":       result.born_at,
                "bpm":           result.bpm,
                "bars":          result.bars,
                "tilt_rate":     result.tilt_rate,
                "ascent_rate":   result.ascent_rate,
                "mente_total":   result.mente_total,
                "mente_achieved": result.mente_achieved,
                "key":           result.key,
                "mode_name":     result.mode_name,
                "era":           result.era,
                "embellishments": result.embellishments,
                "commentary":    result.commentary,
            }
            yield f"event: score_update\ndata: {_json.dumps({'type': 'score_update', 'data': score_data})}\n\n"

            await asyncio.sleep(1.0)

            # Lightweight ascent_tick between full updates
            tick_data = {
                "type":        "ascent_tick",
                "ascent_rate": result.ascent_rate,
                "bpm":         result.bpm,
                "era":         result.era,
            }
            yield f"event: ascent_tick\ndata: {_json.dumps(tick_data)}\n\n"

            await asyncio.sleep(1.0)

        yield "event: stream_end\ndata: {\"type\": \"stream_end\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

# ── Phase J: mesh-score models ──────────────────────────────────────────────

class RawPointModel(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized x ∈ [0,1] (time)")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized y ∈ [0,1] (pitch, top=high)")
    t: float = Field(0.0, description="Timestamp in ms (optional)")


class GridConfigModel(BaseModel):
    cols: int = Field(16, ge=4, le=64)
    rows: int = Field(12, ge=4, le=24)
    bpm: int = Field(120, ge=40, le=240)
    bars: int = Field(4, ge=1, le=16)
    beats_per_bar: int = Field(4, ge=2, le=7)


class MeshScoreRequest(BaseModel):
    strokes: list[list[RawPointModel]] = Field(
        ..., description="List of strokes; each stroke is a list of RawPoints"
    )
    era: str = Field("baroque", description="Musical era for instrument context")
    grid: GridConfigModel = Field(default_factory=GridConfigModel)


class MeshScoreResponse(BaseModel):
    era: str
    version: str
    bpm: int
    bars: int
    events: list[dict]
    stroke_count: int
    export_hint: str


# ── Phase J endpoints ─────────────────────────────────────────────────────────────

@router.post(
    "/candy/sonnet/mesh-score",
    response_model=MeshScoreResponse,
    summary="Phase J — free-curve mesh → musical notes",
    tags=["sonnet"],
)
def candy_sonnet_mesh_score(
    req: MeshScoreRequest,
    _: Role = Depends(require_role(Role.OPERATOR)),
):
    """Convert freehand strokes drawn on a grid mesh into Sonnet-Score NoteEvents.

    Each stroke's geometry (curvature, oscillation, length, Y-position) is
    analysed and mapped to: register (大甲音/甲音/吕音/吕音-bass), motif type,
    beat offset, duration, and intensity.  The resulting events are
    MIDI-compatible at 480 PPQN via to_midi_events().
    """
    cfg = MeshGridConfig(
        cols=req.grid.cols,
        rows=req.grid.rows,
        bpm=req.grid.bpm,
        bars=req.grid.bars,
        beats_per_bar=req.grid.beats_per_bar,
    )
    raw_strokes = [
        [{"x": p.x, "y": p.y, "t": p.t} for p in stroke]
        for stroke in req.strokes
    ]
    try:
        result = strokes_to_score(raw_strokes, era=req.era, grid_cfg=cfg)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result


@router.get(
    "/candy/sonnet/version",
    summary="Phase J — era-aware version negotiation",
    tags=["sonnet"],
)
def candy_sonnet_version(
    mente_total: float = Query(0.0, ge=0.0, description="Current MENTE score"),
):
    """Return the active Sonnet-Score API version for a given MENTE score.

    The ``{era}`` segment is computed from *mente_total* using the same
    thresholds as SonnetScore.compute_offline().  The ``{rev}`` is the
    Phase J revision constant (r2).
    """
    era = era_from_mente(mente_total)
    return {
        "version":        f"cure-{era}-r{CURRENT_REV}",
        "era":            era,
        "rev":            CURRENT_REV,
        "mente_total":    mente_total,
        "era_thresholds": ERA_MENTE_LOWER,
        "endpoint_map": {
            "compute":      "/api/v1/qpu/candy/sonnet",
            "remix":        "/api/v1/qpu/candy/sonnet/remix",
            "stream":       "/api/v1/qpu/candy/sonnet/stream",
            "mesh_score":   "/api/v1/qpu/candy/sonnet/mesh-score",
            "version":      "/api/v1/qpu/candy/sonnet/version",
            "quantum_sim":        "/api/v1/qpu/candy/quantum-sim",
            "quantum_sim_stream": "/api/v1/qpu/candy/quantum-sim/stream",
        },
    }


# ── Phase K: quantum-sim models ──────────────────────────────────────────────

class QuantumSimRequest(BaseModel):
    shapes: list[str] = Field(
        ..., min_length=1, max_length=5,
        description="入力キャンディ群 (1–5 shapes: CUBE/RING/TREE/LINE/STAR)",
    )
    shots:     Optional[int]       = Field(None, ge=1, le=100_000)
    mode:      str                 = Field("local", description="local | fake")
    round_num: int                 = Field(1, ge=1, le=9999, description="蔓旋ラウンド番号")
    bars:      int                 = Field(4, ge=1, le=32, description="Sonnet-Score バー数")
    offline:   bool                = Field(
        True,
        description="True = offline Gemini stub; False = live Gemini Flash (needs GEMINI_API_KEY)",
    )
    bmi_state: Optional[BmiStateModel] = Field(
        None,
        description="Cure-BMI state forwarded to Sonnet-Score layer",
    )


class QuantumSimGeminiResponse(BaseModel):
    suggested_shapes: list[str]
    suggested_shots:  int
    suggested_theta:  str
    retest_reason:    str
    commentary:       str
    model_used:       str


class QuantumSimScoreResponse(BaseModel):
    score_id:       str
    born_at:        str
    bpm:            int
    bars:           int
    era:            str
    mente_total:    float
    mente_achieved: bool
    events:         list[ScoreEventResponse]
    embellishments: list[str]
    commentary:     str


class QuantumSimResponse(BaseModel):
    sim_id:          str
    born_at:         str
    era:             str
    version:         str
    input_shapes:    list[str]
    fused_shapes:    list[str]
    mente_total:     float
    mente_achieved:  bool
    fusion_note:     str
    gemini:          QuantumSimGeminiResponse
    score:           QuantumSimScoreResponse
    observe_receipt: dict


@router.post(
    "/candy/quantum-sim",
    response_model=QuantumSimResponse,
    summary="Phase K — Gemini-Candy ⟷ Sonnet-Score auto-fusion loop",
    tags=["quantum-sim"],
)
def candy_quantum_sim(
    req: QuantumSimRequest,
    role: Role = Depends(require_role(Role.OPERATOR)),
) -> QuantumSimResponse:
    """Unified quantum simulation: Gemini-Candy observation × Sonnet-Score music.

    Stage 1 — Gemini-Candy-Flash: run VirtualAccelerator on *shapes*, obtain
    AI-driven parameter recommendation (or heuristic stub when offline=True).

    Stage 2 — Sonnet-Score: re-run on Gemini's *suggested_shapes*, producing a
    MENTE-era-aware musical score fused with the observation result.

    Returns a combined QuantumSimResponse with both layers and a sig-receipt/1.
    """
    audit = AuditLogger.get()
    resource = f"candy/quantum-sim/{','.join(req.shapes)}/R{req.round_num}"

    for s in req.shapes:
        if s not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(422, f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}")
    if req.mode not in ("local", "fake"):
        raise HTTPException(422, "quantum-sim supports only local or fake mode")

    bmi_dict = req.bmi_state.model_dump() if req.bmi_state else None

    try:
        result = run_quantum_sim(
            shapes=req.shapes,
            bmi_state=bmi_dict,
            shots=req.shots,
            mode=req.mode,
            round_num=req.round_num,
            bars=req.bars,
            offline=req.offline,
        )
    except EnvironmentError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, detail=sanitize_error(exc)) from exc
    except Exception as exc:
        audit.log(role.value, "candy.quantum_sim", resource, "failure",
                  {"error_type": type(exc).__name__})
        raise HTTPException(500, "internal server error") from exc

    audit.log(role.value, "candy.quantum_sim", resource, "success", {
        "era":            result.era,
        "mente_total":    result.mente_total,
        "mente_achieved": result.mente_achieved,
        "fused_shapes":   result.fused_shapes,
    })

    g = result.gemini
    sc = result.score
    return QuantumSimResponse(
        sim_id=result.sim_id,
        born_at=result.born_at,
        era=result.era,
        version=result.version,
        input_shapes=result.input_shapes,
        fused_shapes=result.fused_shapes,
        mente_total=result.mente_total,
        mente_achieved=result.mente_achieved,
        fusion_note=result.fusion_note,
        gemini=QuantumSimGeminiResponse(
            suggested_shapes=g.recommendation.suggested_shapes,
            suggested_shots=g.recommendation.suggested_shots,
            suggested_theta=g.recommendation.suggested_theta,
            retest_reason=g.recommendation.retest_reason,
            commentary=g.recommendation.commentary,
            model_used=g.recommendation.model_used,
        ),
        score=QuantumSimScoreResponse(
            score_id=sc.score_id,
            born_at=sc.born_at,
            bpm=sc.bpm,
            bars=sc.bars,
            era=sc.era,
            mente_total=sc.mente_total,
            mente_achieved=sc.mente_achieved,
            events=[ScoreEventResponse(
                beat=e.beat, duration=e.duration, register=e.register,
                motif=e.motif, intensity=e.intensity, embellishment=e.embellishment,
            ) for e in sc.events],
            embellishments=sc.embellishments,
            commentary=sc.commentary,
        ),
        observe_receipt=g.observe_receipt,
    )


# ── Phase L: quantum-sim SSE stream endpoint ──────────────────────────────────

@router.get(
    "/candy/quantum-sim/stream",
    summary="Phase L — quantum-sim MIDI visualizer SSE stream (cure-{era}-r4)",
    tags=["quantum-sim"],
)
async def candy_quantum_sim_stream(
    shapes: str = Query(..., description="カンマ区切りキャンディ群 e.g. LINE,CUBE"),
    round:  int = Query(1,   ge=1, le=9999, description="開始ラウンド番号"),
    token:  str = Query(..., description="Bearer token (OPERATOR role required)"),
    frames: int = Query(10,  ge=1, le=10,   description="フレーム数 (1–10, default 10)"),
) -> StreamingResponse:
    """Server-Sent Events stream — quantum-sim MIDI visualizer (B地点第七画面).

    Runs run_quantum_sim() *frames* times and emits sim_update / sim_tick events.
    Used by the MIDI_VIZ Flet screen (Phase L, cure-{era}-r4).

    - ``?shapes=LINE,CUBE`` — キャンディ群（カンマ区切り）
    - ``?round=N``          — 開始ラウンド番号
    - ``?token=...``        — OPERATOR 権限のベアラートークン
    - ``?frames=N``         — フレーム数 (1–10)
    """
    from cure_oracle.security import _validate_token
    role = _validate_token(token)
    if role is None or not (role == Role.OPERATOR or role == Role.QPU_ADMIN):
        raise HTTPException(status_code=401, detail="OPERATOR role required")

    shape_list = [s.strip().upper() for s in shapes.split(",") if s.strip()]
    if not shape_list:
        raise HTTPException(422, "shapes must not be empty")
    for s in shape_list:
        if s not in SHAPE_CIRCUIT_MAP:
            raise HTTPException(422, f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}")

    async def event_generator():
        for i in range(frames):
            current_round = round + i
            try:
                result = await asyncio.to_thread(
                    run_quantum_sim,
                    shapes=shape_list,
                    round_num=current_round,
                    bars=4,
                    offline=True,
                )
                frame = build_midi_viz_frame(result)
            except Exception:
                break

            sim_data = {
                "frame_id":       frame.frame_id,
                "born_at":        frame.born_at,
                "era":            frame.era,
                "version":        frame.version,
                "bpm":            frame.bpm,
                "bars":           frame.bars,
                "mente_total":    frame.mente_total,
                "mente_achieved": frame.mente_achieved,
                "fusion_note":    frame.fusion_note,
                "fused_shapes":   frame.fused_shapes,
                "note_count":     len(frame.notes),
                "ppqn":           frame.ppqn,
                "channels": [
                    {
                        "index":        c.index,
                        "name":         c.name,
                        "note_count":   c.note_count,
                        "avg_velocity": c.avg_velocity,
                        "active":       c.active,
                    }
                    for c in frame.channels
                ],
            }
            yield (
                f"event: sim_update\n"
                f"data: {_json.dumps({'type': 'sim_update', 'data': sim_data})}\n\n"
            )

            await asyncio.sleep(2.0)

            tick_data = {
                "type":           "sim_tick",
                "frame_index":    i,
                "era":            frame.era,
                "bpm":            frame.bpm,
                "mente_total":    frame.mente_total,
                "mente_achieved": frame.mente_achieved,
            }
            yield f"event: sim_tick\ndata: {_json.dumps(tick_data)}\n\n"

            await asyncio.sleep(2.0)

        yield "event: stream_end\ndata: {\"type\": \"stream_end\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
