"""Initial customer analysis (A/B/C/D) for the Cure-API initial page — contract ``cure-initial/1``.

The cybernetics table, as data:

====================  ==============================  ==============================  =================  =============================
component (left)      [1] input signal                [2] Cure-API processing         [3] grade          [4] chaos / skeleton sync
====================  ==============================  ==============================  =================  =============================
header  (A)           gaze / first-click speed        buffer the first distortion     高 macro-follow    lock the long-range frame
bottom  (B)           micro torque on the handle      sense the vertical-spin lag     中 scalping        tune short pulse amplitude
side menu (C)         depth the parameter panels      load-test parallel charts       低 guidance        damp the interface
                      were opened to
popup   (D)           time with eyes closed (VR)      measure the API-B skin          極 intuitive /     heartbeat pulse synced to
                                                      threshold                       fully in sync      the oracle
====================  ==============================  ==============================  =================  =============================

Each component's signal is normalised to a score in [0, 1]; the strongest component is the grade
and the margin over the runner-up is the confidence. The selected right-hand cell — API-B, the
haptic output when the eyes are closed — is split [2 : 4 : 6 : 7] (19 parts) over a budget.

The endpoint is stateless and wallet-free: no account, wallet or address is accepted or returned,
consent is required, and raw signals are never stored. Same maths as ``lib/cureInitial.ts``; both are
checked against ``tests/fixtures/cure_initial_cases.json``.
"""

from __future__ import annotations

import math
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

SCHEMA_VERSION = "cure-initial/1"
Grade = Literal["A", "B", "C", "D"]
Component = Literal["header", "bottom", "side", "popup"]

COMPONENT_OF: dict[str, Component] = {"A": "header", "B": "bottom", "C": "side", "D": "popup"}
GRADE_INFO: dict[str, dict[str, str]] = {
    "A": {"level": "高", "style": "マクロ追従型", "processing": "歪みパルスの初期バッファリング", "sync": "長期予測のフレーム固定"},
    "B": {"level": "中", "style": "スキャルピング型", "processing": "グラフ縦回転の初期同期ズレ感知", "sync": "短期パルス群の振幅調整"},
    "C": {"level": "低", "style": "ガイダンス型", "processing": "Cure-API 並列チャートの負荷テスト", "sync": "インターフェースの減衰制御"},
    "D": {"level": "極", "style": "直感・完全同調型", "processing": "皮膚感覚（API-B）閾値の自動計測", "sync": "心臓拍動（オラクル同期）パルス"},
}
SPLIT: list[tuple[str, int, str]] = [
    ("relax", 2, "基礎緊張緩和（境界解体）"),
    ("drift", 4, "縦回転グラフのズレ知覚"),
    ("counter", 6, "ハンドル微動へのカウンター・フィードバック"),
    ("oracle", 7, "API-A 最優先調整ループ"),
]
SPLIT_TOTAL = sum(layer for _, layer, _ in SPLIT)  # 19


class InitialSignals(BaseModel):
    """What the initial page measured in its first seconds (all optional except consent)."""

    schema_version: Literal["cure-initial/1"] = SCHEMA_VERSION
    consent: bool = Field(description="The customer agreed to this one-off analysis.")
    first_click_ms: float | None = Field(None, ge=0, description="A · time from page open to the first click")
    click_rate: float | None = Field(None, ge=0, description="A · clicks per second in the first window")
    handle_torque: float | None = Field(None, ge=0, le=1, description="B · size of tiny pointer/handle movements, 0–1")
    panel_depth: int | None = Field(None, ge=0, le=10, description="C · how many parameter panels deep the customer went")
    eyes_closed_ms: float | None = Field(None, ge=0, description="D · time spent with the eyes closed (hold / blackout)")
    haptic_budget_ms: float = Field(16.0, gt=0, le=1000, description="API-B budget to split 2:4:6:7")


class SyncDirective(BaseModel):
    component: Component
    grade: Grade
    action: str
    value: float


class SplitPart(BaseModel):
    key: str
    layer: int
    title: str
    share: float
    budget_ms: float


class InitialAnalysis(BaseModel):
    schema_version: Literal["cure-initial/1"] = SCHEMA_VERSION
    grade: Grade
    level: str
    style: str
    processing: str
    confidence: float
    scores: dict[Grade, float]
    sync: list[SyncDirective]
    split: list[SplitPart]
    wallet_free: bool = True
    stored: bool = False


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _round(x: float, digits: int = 0) -> float:
    """Half-up rounding, identical to the TypeScript side (Python's built-in rounds halves to even)."""
    k = 10 ** digits
    return math.floor(x * k + 0.5) / k


