"""cure_oracle/hdna.py — Harmonia DNA Format (.hdna) encoder / decoder.

SPEC_REV = "1.0"  — QPU-era ultra-lightweight music card format

A .hdna file encodes one "music DNA card" — the structure, emotion, visual
identity and resonance history of a Cure-Oracle composition — in ~2 KB.
No audio samples are stored; playback is re-synthesised from the structural
description (MIDI-level) at render time.

Binary layout (big-endian throughout)
--------------------------------------
  Offset  Size  Field
  ──────  ────  ──────────────────────────────────────────────────────
     0      4   Magic: b"HDNA"
     4      1   Format version: 0x01
     5      1   Flags  bit0=zlib-compressed  bit1=4-song-chain active
  ── chunk loop ─────────────────────────────────────────────────────
     6      4   Chunk tag  (b"HEAD" | b"MDNA" | b"VART" | b"LINK")
    +4      2   Chunk payload length  (uint16, max 65535)
    +6      n   Chunk payload (possibly zlib-compressed)
  ── footer ─────────────────────────────────────────────────────────
   -4      4   CRC-32 of everything before the footer  (big-endian)

Total (uncompressed): ~2,050 Bytes ≈ 2 KB

HEAD chunk (~40 B)
-------------------
  8   born_at_ms   uint64   Unix timestamp milliseconds
  12  region_code  bytes    12-byte region string  e.g. b"JP-23\x00…"
  20  creator_hash bytes    20-byte SHA-1 of creator ID (truncated)
  → total: 8+12+20 = 40 bytes

MDNA chunk (~variable, target ~1.2 KB)
----------------------------------------
  2   bpm          uint16
  1   key_pc       uint8    pitch class 0-11
  1   era_id       uint8    0=baroque … 4=inner_world
  4   mente_total  float32
  1   timbre_id    uint8    SoundFont patch index
  2   note_count   uint16
  n   note_events  note_count × 6-byte records (zlib compressed in payload)
      each note: pitch(1) velocity(1) start_tick(2) dur_ticks(2)

VART chunk (~variable, target ~500 B)
---------------------------------------
  1   rarity       uint8    0=common 1=rare 2=epic 3=legendary
  4   circle_seed  uint32   Magic Circle geometry seed
  1   band_id      uint8    0=DELTA … 4=GAMMA
  1   scene_id     uint8    0=trading 1=soccer 2=surfing 3=climbing 4=live
  4   theta_q      float32  controller throw arc angle
  24  cipher_icons bytes    12 × uint16 icon coordinates (flattened)
      (remaining bytes zlib-compressed VART extension)

LINK chunk (~variable, target ~300 B)
---------------------------------------
  4   trade_count  uint32
  16  origin_ref   bytes    first 16 bytes of SHA-256 of frame_id
  64  resonance    4 × 16-byte fingerprints (prev-prev / prev / cur / next-hint)
  → remaining: zlib-compressed chain signature

4-song reaction system
-----------------------
  The LINK.resonance field stores fingerprints of the temporal chain:
    slot 0: 前々回 (two-ago)  — ignites MENTE resonance trigger
    slot 1: 前回   (previous)
    slot 2: 今回   (current)
    slot 3: 次回   (next-hint, predictive fingerprint)
  When slot0 XOR slot2 produces a known resonance pattern, the
  `FLAG_CHAIN` bit (bit1) is set in the file header Flags byte.
"""

from __future__ import annotations

import hashlib
import struct
import time
import zlib
from dataclasses import dataclass, field
from typing import Optional, Sequence

# ── constants ────────────────────────────────────────────────────────────────

SPEC_REV       = "1.0"
MAGIC          = b"HDNA"
FORMAT_VERSION = 0x01

FLAG_COMPRESSED = 0x01
FLAG_CHAIN      = 0x02

CHUNK_HEAD = b"HEAD"
CHUNK_MDNA = b"MDNA"
CHUNK_VART = b"VART"
CHUNK_LINK = b"LINK"

_ERA_IDS = {
    "baroque":     0,
    "classical":   1,
    "beethoven":   2,
    "romantic":    3,
    "inner_world": 4,
}
_ID_ERAS = {v: k for k, v in _ERA_IDS.items()}

