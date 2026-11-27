"""cure_oracle/accelerator.py — Virtual Quantum Accelerator.

VirtualAccelerator runs multiple QPU-shape circuits in sequence, synthesizes
their results into MENTE slots (S1–S4), and issues a sig-receipt/1.

Design
------
- Each shape produces a BenchmarkResult with a TVD delta in [0, 1].
- Quality q = max(0.0, 1.0 - delta) maps delta into [0, 1] where 1 = perfect.
- q is then projected onto four 四天王 slots by the same thresholds as check_mente().
- Synthesis: when multiple runs land on the same slot, the highest-q run wins.
- The synthesized slot set is passed to check_mente() to compute mente_total.
- A sig-receipt/1 is issued for the synthesized run.

The accelerator is intentionally stateless — no background threads, no globals.
"""

from __future__ import annotations

import datetime
import hashlib
import uuid
from dataclasses import dataclass, field
from typing import Optional

from cure_oracle.benchmark import (
    CAMPAIGN_SHAPES,
    SHAPE_CIRCUIT_MAP,
    BenchmarkResult,
    run_benchmark,
)
from cure_oracle.birth import make_sig_receipt
from cure_oracle.mente import MENTE_CONST, check_mente

# ── slot projection ───────────────────────────────────────────────────────────

_SLOT_LABELS = ("A", "B", "C", "D")

# q threshold → slot (descending order, first match wins)
_SLOT_THRESHOLDS: list[tuple[float, str]] = [
    (0.75, "S4"),   # 広目天 — highest fidelity
    (0.50, "S1"),   # 多聞天
    (0.25, "S3"),   # 持国天
    (0.00, "S2"),   # 増長天 — lowest
]


def _q_to_slot(q: float) -> str:
    for threshold, slot in _SLOT_THRESHOLDS:
        if q >= threshold:
            return slot
    return "S2"


# Shape → default theta_disp
_SHAPE_THETA: dict[str, str] = {
    c["shape"]: c["theta_disp"] for c in CAMPAIGN_SHAPES
}

# Shape → default shots
_SHAPE_SHOTS: dict[str, int] = {
    c["shape"]: c["shots"] for c in CAMPAIGN_SHAPES
}

# ── data classes ──────────────────────────────────────────────────────────────


@dataclass
class AcceleratorRun:
    """Result of a single shape run within an accelerator batch."""
    shape:       str
    q:           float          # 1 - delta, clamped to [0, 1]
    slot:        str            # S1 / S2 / S3 / S4
    delta:       float
    passed:      bool
    sig_code:    str
    backend:     str
    shots:       int
    theta_disp:  str
    circuit_hash: str


@dataclass
class SynthesizedResult:
    """Synthesized MENTE result from all accelerator runs."""
    slots:          dict[str, AcceleratorRun]   # slot → winning run
    mente_total:    float
    mente_achieved: bool
    four_kings:     bool                        # all 4 slots present
    missing_slots:  list[str]


@dataclass
class AcceleratorResult:
    """Full output of VirtualAccelerator.run()."""
    runs:           list[AcceleratorRun]
    synthesized:    SynthesizedResult
    observe_receipt: dict
    run_id:         str = field(default_factory=lambda: str(uuid.uuid4()))
    born_at:        str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


# ── VirtualAccelerator ────────────────────────────────────────────────────────


