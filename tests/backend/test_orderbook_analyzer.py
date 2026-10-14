"""Tests for spoof-resistant order-book gravity tensors."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2]))

from orderbook_analyzer import OrderBookSpoofFilter, calculate_true_gravity_tensor


def test_short_lived_wall_is_exponentially_attenuated():
    tensor = calculate_true_gravity_tensor({
        "bids": [{"price": 99.0, "volume": 1_000.0, "lifespan_seconds": 0.05}],
        "asks": [{"price": 101.0, "volume": 100.0, "lifespan_seconds": 10.0}],
    })

    assert tensor["filtered_bid_volume"] < tensor["filtered_ask_volume"]
    assert tensor["net_force"] < 0


def test_persistent_tracker_builds_bid_gravity_and_tracks_cancellation():
    tracker = OrderBookSpoofFilter()
    first = {"bids": [{"price": 99.0, "volume": 500.0}], "asks": [{"price": 101.0, "volume": 100.0}]}
    tracker.calculate(first, now=0.0)
    tensor = tracker.calculate(first, now=12.0).to_dict()

    assert tensor["net_force"] > 0
    assert tensor["centers"][0]["side"] == "bid"

    tracker.calculate({"asks": [{"price": 101.0, "volume": 100.0}]}, now=13.0)
    reappeared = tracker.calculate(first, now=13.1).to_dict()
    bid = next(center for center in reappeared["centers"] if center["side"] == "bid")
    assert bid["cancellation_frequency"] > 0
