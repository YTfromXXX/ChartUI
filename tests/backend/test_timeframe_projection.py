"""Tests for timeframe-rescaled live projection payloads."""

from main import TIMEFRAME_ANALYSIS, _timeframe_projection_payload


def test_timeframe_projection_rescales_gravity_and_spiral_geometry():
    payload = {
        "true_gravity_tensor": {
            "magnitude": 1.0,
            "net_force": 0.5,
            "gradient": {"x": 0.25, "y": -0.5},
            "centers": [{"side": "bid", "strength": 2.0, "normalized_position": 0.5}],
        },
        "spiral_cube": {
            "coordinates": [{"x": 0.8, "y": 0.2, "z": 0.6}],
        },
    }

    minute = _timeframe_projection_payload(payload, "1m")
    daily = _timeframe_projection_payload(payload, "1D")

    assert minute["analysis_timeframe"] == "1m"
    assert daily["gravity_span"] == TIMEFRAME_ANALYSIS["1D"]["gravity_span"]
    assert daily["true_gravity_tensor"]["magnitude"] > minute["true_gravity_tensor"]["magnitude"]
    assert daily["spiral_cube"]["coordinates"][0]["x"] > minute["spiral_cube"]["coordinates"][0]["x"]


def test_timeframe_projection_defaults_to_fifteen_minutes():
    result = _timeframe_projection_payload({}, "unsupported")

    assert result["analysis_timeframe"] == "15m"
    assert result["gravity_span"] == TIMEFRAME_ANALYSIS["15m"]["gravity_span"]
