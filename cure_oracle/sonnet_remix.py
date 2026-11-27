"""cure_oracle/sonnet_remix.py — Sonnet-Score remix layer for Cure-BMI integration.

Maps a BMI state (focus / calm / energy) onto a background-music remix layer
that extends any SonnetScoreResult with tempo, instrument palette, and loop
signature derived from the quantum-candy era + brain-signal state.

BMI mapping
-----------
  focus  → melody clarity  (high focus = simpler melodic line, low = ornamental)
  calm   → tempo_modifier  (calm=1.0 → ×1.0,  calm=0.0 → ×1.3,  linear)
  energy → layer_intensity (direct, 0.0–1.0)
  null bmi_state → defaults: focus=0.5, calm=0.5, energy=0.5

Instrument sets by era × remix_style
--------------------------------------
  era            orchestral                     electronic            ambient
  -------------- ------------------------------ --------------------- ----------------
  baroque        harpsichord,violin,cello        synth_arp,bass_pulse  pad,reverb_harp
  classical       harp,strings,flute             lead_synth,arpegg     slow_pad,bell
  beethoven      piano,orchestra                epic_synth,drums      tension_drone
  romantic        grand_piano,orchestra          cinematic_synth       warm_pad,cello
  inner_world    koto,harp,choir                glitch,sub_bass       infinite_drone
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── constants ─────────────────────────────────────────────────────────────────

_DEFAULT_BMI = {"focus": 0.5, "calm": 0.5, "energy": 0.5}

_TEMPO_CALM_MAX_SHIFT = 0.30     # calm=0.0 adds +0.30 to base ×1.0

VALID_REMIX_STYLES = ("orchestral", "electronic", "ambient")

# era → remix_style → instrument list
_INSTRUMENT_TABLE: dict[str, dict[str, list[str]]] = {
    "baroque": {
        "orchestral": ["harpsichord", "violin", "cello"],
        "electronic": ["synth_arp", "bass_pulse"],
        "ambient":    ["pad", "reverb_harp"],
    },
    "classical": {
        "orchestral": ["harp", "strings", "flute"],
        "electronic": ["lead_synth", "arpegg"],
        "ambient":    ["slow_pad", "bell"],
    },
    "beethoven": {
        "orchestral": ["piano", "orchestra"],
        "electronic": ["epic_synth", "drums"],
        "ambient":    ["tension_drone"],
    },
    "romantic": {
        "orchestral": ["grand_piano", "orchestra"],
        "electronic": ["cinematic_synth"],
        "ambient":    ["warm_pad", "cello"],
    },
    "inner_world": {
        "orchestral": ["koto", "harp", "choir"],
        "electronic": ["glitch", "sub_bass"],
        "ambient":    ["infinite_drone"],
    },
}

# era → loop time signature
_ERA_LOOP_SIG: dict[str, str] = {
    "baroque":     "4/4",
    "classical":   "3/4",
    "beethoven":   "4/4",
    "romantic":    "4/4",
    "inner_world": "5/4",
}


# ── data model ────────────────────────────────────────────────────────────────

@dataclass
class BmiState:
    focus:  float = 0.5    # 0.0–1.0
    calm:   float = 0.5    # 0.0–1.0
    energy: float = 0.5    # 0.0–1.0

    @classmethod
    def from_dict(cls, d: Optional[dict]) -> "BmiState":
        if d is None:
            return cls(**_DEFAULT_BMI)
        return cls(
            focus=float(d.get("focus",  _DEFAULT_BMI["focus"])),
            calm=float(d.get("calm",   _DEFAULT_BMI["calm"])),
            energy=float(d.get("energy", _DEFAULT_BMI["energy"])),
        )

    def _clamp(self) -> None:
        self.focus  = max(0.0, min(1.0, self.focus))
        self.calm   = max(0.0, min(1.0, self.calm))
        self.energy = max(0.0, min(1.0, self.energy))


@dataclass
class RemixLayer:
    tempo_modifier:  float
    layer_intensity: float
    instrument_set:  list[str]
    loop_signature:  str
    bmi_influence:   str
    export_hint:     str = "MIDI-compatible event stream at 480 PPQN"

    def to_dict(self) -> dict:
        return {
            "tempo_modifier":  round(self.tempo_modifier, 4),
            "layer_intensity": round(self.layer_intensity, 4),
            "instrument_set":  self.instrument_set,
            "loop_signature":  self.loop_signature,
            "bmi_influence":   self.bmi_influence,
            "export_hint":     self.export_hint,
        }


# ── BMI influence description builder ────────────────────────────────────────

def _bmi_influence_text(bmi: BmiState) -> str:
    focus_tag  = "focus↑"  if bmi.focus  >= 0.5 else "focus↓"
    calm_tag   = "calm↑"   if bmi.calm   >= 0.5 else "calm↓"
    energy_tag = "energy↑" if bmi.energy >= 0.5 else "energy↓"

    focus_desc  = "melody clarity" if bmi.focus >= 0.5 else "ornamental melody"
    calm_desc   = "steady tempo"   if bmi.calm  >= 0.5 else "accelerated tempo"
    energy_desc = "rhythmic drive" if bmi.energy >= 0.5 else "gentle pulse"

    return (
        f"{focus_tag} → {focus_desc}; "
        f"{calm_tag} → {calm_desc}; "
        f"{energy_tag} → {energy_desc}"
    )


# ── core computation ──────────────────────────────────────────────────────────

def compute_remix(
    era: str,
    bmi_state: Optional[dict] = None,
    remix_style: str = "orchestral",
) -> RemixLayer:
    """Compute a RemixLayer from a Sonnet-Score era + optional BMI state.

    Parameters
    ----------
    era:          Sonnet-Score era string (baroque / classical / beethoven / romantic / inner_world)
    bmi_state:    Optional dict with focus / calm / energy keys (0.0–1.0 each).
                  Pass None to use defaults (0.5 / 0.5 / 0.5).
    remix_style:  "orchestral" | "electronic" | "ambient"  (default "orchestral")

    Returns
    -------
    RemixLayer with all computed fields.
    """
    if remix_style not in VALID_REMIX_STYLES:
        remix_style = "orchestral"

    era_norm = era if era in _INSTRUMENT_TABLE else "classical"

    bmi = BmiState.from_dict(bmi_state)
    bmi._clamp()

    # calm=1.0 → ×1.0,  calm=0.0 → ×1.30
    tempo_mod = round(1.0 + (1.0 - bmi.calm) * _TEMPO_CALM_MAX_SHIFT, 4)

    instruments = _INSTRUMENT_TABLE[era_norm].get(remix_style, [])
    loop_sig    = _ERA_LOOP_SIG.get(era_norm, "4/4")
    influence   = _bmi_influence_text(bmi)

    return RemixLayer(
        tempo_modifier=tempo_mod,
        layer_intensity=round(bmi.energy, 4),
        instrument_set=instruments,
        loop_signature=loop_sig,
        bmi_influence=influence,
    )
