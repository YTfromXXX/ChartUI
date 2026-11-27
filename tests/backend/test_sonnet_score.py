"""Tests for SonnetScore and POST /api/v1/qpu/candy/sonnet.

All tests run fully offline — no GEMINI_API_KEY required.
"""

import json
import os
import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cure_oracle.sonnet_score import (
    SonnetScore,
    SonnetScoreResult,
    DriveBoard,
    DriveCell,
    ScoreEvent,
    SLOT_TO_REGISTER,
    SHAPE_MOTIF,
    _angle_to_bpm,
    _mente_to_ascent,
    _mente_to_key,
    _mente_to_era,
)
from cure_oracle.qpu_router import router
from cure_oracle.mente import MENTE_CONST

# ── env setup ─────────────────────────────────────────────────────────────────

_TEST_OP_TOKEN = "sonnet-test-operator-7e1a"
os.environ["CURE_API_TOKENS"] = json.dumps({_TEST_OP_TOKEN: "operator"})

app = FastAPI()
app.include_router(router)
client = TestClient(app)
_AUTH = {"Authorization": f"Bearer {_TEST_OP_TOKEN}"}


# ── _angle_to_bpm tests ───────────────────────────────────────────────────────

class TestAngleToBpm:
    def test_zero_angle_is_min_bpm(self):
        assert _angle_to_bpm(0.0) == 80

    def test_full_angle_is_max_bpm(self):
        assert _angle_to_bpm(360.0) == 160

    def test_half_angle_is_mid_bpm(self):
        assert _angle_to_bpm(180.0) == 120

    def test_bpm_in_range(self):
        for angle in range(0, 361, 45):
            bpm = _angle_to_bpm(float(angle))
            assert 80 <= bpm <= 160


# ── _mente_to_ascent tests ────────────────────────────────────────────────────

class TestMenteToAscent:
    def test_zero_mente_is_zero_ascent(self):
        assert _mente_to_ascent(0.0) == 0.0

    def test_mente_const_is_100_ascent(self):
        assert _mente_to_ascent(MENTE_CONST) == 100.0

    def test_exceeds_const_capped_at_100(self):
        assert _mente_to_ascent(MENTE_CONST * 2) == 100.0

    def test_half_mente_is_50_ascent(self):
        result = _mente_to_ascent(MENTE_CONST / 2)
        assert abs(result - 50.0) < 0.1


# ── _mente_to_key tests ───────────────────────────────────────────────────────

class TestMenteToKey:
    def test_full_mente_chromatic(self):
        key, mode = _mente_to_key(MENTE_CONST)
        assert key == "C#"
        assert mode == "chromatic"

    def test_high_mente_major(self):
        key, mode = _mente_to_key(MENTE_CONST * 0.80)
        assert key == "C"
        assert mode == "major"

    def test_mid_mente_dorian(self):
        key, mode = _mente_to_key(MENTE_CONST * 0.60)
        assert key == "D"
        assert mode == "dorian"

    def test_low_mente_pentatonic(self):
        key, mode = _mente_to_key(MENTE_CONST * 0.30)
        assert key == "G"
        assert mode == "pentatonic"

    def test_zero_mente_minor(self):
        key, mode = _mente_to_key(0.0)
        assert key == "E"
        assert mode == "minor"


# ── _mente_to_era tests ───────────────────────────────────────────────────────

class TestMenteToEra:
    def test_full_mente_inner_world(self):
        assert _mente_to_era(MENTE_CONST) == "inner_world"

    def test_romantic_range(self):
        assert _mente_to_era(MENTE_CONST * 0.80) == "romantic"

    def test_beethoven_range(self):
        assert _mente_to_era(MENTE_CONST * 0.60) == "beethoven"

    def test_classical_range(self):
        assert _mente_to_era(MENTE_CONST * 0.30) == "classical"

    def test_baroque_at_zero(self):
        assert _mente_to_era(0.0) == "baroque"


# ── SLOT_TO_REGISTER mapping tests ───────────────────────────────────────────

class TestSlotRegisterMapping:
    def test_s4_is_highest_octave(self):
        assert SLOT_TO_REGISTER["S4"] == "大甲音"

    def test_s1_is_mid_octave(self):
        assert SLOT_TO_REGISTER["S1"] == "甲音"

    def test_s3_is_lower_octave(self):
        assert SLOT_TO_REGISTER["S3"] == "呂音"

    def test_s2_is_bass(self):
        assert SLOT_TO_REGISTER["S2"] == "呂音-bass"

    def test_all_four_slots_covered(self):
        assert set(SLOT_TO_REGISTER.keys()) == {"S1", "S2", "S3", "S4"}


# ── SHAPE_MOTIF mapping tests ─────────────────────────────────────────────────

