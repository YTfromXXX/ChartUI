"""Tests for cure_oracle/midi_viz.py and Phase L SSE stream endpoint.

Phase L: cure-{era}-r4 — PopKivy MIDI visualizer (B地点第七画面).

Coverage
--------
  TestMidiVizModule             — build_midi_viz_frame() unit-level (Qiskit mocked)
  TestQuantumSimStreamEndpoint  — GET /candy/quantum-sim/stream (FastAPI TestClient)
"""

from __future__ import annotations

import json
import asyncio
import datetime
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from cure_oracle.midi_viz import (
    CURRENT_REV, MIDI_CHANNELS,
    build_midi_viz_frame, MidiVizFrame, MidiVizChannel,
)
from cure_oracle.quantum_sim import run_quantum_sim
from cure_oracle.accelerator import AcceleratorRun, AcceleratorResult, SynthesizedResult

# ── auth ──────────────────────────────────────────────────────────────────────

_TEST_TOKEN = "phk-test-token"


@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch):
    monkeypatch.setenv("CURE_API_TOKENS", json.dumps({_TEST_TOKEN: "operator"}))


def _headers():
    return {"Authorization": f"Bearer {_TEST_TOKEN}"}


# ── mock helpers ──────────────────────────────────────────────────────────────

def _fake_run(shape="LINE") -> AcceleratorRun:
    return AcceleratorRun(
        shape=shape, q=0.85, slot="S1", delta=0.15,
        passed=True, sig_code="RING-φ.618-ε.001",
        backend="fake/statevector", shots=512,
        theta_disp="φ.618", circuit_hash="abc123",
    )


def _fake_acc_result(shapes=None) -> AcceleratorResult:
    shapes = shapes or ["LINE"]
    runs = [_fake_run(s) for s in shapes]
    synth = SynthesizedResult(
        slots={"S1": runs[0]},
        mente_total=0.57,
        mente_achieved=False,
        four_kings=False,
        missing_slots=["S2", "S3", "S4"],
    )
    return AcceleratorResult(
        runs=runs,
        synthesized=synth,
        observe_receipt={"merkle": {"root": "deadbeef"}},
        run_id=str(uuid.uuid4()),
        born_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )


