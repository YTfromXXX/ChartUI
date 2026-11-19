"""MothBlast quantum round randomness — eternal-space engine.

A single Hadamard layer over n qubits collapses to give each round its
quantum character: guide angles, spawn zones, bullet deflections, and
special events (entanglement shot, superposition dash).

Usage:
    from cure_oracle.round_circuit import round_circuit, guide_angles

    r = round_circuit(round_num=1)        # instant, offline (statevector)
    r = round_circuit(round_num=1, mode="fake")   # noisy rehearsal
    r = round_circuit(round_num=1, mode="ibm",
                      token=..., instance=..., confirm="RUN ON QPU")

    # Cure-API: SELECT existing synthetic QPU or CREATE custom one
    r = round_circuit(round_num=5, mode="custom",
                      endpoint="https://your-cure-api/qpu/run",
                      api_key="...",
                      noise_model={"type": "depolarizing", "error_rate": 0.005})

The eternal space: five guide positions per team (10 total).
  Team A (双渦輪, スハル - cyan):   bits 0-4
  Team B (四枝雷, リナリス - orange): bits 5-9
  Bit = 0 → スハル's angle is active  (Team A guide)
  Bit = 1 → リナリス's angle is active (Team B guide)
  The launcher borrows the nearest active guide angle for instant teleport.

Three special qubit pairs (10, 11, 12) determine round events:
  q10: entanglement_shot  — bullet forks into two paths
  q11: superposition_dash — launcher exists at two angles until observed
  q12: luna_event         — Luna or エーリアル intervenes (neutral event)
"""

from __future__ import annotations

import datetime as dt
import math

CONFIRM = "RUN ON QPU"
N_GUIDE = 10   # 5 per team
N_EVENT = 3    # entanglement_shot, superposition_dash, luna_event
N_TOTAL = N_GUIDE + N_EVENT   # 13 qubits total

# Guide layout: (name, team, angle_deg, color)
GUIDES = [
    ("スハル-A0", "A", 0,   "#22b8c8"),
    ("スハル-A1", "A", 72,  "#22b8c8"),
    ("スハル-A2", "A", 144, "#22b8c8"),
    ("スハル-A3", "A", 216, "#22b8c8"),
    ("スハル-A4", "A", 288, "#22b8c8"),
    ("リナリス-B0", "B", 36,  "#f29b30"),
    ("リナリス-B1", "B", 108, "#f29b30"),
    ("リナリス-B2", "B", 180, "#f29b30"),
    ("リナリス-B3", "B", 252, "#f29b30"),
    ("リナリス-B4", "B", 324, "#f29b30"),
]

EVENT_NAMES = ["entanglement_shot", "superposition_dash", "luna_event"]


def _build_qc(n: int = N_TOTAL):
    """H on all qubits → measure.  Pure randomness — no entanglement bias."""
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(n, name="mothblast-round")
    qc.h(range(n))
    qc.measure_all()
    return qc


def _run_local(qc, shots: int, seed: int) -> dict[str, int]:
    from qiskit.primitives import StatevectorSampler
    return StatevectorSampler(seed=seed).run([qc], shots=shots).result()[0].data.meas.get_counts()


def _run_fake(qc, shots: int, backend_name: str | None) -> dict[str, int]:
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    from qiskit_ibm_runtime import SamplerV2, fake_provider
    bk = getattr(fake_provider, backend_name or "FakeTorino")()
    isa = generate_preset_pass_manager(optimization_level=1, backend=bk, seed_transpiler=7).run(qc)
    return SamplerV2(mode=bk).run([isa], shots=shots).result()[0].data.meas.get_counts()


def _run_custom(
    qc,
    shots: int,
    round_num: int,
    endpoint: str,
    api_key: str | None = None,
    noise_model: dict | None = None,
    extra_headers: dict | None = None,
) -> tuple[dict[str, int], str | None]:
    """POST the circuit to a Cure-API custom QPU endpoint and retrieve counts.

    Request body (JSON):
        circuit      : OpenQASM 3 string of the mothblast circuit
        shots        : number of measurement shots
        round_num    : round identifier (for server-side logging / smart-contract nonce)
        noise_model  : optional noise profile, e.g. {"type":"depolarizing","error_rate":0.005}

    Expected response (JSON):
        counts       : dict[bitstring, int]  — measurement histogram (MSB-first, like Qiskit)
        backend_name : str (optional)        — which QPU the server selected
        qpu_seconds  : float (optional)      — QPU wall-clock seconds used

    Cure-API SELECT / CREATE pattern:
        - Set endpoint to ".../qpu/select" to let the server choose from its QPU pool.
        - Set endpoint to ".../qpu/create" with a noise_model to spin up a custom backend
          and receive counts from that freshly-created synthetic QPU.
        - The smart-contract nonce can be derived from round_num + top bitstring on the
          server side, keeping randomness source verifiable and tamper-evident.
    """
    import json
    import urllib.request
    from qiskit.qasm3 import dumps as qasm3_dumps

    payload = json.dumps({
        "circuit":     qasm3_dumps(qc),
        "shots":       shots,
        "round_num":   round_num,
        **({"noise_model": noise_model} if noise_model else {}),
    }).encode()

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    if extra_headers:
        headers.update(extra_headers)

    req = urllib.request.Request(endpoint, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())

    counts = data["counts"]
    backend_name = data.get("backend_name", endpoint)
    qpu_s = data.get("qpu_seconds", None)
    return counts, backend_name, qpu_s


