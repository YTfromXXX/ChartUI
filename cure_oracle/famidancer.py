"""cure_oracle/famidancer.py — FAMIDANCER'S Kit: AnimHint → DanceMove Engine.

CURRENT_REV = 12 — B地点第十五画面 (Phase T)

Derives a dance move specification from Phase S AnimHint + EEG band state.
Output feeds FIKU / 384candy devices as a full kinesthetic + audio control frame.

motion_class → DanceMove mapping
----------------------------------
  "peak"      → full_spin / jump_sequence       (breakdance)
  "dynamic"   → wave_slide / body_roll           (hiphop)
  "steady"    → step_groove / shoulder_bounce    (freeStyle)
  "tension"   → freeze_hold / slow_isolation     (contemporary)
  "static"    → idle_sway                        (idle)
  "contact"   → dodge_step / impact_drop         (capoeira)
  "precision" → micro_isolate                    (contemporary)
  "set_piece" → formation_step                   (freeStyle)

BPM sync: lerp(bpm_min, bpm_max, intensity)
mirror_hint: True when band is DELTA or THETA (slow/introspective)

Hint string: "[scene:move_name:bpm_sync]"
  e.g. "[soccer:full_spin:140]"
       "[trading:freeze_hold:112]"
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from cure_oracle.cure_bmi import build_cure_bmi_frame
from cure_oracle.sound_anim import AnimHint, predict_anim_hint

# ── constants ─────────────────────────────────────────────────────────────────

CURRENT_REV: int = 12

# EEG bands that favour mirrored / introspective movement
_MIRROR_BANDS = frozenset({"DELTA", "THETA"})

# motion_class → [(move_name, style, step_pattern), ...]
# first entry = high intensity (≥ 0.6), last = lower intensity
_MOTION_MOVES: dict[str, list[tuple[str, str, list[str]]]] = {
    "peak": [
        ("full_spin",        "breakdance",    ["prep", "spin_L", "spin_R", "land_bounce"]),
        ("jump_sequence",    "breakdance",    ["crouch", "jump", "tuck", "land"]),
    ],
    "dynamic": [
        ("wave_slide",       "hiphop",        ["slide_L", "wave_body", "slide_R", "lock"]),
        ("body_roll",        "hiphop",        ["roll_up", "chest_pop", "roll_down", "pop"]),
    ],
    "steady": [
        ("step_groove",      "freeStyle",     ["step_L", "step_R", "groove", "bounce"]),
        ("shoulder_bounce",  "freeStyle",     ["bounce_L", "bounce_R", "clap", "reset"]),
    ],
    "tension": [
        ("freeze_hold",      "contemporary",  ["slow_extend", "freeze", "melt", "contract"]),
        ("slow_isolation",   "contemporary",  ["isolate_head", "isolate_chest", "isolate_hip", "hold"]),
    ],
    "static": [
        ("idle_sway",        "idle",          ["sway_L", "sway_R", "breathe", "center"]),
    ],
    "contact": [
        ("dodge_step",       "capoeira",      ["ginga_L", "dodge", "ginga_R", "reset"]),
        ("impact_drop",      "capoeira",      ["wind_up", "impact", "roll", "recover"]),
    ],
    "precision": [
        ("micro_isolate",    "contemporary",  ["finger_wave", "wrist_roll", "chest_isolate", "lock"]),
    ],
    "set_piece": [
        ("formation_step",   "freeStyle",     ["mark_L", "step_in", "mark_R", "step_out"]),
    ],
}

_DEFAULT_MOVES: list[tuple[str, str, list[str]]] = [
    ("idle_sway", "idle", ["sway_L", "sway_R", "breathe", "center"]),
]


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class DanceMove:
    """Single dance move specification for FIKU / 384candy kinesthetic output."""
    move_name:    str
    motion_class: str
    style:        str
    step_pattern: list[str]
    bpm_sync:     int      # BPM for dance sync
    energy_level: float    # 0.0…1.0  (from AnimHint.intensity)
    mirror_hint:  bool     # True → mirror move for introspective EEG bands
    hint_str:     str      # "[scene:move_name:bpm_sync]"

    def to_dict(self) -> dict:
        return {
            "move_name":    self.move_name,
            "motion_class": self.motion_class,
            "style":        self.style,
            "step_pattern": self.step_pattern,
            "bpm_sync":     self.bpm_sync,
            "energy_level": round(self.energy_level, 4),
            "mirror_hint":  self.mirror_hint,
            "hint_str":     self.hint_str,
        }


@dataclass
class FamidancerFrame:
    """Full FAMIDANCER'S Kit output frame (cure-{era}-r12)."""
    frame_id:   str
    born_at:    str
    era:        str
    version:    str          # "{era}-r12"

    # Phase S AnimHint inputs
    anim_label:      str
    anim_scene:      str
    anim_confidence: int
    motion_class:    str
    anim_intensity:  float
    anim_hint_str:   str

    # Phase T DanceMove output
    dance_move:  DanceMove

    # Sport scene context (from Phase R)
    sport_scene: dict

    def to_dict(self) -> dict:
        return {
            "frame_id":        self.frame_id,
            "born_at":         self.born_at,
            "era":             self.era,
            "version":         self.version,
            "anim_label":      self.anim_label,
            "anim_scene":      self.anim_scene,
            "anim_confidence": self.anim_confidence,
            "motion_class":    self.motion_class,
            "anim_intensity":  round(self.anim_intensity, 4),
            "anim_hint_str":   self.anim_hint_str,
            "dance_move":      self.dance_move.to_dict(),
            "sport_scene":     self.sport_scene,
        }


