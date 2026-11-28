"""tests/backend/test_famidancer_score.py — FAMIDANCER'S Kit Scoring Engine tests.

cure-{era}-r12 companion — 24 tests in 2 classes:
  TestFamidancerScoreModule       (16) — unit tests for famidancer_score.py
  TestFamidancerScoreIntegration   (8) — bridge from Phase S/T + pipeline tests
"""

from __future__ import annotations

from typing import Iterator
from unittest.mock import MagicMock, patch

import pytest


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _patch_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CURE_API_TOKENS", "op:OPERATOR:testtoken123")


@pytest.fixture(autouse=True)
def _mock_qiskit() -> Iterator[None]:
    va_mock = MagicMock()
    va_mock.run.return_value = MagicMock(
        runs=[], synthesized=MagicMock(
            mente_total=1.5, mente_achieved=False, four_kings=False,
            missing_slots=[], slots={},
        ),
        observe_receipt={}, run_id="test-run-id",
        born_at="2026-01-01T00:00:00+00:00",
    )
    with (
        patch("cure_oracle.accelerator.VirtualAccelerator.run", va_mock.run),
        patch("cure_oracle.round_circuit.round_circuit", MagicMock(
            return_value={"result": "mocked", "era": "baroque"}
        )),
        patch("cure_oracle.round_circuit.spiral_preview", MagicMock(return_value="mock_b64")),
    ):
        yield


# ── helpers ───────────────────────────────────────────────────────────────────

def _moves(n: int = 3, offset: float = 5.0, diff: float = 8.0):
    from cure_oracle.famidancer_score import ScoredMove
    return [
        ScoredMove(f"move_{i}", beat_offset_ms=offset,
                   difficulty=diff, category="flow")
        for i in range(n)
    ]


def _hints(n: int = 3, visual: float = 8.0, crowd: float = 8.0, combo: int = 2):
    from cure_oracle.famidancer_score import ScoredHint
    return [
        ScoredHint(visual_impact=visual, crowd_energy=crowd,
                   expression_sync=8.0, combo_count=combo)
        for _ in range(n)
    ]


def _slots(label: str, scores: list[float]):
    from cure_oracle.famidancer_score import PlayerSlot5v5
    icons = ["[TUT]", "[ISO]", "[FRZ]", "[FLW]", "[PWR]"]
    return [
        PlayerSlot5v5(i, f"{label}{i+1}", icons[i % 5], "M",
                      is_active=(i == 0), slot_score=scores[i])
        for i in range(len(scores))
    ]


# ── TestFamidancerScoreModule ─────────────────────────────────────────────────

