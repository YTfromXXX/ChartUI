"""cure_oracle/punchcard.py — Phase P: 串刺し螺旋サイコロ × Punchcard Engine
(B地点第十一画面).

CURRENT_REV = 8

Implements the PopKivyDevice-OS spatial coordinate system for two skewered
octahedra (D₁, D₂) rotating on the horizontal axis u = (1, 0, 0), plus the
dynamic and static punch-card pattern generators derived from their vertex
trajectories.

Mathematical model
------------------
  Rotation angles (time parameter t ∈ [0,1]):
    Θ₁(t) = 2π × θ_q × t + θ_disp
    Θ₂(t) = Θ₁(t) × (φ × √2) + ε_disp × 10³

  Helix translation (k ∈ {1, 2}):
    P_k(t) = (x₀ + (-1)^k × (L₀/2) × cos(π θ_q t),
              R_helix × sin(Θ_k(t)),
              R_helix × cos(Θ_k(t)))
    R_helix = clamp(mente × 0.1, 0.1, 2.0)

  Vertex transform (rotation around x-axis):
    v'_k,i(t) = rotate_x(v_i, Θ_k(t)) + P_k(t)

Dynamic punch-card grids (8 tracks × 16 steps):
  Pattern A — Z-plane crossing gate: punch when |v'_1,i.y| > φ⁻¹
  Pattern B — Phase-lock threshold: punch when |Θ₂ - Θ₁| mod π < ε_track

Static punch-card (8 tracks × 16 steps = first 16 bytes of 50-byte claim record):
  Pattern A — OS topology fixed mask: claim_record byte bitmap
  Pattern B — Selective disclosure mask: Merkle proof path open/shielded slots

cure-{era}-r8  (Phase P)
"""

from __future__ import annotations

import datetime
import hashlib
import math
import struct as _struct
import uuid
from dataclasses import dataclass, field

CURRENT_REV: int = 8

PHI        = (1 + 5 ** 0.5) / 2       # golden ratio ≈ 1.6180
PHI_INV    = 1 / PHI                   # ≈ 0.6180
MENTE_CONST = PHI * math.sqrt(2)       # ≈ 2.2882

_L0 = 2.0   # initial axis distance (earphone baseline / VRWorks reference)
_X0 = 0.0   # axle origin

OCTAHEDRON_VERTS: list[tuple[float, float, float]] = [
    ( 1, 0, 0), (-1, 0, 0),
    ( 0, 1, 0), ( 0,-1, 0),
    ( 0, 0, 1), ( 0, 0,-1),
]

CLAIM_TRACKS = [
    "cert_id", "born_at", "backend",    "sig_code",
    "epsilon",  "mente",   "shot_count", "circuit_hash",
]

# Disclosure mask: True = public (open hole), False = shielded (Keccak-256 only)
_DISCLOSURE: dict[str, bool] = {
    "cert_id":      False,
    "born_at":      False,
    "backend":      True,
    "sig_code":     True,
    "epsilon":      True,
    "mente":        True,
    "shot_count":   False,
    "circuit_hash": False,
}

_THETA_DISP_TABLE: dict[str, float] = {
    "φ.618": PHI_INV,
    "π.785": math.pi / 4,
    "√.414": math.sqrt(2) - 1,
}

_CLAIM_TYPE_ID = 0x0003   # uint16 big-endian header for punchcard claim records


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class DiceState:
    k:        int              # 1 or 2
    t:        float            # time parameter ∈ [0, 1]
    theta:    float            # Θ_k(t) in radians
    center:   list[float]      # [x, y, z] helix centre P_k(t)
    vertices: list[list[float]]  # 6 × [x, y, z] after rotation + translation


@dataclass
class PunchcardGrid:
    tracks:       int              # 8
    steps:        int              # 16
    bits:         list[list[int]]  # bits[track][step] ∈ {0, 1}
    track_labels: list[str]
    pattern:      str              # "A" or "B"


@dataclass
class StaticPunchcard:
    pattern:          str
    claim_record:     str              # e.g. "LINE-π.785-ε.019"
    claim_record_hex: str              # 50-byte zero-padded hex
    bits:             list[list[int]]  # bits[track][step] 8 × 16 (first 16 bytes)
    track_labels:     list[str]
    disclosure_mask:  dict[str, bool]  # {track_label: is_public}
    merkle_root:      str              # SHA-256 hex of claim bytes


@dataclass
class PunchcardFrame:
    frame_id:             str
    born_at:              str
    era:                  str
    version:              str             # cure-{era}-r8
    shape:                str
    theta_q:              float
    theta_disp:           float
    theta_disp_mode:      str             # "φ.618" | "π.785" | "√.414"
    epsilon_perturbation: float
    mente_total:          float
    helix_radius:         float
    t_steps:              int
    dice_1_states:        list[DiceState]
    dice_2_states:        list[DiceState]
    dynamic_a:            PunchcardGrid
    dynamic_b:            PunchcardGrid
    static_a:             StaticPunchcard
    static_b:             StaticPunchcard


