"""Spiral Cube pressure analysis for knot-chart projections.

The analyzer is deliberately provider-agnostic: callers can pass scalar values or a
short price/volume history and receive normalized pressure plus a forecast path.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from math import cos, pi, sin
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class SpiralCubePoint:
    """A normalized point inside the volatility cube."""

    x: float
    y: float
    z: float


@dataclass(frozen=True)
class SpiralCubeAnalysis:
    """Pressure readings, selected knot topology, and future cube coordinates."""

    vertical_pressure: float
    horizontal_pressure: float
    topology: str
    topology_label: str
    coordinates: tuple[SpiralCubePoint, ...]
    support: float
    resistance: float

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible representation for API payloads."""
        result = asdict(self)
        result["coordinates"] = [asdict(point) for point in self.coordinates]
        return result


def _finite(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number == number and abs(number) != float("inf") else default


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def _history_values(data: Mapping[str, Any], key: str) -> list[float]:
    values = data.get(key, ())
    if isinstance(values, Sequence) and not isinstance(values, (str, bytes)):
        return [_finite(value) for value in values]
    return []


def select_knot_topology(vertical_pressure: float, horizontal_pressure: float) -> tuple[str, str]:
    """Select a visual knot family from the balance of the two pressures."""
    vertical = _clamp(vertical_pressure)
    horizontal = _clamp(horizontal_pressure)
    if vertical >= horizontal * 1.18 and vertical >= 0.55:
        return "trefoil", "Trefoil Knot"
    if horizontal >= vertical * 1.18 and horizontal >= 0.55:
        return "figure_eight", "Figure-eight Knot"
    return "spiral", "Spiral Knot"


def _pressure_features(data: Mapping[str, Any]) -> tuple[float, float, float, float, float, float]:
    prices = _history_values(data, "prices")
    volumes = _history_values(data, "volumes")
    current = _finite(data.get("current_price"), prices[-1] if prices else 0.0)
    previous = _finite(data.get("previous_price"), prices[-2] if len(prices) > 1 else current)
    price_change = abs(current - previous) / max(abs(previous), 1e-12)
    volatility = _clamp(_finite(data.get("volatility"), 0.0))
    delta = abs(_finite(data.get("s15_delta"), current - previous))
    delta_scale = max(_finite(data.get("delta_scale"), abs(current) * 0.002), 1e-12)
    momentum = _clamp(_finite(data.get("momentum"), price_change / max(volatility, 0.01) * 0.35))
    delta_strength = _clamp(delta / delta_scale)
    shock = _clamp(price_change / max(_finite(data.get("shock_scale"), 0.003), 1e-12))

    dwell = _clamp(_finite(data.get("dwell_time"), 0.0) / max(_finite(data.get("dwell_scale"), 12.0), 1e-12))
    if prices:
        band = max(abs(max(prices) - min(prices)), 1e-12)
        dwell = max(dwell, sum(abs(price - current) <= band * 0.12 for price in prices[-24:]) / min(24, len(prices)))
    if volumes:
        average_volume = sum(volumes[-24:]) / min(24, len(volumes))
        volume_mass = _clamp(sum(volumes[-8:]) / max(average_volume * 8.0, 1e-12))
    else:
        volume_mass = _clamp(_finite(data.get("accumulated_volume"), 0.0) / max(_finite(data.get("volume_scale"), 1.0), 1e-12))
    support_thickness = _clamp(_finite(data.get("support_thickness"), 0.0))
    return shock, delta_strength, momentum, dwell, volume_mass, support_thickness


def analyze_spiral_cube(data: Mapping[str, Any], steps: int = 5) -> SpiralCubeAnalysis:
    """Calculate pressures and forecast a bounded 3D spiral toward cube walls.

    ``vertical_pressure`` combines price shock, S15 delta, and momentum. Horizontal
    pressure combines dwell time, accumulated volume, and support-layer thickness.
    All pressure values and coordinates are normalized to make the result portable
    across symbols and chart scales.
    """
    if steps < 1:
        raise ValueError("steps must be at least 1")

    prices = _history_values(data, "prices")
    current = _finite(data.get("current_price"), prices[-1] if prices else 0.0)
    fallback_low = min(prices) if prices else current - 1.0
    fallback_high = max(prices) if prices else current + 1.0
    support = _finite(data.get("support"), fallback_low)
    resistance = _finite(data.get("resistance"), fallback_high)
    if resistance <= support:
        center = (support + resistance) / 2.0
        radius = max(abs(center) * 0.001, 1.0)
        support, resistance = center - radius, center + radius

    shock, delta_strength, momentum, dwell, volume_mass, support_thickness = _pressure_features(data)
    vertical = _clamp(0.42 * shock + 0.33 * delta_strength + 0.25 * momentum)
    horizontal = _clamp(0.38 * dwell + 0.34 * volume_mass + 0.28 * support_thickness)
    topology, topology_label = select_knot_topology(vertical, horizontal)

    span = resistance - support
    normalized_price = _clamp((current - support) / span, 0.0, 1.0)
    direction = 1.0 if _finite(data.get("price_change"), current - _finite(data.get("previous_price"), current)) >= 0 else -1.0
    wall = 1.0 if direction > 0 else 0.0
    radial = max(0.035, (vertical * 0.68 + horizontal * 0.32) / max(steps, 1))
    angle_offset = _finite(data.get("angle"), 0.0)
    coordinates: list[SpiralCubePoint] = []
    for step in range(1, steps + 1):
        progress = step / steps
        y = _clamp(normalized_price + (wall - normalized_price) * progress * (0.72 + vertical * 0.28))
        angle = angle_offset + progress * (pi * (1.15 + horizontal * 0.65))
        radius = radial * (1.0 - progress * 0.35)
        x = _clamp(0.5 + cos(angle) * radius * (1.0 + horizontal * 0.8))
        z = _clamp(0.5 + sin(angle) * radius * (1.0 + vertical * 0.8))
        coordinates.append(SpiralCubePoint(round(x, 6), round(y, 6), round(z, 6)))

    return SpiralCubeAnalysis(
        vertical_pressure=round(vertical, 6),
        horizontal_pressure=round(horizontal, 6),
        topology=topology,
        topology_label=topology_label,
        coordinates=tuple(coordinates),
        support=round(support, 6),
        resistance=round(resistance, 6),
    )
