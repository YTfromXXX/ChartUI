"""
cure_oracle/benchmark.py — IBM Quantum Campaign benchmark circuits.

SIG SHAPE → circuit family:
  CUBE → QAOA   (Max-Cut, ring graph, p=1)
  RING → VQE    (hardware-efficient ansatz, ring topology)
  TREE → QFT    (quantum Fourier transform)
  LINE → GHZ    (Greenberger-Horne-Zeilinger entanglement)
  STAR → QV     (Quantum Volume, random SU4 layers)

Each ``run_benchmark()`` call:
1. builds the Qiskit circuit for the given SHAPE
2. derives an ideal probability distribution (statevector or analytic)
3. samples it on AerSimulator
4. computes total-variation distance  δ = TVD(sampled, ideal)
5. issues a SIG code when δ ≤ ε_threshold

``compare_ibm_result()`` lets you drop in a real IBM-hardware counts dict
and re-score an existing BenchmarkResult against those shots.

Requires ``qiskit`` and ``qiskit-aer``.  Import this module lazily; it
will raise ``ImportError`` with a helpful message if Qiskit is absent.
"""

from __future__ import annotations

import hashlib
import math
import random
from dataclasses import dataclass
from typing import Optional

# ── Qiskit lazy import ─────────────────────────────────────────────────────────

def _require_qiskit():
    try:
        import qiskit          # noqa: F401
        import qiskit_aer      # noqa: F401
    except ImportError as exc:
        raise ImportError(
            "cure_oracle.benchmark requires Qiskit: "
            "pip install 'cure-oracle[quantum]'"
        ) from exc

# ── constants ──────────────────────────────────────────────────────────────────

BENCHMARK_VERSION = "benchmark/1"

# SIG SHAPE → circuit family
SHAPE_CIRCUIT_MAP: dict[str, str] = {
    "CUBE": "qaoa",
    "RING": "vqe",
    "TREE": "qft",
    "LINE": "ghz",
    "STAR": "qv",
}

# θ_disp → (angle_rad, ε threshold, ε code)
_THETA_INFO: dict[str, tuple[float, float, str]] = {
    "φ.618": (math.pi * 0.6180,  0.001, "ε.001"),
    "π.785": (math.pi * 0.7854,  0.003, "ε.003"),
    "√.414": (math.pi * 0.4142,  0.010, "ε.010"),
}

# Standard IBM Quantum Campaign shapes
CAMPAIGN_SHAPES: list[dict] = [
    {"shape": "CUBE", "n_qubits": 4, "theta_disp": "φ.618", "shots": 8192},
    {"shape": "RING", "n_qubits": 4, "theta_disp": "π.785", "shots": 4096},
    {"shape": "TREE", "n_qubits": 4, "theta_disp": "π.785", "shots": 4096},
    {"shape": "LINE", "n_qubits": 4, "theta_disp": "√.414", "shots": 4096},
    {"shape": "STAR", "n_qubits": 4, "theta_disp": "√.414", "shots": 4096},
]


# ── result dataclass ───────────────────────────────────────────────────────────

@dataclass
class BenchmarkResult:
    shape:          str            # CUBE / RING / TREE / LINE / STAR
    circuit_family: str            # qaoa / vqe / qft / ghz / qv
    n_qubits:       int
    theta_disp:     str            # φ.618 / π.785 / √.414
    shots:          int
    circuit_hash:   str            # 0x + 64 hex  (SHA3-256 of QASM)
    counts:         dict[str, int] # shot-sampled bitstring → count
    ideal:          dict[str, float]  # bitstring → probability
    delta:          float          # TVD(sampled, ideal)
    eps_threshold:  float          # ε from THETA_INFO
    passed:         bool           # delta <= eps_threshold
    sig_code:       str            # "CUBE-φ.618-ε.001" if passed, "" otherwise
    qasm:           str            # OpenQASM 2 / 3 string
    backend:        str            # "aer_simulator" or IBM backend name

    @property
    def eps_code(self) -> str:
        for _, (_, eps, code) in _THETA_INFO.items():
            if abs(eps - self.eps_threshold) < 1e-9:
                return code
        return f"ε.{int(self.eps_threshold*1000):03d}"


# ── public API ─────────────────────────────────────────────────────────────────

