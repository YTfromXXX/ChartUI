"""Tests for the MENTE screen in cure_oracle/app.py.

Flet is not installed in the CI environment, so we install a minimal
mock before importing the module under test.
"""

from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch, AsyncMock

import pytest


# ── Minimal Flet mock ─────────────────────────────────────────────────────────

def _make_ft_mock() -> types.ModuleType:
    ft = types.ModuleType("flet")

    # Controls: each call returns a fresh MagicMock so attribute assignment works
    for _name in (
        "Column", "Row", "Container", "Text", "Slider",
        "ProgressBar", "ProgressRing", "ElevatedButton", "OutlinedButton",
        "TextField", "Dropdown", "NavigationRail", "NavigationRailDestination",
        "VerticalDivider", "Divider", "Icon", "Expanded",
    ):
        setattr(ft, _name, MagicMock(side_effect=lambda *a, **kw: MagicMock()))

    # Enum-like namespaces
    for _ns in (
        "ScrollMode", "FontWeight", "CrossAxisAlignment",
        "NavigationRailLabelType", "ThemeMode", "KeyboardType", "AppView",
    ):
        setattr(ft, _ns, MagicMock())

    # ft.Icons.<anything> → plain string (safe for comparisons)
    class _Icons:
        def __getattr__(self, name: str) -> str:
            return name
    ft.Icons = _Icons()

    ft.border = MagicMock()
    ft.border.all = MagicMock(return_value=MagicMock())

    ft.dropdown = MagicMock()
    ft.dropdown.Option = MagicMock(side_effect=lambda *a, **kw: MagicMock())

    ft.app = MagicMock()
    ft.ControlEvent = MagicMock

    return ft


# Install mock before cure_oracle.app is ever imported
if "flet" not in sys.modules:
    sys.modules["flet"] = _make_ft_mock()

# Remove a stale real import if present (re-import with mock)
if "cure_oracle.app" in sys.modules:
    del sys.modules["cure_oracle.app"]

from cure_oracle.app import (       # noqa: E402
    _q_to_slot, _MENTE_CONST, _SLOT_LABELS,
    _mente_view, _nav_rail, _build_body, _home_view,
    _card, _title, _label, _value,
)
from cure_oracle.app_state import (  # noqa: E402
    AppState, HOME, BENCHMARK, ROUND, BIRTH_CERT, MENTE,
)


# ── TestQToSlot ───────────────────────────────────────────────────────────────

class TestQToSlot:
    def test_high_q_is_s4(self):
        assert _q_to_slot(0.80) == ("S4", "広目天")

    def test_boundary_075_is_s4(self):
        assert _q_to_slot(0.75) == ("S4", "広目天")

    def test_just_below_075_is_s1(self):
        assert _q_to_slot(0.74) == ("S1", "多聞天")

    def test_mid_q_is_s1(self):
        assert _q_to_slot(0.60) == ("S1", "多聞天")

    def test_boundary_050_is_s1(self):
        assert _q_to_slot(0.50) == ("S1", "多聞天")

    def test_just_below_050_is_s3(self):
        assert _q_to_slot(0.49) == ("S3", "持国天")

    def test_mid_low_q_is_s3(self):
        assert _q_to_slot(0.35) == ("S3", "持国天")

    def test_boundary_025_is_s3(self):
        assert _q_to_slot(0.25) == ("S3", "持国天")

    def test_just_below_025_is_s2(self):
        assert _q_to_slot(0.24) == ("S2", "増長天")

    def test_zero_q_is_s2(self):
        assert _q_to_slot(0.0) == ("S2", "増長天")

    def test_returns_tuple_of_two_strings(self):
        slot, king = _q_to_slot(0.5)
        assert isinstance(slot, str)
        assert isinstance(king, str)

    def test_all_four_q_ranges(self):
        results = {_q_to_slot(q)[0] for q in [0.80, 0.60, 0.35, 0.10]}
        assert results == {"S1", "S2", "S3", "S4"}


# ── TestMenteConst ────────────────────────────────────────────────────────────

class TestMenteConst:
    def test_mente_const_value(self):
        import math
        assert abs(_MENTE_CONST - 1.618 * math.sqrt(2)) < 1e-9

    def test_mente_const_approx(self):
        assert abs(_MENTE_CONST - 2.2882) < 0.001


# ── TestSlotLabels ────────────────────────────────────────────────────────────

class TestSlotLabels:
    def test_four_entries(self):
        assert len(_SLOT_LABELS) == 4

    def test_all_slots_present(self):
        slots = {row[1] for row in _SLOT_LABELS}
        assert slots == {"S1", "S2", "S3", "S4"}

    def test_all_kings_present(self):
        kings = {row[2] for row in _SLOT_LABELS}
        assert kings == {"多聞天", "増長天", "持国天", "広目天"}

    def test_each_row_has_three_elements(self):
        for row in _SLOT_LABELS:
            assert len(row) == 3


