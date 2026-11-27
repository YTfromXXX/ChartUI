"""BMI Merkle proof – brain-signal session certificate.

Analogous to cure_oracle/birth.py (QPU certificate) but for Brain-Machine
Interface recordings.  11 claims commit one EEG/neuro time-segment into a
Keccak-256 Merkle tree (OpenZeppelin sorted-pair, same double-hash leaf as
meshmeta_v2.py).

Claim layout
------------
  0  session_id        — unique session identifier (SHA-256 fingerprint)
  1  recorded_at       — ISO-8601 UTC timestamp of segment start
  2  device_id         — electrode array + amplifier model + firmware
  3  band_sig          — EEG quality code  BAND-θ_disp-ε.xxx  ← BMI SIG index
  4  impedance_kohm    — mean electrode impedance (kΩ, float string)
  5  coherence         — neural synchrony index φ×√2 × q × band_pts
  6  net_seconds       — effective recording seconds (after artefact removal)
  7  eeg_hash          — Keccak-256 of the raw EEG segment bytes
  8  consent_hash      — Keccak-256 of the signed consent document bytes
  9  subject_pseudonym — irreversible anonymous subject ID (SHA-256 of real ID)
 10  protocol_id       — IRB-approved trial protocol identifier

Band quality code format
------------------------
  BAND-θ_disp-ε.xxx

  Band  (dominant frequency, 5 tiers)
    DELTA  0.5–4 Hz    band_pts=1
    THETA  4–8 Hz      band_pts=2
    ALPHA  8–13 Hz     band_pts=3
    BETA   13–30 Hz    band_pts=4
    GAMMA  30+ Hz      band_pts=5

  θ_disp  (from coherence quality)
    φ.618   coherence ≥ 0.75
    π.785   coherence ≥ 0.50
    √.414   coherence < 0.50

  ε class  (from mean electrode impedance, kΩ)
    .005    < 5 kΩ   excellent
    .010    5–10 kΩ  good
    .020   10–20 kΩ  acceptable
    .040   > 20 kΩ   poor

Coherence score (analogous to MENTE)
--------------------------------------
  coherence_score = q × band_pts × (φ × √2)
  where q = normalised signal quality  ∈ [0,1]
        φ × √2 ≈ 2.2882  (MENTE constant, same as QPU system)
"""

from __future__ import annotations

import hashlib
import html as _html
import json
import math
from datetime import timezone, datetime
from typing import Sequence

# ── constants ────────────────────────────────────────────────────────────────

BMI_RECEIPT_VERSION = "bmi-receipt/1"
_CLAIM_VALUE_LEN    = 48    # bytes per 50-byte record (2-byte type prefix)
_BMI_SIG_INDEX      = 3     # claim index holding the band_sig code
_MENTE_CONST        = 1.618 * math.sqrt(2)   # φ × √2 ≈ 2.2882

_CLAIM_TYPES = {
    "session_id":       0,
    "recorded_at":      1,
    "device_id":        2,
    "band_sig":         3,
    "impedance_kohm":   4,
    "coherence":        5,
    "net_seconds":      6,
    "eeg_hash":         7,
    "consent_hash":     8,
    "subject_pseudonym":9,
    "protocol_id":      10,
}

# Band tier definitions: (min_hz, name, band_pts)
_BAND_TIERS: list[tuple[float, str, int]] = [
    (30.0, "GAMMA", 5),
    (13.0, "BETA",  4),
    ( 8.0, "ALPHA", 3),
    ( 4.0, "THETA", 2),
    ( 0.0, "DELTA", 1),
]

# θ-display from coherence quality
_THETA_DISP: list[tuple[float, str]] = [
    (0.75, "φ.618"),
    (0.50, "π.785"),
    (0.00, "√.414"),
]

# ε class from mean impedance (kΩ)
_IMP_CLASS: list[tuple[float, str]] = [
    ( 0.0, ".005"),
    ( 5.0, ".010"),
    (10.0, ".020"),
    (20.0, ".040"),
]


# ── keccak-256 (via meshmeta_v2) ─────────────────────────────────────────────

