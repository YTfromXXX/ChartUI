from __future__ import annotations

import importlib
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

module = importlib.import_module("tactics_384")
simulate_tactics_384 = module.simulate_tactics_384
build_yao_board_json = module.build_yao_board_json


def test_simulated_tactics_builds_64_by_6_yao_matrix():
    start = datetime(2024, 1, 1, 0, 0, 0)
    dataset = [
        {"symbol": "AAPL", "open": 100.0, "high": 101.0, "low": 99.5, "close": 100.8, "volume": 1200},
        {"symbol": "MSFT", "open": 200.0, "high": 201.6, "low": 199.0, "close": 200.7, "volume": 900},
        {"symbol": "XAUUSD", "open": 1860.0, "high": 1868.0, "low": 1858.0, "close": 1864.5, "volume": 760},
    ]

    board = simulate_tactics_384(start, dataset)

    assert len(board) == 64
    assert all(len(hexagram) == 6 for hexagram in board)
    assert any(value == 1 for hexagram in board for value in hexagram)
    assert any(value == 0 for hexagram in board for value in hexagram)


def test_json_output_matches_ui_contract():
    start = datetime(2024, 1, 1, 0, 0, 0)
    dataset = [
        {"symbol": "BTCUSD", "open": 45000.0, "high": 45600.0, "low": 44600.0, "close": 45250.0, "volume": 3000},
        {"symbol": "ETHUSD", "open": 2400.0, "high": 2450.0, "low": 2388.0, "close": 2436.0, "volume": 2100},
    ]

    payload = build_yao_board_json(start, dataset)
    assert payload["meta"]["rows"] == 8
    assert payload["meta"]["columns"] == 8
    assert payload["meta"]["yaos_per_hexagram"] == 6
    assert isinstance(payload["board"], list)
    assert len(payload["board"]) == 64
    assert all(len(hexagram) == 6 for hexagram in payload["board"])
    json.dumps(payload)
