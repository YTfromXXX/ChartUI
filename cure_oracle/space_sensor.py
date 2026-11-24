"""Space sensor Merkle receipt — satellite telemetry provenance certificate.

Analogous to cure_oracle/bmi.py but for satellite / quantum-sensor data.
11 claims commit one telemetry segment into a Keccak-256 Merkle tree
(OpenZeppelin sorted-pair, same double-hash leaf as meshmeta_v2.py).

Bandwidth-constrained downlink protocol
----------------------------------------
Downlink bandwidth is precious on small satellites.  The 3-phase design
lets a ground station receive the minimum proof immediately, then pull only
the claims it needs later.

  Phase 1  (real-time, 32 B)   : Merkle root only
  Phase 2  (delayed, ~200 B)   : requested claims + proof paths
  Phase 3  (archive, ~550 B)   : all 11 claim strings

Claim layout
------------
  0  packet_id         — unique packet identifier (SHA-256 fingerprint)
  1  measured_at       — GPS-synced UTC ISO-8601 timestamp (atomic-clock precision)
  2  sensor_id         — sensor type + model + serial-number string
  3  cal_sig           — calibration state code  SENSOR-θ_disp-ε.xxx  ← SPACE SIG index
  4  thermal_noise_db  — thermal noise floor (dBm, float string)
  5  cross_cal_score   — multi-sensor self-consistency score (φ×√2 · q · pts)
  6  integration_s     — measurement window length (seconds)
  7  telemetry_hash    — Keccak-256 of the raw telemetry segment bytes
  8  calibration_hash  — Keccak-256 of the active calibration file bytes
  9  orbit_id          — NORAD satellite ID + TLE epoch + orbit number
 10  ground_station    — ground station identifier that downlinked this pass

Calibration state code format
------------------------------
  SENSOR-θ_disp-ε.xxx

  Sensor tier  (by physical domain, 5 levels)
    MAGNET   magnetometer / fluxgate        pts=1
    ACCEL    accelerometer / IMU            pts=2
    GYRO     gyroscope / star-tracker       pts=3
    GRAVITY  gravimeter / gradiometer       pts=4
    ATOMIC   atomic interferometer / clock  pts=5

  θ_disp  (from cross-calibration quality q)
    φ.618   q ≥ 0.75  — excellent, all sensors agree
    π.785   q ≥ 0.50  — good
    √.414   q < 0.50  — marginal

  ε class  (from thermal noise floor, dBm)
    .001    > −120 dBm   cryogenic / very low noise
    .003    > −110 dBm   standard low noise
    .010    > −100 dBm   moderate (LEO radiation exposure)
    .030    > − 90 dBm   elevated SEU rate / high noise

Cross-calibration score (analogous to QPU MENTE / BMI coherence)
-----------------------------------------------------------------
  cross_cal_score = q × sensor_pts × (φ × √2)
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
import random
from typing import Sequence

# ── constants ────────────────────────────────────────────────────────────────

SPACE_RECEIPT_VERSION = "space-receipt/1"
_CLAIM_VALUE_LEN      = 48
_SPACE_SIG_INDEX      = 3     # cal_sig holds the calibration state code
_MENTE_CONST          = 1.618 * math.sqrt(2)   # φ × √2 ≈ 2.2882

_CLAIM_TYPES: dict[str, int] = {
    "packet_id":        0,
    "measured_at":      1,
    "sensor_id":        2,
    "cal_sig":          3,
    "thermal_noise_db": 4,
    "cross_cal_score":  5,
    "integration_s":    6,
    "telemetry_hash":   7,
    "calibration_hash": 8,
    "orbit_id":         9,
    "ground_station":   10,
}

# Sensor tier: (keyword match, name, pts)
_SENSOR_TIERS: list[tuple[str, str, int]] = [
    ("atomic",   "ATOMIC",  5),   # atomic clock / atomic interferometer
    ("gravi",    "GRAVITY", 4),   # gravimeter / gradiometer (checked before "atom")
    ("atom",     "ATOMIC",  5),   # bare "atom" after gravi is excluded
    ("gyro",     "GYRO",    3),
    ("star",     "GYRO",    3),   # star-tracker
    ("accel",    "ACCEL",   2),
    ("imu",      "ACCEL",   2),
    ("magnet",   "MAGNET",  1),
    ("flux",     "MAGNET",  1),
]

# θ_disp from cross-calibration quality
_THETA_DISP: list[tuple[float, str]] = [
    (0.75, "φ.618"),
    (0.50, "π.785"),
    (0.00, "√.414"),
]

# ε class from thermal noise floor (dBm, higher = more noise)
# stored as (threshold_dBm, class_str); first match where noise_dbm >= threshold
_NOISE_CLASS: list[tuple[float, str]] = [
    (-90.0,  ".030"),
    (-100.0, ".010"),
    (-110.0, ".003"),
    (-200.0, ".001"),   # catch-all for very low noise
]


# ── keccak-256 ────────────────────────────────────────────────────────────────

def _k256(data: bytes) -> bytes:
    from meshmeta_v2 import keccak256
    return keccak256(data)


# ── Merkle helpers (identical formula to birth.py / bmi.py) ──────────────────

def _claim_record(claim_type: int, value: str) -> bytes:
    """50-byte record: uint16(claim_type, big-endian) ‖ UTF-8 value null-padded to 48 B."""
    return claim_type.to_bytes(2, "big") + value.encode("utf-8")[:_CLAIM_VALUE_LEN].ljust(_CLAIM_VALUE_LEN, b"\x00")


def _receipt_leaf(index: int, record: bytes) -> bytes:
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


# ── calibration state code ────────────────────────────────────────────────────

def _sensor_tier(sensor_id: str) -> tuple[str, int]:
    """Infer sensor tier from sensor_id string (case-insensitive keyword match)."""
    s = sensor_id.lower()
    for kw, name, pts in _SENSOR_TIERS:
        if kw in s:
            return name, pts
    return "MAGNET", 1  # fallback


def _theta_disp(cross_cal_q: float) -> str:
    for threshold, disp in _THETA_DISP:
        if cross_cal_q >= threshold:
            return disp
    return "√.414"


def _noise_class(thermal_noise_db: float) -> str:
    for threshold, cls in _NOISE_CLASS:
        if thermal_noise_db >= threshold:
            return cls
    return ".001"


def compute_cal_sig(
    sensor_id: str,
    cross_cal_q: float,
    thermal_noise_db: float,
) -> dict:
    """Compute the calibration state code and cross-calibration score.

    Parameters
    ----------
    sensor_id:         sensor identifier string (used for tier inference)
    cross_cal_q:       normalised cross-calibration quality [0, 1]
    thermal_noise_db:  thermal noise floor in dBm (e.g. -115.0)

    Returns
    -------
    dict: sensor_name, sensor_pts, theta_disp, noise_class, sig, cross_cal_score
    """
    cross_cal_q = max(0.0, min(1.0, cross_cal_q))
    sensor_name, pts = _sensor_tier(sensor_id)
    theta        = _theta_disp(cross_cal_q)
    eps          = _noise_class(thermal_noise_db)
    sig          = f"{sensor_name}-{theta}-ε{eps}"
    score        = round(cross_cal_q * pts * _MENTE_CONST, 6)
    return {
        "sensor_name":    sensor_name,
        "sensor_pts":     pts,
        "theta_disp":     theta,
        "noise_class":    eps,
        "sig":            sig,
        "cross_cal_score": score,
    }


# ── telemetry fingerprint ─────────────────────────────────────────────────────

def telemetry_fingerprint(segment_bytes: bytes) -> str:
    """Keccak-256 of a raw telemetry segment as a 0x-prefixed hex string."""
    return "0x" + _k256(segment_bytes).hex()


def synthetic_telemetry_segment(
    sensor_type: str    = "atomic",
    sample_rate: int    = 10,
    duration_s: float   = 60.0,
    seed: int           = 7,
) -> bytes:
    """Generate deterministic synthetic sensor telemetry.

    Returns raw IEEE-754 float64 bytes (samples × 3 axes, row-major).
    Sample values are physically plausible but not accurate simulations.
    """
    rng = random.Random(seed)
    n   = int(sample_rate * duration_s)
    amp_map = {"atomic": 1e-9, "gravity": 1e-6, "gyro": 0.01, "accel": 1.0, "magnet": 50.0}
    amp = next((v for k, v in amp_map.items() if k in sensor_type.lower()), 1.0)
    out: list[float] = []
    for i in range(n):
        t = i / sample_rate
        for axis in range(3):
            v = amp * math.sin(2 * math.pi * 0.1 * t + axis * 1.047)
            v += amp * 0.01 * rng.gauss(0.0, 1.0)
            out.append(v)
    return struct.pack(f">{len(out)}d", *out)


# ── packet fingerprint ────────────────────────────────────────────────────────

def make_packet_id(measured_at: str, sensor_id: str, telemetry_hash: str) -> str:
    """Deterministic 16-hex-char packet ID."""
    return hashlib.sha256(
        f"{measured_at}:{sensor_id}:{telemetry_hash}".encode()
    ).hexdigest()[:16]


# ── main receipt builder ──────────────────────────────────────────────────────

def make_space_receipt(
    *,
    measured_at:         str,
    sensor_id:           str,
    cross_cal_q:         float,
    thermal_noise_db:    float,
    integration_s:       float,
    telemetry_segment:   bytes,
    calibration_file:    bytes,
    orbit_id:            str,
    ground_station:      str,
    private_key=None,
) -> dict:
    """Build an 11-claim Keccak-256 Merkle receipt for one telemetry segment.

    Parameters
    ----------
    measured_at         GPS-synced UTC ISO-8601 string
    sensor_id           e.g. 'honeywell-hmc5983-magnetometer-SN00142'
    cross_cal_q         cross-calibration quality [0, 1]
    thermal_noise_db    thermal noise floor (dBm, e.g. -115.0)
    integration_s       measurement window length in seconds
    telemetry_segment   raw sensor bytes for fingerprinting
    calibration_file    calibration binary / JSON for hashing
    orbit_id            e.g. 'NORAD-57166/TLE-2026-11-24T00:00:00Z/orbit-5842'
    ground_station      e.g. 'JAXA-Tsukuba'
    private_key         optional Ed25519 key for body signature

    Returns
    -------
    Full receipt dict with merkle root, proof path for cal_sig (index 3),
    all 11 claim values, and claim_strings for selective disclosure.
    """
    calsig     = compute_cal_sig(sensor_id, cross_cal_q, thermal_noise_db)
    tel_hash   = telemetry_fingerprint(telemetry_segment)
    cal_hash   = "0x" + _k256(calibration_file).hex()
    packet_id  = make_packet_id(measured_at, sensor_id, tel_hash)

    ordered_claims: list[tuple[int, str]] = [
        (0,  packet_id),
        (1,  measured_at),
        (2,  sensor_id),
        (3,  calsig["sig"]),
        (4,  f"{thermal_noise_db:.2f}"),
        (5,  f"{calsig['cross_cal_score']:.6f}"),
        (6,  f"{integration_s:.3f}"),
        (7,  tel_hash),
        (8,  cal_hash),
        (9,  orbit_id),
        (10, ground_station),
    ]

    recs     = [_claim_record(ct, val) for ct, val in ordered_claims]
    levels   = _receipt_tree(recs)
    root     = levels[-1][0]
    path     = _receipt_proof(levels, _SPACE_SIG_INDEX)
    cal_leaf = _receipt_leaf(_SPACE_SIG_INDEX, recs[_SPACE_SIG_INDEX])

    claim_strings: list[str] = [v for _, v in ordered_claims]

    receipt: dict = {
        "version":           SPACE_RECEIPT_VERSION,
        "packet_id":         packet_id,
        "measured_at":       measured_at,
        "sensor_id":         sensor_id,
        "cal_sig":           calsig["sig"],
        "sensor_name":       calsig["sensor_name"],
        "sensor_pts":        calsig["sensor_pts"],
        "theta_disp":        calsig["theta_disp"],
        "thermal_noise_db":  thermal_noise_db,
        "cross_cal_score":   calsig["cross_cal_score"],
        "integration_s":     integration_s,
        "telemetry_hash":    tel_hash,
        "calibration_hash":  cal_hash,
        "orbit_id":          orbit_id,
        "ground_station":    ground_station,
        "claim_strings":     claim_strings,
        "merkle": {
            "hash":       "keccak256",
            "leaf":       "keccak256(keccak256(uint256(index) ‖ uint16(type) ‖ value48))",
            "node":       "sorted-pair",
            "root":       "0x" + root.hex(),
            "claims":     len(recs),
            "sig_index":  _SPACE_SIG_INDEX,
        },
        "proof": {
            "index": _SPACE_SIG_INDEX,
            "path":  ["0x" + h.hex() for h in path],
            "leaf":  "0x" + cal_leaf.hex(),
        },
    }

    if private_key is not None:
        try:
            from meshmeta_v2 import _jcs_encode
            body_bytes = _jcs_encode({k: v for k, v in receipt.items() if k != "signature"})
            sig_bytes  = private_key.sign(body_bytes)
            receipt["signature"] = {"alg": "Ed25519", "hex": "0x" + sig_bytes.hex()}
        except Exception:
            pass

    return receipt


# ── bandwidth-constrained downlink protocol ───────────────────────────────────

def downlink_phase1(receipt: dict) -> dict:
    """Phase 1 — 32 bytes over real-time downlink: Merkle root only.

    The ground station records 'this measurement exists' without any data.
    """
    return {
        "phase":      1,
        "version":    receipt["version"],
        "packet_id":  receipt["packet_id"],
        "measured_at":receipt["measured_at"],
        "merkle_root":receipt["merkle"]["root"],
        "byte_budget": 32 + len(receipt["packet_id"]) + len(receipt["measured_at"]),
    }


def downlink_phase2(receipt: dict, claim_names: Sequence[str]) -> dict:
    """Phase 2 — selective claims with their Merkle proof paths.

    Returns only the requested claims; every claim's proof path verifies
    against the same root so the recipient doesn't need any other values.
    """
    all_vals = receipt.get("claim_strings", [])
    if not all_vals:
        ordered  = list(_CLAIM_TYPES.keys())
        all_vals = [str(receipt.get(k, "")) for k in ordered]

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
            "claim": name,
            "index": idx,
            "value": all_vals[idx],
            "leaf":  "0x" + leaf.hex(),
            "proof": ["0x" + h.hex() for h in proof],
        })

    total_bytes = sum(
        len(d["value"].encode()) + 32 + 32 * len(d["proof"])
        for d in disclosed
    )
    return {
        "phase":        2,
        "version":      receipt["version"],
        "packet_id":    receipt["packet_id"],
        "merkle_root":  receipt["merkle"]["root"],
        "disclosed":    disclosed,
        "byte_budget":  total_bytes,
    }


def downlink_phase3(receipt: dict) -> dict:
    """Phase 3 — full archive: all 11 claim strings + complete proof."""
    return {
        "phase":         3,
        "version":       receipt["version"],
        "packet_id":     receipt["packet_id"],
        "measured_at":   receipt["measured_at"],
        "sensor_id":     receipt["sensor_id"],
        "cal_sig":       receipt["cal_sig"],
        "thermal_noise_db": receipt["thermal_noise_db"],
        "cross_cal_score":  receipt["cross_cal_score"],
        "integration_s": receipt["integration_s"],
        "telemetry_hash":receipt["telemetry_hash"],
        "calibration_hash":receipt["calibration_hash"],
        "orbit_id":      receipt["orbit_id"],
        "ground_station":receipt["ground_station"],
        "merkle":        receipt["merkle"],
        "proof":         receipt["proof"],
        "claim_strings": receipt["claim_strings"],
        "byte_budget":   sum(len(s.encode()) for s in receipt["claim_strings"]) + 32 * 5,
    }


# ── demo builder ──────────────────────────────────────────────────────────────

def make_demo_receipt(
    sensor_id: str         = "honeywell-hmc5983-magnetometer-SN00142",
    cross_cal_q: float     = 0.88,
    thermal_noise_db: float= -115.0,
    integration_s: float   = 60.0,
    seed: int              = 7,
) -> dict:
    """Convenience wrapper that builds a receipt from synthetic data."""
    measured_at   = "2026-11-24T09:12:00+00:00"
    orbit_id      = "NORAD-57166/TLE-2026-11-24T00:00:00Z/orbit-5842"
    ground_station= "JAXA-Tsukuba"

    tel_seg  = synthetic_telemetry_segment(sensor_id, 10, integration_s, seed)
    cal_file = (
        f'{{"sensor":"{sensor_id}","epoch":"{measured_at}",'
        f'"scale":1.0,"offset":[0.0,0.0,0.0]}}'
    ).encode("utf-8")

    return make_space_receipt(
        measured_at=measured_at,
        sensor_id=sensor_id,
        cross_cal_q=cross_cal_q,
        thermal_noise_db=thermal_noise_db,
        integration_s=integration_s,
        telemetry_segment=tel_seg,
        calibration_file=cal_file,
        orbit_id=orbit_id,
        ground_station=ground_station,
    )
