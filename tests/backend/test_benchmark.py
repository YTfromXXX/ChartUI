"""Tests for cure_oracle/benchmark.py."""

import math
import pytest
from cure_oracle.benchmark import (
    BENCHMARK_VERSION,
    CAMPAIGN_SHAPES,
    SHAPE_CIRCUIT_MAP,
    BenchmarkResult,
    build_circuit,
    compare_ibm_result,
    issue_sig_if_passed,
    run_benchmark,
    _circuit_hash,
    _circuit_to_qasm,
    _total_variation_distance,
    _ideal_distribution,
    _THETA_INFO,
)


# ── TestCircuitBuilders ────────────────────────────────────────────────────────

class TestCircuitBuilders:
    @pytest.mark.parametrize("shape", ["CUBE", "RING", "TREE", "LINE", "STAR"])
    def test_build_returns_circuit(self, shape):
        circ = build_circuit(shape, n_qubits=4)
        assert circ is not None

    @pytest.mark.parametrize("shape", ["CUBE", "RING", "TREE", "LINE", "STAR"])
    def test_circuit_has_measurements(self, shape):
        circ = build_circuit(shape, n_qubits=4)
        assert circ.num_clbits == 4

    @pytest.mark.parametrize("shape", ["CUBE", "RING", "TREE", "LINE", "STAR"])
    def test_circuit_qubit_count(self, shape):
        for n in (2, 4, 6):
            circ = build_circuit(shape, n_qubits=n)
            assert circ.num_qubits == n

    def test_unknown_shape_raises(self):
        with pytest.raises(ValueError, match="unknown shape"):
            build_circuit("BLOB", n_qubits=4)

    def test_qasm_is_string(self):
        circ = build_circuit("LINE", n_qubits=4)
        qasm = _circuit_to_qasm(circ)
        assert isinstance(qasm, str)
        assert len(qasm) > 20


# ── TestCircuitHash ────────────────────────────────────────────────────────────

class TestCircuitHash:
    def test_hash_format(self):
        circ = build_circuit("CUBE", n_qubits=4)
        h = _circuit_hash(_circuit_to_qasm(circ))
        assert h.startswith("0x")
        assert len(h) == 66  # 0x + 64 hex chars

    def test_hash_is_hex(self):
        circ = build_circuit("RING", n_qubits=4)
        h = _circuit_hash(_circuit_to_qasm(circ))
        int(h[2:], 16)  # should not raise

    def test_different_circuits_different_hashes(self):
        h1 = _circuit_hash(_circuit_to_qasm(build_circuit("CUBE", n_qubits=4)))
        h2 = _circuit_hash(_circuit_to_qasm(build_circuit("LINE", n_qubits=4)))
        assert h1 != h2

    def test_same_circuit_same_hash(self):
        qasm = _circuit_to_qasm(build_circuit("LINE", n_qubits=4))
        assert _circuit_hash(qasm) == _circuit_hash(qasm)


# ── TestIdealDistribution ──────────────────────────────────────────────────────

class TestIdealDistribution:
    def test_ghz_exact_two_states(self):
        ideal = _ideal_distribution("LINE", 4, math.pi * 0.414)
        assert set(ideal.keys()) == {"0000", "1111"}
        assert abs(ideal["0000"] - 0.5) < 1e-9
        assert abs(ideal["1111"] - 0.5) < 1e-9

    def test_qft_uniform(self):
        n = 4
        ideal = _ideal_distribution("TREE", n, math.pi * 0.785)
        assert len(ideal) == 2 ** n
        for v in ideal.values():
            assert abs(v - 1.0 / 2**n) < 1e-9

    def test_qft_sums_to_one(self):
        ideal = _ideal_distribution("TREE", 4, math.pi * 0.785)
        assert abs(sum(ideal.values()) - 1.0) < 1e-9

    def test_ghz_sums_to_one(self):
        ideal = _ideal_distribution("LINE", 4, math.pi * 0.414)
        assert abs(sum(ideal.values()) - 1.0) < 1e-9

    def test_qaoa_sums_to_one(self):
        ideal = _ideal_distribution("CUBE", 4, math.pi * 0.618)
        assert abs(sum(ideal.values()) - 1.0) < 1e-6

    def test_vqe_sums_to_one(self):
        ideal = _ideal_distribution("RING", 4, math.pi * 0.785)
        assert abs(sum(ideal.values()) - 1.0) < 1e-6


