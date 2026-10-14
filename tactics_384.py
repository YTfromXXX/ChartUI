from __future__ import annotations

from datetime import datetime
from math import cos, exp, isfinite, pi, sin, sqrt, tanh
from typing import Any, Iterable, Sequence

import numpy as np

from tarot_engine import KNOT_MATRIX


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


# ---------------------------------------------------------------------------
# 384 "candy" control points — a 48-cell spherical Fibonacci lattice wraps the
# current-price sphere; four timeline-layer spirals (surge / continuation /
# range / plunge — the same four trajectories used by
# tarot_engine.calculate_square_arcs) thread through the gravitational shell of
# every cell twice (the cell's own pole and its antipodal pole), yielding
# exactly 48 * 4 * 2 = 384 control points ("candies").
# ---------------------------------------------------------------------------

CANDY_CELL_COUNT = 48
CANDY_TIMELINE_LAYERS: tuple[tuple[str, float, float], ...] = (
    ("surge", 1.85, 1.35),
    ("continuation", 1.0, 0.95),
    ("range", 0.0, 0.58),
    ("plunge", -1.85, 1.35),
)
CANDY_POLES = ("upper", "lower")
CANDY_TOTAL_POINTS = CANDY_CELL_COUNT * len(CANDY_TIMELINE_LAYERS) * len(CANDY_POLES)  # 384

_GOLDEN_ANGLE = pi * (3.0 - sqrt(5.0))
_SPIRAL_SAMPLES = 720
_KNOT_IDS = sorted(KNOT_MATRIX.keys())


def spherical_fibonacci_lattice(count: int = CANDY_CELL_COUNT) -> list[tuple[float, float, float]]:
    """Evenly distribute ``count`` cell directions on the unit sphere.

    Uses the golden-angle spherical Fibonacci construction, a cheap and
    near-optimal way to place the 48 I-Ching cells over the current-price
    sphere without needing a bespoke subdivided polyhedron mesh.
    """
    if count <= 0:
        raise ValueError("count must be positive")
    cells: list[tuple[float, float, float]] = []
    for index in range(count):
        z = 1.0 - 2.0 * (index + 0.5) / count
        radius_xy = sqrt(max(0.0, 1.0 - z * z))
        theta = _GOLDEN_ANGLE * index
        cells.append((radius_xy * cos(theta), radius_xy * sin(theta), z))
    return cells