_BAND_IDS = {"DELTA": 0, "THETA": 1, "ALPHA": 2, "BETA": 3, "GAMMA": 4}
_ID_BANDS = {v: k for k, v in _BAND_IDS.items()}

_SCENE_IDS = {"trading": 0, "soccer": 1, "surfing": 2, "climbing": 3, "live": 4}
_ID_SCENES = {v: k for k, v in _SCENE_IDS.items()}

_RARITY_THRESHOLDS = [
    (0.9, 3),   # legendary  θ_q ≥ 0.9
    (0.6, 2),   # epic
    (0.3, 1),   # rare
    (0.0, 0),   # common
]

REGION_CODE_LEN  = 12
CREATOR_HASH_LEN = 20
ORIGIN_REF_LEN   = 16
RESONANCE_SLOTS  = 4
RESONANCE_FP_LEN = 16


# ── NoteEvent ────────────────────────────────────────────────────────────────

@dataclass
class NoteEvent:
    pitch:      int   # 0-127
    velocity:   int   # 0-127
    start_tick: int   # uint16
    dur_ticks:  int   # uint16

    def pack(self) -> bytes:
        return struct.pack(">BBHH", self.pitch, self.velocity,
                           self.start_tick & 0xFFFF, self.dur_ticks & 0xFFFF)

    @classmethod
    def unpack(cls, data: bytes, offset: int = 0) -> "NoteEvent":
        p, v, st, dt = struct.unpack_from(">BBHH", data, offset)
        return cls(pitch=p, velocity=v, start_tick=st, dur_ticks=dt)


# ── Chunk dataclasses ─────────────────────────────────────────────────────────

@dataclass
class HeadChunk:
    born_at_ms:    int    = 0
    region_code:   bytes  = b"JP-00" + b"\x00" * 7
    creator_hash:  bytes  = b"\x00" * CREATOR_HASH_LEN

    def pack(self) -> bytes:
        rc = (self.region_code + b"\x00" * REGION_CODE_LEN)[:REGION_CODE_LEN]
        ch = (self.creator_hash + b"\x00" * CREATOR_HASH_LEN)[:CREATOR_HASH_LEN]
        return struct.pack(">Q", self.born_at_ms) + rc + ch


@dataclass
class MdnaChunk:
    bpm:         int               = 120
    key_pc:      int               = 0
    era_id:      int               = 0
    mente_total: float             = 0.0
    timbre_id:   int               = 0
    notes:       list[NoteEvent]   = field(default_factory=list)

    def pack(self) -> bytes:
        note_bytes = b"".join(n.pack() for n in self.notes)
        compressed = zlib.compress(note_bytes, level=6)
        return struct.pack(
            ">HBBfBH",
            self.bpm & 0xFFFF,
            self.key_pc & 0x0F,
            self.era_id & 0xFF,
            self.mente_total,
            self.timbre_id & 0xFF,
            len(self.notes) & 0xFFFF,
        ) + compressed

    @classmethod
    def unpack(cls, data: bytes) -> "MdnaChunk":
        hdr_size = struct.calcsize(">HBBfBH")
        bpm, key_pc, era_id, mente, timbre, note_count = struct.unpack_from(">HBBfBH", data)
        compressed = data[hdr_size:]
        note_bytes = zlib.decompress(compressed)
        notes = [NoteEvent.unpack(note_bytes, i * 6) for i in range(note_count)]
        return cls(bpm=bpm, key_pc=key_pc, era_id=era_id,
                   mente_total=round(mente, 6), timbre_id=timbre, notes=notes)