# ── TestMenteViewBuilds ───────────────────────────────────────────────────────

class TestMenteViewBuilds:
    def _page(self):
        p = MagicMock()
        p.update = MagicMock()
        return p

    def test_builds_without_exception(self):
        s = AppState()
        p = self._page()
        result = _mente_view(s, p)
        assert result is not None

    def test_registers_listener(self):
        s = AppState()
        p = self._page()
        before = len(s._listeners)
        _mente_view(s, p)
        assert len(s._listeners) == before + 1

    def test_listener_callable_on_notify(self):
        s = AppState()
        p = self._page()
        _mente_view(s, p)
        # _notify must not throw even with no check_result
        s._notify()

    def test_listener_fires_on_state_change(self):
        s = AppState()
        p = self._page()
        _mente_view(s, p)
        s.mente.mente_total = 2.5
        s.mente.mente_achieved = True
        s.mente.check_result = {
            "slots": [],
            "mente_total": 2.5,
            "mente_achieved": True,
            "mente_const": round(_MENTE_CONST, 6),
            "missing_kings": [],
        }
        s._notify()   # must not raise
        p.update.assert_called()

    def test_listener_fires_on_error(self):
        s = AppState()
        p = self._page()
        _mente_view(s, p)
        s.mente.error = "some error"
        s._notify()
        p.update.assert_called()

    def test_listener_handles_birth_result(self):
        s = AppState()
        p = self._page()
        _mente_view(s, p)
        s.mente.mente_achieved = True
        s.mente.check_result = {
            "slots": [{"label": "A", "slot": "S4", "king": "広目天",
                       "sig": "LINE-√.414-ε.010", "mente": 8.0,
                       "epsilon": 0.02, "shape": "LINE"}],
            "mente_total": 8.0,
            "mente_achieved": True,
            "mente_const": round(_MENTE_CONST, 6),
            "missing_kings": [],
        }
        s.mente.birth_result = {
            "cert": {"certificate_id": "CERT-M1"},
            "receipts": [{"merkle": "0xabc", "proof": []}],
            "cert_path": "/tmp/cert.json",
            "html_path": "/tmp/cert.html",
        }
        s._notify()
        p.update.assert_called()


# ── TestNavRailMente ──────────────────────────────────────────────────────────

class TestNavRailMente:
    def test_nav_rail_has_five_destinations(self):
        import flet as ft
        s = AppState()
        p = MagicMock()
        _nav_rail(s, p)
        # NavigationRail was called; check destinations kwarg length
        call_kwargs = ft.NavigationRail.call_args
        destinations = call_kwargs.kwargs.get("destinations", [])
        assert len(destinations) == 5

    def test_mente_view_in_navigation_index_map(self):
        # _nav_rail internally maps MENTE → index 4
        # Verify by calling navigate and checking the rail is built for MENTE
        import flet as ft
        s = AppState()
        s.navigate(MENTE)
        p = MagicMock()
        rail = _nav_rail(s, p)
        # selected_index kwarg should be 4
        call_kwargs = ft.NavigationRail.call_args
        assert call_kwargs.kwargs.get("selected_index") == 4


# ── TestBuildBodyMente ────────────────────────────────────────────────────────

class TestBuildBodyMente:
    def _page(self):
        p = MagicMock()
        p.update = MagicMock()
        return p

    def test_routes_mente_view_constant(self):
        s = AppState()
        s.navigate(MENTE)
        p = self._page()
        result = _build_body(s, p)
        assert result is not None

    def test_other_views_not_mente(self):
        p = self._page()
        for view in (HOME, BENCHMARK, ROUND, BIRTH_CERT):
            s = AppState()
            s.navigate(view)
            result = _build_body(s, p)
            assert result is not None


# ── TestHomeDashboardMente ────────────────────────────────────────────────────

class TestHomeDashboardMente:
    def test_home_view_builds_with_mente_state(self):
        s = AppState()
        result = _home_view(s)
        assert result is not None

    def test_home_view_builds_with_achieved_mente(self):
        s = AppState()
        s.mente.mente_total    = 21.5
        s.mente.mente_achieved = True
        s.mente.check_result   = {"mente_achieved": True}
        s.mente.missing_kings  = []
        result = _home_view(s)
        assert result is not None

    def test_home_view_builds_with_missing_kings(self):
        s = AppState()
        s.mente.mente_total    = 0.5
        s.mente.mente_achieved = False
        s.mente.check_result   = {"mente_achieved": False}
        s.mente.missing_kings  = ["S1", "S3", "S4"]
        result = _home_view(s)
        assert result is not None

    def test_home_view_builds_with_mente_error(self):
        s = AppState()
        s.mente.error = "QPU error"
        result = _home_view(s)
        assert result is not None
