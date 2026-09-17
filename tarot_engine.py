"""Tarot market mappings and minor arcana signal classification."""

from datetime import datetime
from math import atan, ceil, exp, isfinite, log10, pi, sqrt
from typing import Any, Dict, List, Mapping, Sequence, TypedDict

import pandas as pd

from config.archetype_matrix import ARCHETYPE_MATRIX


class MajorArcanaSymbol(TypedDict):
    card: str
    symbol: str
    element: str


MAJOR_ARCANA_SYMBOLS: Dict[int, MajorArcanaSymbol] = {
    0: {"card": "0_THE_FOOL", "symbol": "DOGEUSD", "element": "AIR"},
    1: {"card": "1_THE_MAGICIAN", "symbol": "BTCUSD", "element": "FIRE"},
    2: {"card": "2_THE_HIGH_PRIESTESS", "symbol": "EURUSD", "element": "WATER"},
    3: {"card": "3_THE_EMPRESS", "symbol": "XAUUSD", "element": "EARTH"},
    4: {"card": "4_THE_EMPEROR", "symbol": "US500", "element": "FIRE"},
    5: {"card": "5_THE_HIEROPHANT", "symbol": "GBPUSD", "element": "EARTH"},
    6: {"card": "6_THE_LOVERS", "symbol": "ETHUSD", "element": "AIR"},
    7: {"card": "7_THE_CHARIOT", "symbol": "NAS100", "element": "WATER"},
    8: {"card": "8_STRENGTH", "symbol": "US30", "element": "FIRE"},
    9: {"card": "9_THE_HERMIT", "symbol": "USDJPY", "element": "EARTH"},
    10: {"card": "10_WHEEL_OF_FORTUNE", "symbol": "SOLUSD", "element": "AIR"},
    11: {"card": "11_JUSTICE", "symbol": "AUDUSD", "element": "AIR"},
    12: {"card": "12_THE_HANGED_MAN", "symbol": "XAGUSD", "element": "WATER"},
    13: {"card": "13_DEATH", "symbol": "LTCUSD", "element": "WATER"},
    14: {"card": "14_TEMPERANCE", "symbol": "USDCHF", "element": "WATER"},
    15: {"card": "15_THE_DEVIL", "symbol": "XRPUSD", "element": "FIRE"},
    16: {"card": "16_THE_TOWER", "symbol": "BTCXAU", "element": "FIRE"},
    17: {"card": "17_THE_STAR", "symbol": "NZDUSD", "element": "AIR"},
    18: {"card": "18_THE_MOON", "symbol": "USDCAD", "element": "WATER"},
    19: {"card": "19_THE_SUN", "symbol": "DAX40", "element": "FIRE"},
    20: {"card": "20_JUDGEMENT", "symbol": "ADAUSD", "element": "AIR"},
    21: {"card": "21_THE_WORLD", "symbol": "GER40", "element": "EARTH"},
}

WATCHLIST_SYMBOLS: List[str] = [entry["symbol"] for entry in MAJOR_ARCANA_SYMBOLS.values()]

_PERSONA_RANKS = ((50, "PAGE"), (150, "KNIGHT"), (300, "QUEEN"))