# ── core logic ────────────────────────────────────────────────────────────────

def predict_dance_move(
    anim_hint: AnimHint,
    band:      str,
    bpm_min:   int,
    bpm_max:   int,
) -> DanceMove:
    """Map AnimHint + EEG band to a concrete DanceMove.

    Parameters
    ----------
    anim_hint:  AnimHint from sound_anim.predict_anim_hint
    band:       EEG dominant band (DELTA/THETA/ALPHA/BETA/GAMMA)
    bpm_min:    lower BPM from SportScene preset
    bpm_max:    upper BPM from SportScene preset
    """
    candidates = _MOTION_MOVES.get(anim_hint.motion_class, _DEFAULT_MOVES)

    # high intensity (≥ 0.6) → first (most energetic) variant
    if anim_hint.intensity >= 0.6 or len(candidates) == 1:
        move_name, style, step_pattern = candidates[0]
    else:
        move_name, style, step_pattern = candidates[-1]

    bpm_sync    = int(bpm_min + (bpm_max - bpm_min) * anim_hint.intensity)
    mirror_hint = band in _MIRROR_BANDS
    hint_str    = f"[{anim_hint.scene}:{move_name}:{bpm_sync}]"

    return DanceMove(
        move_name=move_name,
        motion_class=anim_hint.motion_class,
        style=style,
        step_pattern=list(step_pattern),
        bpm_sync=bpm_sync,
        energy_level=round(anim_hint.intensity, 4),
        mirror_hint=mirror_hint,
        hint_str=hint_str,
    )


def build_famidancer_frame(
    sim_result,
    *,
    dominant_hz:    float = 10.0,
    coherence_q:    float = 0.75,
    impedance_kohm: float = 4.0,
    focus:          float = 0.5,
    calm:           float = 0.5,
    energy:         float = 0.5,
    bow_position:   float = 1.0,
    epsilon:        float = 1e-6,
    t_steps:        int   = 16,
    scene:          str   = "trading",
    immersion:      float = 1.0,
) -> FamidancerFrame:
    """Build a FamidancerFrame by chaining Phase R (BMI) → Phase S (AnimHint) → Phase T (DanceMove).

    Parameters mirror build_cure_bmi_frame; the caller supplies the same sim_result.
    """
    # Phase R: full BMI + KnotScore integration
    bmi_frame = build_cure_bmi_frame(
        sim_result,
        dominant_hz=dominant_hz,
        coherence_q=coherence_q,
        impedance_kohm=impedance_kohm,
        focus=focus,
        calm=calm,
        energy=energy,
        bow_position=bow_position,
        epsilon=epsilon,
        t_steps=t_steps,
        scene=scene,
        immersion=immersion,
    )

    # Phase S: re-derive full AnimHint object (hint_str already in sport_scene)
    anim_hint = predict_anim_hint(
        band=bmi_frame.band,
        energy=energy,
        focus=focus,
        calm=calm,
        coherence_score=bmi_frame.coherence_score,
        scene=scene,
        tempo_mod=bmi_frame.tempo_mod,
    )

    # Phase T: derive DanceMove from AnimHint + EEG band
    dance_move = predict_dance_move(
        anim_hint,
        band=bmi_frame.band,
        bpm_min=bmi_frame.sport_scene.bpm_min,
        bpm_max=bmi_frame.sport_scene.bpm_max,
    )

    era = bmi_frame.era
    return FamidancerFrame(
        frame_id        = str(uuid.uuid4()),
        born_at         = datetime.now(timezone.utc).isoformat(),
        era             = era,
        version         = f"{era}-r{CURRENT_REV}",
        anim_label      = anim_hint.label,
        anim_scene      = anim_hint.scene,
        anim_confidence = anim_hint.confidence,
        motion_class    = anim_hint.motion_class,
        anim_intensity  = anim_hint.intensity,
        anim_hint_str   = anim_hint.hint_str,
        dance_move      = dance_move,
        sport_scene     = bmi_frame.sport_scene.to_dict(),
    )
