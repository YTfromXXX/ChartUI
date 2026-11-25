"""Tests for cure_oracle/verify.py."""

import pytest
from cure_oracle.verify import (
    VerifyResult,
    SIG_RECEIPT_VERSION,
    verify_receipt,
    verify_sig_code,
    verify_proof,
    verify_disclosed,
    KNOWN_VERSIONS,
)
from cure_oracle.bmi import (
    make_demo_receipt as make_bmi_receipt,
    reveal_claims,
    BMI_RECEIPT_VERSION,
)
from cure_oracle.space_sensor import (
    make_demo_receipt as make_space_receipt,
    downlink_phase2,
    SPACE_RECEIPT_VERSION,
)


# ── verify_sig_code ────────────────────────────────────────────────────────────

class TestVerifySigCode:
    @pytest.mark.parametrize("sig,version,expected", [
        # QPU
        ("CUBE-π.785-ε.019",        SIG_RECEIPT_VERSION,   True),
        ("RING-φ.618-ε.000",        SIG_RECEIPT_VERSION,   True),
        ("STAR-√.414-ε.999",        SIG_RECEIPT_VERSION,   True),
        ("BLOB-φ.618-ε.001",        SIG_RECEIPT_VERSION,   False),  # bad shape
        ("CUBE-φ.618-ε.1",          SIG_RECEIPT_VERSION,   False),  # ε not 3 digits
        # BMI
        ("ALPHA-φ.618-ε.005",       BMI_RECEIPT_VERSION,   True),
        ("DELTA-√.414-ε.040",       BMI_RECEIPT_VERSION,   True),
        ("ALPHA-φ.618-ε.007",       BMI_RECEIPT_VERSION,   False),  # ε not in enum
        ("WAVES-φ.618-ε.005",       BMI_RECEIPT_VERSION,   False),  # bad band
        # Space
        ("MAGNET-φ.618-ε.001",      SPACE_RECEIPT_VERSION, True),
        ("ATOMIC-√.414-ε.030",      SPACE_RECEIPT_VERSION, True),
        ("MAGNET-φ.618-ε.005",      SPACE_RECEIPT_VERSION, False),  # ε not in enum
        ("LASER-φ.618-ε.001",       SPACE_RECEIPT_VERSION, False),  # bad sensor
    ])
    def test_pattern_match(self, sig, version, expected):
        assert verify_sig_code(sig, version) is expected

    def test_unknown_version_raises(self):
        with pytest.raises(ValueError, match="unknown version"):
            verify_sig_code("CUBE-φ.618-ε.001", "unknown-receipt/0")


# ── verify_receipt (BMI) ───────────────────────────────────────────────────────

class TestVerifyReceiptBmi:
    @pytest.fixture
    def receipt(self):
        return make_bmi_receipt(seed=42)

    def test_valid_receipt(self, receipt):
        result = verify_receipt(receipt)
        assert result.ok is True
        assert result.errors == []
        assert result.version == BMI_RECEIPT_VERSION

    def test_bad_band_sig(self, receipt):
        receipt["band_sig"] = "INVALID-SIG"
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("band_sig" in e for e in result.errors)

    def test_missing_session_id(self, receipt):
        del receipt["session_id"]
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("session_id" in e for e in result.errors)

    def test_bad_iso8601(self, receipt):
        receipt["recorded_at"] = "2026/11/24 09:00"
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("recorded_at" in e for e in result.errors)

    def test_negative_impedance(self, receipt):
        receipt["impedance_kohm"] = -1.0
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("impedance_kohm" in e for e in result.errors)

    def test_bad_eeg_hash(self, receipt):
        receipt["eeg_hash"] = "not-a-hash"
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("eeg_hash" in e for e in result.errors)

    def test_tampered_claim_string_fails_root(self, receipt):
        receipt["claim_strings"][3] = "TAMPERED-SIG-CODE"
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("Merkle root mismatch" in e for e in result.errors)

    def test_wrong_claim_strings_length(self, receipt):
        receipt["claim_strings"] = receipt["claim_strings"][:5]
        result = verify_receipt(receipt)
        assert not result.ok

    def test_unknown_version(self, receipt):
        receipt["version"] = "unknown/0"
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("unknown version" in e for e in result.errors)

    def test_result_str(self, receipt):
        result = verify_receipt(receipt)
        assert "VerifyResult" in str(result)


# ── verify_receipt (Space) ─────────────────────────────────────────────────────

