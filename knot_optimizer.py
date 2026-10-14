"""Tactical timing signals for tarot and I Ching package strategies."""

from __future__ import annotations

from itertools import combinations
from statistics import mean
from typing import Any


STRATEGY_PROFILES = (
    "THE_CHARIOT",
    "THE_HERMIT",
    "THE_HANGED_MAN",
    "TEMPERANCE",
)


def _number(item: dict[str, Any], key: str, default: float = 0.0) -> float:
    try:
        return float(item.get(key, default))
    except (TypeError, ValueError):
        return default


def _binary(item: dict[str, Any]) -> str:
    value = str(item.get("hexagram_binary") or item.get("hexagram") or "")
    return value if len(value) == 6 and set(value) <= {"0", "1"} else "000000"


def _chariot(items: list[dict[str, Any]]) -> dict[str, Any]:
    binaries = [_binary(item) for item in items]
    zeros = sum(binary.count("0") for binary in binaries)
    total_lines = max(1, len(binaries) * 6)
    yin_ratio = zeros / total_lines
    divergences = [abs(_number(item, "price_change") - _number(item, "volume_change")) for item in items]
    energy = mean(divergences) if divergences else 0.0
    return {"score": round(yin_ratio * (1.0 + energy), 6), "timing": "MAX_REPULSION" if yin_ratio >= 0.66 else "WAIT"}


def _hermit(items: list[dict[str, Any]]) -> dict[str, Any]:
    if len(items) < 2:
        return {"score": 0.0, "timing": "INSUFFICIENT_PAIRS", "pair": []}
    best: tuple[float, dict[str, Any], dict[str, Any]] | None = None
    for left, right in combinations(items, 2):
        left_volatility = _number(left, "volatility", 1.0)
        right_volatility = _number(right, "volatility", 1.0)
        beta = _number(left, "beta", 1.0) + _number(right, "beta", 1.0)
        neutrality = abs(beta) + abs(left_volatility - right_volatility) * 0.1
        candidate = (neutrality, left, right)
        if best is None or candidate[0] < best[0]:
            best = candidate
    assert best is not None
    return {"score": round(1.0 / (1.0 + best[0]), 6), "timing": "NEUTRAL_CENTER", "pair": [best[1].get("symbol"), best[2].get("symbol")]}


def _hanged_man(items: list[dict[str, Any]]) -> dict[str, Any]:
    divergence = max(
        (abs(_number(item, "price_change")) - abs(_number(item, "volume_change")) for item in items),
        default=0.0,
    )
    return {"score": round(max(0.0, divergence), 6), "timing": "COUNTER_TREND" if divergence > 0 else "WAIT"}


def _temperance(items: list[dict[str, Any]]) -> dict[str, Any]:
    best: tuple[float, dict[str, Any], dict[str, Any]] | None = None
    for left, right in combinations(items, 2):
        correlation = _number(left, "correlation", 0.0)
        spread = abs(_number(left, "price", 0.0) - _number(right, "price", 0.0))
        candidate = (correlation + spread * 0.001, left, right)
        if best is None or candidate[0] < best[0]:
            best = candidate
    if best is None:
        return {"score": 0.0, "timing": "INSUFFICIENT_PAIRS", "pair": []}
    return {"score": round(1.0 - abs(best[0]), 6), "timing": "MEAN_REVERSION", "pair": [best[1].get("symbol"), best[2].get("symbol")]}


def evaluate_strategy_profiles(symbols_data: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Evaluate all tactical profiles and return inspectable timing signals."""
    items = [item for item in symbols_data if str(item.get("symbol", "")).strip()]
    return {
        "THE_CHARIOT": _chariot(items),
        "THE_HERMIT": _hermit(items),
        "THE_HANGED_MAN": _hanged_man(items),
        "TEMPERANCE": _temperance(items),
    }

def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    avg = mean(values)
    return (sum((value - avg) ** 2 for value in values) / len(values)) ** 0.5


def calculate_knot_weather(closes: list[float], window: int = 20) -> dict[str, Any]:
    """Map a close-price series to knot crossings, tension stress and topology phase.

    Crossings count how often price weaves through its moving average (range-bound
    markets tangle the most). Tension combines return volatility with drawdown from
    the recent peak, scaled to 0-100.
    """
    series = [float(value) for value in closes if value is not None and value == value]
    if len(series) < 3:
        return {"knot_crossing": 0, "tension_stress": 0.0, "topology_phase": "Unknot"}
    window = max(2, min(window, len(series)))

    crossings = 0
    previous_side = 0
    for index in range(window - 1, len(series)):
        base = mean(series[index - window + 1:index + 1])
        side = (series[index] > base) - (series[index] < base)
        if side and previous_side and side != previous_side:
            crossings += 1
        if side:
            previous_side = side

    returns = [
        (series[i] - series[i - 1]) / series[i - 1]
        for i in range(1, len(series)) if series[i - 1] != 0
    ]
    peak = max(series)
    drawdown = (peak - series[-1]) / peak if peak > 0 else 0.0
    volatility = _std(returns)
    tension = min(100.0, max(0.0, volatility * 10000.0 * 0.5 + drawdown * 100.0 * 4.0))

    if tension >= 70.0 or crossings >= 8:
        phase = "Chaotic_Tangle"
    elif crossings >= 3:
        phase = "Trefoil"
    else:
        phase = "Unknot"
    return {"knot_crossing": crossings, "tension_stress": round(tension, 2), "topology_phase": phase}
