"""IBM Quantum challenge: ask a real QPU the spin-lab question (QAOA, one layer).

The question comes from quantum/problems/<id>.json (written by `npm run quantum:export` from
lib/spinLab.ts), so the QPU, the local simulators and the browser all ask the same thing.

    pip install -r quantum/requirements.txt
    python quantum/ibm_spin_challenge.py hair --mode local     # exact simulation (free, offline)
    python quantum/ibm_spin_challenge.py hair --mode fake      # noisy rehearsal on a fake IBM chip (offline)
    python quantum/ibm_spin_challenge.py hair --mode ibm       # the real QPU (uses your free-plan minutes)

For --mode ibm, save your account once on your own machine (never commit the key):

    from qiskit_ibm_runtime import QiskitRuntimeService
    QiskitRuntimeService.save_account(channel="ibm_quantum_platform", token="<API key>", instance="<CRN>")

Budget: one circuit, 4 000 shots by default. A 10-qubit, one-layer circuit runs in a few seconds of
QPU time, far inside the free plan's monthly minutes. The script refuses more than --max-shots and
asks before submitting. Results go to quantum/results/<id>-<mode>-<backend>.json; the spin lab page
shows them next to the browser's own simulation.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent


def load(problem_id: str) -> dict:
    return json.loads((HERE / "problems" / f"{problem_id}.json").read_text(encoding="utf-8"))


def ising(doc: dict) -> tuple[list[float], list[tuple[int, int, float]], float]:
    """QUBO (x = 1 means ↑ = measured 1) → Pauli-Z form. With x = (1 − Z)/2:
    a·x → −a/2·Z (+a/2);  b·xᵢxⱼ → b/4·ZᵢZⱼ − b/4·Zᵢ − b/4·Zⱼ (+b/4)."""
    q = doc["qubo"]; n = doc["n"]
    z = [-a / 2 for a in q["linear"]]; zz: list[tuple[int, int, float]] = []; const = q["offset"] + sum(q["linear"]) / 2
    for i, j, b in q["quadratic"]:
        zz.append((i, j, b / 4)); z[i] -= b / 4; z[j] -= b / 4; const += b / 4
    assert len(z) == n
    return z, zz, const


def energy(doc: dict, bits: list[int]) -> float:
    q = doc["qubo"]
    e = q["offset"] + sum(a for a, b in zip(q["linear"], bits) if b)
    return e + sum(w for i, j, w in q["quadratic"] if bits[i] and bits[j])


def circuit(doc: dict):
    """H on every qubit, then e^(−iγE/scale) as RZ / RZZ, then e^(−iβX) as RX(2β), then measure."""
    from qiskit import QuantumCircuit

    n = doc["n"]; g = doc["qaoa"]["gamma"] / doc["energy_scale"]; b = doc["qaoa"]["beta"]
    z, zz, _ = ising(doc)
    qc = QuantumCircuit(n, name=f"qaoa-{doc['id']}")
    qc.h(range(n))
    for i, j, w in zz:
        qc.rzz(2 * g * w, i, j)      # RZZ(θ) = e^(−iθ/2·ZZ)
    for i, w in enumerate(z):
        if abs(w) > 1e-12:
            qc.rz(2 * g * w, i)       # RZ(θ) = e^(−iθ/2·Z)
    qc.rx(2 * b, range(n))            # RX(2β) = e^(−iβX)
    qc.measure_all()
    return qc


def bits_of(key: str, n: int) -> list[int]:
    k = int(key, 2)  # Qiskit bit strings put qubit 0 on the right, so int() gives the same k as the browser
    return [(k >> i) & 1 for i in range(n)]


def summarise(doc: dict, counts: dict[str, int]) -> dict:
    n = doc["n"]; shots = sum(counts.values()); best = doc["exact"]["energy"]
    probs = [0.0] * (1 << n)
    for key, c in counts.items():
        probs[int(key.replace(" ", ""), 2)] += c / shots
    exp = sum(p * energy(doc, [(k >> i) & 1 for i in range(n)]) for k, p in enumerate(probs) if p)
    p_opt = sum(p for k, p in enumerate(probs) if p and abs(energy(doc, [(k >> i) & 1 for i in range(n)]) - best) < 1e-9)
    top = sorted(((p, k) for k, p in enumerate(probs) if p), reverse=True)[:12]
    browser = doc["qaoa"]["browser_probabilities"]
    tvd = 0.5 * sum(abs(a - b) for a, b in zip(probs, browser))  # distance from the browser's ideal answer
    return {"shots": shots, "expect": exp, "p_opt": p_opt, "tvd_vs_browser": tvd,
            "top": [{"bits": [(k >> i) & 1 for i in range(n)], "p": p, "energy": energy(doc, [(k >> i) & 1 for i in range(n)])} for p, k in top],
            "probabilities": [round(p, 6) for p in probs]}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("problem", choices=["hair", "flower"])
    ap.add_argument("--mode", choices=["local", "fake", "ibm"], default="local")
    ap.add_argument("--shots", type=int, default=4000)
    ap.add_argument("--max-shots", type=int, default=10000)
    ap.add_argument("--backend", help="IBM backend name (default: least busy) or fake backend class (default FakeTorino)")
    ap.add_argument("--yes", action="store_true", help="submit to the real QPU without asking")
    a = ap.parse_args(argv)
    if a.shots > a.max_shots:
        sys.exit(f"{a.shots} shots is over the --max-shots guard ({a.max_shots})")

    doc = load(a.problem); qc = circuit(doc); backend_name = "statevector"; usage = None

    if a.mode == "local":
        from qiskit.primitives import StatevectorSampler
        counts = StatevectorSampler(seed=7).run([qc], shots=a.shots).result()[0].data.meas.get_counts()
    else:
        from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
        if a.mode == "fake":
            from qiskit_ibm_runtime import SamplerV2
            from qiskit_ibm_runtime import fake_provider
            backend = getattr(fake_provider, a.backend or "FakeTorino")()
        else:
            from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
            service = QiskitRuntimeService()
            backend = service.backend(a.backend) if a.backend else service.least_busy(operational=True, simulator=False, min_num_qubits=doc["n"])
        backend_name = backend.name
        isa = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=7).run(qc)
        ops = isa.count_ops(); twoq = sum(v for k, v in ops.items() if k in ("cz", "ecr", "cx"))
        print(f"{backend_name}: depth {isa.depth()}, two-qubit gates {twoq}, shots {a.shots}")
        if a.mode == "ibm" and not a.yes and input("Submit to the real QPU? This uses free-plan time. [y/N] ").strip().lower() != "y":
            print("not submitted"); return 1
        job = SamplerV2(mode=backend).run([isa], shots=a.shots)
        print("job", job.job_id())
        res = job.result(); counts = res[0].data.meas.get_counts()
        if a.mode == "ibm":
            try:
                usage = job.usage()  # seconds of QPU time billed to the plan
            except Exception:  # noqa: BLE001 — older runtimes: fall back to metrics
                usage = (job.metrics() or {}).get("usage", {}).get("quantum_seconds")
            print("QPU seconds used:", usage)

    s = summarise(doc, counts)
    uniform = sum(1 for k in range(1 << doc["n"]) if abs(energy(doc, [(k >> i) & 1 for i in range(doc["n"])]) - doc["exact"]["energy"]) < 1e-9) / (1 << doc["n"])
    out = {"problem": doc["id"], "mode": a.mode, "backend": backend_name, "when": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "qpu_seconds": usage, "gamma": doc["qaoa"]["gamma"], "beta": doc["qaoa"]["beta"], "exact_energy": doc["exact"]["energy"],
           "browser_expect": doc["qaoa"]["expect"], "uniform_p_opt": uniform, **s}
    path = HERE / "results" / f"{doc['id']}-{a.mode}-{backend_name}.json"
    path.write_text(json.dumps(out) + "\n", encoding="utf-8")
    print(f"<E> {s['expect']:.3f} (browser {doc['qaoa']['expect']:.3f}, exact best {doc['exact']['energy']:.3f}) · "
          f"P(optimum) {s['p_opt'] * 100:.2f}% (random {uniform * 100:.2f}%) · distance from browser {s['tvd_vs_browser']:.3f}")
    print("saved", path.relative_to(HERE.parent))
    return 0


if __name__ == "__main__":
    sys.exit(main())
