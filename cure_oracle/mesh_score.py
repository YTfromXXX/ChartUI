"""cure_oracle/mesh_score.py — Phase J: Free-curve mesh → musical note converter.

Converts freehand strokes drawn on a grid mesh into SonnetScore-compatible
NoteEvent sequences, stored per instrument register.

Mesh coordinate system
----------------------
  x ∈ [0.0, 1.0]  — horizontal = time  (left → right)
  y ∈ [0.0, 1.0]  — vertical   = pitch (top = high, bottom = low)

Y-zone → register (4 equal zones, matching 四天王スロット S1–S4)
  [0.00, 0.25) → 大甲音    ch0  Dragon ascent  (highest)
  [0.25, 0.50) → 甲音     ch1  Wand sweep
  [0.50, 0.75) → 呂音     ch2  Grid pulse
  [0.75, 1.00] → 呂音-bass ch3  Candy grab anchor (lowest)

Motif classification (stroke geometry heuristics)
  low curvature, long horizontal → scale_run
  high oscillation / zigzag     → tremolo
  high curvature, smooth arc    → arpeggio
  short x-span, cluster         → staccato_burst
  nearly vertical, dense        → block_chord

Version
-------
  Phase J = cure-{era}-r2
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional


# ── constants ─────────────────────────────────────────────────────────────────

CURRENT_REV: int = 2

VALID_ERAS: tuple[str, ...] = (
    "baroque", "classical", "beethoven", "romantic", "inner_world",
)

ERA_MENTE_LOWER: dict[str, float] = {
    "baroque":     0.00,
    "classical":   0.57,
    "beethoven":   1.14,
    "romantic":    1.72,
    "inner_world": 2.29,
}

_REGISTER_ZONES: list[tuple[float, float, str]] = [
    (0.00, 0.25, "大甲音"),
    (0.25, 0.50, "甲音"),
    (0.50, 0.75, "呂音"),
    (0.75, 1.01, "呂音-bass"),
]

_MOTIF_TYPES: tuple[str, ...] = (
    "scale_run", "tremolo", "arpeggio", "staccato_burst", "block_chord",
)


# ── data classes ───────────────────────────────────────────────────────────────

@dataclass
class GridConfig:
    """Mesh grid parameters controlling time/pitch resolution."""
    cols: int = 16            # horizontal grid divisions (time axis)
    rows: int = 12            # vertical grid divisions (pitch axis)
    bpm: int = 120
    bars: int = 4
    beats_per_bar: int = 4

    def beat_range(self) -> tuple[float, float]:
        return (1.0, 1.0 + self.bars * self.beats_per_bar)

    def total_beats(self) -> int:
        return self.bars * self.beats_per_bar


@dataclass
class RawPoint:
    """A single point on the normalized mesh [0,1]×[0,1]."""
    x: float
    y: float
    t: float = 0.0  # timestamp in ms (optional, for velocity calc)

    def __post_init__(self) -> None:
        self.x = max(0.0, min(1.0, float(self.x)))
        self.y = max(0.0, min(1.0, float(self.y)))
        self.t = float(self.t)


@dataclass
class MeshStroke:
    """A connected sequence of RawPoints — one drawn gesture."""
    points: list[RawPoint] = field(default_factory=list)

    # ── geometry queries ──────────────────────────────────────────────────────

    def is_valid(self) -> bool:
        return len(self.points) >= 2

    def x_span(self) -> float:
        if not self.points:
            return 0.0
        xs = [p.x for p in self.points]
        return max(xs) - min(xs)

    def y_span(self) -> float:
        if not self.points:
            return 0.0
        ys = [p.y for p in self.points]
        return max(ys) - min(ys)

    def mean_x(self) -> float:
        if not self.points:
            return 0.0
        return sum(p.x for p in self.points) / len(self.points)

    def mean_y(self) -> float:
        if not self.points:
            return 0.5
        return sum(p.y for p in self.points) / len(self.points)

    def path_length(self) -> float:
        return sum(
            math.hypot(b.x - a.x, b.y - a.y)
            for a, b in zip(self.points, self.points[1:])
        )

    def curvature_index(self) -> float:
        """0 = straight line · 1 = highly curved path."""
        if len(self.points) < 3:
            return 0.0
        chord = math.hypot(
            self.points[-1].x - self.points[0].x,
            self.points[-1].y - self.points[0].y,
        )
        path = self.path_length()
        if path == 0.0:
            return 0.0
        return max(0.0, min(1.0, 1.0 - chord / path))

    def oscillation_index(self) -> float:
        """Fraction of Y-direction reversals (0 = monotone · 1 = zigzag)."""
        ys = [p.y for p in self.points]
        if len(ys) < 3:
            return 0.0
        reversals = sum(
            1
            for i in range(1, len(ys) - 1)
            if (ys[i] - ys[i - 1]) * (ys[i + 1] - ys[i]) < 0
        )
        return reversals / max(1, len(ys) - 2)


@dataclass
class NoteEvent:
    """A single musical note event derived from one MeshStroke."""
    beat: float
    duration: float
    register: str
    motif: str
    intensity: float
    embellishment: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "beat":          round(self.beat, 3),
            "duration":      round(self.duration, 3),
            "register":      self.register,
            "motif":         self.motif,
            "intensity":     round(self.intensity, 3),
            "embellishment": self.embellishment,
        }


# ── private helpers ────────────────────────────────────────────────────────────

def _y_to_register(y: float) -> str:
    """Map normalized Y ∈ [0,1] to instrument register."""
    for lo, hi, reg in _REGISTER_ZONES:
        if lo <= y < hi:
            return reg
    return "呂音-bass"


def _classify_motif(stroke: MeshStroke) -> str:
    """Classify a stroke's gesture into a Sonnet-Score motif type."""
    if not stroke.is_valid():
        return "scale_run"

    ci = stroke.curvature_index()
    oi = stroke.oscillation_index()
    xs = stroke.x_span()
    ys = stroke.y_span()

    # Nearly vertical cluster → block_chord
    if xs < 0.05 and ys >= 0.08:
        return "block_chord"

    # Zigzag oscillation → tremolo
    if oi >= 0.40:
        return "tremolo"

    # Smooth arc (high curvature, low oscillation) → arpeggio
    if ci >= 0.25 and oi < 0.25:
        return "arpeggio"

    # Short horizontal burst → staccato_burst
    if xs < 0.08:
        return "staccato_burst"

    # Long, smooth, low curvature → scale_run
    return "scale_run"


