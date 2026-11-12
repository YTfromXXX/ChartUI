import hashlib
import json
import pathlib
import sys

import pytest

import meshmeta_v2 as m2

FIX = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "meshmeta_v2_tetra.json"
DATA = json.loads(FIX.read_text(encoding="utf-8"))


def test_keccak256_vectors():
    assert m2.keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    assert m2.keccak256(b"abc").hex() == "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
    assert m2.keccak256(b"a" * 136).hex() != m2.keccak256(b"a" * 135).hex()  # crosses the 136-byte rate


def test_jcs_sorts_by_utf16_and_normalises_nfc():
    assert m2.canonical(DATA["jcs_case"]).decode() == DATA["jcs_expected"]
    assert DATA["jcs_expected"].index("\U0001f600") < DATA["jcs_expected"].index("")
    with pytest.raises(ValueError):
        m2.canonical({"q": 0.5})


def test_nfc_does_not_touch_the_emoji_variation_selector():
    # NFC keeps U+FE0F, so "⏸" and "⏸️" stay different: the schema fixes the exact form instead.
    assert m2.canonical("⏸") != m2.canonical("⏸️")


def test_fixture_rebuilds_byte_for_byte():
    cryptography = pytest.importorskip("cryptography")  # noqa: F841
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    stl, meta = m2.build(DATA["vertices"], [tuple(t) for t in DATA["triangles"]])
    meta = m2.sign_ed25519(meta, Ed25519PrivateKey.from_private_bytes(bytes(range(32))))
    assert stl.hex() == DATA["stl_hex"]
    assert meta == DATA["meta"]
    assert hashlib.sha256(m2.signing_bytes(meta)).hexdigest() == DATA["signing_sha256"]


def test_verify_and_tamper():
    pytest.importorskip("cryptography")
    stl = bytes.fromhex(DATA["stl_hex"]); meta = DATA["meta"]
    assert m2.verify(stl, meta)["ok"]
    bad = bytearray(stl); bad[84 + 50 * 3 + 20] ^= 1
    r = m2.verify(bytes(bad), meta)
    assert not r["ok"] and not r["merkle_root"] and not r["stl_sha256"]
    moved = json.loads(json.dumps(meta)); moved["pointers"][0]["index"] = (moved["pointers"][0]["index"] + 1) % 10
    r = m2.verify(stl, moved)
    assert not r["ok"] and r["signatures"] == [False] and r["pointers"][0] is False
    assert not m2.verify(stl, meta, trusted=["00" * 32])["ok"]


def test_single_triangle_proof_without_the_whole_file():
    stl = bytes.fromhex(DATA["stl_hex"]); meta = DATA["meta"]
    root = bytes.fromhex(meta["merkle"]["root"][2:])
    for p in meta["pointers"]:
        record = stl[p["start"]:p["start"] + p["length"]]
        assert m2.verify_proof(root, p["index"], record, [bytes.fromhex(x[2:]) for x in p["proof"]])
        assert not m2.verify_proof(root, (p["index"] + 1) % 10, record, [bytes.fromhex(x[2:]) for x in p["proof"]])