def _k256(data: bytes) -> bytes:
    from meshmeta_v2 import keccak256
    return keccak256(data)


# ── Merkle helpers (identical formula to birth.py / meshmeta_v2) ─────────────

def _claim_record(claim_type: int, value: str) -> bytes:
    """50-byte record: uint16(claim_type, big-endian) ‖ UTF-8 value null-padded to 48 B."""
    return claim_type.to_bytes(2, "big") + value.encode("utf-8")[:_CLAIM_VALUE_LEN].ljust(_CLAIM_VALUE_LEN, b"\x00")


def _receipt_leaf(index: int, record: bytes) -> bytes:
    """keccak256(keccak256(uint256(index) ‖ record50)) — OpenZeppelin leaf."""
    return _k256(_k256(index.to_bytes(32, "big") + record))


def _receipt_pair(a: bytes, b: bytes) -> bytes:
    return _k256(a + b if a <= b else b + a)


def _receipt_tree(claim_records: list[bytes]) -> list[list[bytes]]:
    level  = [_receipt_leaf(i, r) for i, r in enumerate(claim_records)]
    levels = [level]
    while len(level) > 1:
        level = [
            _receipt_pair(level[i], level[i + 1]) if i + 1 < len(level) else level[i]
            for i in range(0, len(level), 2)
        ]
        levels.append(level)
    return levels


def _receipt_proof(levels: list[list[bytes]], index: int) -> list[bytes]:
    out: list[bytes] = []
    for level in levels[:-1]:
        sib = index ^ 1
        if sib < len(level):
            out.append(level[sib])
        index //= 2
    return out


# ── band quality code ─────────────────────────────────────────────────────────

def _band_tier(dominant_hz: float) -> tuple[str, int]:
    for min_hz, name, pts in _BAND_TIERS:
        if dominant_hz >= min_hz:
            return name, pts
    return "DELTA", 1


def _theta_disp(coherence_q: float) -> str:
    for threshold, disp in _THETA_DISP:
        if coherence_q >= threshold:
            return disp
    return "√.414"


def _imp_class(impedance_kohm: float) -> str:
    cls = ".040"
    for threshold, code in _IMP_CLASS:
        if impedance_kohm >= threshold:
            cls = code
    return cls


def compute_band_sig(dominant_hz: float, coherence_q: float, impedance_kohm: float) -> dict:
    """Compute the band_sig code and coherence score from raw EEG metrics.

    Parameters
    ----------
    dominant_hz:      peak frequency of the EEG segment (Hz)
    coherence_q:      normalised signal quality [0, 1]
    impedance_kohm:   mean electrode impedance (kΩ)

    Returns
    -------
    dict with keys: band, band_pts, theta_disp, imp_class, sig, coherence_score
    """
    coherence_q = max(0.0, min(1.0, coherence_q))
    band, pts   = _band_tier(dominant_hz)
    theta       = _theta_disp(coherence_q)
    eps         = _imp_class(impedance_kohm)
    sig         = f"{band}-{theta}-ε{eps}"
    score       = round(coherence_q * pts * _MENTE_CONST, 6)
    return {
        "band":             band,
        "band_pts":         pts,
        "theta_disp":       theta,
        "imp_class":        eps,
        "sig":              sig,
        "coherence_score":  score,
    }


# ── EEG fingerprint ───────────────────────────────────────────────────────────

def eeg_fingerprint(segment_bytes: bytes) -> str:
    """Keccak-256 hash of a raw EEG segment as a 0x-prefixed hex string."""
    return "0x" + _k256(segment_bytes).hex()


