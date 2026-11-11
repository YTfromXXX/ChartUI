import json
import math

import pytest

import mesh_meta as mm


def tetra():
    """Regular tetrahedron: four equilateral faces."""
    v = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]
    return v, [(0, 1, 2), (0, 3, 1), (0, 2, 3), (1, 3, 2)]


def test_quality_equilateral_is_one_and_degenerate_is_zero():
    h = math.sqrt(3) / 2
    assert mm.triangle_quality((0, 0, 0), (1, 0, 0), (0.5, h, 0)) == pytest.approx(1.0)
    assert mm.triangle_quality((0, 0, 0), (1, 0, 0), (2, 0, 0)) == 0.0
    assert mm.triangle_quality((0, 0, 0), (1, 0, 0), (0.5, 0.05, 0)) < 0.2


def test_ranking_orders_by_quality_and_labels_a_to_d():
    h = math.sqrt(3) / 2
    v = [(0, 0, 0), (1, 0, 0), (0.5, h, 0), (0.5, 0.6, 0), (0.5, 0.4, 0), (0.5, 0.2, 0), (0.5, 0.1, 0)]
    t = [(0, 1, 6), (0, 1, 2), (0, 1, 4), (0, 1, 3), (0, 1, 5)]
    best = mm.top_triangles(v, t, range(len(t)))
    assert [i for i, _ in best] == [1, 3, 2, 4]
    assert [q for _, q in best] == sorted((q for _, q in best), reverse=True)


def test_segment_separates_components_and_sharp_edges():
    v, t = tetra()
    shifted = [(x + 10, y, z) for x, y, z in v]
    verts = v + shifted
    tris = t + [(a + 4, b + 4, c + 4) for a, b, c in t]
    assert len(mm.segment(verts, tris)) == 2  # two bodies
    assert len(mm.segment(verts, tris, sharp_deg=40)) == 8  # every tetra edge is sharp


def test_weld_merges_stl_style_duplicates():
    v, t = tetra()
    flat_v = [v[i] for tri in t for i in tri]
    flat_t = [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(t))]
    wv, wt = mm.weld(flat_v, flat_t)
    assert len(wv) == 4 and len(mm.segment(wv, wt)) == 1


def test_data_field_round_trip_and_regex():
    field = mm.format_data(0xA1, 36)
    assert field == '[⏸️ (バイト): "0x00A1", ▶️ (バイト): "36"]'
    assert mm.parse_data(field) == (161, 36)
    assert mm.parse_data('[⏸️ (バイト): "197", ▶️ (バイト): "36"]') == (197, 36)
    with pytest.raises(ValueError):
        mm.parse_data("[pause: 1]")


def test_pointers_read_back_the_exact_triangle_from_stl():
    v, t = tetra()
    stl, meta = mm.build_meshmeta(v, t, sharp_deg=None)
    assert len(stl) == 84 + 50 * len(t)
    vs, ts = mm.read_stl(stl)
    assert len(ts) == 4
    part = meta["MeshPart_01"]["Top_Triangles"]
    assert [e["Label"] for e in part] == ["A", "B", "C", "D"]
    assert [e["Rank"] for e in part] == ["No.1", "No.2", "No.3", "No.4"]
    assert all(e["Quality"] == "1.000" for e in part)
    for e in part:
        tri = mm.read_pointer(stl, e["Data"])
        assert len(tri) == 3 and mm.triangle_quality(*tri) == pytest.approx(1.0, abs=1e-6)
    # The JSON survives a dump/load, emoji and escaped quotes included.
    again = json.loads(mm.dumps_meshmeta(meta))
    assert mm.parse_data(again["MeshPart_01"]["Top_Triangles"][0]["Data"]) == (mm.vertex_offset(0), 36)


def test_pointer_out_of_range_is_rejected():
    v, t = tetra()
    stl, _ = mm.build_meshmeta(v, t)
    with pytest.raises(ValueError):
        mm.read_pointer(stl, mm.format_data(len(stl) - 10))
    with pytest.raises(ValueError):
        mm.read_pointer(stl, mm.format_data(100, 35))


def test_ascii_stl_is_read():
    text = b"solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x\n"
    v, t = mm.read_stl(text)
    assert v == [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)] and t == [(0, 1, 2)]


def test_signature_round_trip_and_tamper_detection():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    v, t = tetra()
    stl, meta = mm.build_meshmeta(v, t)
    key = Ed25519PrivateKey.from_private_bytes(bytes(range(32)))
    signed = mm.sign_meshmeta(stl, meta, key)
    pub = signed["Signature"]["PublicKey"]
    assert mm.verify_meshmeta(stl, signed, pub)
    # Survives a save/load through the JSON text.
    assert mm.verify_meshmeta(stl, json.loads(mm.dumps_meshmeta(signed)), pub)
    # A changed STL byte, a changed pointer, or another signer all fail.
    assert not mm.verify_meshmeta(stl[:-1] + bytes([stl[-1] ^ 1]), signed)
    moved = json.loads(json.dumps(signed))
    first = next(k for k in moved if k.startswith("MeshPart_"))
    moved[first]["Top_Triangles"][0]["Data"] = mm.format_data(mm.vertex_offset(1))
    assert not mm.verify_meshmeta(stl, moved)
    assert not mm.verify_meshmeta(stl, signed, "00" * 32)
    assert not mm.verify_meshmeta(stl, meta)
