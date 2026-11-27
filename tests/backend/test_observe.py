"""Tests for GET /api/v1/qpu/observe — A地点/B地点 OS識別 + MENTE座標空間."""

import os
import platform
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_oracle.qpu_router import router
from cure_oracle.mente import MENTE_CONST

os.environ.setdefault("CURE_API_TOKENS", '{}')   # dev mode: any bearer → OPERATOR

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ── TestObserveEndpoint ───────────────────────────────────────────────────────

class TestObserveEndpoint:
    def test_returns_200(self):
        r = client.get("/api/v1/qpu/observe")
        assert r.status_code == 200

    def test_has_point_a(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert "point_a" in data
        assert data["point_a"]["role"] == "quantum_state"

    def test_has_point_b(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert "point_b" in data
        assert data["point_b"]["role"] == "observer"

    def test_point_a_system_matches_server(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert data["point_a"]["system"] == platform.system()

    def test_point_a_python_matches(self):
        data = client.get("/api/v1/qpu/observe").json()
        expected = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        assert data["point_a"]["python"] == expected

    def test_mente_const_correct(self):
        import math
        data = client.get("/api/v1/qpu/observe").json()
        assert abs(data["mente_const"] - round(MENTE_CONST, 6)) < 1e-9

    def test_coordinate_space_has_four_axes(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert len(data["coordinate_space"]) == 4

    def test_coordinate_space_slots(self):
        data = client.get("/api/v1/qpu/observe").json()
        slots = {ax["slot"] for ax in data["coordinate_space"]}
        assert slots == {"S1", "S2", "S3", "S4"}

    def test_coordinate_space_kings(self):
        data = client.get("/api/v1/qpu/observe").json()
        kings = {ax["king"] for ax in data["coordinate_space"]}
        assert kings == {"多聞天", "増長天", "持国天", "広目天"}

    def test_s4_q_min_075(self):
        data = client.get("/api/v1/qpu/observe").json()
        s4 = next(ax for ax in data["coordinate_space"] if ax["slot"] == "S4")
        assert abs(s4["q_min"] - 0.75) < 1e-9
        assert abs(s4["q_max"] - 1.0)  < 1e-9

    def test_s2_q_min_0(self):
        data = client.get("/api/v1/qpu/observe").json()
        s2 = next(ax for ax in data["coordinate_space"] if ax["slot"] == "S2")
        assert abs(s2["q_min"] - 0.0)  < 1e-9
        assert abs(s2["q_max"] - 0.25) < 1e-9

    def test_basis_string(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert data["basis"] == "四天王座標系 φ×√2"

    def test_axes_cover_full_q_range(self):
        data = client.get("/api/v1/qpu/observe").json()
        mins = {ax["q_min"] for ax in data["coordinate_space"]}
        maxs = {ax["q_max"] for ax in data["coordinate_space"]}
        assert 0.0 in mins
        assert 1.0 in maxs

    def test_user_agent_reflected_in_point_b(self):
        r = client.get("/api/v1/qpu/observe",
                       headers={"User-Agent": "PopKivyDevice/1.0"})
        assert r.json()["point_b"]["system"] == "PopKivyDevice/1.0"

    def test_no_auth_still_200_viewer_role(self):
        # VIEWER role is sufficient for /observe
        r = client.get("/api/v1/qpu/observe")
        assert r.status_code == 200


# ── TestObserveReceipt ────────────────────────────────────────────────────────

class TestObserveReceipt:
    """sig-receipt/1 Keccak-256 Merkle receipt — Cure-OS A地点 → PopKivyDevice B地点."""

    def _receipt(self):
        return client.get("/api/v1/qpu/observe").json()["observe_receipt"]

    def test_receipt_present(self):
        data = client.get("/api/v1/qpu/observe").json()
        assert "observe_receipt" in data
        assert data["observe_receipt"] is not None

    def test_receipt_version(self):
        assert self._receipt()["version"] == "sig-receipt/1"

    def test_receipt_sig_code(self):
        assert self._receipt()["sig"] == "CUBE-φ.618-ε.001"

    def test_receipt_backend_has_cure_os(self):
        assert self._receipt()["backend"].startswith("cure-os/")

    def test_receipt_mente_matches_const(self):
        import math
        r = self._receipt()
        assert abs(r["mente"] - round(MENTE_CONST, 6)) < 1e-9

    def test_receipt_has_merkle_root(self):
        merkle = self._receipt()["merkle"]
        assert "root" in merkle
        assert merkle["root"].startswith("0x")
        assert len(merkle["root"]) == 66  # "0x" + 64 hex chars

    def test_receipt_merkle_hash_algo(self):
        assert self._receipt()["merkle"]["hash"] == "keccak256"

    def test_receipt_has_proof_path(self):
        proof = self._receipt()["proof"]
        assert "path" in proof
        assert isinstance(proof["path"], list)
        assert len(proof["path"]) > 0

    def test_receipt_proof_leaf_hex(self):
        leaf = self._receipt()["proof"]["leaf"]
        assert leaf.startswith("0x")
        assert len(leaf) == 66

    def test_receipt_proof_index_is_sig_index(self):
        # sig_code is claim 3 — same as birth.py _SIG_INDEX
        assert self._receipt()["proof"]["index"] == 3

    def test_receipt_cert_id_is_uuid(self):
        import re
        cid = self._receipt()["cert_id"]
        uuid_re = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        )
        assert uuid_re.match(cid), f"cert_id not UUID: {cid}"

    def test_receipt_unique_per_request(self):
        r1 = client.get("/api/v1/qpu/observe").json()["observe_receipt"]
        r2 = client.get("/api/v1/qpu/observe").json()["observe_receipt"]
        assert r1["cert_id"] != r2["cert_id"]
        assert r1["merkle"]["root"] != r2["merkle"]["root"]

    def test_verify_proof_roundtrip(self):
        """Round-trip: generate receipt → verify Merkle proof with cure_oracle.verify."""
        from cure_oracle.verify import verify_proof, SIG_RECEIPT_VERSION
        receipt = self._receipt()
        ok = verify_proof(
            leaf_hex=receipt["proof"]["leaf"],
            proof_path=receipt["proof"]["path"],
            root_hex=receipt["merkle"]["root"],
            version=SIG_RECEIPT_VERSION,
        )
        assert ok, "Merkle proof failed to verify"

    def test_verify_sig_code(self):
        """SIG code passes pattern check for sig-receipt/1."""
        from cure_oracle.verify import verify_sig_code, SIG_RECEIPT_VERSION
        assert verify_sig_code(self._receipt()["sig"], SIG_RECEIPT_VERSION)

    def test_receipt_epsilon(self):
        assert abs(self._receipt()["epsilon"] - 0.001) < 1e-9
