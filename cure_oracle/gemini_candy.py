"""cure_oracle/gemini_candy.py — Gemini-Candy-Flash-API.

GeminiCandyFlash bridges the quantum accelerator (candy group / キャンディ群) and
the spiral round circuit (螺旋) to Google Gemini Flash, using the AI model as an
internal-parameter controller.

Workflow
--------
1. Run VirtualAccelerator over a candy-group shape set.
2. Run round_circuit() to obtain the spiral state.
3. Build a structured prompt from quantum results + spiral positions.
4. Call Gemini Flash and parse structured recommendations.
5. Issue a sig-receipt/1 for the full Gemini response.

Environment variable
--------------------
GEMINI_API_KEY   Your Google AI Studio / Vertex AI API key.
GEMINI_MODEL     Gemini model id (default: gemini-2.0-flash).

The key is NEVER logged, committed, or included in any response.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Optional

from cure_oracle.accelerator import AcceleratorResult, VirtualAccelerator
from cure_oracle.birth import make_sig_receipt
from cure_oracle.mente import MENTE_CONST

_log = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.0-flash"

# ── data classes ──────────────────────────────────────────────────────────────


@dataclass
class GeminiRecommendation:
    suggested_shapes:  list[str]       # e.g. ["CUBE", "CUBE", "RING"]
    suggested_shots:   int             # e.g. 8192
    suggested_theta:   str             # φ.618 / π.785 / √.414
    retest_reason:     str             # why this config improves MENTE
    commentary:        str             # full Gemini response text (Japanese)
    model_used:        str


@dataclass
class GeminiCandyResult:
    accelerator:     AcceleratorResult
    spiral:          dict               # round_circuit() output
    spiral_preview:  str                # ASCII spiral
    recommendation:  GeminiRecommendation
    observe_receipt: dict
    session_id:      str = field(default_factory=lambda: str(uuid.uuid4()))
    born_at:         str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


# ── prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(
    acc: AcceleratorResult,
    spiral: dict,
    spiral_prev: str,
    mente_const: float,
) -> str:
    """Build a structured Japanese/English prompt for Gemini."""
    runs_txt = "\n".join(
        f"  - {r.shape:5s} | q={r.q:.4f} | δ={r.delta:.4f} | slot={r.slot} "
        f"| passed={'✓' if r.passed else '✗'} | backend={r.backend}"
        for r in acc.runs
    )
    slots_txt = "\n".join(
        f"  - {slot}: q={run.q:.4f} ({run.shape})"
        for slot, run in sorted(acc.synthesized.slots.items())
    )
    missing = acc.synthesized.missing_slots or ["(なし — 四天王全顕現)"]
    events = spiral.get("events", {})
    evt_txt = ", ".join(
        f"{k}={'ON' if v else 'off'}" for k, v in events.items()
    )

    return f"""あなたは仮想量子加速器「Cure-OS / VirtualAccelerator」の最適化アシスタントです。
以下の量子回路ベンチマーク結果と螺旋状態を分析し、MENTE スコアを改善するための
内部パラメーター推薦を提供してください。

═══════════════════════════════════════════════════
§ キャンディ群 (Candy Group) — ベンチマーク結果
───────────────────────────────────────────────────
実行済み形状 ({len(acc.runs)} runs):
{runs_txt}

四天王スロット合成 (最大コヒーレンス選択):
{slots_txt}

不在スロット: {', '.join(missing)}
MENTE 合計:  {acc.synthesized.mente_total:.6f}  (閾値 φ×√2 = {mente_const:.6f})
四天王全顕現: {'✓ 達成' if acc.synthesized.mente_achieved else '✗ 未達成'}

═══════════════════════════════════════════════════
§ 螺旋 (Spiral) — ラウンド回路状態
───────────────────────────────────────────────────
ラウンド:       R{spiral.get('round', '?')}
テレポート角A:  {spiral.get('teleport_angle_a', '?')}°
テレポート角B:  {spiral.get('teleport_angle_b', '?')}°
活性ガイドA:    {', '.join(spiral.get('active_guides_a', []))}
活性ガイドB:    {', '.join(spiral.get('active_guides_b', []))}
量子イベント:   {evt_txt}

