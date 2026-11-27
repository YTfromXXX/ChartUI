"""Cure-OS Flet app.

Usage
-----
    python -m cure_oracle.app           # desktop window
    flet run cure_oracle/app.py         # hot-reload mode
    python -m cure_oracle.app --web     # browser on :8550

Screens
-------
  HOME        — status dashboard
  BENCHMARK   — SIG benchmark circuits
  ROUND       — MothBlast quantum randomness round
  BIRTH_CERT  — QPU birth certificate viewer
  MENTE       — MENTE 四天王全顕現 checker
  VERIFY      — sig-receipt/1 Merkle verification (B地点)
  MIDI_VIZ    — MIDI visualizer cure-{era}-r4 (B地点第七画面, Phase L)
"""

from __future__ import annotations

import platform
import sys

try:
    import flet as ft
except ImportError:
    print("flet is not installed.  Run: pip install flet", file=sys.stderr)
    sys.exit(1)

from cure_oracle.app_state import (
    AppState,
    HOME, BENCHMARK, ROUND, BIRTH_CERT, MENTE, VERIFY, MIDI_VIZ,
)

# ── B地点: 観察者OS識別 ────────────────────────────────────────────────────────

def _observer_info() -> dict:
    return {
        "role":    "observer",
        "device":  "pop_kivy_virtual_quantum",
        "system":  platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "python":  f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "ui":      "flet",
    }


# ── design tokens ─────────────────────────────────────────────────────────────

_MENTE_CONST = 1.618 * (2 ** 0.5)   # φ×√2 ≈ 2.2882

_BG      = "#0a0a1a"
_SURFACE = "#111128"
_BORDER  = "#1e1e3f"
_ACCENT  = "#38c8f0"
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
        border=ft.Border.all(1, _BORDER),
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
    return ft.Container(width=10, height=10, border_radius=5, bgcolor=color)


# ── nav rail ──────────────────────────────────────────────────────────────────