def _run_ibm(qc, shots: int, backend_name: str | None,
             token: str, instance: str) -> tuple[dict[str, int], str | None]:
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
    service = QiskitRuntimeService(channel="ibm_quantum_platform", token=token, instance=instance)
    token = None  # drop reference immediately
    bk = service.backend(backend_name) if backend_name else service.least_busy(
        operational=True, simulator=False, min_num_qubits=N_TOTAL)
    isa = generate_preset_pass_manager(optimization_level=3, backend=bk, seed_transpiler=7).run(qc)
    print(f"{bk.name}: depth {isa.depth()}, shots {shots}")
    job = SamplerV2(mode=bk).run([isa], shots=shots)
    counts = job.result()[0].data.meas.get_counts()
    try:
        qpu_s = job.usage()
    except Exception:
        qpu_s = None
    return counts, qpu_s


def _interpret(bits: list[int]) -> dict:
    """Map 13 bits to eternal-space game state."""
    guide_bits = bits[:N_GUIDE]
    event_bits = bits[N_GUIDE:]

    # Active guide angles: team A guides whose bit is 0, team B whose bit is 1
    active_a = [GUIDES[i] for i in range(5) if guide_bits[i] == 0]
    active_b = [GUIDES[i] for i in range(5, 10) if guide_bits[i] == 1]

    # Launcher teleport target = centroid of active guides per team
    def centroid(gs):
        if not gs:
            return 0.0
        rad = [math.radians(g[2]) for g in gs]
        return math.degrees(math.atan2(
            sum(math.sin(r) for r in rad) / len(rad),
            sum(math.cos(r) for r in rad) / len(rad),
        )) % 360

    events = {EVENT_NAMES[i]: bool(event_bits[i]) for i in range(N_EVENT)}

    return {
        "guide_bits": guide_bits,
        "active_guides_a": [g[0] for g in active_a],
        "active_guides_b": [g[0] for g in active_b],
        "teleport_angle_a": round(centroid(active_a), 2),
        "teleport_angle_b": round(centroid(active_b), 2),
        "events": events,
    }


def round_circuit(
    round_num: int = 1,
    mode: str = "local",
    *,
    shots: int = 500,
    max_shots: int = 2000,
    backend: str | None = None,
    token: str | None = None,
    instance: str | None = None,
    confirm: str | None = None,
    # --- custom QPU parameters ---
    endpoint: str | None = None,
    api_key: str | None = None,
    noise_model: dict | None = None,
    extra_headers: dict | None = None,
) -> dict:
    """Generate quantum randomness for one MothBlast round.

    Parameters
    ----------
    round_num     : int   round number (seed for local mode; nonce hint for custom)
    mode          : str   'local' | 'fake' | 'ibm' | 'custom'
    shots         : int   measurement shots (capped at max_shots)
    confirm       : str   must equal "RUN ON QPU" for mode='ibm'

    Custom QPU parameters (mode='custom')
    --------------------------------------
    endpoint      : str   Cure-API endpoint URL
                          .../qpu/run    — run on the server's default QPU
                          .../qpu/select — let the server SELECT from its QPU pool
                          .../qpu/create — CREATE a new synthetic QPU from noise_model
    api_key       : str   Bearer token for Cure-API authentication
    noise_model   : dict  Synthetic QPU profile, e.g.:
                          {"type": "depolarizing", "error_rate": 0.005}
                          {"type": "thermal", "T1_us": 100, "T2_us": 80}
                          {"type": "custom", "gate_errors": {...}}
    extra_headers : dict  Additional HTTP headers (e.g. routing, smart-contract context)

    Returns
    -------
    dict with keys: round, mode, backend, when, guide_bits,
                    active_guides_a/b, teleport_angle_a/b, events, counts, size
    """
    if mode not in ("local", "fake", "ibm", "custom"):
        raise ValueError("mode must be local | fake | ibm | custom")
    if shots > max_shots:
        raise ValueError(f"{shots} > max_shots ({max_shots})")
    if mode == "ibm" and confirm != CONFIRM:
        raise PermissionError(f'real-QPU run needs confirm="{CONFIRM}"')
    if mode == "custom" and not endpoint:
        raise ValueError("mode='custom' requires endpoint=")

    qc = _build_qc()
    size = {"qubits": qc.num_qubits, "depth": qc.depth()}
    qpu_s = None

    if mode == "local":
        counts = _run_local(qc, shots, seed=round_num & 0xFFFFFFFF)
        backend_name = "statevector"
    elif mode == "fake":
        counts = _run_fake(qc, shots, backend)
        backend_name = backend or "FakeTorino"
    elif mode == "custom":
        counts, backend_name, qpu_s = _run_custom(
            qc, shots, round_num, endpoint,
            api_key=api_key, noise_model=noise_model, extra_headers=extra_headers,
        )
    else:
        counts, qpu_s = _run_ibm(qc, shots, backend, token, instance)
        backend_name = backend or "least_busy"

    # most-frequent bitstring → ground truth for this round
    top_key = max(counts, key=counts.get)
    # qiskit returns MSB-first strings; reverse to get q0 at index 0
    bits = [int(b) for b in reversed(top_key)]
    if len(bits) < N_TOTAL:
        bits += [0] * (N_TOTAL - len(bits))

    state = _interpret(bits)

    result = {
        "round": round_num,
        "mode": mode,
        "backend": backend_name,
        "when": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "qpu_seconds": qpu_s,
        "size": size,
        **state,
        "counts": dict(sorted(counts.items(), key=lambda kv: -kv[1])[:16]),
    }
    return result


