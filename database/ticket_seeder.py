"""Generate synthetic settlement tickets for strategy-learning experiments."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import random
from uuid import uuid4

from config.archetype_matrix import ARCHETYPE_MATRIX
from database.magic_ledger import MagicLedgerDB


DEFAULT_TICKET_COUNT = 100
PHASE_COUNTS = (40, 40, 20)
STABLE_SYMBOLS = {
    "AAPL", "AMZN", "AUDUSD", "BRK.B", "DAX30", "DAX40", "EURGBP", "EURJPY",
    "EURUSD", "GBPUSD", "IWM", "KO", "MSFT", "NAS100", "NVDA", "ORCL", "SPY",
    "TLT", "US2000", "US30", "US500", "USDCHF", "USDJPY", "USTEC", "XAGUSD",
    "XAUJPY", "XAUUSD",
}
CRYPTO_SYMBOLS = {
    "ADAUSD", "APTUSD", "ATOMUSD", "AVAXUSD", "BTCUSD", "BTCXAU", "DOGEUSD",
    "DOTUSD", "ETHUSD", "FILUSD", "LINKUSD", "LTCBTC", "LTCUSD", "LUNAUSD",
    "MATICUSD", "NEARUSD", "PEPEUSD", "SHIBUSD", "SOLUSD", "TRXUSD", "UNIUSD",
    "USDC", "USDCUSD", "USDTUSD", "XRPUSD",
}


def _all_symbols() -> list[str]:
    """Flatten the archetype matrix without introducing symbols outside its pools."""
    return sorted({symbol for entry in ARCHETYPE_MATRIX.values() for symbol in entry["symbol_pool"]})


def _pick_symbols(rng: random.Random, count: int, preferred: set[str] | None = None) -> list[str]:
    candidates = [symbol for symbol in _all_symbols() if not preferred or symbol in preferred]
    if len(candidates) < count:
        candidates = _all_symbols()
    return rng.sample(candidates, count)


def _iching_binary(rng: random.Random) -> str:
    return "".join(rng.choice("01") for _ in range(6))


def _ticket_row(rng: random.Random, phase: int, timestamp: datetime) -> tuple[object, ...]:
    if phase == 1:
        shape_type = "Hexagram"
        symbol_count = 7
        symbols = _pick_symbols(rng, symbol_count, STABLE_SYMBOLS)
        total_pnl = round(rng.uniform(25, 220) if rng.random() < 0.86 else rng.uniform(-90, -5), 2)
        mana_consumed = rng.randint(90, 220)
    elif phase == 2:
        shape_type = "Triangle"
        symbol_count = 3
        symbols = _pick_symbols(rng, symbol_count, CRYPTO_SYMBOLS)
        total_pnl = round(rng.uniform(80, 1_500) if rng.random() < 0.55 else rng.uniform(-900, -40), 2)
        mana_consumed = rng.randint(120, 420)
    else:
        shape_type = "Overload"
        symbol_count = rng.randint(11, 15)
        symbols = _pick_symbols(rng, symbol_count)
        total_pnl = round(rng.uniform(-1_800, -80) if rng.random() < 0.78 else rng.uniform(20, 300), 2)
        mana_consumed = rng.randint(700, 1_800)

    return (
        str(uuid4()),
        timestamp.isoformat(),
        shape_type,
        symbol_count,
        json.dumps(symbols, separators=(",", ":")),
        total_pnl,
        mana_consumed,
        _iching_binary(rng),
    )


def seed_tickets(
    db_path: str | Path = "magic_ledger.db",
    count: int = DEFAULT_TICKET_COUNT,
    seed: int = 20260915,
    reset: bool = False,
) -> int:
    """Insert synthetic tickets and return the number inserted."""
    if count < 3:
        raise ValueError("count must be at least 3")

    stable_count = round(count * PHASE_COUNTS[0] / DEFAULT_TICKET_COUNT)
    attack_count = round(count * PHASE_COUNTS[1] / DEFAULT_TICKET_COUNT)
    overload_count = count - stable_count - attack_count
    rng = random.Random(seed)
    ledger = MagicLedgerDB(db_path)
    with ledger._connect() as connection:
        if reset:
            connection.execute("DELETE FROM settlement_tickets")
        now = datetime.now(timezone.utc)
        rows = [
            _ticket_row(rng, phase, now - timedelta(minutes=index * rng.randint(15, 180)))
            for index, phase in enumerate(
                [1] * stable_count + [2] * attack_count + [3] * overload_count
            )
        ]
        connection.executemany(
            """
            INSERT INTO settlement_tickets
                (ticket_id, timestamp, shape_type, symbol_count, symbols_json,
                 total_pnl, mana_consumed, iching_context)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path("magic_ledger.db"))
    parser.add_argument("--count", type=int, default=DEFAULT_TICKET_COUNT)
    parser.add_argument("--seed", type=int, default=20260915)
    parser.add_argument("--reset", action="store_true", help="delete existing settlement tickets first")
    args = parser.parse_args()
    inserted = seed_tickets(args.db, args.count, args.seed, args.reset)
    print(f"Inserted {inserted} settlement tickets into {args.db}")


if __name__ == "__main__":
    main()