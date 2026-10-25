"""Tests for the spherical-harmonic distortion field (Dk(t) barrier math)."""

import math

import pytest

from distortion_field import (
    PLANE_COUNT,
    calculate_true_gravity_distortion,
    calculate_true_gravity_tensor_distortion_from_payload,
    cell_angles,
    coefficients_from_market,
    distorted_radius,
    estimate_plane_acceleration,
)


def test_cell_angles_cover_full_sphere_and_are_bijective():
    angles = [cell_angles(index) for index in range(PLANE_COUNT)]
    assert len(set(angles)) == PLANE_COUNT
    for theta, phi in angles:
        assert 0.0 < theta < math.pi
        assert 0.0 < phi < 2 * math.pi


def test_cell_angles_rejects_out_of_range_index():
    with pytest.raises(ValueError):
        cell_angles(PLANE_COUNT)
    with pytest.raises(ValueError):
        cell_angles(-1)


def test_flat_coefficients_keep_radius_at_base():
    flat = {"c00": 0.0, "c10": 0.0, "c20": 0.0, "c22": 0.0}
    for index in range(0, PLANE_COUNT, 7):
        theta, phi = cell_angles(index)
        assert distorted_radius(theta, phi, flat, base_radius=1.0) == pytest.approx(1.0)


def test_calculate_true_gravity_distortion_returns_48_finite_planes():
    coefficients = coefficients_from_market(
        vertical_pressure=0.7, horizontal_pressure=0.2, gravity_magnitude=0.6, net_force=0.5
    )
    planes = calculate_true_gravity_distortion(coefficients, base_radius=1.0)

    assert len(planes) == PLANE_COUNT
    assert {plane["index"] for plane in planes} == set(range(PLANE_COUNT))
    for plane in planes:
        assert math.isfinite(plane["radius"])
        assert math.isfinite(plane["distance"])
        assert plane["distance"] == pytest.approx(1.0 - plane["radius"])


def test_net_force_direction_biases_dipole_pole():
    up_planes = calculate_true_gravity_distortion(
        coefficients_from_market(0.0, 0.0, 0.0, net_force=1.0)
    )
    down_planes = calculate_true_gravity_distortion(
        coefficients_from_market(0.0, 0.0, 0.0, net_force=-1.0)
    )
    # Row 0 sits near theta -> 0 (the "buy" pole); a positive net force should
    # bulge that pole outward (smaller Dk) relative to a negative net force.
    assert up_planes[0]["distance"] < down_planes[0]["distance"]


def test_orchestrator_payload_shape():
    payload = calculate_true_gravity_tensor_distortion_from_payload(
        vertical_pressure=0.4, horizontal_pressure=0.3, gravity_magnitude=0.5, net_force=0.1
    )
    assert set(payload) == {"coefficients", "base_radius", "planes"}
    assert len(payload["planes"]) == PLANE_COUNT
    assert payload["base_radius"] == 1.0


def test_estimate_plane_acceleration_requires_three_samples():
    assert estimate_plane_acceleration([(1.0, 0.0), (0.9, 1.0)]) is None


def test_estimate_plane_acceleration_detects_accelerating_approach():
    # Distance shrinking ever faster => accelerating approach => negative Ak.
    history = [(1.0, 0.0), (0.8, 1.0), (0.3, 2.0)]
    acceleration = estimate_plane_acceleration(history)
    assert acceleration is not None
    assert acceleration < 0


def test_estimate_plane_acceleration_detects_decelerating_approach():
    # Distance shrinking ever more slowly => decelerating approach => positive Ak.
    history = [(1.0, 0.0), (0.3, 1.0), (0.1, 2.0)]
    acceleration = estimate_plane_acceleration(history)
    assert acceleration is not None
    assert acceleration > 0


from distortion_field import (  # noqa: E402
    BREAKOUT_DISTANCE,
    coefficients_from_fund_flows,
    detect_breakouts,
    stream_function_velocity,
)