@dataclass
class VartChunk:
    rarity:       int    = 0
    circle_seed:  int    = 0
    band_id:      int    = 2     # ALPHA
    scene_id:     int    = 0     # trading
    theta_q:      float  = 0.0
    cipher_icons: bytes  = b"\x00" * 24   # 12 × uint16

    def pack(self) -> bytes:
        base = struct.pack(
            ">BIBBf",
            self.rarity & 0xFF,
            self.circle_seed & 0xFFFFFFFF,
            self.band_id & 0xFF,
            self.scene_id & 0xFF,
            self.theta_q,
        )
        icons = (self.cipher_icons + b"\x00" * 24)[:24]
        return base + icons

    @classmethod
    def unpack(cls, data: bytes) -> "VartChunk":
        hdr = struct.calcsize(">BIBBf")
        rarity, seed, band, scene, theta = struct.unpack_from(">BIBBf", data)
        icons = data[hdr:hdr + 24] if len(data) >= hdr + 24 else b"\x00" * 24
        return cls(rarity=rarity, circle_seed=seed, band_id=band,
                   scene_id=scene, theta_q=round(theta, 6), cipher_icons=icons)


@dataclass
class LinkChunk:
    trade_count:  int    = 0
    origin_ref:   bytes  = b"\x00" * ORIGIN_REF_LEN
    resonance:    bytes  = b"\x00" * (RESONANCE_SLOTS * RESONANCE_FP_LEN)

    @property
    def chain_active(self) -> bool:
        """True when slot0 XOR slot2 produces a non-zero pattern."""
        s0 = self.resonance[:16]
        s2 = self.resonance[32:48]
        return any(a ^ b for a, b in zip(s0, s2))

    def pack(self) -> bytes:
        orig = (self.origin_ref + b"\x00" * ORIGIN_REF_LEN)[:ORIGIN_REF_LEN]
        res  = (self.resonance  + b"\x00" * (RESONANCE_SLOTS * RESONANCE_FP_LEN)
                )[:RESONANCE_SLOTS * RESONANCE_FP_LEN]
        return struct.pack(">I", self.trade_count & 0xFFFFFFFF) + orig + res

    @classmethod
    def unpack(cls, data: bytes) -> "LinkChunk":
        trade = struct.unpack_from(">I", data)[0]
        orig  = data[4:4 + ORIGIN_REF_LEN]
        res   = data[4 + ORIGIN_REF_LEN:4 + ORIGIN_REF_LEN + RESONANCE_SLOTS * RESONANCE_FP_LEN]
        return cls(trade_count=trade, origin_ref=orig, resonance=res)


# ── HdnaCard ─────────────────────────────────────────────────────────────────

@dataclass
class HdnaCard:
    """One Harmonia DNA card — a ~2 KB music DNA object."""
    head: HeadChunk
    mdna: MdnaChunk
    vart: VartChunk
    link: LinkChunk

    @property
    def era(self) -> str:
        return _ID_ERAS.get(self.mdna.era_id, "baroque")

    @property
    def band(self) -> str:
        return _ID_BANDS.get(self.vart.band_id, "ALPHA")

    @property
    def scene(self) -> str:
        return _ID_SCENES.get(self.vart.scene_id, "trading")

    @property
    def rarity_label(self) -> str:
        return ["common", "rare", "epic", "legendary"][self.vart.rarity]

    def to_dict(self) -> dict:
        return {
            "spec_rev":    SPEC_REV,
            "era":         self.era,
            "band":        self.band,
            "scene":       self.scene,
            "rarity":      self.rarity_label,
            "bpm":         self.mdna.bpm,
            "key_pc":      self.mdna.key_pc,
            "mente_total": self.mdna.mente_total,
            "theta_q":     self.vart.theta_q,
            "note_count":  len(self.mdna.notes),
            "trade_count": self.link.trade_count,
            "chain_active":self.link.chain_active,
            "origin_ref":  self.link.origin_ref.hex(),
        }


# ── encoder ───────────────────────────────────────────────────────────────────

def _write_chunk(tag: bytes, payload: bytes) -> bytes:
    assert len(tag) == 4
    if len(payload) > 65535:
        payload = zlib.compress(payload, level=9)
    return tag + struct.pack(">H", len(payload)) + payload


