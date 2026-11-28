"""cure_oracle/hdna_sim.py — .hdna Music Simulation Engine.

CURRENT_REV = 13 — B地点第十六画面 (Phase U)

Converts an HdnaCard (.hdna binary) into two music-API-compatible outputs:
  1. Tone.js sequence JSON  — transport + instrument + reverb + notes
  2. Standard MIDI Type-0   — MThd/MTrk bytes (base64 in JSON responses)

Era → instrument
-----------------
  baroque     → harpsichord
  classical   → piano
  beethoven   → piano
  romantic    → strings
  inner_world → synth

Scene → reverb preset
----------------------
  trading  → roomSize 0.3 / wet 0.4  (intimate / office)
  soccer   → roomSize 0.8 / wet 0.6  (stadium)
  surfing  → roomSize 0.9 / wet 0.7  (open water)
  climbing → roomSize 0.5 / wet 0.3  (rock face)
  live     → roomSize 0.7 / wet 0.5  (concert hall)

MIDI structure
--------------
  MThd: format=0, tracks=1, division=480 PPQN
  MTrk: tempo meta-event + note-on/off pairs + end-of-track
"""

from __future__ import annotations

import base64
import struct
from dataclasses import dataclass

from cure_oracle.hdna import HdnaCard, SPEC_REV

# ── constants ─────────────────────────────────────────────────────────────────

CURRENT_REV: int = 13
PPQN:        int = 480  # ticks per beat — matches knot_score.py

_NOTE_NAMES: list[str] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
]

_ERA_INSTRUMENT: dict[str, str] = {
    "baroque":     "harpsichord",
    "classical":   "piano",
    "beethoven":   "piano",
    "romantic":    "strings",
    "inner_world": "synth",
}

_SCENE_REVERB: dict[str, dict] = {
    "trading":  {"roomSize": 0.3, "wet": 0.4},
    "soccer":   {"roomSize": 0.8, "wet": 0.6},
    "surfing":  {"roomSize": 0.9, "wet": 0.7},
    "climbing": {"roomSize": 0.5, "wet": 0.3},
    "live":     {"roomSize": 0.7, "wet": 0.5},
}


# ── helpers ───────────────────────────────────────────────────────────────────

def midi_note_name(n: int) -> str:
    """MIDI pitch number → note name string (e.g. 60 → 'C4', 69 → 'A4')."""
    n = max(0, min(127, n))
    return f"{_NOTE_NAMES[n % 12]}{n // 12 - 1}"


def _vlq(n: int) -> bytes:
    """Variable-length quantity encoding for MIDI delta times."""
    if n == 0:
        return b"\x00"
    buf: list[int] = []
    while n > 0:
        buf.append(n & 0x7F)
        n >>= 7
    buf.reverse()
    for i in range(len(buf) - 1):
        buf[i] |= 0x80
    return bytes(buf)


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class SimNote:
    """One simulated note with real-time annotations."""
    pitch_midi:          int
    note_name:           str
    time_sec:            float    # onset time in seconds
    duration_sec:        float    # duration in seconds
    velocity_normalized: float    # 0.0–1.0

    def to_dict(self) -> dict:
        return {
            "pitch_midi":          self.pitch_midi,
            "note_name":           self.note_name,
            "time_sec":            round(self.time_sec,            4),
            "duration_sec":        round(self.duration_sec,        4),
            "velocity_normalized": round(self.velocity_normalized, 4),
        }


@dataclass
class HdnaSimResult:
    """Full simulation output for one HdnaCard."""
    spec_rev:         str
    era:              str
    band:             str
    scene:            str
    rarity:           str
    bpm:              int
    key_pc:           int
    mente_total:      float
    theta_q:          float
    instrument:       str
    reverb:           dict
    note_count:       int
    duration_sec:     float
    notes:            list[SimNote]
    tone_js_sequence: dict   # Tone.js Part-compatible sequence
    midi_b64:         str    # base64-encoded MIDI Type-0 bytes

    def to_dict(self) -> dict:
        return {
            "spec_rev":         self.spec_rev,
            "era":              self.era,
            "band":             self.band,
            "scene":            self.scene,
            "rarity":           self.rarity,
            "bpm":              self.bpm,
            "key_pc":           self.key_pc,
            "mente_total":      round(self.mente_total, 6),
            "theta_q":          round(self.theta_q,     6),
            "instrument":       self.instrument,
            "reverb":           self.reverb,
            "note_count":       self.note_count,
            "duration_sec":     round(self.duration_sec, 4),
            "notes":            [n.to_dict() for n in self.notes],
            "tone_js_sequence": self.tone_js_sequence,
            "midi_b64":         self.midi_b64,
        }


# ── core conversion ───────────────────────────────────────────────────────────