class VirtualAccelerator:
    """Run multiple QPU shapes, synthesize via MENTE slots, issue sig-receipt.

    Usage::

        acc = VirtualAccelerator()
        result = acc.run(["CUBE", "RING", "STAR"], shots=4096, mode="local")

    Parameters
    ----------
    n_qubits:
        Circuit width (default 4).  Applied to every shape in the batch.
    """

    def __init__(self, n_qubits: int = 4) -> None:
        self.n_qubits = n_qubits

    # ── public ────────────────────────────────────────────────────────────────

    def run(
        self,
        shapes: list[str],
        shots: Optional[int] = None,
        mode: str = "local",
        token: Optional[str] = None,
        instance: Optional[str] = None,
        confirm: Optional[str] = None,
    ) -> AcceleratorResult:
        """Execute *shapes* and synthesize results.

        Parameters
        ----------
        shapes:
            1–10 shape names (repeats allowed for QPU replication).
            Valid: CUBE / RING / TREE / LINE / STAR.
        shots:
            Shots per shape; defaults to each shape's canonical shot count.
        mode:
            "local" | "fake" | "ibm".
        token / instance / confirm:
            IBM QPU credentials — required when mode == "ibm".
        """
        if not shapes:
            raise ValueError("shapes must be non-empty")
        for s in shapes:
            if s not in SHAPE_CIRCUIT_MAP:
                raise ValueError(
                    f"unknown shape {s!r}; valid: {sorted(SHAPE_CIRCUIT_MAP)}"
                )

        runs: list[AcceleratorRun] = []
        for shape in shapes:
            run_shots = shots if shots is not None else _SHAPE_SHOTS.get(shape, 4096)
            theta_disp = _SHAPE_THETA.get(shape, "√.414")
            result = self._run_one(
                shape=shape,
                theta_disp=theta_disp,
                shots=run_shots,
                mode=mode,
                token=token,
                instance=instance,
                confirm=confirm,
            )
            runs.append(result)

        synthesized = self._synthesize(runs)
        receipt = self._build_receipt(synthesized, runs)
        return AcceleratorResult(runs=runs, synthesized=synthesized, observe_receipt=receipt)

    # ── private ───────────────────────────────────────────────────────────────

    def _run_one(
        self,
        shape: str,
        theta_disp: str,
        shots: int,
        mode: str,
        token: Optional[str],
        instance: Optional[str],
        confirm: Optional[str],
    ) -> AcceleratorRun:
        kwargs: dict = dict(
            shape=shape,
            n_qubits=self.n_qubits,
            theta_disp=theta_disp,
            shots=shots,
            mode=mode,
        )
        if mode == "ibm":
            kwargs.update(token=token, instance=instance, confirm=confirm)

        br: BenchmarkResult = run_benchmark(**kwargs)
        q = max(0.0, min(1.0, 1.0 - br.delta))
        return AcceleratorRun(
            shape=shape,
            q=round(q, 6),
            slot=_q_to_slot(q),
            delta=round(br.delta, 6),
            passed=br.passed,
            sig_code=br.sig_code,
            backend=br.backend,
            shots=br.shots,
            theta_disp=theta_disp,
            circuit_hash=br.circuit_hash,
        )

    def _synthesize(self, runs: list[AcceleratorRun]) -> SynthesizedResult:
        # For each slot, choose the run with the highest q (maximum-coherence)
        slot_best: dict[str, AcceleratorRun] = {}
        for run in runs:
            existing = slot_best.get(run.slot)
            if existing is None or run.q > existing.q:
                slot_best[run.slot] = run

        # Build MENTE triangles from winning runs (use slot labels A/B/C/D)
        # Map slots to fixed labels
        slot_to_label = {"S1": "A", "S2": "B", "S3": "C", "S4": "D"}
        triangles = [
            {"q": run.q, "label": slot_to_label[slot]}
            for slot, run in slot_best.items()
        ]

        check = check_mente(triangles) if triangles else None
        mente_total = round(check.mente_total, 6) if check else 0.0
        mente_achieved = check.mente_achieved if check else False
        all_slots = {"S1", "S2", "S3", "S4"}
        present = set(slot_best.keys())
        missing = sorted(all_slots - present)

        return SynthesizedResult(
            slots=slot_best,
            mente_total=mente_total,
            mente_achieved=mente_achieved,
            four_kings=len(missing) == 0,
            missing_slots=missing,
        )

    def _build_receipt(
        self,
        synthesized: SynthesizedResult,
        runs: list[AcceleratorRun],
    ) -> dict:
        run_id = str(uuid.uuid4())
        born_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Circuit fingerprint: hash of all shape/circuit_hash values
        fingerprint = hashlib.sha256(
            "|".join(f"{r.shape}:{r.circuit_hash}" for r in runs).encode()
        ).hexdigest()

        sig_code = "CUBE-φ.618-ε.001" if synthesized.mente_achieved else "LINE-√.414-ε.010"
        epsilon = 0.001 if synthesized.mente_achieved else 0.010

        cert = {
            "certificate_id": run_id,
            "born_at":         born_at,
            "backend":         "cure-os/virtual-accelerator",
            "qpu_seconds":     0,
            "bitstring":       fingerprint[:16],
        }
        return make_sig_receipt(cert, sig_code, epsilon, synthesized.mente_total)
