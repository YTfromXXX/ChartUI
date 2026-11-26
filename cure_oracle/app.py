"""Cure-OS Flet app.

Usage
-----
    python -m cure_oracle.app           # desktop window
    flet run cure_oracle/app.py         # hot-reload mode
    python -m cure_oracle.app --web     # browser on :8550

Screens
-------
  HOME        — status dashboard (last benchmark + last round summary)
  BENCHMARK   — run SIG benchmark circuits, see TVD result
  ROUND       — MothBlast quantum randomness round
  BIRTH_CERT  — QPU birth certificate viewer
"""

from __future__ import annotations

import sys

try:
    import flet as ft
except ImportError:
    print("flet is not installed.  Run: pip install flet", file=sys.stderr)
    sys.exit(1)

from cure_oracle.app_state import (
    AppState, HOME, BENCHMARK, ROUND, BIRTH_CERT,
)

# ── design tokens ─────────────────────────────────────────────────────────────

_BG      = "#0a0a1a"
_SURFACE = "#111128"
_BORDER  = "#1e1e3f"
_ACCENT  = "#38c8f0"   # cyan
_PURPLE  = "#8b5cf6"
_WHITE   = "#e8e8ff"
_DIM     = "#5a5a7a"
_GREEN   = "#22c55e"
_RED     = "#ef4444"
_GOLD    = "#f59e0b"


def _card(content: ft.Control, padding: int = 16) -> ft.Container:
    return ft.Container(
        content=content,
        bgcolor=_SURFACE,
        border=ft.border.all(1, _BORDER),
        border_radius=8,
        padding=padding,
    )


def _title(text: str, size: int = 18, color: str = _WHITE) -> ft.Text:
    return ft.Text(text, size=size, weight=ft.FontWeight.BOLD, color=color)


def _label(text: str, color: str = _DIM) -> ft.Text:
    return ft.Text(text, size=11, color=color)


def _value(text: str, color: str = _WHITE, size: int = 13) -> ft.Text:
    return ft.Text(text, size=size, color=color, selectable=True)


def _status_dot(passed: bool | None) -> ft.Container:
    color = _GREEN if passed is True else (_RED if passed is False else _DIM)
    return ft.Container(width=10, height=10,
                        border_radius=5, bgcolor=color)


# ── nav rail ──────────────────────────────────────────────────────────────────

def _nav_rail(state: AppState, page: ft.Page) -> ft.NavigationRail:
    idx = {HOME: 0, BENCHMARK: 1, ROUND: 2, BIRTH_CERT: 3}
    views = [HOME, BENCHMARK, ROUND, BIRTH_CERT]

    def on_change(e: ft.ControlEvent) -> None:
        state.navigate(views[int(e.data)])

    return ft.NavigationRail(
        selected_index=idx.get(state.current_view, 0),
        label_type=ft.NavigationRailLabelType.ALL,
        bgcolor=_SURFACE,
        indicator_color=_PURPLE,
        destinations=[
            ft.NavigationRailDestination(
                icon=ft.Icons.DASHBOARD_OUTLINED,
                selected_icon=ft.Icons.DASHBOARD,
                label="ホーム",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.SCIENCE_OUTLINED,
                selected_icon=ft.Icons.SCIENCE,
                label="SIG",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.BOLT_OUTLINED,
                selected_icon=ft.Icons.BOLT,
                label="ラウンド",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.WORKSPACE_PREMIUM_OUTLINED,
                selected_icon=ft.Icons.WORKSPACE_PREMIUM,
                label="証明書",
            ),
        ],
        on_change=on_change,
    )


# ── HOME screen ───────────────────────────────────────────────────────────────