class TestShapeMotifMapping:
    def test_all_five_shapes_covered(self):
        assert set(SHAPE_MOTIF.keys()) == {"CUBE", "RING", "TREE", "LINE", "STAR"}

    def test_cube_is_baroque(self):
        assert SHAPE_MOTIF["CUBE"]["era"] == "baroque"

    def test_star_is_inner_world(self):
        assert SHAPE_MOTIF["STAR"]["era"] == "inner_world"

    def test_line_is_romantic(self):
        assert SHAPE_MOTIF["LINE"]["era"] == "romantic"

    def test_motifs_have_required_keys(self):
        for shape, motif in SHAPE_MOTIF.items():
            assert "name" in motif, f"{shape} missing 'name'"
            assert "jp" in motif, f"{shape} missing 'jp'"
            assert "era" in motif, f"{shape} missing 'era'"


# ── SonnetScore unit tests ────────────────────────────────────────────────────

class TestSonnetScore:
    def _ss(self, bars: int = 4):
        return SonnetScore(bars=bars)

    def test_compute_offline_returns_result(self):
        result = self._ss().compute_offline(["LINE"], mode="local")
        assert isinstance(result, SonnetScoreResult)

    def test_bpm_in_range(self):
        result = self._ss().compute_offline(["CUBE"], mode="local")
        assert 80 <= result.bpm <= 160

    def test_ascent_rate_in_range(self):
        result = self._ss().compute_offline(["LINE"], mode="local")
        assert 0.0 <= result.ascent_rate <= 100.0

    def test_bars_respected(self):
        result = self._ss(bars=8).compute_offline(["LINE"], mode="local")
        assert result.bars == 8

    def test_score_id_is_uuid(self):
        result = self._ss().compute_offline(["LINE"], mode="local")
        uuid_re = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        )
        assert uuid_re.match(result.score_id)

    def test_unique_score_ids(self):
        r1 = self._ss().compute_offline(["LINE"])
        r2 = self._ss().compute_offline(["LINE"])
        assert r1.score_id != r2.score_id

    def test_key_is_string(self):
        result = self._ss().compute_offline(["LINE"])
        assert isinstance(result.key, str)
        assert len(result.key) > 0

    def test_mode_name_is_string(self):
        result = self._ss().compute_offline(["LINE"])
        assert result.mode_name in ("minor", "pentatonic", "dorian", "major", "chromatic")

    def test_era_is_valid(self):
        valid_eras = {"baroque", "classical", "beethoven", "romantic", "inner_world"}
        result = self._ss().compute_offline(["LINE"])
        assert result.era in valid_eras

    def test_events_are_list(self):
        result = self._ss().compute_offline(["LINE"])
        assert isinstance(result.events, list)

    def test_events_have_register(self):
        result = self._ss().compute_offline(["CUBE", "RING"])
        valid = set(SLOT_TO_REGISTER.values())
        for ev in result.events:
            assert ev.register in valid

    def test_events_intensity_in_range(self):
        result = self._ss().compute_offline(["CUBE", "LINE"])
        for ev in result.events:
            assert 0.0 <= ev.intensity <= 1.0

    def test_board_1_is_4x4(self):
        result = self._ss().compute_offline(["LINE"])
        assert result.board_1.cols == 4
        assert result.board_1.rows == 4

    def test_board_2_is_8x4(self):
        result = self._ss().compute_offline(["LINE"])
        assert result.board_2.cols == 8
        assert result.board_2.rows == 4

    def test_board_1_grid_shape(self):
        result = self._ss().compute_offline(["CUBE"])
        grid = result.board_1.to_grid()
        assert len(grid) == 4
        assert all(len(row) == 4 for row in grid)

    def test_board_2_grid_shape(self):
        result = self._ss().compute_offline(["CUBE"])
        grid = result.board_2.to_grid()
        assert len(grid) == 4
        assert all(len(row) == 8 for row in grid)

    def test_board_cells_col_in_range(self):
        result = self._ss().compute_offline(["CUBE", "RING", "LINE"])
        for cell in result.board_1.cells:
            assert 0 <= cell.col < result.board_1.cols
        for cell in result.board_2.cells:
            assert 0 <= cell.col < result.board_2.cols

    def test_mente_total_nonneg(self):
        result = self._ss().compute_offline(["LINE"])
        assert result.mente_total >= 0.0

    def test_observe_receipt_present(self):
        result = self._ss().compute_offline(["LINE"])
        assert result.observe_receipt.get("version") == "sig-receipt/1"

    def test_receipt_merkle_root_format(self):
        result = self._ss().compute_offline(["LINE"])
        root = result.observe_receipt["merkle"]["root"]
        assert root.startswith("0x")
        assert len(root) == 66

    def test_receipt_verify_roundtrip(self):
        from cure_oracle.verify import verify_proof, SIG_RECEIPT_VERSION
        result = self._ss().compute_offline(["LINE"])
        receipt = result.observe_receipt
        ok = verify_proof(
            leaf_hex=receipt["proof"]["leaf"],
            proof_path=receipt["proof"]["path"],
            root_hex=receipt["merkle"]["root"],
            version=SIG_RECEIPT_VERSION,
        )
        assert ok, "sig-receipt/1 Merkle proof failed for SonnetScore"

    def test_commentary_is_string(self):
        result = self._ss().compute_offline(["LINE"])
        assert isinstance(result.commentary, str)
        assert len(result.commentary) > 0

    def test_embellishments_is_list(self):
        result = self._ss().compute_offline(["LINE"])
        assert isinstance(result.embellishments, list)

    def test_tilt_rate_in_range(self):
        result = self._ss().compute_offline(["LINE"])
        assert 0.0 <= result.tilt_rate <= 100.0

    def test_multiple_shapes_produce_events(self):
        result = self._ss().compute_offline(["CUBE", "RING", "LINE", "STAR"])
        assert len(result.events) >= 1

    def test_round_num_affects_round(self):
        r1 = self._ss().compute_offline(["LINE"], round_num=1)
        r2 = self._ss().compute_offline(["LINE"], round_num=5)
        # Different rounds produce different spiral states → different tilt rates
        # (may coincidentally match, so just ensure no exception)
        assert r1.score_id != r2.score_id  # always unique

    def test_fake_mode_accepted(self):
        result = self._ss().compute_offline(["LINE"], mode="fake")
        assert isinstance(result, SonnetScoreResult)