def encode(card: HdnaCard) -> bytes:
    """Encode an HdnaCard to .hdna binary bytes (~2 KB)."""
    flags = 0x00
    if card.link.chain_active:
        flags |= FLAG_CHAIN

    body = (
        _write_chunk(CHUNK_HEAD, card.head.pack()) +
        _write_chunk(CHUNK_MDNA, card.mdna.pack()) +
        _write_chunk(CHUNK_VART, card.vart.pack()) +
        _write_chunk(CHUNK_LINK, card.link.pack())
    )
    header  = MAGIC + struct.pack(">BB", FORMAT_VERSION, flags)
    crc     = zlib.crc32(header + body) & 0xFFFFFFFF
    return header + body + struct.pack(">I", crc)


# ── decoder ───────────────────────────────────────────────────────────────────

def decode(data: bytes) -> HdnaCard:
    """Decode .hdna bytes back to an HdnaCard.  Raises ValueError on bad magic/CRC."""
    if data[:4] != MAGIC:
        raise ValueError(f"bad magic: expected b'HDNA', got {data[:4]!r}")
    version, flags = struct.unpack_from(">BB", data, 4)
    if version != FORMAT_VERSION:
        raise ValueError(f"unsupported .hdna version 0x{version:02X}")

    # verify CRC
    stored_crc  = struct.unpack_from(">I", data, len(data) - 4)[0]
    computed    = zlib.crc32(data[:-4]) & 0xFFFFFFFF
    if stored_crc != computed:
        raise ValueError(f"CRC mismatch: stored 0x{stored_crc:08X} != computed 0x{computed:08X}")

    chunks: dict[bytes, bytes] = {}
    offset = 6   # past magic + version + flags
    while offset < len(data) - 4:  # -4 for footer CRC
        tag     = data[offset:offset + 4]
        length  = struct.unpack_from(">H", data, offset + 4)[0]
        payload = data[offset + 6: offset + 6 + length]
        chunks[tag] = payload
        offset += 6 + length

    head = HeadChunk()
    if CHUNK_HEAD in chunks:
        raw = chunks[CHUNK_HEAD]
        born_ms = struct.unpack_from(">Q", raw)[0]
        rc = raw[8:8 + REGION_CODE_LEN]
        ch = raw[8 + REGION_CODE_LEN:8 + REGION_CODE_LEN + CREATOR_HASH_LEN]
        head = HeadChunk(born_at_ms=born_ms, region_code=rc, creator_hash=ch)

    mdna = MdnaChunk.unpack(chunks[CHUNK_MDNA]) if CHUNK_MDNA in chunks else MdnaChunk()
    vart = VartChunk.unpack(chunks[CHUNK_VART]) if CHUNK_VART in chunks else VartChunk()
    link = LinkChunk.unpack(chunks[CHUNK_LINK]) if CHUNK_LINK in chunks else LinkChunk()

    return HdnaCard(head=head, mdna=mdna, vart=vart, link=link)


# ── fingerprint helpers ───────────────────────────────────────────────────────

def fingerprint(frame_id: str) -> bytes:
    """16-byte fingerprint of a frame_id for LINK.resonance slots."""
    return hashlib.sha256(frame_id.encode()).digest()[:RESONANCE_FP_LEN]


def build_resonance_chain(
    two_ago:    Optional[str] = None,
    previous:   Optional[str] = None,
    current:    Optional[str] = None,
    next_hint:  Optional[str] = None,
) -> bytes:
    """Build 64-byte resonance chain from up to 4 frame_ids."""
    slots = [two_ago, previous, current, next_hint]
    return b"".join(
        fingerprint(s) if s else b"\x00" * RESONANCE_FP_LEN
        for s in slots
    )


# ── builder from CureBmiFrame dict ───────────────────────────────────────────

def _rarity_from_theta(theta_q: float) -> int:
    for threshold, r in _RARITY_THRESHOLDS:
        if theta_q >= threshold:
            return r
    return 0


