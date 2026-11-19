"""QPU pool scoring for qpu/select.

Each backend in the pool is scored on four axes and the highest scorer wins.

Score formula (0–100 per axis, equal weight):
    queue_score    = 100 * (1 - queue_len / MAX_QUEUE)
    accuracy_score = 100 * (1 - avg_gate_error / MAX_ERR)
    latency_score  = 100 * (1 - latency_ms / MAX_LAT)
    shots_score    = 100 * min(available_shots / WANT_SHOTS, 1)

Custom weights can override defaults via the `weights` argument.
"""

from __future__ import annotations

MAX_QUEUE = 100
MAX_ERR   = 0.05   # 5% gate error ceiling
MAX_LAT   = 5000   # 5 s ceiling
WANT_SHOTS = 2000


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_backend(backend: dict, weights: dict | None = None) -> float:
    """Return a [0, 100] composite score for a backend dict.

    Backend dict keys:
        queue_len       : int   — pending jobs in queue
        avg_gate_error  : float — mean two-qubit gate error rate
        latency_ms      : float — recent job round-trip time (ms)
        available_shots : int   — remaining shots this billing cycle
        operational     : bool  — backend is currently online
    """
    if not backend.get("operational", True):
        return 0.0

    w = {"queue": 1.0, "accuracy": 1.0, "latency": 1.0, "shots": 1.0}
    if weights:
        w.update(weights)

    q = _clamp(1 - backend.get("queue_len", 0) / MAX_QUEUE)
    a = _clamp(1 - backend.get("avg_gate_error", 0.01) / MAX_ERR)
    l = _clamp(1 - backend.get("latency_ms", 500) / MAX_LAT)
    s = _clamp(backend.get("available_shots", WANT_SHOTS) / WANT_SHOTS)

    total_w = w["queue"] + w["accuracy"] + w["latency"] + w["shots"]
    return 100 * (w["queue"]*q + w["accuracy"]*a + w["latency"]*l + w["shots"]*s) / total_w


def select_best(pool: list[dict], weights: dict | None = None) -> dict:
    """Return the highest-scoring backend from pool."""
    if not pool:
        raise ValueError("empty QPU pool")
    return max(pool, key=lambda b: score_backend(b, weights))
