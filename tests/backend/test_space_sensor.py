"""Tests for cure_oracle/space_sensor.py — space sensor Merkle receipt."""

import pytest
from cure_oracle.space_sensor import (
    SPACE_RECEIPT_VERSION,
    _CLAIM_TYPES,
    _SPACE_SIG_INDEX,
    _MENTE_CONST,
    _claim_record,
    _receipt_leaf,
    _receipt_pair,
    _receipt_tree,
    _receipt_proof,
    compute_cal_sig,
    telemetry_fingerprint,
    synthetic_telemetry_segment,
    make_packet_id,
    make_space_receipt,
    make_demo_receipt,
    downlink_phase1,
    downlink_phase2,
    downlink_phase3,
)


# ── compute_cal_sig ───────────────────────────────────────────────────────────

class TestComputeCalSig:
    def test_atomic_high_quality_low_noise(self):
        r = compute_cal_sig("stanford-ai-atomic-clock-SN001", 0.9, -118.0)
        assert r["sensor_name"]  == "ATOMIC"
        assert r["sensor_pts"]   == 5
        assert r["theta_disp"]   == "φ.618"
        assert r["noise_class"]  == ".001"
        assert r["sig"]          == "ATOMIC-φ.618-ε.001"

    def test_magnetometer_marginal_quality_high_noise(self):
        r = compute_cal_sig("honeywell-hmc5983-magnetometer-SN00142", 0.4, -95.0)
        assert r["sensor_name"]  == "MAGNET"
        assert r["sensor_pts"]   == 1
        assert r["theta_disp"]   == "√.414"
        assert r["noise_class"]  == ".010"
        assert r["sig"]          == "MAGNET-√.414-ε.010"

    def test_gravity_good_quality(self):
        r = compute_cal_sig("muquans-atom-gravimeter-SN042", 0.6, -105.0)
        assert r["sensor_name"] == "GRAVITY"
        assert r["sensor_pts"]  == 4
        assert r["theta_disp"]  == "π.785"
        assert r["noise_class"] == ".003"

    @pytest.mark.parametrize("sensor_id,expected_name", [
        ("stanford-ai-atomic-clock-SN001",           "ATOMIC"),
        ("muquans-atom-gravimeter-SN042",             "GRAVITY"),
        ("honeywell-gyro-SN200",                      "GYRO"),
        ("sodern-star-tracker-ct633",                 "GYRO"),
        ("stim300-accel-imu-SN099",                   "ACCEL"),
        ("honeywell-hmc5983-magnetometer-SN00142",    "MAGNET"),
    ])
    def test_sensor_tier_inference(self, sensor_id, expected_name):
        assert compute_cal_sig(sensor_id, 0.5, -105.0)["sensor_name"] == expected_name

    @pytest.mark.parametrize("q,expected_theta", [
        (0.75, "φ.618"),
        (0.74, "π.785"),
        (0.50, "π.785"),
        (0.49, "√.414"),
    ])
    def test_theta_disp_boundaries(self, q, expected_theta):
        assert compute_cal_sig("magnet", q, -105.0)["theta_disp"] == expected_theta

    @pytest.mark.parametrize("noise_db,expected_eps", [
        (-89.0,  ".030"),
        (-90.0,  ".030"),
        (-91.0,  ".010"),
        (-99.9,  ".010"),
        (-100.0, ".010"),
        (-100.1, ".003"),
        (-109.9, ".003"),
        (-110.0, ".003"),
        (-110.1, ".001"),
        (-130.0, ".001"),
    ])
    def test_noise_class_boundaries(self, noise_db, expected_eps):
        assert compute_cal_sig("magnet", 0.5, noise_db)["noise_class"] == expected_eps

    def test_cross_cal_score_formula(self):
        r = compute_cal_sig("atomic-clock", 0.8, -115.0)
        expected = round(0.8 * 5 * _MENTE_CONST, 6)
        assert r["cross_cal_score"] == pytest.approx(expected, rel=1e-5)

    def test_quality_clamped(self):
        assert compute_cal_sig("magnet", 2.0,  -105.0)["theta_disp"] == "φ.618"
        assert compute_cal_sig("magnet", -1.0, -105.0)["theta_disp"] == "√.414"


