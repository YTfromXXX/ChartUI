"""Guarded MT5 order execution with a deterministic dry-run mode."""

from __future__ import annotations

import os
import threading
import time
from typing import Any

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

from tarot_engine import MAJOR_ARCANA_SYMBOLS


class MT5Executor:
    def __init__(self) -> None:
        self.dry_run = os.getenv("DRY_RUN", "True").lower() in {"1", "true", "yes", "on"}
        self.max_lot_size = float(os.getenv("MAX_LOT_SIZE", "0.01"))
        self.cooldown_seconds = float(os.getenv("ORDER_COOLDOWN_SECONDS", "5"))
        self.allowed_symbols = {str(entry["symbol"]).upper() for entry in MAJOR_ARCANA_SYMBOLS.values()}
        self._last_orders: dict[str, float] = {}
        self._lock = threading.Lock()

    def execute(self, symbol: str, action: str, lot_size: float = 0.01) -> dict[str, Any]:
        symbol, action = self.validate_order(symbol, action, lot_size)
        now = time.monotonic()
        with self._lock:
            if now - self._last_orders.get(symbol, 0) < self.cooldown_seconds:
                raise RuntimeError(f"duplicate order blocked for {symbol}")
            self._last_orders[symbol] = now

        if self.dry_run:
            print(f"[DRY_RUN] MT5 order symbol={symbol} action={action} lot_size={lot_size}")
            return {"status": "dry_run", "symbol": symbol, "action": action, "lot_size": lot_size}
        if mt5 is None:
            raise RuntimeError("MetaTrader5 package is unavailable")
        raise NotImplementedError("Live MT5 order request must be configured before production use")

    def validate_order(self, symbol: str, action: str, lot_size: float = 0.01) -> tuple[str, str]:
        """Validate an order without consuming its per-symbol cooldown."""
        symbol = symbol.strip().upper()
        action = action.strip().upper()
        if symbol not in self.allowed_symbols:
            raise ValueError(f"symbol is not allowed: {symbol}")
        if lot_size <= 0 or lot_size > self.max_lot_size:
            raise ValueError(f"lot_size must be between 0 and {self.max_lot_size}")
        if action not in {"LONG", "SHORT", "CLOSE"}:
            raise ValueError("action must be LONG, SHORT, or CLOSE")
        return symbol, action

    def execute_limit(self, symbol: str, action: str, limit_price: float, lot_size: float = 0.01) -> dict[str, Any]:
        """Submit a guarded limit order, or expose its payload in dry-run mode."""
        symbol, action = self.validate_order(symbol, action, lot_size)
        if limit_price <= 0:
            raise ValueError("limit_price must be greater than zero")
        now = time.monotonic()
        with self._lock:
            if now - self._last_orders.get(symbol, 0) < self.cooldown_seconds:
                raise RuntimeError(f"duplicate order blocked for {symbol}")
            self._last_orders[symbol] = now
        if self.dry_run:
            print(f"[DRY_RUN] MT5 limit symbol={symbol} action={action} price={limit_price} lot_size={lot_size}")
            return {"status": "dry_run", "symbol": symbol, "action": action, "limit_price": limit_price, "lot_size": lot_size}
        if mt5 is None:
            raise RuntimeError("MetaTrader5 package is unavailable")
        raise NotImplementedError("Live MT5 limit-order request must be configured before production use")