def test_zero_or_invalid_fund_flows_keep_sphere_flat():
    for flows in ([], [0.0, 0.0], [float("nan")]):
        planes = calculate_true_gravity_distortion(coefficients_from_fund_flows(flows))
        assert all(plane["distance"] == pytest.approx(0.0) for plane in planes)
        assert detect_breakouts(planes) == list(range(PLANE_COUNT))


def test_fund_flow_sign_moves_dk_at_the_poles():
    inflow = calculate_true_gravity_distortion(coefficients_from_fund_flows([5.0, 3.0]))
    outflow = calculate_true_gravity_distortion(coefficients_from_fund_flows([-5.0, -3.0]))
    assert inflow[0]["distance"] < outflow[0]["distance"]
    assert inflow[PLANE_COUNT - 1]["distance"] > outflow[PLANE_COUNT - 1]["distance"]


def test_dk_matches_closed_form_for_fund_flow_coefficients():
    coefficients = coefficients_from_fund_flows([4.0, -1.0, 2.0])
    for plane in calculate_true_gravity_distortion(coefficients, base_radius=1.5):
        theta, phi = cell_angles(plane["index"])
        assert plane["distance"] == pytest.approx(1.5 - distorted_radius(theta, phi, coefficients, 1.5))


def test_breakout_threshold_is_inclusive_and_matches_distance():
    planes = calculate_true_gravity_distortion(coefficients_from_fund_flows([10.0, 2.0, -1.0]))
    broken = detect_breakouts(planes)
    assert broken == [p["index"] for p in planes if p["distance"] <= BREAKOUT_DISTANCE]
    assert broken, "a strong one-sided flow must push mass through at least one face"
    assert detect_breakouts(planes, threshold=-10.0) == []
    boundary = [{"index": 0, "distance": BREAKOUT_DISTANCE}, {"index": 1, "distance": BREAKOUT_DISTANCE + 1e-9}]
    assert detect_breakouts(boundary) == [0]


def test_stronger_flow_never_reduces_breakout_count():
    counts = [
        len(detect_breakouts(calculate_true_gravity_distortion(coefficients_from_fund_flows([scale, scale * 0.5]))))
        for scale in (0.5, 2.0, 20.0)
    ]
    assert counts == sorted(counts)


def test_stream_function_velocity_is_divergence_free():
    h = 1e-5
    for x, y in ((0.3, 0.7), (1.9, 2.4), (4.0, 5.5)):
        du = (stream_function_velocity(x + h, y)[0] - stream_function_velocity(x - h, y)[0]) / (2 * h)
        dv = (stream_function_velocity(x, y + h)[1] - stream_function_velocity(x, y - h)[1]) / (2 * h)
        assert du + dv == pytest.approx(0.0, abs=1e-6)


# ---- Stress pipeline: SDF Breakthrough / Long-term Spiral ----------------------------
from distortion_field import advect_particle, boundary_response, sdf_at, sdf_normal  # noqa: E402
from mocks.geometric_stress_generator import (  # noqa: E402
    long_term_spiral_prices,
    sdf_breakthrough_flows,
    sdf_breakthrough_jets,
    spiral_scale_series,
)


def _speed(v):
    return math.sqrt(sum(c * c for c in v))


def test_boundary_response_conserves_kinetic_energy_and_blocks_penetration():
    coefficients = coefficients_from_fund_flows([3.0, -1.0])
    for point, velocity in (((1.0, 0.1, 0.2), (2.0, 0.0, 0.0)), ((0.0, 1.2, 0.0), (0.0, -3.0, 0.0)), ((0.3, 0.8, 0.5), (-1.0, 1.0, 2.0))):
        n = sdf_normal(point, coefficients)
        out = boundary_response(velocity, n)
        assert sum(o * c for o, c in zip(out, n)) == pytest.approx(0.0, abs=1e-9)
        assert _speed(out) == pytest.approx(_speed(velocity), rel=1e-9)


