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
