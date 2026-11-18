"""QPU birth certificate — quantum proof-of-access for MothBlast game login.

Flow:
  1. User runs: cure round --mode ibm
  2. First IBM run auto-generates cure_birth_certificate.json
  3. HTML birth certificate is written (Niki de Saint Phalle inspired: cobalt blue sphere)
  4. cert["game_token"] (16-char hex fingerprint) serves as game login auth token

The certificate is unique per QPU run:
  certificate_id = SHA-256( born_at + backend + bitstring )[:16]
"""

from __future__ import annotations

import hashlib
import html as _html
import json
import math
import os
import pathlib

CERT_FILENAME = "cure_birth_certificate.json"

# Palette — Niki de Saint Phalle cobalt-blue-and-gold aesthetic
_BG      = "#0d1040"
_GOLD    = "#f5c542"
_CYAN    = "#22b8c8"
_ORANGE  = "#f29b30"
_LUNA    = "#e8e8ff"
_ARIEL   = "#b8d8e8"
_RING    = "#1a2060"


# ── certificate data ─────────────────────────────────────────────────────────

def make_certificate(result: dict) -> dict:
    """Build a birth certificate dict from a round_circuit(mode='ibm') result."""
    guide_bits = result.get("guide_bits", [])
    evt_bits   = [1 if v else 0 for v in result.get("events", {}).values()]
    all_bits   = guide_bits + evt_bits
    born_at    = result.get("when", "")
    backend    = result.get("backend", "")
    bitstring  = "".join(str(b) for b in all_bits)

    fingerprint = hashlib.sha256(
        f"{born_at}:{backend}:{bitstring}".encode()
    ).hexdigest()[:16]

    return {
        "certificate_id":   fingerprint,
        "game_token":       fingerprint,          # used as login auth token
        "born_at":          born_at,
        "backend":          backend,
        "bitstring":        bitstring,            # 13 bits: 10 guide + 3 event
        "teleport_angle_a": result.get("teleport_angle_a"),
        "teleport_angle_b": result.get("teleport_angle_b"),
        "active_guides_a":  result.get("active_guides_a", []),
        "active_guides_b":  result.get("active_guides_b", []),
        "events":           result.get("events", {}),
        "qpu_seconds":      result.get("qpu_seconds"),
        "midwife":          "Luna + エーリアル",
        "round":            result.get("round", 0),
    }


