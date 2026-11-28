"""384 SPIRAL CANDY logarithmic grid for the METADOGG ORACLE API.

Space: spherical coordinates (r, theta, phi) with the origin (0, 0, 0) as the
current price (singularity). 48 base cells x 4 timeline waveforms x 2 polarities
= 384 control points. The radius follows the logarithmic spiral r = a * exp(b * omega),
where omega in [0, 1] runs from micro (core) to macro (outer rim). `scale_dial`
shifts ln(a) linearly, so the whole grid zooms linearly along the log-radius axis.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, Field

from tarot_engine import MAJOR_ARCANA_SYMBOLS

CELL_COUNT = 48
POLARITIES = (1, -1)  # +1 = ascending vector, -1 = inverted (descending) vector
WAVEFORMS = ("SURGE", "CONTINUATION", "RANGE", "CRASH")
GOLDEN_ANGLE = math.pi * (3.0 - math.sqrt(5.0))

# Spiral parameters: r = a * exp(b * omega)
A_MICRO = 1.0  # radius of the core at dial = 0
ZOOM_LOG_SPAN = math.log(1000.0)  # dial 0 -> 1 shifts the grid by 3 decades
B_BASE = math.log(100.0)  # radial growth of the spiral across the timeline
SPIRAL_TURNS = 1.5  # azimuthal winding over the full timeline
WAVE_AMPLITUDE = 0.35  # angular amplitude of the waveform
RADIAL_RIPPLE = 0.12

# (phase shift, kind) per waveform: sine/cosine phase shifts
_WAVE_PHASES = {
    "SURGE": (0.0, "sin", 1.0),
    "CONTINUATION": (math.pi / 2.0, "cos", 1.0),
    "RANGE": (math.pi, "sin", 2.0),
    "CRASH": (3.0 * math.pi / 2.0, "cos", 1.0),
}
# Directional drift of theta: surge pulls toward +z pole, crash toward -z pole
_REDSHIFT_WEIGHT = {"SURGE": 1.0, "CRASH": 1.0, "CONTINUATION": 0.6, "RANGE": 0.3}
LENS_REFERENCE_RADIUS = 30.0 * A_MICRO

# Extreme-z cells -> (tarot suit, element, market)
SINGULARITY_CELLS = {
    0: ("WANDS", "FIRE", "METAL"),
    1: ("CUPS", "WATER", "ANIMAL"),
    46: ("SWORDS", "AIR", "CRYPTO"),
    47: ("PENTACLES", "EARTH", "META"),
}
# Singularity Axis: the lattice pole axis (+z in the grid) is the absolute price axis,
# rendered as the vertical Y axis by the frontend. Height = predicted price offset from
# the current price (0 = singularity); radial distance in the plane orthogonal to the
# axis = time to target.
HOURS_PER_RADIUS_UNIT = 0.25  # 1 radial unit = 15 minutes
MIN_TIME_TO_TARGET_HRS = 1.0 / 60.0
DRAWDOWN_BASE = 0.12  # baseline adverse excursion as a share of |price offset|-scale r
DRAWDOWN_LENSING_GAIN = 0.55
MAX_RR = 99.0
GRAVITY_SIGMA = 0.9  # radians; angular reach of a singularity's pull
# Suit pull strength: Metal (tension) accelerates the most.
SUIT_GRAVITY = {"WANDS": 0.9, "SWORDS": 0.6, "CUPS": 0.45, "PENTACLES": 0.3}
RR_ACCELERATION_GAIN = 0.5  # RR bonus per unit of time saved by gravity
_WAVE_DRIFT = {"SURGE": -0.25, "CONTINUATION": -0.08, "RANGE": 0.0, "CRASH": 0.25}


def generate_base_48_cells() -> list[tuple[float, float]]:
    """Return 48 evenly distributed (theta, phi) pairs via the spherical Fibonacci lattice.

    theta is the polar angle [0, pi], phi the azimuth [0, 2pi).
    """
    cells: list[tuple[float, float]] = []
    for i in range(CELL_COUNT):
        z = 1.0 - 2.0 * (i + 0.5) / CELL_COUNT
        theta = math.acos(z)
        phi = (i * GOLDEN_ANGLE) % (2.0 * math.pi)
        cells.append((theta, phi))
    return cells


def _unit(theta: float, phi: float) -> np.ndarray:
    return np.array(
        [math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)]
    )


def singularity_gravity(theta: float, phi: float) -> dict[str, Any]:
    """Angular distance to the 4 element singularities and the resulting time factor.

    pull_s = SUIT_GRAVITY[s] * exp(-d_s^2 / (2 sigma^2));  factor = 1 / (1 + sum pull_s).
    factor in (0, 1]: 1 = no interference, lower = the entry-to-exit time is shortened.
    """
    cells = generate_base_48_cells()
    point = _unit(theta, phi)
    distances: dict[str, float] = {}
    total = 0.0
    for cell_id, (suit, _element, market) in SINGULARITY_CELLS.items():
        t0, p0 = cells[cell_id]
        d = math.acos(max(-1.0, min(1.0, float(point @ _unit(t0, p0)))))
        distances[suit] = d
        total += SUIT_GRAVITY[suit] * math.exp(-(d * d) / (2.0 * GRAVITY_SIGMA**2))
    nearest = min(distances, key=distances.get)
    return {
        "nearest_suit": nearest,
        "nearest_market": SINGULARITY_CELLS[
            next(c for c, v in SINGULARITY_CELLS.items() if v[0] == nearest)
        ][2],
        "distances": distances,
        "time_factor": 1.0 / (1.0 + total),
    }


def _wave(kind: str, x: float) -> float:
    return math.sin(x) if kind == "sin" else math.cos(x)


def _clamp_dial(scale_dial: float) -> float:
    try:
        value = float(scale_dial)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(value):
        return 0.0
    return min(1.0, max(0.0, value))


def calculate_384_spiral_candies(scale_dial: float) -> list[dict[str, Any]]:
    """Compute the 384 spiral candies for ``scale_dial`` in [0, 1].

    Returns dicts with index, xyz coordinates, spherical coords and attributes.
    """
    dial = _clamp_dial(scale_dial)
    ln_a = math.log(A_MICRO) + dial * ZOOM_LOG_SPAN
    a = math.exp(ln_a)
    b = B_BASE

    cells = generate_base_48_cells()
    candies: list[dict[str, Any]] = []
    index = 0
    for cell_id, (theta0, phi0) in enumerate(cells):
        assignment = cell_assignment(cell_id)

        # First pass: base position and waveform value of the 4 layers in this cell.
        layers = []
        for wave_id, wave_name in enumerate(WAVEFORMS):
            shift, kind, freq = _WAVE_PHASES[wave_name]
            # omega: micro -> macro position, staggered per waveform layer
            omega = (wave_id + (cell_id + 0.5) / CELL_COUNT) / len(WAVEFORMS)
            w = _wave(kind, 2.0 * math.pi * freq * omega + shift + phi0)

            r = a * math.exp(b * omega) * (1.0 + RADIAL_RIPPLE * w)
            theta = theta0 + WAVE_AMPLITUDE * w + _WAVE_DRIFT[wave_name] * omega
            theta = min(math.pi, max(0.0, theta))
            phi = phi0 + 2.0 * math.pi * SPIRAL_TURNS * omega

            sin_t = math.sin(theta)
            base = np.array(
                [r * sin_t * math.cos(phi), r * sin_t * math.sin(phi), r * math.cos(theta)]
            )
            layers.append((wave_name, omega, w, r, theta, phi, base))

        for wave_id, (wave_name, omega, w, r, theta, phi, base) in enumerate(layers):
            pta = _pta_resultant(wave_id, layers)
            lensing = _lensing_distortion(r, omega, w)
            gravity = singularity_gravity(theta, phi)
            for polarity in POLARITIES:
                x, y, z = (base * polarity).tolist()
                # Polarity inverts through the origin, so the lattice point's unit
                # direction is mirrored too.
                g = gravity if polarity > 0 else singularity_gravity(math.pi - theta, phi + math.pi)
                rr = _risk_reward(x, y, z, r, lensing, pta * polarity, g["time_factor"])
                candies.append(
                    {
                        "index": index,
                        "cell": cell_id,
                        "waveform": wave_name,
                        "polarity": "UP" if polarity > 0 else "DOWN",
                        "omega": omega,
                        "r": r,
                        "theta": theta,
                        "phi": phi % (2.0 * math.pi),
                        "x": x,
                        "y": y,
                        "z": z,
                        "tarot": assignment["label"],
                        "element": assignment["element"],
                        "symbol": assignment["symbol"],
                        "tarot_archetype": assignment["tarot_archetype"],
                        "element_singularity": assignment["element_singularity"],
                        "redshift": _redshift(wave_name, w, polarity),
                        "lensing_distortion": lensing,
                        "pta_vector": (pta * polarity).tolist(),
                        "axis_height": z,
                        "axis_radial": rr["radial"],
                        "direction": rr["direction"],
                        "expected_return": rr["expected_return"],
                        "max_drawdown": rr["max_drawdown"],
                        "gravity": {
                            "nearest_suit": g["nearest_suit"],
                            "nearest_market": g["nearest_market"],
                            "distances": g["distances"],
                            "time_factor": g["time_factor"],
                        },
                        "time_to_target_hrs": rr["time_to_target_hrs"],
                        "risk_reward_ratio": rr["risk_reward_ratio"],
                    }
                )
                index += 1
    return candies


def cell_assignment(cell_id: int) -> dict[str, Any]:
    """Strict tarot/element assignment of one of the 48 cells.

    The Fibonacci lattice orders cells from the +z pole to the -z pole, so cells
    0, 1 (top) and 46, 47 (bottom) are the extreme-z cells and become the four
    pure element singularities. The other 44 cells map 22 Major Arcana x
    (Light, Shadow) in order.
    """
    if cell_id in SINGULARITY_CELLS:
        suit, element, market = SINGULARITY_CELLS[cell_id]
        return {
            "label": f"{suit}_SINGULARITY",
            "element": element,
            "symbol": market,
            "tarot_archetype": None,
            "element_singularity": {"market": market, "suit": suit, "element": element},
        }
    k = cell_id - sum(1 for c in SINGULARITY_CELLS if c < cell_id)
    card_id = sorted(MAJOR_ARCANA_SYMBOLS)[k // 2]
    arcana = MAJOR_ARCANA_SYMBOLS[card_id]
    aspect = "LIGHT" if k % 2 == 0 else "SHADOW"
    return {
        "label": arcana["card"],
        "element": arcana["element"],
        "symbol": arcana["symbol"],
        "tarot_archetype": {"id": card_id, "name": arcana["card"], "aspect": aspect},
        "element_singularity": None,
    }


def _risk_reward(
    x: float, y: float, z: float, r: float, lensing: float, pta: np.ndarray, time_factor: float
) -> dict[str, Any]:
    """Time-to-Target and RR from the position relative to the Singularity Axis.

    radial = sqrt(x^2 + y^2)            -> time_to_target = max(min, radial * hrs_per_unit * time_factor)
    expected_return = |z|               (predicted price offset along the axis)
    max_drawdown = r * (base + gain * lensing) * (1 + |pta|)   (volatility pressure + timing skew)
    RR = expected_return / max_drawdown * (1 + gain * (1 - time_factor)), capped at MAX_RR.
    """
    radial = math.hypot(x, y)
    time_hrs = max(MIN_TIME_TO_TARGET_HRS, radial * HOURS_PER_RADIUS_UNIT * time_factor)
    expected = abs(z)
    drawdown = max(
        1e-9, r * (DRAWDOWN_BASE + DRAWDOWN_LENSING_GAIN * lensing) * (1.0 + float(np.linalg.norm(pta)))
    )
    ratio = expected / drawdown * (1.0 + RR_ACCELERATION_GAIN * (1.0 - time_factor))
    return {
        "radial": radial,
        "direction": "LONG" if z >= 0 else "SHORT",
        "expected_return": expected,
        "max_drawdown": drawdown,
        "time_to_target_hrs": time_hrs,
        "risk_reward_ratio": min(MAX_RR, ratio),
    }


def _redshift(wave_name: str, w: float, polarity: int) -> float:
    """Blueshift (<0) for ascending vectors, redshift (>0) for descending, in [-1, 1]."""
    magnitude = _REDSHIFT_WEIGHT[wave_name] * (0.5 + 0.5 * abs(w))
    return -polarity * min(1.0, max(0.0, magnitude))


def _lensing_distortion(r: float, omega: float, w: float) -> float:
    """Mock volatility pressure in [0, 1].

    Combines proximity to the singularity (pressure decays with r) and the local
    curvature of the log spiral (a steeper ln r slope per turn means a flatter path).
    """
    proximity = 1.0 / (1.0 + r / LENS_REFERENCE_RADIUS)
    slope = B_BASE + RADIAL_RIPPLE * 2.0 * math.pi * math.cos(2.0 * math.pi * omega)
    curvature = 1.0 / math.sqrt(1.0 + (slope / (2.0 * math.pi * SPIRAL_TURNS)) ** 2)
    ripple = 0.5 + 0.5 * w
    value = 0.55 * proximity + 0.3 * curvature + 0.15 * ripple
    return min(1.0, max(0.0, value))


def _pta_resultant(i: int, layers: list) -> np.ndarray:
    """Pulsar-timing-style displacement: sum of phase lags toward the sibling waveforms.

    Each of the other 3 layers in the cell contributes its waveform lag (w_j - w_i)
    along the unit direction to its position; components are bounded to [-1, 1].
    """
    _, _, w_i, _, _, _, p_i = layers[i]
    total = np.zeros(3)
    for j, (_, _, w_j, _, _, _, p_j) in enumerate(layers):
        if j == i:
            continue
        d = p_j - p_i
        norm = float(np.linalg.norm(d))
        if norm > 0.0:
            total += (w_j - w_i) * d / norm
    return np.clip(total / 6.0, -1.0, 1.0)


class SpiralGridResponse(BaseModel):
    scale_dial: float
    count: int
    log10_radius_min: float
    log10_radius_max: float
    candies: list[dict[str, Any]]


router = APIRouter()


@router.get("/api/v1/oracle/spiral-grid", response_model=SpiralGridResponse)
def get_spiral_grid(scale_dial: float = 0.0) -> SpiralGridResponse:
    dial = _clamp_dial(scale_dial)
    candies = calculate_384_spiral_candies(dial)
    radii = [c["r"] for c in candies]
    return SpiralGridResponse(
        scale_dial=dial,
        count=len(candies),
        log10_radius_min=math.log10(min(radii)),
        log10_radius_max=math.log10(max(radii)),
        candies=candies,
    )
