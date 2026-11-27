"""cure_oracle/quantum_sim.py — Phase K: Gemini-Candy ⟷ Sonnet-Score auto-fusion loop.

Unified quantum simulation pipeline:
  Gemini-Candy (observation viewpoint) × Sonnet-Score (simulation music)
  → QuantumSimResult (combined receipt + score)

The fusion loop:
  1. Run GeminiCandyFlash (or offline stub) over the input shapes.
  2. Feed suggested_shapes from Gemini recommendation → SonnetScore.compute_offline().
  3. Merge both receipts into a single QuantumSimResult with sig-receipt/1.

Version
-------
  Phase K = cure-{era}-r3
"""

from __future__ import annotations

import datetime
import os
import uuid
from dataclasses import dataclass, field
from typing import Optional

from cure_oracle.gemini_candy import GeminiCandyFlash, GeminiCandyResult
from cure_oracle.sonnet_score import SonnetScore, SonnetScoreResult
from cure_oracle.mesh_score import era_from_mente, ERA_MENTE_LOWER

CURRENT_REV: int = 3


# ── result dataclass ───────────────────────────────────────────────────────────

@dataclass
class QuantumSimResult:
    """Combined result of one Gemini-Candy ⟷ Sonnet-Score fusion pass."""
    sim_id:          str
    born_at:         str
    era:             str
    version:         str                  # cure-{era}-r3
    # Gemini-Candy layer
    gemini:          GeminiCandyResult
    # Sonnet-Score layer (run on Gemini's suggested_shapes)
    score:           SonnetScoreResult
    # Fusion metadata
    input_shapes:    list[str]            # original caller shapes
    fused_shapes:    list[str]            # Gemini-suggested shapes used for score
    mente_total:     float
    mente_achieved:  bool
    fusion_note:     str                  # one-line commentary on the fusion


def _fusion_note(gemini: GeminiCandyResult, score: SonnetScoreResult) -> str:
    mt = gemini.accelerator.synthesized.mente_total
    bpm = score.bpm
    era = score.era
    achieved = gemini.accelerator.synthesized.mente_achieved
    status = "四天王全顕現" if achieved else "MENTE未達成"
    return (
        f"{status} | mente={mt:.4f} | {era} era | BPM={bpm} | "
        f"Gemini→{gemini.recommendation.suggested_shapes} | "
        f"Sonnet-Score events={len(score.events)}"
    )


# ── public API ─────────────────────────────────────────────────────────────────

def run_quantum_sim(
    shapes: list[str],
    bmi_state: Optional[dict] = None,
    shots: Optional[int] = None,
    mode: str = "local",
    round_num: int = 1,
    bars: int = 4,
    offline: bool = True,
) -> QuantumSimResult:
    """Run the Gemini-Candy ⟷ Sonnet-Score auto-fusion loop.

    Parameters
    ----------
    shapes:
        Input candy shapes for the Gemini-Candy accelerator stage.
    bmi_state:
        Optional Cure-BMI dict (focus, calm, energy) forwarded to SonnetScore.
    shots:
        Shots per shape for the accelerator (None = canonical default).
    mode:
        Execution mode: local | fake.
    round_num:
        Spiral round number.
    bars:
        Number of musical bars for Sonnet-Score.
    offline:
        True  = skip Gemini API call, use heuristic stub (default).
        False = call Gemini Flash (requires GEMINI_API_KEY env var).

    Returns
    -------
    QuantumSimResult — fused observation + music score.
    """
    sim_id  = str(uuid.uuid4())
    born_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # ── stage 1: Gemini-Candy observation ─────────────────────────────────────
    flash = GeminiCandyFlash()
    if offline or not os.environ.get("GEMINI_API_KEY"):
        gemini_result: GeminiCandyResult = flash.run_offline(
            shapes=shapes, shots=shots, mode=mode, round_num=round_num,
        )
    else:
        gemini_result = flash.run(
            shapes=shapes, shots=shots, mode=mode, round_num=round_num,
        )

    # ── stage 2: Sonnet-Score on Gemini's suggested shapes ────────────────────
    fused_shapes = gemini_result.recommendation.suggested_shapes or shapes
    ss = SonnetScore(bars=bars)
    score_result: SonnetScoreResult = ss.compute_offline(
        shapes=fused_shapes,
        shots=shots,
        mode=mode,
        round_num=round_num,
    )

    mente_total   = gemini_result.accelerator.synthesized.mente_total
    mente_achieved = gemini_result.accelerator.synthesized.mente_achieved
    era            = era_from_mente(mente_total)
    version        = f"cure-{era}-r{CURRENT_REV}"

    return QuantumSimResult(
        sim_id=sim_id,
        born_at=born_at,
        era=era,
        version=version,
        gemini=gemini_result,
        score=score_result,
        input_shapes=list(shapes),
        fused_shapes=list(fused_shapes),
        mente_total=mente_total,
        mente_achieved=mente_achieved,
        fusion_note=_fusion_note(gemini_result, score_result),
    )