def to_sim_notes(card: HdnaCard) -> list[SimNote]:
    """Convert HdnaCard NoteEvents to real-time annotated SimNotes."""
    bpm          = card.mdna.bpm or 120
    sec_per_tick = 60.0 / bpm / PPQN
    return [
        SimNote(
            pitch_midi          = n.pitch,
            note_name           = midi_note_name(n.pitch),
            time_sec            = round(n.start_tick * sec_per_tick, 6),
            duration_sec        = round(max(n.dur_ticks, 1) * sec_per_tick, 6),
            velocity_normalized = round(n.velocity / 127.0, 4),
        )
        for n in card.mdna.notes
    ]


def to_tone_js_sequence(card: HdnaCard) -> dict:
    """Build a Tone.js Part-compatible sequence dict.

    Usage in browser:
      const part = new Tone.Part((time, v) =>
          synth.triggerAttackRelease(v.note, v.duration, time, v.velocity),
          seq.notes);
      Tone.Transport.bpm.value = seq.transport.bpm;
      part.start(0);
      Tone.Transport.start();
    """
    era        = card.era
    scene      = card.scene
    instrument = _ERA_INSTRUMENT.get(era, "piano")
    reverb     = _SCENE_REVERB.get(scene, {"roomSize": 0.5, "wet": 0.4})
    notes      = to_sim_notes(card)
    return {
        "transport": {
            "bpm":           card.mdna.bpm or 120,
            "timeSignature": [4, 4],
        },
        "instrument": {
            "type":   instrument,
            "reverb": reverb,
        },
        "notes": [
            {
                "time":     n.time_sec,
                "note":     n.note_name,
                "duration": n.duration_sec,
                "velocity": n.velocity_normalized,
            }
            for n in notes
        ],
    }


def to_midi_bytes(card: HdnaCard) -> bytes:
    """Generate a standard MIDI Type-0 file from an HdnaCard.

    Returns raw bytes beginning with b'MThd' (6-byte header).
    """
    bpm         = card.mdna.bpm or 120
    us_per_beat = int(60_000_000 / bpm)

    # timeline: (absolute_tick, is_note_on, pitch, velocity)
    events: list[tuple[int, bool, int, int]] = []
    for n in card.mdna.notes:
        events.append((n.start_tick,                     True,  n.pitch, n.velocity))
        events.append((n.start_tick + max(n.dur_ticks, 1), False, n.pitch, 0))
    # sort by tick; note-off (False) before note-on (True) at the same tick
    events.sort(key=lambda e: (e[0], e[1]))

    track = bytearray()
    # tempo meta-event at delta=0
    track += b"\x00\xFF\x51\x03"
    track += bytes([
        (us_per_beat >> 16) & 0xFF,
        (us_per_beat >>  8) & 0xFF,
         us_per_beat        & 0xFF,
    ])

    prev = 0
    for tick, is_on, pitch, vel in events:
        delta  = tick - prev
        status = 0x90 if is_on else 0x80
        track += _vlq(delta) + bytes([status, pitch & 0x7F, vel & 0x7F])
        prev   = tick

    track += b"\x00\xFF\x2F\x00"  # end of track

    header = b"MThd" + struct.pack(">IHHH", 6, 0, 1, PPQN)
    trk    = b"MTrk" + struct.pack(">I", len(track)) + bytes(track)
    return header + trk


def simulate(card: HdnaCard) -> HdnaSimResult:
    """Simulate full playback of an HdnaCard.

    Returns HdnaSimResult with Tone.js sequence JSON and base64 MIDI bytes.
    """
    era        = card.era
    scene      = card.scene
    instrument = _ERA_INSTRUMENT.get(era, "piano")
    reverb     = _SCENE_REVERB.get(scene, {"roomSize": 0.5, "wet": 0.4})
    notes      = to_sim_notes(card)
    tone_js    = to_tone_js_sequence(card)
    midi_raw   = to_midi_bytes(card)
    midi_b64   = base64.b64encode(midi_raw).decode("ascii")
    duration   = max(
        (n.time_sec + n.duration_sec for n in notes),
        default=0.0,
    )
    return HdnaSimResult(
        spec_rev         = SPEC_REV,
        era              = era,
        band             = card.band,
        scene            = scene,
        rarity           = card.rarity_label,
        bpm              = card.mdna.bpm or 120,
        key_pc           = card.mdna.key_pc,
        mente_total      = card.mdna.mente_total,
        theta_q          = card.vart.theta_q,
        instrument       = instrument,
        reverb           = reverb,
        note_count       = len(notes),
        duration_sec     = round(duration, 4),
        notes            = notes,
        tone_js_sequence = tone_js,
        midi_b64         = midi_b64,
    )