def generate_ticket_persona(symbols_data: list[dict[str, Any]], total_mana: int) -> dict[str, str]:
    """Derive a deterministic tarot persona and gravity field for a package ticket."""
    if not symbols_data:
        raise ValueError("symbols_data must contain at least one symbol")
    if total_mana < 0:
        raise ValueError("total_mana must not be negative")

    elements: list[str] = []
    hexagrams: list[str] = []
    for item in symbols_data:
        symbol = str(item.get("symbol", "")).strip().upper()
        mapped = next((entry for entry in MAJOR_ARCANA_SYMBOLS.values() if entry["symbol"] == symbol), None)
        element = str(item.get("element") or (mapped["element"] if mapped else "EARTH")).upper()
        if element not in {"FIRE", "WATER", "AIR", "EARTH", "METAL"}:
            element = "EARTH"
        elements.append(element)

        binary = str(item.get("hexagram_binary") or item.get("hexagram") or "").strip()
        if len(binary) == 6 and set(binary) <= {"0", "1"}:
            hexagrams.append(binary)

    element_order = ("FIRE", "WATER", "AIR", "EARTH", "METAL")
    element_counts = {element: elements.count(element) for element in element_order}
    primary_element = max(element_order, key=lambda element: (element_counts[element], -element_order.index(element)))
    representative = "".join(
        "1" if sum(binary[index] == "1" for binary in hexagrams) * 2 >= len(hexagrams) else "0"
        for index in range(6)
    ) if hexagrams else "000000"
    yang_count = representative.count("1")
    yin_count = representative.count("0")
    gravity_type = "EXPANSIVE" if yang_count > yin_count else "CONTRACTIVE" if yin_count > yang_count else "BALANCED"
    rank = next((rank for threshold, rank in _PERSONA_RANKS if total_mana <= threshold), "KING")
    return {
        "persona_name": f"{rank}_OF_{primary_element}",
        "hexagram": representative,
        "gravity_type": gravity_type,
    }

ELEMENT_FIELD_COEFFICIENTS: dict[str, float] = {
    "FIRE": 1.5,
    "AIR": 1.2,
    "WATER": 0.8,
    "EARTH": 0.5,
}


def get_archetype_parameters(element: str, card_name: str) -> dict[str, float]:
    parameters = {
        "rsi_overbought": 80.0,
        "rsi_oversold": 20.0,
        "bbw_squeeze_threshold": 0.02,
        "delta_tolerance": 0.0005,
        "breakout_sensitivity": 1.0,
    }
    normalized_element = element.upper()
    normalized_card = card_name.upper()

    if normalized_element in {"FIRE", "AIR"}:
        parameters.update(rsi_overbought=85.0, rsi_oversold=15.0, delta_tolerance=0.001)
    elif normalized_element in {"EARTH", "WATER"}:
        parameters["bbw_squeeze_threshold"] = 0.015

    if normalized_card in {"0_THE_FOOL", "THE_FOOL"}:
        parameters["rsi_overbought"] = 90.0
    elif normalized_card in {"16_THE_TOWER", "THE_TOWER"}:
        parameters["breakout_sensitivity"] = 0.8

    return parameters


def _card_context(card_name: str | None = None, symbol: str | None = None) -> tuple[str, str]:
    """Resolve an element/card pair from an explicit card or mapped symbol."""
    if card_name:
        normalized_card = card_name.upper()
        for entry in MAJOR_ARCANA_SYMBOLS.values():
            if entry["card"].upper() == normalized_card or entry["card"].upper().endswith(f"_{normalized_card}"):
                return entry["element"], entry["card"]
        return "EARTH", card_name
    if symbol:
        for entry in MAJOR_ARCANA_SYMBOLS.values():
            if entry["symbol"] == symbol:
                return entry["element"], entry["card"]
    return "EARTH", ""