def test_flash_crash_breakthrough_stays_finite_and_flags_all_faces():
    frames = sdf_breakthrough_flows(steps=240, spike=5000.0, spike_at=120)
    peak = max(abs(f) for f in frames[120])
    assert peak > 500  # mass really does jump by orders of magnitude
    for frame in frames:
        planes = calculate_true_gravity_distortion(coefficients_from_fund_flows(frame))
        assert all(math.isfinite(p["distance"]) and math.isfinite(p["radius"]) for p in planes)
        assert calculate_true_gravity_distortion(coefficients_from_fund_flows(frame))  # no exception
    crash = calculate_true_gravity_distortion(coefficients_from_fund_flows(frames[120]))
    assert len(detect_breakouts(crash)) > 0


def test_fluid_stays_finite_and_forms_wall_vortices_during_flash_crash():
    frames = sdf_breakthrough_flows(steps=160, spike=5000.0, spike_at=60)
    jets = sdf_breakthrough_jets(frames)
    wall_hits = 0
    tangential_energy = 0.0
    seeds = [(1.3 * math.cos(i), 0.9 * math.sin(i * 0.7), 1.3 * math.sin(i)) for i in range(24)]
    points = list(seeds)
    for step in range(60, 160):
        coefficients = coefficients_from_fund_flows(frames[step])
        for index, point in enumerate(points):
            new, velocity, hit = advect_particle(point, step * 0.05, 0.05, jets[step], coefficients)
            assert all(math.isfinite(c) for c in new + velocity)
            assert sdf_at(new, coefficients) >= -1e-2  # never tunnels through the barrier
            assert _speed(velocity) <= 4.0 + 1e-9
            if hit:
                wall_hits += 1
                n = sdf_normal(new, coefficients)
                tangential_energy += _speed(velocity) ** 2 - sum(v * c for v, c in zip(velocity, n)) ** 2
            points[index] = new
    assert wall_hits > 0
    assert tangential_energy > 0.0


def test_long_term_spiral_scale_grows_monotonically_and_flow_fit_stays_bounded():
    prices = long_term_spiral_prices(years=40)
    assert len(prices) == 40 * 252 + 1
    assert all(math.isfinite(p) and p > 0 for p in prices)
    scales = spiral_scale_series(prices)
    assert all(b >= a for a, b in zip(scales, scales[1:]))
    assert scales[-1] > scales[len(scales) // 2] > 0
    # Decades of cumulative flow must not break the SH coefficients.
    flows = [b - a for a, b in zip(prices[::252], prices[252::252])]
    coefficients = coefficients_from_fund_flows(flows)
    assert all(math.isfinite(v) and abs(v) < 1.0 for v in coefficients.values())


from distortion_field import clamp_cell_velocity, cell_speed_cap  # noqa: E402


def test_cell_speed_caps_are_bounded_and_lower_at_poles():
    caps = [cell_speed_cap(i) for i in range(PLANE_COUNT)]
    assert all(0.0 < c <= 4.0 for c in caps)
    assert cell_speed_cap(0) < cell_speed_cap(2 * 8)  # pole row < equatorial row


def test_clamp_cell_velocity_survives_5000x_mass_and_non_finite_input():
    for index in range(PLANE_COUNT):
        huge = clamp_cell_velocity((5000.0, -5000.0, 5000.0), index)
        assert _speed(huge) == pytest.approx(cell_speed_cap(index))
        for bad in ((float("nan"), 0.0, 0.0), (float("inf"), 1.0, 0.0), (1e300, 1e300, 1e300)):
            assert clamp_cell_velocity(bad, index) == (0.0, 0.0, 0.0)
        small = clamp_cell_velocity((0.1, 0.0, 0.0), index)
        assert small == (0.1, 0.0, 0.0)
