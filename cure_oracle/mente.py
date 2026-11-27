"""MENTE orchestration layer.

MENTE (φ×√2 ≈ 2.2882) is the convergence threshold for BOX geometry:
when the total MENTE score of a 4-triangle batch reaches that value
the 四天王 (four heavenly kings) have all appeared and a birth
certificate is auto-issued.

Public API
----------
check_mente(triangles)
    Pure calculation — no I/O, no QPU.  Returns a MenteCheckResult.

issue_birth_on_mente(triangles, round_result, cert_path)
    If the batch achieves MENTE, issues the birth certificate + SIG receipts.
    Returns a MenteBirthResult (or None when not achieved).

MENTE_CONST     float   φ × √2 ≈ 2.2882
HEAVENLY_KINGS  dict    slot → kanji name
"""

from __future__ import annotations

import math
import pathlib
from dataclasses import dataclass, field
from typing import Optional

MENTE_CONST: float = 1.618 * math.sqrt(2)  # φ × √2 ≈ 2.2882

HEAVENLY_KINGS: dict[str, str] = {
    "S1": "多聞天",
    "S2": "増長天",
    "S3": "持国天",
    "S4": "広目天",
}


# ── data classes ──────────────────────────────────────────────────────────────

@dataclass
class MenteSlot:
    label:    str    # A / B / C / D
    slot:     str    # S1 / S2 / S3 / S4
    king:     str    # 多聞天 / 増長天 / 持国天 / 広目天
    sig:      str    # e.g. "CUBE-π.785-ε.019"
    mente:    float
    epsilon:  float
    shape:    str


@dataclass
class MenteCheckResult:
    slots:            list[MenteSlot]
    mente_total:      float
    mente_achieved:   bool
    mente_const:      float = field(default_factory=lambda: round(MENTE_CONST, 6))
    missing_kings:    list[str] = field(default_factory=list)   # slot codes not present


@dataclass
class MenteBirthResult:
    check:     MenteCheckResult
    cert:      dict
    receipts:  list[dict]           # one per SIG slot
    cert_path: str
    html_path: str


# ── pure calculation ──────────────────────────────────────────────────────────

def check_mente(triangles: list[dict]) -> MenteCheckResult:
    """Calculate MENTE for a batch of triangles.

    Each triangle dict must have ``q`` (float 0–1) and ``label`` (A/B/C/D).
    Returns a MenteCheckResult; no I/O, no QPU.
    """
    from cure_initial import meshmeta_to_sig, MeshBatchRequest, MeshTriangle

    mesh_tris = [MeshTriangle(q=float(t["q"]), label=str(t["label"]))
                 for t in triangles]
    batch_response = meshmeta_to_sig(MeshBatchRequest(triangles=mesh_tris))

    slots = [
        MenteSlot(
            label=s.label,
            slot=s.slot,
            king=HEAVENLY_KINGS.get(s.slot, s.slot),
            sig=s.sig,
            mente=s.mente,
            epsilon=s.epsilon,
            shape=s.shape,
        )
        for s in batch_response.sigs
    ]

    present_slots = {sl.slot for sl in slots}
    missing = [k for k in HEAVENLY_KINGS if k not in present_slots]

    return MenteCheckResult(
        slots=slots,
        mente_total=batch_response.mente_total,
        mente_achieved=batch_response.mente_achieved,
        missing_kings=missing,
    )


# ── auto-issuance ─────────────────────────────────────────────────────────────

def issue_birth_on_mente(
    triangles:    list[dict],
    round_result: dict,
    cert_path:    str = "cure_birth_certificate.json",
) -> Optional[MenteBirthResult]:
    """Issue a birth certificate when MENTE is achieved.

    Parameters
    ----------
    triangles    : list of {q, label} dicts (same as check_mente)
    round_result : dict returned by round_circuit() — provides QPU bitstring
                   and teleport angles for the certificate
    cert_path    : where to write cure_birth_certificate.json

    Returns
    -------
    MenteBirthResult when achieved, None otherwise.
    """
    check = check_mente(triangles)
    if not check.mente_achieved:
        return None

    from cure_oracle.birth import (
        make_certificate, save_certificate,
        certificate_html, make_sig_receipt,
    )

    cert = make_certificate(round_result)

    # attach MENTE metadata to the certificate
    cert["mente_total"]    = check.mente_total
    cert["mente_achieved"] = True
    cert["mente_const"]    = check.mente_const
    cert["四天王"] = {
        sl.slot: {
            "label": sl.label, "king": sl.king, "sig": sl.sig,
            "mente": sl.mente,
        }
        for sl in check.slots
    }

    p = pathlib.Path(cert_path)
    save_certificate(cert, str(p))

    html_path = str(p.with_suffix(".html"))
    p.with_suffix(".html").write_text(certificate_html(cert), encoding="utf-8")

    receipts = [
        make_sig_receipt(cert, sl.sig, sl.epsilon, sl.mente)
        for sl in check.slots
    ]

    return MenteBirthResult(
        check=check,
        cert=cert,
        receipts=receipts,
        cert_path=str(p),
        html_path=html_path,
    )