螺旋ビジュアル:
{spiral_prev}

═══════════════════════════════════════════════════
§ 推薦リクエスト
───────────────────────────────────────────────────
以下の JSON 形式で必ず返答してください（コードブロック不要、JSON のみ）:
{{
  "suggested_shapes": ["形状1", "形状2", ...],
  "suggested_shots": <整数>,
  "suggested_theta": "<φ.618|π.785|√.414>",
  "retest_reason": "<なぜこの設定で MENTE が改善されるか、1-2文>",
  "commentary": "<量子回路の状態分析と螺旋視点からの考察、3-5文、日本語>"
}}

ルール:
- suggested_shapes は CUBE / RING / TREE / LINE / STAR のみ使用可
- suggested_shapes は 1–5 要素
- 不在スロットを埋める形状を優先してください
- 螺旋のテレポート角と活性ガイドの分布を考慮してください
"""


# ── Gemini caller ─────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, api_key: str, model: str) -> str:
    """Call Gemini Flash and return raw text response."""
    from google import genai as _genai  # lazy import — not required at module level
    client = _genai.Client(api_key=api_key)
    response = client.models.generate_content(model=model, contents=prompt)
    return response.text


def _parse_recommendation(text: str, model: str) -> GeminiRecommendation:
    """Parse JSON recommendation from Gemini response text."""
    # Try to extract first {...} block
    start = text.find("{")
    end   = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"Gemini returned no JSON block: {text[:200]}")
    data = json.loads(text[start:end])

    valid_shapes = {"CUBE", "RING", "TREE", "LINE", "STAR"}
    shapes = [s for s in data.get("suggested_shapes", ["LINE"]) if s in valid_shapes]
    if not shapes:
        shapes = ["LINE"]

    theta = data.get("suggested_theta", "√.414")
    if theta not in ("φ.618", "π.785", "√.414"):
        theta = "√.414"

    shots = int(data.get("suggested_shots", 4096))
    shots = max(512, min(8192, shots))

    return GeminiRecommendation(
        suggested_shapes=shapes,
        suggested_shots=shots,
        suggested_theta=theta,
        retest_reason=str(data.get("retest_reason", "")),
        commentary=str(data.get("commentary", text)),
        model_used=model,
    )


# ── sig-receipt builder ───────────────────────────────────────────────────────

def _build_candy_receipt(
    result: GeminiCandyResult,
    api_key_hint: str,
) -> dict:
    """Build sig-receipt/1 for the Gemini-Candy session."""
    session_id = result.session_id

    # Content fingerprint — hash of Gemini commentary + mente_total (no key)
    content = (
        f"{result.recommendation.commentary}"
        f"|{result.accelerator.synthesized.mente_total:.6f}"
        f"|{result.recommendation.suggested_shapes}"
    )
    fingerprint = hashlib.sha256(content.encode()).hexdigest()

    sig_code = "CUBE-φ.618-ε.001" if result.accelerator.synthesized.mente_achieved else "LINE-√.414-ε.010"
    epsilon   = 0.001 if result.accelerator.synthesized.mente_achieved else 0.010

    cert = {
        "certificate_id": session_id,
        "born_at":         result.born_at,
        "backend":         f"cure-os/gemini-candy/{result.recommendation.model_used}",
        "qpu_seconds":     0,
        "bitstring":       fingerprint[:16],
    }
    return make_sig_receipt(cert, sig_code, epsilon, result.accelerator.synthesized.mente_total)


# ── GeminiCandyFlash ──────────────────────────────────────────────────────────


class GeminiCandyFlash:
    """Quantum accelerator + Gemini Flash parameter controller.

    Parameters
    ----------
    api_key:
        Google Generative AI key.  Falls back to GEMINI_API_KEY env var.
    model:
        Gemini model id.  Falls back to GEMINI_MODEL env var, then
        ``gemini-2.0-flash``.
    n_qubits:
        Circuit width for the accelerator.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        n_qubits: int = 4,
    ) -> None:
        self._api_key  = api_key  or os.environ.get("GEMINI_API_KEY", "")
        self._model    = model    or os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
        self._n_qubits = n_qubits

    # ── public ────────────────────────────────────────────────────────────────

    def run(
        self,
        shapes: list[str],
        shots: Optional[int] = None,
        mode: str = "local",
        round_num: int = 1,
    ) -> GeminiCandyResult:
        """Run candy-group accelerator + spiral → Gemini Flash → receipt.

        Parameters
        ----------
        shapes:
            Candy group shapes to benchmark.
        shots:
            Shots per shape.
        mode:
            Execution mode: local | fake.
        round_num:
            Spiral round number for the round_circuit call.
        """
        from cure_oracle.round_circuit import round_circuit, spiral_preview  # lazy

        # 1. Run accelerator
        acc = VirtualAccelerator(n_qubits=self._n_qubits)
        acc_result = acc.run(shapes=shapes, shots=shots, mode=mode)

        # 2. Run spiral
        spiral = round_circuit(round_num=round_num)
        s_prev = spiral_preview(spiral)

        # 3. Build prompt and call Gemini
        if not self._api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY is not set. "
                "Add it via environment settings or pass api_key= to GeminiCandyFlash()."
            )
        prompt = _build_prompt(acc_result, spiral, s_prev, MENTE_CONST)
        raw = _call_gemini(prompt, self._api_key, self._model)
        rec = _parse_recommendation(raw, self._model)

        # 4. Build result (without receipt yet — need session_id from result)
        result = GeminiCandyResult(
            accelerator=acc_result,
            spiral=spiral,
            spiral_preview=s_prev,
            recommendation=rec,
            observe_receipt={},   # placeholder; filled below
        )
        # 5. Issue sig-receipt
        result.observe_receipt = _build_candy_receipt(result, "")
        return result

    def run_offline(
        self,
        shapes: list[str],
        shots: Optional[int] = None,
        mode: str = "local",
        round_num: int = 1,
    ) -> GeminiCandyResult:
        """Same as run() but skips the Gemini call; returns a stub recommendation.

        Useful for unit tests and environments without a Gemini key.
        """
        from cure_oracle.round_circuit import round_circuit, spiral_preview

        acc = VirtualAccelerator(n_qubits=self._n_qubits)
        acc_result = acc.run(shapes=shapes, shots=shots, mode=mode)
        spiral = round_circuit(round_num=round_num)
        s_prev = spiral_preview(spiral)

        # Heuristic stub: recommend shapes that fill missing slots
        missing = acc_result.synthesized.missing_slots
        slot_shape = {"S4": "CUBE", "S1": "RING", "S3": "TREE", "S2": "LINE"}
        suggested = [slot_shape.get(s, "LINE") for s in missing] or ["LINE"]

        rec = GeminiRecommendation(
            suggested_shapes=suggested[:5],
            suggested_shots=8192,
            suggested_theta="φ.618",
            retest_reason="不在スロットを埋めるため最高フィデリティ形状を推薦します（オフライン推定）。",
            commentary=(
                "GEMINI_API_KEY が設定されていないためオフラインモードで動作しています。"
                f"不在スロット: {missing if missing else '(なし)'}。"
                "φ.618 高フィデリティ形状を使用して再テストすることを推奨します。"
            ),
            model_used="offline-stub",
        )
        result = GeminiCandyResult(
            accelerator=acc_result,
            spiral=spiral,
            spiral_preview=s_prev,
            recommendation=rec,
            observe_receipt={},
        )
        result.observe_receipt = _build_candy_receipt(result, "")
        return result