def _strength_1_to_10(value: float) -> int:
    """Clamp a normalized score to the ten minor-card strengths."""
    return max(1, min(10, ceil(value * 10)))


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Calculate Wilder-style RSI without requiring a third-party indicator package."""
    delta = close.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    average_gain = gains.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    average_loss = losses.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    relative_strength = average_gain / average_loss.replace(0, float("nan"))
    result = 100 - (100 / (1 + relative_strength))
    result = result.mask((average_loss == 0) & (average_gain > 0), 100)
    result = result.mask((average_loss == 0) & (average_gain == 0), 50)
    return result


def calculate_minor_arcana(df_m7: pd.DataFrame, card_name: str | None = None, symbol: str | None = None) -> str | None:
    """Classify the latest M7 candle as a numbered Minor Arcana card.

    Wands represent an overheated breakout above the upper two-sigma band. Cups
    represent an inner-band squeeze. The remaining states are assigned to Pentacles
    for balanced or recovering conditions and Swords for bearish pressure.
    """
    if "close" not in df_m7.columns or len(df_m7) < 50:
        return None

    context_card = card_name or df_m7.attrs.get("card_name")
    context_symbol = symbol or df_m7.attrs.get("symbol")
    element, resolved_card = _card_context(context_card, context_symbol)
    parameters = get_archetype_parameters(element, resolved_card)

    close = pd.to_numeric(df_m7["close"], errors="coerce")
    if close.isna().any():
        close = close.dropna()
    if len(close) < 50:
        return None

    sma20 = close.rolling(window=20, min_periods=20).mean()
    std20 = close.rolling(window=20, min_periods=20).std()
    bbw = ((sma20 + (2 * std20)) - (sma20 - (2 * std20))) / sma20.abs().replace(0, float("nan"))
    rsi = _rsi(close)
    metrics = pd.DataFrame(
        {
            "close": close,
            "sma20": sma20,
            "std20": std20,
            "bbw": bbw,
            "rsi": rsi,
        }
    ).dropna()
    if len(metrics) < 50:
        return None

    latest = metrics.iloc[-1]
    recent_bbw = metrics["bbw"].tail(50)
    current_close = float(latest["close"])
    sma_value = float(latest["sma20"])
    std_value = float(latest["std20"])
    current_bbw = float(latest["bbw"])
    average_bbw = float(recent_bbw.mean())
    minimum_bbw = float(recent_bbw.min())
    current_rsi = float(latest["rsi"])
    upper1 = sma_value + std_value
    lower1 = sma_value - std_value
    upper2 = sma_value + (2 * std_value)
    lower2 = sma_value - (2 * std_value)

    # Fire strength combines RSI heat and the distance beyond +2 sigma.
    breakout_distance = (current_close - upper2) / max(std_value, 1e-12)
    if current_close > upper2 and current_rsi >= parameters["rsi_overbought"]:
        rsi_range = max(100.0 - parameters["rsi_overbought"], 1.0)
        rsi_score = max(0.0, min(1.0, (current_rsi - parameters["rsi_overbought"]) / rsi_range))
        breakout_score = max(0.0, min(1.0, breakout_distance / parameters["breakout_sensitivity"]))
        return f"WANDS_{_strength_1_to_10((rsi_score + breakout_score) / 2)}"

    # Water requires both inner-band containment and a narrowing band.
    if lower1 <= current_close <= upper1 and current_bbw <= parameters["bbw_squeeze_threshold"] and current_bbw <= average_bbw:
        if current_bbw == 0 and average_bbw == 0:
            contraction_score = 1.0
        else:
            contraction_score = max(0.0, min(1.0, (average_bbw - current_bbw) / max(average_bbw - minimum_bbw, 1e-12)))
        return f"CUPS_{_strength_1_to_10(contraction_score)}"

    # Swords captures a confirmed downside expansion or clearly bearish momentum.
    if current_close < lower2 or (current_close < sma_value and current_rsi < parameters["rsi_oversold"] + 25):
        pressure_score = max(0.0, min(1.0, (lower2 - current_close) / max(std_value, 1e-12)))
        rsi_score = max(0.0, min(1.0, (45 - current_rsi) / 30))
        return f"SWORDS_{_strength_1_to_10(max(pressure_score, rsi_score))}"

    # Pentacles is the neutral/reversion fallback for all non-breakout conditions.
    return "PENTACLES_1" if sma_value == 0 else f"PENTACLES_{_strength_1_to_10(max(0.0, 1 - abs(current_close - sma_value) / max(std_value * 2, 1e-12)))}"


def detect_knots(
    df_m7: pd.DataFrame,
    price_tolerance: float | None = None,
    card_name: str | None = None,
    symbol: str | None = None,
) -> list[dict[str, Any]]:
    """Detect separated, volume-depleted double tops using archetype tolerance."""
    if "high" not in df_m7.columns or len(df_m7) < 3:
        return []
    element, resolved_card = _card_context(card_name, symbol or df_m7.attrs.get("symbol"))
    parameters = get_archetype_parameters(element, resolved_card)
    tolerance = price_tolerance if price_tolerance is not None else parameters["delta_tolerance"]
    volume_column = "tick_volume" if "tick_volume" in df_m7.columns else "volume"
    if volume_column not in df_m7.columns:
        return []

    peaks = [
        index for index in range(1, len(df_m7) - 1)
        if df_m7["high"].iloc[index] > df_m7["high"].iloc[index - 1]
        and df_m7["high"].iloc[index] >= df_m7["high"].iloc[index + 1]
    ]
    knots: list[dict[str, Any]] = []
    for first_position, first_peak in enumerate(peaks):
        for second_peak in peaks[first_position + 1:]:
            if second_peak - first_peak < 4:
                continue
            first_price = float(df_m7["high"].iloc[first_peak])
            second_price = float(df_m7["high"].iloc[second_peak])
            if abs(second_price - first_price) / max(abs(first_price), 1e-12) > tolerance:
                continue
            if float(df_m7[volume_column].iloc[second_peak]) >= float(df_m7[volume_column].iloc[first_peak]):
                continue
            knots.append({
                "knot_time": df_m7.index[second_peak],
                "top1_time": df_m7.index[first_peak],
                "top1_price": first_price,
                "top2_price": second_price,
            })
            break
    return knots


def evaluate_court_card(
    minor_card: str | None,
    micro_status: str | None,
    macro_status: str | None,
) -> str | None:
    """Promote a high-strength Wands card to a Knight or King court card.

    ``FILLING`` represents the S15 pressure trigger. A confirmed macro direction
    promotes the same synchronized setup from Knight to King. Other minor cards are
    returned unchanged so the function can be used directly in a signal pipeline.
    """
    if minor_card is None:
        return None

    normalized_minor = minor_card.upper()
    normalized_micro = (micro_status or "").upper()
    normalized_macro = (macro_status or "").upper()
    is_high_wands = normalized_minor in {f"WANDS_{strength}" for strength in range(8, 11)}
    if not is_high_wands or normalized_micro != "FILLING":
        return minor_card

    confirmed_macro = normalized_macro in {
        "DOWN",
        "DOWN_CONFIRMED",
        "UP",
        "UP_CONFIRMED",
    }
    if confirmed_macro:
        return "KING_OF_WANDS"
    return "KNIGHT_OF_WANDS"


ICHING_SYMBOLS = [
    "䷀", "䷁", "䷂", "䷃", "䷄", "䷅", "䷆", "䷇", "䷈", "䷉", "䷊", "䷋", "䷌", "䷍", "䷎", "䷏",
    "䷐", "䷑", "䷒", "䷓", "䷔", "䷕", "䷖", "䷗", "䷘", "䷙", "䷚", "䷛", "䷜", "䷝", "䷞", "䷟",
    "䷠", "䷡", "䷢", "䷣", "䷤", "䷥", "䷦", "䷧", "䷨", "䷩", "䷪", "䷫", "䷬", "䷭", "䷮", "䷯",
    "䷰", "䷱", "䷲", "䷳", "䷴", "䷵", "䷶", "䷷", "䷸", "䷹", "䷺", "䷻", "䷼", "䷽", "䷾", "䷿",
]

_ICHING_COLORS = ("#0B1F33", "#123C4A", "#2B5D4F", "#667A3E", "#A77B35", "#9C4A3C", "#5C315D", "#E0B44C")


def _market_value(data: Mapping[str, Any], *names: str, default: float = 0.0) -> float:
    """Read the first finite numeric market field, treating bad feeds as missing."""
    for name in names:
        try:
            value = float(data.get(name, default))
            if pd.notna(value):
                return value
        except (TypeError, ValueError):
            continue
    return default


def _sigmoid(value: float) -> float:
    value = max(-60.0, min(60.0, value))
    return 1.0 / (1.0 + exp(-value))


def calculate_physics_parameters(market_data: Mapping[str, Any]) -> dict[str, float | bool]:
    """Convert normalized market fields into the 3D chart physics contract.

    ``market_data`` may contain scalar indicators and/or ``history`` (a DataFrame).
    Missing optional indicators use neutral values so a provider outage cannot emit NaN.
    """
    history = market_data.get("history")
    frame = history if isinstance(history, pd.DataFrame) else pd.DataFrame()
    close = pd.to_numeric(frame.get("close", pd.Series(dtype=float)), errors="coerce").dropna()
    volume = pd.to_numeric(frame.get("volume", frame.get("tick_volume", pd.Series(dtype=float))), errors="coerce").dropna()
    current_price = _market_value(market_data, "price", "close", default=float(close.iloc[-1]) if not close.empty else 1.0)
    previous_price = _market_value(market_data, "previous_close", default=float(close.iloc[-2]) if len(close) > 1 else current_price)
    short_return = _market_value(market_data, "short_return", "price_change_rate", default=(current_price - previous_price) / max(abs(previous_price), 1e-12))
    rsi = _market_value(market_data, "rsi", default=float(_rsi(close).iloc[-1]) if len(close) >= 15 and pd.notna(_rsi(close).iloc[-1]) else 50.0)

    market_cap = max(_market_value(market_data, "market_cap", "market_capitalization", default=current_price), 1e-12)
    volume_24h = max(_market_value(market_data, "volume_24h", "quote_volume", default=float(volume.tail(24).sum()) if not volume.empty else 1.0), 1e-12)
    thickness_r = log10(1.0 + market_cap) / max(log10(1.0 + volume_24h), 1e-12)

    tension_t = abs(short_return) * 100.0 + abs(rsi - 50.0) / 50.0
    if len(close) >= 20:
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        bandwidth = float((4 * std20.iloc[-1]) / max(abs(sma20.iloc[-1]), 1e-12))
        baseline = float(((4 * std20) / sma20.abs().replace(0, float("nan"))).dropna().tail(20).mean())
        complexity_c = _sigmoid((bandwidth / max(baseline, 1e-12) - 1.0) * 3.0)
        short_ma = float(close.rolling(5).mean().iloc[-1])
        long_ma = float(close.rolling(20).mean().iloc[-1])
    else:
        bandwidth = _market_value(market_data, "bollinger_bandwidth", "bbw")
        baseline = max(_market_value(market_data, "bollinger_baseline", default=bandwidth), 1e-12)
        complexity_c = _sigmoid((bandwidth / baseline - 1.0) * 3.0)
        short_ma = _market_value(market_data, "short_ma", "ma_short", default=current_price)
        long_ma = _market_value(market_data, "long_ma", "ma_long", default=current_price)

    ma_divergence = (short_ma - long_ma) / max(abs(long_ma), 1e-12)
    macd_histogram = _market_value(market_data, "macd_histogram", "macd_hist", default=ma_divergence * current_price)
    macd_scale = max(abs(current_price), 1e-12)
    tornado_tilt_deg = (180.0 / pi) * atan((ma_divergence * 10.0) + (macd_histogram / macd_scale * 10.0))
    bid_volume = _market_value(market_data, "bid_volume", "buy_volume")
    ask_volume = _market_value(market_data, "ask_volume", "sell_volume")
    imbalance = (bid_volume - ask_volume) / max(bid_volume + ask_volume, 1e-12) if bid_volume + ask_volume else 0.0
    return {
        "thickness_r": round(max(0.0, thickness_r), 6),
        "tension_t": round(max(0.0, tension_t), 6),
        "complexity_c": round(max(0.0, min(1.0, complexity_c)), 6),
        "tornado_tilt_deg": round(tornado_tilt_deg, 6),
        "gravity_g": round(max(-1.0, min(1.0, imbalance)), 6),
        "trigger_firework": abs(tornado_tilt_deg) > 45.0,
    }


def map_market_archetype(symbol: str, physics: Mapping[str, Any]) -> dict[str, str | int]:
    """Map the configured Major Arcana matrix and knot model to current conditions."""
    normalized = symbol.upper()
    arcana = next((number for number, entry in ARCHETYPE_MATRIX.items() if normalized in entry["symbol_pool"]), None)
    if arcana is None:
        volatility = float(physics.get("complexity_c", 0.5))
        tilt = abs(float(physics.get("tornado_tilt_deg", 0.0)))
        arcana = 16 if tilt > 45 else 10 if volatility < 0.35 else 1
    entry = ARCHETYPE_MATRIX[arcana]
    knot_model = {"本結び": "honda_knot", "らせん結び": "spiral_knot"}.get(entry["knot_type"], entry["knot_type"])
    return {"major_arcana": arcana, "knot_model": knot_model}


def calculate_iching_visuals(volatility: float, timestamp: datetime | None = None) -> dict[str, str]:
    """Select a deterministic 64-hexagram symbol and seasonal background color."""
    moment = timestamp or datetime.utcnow()
    seasonal = (moment.month - 1) // 3
    normalized = max(0.0, min(1.0, float(volatility)))
    decimal = (int(round(normalized * 63.0)) + seasonal * 7) % 64
    color_index = (decimal // 8 + seasonal) % len(_ICHING_COLORS)
    return {"i_ching_hexagram_symbol": ICHING_SYMBOLS[decimal], "background_hex": _ICHING_COLORS[color_index]}


def analyze_4d_timeline(symbol: str, target_time: datetime | str) -> dict[str, Any]:
    """Compare scalp-oriented market states across four deterministic time layers.

    A live adapter can replace ``_timeline_snapshot`` with OHLCV history later. The
    fallback is intentionally deterministic so backtests, API responses, and UI demos
    produce the same result for the same symbol and target timestamp.
    """
    moment = datetime.fromisoformat(target_time) if isinstance(target_time, str) else target_time
    if not isinstance(moment, datetime):
        raise TypeError("target_time must be a datetime or ISO-8601 string")
    normalized_symbol = str(symbol).strip().upper()
    if not normalized_symbol:
        raise ValueError("symbol must not be empty")

    layers = {
        "T-40m": moment - pd.Timedelta(minutes=40).to_pytimedelta(),
        "T-4h": moment - pd.Timedelta(hours=4).to_pytimedelta(),
        "T-target": moment,
        "T-best": moment - pd.Timedelta(days=((sum(map(ord, normalized_symbol)) % 17) + 1)).to_pytimedelta(),
    }

    snapshots: dict[str, dict[str, Any]] = {}
    seed = sum((index + 1) * ord(character) for index, character in enumerate(normalized_symbol))
    for index, (layer, timestamp) in enumerate(layers.items()):
        time_seed = int(timestamp.timestamp() // 60)
        volatility = ((seed * 17 + time_seed * 13 + index * 29) % 1000) / 1000.0
        decimal = (seed + time_seed // 5 + index * 11) % 64
        binary = format(decimal, "06b")
        snapshots[layer] = {
            "timestamp": timestamp.isoformat(),
            "hexagram_decimal": decimal,
            "hexagram_binary": binary,
            "hexagram_symbol": ICHING_SYMBOLS[decimal],
            "volatility": round(volatility, 6),
        }

    baseline = snapshots["T-target"]
    distortions: dict[str, dict[str, float | int]] = {}
    for layer, snapshot in snapshots.items():
        if layer == "T-target":
            continue
        volatility_delta = round(snapshot["volatility"] - baseline["volatility"], 6)
        hexagram_delta = int(snapshot["hexagram_decimal"]) - int(baseline["hexagram_decimal"])
        distortions[layer] = {
            "volatility_delta": volatility_delta,
            "hexagram_delta": hexagram_delta,
            "distance": round(abs(volatility_delta) + abs(hexagram_delta) / 63.0, 6),
        }

    short_term = float(distortions["T-40m"]["volatility_delta"])
    meso_term = float(distortions["T-4h"]["volatility_delta"])
    ideal_term = float(distortions["T-best"]["volatility_delta"])
    convergence_score = max(-1.0, min(1.0, ideal_term * 0.5 - short_term * 0.3 - meso_term * 0.2))
    direction = "EXPANDING" if convergence_score > 0.12 else "CONTRACTING" if convergence_score < -0.12 else "BALANCED"

    return {
        "symbol": normalized_symbol,
        "target_time": moment.isoformat(),
        "layers": snapshots,
        "distortions": distortions,
        "convergence": {
            "score": round(convergence_score, 6),
            "direction": direction,
            "note": "Positive values lean toward the best historical fractal; negative values lean toward compression.",
        },
    }
