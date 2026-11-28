"""cure_oracle/knot_score.py — Phase Q: _Sonnet-Score-API × Knot Score Engine
(B地点第十二画面).

CURRENT_REV = 9

Implements the _Sonnet-Score-API: 246 rope knots (knots3d.com) mapped to
12 chromatic pitch classes × 4 vertical strip voices (fig 13) × Magic Circle
harmony ring (fig 9/14) × GarageBand 2×8 loop grid (fig 14).

Reference images:
  Fig 8:  Graphic score p.15 — price_curve → score_line (Prestissimo/Lento)
  Fig 9:  "The Magic Circle of Infinity — Dylan Perceived — SYMBOL Vol."
  Fig 10: Stegfläche/hinterm Steg — bow_position → filter_freq
  Fig 11: Spectral duration graph — duration_sec[] → note_length
  Fig 12: 4Vn/3Vl/3Vc/2Cb micropolyphony — 4 MIDI ch. color strands
  Fig 13: 4-panel vertical strip notation (pppp/quasi Pfiff/legno salt)
  Fig 14: Controller throw → Magic Circle → GarageBand grid (2×8)

cure-{era}-r9  (Phase Q)
"""

from __future__ import annotations

import datetime
import hashlib
import math
import uuid
from dataclasses import dataclass

CURRENT_REV: int = 9

PHI         = (1 + 5 ** 0.5) / 2
PHI_INV     = 1 / PHI
MENTE_CONST = PHI * math.sqrt(2)   # ≈ 2.2882

# Magic Circle of Infinity — 12 chromatic positions (fig 9/14)
PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# 12-cycle knot family → pitch class BMI mapping
KNOT_FAMILY_LABELS = [
    "止め結び",    # C  0 — stopper
    "ループ",      # C# 1 — loop / bowline
    "ヒッチ_単",   # D  2 — simple hitch
    "ヒッチ_複",   # D# 3 — complex/friction hitch
    "ベンド_単",   # E  4 — simple bend
    "ベンド_複",   # F  5 — complex bend
    "バインディング",  # F# 6 — binding
    "ラッシング",  # G  7 — lashing
    "スプライス",  # G# 8 — splice / join
    "装飾マット",  # A  9 — decorative mat
    "コイル",      # A# 10 — coil
    "特殊位相",    # B  11 — topological special
]

# Fig 13: 4 strip voices — technique tags (pppp underwater)
STRIP_TECHNIQUES = [
    "pppp_thumb_arco",    # Strip 0 Vn ch.0: Daumen heraus, pppp, gliss
    "pppp_cluster",       # Strip 1 Vl ch.1: III→I, ppp cluster
    "quasi_pfiff_bogen",  # Strip 2 Vc ch.2: quasi Pfiff, Bogen stop, V-gliss
    "legno_salt_steg",    # Strip 3 Cb ch.3: legno salt I/III zum Steg
]

# Strip velocity levels (pppp water attenuation, fig 10/13)
_STRIP_VEL = [5, 8, 15, 30]       # pppp, pppp, quasi-pfiff, legno

# MIDI base notes per voice: Vn=60(C4) Vl=48(C3) Vc=36(C2) Cb=24(C1)
_VOICE_BASE = [60, 48, 36, 24]

# Fig 11: spectral duration reference (seconds)
DURATION_TABLE_SEC = [
    13.3, 19.6, 11.0, 19.6, 16.2, 65.0,
    12.5,  9.0, 13.4, 19.5, 28.8, 13.2,
    19.6,  4.6, 17.7, 23.8, 18.4, 116.6,
    12.5, 17.2,  6.1,  6.5, 25.3,
]

# Fig 10: bow_position → LPF cutoff Hz
# 0.0=normale(4000Hz), 0.5=Stegfläche(800Hz), 1.0=hinterm_Steg(200Hz)
def bow_to_filter_hz(bow_pos: float) -> float:
    p = max(0.0, min(1.0, bow_pos))
    return round(4000.0 * (1 - p) + 200.0 * p, 2)


