"""Tests for cure_oracle/bmi.py — BMI Merkle receipt."""

import pytest
from cure_oracle.bmi import (
    BMI_RECEIPT_VERSION,
    _CLAIM_TYPES,
    _BMI_SIG_INDEX,
    _MENTE_CONST,
    _claim_record,
    _receipt_leaf,
    _receipt_pair,
    _receipt_tree,
    _receipt_proof,
    compute_band_sig,
    eeg_fingerprint,
    synthetic_eeg_segment,
    make_session_id,
    make_bmi_receipt,
    make_demo_receipt,
    reveal_claims,
)


# ── compute_band_sig ──────────────────────────────────────────────────────────

class TestComputeBandSig:
    def test_gamma_high_quality_low_impedance(self):
        r = compute_band_sig(dominant_hz=35.0, coherence_q=0.9, impedance_kohm=2.0)
        assert r["band"] == "GAMMA"
        assert r["band_pts"] == 5
        assert r["theta_disp"] == "φ.618"
        assert r["imp_class"] == ".005"
        assert r["sig"] == "GAMMA-φ.618-ε.005"

    def test_alpha_mid_quality_good_impedance(self):
        r = compute_band_sig(dominant_hz=10.0, coherence_q=0.60, impedance_kohm=7.0)
        assert r["band"] == "ALPHA"
        assert r["band_pts"] == 3
        assert r["theta_disp"] == "π.785"
        assert r["imp_class"] == ".010"
        assert r["sig"] == "ALPHA-π.785-ε.010"

    def test_delta_low_quality_poor_impedance(self):
        r = compute_band_sig(dominant_hz=1.0, coherence_q=0.2, impedance_kohm=25.0)
        assert r["band"] == "DELTA"
        assert r["band_pts"] == 1
        assert r["theta_disp"] == "√.414"
        assert r["imp_class"] == ".040"
        assert r["sig"] == "DELTA-√.414-ε.040"

    @pytest.mark.parametrize("hz,expected_band", [
        (30.5, "GAMMA"),
        (20.0, "BETA"),
        (10.0, "ALPHA"),
        (6.0,  "THETA"),
        (2.0,  "DELTA"),
    ])
    def test_band_boundaries(self, hz, expected_band):
        assert compute_band_sig(hz, 0.5, 5.0)["band"] == expected_band

    @pytest.mark.parametrize("q,expected_theta", [
        (0.75, "φ.618"),
        (0.74, "π.785"),
        (0.50, "π.785"),
        (0.49, "√.414"),
    ])
    def test_theta_disp_boundaries(self, q, expected_theta):
        assert compute_band_sig(10.0, q, 5.0)["theta_disp"] == expected_theta

    @pytest.mark.parametrize("kohm,expected_eps", [
        (0.0,  ".005"),
        (4.9,  ".005"),
        (5.0,  ".010"),
        (9.9,  ".010"),
        (10.0, ".020"),
        (19.9, ".020"),
        (20.0, ".040"),
    ])
    def test_impedance_class_boundaries(self, kohm, expected_eps):
        assert compute_band_sig(10.0, 0.5, kohm)["imp_class"] == expected_eps

    def test_coherence_score_formula(self):
        r = compute_band_sig(dominant_hz=10.0, coherence_q=0.8, impedance_kohm=3.0)
        expected = round(0.8 * 3 * _MENTE_CONST, 6)
        assert r["coherence_score"] == pytest.approx(expected, rel=1e-5)

    def test_coherence_clamped(self):
        r_high = compute_band_sig(10.0, 2.0, 5.0)
        r_low  = compute_band_sig(10.0, -1.0, 5.0)
        assert r_high["theta_disp"] == "φ.618"
        assert r_low["theta_disp"]  == "√.414"


# ── EEG fingerprint ───────────────────────────────────────────────────────────

class TestEegFingerprint:
    def test_fingerprint_format(self):
        fp = eeg_fingerprint(b"test-eeg-data")
        assert fp.startswith("0x")
        assert len(fp) == 2 + 64   # 0x + 32 bytes hex

    def test_deterministic(self):
        data = b"\x01\x02\x03" * 100
        assert eeg_fingerprint(data) == eeg_fingerprint(data)

    def test_different_data_different_hash(self):
        assert eeg_fingerprint(b"aaa") != eeg_fingerprint(b"bbb")

    def test_synthetic_eeg_deterministic(self):
        s1 = synthetic_eeg_segment(dominant_hz=10.0, seed=42)
        s2 = synthetic_eeg_segment(dominant_hz=10.0, seed=42)
        assert s1 == s2

    def test_synthetic_eeg_different_seeds(self):
        s1 = synthetic_eeg_segment(seed=1)
        s2 = synthetic_eeg_segment(seed=2)
        assert s1 != s2

    def test_synthetic_eeg_byte_length(self):
        seg = synthetic_eeg_segment(sample_rate=256, duration_s=1.0, channels=8)
        # 256 samples × 8 channels × 4 bytes per float32 = 8192 bytes
        assert len(seg) == 256 * 8 * 4


# ── Merkle tree primitives ────────────────────────────────────────────────────