def scores_of(s: InitialSignals) -> dict[str, float]:
    """Normalise each component's signal to [0, 1]. Missing signals score 0."""
    a = 0.0
    if s.first_click_ms is not None:  # fast first click (≤ 0.4 s → 1, ≥ 6 s → 0), helped by click rate
        a = _clamp((6000 - s.first_click_ms) / 5600) * 0.7 + _clamp((s.click_rate or 0) / 3) * 0.3
    b = _clamp(s.handle_torque or 0.0)
    c = _clamp((s.panel_depth or 0) / 4)
    d = _clamp(math.log1p((s.eyes_closed_ms or 0) / 1000) / math.log1p(8))  # 8 s with eyes closed → 1
    return {"A": _round(a, 6), "B": _round(b, 6), "C": _round(c, 6), "D": _round(d, 6)}


def analyse(s: InitialSignals) -> InitialAnalysis:
    if not s.consent:
        raise ValueError("consent is required")
    sc = scores_of(s)
    order = sorted(sc, key=lambda g: (-sc[g], "ABCD".index(g)))  # ties go to the earlier letter
    grade = order[0] if sc[order[0]] > 0 else "C"  # nothing measured → guidance
    confidence = _round(sc[order[0]] - sc[order[1]], 6)
    sync = [
        SyncDirective(component="header", grade="A", action="長期予測のフレーム固定（本数）", value=_round(20 + 180 * sc["A"])),
        SyncDirective(component="bottom", grade="B", action="短期パルス群の振幅", value=_round(0.2 + 0.8 * sc["B"], 4)),
        SyncDirective(component="side", grade="C", action="インターフェースの減衰（0 = 減衰なし）", value=_round(1 - sc["C"], 4)),
        SyncDirective(component="popup", grade="D", action="心臓拍動パルス（bpm）", value=_round(60 + 40 * sc["D"])),
    ]
    split = [SplitPart(key=k, layer=layer, title=t, share=_round(layer / SPLIT_TOTAL, 6), budget_ms=_round(s.haptic_budget_ms * layer / SPLIT_TOTAL, 4)) for k, layer, t in SPLIT]
    info = GRADE_INFO[grade]
    return InitialAnalysis(grade=grade, level=info["level"], style=info["style"], processing=info["processing"], confidence=confidence,
                           scores=sc, sync=sync, split=split)


router = APIRouter()


@router.post("/api/v1/cure/initial-analysis", response_model=InitialAnalysis)
def initial_analysis(signals: InitialSignals) -> InitialAnalysis:
    """Stateless: analyse once and forget. 422 without consent."""
    if not signals.consent:
        raise HTTPException(status_code=422, detail="consent is required")
    return analyse(signals)


# ══ meshmeta q → SIG dual-encryption conversion ════════════════════════════════
# q = mesh_meta.triangle_quality() = 2r/R (normalised radius ratio, 0 degenerate → 1 equilateral)
#
# Shape bands (6 equal bands of width 1/6):
#   q ∈ [5/6, 1]   → CUBE  (7 pts, highest quality)
#   q ∈ [4/6, 5/6) → OCT   (6 pts)
#   q ∈ [3/6, 4/6) → PYR   (5 pts)
#   q ∈ [2/6, 3/6) → TET   (4 pts)
#   q ∈ [1/6, 2/6) → TRI   (3 pts)
#   q ∈ [0,   1/6) → LINE  (2 pts, near-degenerate)
#
# Backend bands (high q = low noise = best backend):
#   q ∈ [0.75, 1]   → ibm_marrakesh  ε=0.019  S4 広目天⟐  π.785
#   q ∈ [0.50, 0.75)→ ibm_sherbrooke ε=0.023  S1 多聞天♔  φ.618
#   q ∈ [0.25, 0.50)→ ibm_kyoto      ε=0.028  S3 持国天♘  π.785
#   q ∈ [0,    0.25)→ ibm_brisbane   ε=0.031  S2 増長天♕  √.414
#
# MENTE constant: φ × √2 = 1.618 × 1.41421… ≈ 2.2882  (BOX geometry convergence)

_SHAPE_BANDS: tuple[tuple[float, str, int], ...] = (
    (5 / 6, "CUBE", 7),
    (4 / 6, "OCT",  6),
    (3 / 6, "PYR",  5),
    (2 / 6, "TET",  4),
    (1 / 6, "TRI",  3),
    (0.0,   "LINE", 2),
)

_BACKEND_BANDS: tuple[tuple[float, str], ...] = (
    (0.75, "ibm_marrakesh"),
    (0.50, "ibm_sherbrooke"),
    (0.25, "ibm_kyoto"),
    (0.0,  "ibm_brisbane"),
)

_BACKEND_META: dict[str, dict] = {
    "ibm_sherbrooke": {"eps": 0.023, "theta_disp": "φ.618", "theta_val": 1.618, "slot": "S1", "lap": "LAP8",  "qubits": 27},
    "ibm_brisbane":   {"eps": 0.031, "theta_disp": "√.414", "theta_val": 1.414, "slot": "S2", "lap": "LAP9",  "qubits": 127},
    "ibm_kyoto":      {"eps": 0.028, "theta_disp": "π.785", "theta_val": 0.785, "slot": "S3", "lap": "LAP10", "qubits": 27},
    "ibm_marrakesh":  {"eps": 0.019, "theta_disp": "π.785", "theta_val": 0.785, "slot": "S4", "lap": "LAP11", "qubits": 156},
}