# ── telemetry fingerprint ─────────────────────────────────────────────────────

class TestTelemetryFingerprint:
    def test_format(self):
        fp = telemetry_fingerprint(b"test-telemetry")
        assert fp.startswith("0x") and len(fp) == 66

    def test_deterministic(self):
        d = b"\xDE\xAD\xBE\xEF" * 100
        assert telemetry_fingerprint(d) == telemetry_fingerprint(d)

    def test_different_data_different_hash(self):
        assert telemetry_fingerprint(b"aaa") != telemetry_fingerprint(b"bbb")

    def test_synthetic_deterministic(self):
        s1 = synthetic_telemetry_segment(seed=7)
        s2 = synthetic_telemetry_segment(seed=7)
        assert s1 == s2

    def test_synthetic_different_seeds(self):
        assert synthetic_telemetry_segment(seed=1) != synthetic_telemetry_segment(seed=2)

    def test_synthetic_byte_length(self):
        seg = synthetic_telemetry_segment(sample_rate=10, duration_s=60.0)
        # 10 Hz × 60 s = 600 samples × 3 axes × 8 bytes (float64) = 144000 B
        assert len(seg) == 10 * 60 * 3 * 8


# ── Merkle tree ───────────────────────────────────────────────────────────────

class TestMerkleTree:
    def _build(self, n=11):
        recs   = [_claim_record(i, f"claim-value-{i}") for i in range(n)]
        levels = _receipt_tree(recs)
        return recs, levels

    def test_root_is_32_bytes(self):
        _, levels = self._build()
        assert len(levels[-1][0]) == 32

    def test_proof_verification_for_11_claims(self):
        recs, levels = self._build()
        root  = levels[-1][0]
        proof = _receipt_proof(levels, _SPACE_SIG_INDEX)
        leaf  = _receipt_leaf(_SPACE_SIG_INDEX, recs[_SPACE_SIG_INDEX])
        h = leaf
        for p in proof:
            h = _receipt_pair(h, p)
        assert h == root

    def test_changed_claim_changes_root(self):
        recs1 = [_claim_record(i, f"val-{i}") for i in range(11)]
        recs2 = list(recs1)
        recs2[3] = _claim_record(3, "CHANGED-CAL-SIG")
        l1 = _receipt_tree(recs1)[-1][0]
        l2 = _receipt_tree(recs2)[-1][0]
        assert l1 != l2


# ── make_space_receipt ────────────────────────────────────────────────────────

class TestMakeSpaceReceipt:
    @pytest.fixture
    def receipt(self):
        return make_demo_receipt()

    def test_version(self, receipt):
        assert receipt["version"] == SPACE_RECEIPT_VERSION

    def test_cal_sig_format(self, receipt):
        parts = receipt["cal_sig"].split("-")
        assert len(parts) == 3
        assert parts[0] == "MAGNET"
        assert parts[2].startswith("ε")

    def test_merkle_has_11_claims(self, receipt):
        assert receipt["merkle"]["claims"] == 11
        assert receipt["merkle"]["sig_index"] == _SPACE_SIG_INDEX
        assert receipt["merkle"]["root"].startswith("0x")
        assert len(receipt["merkle"]["root"]) == 66

    def test_proof_verification(self, receipt):
        leaf = bytes.fromhex(receipt["proof"]["leaf"][2:])
        h    = leaf
        for p_hex in receipt["proof"]["path"]:
            h = _receipt_pair(h, bytes.fromhex(p_hex[2:]))
        assert "0x" + h.hex() == receipt["merkle"]["root"]

    def test_determinism(self):
        r1 = make_demo_receipt(seed=7)
        r2 = make_demo_receipt(seed=7)
        assert r1["merkle"]["root"] == r2["merkle"]["root"]
        assert r1["packet_id"]      == r2["packet_id"]

    def test_different_seeds_different_roots(self):
        r1 = make_demo_receipt(seed=1)
        r2 = make_demo_receipt(seed=2)
        assert r1["merkle"]["root"] != r2["merkle"]["root"]

    def test_all_11_claims_present(self, receipt):
        for name in _CLAIM_TYPES:
            assert name in receipt, f"missing claim: {name}"

    def test_hashes_are_hex(self, receipt):
        assert receipt["telemetry_hash"].startswith("0x")  and len(receipt["telemetry_hash"])   == 66
        assert receipt["calibration_hash"].startswith("0x") and len(receipt["calibration_hash"]) == 66

    def test_claim_strings_match_11(self, receipt):
        assert len(receipt["claim_strings"]) == 11

    def test_atomic_sensor_different_tier(self):
        r = make_demo_receipt(sensor_id="stanford-ai-atomic-clock-SN001", cross_cal_q=0.9, seed=99)
        assert r["sensor_name"] == "ATOMIC"
        assert r["sensor_pts"]  == 5
        assert "ATOMIC" in r["cal_sig"]


