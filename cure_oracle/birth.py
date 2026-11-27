"""QPU birth certificate — quantum proof-of-access for MothBlast game login.

Flow:
  1. User runs: cure round --mode ibm
  2. First IBM run auto-generates cure_birth_certificate.json
  3. HTML birth certificate is written (Niki de Saint Phalle inspired: cobalt blue sphere)
  4. cert["game_token"] (16-char hex fingerprint) serves as game login auth token

The certificate is unique per QPU run:
  certificate_id = SHA-256( born_at + backend + bitstring )[:16]

Merkle proof–backed SIG receipt
---------------------------------
``make_sig_receipt()`` commits 8 cert claims into a Keccak-256 Merkle tree
(OpenZeppelin compatible, same double-hash leaf formula as meshmeta_v2.py).
Claim index 3 is always the SIG code; its Merkle proof lets a third party
verify the SIG inclusion without seeing the other 7 claims.
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

# ── Merkle proof–backed SIG receipt ─────────────────────────────────────────

SIG_RECEIPT_VERSION = "sig-receipt/1"
_CLAIM_VALUE_LEN = 48   # bytes of value per 50-byte record (2-byte type prefix)
_SIG_INDEX       = 3    # claim index that holds the SIG code

_CLAIM_TYPES = {
    "cert_id": 0, "born_at": 1, "backend": 2, "sig_code": 3,
    "epsilon": 4, "mente":   5, "qpu_seconds": 6, "bitstring": 7,
}


def _claim_record(claim_type: int, value: str) -> bytes:
    """50-byte record: uint16(claim_type, big-endian) || UTF-8 value, null-padded to 48 B."""
    return claim_type.to_bytes(2, "big") + value.encode("utf-8")[:_CLAIM_VALUE_LEN].ljust(_CLAIM_VALUE_LEN, b"\x00")


def _k256(data: bytes) -> bytes:
    from meshmeta_v2 import keccak256
    return keccak256(data)


def _receipt_leaf(index: int, record: bytes) -> bytes:
    """keccak256(keccak256(uint256(index) ‖ record50)) — identical to meshmeta_v2.leaf."""
    return _k256(_k256(index.to_bytes(32, "big") + record))


def _receipt_pair(a: bytes, b: bytes) -> bytes:
    return _k256(a + b if a <= b else b + a)


def _receipt_tree(claim_records: list[bytes]) -> list[list[bytes]]:
    """Keccak-256 Merkle tree (OpenZeppelin sorted-pair nodes)."""
    level = [_receipt_leaf(i, r) for i, r in enumerate(claim_records)]
    levels = [level]
    while len(level) > 1:
        level = [
            _receipt_pair(level[i], level[i + 1]) if i + 1 < len(level) else level[i]
            for i in range(0, len(level), 2)
        ]
        levels.append(level)
    return levels


def _receipt_proof(levels: list[list[bytes]], index: int) -> list[bytes]:
    out: list[bytes] = []
    for level in levels[:-1]:
        sib = index ^ 1
        if sib < len(level):
            out.append(level[sib])
        index //= 2
    return out


def make_sig_receipt(
    cert: dict,
    sig_code: str,
    epsilon: float,
    mente: float,
    private_key=None,
) -> dict:
    """Build a Merkle proof–backed SIG receipt from a birth certificate.

    Commits 8 claims into a Keccak-256 Merkle tree (OpenZeppelin compatible).
    Returns the receipt dict with ``merkle.root`` and ``proof.path`` for the
    SIG code (claim index 3).  Pass an Ed25519 private key to attach a
    signature over the canonical (RFC 8785 JCS) receipt body.
    """
    cid      = cert.get("certificate_id", "")
    born_at  = cert.get("born_at", "")
    backend  = cert.get("backend", "")
    qpu_sec  = str(cert.get("qpu_seconds") or "0")
    bitstring= cert.get("bitstring", "")

    ordered_claims = [
        (0, cid),
        (1, born_at),
        (2, backend),
        (3, sig_code),
        (4, str(epsilon)),
        (5, f"{mente:.6f}"),
        (6, qpu_sec),
        (7, bitstring),
    ]
    recs   = [_claim_record(ct, val) for ct, val in ordered_claims]
    levels = _receipt_tree(recs)
    root   = levels[-1][0]
    path   = _receipt_proof(levels, _SIG_INDEX)
    sig_leaf = _receipt_leaf(_SIG_INDEX, recs[_SIG_INDEX])

    receipt: dict = {
        "version": SIG_RECEIPT_VERSION,
        "cert_id": cid,
        "born_at": born_at,
        "backend": backend,
        "sig":     sig_code,
        "epsilon": epsilon,
        "mente":   round(mente, 6),
        "merkle": {
            "hash":  "keccak256",
            "leaf":  "keccak256(keccak256(uint256(index) ‖ uint16(type) ‖ value48))",
            "node":  "sorted-pair",
            "root":  "0x" + root.hex(),
            "claims":    len(recs),
            "sig_index": _SIG_INDEX,
        },
        "proof": {
            "index": _SIG_INDEX,
            "path":  ["0x" + p.hex() for p in path],
            "leaf":  "0x" + sig_leaf.hex(),
        },
    }

    if private_key is not None:
        from cryptography.hazmat.primitives import serialization
        from meshmeta_v2 import canonical
        body = {k: v for k, v in receipt.items() if k != "signature"}
        pub  = private_key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        receipt["signature"] = {
            "alg":    "Ed25519",
            "signer": pub.hex(),
            "sig":    private_key.sign(canonical(body)).hex(),
        }

    return receipt


def receipt_html_section(receipt: dict) -> str:
    """HTML fragment for embedding a Merkle receipt inside the birth certificate page."""
    root  = receipt.get("merkle", {}).get("root", "")
    path  = receipt.get("proof", {}).get("path", [])
    leaf  = receipt.get("proof", {}).get("leaf", "")
    sig   = _html.escape(receipt.get("sig", ""))
    idx   = receipt.get("merkle", {}).get("sig_index", 3)
    eps   = receipt.get("epsilon", "")
    mente = receipt.get("mente", "")
    ed    = receipt.get("signature", {})
    ed_html = ""
    if ed:
        ed_html = f"""
  <tr><td>Ed25519署名</td><td style="word-break:break-all;font-size:.7em">{_html.escape(ed.get('sig','')[:32])}…</td></tr>
  <tr><td>公開鍵</td><td style="word-break:break-all;font-size:.7em">{_html.escape(ed.get('signer','')[:32])}…</td></tr>"""

    path_steps = "".join(
        f'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
        f'<span style="color:var(--dim);font-size:.7em;width:18px">h{i}</span>'
        f'<span style="color:var(--cyan);font-size:.68em;word-break:break-all;flex:1">{_html.escape(p)}</span>'
        f'</div>'
        for i, p in enumerate(path)
    )

    proof_json    = _html.escape(json.dumps(receipt.get("proof", {}), ensure_ascii=False))
    claims_count  = receipt.get("merkle", {}).get("claims", 8)

    return f"""
