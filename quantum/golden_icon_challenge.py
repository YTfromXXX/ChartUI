"""IBM Quantum free-plan challenge for "イーサリアムの黄金のアイコンを探せ"（仮）.

Two small questions from the story, each one circuit:

  hair   On the island, the thinking machine フォン（仮） is asked: which dominant hairstyle should each
         of the four figures wear so that the four are easiest to tell apart? 16 qubits (4 figures ×
         4 styles), QAOA with one layer. The question is exported by
         `node scripts/export-golden-problem.mjs` from the same code as /lab/face-contour, so the
         browser, this script and the QPU ask the same thing.
  cloth  Year 9, the observation cut: two qubits, two angles (integer milliradians, the same unit as a
         .q file). 00 = the cloth stays, 01 = Stoic folds back its edge, 10 = his hand stops,
         11 = the cloth comes off. The ideal probabilities are printed next to what was measured.

    pip install -r quantum/requirements.txt
    python quantum/golden_icon_challenge.py hair  --mode local   # exact simulation (free, offline)
    python quantum/golden_icon_challenge.py hair  --mode fake    # noisy rehearsal on a fake IBM chip (offline)
    python quantum/golden_icon_challenge.py hair  --mode ibm     # the real QPU (uses free-plan time)
    python quantum/golden_icon_challenge.py cloth --mode local --angles 2094 1571

For --mode ibm, save your account once on your own machine (never commit the key):

    from qiskit_ibm_runtime import QiskitRuntimeService
    QiskitRuntimeService.save_account(channel="ibm_quantum_platform", token="<API key>", instance="<CRN>")

Budget: one circuit per run; hair 4 000 shots, cloth 1 000 shots by default; never more than
--max-shots (10 000). Both circuits take seconds of QPU time, well inside the free plan's monthly
minutes. The script shows the transpiled size and asks before submitting to a real QPU.
Results go to quantum/results/golden-<question>-<mode>-<backend>.json.

Honest note: with one QAOA layer on a 16-qubit problem with constraints, the chance of measuring the
best assignment is only a little above random (see the export script's output). The point is that the
game's question can be asked of a quantum computer, not that it answers faster.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ibm_spin_challenge import circuit, energy  # noqa: E402  (same QAOA circuit and energy as the spin lab)

CLOTH = {"00": "布はそのまま", "01": "端を折り返す", "10": "手が止まる", "11": "布を外す"}


def load_hair() -> dict:
    return json.loads((HERE / "problems" / "golden-hair.json").read_text(encoding="utf-8"))


def cloth_circuit(a_mrad: int, b_mrad: int):
    """RY(a) on qubit 0 (the cloth's edge), RY(b) on qubit 1 (Stoic's hand), then CX 0→1: the hand follows the edge."""
    from qiskit import QuantumCircuit

    qc = QuantumCircuit(2, name="golden-cloth")
    qc.ry(a_mrad / 1000, 0)
    qc.ry(b_mrad / 1000, 1)
    qc.cx(0, 1)
    qc.measure_all()
    return qc


def ideal_cloth(a_mrad: int, b_mrad: int) -> dict[str, float]:
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector

    qc = QuantumCircuit(2)
    qc.ry(a_mrad / 1000, 0); qc.ry(b_mrad / 1000, 1); qc.cx(0, 1)
    return {k: float(v) for k, v in Statevector(qc).probabilities_dict().items()}


def run(qc, mode: str, backend_hint: str | None, shots: int, yes: bool, min_qubits: int):
    usage = None; backend_name = "statevector"
    if mode == "local":
        from qiskit.primitives import StatevectorSampler
        counts = StatevectorSampler(seed=7).run([qc], shots=shots).result()[0].data.meas.get_counts()
        return counts, backend_name, usage
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    if mode == "fake":
        from qiskit_ibm_runtime import SamplerV2, fake_provider
        backend = getattr(fake_provider, backend_hint or "FakeTorino")()
    else:
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
        service = QiskitRuntimeService()
        backend = service.backend(backend_hint) if backend_hint else service.least_busy(operational=True, simulator=False, min_num_qubits=min_qubits)
    backend_name = backend.name
    isa = generate_preset_pass_manager(optimization_level=3, backend=backend, seed_transpiler=7).run(qc)
    ops = isa.count_ops(); twoq = sum(v for k, v in ops.items() if k in ("cz", "ecr", "cx"))
    print(f"{backend_name}: depth {isa.depth()}, two-qubit gates {twoq}, shots {shots}")
    if mode == "ibm" and not yes and input("Submit to the real QPU? This uses free-plan time. [y/N] ").strip().lower() != "y":
        raise SystemExit("not submitted")
    job = SamplerV2(mode=backend).run([isa], shots=shots)
    print("job", job.job_id())
    counts = job.result()[0].data.meas.get_counts()
    if mode == "ibm":
        try:
            usage = job.usage()
        except Exception:  # noqa: BLE001
            usage = (job.metrics() or {}).get("usage", {}).get("quantum_seconds")
        print("QPU seconds used:", usage)
    return counts, backend_name, usage


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("question", choices=["hair", "cloth"])
    ap.add_argument("--mode", choices=["local", "fake", "ibm"], default="local")
    ap.add_argument("--backend", help="IBM backend name (default: least busy) or fake class name (default FakeTorino)")
    ap.add_argument("--shots", type=int)
    ap.add_argument("--max-shots", type=int, default=10_000)
    ap.add_argument("--angles", type=int, nargs=2, default=[2094, 1571], metavar=("EDGE_MRAD", "HAND_MRAD"), help="cloth only: two angles in milliradians")
    ap.add_argument("--yes", action="store_true", help="do not ask before submitting to a real QPU")
    a = ap.parse_args(argv)
    shots = a.shots or (4000 if a.question == "hair" else 1000)
    if shots > a.max_shots:
        print(f"refusing {shots} shots (more than --max-shots {a.max_shots})"); return 2
    when = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    if a.question == "hair":
        doc = load_hair(); n = doc["n"]; best = doc["exact"]["energy"]
        counts, backend_name, usage = run(circuit(doc), a.mode, a.backend, shots, a.yes, n)
        total = sum(counts.values()); rows = []
        for key, c in counts.items():
            k = int(key.replace(" ", ""), 2); bits = [(k >> i) & 1 for i in range(n)]
            rows.append((c / total, bits, energy(doc, bits)))
        expect = sum(p * e for p, _, e in rows); p_opt = sum(p for p, _, e in rows if abs(e - best) < 1e-9)
        valid = sum(p for p, b, _ in rows if all(sum(b[f * 4:(f + 1) * 4]) == 1 for f in range(4)) and all(sum(b[f * 4 + s] for f in range(4)) == 1 for s in range(4)))
        top = sorted(rows, key=lambda r: -r[0])[:8]
        out = {"question": "hair", "mode": a.mode, "backend": backend_name, "when": when, "qpu_seconds": usage, "shots": total,
               "exact": doc["exact"], "current_design": doc.get("current_design"), "expect": expect, "p_opt": p_opt,
               "p_valid_assignment": valid, "browser_expect": doc["qaoa"]["expect"], "browser_p_opt": doc["qaoa"].get("p_opt"),
               "top": [{"p": p, "bits": b, "energy": e} for p, b, e in top]}
        print(f"<E> {expect:.3f} (browser {doc['qaoa']['expect']:.3f}, best {best:.3f}) · P(best) {p_opt * 100:.3f}% · "
              f"P(valid: one style each) {valid * 100:.2f}%")
        print("best assignment:", doc["exact"]["reading"])
        path = HERE / "results" / f"golden-hair-{a.mode}-{backend_name}.json"
    else:
        ea, hb = a.angles; ideal = ideal_cloth(ea, hb)
        counts, backend_name, usage = run(cloth_circuit(ea, hb), a.mode, a.backend, shots, a.yes, 2)
        total = sum(counts.values()); measured = {k.replace(" ", ""): c / total for k, c in counts.items()}
        tvd = 0.5 * sum(abs(measured.get(k, 0) - ideal.get(k, 0)) for k in CLOTH)
        out = {"question": "cloth", "mode": a.mode, "backend": backend_name, "when": when, "qpu_seconds": usage, "shots": total,
               "angles_mrad": [ea, hb], "ideal": ideal, "measured": measured, "tvd_vs_ideal": tvd, "meaning": CLOTH}
        for k in ("00", "01", "10", "11"):
            print(f"{k} {CLOTH[k]:　<6} ideal {ideal.get(k, 0) * 100:5.1f}%  measured {measured.get(k, 0) * 100:5.1f}%")
        print(f"distance from ideal {tvd:.3f}")
        path = HERE / "results" / f"golden-cloth-{a.mode}-{backend_name}.json"
    path.write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    print("saved", path.relative_to(HERE.parent))
    return 0


if __name__ == "__main__":
    sys.exit(main())
