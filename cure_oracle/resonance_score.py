"""cure_oracle/resonance_score.py — Phase M: Resonance-Score Max-Cut × MIDI fusion (B地点第八画面).

CURRENT_REV = 5

Converts a QuantumSimResult + Resonance Max-Cut bits into a ResonanceFrame
suitable for the RESONANCE_VIZ Flet screen.

Data flow
---------
  GET /candy/resonance/stream (SSE)
  → QuantumSimResult + Max-Cut bits (pre-computed or brute-force)
  → build_resonance_frame()
  → ResonanceFrame
  → AppState.resonance_viz (ResonanceState)
  → Flet RESONANCE_VIZ screen (B地点第八画面)

Max-Cut mapping (6 coins → 4 MIDI channels)
--------------------------------------------
  Partition-0 (group=0): BTC, ETH, SOL  → ch0 大甲音 + ch1 甲音
  Partition-1 (group=1): XRP, ADA, DOGE → ch2 呂音  + ch3 呂音-bass

  Within each partition:
    coin_index % 2 == 0 → higher channel of the pair
    coin_index % 2 == 1 → lower channel of the pair

Coin labels (6, from resonance-maxcut.json v1)
----------------------------------------------
  0 BTC  1 ETH  2 SOL  3 XRP  4 ADA  5 DOGE

cure-{era}-r5  (Phase M)
"""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass, field
from typing import Optional

CURRENT_REV: int = 5

# ── constants ─────────────────────────────────────────────────────────────────

COIN_LABELS: list[str] = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"]

_CHANNEL_NAMES: list[str] = ["大甲音", "甲音", "呂音", "呂音-bass"]

# Base MIDI note per coin (C major pentatonic, two octave spread)
_COIN_NOTE_BASE: list[int] = [72, 69, 67, 64, 60, 57]  # C5 A4 G4 E4 C4 A3

_PPQN = 480


def _coin_channel(coin_index: int, group: int) -> int:
    """Map (coin_index, partition group) → MIDI channel 0-3."""
    if group == 0:
        return 0 if coin_index % 2 == 0 else 1
    return 2 if coin_index % 2 == 0 else 3


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class ResonanceNote:
    coin:           str
    coin_index:     int
    group:          int    # Max-Cut partition 0 or 1
    channel:        int    # MIDI channel 0-3
    note:           int    # MIDI note 0-127
    velocity:       int    # 0-127
    tick:           int    # onset tick (PPQN)
    duration_ticks: int
    weight_sum:     float  # sum of Max-Cut edge weights for this coin


@dataclass
class ResonanceChannel:
    index:        int
    name:         str
    coin_labels:  list[str]
    note_count:   int
    avg_velocity: float
    cut_weight:   float    # total cut weight attributed to this channel
    active:       bool


@dataclass
class ResonanceFrame:
    frame_id:       str
    born_at:        str
    era:            str
    version:        str               # cure-{era}-r5
    bpm:            int
    bars:           int
    mente_total:    float
    mente_achieved: bool
    fusion_note:    str
    fused_shapes:   list[str]
    cut_value:      float
    partition_0:    list[str]         # coin labels in group 0
    partition_1:    list[str]         # coin labels in group 1
    notes:          list[ResonanceNote]
    channels:       list[ResonanceChannel]
    ppqn:           int = _PPQN


# ── helpers ───────────────────────────────────────────────────────────────────

def _coin_weight_sums(doc: dict, bits: list[int]) -> list[float]:
    """Sum of Max-Cut edge weights incident to each coin in the cut."""
    n = doc["n"]
    weights = doc["weights"]
    sums = [0.0] * n
    for i in range(n):
        for j in range(i + 1, n):
            if bits[i] != bits[j]:
                sums[i] += weights[i][j]
                sums[j] += weights[i][j]
    return sums


def _total_max_weight(doc: dict) -> float:
    n = doc["n"]
    w = doc["weights"]
    return sum(w[i][j] for i in range(n) for j in range(i + 1, n))


# ── builder ───────────────────────────────────────────────────────────────────

