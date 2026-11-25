"""cure-oracle: the pure-Python core of ChartUI / METADOGG ORACLE.

    pip install cure-oracle            # knots, .meshmeta
    pip install "cure-oracle[sign]"    # + Ed25519 signatures on .meshmeta
    pip install "cure-oracle[api]"     # + the FastAPI cure-initial/1 router
    pip install "cure-oracle[quantum]" # + Qiskit: the resonance Max-Cut (cure_oracle.resonance)

The modules keep their repository names so the app and the package share one copy of the code.
"""

from __future__ import annotations

import importlib

__version__ = "0.3.2"
__all__ = [
    "knot_crossings", "mesh_meta", "cure_initial",
    "bmi", "space_sensor", "verify",
    "__version__",
]

# verify public API re-exported at package level
from cure_oracle.verify import (  # noqa: E402
    VerifyResult,
    KNOWN_VERSIONS,
    SIG_RECEIPT_VERSION,
    verify_receipt,
    verify_sig_code,
    verify_proof,
    verify_disclosed,
)


def __getattr__(name: str):  # lazy: cure_initial needs FastAPI, the others need nothing
    if name in ("knot_crossings", "mesh_meta", "cure_initial", "bmi", "space_sensor", "verify"):
        return importlib.import_module(f"cure_oracle.{name}" if name in ("bmi", "space_sensor", "verify") else name)
    raise AttributeError(name)