def duration_sec_to_ticks(sec: float, bpm: float = 120, ppqn: int = 480) -> int:
    return max(1, int(sec * (bpm / 60) * ppqn))


# ── dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class KnotStrip:
    """Vertical strip voice (fig 13 — 4-panel strip notation)."""
    voice_id:  int
    midi_ch:   int
    technique: str
    bow_pos:   float
    filter_hz: float
    base_note: int              # MIDI note (pitch_class + octave_base)
    velocity:  int
    notes:     list             # [(pitch_midi, velocity, duration_ticks)]
    gliss_arc: list             # V-shape [(t, semitones)] — fig 13 strip 2


@dataclass
class MagicCircleRing:
    """12-position harmony ring (Magic Circle of Infinity, fig 9/14)."""
    positions:   int            # 12
    t_steps:     int            # 16
    placements:  list           # [12][16] diamond icon bits
    pitch_names: list           # PITCH_NAMES
    throw_arc:   list           # controller trajectory [(t, angle_rad, radius)]


@dataclass
class GarageBandGrid:
    """2×8 loop grid (ガレージバンドトラックループ AREA, fig 14)."""
    rows:       int             # 8
    cols:       int             # 2 (Loop A, Loop B)
    cells:      list            # [8][2] active bits
    row_labels: list            # knot family names (8 of 12)
    loop_a:     list            # active knot name per row, Loop A
    loop_b:     list            # harmony knot name per row, Loop B


@dataclass
class KnotScoreFrame:
    frame_id:       str
    born_at:        str
    era:            str
    version:        str         # cure-{era}-r9
    knot_name:      str
    knot_pitch:     int         # 0-11
    pitch_name:     str
    knot_family:    str
    theta_q:        float
    bow_position:   float
    filter_hz:      float
    technique:      str
    mente_total:    float
    duration_ticks: int
    strips:         list        # 4 KnotStrip
    magic_circle:   MagicCircleRing
    gb_grid:        GarageBandGrid


# ── knot pitch classifier ─────────────────────────────────────────────────────

def classify_knot_pitch(name: str) -> int:
    """Map a Japanese knot name to pitch class 0-11 (12-cycle BMI)."""
    # B/11: topological special
    if any(k in name for k in ["三葉結び目", "愛結び", "総角", "猿のこぶし", "ケルト", "叶結び", "タール"]):
        return 11
    # A#/10: coils
    if any(k in name for k in ["コイル", "フレーク", "フレミッシュ"]):
        return 10
    # A/9: decorative mats
    if any(k in name for k in ["タークス", "マット", "キャリック", "ミチョアカン", "ヴァルドスタン", "ダイヤモンド", "オーシャン"]):
        return 9
    # G#/8: splices/joins
    if any(k in name for k in ["継ぎ", "一本鎖"]):
        return 8
    # G/7: lashings
    if any(k in name for k in ["縛り", "三脚", "三方", "角縛"]):
        return 7
    # F#/6: binding/constricting
    if any(k in name for k in ["コンストリクター", "バントライン", "南京", "荷造"]):
        return 6
    # F/5: complex bends
    if any(k in name for k in ["ダブル・", "ブラッド", "ドラゴン", "ハーネス", "ラッキング", "バイス"]):
        return 5
    # E/4: simple bends
    if any(k in name for k in ["ベンド", "本結び", "握手", "ブローチ", "サンソム", "ハンターズ", "ツェッペリン", "アシュリー", "ラップ", "小綱", "引き通し", "一重継", "止め結び継"]):
        return 4
    # D#/3: friction/complex hitches
    if any(k in name for k in ["ムンター", "ターバック", "自在", "プルージック", "クレムヘイスト", "ディステル", "ミッドシップ", "スーパー", "ライターマンズ", "ファリモンド", "トラッカーズ", "ポルド"]):
        return 3
    # D/2: simple hitches
    if any(k in name for k in ["ヒッチ", "巻き結び", "錨", "係留", "端綱", "杭", "仲仕", "もどる", "よろい", "グラウンド", "つらら", "てこ"]):
        return 2
    # C#/1: loops/bowlines
    if any(k in name for k in ["もやい", "ループ", "ひばり", "バタフライ", "サージャン", "パーフェクション", "ドロッパー", "ハンソン", "クレー", "スペイン", "テグス", "ユカタン", "エドワーズ", "スコット", "罠", "逆もやい", "ふじ", "ポルトガル", "巻きもやい", "引き解けもやい"]):
        return 1
    # C/0: stopper/overhand
    if any(k in name for k in ["止め", "八の字結び", "オーバーハンド", "ストッパー", "エスター", "トリプル", "ナイン", "固め", "詰め", "引き解け結び"]):
        return 0
    # Fallback: stable hash mod 12
    return int(hashlib.md5(name.encode("utf-8")).hexdigest(), 16) % 12


