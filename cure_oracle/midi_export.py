"""cure_oracle/midi_export.py — Phase N: MIDI Export layer (B地点第九画面).

CURRENT_REV = 6

Converts MidiVizFrame / ResonanceFrame → standard MIDI Format 0 (.mid) bytes
using only Python's built-in ``struct`` module.  No external dependencies.

MIDI Format 0 layout
--------------------
  MThd  chunk  (14 B)  : format=0, ntracks=1, division=ppqn
  MTrk  chunk  (N B)   : tempo meta + note-on/off events + end-of-track meta

Event encoding
--------------
  Tempo     : FF 51 03 tt tt tt  (microseconds per beat, big-endian)
  Note On   : 9n nn vv           (channel n, note, velocity)
  Note Off  : 8n nn 00           (channel n, note, velocity=0)
  End track : FF 2F 00

Variable-length values follow the standard MIDI VLQ encoding.

cure-{era}-r6  (Phase N)
"""

from __future__ import annotations

import datetime
import struct
import uuid
from dataclasses import dataclass, field
from typing import Any

CURRENT_REV: int = 6

_PPQN = 480


# ── VLQ helpers ───────────────────────────────────────────────────────────────

def _vlq(value: int) -> bytes:
    """Encode a non-negative integer as MIDI variable-length quantity."""
    if value < 0:
        raise ValueError(f"VLQ value must be >= 0, got {value}")
    buf: list[int] = []
    buf.append(value & 0x7F)
    value >>= 7
    while value:
        buf.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(buf))


# ── MIDI builder ──────────────────────────────────────────────────────────────