# ── geometry helpers ──────────────────────────────────────────────────────────

def _rotate_x(
    vx: float, vy: float, vz: float, theta: float,
) -> tuple[float, float, float]:
    """Rotate vector (vx, vy, vz) around x-axis by angle theta (radians)."""
    c, s = math.cos(theta), math.sin(theta)
    return (vx, vy * c - vz * s, vy * s + vz * c)


def _helix_center(
    k: int, t: float, theta_q: float, theta_k: float, R_helix: float,
) -> list[float]:
    """Compute helix centre P_k(t) = (xk, R sin Θk, R cos Θk)."""
    xk = _X0 + ((-1) ** k) * (_L0 / 2) * math.cos(math.pi * theta_q * t)
    return [xk, R_helix * math.sin(theta_k), R_helix * math.cos(theta_k)]


def _dice_state(
    k: int, t: float, theta_q: float, theta_disp: float,
    epsilon: float, R_helix: float,
) -> DiceState:
    """Compute DiceState for dice k at time t."""
    theta_1 = 2 * math.pi * theta_q * t + theta_disp
    if k == 1:
        theta_k = theta_1
    else:
        theta_k = theta_1 * (PHI * math.sqrt(2)) + epsilon * 1_000

    center = _helix_center(k, t, theta_q, theta_k, R_helix)

    vertices: list[list[float]] = []
    for vx0, vy0, vz0 in OCTAHEDRON_VERTS:
        rx, ry, rz = _rotate_x(vx0, vy0, vz0, theta_k)
        vertices.append([
            round(rx + center[0], 6),
            round(ry + center[1], 6),
            round(rz + center[2], 6),
        ])

    return DiceState(k=k, t=round(t, 4), theta=round(theta_k, 6),
                     center=[round(c, 6) for c in center], vertices=vertices)


# ── punch card builders ───────────────────────────────────────────────────────

def _build_dynamic_a(
    theta_q: float, theta_disp: float, epsilon: float,
    R_helix: float, t_steps: int,
) -> PunchcardGrid:
    """Dynamic Pattern A: punch when |v'_1,i.y| > φ⁻¹ at each step."""
    bits: list[list[int]] = [[0] * t_steps for _ in range(8)]

    for j in range(t_steps):
        t = j / max(t_steps - 1, 1)
        ds = _dice_state(1, t, theta_q, theta_disp, epsilon, R_helix)
        ys = [v[1] for v in ds.vertices]   # y-world coords of D1 vertices

        # Track 0–5: one vertex each; Track 6: any crossing; Track 7: multi
        for tr in range(6):
            bits[tr][j] = 1 if abs(ys[tr]) > PHI_INV else 0
        bits[6][j] = 1 if any(abs(y) > PHI_INV for y in ys) else 0
        bits[7][j] = 1 if sum(1 for y in ys if abs(y) > PHI_INV) >= 2 else 0

    return PunchcardGrid(tracks=8, steps=t_steps, bits=bits,
                         track_labels=CLAIM_TRACKS, pattern="A")


def _build_dynamic_b(
    theta_q: float, theta_disp: float, epsilon: float,
    R_helix: float, t_steps: int,
) -> PunchcardGrid:
    """Dynamic Pattern B: punch when |Θ₂(t) − Θ₁(t)| mod π < track threshold."""
    bits: list[list[int]] = [[0] * t_steps for _ in range(8)]
    phi_sqrt2 = PHI * math.sqrt(2)

    for j in range(t_steps):
        t = j / max(t_steps - 1, 1)
        theta_1 = 2 * math.pi * theta_q * t + theta_disp
        theta_2 = theta_1 * phi_sqrt2 + epsilon * 1_000
        phase_diff = abs(theta_2 - theta_1) % math.pi

        for tr in range(8):
            # Each track has a slightly different threshold (epsilon-based)
            threshold = epsilon + tr * 0.001 + 0.005
            bits[tr][j] = 1 if phase_diff < threshold else 0

    return PunchcardGrid(tracks=8, steps=t_steps, bits=bits,
                         track_labels=CLAIM_TRACKS, pattern="B")


def _build_static_a(shape: str, theta_disp_mode: str, epsilon: float) -> StaticPunchcard:
    """Static Pattern A: 50-byte claim record → 8×16 bit display (first 16 bytes)."""
    # Compose claim record string: "SHAPE-θdisp_mode-ε.NNN"
    eps_str = f"ε.{int(epsilon * 1000):03d}"
    claim_record = f"{shape}-{theta_disp_mode}-{eps_str}"

    # Encode and pad to 50 bytes: 2-byte uint16 header + 48-byte UTF-8 null-padded
    header = _struct.pack(">H", _CLAIM_TYPE_ID)
    body   = claim_record.encode("utf-8")[:48].ljust(48, b"\x00")
    claim_bytes = (header + body)[:50]
    claim_record_hex = "0x" + claim_bytes.hex()

    # Merkle root: SHA-256 of claim bytes
    merkle_root = "0x" + hashlib.sha256(claim_bytes).hexdigest()

    # Visualise first 16 bytes as 8 tracks × 16 steps (bit 7 → track 0)
    display_bytes = claim_bytes[:16]
    bits: list[list[int]] = [[0] * 16 for _ in range(8)]
    for step, byte in enumerate(display_bytes):
        for track in range(8):
            bits[track][step] = (byte >> (7 - track)) & 1

    return StaticPunchcard(
        pattern="A",
        claim_record=claim_record,
        claim_record_hex=claim_record_hex,
        bits=bits,
        track_labels=CLAIM_TRACKS,
        disclosure_mask={k: True for k in CLAIM_TRACKS},  # Pattern A: all public
        merkle_root=merkle_root,
    )