def synthetic_eeg_segment(
    dominant_hz: float = 10.0,
    sample_rate: int   = 256,
    duration_s: float  = 1.0,
    channels: int      = 8,
    seed: int          = 42,
) -> bytes:
    """Generate a deterministic synthetic multi-channel EEG segment.

    Returns raw IEEE-754 float32 bytes (channels × samples, row-major).
    Suitable for fingerprinting; not a real EEG simulation.
    """
    import struct, random
    rng = random.Random(seed)
    n   = int(sample_rate * duration_s)
    out: list[float] = []
    for ch in range(channels):
        amp   = rng.uniform(10.0, 80.0)          # µV
        noise = rng.uniform(0.5, 5.0)
        phase = rng.uniform(0.0, 2 * math.pi)
        for i in range(n):
            t = i / sample_rate
            v = amp * math.sin(2 * math.pi * dominant_hz * t + phase)
            v += noise * rng.gauss(0.0, 1.0)
            out.append(v)
    return struct.pack(f">{len(out)}f", *out)


# ── session fingerprint ───────────────────────────────────────────────────────

def make_session_id(recorded_at: str, device_id: str, eeg_hash: str) -> str:
    """Deterministic 16-hex-char session ID, analogous to QPU certificate_id."""
    return hashlib.sha256(
        f"{recorded_at}:{device_id}:{eeg_hash}".encode()
    ).hexdigest()[:16]


# ── main receipt builder ──────────────────────────────────────────────────────

def make_bmi_receipt(
    *,
    recorded_at:        str,
    device_id:          str,
    dominant_hz:        float,
    coherence_q:        float,
    impedance_kohm:     float,
    net_seconds:        float,
    eeg_segment:        bytes,
    consent_document:   bytes,
    subject_real_id:    str,
    protocol_id:        str,
    private_key=None,
) -> dict:
    """Build an 11-claim Keccak-256 Merkle receipt for one BMI session segment.

    Parameters
    ----------
    recorded_at       ISO-8601 UTC string
    device_id         e.g. 'gtec-unicorn-16ch-fw2.3'
    dominant_hz       peak frequency of the EEG segment (Hz)
    coherence_q       normalised quality [0, 1]
    impedance_kohm    mean electrode impedance (kΩ)
    net_seconds       effective recording duration after artefact removal
    eeg_segment       raw EEG bytes for fingerprinting
    consent_document  consent PDF / text bytes for hashing
    subject_real_id   real subject identifier (hashed; never stored in receipt)
    protocol_id       IRB trial protocol ID
    private_key       optional Ed25519 private key for body signature

    Returns
    -------
    Full receipt dict with merkle root, proof path for band_sig (index 3),
    and all 11 claim values.
    """
    bsig       = compute_band_sig(dominant_hz, coherence_q, impedance_kohm)
    eeg_hash   = eeg_fingerprint(eeg_segment)
    cons_hash  = "0x" + _k256(consent_document).hex()
    pseudonym  = "0x" + hashlib.sha256(subject_real_id.encode()).hexdigest()[:32]
    session_id = make_session_id(recorded_at, device_id, eeg_hash)

    ordered_claims: list[tuple[int, str]] = [
        (0,  session_id),
        (1,  recorded_at),
        (2,  device_id),
        (3,  bsig["sig"]),
        (4,  f"{impedance_kohm:.4f}"),
        (5,  f"{bsig['coherence_score']:.6f}"),
        (6,  f"{net_seconds:.3f}"),
        (7,  eeg_hash),
        (8,  cons_hash),
        (9,  pseudonym),
        (10, protocol_id),
    ]

    recs     = [_claim_record(ct, val) for ct, val in ordered_claims]
    levels   = _receipt_tree(recs)
    root     = levels[-1][0]
    path     = _receipt_proof(levels, _BMI_SIG_INDEX)
    band_leaf = _receipt_leaf(_BMI_SIG_INDEX, recs[_BMI_SIG_INDEX])

    # Exact string values committed to the Merkle tree (index-ordered)
    claim_strings: list[str] = [v for _, v in ordered_claims]

    receipt: dict = {
        "version":          BMI_RECEIPT_VERSION,
        "session_id":       session_id,
        "recorded_at":      recorded_at,
        "device_id":        device_id,
        "band_sig":         bsig["sig"],
        "band":             bsig["band"],
        "band_pts":         bsig["band_pts"],
        "theta_disp":       bsig["theta_disp"],
        "impedance_kohm":   impedance_kohm,
        "coherence":        bsig["coherence_score"],
        "net_seconds":      net_seconds,
        "eeg_hash":         eeg_hash,
        "consent_hash":     cons_hash,
        "subject_pseudonym":pseudonym,
        "protocol_id":      protocol_id,
        "claim_strings":    claim_strings,
        "merkle": {
            "hash":       "keccak256",
            "leaf":       "keccak256(keccak256(uint256(index) ‖ uint16(type) ‖ value48))",
            "node":       "sorted-pair",
            "root":       "0x" + root.hex(),
            "claims":     len(recs),
            "sig_index":  _BMI_SIG_INDEX,
        },
        "proof": {
            "index": _BMI_SIG_INDEX,
            "path":  ["0x" + h.hex() for h in path],
            "leaf":  "0x" + band_leaf.hex(),
        },
    }

    if private_key is not None:
        try:
            from meshmeta_v2 import _jcs_encode
            body_bytes = _jcs_encode({k: v for k, v in receipt.items() if k != "signature"})
            sig_bytes  = private_key.sign(body_bytes)
            receipt["signature"] = {
                "alg":  "Ed25519",
                "hex":  "0x" + sig_bytes.hex(),
            }
        except Exception:
            pass

    return receipt