def build_resonance_frame(
    sim_result,
    bits: Optional[list[int]] = None,
) -> ResonanceFrame:
    """Convert a QuantumSimResult + Max-Cut bits into a ResonanceFrame.

    Parameters
    ----------
    sim_result:
        QuantumSimResult from cure_oracle.quantum_sim.run_quantum_sim().
    bits:
        Max-Cut partition bits (0 or 1 per coin, length 6).  None → use the
        pre-computed browser-optimal bits from resonance-maxcut.json
        (Qiskit-free, fully deterministic — no IBM QPU required).

    Returns
    -------
    ResonanceFrame ready for SSE / Flet RESONANCE_VIZ screen.
    """
    from cure_oracle.resonance import load, cut_value as _cut_value

    doc = load()

    if bits is None:
        bits = doc["browser"]["best_groups"]

    cv          = _cut_value(doc, bits)
    labels      = doc["labels"]
    max_w       = _total_max_weight(doc)
    intensity   = min(1.0, cv / max_w) if max_w > 0 else 0.5
    weight_sums = _coin_weight_sums(doc, bits)

    bpm  = getattr(getattr(sim_result, "score", None), "bpm", 120) or 120
    bars = getattr(getattr(sim_result, "score", None), "bars", 4)  or 4
    beats_total = bars * 4

    p0 = [labels[i] for i, b in enumerate(bits) if b == 0]
    p1 = [labels[i] for i, b in enumerate(bits) if b == 1]

    notes: list[ResonanceNote] = []
    for idx, label in enumerate(labels):
        group    = bits[idx]
        channel  = _coin_channel(idx, group)
        ws       = weight_sums[idx]
        velocity = max(30, min(127, round(60 + ws * 20 + intensity * 30)))
        beat_off = (idx / len(labels)) * beats_total
        tick     = round(beat_off * _PPQN)
        dur      = max(_PPQN // 2, round(ws * _PPQN * 0.5))

        notes.append(ResonanceNote(
            coin=label, coin_index=idx, group=group, channel=channel,
            note=_COIN_NOTE_BASE[idx], velocity=velocity,
            tick=tick, duration_ticks=dur, weight_sum=ws,
        ))

    # aggregate per channel
    ch_coins:  dict[int, list[str]] = {i: [] for i in range(4)}
    ch_vels:   dict[int, list[int]] = {i: [] for i in range(4)}
    ch_weight: dict[int, float]     = {i: 0.0 for i in range(4)}
    for n_ in notes:
        ch_coins[n_.channel].append(n_.coin)
        ch_vels[n_.channel].append(n_.velocity)
        ch_weight[n_.channel] += n_.weight_sum

    channels = [
        ResonanceChannel(
            index=i, name=_CHANNEL_NAMES[i],
            coin_labels=ch_coins[i],
            note_count=len(ch_coins[i]),
            avg_velocity=(sum(ch_vels[i]) / len(ch_vels[i])) if ch_vels[i] else 0.0,
            cut_weight=ch_weight[i],
            active=len(ch_coins[i]) > 0,
        )
        for i in range(4)
    ]

    era     = getattr(sim_result, "era", "baroque")
    version = f"cure-{era}-r{CURRENT_REV}"
    p0_str  = "/".join(p0) if p0 else "—"
    p1_str  = "/".join(p1) if p1 else "—"
    sim_fn  = getattr(sim_result, "fusion_note", "")
    fusion_note = f"Max-Cut {cv:.3f} | {p0_str} ⟷ {p1_str} | {sim_fn}"

    return ResonanceFrame(
        frame_id       = str(uuid.uuid4()),
        born_at        = datetime.datetime.now(datetime.timezone.utc).isoformat(),
        era            = era,
        version        = version,
        bpm            = bpm,
        bars           = bars,
        mente_total    = getattr(sim_result, "mente_total", 0.0),
        mente_achieved = getattr(sim_result, "mente_achieved", False),
        fusion_note    = fusion_note,
        fused_shapes   = list(getattr(sim_result, "fused_shapes", [])),
        cut_value      = cv,
        partition_0    = p0,
        partition_1    = p1,
        notes          = notes,
        channels       = channels,
        ppqn           = _PPQN,
    )
