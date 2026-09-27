"""Spherical-harmonic distortion field for the Arcana trap / Portfolio Radar
system.

The market's aggregate order-book pressure (vertical/horizontal pressure from
`spiral_cube_analyzer` and the true gravity tensor from `orderbook_analyzer`)
is fitted to a low-order real spherical-harmonic expansion, producing a
"distorted sphere" r(theta, phi) around a fixed base radius. A 48-face
polyhedron barrier (the same 8x6 grid used by the frontend's 48-mass field)
sits at the base radius; for each face k we compute the signed distance

    D_k(t) = R0 - r(theta_k, phi_k, t)

which is positive while the sphere sits inside the barrier and converges to
zero (or goes negative) as the distorted sphere bulges through that face --
a breakout. Callers track D_k(t) across polls to derive the acceleration
A_k(t) (second finite difference) used to fire an armed Arcana trap before
the breakout is even complete.
"""

from __future__ import annotations

from math import cos, isfinite, pi, sin, sqrt
from typing import Sequence, TypedDict

GRID_COLUMNS = 8
GRID_ROWS = 6
PLANE_COUNT = GRID_COLUMNS * GRID_ROWS  # 48

_SH00 = 0.5 * sqrt(1 / pi)


def _sh10(theta: float) -> float:
    return 0.5 * sqrt(3 / pi) * cos(theta)


def _sh20(theta: float) -> float:
    return 0.25 * sqrt(5 / pi) * (3 * cos(theta) ** 2 - 1)


def _sh22(theta: float, phi: float) -> float:
    return 0.25 * sqrt(15 / pi) * sin(theta) ** 2 * cos(2 * phi)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _clamp01(value: float) -> float:
    return _clamp(value if isfinite(value) else 0.0, 0.0, 1.0)


class SphericalCoefficients(TypedDict):
    c00: float
    c10: float
    c20: float
    c22: float


class PlaneReading(TypedDict):
    index: int
    theta: float
    phi: float
    radius: float
    distance: float


def cell_angles(index: int) -> tuple[float, float]:
    """Maps a 48-cell grid index to (theta, phi) on the unit sphere.

    Mirrors `lib/projectionGrid.ts::cellAngles` on the frontend so a "cell"
    and a "plane" always refer to the same physical direction.
    """

    if not 0 <= index < PLANE_COUNT:
        raise ValueError(f"plane index out of range: {index}")
    column = index % GRID_COLUMNS
    row = index // GRID_COLUMNS
    theta = ((row + 0.5) / GRID_ROWS) * pi
    phi = ((column + 0.5) / GRID_COLUMNS) * 2 * pi
    return theta, phi


def coefficients_from_market(
    vertical_pressure: float,
    horizontal_pressure: float,
    gravity_magnitude: float,
    net_force: float,
) -> SphericalCoefficients:
    """Maps order-book / spiral-cube pressures onto SH coefficients."""

    return {
        "c00": 0.15 * _clamp01(gravity_magnitude),
        "c10": 0.22 * _clamp(net_force if isfinite(net_force) else 0.0, -1.0, 1.0),
        "c20": 0.18 * (_clamp01(vertical_pressure) - _clamp01(horizontal_pressure)),
        "c22": 0.12 * _clamp01(horizontal_pressure),
    }


def distorted_radius(theta: float, phi: float, coefficients: SphericalCoefficients, base_radius: float = 1.0) -> float:
    """Distorted sphere radius r(theta, phi) at the given coefficients."""

    return (
        base_radius
        + coefficients["c00"] * _SH00
        + coefficients["c10"] * _sh10(theta)
        + coefficients["c20"] * _sh20(theta)
        + coefficients["c22"] * _sh22(theta, phi)
    )


def calculate_true_gravity_distortion(
    coefficients: SphericalCoefficients,
    base_radius: float = 1.0,
) -> list[PlaneReading]:
    """Samples the distorted sphere at all 48 barrier-face directions.

    Returns, for every plane, its spherical coordinates, the distorted
    radius there, and the SDF distance `D_k(t) = base_radius - radius`.
    """

    readings: list[PlaneReading] = []
    for index in range(PLANE_COUNT):
        theta, phi = cell_angles(index)
        radius = distorted_radius(theta, phi, coefficients, base_radius)
        readings.append(
            {
                "index": index,
                "theta": theta,
                "phi": phi,
                "radius": radius,
                "distance": base_radius - radius,
            }
        )
    return readings


def calculate_true_gravity_tensor_distortion_from_payload(
    vertical_pressure: float = 0.0,
    horizontal_pressure: float = 0.0,
    gravity_magnitude: float = 0.0,
    net_force: float = 0.0,
    base_radius: float = 1.0,
) -> dict[str, object]:
    """Top-level orchestrator used by the `/api/distortion-field` route."""

    coefficients = coefficients_from_market(vertical_pressure, horizontal_pressure, gravity_magnitude, net_force)
    planes = calculate_true_gravity_distortion(coefficients, base_radius)
    return {"coefficients": coefficients, "base_radius": base_radius, "planes": planes}


def estimate_plane_acceleration(distance_history: Sequence[tuple[float, float]]) -> float | None:
    """Second finite difference of Dk(t) samples of the form (distance, time).

    Requires at least three samples; returns None otherwise. A negative
    result means the distorted sphere's approach toward that barrier face is
    accelerating, which -- combined with a small positive distance -- is the
    trigger condition for an armed Arcana trap.
    """

    if len(distance_history) < 3:
        return None
    (d0, t0), (d1, t1), (d2, t2) = distance_history[-3:]
    dt1 = max(1e-6, t1 - t0)
    dt2 = max(1e-6, t2 - t1)
    velocity1 = (d1 - d0) / dt1
    velocity2 = (d2 - d1) / dt2
    return (velocity2 - velocity1) / max(1e-6, (dt1 + dt2) / 2)
