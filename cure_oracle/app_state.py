"""Cure-OS app state: pure-Python, no UI dependency.

AppState is the single source of truth for the Flet app.
Every screen reads from it; updates go through its async methods.
Keeping UI-free makes it easy to unit-test.
"""

from __future__ import annotations

import asyncio
import json
import logging
import pathlib
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

_log = logging.getLogger(__name__)

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

try:
    from cure_oracle.mente import (
        MENTE_CONST, check_mente, issue_birth_on_mente,
    )
except Exception:
    MENTE_CONST = 2.2882       # type: ignore[assignment]
    check_mente = None         # type: ignore[assignment]
    issue_birth_on_mente = None  # type: ignore[assignment]

try:
    from cure_oracle.quantum_sim import run_quantum_sim
except Exception:
    run_quantum_sim = None  # type: ignore[assignment]

try:
    from cure_oracle.midi_viz import build_midi_viz_frame
except Exception:
    build_midi_viz_frame = None  # type: ignore[assignment]


# ── view names ────────────────────────────────────────────────────────────────────────────────

HOME       = "home"
BENCHMARK  = "benchmark"
ROUND      = "round"
BIRTH_CERT = "birth_cert"
MENTE      = "mente"
VERIFY     = "verify"
MIDI_VIZ   = "midi_viz"   # Phase L — B地点第七画面


# ── data containers ────────────────────────────────────────────────────────────────────────────────

@dataclass
class BenchmarkState:
    running:     bool = False
    shape:       str  = "LINE"
    n_qubits:    int  = 4
    theta_disp:  str  = "√.414"
    shots:       int  = 4096
    mode:        str  = "local"
    result:      Optional[dict] = None
    error:       Optional[str]  = None


@dataclass
class RoundState:
    running:     bool = False
    round_num:   int  = 1
    mode:        str  = "local"
    result:      Optional[dict] = None
    preview:     Optional[str]  = None
    error:       Optional[str]  = None


@dataclass
class CertState:
    cert:        Optional[dict] = None
    html_path:   Optional[str]  = None
    error:       Optional[str]  = None


@dataclass
class MenteState:
    running:        bool           = False
    triangles:      list[dict]     = field(default_factory=list)
    check_result:   Optional[dict] = None
    birth_result:   Optional[dict] = None
    mente_total:    float          = 0.0
    mente_achieved: bool           = False
    missing_kings:  list[str]      = field(default_factory=list)
    error:          Optional[str]  = None


@dataclass
class VerifyState:
    """PopKivyDevice-OS B地点 — sig-receipt/1 Merkle receipt verification."""
    running:   bool           = False
    receipt:   Optional[dict] = None
    proof_ok:  Optional[bool] = None
    sig_ok:    Optional[bool] = None
    root_hash: Optional[str]  = None
    error:     Optional[str]  = None


@dataclass
class MidiVizState:
    """B地点第七画面 — リアルタイム MIDI ビジュアライザ状態 (Phase L, cure-{era}-r4)."""
    running:        bool           = False
    current_frame:  Optional[dict] = None   # serialised MidiVizFrame
    frames:         list[dict]     = field(default_factory=list)  # last 5 frames
    era:            str            = "baroque"
    mente_total:    float          = 0.0
    mente_achieved: bool           = False
    shapes:         list[str]      = field(default_factory=lambda: ["LINE"])
    error:          Optional[str]  = None