def run_benchmark(
    shape: str,
    n_qubits: int = 4,
    theta_disp: str = "φ.618",
    shots: int = 4096,
    seed: int = 42,
    backend_name: str = "aer_simulator",
) -> BenchmarkResult:
    """
    Build and simulate a benchmark circuit for the given SIG SHAPE.

    Parameters
    ----------
    shape       : one of CUBE / RING / TREE / LINE / STAR
    n_qubits    : circuit width (2–8 recommended)
    theta_disp  : θ_disp code — φ.618 / π.785 / √.414
    shots       : number of Aer shots
    seed        : RNG seed for QV circuit and shot sampling
    backend_name: Aer backend name (default "aer_simulator")

    Returns
    -------
    BenchmarkResult with delta, passed, sig_code filled in.
    """
    _require_qiskit()
    if shape not in SHAPE_CIRCUIT_MAP:
        raise ValueError(f"unknown shape {shape!r}; expected one of {sorted(SHAPE_CIRCUIT_MAP)}")
    if theta_disp not in _THETA_INFO:
        raise ValueError(f"unknown theta_disp {theta_disp!r}; expected one of {sorted(_THETA_INFO)}")

    theta_val, eps, eps_code = _THETA_INFO[theta_disp]
    family = SHAPE_CIRCUIT_MAP[shape]

    circ = build_circuit(shape, n_qubits, theta_disp, seed=seed)
    qasm = _circuit_to_qasm(circ)
    chash = _circuit_hash(qasm)

    # sample on Aer
    counts = _run_aer(circ, shots, seed=seed, backend_name=backend_name)

    # ideal distribution
    ideal = _ideal_distribution(shape, n_qubits, theta_val, seed=seed)

    delta = _total_variation_distance(counts, ideal, shots)
    passed = delta <= eps
    sig_code = f"{shape}-{theta_disp}-{eps_code}" if passed else ""

    return BenchmarkResult(
        shape=shape,
        circuit_family=family,
        n_qubits=n_qubits,
        theta_disp=theta_disp,
        shots=shots,
        circuit_hash=chash,
        counts=counts,
        ideal=ideal,
        delta=delta,
        eps_threshold=eps,
        passed=passed,
        sig_code=sig_code,
        qasm=qasm,
        backend=backend_name,
    )


def compare_ibm_result(
    ibm_counts: dict[str, int],
    aer_result: BenchmarkResult,
) -> tuple[float, bool, str]:
    """
    Score real IBM-hardware counts against the ideal from an existing
    BenchmarkResult.  Returns (delta, passed, sig_code).

    Example::

        ibm_counts = {"0000": 3821, "1111": 191, ...}  # from IBM job
        delta, passed, sig = compare_ibm_result(ibm_counts, aer_result)
    """
    shots = sum(ibm_counts.values())
    delta = _total_variation_distance(ibm_counts, aer_result.ideal, shots)
    passed = delta <= aer_result.eps_threshold
    _, _, eps_code = _THETA_INFO[aer_result.theta_disp]
    sig_code = f"{aer_result.shape}-{aer_result.theta_disp}-{eps_code}" if passed else ""
    return delta, passed, sig_code


def issue_sig_if_passed(result: BenchmarkResult) -> Optional[str]:
    """Return the SIG code when result.passed is True, else None."""
    return result.sig_code if result.passed else None


def build_circuit(
    shape: str,
    n_qubits: int,
    theta_disp: str = "φ.618",
    seed: int = 42,
):
    """
    Build and return a Qiskit QuantumCircuit for the given SIG SHAPE.
    The circuit includes measurements on all qubits.
    """
    _require_qiskit()
    if shape not in SHAPE_CIRCUIT_MAP:
        raise ValueError(f"unknown shape {shape!r}")
    theta_val, _, _ = _THETA_INFO.get(theta_disp, (math.pi * 0.618, 0.001, "ε.001"))
    builders = {
        "CUBE": _build_qaoa,
        "RING": _build_vqe_ring,
        "TREE": _build_qft,
        "LINE": _build_ghz,
        "STAR": _build_qv,
    }
    return builders[shape](n_qubits, theta_val, seed)


# ── circuit builders ───────────────────────────────────────────────────────────

def _build_qaoa(n: int, theta: float, seed: int = 42):
    """CUBE: QAOA p=1 on a ring graph (n-cycle Max-Cut).

    γ = theta  (problem unitary angle)
    β = theta/2  (mixer angle)
    """
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(n, n)
    gamma = theta
    beta  = theta / 2.0

    # initial state |+⟩^⊗n
    for i in range(n):
        qc.h(i)

    # problem unitary: RZZ on each edge of n-cycle
    for i in range(n):
        j = (i + 1) % n
        qc.cx(i, j)
        qc.rz(2 * gamma, j)
        qc.cx(i, j)

    # mixer unitary: RX on all qubits
    for i in range(n):
        qc.rx(2 * beta, i)

    qc.measure(list(range(n)), list(range(n)))
    return qc


def _build_vqe_ring(n: int, theta: float, seed: int = 42):
    """RING: Hardware-efficient ansatz with ring CNOT entanglement.

    Layer 1: RY(θ·(i+1)/n) on each qubit i
    Layer 2: CNOT ring  (i → (i+1)%n)
    Layer 3: RY(θ/2) on each qubit
    """
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(n, n)
    for i in range(n):
        qc.ry(theta * (i + 1) / n, i)
    for i in range(n):
        qc.cx(i, (i + 1) % n)
    for i in range(n):
        qc.ry(theta / 2.0, i)
    qc.measure(list(range(n)), list(range(n)))
    return qc