def _nav_rail(state: AppState, page: ft.Page) -> ft.NavigationRail:
    views = [HOME, BENCHMARK, ROUND, BIRTH_CERT, MENTE, VERIFY, MIDI_VIZ]
    idx   = {v: i for i, v in enumerate(views)}

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
            ft.NavigationRailDestination(
                icon=ft.Icons.AUTO_AWESOME_OUTLINED,
                selected_icon=ft.Icons.AUTO_AWESOME,
                label="MENTE",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.VERIFIED_OUTLINED,
                selected_icon=ft.Icons.VERIFIED,
                label="B地点検証",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.PIANO_OUTLINED,
                selected_icon=ft.Icons.PIANO,
                label="MIDI可視化",
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
        bstr = str(r2.get("guide_bits", ""))[:8] + "…"
        ro_summary = ft.Column([
            _value(f"ラウンド {r2['round']}  ({r2['backend']})", color=_ACCENT),
            _label(f"bits: {bstr}  A:{r2.get('teleport_angle_a',0):.1f}°  "
                   f"B:{r2.get('teleport_angle_b',0):.1f}°"),
        ], spacing=4)
    elif ro.error:
        ro_summary = _value(ro.error, color=_RED)
    else:
        ro_summary = _value("まだ実行されていません", color=_DIM)

    cert_summary: ft.Control
    if state.cert.cert:
        c = state.cert.cert
        cert_summary = ft.Column([
            _value(c.get("certificate_id", "?"), color=_GOLD),
            _label(f"token: {c.get('game_token','?')}"),
        ], spacing=4)
    else:
        cert_summary = _value("誕生証明書なし", color=_DIM)

    mn = state.mente
    mente_summary: ft.Control
    if mn.check_result:
        achieved = mn.mente_achieved
        icon = "⭐" if achieved else "◎"
        mente_summary = ft.Column([
            ft.Row([
                _value(f"{icon} {mn.mente_total:.4f}", color=_GOLD if achieved else _DIM),
                ft.Container(expand=True),
                _label("/ MENTE"),
            ], spacing=4),
            _label("四天王全顕現" if achieved else
                   f"不足: {', '.join(mn.missing_kings)}"),
        ], spacing=4)
    elif mn.error:
        mente_summary = _value(mn.error, color=_RED)
    else:
        mente_summary = _value("未チェック", color=_DIM)

    mv = state.midi_viz
    midi_summary: ft.Control
    if mv.current_frame:
        f = mv.current_frame
        midi_summary = ft.Column([
            _value(f"era: {f['era']}  BPM: {f['bpm']}", color=_ACCENT),
            _label(f"MENTE: {f['mente_total']:.4f}  notes: {f['note_count']}  "
                   f"frames: {len(mv.frames)}"),
        ], spacing=4)
    elif mv.error:
        midi_summary = _value(mv.error, color=_RED)
    else:
        midi_summary = _value("未実行", color=_DIM)

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
                ro_summary,
            ], spacing=4))),
            ft.Expanded(_card(ft.Column([
                _title("QPU 誕生証明書", size=14, color=_GOLD),
                ft.Container(height=6),
                cert_summary,
            ], spacing=4))),
            ft.Expanded(_card(ft.Column([
                _title("MENTE 四天王", size=14, color=_GOLD),
                ft.Container(height=6),
                mente_summary,
            ], spacing=4))),
            ft.Expanded(_card(ft.Column([
                _title("MIDI ビジュアライザ", size=14, color=_ACCENT),
                ft.Container(height=6),
                midi_summary,
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
    run_btn = ft.FilledButton(
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
                    ft.Column([_label("shape"),   _value(r["shape"])],   spacing=2),
                    ft.Column([_label("backend"),  _value(r["backend"])], spacing=2),
                    ft.Column([_label("δ"),        _value(f"{r['delta']:.6f}", color=passed_color)], spacing=2),
                    ft.Column([_label("ε"),        _value(str(r["eps_threshold"]))], spacing=2),
                ], spacing=24),
                ft.Row([
                    ft.Column([_label("circuit"), _value(r["circuit_family"])], spacing=2),
                    ft.Column([_label("shots"),   _value(str(r["shots"]))],      spacing=2),
                    ft.Column([_label("θ_disp"),  _value(r["theta_disp"])],      spacing=2),
                ], spacing=24),
                _card(ft.Column([
                    _label("circuit hash"),
                    _value(r["circuit_hash"], color=_ACCENT, size=11),
                    _label(f"job_id: {r['job_id'] or '—'}   qpu_seconds: {r['qpu_seconds'] or '—'}"),
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
    run_btn = ft.FilledButton(
        "⚡ 量子ランダム生成", bgcolor=_PURPLE, color=_WHITE,
        disabled=ro.running,
    )
    progress = ft.ProgressRing(visible=ro.running, color=_ACCENT, width=24, height=24)
    result_col = ft.Column(spacing=8)

    def _refresh() -> None:
        progress.visible = ro.running
        run_btn.disabled = ro.running
        result_col.controls.clear()
        if ro.result:
            r = ro.result
            events = [k for k, v in r.get("events", {}).items() if v]
            result_col.controls += [
                ft.Divider(color=_BORDER),
                ft.Row([
                    ft.Column([_label("ラウンド"),   _value(str(r["round"]), color=_ACCENT)],              spacing=2),
                    ft.Column([_label("バックエンド"), _value(r["backend"])],                               spacing=2),
                    ft.Column([_label("A テレポート"), _value(f"{r.get('teleport_angle_a',0):.2f}°", color=_PURPLE)], spacing=2),
                    ft.Column([_label("B テレポート"), _value(f"{r.get('teleport_angle_b',0):.2f}°", color=_GOLD)],   spacing=2),
                ], spacing=24),
                _label(f"イベント: {', '.join(events) if events else 'none'}"),
                _card(ft.Text(ro.preview or "", font_family="monospace",
                              size=11, color=_ACCENT, selectable=True)),
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
                    ft.Column([_label("Certificate ID"), _value(c.get("certificate_id", "?"), color=_GOLD)], spacing=2),
                    ft.Column([_label("誕生日時"),        _value(c.get("born_at", "?"))],                     spacing=2),
                ], spacing=24),
                ft.Row([
                    ft.Column([_label("Game Token"),   _value(c.get("game_token", "?"), color=_PURPLE)], spacing=2),
                    ft.Column([_label("バックエンド"), _value(c.get("backend", "?"))],                   spacing=2),
                ], spacing=24),
                _label(f"イベント: {', '.join(events) if events else 'none'}"),
            ]
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


# ── MENTE screen ──────────────────────────────────────────────────────────────

_SLOT_LABELS = [
    ("q ≥ 0.75", "S4", "広目天"),
    ("0.50 ≤ q < 0.75", "S1", "多聞天"),
    ("0.25 ≤ q < 0.50", "S3", "持国天"),
    ("q < 0.25", "S2", "増長天"),
]


def _q_to_slot(q: float) -> tuple[str, str]:
    if q >= 0.75:
        return "S4", "広目天"
    if q >= 0.50:
        return "S1", "多聞天"
    if q >= 0.25:
        return "S3", "持国天"
    return "S2", "増長天"


def _mente_view(state: AppState, page: ft.Page) -> ft.Column:
    ms = state.mente

    labels   = ["A", "B", "C", "D"]
    q_values: list[float] = [0.80, 0.60, 0.35, 0.10]

    slot_texts: list[ft.Text] = []
    sliders:    list[ft.Slider] = []
    q_disp:     list[ft.Text] = []

    for i, lbl in enumerate(labels):
        slot, king = _q_to_slot(q_values[i])
        slot_texts.append(ft.Text(f"{slot} {king}", size=12, color=_GOLD,
                                  weight=ft.FontWeight.BOLD))
        q_disp.append(ft.Text(f"q = {q_values[i]:.2f}", size=12, color=_WHITE))
        sliders.append(ft.Slider(
            value=q_values[i], min=0.0, max=1.0, divisions=100,
            active_color=_PURPLE, inactive_color=_BORDER, expand=True,
        ))

    def _make_slider_handler(idx: int):
        def on_change(e: ft.ControlEvent) -> None:
            q_values[idx] = round(float(e.control.value), 2)
            q_disp[idx].value = f"q = {q_values[idx]:.2f}"
            slot, king = _q_to_slot(q_values[idx])
            slot_texts[idx].value = f"{slot} {king}"
            total = sum(q * 10 for q in q_values)
            score_text.value = f"推定スコア  {total:.2f} / {_MENTE_CONST:.4f}"
            score_bar.value  = min(total / (_MENTE_CONST * 2), 1.0)
            page.update()
        return on_change

    for i, sl in enumerate(sliders):
        sl.on_change = _make_slider_handler(i)

    triangle_rows = ft.Column(spacing=8)
    for i, lbl in enumerate(labels):
        triangle_rows.controls.append(
            _card(ft.Row([
                ft.Text(f"△ {lbl}", size=14, color=_ACCENT,
                        weight=ft.FontWeight.BOLD, width=28),
                sliders[i],
                q_disp[i],
                ft.Container(width=12),
                slot_texts[i],
            ], spacing=8, vertical_alignment=ft.CrossAxisAlignment.CENTER))
        )

    init_total = sum(q * 10 for q in q_values)
    score_text = ft.Text(f"推定スコア  {init_total:.2f} / {_MENTE_CONST:.4f}",
                         size=13, color=_WHITE)
    score_bar  = ft.ProgressBar(value=min(init_total / (_MENTE_CONST * 2), 1.0),
                                 color=_PURPLE, bgcolor=_BORDER, expand=True)
    mente_const_label = ft.Text(f"MENTE閾値  φ×√2 = {_MENTE_CONST:.4f}",
                                 size=11, color=_DIM)

    check_btn = ft.FilledButton("🔮 MENTE チェック", bgcolor=_PURPLE, color=_WHITE,
                                disabled=ms.running)
    birth_btn = ft.FilledButton("⭐ 誕生証明書 発行", bgcolor=_GOLD, color="#0a0a1a",
                                visible=False)
    progress  = ft.ProgressRing(visible=ms.running, color=_ACCENT, width=24, height=24)
    result_col = ft.Column(spacing=8)

    def _refresh() -> None:
        check_btn.disabled = ms.running
        progress.visible   = ms.running
        result_col.controls.clear()

        if ms.error:
            result_col.controls.append(_value(f"エラー: {ms.error}", color=_RED))
            birth_btn.visible = False
            page.update()
            return

        cr = ms.check_result
        if not cr:
            page.update()
            return

        achieved = cr["mente_achieved"]
        total    = cr["mente_total"]
        score_text.value = f"MENTEスコア  {total:.4f} / {_MENTE_CONST:.4f}"
        score_bar.value  = min(total / (_MENTE_CONST * 2), 1.0)
        score_bar.color  = _GREEN if achieved else _PURPLE

        if achieved:
            result_col.controls.append(
                _card(ft.Row([
                    ft.Icon(ft.Icons.AUTO_AWESOME, color=_GOLD, size=28),
                    _title("四天王全顕現  MENTE 達成！", color=_GOLD, size=16),
                ], spacing=8), padding=20)
            )
        else:
            missing = cr.get("missing_kings", [])
            result_col.controls.append(
                _card(ft.Column([
                    _value("MENTE 未達成", color=_DIM),
                    _label(f"不足: {', '.join(missing) if missing else '—'}"),
                ], spacing=4))
            )

        slot_rows: list[ft.Control] = [
            ft.Row([
                ft.Container(_label("△"),      width=24),
                ft.Container(_label("スロット"), width=56),
                ft.Container(_label("天王"),    width=72),
                ft.Container(_label("MENTE"),   width=64),
                ft.Container(_label("ε"),       width=56),
                ft.Container(_label("SIG"),     expand=True),
            ], spacing=8),
            ft.Divider(color=_BORDER, height=1),
        ]
        for s in cr["slots"]:
            slot_rows.append(ft.Row([
                ft.Container(_value(s["label"], color=_ACCENT), width=24),
                ft.Container(_value(s["slot"],  color=_PURPLE), width=56),
                ft.Container(_value(s["king"],  color=_GOLD),   width=72),
                ft.Container(_value(f"{s['mente']:.4f}"),        width=64),
                ft.Container(_value(f"{s['epsilon']:.4f}"),      width=56),
                ft.Container(_value(s["sig"], size=11, color=_DIM), expand=True),
            ], spacing=8))
        result_col.controls.append(_card(ft.Column(slot_rows, spacing=4)))

        br = ms.birth_result
        if br:
            cert_id = br["cert"].get("certificate_id", "?")
            result_col.controls.append(
                _card(ft.Column([
                    ft.Row([ft.Icon(ft.Icons.WORKSPACE_PREMIUM, color=_GOLD),
                            _title("誕生証明書 発行済み", color=_GOLD)], spacing=8),
                    ft.Row([
                        ft.Column([_label("Certificate ID"), _value(cert_id, color=_GOLD)], spacing=2),
                        ft.Column([_label("SIG receipts"),   _value(str(len(br["receipts"])))], spacing=2),
                    ], spacing=24),
                    _label(f"保存先: {br['cert_path']}"),
                ], spacing=6), padding=20)
            )

        birth_btn.visible = achieved and (br is None) and (state.round.result is not None)
        page.update()

    state.add_listener(_refresh)

    async def on_check(_: ft.ControlEvent) -> None:
        tris = [{"q": q_values[i], "label": labels[i]} for i in range(4)]
        await state.run_mente(tris)

    async def on_birth(_: ft.ControlEvent) -> None:
        if state.round.result is None:
            return
        tris = [{"q": q_values[i], "label": labels[i]} for i in range(4)]
        await state.run_mente(tris, round_result=state.round.result)

    check_btn.on_click = on_check
    birth_btn.on_click = on_birth

    obs = _observer_info()
    _obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.DEVICE_HUB, color=_PURPLE, size=16),
        ft.Text(
            f"B地点 観察者OS  {obs['device']}  {obs['system']} {obs['release']}  Python {obs['python']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.AUTO_AWESOME, color=_GOLD, size=24),
            _title("MENTE  四天王全顕現", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),
        _obs_banner,
        _card(ft.Column([
            _title("四天王スロット早見表", size=12, color=_DIM),
            ft.Container(height=4),
            ft.Row([
                ft.Column([_label(cond), ft.Text(f"{slot} {king}", size=12, color=_GOLD,
                                                  weight=ft.FontWeight.BOLD)], spacing=2)
                for cond, slot, king in _SLOT_LABELS
            ], spacing=20, wrap=True),
        ], spacing=4)),
        _card(ft.Column([
            _title("三角形バッチ (A–D)", size=14, color=_DIM),
            ft.Container(height=4),
            triangle_rows,
        ], spacing=4)),
        _card(ft.Column([
            ft.Row([score_text, ft.Container(expand=True), mente_const_label]),
            ft.Container(height=4),
            score_bar,
        ], spacing=4)),
        ft.Row([check_btn, birth_btn, progress], spacing=12),
        result_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── VERIFY screen ─────────────────────────────────────────────────────────────

def _verify_view(state: AppState, page: ft.Page) -> ft.Column:
    vs = state.verify
    _GOLD_V   = "#ffd166"
    _GREEN_V  = "#39ff9b"
    _RED_V    = "#ff4c6a"
    _PURPLE_V = "#b66fff"

    def _on_fetch(_e: ft.ControlEvent) -> None:
        import asyncio as _aio
        from cure_oracle.qpu_router import _build_observe_receipt, _OSInfo
        import platform as _plat, sys as _sys
        point_a = _OSInfo(
            system=_plat.system(), release=_plat.release(),
            machine=_plat.machine(),
            python=f"{_sys.version_info.major}.{_sys.version_info.minor}.{_sys.version_info.micro}",
            role="quantum_state",
        )
        from cure_oracle.mente import MENTE_CONST as _MC
        receipt = _build_observe_receipt(point_a, _MC)
        _aio.ensure_future(state.run_verify(receipt))

    if vs.running:
        status_row: ft.Control = ft.Row([
            ft.ProgressRing(width=18, height=18, stroke_width=2),
            _label("検証中…"),
        ], spacing=8)
    elif vs.error:
        status_row = ft.Row([_status_dot(False),
                             _label(f"エラー: {vs.error}", color=_RED_V)], spacing=8)
    elif vs.proof_ok is not None:
        both_ok   = vs.proof_ok and vs.sig_ok
        status_row = ft.Row([
            _status_dot(both_ok),
            _label("検証成功" if both_ok else "検証失敗",
                   color=_GREEN_V if both_ok else _RED_V),
        ], spacing=8)
    else:
        status_row = _label("「レシートを取得」をタップして Cure-OS A地点を検証", color=_DIM)

    result_rows: list[ft.Control] = []
    if vs.receipt:
        merkle = vs.receipt.get("merkle", {})
        proof  = vs.receipt.get("proof",  {})
        for lbl, val in [
            ("バージョン",       vs.receipt.get("version", "—")),
            ("SIG コード",       vs.receipt.get("sig", "—")),
            ("Merkle root",      (merkle.get("root", "—"))[:20] + "…"),
            ("証明パス長",       str(len(proof.get("path", [])))),
            ("証明インデックス", str(proof.get("index", "—"))),
            ("Proof 検証", "✓ OK" if vs.proof_ok else ("✗ NG" if vs.proof_ok is not None else "—")),
            ("SIG 検証",   "✓ OK" if vs.sig_ok  else ("✗ NG" if vs.sig_ok  is not None else "—")),
        ]:
            result_rows.append(ft.Row([_label(lbl, color=_DIM), ft.Expanded(_value(val))], spacing=8))

    result_col = _card(ft.Column(result_rows or [_label("—")], spacing=8)) if result_rows else ft.Container()

    fetch_btn  = ft.FilledButton("レシートを取得・検証", on_click=_on_fetch, disabled=vs.running)
    obs_banner = _card(ft.Column([
        _title("PopKivyDevice-OS  B地点", size=13),
        _label("sig-receipt/1 Keccak-256 Merkle 検証", color=_PURPLE_V),
        _label("CUBE-φ.618-ε.001  |  四天王座標系 φ×√2", color=_GOLD_V),
    ], spacing=4), padding=10)

    return ft.Column([
        obs_banner,
        _title("Cure-OS A地点 → B地点 レシート検証"),
        status_row,
        ft.Row([fetch_btn], spacing=12),
        result_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── MIDI_VIZ screen: B地点第七画面 ───────────────────────────────────────────

_CH_COLORS = [_ACCENT, _PURPLE, _GOLD, _DIM]


def _midi_viz_view(state: AppState, page: ft.Page) -> ft.Column:
    """Phase L — cure-{era}-r4 MIDI visualizer (B地点第七画面).

    Displays the MIDI piano-roll output of the Gemini-Candy ⟷ Sonnet-Score
    quantum-sim fusion loop in real-time.  Receives SSE frames from
    GET /candy/quantum-sim/stream and renders 4 channel lanes.
    """
    mv = state.midi_viz

    shapes_tf = ft.TextField(
        value=",".join(mv.shapes), label="形状 (カンマ区切り)",
        width=200, bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    bars_dd = ft.Dropdown(
        value="4",
        options=[ft.dropdown.Option(str(b)) for b in (2, 4, 8, 16)],
        label="バー数", width=100,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    run_btn  = ft.FilledButton("▶ 量子シム実行", bgcolor=_PURPLE, color=_WHITE,
                               disabled=mv.running)
    progress = ft.ProgressRing(visible=mv.running, color=_ACCENT, width=24, height=24)

    channel_rows = ft.Column(spacing=6)
    result_col   = ft.Column(spacing=8)

    def _refresh() -> None:
        run_btn.disabled = mv.running
        progress.visible = mv.running
        channel_rows.controls.clear()
        result_col.controls.clear()

        if mv.error:
            result_col.controls.append(_value(f"エラー: {mv.error}", color=_RED))
            page.update()
            return

        frame = mv.current_frame
        if not frame:
            page.update()
            return

        result_col.controls += [
            ft.Divider(color=_BORDER),
            ft.Row([
                ft.Column([_label("era"),    _value(frame["era"], color=_GOLD)],     spacing=2),
                ft.Column([_label("BPM"),    _value(str(frame["bpm"]), color=_ACCENT)], spacing=2),
                ft.Column([_label("MENTE"),  _value(
                    f"{frame['mente_total']:.4f}",
                    color=_GREEN if frame["mente_achieved"] else _WHITE)], spacing=2),
                ft.Column([_label("フレーム数"), _value(str(len(mv.frames)))], spacing=2),
                ft.Column([_label("ノート数"),   _value(str(frame["note_count"]))], spacing=2),
            ], spacing=24),
        ]

        note = frame.get("fusion_note", "")
        result_col.controls.append(_label(f"融合: {note[:72]}{'…' if len(note) > 72 else ''}"))

        for ch in frame.get("channels", []):
            ch_color = _CH_COLORS[ch["index"]]
            bar_val  = min(ch["note_count"] / max(frame["note_count"], 1), 1.0)
            channel_rows.controls.append(
                _card(ft.Row([
                    ft.Text(ch["name"], size=12, color=ch_color,
                            weight=ft.FontWeight.BOLD, width=72),
                    ft.ProgressBar(value=bar_val, color=ch_color, bgcolor=_BORDER, width=120),
                    ft.Container(width=8),
                    _label(
                        f"×{ch['note_count']}  vel={ch['avg_velocity']:.0f}",
                        color=ch_color if ch["active"] else _DIM,
                    ),
                ], spacing=8, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                padding=8)
            )

        page.update()

    state.add_listener(_refresh)

    async def on_run(_: ft.ControlEvent) -> None:
        shapes = [s.strip().upper() for s in shapes_tf.value.split(",") if s.strip()]
        if not shapes:
            shapes = ["LINE"]
        await state.run_midi_viz(shapes=shapes, bars=int(bars_dd.value or "4"))

    run_btn.on_click = on_run

    obs = _observer_info()
    obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.PIANO, color=_ACCENT, size=16),
        ft.Text(
            f"B地点 MIDI ビジュアライザ  cure-{{era}}-r4  480 PPQN  "
            f"SSE→Flet  {obs['system']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.PIANO, color=_ACCENT, size=24),
            _title("MIDI ビジュアライザ  cure-{era}-r4", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),
        obs_banner,

        _card(ft.Column([
            _title("シミュレーション設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([shapes_tf, bars_dd], spacing=12, wrap=True),
            ft.Container(height=8),
            ft.Row([run_btn, progress], spacing=12),
        ], spacing=4)),

        _card(ft.Column([
            _title("MIDI チャンネル活性化  (480 PPQN)", size=12, color=_DIM),
            ft.Container(height=4),
            channel_rows,
        ], spacing=4)),

        result_col,
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
    if view == MENTE:
        return _mente_view(state, page)
    if view == VERIFY:
        return _verify_view(state, page)
    if view == MIDI_VIZ:
        return _midi_viz_view(state, page)
    return _home_view(state)


def main(page: ft.Page) -> None:
    page.title      = "Cure-OS"
    page.bgcolor    = _BG
    page.padding    = 0
    page.theme_mode = ft.ThemeMode.DARK

    state = AppState()
    body  = ft.Container(expand=True, padding=24)

    def refresh() -> None:
        body.content = _build_body(state, page)
        page.update()

    state.add_listener(refresh)
    body.content = _build_body(state, page)
    page.add(ft.Row([
        _nav_rail(state, page),
        ft.VerticalDivider(width=1, color=_BORDER),
        body,
    ], expand=True, spacing=0))


if __name__ == "__main__":
    web = "--web" in sys.argv
    if hasattr(ft, "run"):
        ft.run(main, port=8550 if web else 0,
               view=ft.AppView.WEB_BROWSER if web else ft.AppView.FLET_APP)
    else:
        ft.app(target=main, port=8550 if web else None,
               view=ft.AppView.WEB_BROWSER if web else None)
