"""Order-book persistence filtering for liquidity-driven rendering."""

from __future__ import annotations

from dataclasses import dataclass, field
from math import exp, isfinite
from time import monotonic
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class GravityCenter:
    """A price wall that remains after spoofing attenuation."""

    side: str
    price: float
    strength: float
    normalized_position: float
    lifespan_seconds: float
    cancellation_frequency: float

    def to_dict(self) -> dict[str, float | str]:
        return {
            "side": self.side,
            "price": round(self.price, 8),
            "strength": round(self.strength, 8),
            "normalized_position": round(self.normalized_position, 6),
            "lifespan_seconds": round(self.lifespan_seconds, 4),
            "cancellation_frequency": round(self.cancellation_frequency, 6),
        }


@dataclass(frozen=True)
class TrueGravityTensor:
    """JSON-safe tensor contract consumed by the honeycomb renderer."""

    net_force: float
    magnitude: float
    gradient_x: float
    gradient_y: float
    centers: tuple[GravityCenter, ...]
    filtered_bid_volume: float
    filtered_ask_volume: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "net_force": round(self.net_force, 8),
            "magnitude": round(self.magnitude, 8),
            "gradient": {"x": round(self.gradient_x, 8), "y": round(self.gradient_y, 8)},
            "centers": [center.to_dict() for center in self.centers],
            "filtered_bid_volume": round(self.filtered_bid_volume, 8),
            "filtered_ask_volume": round(self.filtered_ask_volume, 8),
        }


@dataclass
class _TrackedOrder:
    first_seen: float
    last_seen: float
    volume: float
    cancellations: int = 0


@dataclass
class OrderBookSpoofFilter:
    """Tracks price-level survival so transient walls lose gravitational mass."""

    half_life_seconds: float = 3.0
    cancellation_window_seconds: float = 15.0
    _orders: dict[tuple[str, float], _TrackedOrder] = field(default_factory=dict)

    def calculate(self, order_book: Mapping[str, Any] | None, now: float | None = None) -> TrueGravityTensor:
        timestamp = monotonic() if now is None else float(now)
        levels = _normalize_levels(order_book)
        seen: set[tuple[str, float]] = set()
        weighted: list[tuple[str, float, float, float, float]] = []

        for side, price, volume in levels:
            key = (side, price)
            seen.add(key)
            tracked = self._orders.get(key)
            if tracked is None:
                tracked = _TrackedOrder(first_seen=timestamp, last_seen=timestamp, volume=volume)
                self._orders[key] = tracked
            else:
                tracked.last_seen = timestamp
                tracked.volume = volume

            lifespan = max(0.0, timestamp - tracked.first_seen)
            cancellation_frequency = tracked.cancellations / max(self.cancellation_window_seconds, lifespan, 1.0)
            survival_weight = 1.0 - exp(-lifespan / max(self.half_life_seconds, 0.001))
            cancellation_weight = exp(-cancellation_frequency * self.cancellation_window_seconds)
            weighted.append((side, price, volume * survival_weight * cancellation_weight, lifespan, cancellation_frequency))

        for key, tracked in tuple(self._orders.items()):
            if key not in seen:
                tracked.cancellations += 1
                # Keep cancellation history so a promptly reappearing wall is
                # penalized instead of being treated as fresh liquidity.
                if timestamp - tracked.last_seen > self.cancellation_window_seconds * 4:
                    self._orders.pop(key)

        return _build_tensor(weighted)


def calculate_true_gravity_tensor(
    order_book: Mapping[str, Any] | None,
    *,
    tracker: OrderBookSpoofFilter | None = None,
    now: float | None = None,
) -> dict[str, Any]:
    """Attenuate short-lived/cancelled walls and return the true-liquidity tensor.

    Supplying a persistent ``tracker`` across snapshots enables lifespan and
    cancellation measurement. A stateless call still accepts explicit
    ``lifespan_seconds`` and ``cancellation_frequency`` on individual levels.
    """
    if tracker is not None:
        return tracker.calculate(order_book, now=now).to_dict()
    return _build_tensor(_weighted_explicit_levels(order_book)).to_dict()


def _normalize_levels(order_book: Mapping[str, Any] | None) -> list[tuple[str, float, float]]:
    if not isinstance(order_book, Mapping):
        return []
    levels: list[tuple[str, float, float]] = []
    for side, key in (("bid", "bids"), ("ask", "asks")):
        raw_levels = order_book.get(key, [])
        if not isinstance(raw_levels, Iterable) or isinstance(raw_levels, (str, bytes, Mapping)):
            continue
        for raw in raw_levels:
            if not isinstance(raw, Mapping):
                continue
            price, volume = _number(raw.get("price")), _number(raw.get("volume"))
            if price is not None and volume is not None and volume > 0:
                levels.append((side, price, volume))
    return levels


def _weighted_explicit_levels(order_book: Mapping[str, Any] | None) -> list[tuple[str, float, float, float, float]]:
    if not isinstance(order_book, Mapping):
        return []
    weighted: list[tuple[str, float, float, float, float]] = []
    for side, key in (("bid", "bids"), ("ask", "asks")):
        raw_levels = order_book.get(key, [])
        if not isinstance(raw_levels, Iterable) or isinstance(raw_levels, (str, bytes, Mapping)):
            continue
        for raw in raw_levels:
            if not isinstance(raw, Mapping):
                continue
            price, volume = _number(raw.get("price")), _number(raw.get("volume"))
            lifespan = max(0.0, _number(raw.get("lifespan_seconds")) or 0.0)
            cancellation_frequency = max(0.0, _number(raw.get("cancellation_frequency")) or 0.0)
            if price is None or volume is None or volume <= 0:
                continue
            survival_weight = 1.0 - exp(-lifespan / 3.0)
            cancellation_weight = exp(-cancellation_frequency * 15.0)
            weighted.append((side, price, volume * survival_weight * cancellation_weight, lifespan, cancellation_frequency))
    return weighted


def _build_tensor(weighted: list[tuple[str, float, float, float, float]]) -> TrueGravityTensor:
    total_bid = sum(volume for side, _, volume, _, _ in weighted if side == "bid")
    total_ask = sum(volume for side, _, volume, _, _ in weighted if side == "ask")
    total = total_bid + total_ask
    net_force = (total_bid - total_ask) / total if total else 0.0
    prices = [price for _, price, volume, _, _ in weighted if volume > 0]
    low, high = (min(prices), max(prices)) if prices else (0.0, 1.0)
    spread = max(high - low, 1e-9)
    centers = tuple(
        GravityCenter(
            side=side,
            price=price,
            strength=volume / total if total else 0.0,
            normalized_position=(price - low) / spread,
            lifespan_seconds=lifespan,
            cancellation_frequency=frequency,
        )
        for side, price, volume, lifespan, frequency in sorted(weighted, key=lambda item: item[2], reverse=True)[:6]
        if volume > 0
    )
    gradient_x = sum((center.normalized_position - 0.5) * center.strength for center in centers)
    gradient_y = -net_force
    return TrueGravityTensor(
        net_force=net_force,
        magnitude=min(1.0, sum(center.strength for center in centers)),
        gradient_x=gradient_x,
        gradient_y=gradient_y,
        centers=centers,
        filtered_bid_volume=total_bid,
        filtered_ask_volume=total_ask,
    )


def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if isfinite(result) else None