def _fake_round_circuit(*args, **kwargs) -> dict:
    return {
        "round": kwargs.get("round_num", args[0] if args else 1),
        "mode": "local",
        "backend": "statevector",
        "when": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "qpu_seconds": None,
        "size": {"qubits": 13, "depth": 2},
        "guide_bits": [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        "active_guides_a": ["スハル-A0", "スハル-A2"],
        "active_guides_b": ["リナリス-B1"],
        "teleport_angle_a": 180.0,
        "teleport_angle_b": 180.0,
        "events": {"entanglement_shot": False, "superposition_dash": True, "luna_event": False},
        "counts": {"0000000000000": 128},
    }


@pytest.fixture(autouse=True)
def _mock_qiskit(monkeypatch):
    """Patch all Qiskit-dependent functions so no Qiskit install is required."""
    from cure_oracle.accelerator import VirtualAccelerator

    monkeypatch.setattr(VirtualAccelerator, "run",
                        lambda self, shapes, **kw: _fake_acc_result(shapes))
    import cure_oracle.round_circuit as _rc
    monkeypatch.setattr(_rc, "round_circuit", _fake_round_circuit)
    monkeypatch.setattr(_rc, "spiral_preview", lambda result: "[fake spiral]")


@pytest.fixture()
def client():
    from fastapi import FastAPI
    from cure_oracle.qpu_router import router
    from cure_oracle.security import SecurityAuditMiddleware
    app = FastAPI()
    app.add_middleware(SecurityAuditMiddleware)
    app.include_router(router)
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture()
def _patch_sleep(monkeypatch):
    """Patch asyncio.sleep to a no-op coroutine to avoid 20-second delays in stream tests."""
    async def _noop(_delay):
        pass
    monkeypatch.setattr("cure_oracle.qpu_router.asyncio.sleep", _noop)


# ── TestMidiVizModule ─────────────────────────────────────────────────────────

class TestMidiVizModule:
    def test_current_rev_is_4(self):
        assert CURRENT_REV == 4

    def test_midi_channels_length(self):
        assert len(MIDI_CHANNELS) == 4

    def test_midi_channels_names(self):
        assert MIDI_CHANNELS == ["大甲音", "甲音", "呂音", "呂音-bass"]

    def test_build_returns_midi_viz_frame(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert isinstance(frame, MidiVizFrame)

    def test_frame_has_4_channels(self):
        result = run_quantum_sim(["CUBE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert len(frame.channels) == 4

    def test_channels_are_midi_viz_channel(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        for ch in frame.channels:
            assert isinstance(ch, MidiVizChannel)

    def test_channel_names_match_midi_channels(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        names = [c.name for c in frame.channels]
        assert names == MIDI_CHANNELS

    def test_era_is_valid(self):
        from cure_oracle.mesh_score import VALID_ERAS
        result = run_quantum_sim(["CUBE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert frame.era in VALID_ERAS

    def test_version_contains_r4(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert f"r{CURRENT_REV}" in frame.version

    def test_bpm_positive(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert frame.bpm > 0

    def test_mente_total_is_float(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert isinstance(frame.mente_total, float)

    def test_fusion_note_non_empty(self):
        result = run_quantum_sim(["RING"], offline=True)
        frame = build_midi_viz_frame(result)
        assert len(frame.fusion_note) > 0

    def test_fused_shapes_non_empty(self):
        result = run_quantum_sim(["STAR"], offline=True)
        frame = build_midi_viz_frame(result)
        assert len(frame.fused_shapes) >= 1

    def test_ppqn_is_480(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        assert frame.ppqn == 480

    def test_channel_indices_ordered(self):
        result = run_quantum_sim(["LINE"], offline=True)
        frame = build_midi_viz_frame(result)
        indices = [c.index for c in frame.channels]
        assert indices == [0, 1, 2, 3]

    def test_notes_list(self):
        result = run_quantum_sim(["CUBE", "RING"], offline=True)
        frame = build_midi_viz_frame(result)
        assert isinstance(frame.notes, list)


# ── TestQuantumSimStreamEndpoint ──────────────────────────────────────────────

class TestQuantumSimStreamEndpoint:
    def _url(self, shapes="LINE", token=_TEST_TOKEN, frames=1):
        return (
            f"/api/v1/qpu/candy/quantum-sim/stream"
            f"?shapes={shapes}&token={token}&frames={frames}"
        )

    def test_returns_200(self, client, _patch_sleep):
        r = client.get(self._url())
        assert r.status_code == 200

    def test_requires_token(self, client):
        r = client.get(
            "/api/v1/qpu/candy/quantum-sim/stream?shapes=LINE&frames=1&token=bad-token"
        )
        assert r.status_code in (401, 403)

    def test_content_type_sse(self, client, _patch_sleep):
        r = client.get(self._url())
        assert "text/event-stream" in r.headers.get("content-type", "")

    def test_contains_sim_update_event(self, client, _patch_sleep):
        r = client.get(self._url())
        assert "event: sim_update" in r.text

    def test_sim_update_has_era(self, client, _patch_sleep):
        r = client.get(self._url())
        lines = [l for l in r.text.splitlines() if l.startswith("data:") and "sim_update" in l]
        assert lines
        payload = json.loads(lines[0].removeprefix("data:").strip())
        assert "era" in payload["data"]

    def test_contains_stream_end_event(self, client, _patch_sleep):
        r = client.get(self._url())
        assert "event: stream_end" in r.text

    def test_invalid_shape_422(self, client):
        r = client.get(self._url(shapes="INVALID"))
        assert r.status_code == 422

    def test_version_endpoint_has_quantum_sim_stream(self, client):
        r = client.get("/api/v1/qpu/candy/sonnet/version")
        assert "quantum_sim_stream" in r.json()["endpoint_map"]
