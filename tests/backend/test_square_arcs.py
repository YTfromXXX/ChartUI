"""Tests for Major Arcana-constrained Square Arc target calculation."""

import math

import pytest

from tarot_engine import KNOT_MATRIX, MAJOR_ARCANA_SYMBOLS, calculate_square_arcs


def test_knot_matrix_covers_each_major_arcana():
    assert set(KNOT_MATRIX) == set(MAJOR_ARCANA_SYMBOLS)
    assert all(0.0 < float(entry["variance_multiplier"]) <= 1.0 for entry in KNOT_MATRIX.values())
    assert all(-1.0 <= float(entry["directional_bias"]) <= 1.0 for entry in KNOT_MATRIX.values())


def test_square_arcs_returns_eight_finite_3d_points():
    result = calculate_square_arcs(100_000.0, 1_200.0, [1, 17])

    assert [target["trajectory"] for target in result["targets"]] == [
        "surge",
        "continuation",
        "range",
        "plunge",
    ]
    assert len(result["points"]) == 8
    assert {point["side"] for point in result["points"]} == {"buy_stop", "sell_stop"}
    assert all(math.isfinite(float(point[axis])) for point in result["points"] for axis in ("x", "y", "z"))
    assert all(target["buy_stop"]["y"] > target["sell_stop"]["y"] for target in result["targets"])


def test_multiple_knots_multiply_variance_and_contract_targets():
    baseline = calculate_square_arcs(100_000.0, 1_000.0)
    selected = calculate_square_arcs(100_000.0, 1_000.0, [1, 14])

    assert selected["variance_multiplier"] == pytest.approx(
        float(KNOT_MATRIX[1]["variance_multiplier"]) * float(KNOT_MATRIX[14]["variance_multiplier"])
    )
    assert selected["effective_standard_deviation"] < baseline["effective_standard_deviation"]


def test_tower_widens_sell_side_and_narrows_buy_side():
    tower = calculate_square_arcs(100_000.0, 1_000.0, [16])
    range_target = next(target for target in tower["targets"] if target["trajectory"] == "range")

    buy_distance = range_target["buy_stop"]["y"] - 100_000.0
    sell_distance = 100_000.0 - range_target["sell_stop"]["y"]
    assert tower["directional_bias"] < 0.0
    assert sell_distance > buy_distance


@pytest.mark.parametrize("knot_ids", ([22], [-1], [1.5], [True]))
def test_square_arcs_reject_unknown_or_non_integer_knot_ids(knot_ids):
    with pytest.raises(ValueError):
        calculate_square_arcs(100_000.0, 1_000.0, knot_ids)
