"""Deterministic chaos-data generators for the geometry / physics stress tests.

Every generator takes a `seed` and returns plain Python data (no numpy) so the
same streams can be mirrored by `lib/stressTestStream.ts` for the frontend.
"""

from __future__ import annotations

import math
import random
from typing import Sequence

Segment = tuple[tuple[float, float], tuple[float, float]]

PRESETS = {
    "usd_flash_crash": {"base": 1.0, "crash": -0.12},
    "gbp_black_wednesday": {"base": 1.0, "crash": -0.06},
    "chf_peg_break": {"base": 1.0, "crash": -0.30},
}


def knot_overload_ticks(count: int = 2048, seed: int = 7, amplitude: float = 0.04) -> list[dict[str, float | bool]]:
    """High-frequency whipsaw ticks: each step flips direction with a random
    magnitude, so the knot chart's crossing count keeps growing."""

    rng = random.Random(seed)
    price = 100.0
    ticks: list[dict[str, float | bool]] = []
    direction = 1.0
    for i in range(count):
        direction = -direction if rng.random() < 0.85 else direction
        step = direction * amplitude * price * rng.uniform(0.2, 1.0)
        previous = price
        price = max(0.01, price + step)
        move = abs(price - previous) / previous
        ticks.append(
            {
                "timestamp": float(i),
                "price": price,
                "volatility": min(1.0, move * 25.0),
                "angle": rng.uniform(-math.pi, math.pi),
                "magicLength": rng.uniform(0.2, 4.0),
                "tension": min(1.0, 0.3 + move * 20.0),
                "jump": move > amplitude * 0.8,
            }
        )
    return ticks


def knot_overload_segments(count: int = 64, seed: int = 11, extent: float = 100.0) -> list[Segment]:
    """Dense random segment soup guaranteeing O(count^2) crossings in a small box."""

    rng = random.Random(seed)
    segments: list[Segment] = []
    for _ in range(count):
        cx, cy = rng.uniform(0, extent), rng.uniform(0, extent)
        angle = rng.uniform(0, math.pi)
        half = rng.uniform(extent * 0.3, extent * 0.6)
        dx, dy = math.cos(angle) * half, math.sin(angle) * half
        segments.append(((cx - dx, cy - dy), (cx + dx, cy + dy)))
    return segments


def sdf_breakthrough_flows(
    steps: int = 240,
    assets: int = 4,
    seed: int = 3,
    spike: float = 5000.0,
    spike_at: int = 120,
    preset: str = "usd_flash_crash",
) -> list[list[float]]:
    """Signed fund-flow vectors per step. Calm noise, then a `spike`-times jump
    in mass (flash crash) on `spike_at`, then an exponential aftershock decay."""

    rng = random.Random(seed)
    crash = PRESETS[preset]["crash"]
    frames: list[list[float]] = []
    for step in range(steps):
        scale = 1.0
        if step >= spike_at:
            scale = 1.0 + (spike - 1.0) * math.exp(-(step - spike_at) / 18.0)
        frame = [rng.uniform(-1.0, 1.0) * scale for _ in range(assets)]
        if step >= spike_at:
            frame[0] = -abs(frame[0]) * (1.0 - crash * 10.0)
        frames.append(frame)
    return frames


def sdf_breakthrough_jets(flows: Sequence[Sequence[float]], seed: int = 5) -> list[list[tuple[float, float, float, float]]]:
    """Maps flow frames to (x, y, z, gamma) jets with fixed unit axes."""

    rng = random.Random(seed)
    axes = []
    for _ in range(len(flows[0])):
        z = rng.uniform(-1, 1)
        a = rng.uniform(0, 2 * math.pi)
        r = math.sqrt(1 - z * z)
        axes.append((r * math.cos(a), z, r * math.sin(a)))
    return [[(*axes[i], flow[i]) for i in range(len(flow))] for flow in flows]


def long_term_spiral_prices(years: int = 40, per_year: int = 252, seed: int = 13, drift: float = 0.09) -> list[float]:
    """Decades of directional drift with regime shocks; the log-scale (spiral
    cube radius) grows without bound."""

    rng = random.Random(seed)
    price = 1.0
    prices = [price]
    daily_drift = drift / per_year
    for day in range(years * per_year):
        shock = rng.gauss(0.0, 0.01)
        if rng.random() < 1.0 / (per_year * 5):
            shock += rng.choice((-1, 1)) * rng.uniform(0.05, 0.2)
        price *= math.exp(daily_drift + shock)
        prices.append(price)
    return prices


def spiral_scale_series(prices: Sequence[float]) -> list[float]:
    """Spiral-cube scale: monotonically non-decreasing running log range."""

    scales: list[float] = []
    low = high = prices[0]
    for price in prices:
        low, high = min(low, price), max(high, price)
        scales.append(math.log(high / low) if low > 0 else 0.0)
    return scales
