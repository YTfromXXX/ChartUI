"""cure_oracle/famidancer_score.py — FAMIDANCER'S Kit: Scoring Engine.

CURRENT_REV = 12 — B地点第十五画面 (Phase T companion)

International standard 5-axis dance scoring (WDSF / HipHop / Street Battle).
Bridges Phase S AnimHint + Phase T DanceMove into multi-format score output.

5 Scoring Axes (weights sum to 1.0)
-------------------------------------
  rhythm_sync    0.30  — beat timing precision, syncopation hits, freeze accuracy
  move_difficulty 0.25 — isolation, wave, floorwork, rotation complexity + FAMISTYLE bonus
  visual_appeal  0.20  — expression, visual impact, LED/camera sync, song atmosphere
  crowd_hype     0.15  — audience energy; ×1.25 anthem multiplier (Sandstorm zone etc.)
  combo_flow     0.10  — unbroken move chain bonus

8 Display Formats
------------------
  1  100-point standard             94.73 / 100.00 pts
  2  5-axis radar (10pt each)       rhythm:9.2/10 …
  3  arcade high score              823,000 PTS
  4  rank grade                     SS (MASTER)
  5  star rating                    ★★★★☆ (4.5/5.0)
  6  percentage sync                94.7%
  7  prediction market              supporter_share / payout_odds
  8  RPG training growth            +EXP / stat_deltas

Game Modes
-----------
  BATTLE  — street scoring: prediction market × 5v5 bottom HUD × tug-of-war gauge
  RANKING — showcase scoring: hybrid training growth × sequential measurement
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# ── constants ─────────────────────────────────────────────────────────────────

CURRENT_REV: int = 12

SCORE_CONFIG = {
    "weights": {
        "rhythm_sync":      0.30,
        "move_difficulty":  0.25,
        "visual_appeal":    0.20,
        "crowd_hype":       0.15,
        "combo_flow":       0.10,
    },
    "battle_mode": {
        "performance_style": "alternating_then_sync",
        "judge_system": {
            "ai_judges":          3,
            "crowd_vote_weight":  0.2,
        },
        "display_format": "percentage_tug_of_war",
    },
    "ranking_mode": {
        "measurement_order":        "sequential",
        "time_limit_sec":           60,
        "anthem_boost_multiplier":  1.25,
        "display_format":           "100_point_breakdown",
    },
}

# Move category → difficulty modifier
_CATEGORY_MOD: dict[str, float] = {
    "isolation": 1.00,
    "tutting":   1.05,
    "power":     1.10,
    "flow":      1.00,
    "freeze":    1.15,
}

# Rank grade thresholds
_RANK_TABLE: list[tuple[float, str]] = [
    (96.0, "SSS (FAMISTYLE LEGEND)"),
    (90.0, "SS (MASTER)"),
    (80.0, "S (EXCELLENT)"),
    (70.0, "A (GROOVE)"),
    (60.0, "B (GOOD)"),
    ( 0.0, "C (ROOKIE)"),
]

# Phase T DanceMove → score category mapping
_STYLE_TO_CATEGORY: dict[str, str] = {
    "breakdance":   "power",
    "hiphop":       "flow",
    "freeStyle":    "flow",
    "contemporary": "isolation",
    "capoeira":     "power",
    "idle":         "flow",
}


# ── dataclasses ───────────────────────────────────────────────────────────────

class GameMode(Enum):
    BATTLE  = "battle"    # street scoring: prediction market × 5v5 HUD
    RANKING = "ranking"   # showcase scoring: hybrid training × sequential


@dataclass
class ScoredMove:
    """Score-specific performance data for one move unit.

    Bridges from Phase T DanceMove via ScoredMove.from_dance_move().
    """
    name:              str
    beat_offset_ms:    float    # deviation from beat (ms); 0 = perfect
    difficulty:        float    # 1.0 … 10.0
    category:          str      # "isolation" / "tutting" / "power" / "flow" / "freeze"
    is_famistyle_sig:  bool = False   # FAMISTYLE signature move bonus

    @classmethod
    def from_dance_move(
        cls,
        dance_move,                      # cure_oracle.famidancer.DanceMove
        *,
        beat_offset_ms: float = 5.0,
        is_famistyle_sig: bool = False,
    ) -> "ScoredMove":
        """Bridge Phase T DanceMove → ScoredMove."""
        from cure_oracle.famidancer import DanceMove  # local import to avoid circular
        difficulty_map = {
            "full_spin":        9.0,  "jump_sequence":    8.5,
            "wave_slide":       8.0,  "body_roll":        7.5,
            "step_groove":      6.5,  "shoulder_bounce":  6.0,
            "freeze_hold":      8.8,  "slow_isolation":   8.0,
            "idle_sway":        4.0,
            "dodge_step":       8.5,  "impact_drop":      9.2,
            "micro_isolate":    8.3,  "formation_step":   7.0,
        }
        cat = _STYLE_TO_CATEGORY.get(
            dance_move.style if hasattr(dance_move, "style") else "flow", "flow"
        )
        diff = difficulty_map.get(
            dance_move.move_name if hasattr(dance_move, "move_name") else "", 7.0
        )
        return cls(
            name=getattr(dance_move, "move_name", "unknown"),
            beat_offset_ms=beat_offset_ms,
            difficulty=diff,
            category=cat,
            is_famistyle_sig=is_famistyle_sig,
        )


@dataclass
class ScoredHint:
    """Score-specific visual/crowd data.

    Bridges from Phase S AnimHint via ScoredHint.from_anim_hint().
    """
    visual_impact:   float   # 1.0 … 10.0  (camera/LED appeal)
    crowd_energy:    float   # 1.0 … 10.0  (audience hype)
    expression_sync: float   # 1.0 … 10.0  (face, song atmosphere)
    combo_count:     int     # consecutive successful moves

    @classmethod
    def from_anim_hint(
        cls,
        anim_hint,              # cure_oracle.sound_anim.AnimHint
        *,
        combo_count: int = 1,
    ) -> "ScoredHint":
        """Bridge Phase S AnimHint → ScoredHint."""
        intensity = getattr(anim_hint, "intensity", 0.5)
        confidence = getattr(anim_hint, "confidence", 50)
        return cls(
            visual_impact=round(min(10.0, intensity * 10.0), 2),
            crowd_energy=round(min(10.0, confidence / 10.0), 2),
            expression_sync=round(min(10.0, (intensity + confidence / 100.0) * 5.0), 2),
            combo_count=combo_count,
        )


@dataclass
class PlayerSlot5v5:
    """One cell of the bottom 5v5 compact dance formation grid."""
    slot_index:  int
    player_name: str
    move_icon:   str    # e.g. "[TUT]" "[FRZ]" "[WAV]" "[PWR]" "[---]"
    stance_code: str    # "L"(Low) / "M"(Mid) / "H"(High) / "A"(Air)
    is_active:   bool  = False
    slot_score:  float = 0.0


# ── scoring engine ────────────────────────────────────────────────────────────

class FamidancerScoreEngine:
    """FAMIDANCER'S Kit unified scoring engine.

    Battle Mode  (street):   prediction market odds × 5v5 HUD × tug-of-war
    Ranking Mode (showcase): hybrid training stats × multi-format score output
    """

    WEIGHTS = SCORE_CONFIG["weights"]
    MOVE_ICON_MAP = {
        "isolation": "[ISO]",
        "tutting":   "[TUT]",
        "power":     "[PWR]",
        "flow":      "[FLW]",
        "freeze":    "[FRZ]",
    }

    def __init__(self, mode: GameMode):
        self.mode = mode

    # ── main evaluator ────────────────────────────────────────────────────────

    def evaluate_performance(
        self,
        moves: list[ScoredMove],
        hints: list[ScoredHint],
        prediction_pool_ratio: float = 0.50,  # Battle: supporter share [0,1]
        training_growth_coef:  float = 1.00,  # Ranking: stat multiplier [1.0,1.5]
    ) -> dict:
        """Compute all score formats from ScoredMove + ScoredHint lists.

        Returns
        -------
        {mode, axes_10pt, displays}
        """
        if not moves or not hints:
            return self._empty_result()

        # 1. Five-axis raw scores (each 0.0 … 10.0) ───────────────────────────
        rhythm_scores = [
            max(0.0, 10.0 - abs(m.beat_offset_ms) / 15.0) for m in moves
        ]
        diff_scores = [
            min(10.0,
                m.difficulty
                * _CATEGORY_MOD.get(m.category, 1.0)
                * (1.15 if m.is_famistyle_sig else 1.0)
            )
            for m in moves
        ]
        visual_scores = [
            min(10.0, h.visual_impact * 0.6 + h.expression_sync * 0.4)
            for h in hints
        ]
        crowd_scores  = [min(10.0, h.crowd_energy) for h in hints]
        max_combo     = max(h.combo_count for h in hints)
        combo_score   = min(10.0, (max_combo / max(len(moves), 1)) * 10.0)

        axes_10pt = {
            "rhythm_sync":      round(sum(rhythm_scores) / len(rhythm_scores), 2),
            "move_difficulty":  round(sum(diff_scores)   / len(diff_scores),   2),
            "visual_appeal":    round(sum(visual_scores) / len(visual_scores),  2),
            "crowd_hype":       round(sum(crowd_scores)  / len(crowd_scores),   2),
            "combo_flow":       round(combo_score, 2),
        }

        # 2. Weighted base score 0.0 … 100.0 ─────────────────────────────────
        raw_100 = sum(axes_10pt[k] * self.WEIGHTS[k] * 10.0 for k in self.WEIGHTS)

        if self.mode == GameMode.BATTLE:
            # prediction market FAMISTYLE resonance bonus
            mode_multiplier = 1.0 + prediction_pool_ratio * 0.15
        else:
            # hybrid training stat growth multiplier
            mode_multiplier = training_growth_coef

        final_100 = min(100.0, round(raw_100 * mode_multiplier, 2))

        # 3. Multi-format display generation ──────────────────────────────────
        displays = self._build_displays(
            final_100=final_100,
            axes_10pt=axes_10pt,
            max_combo=max_combo,
            move_count=len(moves),
            prediction_pool_ratio=prediction_pool_ratio,
        )

        return {"mode": self.mode.value, "axes_10pt": axes_10pt, "displays": displays}

    # ── display builder ───────────────────────────────────────────────────────

    def _build_displays(
        self,
        final_100:            float,
        axes_10pt:            dict,
        max_combo:            int,
        move_count:           int,
        prediction_pool_ratio: float,
    ) -> dict:
        """Generate all 8 UI/broadcast display formats."""

        # ① 100-point standard
        score_100pt = f"{final_100:.2f} / 100.00 pts"

        # ② 5-axis radar (10pt each)
        radar_5axes = {k: f"{v:.1f}/10" for k, v in axes_10pt.items()}

        # ③ Arcade high score (blue-sky combo bonus)
        arcade_pts = int(
            final_100 * 8_500 + max_combo * 12_500 + move_count * 3_000
        )

        # ④ Rank grade
        rank_grade = "C (ROOKIE)"
        for threshold, label in _RANK_TABLE:
            if final_100 >= threshold:
                rank_grade = label
                break

        # ⑤ Star rating (5★, 0.5 steps)
        stars = round((final_100 / 100.0) * 10) / 2
        full  = int(stars)
        half  = stars % 1 >= 0.5
        star_visual = "★" * full + ("☆" if half else "")
        star_str    = f"{star_visual} ({stars:.1f}/5.0)"

        # ⑥ Percentage sync
        hype_pct = f"{round(final_100, 1)}%"

        # ⑦ Prediction market (Battle)
        market_odds = round(1.0 / max(0.05, prediction_pool_ratio), 2)

        # ⑧ RPG training growth (Ranking)
        gained_exp = int(final_100 * 12 + max_combo * 25)
        stat_deltas = {
            "TECH":     round(axes_10pt["move_difficulty"] * 0.8, 1),
            "GROOVE":   round(axes_10pt["rhythm_sync"]     * 0.9, 1),
            "CHARISMA": round(axes_10pt["visual_appeal"]   * 0.85, 1),
        }

        return {
            "1_standard_100pt":      score_100pt,
            "2_radar_10pt_axes":     radar_5axes,
            "3_arcade_high_score":   f"{arcade_pts:,} PTS",
            "4_rank_grade":          rank_grade,
            "5_star_rating":         star_str,
            "6_percentage_sync":     hype_pct,
            "7_prediction_market": {
                "supporter_share": f"{round(prediction_pool_ratio * 100, 1)}%",
                "payout_odds":     f"{market_odds:.2f}x",
            },
            "8_rpg_training_growth": {
                "gained_exp":  f"+{gained_exp} EXP",
                "stat_deltas": stat_deltas,
            },
        }

    # ── 5v5 bottom HUD ────────────────────────────────────────────────────────

    def render_bottom_5v5_dance_diagram(
        self,
        team_a_slots: list[PlayerSlot5v5],
        team_b_slots: list[PlayerSlot5v5],
    ) -> dict:
        """Battle bottom HUD: 5-slot vs 5-slot compact dance formation grid.

        Returns structured JSON for frontend rendering + compact ASCII for CLI/debug.
        """
        def _pad5(slots: list[PlayerSlot5v5], label: str) -> list[PlayerSlot5v5]:
            result = list(slots[:5])
            while len(result) < 5:
                i = len(result)
                result.append(PlayerSlot5v5(i, f"{label}{i+1}", "[---]", "M"))
            return result

        a5 = _pad5(team_a_slots, "A")
        b5 = _pad5(team_b_slots, "B")

        sum_a = sum(s.slot_score for s in a5)
        sum_b = sum(s.slot_score for s in b5)
        total = max(1.0, sum_a + sum_b)
        pct_a = round(sum_a / total * 100, 1)
        pct_b = round(100.0 - pct_a, 1)

        def _row_icons(slots: list[PlayerSlot5v5]) -> str:
            return " ".join(
                f"*{s.move_icon}*" if s.is_active else f" {s.move_icon} "
                for s in slots
            )

        def _row_stance(slots: list[PlayerSlot5v5]) -> str:
            return " ".join(f"  ({s.stance_code})  " for s in slots)

        sep = "-" * 70
        hud = "\n".join([
            f"=== [FAMISTYLE 5v5]  TEAM A {pct_a}%  <== VS ==>  {pct_b}% TEAM B ===",
            f"TEAM A (FAMISTYLE) : {_row_icons(a5)}",
            f"STANCE / HEIGHT    : {_row_stance(a5)}",
            sep,
            f"TEAM B (CHALLENGER): {_row_icons(b5)}",
            f"STANCE / HEIGHT    : {_row_stance(b5)}",
        ])

        return {
            "tug_of_war_pct": {"team_a": pct_a, "team_b": pct_b},
            "team_a_grid":    [vars(s) for s in a5],
            "team_b_grid":    [vars(s) for s in b5],
            "compact_hud_text": hud,
        }

    # ── helpers ───────────────────────────────────────────────────────────────

    def _empty_result(self) -> dict:
        return {"mode": self.mode.value, "axes_10pt": {}, "displays": {}}


# ── smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample_moves = [
        ScoredMove("King Tut Lock",    beat_offset_ms=4.5,  difficulty=8.8, category="tutting", is_famistyle_sig=True),
        ScoredMove("Wave Isolation",   beat_offset_ms=-8.0, difficulty=8.2, category="isolation"),
        ScoredMove("Sandstorm Freeze", beat_offset_ms=2.0,  difficulty=9.5, category="freeze",  is_famistyle_sig=True),
    ]
    sample_hints = [
        ScoredHint(visual_impact=9.0, crowd_energy=8.5, expression_sync=8.8, combo_count=1),
        ScoredHint(visual_impact=8.6, crowd_energy=9.0, expression_sync=8.7, combo_count=2),
        ScoredHint(visual_impact=9.6, crowd_energy=9.8, expression_sync=9.5, combo_count=3),
    ]

    engine = FamidancerScoreEngine(mode=GameMode.BATTLE)
    result = engine.evaluate_performance(sample_moves, sample_hints, prediction_pool_ratio=0.64)
    print("【BATTLE MODE RESULT】")
    for k, v in result["displays"].items():
        print(f"  {k}: {v}")

    team_a = [
        PlayerSlot5v5(0, "A1", "[TUT]", "H", is_active=True,  slot_score=94.2),
        PlayerSlot5v5(1, "A2", "[ISO]", "M", is_active=False, slot_score=88.5),
        PlayerSlot5v5(2, "A3", "[FRZ]", "L", is_active=True,  slot_score=96.0),
        PlayerSlot5v5(3, "A4", "[FLW]", "M", is_active=False, slot_score=85.0),
        PlayerSlot5v5(4, "A5", "[PWR]", "A", is_active=False, slot_score=91.3),
    ]
    team_b = [
        PlayerSlot5v5(0, "B1", "[PWR]", "H", is_active=False, slot_score=89.0),
        PlayerSlot5v5(1, "B2", "[FLW]", "M", is_active=True,  slot_score=90.5),
        PlayerSlot5v5(2, "B3", "[TUT]", "M", is_active=False, slot_score=84.2),
        PlayerSlot5v5(3, "B4", "[ISO]", "L", is_active=False, slot_score=86.8),
        PlayerSlot5v5(4, "B5", "[FRZ]", "L", is_active=True,  slot_score=92.1),
    ]
    hud = engine.render_bottom_5v5_dance_diagram(team_a, team_b)
    print("\n" + hud["compact_hud_text"])