# ── bandwidth-constrained downlink protocol ───────────────────────────────────

class TestDownlinkProtocol:
    @pytest.fixture
    def receipt(self):
        return make_demo_receipt()

    # Phase 1 ─────────────────────────────────────────────────────────────────
    def test_phase1_contains_root_only(self, receipt):
        p1 = downlink_phase1(receipt)
        assert p1["phase"]        == 1
        assert p1["merkle_root"]  == receipt["merkle"]["root"]
        assert "cal_sig"          not in p1
        assert "telemetry_hash"   not in p1

    def test_phase1_byte_budget_small(self, receipt):
        p1 = downlink_phase1(receipt)
        assert p1["byte_budget"] < 200   # root + ids only

    # Phase 2 ─────────────────────────────────────────────────────────────────
    def test_phase2_discloses_requested_claims(self, receipt):
        p2 = downlink_phase2(receipt, ["cal_sig", "integration_s"])
        names = {d["claim"] for d in p2["disclosed"]}
        assert names == {"cal_sig", "integration_s"}

    def test_phase2_proof_verification(self, receipt):
        p2    = downlink_phase2(receipt, ["cal_sig"])
        item  = p2["disclosed"][0]
        leaf  = bytes.fromhex(item["leaf"][2:])
        h     = leaf
        for p_hex in item["proof"]:
            h = _receipt_pair(h, bytes.fromhex(p_hex[2:]))
        assert "0x" + h.hex() == receipt["merkle"]["root"]

    def test_phase2_does_not_leak_other_claims(self, receipt):
        p2 = downlink_phase2(receipt, ["cal_sig"])
        values_str = str([d["value"] for d in p2["disclosed"]])
        # orbit_id and ground_station should not appear in this response
        assert receipt["orbit_id"]       not in values_str
        assert receipt["ground_station"] not in values_str

    def test_phase2_root_unchanged(self, receipt):
        p2 = downlink_phase2(receipt, ["cal_sig", "orbit_id"])
        assert p2["merkle_root"] == receipt["merkle"]["root"]

    def test_phase2_unknown_claim_skipped(self, receipt):
        p2 = downlink_phase2(receipt, ["cal_sig", "nonexistent"])
        assert len(p2["disclosed"]) == 1

    # Phase 3 ─────────────────────────────────────────────────────────────────
    def test_phase3_has_all_claims(self, receipt):
        p3 = downlink_phase3(receipt)
        assert len(p3["claim_strings"]) == 11

    def test_phase3_includes_full_proof(self, receipt):
        p3 = downlink_phase3(receipt)
        assert "merkle" in p3 and "proof" in p3

    def test_phase1_lt_phase2_lt_phase3_bytes(self, receipt):
        p1 = downlink_phase1(receipt)
        p2 = downlink_phase2(receipt, ["cal_sig", "orbit_id", "ground_station"])
        p3 = downlink_phase3(receipt)
        assert p1["byte_budget"] < p2["byte_budget"] < p3["byte_budget"]

    # Cross-phase consistency ──────────────────────────────────────────────────
    def test_all_phases_agree_on_root(self, receipt):
        p1 = downlink_phase1(receipt)
        p2 = downlink_phase2(receipt, ["cal_sig"])
        p3 = downlink_phase3(receipt)
        assert p1["merkle_root"] == p2["merkle_root"] == p3["merkle"]["root"]
