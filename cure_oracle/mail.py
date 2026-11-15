"""Secure result delivery for cure-oracle experiments.

Three delivery paths, one call:
    deliver(result, to="stdout")                        # notebook / Python VM confirmation
    deliver(result, to="email:user@example.com")        # SMTP or SendGrid or Resend
    deliver(result, to="file:/path/report.html")        # save HTML report locally

CLI shorthand:
    cure resonance --mode local --mail user@example.com
    cure resonance --mode fake  --notify stdout
    cure resonance --mode ibm   --mail user@example.com --confirm "RUN ON QPU"

Credentials — environment variables only, never in args or config files:
    SMTP:      CURE_SMTP_HOST  CURE_SMTP_PORT(587)  CURE_SMTP_USER  CURE_SMTP_PASSWORD
    SendGrid:  CURE_SENDGRID_API_KEY
    Resend:    CURE_RESEND_API_KEY

The recipient address is used once per call and is never stored, logged, or written to disk.
"""

from __future__ import annotations

import os
import html as _html
import pathlib
from typing import Literal

# ── character voices ────────────────────────────────────────────────────────

_VOICES: dict[str, dict[str, str]] = {
    "local": {
        "sender":  "スハル（29-種）",
        "color":   "#22b8c8",
        "subject": "🌸 量子シミュレーションの共鳴 — {problem}",
        "opening": (
            "スハル より。\n\n"
            "雑音のない理想の空間で、共鳴を計算しました。\n"
            "純粋な確率の花が静かに咲いています。"
        ),
    },
    "fake": {
        "sender":  "リナリス（92-種）",
        "color":   "#f29b30",
        "subject": "⚡ ノイズ練習機の共鳴 — {problem}",
        "opening": (
            "リナリス より。\n\n"
            "FakeTorino の雑音の中で、花は揺れながらも咲きました。\n"
            "実機の前の、大切な練習が終わりました。"
        ),
    },
    "ibm": {
        "sender":  "スハルとリナリス",
        "color":   "#f5c542",
        "subject": "🔬 IBM 量子コンピュータの共鳴 — {problem}",
        "opening": (
            "スハルとリナリス より。\n\n"
            "IBM 量子コンピュータが実際に回路を走らせました。\n"
            "これは、光の中に刻まれた記録です。"
        ),
    },
}


# ── SVG flower ───────────────────────────────────────────────────────────────

def _flower_svg(result: dict, size: int = 320) -> str:
    """Six-petal flower: group-0 petals = cyan (#22b8c8), group-1 = orange (#f29b30)."""
    import math
    labels   = result.get("labels", [])
    groups   = result.get("best_groups", [0] * len(labels))
    n        = len(labels)
    cx, cy   = size // 2, size // 2
    r_petal  = size * 0.28
    r_center = size * 0.09
    GROUP_COLOR = ["#22b8c8", "#f29b30"]
    CENTER      = "#f5c542"
    TEXT_COLOR  = "#1a1a2e"
    BG          = "#0d0d1a"

    petals = []
    for i in range(n):
        angle  = 2 * math.pi * i / n - math.pi / 2
        px     = cx + r_petal * 0.55 * math.cos(angle)
        py     = cy + r_petal * 0.55 * math.sin(angle)
        fill   = GROUP_COLOR[groups[i]] if i < len(groups) else GROUP_COLOR[0]
        label  = labels[i] if i < len(labels) else str(i)
        petals.append(
            f'<ellipse cx="{px:.1f}" cy="{py:.1f}" rx="{r_petal * 0.38:.1f}" ry="{r_petal * 0.22:.1f}" '
            f'fill="{fill}" opacity="0.88" transform="rotate({math.degrees(angle):.1f},{px:.1f},{py:.1f})"/>'
        )
        lx = cx + r_petal * 0.95 * math.cos(angle)
        ly = cy + r_petal * 0.95 * math.sin(angle) + 4
        petals.append(
            f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" font-size="13" '
            f'font-family="monospace" fill="{fill}" font-weight="bold">{_html.escape(label)}</text>'
        )

    p_meas = result.get("p_optimal_measured", 0)
    p_rand = result.get("p_optimal_random", 0)
    mode   = result.get("mode", "")
    voice  = _VOICES.get(mode, _VOICES["local"])

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <rect width="{size}" height="{size}" fill="{BG}" rx="12"/>
  {''.join(petals)}
  <circle cx="{cx}" cy="{cy}" r="{r_center:.1f}" fill="{CENTER}"/>
  <text x="{cx}" y="{cy - 22}" text-anchor="middle" font-size="11" font-family="monospace" fill="#aaa">
    {_html.escape(voice["sender"])}
  </text>
  <text x="{cx}" y="{cy + size * 0.42:.0f}" text-anchor="middle" font-size="11" font-family="monospace" fill="#888">
    P={p_meas*100:.1f}% (random {p_rand*100:.1f}%)
  </text>
