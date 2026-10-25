from __future__ import annotations

import importlib
from datetime import datetime


module = importlib.import_module("tarot_engine")
analyze_4d_timeline = module.analyze_4d_timeline


def test_analyze_4d_timeline_returns_four_layers_and_convergence():
    result = analyze_4d_timeline("BTCUSD", datetime(2024, 1, 1, 12, 0, 0))

    assert set(result) >= {"symbol", "target_time", "layers", "distortions", "convergence"}
    assert set(result["layers"]) == {"T-40m", "T-4h", "T-target", "T-best"}
    assert all("hexagram_symbol" in layer and "hexagram_decimal" in layer for layer in result["layers"].values())
    assert all("volatility" in layer for layer in result["layers"].values())
    assert set(result["distortions"]) == {"T-40m", "T-4h", "T-best"}
    assert all(set(delta) == {"volatility_delta", "hexagram_delta", "distance"} for delta in result["distortions"].values())
    assert result["convergence"]["direction"] in {"EXPANDING", "CONTRACTING", "BALANCED"}
