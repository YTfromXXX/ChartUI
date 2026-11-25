"""
cure_oracle/verify.py — receipt validation and Merkle proof verification.

Supports three receipt versions:
  sig-receipt/1   (8  claims, QPU)
  bmi-receipt/1   (11 claims, BMI)
  space-receipt/1 (11 claims, Space sensor)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Sequence

# ── import shared internals from existing modules ──────────────────────────────
from cure_oracle.bmi import (
    _claim_record as _bmi_claim_record,
    _receipt_leaf  as _bmi_leaf,
    _receipt_pair  as _bmi_pair,
    _receipt_tree  as _bmi_tree,
    BMI_RECEIPT_VERSION,
    _BMI_SIG_INDEX,
    _CLAIM_TYPES as _BMI_CLAIM_TYPES,
)
from cure_oracle.space_sensor import (
    _claim_record as _space_claim_record,
    _receipt_leaf  as _space_leaf,
    _receipt_pair  as _space_pair,
    _receipt_tree  as _space_tree,
    SPACE_RECEIPT_VERSION,
    _SPACE_SIG_INDEX,
    _CLAIM_TYPES as _SPACE_CLAIM_TYPES,
)

# ── constants ──────────────────────────────────────────────────────────────────

SIG_RECEIPT_VERSION = "sig-receipt/1"

# SIG code regexes per version
_SIG_PATTERNS: dict[str, re.Pattern] = {
    SIG_RECEIPT_VERSION:   re.compile(
        r"^(CUBE|RING|TREE|LINE|STAR)-(φ\.618|π\.785|√\.414)-ε\.\d{3}$"
    ),
    BMI_RECEIPT_VERSION:   re.compile(
        r"^(DELTA|THETA|ALPHA|BETA|GAMMA)-(φ\.618|π\.785|√\.414)-ε\.(005|010|020|040)$"
    ),
    SPACE_RECEIPT_VERSION: re.compile(
        r"^(MAGNET|ACCEL|GYRO|GRAVITY|ATOMIC)-(φ\.618|π\.785|√\.414)-ε\.(001|003|010|030)$"
    ),
}

# SIG field name per version
_SIG_FIELD: dict[str, str] = {
    SIG_RECEIPT_VERSION:   "sig",
    BMI_RECEIPT_VERSION:   "band_sig",
    SPACE_RECEIPT_VERSION: "cal_sig",
}

# Claim type maps (name → index) per version
_CLAIM_TYPES_MAP: dict[str, dict[str, int]] = {
    SIG_RECEIPT_VERSION: {
        "cert_id": 0, "born_at": 1, "backend": 2, "sig": 3,
        "theta_q": 4, "mente": 5, "shot_count": 6, "circuit_hash": 7,
    },
    BMI_RECEIPT_VERSION:   dict(_BMI_CLAIM_TYPES),
    SPACE_RECEIPT_VERSION: dict(_SPACE_CLAIM_TYPES),
}

_SIG_INDEX: dict[str, int] = {
    SIG_RECEIPT_VERSION:   3,
    BMI_RECEIPT_VERSION:   _BMI_SIG_INDEX,
    SPACE_RECEIPT_VERSION: _SPACE_SIG_INDEX,
}

_HEX16_RE = re.compile(r"^[0-9a-f]{16}$")
_HEX32_RE = re.compile(r"^0x[0-9a-f]{32}$")
_HEX64_RE = re.compile(r"^0x[0-9a-f]{64}$")
_ISO8601_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$"
)

KNOWN_VERSIONS = frozenset(_SIG_PATTERNS)

# ── result dataclass ───────────────────────────────────────────────────────────

@dataclass
class VerifyResult:
    ok:       bool
    version:  str = ""
    errors:   list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def __str__(self) -> str:
        lines = [f"VerifyResult(ok={self.ok}, version={self.version!r})"]
        for e in self.errors:
            lines.append(f"  ERROR   {e}")
        for w in self.warnings:
            lines.append(f"  WARNING {w}")
        return "\n".join(lines)


# ── public API ─────────────────────────────────────────────────────────────────

def verify_receipt(receipt: dict) -> VerifyResult:
    """Fully validate a receipt dict: schema, field types, SIG code, Merkle root."""
    errors:   list[str] = []
    warnings: list[str] = []

    version = receipt.get("version", "")
    if version not in KNOWN_VERSIONS:
        return VerifyResult(
            ok=False, version=version,
            errors=[f"unknown version {version!r}; expected one of {sorted(KNOWN_VERSIONS)}"],
        )

    # dispatch per version
    if version == SIG_RECEIPT_VERSION:
        _validate_sig_fields(receipt, errors, warnings)
    elif version == BMI_RECEIPT_VERSION:
        _validate_bmi_fields(receipt, errors, warnings)
    elif version == SPACE_RECEIPT_VERSION:
        _validate_space_fields(receipt, errors, warnings)

    # common: Merkle root re-derivation
    if "claim_strings" in receipt and "merkle" in receipt:
        _validate_merkle_root(receipt, version, errors)
    else:
        warnings.append("claim_strings or merkle block missing — skipping root re-derivation")

    return VerifyResult(
        ok=len(errors) == 0,
        version=version,
        errors=errors,
        warnings=warnings,
    )


def verify_sig_code(sig: str, version: str) -> bool:
    """Return True if sig matches the SIG code pattern for the given receipt version."""
    pattern = _SIG_PATTERNS.get(version)
    if pattern is None:
        raise ValueError(f"unknown version: {version!r}")
    return bool(pattern.match(sig))


def verify_proof(
    leaf_hex: str,
    proof_path: Sequence[str],
    root_hex: str,
    version: str,
) -> bool:
    """Verify a single Merkle proof path for any receipt version."""
    pair_fn = _pair_fn(version)
    h = bytes.fromhex(leaf_hex[2:])
    for p_hex in proof_path:
        h = pair_fn(h, bytes.fromhex(p_hex[2:]))
    return "0x" + h.hex() == root_hex.lower()


def verify_disclosed(disclosed_item: dict, root_hex: str, version: str) -> bool:
    """Verify one selective-disclosure item (from reveal_claims / downlink_phase2)."""
    return verify_proof(
        disclosed_item["leaf"],
        disclosed_item["proof"],
        root_hex,
        version,
    )


# ── field validators ───────────────────────────────────────────────────────────

def _validate_sig_fields(r: dict, errors: list, warnings: list) -> None:
    _require_hex16(r, "cert_id",      errors)
    _require_iso8601(r, "born_at",    errors, warnings)
    _require_nonempty_str(r, "backend", errors)
    _require_sig_code(r, "sig", SIG_RECEIPT_VERSION, errors)
    _require_float_range(r, "theta_q",    0.0, 1.0,   errors)
    _require_float_positive(r, "mente",   errors)
    _require_int_range(r, "shot_count",   1, 8192,    errors)
    _require_hex64(r, "circuit_hash",     errors)
    _require_claim_strings(r, 8, errors)


def _validate_bmi_fields(r: dict, errors: list, warnings: list) -> None:
    _require_hex16(r, "session_id",       errors)
    _require_iso8601(r, "recorded_at",    errors, warnings)
    _require_nonempty_str(r, "device_id", errors)
    _require_sig_code(r, "band_sig", BMI_RECEIPT_VERSION, errors)
    _require_float_range(r, "impedance_kohm", 0.1, 100.0, errors)
    _require_float_positive(r, "coherence", errors)
    _require_float_positive(r, "net_seconds", errors)
    _require_hex64(r, "eeg_hash",         errors)
    _require_hex64(r, "consent_hash",     errors)
    _require_hex32_pseudonym(r, "subject_pseudonym", errors)
    _require_nonempty_str(r, "protocol_id", errors)
    if r.get("protocol_id", "").startswith("IRB") is False:
        warnings.append("protocol_id does not start with 'IRB' — confirm format")
    _require_claim_strings(r, 11, errors)


def _validate_space_fields(r: dict, errors: list, warnings: list) -> None:
    _require_hex16(r, "packet_id",        errors)
    _require_iso8601(r, "measured_at",    errors, warnings)
    _require_nonempty_str(r, "sensor_id", errors)
    _require_sig_code(r, "cal_sig", SPACE_RECEIPT_VERSION, errors)
    _require_float(r, "thermal_noise_db", errors)
    if "thermal_noise_db" in r and r["thermal_noise_db"] > 0:
        warnings.append("thermal_noise_db > 0 dBm is unusually high — verify units")
    _require_float_positive(r, "cross_cal_score", errors)
    _require_float_positive(r, "integration_s",   errors)
    _require_hex64(r, "telemetry_hash",   errors)
    _require_hex64(r, "calibration_hash", errors)
    _require_nonempty_str(r, "orbit_id",  errors)
    _require_nonempty_str(r, "ground_station", errors)
    _require_claim_strings(r, 11, errors)


# ── Merkle root re-derivation ──────────────────────────────────────────────────

def _validate_merkle_root(r: dict, version: str, errors: list) -> None:
    claim_strings = r["claim_strings"]
    claim_types   = _CLAIM_TYPES_MAP[version]
    claim_fn      = _claim_fn(version)
    leaf_fn       = _leaf_fn(version)
    tree_fn       = _tree_fn(version)

    names = list(claim_types.keys())
    if len(claim_strings) != len(names):
        errors.append(
            f"claim_strings length {len(claim_strings)} != expected {len(names)}"
        )
        return

    records = [
        claim_fn(claim_types[name], claim_strings[i])
        for i, name in enumerate(names)
    ]
    levels   = tree_fn(records)
    computed = "0x" + levels[-1][0].hex()
    stored   = r["merkle"]["root"]

    if computed.lower() != stored.lower():
        errors.append(
            f"Merkle root mismatch: computed {computed} != stored {stored}"
        )


# ── primitive validators ───────────────────────────────────────────────────────

def _require_hex16(r, key, errors):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
    elif not isinstance(v, str) or not _HEX16_RE.match(v):
        errors.append(f"{key}: expected 16 hex chars, got {v!r}")


def _require_iso8601(r, key, errors, warnings):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
        return
    if not isinstance(v, str) or not _ISO8601_RE.match(v):
        errors.append(f"{key}: not ISO 8601 with timezone, got {v!r}")
        return
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if dt > datetime.now(dt.tzinfo):
            warnings.append(f"{key}: timestamp is in the future ({v})")
    except ValueError as exc:
        errors.append(f"{key}: parse error — {exc}")


def _require_nonempty_str(r, key, errors):
    v = r.get(key)
    if not isinstance(v, str) or not v.strip():
        errors.append(f"{key}: expected non-empty string, got {v!r}")


def _require_sig_code(r, key, version, errors):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
        return
    if not verify_sig_code(str(v), version):
        errors.append(f"{key}: SIG code {v!r} does not match pattern for {version}")


def _require_float(r, key, errors):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
    elif not isinstance(v, (int, float)) or v != v:  # NaN check
        errors.append(f"{key}: expected finite float, got {v!r}")


def _require_float_range(r, key, lo, hi, errors):
    _require_float(r, key, errors)
    v = r.get(key)
    if isinstance(v, (int, float)) and not (lo <= v <= hi):
        errors.append(f"{key}: {v} out of range [{lo}, {hi}]")


def _require_float_positive(r, key, errors):
    _require_float(r, key, errors)
    v = r.get(key)
    if isinstance(v, (int, float)) and v <= 0:
        errors.append(f"{key}: must be > 0, got {v}")


def _require_int_range(r, key, lo, hi, errors):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
    elif not isinstance(v, int) or isinstance(v, bool):
        errors.append(f"{key}: expected int, got {type(v).__name__}")
    elif not (lo <= v <= hi):
        errors.append(f"{key}: {v} out of range [{lo}, {hi}]")


def _require_hex64(r, key, errors):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
    elif not isinstance(v, str) or not _HEX64_RE.match(v):
        errors.append(f"{key}: expected 0x + 64 hex chars, got {str(v)[:20]!r}…")


def _require_hex32_pseudonym(r, key, errors):
    v = r.get(key)
    if v is None:
        errors.append(f"{key}: missing")
    elif not isinstance(v, str) or not _HEX32_RE.match(v):
        errors.append(f"{key}: expected 0x + 32 hex chars (pseudonym), got {v!r}")


def _require_claim_strings(r, expected_count, errors):
    cs = r.get("claim_strings")
    if cs is None:
        errors.append("claim_strings: missing")
        return
    if not isinstance(cs, list):
        errors.append("claim_strings: expected list")
        return
    if len(cs) != expected_count:
        errors.append(
            f"claim_strings: length {len(cs)} != expected {expected_count}"
        )
    for i, s in enumerate(cs):
        if not isinstance(s, str):
            errors.append(f"claim_strings[{i}]: expected str, got {type(s).__name__}")


# ── internal dispatch helpers ──────────────────────────────────────────────────

def _claim_fn(version: str):
    if version == BMI_RECEIPT_VERSION:
        return _bmi_claim_record
    if version == SPACE_RECEIPT_VERSION:
        return _space_claim_record
    # sig-receipt/1 shares the same 50-byte layout; reuse bmi implementation
    return _bmi_claim_record


def _leaf_fn(version: str):
    if version == SPACE_RECEIPT_VERSION:
        return _space_leaf
    return _bmi_leaf


def _pair_fn(version: str):
    if version == SPACE_RECEIPT_VERSION:
        return _space_pair
    return _bmi_pair


def _tree_fn(version: str):
    if version == SPACE_RECEIPT_VERSION:
        return _space_tree
    return _bmi_tree