</svg>"""


# ── HTML report ───────────────────────────────────────────────────────────────

def _html_report(result: dict) -> str:
    mode    = result.get("mode", "local")
    voice   = _VOICES.get(mode, _VOICES["local"])
    subject = voice["subject"].format(problem=result.get("problem", ""))
    opening = voice["opening"]
    svg     = _flower_svg(result)
    color   = voice["color"]

    labels  = result.get("labels", [])
    groups  = result.get("best_groups", [0] * len(labels))
    g0 = [l for l, g in zip(labels, groups) if g == 0]
    g1 = [l for l, g in zip(labels, groups) if g == 1]

    rows = []
    for k, v in [
        ("モード",       result.get("mode", "")),
        ("バックエンド",  result.get("backend", "")),
        ("実行日時",      result.get("when", "")),
        ("ショット数",    str(result.get("shots", ""))),
        ("最適確率（測定）", f"{result.get('p_optimal_measured', 0)*100:.1f}%"),
        ("最適確率（理想）", f"{result.get('p_optimal_ideal',    0)*100:.1f}%"),
        ("ランダム基準",  f"{result.get('p_optimal_random',   0)*100:.1f}%"),
        ("回路深さ",      str(result.get("size", {}).get("depth", ""))),
        ("2量子ビットゲート", str(result.get("size", {}).get("two_qubit", ""))),
    ]:
        rows.append(f"<tr><td>{_html.escape(k)}</td><td>{_html.escape(str(v))}</td></tr>")

    return f"""<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>{_html.escape(subject)}</title>
