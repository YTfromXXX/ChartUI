"""Tests for cure_oracle/app_state.py — UI-free app state."""

import asyncio
import pathlib
import json
from unittest.mock import patch, MagicMock

import pytest

from cure_oracle.app_state import (
    AppState, HOME, BENCHMARK, ROUND, BIRTH_CERT,
    BenchmarkState, RoundState, CertState,
)
from cure_oracle.benchmark import BenchmarkResult


# ── helpers ───────────────────────────────────────────────────────────────────

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _make_benchmark_result(**overrides) -> BenchmarkResult:
    defaults = dict(
        shape="LINE", circuit_family="ghz", n_qubits=4,
        theta_disp="√.414", shots=512,
        circuit_hash="0x" + "a" * 64,
        counts={"0000": 256, "1111": 256},
        ideal={"0000": 0.5, "1111": 0.5},
        delta=0.002, eps_threshold=0.01,
        passed=True, sig_code="LINE-√.414-ε.010",
        qasm="OPENQASM 2.0;", backend="aer_simulator",
        job_id=None, qpu_seconds=None,
    )
    defaults.update(overrides)
    return BenchmarkResult(**defaults)


# ── TestAppState basics ───────────────────────────────────────────────────────

class TestAppStateInit:
    def test_default_view_is_home(self):
        s = AppState()
        assert s.current_view == HOME

    def test_benchmark_state_defaults(self):
        s = AppState()
        assert s.benchmark.shape      == "LINE"
        assert s.benchmark.running    is False
        assert s.benchmark.result     is None
        assert s.benchmark.error      is None

    def test_round_state_defaults(self):
        s = AppState()
        assert s.round.round_num == 1
        assert s.round.running   is False
        assert s.round.result    is None

    def test_cert_state_defaults(self):
        s = AppState()
        assert s.cert.cert is None


# ── TestNavigation ────────────────────────────────────────────────────────────

class TestNavigation:
    def test_navigate_changes_view(self):
        s = AppState()
        s.navigate(BENCHMARK)
        assert s.current_view == BENCHMARK

    def test_navigate_notifies_listeners(self):
        s = AppState()
        calls = []
        s.add_listener(lambda: calls.append(1))
        s.navigate(ROUND)
        assert len(calls) == 1

    def test_navigate_through_all_views(self):
        s = AppState()
        for view in (HOME, BENCHMARK, ROUND, BIRTH_CERT):
            s.navigate(view)
            assert s.current_view == view


# ── TestBenchmarkRun ──────────────────────────────────────────────────────────

class TestBenchmarkRun:
    def test_run_benchmark_local_success(self):
        s = AppState()
        mock_result = _make_benchmark_result()
        with patch("cure_oracle.app_state.run_benchmark",
                   return_value=mock_result):
            with patch("cure_oracle.app_state.issue_sig_if_passed",
                       return_value="LINE-√.414-ε.010"):
                _run(s.run_benchmark("LINE", shots=512, mode="local"))
        assert s.benchmark.result is not None
        assert s.benchmark.result["shape"]  == "LINE"
        assert s.benchmark.result["passed"] is True
        assert s.benchmark.result["sig"]    == "LINE-√.414-ε.010"
        assert s.benchmark.error   is None
        assert s.benchmark.running is False

    def test_run_benchmark_stores_params(self):
        s = AppState()
        with patch("cure_oracle.app_state.run_benchmark",
                   return_value=_make_benchmark_result(shape="CUBE",
                                                        circuit_family="qaoa")):
            with patch("cure_oracle.app_state.issue_sig_if_passed",
                       return_value=None):
                _run(s.run_benchmark("CUBE", shots=1024, theta_disp="φ.618",
                                     mode="local"))
        assert s.benchmark.shape      == "CUBE"
        assert s.benchmark.shots      == 1024
        assert s.benchmark.theta_disp == "φ.618"

    def test_run_benchmark_failed_gives_sig_none(self):
        s = AppState()
        with patch("cure_oracle.app_state.run_benchmark",
                   return_value=_make_benchmark_result(passed=False,
                                                        sig_code="", delta=0.5)):
            with patch("cure_oracle.app_state.issue_sig_if_passed",
                       return_value=None):
                _run(s.run_benchmark("STAR", shots=1, mode="local"))
        assert s.benchmark.result["sig"] is None

    def test_run_benchmark_exception_stores_error(self):
        s = AppState()
        with patch("cure_oracle.app_state.run_benchmark",
                   side_effect=RuntimeError("qiskit error")):
            _run(s.run_benchmark("LINE", mode="local"))
        assert s.benchmark.error   == "qiskit error"
        assert s.benchmark.result  is None
        assert s.benchmark.running is False

    def test_run_benchmark_notifies_listeners(self):
        s = AppState()
        calls = []
        s.add_listener(lambda: calls.append(1))
        with patch("cure_oracle.app_state.run_benchmark",
                   return_value=_make_benchmark_result()):
            with patch("cure_oracle.app_state.issue_sig_if_passed",
                       return_value=None):
                _run(s.run_benchmark("LINE", mode="local"))
        # at least: start (running=True) + end (running=False)
        assert len(calls) >= 2

    def test_run_benchmark_result_has_all_keys(self):
        s = AppState()
        with patch("cure_oracle.app_state.run_benchmark",
                   return_value=_make_benchmark_result()):
            with patch("cure_oracle.app_state.issue_sig_if_passed",
                       return_value=None):
                _run(s.run_benchmark("LINE", mode="local"))
        for key in ("shape", "circuit_family", "n_qubits", "theta_disp",
                    "shots", "backend", "circuit_hash", "delta",
                    "eps_threshold", "passed", "sig_code", "job_id",
                    "qpu_seconds", "sig"):
            assert key in s.benchmark.result, f"missing key: {key}"