def _home_view(state: AppState) -> ft.Column:
    bm = state.benchmark
    ro = state.round

    bm_summary: ft.Control
    if bm.result:
        r = bm.result
        bm_summary = ft.Column([
            ft.Row([_status_dot(r["passed"]),
                    _value(f"  {r['shape']}  δ={r['delta']:.4f}  ({r['backend']})",
                           color=_GREEN if r["passed"] else _RED)]),
            _label(f"sig: {r['sig'] or '—'}"),
        ], spacing=4)
    elif bm.error:
        bm_summary = _value(bm.error, color=_RED)
    else:
        bm_summary = _value("まだ実行されていません", color=_DIM)

    ro_summary: ft.Control
    if ro.result:
        r2 = ro.result
        bstr = r2.get("guide_bits", "")[:8] + "…"
        bm_summary2 = ft.Column([
            _value(f"ラウンド {r2['round']}  ({r2['backend']})", color=_ACCENT),
            _label(f"bits: {bstr}  A:{r2.get('teleport_angle_a',0):.1f}°  "
                   f"B:{r2.get('teleport_angle_b',0):.1f}°"),
        ], spacing=4)
    elif ro.error:
        bm_summary2 = _value(ro.error, color=_RED)
    else:
        bm_summary2 = _value("まだ実行されていません", color=_DIM)

    cert_summary: ft.Control
    if state.cert.cert:
        c = state.cert.cert
        cert_summary = ft.Column([
            _value(c.get("certificate_id", "?"), color=_GOLD),
            _label(f"token: {c.get('game_token','?')}"),
        ], spacing=4)
    else:
        cert_summary = _value("誕生証明書なし", color=_DIM)

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.FAVORITE, color=_PURPLE, size=28),
            _title("Cure-OS  ダッシュボード", size=22),
        ], spacing=8),
        ft.Divider(color=_BORDER),

        ft.Row([
            ft.Expanded(_card(ft.Column([
                _title("SIG ベンチマーク", size=14, color=_ACCENT),
                ft.Container(height=6),
                bm_summary,
            ], spacing=4))),
            ft.Expanded(_card(ft.Column([
                _title("MothBlast ラウンド", size=14, color=_PURPLE),
                ft.Container(height=6),
                bm_summary2,
            ], spacing=4))),
            ft.Expanded(_card(ft.Column([
                _title("QPU 誕生証明書", size=14, color=_GOLD),
                ft.Container(height=6),
                cert_summary,
            ], spacing=4))),
        ], spacing=12),
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── BENCHMARK screen ──────────────────────────────────────────────────────────