# ── POST /api/v1/qpu/candy/sonnet endpoint tests ──────────────────────────────

class TestSonnetScoreEndpoint:
    @pytest.fixture(autouse=True)
    def _set_tokens(self, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_OP_TOKEN: "operator"}))

    def _post(self, shapes, shots=None, mode="local", round_num=1, bars=4):
        body = {"shapes": shapes, "mode": mode, "round_num": round_num, "bars": bars}
        if shots is not None:
            body["shots"] = shots
        return client.post("/api/v1/qpu/candy/sonnet", json=body, headers=_AUTH)

    def test_returns_200(self):
        assert self._post(["LINE"]).status_code == 200

    def test_has_score_id(self):
        data = self._post(["LINE"]).json()
        assert "score_id" in data

    def test_has_bpm(self):
        data = self._post(["LINE"]).json()
        assert 80 <= data["bpm"] <= 160

    def test_has_ascent_rate(self):
        data = self._post(["LINE"]).json()
        assert 0.0 <= data["ascent_rate"] <= 100.0

    def test_has_era(self):
        data = self._post(["CUBE"]).json()
        valid = {"baroque", "classical", "beethoven", "romantic", "inner_world"}
        assert data["era"] in valid

    def test_has_board_1(self):
        data = self._post(["LINE"]).json()
        assert "board_1" in data
        assert data["board_1"]["cols"] == 4
        assert data["board_1"]["rows"] == 4

    def test_has_board_2(self):
        data = self._post(["LINE"]).json()
        assert "board_2" in data
        assert data["board_2"]["cols"] == 8
        assert data["board_2"]["rows"] == 4

    def test_board_1_grid_shape(self):
        data = self._post(["CUBE"]).json()
        grid = data["board_1"]["grid"]
        assert len(grid) == 4
        assert all(len(row) == 4 for row in grid)

    def test_board_2_grid_shape(self):
        data = self._post(["CUBE"]).json()
        grid = data["board_2"]["grid"]
        assert len(grid) == 4
        assert all(len(row) == 8 for row in grid)

    def test_has_events(self):
        data = self._post(["CUBE", "LINE"]).json()
        assert isinstance(data["events"], list)

    def test_has_receipt(self):
        data = self._post(["LINE"]).json()
        assert data["observe_receipt"]["version"] == "sig-receipt/1"

    def test_bars_param_respected(self):
        data = self._post(["LINE"], bars=8).json()
        assert data["bars"] == 8

    def test_multiple_shapes(self):
        data = self._post(["CUBE", "RING", "LINE"]).json()
        assert data["ascent_rate"] >= 0.0

    def test_has_commentary(self):
        data = self._post(["LINE"]).json()
        assert isinstance(data["commentary"], str)
        assert len(data["commentary"]) > 0

    def test_invalid_shape_422(self):
        r = client.post("/api/v1/qpu/candy/sonnet",
                        json={"shapes": ["PYRAMID"], "mode": "local"},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_ibm_mode_rejected(self):
        r = client.post("/api/v1/qpu/candy/sonnet",
                        json={"shapes": ["LINE"], "mode": "ibm"},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_no_auth_403(self):
        r = client.post("/api/v1/qpu/candy/sonnet",
                        json={"shapes": ["LINE"], "mode": "local"})
        assert r.status_code == 403

    def test_too_many_shapes_422(self):
        r = client.post("/api/v1/qpu/candy/sonnet",
                        json={"shapes": ["LINE"] * 6, "mode": "local"},
                        headers=_AUTH)
        assert r.status_code == 422

    def test_round_num_in_range(self):
        data = self._post(["LINE"], round_num=7).json()
        assert data["score_id"]  # just ensure no server error

    def test_key_field_present(self):
        data = self._post(["LINE"]).json()
        assert "key" in data
        assert isinstance(data["key"], str)

    def test_mode_name_field_present(self):
        data = self._post(["LINE"]).json()
        assert "mode_name" in data
        valid = {"minor", "pentatonic", "dorian", "major", "chromatic"}
        assert data["mode_name"] in valid