# ── builder helpers ───────────────────────────────────────────────────────────

def _build_v_gliss(t_steps: int, theta_q: float) -> list:
    """V-shape glissando arc from fig 13 strip 2 (quasi Pfiff, Bogen stop).

    Rise for t<0.5, fall for t>0.5; sharpness = theta_q × 12 semitones.
    """
    arc = []
    for j in range(t_steps):
        t = j / max(t_steps - 1, 1)
        half = abs(t - 0.5) * 2       # 0 at centre, 1 at edges
        semitones = round((1 - half) * 12 * theta_q, 4)
        arc.append((round(t, 4), semitones))
    return arc


def _build_strip(voice_id: int, knot_pitch: int, theta_q: float,
                 bow_pos: float, t_steps: int) -> KnotStrip:
    technique = STRIP_TECHNIQUES[voice_id]
    base_note = _VOICE_BASE[voice_id] + knot_pitch
    vel       = _STRIP_VEL[voice_id]
    fhz       = bow_to_filter_hz(bow_pos)

    notes: list = []
    for step in range(t_steps):
        # Phi-based rhythmic placement (pppp texture, fig 8/13)
        if int(step * PHI_INV * 7) % 3 == 0:
            # Harmony shift: Vl (+4), Vc (+7 or -5), Cb (−12)
            offset = [0, 4, 7, -12][voice_id]
            pitch  = max(21, min(108, base_note + offset))
            dur    = 240 if voice_id < 2 else 480
            notes.append((pitch, vel, dur))

    # V-gliss only on strip 2 (Vc, quasi Pfiff)
    gliss = _build_v_gliss(t_steps, theta_q) if voice_id == 2 else []

    return KnotStrip(
        voice_id=voice_id, midi_ch=voice_id,
        technique=technique, bow_pos=round(bow_pos, 4),
        filter_hz=fhz, base_note=base_note,
        velocity=vel, notes=notes, gliss_arc=gliss,
    )


def _build_magic_circle(knot_pitch: int, theta_q: float, t_steps: int) -> MagicCircleRing:
    """12-position ring × 16 steps diamond placements + controller throw arc (fig 9/14)."""
    placements = [[0] * t_steps for _ in range(12)]

    # Main melody: knot_pitch position, phi-spaced steps
    for step in range(t_steps):
        if int(step * PHI_INV * 5) % 2 == 0:
            placements[knot_pitch][step] = 1

    # Harmony: +4 semitones (perfect 4th), sparser
    harm_pitch = (knot_pitch + 4) % 12
    for step in range(t_steps):
        if int(step * PHI_INV * 3) % 3 == 0:
            placements[harm_pitch][step] = 1

    # Controller throw arc: starburst(theta_q×2π) → landing(knot_pitch×π/6)
    # Reuses Phase P quaternion concept: arc in polar coords
    start_angle = theta_q * 2 * math.pi
    end_angle   = knot_pitch * (math.pi / 6)
    throw_arc: list = []
    for j in range(t_steps):
        t = j / max(t_steps - 1, 1)
        angle  = start_angle + (end_angle - start_angle) * t
        radius = 1.5 - 0.5 * t          # falls from 1.5 to 1.0 (landing on ring)
        throw_arc.append((round(t, 4), round(angle, 6), round(radius, 6)))

    return MagicCircleRing(
        positions=12, t_steps=t_steps,
        placements=placements, pitch_names=list(PITCH_NAMES),
        throw_arc=throw_arc,
    )


