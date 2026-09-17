from __future__ import annotations

from datetime import datetime
from typing import Iterable, Sequence


TACTIC_ORDER = ["sling_shot", "anchor", "trap", "arbitrage"]


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize(value: float, lower: float, upper: float) -> float:
    if upper == lower:
        return 0.0
    return max(0.0, min(1.0, (value - lower) / (upper - lower)))


def _phase_to_yao(phase_index: int) -> list[int]:
    if phase_index < 0:
        phase_index = 0
    bits = [(phase_index + offset * 7) % 2 for offset in range(6)]
    return [int(bit) for bit in bits]


def _derive_tactic_scores(start: datetime, dataset: Sequence[dict]) -> dict[str, float]:
    if not dataset:
        return {name: 0.0 for name in TACTIC_ORDER}

    weights = {name: 0.0 for name in TACTIC_ORDER}
    for index, tick in enumerate(dataset):
        base = float((start.timestamp() + index * 31) % 997) / 997.0
        close = _safe_float(tick.get("close"), 1.0)
        open_price = _safe_float(tick.get("open"), close)
        high = _safe_float(tick.get("high"), close)
        low = _safe_float(tick.get("low"), close)
        volume = _safe_float(tick.get("volume"), 0.0)
        volatility = max(0.0, (high - low) / max(close, 1e-6))

        weights["sling_shot"] += _normalize((close - open_price) / max(abs(open_price), 1.0), -0.04, 0.04) + base
        weights["anchor"] += 1.0 - _normalize(volatility, 0.0, 0.1) + 0.25 * _normalize(volume, 0, 1000)
        weights["trap"] += _normalize(volatility, 0.0, 0.12) + (1.0 - _normalize(volume, 0, 2000))
        weights["arbitrage"] += _normalize(abs(close - (sum(_safe_float(item.get("close"), close) for item in dataset[: min(index + 1, len(dataset))]) / max(len(dataset[: index + 1]), 1))), 0.0, 5.0)

    for name in TACTIC_ORDER:
        weights[name] = max(0.0, min(1.0, weights[name] / max(len(dataset), 1)))
    return weights


def simulate_tactics_384(start: datetime | str, dataset: Sequence[dict]) -> list[list[int]]:
    if isinstance(start, str):
        start = datetime.fromisoformat(start)

    scores = _derive_tactic_scores(start, dataset)
    normalized = [(scores.get(name, 0.0) + 0.2 * (index + 1)) for index, name in enumerate(TACTIC_ORDER)]
    total_signal = sum(normalized)

    board: list[list[int]] = []
    for block in range(64):
        phase_seed = int(((block + 1) * 13 + total_signal * 97 + int(start.timestamp()) % 383) % 384)
        trigger = sum(int((phase_seed + offset * 19) % 2) for offset in range(4))
        yaos = []
        for line in range(6):
            value = int((phase_seed + trigger + block * 11 + line * 7 + (line % 2 == 0)) % 2)
            if block % 8 == 0 and line == 0:
                value = 1
            if block % 9 == 0 and line == 5:
                value = 0
            yaos.append(value)
        board.append(yaos)

    return board


def build_yao_board_json(start: datetime | str, dataset: Sequence[dict]) -> dict:
    if isinstance(start, str):
        start = datetime.fromisoformat(start)

    board = simulate_tactics_384(start, dataset)
    return {
        "meta": {
            "rows": 8,
            "columns": 8,
            "yaos_per_hexagram": 6,
            "tactics": TACTIC_ORDER,
            "start": start.isoformat(),
        },
        "board": board,
    }


if __name__ == "__main__":
    sample_start = datetime(2024, 1, 1, 0, 0, 0)
    sample = [
        {"symbol": "AAPL", "open": 100.0, "high": 101.5, "low": 99.2, "close": 100.8, "volume": 1200},
        {"symbol": "MSFT", "open": 200.0, "high": 202.5, "low": 198.8, "close": 201.1, "volume": 990},
        {"symbol": "BTCUSD", "open": 45000.0, "high": 45850.0, "low": 44500.0, "close": 45280.0, "volume": 3400},
    ]
    print(build_yao_board_json(sample_start, sample))
