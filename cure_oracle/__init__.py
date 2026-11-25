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
    # sub-modules (lazy)
    "knot_crossings", "mesh_meta", "cure_initial",
    "birth", "bmi", "space_sensor", "verify", "resonance",
    "round_circuit", "cli", "ibm_setup", "mail",
    # resonance
    "run", "circuit", "best_cut", "cut_value", "bits_of",
    "export_qasm", "ideal", "tune", "load",
    "CONFIRM",
    # round_circuit
    "round_circuit", "guide_angles", "spiral_preview",
    "EVENT_NAMES", "GUIDES", "N_EVENT", "N_GUIDE", "N_TOTAL",
    # cli
    "main",
    # ibm_setup
    "credentials_status", "verify_instance",
    # mail
    "deliver",
    # birth
    "make_certificate", "save_certificate", "load_certificate",
    "make_sig_receipt", "certificate_html", "receipt_html_section",
    "CERT_FILENAME",
    # knot_crossings
    "find_crossings", "writhe", "segment_intersection",
    # mesh_meta
    "build_meshmeta", "dumps_meshmeta", "sign_meshmeta", "verify_meshmeta",
    "read_stl", "write_stl", "parse_data", "format_data",
    # verify
    "VerifyResult", "KNOWN_VERSIONS", "SIG_RECEIPT_VERSION",
    "verify_receipt", "verify_sig_code", "verify_proof", "verify_disclosed",
    # cure_initial (lazy via __getattr__)
    "initial_analysis", "analyse", "q_to_sig", "meshmeta_to_sig",
    "sig_receipt", "scores_of",
    "InitialAnalysis", "InitialSignals", "SIGCode", "Grade",
    "SigReceiptRequest", "SigReceiptResponse",
    "QToSigRequest", "MerkleInfo", "ProofInfo",
    "MeshBatchRequest", "MeshBatchResponse", "MeshTriangle",
    "SyncDirective", "SplitPart",
    "SCHEMA_VERSION", "GRADE_INFO", "COMPONENT_OF", "SPLIT", "SPLIT_TOTAL",
    "router",
    "__version__",
]

# resonance public API (Qiskit optional dependency — lazy)
_RESONANCE_EXPORTS = frozenset({
    "run", "circuit", "best_cut", "cut_value", "bits_of",
    "export_qasm", "ideal", "tune", "load", "CONFIRM",
})

# birth public API
from cure_oracle.birth import (  # noqa: E402
    make_certificate,
    save_certificate,
    load_certificate,
    make_sig_receipt,
    certificate_html,
    receipt_html_section,
    CERT_FILENAME,
)

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
    "birth":          "cure_oracle.birth",
    "bmi":            "cure_oracle.bmi",
    "cli":            "cure_oracle.cli",
    "ibm_setup":      "cure_oracle.ibm_setup",
    "mail":           "cure_oracle.mail",
    "resonance":      "cure_oracle.resonance",
    "round_circuit":  "cure_oracle.round_circuit",
    "space_sensor":   "cure_oracle.space_sensor",
    "verify":         "cure_oracle.verify",
}

_IBM_SETUP_EXPORTS = frozenset({"credentials_status", "verify_instance"})
_MAIL_EXPORTS      = frozenset({"deliver"})

_ROUND_CIRCUIT_EXPORTS = frozenset({
    "round_circuit", "guide_angles", "spiral_preview",
    "EVENT_NAMES", "GUIDES", "N_EVENT", "N_GUIDE", "N_TOTAL",
})

_CLI_EXPORTS = frozenset({"main"})

# cure_initial names exported lazily (FastAPI optional dependency)
_CURE_INITIAL_EXPORTS = frozenset({
    # core functions
    "initial_analysis", "analyse", "q_to_sig", "meshmeta_to_sig",
    "sig_receipt", "scores_of",
    # Pydantic models / request-response
    "InitialAnalysis", "InitialSignals", "SIGCode", "Grade",
    "SigReceiptRequest", "SigReceiptResponse",
    "QToSigRequest", "MerkleInfo", "ProofInfo",
    "MeshBatchRequest", "MeshBatchResponse", "MeshTriangle",
    "SyncDirective", "SplitPart",
    # constants
    "SCHEMA_VERSION", "GRADE_INFO", "COMPONENT_OF", "SPLIT", "SPLIT_TOTAL",
    # FastAPI router (optional)
    "router",
})


def __getattr__(name: str):
    if name in _LAZY_MODULES:
        return importlib.import_module(_LAZY_MODULES[name])
    if name in _CURE_INITIAL_EXPORTS:
        mod = importlib.import_module("cure_initial")
        return getattr(mod, name)
    if name in _RESONANCE_EXPORTS:
        mod = importlib.import_module("cure_oracle.resonance")
        return getattr(mod, name)
    if name in _ROUND_CIRCUIT_EXPORTS:
        mod = importlib.import_module("cure_oracle.round_circuit")
        return getattr(mod, name)
    if name in _CLI_EXPORTS:
        mod = importlib.import_module("cure_oracle.cli")
        return getattr(mod, name)
    if name in _IBM_SETUP_EXPORTS:
        mod = importlib.import_module("cure_oracle.ibm_setup")
        return getattr(mod, name)
    if name in _MAIL_EXPORTS:
        mod = importlib.import_module("cure_oracle.mail")
        return getattr(mod, name)
    raise AttributeError(name)