def _timeline_spiral_samples(
    slope: float,
    range_factor: float,
    phase: float,
    turns: float,
    samples: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Densely sample one of the four timeline-layer spirals.

    ``slope``/``range_factor`` mirror the trajectories used by
    ``tarot_engine.calculate_square_arcs``: a steep slope drifts the helix
    toward the bull (+z) or bear (-z) pole as the horizon ``t`` (0 = now,
    1 = furthest projected candle) advances, while ``range_factor`` controls
    how far the coil expands outward — wide for surge/plunge, tight for range.
    """
    t = np.linspace(0.0, 1.0, samples)
    drift = tanh(slope)
    z = drift * t
    radius_xy = np.sqrt(np.clip(1.0 - z * z, 0.0, None))
    phi = phase + 2.0 * pi * turns * t
    unit_direction = np.stack([radius_xy * np.cos(phi), radius_xy * np.sin(phi), z], axis=1)
    growth = 1.0 + range_factor * 0.55 * t
    world = unit_direction * growth[:, None]
    return t, world


def _refine_contact(t_samples: np.ndarray, world_samples: np.ndarray, target: np.ndarray) -> float:
    """Closest-approach parameter ``t*`` for ``target``, with a parabolic
    sub-sample refinement around the nearest coarse sample."""
    distances = np.linalg.norm(world_samples - target[None, :], axis=1)
    index = int(np.argmin(distances))
    t_star = float(t_samples[index])
    if 0 < index < len(t_samples) - 1:
        d0, d1, d2 = float(distances[index - 1]), float(distances[index]), float(distances[index + 1])
        denom = d0 - 2.0 * d1 + d2
        if abs(denom) > 1e-12:
            offset = max(-1.0, min(1.0, 0.5 * (d0 - d2) / denom))
            step = float(t_samples[index + 1] - t_samples[index])
            t_star = t_star + offset * step
    return max(0.0, min(1.0, t_star))


def _dataset_signal(dataset: Sequence[dict] | None) -> tuple[float, float]:
    """Bounded (momentum, volatility) summary in [-1, 1] / [0, 1] extracted
    from a raw OHLCV dataset, used to bias each layer's base probability."""
    if not dataset:
        return 0.0, 0.2

    closes = [_safe_float(tick.get("close"), 0.0) for tick in dataset]
    opens = [_safe_float(tick.get("open"), close) for tick, close in zip(dataset, closes)]
    highs = [_safe_float(tick.get("high"), close) for tick, close in zip(dataset, closes)]
    lows = [_safe_float(tick.get("low"), close) for tick, close in zip(dataset, closes)]

    first_open = opens[0] if opens[0] else 1.0
    momentum = tanh((closes[-1] - first_open) / max(abs(first_open), 1e-6) * 8.0)

    ranges = [(high - low) / max(close, 1e-6) for high, low, close in zip(highs, lows, closes)]
    volatility = max(0.0, min(1.0, (sum(ranges) / max(len(ranges), 1)) * 6.0))
    return momentum, volatility


def _layer_base_probability(layer_name: str, momentum: float, volatility: float) -> float:
    """Deterministic base confidence per timeline layer before geometric
    proximity and tarot weighting are applied."""
    if layer_name == "surge":
        base = 0.30 + 0.40 * max(momentum, 0.0) + 0.25 * volatility
    elif layer_name == "plunge":
        base = 0.30 + 0.40 * max(-momentum, 0.0) + 0.25 * volatility
    elif layer_name == "continuation":
        base = 0.35 + 0.30 * abs(momentum) + 0.10 * (1.0 - volatility)
    else:  # "range"
        base = 0.35 + 0.35 * (1.0 - volatility) + 0.10 * (1.0 - abs(momentum))
    return max(0.0, min(1.0, base))


def calculate_true_gravity_candy_points(
    current_price: float,
    radius: float,
    dataset: Sequence[dict] | None = None,
    turns: float = 3.0,
) -> dict[str, Any]:
    """Extract 384 "candy" control points from the 48-cell gravitational
    lattice wrapped by the four timeline spirals.

    For every one of the 48 spherical-Fibonacci cells and every one of the
    four timeline layers, the spiral's closest approach to the cell's own
    pole ("upper") and to its antipodal pole ("lower") is located, producing
    the tangent contact point and its outward surface normal. Each contact is
    scored with a prediction probability, a bullish/bearish/neutral direction
    label, and one of the 22 Major Arcana attributes (borrowed from
    ``tarot_engine.KNOT_MATRIX``), yielding exactly
    ``CANDY_TOTAL_POINTS`` (48 * 4 * 2 = 384) JSON-ready points.
    """
    price = float(current_price)
    r = float(radius)
    if not isfinite(price) or price <= 0:
        raise ValueError("current_price must be a positive finite value")
    if not isfinite(r) or r <= 0:
        raise ValueError("radius must be a positive finite value")
    if not isfinite(turns) or turns <= 0:
        raise ValueError("turns must be a positive finite value")

    momentum, volatility = _dataset_signal(dataset)
    cells = spherical_fibonacci_lattice(CANDY_CELL_COUNT)

    candies: list[dict[str, Any]] = []
    for layer_index, (layer_name, slope, range_factor) in enumerate(CANDY_TIMELINE_LAYERS):
        phase = layer_index * (pi / 2.0)
        t_samples, world_samples = _timeline_spiral_samples(slope, range_factor, phase, turns, _SPIRAL_SAMPLES)
        layer_base_probability = _layer_base_probability(layer_name, momentum, volatility)
        drift = tanh(slope)

        for cell_index, cell_direction in enumerate(cells):
            cell_array = np.array(cell_direction)
            for pole in CANDY_POLES:
                target = cell_array if pole == "upper" else -cell_array
                t_star = _refine_contact(t_samples, world_samples, target)

                z_star = drift * t_star
                radius_xy_star = sqrt(max(0.0, 1.0 - z_star * z_star))
                phi_star = phase + 2.0 * pi * turns * t_star
                normal = (radius_xy_star * cos(phi_star), radius_xy_star * sin(phi_star), z_star)
                growth_star = 1.0 + range_factor * 0.55 * t_star
                contact = tuple(component * growth_star for component in normal)

                approach_distance = sqrt(sum((c - g) ** 2 for c, g in zip(contact, target)))
                proximity = exp(-((approach_distance / 0.42) ** 2))
                probability = layer_base_probability * (0.35 + 0.65 * proximity)

                arcana_id = _KNOT_IDS[(cell_index * 4 + layer_index * 2 + (0 if pole == "upper" else 1)) % len(_KNOT_IDS)]
                arcana = KNOT_MATRIX[arcana_id]
                probability = max(0.0, min(1.0, probability * (0.85 + 0.30 * float(arcana["variance_multiplier"]))))

                direction_field = normal[2] + float(arcana["directional_bias"]) * 0.15
                if direction_field > 0.06:
                    direction_label = "bullish"
                elif direction_field < -0.06:
                    direction_label = "bearish"
                else:
                    direction_label = "neutral"

                # World position: x/z are the spiral's azimuthal spread around
                # the price sphere, y is the vertical price axis (normal[2] /
                # contact[2] carries the pole drift, matching the y=price
                # convention already used by tarot_engine.calculate_square_arcs).
                position = {
                    "x": round(contact[0] * r, 6),
                    "y": round(price + contact[2] * r, 6),
                    "z": round(contact[1] * r, 6),
                }
                normal_vector = {
                    "x": round(normal[0], 6),
                    "y": round(normal[2], 6),
                    "z": round(normal[1], 6),
                }

                candies.append({
                    "id": f"candy-{layer_name}-{cell_index:02d}-{pole}",
                    "cell_index": cell_index,
                    "layer": layer_name,
                    "pole": pole,
                    "t": round(t_star, 6),
                    "position": position,
                    "normal": normal_vector,
                    "contact_distance": round(approach_distance, 6),
                    "probability": round(probability, 6),
                    "direction": direction_label,
                    "tarot": {
                        "id": arcana_id,
                        "name": arcana["name"],
                        "variance_multiplier": arcana["variance_multiplier"],
                        "directional_bias": arcana["directional_bias"],
                    },
                })

    return {
        "meta": {
            "cell_count": CANDY_CELL_COUNT,
            "layers": [name for name, _, _ in CANDY_TIMELINE_LAYERS],
            "poles": list(CANDY_POLES),
            "total_points": CANDY_TOTAL_POINTS,
            "current_price": price,
            "radius": r,
            "turns": turns,
            "momentum": round(momentum, 6),
            "volatility": round(volatility, 6),
        },
        "candies": candies,
    }


if __name__ == "__main__":
    sample_start = datetime(2024, 1, 1, 0, 0, 0)
    sample = [
        {"symbol": "AAPL", "open": 100.0, "high": 101.5, "low": 99.2, "close": 100.8, "volume": 1200},
        {"symbol": "MSFT", "open": 200.0, "high": 202.5, "low": 198.8, "close": 201.1, "volume": 990},
        {"symbol": "BTCUSD", "open": 45000.0, "high": 45850.0, "low": 44500.0, "close": 45280.0, "volume": 3400},
    ]
    print(build_yao_board_json(sample_start, sample))
