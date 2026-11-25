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

# knot_crossings public API
from knot_crossings import (  # noqa: E402
    find_crossings,
    writhe,
    segment_intersection,
)

# mesh_meta public API
from mesh_meta import (  # noqa: E402
    build_meshmeta,
    dumps_meshmeta,
    sign_meshmeta,
    verify_meshmeta,
    read_stl,
    write_stl,
    parse_data,
    format_data,
)

# verify public API
from cure_oracle.verify import (  # noqa: E402
    VerifyResult,
    KNOWN_VERSIONS,
    SIG_RECEIPT_VERSION,
    verify_receipt,
    verify_sig_code,
    verify_proof,
    verify_disclosed,
)

_LAZY_MODULES = {
    "knot_crossings": "knot_crossings",
    "mesh_meta":      "mesh_meta",
    "cure_initial":   "cure_initial",
    "bmi":            "cure_oracle.bmi",
    "space_sensor":   "cure_oracle.space_sensor",
    "verify":         "cure_oracle.verify",
}


def __getattr__(name: str):
    if name in _LAZY_MODULES:
        return importlib.import_module(_LAZY_MODULES[name])
    raise AttributeError(name)