def _build_track_bytes(events: list[dict], bpm: int, ppqn: int) -> bytes:
    """Encode a list of note events into MTrk chunk bytes.

    Parameters
    ----------
    events:
        List of dicts with keys: tick (int), channel (int), note (int),
        velocity (int), duration_ticks (int).  Must be sorted by tick.
    bpm:
        Beats per minute; used to write the tempo meta-event.
    ppqn:
        Pulses per quarter note (ticks per beat).
    """
    us_per_beat = max(1, round(60_000_000 / bpm))
    tt = us_per_beat.to_bytes(3, "big")

    track_data = bytearray()

    # tempo meta at tick 0
    track_data += _vlq(0)                       # delta time
    track_data += b"\xff\x51\x03" + tt          # tempo meta-event

    # sort events by tick
    sorted_events = sorted(events, key=lambda e: e["tick"])

    # expand each note into (onset_tick, off_tick, channel, note, velocity)
    raw: list[tuple[int, int, int, int, int]] = []
    for ev in sorted_events:
        tick     = int(ev["tick"])
        dur      = max(1, int(ev.get("duration_ticks", ppqn // 2)))
        channel  = int(ev["channel"]) & 0x0F
        note     = max(0, min(127, int(ev["note"])))
        velocity = max(1, min(127, int(ev["velocity"])))
        raw.append((tick, tick + dur, channel, note, velocity))

    # build (absolute_tick, status_byte, note, velocity) tuples for all msgs
    messages: list[tuple[int, int, int, int]] = []
    for onset, offset, ch, note, vel in raw:
        messages.append((onset,  0x90 | ch, note, vel))   # note on
        messages.append((offset, 0x80 | ch, note, 0))     # note off

    messages.sort(key=lambda m: (m[0], m[1] & 0xF0))  # sort by tick, off before on at same tick

    # encode with delta times
    prev_tick = 0
    for abs_tick, status, note, vel in messages:
        delta = max(0, abs_tick - prev_tick)
        track_data += _vlq(delta)
        track_data += bytes([status, note, vel])
        prev_tick = abs_tick

    # end of track
    track_data += _vlq(0) + b"\xff\x2f\x00"

    return bytes(track_data)


def events_to_midi_bytes(events: list[dict], bpm: int = 120, ppqn: int = _PPQN) -> bytes:
    """Convert a list of note-event dicts to MIDI Format 0 (.mid) bytes.

    Parameters
    ----------
    events:
        List of dicts with keys: tick, channel, note, velocity, duration_ticks.
    bpm:
        Tempo in beats per minute.
    ppqn:
        Pulses (ticks) per quarter note.

    Returns
    -------
    Raw bytes suitable for writing to a .mid file.
    """
    track = _build_track_bytes(events, bpm=bpm, ppqn=ppqn)
    header = struct.pack(">4sIHHH", b"MThd", 6, 0, 1, ppqn)
    mtrk   = struct.pack(">4sI", b"MTrk", len(track)) + track
    return header + mtrk


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class MidiExportResult:
    export_id:        str
    born_at:          str
    era:              str
    version:          str         # cure-{era}-r6
    bpm:              int
    ppqn:             int
    bars:             int
    event_count:      int
    track_count:      int         # always 1 (Format 0)
    duration_ticks:   int
    duration_seconds: float
    source:           str         # "midi_viz" | "resonance"
    midi_bytes:       bytes


# ── frame converters ──────────────────────────────────────────────────────────

def _events_from_midi_viz_frame(frame) -> list[dict]:
    """Extract note events from a MidiVizFrame."""
    out: list[dict] = []
    for n in getattr(frame, "notes", []):
        out.append({
            "tick":           getattr(n, "tick", 0),
            "channel":        getattr(n, "channel", 0),
            "note":           getattr(n, "note", 60),
            "velocity":       getattr(n, "velocity", 64),
            "duration_ticks": getattr(n, "duration_ticks", _PPQN // 2),
        })
    return out


def _events_from_resonance_frame(frame) -> list[dict]:
    """Extract note events from a ResonanceFrame."""
    out: list[dict] = []
    for n in getattr(frame, "notes", []):
        out.append({
            "tick":           getattr(n, "tick", 0),
            "channel":        getattr(n, "channel", 0),
            "note":           getattr(n, "note", 60),
            "velocity":       getattr(n, "velocity", 64),
            "duration_ticks": getattr(n, "duration_ticks", _PPQN // 2),
        })
    return out


def frame_to_midi(frame, source: str = "midi_viz") -> MidiExportResult:
    """Convert a MidiVizFrame or ResonanceFrame to a MidiExportResult.

    Parameters
    ----------
    frame:
        MidiVizFrame (from midi_viz.py) or ResonanceFrame (from resonance_score.py).
    source:
        "midi_viz" or "resonance" — identifies the frame type.

    Returns
    -------
    MidiExportResult containing the raw MIDI bytes and metadata.
    """
    bpm  = getattr(frame, "bpm", 120) or 120
    bars = getattr(frame, "bars", 4)  or 4
    ppqn = getattr(frame, "ppqn", _PPQN) or _PPQN
    era  = getattr(frame, "era", "baroque")

    if source == "resonance":
        events = _events_from_resonance_frame(frame)
    else:
        events = _events_from_midi_viz_frame(frame)

    midi_bytes = events_to_midi_bytes(events, bpm=bpm, ppqn=ppqn)

    beats_total    = bars * 4
    duration_ticks = beats_total * ppqn
    us_per_beat    = max(1, round(60_000_000 / bpm))
    duration_sec   = round((duration_ticks * us_per_beat) / (ppqn * 1_000_000), 3)

    return MidiExportResult(
        export_id        = str(uuid.uuid4()),
        born_at          = datetime.datetime.now(datetime.timezone.utc).isoformat(),
        era              = era,
        version          = f"cure-{era}-r{CURRENT_REV}",
        bpm              = bpm,
        ppqn             = ppqn,
        bars             = bars,
        event_count      = len(events),
        track_count      = 1,
        duration_ticks   = duration_ticks,
        duration_seconds = duration_sec,
        source           = source,
        midi_bytes       = midi_bytes,
    )