<style>
  body{{background:#0d0d1a;color:#e8e8f0;font-family:monospace;max-width:600px;margin:0 auto;padding:24px}}
  h1{{color:{color};font-size:1.1em;border-bottom:1px solid #333;padding-bottom:8px}}
  pre{{white-space:pre-wrap;color:#aaa;font-size:0.85em;line-height:1.6}}
  table{{border-collapse:collapse;width:100%;margin:16px 0}}
  td{{padding:6px 10px;border-bottom:1px solid #222;font-size:0.85em}}
  td:first-child{{color:#888;width:45%}}
  .groups{{display:flex;gap:16px;margin:16px 0}}
  .g0{{color:#22b8c8}}.g1{{color:#f29b30}}
  footer{{color:#444;font-size:0.75em;margin-top:32px;border-top:1px solid #222;padding-top:8px}}
</style>
</head>
<body>
<h1>{_html.escape(subject)}</h1>
<pre>{_html.escape(opening)}</pre>
<div style="text-align:center;margin:20px 0">{svg}</div>
<div class="groups">
  <div><span class="g0">■ グループ 0：</span> {_html.escape(', '.join(g0))}</div>
  <div><span class="g1">■ グループ 1：</span> {_html.escape(', '.join(g1))}</div>
</div>
<table>{''.join(rows)}</table>
<footer>cure-oracle · Max-Cut は形のみを使用し、価格情報は含みません。投資助言ではありません。<br>
Secure delivery: recipient address is not stored.</footer>
</body></html>"""


# ── delivery ─────────────────────────────────────────────────────────────────

def deliver(
    result: dict,
    to: str = "stdout",
    *,
    subject: str | None = None,
) -> Literal["ok"]:
    """Deliver a cure-oracle result.

    Parameters
    ----------
    result:  the dict returned by resonance.run()
    to:      "stdout"  — print a summary to the console (notebook-friendly)
             "email:addr@example.com"  — send via SMTP / SendGrid / Resend
             "file:/path/to/report.html"  — write an HTML file
    subject: override the auto subject line
    """
    mode    = result.get("mode", "local")
    voice   = _VOICES.get(mode, _VOICES["local"])
    subj    = subject or voice["subject"].format(problem=result.get("problem", ""))
    opening = voice["opening"]

    labels = result.get("labels", [])
    groups = result.get("best_groups", [0] * len(labels))
    g0 = [l for l, g in zip(labels, groups) if g == 0]
    g1 = [l for l, g in zip(labels, groups) if g == 1]
    p  = result.get("p_optimal_measured", 0)

    if to == "stdout":
        sep = "─" * 52
        print(f"\n{sep}")
        print(f"  {voice['sender']} からのメッセージ")
        print(sep)
        print(opening)
        print(f"\n  グループ 0 ： {', '.join(g0)}")
        print(f"  グループ 1 ： {', '.join(g1)}")
        print(f"  P(最適) = {p*100:.1f}%  (ランダム {result.get('p_optimal_random',0)*100:.1f}%)")
        print(sep)
        return "ok"

    if to.startswith("file:"):
        path = pathlib.Path(to[5:])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_html_report(result), encoding="utf-8")
        print(f"レポートを保存しました → {path}")
        return "ok"

    if to.startswith("email:"):
        addr = to[6:]
        _send_email(addr, subj, _html_report(result))
        print(f"メールを送信しました ({mode} / {voice['sender']})")
        return "ok"

    raise ValueError(f"to= は 'stdout', 'email:addr', 'file:path' のいずれかです。got: {to!r}")


# ── SMTP / API back-ends ──────────────────────────────────────────────────────

def _send_email(addr: str, subject: str, html_body: str) -> None:
    """Send via SMTP or API (SendGrid / Resend). Credentials from env vars only."""
    sg_key     = os.environ.get("CURE_SENDGRID_API_KEY")
    resend_key = os.environ.get("CURE_RESEND_API_KEY")
    smtp_host  = os.environ.get("CURE_SMTP_HOST")

    if resend_key:
        _send_resend(addr, subject, html_body, resend_key)
    elif sg_key:
        _send_sendgrid(addr, subject, html_body, sg_key)
    elif smtp_host:
        _send_smtp(addr, subject, html_body, smtp_host)
    else:
        raise EnvironmentError(
            "メール送信には環境変数が必要です。いずれかを設定してください：\n"
            "  CURE_SMTP_HOST + CURE_SMTP_USER + CURE_SMTP_PASSWORD\n"
            "  CURE_SENDGRID_API_KEY\n"
            "  CURE_RESEND_API_KEY\n"
            "Colab では userdata.get('CURE_SMTP_PASSWORD') などで設定します。"
        )


def _send_smtp(addr: str, subject: str, html_body: str, host: str) -> None:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    port     = int(os.environ.get("CURE_SMTP_PORT", "587"))
    user     = os.environ.get("CURE_SMTP_USER", "")
    password = os.environ.get("CURE_SMTP_PASSWORD", "")

    msg              = MIMEMultipart("alternative")
    msg["Subject"]   = subject
    msg["From"]      = user
    msg["To"]        = addr
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(host, port) as s:
        s.ehlo(); s.starttls(); s.ehlo()
        s.login(user, password)
        s.sendmail(user, [addr], msg.as_bytes())
    # drop references to credentials immediately
    del password, user


def _send_sendgrid(addr: str, subject: str, html_body: str, api_key: str) -> None:
    import urllib.request, json as _json
    from_addr = os.environ.get("CURE_FROM_ADDRESS", "cure-oracle@example.com")
    payload   = _json.dumps({
        "personalizations": [{"to": [{"email": addr}]}],
        "from": {"email": from_addr},
        "subject": subject,
        "content": [{"type": "text/html", "value": html_body}],
    }).encode()
    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    del api_key
    with urllib.request.urlopen(req) as r:
        if r.status not in (200, 202):
            raise RuntimeError(f"SendGrid {r.status}")


def _send_resend(addr: str, subject: str, html_body: str, api_key: str) -> None:
    import urllib.request, json as _json
    from_addr = os.environ.get("CURE_FROM_ADDRESS", "cure-oracle@resend.dev")
    payload   = _json.dumps({
        "from": from_addr, "to": [addr],
        "subject": subject, "html": html_body,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    del api_key
    with urllib.request.urlopen(req) as r:
        if r.status not in (200, 201):
            raise RuntimeError(f"Resend {r.status}")
