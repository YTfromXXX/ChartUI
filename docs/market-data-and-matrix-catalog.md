# Market data and matrix catalog

## Purpose and status

`lib/marketCatalog.ts` is the engine's discovery and data-contract layer. Its 22 Matrix roles describe market functions, not a claim that each Arcana is a tradable instrument. Candidates can belong to multiple roles and fields so the explorer can represent diverse behavior without hard-wiring a unique ticker to each slot.

The catalog is curated metadata, not a live symbol search or a guarantee that a provider currently serves a symbol. `providerSymbols` and `candidateTimeframes` are discovery hints: validate them against the provider's current catalog, plan entitlements, exchange permissions, and instrument specifications before enabling a live adapter. No scraping is required by this design. Prefer documented APIs or appropriately licensed datasets; do not bypass authentication or access controls.

## Observation contract

`MarketDataContract` standardizes each observation:

- `symbol`, `value`, `currency`, and `timeframe` identify what the number means.
- `source.kind`, `source.provider`, and optional `source.instrument` provide provenance.
- `observedAt` is the provider/data observation time; `receivedAt` is the engine receipt time. Both are Unix milliseconds.
- `expectedIntervalMs` and `maxAgeMs` define expected cadence and freshness policy.
- `quality` distinguishes live, delayed, stale, and synthetic values.
- Synthetic observations include a composition version, covered weight, and the actual contributors.

`validateMarketDataContract` rejects invalid prices/timestamps, materially future-dated observations, and values older than their explicit freshness budget. A delayed or stale observation must not be silently relabeled live. Event-based and low-frequency series keep their observation/release time; they must not be interpolated into false tick-level precision.

## Synthetic index rule

For each eligible constituent, calculate its log return over a common window:

`r_i = direction_i * ln(current_i / previous_i)`

Normalize the configured weights over only fresh constituents, then aggregate:

`R = sum((w_i / sum_fresh(w)) * r_i)` and `I_t = I_(t-1) * exp(R)`

The calculation is rejected when fresh weight coverage is below the index's `minimumCoverage`, prices are invalid, or the resulting index is non-finite. FX constituents use `currencyDirection` to put returns into the basket's chosen orientation. Do not compare unsynchronized windows: align observations to the basket timeframe or exclude the stale member. Version the composition and record the contributors so historical values can be reproduced.

The Animal simulator uses the versioned five-asset basket (soybeans, wheat, corn, WTI, and natural gas), retaining its weighted-log-return rule while driving correlation and Kuramoto synchronization from the individual simulated return histories. Per-constituent log-return pairs provide phase estimates; the complex order parameter gives `r` and mean phase `ψ`. A high-coherence centroid is pulled toward Wheel of Fortune (X) or The World (XXI). At near-total coherence and close attractor alignment, Inventory persists the phase vector and correlation matrix; the replay control restores that recorded phase/coherence to the Candy pulse and braid renderer. Meta uses a versioned equity/FX relative basket and maintains the existing constituent correlation and low-pass-filter analysis. The simulator emits the same contract shape as future provider-backed observations. Simulated refreshes are accelerated for animation and are not claims about actual provider cadence.

## Candy parameter mapping

Every field step now exposes common candy controls while retaining its own simulated state:

| Field | Simulation signal | Candy response |
| --- | --- | --- |
| Metal | jump flash, matrix invasion, angular velocity, daily layer step | temporary mass/radial expansion, crystal-layer growth, crack flash, modest spin and hue shift |
| Animal | basket synchronization, directional strength, Kuramoto phase and angular velocity | thicker bundled projection as synchronization rises; phase-linked rotation and green/gold tint |
| Crypto | damped order-book oscillator, high-frequency wave and log-return velocity | high-frequency vibration, responsive spin and radial modulation with violet hue |
| Meta | filtered index return, relative dispersion, matrix rigidity and micro-tremor | heavier/rigid candy scale, low vibration, restrained radial change and blue-violet tint |

The 22 `MATRIX_ROLES` each carry baseline mass, rigidity, vibration, and radial-scale values. `CandyInstancedMesh` combines those role baselines with the current field parameters; clamps bound their visual influence so extreme inputs do not create unbounded instance transforms. These values are visual simulation controls, not investment signals.

## Extending the catalog

1. Add a candidate with a canonical symbol, asset class, relevant fields and role IDs, provider-specific symbol hints, candidate timeframes, quote currency, and caveats.
2. Select an explicit source contract and verify the provider instrument, timestamp semantics, licensing, and cadence before polling.
3. For a synthetic basket, define weights, return orientation, base value, timeframe, maximum age, minimum coverage, and a new composition version.
4. Add unit-level checks for stale/future data, missing constituents, insufficient coverage, FX direction, and reproducibility before connecting it to a live feed.
5. Tune candy controls from measured simulation diagnostics, preserving documented bounds and making the source/quality visible in the UI.
