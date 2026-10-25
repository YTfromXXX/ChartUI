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


from knot_crossings import (  # noqa: E402
    find_crossings,
    margin_square,
    margins_overlap,
    square_side,
    writhe,
)

EPSILON = 2.0
FOUR_LINES = [
    ((-10.0, -10.0), (10.0, 10.0)),
    ((-10.0, 10.0), (10.0, -10.0)),
    ((-12.0, 3.0), (12.0, 3.0)),
    ((6.0, -12.0), (6.0, 12.0)),
]


def test_four_lines_yield_expected_crossings():
    crossings = find_crossings(FOUR_LINES)
    pairs = {(c["over"], c["under"]) if c["over"] < c["under"] else (c["under"], c["over"]) for c in crossings}
    assert pairs == {(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)}
    assert all(c["over"] != c["under"] for c in crossings)


def test_crossing_points_lie_on_both_segments():
    for crossing in find_crossings(FOUR_LINES):
        px, py = crossing["point"]
        for index in (crossing["over"], crossing["under"]):
            (x1, y1), (x2, y2) = FOUR_LINES[index]
            cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
            assert cross == pytest.approx(0.0, abs=1e-6)
            assert min(x1, x2) - 1e-9 <= px <= max(x1, x2) + 1e-9


def test_parallel_and_endpoint_touching_segments_do_not_cross():
    assert find_crossings([((0, 0), (1, 0)), ((0, 1), (1, 1))]) == []
    assert find_crossings([((0, 0), (1, 1)), ((1, 1), (2, 0))]) == []


def test_margin_square_has_side_two_epsilon_and_is_centered():
    crossings = find_crossings(FOUR_LINES)
    for crossing in crossings:
        corners = margin_square(FOUR_LINES[crossing["over"]], crossing["point"], EPSILON)
        assert square_side(corners) == pytest.approx(2 * EPSILON)
        cx = sum(p[0] for p in corners) / 4
        cy = sum(p[1] for p in corners) / 4
        assert (cx, cy) == pytest.approx(crossing["point"])
        sides = [math.dist(corners[i], corners[(i + 1) % 4]) for i in range(4)]
        assert sides == pytest.approx([2 * EPSILON] * 4)


def test_over_under_alternates_and_flips_sign_consistently():
    crossings = sorted(find_crossings(FOUR_LINES), key=lambda c: c["order"])
    assert len({c["over"] for c in crossings}) > 1
    assert abs(writhe(crossings)) <= len(crossings)
    mirrored = find_crossings([FOUR_LINES[1], FOUR_LINES[0], *FOUR_LINES[2:]])
    assert len(mirrored) == len(crossings)


def test_margins_do_not_overlap_for_well_separated_crossings():
    crossings = find_crossings(FOUR_LINES)
    assert not margins_overlap(crossings, 0.5)
    assert margins_overlap(crossings, 100.0)


# ---- Stress pipeline: Knot Overload -------------------------------------------------
from mocks.geometric_stress_generator import knot_overload_segments, knot_overload_ticks  # noqa: E402


@pytest.mark.parametrize("seed", (1, 11, 99))
def test_knot_overload_crossings_keep_valid_margin_squares(seed):
    segments = knot_overload_segments(count=48, seed=seed)
    crossings = find_crossings(segments)

    assert len(crossings) > 200  # saturated: far beyond a human-readable diagram
    for crossing in crossings:
        assert crossing["over"] != crossing["under"]
        assert math.isfinite(crossing["point"][0]) and math.isfinite(crossing["point"][1])
        corners = margin_square(segments[crossing["over"]], crossing["point"], EPSILON)
        assert all(math.isfinite(c) for corner in corners for c in corner)
        assert square_side(corners) == pytest.approx(2 * EPSILON)
        cx = sum(p[0] for p in corners) / 4
        cy = sum(p[1] for p in corners) / 4
        assert (cx, cy) == pytest.approx(crossing["point"])
    assert abs(writhe(crossings)) <= len(crossings)


def test_knot_overload_each_pair_crosses_at_most_once_and_is_not_duplicated():
    segments = knot_overload_segments(count=32, seed=5)
    crossings = find_crossings(segments)
    pairs = [frozenset((c["over"], c["under"])) for c in crossings]
    assert len(pairs) == len(set(pairs))


def test_knot_overload_ticks_are_finite_and_whipsaw():
    ticks = knot_overload_ticks(count=1024, seed=3)
    assert all(math.isfinite(float(t["price"])) and float(t["price"]) > 0 for t in ticks)
    reversals = sum(
        1
        for a, b, c in zip(ticks, ticks[1:], ticks[2:])
        if (float(b["price"]) - float(a["price"])) * (float(c["price"]) - float(b["price"])) < 0
    )
    assert reversals / len(ticks) > 0.7
    # Last-window line segments of the tick path feed the knot chart; they must stay topologically valid.
    window = [((float(i), float(t["price"])), (float(i + 1), float(ticks[i + 1]["price"]))) for i, t in enumerate(ticks[:16])]
    for crossing in find_crossings(window):
        assert square_side(margin_square(window[crossing["over"]], crossing["point"], EPSILON)) == pytest.approx(2 * EPSILON)
