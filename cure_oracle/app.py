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
  MIDI_VIZ      — MIDI visualizer cure-{era}-r4 (B地点第七画面, Phase L)
  RESONANCE_VIZ — Resonance Max-Cut × MIDI fusion cure-{era}-r5 (B地点第八画面, Phase M)
  EXPORT_VIZ    — MIDI Format 0 export cure-{era}-r6 (B地点第九画面, Phase N)
  SCORE_REPLAY  — Score Replay & Piano-Roll History cure-{era}-r7 (B地点第十画面, Phase O)
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
    HOME, BENCHMARK, ROUND, BIRTH_CERT, MENTE, VERIFY,
    MIDI_VIZ, RESONANCE_VIZ, EXPORT_VIZ, SCORE_REPLAY, PUNCHCARD, KNOT_SCORE, CURE_BMI,
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
    views = [HOME, BENCHMARK, ROUND, BIRTH_CERT, MENTE, VERIFY,
             MIDI_VIZ, RESONANCE_VIZ, EXPORT_VIZ, SCORE_REPLAY, PUNCHCARD, KNOT_SCORE,
             CURE_BMI]
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
            ft.NavigationRailDestination(
                icon=ft.Icons.HUB_OUTLINED,
                selected_icon=ft.Icons.HUB,
                label="共鳴スコア",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.MUSIC_NOTE_OUTLINED,
                selected_icon=ft.Icons.MUSIC_NOTE,
                label="MIDI出力",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.QUEUE_MUSIC_OUTLINED,
                selected_icon=ft.Icons.QUEUE_MUSIC,
                label="スコア再生",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.CASINO_OUTLINED,
                selected_icon=ft.Icons.CASINO,
                label="パンチカード",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.PIANO_OUTLINED,
                selected_icon=ft.Icons.PIANO,
                label="結び目スコア",
            ),
            ft.NavigationRailDestination(
                icon=ft.Icons.PSYCHOLOGY_OUTLINED,
                selected_icon=ft.Icons.PSYCHOLOGY,
                label="Cure-BMI",
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


# ── RESONANCE_VIZ screen: B地点第八画面 ──────────────────────────────────────

_COIN_COLORS: list[str] = ["#f7931a", "#627eea", "#9945ff", "#00aae4", "#3cc8c8", "#c3a634"]


def _resonance_view(state: AppState, page: ft.Page) -> ft.Column:
    """Phase M — cure-{era}-r5 Resonance Max-Cut × MIDI fusion (B地点第八画面).

    Displays the Resonance Max-Cut partition (6 coins / 4 MIDI channels) and
    cut-value score produced by the quantum-sim + resonance pipeline.
    Receives SSE frames from GET /candy/resonance/stream.
    """
    rv = state.resonance_viz

    shapes_tf = ft.TextField(
        value=",".join(rv.shapes), label="形状 (カンマ区切り)",
        width=200, bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    bars_dd = ft.Dropdown(
        value="4",
        options=[ft.dropdown.Option(str(b)) for b in (2, 4, 8, 16)],
        label="バー数", width=100,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    run_btn  = ft.FilledButton("▶ 共鳴シム実行", bgcolor=_PURPLE, color=_WHITE,
                               disabled=rv.running)
    progress = ft.ProgressRing(visible=rv.running, color=_ACCENT, width=24, height=24)

    partition_row = ft.Row(spacing=12, wrap=True)
    channel_rows  = ft.Column(spacing=6)
    result_col    = ft.Column(spacing=8)

    def _refresh() -> None:
        run_btn.disabled  = rv.running
        progress.visible  = rv.running
        partition_row.controls.clear()
        channel_rows.controls.clear()
        result_col.controls.clear()

        if rv.error:
            result_col.controls.append(_value(f"エラー: {rv.error}", color=_RED))
            page.update()
            return

        frame = rv.current_frame
        if not frame:
            page.update()
            return

        result_col.controls += [
            ft.Divider(color=_BORDER),
            ft.Row([
                ft.Column([_label("era"),        _value(frame["era"], color=_GOLD)],     spacing=2),
                ft.Column([_label("BPM"),         _value(str(frame["bpm"]), color=_ACCENT)], spacing=2),
                ft.Column([_label("MENTE"),        _value(
                    f"{frame['mente_total']:.4f}",
                    color=_GREEN if frame["mente_achieved"] else _WHITE)], spacing=2),
                ft.Column([_label("Max-Cut"),      _value(
                    f"{frame['cut_value']:.4f}", color=_GOLD)], spacing=2),
                ft.Column([_label("フレーム数"),   _value(str(len(rv.frames)))], spacing=2),
            ], spacing=24),
        ]

        # partition display
        p0 = frame.get("partition_0", [])
        p1 = frame.get("partition_1", [])
        coin_labels_all = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"]
        for label in coin_labels_all:
            group = 0 if label in p0 else 1
            color = _ACCENT if group == 0 else _PURPLE
            partition_row.controls.append(_card(
                ft.Column([
                    ft.Text(label, size=13, color=color, weight=ft.FontWeight.BOLD),
                    _label(f"G{group}", color=color),
                ], spacing=2, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                padding=8,
            ))

        note = frame.get("fusion_note", "")
        result_col.controls.append(
            _label(f"融合: {note[:72]}{'…' if len(note) > 72 else ''}")
        )

        for ch in frame.get("channels", []):
            ch_color = _CH_COLORS[ch["index"]]
            coins_str = ", ".join(ch["coin_labels"]) if ch["coin_labels"] else "—"
            cw = ch.get("cut_weight", 0.0)
            channel_rows.controls.append(
                _card(ft.Row([
                    ft.Text(ch["name"], size=12, color=ch_color,
                            weight=ft.FontWeight.BOLD, width=72),
                    ft.ProgressBar(
                        value=min(cw / 4.0, 1.0) if cw else 0.0,
                        color=ch_color, bgcolor=_BORDER, width=120,
                    ),
                    ft.Container(width=8),
                    _label(
                        f"{coins_str}  wt={cw:.3f}  vel={ch['avg_velocity']:.0f}",
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
        await state.run_resonance(shapes=shapes, bars=int(bars_dd.value or "4"))

    run_btn.on_click = on_run

    obs = _observer_info()
    obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.HUB, color=_ACCENT, size=16),
        ft.Text(
            f"B地点 共鳴スコア  cure-{{era}}-r5  Max-Cut QAOA × MIDI  "
            f"SSE→Flet  {obs['system']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.HUB, color=_ACCENT, size=24),
            _title("共鳴スコア  cure-{era}-r5", size=20),
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
            _title("Max-Cut パーティション (6コイン)", size=12, color=_DIM),
            ft.Container(height=4),
            partition_row,
        ], spacing=4)),

        _card(ft.Column([
            _title("MIDI チャンネル重み  (cure-{era}-r5)", size=12, color=_DIM),
            ft.Container(height=4),
            channel_rows,
        ], spacing=4)),

        result_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── EXPORT_VIZ screen: B地点第九画面 ─────────────────────────────────────────

_SOURCE_LABELS = {"midi_viz": "MIDI可視化 (r4)", "resonance": "共鳴スコア (r5)"}


def _export_view(state: AppState, page: ft.Page) -> ft.Column:
    """Phase N — cure-{era}-r6 MIDI Export (B地点第九画面).

    Runs quantum-sim + frame builder + MIDI Format 0 writer and displays
    metadata for the resulting .mid file.  POST /candy/export/midi provides
    the same bytes over HTTP.
    """
    ev = state.export_viz

    shapes_tf = ft.TextField(
        value=",".join(ev.shapes), label="形状 (カンマ区切り)",
        width=200, bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    bars_dd = ft.Dropdown(
        value="4",
        options=[ft.dropdown.Option(str(b)) for b in (2, 4, 8, 16)],
        label="バー数", width=100,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    source_dd = ft.Dropdown(
        value=ev.source,
        options=[
            ft.dropdown.Option("midi_viz",   "MIDI可視化 (r4)"),
            ft.dropdown.Option("resonance",  "共鳴スコア (r5)"),
        ],
        label="ソース", width=180,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    export_btn = ft.FilledButton("▶ MIDI エクスポート", bgcolor=_PURPLE, color=_WHITE,
                                 disabled=ev.running)
    progress   = ft.ProgressRing(visible=ev.running, color=_ACCENT, width=24, height=24)
    result_col = ft.Column(spacing=8)

    def _refresh() -> None:
        export_btn.disabled = ev.running
        progress.visible    = ev.running
        result_col.controls.clear()

        if ev.error:
            result_col.controls.append(_value(f"エラー: {ev.error}", color=_RED))
            page.update()
            return

        if not ev.last_export:
            page.update()
            return

        ex = ev.last_export
        result_col.controls += [
            ft.Divider(color=_BORDER),
            ft.Row([
                ft.Column([_label("era"),        _value(ex["era"], color=_GOLD)],     spacing=2),
                ft.Column([_label("BPM"),         _value(str(ex["bpm"]), color=_ACCENT)], spacing=2),
                ft.Column([_label("PPQN"),         _value(str(ex["ppqn"]), color=_WHITE)], spacing=2),
                ft.Column([_label("バー"),         _value(str(ex["bars"]), color=_WHITE)], spacing=2),
                ft.Column([_label("イベント数"),   _value(str(ex["event_count"]), color=_WHITE)], spacing=2),
                ft.Column([_label("長さ (秒)"),    _value(f"{ex['duration_seconds']:.2f}s", color=_WHITE)], spacing=2),
                ft.Column([_label("ファイルサイズ"), _value(f"{ex['file_size_bytes']} B", color=_WHITE)], spacing=2),
            ], spacing=20, wrap=True),
            _card(ft.Column([
                ft.Row([
                    ft.Icon(ft.Icons.CHECK_CIRCLE, color=_GREEN, size=18),
                    _title("MIDI Format 0  生成完了", color=_GREEN, size=14),
                ], spacing=8),
                _label(f"export_id: {ex['export_id']}"),
                _label(f"version:   {ex['version']}"),
                _label(f"source:    {_SOURCE_LABELS.get(ex['source'], ex['source'])}"),
                _label(f"born_at:   {ex['born_at'][:19]}"),
            ], spacing=4), padding=16),
        ]
        page.update()

    state.add_listener(_refresh)

    async def on_export(_: ft.ControlEvent) -> None:
        shapes = [s.strip().upper() for s in shapes_tf.value.split(",") if s.strip()]
        if not shapes:
            shapes = ["LINE"]
        src = source_dd.value or "midi_viz"
        await state.run_export(shapes=shapes, source=src, bars=int(bars_dd.value or "4"))

    export_btn.on_click = on_export

    obs = _observer_info()
    obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.MUSIC_NOTE, color=_ACCENT, size=16),
        ft.Text(
            f"B地点 MIDI Export  cure-{{era}}-r6  Format 0  struct  480 PPQN  "
            f"{obs['system']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.MUSIC_NOTE, color=_ACCENT, size=24),
            _title("MIDI Export  cure-{era}-r6", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),
        obs_banner,

        _card(ft.Column([
            _title("エクスポート設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([shapes_tf, bars_dd, source_dd], spacing=12, wrap=True),
            ft.Container(height=8),
            ft.Row([export_btn, progress], spacing=12),
        ], spacing=4)),

        _card(ft.Column([
            _title("エンドポイント", size=12, color=_DIM),
            _label("POST /api/v1/qpu/candy/export/midi  → audio/midi bytes"),
        ], spacing=4)),

        result_col,
    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── SCORE_REPLAY screen: B地点第十画面 ───────────────────────────────────────

_NOTE_NAMES_SHORT = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_CH_REPLAY_COLORS = [_ACCENT, _PURPLE, _GOLD, _GREEN]


def _score_replay_view(state: AppState, page: ft.Page) -> ft.Column:
    """Phase O — cure-{era}-r7 Score Replay & Piano-Roll History (B地点第十画面).

    Runs export pipeline and renders a piano-roll grid (bar × pitch_class)
    with per-channel coloring, plus a scrollable note-event list.
    Keeps a history of the last 10 frames selectable by index.
    """
    sr = state.score_replay

    shapes_tf = ft.TextField(
        value="LINE", label="形状 (カンマ区切り)",
        width=200, bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    bars_dd = ft.Dropdown(
        value="4",
        options=[ft.dropdown.Option(str(b)) for b in (2, 4, 8, 16)],
        label="バー数", width=100,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    source_dd = ft.Dropdown(
        value=sr.source,
        options=[
            ft.dropdown.Option("midi_viz",  "MIDI可視化 (r4)"),
            ft.dropdown.Option("resonance", "共鳴スコア (r5)"),
        ],
        label="ソース", width=180,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    replay_btn = ft.FilledButton("▶ スコア生成", bgcolor=_PURPLE, color=_WHITE,
                                 disabled=sr.running)
    progress   = ft.ProgressRing(visible=sr.running, color=_ACCENT, width=24, height=24)

    piano_grid  = ft.Column(spacing=2)
    notes_col   = ft.Column(spacing=4)
    history_row = ft.Row(spacing=8, wrap=True)
    result_col  = ft.Column(spacing=8)

    def _build_piano_grid(cells: list[dict], bars: int) -> None:
        piano_grid.controls.clear()
        if not cells:
            piano_grid.controls.append(_label("ノートなし", color=_DIM))
            return

        # Header: bar indices
        hdr_cells: list[ft.Control] = [ft.Container(width=32)]
        for b in range(bars):
            hdr_cells.append(ft.Container(
                content=ft.Text(str(b + 1), size=10, color=_DIM,
                                text_align=ft.TextAlign.CENTER),
                width=28,
            ))
        piano_grid.controls.append(ft.Row(hdr_cells, spacing=2))

        # Row per pitch_class (descending: B=11 → C=0)
        cell_map = {(c["bar"], c["pitch_class"]): c for c in cells}
        for pc in range(11, -1, -1):
            row_cells: list[ft.Control] = [
                ft.Container(
                    content=ft.Text(_NOTE_NAMES_SHORT[pc], size=10, color=_DIM),
                    width=32, alignment=ft.alignment.center_right,
                )
            ]
            for b in range(bars):
                c = cell_map.get((b, pc))
                if c:
                    ch_color = _CH_REPLAY_COLORS[c["channel"] % 4]
                    alpha = max(0.3, c["velocity"] / 127.0)
                    cell_ctrl = ft.Container(
                        bgcolor=ch_color,
                        width=26, height=14,
                        border_radius=2,
                        opacity=alpha,
                        tooltip=f"{_NOTE_NAMES_SHORT[pc]}{c['octave']}  "
                                f"vel={c['velocity']}  ch={c['channel']}",
                    )
                else:
                    cell_ctrl = ft.Container(
                        bgcolor=_BORDER,
                        width=26, height=14,
                        border_radius=2,
                    )
                row_cells.append(cell_ctrl)
            piano_grid.controls.append(ft.Row(row_cells, spacing=2))

    def _refresh() -> None:
        replay_btn.disabled = sr.running
        progress.visible    = sr.running
        piano_grid.controls.clear()
        notes_col.controls.clear()
        history_row.controls.clear()
        result_col.controls.clear()

        if sr.error:
            result_col.controls.append(_value(f"エラー: {sr.error}", color=_RED))
            page.update()
            return

        frame = sr.current_frame
        if not frame:
            page.update()
            return

        result_col.controls += [
            ft.Divider(color=_BORDER),
            ft.Row([
                ft.Column([_label("era"),        _value(frame["era"], color=_GOLD)],     spacing=2),
                ft.Column([_label("BPM"),         _value(str(frame["bpm"]), color=_ACCENT)], spacing=2),
                ft.Column([_label("ノート数"),    _value(str(frame["event_count"]), color=_WHITE)], spacing=2),
                ft.Column([_label("長さ (秒)"),   _value(f"{frame['duration_seconds']:.2f}s", color=_WHITE)], spacing=2),
                ft.Column([_label("履歴"),        _value(f"{len(sr.history)} / 10", color=_WHITE)], spacing=2),
            ], spacing=20),
        ]

        _build_piano_grid(frame.get("piano_roll", []), bars=frame.get("bars", 4))

        for n in frame.get("notes", [])[:20]:
            ch_color = _CH_REPLAY_COLORS[n["channel"] % 4]
            notes_col.controls.append(ft.Row([
                ft.Container(_value(n["label"], color=ch_color), width=40),
                ft.Container(_label(f"ch{n['channel']}"), width=32),
                ft.Container(_label(f"t={n['tick']}"), width=64),
                ft.Container(_label(f"vel={n['velocity']}"), width=56),
                ft.Container(_label(f"dur={n['duration_ticks']}"), width=64),
            ], spacing=4))

        for i, h in enumerate(reversed(sr.history)):
            is_current = h["frame_id"] == frame["frame_id"]
            history_row.controls.append(_card(
                ft.Column([
                    ft.Text(f"#{len(sr.history) - i}", size=11,
                            color=_ACCENT if is_current else _DIM,
                            weight=ft.FontWeight.BOLD),
                    _label(h["era"][:6], color=_GOLD if is_current else _DIM),
                    _label(f"{h['event_count']}n", color=_DIM),
                ], spacing=2, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                padding=6,
            ))

        page.update()

    state.add_listener(_refresh)

    async def on_replay(_: ft.ControlEvent) -> None:
        shapes = [s.strip().upper() for s in shapes_tf.value.split(",") if s.strip()]
        if not shapes:
            shapes = ["LINE"]
        src = source_dd.value or "midi_viz"
        await state.run_score_replay(shapes=shapes, source=src,
                                     bars=int(bars_dd.value or "4"))

    replay_btn.on_click = on_replay

    obs = _observer_info()
    obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.QUEUE_MUSIC, color=_ACCENT, size=16),
        ft.Text(
            f"B地点 スコア再生  cure-{{era}}-r7  MIDI piano-roll  history×10  "
            f"{obs['system']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.QUEUE_MUSIC, color=_ACCENT, size=24),
            _title("スコア再生  cure-{era}-r7", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),
        obs_banner,

        _card(ft.Column([
            _title("シミュレーション設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([shapes_tf, bars_dd, source_dd], spacing=12, wrap=True),
            ft.Container(height=8),
            ft.Row([replay_btn, progress], spacing=12),
        ], spacing=4)),

        result_col,

        _card(ft.Column([
            _title("ピアノロール  (bar × pitch)", size=12, color=_DIM),
            ft.Container(height=4),
            ft.Row([
                ft.Container(_card(ft.Row([
                    ft.Container(bgcolor=_CH_REPLAY_COLORS[i], width=12, height=12,
                                 border_radius=2),
                    _label(["大甲音", "甲音", "呂音", "呂音-bass"][i]),
                ], spacing=4), padding=4))
                for i in range(4)
            ], spacing=8, wrap=True),
            ft.Container(height=4),
            ft.SingleChildScrollView(
                content=piano_grid,
                scroll_direction=ft.ScrollMode.HORIZONTAL,
            ),
        ], spacing=4)),

        _card(ft.Column([
            _title("ノートイベント (先頭20件)", size=12, color=_DIM),
            ft.Container(height=4),
            notes_col,
        ], spacing=4)),

        _card(ft.Column([
            _title("履歴バッファ (最新10フレーム)", size=12, color=_DIM),
            ft.Container(height=4),
            history_row,
        ], spacing=4)),

    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── PUNCHCARD screen: B地点第十一画面 ────────────────────────────────────────

_PUNCH_ON  = "#38c8f0"   # punched cell: cyan
_PUNCH_OFF = "#1a1a3a"   # blank cell: dark navy

_GRID_COLORS = {
    "A_dyn": "#38c8f0",   # dynamic A: cyan
    "B_dyn": "#8b5cf6",   # dynamic B: purple
    "A_sta": "#f59e0b",   # static A: gold
    "B_sta": "#22c55e",   # static B: green
}


def _punch_grid(bits: list[list[int]], key: str, label: str) -> ft.Control:
    """Render an 8×16 punchcard grid as a card."""
    on_color = _GRID_COLORS.get(key, _PUNCH_ON)
    rows: list[ft.Control] = []
    for tr in range(8):
        cells: list[ft.Control] = []
        for step in range(16):
            bit = bits[tr][step] if tr < len(bits) and step < len(bits[tr]) else 0
            cells.append(ft.Container(
                bgcolor=on_color if bit else _PUNCH_OFF,
                width=14, height=10, border_radius=1,
                opacity=0.9 if bit else 0.3,
            ))
        rows.append(ft.Row(cells, spacing=2))
    return _card(ft.Column([
        _title(label, size=11, color=_DIM),
        ft.Container(height=4),
        ft.Column(rows, spacing=2),
    ], spacing=4), padding=10)


def _punchcard_view(state: AppState, page: ft.Page) -> ft.Column:
    """Phase P — cure-{era}-r8 串刺し螺旋サイコロ × Punchcard Engine (B地点第十一画面).

    Displays 2 octahedra (D₁, D₂) rotating on horizontal axis u=(1,0,0)
    with quaternion-derived helix trajectories, plus:
      - Dynamic Punchcard A (8×16): |v'_1,i.y| > φ⁻¹ gate
      - Dynamic Punchcard B (8×16): |Θ₂−Θ₁| mod π < threshold
      - Static Punchcard A (8×16): 50-byte claim record bitmap
      - Static Punchcard B (8×16): selective disclosure mask
    """
    pc = state.punchcard

    shapes_tf = ft.TextField(
        value="LINE", label="形状 (カンマ区切り)",
        width=200, bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    bars_dd = ft.Dropdown(
        value="4",
        options=[ft.dropdown.Option(str(b)) for b in (2, 4, 8, 16)],
        label="バー数", width=100,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    epsilon_tf = ft.TextField(
        value="0.019", label="ε_disp",
        width=90, keyboard_type=ft.KeyboardType.NUMBER,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    run_btn  = ft.FilledButton("▶ パンチカード生成", bgcolor=_PURPLE, color=_WHITE,
                               disabled=pc.running)
    progress = ft.ProgressRing(visible=pc.running, color=_ACCENT, width=24, height=24)

    grids_row  = ft.Row(spacing=12, wrap=True)
    params_col = ft.Column(spacing=8)
    result_col = ft.Column(spacing=8)

    def _refresh() -> None:
        run_btn.disabled = pc.running
        progress.visible = pc.running
        grids_row.controls.clear()
        params_col.controls.clear()
        result_col.controls.clear()

        if pc.error:
            result_col.controls.append(_value(f"エラー: {pc.error}", color=_RED))
            page.update()
            return

        frame = pc.current_frame
        if not frame:
            page.update()
            return

        result_col.controls += [
            ft.Divider(color=_BORDER),
            ft.Row([
                ft.Column([_label("era"),           _value(frame["era"], color=_GOLD)],     spacing=2),
                ft.Column([_label("θ_q"),            _value(f"{frame['theta_q']:.4f}", color=_ACCENT)], spacing=2),
                ft.Column([_label("θ_disp_mode"),   _value(frame["theta_disp_mode"], color=_PURPLE)], spacing=2),
                ft.Column([_label("ε_disp"),         _value(f"{frame['epsilon_perturbation']:.3f}", color=_WHITE)], spacing=2),
                ft.Column([_label("R_helix"),         _value(f"{frame['helix_radius']:.3f}", color=_WHITE)], spacing=2),
                ft.Column([_label("MENTE"),           _value(f"{frame['mente_total']:.4f}", color=_WHITE)], spacing=2),
                ft.Column([_label("shape"),           _value(frame["shape"], color=_GOLD)], spacing=2),
            ], spacing=20, wrap=True),
        ]

        da = frame.get("dynamic_a")
        db = frame.get("dynamic_b")
        sa = frame.get("static_a")
        sb = frame.get("static_b")

        if da:
            grids_row.controls.append(
                _punch_grid(da["bits"], "A_dyn", "Dynamic A — |v'₁ᵢ.y| > φ⁻¹")
            )
        if db:
            grids_row.controls.append(
                _punch_grid(db["bits"], "B_dyn", "Dynamic B — |Θ₂−Θ₁| mod π < ε_track")
            )
        if sa:
            claim = sa.get("claim_record", "")
            grids_row.controls.append(
                _punch_grid(sa["bits"], "A_sta", f"Static A — {claim[:20]}")
            )
        if sb:
            merkle = sb.get("merkle_root", "")
            grids_row.controls.append(
                _punch_grid(sb["bits"], "B_sta", f"Static B — Merkle {merkle[2:10]}…")
            )

        if sa:
            params_col.controls += [
                ft.Divider(color=_BORDER),
                _card(ft.Column([
                    _title("Claim Record (50 bytes)", size=12, color=_DIM),
                    _value(sa.get("claim_record", ""), color=_GOLD),
                    _label(sa.get("claim_record_hex", "")[:48] + "…", color=_DIM),
                    ft.Container(height=4),
                    _title("Merkle Root (SHA-256)", size=12, color=_DIM),
                    _value(sa.get("merkle_root", "")[2:34] + "…", color=_ACCENT, size=11),
                ], spacing=4), padding=12),
            ]
        if sb:
            mask = sb.get("disclosure_mask", {})
            mask_row = ft.Row([
                _card(ft.Column([
                    _label(k, color=_GREEN if v else _DIM),
                    ft.Text("OPEN" if v else "SHLD", size=10,
                            color=_GREEN if v else _DIM,
                            weight=ft.FontWeight.BOLD),
                ], spacing=2, horizontal_alignment=ft.CrossAxisAlignment.CENTER), padding=4)
                for k, v in mask.items()
            ], spacing=6, wrap=True)
            params_col.controls.append(_card(ft.Column([
                _title("開示マスク", size=12, color=_DIM),
                ft.Container(height=4),
                mask_row,
            ], spacing=4), padding=12))

        page.update()

    state.add_listener(_refresh)

    async def on_run(_: ft.ControlEvent) -> None:
        shapes = [s.strip().upper() for s in shapes_tf.value.split(",") if s.strip()]
        if not shapes:
            shapes = ["LINE"]
        try:
            eps = float(epsilon_tf.value or "0.019")
        except ValueError:
            eps = 0.019
        await state.run_punchcard(shapes=shapes, bars=int(bars_dd.value or "4"), epsilon=eps)

    run_btn.on_click = on_run

    obs = _observer_info()
    obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.CASINO, color=_PURPLE, size=16),
        ft.Text(
            f"B地点 串刺し螺旋サイコロ  cure-{{era}}-r8  正八面体×2  quaternion×x軸  "
            f"{obs['system']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.CASINO, color=_PURPLE, size=24),
            _title("パンチカード  cure-{era}-r8", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),
        obs_banner,

        _card(ft.Column([
            _title("シミュレーション設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([shapes_tf, bars_dd, epsilon_tf], spacing=12, wrap=True),
            ft.Container(height=8),
            ft.Row([run_btn, progress], spacing=12),
        ], spacing=4)),

        result_col,

        _card(ft.Column([
            _title("パンチカードグリッド (8 tracks × 16 steps)", size=12, color=_DIM),
            ft.Container(height=4),
            ft.Row([
                _card(ft.Row([
                    ft.Container(bgcolor=_GRID_COLORS[k], width=12, height=10, border_radius=1),
                    _label(lbl),
                ], spacing=4), padding=4)
                for k, lbl in [
                    ("A_dyn", "Dyn-A: y閾値"),
                    ("B_dyn", "Dyn-B: 位相差"),
                    ("A_sta", "Sta-A: クレーム"),
                    ("B_sta", "Sta-B: 開示"),
                ]
            ], spacing=8, wrap=True),
            ft.Container(height=4),
            ft.SingleChildScrollView(
                content=grids_row,
                scroll_direction=ft.ScrollMode.HORIZONTAL,
            ),
        ], spacing=4)),

        params_col,

    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── KNOT_SCORE screen: B地点第十二画面 ───────────────────────────────────────

_CIRCLE_ON  = "#f59e0b"   # diamond placement: gold (Magic Circle)
_CIRCLE_OFF = "#1a1a3a"
_GB_ON_A    = "#22c55e"   # GarageBand Loop A: green
_GB_ON_B    = "#8b5cf6"   # GarageBand Loop B: purple
_GB_OFF     = "#1a1a3a"

_STRIP_COLORS = ["#38c8f0", "#8b5cf6", "#f59e0b", "#ef4444"]


def _magic_circle_widget(mc: dict) -> ft.Control:
    """12-position ring × 16 steps as dot grid (fig 9/14)."""
    placements = mc.get("placements", [[0]*16]*12)
    pitch_names = mc.get("pitch_names", [""]*12)
    rows: list[ft.Control] = []
    for pos in range(12):
        cells: list[ft.Control] = []
        label = ft.Container(
            ft.Text(pitch_names[pos] if pos < len(pitch_names) else "",
                    size=8, color=_DIM),
            width=24,
        )
        cells.append(label)
        for step in range(16):
            bit = placements[pos][step] if pos < len(placements) and step < len(placements[pos]) else 0
            cells.append(ft.Container(
                bgcolor=_CIRCLE_ON if bit else _CIRCLE_OFF,
                width=10, height=8, border_radius=5,
                opacity=0.9 if bit else 0.25,
            ))
        rows.append(ft.Row(cells, spacing=2))
    return _card(ft.Column([
        _title("Magic Circle of Infinity  12×16", size=11, color=_DIM),
        ft.Container(height=4),
        ft.Column(rows, spacing=2),
    ], spacing=4), padding=10)


def _gb_grid_widget(gb: dict) -> ft.Control:
    """2×8 GarageBand loop grid (ガレージバンドトラックループ AREA, fig 14)."""
    cells    = gb.get("cells", [[0,0]]*8)
    labels   = gb.get("row_labels", [""]*8)
    loop_a   = gb.get("loop_a", [""]*8)
    loop_b   = gb.get("loop_b", [""]*8)
    rows: list[ft.Control] = [
        ft.Row([
            ft.Container(ft.Text("", size=8), width=90),
            ft.Container(ft.Text("Loop A", size=9, color=_GB_ON_A), width=70),
            ft.Container(ft.Text("Loop B", size=9, color=_GB_ON_B), width=70),
        ], spacing=4),
    ]
    for r in range(8):
        a_bit = cells[r][0] if r < len(cells) else 0
        b_bit = cells[r][1] if r < len(cells) else 0
        a_name = loop_a[r][:8] if r < len(loop_a) else ""
        b_name = loop_b[r][:8] if r < len(loop_b) else ""
        label  = labels[r] if r < len(labels) else ""
        rows.append(ft.Row([
            ft.Container(ft.Text(label, size=8, color=_DIM), width=90),
            ft.Container(
                bgcolor=_GB_ON_A if a_bit else _GB_OFF,
                content=ft.Text(a_name, size=8, color=_WHITE if a_bit else _DIM),
                width=70, height=20, border_radius=3, padding=2,
                opacity=0.9 if a_bit else 0.3,
            ),
            ft.Container(
                bgcolor=_GB_ON_B if b_bit else _GB_OFF,
                content=ft.Text(b_name, size=8, color=_WHITE if b_bit else _DIM),
                width=70, height=20, border_radius=3, padding=2,
                opacity=0.9 if b_bit else 0.3,
            ),
        ], spacing=4))
    return _card(ft.Column([
        _title("ガレージバンドトラックループ AREA  2×8", size=11, color=_DIM),
        ft.Container(height=4),
        ft.Column(rows, spacing=3),
    ], spacing=4), padding=10)


def _strip_widget(s: dict, idx: int) -> ft.Control:
    """Single vertical strip voice (fig 13)."""
    color = _STRIP_COLORS[idx % 4]
    voice_names = ["Vn ch.0", "Vl ch.1", "Vc ch.2", "Cb ch.3"]
    gliss = s.get("gliss_arc", [])
    gliss_row = ft.Row(
        [ft.Container(
            bgcolor=color,
            width=max(2, int(sem * 4 + 2)),
            height=8, border_radius=1,
            opacity=0.5 + 0.5 * (sem / 12 if sem > 0 else 0),
        ) for _, sem in gliss],
        spacing=1, wrap=True,
    ) if gliss else ft.Container()
    return _card(ft.Column([
        ft.Row([
            ft.Container(bgcolor=color, width=10, height=10, border_radius=2),
            _label(voice_names[idx]),
            _value(s.get("technique",""), color=color, size=10),
        ], spacing=6),
        ft.Row([
            _label("note"),  _value(str(s.get("note_count",0)), color=_WHITE),
            ft.Container(width=8),
            _label("vel"),   _value(str(s.get("velocity",0)), color=_WHITE),
            ft.Container(width=8),
            _label("LPF"),   _value(f"{s.get('filter_hz',0):.0f}Hz", color=_ACCENT),
        ], spacing=4, wrap=True),
        gliss_row,
    ], spacing=4), padding=8)


def _knot_score_view(state: AppState, page: ft.Page) -> ft.Column:
    """Phase Q — cure-{era}-r9 _Sonnet-Score-API × Knot Score Engine (B地点第十二画面).

    Controller fires diamond note icons into the Magic Circle of Infinity (fig 14).
    4 vertical strip voices (fig 13) drive 4 MIDI channels.
    GarageBand 2×8 loop grid is the output target.
    246 knots × 12 pitch classes (knots3d.com).
    """
    ks = state.knot_score

    knot_tf = ft.TextField(
        value="もやい結び", label="結び目名 (日本語)",
        width=200, bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    bow_tf = ft.TextField(
        value="1.0", label="弓位置 bow_pos (0.0-1.0)",
        width=120, keyboard_type=ft.KeyboardType.NUMBER,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
        hint_text="1.0=水中/0.0=通常",
    )
    epsilon_tf = ft.TextField(
        value="0.019", label="ε_disp",
        width=90, keyboard_type=ft.KeyboardType.NUMBER,
        bgcolor=_SURFACE, color=_WHITE, border_color=_BORDER,
    )
    run_btn  = ft.FilledButton("▶ スコア生成", bgcolor=_PURPLE, color=_WHITE,
                               disabled=ks.running)
    progress = ft.ProgressRing(visible=ks.running, color=_ACCENT, width=24, height=24)

    strips_row     = ft.Row(spacing=12, wrap=True)
    circle_col     = ft.Column(spacing=8)
    gb_col         = ft.Column(spacing=8)
    result_col     = ft.Column(spacing=8)

    def _refresh() -> None:
        run_btn.disabled = ks.running
        progress.visible = ks.running
        strips_row.controls.clear()
        circle_col.controls.clear()
        gb_col.controls.clear()
        result_col.controls.clear()

        if ks.error:
            result_col.controls.append(_value(f"エラー: {ks.error}", color=_RED))
            page.update()
            return

        frame = ks.current_frame
        if not frame:
            page.update()
            return

        result_col.controls += [
            ft.Divider(color=_BORDER),
            ft.Row([
                ft.Column([_label("結び目"),  _value(frame["knot_name"],  color=_GOLD)],  spacing=2),
                ft.Column([_label("ピッチ"),  _value(f'{frame["pitch_name"]} ({frame["knot_pitch"]})', color=_ACCENT)], spacing=2),
                ft.Column([_label("ファミリー"), _value(frame["knot_family"], color=_PURPLE)], spacing=2),
                ft.Column([_label("θ_q"),    _value(f'{frame["theta_q"]:.4f}', color=_WHITE)], spacing=2),
                ft.Column([_label("LPF"),    _value(f'{frame["filter_hz"]:.0f}Hz', color=_ACCENT)], spacing=2),
                ft.Column([_label("ticks"),  _value(str(frame["duration_ticks"]), color=_WHITE)], spacing=2),
                ft.Column([_label("era"),    _value(frame["era"], color=_GOLD)], spacing=2),
            ], spacing=20, wrap=True),
        ]

        for i, s in enumerate(frame.get("strips", [])):
            strips_row.controls.append(_strip_widget(s, i))

        mc = frame.get("magic_circle")
        if mc:
            circle_col.controls.append(_magic_circle_widget(mc))

        gb = frame.get("gb_grid")
        if gb:
            gb_col.controls.append(_gb_grid_widget(gb))

        page.update()

    state.add_listener(_refresh)

    async def on_run(_: ft.ControlEvent) -> None:
        try:
            bow = float(bow_tf.value or "1.0")
        except ValueError:
            bow = 1.0
        try:
            eps = float(epsilon_tf.value or "0.019")
        except ValueError:
            eps = 0.019
        await state.run_knot_score(
            knot_name=knot_tf.value.strip() or "もやい結び",
            bow_position=max(0.0, min(1.0, bow)),
            epsilon=eps,
        )

    run_btn.on_click = on_run

    obs     = _observer_info()
    obs_banner = _card(ft.Row([
        ft.Icon(ft.Icons.PIANO, color=_GOLD, size=16),
        ft.Text(
            f"B地点 _Sonnet-Score-API  cure-{{era}}-r9  246結び目×12音  Magic Circle  {obs['system']}",
            size=11, color=_DIM,
        ),
    ], spacing=8))

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.PIANO, color=_GOLD, size=24),
            _title("結び目スコア  cure-{era}-r9", size=20),
        ], spacing=8),
        ft.Divider(color=_BORDER),
        obs_banner,

        _card(ft.Column([
            _title("スコア設定", size=14, color=_DIM),
            ft.Container(height=4),
            ft.Row([knot_tf, bow_tf, epsilon_tf], spacing=12, wrap=True),
            ft.Text("bow_pos: 0.0=通常(4000Hz)  0.5=Stegfläche(800Hz)  1.0=水中/hinterm Steg(200Hz)",
                    size=10, color=_DIM),
            ft.Container(height=8),
            ft.Row([run_btn, progress], spacing=12),
        ], spacing=4)),

        result_col,

        _card(ft.Column([
            _title("4 垂直ストリップ声部 (fig 13)", size=12, color=_DIM),
            ft.Row([
                ft.Container(bgcolor=_STRIP_COLORS[i], width=12, height=10, border_radius=1)
                for i in range(4)
            ] + [
                _label(t) for t in ["Vn pppp", "Vl cluster", "Vc Pfiff", "Cb legno"]
            ], spacing=6, wrap=True),
            ft.Container(height=4),
            strips_row,
        ], spacing=4)),

        ft.Row([
            ft.Column([circle_col], expand=True),
            ft.Column([gb_col], expand=True),
        ], spacing=16, wrap=True),

    ], spacing=16, scroll=ft.ScrollMode.AUTO)


# ── root ──────────────────────────────────────────────────────────────────────

# ── CURE_BMI screen: B地点第十三画面 ─────────────────────────────────────────

_SCENE_OPTIONS = ["trading", "soccer", "surfing", "climbing", "live"]
_BAND_COLOR: dict[str, str] = {
    "DELTA": "#6366f1",  # indigo
    "THETA": "#8b5cf6",  # violet
    "ALPHA": "#22c55e",  # green (default)
    "BETA":  "#f59e0b",  # amber
    "GAMMA": "#ef4444",  # red
}


def _bmi_band_chip(band: str) -> ft.Container:
    color = _BAND_COLOR.get(band, _ACCENT)
    return ft.Container(
        ft.Text(band, size=11, weight=ft.FontWeight.BOLD, color=_WHITE),
        bgcolor=color, border_radius=4, padding=ft.padding.symmetric(4, 8),
    )


def _cure_bmi_view(state: AppState, page: ft.Page) -> ft.Column:
    """B地点第十三画面 — Cure-BMI × KnotScore Integration (Phase R, cure-{era}-r10)."""
    cb = state.cure_bmi

    # ── EEG inputs ───────────────────────────────────────────────────────────
    knot_tf   = ft.TextField(label="結び目名", value=cb.knot_name,
                             width=200, text_size=12, bgcolor=_SURFACE)
    hz_tf     = ft.TextField(label="dominant Hz", value="10.0",
                             width=100, text_size=12, bgcolor=_SURFACE)
    coh_tf    = ft.TextField(label="coherence_q (0-1)", value="0.75",
                             width=120, text_size=12, bgcolor=_SURFACE)
    imp_tf    = ft.TextField(label="impedance kΩ", value="4.0",
                             width=110, text_size=12, bgcolor=_SURFACE)
    bow_tf    = ft.TextField(label="bow_pos (0-1)", value="1.0",
                             width=110, text_size=12, bgcolor=_SURFACE)

    focus_sl  = ft.Slider(min=0, max=1, value=cb.focus,  divisions=20, label="focus")
    calm_sl   = ft.Slider(min=0, max=1, value=cb.calm,   divisions=20, label="calm")
    energy_sl = ft.Slider(min=0, max=1, value=cb.energy, divisions=20, label="energy")
    imm_sl    = ft.Slider(min=0, max=1, value=1.0,        divisions=20, label="immersion")

    scene_dd = ft.Dropdown(
        label="sport scene", value=cb.scene, width=140,
        options=[ft.dropdown.Option(s) for s in _SCENE_OPTIONS],
    )

    # ── result display ───────────────────────────────────────────────────────
    band_row   = ft.Row([_bmi_band_chip(cb.band)], spacing=4)
    sig_text   = ft.Text(cb.band_sig, size=11, color=_DIM)
    pitch_text = ft.Text(f"pitch: {cb.pitch_name}  knot: {cb.knot_name}",
                         size=12, color=_GOLD)
    infl_text  = ft.Text(cb.bmi_influence, size=11, color=_ACCENT,
                         max_lines=3, overflow=ft.TextOverflow.ELLIPSIS)
    effect_col = ft.Column([], spacing=4)
    scene_col  = ft.Column([], spacing=4)
    err_text   = ft.Text("", color="#ef4444", size=11)
    status_txt = ft.Text("", size=11, color=_DIM)

    def _refresh_result(frame_dict: dict) -> None:
        be = frame_dict.get("bmi_effect", {})
        ks = frame_dict.get("knot_score", {})
        ss = frame_dict.get("sport_scene", {})
        band_row.controls = [_bmi_band_chip(frame_dict.get("band", "ALPHA"))]
        sig_text.value    = frame_dict.get("band_sig", "")
        pitch_text.value  = (
            f"pitch: {ks.get('pitch_name','')}  knot: {ks.get('knot_name','')}"
            f"  bow: {ks.get('bow_position',0):.2f}  filter: {ks.get('filter_hz',0)}Hz"
        )
        infl_text.value   = frame_dict.get("bmi_influence", "")
        effect_col.controls = [
            _label(f"pitch offset: {be.get('knot_pitch_offset',0):+d}  "
                   f"vel×{be.get('velocity_scale',1):.2f}  "
                   f"arc_r={be.get('arc_radius',1):.2f}"),
            _label(f"gb_density: {be.get('gb_density',0):.2f}  "
                   f"eff_bow: {be.get('effective_bow',0):.2f}"),
            _label(f"tempo_mod: {frame_dict.get('tempo_mod',1):.4f}  "
                   f"pitch_st: {frame_dict.get('pitch_shift_st',0):+.2f}  "
                   f"intensity: {frame_dict.get('layer_intensity',0):.2f}"),
        ]
        scene_col.controls = [
            _label(f"scene: {ss.get('scene','')}  spatial: {ss.get('spatial_mode','')}"),
            _label(f"reverb: {ss.get('reverb_size',0):.2f}  "
                   f"crowd: {ss.get('crowd_mix',0):.2f}  "
                   f"BPM: {ss.get('bpm_min',0)}–{ss.get('bpm_max',0)}"),
            _label(f"immersion: {ss.get('immersion_level',0):.2f}  "
                   f"anim_hint: {ss.get('audio_to_anim_hint','—') or '—'}"),
        ]
        page.update()

    async def _run(_: ft.ControlEvent) -> None:
        err_text.value  = ""
        status_txt.value = "実行中…"
        page.update()
        try:
            await state.run_cure_bmi(
                knot_name=knot_tf.value or "もやい結び",
                dominant_hz=float(hz_tf.value or 10.0),
                coherence_q=float(coh_tf.value or 0.75),
                impedance_kohm=float(imp_tf.value or 4.0),
                focus=focus_sl.value,
                calm=calm_sl.value,
                energy=energy_sl.value,
                bow_position=float(bow_tf.value or 1.0),
                scene=scene_dd.value or "trading",
                immersion=imm_sl.value,
            )
        except Exception as exc:
            err_text.value = str(exc)
        if state.cure_bmi.error:
            err_text.value = state.cure_bmi.error
        elif state.cure_bmi.current_frame:
            _refresh_result(state.cure_bmi.current_frame)
        status_txt.value = ""
        page.update()

    if cb.current_frame:
        _refresh_result(cb.current_frame)

    run_btn = ft.FilledButton("🧠 BMI × KnotScore 実行", bgcolor=_PURPLE, color=_WHITE,
                              on_click=_run)

    return ft.Column([
        ft.Row([
            ft.Icon(ft.Icons.PSYCHOLOGY, color=_GOLD, size=16),
            _title("Cure-BMI  cure-{era}-r10", size=20),
        ], spacing=6),
        _label("B地点第十三画面 — EEG × KnotScore × FIKU/384candy Remix"),
        ft.Divider(color=_BORDER),

        # ── EEG / BMI inputs ─────────────────────────────────────────────────
        _title("EEG入力", size=13, color=_ACCENT),
        ft.Row([knot_tf, hz_tf, coh_tf, imp_tf, bow_tf], spacing=8, wrap=True),
        ft.Row([scene_dd,
                ft.Container(ft.Column([
                    _label("focus"), focus_sl,
                    _label("calm"),  calm_sl,
                    _label("energy"), energy_sl,
                    _label("immersion"), imm_sl,
                ], spacing=0), expand=True)], spacing=12),

        run_btn, err_text, status_txt,
        ft.Divider(color=_BORDER),

        # ── EEG band + signature ─────────────────────────────────────────────
        _title("BMIシグネチャ", size=13, color=_ACCENT),
        band_row, sig_text, pitch_text,
        ft.Divider(color=_BORDER),

        # ── BMI effects on KnotScore ─────────────────────────────────────────
        _title("エフェクトパラメータ (FIKU / 384candy)", size=13, color=_ACCENT),
        effect_col,
        ft.Divider(color=_BORDER),

        # ── Sport scene / game context ───────────────────────────────────────
        _title("スポーツシーン / ゲームコンテキスト", size=13, color=_ACCENT),
        scene_col,
        infl_text,
    ], scroll=ft.ScrollMode.AUTO, spacing=6, expand=True)


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
    if view == RESONANCE_VIZ:
        return _resonance_view(state, page)
    if view == EXPORT_VIZ:
        return _export_view(state, page)
    if view == SCORE_REPLAY:
        return _score_replay_view(state, page)
    if view == PUNCHCARD:
        return _punchcard_view(state, page)
    if view == KNOT_SCORE:
        return _knot_score_view(state, page)
    if view == CURE_BMI:
        return _cure_bmi_view(state, page)
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
