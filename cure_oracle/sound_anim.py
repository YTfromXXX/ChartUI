"""cure_oracle/sound_anim.py — Phase S: Audio → Animation Hint Classifier.

CURRENT_REV = 11 — B地点第十四画面

Rule-based EEG × sport-scene event label predictor for FIKU / 384candy devices.
Derives a human-readable animation hint from BMI state + scene context.

Input:  band, energy, focus, calm, coherence_score, scene, tempo_mod
Output: AnimHint  —  label, scene, confidence [0,100], motion_class, intensity, hint_str

Hint string format: "[scene:event_label:confidence_pct]"
  e.g. "[soccer:goal_celebration:87]"
       "[trading:breakout:62]"

Event vocabulary per scene
---------------------------
  soccer   — goal_celebration / corner_kick / free_kick / dribble_run / tackle / idle
  surfing  — tube_ride / wave_break / aerial / paddle_out / wipeout / shore_rest
  climbing — top_out / dynamo / crimp_move / rest_hold / chalk_up / idle
  live     — crowd_surge / drop / chorus / verse / breakdown / outro
  trading  — breakout / momentum_up / reversal / momentum_down / consolidation / idle
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ── constants ─────────────────────────────────────────────────────────────────

CURRENT_REV: int = 11

PHI         = (1 + 5 ** 0.5) / 2
MENTE_CONST = PHI * math.sqrt(2)   # ≈ 2.2882

# EEG band → base action contribution (GAMMA=peak, DELTA=rest)
_BAND_ACTION: dict[str, float] = {
    "GAMMA": 1.0,
    "BETA":  0.7,
    "ALPHA": 0.5,
    "THETA": 0.3,
    "DELTA": 0.0,
}

# (label, motion_class, min_action_score, max_action_score)
# action score range is [0.0, 1.0]; events are tested in order (first match wins)
_SCENE_EVENTS: dict[str, list[tuple[str, str, float, float]]] = {
    "soccer": [
        ("goal_celebration", "peak",      0.85, 1.01),
        ("corner_kick",      "set_piece", 0.65, 0.85),
        ("free_kick",        "set_piece", 0.50, 0.65),
        ("dribble_run",      "dynamic",   0.35, 0.50),
        ("tackle",           "contact",   0.20, 0.35),
        ("idle",             "static",    0.00, 0.20),
    ],
    "surfing": [
        ("tube_ride",        "peak",      0.85, 1.01),
        ("wave_break",       "dynamic",   0.60, 0.85),
        ("aerial",           "dynamic",   0.45, 0.60),
        ("paddle_out",       "steady",    0.25, 0.45),
        ("wipeout",          "contact",   0.15, 0.25),
        ("shore_rest",       "static",    0.00, 0.15),
    ],
    "climbing": [
        ("top_out",          "peak",      0.85, 1.01),
        ("dynamo",           "dynamic",   0.65, 0.85),
        ("crimp_move",       "precision", 0.45, 0.65),
        ("rest_hold",        "steady",    0.25, 0.45),
        ("chalk_up",         "static",    0.10, 0.25),
        ("idle",             "static",    0.00, 0.10),
    ],
    "live": [
        ("crowd_surge",      "peak",      0.85, 1.01),
        ("drop",             "dynamic",   0.70, 0.85),
        ("chorus",           "dynamic",   0.55, 0.70),
        ("verse",            "steady",    0.35, 0.55),
        ("breakdown",        "tension",   0.20, 0.35),
        ("outro",            "static",    0.00, 0.20),
    ],
    "trading": [
        ("breakout",         "peak",      0.80, 1.01),
        ("momentum_up",      "dynamic",   0.60, 0.80),
        ("reversal",         "tension",   0.45, 0.60),
        ("momentum_down",    "dynamic",   0.30, 0.45),
        ("consolidation",    "steady",    0.15, 0.30),
        ("idle",             "static",    0.00, 0.15),
    ],
}

# ── dataclass ─────────────────────────────────────────────────────────────────

@dataclass
class AnimHint:
    """Animation prediction output for a single BMI frame."""
    label:        str    # e.g. "goal_celebration"
    scene:        str    # e.g. "soccer"
    confidence:   int    # 0…100 (derived from EEG coherence)
    motion_class: str    # "peak" / "dynamic" / "steady" / "static" / "tension" / etc.
    intensity:    float  # 0.0…1.0  (normalized action_score)
    hint_str:     str    # "[scene:label:confidence_pct]" ready for display

    def to_dict(self) -> dict:
        return {
            "label":        self.label,
            "scene":        self.scene,
            "confidence":   self.confidence,
            "motion_class": self.motion_class,
            "intensity":    round(self.intensity, 4),
            "hint_str":     self.hint_str,
        }


# ── core logic ────────────────────────────────────────────────────────────────

def _action_score(band: str, energy: float, focus: float) -> float:
    """Combine EEG band, energy and focus into a [0, 1] action score."""
    band_w = _BAND_ACTION.get(band, 0.5)
    score  = energy * 0.40 + focus * 0.30 + band_w * 0.30
    return max(0.0, min(1.0, score))


def predict_anim_hint(
    band:            str,
    energy:          float,
    focus:           float,
    calm:            float,     # noqa: ARG001  (reserved for future calm-brake)
    coherence_score: float,
    scene:           str,
    tempo_mod:       float,     # noqa: ARG001  (reserved for BPM-paced label timing)
) -> AnimHint:
    """Predict the most likely animation event from BMI + scene context.

    Parameters
    ----------
    band:            EEG dominant band (DELTA/THETA/ALPHA/BETA/GAMMA)
    energy:          BMI energy dimension [0, 1]
    focus:           BMI focus dimension [0, 1]
    calm:            BMI calm dimension [0, 1] — reserved; influences future calming brake
    coherence_score: EEG coherence score [0, ∞) from compute_band_sig
    scene:           sport/game scene key
    tempo_mod:       Remix tempo modifier — reserved for BPM-paced label timing
    """
    score    = _action_score(band, energy, focus)
    vocab    = _SCENE_EVENTS.get(scene, _SCENE_EVENTS["trading"])
    label, motion_class = "idle", "static"
    for lbl, mc, lo, hi in vocab:
        if lo <= score < hi:
            label, motion_class = lbl, mc
            break

    confidence = max(0, min(100, int(coherence_score / MENTE_CONST * 100)))
    hint_str   = f"[{scene}:{label}:{confidence:02d}]"

    return AnimHint(
        label=label,
        scene=scene,
        confidence=confidence,
        motion_class=motion_class,
        intensity=round(score, 4),
        hint_str=hint_str,
    )
