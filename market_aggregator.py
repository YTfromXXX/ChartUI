"""Unified market-data acquisition for the Major Arcana watchlist."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from math import hypot
from typing import Any, Iterable, Mapping, Sequence

import pandas as pd
import requests

from config.archetype_matrix import ARCHETYPE_MATRIX

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None  # type: ignore[assignment]

try:
    import yfinance as yf
except ImportError:
    yf = None  # type: ignore[assignment]

try:
    import ccxt
except ImportError:
    ccxt = None  # type: ignore[assignment]

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

UNIFIED_SYMBOLS: dict[int, dict[str, str]] = {
    0: {"card": "THE_FOOL", "symbol": "DOGE", "source": "crypto", "name": "Dogecoin"},
    1: {"card": "THE_MAGICIAN", "symbol": "BTCUSD", "source": "crypto", "name": "Bitcoin"},
    2: {"card": "THE_HIGH_PRIESTESS", "symbol": "EURUSD", "source": "forex", "name": "Euro / US Dollar"},
    3: {"card": "THE_EMPRESS", "symbol": "XAUUSD", "source": "mt5", "name": "Gold"},
    4: {"card": "THE_EMPEROR", "symbol": "US500", "source": "mt5", "name": "S&P 500"},
    5: {"card": "THE_HIEROPHANT", "symbol": "GBPUSD", "source": "forex", "name": "British Pound / US Dollar"},
    6: {"card": "THE_LOVERS", "symbol": "ETH", "source": "crypto", "name": "Ethereum"},
    7: {"card": "THE_CHARIOT", "symbol": "USDJPY", "source": "forex", "name": "US Dollar / Japanese Yen"},
    8: {"card": "STRENGTH", "symbol": "AAPL", "source": "stock", "name": "Apple"},
    9: {"card": "THE_HERMIT", "symbol": "XAGUSD", "source": "mt5", "name": "Silver"},
    10: {"card": "WHEEL_OF_FORTUNE", "symbol": "TSLA", "source": "stock", "name": "Tesla"},
    11: {"card": "JUSTICE", "symbol": "AUDUSD", "source": "forex", "name": "Australian Dollar / US Dollar"},
    12: {"card": "THE_HANGED_MAN", "symbol": "PEPE", "source": "crypto", "name": "Pepe"},
    13: {"card": "DEATH", "symbol": "SOL", "source": "crypto", "name": "Solana"},
    14: {"card": "TEMPERANCE", "symbol": "USDCHF", "source": "forex", "name": "US Dollar / Swiss Franc"},
    15: {"card": "THE_DEVIL", "symbol": "NVDA", "source": "stock", "name": "NVIDIA"},
    16: {"card": "THE_TOWER", "symbol": "BTCXAU", "source": "mt5", "name": "Bitcoin / Gold"},
    17: {"card": "THE_STAR", "symbol": "MSFT", "source": "stock", "name": "Microsoft"},
    18: {"card": "THE_MOON", "symbol": "USDCAD", "source": "forex", "name": "US Dollar / Canadian Dollar"},
    19: {"card": "THE_SUN", "symbol": "AMZN", "source": "stock", "name": "Amazon"},
    20: {"card": "JUDGEMENT", "symbol": "ADA", "source": "crypto", "name": "Cardano"},
    21: {"card": "THE_WORLD", "symbol": "META", "source": "stock", "name": "Meta Platforms"},
}

_COMMON_COLUMNS = ["time", "open", "high", "low", "close", "volume"]
_CRYPTO_IDS = {
    "DOGE": "dogecoin",
    "DOGEUSD": "dogecoin",
    "BTCUSD": "bitcoin",
    "AVAXUSD": "avalanche-2",
    "ETH": "ethereum",
    "ETHUSD": "ethereum",
    "PEPE": "pepe",
    "PEPEUSD": "pepe",
    "SHIBUSD": "shiba-inu",
    "SOL": "solana",
    "SOLUSD": "solana",
    "MATICUSD": "matic-network",
    "LINKUSD": "chainlink",
    "ADA": "cardano",
    "ADAUSD": "cardano",
    "LTCUSD": "litecoin",
    "XRPUSD": "ripple",
    "USDTUSD": "tether",
    "USDC": "usd-coin",
    "USDCUSD": "usd-coin",
    "LUNAUSD": "terra-luna-2",
    "APTUSD": "aptos",
}
_FOREX_YF_TICKERS = {
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "JPY=X",
    "AUDUSD": "AUDUSD=X",
    "USDCHF": "CHF=X",
    "USDCAD": "CAD=X",
}
_MT5_SYMBOLS = {"XAUUSD", "US500", "USDJPY", "XAGUSD", "DAX40", "GER40", "BTCXAU"}
_STOCK_SYMBOLS = {"AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPY", "VIX"}

# The list is deliberately explicit so a caller can replace it with the current
# S&P 500 constituents without changing the fetch pipeline.
SP500_MAJOR_SYMBOLS = (
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO", "GOOG", "TSLA", "BRK-B",
    "WMT", "JPM", "LLY", "V", "ORCL", "XOM", "MA", "COST", "NFLX", "HD", "PG", "JNJ",
    "ABBV", "BAC", "CRM", "CVX", "KO", "MRK", "AMD", "PEP", "ADBE", "TMO", "ACN", "MCD",
    "CSCO", "LIN", "ABT", "WFC", "IBM", "GE", "CAT", "INTU", "QCOM", "TXN", "AMGN", "DHR",
    "VZ", "PM", "ISRG", "NEE",
)

_COINGECKO_PAGE_SIZE = 250


class _TTLCache:
    """Small process-local cache used when Redis is not available."""

    def __init__(self, ttl_seconds: float = 30.0):
        self.ttl_seconds = max(float(ttl_seconds), 0.0)
        self._values: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            cached = self._values.get(key)
            if cached is None:
                return None
            expires_at, value = cached
            if expires_at <= time.monotonic():
                self._values.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        async with self._lock:
            ttl = self.ttl_seconds if ttl_seconds is None else max(float(ttl_seconds), 0.0)
            self._values[key] = (time.monotonic() + ttl, value)


_BROAD_MARKET_CACHE = _TTLCache()


async def _coingecko_page(session: Any, page: int, per_page: int, retries: int = 2) -> list[dict[str, Any]]:
    """Fetch one CoinGecko market page, retrying transient rate limits."""
    params = {
        "vs_currency": "usd",
        "order": "market_cap_desc",
        "per_page": per_page,
        "page": page,
        "sparkline": "true",
        "price_change_percentage": "24h",
    }
    for attempt in range(retries + 1):
        try:
            if session is None:
                response = await asyncio.to_thread(
                    requests.get,
                    "https://api.coingecko.com/api/v3/coins/markets",
                    params=params,
                    timeout=15,
                )
                response.raise_for_status()
                return response.json()
            async with session.get(
                "https://api.coingecko.com/api/v3/coins/markets", params=params
            ) as response:
                if response.status == 429:
                    raise RuntimeError("CoinGecko rate limit")
                response.raise_for_status()
                return await response.json()
        except Exception:
            if attempt == retries:
                logger.warning("CoinGecko page %s failed", page, exc_info=True)
                return []
            await asyncio.sleep(2 ** attempt)
    return []


async def fetch_top_crypto_market_data(
    limit: int = 300,
    chunk_size: int = _COINGECKO_PAGE_SIZE,
    concurrency: int = 2,
    cache_ttl: float = 30.0,
) -> list[dict[str, Any]]:
    """Fetch top crypto assets with price, volume, 24h change, and sparkline data."""
    limit = max(0, min(int(limit), 300))
    if not limit:
        return []
    chunk_size = max(1, min(int(chunk_size), _COINGECKO_PAGE_SIZE))
    cache_key = f"crypto:{limit}:{chunk_size}"
    cached = await _BROAD_MARKET_CACHE.get(cache_key)
    if cached is not None:
        return list(cached)

    pages = range(1, (limit + chunk_size - 1) // chunk_size + 1)
    semaphore = asyncio.Semaphore(max(1, int(concurrency)))

    async def worker(page: int) -> list[dict[str, Any]]:
        async with semaphore:
            if aiohttp is None:
                return await _coingecko_page(None, page, chunk_size)
            async with aiohttp.ClientSession() as session:
                return await _coingecko_page(session, page, chunk_size)

    page_results = await asyncio.gather(*(worker(page) for page in pages))
    assets: list[dict[str, Any]] = []
    for page in page_results:
        for item in page:
            symbol = str(item.get("symbol", "")).upper()
            if not symbol:
                continue
            assets.append(
                {
                    "symbol": symbol,
                    "name": item.get("name", symbol),
                    "source": "crypto",
                    "price": item.get("current_price"),
                    "volume_24h": item.get("total_volume"),
                    "change_24h": item.get("price_change_percentage_24h"),
                    "history": item.get("sparkline_in_7d", {}).get("price", []),
                    "market_cap_rank": item.get("market_cap_rank"),
                }
            )
    result = assets[:limit]
    await _BROAD_MARKET_CACHE.set(cache_key, result, ttl_seconds=cache_ttl)
    return result


def _download_yfinance_chunk(tickers: Sequence[str]) -> pd.DataFrame | None:
    if yf is None or not tickers:
        return None
    return yf.download(
        tickers=list(tickers), period="3mo", interval="1d", progress=False,
        auto_adjust=False, threads=False, group_by="column",
    )


def _stock_market_rows(frame: pd.DataFrame | None, tickers: Sequence[str]) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []
    if isinstance(frame.columns, pd.MultiIndex):
        fields = set(frame.columns.get_level_values(0))
        close = frame["Close"] if "Close" in fields else None
        volume = frame["Volume"] if "Volume" in fields else None
    else:
        close = frame.get("Close")
        volume = frame.get("Volume")
    if close is None:
        return []
    if isinstance(close, pd.Series):
        close = close.to_frame(name=tickers[0])
    if isinstance(volume, pd.Series):
        volume = volume.to_frame(name=tickers[0])
    rows: list[dict[str, Any]] = []
    for ticker in tickers:
        if ticker not in close:
            continue
        prices = pd.to_numeric(close[ticker], errors="coerce").dropna()
        if prices.empty:
            continue
        latest = float(prices.iloc[-1])
        previous = float(prices.iloc[-2]) if len(prices) > 1 else latest
        volumes = pd.to_numeric(volume[ticker], errors="coerce").dropna() if volume is not None and ticker in volume else pd.Series(dtype=float)
        rows.append(
            {
                "symbol": ticker,
                "name": ticker,
                "source": "stock",
                "price": latest,
                "volume_24h": float(volumes.iloc[-1]) if not volumes.empty else 0.0,
                "change_24h": (latest - previous) / previous * 100 if previous else 0.0,
                "history": prices.tolist(),
            }
        )
    return rows


async def fetch_sp500_market_data(
    symbols: Iterable[str] = SP500_MAJOR_SYMBOLS,
    chunk_size: int = 25,
    cache_ttl: float = 300.0,
) -> list[dict[str, Any]]:
    """Fetch S&P 500 leaders in yfinance chunks without blocking the event loop."""
    normalized = tuple(dict.fromkeys(str(symbol).upper() for symbol in symbols if symbol))
    if not normalized:
        return []
    chunk_size = max(1, int(chunk_size))
    cache_key = f"stocks:{','.join(normalized)}:{chunk_size}"
    cached = await _BROAD_MARKET_CACHE.get(cache_key)
    if cached is not None:
        return list(cached)
    chunks = [normalized[index:index + chunk_size] for index in range(0, len(normalized), chunk_size)]
    frames = await asyncio.gather(*(asyncio.to_thread(_download_yfinance_chunk, chunk) for chunk in chunks))
    rows = [row for frame, chunk in zip(frames, chunks) for row in _stock_market_rows(frame, chunk)]
    await _BROAD_MARKET_CACHE.set(cache_key, rows, ttl_seconds=cache_ttl)
    return rows


async def fetch_broad_market_data(
    crypto_limit: int = 300,
    stock_symbols: Iterable[str] = SP500_MAJOR_SYMBOLS,
) -> list[dict[str, Any]]:
    """Fetch crypto and equity universes concurrently for rhizome construction."""
    crypto, stocks = await asyncio.gather(
        fetch_top_crypto_market_data(limit=crypto_limit),
        fetch_sp500_market_data(symbols=stock_symbols),
    )
    return crypto + stocks


def _history_for_asset(asset: Mapping[str, Any], price_histories: Mapping[str, Any] | None) -> pd.Series:
    symbol = str(asset.get("symbol", ""))
    values = price_histories.get(symbol) if price_histories else asset.get("history", [])
    if isinstance(values, pd.DataFrame):
        values = values.get("close", pd.Series(dtype=float))
    return pd.to_numeric(pd.Series(values), errors="coerce").dropna()


def build_rhizome_graph(
    market_data: Sequence[Mapping[str, Any]],
    price_histories: Mapping[str, Any] | None = None,
    correlation_threshold: float = 0.6,
    volatility_similarity_threshold: float = 0.7,
) -> dict[str, list[dict[str, Any]]]:
    """Create nodes and weighted edges from return correlation and volatility proximity."""
    nodes: list[dict[str, Any]] = []
    return_series: dict[str, pd.Series] = {}
    for asset in market_data:
        symbol = str(asset.get("symbol", "")).upper()
        if not symbol:
            continue
        history = _history_for_asset(asset, price_histories)
        returns = history.pct_change().replace([float("inf"), -float("inf")], pd.NA).dropna()
        volatility = float(returns.std()) if len(returns) > 1 else float(asset.get("volatility", 0.0) or 0.0)
        return_series[symbol] = returns.rename(symbol)
        nodes.append({"id": symbol, "symbol": symbol, "name": asset.get("name", symbol), "source": asset.get("source"), "volatility": volatility})

    returns_frame = pd.concat(return_series.values(), axis=1).sort_index() if return_series else pd.DataFrame()
    correlations = returns_frame.corr(min_periods=2) if not returns_frame.empty else pd.DataFrame()
    volatility_by_symbol = {node["id"]: node["volatility"] for node in nodes}
    edges: list[dict[str, Any]] = []
    for left_index, left in enumerate(nodes):
        for right in nodes[left_index + 1:]:
            left_id, right_id = left["id"], right["id"]
            correlation = float(correlations.at[left_id, right_id]) if left_id in correlations and right_id in correlations and pd.notna(correlations.at[left_id, right_id]) else 0.0
            left_vol, right_vol = volatility_by_symbol[left_id], volatility_by_symbol[right_id]
            scale = max(abs(left_vol), abs(right_vol), 1e-12)
            volatility_similarity = max(0.0, 1.0 - abs(left_vol - right_vol) / scale)
            if abs(correlation) >= correlation_threshold or volatility_similarity >= volatility_similarity_threshold:
                weight = round(0.7 * abs(correlation) + 0.3 * volatility_similarity, 6)
                edges.append({"source": left_id, "target": right_id, "correlation": round(correlation, 6), "volatility_similarity": round(volatility_similarity, 6), "weight": weight})
    return {"nodes": nodes, "edges": edges}


def map_rhizome_to_hexagram_grid(
    graph: Mapping[str, Sequence[Mapping[str, Any]]],
    market_data: Sequence[Mapping[str, Any]] | None = None,
    price_histories: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Place graph nodes on an 8x8 hexagram grid, preserving strong branches nearby."""
    from tarot_engine import calculate_iching_weight

    assets_by_symbol = {str(asset.get("symbol", "")).upper(): asset for asset in (market_data or [])}
    edges = list(graph.get("edges", []))
    adjacency: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for edge in edges:
        source, target = str(edge["source"]), str(edge["target"])
        weight = float(edge.get("weight", 0.0))
        adjacency[source].append((target, weight))
        adjacency[target].append((source, weight))

    degrees = {str(node["id"]): len(adjacency[str(node["id"])]) for node in graph.get("nodes", [])}
    coordinates: dict[str, dict[str, Any]] = {}
    occupied_cells: set[tuple[int, int]] = set()
    ordered_nodes = sorted((str(node["id"]) for node in graph.get("nodes", [])), key=lambda symbol: (-degrees[symbol], symbol))
    for symbol in ordered_nodes:
        asset = assets_by_symbol.get(symbol, {"symbol": symbol})
        history = _history_for_asset(asset, price_histories)
        frame = pd.DataFrame({"open": history.shift(1), "close": history}).dropna().tail(6)
        iching = calculate_iching_weight(frame, "EARTH") if len(frame) >= 6 else {"hexagram_decimal": sum(map(ord, symbol)) % 64, "hexagram_binary": format(sum(map(ord, symbol)) % 64, "06b")}
        decimal = int(iching.get("hexagram_decimal") or 0) % 64
        desired = (decimal % 8, decimal // 8)
        placed_neighbors = [(coordinates[neighbor], weight) for neighbor, weight in adjacency[symbol] if neighbor in coordinates]
        candidates = [(x, y) for y in range(8) for x in range(8)]
        def score(cell: tuple[int, int]) -> float:
            base = hypot(cell[0] - desired[0], cell[1] - desired[1]) * 0.25
            neighbor_cost = sum(weight * hypot(cell[0] - item["x"], cell[1] - item["y"]) for item, weight in placed_neighbors)
            occupancy_cost = 100.0 if cell in occupied_cells and len(occupied_cells) < 64 else 0.0
            return base + neighbor_cost + occupancy_cost
        x, y = min(candidates, key=score)
        parent = max(placed_neighbors, key=lambda item: item[1])[0]["symbol"] if placed_neighbors else None
        coordinates[symbol] = {"symbol": symbol, "x": x, "y": y, "hexagram_decimal": decimal, "hexagram_binary": iching.get("hexagram_binary", format(decimal, "06b")), "parent": parent, "branch_depth": coordinates[parent]["branch_depth"] + 1 if parent else 0}
        occupied_cells.add((x, y))

    cells: dict[str, list[str]] = defaultdict(list)
    for symbol, coordinate in coordinates.items():
        cells[f"{coordinate['x']},{coordinate['y']}"].append(symbol)
    return {"grid_size": 8, "coordinates": coordinates, "cells": dict(cells), "nodes": list(graph.get("nodes", [])), "edges": edges}


def _source_for_symbol(symbol: str) -> str:
    """Infer a provider for matrix candidates that only carry a symbol name."""
    if symbol in _MT5_SYMBOLS:
        return "mt5"
    if symbol in _STOCK_SYMBOLS:
        return "stock"
    if symbol in _FOREX_YF_TICKERS:
        return "forex"
    return "crypto"


def _empty_or_normalize(frame: pd.DataFrame | None) -> pd.DataFrame | None:
    """Normalize provider output into the six-column public schema."""
    if frame is None or frame.empty:
        return None
    result = frame.copy()
    if isinstance(result.columns, pd.MultiIndex):
        result.columns = [column[0] for column in result.columns]
    result = result.reset_index()
    time_column = next((column for column in ("time", "Datetime", "Date", "index") if column in result.columns), None)
    if time_column is None:
        return None
    result = result.rename(columns={time_column: "time", "Volume": "volume", "Open": "open", "High": "high", "Low": "low", "Close": "close"})
    if "volume" not in result:
        result["volume"] = 0.0
    missing = [column for column in _COMMON_COLUMNS if column not in result.columns]
    if missing:
        return None
    result = result[_COMMON_COLUMNS].copy()
    result["time"] = pd.to_datetime(result["time"], utc=True, errors="coerce")
    for column in _COMMON_COLUMNS[1:]:
        result[column] = pd.to_numeric(result[column], errors="coerce")
    result = result.dropna(subset=["time", "open", "high", "low", "close"]).sort_values("time")
    return result.reset_index(drop=True)


def _resample_to_7m(frame: pd.DataFrame, limit: int) -> pd.DataFrame | None:
    """Aggregate provider candles to the requested seven-minute approximation."""
    normalized = _empty_or_normalize(frame)
    if normalized is None:
        return None
    indexed = normalized.set_index("time")
    result = indexed.resample("7min", origin="epoch").agg(
        open=("open", "first"), high=("high", "max"), low=("low", "min"),
        close=("close", "last"), volume=("volume", "sum"),
    ).dropna(subset=["open", "high", "low", "close"])
    return result.reset_index()[_COMMON_COLUMNS].tail(limit).reset_index(drop=True)


def _fetch_mt5(symbol_info: dict[str, str], limit: int) -> pd.DataFrame | None:
    if mt5 is None or not hasattr(mt5, "copy_rates_from_pos"):
        return None
    timeframe = getattr(mt5, "TIMEFRAME_M1", None)
    if timeframe is None:
        return None
    rates = mt5.copy_rates_from_pos(symbol_info["symbol"], timeframe, 0, max(limit * 8, 100))
    return _resample_to_7m(pd.DataFrame(rates) if rates is not None else None, limit)


def _fetch_crypto(symbol_info: dict[str, str], limit: int) -> pd.DataFrame | None:
    symbol = symbol_info["symbol"]
    coin_id = _CRYPTO_IDS.get(symbol)
    if coin_id is None:
        return None
    response = requests.get(
        f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart",
        params={"vs_currency": "usd", "days": "1"},
        timeout=10,
    )
    response.raise_for_status()
    prices = response.json().get("prices", [])
    frame = pd.DataFrame(prices, columns=["time", "close"])
    if frame.empty:
        return None
    frame["time"] = pd.to_datetime(frame["time"], unit="ms", utc=True)
    frame["open"] = frame["close"]
    frame["high"] = frame["close"]
    frame["low"] = frame["close"]
    frame["volume"] = 0.0
    return _resample_to_7m(frame, limit)


def _fetch_stock(symbol_info: dict[str, str], limit: int) -> pd.DataFrame | None:
    if yf is None:
        return None
    ticker = _FOREX_YF_TICKERS.get(symbol_info["symbol"], symbol_info["symbol"])
    frame = yf.download(tickers=ticker, period="5d", interval="5m", progress=False, auto_adjust=False, threads=False)
    return _resample_to_7m(frame, limit)


async def fetch_unified_market_data(
    symbol_info: dict[str, str], timeframe: str = "7m", limit: int = 100
) -> pd.DataFrame | None:
    """Fetch market data from MT5, CoinGecko, or yfinance in a common format.

    Network and terminal APIs are synchronous, so they run in a worker thread. Any
    unsupported source, malformed response, provider error, or rate-limit failure returns
    ``None`` rather than propagating an exception into the monitoring loop.
    """
    if not isinstance(symbol_info, dict) or limit <= 0:
        return None
    source = symbol_info.get("source")
    try:
        if source == "mt5":
            frame = await asyncio.to_thread(_fetch_mt5, symbol_info, limit)
        elif source == "crypto":
            frame = await asyncio.to_thread(_fetch_crypto, symbol_info, limit)
        elif source in {"stock", "forex"}:
            frame = await asyncio.to_thread(_fetch_stock, symbol_info, limit)
        else:
            logger.warning("Unsupported market data source: %s", source)
            return None
    except Exception as exc:
        logger.warning("Market data fetch failed for %s: %s", symbol_info.get("symbol"), exc)
        return None

    if frame is None:
        return None
    if timeframe != "7m":
        logger.info("timeframe=%s requested; returning normalized provider data near 7m.", timeframe)
    return frame.tail(limit).reset_index(drop=True)


class TarotMatrixManager:
    """Keep one healthy active market assigned to every Major Arcana slot."""

    def __init__(self, matrix: dict[int, dict[str, Any]] | None = None, refresh_seconds: float = 30.0):
        self.matrix = matrix or ARCHETYPE_MATRIX
        self.refresh_seconds = max(refresh_seconds, 1.0)
        self.active_symbols: dict[int, dict[str, Any]] = {}
        self.last_refresh: float = 0.0
        self._lock = asyncio.Lock()

    async def refresh_active_symbols(self, force: bool = False) -> dict[int, dict[str, Any]]:
        """Probe each candidate pool in order and retain the first healthy candidate."""
        now = asyncio.get_running_loop().time()
        if not force and now - self.last_refresh < self.refresh_seconds:
            return self.active_symbols.copy()

        async with self._lock:
            now = asyncio.get_running_loop().time()
            if not force and now - self.last_refresh < self.refresh_seconds:
                return self.active_symbols.copy()
            used_symbols: set[str] = set()
            for arcana_number, archetype in self.matrix.items():
                assigned = None
                for candidate in archetype["symbol_pool"]:
                    if candidate in used_symbols:
                        logger.debug("Skipping already assigned symbol %s for Arcana %s", candidate, arcana_number)
                        continue
                    symbol_info = {
                        "symbol": candidate,
                        "source": _source_for_symbol(candidate),
                        "name": candidate,
                    }
                    try:
                        frame = await fetch_unified_market_data(symbol_info, limit=2)
                    except Exception as exc:
                        logger.warning("Health check failed for %s: %s", candidate, exc)
                        frame = None
                    if frame is not None and not frame.empty:
                        assigned = {**archetype, "active_symbol": candidate, "source": symbol_info["source"]}
                        used_symbols.add(candidate)
                        break

                if assigned is not None:
                    self.active_symbols[arcana_number] = assigned
                elif arcana_number in self.active_symbols:
                    previous_symbol = self.active_symbols[arcana_number].get("active_symbol")
                    if previous_symbol not in used_symbols:
                        used_symbols.add(previous_symbol)
                        logger.warning("Keeping previous active symbol for Arcana %s", arcana_number)
                    else:
                        logger.error("No unique healthy candidate available for Arcana %s", arcana_number)
                else:
                    logger.error("No healthy candidate available for Arcana %s", arcana_number)
            self.last_refresh = now
            return self.active_symbols.copy()

    def active_assignments(self) -> dict[int, dict[str, Any]]:
        """Return the latest assignments without triggering network calls."""
        return self.active_symbols.copy()
