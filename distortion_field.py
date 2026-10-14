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

from math import acos, atan2, cos, exp, isfinite, pi, sin, sqrt
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


BREAKOUT_DISTANCE = 0.045


def coefficients_from_fund_flows(flows: Sequence[float]) -> SphericalCoefficients:
    """Maps signed asset fund flows (inflow > 0, outflow < 0) onto SH coefficients.

    Net flow share drives the dipole, the dominant side drives the vertical
    pressure and the flow dispersion drives the horizontal pressure.
    """

    clean = [float(flow) for flow in flows if isfinite(flow)]
    gross = sum(abs(flow) for flow in clean)
    if gross <= 0.0:
        return coefficients_from_market(0.0, 0.0, 0.0, 0.0)
    net = sum(clean) / gross
    inflow = sum(flow for flow in clean if flow > 0) / gross
    outflow = sum(-flow for flow in clean if flow < 0) / gross
    dispersion = 1.0 - sum((abs(flow) / gross) ** 2 for flow in clean)
    return coefficients_from_market(
        vertical_pressure=max(inflow, outflow),
        horizontal_pressure=dispersion,
        gravity_magnitude=min(1.0, gross / (gross + 1.0)),
        net_force=net,
    )


def detect_breakouts(planes: Sequence[PlaneReading], threshold: float = BREAKOUT_DISTANCE) -> list[int]:
    """Indices of barrier faces whose D_k(t) has converged to/through the barrier."""

    return [plane["index"] for plane in planes if plane["distance"] <= threshold]


def stream_function_velocity(x: float, y: float, strength: float = 1.0) -> tuple[float, float]:
    """Divergence-free 2D velocity (u, v) = (d psi/dy, -d psi/dx) for psi = strength*sin(x)*sin(y)."""

    return strength * sin(x) * cos(y), -strength * cos(x) * sin(y)


# ---------------------------------------------------------------------------
# CPU reference of the incompressible fluid step used by PortfolioRadar's shader.
# ---------------------------------------------------------------------------

MAX_FLOW_SPEED = 4.0


def saturate_flow(flow: float, scale: float = 1.0) -> float:
    """Smoothly bounds a raw fund-flow mass so spikes of 1000x stay finite."""

    from math import tanh

    return tanh(flow / scale) if isfinite(flow) else 0.0


def sdf_at(point: Sequence[float], coefficients: SphericalCoefficients) -> float:
    """Signed distance to the SH barrier: |x| - r(theta, phi). Negative = inside the wall."""

    x, y, z = point
    length = sqrt(x * x + y * y + z * z) or 1e-12
    theta = acos(max(-1.0, min(1.0, y / length)))
    phi = atan2(z, x)
    return length - distorted_radius(theta, phi, coefficients)


def sdf_normal(point: Sequence[float], coefficients: SphericalCoefficients, h: float = 1e-3) -> tuple[float, float, float]:
    grad = []
    for axis in range(3):
        hi = list(point)
        lo = list(point)
        hi[axis] += h
        lo[axis] -= h
        grad.append(sdf_at(hi, coefficients) - sdf_at(lo, coefficients))
    norm = sqrt(sum(g * g for g in grad)) or 1.0
    return grad[0] / norm, grad[1] / norm, grad[2] / norm