def _build_qft(n: int, theta: float, seed: int = 42):
    """TREE: Quantum Fourier Transform on n qubits (input |0…0⟩)."""
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(n, n)
    for i in range(n):
        qc.h(i)
        for j in range(i + 1, n):
            qc.cp(math.pi / (2 ** (j - i)), j, i)
    for i in range(n // 2):
        qc.swap(i, n - 1 - i)
    qc.measure(list(range(n)), list(range(n)))
    return qc


def _build_ghz(n: int, theta: float, seed: int = 42):
    """LINE: GHZ state  |GHZ⟩ = (|0…0⟩ + |1…1⟩)/√2.

    H on qubit 0, then CNOT chain 0→1→…→(n-1).
    """
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(n, n)
    qc.h(0)
    for i in range(n - 1):
        qc.cx(i, i + 1)
    qc.measure(list(range(n)), list(range(n)))
    return qc


def _build_qv(n: int, theta: float, seed: int = 42):
    """STAR: Quantum Volume — n layers of random SU(4) on random qubit pairs.

    Each SU(4) is approximated by RY+RZ+CNOT+RY+RZ (KAK decomposition stub).
    """
    from qiskit import QuantumCircuit
    rng = random.Random(seed)
    qc = QuantumCircuit(n, n)
    for _ in range(n):                   # depth = n (QV definition)
        qubits = list(range(n))
        rng.shuffle(qubits)
        for k in range(0, n - 1, 2):
            a, b = qubits[k], qubits[k + 1]
            # random 2-qubit gate via KAK stub
            for q in (a, b):
                qc.ry(rng.uniform(0, math.pi * 2), q)
                qc.rz(rng.uniform(0, math.pi * 2), q)
            qc.cx(a, b)
            for q in (a, b):
                qc.ry(rng.uniform(0, math.pi * 2), q)
                qc.rz(rng.uniform(0, math.pi * 2), q)
    qc.measure(list(range(n)), list(range(n)))
    return qc


# ── ideal distributions ────────────────────────────────────────────────────────

def _ideal_distribution(
    shape: str, n: int, theta: float, seed: int = 42
) -> dict[str, float]:
    """Return the ideal (noiseless) probability distribution for a circuit."""
    if shape == "LINE":
        # GHZ: exactly two states
        z = "0" * n
        o = "1" * n
        return {z: 0.5, o: 0.5}
    if shape == "TREE":
        # QFT on |0⟩: uniform over all 2^n states
        total = 2 ** n
        return {format(i, f"0{n}b"): 1.0 / total for i in range(total)}
    # For CUBE, RING, STAR: use Aer statevector
    return _statevector_distribution(shape, n, theta, seed)


def _statevector_distribution(
    shape: str, n: int, theta: float, seed: int
) -> dict[str, float]:
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector

    builders = {
        "CUBE": _build_qaoa,
        "RING": _build_vqe_ring,
        "STAR": _build_qv,
    }
    # build without measurements for statevector
    circ_meas = builders[shape](n, theta, seed)
    circ_sv = circ_meas.remove_final_measurements(inplace=False)
    sv = Statevector(circ_sv)
    probs = sv.probabilities_dict()
    return {k: float(v) for k, v in probs.items() if v > 1e-12}


# ── Aer runner ─────────────────────────────────────────────────────────────────

def _run_aer(
    circuit,
    shots: int,
    seed: int = 42,
    backend_name: str = "aer_simulator",
) -> dict[str, int]:
    from qiskit_aer import AerSimulator
    from qiskit import transpile

    backend = AerSimulator()
    tcirc = transpile(circuit, backend, optimization_level=0)
    job = backend.run(tcirc, shots=shots, seed_simulator=seed)
    return dict(job.result().get_counts())


# ── hash ───────────────────────────────────────────────────────────────────────

def _circuit_to_qasm(circuit) -> str:
    """Export a QuantumCircuit to an OpenQASM 2 string (Qiskit 1.x API)."""
    from qiskit import qasm2
    return qasm2.dumps(circuit)


def _circuit_hash(qasm: str) -> str:
    """SHA3-256 of the QASM string, returned as 0x + 64 hex chars."""
    digest = hashlib.sha3_256(qasm.encode()).hexdigest()
    return "0x" + digest


# ── total variation distance ───────────────────────────────────────────────────

def _total_variation_distance(
    counts: dict[str, int],
    ideal: dict[str, float],
    shots: int,
) -> float:
    """TVD = 0.5 * Σ|P_sampled(x) - P_ideal(x)|."""
    all_keys = set(counts) | set(ideal)
    total = 0.0
    for k in all_keys:
        p_samp = counts.get(k, 0) / shots
        p_ideal = ideal.get(k, 0.0)
        total += abs(p_samp - p_ideal)
    return total / 2.0
