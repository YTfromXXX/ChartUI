"""cure_oracle/midi_viz.py — Phase L: PopKivy MIDI visualizer (B地点第七画面).

CURRENT_REV = 4

Converts QuantumSimResult frames into MIDI visualizer state for real-time
Flet drawing.  The MIDI_VIZ screen receives SSE events from
GET /candy/quantum-sim/stream and renders them as animated piano-roll lanes.

Data flow
---------
  GET /candy/quantum-sim/stream (SSE)
  → QuantumSimResult JSON frames
  → build_midi_viz_frame()
  → MidiVizFrame
  → AppState.midi_viz (MidiVizState)
  → Flet MIDI_VIZ screen (B地点第七画面)

MIDI channel mapping (箏三音域)
---------------------------------
  ch0  大甲音   (highest octave)   — Dragon ascent
  ch1  甲音     (middle octave)    — Wand sweep
  ch2  呂音     (lower octave)     — Grid pulse
  ch3  呂音-bass                   — Candy grab anchor

Version
-------
  Phase L = cure-{era}-r4
"""

from __future__ import annotations

from dataclasses import dataclass, field

CURRENT_REV: int = 4

MIDI_CHANNELS: list[str] = ["大甲音", "甲音", "呂音", "呂音-bass"]

_PPQN = 480

_REGISTER_TO_CHANNEL: dict[str, int] = {
    "大甲音":    0,
    "甲音":      1,
    "呂音":      2,
    "呂音-bass": 3,
}
_MOTIF_NOTE_BASE: dict[str, int] = {
    "block_chord":    60,
    "arpeggio":       62,
    "tremolo":        64,
    "scale_run":      65,
    "staccato_burst": 67,
}
_REGISTER_OCTAVE_OFFSET: dict[str, int] = {
    "大甲音":    24,
    "甲音":      12,
    "呂音":       0,
    "呂音-bass": -12,
}


# ── data classes ──────────────────────────────────────────────────────────────

@dataclass
class MidiVizNote:
    """One note event in the MIDI visualizer piano-roll."""
    tick:           int
    channel:        int    # 0–3
    note:           int    # MIDI note 0–127
    velocity:       int    # 1–127
    duration_ticks: int
    motif:          str
    register:       str
    intensity:      float


@dataclass
class MidiVizChannel:
    """Per-channel aggregated state for one frame."""
    index:        int
    name:         str
    note_count:   int   = 0
    avg_velocity: float = 0.0
    active:       bool  = False


@dataclass
class MidiVizFrame:
    """One frame of MIDI visualization data, produced from QuantumSimResult."""
    frame_id:       str
    born_at:        str
    era:            str
    version:        str               # cure-{era}-r4
    bpm:            int
    bars:           int
    mente_total:    float
    mente_achieved: bool
    notes:          list[MidiVizNote]
    channels:       list[MidiVizChannel]  # always 4 entries, one per MIDI channel
    fusion_note:    str
    fused_shapes:   list[str]
    ppqn:           int = _PPQN


# ── public API ────────────────────────────────────────────────────────────────

def build_midi_viz_frame(sim_result) -> MidiVizFrame:
    """Convert a QuantumSimResult into a MidiVizFrame for Flet rendering.

    Works directly with the SonnetScoreResult dataclass (sim_result.score)
    rather than going through the HTTP dict layer, so no serialization is needed.

    Parameters
    ----------
    sim_result:  QuantumSimResult from run_quantum_sim()
    """
    score = sim_result.score

    notes: list[MidiVizNote] = []
    for ev in score.events:
        channel   = _REGISTER_TO_CHANNEL.get(ev.register, 2)
        base_note = _MOTIF_NOTE_BASE.get(ev.motif, 60)
        oct_off   = _REGISTER_OCTAVE_OFFSET.get(ev.register, 0)
        note      = max(0, min(127, base_note + oct_off))
        velocity  = max(1, min(127, round(ev.intensity * 127)))
        tick      = round((ev.beat - 1.0) * _PPQN)
        dur_ticks = round(ev.duration * _PPQN)

        notes.append(MidiVizNote(
            tick=tick,
            channel=channel,
            note=note,
            velocity=velocity,
            duration_ticks=dur_ticks,
            motif=ev.motif,
            register=ev.register,
            intensity=ev.intensity,
        ))

    # Aggregate per channel
    channels: list[MidiVizChannel] = []
    for idx, name in enumerate(MIDI_CHANNELS):
        ch_notes = [n for n in notes if n.channel == idx]
        avg_vel  = (
            sum(n.velocity for n in ch_notes) / len(ch_notes)
            if ch_notes else 0.0
        )
        channels.append(MidiVizChannel(
            index=idx,
            name=name,
            note_count=len(ch_notes),
            avg_velocity=round(avg_vel, 2),
            active=len(ch_notes) > 0,
        ))

    return MidiVizFrame(
        frame_id=sim_result.sim_id,
        born_at=sim_result.born_at,
        era=sim_result.era,
        version=f"cure-{sim_result.era}-r{CURRENT_REV}",
        bpm=score.bpm,
        bars=score.bars,
        mente_total=sim_result.mente_total,
        mente_achieved=sim_result.mente_achieved,
        notes=notes,
        channels=channels,
        fusion_note=sim_result.fusion_note,
        fused_shapes=list(sim_result.fused_shapes),
    )
