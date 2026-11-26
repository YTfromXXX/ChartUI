"""Cure-OS app state: pure-Python, no UI dependency.

AppState is the single source of truth for the Flet app.
Every screen reads from it; updates go through its async methods.
Keeping UI-free makes it easy to unit-test.
"""

from __future__ import annotations

import asyncio
import json
import pathlib
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

# module-level imports — present at import time so patch() can target them
try:
    from cure_oracle.benchmark import (
        run_benchmark, issue_sig_if_passed, CONFIRM,
    )
except Exception:  # Qiskit not installed
    run_benchmark = None      # type: ignore[assignment]
    issue_sig_if_passed = None  # type: ignore[assignment]
    CONFIRM = "RUN ON QPU"

try:
    from cure_oracle.round_circuit import round_circuit, spiral_preview
except Exception:
    round_circuit = None    # type: ignore[assignment]
    spiral_preview = None   # type: ignore[assignment]

try:
    from cure_oracle.birth import (
        load_certificate, make_certificate,
        save_certificate, certificate_html,
    )
except Exception:
    load_certificate = None   # type: ignore[assignment]
    make_certificate = None   # type: ignore[assignment]
    save_certificate = None   # type: ignore[assignment]
    certificate_html = None   # type: ignore[assignment]


# ── view names ────────────────────────────────────────────────────────────────

HOME       = "home"
BENCHMARK  = "benchmark"
ROUND      = "round"
BIRTH_CERT = "birth_cert"


# ── data containers ───────────────────────────────────────────────────────────

@dataclass
class BenchmarkState:
    running:     bool = False
    shape:       str  = "LINE"
    n_qubits:    int  = 4
    theta_disp:  str  = "√.414"
    shots:       int  = 4096
    mode:        str  = "local"
    result:      Optional[dict] = None   # serialised BenchmarkResult
    error:       Optional[str]  = None


@dataclass
class RoundState:
    running:     bool = False
    round_num:   int  = 1
    mode:        str  = "local"
    result:      Optional[dict] = None   # dict from round_circuit()
    preview:     Optional[str]  = None   # ASCII spiral_preview()
    error:       Optional[str]  = None


@dataclass
class CertState:
    cert:        Optional[dict] = None
    html_path:   Optional[str]  = None
    error:       Optional[str]  = None


@dataclass
class AppState:
    current_view: str            = HOME
    benchmark:    BenchmarkState = field(default_factory=BenchmarkState)
    round:        RoundState     = field(default_factory=RoundState)
    cert:         CertState      = field(default_factory=CertState)

    # registered UI-refresh callbacks (called after each state mutation)
    _listeners: list[Callable[[], None]] = field(default_factory=list, repr=False)

    # ── listener plumbing ─────────────────────────────────────────────────────

    def add_listener(self, cb: Callable[[], None]) -> None:
        self._listeners.append(cb)

    def _notify(self) -> None:
        for cb in self._listeners:
            try:
                cb()
            except Exception:
                pass

    def navigate(self, view: str) -> None:
        self.current_view = view
        self._notify()

    # ── benchmark ─────────────────────────────────────────────────────────────

    async def run_benchmark(
        self,
        shape: str,
        n_qubits: int = 4,
        theta_disp: str = "√.414",
        shots: int = 4096,
        mode: str = "local",
        token: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> None:
        self.benchmark.running = True
        self.benchmark.error   = None
        self.benchmark.result  = None
        self.benchmark.shape      = shape
        self.benchmark.n_qubits   = n_qubits
        self.benchmark.theta_disp = theta_disp
        self.benchmark.shots      = shots
        self.benchmark.mode       = mode
        self._notify()
        try:
            kwargs: dict[str, Any] = dict(
                shape=shape, n_qubits=n_qubits,
                theta_disp=theta_disp, shots=shots, mode=mode,
            )
            if mode == "ibm":
                kwargs.update(token=token, instance=instance, confirm=CONFIRM)
            result = await asyncio.to_thread(run_benchmark, **kwargs)
            sig = issue_sig_if_passed(result)
            self.benchmark.result = {
                "shape":        result.shape,
                "circuit_family": result.circuit_family,
                "n_qubits":     result.n_qubits,
                "theta_disp":   result.theta_disp,
                "shots":        result.shots,
                "backend":      result.backend,
                "circuit_hash": result.circuit_hash,
                "delta":        round(result.delta, 6),
                "eps_threshold": result.eps_threshold,
                "passed":       result.passed,
                "sig_code":     result.sig_code,
                "job_id":       result.job_id,
                "qpu_seconds":  result.qpu_seconds,
                "sig":          sig,
            }
        except Exception as exc:
            self.benchmark.error = str(exc)
        finally:
            self.benchmark.running = False
            self._notify()

    # ── round ─────────────────────────────────────────────────────────────────

    async def run_round(
        self,
        round_num: int = 1,
        mode: str = "local",
        shots: int = 500,
        token: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> None:
        self.round.running   = True
        self.round.error     = None
        self.round.result    = None
        self.round.preview   = None
        self.round.round_num = round_num
        self.round.mode      = mode
        self._notify()
        try:
            kwargs: dict[str, Any] = dict(round_num=round_num, mode=mode, shots=shots)
            if mode == "ibm":
                kwargs.update(token=token, instance=instance, confirm="RUN ON QPU")
            result = await asyncio.to_thread(round_circuit, **kwargs)
            self.round.result  = result
            self.round.preview = spiral_preview(result)
        except Exception as exc:
            self.round.error = str(exc)
        finally:
            self.round.running = False
            self._notify()

    # ── birth certificate ─────────────────────────────────────────────────────

    def load_cert(self, path: str = "cure_birth_certificate.json") -> None:
        self.cert.error = None
        cert = load_certificate(path)
        if cert is None:
            self.cert.error = f"証明書が見つかりません: {path}"
        else:
            self.cert.cert = cert
        self._notify()

    def set_cert_from_round(self, round_result: dict,
                            cert_path: str = "cure_birth_certificate.json") -> None:
        cert = make_certificate(round_result)
        save_certificate(cert, cert_path)
        p = pathlib.Path(cert_path)
        html_path = str(p.with_suffix(".html"))
        p.with_suffix(".html").write_text(certificate_html(cert), encoding="utf-8")
        self.cert.cert      = cert
        self.cert.html_path = html_path
        self._notify()

    # ── serialise (for persistence / debugging) ───────────────────────────────

    def to_dict(self) -> dict:
        return {
            "current_view": self.current_view,
            "benchmark": {
                "shape":      self.benchmark.shape,
                "n_qubits":   self.benchmark.n_qubits,
                "theta_disp": self.benchmark.theta_disp,
                "shots":      self.benchmark.shots,
                "mode":       self.benchmark.mode,
                "passed":     self.benchmark.result.get("passed") if self.benchmark.result else None,
                "error":      self.benchmark.error,
            },
            "round": {
                "round_num": self.round.round_num,
                "mode":      self.round.mode,
                "has_result": self.round.result is not None,
                "error":     self.round.error,
            },
            "cert": {
                "has_cert":  self.cert.cert is not None,
                "error":     self.cert.error,
            },
        }