class TestVerifyReceiptSpace:
    @pytest.fixture
    def receipt(self):
        return make_space_receipt()

    def test_valid_receipt(self, receipt):
        result = verify_receipt(receipt)
        assert result.ok is True
        assert result.errors == []

    def test_bad_cal_sig(self, receipt):
        receipt["cal_sig"] = "MAGNET-φ.618-ε.005"  # ε.005 not in space enum
        result = verify_receipt(receipt)
        assert not result.ok
        assert any("cal_sig" in e for e in result.errors)

    def test_positive_thermal_noise_warns(self, receipt):
        receipt["thermal_noise_db"] = 5.0
        result = verify_receipt(receipt)
        assert any("thermal_noise_db" in w for w in result.warnings)

    def test_tampered_root_fails(self, receipt):
        receipt["merkle"]["root"] = "0x" + "ab" * 32
        result = verify_receipt(receipt)
        assert not result.ok

    def test_missing_orbit_id(self, receipt):
        receipt["orbit_id"] = ""
        result = verify_receipt(receipt)
        assert not result.ok


# ── verify_proof ───────────────────────────────────────────────────────────────

class TestVerifyProof:
    def test_bmi_sig_proof(self):
        r = make_bmi_receipt(seed=42)
        ok = verify_proof(
            r["proof"]["leaf"],
            r["proof"]["path"],
            r["merkle"]["root"],
            BMI_RECEIPT_VERSION,
        )
        assert ok is True

    def test_space_sig_proof(self):
        r = make_space_receipt()
        ok = verify_proof(
            r["proof"]["leaf"],
            r["proof"]["path"],
            r["merkle"]["root"],
            SPACE_RECEIPT_VERSION,
        )
        assert ok is True

    def test_tampered_leaf_fails(self):
        r = make_bmi_receipt(seed=42)
        ok = verify_proof(
            "0x" + "ff" * 32,
            r["proof"]["path"],
            r["merkle"]["root"],
            BMI_RECEIPT_VERSION,
        )
        assert ok is False

    def test_tampered_path_fails(self):
        r = make_space_receipt()
        bad_path = list(r["proof"]["path"])
        bad_path[0] = "0x" + "00" * 32
        ok = verify_proof(
            r["proof"]["leaf"],
            bad_path,
            r["merkle"]["root"],
            SPACE_RECEIPT_VERSION,
        )
        assert ok is False


# ── verify_disclosed ───────────────────────────────────────────────────────────

class TestVerifyDisclosed:
    def test_bmi_reveal_claims(self):
        r = make_bmi_receipt(seed=42)
        d = reveal_claims(r, ["band_sig", "coherence", "protocol_id"])
        for item in d["disclosed"]:
            ok = verify_disclosed(item, r["merkle"]["root"], BMI_RECEIPT_VERSION)
            assert ok is True, f"{item['claim']} proof failed"

    def test_space_phase2_disclosed(self):
        r = make_space_receipt()
        p2 = downlink_phase2(r, ["cal_sig", "orbit_id", "ground_station"])
        for item in p2["disclosed"]:
            ok = verify_disclosed(item, r["merkle"]["root"], SPACE_RECEIPT_VERSION)
            assert ok is True, f"{item['claim']} proof failed"

    def test_all_bmi_claims_individually(self):
        r = make_bmi_receipt(seed=42)
        from cure_oracle.bmi import _CLAIM_TYPES
        all_names = list(_CLAIM_TYPES.keys())
        d = reveal_claims(r, all_names)
        for item in d["disclosed"]:
            ok = verify_disclosed(item, r["merkle"]["root"], BMI_RECEIPT_VERSION)
            assert ok is True, f"{item['claim']} individual proof failed"

    def test_all_space_claims_individually(self):
        r = make_space_receipt()
        from cure_oracle.space_sensor import _CLAIM_TYPES
        all_names = list(_CLAIM_TYPES.keys())
        p2 = downlink_phase2(r, all_names)
        for item in p2["disclosed"]:
            ok = verify_disclosed(item, r["merkle"]["root"], SPACE_RECEIPT_VERSION)
            assert ok is True, f"{item['claim']} individual proof failed"


# ── KNOWN_VERSIONS ─────────────────────────────────────────────────────────────

class TestKnownVersions:
    def test_all_three_versions_present(self):
        assert SIG_RECEIPT_VERSION   in KNOWN_VERSIONS
        assert BMI_RECEIPT_VERSION   in KNOWN_VERSIONS
        assert SPACE_RECEIPT_VERSION in KNOWN_VERSIONS

    def test_exactly_three_versions(self):
        assert len(KNOWN_VERSIONS) == 3