def save_certificate(cert: dict, path: str | pathlib.Path | None = None) -> pathlib.Path:
    """Save cert JSON. Default: ./cure_birth_certificate.json"""
    p = pathlib.Path(path or CERT_FILENAME)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(cert, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return p


def load_certificate(path: str | pathlib.Path | None = None) -> dict | None:
    """Load an existing certificate, or None if not found."""
    p = pathlib.Path(path or CERT_FILENAME)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


# ── SVG eternal-space ring ───────────────────────────────────────────────────

def _ring_svg(cert: dict, size: int = 320) -> str:
    """Cobalt-blue sphere with 10 guide fairies on the ring."""
    cx = cy = size // 2
    R = size * 0.37

    active_a = set(cert.get("active_guides_a", []))
    active_b = set(cert.get("active_guides_b", []))

    from cure_oracle.round_circuit import GUIDES

    petals = []
    for name, team, angle_deg, _ in GUIDES:
        rad   = math.radians(angle_deg - 90)
        px    = cx + R * math.cos(rad)
        py    = cy + R * math.sin(rad)
        active = name in active_a or name in active_b
        color  = _CYAN if team == "A" else _ORANGE
        r_dot  = size * 0.045 if active else size * 0.025
        sym    = "★" if active else "·"
        petals.append(
            f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r_dot:.1f}" '
            f'fill="{color}" opacity="{"0.95" if active else "0.35"}"/>'
        )
        lx = cx + (R + size * 0.07) * math.cos(rad)
        ly = cy + (R + size * 0.07) * math.sin(rad) + 3
        petals.append(
            f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
            f'font-size="9" font-family="monospace" fill="{color}" '
            f'opacity="{"0.9" if active else "0.4"}">{_html.escape(sym)}</text>'
        )

    # teleport needles
    needles = []
    for ang, color, label in [
        (cert.get("teleport_angle_a", 0), _CYAN,   "A"),
        (cert.get("teleport_angle_b", 0), _ORANGE, "B"),
    ]:
        rad = math.radians(ang - 90)
        nx  = cx + R * 0.62 * math.cos(rad)
        ny  = cy + R * 0.62 * math.sin(rad)
        needles.append(
            f'<line x1="{cx}" y1="{cy}" x2="{nx:.1f}" y2="{ny:.1f}" '
            f'stroke="{color}" stroke-width="1.5" opacity="0.75"/>'
            f'<text x="{nx:.1f}" y="{ny:.1f}" text-anchor="middle" '
            f'font-size="10" fill="{color}">{label}</text>'
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">
  <defs>
    <radialGradient id="sphere" cx="40%" cy="35%">
      <stop offset="0%"   stop-color="#2a3a8a"/>
      <stop offset="100%" stop-color="{_BG}"/>
    </radialGradient>
  </defs>
  <circle cx="{cx}" cy="{cy}" r="{size//2 - 2}" fill="url(#sphere)" stroke="{_GOLD}" stroke-width="2"/>
  {''.join(petals)}
  {''.join(needles)}
  <circle cx="{cx}" cy="{cy}" r="{size * 0.07:.1f}" fill="{_GOLD}" opacity="0.9"/>
  <text x="{cx}" y="{cy + 4}" text-anchor="middle" font-size="10" font-family="monospace" fill="{_BG}">◎</text>
</svg>"""


# ── HTML birth certificate ────────────────────────────────────────────────────

def certificate_html(cert: dict) -> str:
    """Full HTML birth certificate page — cobalt blue, gold cap, Niki de Saint Phalle style."""
    cid     = cert.get("certificate_id", "")
    born_at = cert.get("born_at", "")
    backend = cert.get("backend", "")
    bits    = cert.get("bitstring", "")
    ta      = cert.get("teleport_angle_a", 0)
    tb      = cert.get("teleport_angle_b", 0)
    events  = [k for k, v in cert.get("events", {}).items() if v]
    round_n = cert.get("round", "?")
    svg     = _ring_svg(cert)

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>量子ベイベー誕生証明書 — {_html.escape(cid)}</title>
<style>
  :root {{
    --bg:#0d1040; --gold:#f5c542; --cyan:#22b8c8; --orange:#f29b30;
    --luna:#e8e8ff; --text:#c8d0f8; --dim:#5a6090;
  }}
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:var(--bg);color:var(--text);font-family:monospace;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}}
  .card{{max-width:480px;width:100%;border:2px solid var(--gold);border-radius:50% 50% 48% 48% / 10% 10% 8% 8%;
         padding:40px 32px 36px;text-align:center;
         background:radial-gradient(ellipse at 38% 32%, #1e2a7a 0%, var(--bg) 70%);
         box-shadow:0 0 48px #f5c54240}}
  .gold-cap{{width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe066,#c89a10);
            margin:0 auto 20px;box-shadow:0 2px 12px #f5c54260}}
  h1{{color:var(--gold);font-size:1em;letter-spacing:.12em;margin-bottom:4px}}
  .subtitle{{color:var(--dim);font-size:.75em;margin-bottom:24px}}
  .sphere{{margin:0 auto 24px;display:block;filter:drop-shadow(0 0 16px #22b8c840)}}
  .cert-id{{font-size:1.3em;color:var(--gold);letter-spacing:.18em;margin-bottom:6px}}
  .born-at{{color:var(--dim);font-size:.8em;margin-bottom:20px}}
  table{{width:100%;border-collapse:collapse;font-size:.8em;text-align:left;margin-bottom:20px}}
  td{{padding:4px 8px;border-bottom:1px solid #1e2060}}
  td:first-child{{color:var(--dim);width:46%}}
  .bits{{word-break:break-all;font-size:.75em;color:var(--cyan);letter-spacing:.05em;
         border:1px solid #1e3060;padding:8px;border-radius:4px;margin-bottom:20px}}
  .token-label{{color:var(--dim);font-size:.75em;margin-bottom:4px}}
  .token{{font-size:1.1em;color:var(--gold);letter-spacing:.2em;padding:10px;
           border:1px solid var(--gold);border-radius:6px;background:#0a0d30}}
  .footer{{color:var(--dim);font-size:.7em;margin-top:24px;line-height:1.6}}
  .sig{{font-style:italic;color:var(--luna);font-size:.8em;margin-top:12px}}
</style>
</head>
<body>
<div class="card">
  <div class="gold-cap"></div>
  <h1>量子ベイベー誕生証明書</h1>
  <div class="subtitle">MothBlast — 永遠空間 QPU 認証</div>

  {svg.replace('<svg ', '<svg class="sphere" ')}

  <div class="cert-id">{_html.escape(cid)}</div>
  <div class="born-at">{_html.escape(born_at)}</div>

  <table>
    <tr><td>バックエンド</td><td>{_html.escape(backend)}</td></tr>
    <tr><td>ラウンド</td><td>{_html.escape(str(round_n))}</td></tr>
    <tr><td>スハル テレポート</td><td>{ta:.2f}°</td></tr>
    <tr><td>リナリス テレポート</td><td>{tb:.2f}°</td></tr>
    <tr><td>量子イベント</td><td>{_html.escape(', '.join(events) if events else 'none')}</td></tr>
  </table>

  <div class="bits">{_html.escape(bits or '—')}</div>

  <div class="token-label">ゲームログイン トークン</div>
  <div class="token">{_html.escape(cid)}</div>

  <div class="sig">— Luna + エーリアル より —</div>
  <div class="footer">
    IBM Quantum Platform · Cure-API<br>
    このトークンは量子測定の一意な指紋です。<br>
    cure-oracle · 誕生証明書は投資助言ではありません。
  </div>
</div>
</body>
</html>"""