# ── selective disclosure helper ───────────────────────────────────────────────

def reveal_claims(receipt: dict, claim_names: list[str]) -> dict:
    """Return a minimal disclosure packet for the requested claim names.

    Contains only the claim values + their proof paths, no other claim values.
    Verifier can check each claim's inclusion in the same Merkle root.
    """
    # Use the exact strings committed to the tree (stored in claim_strings)
    all_vals: list[str] = receipt.get("claim_strings", [])
    if not all_vals:
        # Fallback: coerce receipt fields to string (may differ from tree values)
        ordered   = list(_CLAIM_TYPES.keys())
        all_vals  = [str(receipt.get(k, "")) for k in ordered]
    # Rebuild the full tree to get per-claim proofs
    recs   = [_claim_record(i, v) for i, v in enumerate(all_vals)]
    levels = _receipt_tree(recs)

    disclosed: list[dict] = []
    for name in claim_names:
        idx = _CLAIM_TYPES.get(name)
        if idx is None:
            continue
        proof = _receipt_proof(levels, idx)
        leaf  = _receipt_leaf(idx, recs[idx])
        disclosed.append({
            "claim":  name,
            "index":  idx,
            "value":  all_vals[idx],
            "leaf":   "0x" + leaf.hex(),
            "proof":  ["0x" + h.hex() for h in proof],
        })

    return {
        "version":        BMI_RECEIPT_VERSION,
        "session_id":     receipt["session_id"],
        "merkle_root":    receipt["merkle"]["root"],
        "disclosed":      disclosed,
    }


# ── demo builder ──────────────────────────────────────────────────────────────

def make_demo_receipt(
    dominant_hz: float    = 10.0,
    coherence_q: float    = 0.82,
    impedance_kohm: float = 3.5,
    net_seconds: float    = 4.0,
    seed: int             = 42,
) -> dict:
    """Convenience wrapper that builds a receipt from synthetic data."""
    recorded_at = "2026-11-24T09:00:00+00:00"
    device_id   = "gtec-unicorn-16ch-fw2.3"
    protocol_id = "IRB-2026-BMI-042"

    eeg_seg  = synthetic_eeg_segment(
        dominant_hz=dominant_hz, sample_rate=256, duration_s=net_seconds,
        channels=16, seed=seed,
    )
    consent  = "BMI研究同意書 v1.0 / IRB-2026-BMI-042 / 2026-11-24".encode("utf-8")
    subject  = f"SUBJECT-DEMO-{seed:04d}"

    return make_bmi_receipt(
        recorded_at=recorded_at,
        device_id=device_id,
        dominant_hz=dominant_hz,
        coherence_q=coherence_q,
        impedance_kohm=impedance_kohm,
        net_seconds=net_seconds,
        eeg_segment=eeg_seg,
        consent_document=consent,
        subject_real_id=subject,
        protocol_id=protocol_id,
    )
