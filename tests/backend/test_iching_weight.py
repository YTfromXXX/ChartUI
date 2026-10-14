"""Tests for candle-derived I Ching market weights."""

import pandas as pd

from tarot_engine import calculate_iching_weight


def test_iching_weight_encodes_six_candle_directions():
    frame = pd.DataFrame({
        "open": [10, 10, 10, 10, 10, 10],
        "close": [11, 9, 11, 9, 11, 9],
    })

    result = calculate_iching_weight(frame, "FIRE")

    assert result["hexagram_binary"] == "101010"
    assert result["hexagram_decimal"] == 42
    assert 0.5 <= result["volatility_weight"] <= 2.0
