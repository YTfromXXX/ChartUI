"""cure_oracle/sonnet_sdk.py — Sonnet-Score HTTP client SDK.

Wraps the Sonnet-Score API endpoints with a convenient Python interface.
Requires ``httpx`` (sync + async) — no other external dependencies.

MIDI channel mapping (箏三音域 → MIDI)
----------------------------------------
  ch0  大甲音   (highest octave)   — Dragon ascent motif
  ch1  甲音    (middle octave)    — Wand sweep
  ch2  呂音    (lower octave)     — Grid pulse
  ch3  呂音-bass                  — Candy grab anchor
"""

from __future__ import annotations

import json
from typing import Any, Callable, Iterator, Optional


# ── MIDI constants ────────────────────────────────────────────────────────────

_REGISTER_TO_CHANNEL: dict[str, int] = {
    "大甲音":    0,
    "甲音":     1,
    "呂音":     2,
    "呂音-bass": 3,
}

_MOTIF_NOTE_BASE: dict[str, int] = {
    "block_chord":    60,   # C4
    "arpeggio":       62,   # D4
    "tremolo":        64,   # E4
    "scale_run":      65,   # F4
    "staccato_burst": 67,   # G4
}

_REGISTER_OCTAVE_OFFSET: dict[str, int] = {
    "大甲音":    24,   # +2 octaves above base
    "甲音":     12,   # +1 octave
    "呂音":      0,   # base
    "呂音-bass": -12, # -1 octave
}

_PPQN = 480
_TICKS_PER_BEAT = _PPQN


# ── MIDI event builder ────────────────────────────────────────────────────────

def to_midi_events(result: dict) -> list[dict]:
    """Convert a SonnetScoreResponse (or SonnetRemixResponse) dict to MIDI events.

    Returns a list of dicts, each with:
        tick             — absolute PPQN tick (onset, based on bpm + beat position)
        channel          — MIDI channel 0–3 (register → channel)
        note             — MIDI note number 0–127
        velocity         — 0–127 (from event intensity × 127)
        duration_ticks   — note duration in PPQN ticks

    Parameters
    ----------
    result:  dict returned by SonnetScoreClient.compute() or .remix()
    """
    bpm = result.get("bpm", 120)
    events_raw = result.get("events", [])
    out: list[dict] = []

    for ev in events_raw:
        beat: float     = ev.get("beat", 1.0)
        duration: float = ev.get("duration", 1.0)
        register: str   = ev.get("register", "呂音")
        motif: str      = ev.get("motif", "scale_run")
        intensity: float = ev.get("intensity", 0.5)

        channel = _REGISTER_TO_CHANNEL.get(register, 2)
        base_note = _MOTIF_NOTE_BASE.get(motif, 60)
        octave_off = _REGISTER_OCTAVE_OFFSET.get(register, 0)
        note = max(0, min(127, base_note + octave_off))
        velocity = max(1, min(127, round(intensity * 127)))
        tick = round((beat - 1.0) * _TICKS_PER_BEAT)
        dur_ticks = round(duration * _TICKS_PER_BEAT)

        out.append({
            "tick":           tick,
            "channel":        channel,
            "note":           note,
            "velocity":       velocity,
            "duration_ticks": dur_ticks,
        })

    return out


# ── HTTP client ───────────────────────────────────────────────────────────────

class SonnetScoreClient:
    """HTTP client for the Sonnet-Score API endpoints.

    Parameters
    ----------
    base_url:   Server base URL (e.g. "http://localhost:8000")
    token:      Bearer token for OPERATOR role
    timeout:    HTTP timeout in seconds (default 30)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        token: str = "",
        timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._timeout = timeout

    # ── private helpers ───────────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json", "Accept": "application/json"}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        return h

    def _post(self, path: str, payload: dict) -> dict:
        import httpx
        url = f"{self._base_url}{path}"
        resp = httpx.post(url, json=payload, headers=self._headers(), timeout=self._timeout)
        resp.raise_for_status()
        return resp.json()

    def _get_sse(self, path: str, params: dict) -> Iterator[dict]:
        import httpx
        url = f"{self._base_url}{path}"
        with httpx.stream("GET", url, params=params, headers=self._headers(),
                          timeout=self._timeout) as resp:
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line.startswith("data:"):
                    raw = line[5:].strip()
                    if raw:
                        try:
                            yield json.loads(raw)
                        except json.JSONDecodeError:
                            pass

    # ── public API ────────────────────────────────────────────────────────────

    def compute(
        self,
        shapes: list[str],
        shots: Optional[int] = None,
        mode: str = "local",
        round_num: int = 1,
        bars: int = 4,
    ) -> dict:
        """POST /api/v1/qpu/candy/sonnet — run a Sonnet-Score computation.

        Returns the full SonnetScoreResponse dict.
        """
        payload: dict[str, Any] = {
            "shapes":    shapes,
            "mode":      mode,
            "round_num": round_num,
            "bars":      bars,
        }
        if shots is not None:
            payload["shots"] = shots
        return self._post("/api/v1/qpu/candy/sonnet", payload)

    def remix(
        self,
        shapes: list[str],
        bmi_state: Optional[dict] = None,
        shots: Optional[int] = None,
        mode: str = "local",
        round_num: int = 1,
        bars: int = 4,
        remix_style: str = "orchestral",
    ) -> dict:
        """POST /api/v1/qpu/candy/sonnet/remix — Sonnet-Score + BMI remix layer.

        Returns the full SonnetRemixResponse dict (SonnetScoreResponse + "remix" key).
        """
        payload: dict[str, Any] = {
            "shapes":      shapes,
            "mode":        mode,
            "round_num":   round_num,
            "bars":        bars,
            "remix_style": remix_style,
        }
        if shots is not None:
            payload["shots"] = shots
        if bmi_state is not None:
            payload["bmi_state"] = bmi_state
        return self._post("/api/v1/qpu/candy/sonnet/remix", payload)

    def stream(
        self,
        shapes: list[str],
        callback: Callable[[dict], None],
        round_num: int = 1,
    ) -> None:
        """GET /api/v1/qpu/candy/sonnet/stream — consume SSE score-update stream.

        Calls *callback* with each parsed JSON event dict until the stream ends
        (stream_end event) or the connection closes.

        Parameters
        ----------
        shapes:    Candy shapes to stream.
        callback:  Callable invoked with each event dict.
        round_num: Starting round number.
        """
        params: dict[str, Any] = {
            "shapes": ",".join(shapes),
            "round":  round_num,
        }
        if self._token:
            params["token"] = self._token
        for event in self._get_sse("/api/v1/qpu/candy/sonnet/stream", params):
            callback(event)
            if event.get("type") == "stream_end":
                break