def _x_to_beat(x: float, cfg: GridConfig) -> float:
    lo, hi = cfg.beat_range()
    return lo + x * (hi - lo)


def _xspan_to_duration(x_span: float, cfg: GridConfig) -> float:
    total = float(cfg.total_beats())
    return max(0.25, min(total, x_span * total))


def _stroke_intensity(stroke: MeshStroke) -> float:
    """Derive note intensity from stroke path length (longer/faster = louder)."""
    path = stroke.path_length()
    return max(0.1, min(1.0, path * 4.0))


# ── public API ─────────────────────────────────────────────────────────────────

def era_from_mente(mente_total: float) -> str:
    """Return the musical era for a given MENTE score."""
    for era in reversed(list(ERA_MENTE_LOWER)):  # inner_world first
        if mente_total >= ERA_MENTE_LOWER[era]:
            return era
    return "baroque"


def stroke_from_dict(raw: list[dict]) -> MeshStroke:
    """Build a MeshStroke from a list of {x, y, t?} dicts."""
    pts = [RawPoint(p["x"], p["y"], p.get("t", 0.0)) for p in raw]
    return MeshStroke(pts)


def strokes_to_score(
    strokes: list[MeshStroke | list[dict]],
    era: str = "baroque",
    grid_cfg: Optional[GridConfig] = None,
) -> dict:
    """Convert freehand mesh strokes into a Sonnet-Score-compatible event list.

    Parameters
    ----------
    strokes:
        Each stroke is either a MeshStroke or a list of {x, y, t?} dicts.
    era:
        Musical era for instrument context (baroque … inner_world).
    grid_cfg:
        Mesh grid configuration; defaults to GridConfig().

    Returns
    -------
    dict with keys: era, version, bpm, bars, events, stroke_count, export_hint
    """
    if grid_cfg is None:
        grid_cfg = GridConfig()

    if era not in VALID_ERAS:
        raise ValueError(f"Unknown era: {era!r}. Valid values: {VALID_ERAS}")

    parsed: list[MeshStroke] = []
    for s in strokes:
        if isinstance(s, MeshStroke):
            parsed.append(s)
        else:
            parsed.append(stroke_from_dict(s))

    events: list[NoteEvent] = []
    for stroke in parsed:
        if not stroke.is_valid():
            continue
        events.append(NoteEvent(
            beat=_x_to_beat(stroke.mean_x(), grid_cfg),
            duration=_xspan_to_duration(stroke.x_span(), grid_cfg),
            register=_y_to_register(stroke.mean_y()),
            motif=_classify_motif(stroke),
            intensity=_stroke_intensity(stroke),
        ))

    events.sort(key=lambda e: e.beat)

    return {
        "era":          era,
        "version":      f"cure-{era}-r{CURRENT_REV}",
        "bpm":          grid_cfg.bpm,
        "bars":         grid_cfg.bars,
        "events":       [e.to_dict() for e in events],
        "stroke_count": sum(1 for s in parsed if s.is_valid()),
        "export_hint":  "MIDI-compatible event stream at 480 PPQN",
    }