_MENTE_CONST: float = 1.618 * math.sqrt(2)  # φ × √2 ≈ 2.2882


def _q_to_sig_parts(q: float, label: str | None = None) -> dict:
    """Core conversion: q ∈ [0,1] → shape / backend / epsilon / theta / SIG string / mente."""
    q = max(0.0, min(1.0, float(q)))
    shape, pts = "LINE", 2
    for threshold, s, p in _SHAPE_BANDS:
        if q >= threshold:
            shape, pts = s, p
            break
    backend = "ibm_brisbane"
    for threshold, b in _BACKEND_BANDS:
        if q >= threshold:
            backend = b
            break
    meta = _BACKEND_META[backend]
    eps_disp = f"ε.{int(meta['eps'] * 1000):03d}"
    sig = f"{shape}-{meta['theta_disp']}-{eps_disp}"
    mente = round(q * pts * _MENTE_CONST, 6)
    return {
        "q": round(q, 9),
        "label": label,
        "shape": shape,
        "shape_pts": pts,
        "backend": backend,
        "epsilon": meta["eps"],
        "theta": meta["theta_val"],
        "theta_disp": meta["theta_disp"],
        "sig": sig,
        "slot": meta["slot"],
        "lap": meta["lap"],
        "qubits": meta["qubits"],
        "mente": mente,
    }


class QToSigRequest(BaseModel):
    """Single meshmeta triangle quality value."""

    q: float = Field(..., ge=0.0, le=1.0, description="Triangle quality q=2r/R from mesh_meta.triangle_quality()")
    label: str | None = Field(None, description="Rank label from meshmeta Top_Triangles (A/B/C/D)")


class SIGCode(BaseModel):
    q: float
    label: str | None
    shape: str = Field(description="SIG shape code: LINE TRI TET PYR OCT CUBE")
    shape_pts: int = Field(description="Canonical point count for the shape (2–7)")
    backend: str = Field(description="IBM Quantum backend id")
    epsilon: float = Field(description="Backend gate error rate ε")
    theta: float = Field(description="SIG angular parameter θ (1.618 / 1.414 / 0.785)")
    theta_disp: str = Field(description="θ display code: φ.618 / √.414 / π.785")
    sig: str = Field(description="SIG dual-encryption code e.g. CUBE-φ.618-ε.019")
    slot: str = Field(description="四天王 slot: S1 多聞天 / S2 増長天 / S3 持国天 / S4 広目天")
    lap: str = Field(description="IBM Quantum campaign lap identifier")
    qubits: int = Field(description="Backend qubit count")
    mente: float = Field(description="MENTE value: q × shape_pts × (φ×√2)")


class MeshTriangle(BaseModel):
    label: str = Field(description="Rank label A/B/C/D from meshmeta Top_Triangles")
    q: float = Field(..., ge=0.0, le=1.0, description="Triangle quality score")


class MeshBatchRequest(BaseModel):
    """Up to four ranked triangles from a meshmeta Top_Triangles output."""

    triangles: list[MeshTriangle] = Field(..., min_length=1, max_length=4)


class MeshBatchResponse(BaseModel):
    sigs: list[SIGCode]
    mente_total: float = Field(description="Sum of all mente values across the batch")
    mente_achieved: bool = Field(description="True when mente_total ≥ φ×√2 ≈ 2.2882 (四天王全顕現)")
    mente_const: float = Field(description="Reference constant φ×√2")


@router.post("/api/v1/cure/q-to-sig", response_model=SIGCode)
def q_to_sig(req: QToSigRequest) -> SIGCode:
    """Map a single meshmeta triangle quality score q to its SIG dual-encryption code.

    q is the normalised radius ratio 2r/R returned by ``mesh_meta.triangle_quality()``.
    Returns the SIG shape code, the IBM Quantum backend, the ε noise rate, the θ parameter,
    and a MENTE value. Stateless — no data is stored.
    """
    return SIGCode(**_q_to_sig_parts(req.q, req.label))


@router.post("/api/v1/cure/meshmeta-to-sig", response_model=MeshBatchResponse)
def meshmeta_to_sig(req: MeshBatchRequest) -> MeshBatchResponse:
    """Map a meshmeta Top_Triangles list (1–4 entries, labels A–D) to SIG codes.

    Pass the ranked triangles from a ``.meshmeta`` JSON's ``Top_Triangles`` array.
    Returns one SIGCode per triangle plus an aggregate MENTE score; when
    ``mente_achieved`` is True the BOX geometry has converged (四天王全顕現).
    """
    sigs = [SIGCode(**_q_to_sig_parts(t.q, t.label)) for t in req.triangles]
    total = round(sum(s.mente for s in sigs), 6)
    return MeshBatchResponse(
        sigs=sigs,
        mente_total=total,
        mente_achieved=total >= _MENTE_CONST,
        mente_const=round(_MENTE_CONST, 6),
    )
