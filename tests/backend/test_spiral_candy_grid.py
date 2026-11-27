import math

from fastapi import FastAPI
from fastapi.testclient import TestClient

from spiral_candy_grid import (
    calculate_384_spiral_candies,
    generate_base_48_cells,
    router,
)


def test_base_cells_count_and_range():
    cells = generate_base_48_cells()
    assert len(cells) == 48
    assert all(0 <= t <= math.pi and 0 <= p < 2 * math.pi for t, p in cells)


def test_384_candies_and_log_linear_zoom():
    lo = calculate_384_spiral_candies(0.0)
    mid = calculate_384_spiral_candies(0.5)
    hi = calculate_384_spiral_candies(1.0)
    assert len(lo) == 384
    mean_log = [sum(math.log(c["r"]) for c in s) / 384 for s in (lo, mid, hi)]
    assert math.isclose(mean_log[1] - mean_log[0], mean_log[2] - mean_log[1], rel_tol=1e-9)
    assert mean_log[2] > mean_log[0]
    # opposite polarities mirror through the origin
    assert math.isclose(lo[0]["x"], -lo[1]["x"]) and lo[0]["polarity"] == "UP"


def test_endpoint():
    app = FastAPI()
    app.include_router(router)
    res = TestClient(app).get("/api/v1/oracle/spiral-grid", params={"scale_dial": 0.3})
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 384
    assert {"x", "y", "z", "tarot", "element"} <= body["candies"][0].keys()


def test_strict_assignment_and_physics():
    candies = calculate_384_spiral_candies(0.4)
    pairs = {
        (c["tarot_archetype"]["id"], c["tarot_archetype"]["aspect"])
        for c in candies
        if c["tarot_archetype"]
    }
    assert len(pairs) == 44
    suits = {c["element_singularity"]["suit"] for c in candies if c["element_singularity"]}
    assert suits == {"WANDS", "CUPS", "SWORDS", "PENTACLES"}
    assert sum(1 for c in candies if c["element_singularity"]) == 4 * 8
    for c in candies:
        assert (c["redshift"] < 0) == (c["polarity"] == "UP")
        assert -1.0 <= c["redshift"] <= 1.0
        assert 0.0 <= c["lensing_distortion"] <= 1.0
        assert len(c["pta_vector"]) == 3 and all(-1 <= v <= 1 for v in c["pta_vector"])


def test_time_to_target_and_risk_reward():
    candies = calculate_384_spiral_candies(0.4)
    for c in candies:
        assert math.isclose(c["axis_radial"], math.hypot(c["x"], c["y"]))
        assert c["time_to_target_hrs"] >= 1 / 60 - 1e-12
        assert 0.0 < c["gravity"]["time_factor"] <= 1.0
        assert 0.0 <= c["risk_reward_ratio"] <= 99.0
        assert c["direction"] == ("LONG" if c["z"] >= 0 else "SHORT")
    # Candies sitting on the Metal pole are the most accelerated.
    metal_top = min(candies, key=lambda c: c["gravity"]["distances"]["WANDS"])
    avg = sum(c["gravity"]["time_factor"] for c in candies) / len(candies)
    assert metal_top["gravity"]["time_factor"] < avg


def test_endpoint_radius_range_zooms_three_decades_and_clamps():
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    lo = client.get("/api/v1/oracle/spiral-grid", params={"scale_dial": 0.0}).json()
    hi = client.get("/api/v1/oracle/spiral-grid", params={"scale_dial": 1.0}).json()
    assert math.isclose(hi["log10_radius_min"] - lo["log10_radius_min"], 3.0, rel_tol=1e-9)
    assert math.isclose(hi["log10_radius_max"] - lo["log10_radius_max"], 3.0, rel_tol=1e-9)
    clamped = client.get("/api/v1/oracle/spiral-grid", params={"scale_dial": 5.0}).json()
    assert clamped["scale_dial"] == 1.0