# ── TestTVD ────────────────────────────────────────────────────────────────────

class TestTVD:
    def test_identical_zero(self):
        ideal = {"00": 0.5, "11": 0.5}
        counts = {"00": 500, "11": 500}
        assert _total_variation_distance(counts, ideal, 1000) == pytest.approx(0.0)

    def test_completely_wrong_one(self):
        ideal = {"00": 0.5, "11": 0.5}
        counts = {"01": 1000}
        assert _total_variation_distance(counts, ideal, 1000) == pytest.approx(1.0)

    def test_half_wrong_half(self):
        ideal = {"00": 0.5, "11": 0.5}
        counts = {"00": 1000}
        assert _total_variation_distance(counts, ideal, 1000) == pytest.approx(0.5)

    def test_range_zero_to_one(self):
        ideal = {"00": 0.5, "11": 0.5}
        for c00 in range(0, 11):
            counts = {"00": c00 * 100, "11": 1000 - c00 * 100}
            d = _total_variation_distance(counts, ideal, 1000)
            assert 0.0 <= d <= 1.0


# ── TestRunBenchmark ───────────────────────────────────────────────────────────

class TestRunBenchmark:
    @pytest.mark.parametrize("shape", ["CUBE", "RING", "TREE", "LINE", "STAR"])
    def test_returns_benchmark_result(self, shape):
        r = run_benchmark(shape, n_qubits=4, theta_disp="φ.618", shots=1024, seed=42)
        assert isinstance(r, BenchmarkResult)

    @pytest.mark.parametrize("shape", ["CUBE", "RING", "TREE", "LINE", "STAR"])
    def test_shape_stored(self, shape):
        r = run_benchmark(shape, n_qubits=4, shots=1024, seed=42)
        assert r.shape == shape

    @pytest.mark.parametrize("shape,family", SHAPE_CIRCUIT_MAP.items())
    def test_circuit_family_mapping(self, shape, family):
        r = run_benchmark(shape, n_qubits=4, shots=1024, seed=42)
        assert r.circuit_family == family

    def test_circuit_hash_format(self):
        r = run_benchmark("LINE", n_qubits=4, shots=512, seed=0)
        assert r.circuit_hash.startswith("0x")
        assert len(r.circuit_hash) == 66

    def test_counts_sum_to_shots(self):
        shots = 2048
        r = run_benchmark("LINE", n_qubits=4, shots=shots, seed=1)
        assert sum(r.counts.values()) == shots

    def test_delta_in_range(self):
        r = run_benchmark("LINE", n_qubits=4, shots=4096, seed=42)
        assert 0.0 <= r.delta <= 1.0

    def test_ghz_low_delta_high_shots(self):
        r = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=65536, seed=0)
        # GHZ ideal is deterministic; Aer should nail it → δ << ε.010
        assert r.delta < 0.01

    def test_passed_flag_consistent(self):
        r = run_benchmark("LINE", n_qubits=4, shots=65536, seed=0)
        assert r.passed == (r.delta <= r.eps_threshold)

    def test_sig_code_format_when_passed(self):
        r = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=65536, seed=0)
        if r.passed:
            assert r.sig_code == f"LINE-√.414-ε.010"

    def test_sig_code_empty_when_failed(self):
        # force failure by using tiny shots → high TVD for STAR
        r = run_benchmark("STAR", n_qubits=4, theta_disp="φ.618", shots=1, seed=99)
        if not r.passed:
            assert r.sig_code == ""

    def test_qasm_non_empty(self):
        r = run_benchmark("TREE", n_qubits=4, shots=512, seed=0)
        assert len(r.qasm) > 50

    def test_backend_name_stored(self):
        r = run_benchmark("GHZ" if False else "LINE", n_qubits=4, shots=512, seed=0)
        assert r.backend == "aer_simulator"

    def test_unknown_shape_raises(self):
        with pytest.raises(ValueError, match="unknown shape"):
            run_benchmark("BLOB", n_qubits=4, shots=512)

    def test_unknown_theta_raises(self):
        with pytest.raises(ValueError, match="unknown theta_disp"):
            run_benchmark("CUBE", n_qubits=4, theta_disp="ψ.999", shots=512)

    def test_eps_code_property(self):
        r = run_benchmark("TREE", n_qubits=4, theta_disp="π.785", shots=512, seed=0)
        assert r.eps_code == "ε.003"


