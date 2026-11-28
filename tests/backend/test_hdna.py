"""tests/backend/test_hdna.py — Harmonia DNA Format (.hdna) tests.

SPEC_REV "1.0" — 24 tests in 2 classes:
  TestHdnaFormat   (16 tests) — encoder/decoder, chunk structure, size budget
  TestHdnaEndpoint  (8 tests) — FastAPI GET /candy/hdna/pack
"""

from __future__ import annotations

import struct
from typing import Iterator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURE_API_TOKENS", "op:OPERATOR:testtoken123")


@pytest.fixture(autouse=True)
def _mock_qiskit() -> Iterator[None]:
    va_mock = MagicMock()
    va_mock.run.return_value = MagicMock(
        runs=[], synthesized=MagicMock(
            mente_total=1.5, mente_achieved=False, four_kings=False,
            missing_slots=[], slots={},
        ),
        observe_receipt={}, run_id="test-run-id",
        born_at="2026-01-01T00:00:00+00:00",
    )
    with (
        patch("cure_oracle.accelerator.VirtualAccelerator.run", va_mock.run),
        patch("cure_oracle.round_circuit.round_circuit", MagicMock(
            return_value={"result": "mocked", "era": "baroque"}
        )),
        patch("cure_oracle.round_circuit.spiral_preview", MagicMock(return_value="mock_b64")),
    ):
        yield


# ── helpers ───────────────────────────────────────────────────────────────────

def _minimal_frame_dict(era: str = "baroque") -> dict:
    """Minimal CureBmiFrame-shaped dict for testing."""
    return {
        "frame_id":    "test-frame-00000000-0000-0000-0000-000000000001",
        "era":         era,
        "band":        "ALPHA",
        "mente_total": 1.5,
        "tempo_mod":   1.1,
        "knot_score":  {
            "knot_pitch":  1,
            "theta_q":     0.65,
            "mente_total": 1.5,
            "strips": [
                {"notes": [{"pitch": 61, "velocity": 64, "dur_ticks": 480}]},
            ],
            "magic_circle": {
                "placements": [[0.1 * i for i in range(12)]] + [[0.0] * 12] * 11,
            },
        },
        "sport_scene": {"scene": "trading"},
    }


def _app():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    app = FastAPI()
    app.include_router(router)
    return app


# ── TestHdnaFormat ────────────────────────────────────────────────────────────