@dataclass
class AppState:
    current_view: str            = HOME
    benchmark:    BenchmarkState = field(default_factory=BenchmarkState)
    round:        RoundState     = field(default_factory=RoundState)
    cert:         CertState      = field(default_factory=CertState)
    mente:        MenteState     = field(default_factory=MenteState)
    verify:       VerifyState    = field(default_factory=VerifyState)
    midi_viz:     MidiVizState   = field(default_factory=MidiVizState)

    _listeners: list[Callable[[], None]] = field(default_factory=list, repr=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)

    # ── listener plumbing ────────────────────────────────────────────────────────────────────────────────

    def add_listener(self, cb: Callable[[], None]) -> None:
        self._listeners.append(cb)

    def _notify(self) -> None:
        for cb in self._listeners:
            try:
                cb()
            except Exception as exc:
                _log.warning("listener error: %s", exc, exc_info=True)

    def navigate(self, view: str) -> None:
        self.current_view = view
        self._notify()

    # ── benchmark ────────────────────────────────────────────────────────────────────────────────

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
        async with self._lock:
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
                    "shape":          result.shape,
                    "circuit_family": result.circuit_family,
                    "n_qubits":       result.n_qubits,
                    "theta_disp":     result.theta_disp,
                    "shots":          result.shots,
                    "backend":        result.backend,
                    "circuit_hash":   result.circuit_hash,
                    "delta":          round(result.delta, 6),
                    "eps_threshold":  result.eps_threshold,
                    "passed":         result.passed,
                    "sig_code":       result.sig_code,
                    "job_id":         result.job_id,
                    "qpu_seconds":    result.qpu_seconds,
                    "sig":            sig,
                }
            except Exception as exc:
                self.benchmark.error = str(exc)
            finally:
                self.benchmark.running = False
                self._notify()

    # ── round ────────────────────────────────────────────────────────────────────────────────

    async def run_round(
        self,
        round_num: int = 1,
        mode: str = "local",
        shots: int = 500,
        token: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> None:
        async with self._lock:
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

    # ── MENTE ────────────────────────────────────────────────────────────────────────────────

    async def run_mente(
        self,
        triangles: list[dict],
        round_result: Optional[dict] = None,
        cert_path: str = "cure_birth_certificate.json",
    ) -> None:
        async with self._lock:
            self.mente.running      = True
            self.mente.error        = None
            self.mente.check_result = None
            self.mente.birth_result = None
            self.mente.triangles    = list(triangles)
            self._notify()
            try:
                check = await asyncio.to_thread(check_mente, triangles)
                self.mente.mente_total    = check.mente_total
                self.mente.mente_achieved = check.mente_achieved
                self.mente.missing_kings  = check.missing_kings
                self.mente.check_result = {
                    "slots": [
                        {"label": s.label, "slot": s.slot, "king": s.king,
                         "sig": s.sig, "mente": s.mente, "epsilon": s.epsilon,
                         "shape": s.shape}
                        for s in check.slots
                    ],
                    "mente_total":    check.mente_total,
                    "mente_achieved": check.mente_achieved,
                    "mente_const":    check.mente_const,
                    "missing_kings":  check.missing_kings,
                }
                if check.mente_achieved and round_result is not None:
                    birth = await asyncio.to_thread(
                        issue_birth_on_mente, triangles, round_result, cert_path,
                    )
                    if birth is not None:
                        self.mente.birth_result = {
                            "cert":      birth.cert,
                            "receipts":  birth.receipts,
                            "cert_path": birth.cert_path,
                            "html_path": birth.html_path,
                        }
            except Exception as exc:
                self.mente.error = str(exc)
            finally:
                self.mente.running = False
                self._notify()

    # ── sig-receipt/1 verification (PopKivyDevice-OS B地点) ───────────────────────────────────────

    async def run_verify(self, receipt: dict) -> None:
        async with self._lock:
            self.verify.running  = True
            self.verify.receipt  = receipt
            self.verify.proof_ok = None
            self.verify.sig_ok   = None
            self.verify.root_hash = None
            self.verify.error    = None
            self._notify()

        try:
            from cure_oracle.verify import verify_proof, verify_sig_code, SIG_RECEIPT_VERSION
            merkle = receipt.get("merkle", {})
            proof  = receipt.get("proof", {})

            proof_ok = verify_proof(
                leaf_hex=proof.get("leaf", "0x" + "0" * 64),
                proof_path=proof.get("path", []),
                root_hex=merkle.get("root", "0x" + "0" * 64),
                version=SIG_RECEIPT_VERSION,
            )
            sig_ok = verify_sig_code(
                receipt.get("sig", ""),
                SIG_RECEIPT_VERSION,
            )
            async with self._lock:
                self.verify.proof_ok  = proof_ok
                self.verify.sig_ok    = sig_ok
                self.verify.root_hash = merkle.get("root")
        except Exception as exc:
            async with self._lock:
                self.verify.error = str(exc)
        finally:
            async with self._lock:
                self.verify.running = False
            self._notify()

    # ── MIDI visualizer (Phase L) ─────────────────────────────────────────────────────────────────────────────

    async def run_midi_viz(
        self,
        shapes: Optional[list[str]] = None,
        round_num: int = 1,
        bars: int = 4,
    ) -> None:
        """Run one quantum-sim fusion pass and update the MIDI visualizer state.

        Calls run_quantum_sim() (offline mode) → build_midi_viz_frame() and
        stores the result in midi_viz.current_frame + midi_viz.frames (last 5).
        """
        if shapes:
            self.midi_viz.shapes = list(shapes)
        async with self._lock:
            self.midi_viz.running = True
            self.midi_viz.error   = None
            self._notify()
            try:
                result = await asyncio.to_thread(
                    run_quantum_sim,
                    shapes=self.midi_viz.shapes,
                    round_num=round_num,
                    bars=bars,
                    offline=True,
                )
                frame = build_midi_viz_frame(result)
                frame_dict: dict = {
                    "frame_id":       frame.frame_id,
                    "born_at":        frame.born_at,
                    "era":            frame.era,
                    "version":        frame.version,
                    "bpm":            frame.bpm,
                    "bars":           frame.bars,
                    "mente_total":    frame.mente_total,
                    "mente_achieved": frame.mente_achieved,
                    "fusion_note":    frame.fusion_note,
                    "fused_shapes":   frame.fused_shapes,
                    "note_count":     len(frame.notes),
                    "channels": [
                        {
                            "index":        c.index,
                            "name":         c.name,
                            "note_count":   c.note_count,
                            "avg_velocity": c.avg_velocity,
                            "active":       c.active,
                        }
                        for c in frame.channels
                    ],
                }
                self.midi_viz.current_frame = frame_dict
                self.midi_viz.frames = (self.midi_viz.frames + [frame_dict])[-5:]
                self.midi_viz.era            = frame.era
                self.midi_viz.mente_total    = frame.mente_total
                self.midi_viz.mente_achieved = frame.mente_achieved
            except Exception as exc:
                self.midi_viz.error = str(exc)
            finally:
                self.midi_viz.running = False
                self._notify()

    # ── birth certificate ─────────────────────────────────────────────────────────────────────────────

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

    # ── serialise ─────────────────────────────────────────────────────────────────────────────

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
                "round_num":  self.round.round_num,
                "mode":       self.round.mode,
                "has_result": self.round.result is not None,
                "error":      self.round.error,
            },
            "cert": {
                "has_cert": self.cert.cert is not None,
                "error":    self.cert.error,
            },
            "mente": {
                "mente_total":    self.mente.mente_total,
                "mente_achieved": self.mente.mente_achieved,
                "missing_kings":  self.mente.missing_kings,
                "has_birth":      self.mente.birth_result is not None,
                "error":          self.mente.error,
            },
            "midi_viz": {
                "era":            self.midi_viz.era,
                "mente_total":    self.midi_viz.mente_total,
                "mente_achieved": self.midi_viz.mente_achieved,
                "frame_count":    len(self.midi_viz.frames),
                "shapes":         self.midi_viz.shapes,
                "error":          self.midi_viz.error,
            },
        }
