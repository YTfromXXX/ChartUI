"""cure_oracle/cure_bmi.py — Cure-BMI × KnotScore Integration Engine.

CURRENT_REV = 11 — B地点第十四画面 (Phase S)

Maps EEG/BMI state onto KnotScoreFrame parameters, producing a unified
CureBmiFrame for underwater BTC/USD scalping live trading music experience.

BMI → KnotScore effect matrix
------------------------------
  EEG band (dominant_hz)  → knot_pitch_offset  DELTA=-2 / THETA=-1 / ALPHA=0 / BETA=+1 / GAMMA=+2
  focus  [0,1]            → velocity_scale      0.5 + focus (0.5×pppp … 1.5×forte)
  calm   [0,1]            → bow_mod             bow_pos += (1-calm)×BOW_CALM_SHIFT
  energy [0,1]            → gb_density          fraction of GarageBand grid cells active
  coherence_score [0,∞)   → arc_radius          1.0 + clamp(coherence_score/MENTE_CONST)×1.0

Sound device context
--------------------
  FIKU / 384candy devices receive the RemixLayer as effect-chain parameters.
  Phase S: audio fingerprint → animation prediction (soccer / surfing / climbing / live / trading).

Phase S — audio_to_anim_hint (sound_anim.py)
----------------------------------------------
  AnimHint.hint_str format:  "[scene:event_label:confidence_pct]"
    "[soccer:goal_celebration:87]"  — GAMMA band + high energy during match
    "[trading:breakout:62]"         — BETA band + momentum spike
  immersion_level: float    — 0.0=monitor 1.0=full spatial audio (drives binaural panner)
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from cure_oracle.bmi import compute_band_sig
from cure_oracle.knot_score import (
    CURRENT_REV as _KNOT_REV,
    PITCH_NAMES,
    KnotScoreFrame,
    build_knot_score_frame,
)
from cure_oracle.sound_anim import predict_anim_hint
from cure_oracle.sonnet_remix import compute_remix

# ── constants ────────────────────────────────────────────────────────────────

CURRENT_REV: int = 11

PHI         = (1 + 5 ** 0.5) / 2
MENTE_CONST = PHI * math.sqrt(2)   # ≈ 2.2882

BOW_CALM_SHIFT = 0.3   # max bow_pos nudge toward underwater when calm=0

# DELTA=-2 … GAMMA=+2 (matches _BAND_TIERS order in bmi.py)
_BAND_PITCH_OFFSET: dict[str, int] = {
    "DELTA": -2,
    "THETA": -1,
    "ALPHA":  0,
    "BETA":  +1,
    "GAMMA": +2,
}

# FIKU / 384candy effect chain presets per sport scene
_SCENE_PRESETS: dict[str, dict] = {
    "soccer": {
        "reverb_size": 0.85, "crowd_mix": 0.6, "bpm_range": (120, 160),
        "spatial_mode": "stadium",
    },
    "surfing": {
        "reverb_size": 0.95, "crowd_mix": 0.1, "bpm_range": (80, 110),
        "spatial_mode": "ocean_stereo",
    },
    "climbing": {
        "reverb_size": 0.4,  "crowd_mix": 0.0, "bpm_range": (90, 130),
        "spatial_mode": "rock_chamber",
    },
    "live": {
        "reverb_size": 0.7,  "crowd_mix": 0.3, "bpm_range": (100, 180),
        "spatial_mode": "concert_hall",
    },
    "trading": {
        "reverb_size": 0.6,  "crowd_mix": 0.0, "bpm_range": (100, 140),
        "spatial_mode": "underwater",
    },
}

# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class BmiEffect:
    """Derived effect parameters from EEG state."""
    knot_pitch_offset: int        # -2 … +2 (semitone shift applied to base pitch)
    velocity_scale:    float      # 0.5 … 1.5
    bow_mod:           float      # additive bow_pos nudge (0.0 … BOW_CALM_SHIFT)
    gb_density:        float      # 0.0 … 1.0 GB grid active cell fraction
    arc_radius:        float      # 1.0 … 2.0 throw arc radius multiplier
    effective_bow:     float      # clamped final bow_position after bow_mod

    def to_dict(self) -> dict:
        return {
            "knot_pitch_offset": self.knot_pitch_offset,
            "velocity_scale":    round(self.velocity_scale, 4),
            "bow_mod":           round(self.bow_mod, 4),
            "gb_density":        round(self.gb_density, 4),
            "arc_radius":        round(self.arc_radius, 4),
            "effective_bow":     round(self.effective_bow, 4),
        }


@dataclass
class SportScene:
    """FIKU / 384candy device context for game/live audio experience."""
    scene:          str    = "trading"
    reverb_size:    float  = 0.6
    crowd_mix:      float  = 0.0
    bpm_min:        int    = 100
    bpm_max:        int    = 140
    spatial_mode:   str    = "underwater"
    # Phase S+ stubs
    audio_to_anim_hint: str   = ""    # e.g. "goal_celebration", "wave_break"
    immersion_level:    float = 1.0   # 0.0=monitor 1.0=full spatial

    def to_dict(self) -> dict:
        return {
            "scene":              self.scene,
            "reverb_size":        self.reverb_size,
            "crowd_mix":          self.crowd_mix,
            "bpm_min":            self.bpm_min,
            "bpm_max":            self.bpm_max,
            "spatial_mode":       self.spatial_mode,
            "audio_to_anim_hint": self.audio_to_anim_hint,
            "immersion_level":    self.immersion_level,
        }


@dataclass
class CureBmiFrame:
    """Unified BMI × KnotScore frame (cure-{era}-r10)."""

    frame_id:   str
    born_at:    str
    era:        str
    version:    str   # "{era}-r10"

    # ── raw BMI inputs ────────────────────────────────────────────────────────
    focus:          float
    calm:           float
    energy:         float
    dominant_hz:    float
    impedance_kohm: float
    coherence_q:    float    # raw [0,1] signal quality

    # ── computed BMI signature ────────────────────────────────────────────────
    band:             str    # DELTA/THETA/ALPHA/BETA/GAMMA
    band_pts:         int
    band_sig:         str    # e.g. "ALPHA-φ.618-ε.005"
    coherence_score:  float  # q × band_pts × MENTE_CONST

    # ── effect parameters ─────────────────────────────────────────────────────
    bmi_effect:   BmiEffect

    # ── integrated KnotScore (BMI-modified) ───────────────────────────────────
    knot_score:   KnotScoreFrame

    # ── Remix layer (FIKU / 384candy) ─────────────────────────────────────────
    bmi_influence:  str
    tempo_mod:      float
    layer_intensity: float
    pitch_shift_st:  float   # semitones from sonnet_remix + BMI offset

    # ── sport/game device context ─────────────────────────────────────────────
    sport_scene:  SportScene

    def to_dict(self) -> dict:
        return {
            "frame_id":        self.frame_id,
            "born_at":         self.born_at,
            "era":             self.era,
            "version":         self.version,
            "focus":           round(self.focus, 4),
            "calm":            round(self.calm, 4),
            "energy":          round(self.energy, 4),
            "dominant_hz":     round(self.dominant_hz, 2),
            "impedance_kohm":  round(self.impedance_kohm, 3),
            "coherence_q":     round(self.coherence_q, 4),
            "band":            self.band,
            "band_pts":        self.band_pts,
            "band_sig":        self.band_sig,
            "coherence_score": round(self.coherence_score, 6),
            "bmi_effect":      self.bmi_effect.to_dict(),
            "knot_score": {
                "frame_id":    self.knot_score.frame_id,
                "knot_name":   self.knot_score.knot_name,
                "knot_pitch":  self.knot_score.knot_pitch,
                "pitch_name":  self.knot_score.pitch_name,
                "theta_q":     round(self.knot_score.theta_q, 4),
                "bow_position": round(self.knot_score.bow_position, 4),
                "filter_hz":   self.knot_score.filter_hz,
                "technique":   self.knot_score.technique,
                "duration_ticks": self.knot_score.duration_ticks,
                "strips":      [
                    {
                        "voice_id":   s.voice_id,
                        "midi_ch":    s.midi_ch,
                        "technique":  s.technique,
                        "note_count": len(s.notes),
                        "velocity":   s.velocity,
                        "filter_hz":  s.filter_hz,
                    }
                    for s in self.knot_score.strips
                ],
                "magic_circle": {
                    "positions":  self.knot_score.magic_circle.positions,
                    "t_steps":    self.knot_score.magic_circle.t_steps,
                    "placements": self.knot_score.magic_circle.placements,
                    "pitch_names":self.knot_score.magic_circle.pitch_names,
                    "throw_arc":  [list(pt) for pt in self.knot_score.magic_circle.throw_arc],
                },
                "gb_grid": {
                    "rows":       self.knot_score.gb_grid.rows,
                    "cols":       self.knot_score.gb_grid.cols,
                    "cells":      self.knot_score.gb_grid.cells,
                    "row_labels": self.knot_score.gb_grid.row_labels,
                    "loop_a":     self.knot_score.gb_grid.loop_a,
                    "loop_b":     self.knot_score.gb_grid.loop_b,
                },
            },
            "bmi_influence":   self.bmi_influence,
            "tempo_mod":       round(self.tempo_mod, 4),
            "layer_intensity": round(self.layer_intensity, 4),
            "pitch_shift_st":  round(self.pitch_shift_st, 4),
            "sport_scene":     self.sport_scene.to_dict(),
        }


# ── BMI effect computation ────────────────────────────────────────────────────

def compute_bmi_effect(
    band: str,
    band_pts: int,
    coherence_score: float,
    focus: float,
    calm: float,
    energy: float,
    base_bow: float,
) -> BmiEffect:
    """Derive KnotScore effect parameters from BMI state."""
    pitch_offset = _BAND_PITCH_OFFSET.get(band, 0)
    vel_scale    = round(0.5 + max(0.0, min(1.0, focus)), 4)   # 0.5 … 1.5
    bow_nudge    = round((1.0 - max(0.0, min(1.0, calm))) * BOW_CALM_SHIFT, 4)
    eff_bow      = round(min(1.0, base_bow + bow_nudge), 4)
    density      = round(max(0.0, min(1.0, energy)), 4)
    coherence_n  = min(1.0, coherence_score / MENTE_CONST)
    arc_r        = round(1.0 + coherence_n * 1.0, 4)            # 1.0 … 2.0
    return BmiEffect(
        knot_pitch_offset=pitch_offset,
        velocity_scale=vel_scale,
        bow_mod=bow_nudge,
        gb_density=density,
        arc_radius=arc_r,
        effective_bow=eff_bow,
    )


def _apply_gb_density(gb_grid, density: float):
    """Scale GarageBand grid active cells by density factor (mutates cells list)."""
    import random
    rng = random.Random(42)
    new_cells = []
    for row in gb_grid.cells:
        new_row = []
        for cell in row:
            if cell and rng.random() > density:
                new_row.append(False)
            else:
                new_row.append(cell)
        new_cells.append(new_row)
    gb_grid.cells = new_cells


def _build_sport_scene(
    scene: str,
    immersion: float = 1.0,
    *,
    band: str = "ALPHA",
    energy: float = 0.5,
    focus: float = 0.5,
    calm: float = 0.5,
    coherence_score: float = 1.0,
    tempo_mod: float = 1.0,
) -> SportScene:
    preset = _SCENE_PRESETS.get(scene, _SCENE_PRESETS["trading"])
    bmin, bmax = preset["bpm_range"]
    hint = predict_anim_hint(
        band=band,
        energy=energy,
        focus=focus,
        calm=calm,
        coherence_score=coherence_score,
        scene=scene,
        tempo_mod=tempo_mod,
    )
    return SportScene(
        scene=scene,
        reverb_size=preset["reverb_size"],
        crowd_mix=preset["crowd_mix"],
        bpm_min=bmin,
        bpm_max=bmax,
        spatial_mode=preset["spatial_mode"],
        audio_to_anim_hint=hint.hint_str,
        immersion_level=round(max(0.0, min(1.0, immersion)), 4),
    )


# ── main builder ─────────────────────────────────────────────────────────────

def build_cure_bmi_frame(
    sim_result,
    *,
    knot_name:      str   = "もやい結び",
    dominant_hz:    float = 10.0,    # ALPHA default
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
) -> CureBmiFrame:
    """Build a CureBmiFrame by integrating BMI state with a KnotScoreFrame.

    Parameters
    ----------
    sim_result:    AcceleratorResult (or mock with .era / .mente_total)
    knot_name:     Japanese knot name from knots3d.com catalog
    dominant_hz:   EEG dominant frequency (Hz) → band classification
    coherence_q:   raw signal quality [0, 1]
    impedance_kohm: mean electrode impedance (kΩ)
    focus/calm/energy: BMI dimensions [0, 1]
    bow_position:  base bow_position (0.0=normale, 1.0=underwater)
    scene:         "soccer" | "surfing" | "climbing" | "live" | "trading"
    immersion:     spatial audio depth 0.0…1.0
    """
    era = getattr(sim_result, "era", "baroque")

    # ── 1. BMI signature ─────────────────────────────────────────────────────
    bmi_sig = compute_band_sig(dominant_hz, coherence_q, impedance_kohm)
    band         = bmi_sig["band"]
    band_pts     = bmi_sig["band_pts"]
    band_sig_str = bmi_sig["sig"]
    coh_score    = bmi_sig["coherence_score"]

    # ── 2. BMI effects ───────────────────────────────────────────────────────
    bmi_effect = compute_bmi_effect(
        band, band_pts, coh_score, focus, calm, energy, bow_position
    )

    # ── 3. Build KnotScoreFrame with effective bow (BMI-modified) ────────────
    ks_frame = build_knot_score_frame(
        sim_result,
        knot_name=knot_name,
        bow_position=bmi_effect.effective_bow,
        epsilon=epsilon,
        t_steps=t_steps,
    )

    # ── 4. Apply pitch offset to knot_pitch ──────────────────────────────────
    offset_pitch = (ks_frame.knot_pitch + bmi_effect.knot_pitch_offset) % 12
    ks_frame.knot_pitch  = offset_pitch
    ks_frame.pitch_name  = PITCH_NAMES[offset_pitch]

    # ── 5. Apply velocity scale to strips ────────────────────────────────────
    for strip in ks_frame.strips:
        strip.velocity = max(1, min(127, int(strip.velocity * bmi_effect.velocity_scale)))

    # ── 6. Apply arc_radius to Magic Circle throw_arc ────────────────────────
    r_scale = bmi_effect.arc_radius
    new_arc = []
    for pt in ks_frame.magic_circle.throw_arc:
        # throw_arc points are (theta, r, t) tuples
        theta, r, t = pt
        new_arc.append((theta, round(r * r_scale, 4), t))
    ks_frame.magic_circle.throw_arc = new_arc

    # ── 7. Apply energy → GB grid density ────────────────────────────────────
    _apply_gb_density(ks_frame.gb_grid, bmi_effect.gb_density)

    # ── 8. Remix layer (FIKU / 384candy) ─────────────────────────────────────
    bmi_state_dict = {"focus": focus, "calm": calm, "energy": energy}
    remix = compute_remix(era=era, bmi_state=bmi_state_dict)

    # pitch shift = BMI pitch offset (semitones); remix has no pitch_shift field
    total_pitch_st = round(float(bmi_effect.knot_pitch_offset), 4)

    # ── 9. Sport scene + Phase S animation hint ──────────────────────────────
    sport = _build_sport_scene(
        scene, immersion,
        band=band,
        energy=energy,
        focus=focus,
        calm=calm,
        coherence_score=coh_score,
        tempo_mod=remix.tempo_modifier,
    )

    return CureBmiFrame(
        frame_id        = str(uuid.uuid4()),
        born_at         = datetime.now(timezone.utc).isoformat(),
        era             = era,
        version         = f"{era}-r{CURRENT_REV}",
        focus           = round(focus, 4),
        calm            = round(calm, 4),
        energy          = round(energy, 4),
        dominant_hz     = round(dominant_hz, 2),
        impedance_kohm  = round(impedance_kohm, 3),
        coherence_q     = round(coherence_q, 4),
        band            = band,
        band_pts        = band_pts,
        band_sig        = band_sig_str,
        coherence_score = coh_score,
        bmi_effect      = bmi_effect,
        knot_score      = ks_frame,
        bmi_influence   = remix.bmi_influence,
        tempo_mod       = remix.tempo_modifier,
        layer_intensity = remix.layer_intensity,
        pitch_shift_st  = total_pitch_st,
        sport_scene     = sport,
    )
