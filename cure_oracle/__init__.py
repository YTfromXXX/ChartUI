"""cure-oracle: the pure-Python core of ChartUI / METADOGG ORACLE.

    pip install cure-oracle            # knots, .meshmeta
    pip install "cure-oracle[sign]"    # + Ed25519 signatures on .meshmeta
    pip install "cure-oracle[api]"     # + the FastAPI cure-initial/1 router

The modules keep their repository names so the app and the package share one copy of the code.
"""

from __future__ import annotations

import importlib

__version__ = "0.1.0"
__all__ = ["knot_crossings", "mesh_meta", "cure_initial", "__version__"]


def __getattr__(name: str):  # lazy: cure_initial needs FastAPI, the others need nothing
    if name in ("knot_crossings", "mesh_meta", "cure_initial"):
        return importlib.import_module(name)
    raise AttributeError(name)