class TestFamidancerScoreModule:

    def test_current_rev_is_12(self):
        from cure_oracle.famidancer_score import CURRENT_REV
        assert CURRENT_REV == 12

    def test_battle_mode_returns_dict(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(), _hints()
        )
        assert isinstance(res, dict)
        assert res["mode"] == "battle"

    def test_ranking_mode_returns_dict(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.RANKING).evaluate_performance(
            _moves(), _hints()
        )
        assert res["mode"] == "ranking"

    def test_axes_10pt_has_5_keys(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(), _hints()
        )
        assert len(res["axes_10pt"]) == 5

    def test_rhythm_score_perfect_on_zero_offset(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(offset=0.0), _hints()
        )
        assert res["axes_10pt"]["rhythm_sync"] == pytest.approx(10.0)

    def test_rhythm_score_degrades_with_offset(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        eng = FamidancerScoreEngine(GameMode.BATTLE)
        r_good = eng.evaluate_performance(_moves(offset=0.0),  _hints())["axes_10pt"]["rhythm_sync"]
        r_bad  = eng.evaluate_performance(_moves(offset=30.0), _hints())["axes_10pt"]["rhythm_sync"]
        assert r_good > r_bad

    def test_famistyle_sig_boosts_difficulty(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode, ScoredMove, ScoredHint
        base = ScoredMove("x", 5.0, 8.0, "tutting", is_famistyle_sig=False)
        sig  = ScoredMove("x", 5.0, 8.0, "tutting", is_famistyle_sig=True)
        eng  = FamidancerScoreEngine(GameMode.BATTLE)
        r_base = eng.evaluate_performance([base], _hints(1))["axes_10pt"]["move_difficulty"]
        r_sig  = eng.evaluate_performance([sig],  _hints(1))["axes_10pt"]["move_difficulty"]
        assert r_sig > r_base

    def test_rank_grade_sss_at_max_score(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(offset=0.0, diff=10.0), _hints(visual=10.0, crowd=10.0, combo=10)
        )
        assert "SSS" in res["displays"]["4_rank_grade"]

    def test_rank_grade_c_at_low_score(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(offset=100.0, diff=1.0), _hints(visual=1.0, crowd=1.0, combo=0)
        )
        assert "C" in res["displays"]["4_rank_grade"]

    def test_arcade_pts_positive(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(), _hints()
        )
        assert "PTS" in res["displays"]["3_arcade_high_score"]
        pts = int(res["displays"]["3_arcade_high_score"].replace(",", "").replace(" PTS", ""))
        assert pts > 0

    def test_all_8_display_keys_present(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        d = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(), _hints()
        )["displays"]
        for key in ("1_standard_100pt", "2_radar_10pt_axes", "3_arcade_high_score",
                    "4_rank_grade", "5_star_rating", "6_percentage_sync",
                    "7_prediction_market", "8_rpg_training_growth"):
            assert key in d, f"missing display key: {key}"

    def test_score_capped_at_100(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(offset=0.0, diff=10.0), _hints(visual=10.0, crowd=10.0, combo=10),
            prediction_pool_ratio=1.0,
        )
        pts_str = res["displays"]["1_standard_100pt"]
        score = float(pts_str.split(" / ")[0])
        assert score <= 100.0

    def test_5v5_tug_of_war_sums_to_100(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        eng = FamidancerScoreEngine(GameMode.BATTLE)
        hud = eng.render_bottom_5v5_dance_diagram(
            _slots("A", [90.0, 85.0, 95.0, 88.0, 92.0]),
            _slots("B", [80.0, 82.0, 78.0, 84.0, 83.0]),
        )
        total = hud["tug_of_war_pct"]["team_a"] + hud["tug_of_war_pct"]["team_b"]
        assert abs(total - 100.0) < 0.01

    def test_5v5_hud_has_compact_text(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        eng = FamidancerScoreEngine(GameMode.BATTLE)
        hud = eng.render_bottom_5v5_dance_diagram(
            _slots("A", [90.0] * 5), _slots("B", [85.0] * 5)
        )
        assert "FAMISTYLE 5v5" in hud["compact_hud_text"]
        assert "TEAM A" in hud["compact_hud_text"]
        assert "TEAM B" in hud["compact_hud_text"]

    def test_active_slot_marked_with_asterisk(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        eng = FamidancerScoreEngine(GameMode.BATTLE)
        hud = eng.render_bottom_5v5_dance_diagram(
            _slots("A", [90.0] * 5), _slots("B", [85.0] * 5)
        )
        # slot_index 0 of A is is_active=True → surrounded by *
        assert "*[TUT]*" in hud["compact_hud_text"]

    def test_empty_moves_returns_empty_result(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance([], [])
        assert res["axes_10pt"] == {}
        assert res["displays"] == {}


# ── TestFamidancerScoreIntegration ────────────────────────────────────────────

class TestFamidancerScoreIntegration:

    def test_scored_move_from_phase_t_dance_move(self):
        from cure_oracle.famidancer_score import ScoredMove
        from cure_oracle.famidancer import DanceMove
        dm = DanceMove(
            move_name="full_spin", motion_class="peak", style="breakdance",
            step_pattern=["prep", "spin_L"], bpm_sync=140,
            energy_level=0.9, mirror_hint=False,
            hint_str="[soccer:full_spin:140]",
        )
        sm = ScoredMove.from_dance_move(dm, beat_offset_ms=3.0, is_famistyle_sig=True)
        assert sm.name == "full_spin"
        assert sm.difficulty > 0
        assert sm.is_famistyle_sig is True

    def test_scored_hint_from_phase_s_anim_hint(self):
        from cure_oracle.famidancer_score import ScoredHint
        from cure_oracle.sound_anim import AnimHint
        ah = AnimHint(
            label="goal_celebration", scene="soccer", confidence=87,
            motion_class="peak", intensity=0.92,
            hint_str="[soccer:goal_celebration:87]",
        )
        sh = ScoredHint.from_anim_hint(ah, combo_count=3)
        assert sh.combo_count == 3
        assert sh.visual_impact > 0
        assert sh.crowd_energy > 0

    def test_full_pipeline_battle(self):
        from cure_oracle.famidancer_score import (
            FamidancerScoreEngine, GameMode, ScoredMove, ScoredHint
        )
        moves = [ScoredMove("wave_slide", 6.0, 8.0, "flow", is_famistyle_sig=False)]
        hints = [ScoredHint(8.5, 8.0, 8.5, combo_count=2)]
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            moves, hints, prediction_pool_ratio=0.55
        )
        assert res["mode"] == "battle"
        assert res["displays"]["1_standard_100pt"].endswith("/ 100.00 pts")

    def test_full_pipeline_ranking_growth_coef(self):
        from cure_oracle.famidancer_score import (
            FamidancerScoreEngine, GameMode, ScoredMove, ScoredHint
        )
        moves = [ScoredMove("step_groove", 5.0, 7.0, "flow")]
        hints = [ScoredHint(7.0, 7.0, 7.0, combo_count=1)]
        eng = FamidancerScoreEngine(GameMode.RANKING)
        base  = float(eng.evaluate_performance(moves, hints, training_growth_coef=1.00)
                      ["displays"]["1_standard_100pt"].split(" / ")[0])
        boosted = float(eng.evaluate_performance(moves, hints, training_growth_coef=1.5)
                        ["displays"]["1_standard_100pt"].split(" / ")[0])
        assert boosted >= base

    def test_prediction_market_payout_above_1x(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(), _hints(), prediction_pool_ratio=0.4
        )
        odds_str = res["displays"]["7_prediction_market"]["payout_odds"]
        odds = float(odds_str.replace("x", ""))
        assert odds >= 1.0

    def test_rpg_exp_positive(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.RANKING).evaluate_performance(
            _moves(), _hints()
        )
        exp_str = res["displays"]["8_rpg_training_growth"]["gained_exp"]
        assert exp_str.startswith("+")
        assert int(exp_str.replace("+", "").replace(" EXP", "")) > 0

    def test_star_rating_format(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        res = FamidancerScoreEngine(GameMode.BATTLE).evaluate_performance(
            _moves(), _hints()
        )
        star_str = res["displays"]["5_star_rating"]
        assert "/5.0)" in star_str

    def test_5v5_grid_has_5_entries_per_team(self):
        from cure_oracle.famidancer_score import FamidancerScoreEngine, GameMode
        eng = FamidancerScoreEngine(GameMode.BATTLE)
        # Pass only 3 slots; engine should pad to 5
        hud = eng.render_bottom_5v5_dance_diagram(
            _slots("A", [90.0, 85.0, 95.0]),
            _slots("B", [80.0, 82.0, 78.0]),
        )
        assert len(hud["team_a_grid"]) == 5
        assert len(hud["team_b_grid"]) == 5