# ── TestRoundRun ──────────────────────────────────────────────────────────────

class TestRoundRun:
    def _mock_round_result(self, round_num: int = 1) -> dict:
        return {
            "round": round_num, "mode": "local", "backend": "aer_simulator",
            "when": "2026-11-26T00:00:00Z", "qpu_seconds": None,
            "size": 500, "guide_bits": "10110100",
            "active_guides_a": [0, 72], "active_guides_b": [36, 108],
            "teleport_angle_a": 153.43, "teleport_angle_b": 72.0,
            "events": {"luna_event": True},
            "counts": {"0000": 250, "1111": 250},
        }

    def test_run_round_success(self):
        s = AppState()
        result = self._mock_round_result()
        with patch("cure_oracle.app_state.round_circuit", return_value=result):
            with patch("cure_oracle.app_state.spiral_preview",
                       return_value="  ◎ preview"):
                _run(s.run_round(round_num=1, mode="local"))
        assert s.round.result  is not None
        assert s.round.preview == "  ◎ preview"
        assert s.round.error   is None
        assert s.round.running is False

    def test_run_round_stores_round_num(self):
        s = AppState()
        result = self._mock_round_result(round_num=7)
        with patch("cure_oracle.app_state.round_circuit", return_value=result):
            with patch("cure_oracle.app_state.spiral_preview", return_value=""):
                _run(s.run_round(round_num=7, mode="local"))
        assert s.round.round_num == 7

    def test_run_round_exception_stores_error(self):
        s = AppState()
        with patch("cure_oracle.app_state.round_circuit",
                   side_effect=RuntimeError("circuit error")):
            _run(s.run_round(mode="local"))
        assert s.round.error   == "circuit error"
        assert s.round.result  is None
        assert s.round.running is False

    def test_run_round_notifies_listeners(self):
        s = AppState()
        calls = []
        s.add_listener(lambda: calls.append(1))
        with patch("cure_oracle.app_state.round_circuit",
                   return_value=self._mock_round_result()):
            with patch("cure_oracle.app_state.spiral_preview", return_value=""):
                _run(s.run_round())
        assert len(calls) >= 2


# ── TestCertLoad ──────────────────────────────────────────────────────────────

class TestCertLoad:
    def test_load_cert_success(self):
        s = AppState()
        cert = {"certificate_id": "CERT-001", "game_token": "GT-X",
                "born_at": "2026-11-26T00:00:00Z", "backend": "ibm_torino",
                "bitstring": "0101", "teleport_angle_a": 90.0,
                "teleport_angle_b": 45.0, "events": {}}
        with patch("cure_oracle.app_state.load_certificate", return_value=cert):
            s.load_cert("cert.json")
        assert s.cert.cert is not None
        assert s.cert.cert["certificate_id"] == "CERT-001"
        assert s.cert.error is None

    def test_load_cert_not_found(self):
        s = AppState()
        with patch("cure_oracle.app_state.load_certificate", return_value=None):
            s.load_cert("missing.json")
        assert s.cert.cert  is None
        assert s.cert.error is not None
        assert "missing.json" in s.cert.error

    def test_load_cert_notifies_listeners(self):
        s = AppState()
        calls = []
        s.add_listener(lambda: calls.append(1))
        with patch("cure_oracle.app_state.load_certificate", return_value=None):
            s.load_cert("x.json")
        assert len(calls) == 1

    def test_set_cert_from_round(self, tmp_path):
        from cure_oracle.round_circuit import round_circuit
        s = AppState()
        cert_path = str(tmp_path / "cert.json")
        # use a real local round_circuit result so make_certificate gets the right format
        round_result = round_circuit(1, mode="local", shots=50)
        s.set_cert_from_round(round_result, cert_path=cert_path)
        assert s.cert.cert is not None
        assert pathlib.Path(cert_path).exists()
        assert s.cert.html_path is not None


# ── TestToDict ────────────────────────────────────────────────────────────────

class TestToDict:
    def test_to_dict_has_required_keys(self):
        s = AppState()
        d = s.to_dict()
        assert "current_view" in d
        assert "benchmark" in d
        assert "round" in d
        assert "cert" in d

    def test_to_dict_reflects_navigation(self):
        s = AppState()
        s.navigate(BENCHMARK)
        assert s.to_dict()["current_view"] == BENCHMARK

    def test_to_dict_reflects_benchmark_error(self):
        s = AppState()
        s.benchmark.error = "oops"
        assert s.to_dict()["benchmark"]["error"] == "oops"