_GB_ROW_LABELS = [
    "止め/ループ", "ヒッチ_単/複", "ベンド_単/複",
    "バインディング", "ラッシング", "スプライス",
    "装飾マット", "コイル/特殊",
]

# Map 12 pitch classes → 8 GB rows (some rows merge two families)
_PITCH_TO_ROW = [0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 7]


def _build_gb_grid(knot_pitch: int, knot_name: str) -> GarageBandGrid:
    """2×8 GarageBand loop grid (fig 14 right side)."""
    cells = [[0, 0] for _ in range(8)]

    main_row = _PITCH_TO_ROW[knot_pitch]
    harm_row = _PITCH_TO_ROW[(knot_pitch + 4) % 12]

    cells[main_row][0] = 1   # Loop A active
    cells[harm_row][1] = 1   # Loop B harmony

    loop_a = [""] * 8
    loop_b = [""] * 8
    loop_a[main_row] = knot_name
    loop_b[harm_row] = KNOT_FAMILY_LABELS[(knot_pitch + 4) % 12]

    return GarageBandGrid(
        rows=8, cols=2, cells=cells,
        row_labels=_GB_ROW_LABELS,
        loop_a=loop_a, loop_b=loop_b,
    )


# ── main builder ──────────────────────────────────────────────────────────────

def build_knot_score_frame(
    sim_result,
    knot_name:   str   = "もやい結び",
    bow_position: float = 1.0,
    epsilon:      float = 0.019,
    t_steps:      int   = 16,
) -> KnotScoreFrame:
    """Build a KnotScoreFrame from a QuantumSimResult.

    Parameters
    ----------
    sim_result:
        Output of run_quantum_sim().
    knot_name:
        Japanese knot name from knots3d.com (246 total).
    bow_position:
        0.0=normale (4000 Hz), 1.0=hinterm Steg (200 Hz, fully underwater).
    epsilon:
        Noise perturbation ε_disp (default 0.019).
    t_steps:
        Time steps for grids and arcs (default 16).
    """
    era         = getattr(sim_result, "era", "baroque")
    mente_total = float(getattr(sim_result, "mente_total", 1.0) or 1.0)
    theta_q     = min(1.0, max(0.0, mente_total / MENTE_CONST))

    knot_pitch  = classify_knot_pitch(knot_name)
    pitch_name  = PITCH_NAMES[knot_pitch]
    knot_family = KNOT_FAMILY_LABELS[knot_pitch]
    filter_hz   = bow_to_filter_hz(bow_position)
    technique   = STRIP_TECHNIQUES[knot_pitch % 4]

    # Duration from fig 11 spectral table (cycle by pitch)
    dur_sec        = DURATION_TABLE_SEC[knot_pitch % len(DURATION_TABLE_SEC)]
    duration_ticks = duration_sec_to_ticks(dur_sec)

    strips       = [_build_strip(i, knot_pitch, theta_q, bow_position, t_steps)
                    for i in range(4)]
    magic_circle = _build_magic_circle(knot_pitch, theta_q, t_steps)
    gb_grid      = _build_gb_grid(knot_pitch, knot_name)

    return KnotScoreFrame(
        frame_id       = str(uuid.uuid4()),
        born_at        = datetime.datetime.now(datetime.timezone.utc).isoformat(),
        era            = era,
        version        = f"cure-{era}-r{CURRENT_REV}",
        knot_name      = knot_name,
        knot_pitch     = knot_pitch,
        pitch_name     = pitch_name,
        knot_family    = knot_family,
        theta_q        = round(theta_q, 6),
        bow_position   = round(bow_position, 4),
        filter_hz      = filter_hz,
        technique      = technique,
        mente_total    = round(mente_total, 6),
        duration_ticks = duration_ticks,
        strips         = strips,
        magic_circle   = magic_circle,
        gb_grid        = gb_grid,
    )
