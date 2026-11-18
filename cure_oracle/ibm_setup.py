"""IBM Quantum instance setup and verification for Cure-API.

Usage:
    from cure_oracle.ibm_setup import credentials_status, verify_instance

CLI:
    cure ibm-setup             # show credential status
    cure ibm-setup --verify    # connect and list QPU backends
"""

from __future__ import annotations

import os


def credentials_status() -> dict:
    """Return whether IBM_QUANTUM_TOKEN and IBM_QUANTUM_INSTANCE are set."""
    token    = os.environ.get("IBM_QUANTUM_TOKEN")
    instance = os.environ.get("IBM_QUANTUM_INSTANCE")
    return {
        "token_set":    bool(token),
        "instance_set": bool(instance),
        "instance":     instance or "(not set)",
        "ready":        bool(token and instance),
    }


def verify_instance(token: str, instance: str) -> dict:
    """Connect to IBM Quantum Platform and report accessible QPU backends.

    Token is dropped from memory immediately after service creation.
    """
    from qiskit_ibm_runtime import QiskitRuntimeService
    service = QiskitRuntimeService(
        channel="ibm_quantum_platform", token=token, instance=instance
    )
    token = None  # drop reference immediately

    all_bk   = service.backends(operational=True)
    qpu_bk   = [b for b in all_bk if not b.simulator]
    sim_bk   = [b for b in all_bk if b.simulator]

    lb = None
    try:
        lb = service.least_busy(operational=True, simulator=False, min_num_qubits=13)
    except Exception:
        pass

    return {
        "instance":          instance,
        "accessible":        True,
        "qpu_backends":      [b.name for b in qpu_bk],
        "sim_backends":      [b.name for b in sim_bk],
        "least_busy_13q":    lb.name if lb else None,
        "qpu_count":         len(qpu_bk),
    }