def _build_static_b(claim_record_hex: str, merkle_root: str) -> StaticPunchcard:
    """Static Pattern B: selective disclosure mask (open = public, closed = shielded)."""
    # For display: open slots are punched (1), shielded slots are blank (0)
    bits: list[list[int]] = [[0] * 16 for _ in range(8)]
    for tr, label in enumerate(CLAIM_TRACKS):
        is_public = _DISCLOSURE.get(label, False)
        for step in range(16):
            # Public slots: alternate pattern; shielded: always 0
            bits[tr][step] = (1 if step % 2 == 0 else 0) if is_public else 0

    return StaticPunchcard(
        pattern="B",
        claim_record="selective_disclosure_mask",
        claim_record_hex=claim_record_hex,
        bits=bits,
        track_labels=CLAIM_TRACKS,
        disclosure_mask=dict(_DISCLOSURE),
        merkle_root=merkle_root,
    )


# ── theta_disp_mode selector ──────────────────────────────────────────────────

def select_theta_disp_mode(theta_q: float) -> str:
    """Select θ_disp mode based on quality score θ_q."""
    if theta_q >= 0.75:
        return "φ.618"
    if theta_q >= 0.50:
        return "π.785"
    return "√.414"


# ── main builder ──────────────────────────────────────────────────────────────

def build_punchcard_frame(
    sim_result,
    epsilon: float = 0.019,
    t_steps: int = 16,
) -> PunchcardFrame:
    """Build a PunchcardFrame from a QuantumSimResult.

    Parameters
    ----------
    sim_result:
        Output of run_quantum_sim() (has .era, .mente_total, .fused_shapes, etc.).
    epsilon:
        Noise perturbation ε_disp (default 0.019).
    t_steps:
        Number of time steps for dynamic grids (default 16).

    Returns
    -------
    PunchcardFrame with all dice states, dynamic grids A/B, and static cards A/B.
    """
    era         = getattr(sim_result, "era", "baroque")
    mente_total = float(getattr(sim_result, "mente_total", 1.0) or 1.0)

    # quality score from MENTE
    theta_q = min(1.0, max(0.0, mente_total / MENTE_CONST))

    # determine θ_disp mode and value
    theta_disp_mode = select_theta_disp_mode(theta_q)
    theta_disp      = _THETA_DISP_TABLE[theta_disp_mode]

    # helix radius from MENTE
    R_helix = max(0.1, min(2.0, mente_total * 0.1))

    # shape from first fused shape
    fused = getattr(sim_result, "fused_shapes", None) or []
    shape = fused[0] if fused else "LINE"

    # compute dice states for all time steps
    dice_1_states: list[DiceState] = []
    dice_2_states: list[DiceState] = []
    for j in range(t_steps):
        t = j / max(t_steps - 1, 1)
        dice_1_states.append(_dice_state(1, t, theta_q, theta_disp, epsilon, R_helix))
        dice_2_states.append(_dice_state(2, t, theta_q, theta_disp, epsilon, R_helix))

    # dynamic punch card grids
    dynamic_a = _build_dynamic_a(theta_q, theta_disp, epsilon, R_helix, t_steps)
    dynamic_b = _build_dynamic_b(theta_q, theta_disp, epsilon, R_helix, t_steps)

    # static punch card patterns
    static_a = _build_static_a(shape, theta_disp_mode, epsilon)
    static_b = _build_static_b(static_a.claim_record_hex, static_a.merkle_root)

    return PunchcardFrame(
        frame_id             = str(uuid.uuid4()),
        born_at              = datetime.datetime.now(datetime.timezone.utc).isoformat(),
        era                  = era,
        version              = f"cure-{era}-r{CURRENT_REV}",
        shape                = shape,
        theta_q              = round(theta_q, 6),
        theta_disp           = round(theta_disp, 6),
        theta_disp_mode      = theta_disp_mode,
        epsilon_perturbation = epsilon,
        mente_total          = round(mente_total, 6),
        helix_radius         = round(R_helix, 6),
        t_steps              = t_steps,
        dice_1_states        = dice_1_states,
        dice_2_states        = dice_2_states,
        dynamic_a            = dynamic_a,
        dynamic_b            = dynamic_b,
        static_a             = static_a,
        static_b             = static_b,
    )