# ── TestIssueSig ──────────────────────────────────────────────────────────────

class TestIssueSig:
    def test_returns_string_when_passed(self):
        r = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=65536, seed=0)
        if r.passed:
            sig = issue_sig_if_passed(r)
            assert isinstance(sig, str)
            assert sig.startswith("LINE-")

    def test_returns_none_when_failed(self):
        r = run_benchmark("STAR", n_qubits=4, theta_disp="φ.618", shots=1, seed=0)
        if not r.passed:
            assert issue_sig_if_passed(r) is None

    def test_ghz_passes_at_high_shots(self):
        r = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=131072, seed=42)
        assert r.passed is True
        assert issue_sig_if_passed(r) == "LINE-√.414-ε.010"

    def test_qft_passes_at_high_shots(self):
        r = run_benchmark("TREE", n_qubits=4, theta_disp="√.414", shots=131072, seed=42)
        assert r.passed is True


# ── TestCompareIBM ────────────────────────────────────────────────────────────

class TestCompareIBM:
    def test_perfect_ibm_counts_low_delta(self):
        # Perfect IBM counts matching the ideal GHZ distribution
        aer = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=1024, seed=0)
        ibm_counts = {"0000": 512, "1111": 512}
        delta, passed, sig = compare_ibm_result(ibm_counts, aer)
        assert delta < 0.01

    def test_noisy_ibm_higher_delta(self):
        aer = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=1024, seed=0)
        # Simulate noisy hardware with spurious states
        ibm_counts = {"0000": 420, "1111": 420, "0001": 60, "1110": 60, "0100": 44}
        delta_clean, _, _ = compare_ibm_result({"0000": 500, "1111": 500}, aer)
        delta_noisy, _, _ = compare_ibm_result(ibm_counts, aer)
        assert delta_noisy > delta_clean

    def test_returns_triple(self):
        aer = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=1024, seed=0)
        result = compare_ibm_result({"0000": 500, "1111": 524}, aer)
        assert len(result) == 3
        delta, passed, sig = result
        assert isinstance(delta, float)
        assert isinstance(passed, bool)
        assert isinstance(sig, str)

    def test_sig_code_format_on_pass(self):
        aer = run_benchmark("LINE", n_qubits=4, theta_disp="√.414", shots=1024, seed=0)
        _, passed, sig = compare_ibm_result({"0000": 500, "1111": 500}, aer)
        if passed:
            assert sig == "LINE-√.414-ε.010"


# ── TestCampaignShapes ────────────────────────────────────────────────────────

class TestCampaignShapes:
    def test_all_five_shapes(self):
        shapes = {c["shape"] for c in CAMPAIGN_SHAPES}
        assert shapes == set(SHAPE_CIRCUIT_MAP.keys())

    def test_valid_theta_disps(self):
        for c in CAMPAIGN_SHAPES:
            assert c["theta_disp"] in _THETA_INFO

    def test_benchmark_version(self):
        assert BENCHMARK_VERSION == "benchmark/1"


# ── TestThetaInfo ─────────────────────────────────────────────────────────────

class TestThetaInfo:
    def test_all_three_theta_keys(self):
        assert set(_THETA_INFO.keys()) == {"φ.618", "π.785", "√.414"}

    def test_eps_ordering(self):
        # φ.618 is tightest, √.414 is loosest
        eps = {k: v[1] for k, v in _THETA_INFO.items()}
        assert eps["φ.618"] < eps["π.785"] < eps["√.414"]

    def test_angle_values_in_range(self):
        for theta_val, _, _ in _THETA_INFO.values():
            assert 0 < theta_val < math.pi * 1.1