def _benchmark_view(state: AppState, page: ft.Page) -> ft.Column:
    bm = state.benchmark

    shape_dd = ft.Dropdown(
        value=bm.shape,
        options=[ft.dropdown.Option(s) for s in
                 ("CUBE", "RING", "TREE", "LINE", "STAR")],
        label="SIG Shape", width=130,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    theta_dd = ft.Dropdown(
        value=bm.theta_disp,
        options=[ft.dropdown.Option(t) for t in ("φ.618", "π.785", "√.414")],
        label="θ_disp", width=120,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    shots_tf = ft.TextField(
        value=str(bm.shots), label="shots",
        width=100, keyboard_type=ft.KeyboardType.NUMBER,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    mode_dd = ft.Dropdown(
        value=bm.mode,
        options=[ft.dropdown.Option(m) for m in ("local", "fake", "ibm")],
        label="モード", width=110,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    run_btn = ft.ElevatedButton(
        "▶ 実行", bgcolor=_PURPLE, color=_WHITE,
        disabled=bm.running,
    )
    progress = ft.ProgressRing(visible=bm.running, color=_ACCENT, width=24, height=24)

    result_col = ft.Column(spacing=8)

    def _refresh_result() -> None:
        result_col.controls.clear()
        r = bm.result
        if r:
            passed_color = _GREEN if r["passed"] else _RED
            passed_text  = "✓ PASSED" if r["passed"] else "✗ NOT PASSED"
            result_col.controls += [
                ft.Divider(color=_BORDER),
                ft.Row([_status_dot(r["passed"]),
                        _title(f"  {passed_text}", color=passed_color)]),
                ft.Row([
                    ft.Column([_label("shape"), _value(r["shape"])], spacing=2),
                    ft.Column([_label("backend"), _value(r["backend"])], spacing=2),
                    ft.Column([_label("δ"), _value(f"{r['delta']:.6f}", color=passed_color)], spacing=2),
                    ft.Column([_label("ε"), _value(str(r["eps_threshold"]))], spacing=2),
                ], spacing=24),
                ft.Row([
                    ft.Column([_label("circuit"), _value(r["circuit_family"])], spacing=2),
                    ft.Column([_label("shots"), _value(str(r["shots"]))], spacing=2),
                    ft.Column([_label("θ_disp"), _value(r["theta_disp"])], spacing=2),
                ], spacing=24),
                _card(ft.Column([
                    _label("circuit hash"),
                    _value(r["circuit_hash"], color=_ACCENT, size=11),
                    _label(f"job_id: {r['job_id'] or '—'}   "
                           f"qpu_seconds: {r['qpu_seconds'] or '—'}"),
                ], spacing=4)),
            ]
            if r["sig"]:
                result_col.controls.append(
                    _card(ft.Row([
                        ft.Icon(ft.Icons.VERIFIED, color=_GOLD),
                        _value(f"SIG: {r['sig']}", color=_GOLD, size=14),
                    ], spacing=8))
                )
        elif bm.error:
            result_col.controls.append(_value(f"エラー: {bm.error}", color=_RED))
        progress.visible = bm.running
        run_btn.disabled = bm.running
        page.update()

    state.add_listener(_refresh_result)

    async def on_run(_: ft.ControlEvent) -> None:
        await state.run_benchmark(
            shape=shape_dd.value or "LINE",
            n_qubits=4,
            theta_disp=theta_dd.value or "√.414",
            shots=int(shots_tf.value or "4096"),
            mode=mode_dd.value or "local",
        )

    run_btn.on_click = on_run

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.SCIENCE, color=_ACCENT, size=24),
            _title("SIG ベンチマーク", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),

        _card(ft.Column([
            _title("回路設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([shape_dd, theta_dd, shots_tf, mode_dd], spacing=12, wrap=True),
            ft.Container(height=8),
            ft.Row([run_btn, progress], spacing=12),
        ], spacing=4)),

        result_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── ROUND screen ──────────────────────────────────────────────────────────────

def _round_view(state: AppState, page: ft.Page) -> ft.Column:
    ro = state.round

    round_tf = ft.TextField(
        value=str(ro.round_num), label="ラウンド番号",
        width=120, keyboard_type=ft.KeyboardType.NUMBER,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    shots_tf = ft.TextField(
        value="500", label="shots",
        width=100, keyboard_type=ft.KeyboardType.NUMBER,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    mode_dd = ft.Dropdown(
        value=ro.mode,
        options=[ft.dropdown.Option(m) for m in ("local", "fake", "ibm")],
        label="モード", width=110,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    run_btn = ft.ElevatedButton(
        "⚡ 量子ランダム生成", bgcolor=_PURPLE, color=_WHITE,
        disabled=ro.running,
    )
    progress = ft.ProgressRing(visible=ro.running, color=_ACCENT, width=24, height=24)

    preview_text = ft.Text(
        ro.preview or "",
        font_family="monospace", size=11, color=_ACCENT, selectable=True,
    )
    result_col = ft.Column(spacing=8)

    def _refresh() -> None:
        progress.visible = ro.running
        run_btn.disabled = ro.running
        preview_text.value = ro.preview or ""
        result_col.controls.clear()
        if ro.result:
            r = ro.result
            events = [k for k, v in r.get("events", {}).items() if v]
            result_col.controls += [
                ft.Divider(color=_BORDER),
                ft.Row([
                    ft.Column([_label("ラウンド"),
                               _value(str(r["round"]), color=_ACCENT)], spacing=2),
                    ft.Column([_label("バックエンド"),
                               _value(r["backend"])], spacing=2),
                    ft.Column([_label("A テレポート"),
                               _value(f"{r.get('teleport_angle_a',0):.2f}°",
                                      color=_PURPLE)], spacing=2),
                    ft.Column([_label("B テレポート"),
                               _value(f"{r.get('teleport_angle_b',0):.2f}°",
                                      color=_GOLD)], spacing=2),
                ], spacing=24),
                _label(f"イベント: {', '.join(events) if events else 'none'}"),
                _card(ft.Text(ro.preview or "",
                              font_family="monospace", size=11, color=_ACCENT,
                              selectable=True)),
            ]
        elif ro.error:
            result_col.controls.append(_value(f"エラー: {ro.error}", color=_RED))
        page.update()

    state.add_listener(_refresh)

    async def on_run(_: ft.ControlEvent) -> None:
        await state.run_round(
            round_num=int(round_tf.value or "1"),
            mode=mode_dd.value or "local",
            shots=int(shots_tf.value or "500"),
        )

    run_btn.on_click = on_run

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.BOLT, color=_PURPLE, size=24),
            _title("MothBlast  量子ランダム", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),

        _card(ft.Column([
            _title("ラウンド設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([round_tf, shots_tf, mode_dd], spacing=12, wrap=True),
            ft.Container(height=8),
            ft.Row([run_btn, progress], spacing=12),
        ], spacing=4)),

        result_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── BIRTH_CERT screen ─────────────────────────────────────────────────────────

def _cert_view(state: AppState, page: ft.Page) -> ft.Column:
    cs = state.cert

    path_tf = ft.TextField(
        value="cure_birth_certificate.json",
        label="証明書パス", expand=True,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    load_btn = ft.OutlinedButton("読み込む", icon=ft.Icons.FOLDER_OPEN)

    cert_col = ft.Column(spacing=8)

    def _refresh() -> None:
        cert_col.controls.clear()
        if cs.cert:
            c = cs.cert
            events = [k for k, v in c.get("events", {}).items() if v]
            cert_col.controls += [
                ft.Divider(color=_BORDER),
                ft.Row([
                    ft.Icon(ft.Icons.WORKSPACE_PREMIUM, color=_GOLD, size=28),
                    _title("量子ベイベー誕生証明書", color=_GOLD),
                ], spacing=8),
                ft.Row([
                    ft.Column([_label("Certificate ID"),
                               _value(c.get("certificate_id", "?"), color=_GOLD)], spacing=2),
                    ft.Column([_label("誕生日時"),
                               _value(c.get("born_at", "?"), color=_WHITE)], spacing=2),
                ], spacing=24),
                ft.Row([
                    ft.Column([_label("Game Token"),
                               _value(c.get("game_token", "?"), color=_PURPLE)], spacing=2),
                    ft.Column([_label("バックエンド"),
                               _value(c.get("backend", "?"))], spacing=2),
                ], spacing=24),
                ft.Row([
                    ft.Column([_label("産声 (bits)"),
                               _value(c.get("bitstring", "?"), color=_ACCENT)], spacing=2),
                    ft.Column([_label("スハル角"),
                               _value(f"{c.get('teleport_angle_a',0):.2f}°",
                                      color=_PURPLE)], spacing=2),
                    ft.Column([_label("リナリス角"),
                               _value(f"{c.get('teleport_angle_b',0):.2f}°",
                                      color=_GOLD)], spacing=2),
                ], spacing=24),
                _label(f"イベント: {', '.join(events) if events else 'none'}"),
            ]
            if cs.html_path:
                cert_col.controls.append(
                    _label(f"HTML証明書: {cs.html_path}")
                )
        elif cs.error:
            cert_col.controls.append(_value(cs.error, color=_RED))
        page.update()

    state.add_listener(_refresh)

    def on_load(_: ft.ControlEvent) -> None:
        state.load_cert(path_tf.value or "cure_birth_certificate.json")

    load_btn.on_click = on_load

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.WORKSPACE_PREMIUM, color=_GOLD, size=24),
            _title("QPU 誕生証明書", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),

        _card(ft.Row([path_tf, load_btn], spacing=12)),

        cert_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── root ──────────────────────────────────────────────────────────────────────

def _build_body(state: AppState, page: ft.Page) -> ft.Control:
    view = state.current_view
    if view == BENCHMARK:
        return _benchmark_view(state, page)
    if view == ROUND:
        return _round_view(state, page)
    if view == BIRTH_CERT:
        return _cert_view(state, page)
    return _home_view(state)


def main(page: ft.Page) -> None:
    page.title       = "Cure-OS"
    page.bgcolor     = _BG
    page.padding     = 0
    page.theme_mode  = ft.ThemeMode.DARK

    state = AppState()
    body  = ft.Container(expand=True, padding=24)

    def refresh() -> None:
        body.content = _build_body(state, page)
        page.update()

    state.add_listener(refresh)

    # initial render
    body.content = _build_body(state, page)
    page.add(ft.Row([
        _nav_rail(state, page),
        ft.VerticalDivider(width=1, color=_BORDER),
        body,
    ], expand=True, spacing=0))


if __name__ == "__main__":
    web = "--web" in sys.argv
    ft.app(target=main, port=8550 if web else None, view=ft.AppView.WEB_BROWSER if web else None)