def guide_angles(result: dict | None = None) -> list[dict]:
    """Return the full guide layout (optionally with active/inactive from a result)."""
    active_a = set(result["active_guides_a"]) if result else set()
    active_b = set(result["active_guides_b"]) if result else set()
    return [
        {
            "name": g[0], "team": g[1], "angle": g[2], "color": g[3],
            "active": g[0] in (active_a | active_b),
        }
        for g in GUIDES
    ]


def spiral_preview(result: dict) -> str:
    """ASCII polar ring: 10 guide positions, L1/R1 ladder hints, teleport arrows.

    ★ = active guide (quantum-collapsed to this angle)
    · = inactive guide (still in superposition)
    ◎ = centre (eternal-space origin)
    ◀ / ▶ = L1 / R1 step direction
    """
    import math

    W, H = 48, 15
    cx, cy = W // 2, H // 2
    Rx, Ry = 20, 6  # char aspect ≈ 3.3:1

    grid = [[" "] * W for _ in range(H)]

    active_a = set(result.get("active_guides_a", []))
    active_b = set(result.get("active_guides_b", []))

    for g in GUIDES:
        name, team, angle_deg, _ = g
        rad = math.radians(angle_deg - 90)  # 0° at top
        x = round(cx + Rx * math.cos(rad))
        y = round(cy + Ry * math.sin(rad))
        x, y = max(0, min(W - 5, x)), max(0, min(H - 1, y))

        sym = "★" if name in (active_a | active_b) else "·"
        label = f"{sym}{'A' if team == 'A' else 'B'}{angle_deg:>3}°"
        for i, ch in enumerate(label):
            if x + i < W:
                grid[y][x + i] = ch

    # centre
    grid[cy][cx] = "◎"

    # teleport angle needles
    for ang, marker in [
        (result.get("teleport_angle_a", 0), "→A"),
        (result.get("teleport_angle_b", 0), "→B"),
    ]:
        rad = math.radians(ang - 90)
        nx = round(cx + (Rx * 0.55) * math.cos(rad))
        ny = round(cy + (Ry * 0.55) * math.sin(rad))
        nx, ny = max(0, min(W - 3, nx)), max(0, min(H - 1, ny))
        for i, ch in enumerate(marker):
            if nx + i < W:
                grid[ny][nx + i] = ch

    # ladder hint row
    ring_row = "  ◀L1 "
    for g in GUIDES:
        _, team, ang, _ = g
        sym = "●" if g[0] in (active_a | active_b) else "○"
        ring_row += f"{sym} "
    ring_row += "R1▶"

    lines = ["  " + "─" * (W - 2)] + ["".join(row) for row in grid] + ["  " + "─" * (W - 2), ring_row]

    ta = result.get("teleport_angle_a", 0)
    tb = result.get("teleport_angle_b", 0)
    events = [k for k, v in result.get("events", {}).items() if v]
    lines += [
        f"  A(スハル)  テレポート: {ta:>7.2f}°   B(リナリス) テレポート: {tb:>7.2f}°",
        f"  イベント: {', '.join(events) if events else 'none'}",
    ]
    return "\n".join(lines)