class TestHdnaFormat:
    """Unit tests for cure_oracle/hdna.py."""

    def test_spec_rev_is_1_0(self):
        from cure_oracle.hdna import SPEC_REV
        assert SPEC_REV == "1.0"

    def test_magic_bytes(self):
        from cure_oracle.hdna import MAGIC
        assert MAGIC == b"HDNA"

    def test_encode_starts_with_magic(self):
        from cure_oracle.hdna import build_hdna_card, encode
        card = build_hdna_card(_minimal_frame_dict())
        data = encode(card)
        assert data[:4] == b"HDNA"

    def test_encode_decode_roundtrip(self):
        from cure_oracle.hdna import build_hdna_card, encode, decode
        card = build_hdna_card(_minimal_frame_dict())
        data = encode(card)
        card2 = decode(data)
        assert card2.mdna.bpm == card.mdna.bpm
        assert card2.mdna.key_pc == card.mdna.key_pc
        assert card2.vart.rarity == card.vart.rarity

    def test_crc_corruption_raises(self):
        from cure_oracle.hdna import build_hdna_card, encode, decode
        data = bytearray(encode(build_hdna_card(_minimal_frame_dict())))
        data[-1] ^= 0xFF   # corrupt last CRC byte
        with pytest.raises(ValueError, match="CRC"):
            decode(bytes(data))

    def test_bad_magic_raises(self):
        from cure_oracle.hdna import decode
        with pytest.raises(ValueError, match="bad magic"):
            decode(b"WXYZ\x01\x00" + b"\x00" * 20)

    def test_size_under_4kb(self):
        from cure_oracle.hdna import build_hdna_card, encode
        # add 32 notes to simulate realistic MDNA
        frame = _minimal_frame_dict()
        frame["knot_score"]["strips"] = [
            {"notes": [{"pitch": 60 + i % 12, "velocity": 64, "dur_ticks": 240}
                       for i in range(32)]}
        ]
        data = encode(build_hdna_card(frame))
        assert len(data) < 4096, f"size {len(data)} exceeds 4 KB target"

    def test_rarity_legendary_at_high_theta(self):
        from cure_oracle.hdna import build_hdna_card
        frame = _minimal_frame_dict()
        frame["knot_score"]["theta_q"] = 0.95
        card = build_hdna_card(frame)
        assert card.rarity_label == "legendary"

    def test_rarity_common_at_low_theta(self):
        from cure_oracle.hdna import build_hdna_card
        frame = _minimal_frame_dict()
        frame["knot_score"]["theta_q"] = 0.1
        card = build_hdna_card(frame)
        assert card.rarity_label == "common"

    def test_era_round_trips(self):
        from cure_oracle.hdna import build_hdna_card, encode, decode
        frame = _minimal_frame_dict(era="romantic")
        card2 = decode(encode(build_hdna_card(frame)))
        assert card2.era == "romantic"

    def test_scene_stored_correctly(self):
        from cure_oracle.hdna import build_hdna_card
        frame = _minimal_frame_dict()
        frame["sport_scene"] = {"scene": "soccer"}
        card = build_hdna_card(frame)
        assert card.scene == "soccer"

    def test_chain_flag_active_with_resonance(self):
        from cure_oracle.hdna import build_hdna_card, encode, FLAG_CHAIN
        frame = _minimal_frame_dict()
        card = build_hdna_card(
            frame,
            two_ago="frame-aaa",   # slot0 ≠ slot2 → chain active
            previous="frame-bbb",
        )
        data = encode(card)
        flags = data[5]
        assert flags & FLAG_CHAIN

    def test_fingerprint_length(self):
        from cure_oracle.hdna import fingerprint, RESONANCE_FP_LEN
        fp = fingerprint("test-frame-id")
        assert len(fp) == RESONANCE_FP_LEN

    def test_note_event_pack_unpack(self):
        from cure_oracle.hdna import NoteEvent
        n = NoteEvent(pitch=60, velocity=90, start_tick=480, dur_ticks=240)
        n2 = NoteEvent.unpack(n.pack())
        assert n2.pitch == 60
        assert n2.velocity == 90
        assert n2.dur_ticks == 240

    def test_b64_roundtrip(self):
        from cure_oracle.hdna import build_hdna_card, encode_b64, decode_b64
        card = build_hdna_card(_minimal_frame_dict())
        s = encode_b64(card)
        assert isinstance(s, str)
        card2 = decode_b64(s)
        assert card2.mdna.bpm == card.mdna.bpm

    def test_to_dict_has_expected_keys(self):
        from cure_oracle.hdna import build_hdna_card
        d = build_hdna_card(_minimal_frame_dict()).to_dict()
        for key in ["spec_rev", "era", "band", "scene", "rarity", "bpm",
                    "key_pc", "mente_total", "theta_q", "note_count",
                    "trade_count", "chain_active", "origin_ref"]:
            assert key in d, f"missing key: {key}"


# ── TestHdnaEndpoint ──────────────────────────────────────────────────────────

class TestHdnaEndpoint:
    """FastAPI integration tests for GET /api/v1/qpu/candy/hdna/pack."""

    def test_pack_200_ok(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200

    def test_pack_requires_token(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "LINE"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_pack_has_hdna_b64(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "hdna_b64" in resp.json()

    def test_pack_b64_decodes_to_valid_card(self):
        import base64
        from cure_oracle.hdna import decode
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        raw = base64.b64decode(resp.json()["hdna_b64"])
        assert raw[:4] == b"HDNA"

    def test_pack_has_card_summary(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert "card" in resp.json()
        assert "rarity" in resp.json()["card"]

    def test_pack_size_field_under_4096(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "LINE", "token": "testtoken123"},
        )
        assert resp.status_code == 200
        assert resp.json()["size_bytes"] < 4096

    def test_pack_invalid_shape_422(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/qpu/candy/hdna/pack",
            params={"shapes": "INVALID_SHAPE", "token": "testtoken123"},
        )
        assert resp.status_code == 422

    def test_version_endpoint_has_hdna(self):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/api/v1/qpu/candy/sonnet/version", params={"mente_total": 0.0})
        assert resp.status_code == 200
        assert "hdna" in resp.json().get("endpoint_map", {})


# ── local helper (re-exported for tests) ─────────────────────────────────────

def _minimal_frame_dict(era: str = "baroque") -> dict:
    return {
        "frame_id":    "test-frame-00000000-0000-0000-0000-000000000001",
        "era":         era,
        "band":        "ALPHA",
        "mente_total": 1.5,
        "tempo_mod":   1.1,
        "knot_score":  {
            "knot_pitch":  1,
            "theta_q":     0.65,
            "mente_total": 1.5,
            "strips": [
                {"notes": [{"pitch": 61, "velocity": 64, "dur_ticks": 480}]},
            ],
            "magic_circle": {
                "placements": [[0.1 * i for i in range(12)]] + [[0.0] * 12] * 11,
            },
        },
        "sport_scene": {"scene": "trading"},
    }
