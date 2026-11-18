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

    Tries ibm_quantum_platform (CRN) first, falls back to ibm_quantum
    (hub/group/project) for Open Plan accounts that use the old format.
    Token is dropped from memory immediately after service creation.
    """
    from qiskit_ibm_runtime import QiskitRuntimeService

    # Determine channel: CRN strings start with "crn:"
    if instance.startswith("crn:"):
        channel = "ibm_quantum_platform"
    else:
        channel = "ibm_quantum"

    service = QiskitRuntimeService(channel=channel, token=token, instance=instance)
    token = None  # drop reference immediately

    # Try without operational filter first (Open Plan returns all accessible
    # backends; filter by status after the fact to avoid empty results)
    try:
        all_bk = service.backends()
    except Exception:
        all_bk = []

    if not all_bk:
        # Fallback: try with operational filter in case the above is too broad
        try:
            all_bk = service.backends(operational=True)
        except Exception:
            all_bk = []

    qpu_bk = [b for b in all_bk if not getattr(b, "simulator", True)]
    sim_bk = [b for b in all_bk if getattr(b, "simulator", False)]

    lb = None
    try:
        lb = service.least_busy(operational=True, simulator=False, min_num_qubits=13)
    except Exception:
        pass

    # Build backend detail list: name + queue depth
    def _bk_info(b):
        q = None
        try:
            q = b.status().pending_jobs
        except Exception:
            pass
        return {"name": b.name, "qubits": getattr(b, "num_qubits", "?"), "queue": q}

    return {
        "channel":           channel,
        "instance":          instance,
        "accessible":        True,
        "qpu_backends":      [_bk_info(b) for b in qpu_bk],
        "sim_backends":      [b.name for b in sim_bk],
        "least_busy_13q":    lb.name if lb else None,
        "qpu_count":         len(qpu_bk),
        "total_backends":    len(all_bk),
    }
