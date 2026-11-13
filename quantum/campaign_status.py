"""IBM Quantum 28-day campaign: how much real-QPU time this project has used in the last 28 days.

    python quantum/campaign_status.py            # sums qpu_seconds of real-QPU results (mode "ibm")
    python quantum/campaign_status.py --budget 600

IBM's free plan gives a limited amount of QPU time per rolling 28-day window (check the current terms
on IBM's site; this script does not contact IBM). Only results saved by the challenge scripts in
quantum/results/ with mode "ibm" are counted; local and fake rehearsals cost nothing.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--budget", type=float, default=600.0, help="seconds of QPU time per 28 days (default 600 = 10 minutes)")
    a = ap.parse_args()
    now = dt.datetime.now(dt.timezone.utc); since = now - dt.timedelta(days=28)
    used = 0.0; runs = []
    for p in sorted((HERE / "results").glob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if r.get("mode") != "ibm":
            continue
        when = dt.datetime.fromisoformat(r.get("when", "1970-01-01T00:00:00+00:00"))
        secs = float(r.get("qpu_seconds") or 0)
        if when >= since:
            used += secs; runs.append((when.date().isoformat(), p.name, secs))
    for d, name, secs in runs:
        print(f"{d}  {name}  {secs:.1f} s")
    print(f"last 28 days: {used:.1f} s of {a.budget:.0f} s ({used / a.budget * 100:.1f} %) · {len(runs)} real-QPU runs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
