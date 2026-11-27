"""Tests for GeminiCandyFlash and POST /api/v1/qpu/candy/flash.

All tests run offline (Gemini call stubbed) so no GEMINI_API_KEY is required.
"""

import json
import os
import re
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_oracle.gemini_candy import (
    GeminiCandyFlash,
    GeminiCandyResult,
    GeminiRecommendation,
    _build_prompt,
    _parse_recommendation,
)
from cure_oracle.qpu_router import router

# ── env setup ─────────────────────────────────────────────────────────────────

_TEST_OP_TOKEN = "candy-test-operator-5b2d"
os.environ["CURE_API_TOKENS"] = json.dumps({_TEST_OP_TOKEN: "operator"})
os.environ.pop("GEMINI_API_KEY", None)   # ensure no key → offline mode

app = FastAPI()
app.include_router(router)
client = TestClient(app)
_AUTH = {"Authorization": f"Bearer {_TEST_OP_TOKEN}"}


# ── GeminiCandyFlash unit tests ───────────────────────────────────────────────

class TestGeminiCandyOffline:
    """Tests that run run_offline() — no Gemini call."""

    def _flash(self):
        return GeminiCandyFlash()

    def test_offline_returns_result(self):
        result = self._flash().run_offline(["LINE"], mode="local")
        assert isinstance(result, GeminiCandyResult)

    def test_offline_has_recommendation(self):
        result = self._flash().run_offline(["LINE"], mode="local")
        assert isinstance(result.recommendation, GeminiRecommendation)

    def test_offline_suggested_shapes_valid(self):
        result = self._flash().run_offline(["CUBE", "LINE"], mode="local")
        valid = {"CUBE", "RING", "TREE", "LINE", "STAR"}
        for s in result.recommendation.suggested_shapes:
            assert s in valid

    def test_offline_model_is_stub(self):
        result = self._flash().run_offline(["LINE"], mode="local")
        assert result.recommendation.model_used == "offline-stub"

    def test_offline_has_spiral(self):
        result = self._flash().run_offline(["LINE"], round_num=1)
        assert isinstance(result.spiral, dict)
        assert "round" in result.spiral
        assert result.spiral["round"] == 1

    def test_offline_has_spiral_preview(self):
        result = self._flash().run_offline(["LINE"])
        assert isinstance(result.spiral_preview, str)
        assert len(result.spiral_preview) > 10

    def test_offline_has_session_id(self):
        result = self._flash().run_offline(["LINE"])
        uuid_re = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        )
        assert uuid_re.match(result.session_id)

    def test_offline_has_receipt(self):
        result = self._flash().run_offline(["LINE"])
        assert result.observe_receipt.get("version") == "sig-receipt/1"

    def test_offline_receipt_merkle_root(self):
        result = self._flash().run_offline(["LINE"])
        root = result.observe_receipt["merkle"]["root"]
        assert root.startswith("0x")
        assert len(root) == 66

    def test_offline_accelerator_has_runs(self):
        result = self._flash().run_offline(["CUBE", "LINE"])
        assert len(result.accelerator.runs) == 2

    def test_offline_missing_slots_filled_in_recommendation(self):
        result = self._flash().run_offline(["LINE"])
        # Suggested shapes should address missing slots (heuristic)
        assert len(result.recommendation.suggested_shapes) >= 1

    def test_offline_suggested_shots_range(self):
        result = self._flash().run_offline(["LINE"])
        assert 512 <= result.recommendation.suggested_shots <= 8192

    def test_offline_round_num_respected(self):
        r1 = self._flash().run_offline(["LINE"], round_num=1)
        r2 = self._flash().run_offline(["LINE"], round_num=3)
        assert r1.spiral["round"] == 1
        assert r2.spiral["round"] == 3

    def test_offline_no_gemini_key_needed(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        result = GeminiCandyFlash().run_offline(["LINE"])
        assert result.recommendation.commentary

    def test_run_raises_without_key(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        with pytest.raises(EnvironmentError, match="GEMINI_API_KEY"):
            GeminiCandyFlash().run(["LINE"])


# ── _build_prompt tests ───────────────────────────────────────────────────────

class TestBuildPrompt:
    def _get_prompt(self):
        from cure_oracle.accelerator import VirtualAccelerator
        from cure_oracle.round_circuit import round_circuit, spiral_preview
        from cure_oracle.mente import MENTE_CONST

        acc = VirtualAccelerator().run(["LINE"], shots=512)
        spiral = round_circuit(round_num=1)
        s_prev = spiral_preview(spiral)
        return _build_prompt(acc, spiral, s_prev, MENTE_CONST)

    def test_prompt_contains_candy_group(self):
        p = self._get_prompt()
        assert "キャンディ群" in p

    def test_prompt_contains_shape(self):
        p = self._get_prompt()
        assert "LINE" in p

    def test_prompt_contains_spiral_section(self):
        p = self._get_prompt()
        assert "螺旋" in p

    def test_prompt_contains_json_template(self):
        p = self._get_prompt()
        assert "suggested_shapes" in p

    def test_prompt_contains_mente_const(self):
        p = self._get_prompt()
        assert "2.288" in p or "φ×√2" in p


# ── _parse_recommendation tests ───────────────────────────────────────────────

class TestParseRecommendation:
    def test_valid_json(self):
        text = json.dumps({
            "suggested_shapes": ["CUBE", "RING"],
            "suggested_shots": 4096,
            "suggested_theta": "φ.618",
            "retest_reason": "スロットを埋めるため",
            "commentary": "良い量子状態です",
        })
        rec = _parse_recommendation(text, "gemini-2.0-flash")
        assert rec.suggested_shapes == ["CUBE", "RING"]
        assert rec.suggested_shots == 4096
        assert rec.suggested_theta == "φ.618"

    def test_invalid_shapes_filtered(self):
        text = json.dumps({
            "suggested_shapes": ["CUBE", "HEXAGON", "TRIANGLE"],
            "suggested_shots": 2048,
            "suggested_theta": "π.785",
            "retest_reason": "test",
            "commentary": "test",
        })
        rec = _parse_recommendation(text, "gemini-2.0-flash")
        assert "HEXAGON" not in rec.suggested_shapes
        assert "CUBE" in rec.suggested_shapes

    def test_invalid_theta_defaults(self):
        text = json.dumps({
            "suggested_shapes": ["LINE"],
            "suggested_shots": 512,
            "suggested_theta": "θ.999",
            "retest_reason": "test",
            "commentary": "test",
        })
        rec = _parse_recommendation(text, "gemini-2.0-flash")
        assert rec.suggested_theta == "√.414"

    def test_shots_clamped_to_range(self):
        text = json.dumps({
            "suggested_shapes": ["LINE"],
            "suggested_shots": 999999,
            "suggested_theta": "√.414",
            "retest_reason": "test",
            "commentary": "test",
        })
        rec = _parse_recommendation(text, "gemini-2.0-flash")
        assert rec.suggested_shots <= 8192

    def test_no_json_raises(self):
        with pytest.raises(ValueError, match="no JSON"):
            _parse_recommendation("これは純テキストです。", "gemini-2.0-flash")

    def test_model_stored(self):
        text = json.dumps({
            "suggested_shapes": ["CUBE"],
            "suggested_shots": 4096,
            "suggested_theta": "φ.618",
            "retest_reason": "test",
            "commentary": "test",
        })
        rec = _parse_recommendation(text, "gemini-2.0-flash-exp")
        assert rec.model_used == "gemini-2.0-flash-exp"


# ── Gemini mock run tests (Gemini call mocked) ────────────────────────────────

class TestGeminiCandyMocked:
    """Mocks _call_gemini to test the full run() path without a real key."""

    _FAKE_RESPONSE = json.dumps({
        "suggested_shapes": ["CUBE", "CUBE", "RING"],
        "suggested_shots": 8192,
        "suggested_theta": "φ.618",
        "retest_reason": "CUBE の高フィデリティ回路で S4 スロットを強化します。",
        "commentary": "現在の MENTE スコアは閾値未満です。CUBE 形状を 2 回複製することで S4 スロットの q 値が向上し、全顕現に近づきます。螺旋のテレポート角 A を考慮すると φ.618 が最適です。",
    })

    def test_mocked_run_returns_result(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-test")
        with patch("cure_oracle.gemini_candy._call_gemini", return_value=self._FAKE_RESPONSE):
            result = GeminiCandyFlash().run(["LINE"], shots=512)
        assert result.recommendation.suggested_shapes == ["CUBE", "CUBE", "RING"]

    def test_mocked_run_suggested_shots(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-test")
        with patch("cure_oracle.gemini_candy._call_gemini", return_value=self._FAKE_RESPONSE):
            result = GeminiCandyFlash().run(["LINE"], shots=512)
        assert result.recommendation.suggested_shots == 8192

    def test_mocked_receipt_valid(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-test")
        with patch("cure_oracle.gemini_candy._call_gemini", return_value=self._FAKE_RESPONSE):
            result = GeminiCandyFlash().run(["LINE"], shots=512)
        from cure_oracle.verify import verify_proof, SIG_RECEIPT_VERSION
        receipt = result.observe_receipt
        ok = verify_proof(
            leaf_hex=receipt["proof"]["leaf"],
            proof_path=receipt["proof"]["path"],
            root_hex=receipt["merkle"]["root"],
            version=SIG_RECEIPT_VERSION,
        )
        assert ok, "sig-receipt/1 Merkle proof failed for Gemini-Candy session"


# ── POST /api/v1/qpu/candy/flash endpoint tests ───────────────────────────────

class TestCandyFlashEndpoint:
    @pytest.fixture(autouse=True)
    def _set_tokens(self, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_OP_TOKEN: "operator"}))
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)  # force offline mode

    def _post(self, shapes, shots=512, round_num=1, offline=True):
        return client.post(
            "/api/v1/qpu/candy/flash",
            json={"shapes": shapes, "shots": shots, "round_num": round_num, "offline": offline},
            headers=_AUTH,
        )

    def test_returns_200(self):
        assert self._post(["LINE"]).status_code == 200

    def test_has_session_id(self):
        data = self._post(["LINE"]).json()
        assert "session_id" in data

    def test_has_runs(self):
        data = self._post(["LINE"]).json()
        assert len(data["runs"]) == 1

    def test_has_synthesized(self):
        data = self._post(["CUBE", "LINE"]).json()
        assert "mente_total" in data["synthesized"]

    def test_has_spiral(self):
        data = self._post(["LINE"]).json()
        assert "round" in data["spiral"]

    def test_has_spiral_preview(self):
        data = self._post(["LINE"]).json()
        assert len(data["spiral_preview"]) > 5

    def test_has_gemini_field(self):
        data = self._post(["LINE"]).json()
        assert "gemini" in data
        assert "commentary" in data["gemini"]
        assert "suggested_shapes" in data["gemini"]

    def test_offline_model_stub(self):
        data = self._post(["LINE"]).json()
        assert data["gemini"]["model_used"] == "offline-stub"

    def test_has_receipt(self):
        data = self._post(["LINE"]).json()
        assert data["observe_receipt"]["version"] == "sig-receipt/1"

    def test_round_num_in_spiral(self):
        data = self._post(["LINE"], round_num=3).json()
        assert data["spiral"]["round"] == 3

    def test_invalid_shape_422(self):
        r = client.post("/api/v1/qpu/candy/flash",
                        json={"shapes": ["PYRAMID"], "shots": 512, "offline": True},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_ibm_mode_rejected(self):
        r = client.post("/api/v1/qpu/candy/flash",
                        json={"shapes": ["LINE"], "mode": "ibm", "offline": True},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_no_auth_403(self):
        r = client.post("/api/v1/qpu/candy/flash",
                        json={"shapes": ["LINE"], "offline": True})
        assert r.status_code == 403