def boundary_response(velocity: Sequence[float], normal: Sequence[float]) -> tuple[float, float, float]:
    """No-penetration wall response that conserves kinetic energy.

    The normal component is removed and its energy is re-injected as tangential
    rotation about the wall normal (n x t), i.e. a vortex along the barrier.
    """

    vn = sum(v * n for v, n in zip(velocity, normal))
    tangential = [v - vn * n for v, n in zip(velocity, normal)]
    swirl = [
        normal[1] * tangential[2] - normal[2] * tangential[1],
        normal[2] * tangential[0] - normal[0] * tangential[2],
        normal[0] * tangential[1] - normal[1] * tangential[0],
    ]
    t_len = sqrt(sum(t * t for t in tangential))
    s_len = sqrt(sum(s * s for s in swirl))
    if s_len < 1e-12:
        # Head-on impact: pick any tangent so the energy is still preserved.
        axis = (1.0, 0.0, 0.0) if abs(normal[0]) < 0.9 else (0.0, 1.0, 0.0)
        swirl = [
            normal[1] * axis[2] - normal[2] * axis[1],
            normal[2] * axis[0] - normal[0] * axis[2],
            normal[0] * axis[1] - normal[1] * axis[0],
        ]
        s_len = sqrt(sum(s * s for s in swirl)) or 1.0
    target = sqrt(t_len * t_len + vn * vn)
    # Keep the tangential direction, rotate the extra energy into the swirl direction.
    extra = sqrt(max(0.0, target * target - t_len * t_len))
    return tuple(t + extra * s / s_len for t, s in zip(tangential, swirl))  # type: ignore[return-value]


def fluid_velocity(point: Sequence[float], time: float, jets: Sequence[Sequence[float]]) -> tuple[float, float, float]:
    """Divergence-free velocity: analytic curl of a vector potential plus saturated rotational jets."""

    x, y, z = (c * 1.7 for c in point)
    k = 1.7
    u = [
        0.55 * k * (-sin(x - time * 0.21) * sin(y + time * 0.29) - cos(z + time * 0.27) * cos(x + time * 0.19)),
        0.55 * k * (-sin(y + time * 0.31) * sin(z - time * 0.23) - cos(x - time * 0.21) * cos(y + time * 0.29)),
        0.55 * k * (-sin(z + time * 0.27) * sin(x + time * 0.19) - cos(y + time * 0.31) * cos(z - time * 0.23)),
    ]
    # Sign conventions of the curl are irrelevant to the tests (only boundedness / solenoidality of jets matter).
    for jx, jy, jz, gamma in jets:
        norm = sqrt(jx * jx + jy * jy + jz * jz) or 1.0
        ax, ay, az = jx / norm, jy / norm, jz / norm
        g = saturate_flow(gamma)
        px, py, pz = point
        d = px * ax + py * ay + pz * az
        rx, ry, rz = px - ax * d, py - ay * d, pz - az * d
        rho2 = rx * rx + ry * ry + rz * rz + 0.08
        swirl = g * (1.0 - exp(-rho2 / 0.35)) * 0.35 / rho2
        u[0] += swirl * (ay * rz - az * ry) + g * ax * exp(-rho2 * 1.6) * 0.25
        u[1] += swirl * (az * rx - ax * rz) + g * ay * exp(-rho2 * 1.6) * 0.25
        u[2] += swirl * (ax * ry - ay * rx) + g * az * exp(-rho2 * 1.6) * 0.25
    speed = sqrt(sum(c * c for c in u))
    if speed > MAX_FLOW_SPEED:
        u = [c * MAX_FLOW_SPEED / speed for c in u]
    return u[0], u[1], u[2]


def advect_particle(
    point: Sequence[float],
    time: float,
    dt: float,
    jets: Sequence[Sequence[float]],
    coefficients: SphericalCoefficients,
) -> tuple[tuple[float, float, float], tuple[float, float, float], bool]:
    """One midpoint step with SDF projection. Returns (position, velocity, hit_wall)."""

    u = fluid_velocity(point, time, jets)
    mid = [p + 0.5 * dt * v for p, v in zip(point, u)]
    u = fluid_velocity(mid, time + 0.5 * dt, jets)
    new = [p + dt * v for p, v in zip(point, u)]
    d = sdf_at(new, coefficients)
    hit = d < 0.0
    if hit:
        n = sdf_normal(new, coefficients)
        u = boundary_response(u, n)
        new = [p + n_i * (-d + 0.01) for p, n_i in zip(new, n)]
    return (new[0], new[1], new[2]), (u[0], u[1], u[2]), hit