def build_hdna_card(
    frame_dict: dict,
    *,
    region_code:  str            = "JP-00",
    creator_id:   str            = "cure-oracle",
    two_ago:      Optional[str]  = None,
    previous:     Optional[str]  = None,
    next_hint:    Optional[str]  = None,
    trade_count:  int            = 0,
) -> HdnaCard:
    """Build an HdnaCard from a serialised CureBmiFrame (or KnotScoreFrame) dict.

    Accepts both CureBmiFrame.to_dict() and KnotScoreFrame-shaped dicts.
    """
    # ── HEAD ─────────────────────────────────────────────────────────────────
    born_ms      = int(time.time() * 1000)
    rc_bytes     = (region_code.encode()[:REGION_CODE_LEN] + b"\x00" * REGION_CODE_LEN
                    )[:REGION_CODE_LEN]
    creator_hash = hashlib.sha1(creator_id.encode()).digest()[:CREATOR_HASH_LEN]
    head = HeadChunk(born_at_ms=born_ms, region_code=rc_bytes, creator_hash=creator_hash)

    # ── MDNA ─────────────────────────────────────────────────────────────────
    era_str      = frame_dict.get("era", "baroque")
    ks           = frame_dict.get("knot_score", frame_dict)   # KnotScoreFrame path
    theta_q      = float(ks.get("theta_q", frame_dict.get("theta_q", 0.0)))
    mente_total  = float(frame_dict.get("mente_total", ks.get("mente_total", 0.0)))
    key_pc       = int(ks.get("knot_pitch", frame_dict.get("knot_pitch", 0))) % 12

    # derive BPM from tempo_mod: base 120 × modifier
    tempo_mod = float(frame_dict.get("tempo_mod", 1.0))
    bpm       = max(60, min(240, int(120 * tempo_mod)))

    # pack notes from strips[0] (up to 128 events to stay inside target size)
    notes: list[NoteEvent] = []
    strips = ks.get("strips", [])
    tick = 0
    for strip in strips:
        for n in strip.get("notes", [])[:32]:
            notes.append(NoteEvent(
                pitch      = int(n.get("pitch", 60)) & 0x7F,
                velocity   = int(n.get("velocity", 64)) & 0x7F,
                start_tick = tick & 0xFFFF,
                dur_ticks  = int(n.get("dur_ticks", 480)) & 0xFFFF,
            ))
            tick += int(n.get("dur_ticks", 480))

    mdna = MdnaChunk(
        bpm         = bpm,
        key_pc      = key_pc,
        era_id      = _ERA_IDS.get(era_str, 0),
        mente_total = mente_total,
        timbre_id   = int(theta_q * 127) & 0xFF,
        notes       = notes,
    )

    # ── VART ─────────────────────────────────────────────────────────────────
    band_str   = frame_dict.get("band", "ALPHA")
    scene_str  = frame_dict.get("sport_scene", {}).get("scene", "trading") \
                 if isinstance(frame_dict.get("sport_scene"), dict) \
                 else frame_dict.get("scene", "trading")
    mc         = ks.get("magic_circle", {})
    seed       = abs(hash(str(mc.get("placements", [[]])))) & 0xFFFFFFFF
    rarity     = _rarity_from_theta(theta_q)

    # 12 icon coordinates from Magic Circle placements row 0
    placements = mc.get("placements", [[0] * 12])[0]
    icon_coords = struct.pack(">12H", *[int(v * 65535) & 0xFFFF for v in placements[:12]])

    vart = VartChunk(
        rarity       = rarity,
        circle_seed  = seed,
        band_id      = _BAND_IDS.get(band_str, 2),
        scene_id     = _SCENE_IDS.get(scene_str, 0),
        theta_q      = theta_q,
        cipher_icons = icon_coords,
    )

    # ── LINK ─────────────────────────────────────────────────────────────────
    frame_id  = frame_dict.get("frame_id", "")
    orig_ref  = hashlib.sha256(frame_id.encode()).digest()[:ORIGIN_REF_LEN]
    resonance = build_resonance_chain(
        two_ago=two_ago, previous=previous,
        current=frame_id or None, next_hint=next_hint,
    )
    link = LinkChunk(trade_count=trade_count, origin_ref=orig_ref, resonance=resonance)

    return HdnaCard(head=head, mdna=mdna, vart=vart, link=link)


def encode_b64(card: HdnaCard) -> str:
    """Encode card to base64 string (safe for JSON transport)."""
    import base64
    return base64.b64encode(encode(card)).decode("ascii")


def decode_b64(s: str) -> HdnaCard:
    """Decode base64 string back to HdnaCard."""
    import base64
    return decode(base64.b64decode(s))