class TestMerkleTree:
    def _build(self, n_claims=11):
        recs   = [_claim_record(i, f"value-{i}") for i in range(n_claims)]
        levels = _receipt_tree(recs)
        return recs, levels

    def test_root_is_32_bytes(self):
        _, levels = self._build()
        assert len(levels[-1][0]) == 32

    def test_proof_path_length_for_11_claims(self):
        recs, levels = self._build(11)
        proof = _receipt_proof(levels, _BMI_SIG_INDEX)
        # 11 leaves → ceil(log2(11)) = 4 levels above leaves
        assert len(proof) >= 3

    def test_proof_verification(self):
        recs, levels = self._build()
        root  = levels[-1][0]
        proof = _receipt_proof(levels, _BMI_SIG_INDEX)
        leaf  = _receipt_leaf(_BMI_SIG_INDEX, recs[_BMI_SIG_INDEX])
        h = leaf
        for p in proof:
            h = _receipt_pair(h, p)
        assert h == root

    def test_different_values_different_root(self):
        recs1 = [_claim_record(i, f"val-{i}") for i in range(11)]
        recs2 = [_claim_record(i, f"val-{i}") for i in range(11)]
        recs2[3] = _claim_record(3, "CHANGED")
        l1 = _receipt_tree(recs1)[-1][0]
        l2 = _receipt_tree(recs2)[-1][0]
        assert l1 != l2


# ── make_bmi_receipt ──────────────────────────────────────────────────────────

class TestMakeBmiReceipt:
    @pytest.fixture
    def receipt(self):
        return make_demo_receipt(dominant_hz=10.0, coherence_q=0.82, impedance_kohm=3.5)

    def test_version(self, receipt):
        assert receipt["version"] == BMI_RECEIPT_VERSION

    def test_band_sig_in_receipt(self, receipt):
        assert "band_sig" in receipt
        parts = receipt["band_sig"].split("-")
        assert len(parts) == 3
        assert parts[2].startswith("ε")

    def test_merkle_structure(self, receipt):
        m = receipt["merkle"]
        assert m["hash"] == "keccak256"
        assert m["node"] == "sorted-pair"
        assert m["claims"] == 11
        assert m["sig_index"] == _BMI_SIG_INDEX
        assert m["root"].startswith("0x")
        assert len(m["root"]) == 66

    def test_proof_structure(self, receipt):
        p = receipt["proof"]
        assert p["index"] == _BMI_SIG_INDEX
        assert p["leaf"].startswith("0x")
        assert all(h.startswith("0x") for h in p["path"])

    def test_proof_verification(self, receipt):
        from cure_oracle.bmi import _receipt_pair
        leaf = bytes.fromhex(receipt["proof"]["leaf"][2:])
        h    = leaf
        for p_hex in receipt["proof"]["path"]:
            p = bytes.fromhex(p_hex[2:])
            h = _receipt_pair(h, p)
        assert "0x" + h.hex() == receipt["merkle"]["root"]

    def test_determinism(self):
        r1 = make_demo_receipt(seed=42)
        r2 = make_demo_receipt(seed=42)
        assert r1["merkle"]["root"] == r2["merkle"]["root"]
        assert r1["session_id"]     == r2["session_id"]

    def test_different_seeds_different_roots(self):
        r1 = make_demo_receipt(seed=1)
        r2 = make_demo_receipt(seed=2)
        assert r1["merkle"]["root"] != r2["merkle"]["root"]

    def test_no_real_subject_id_in_receipt(self, receipt):
        # subject_real_id must never appear; only pseudonym (sha256 prefix)
        raw = str(receipt)
        assert "SUBJECT-DEMO" not in raw

    def test_pseudonym_is_hash_prefix(self, receipt):
        pseudo = receipt["subject_pseudonym"]
        assert pseudo.startswith("0x")
        assert len(pseudo) == 2 + 32   # 0x + 16 bytes = 32 hex chars

    def test_eeg_hash_and_consent_hash_format(self, receipt):
        assert receipt["eeg_hash"].startswith("0x")
        assert receipt["consent_hash"].startswith("0x")
        assert len(receipt["eeg_hash"])     == 66
        assert len(receipt["consent_hash"]) == 66

    def test_all_11_claims_present(self, receipt):
        for name in _CLAIM_TYPES:
            assert name in receipt, f"missing claim: {name}"


# ── reveal_claims (selective disclosure) ─────────────────────────────────────

class TestSelectiveDisclosure:
    @pytest.fixture
    def receipt(self):
        return make_demo_receipt()

    def test_disclose_band_sig_only(self, receipt):
        d = reveal_claims(receipt, ["band_sig"])
        assert len(d["disclosed"]) == 1
        item = d["disclosed"][0]
        assert item["claim"]  == "band_sig"
        assert item["index"]  == _BMI_SIG_INDEX
        assert item["value"]  == receipt["band_sig"]
        assert item["leaf"].startswith("0x")

    def test_proof_in_disclosed_item_verifies(self, receipt):
        d = reveal_claims(receipt, ["band_sig"])
        item = d["disclosed"][0]
        leaf = bytes.fromhex(item["leaf"][2:])
        h    = leaf
        for p_hex in item["proof"]:
            p = bytes.fromhex(p_hex[2:])
            h = _receipt_pair(h, p)
        assert "0x" + h.hex() == receipt["merkle"]["root"]

    def test_disclose_billing_subset(self, receipt):
        # auditor needs: session_id, net_seconds, device_id — no eeg data
        d = reveal_claims(receipt, ["session_id", "net_seconds", "device_id"])
        names = [item["claim"] for item in d["disclosed"]]
        assert set(names) == {"session_id", "net_seconds", "device_id"}
        # eeg_hash and consent_hash must NOT be in the response values
        values_str = str([item["value"] for item in d["disclosed"]])
        assert receipt["eeg_hash"]     not in values_str
        assert receipt["consent_hash"] not in values_str

    def test_unknown_claim_name_is_skipped(self, receipt):
        d = reveal_claims(receipt, ["band_sig", "nonexistent_claim"])
        assert len(d["disclosed"]) == 1

    def test_root_is_preserved_in_disclosure(self, receipt):
        d = reveal_claims(receipt, ["coherence"])
        assert d["merkle_root"] == receipt["merkle"]["root"]
