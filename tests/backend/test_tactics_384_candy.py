from __future__ import annotations

import pytest

from tactics_384 import (
    CANDY_CELL_COUNT,
    CANDY_POLES,
    CANDY_TIMELINE_LAYERS,
    CANDY_TOTAL_POINTS,
    calculate_true_gravity_candy_points,
    spherical_fibonacci_lattice,
)


def test_spherical_fibonacci_lattice_count_and_norm():
    cells = spherical_fibonacci_lattice(48)
    assert len(cells) == 48
    for x, y, z in cells:
        norm = (x * x + y * y + z * z) ** 0.5
        assert abs(norm - 1.0) < 1e-6


def test_calculate_true_gravity_candy_points_produces_384_points():
    result = calculate_true_gravity_candy_points(current_price=50000.0, radius=200.0)
    assert result["meta"]["total_points"] == 384
    candies = result["candies"]
    assert len(candies) == 384

    # Verify grouping
    layer_names = {name for name, _, _ in CANDY_TIMELINE_LAYERS}
    observed_layers = {candy["layer"] for candy in candies}
    assert observed_layers == layer_names

    observed_poles = {candy["pole"] for candy in candies}
    assert observed_poles == set(CANDY_POLES)

    cell_indices = {candy["cell_index"] for candy in candies}
    assert cell_indices == set(range(48))


def test_candy_point_schema_fields():
    result = calculate_true_gravity_candy_points(current_price=100.0, radius=10.0)
    for candy in result["candies"]:
        assert "id" in candy
        assert "cell_index" in candy
        assert "layer" in candy
        assert "pole" in candy
        assert "t" in candy and 0.0 <= candy["t"] <= 1.0
        assert "position" in candy
        assert set(candy["position"].keys()) == {"x", "y", "z"}
        assert "normal" in candy
        assert set(candy["normal"].keys()) == {"x", "y", "z"}
        # Normal should be approximately unit length
        nx, ny, nz = candy["normal"]["x"], candy["normal"]["y"], candy["normal"]["z"]
        norm = (nx * nx + ny * ny + nz * nz) ** 0.5
        assert abs(norm - 1.0) < 1e-4

        assert "probability" in candy and 0.0 <= candy["probability"] <= 1.0
        assert candy["direction"] in {"bullish", "bearish", "neutral"}
        assert "tarot" in candy
        assert set(candy["tarot"].keys()) == {"id", "name", "variance_multiplier", "directional_bias"}
        assert 0 <= candy["tarot"]["id"] <= 21


def test_candy_points_negative_or_invalid_price_raises():
    with pytest.raises(ValueError):
        calculate_true_gravity_candy_points(current_price=-10.0, radius=10.0)
    with pytest.raises(ValueError):
        calculate_true_gravity_candy_points(current_price=100.0, radius=0.0)


def test_main_candy_points_endpoint_direct():
    from main import CandyPointsRequest, candy_points

    req = CandyPointsRequest(current_price=64000.0, radius=500.0, turns=3.0)
    data = candy_points(req)
    assert data["meta"]["total_points"] == 384
    assert len(data["candies"]) == 384
    first = data["candies"][0]
    assert first["probability"] >= 0.0
    assert first["direction"] in {"bullish", "bearish", "neutral"}
    assert first["tarot"]["name"]

