"""cure_oracle/score_replay.py — Phase O: MIDI Score Replay & Piano-Roll History
(B地点第十画面).

CURRENT_REV = 7

Wraps a MidiExportResult into a ScoreReplayFrame, adding:
  - MIDI note-name labels  (C4, D#5, …)
  - Piano-roll grid rows   (bar × pitch_class → active cell)
  - History index          (position in the app-state replay buffer)
  - Round-trip parsing     (MIDI bytes → ScoreNote list)

cure-{era}-r7  (Phase O)
"""

from __future__ import annotations

import datetime
import struct as _struct
import uuid
from dataclasses import dataclass, field

CURRENT_REV: int = 7

_PPQN = 480

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def midi_note_name(note: int) -> str:
    """Return scientific pitch name for a MIDI note number (0–127), e.g. 60 → 'C4'."""
    if not (0 <= note <= 127):
        return f"?{note}"
    octave = (note // 12) - 1
    return f"{_NOTE_NAMES[note % 12]}{octave}"


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class ScoreNote:
    tick:           int
    channel:        int
    note:           int
    velocity:       int
    duration_ticks: int
    label:          str    # e.g. "C4", "D#5"


@dataclass
class PianoRollCell:
    """One active cell in the piano-roll grid: bar × pitch_class."""
    bar:         int
    pitch_class: int    # 0–11
    octave:      int
    channel:     int
    velocity:    int


@dataclass
class ScoreReplayFrame:
    frame_id:         str
    born_at:          str
    era:              str
    version:          str              # cure-{era}-r7
    bpm:              int
    ppqn:             int
    bars:             int
    source:           str              # "midi_viz" | "resonance"
    event_count:      int
    duration_ticks:   int
    duration_seconds: float
    history_index:    int
    notes:            list[ScoreNote]      = field(default_factory=list)
    piano_roll:       list[PianoRollCell]  = field(default_factory=list)


# ── piano-roll builder ────────────────────────────────────────────────────────

def _make_piano_roll(notes: list[ScoreNote], bars: int, ppqn: int) -> list[PianoRollCell]:
    """Build compact piano-roll cells from note events.

    Each note maps to the bar it starts in: bar = tick // (ppqn*4).
    One cell per unique (bar, pitch_class); higher velocity wins ties.
    """
    ticks_per_bar = max(1, ppqn * 4)
    seen: dict[tuple[int, int], PianoRollCell] = {}
    for n in notes:
        bar = min(n.tick // ticks_per_bar, max(0, bars - 1))
        key = (bar, n.note % 12)
        if key not in seen or n.velocity > seen[key].velocity:
            seen[key] = PianoRollCell(
                bar=bar,
                pitch_class=n.note % 12,
                octave=(n.note // 12) - 1,
                channel=n.channel,
                velocity=n.velocity,
            )
    return sorted(seen.values(), key=lambda c: (c.bar, c.pitch_class))


# ── MIDI byte parser ──────────────────────────────────────────────────────────

def _read_vlq(data: bytes, pos: int) -> tuple[int, int]:
    """Read a MIDI VLQ from data at pos; return (value, new_pos)."""
    value = 0
    while pos < len(data):
        byte = data[pos]; pos += 1
        value = (value << 7) | (byte & 0x7F)
        if not (byte & 0x80):
            break
    return value, pos


def _parse_mtrk(data: bytes, ppqn: int) -> list[ScoreNote]:
    """Extract ScoreNote list from a MIDI Format 0 byte string."""
    if not data or len(data) < 14:
        return []
    # Locate MTrk after MThd (14 bytes)
    pos = 14
    if len(data) < pos + 8 or data[pos:pos + 4] != b"MTrk":
        return []
    track_len = _struct.unpack(">I", data[pos + 4:pos + 8])[0]
    pos += 8
    end = pos + track_len

    abs_tick = 0
    note_ons: dict[tuple[int, int], tuple[int, int]] = {}  # (ch, note) → (tick, vel)
    notes: list[ScoreNote] = []

    while pos < end:
        delta, pos = _read_vlq(data, pos)
        abs_tick += delta
        if pos >= end:
            break
        status = data[pos]; pos += 1

        if status == 0xFF:  # meta-event
            if pos >= end:
                break
            pos += 1  # meta type
            meta_len, pos = _read_vlq(data, pos)
            pos += meta_len
            continue

        kind = status & 0xF0
        ch   = status & 0x0F

        if kind == 0x90:  # note-on
            if pos + 1 >= end:
                break
            note = data[pos]; pos += 1
            vel  = data[pos]; pos += 1
            if vel > 0:
                note_ons[(ch, note)] = (abs_tick, vel)
            else:
                _close_note(notes, note_ons, ch, note, abs_tick)

        elif kind == 0x80:  # note-off
            if pos + 1 >= end:
                break
            note = data[pos]; pos += 1
            pos += 1  # velocity ignored
            _close_note(notes, note_ons, ch, note, abs_tick)

        else:
            break  # unknown / running status — stop

    # flush any open notes at end of track
    for (ch, note), (on_tick, vel) in list(note_ons.items()):
        notes.append(ScoreNote(
            tick=on_tick, channel=ch, note=note, velocity=vel,
            duration_ticks=max(1, abs_tick - on_tick),
            label=midi_note_name(note),
        ))

    return notes


def _close_note(
    notes: list[ScoreNote],
    note_ons: dict[tuple[int, int], tuple[int, int]],
    ch: int, note: int, off_tick: int,
) -> None:
    key = (ch, note)
    if key in note_ons:
        on_tick, vel = note_ons.pop(key)
        notes.append(ScoreNote(
            tick=on_tick, channel=ch, note=note, velocity=vel,
            duration_ticks=max(1, off_tick - on_tick),
            label=midi_note_name(note),
        ))


# ── frame builder ─────────────────────────────────────────────────────────────

def build_score_replay_frame(export_result, history_index: int = 0) -> ScoreReplayFrame:
    """Wrap a MidiExportResult into a ScoreReplayFrame.

    Parses the MIDI bytes back into ScoreNote objects and builds a piano-roll
    grid for display.  No Qiskit dependency; works from any MidiExportResult.

    Parameters
    ----------
    export_result:
        A MidiExportResult (from midi_export.py).
    history_index:
        Position in the replay history buffer (0 = most recent after append).
    """
    bpm  = getattr(export_result, "bpm", 120) or 120
    ppqn = getattr(export_result, "ppqn", _PPQN) or _PPQN
    bars = getattr(export_result, "bars", 4) or 4
    era  = getattr(export_result, "era", "baroque")

    midi_bytes = getattr(export_result, "midi_bytes", None)
    score_notes = _parse_mtrk(midi_bytes or b"", ppqn=ppqn)
    piano_roll  = _make_piano_roll(score_notes, bars=bars, ppqn=ppqn)

    return ScoreReplayFrame(
        frame_id         = str(uuid.uuid4()),
        born_at          = datetime.datetime.now(datetime.timezone.utc).isoformat(),
        era              = era,
        version          = f"cure-{era}-r{CURRENT_REV}",
        bpm              = bpm,
        ppqn             = ppqn,
        bars             = bars,
        source           = getattr(export_result, "source", "midi_viz"),
        event_count      = getattr(export_result, "event_count", len(score_notes)),
        duration_ticks   = getattr(export_result, "duration_ticks", bars * ppqn * 4),
        duration_seconds = getattr(export_result, "duration_seconds", 0.0),
        history_index    = history_index,
        notes            = score_notes,
        piano_roll       = piano_roll,
    )
