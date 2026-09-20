"""Focused tests for spiral cube pressure and topology selection."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2]))

from spiral_cube_analyzer import analyze_spiral_cube, select_knot_topology


def test_vertical_pressure_selects_trefoil_and_reaches_resistance():
    analysis = analyze_spiral_cube({
        "prices": [100.0, 100.1, 100.2, 101.8],
        "current_price": 101.8,
        "previous_price": 100.2,
        "s15_delta": 1.6,
        "delta_scale": 0.4,
        "momentum": 1.0,
        "volatility": 0.9,
        "support": 99.0,
        "resistance": 103.0,
    })

    assert analysis.vertical_pressure > analysis.horizontal_pressure
    assert analysis.topology == "trefoil"
    assert analysis.coordinates[-1].y > analysis.coordinates[0].y


def test_horizontal_pressure_selects_figure_eight():
    analysis = analyze_spiral_cube({
        "prices": [100.0] * 24,
        "current_price": 100.0,
        "previous_price": 100.0,
        "dwell_time": 24.0,
        "dwell_scale": 12.0,
        "accumulated_volume": 90.0,
        "volume_scale": 100.0,
        "support_thickness": 1.0,
        "support": 98.0,
        "resistance": 102.0,
    })

    assert analysis.horizontal_pressure > analysis.vertical_pressure
    assert analysis.topology == "figure_eight"
    assert len(analysis.coordinates) == 5


def test_balanced_pressure_uses_spiral_family():
    assert select_knot_topology(0.5, 0.5) == ("spiral", "Spiral Knot")
