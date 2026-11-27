"""Tests for VirtualAccelerator and POST /api/v1/qpu/accelerate."""

import json
import os
import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_oracle.accelerator import (
    VirtualAccelerator,
    AcceleratorResult,
    _q_to_slot,
    _SLOT_THRESHOLDS,
)
from cure_oracle.qpu_router import router
from cure_oracle.mente import MENTE_CONST

os.environ.setdefault("CURE_API_TOKENS", "{}")

_TEST_OP_TOKEN = "acc-test-operator-9f3c"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ── _q_to_slot unit tests ──────────────────────────────────────────────────────

class TestQToSlot:
    def test_high_q_is_s4(self):
        assert _q_to_slot(1.0) == "S4"
        assert _q_to_slot(0.75) == "S4"
        assert _q_to_slot(0.90) == "S4"

    def test_mid_high_q_is_s1(self):
        assert _q_to_slot(0.74) == "S1"
        assert _q_to_slot(0.50) == "S1"

    def test_mid_low_q_is_s3(self):
        assert _q_to_slot(0.49) == "S3"
        assert _q_to_slot(0.25) == "S3"

    def test_low_q_is_s2(self):
        assert _q_to_slot(0.24) == "S2"
        assert _q_to_slot(0.00) == "S2"


# ── VirtualAccelerator unit tests ──────────────────────────────────────────────

class TestVirtualAccelerator:
    def _acc(self):
        return VirtualAccelerator()

    def test_single_shape_returns_result(self):
        result = self._acc().run(["LINE"], mode="local")
        assert isinstance(result, AcceleratorResult)
        assert len(result.runs) == 1

    def test_run_has_correct_shape(self):
        result = self._acc().run(["CUBE"], mode="local")
        assert result.runs[0].shape == "CUBE"

    def test_q_in_range(self):
        result = self._acc().run(["LINE"], mode="local")
        q = result.runs[0].q
        assert 0.0 <= q <= 1.0

    def test_slot_assigned(self):
        result = self._acc().run(["LINE"], mode="local")
        assert result.runs[0].slot in {"S1", "S2", "S3", "S4"}

    def test_duplicate_shapes_allowed(self):
        result = self._acc().run(["LINE", "LINE", "LINE"], mode="local")
        assert len(result.runs) == 3

    def test_all_five_shapes(self):
        result = self._acc().run(["CUBE", "RING", "TREE", "LINE", "STAR"], mode="local")
        assert len(result.runs) == 5

    def test_synthesized_mente_total_nonneg(self):
        result = self._acc().run(["CUBE", "LINE"], mode="local")
        assert result.synthesized.mente_total >= 0.0

    def test_synthesized_slots_subset_of_runs(self):
        result = self._acc().run(["CUBE", "RING"], mode="local")
        all_slots = {r.slot for r in result.runs}
        for slot in result.synthesized.slots:
            assert slot in all_slots

    def test_synthesized_missing_slots_complement(self):
        result = self._acc().run(["LINE"], mode="local")
        present = set(result.synthesized.slots.keys())
        missing = set(result.synthesized.missing_slots)
        assert present | missing == {"S1", "S2", "S3", "S4"}
        assert present & missing == set()

    def test_four_kings_requires_all_slots(self):
        result = self._acc().run(["LINE"], mode="local")
        if result.synthesized.four_kings:
            assert result.synthesized.missing_slots == []
        else:
            assert len(result.synthesized.missing_slots) > 0

    def test_observe_receipt_present(self):
        result = self._acc().run(["LINE"], mode="local")
        assert isinstance(result.observe_receipt, dict)
        assert result.observe_receipt.get("version") == "sig-receipt/1"

    def test_observe_receipt_has_merkle(self):
        result = self._acc().run(["LINE"], mode="local")
        merkle = result.observe_receipt.get("merkle", {})
        assert merkle.get("root", "").startswith("0x")
        assert len(merkle["root"]) == 66

    def test_run_id_is_uuid(self):
        result = self._acc().run(["LINE"], mode="local")
        uuid_re = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        )
        assert uuid_re.match(result.run_id)

    def test_unique_run_ids(self):
        r1 = self._acc().run(["LINE"], mode="local")
        r2 = self._acc().run(["LINE"], mode="local")
        assert r1.run_id != r2.run_id

    def test_invalid_shape_raises(self):
        with pytest.raises(ValueError, match="unknown shape"):
            self._acc().run(["HEXAGON"], mode="local")

    def test_empty_shapes_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            self._acc().run([], mode="local")

    def test_maximum_coherence_selection(self):
        """When two runs land on the same slot, the highest-q wins."""
        result = self._acc().run(["LINE", "LINE", "LINE", "LINE"], mode="local")
        for slot, winning_run in result.synthesized.slots.items():
            same_slot_runs = [r for r in result.runs if r.slot == slot]
            best_q = max(r.q for r in same_slot_runs)
            assert winning_run.q == best_q

    def test_receipt_backend_is_virtual_accelerator(self):
        result = self._acc().run(["CUBE"], mode="local")
        assert "virtual-accelerator" in result.observe_receipt.get("backend", "")

    def test_verify_proof_roundtrip(self):
        from cure_oracle.verify import verify_proof, SIG_RECEIPT_VERSION
        result = self._acc().run(["LINE"], mode="local")
        receipt = result.observe_receipt
        ok = verify_proof(
            leaf_hex=receipt["proof"]["leaf"],
            proof_path=receipt["proof"]["path"],
            root_hex=receipt["merkle"]["root"],
            version=SIG_RECEIPT_VERSION,
        )
        assert ok, "Merkle proof failed to verify for accelerator receipt"

    def test_shots_override(self):
        result = self._acc().run(["CUBE"], shots=512, mode="local")
        assert result.runs[0].shots == 512