<div class="receipt-box" style="
  margin-top:28px;border:1px solid #22b8c840;border-radius:10px;
  padding:18px 16px;background:#0a0d30;text-align:left">
  <div style="color:var(--gold);font-size:.75em;letter-spacing:.12em;margin-bottom:12px">
    ◈ Merkle証明付き SIG 領収証
  </div>

  <div style="margin-bottom:14px">
    <div style="font-size:.7em;color:var(--dim);margin-bottom:3px">SIG コード</div>
    <div style="font-size:1em;color:var(--gold);font-weight:700;letter-spacing:.1em">{sig}</div>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
    <div style="flex:1;min-width:120px">
      <div style="font-size:.7em;color:var(--dim);margin-bottom:2px">ε ノイズ率</div>
      <div style="font-size:.85em;color:var(--cyan)">{_html.escape(str(eps))}</div>
    </div>
    <div style="flex:1;min-width:120px">
      <div style="font-size:.7em;color:var(--dim);margin-bottom:2px">MENTE値</div>
      <div style="font-size:.85em;color:var(--orange)">{_html.escape(str(mente))}</div>
    </div>
    <div style="flex:1;min-width:120px">
      <div style="font-size:.7em;color:var(--dim);margin-bottom:2px">クレームindex</div>
      <div style="font-size:.85em;color:var(--luna)">{idx} / 7</div>
    </div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:.7em;color:var(--dim);margin-bottom:3px">Merkle Root (Keccak-256)</div>
    <div style="font-size:.68em;color:var(--cyan);word-break:break-all;border:1px solid #22b8c830;
         padding:6px 8px;border-radius:5px;background:#060918">{_html.escape(root)}</div>
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:.7em;color:var(--dim);margin-bottom:6px">証明パス (Proof Path)</div>
    {path_steps if path_steps else '<div style="color:var(--dim);font-size:.7em">— 単一クレーム（パスなし） —</div>'}
  </div>

  <div style="margin-bottom:12px">
    <div style="font-size:.7em;color:var(--dim);margin-bottom:3px">SIG リーフ</div>
    <div style="font-size:.68em;color:var(--luna);word-break:break-all;border:1px solid #c084fc30;
         padding:6px 8px;border-radius:5px;background:#060918">{_html.escape(leaf)}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:.75em;margin-bottom:10px">
    <tr><td style="color:var(--dim);padding:3px 6px;border-bottom:1px solid #1e2060">ハッシュアルゴリズム</td>
        <td style="padding:3px 6px;border-bottom:1px solid #1e2060">Keccak-256 (Ethereum)</td></tr>
    <tr><td style="color:var(--dim);padding:3px 6px;border-bottom:1px solid #1e2060">ノード結合</td>
        <td style="padding:3px 6px;border-bottom:1px solid #1e2060">sorted-pair (OpenZeppelin互換)</td></tr>
    <tr><td style="color:var(--dim);padding:3px 6px;border-bottom:1px solid #1e2060">クレーム総数</td>
        <td style="padding:3px 6px;border-bottom:1px solid #1e2060">{claims_count}</td></tr>{ed_html}
  </table>

  <details style="margin-top:8px">
    <summary style="font-size:.7em;color:var(--dim);cursor:pointer">証明JSON (コピー用)</summary>
    <pre style="font-size:.62em;color:var(--cyan);overflow-x:auto;padding:8px;background:#060918;
         border-radius:5px;margin-top:6px;white-space:pre-wrap;word-break:break-all">{proof_json}</pre>
  </details>
</div>"""


def certificate_html(cert: dict, receipt: dict | None = None) -> str:
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
  {receipt_html_section(receipt) if receipt else ""}
</div>
</body>
</html>"""
