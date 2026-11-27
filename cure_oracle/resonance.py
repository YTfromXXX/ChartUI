"""Resonance Max-Cut — six coins, six qubits, one QAOA layer. Made to run from a tablet's browser notebook.

    pip install "cure-oracle[quantum]"         (from the wheel or a pinned commit; see quantum/notebooks/)
    from cure_oracle import resonance
    resonance.run("local")                     # exact simulation, free, offline
    resonance.run("fake")                      # noisy rehearsal on a fake IBM chip, offline
    resonance.run("ibm", token=..., instance=..., confirm="RUN ON QPU")   # the real QPU (free-plan time)

Or from a shell:  cure resonance --mode local   /   cure resonance --export-qasm resonance.qasm

The question is the one on /mente/game/root-bloom: weight w_ij = 1 − correlation of the coins' daily log changes;
cut the pairs that move least alike. The problem JSON is bundled (cure_oracle/data/resonance-maxcut.json) and is
written by scripts/export-resonance-problem.mjs, so the browser, this module and the QPU ask the same thing.

Safety rules built in (the notebook relies on them):
  • the API token is never printed, logged, returned or written to a file — pass it in, it is used once;
  • a real-QPU run needs the exact phrase confirm="RUN ON QPU", and shows the circuit size before it is sent;
  • shots are capped (max_shots, default 10 000); one circuit per run;
  • results are plain JSON (counts, sizes, times) with no account details.
Not investment advice: only the shape of price changes is used, never a price.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import pathlib
from importlib import resources

CONFIRM = "RUN ON QPU"


def load(path: str | None = None) -> dict:
    if path:
        return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    return json.loads(resources.files("cure_oracle").joinpath("data/resonance-maxcut.json").read_text(encoding="utf-8"))


def cut_value(doc: dict, bits: list[int]) -> float:
    w = doc["weights"]; n = doc["n"]
    return sum(w[i][j] for i in range(n) for j in range(i + 1, n) if bits[i] != bits[j])


def bits_of(k: int, n: int) -> list[int]:
    return [(k >> i) & 1 for i in range(n)]


def best_cut(doc: dict) -> tuple[float, list[int]]:
    n = doc["n"]; best = max(range(1 << n), key=lambda k: cut_value(doc, bits_of(k, n)))
    return cut_value(doc, bits_of(best, n)), bits_of(best, n)


def circuit(doc: dict, gamma: float, beta: float, measure: bool = True):
    """QAOA p = 1 for Max-Cut: H on all, RZZ(−γ·w_ij) on every pair, RX(2β) on all."""
    from qiskit import QuantumCircuit

    n = doc["n"]; qc = QuantumCircuit(n, name="resonance-maxcut")
    qc.h(range(n))
    for i in range(n):
        for j in range(i + 1, n):
            if doc["weights"][i][j]:
                qc.rzz(-gamma * doc["weights"][i][j], i, j)
    qc.rx(2 * beta, range(n))
    if measure:
        qc.measure_all()
    return qc


def _optimal_keys(doc: dict) -> set[str]:
    best, _ = best_cut(doc); n = doc["n"]
    return {format(k, f"0{n}b") for k in range(1 << n) if abs(cut_value(doc, bits_of(k, n)) - best) < 1e-9}


def ideal(doc: dict, gamma: float, beta: float) -> dict[str, float]:
    from qiskit.quantum_info import Statevector

    return Statevector(circuit(doc, gamma, beta, measure=False)).probabilities_dict()


def tune(doc: dict, grid: int = 24) -> tuple[float, float, float]:
    """Grid search for γ, β that make the best cut most likely (what the classical optimiser beside a QPU does)."""
    opt = _optimal_keys(doc); best = (0.0, 0.0, -1.0)
    for i in range(1, grid + 1):
        for j in range(1, grid + 1):
            g = math.pi * i / grid; b = (math.pi / 2) * j / grid
            p = sum(v for k, v in ideal(doc, g, b).items() if k in opt)
            if p > best[2]:
                best = (g, b, p)
    return best


def export_qasm(path: str, doc: dict | None = None) -> str:
    """Write the tuned circuit as OpenQASM 3 (for any toolchain or the IBM web console)."""
    from qiskit import qasm3

    doc = doc or load(); g, b, _ = tune(doc); text = qasm3.dumps(circuit(doc, g, b))
    pathlib.Path(path).write_text(text, encoding="utf-8"); return text


def run(mode: str = "local", *, shots: int = 2000, max_shots: int = 10_000, backend: str | None = None,
        token: str | None = None, instance: str | None = None, confirm: str | None = None,
        out_dir: str = ".", doc: dict | None = None) -> dict:
    if mode not in ("local", "fake", "ibm"):
        raise ValueError("mode is local, fake or ibm")
    if shots > max_shots:
        raise ValueError(f"{shots} shots is over the max_shots guard ({max_shots})")
    doc = doc or load(); gamma, beta, p_ideal = tune(doc); qc = circuit(doc, gamma, beta)
    opt = _optimal_keys(doc); best, groups = best_cut(doc)
    if groups[0] == 1:
        groups = [1 - x for x in groups]
    size = {"depth": qc.depth(), "two_qubit": sum(1 for x in qc.data if x.operation.num_qubits == 2)}
    backend_name = "statevector"; job_id = None; qpu_seconds = None
    if mode == "local":
        from qiskit.primitives import StatevectorSampler

        counts = StatevectorSampler(seed=7).run([qc], shots=shots).result()[0].data.meas.get_counts()
    else:
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        from qiskit_ibm_runtime import SamplerV2

        if mode == "fake":
            from qiskit_ibm_runtime import fake_provider

            bk = getattr(fake_provider, backend or "FakeTorino")()
        else:
            if confirm != CONFIRM:
                raise PermissionError(f'a real-QPU run needs confirm="{CONFIRM}"')
            from qiskit_ibm_runtime import QiskitRuntimeService

            service = QiskitRuntimeService(channel="ibm_quantum_platform", token=token, instance=instance) if token else QiskitRuntimeService()
            token = None  # drop our reference as soon as the session exists
            bk = service.backend(backend) if backend else service.least_busy(operational=True, simulator=False, min_num_qubits=doc["n"])
        backend_name = bk.name
        isa = generate_preset_pass_manager(optimization_level=3, backend=bk, seed_transpiler=7).run(qc)
        ops = isa.count_ops(); size = {"depth": isa.depth(), "two_qubit": sum(v for k, v in ops.items() if k in ("cz", "ecr", "cx"))}
        print(f"{backend_name}: depth {size['depth']}, two-qubit gates {size['two_qubit']}, shots {shots}")
        job = SamplerV2(mode=bk).run([isa], shots=shots); job_id = job.job_id()
        counts = job.result()[0].data.meas.get_counts()
        if mode == "ibm":
            try:
                qpu_seconds = job.usage()
            except Exception:  # noqa: BLE001 — older runtimes
                qpu_seconds = None
    total = sum(counts.values()); p_meas = sum(v for k, v in counts.items() if k in opt) / total
    out = {
        "problem": doc["id"], "source": doc.get("source"), "mode": mode, "backend": backend_name, "shots": shots,
        "when": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "job_id": job_id, "qpu_seconds": qpu_seconds,
        "gamma": round(gamma, 6), "beta": round(beta, 6), "size": size, "labels": doc["labels"], "best_groups": groups, "best_cut": round(best, 6),
        "p_optimal_measured": round(p_meas, 6), "p_optimal_ideal": round(p_ideal, 6), "p_optimal_random": len(opt) / (1 << doc["n"]),
        "counts": dict(sorted(counts.items())),
    }
    path = pathlib.Path(out_dir) / f"resonance-{mode}-{backend_name}.json"
    path.write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"P(best cut) measured {p_meas * 100:.1f}% · ideal {p_ideal * 100:.1f}% · random {out['p_optimal_random'] * 100:.1f}%  → {path}")
    return out