# ── POST /api/v1/qpu/accelerate endpoint tests ───────────────────────────────

_AUTH = {"Authorization": f"Bearer {_TEST_OP_TOKEN}"}


class TestAccelerateEndpoint:
    @pytest.fixture(autouse=True)
    def _set_tokens(self, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_OP_TOKEN: "operator"}))

    def _post(self, shapes, shots=512, mode="local"):
        return client.post("/api/v1/qpu/accelerate",
                           json={"shapes": shapes, "shots": shots, "mode": mode},
                           headers=_AUTH)

    def test_returns_200(self):
        r = self._post(["LINE"])
        assert r.status_code == 200

    def test_response_has_runs(self):
        data = self._post(["LINE"]).json()
        assert "runs" in data
        assert len(data["runs"]) == 1

    def test_response_has_synthesized(self):
        data = self._post(["CUBE"]).json()
        assert "synthesized" in data
        assert "mente_total" in data["synthesized"]

    def test_response_has_receipt(self):
        data = self._post(["LINE"]).json()
        assert "observe_receipt" in data
        assert data["observe_receipt"]["version"] == "sig-receipt/1"

    def test_response_has_run_id(self):
        data = self._post(["LINE"]).json()
        assert "run_id" in data

    def test_multiple_shapes(self):
        data = self._post(["CUBE", "RING", "LINE"]).json()
        assert len(data["runs"]) == 3

    def test_invalid_shape_422(self):
        r = self._post(["TRIANGLE"])
        assert r.status_code == 422

    def test_unknown_mode_422(self):
        r = client.post("/api/v1/qpu/accelerate",
                        json={"shapes": ["LINE"], "mode": "quantum-cloud"},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_empty_shapes_422(self):
        r = client.post("/api/v1/qpu/accelerate",
                        json={"shapes": [], "mode": "local"},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_synthesized_missing_plus_present_equals_all(self):
        data = self._post(["LINE"]).json()
        syn = data["synthesized"]
        present = set(syn["slots"].keys())
        missing = set(syn["missing_slots"])
        assert present | missing == {"S1", "S2", "S3", "S4"}

    def test_four_shapes_covers_more_slots(self):
        data = self._post(["CUBE", "RING", "LINE", "STAR"]).json()
        syn = data["synthesized"]
        assert len(syn["slots"]) >= 1

    def test_mente_total_nonneg(self):
        data = self._post(["LINE"]).json()
        assert data["synthesized"]["mente_total"] >= 0.0

    def test_four_kings_bool(self):
        data = self._post(["LINE"]).json()
        assert isinstance(data["synthesized"]["four_kings"], bool)
