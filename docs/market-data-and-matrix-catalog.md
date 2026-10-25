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

The Animal simulator uses the versioned five-asset basket (soybeans, wheat, corn, WTI, and natural gas), retaining its weighted-log-return rule while driving correlation and Kuramoto synchronization from the individual simulated return histories. Per-constituent log-return pairs provide phase estimates; the complex order parameter gives `r` and mean phase `ψ`. A high-coherence centroid is pulled toward Wheel of Fortune (X) or The World (XXI). At near-total coherence and close attractor alignment, Inventory persists the phase vector and correlation matrix; the replay control restores that recorded phase/coherence to the Candy pulse and braid renderer. Meta uses a versioned equity/FX relative basket and a second-order Butterworth low-pass filter to estimate its pulsar mass. Its 15° floor-quantized orientation uses a boundary hysteresis band; XAU/USD distance beyond the critical threshold triggers a discrete Arcana phase shift and micro-tremor. Each quantized step emits a transient ripple; an interference event records filtered mass, angle step, source/target Arcana coordinates, XAU/USD distance, and crack intensity in Inventory. When configured, the Metal quote feed supplies the Meta XAU leg; otherwise the simulator's synthetic XAU/USD proxy is explicitly labeled. The simulator emits the same contract shape as future provider-backed observations. Simulated refreshes are accelerated for animation and are not claims about actual provider cadence.

## Candy parameter mapping

Every field step now exposes common candy controls while retaining its own simulated state:

| Field | Simulation signal | Candy response |
| --- | --- | --- |
| Metal | jump flash, matrix invasion, angular velocity, daily layer step | temporary mass/radial expansion, crystal-layer growth, crack flash, modest spin and hue shift |
| Animal | basket synchronization, directional strength, Kuramoto phase and angular velocity | thicker bundled projection as synchronization rises; phase-linked rotation and green/gold tint |
| Crypto | damped order-book oscillator, high-frequency wave and log-return velocity | high-frequency vibration, responsive spin and radial modulation with violet hue |
| Meta | Butterworth-filtered index, pulsar mass, hysteretic 15° step, XAU/USD interference distance | faceted rigid-body rotation, pulsed gravitational ripple, and horizon crack flash on rupture |

The 22 `MATRIX_ROLES` each carry baseline mass, rigidity, vibration, and radial-scale values. `CandyInstancedMesh` combines those role baselines with the current field parameters; clamps bound their visual influence so extreme inputs do not create unbounded instance transforms. These values are visual simulation controls, not investment signals.

## Field animation extension points

The Metal projection is the first field with a cell-addressable 2D/3D event path. Its 8-by-6 pointy honeycomb contains exactly 48 edge-sharing cells; each cell is divided into six crystal facets. The stable `fractureCell` and `fractureLine` style values identify the same 0–47 candy cell and one of its six division rays. A timestamped jump drives the 2D boundary spark, the 3D candy shader spark, and a short-lived background lightning bolt. All event strengths are clamped and decay after the triggering timestamp.

| Field | 2D geometry extension | Source signal | 3D animation extension | Inventory/replay hook |
| --- | --- | --- | --- | --- |
| Metal | Implemented: exact 48-cell, 6-facet crystal honeycomb; selected fracture cell/line | XAU/USD resonance, matrix distance, Poisson jump, daily layer step | Implemented: division-line sparks, cell-matched candy flash, timestamped lightning | Metal jump / fracture event trace |
| Animal | Preserve shared projection; add basket-phase or synapse overlays | Commodity returns, Kuramoto order/mean phase, correlation matrix | Golden-angle action-potential propagation and braid strength | Animal synchronization phase/correlation snapshot |
| Crypto | Preserve shared projection; add volatility/resonance lensing | Hurst exponent, high-frequency noise, damped order-book oscillator | Probabilistic point-cloud births and pair-event pulse | Crypto state bounds and resonance snapshot |
| Meta | Preserve shared projection; add rigid 15° phase/ripple guides | Filtered pulsar mass, quantized step, XAU/USD interference | Rigid rotation, ripple wavefront, horizon cracks | Quantized phase-shift record |

Future field work should carry stable cell/feature IDs and event timestamps through the field style into both renderers, use bounded shader parameters, and keep the corresponding Inventory event shape replayable. A new visual must remain field-gated so it does not alter the other fields' existing projection.

## Extending the catalog

1. Add a candidate with a canonical symbol, asset class, relevant fields and role IDs, provider-specific symbol hints, candidate timeframes, quote currency, and caveats.
2. Select an explicit source contract and verify the provider instrument, timestamp semantics, licensing, and cadence before polling.
3. For a synthetic basket, define weights, return orientation, base value, timeframe, maximum age, minimum coverage, and a new composition version.
4. Add unit-level checks for stale/future data, missing constituents, insufficient coverage, FX direction, and reproducibility before connecting it to a live feed.
5. Tune candy controls from measured simulation diagnostics, preserving documented bounds and making the source/quality visible in the UI.

### Bollinger half-variance (Metal / Animal)

`calculateBollingerHalfVariance` (`lib/fieldModels.ts`) splits deviations at the moving average (n = 20, k = 2) into σ⁺ and σ⁻ and reports %b and bandwidth.

| Field | Band definition | 2D | 3D |
| --- | --- | --- | --- |
| Metal | σ⁺ adds λ·E[J²]; σ⁻ is the plain lower half-deviation | 4 cleavage lines per cell (48 cells); a tip crossing a line while %b > 0.5 emits a spark event | Rigid stepping: layered outward uplift above μ; elevator-style accelerated drop when %b falls below 0.5; sparks on the crossed cell |
| Animal | σ_θ² = 1 − r² (phase dispersion), symmetric | Seeded point cloud per cell joined as a voxel chain; golden-angle pulses; lattice squeezes toward the centre as r rises | Wormhole deformation (throat taper, peristalsis, swirl) plus Kuramoto ring (gold at r > 0.85), 5-node synaptic radar, log-spiral expansion vector at alert |

### Indicator geometry (MACD / Ichimoku)

Pure helpers in `lib/fieldModels.ts`: `calculateMacdPendulum`, `accelerateJumpIntensity`, `calculateIchimoku`, `calculateOrderParameterMacd`, `detectEcosystemCollapse`, `calculateIndicatorVelocity` (`indicator_velocity`, `target_price_projection`; driven by the velocity slider on the 2D chart).

| Indicator | Metal | Animal |
| --- | --- | --- |
| MACD | Double-pendulum phase difference; histogram = Z distortion height of the 3D honeycomb backdrop; histogram acceleration raises Poisson λ and spark count | MACD of r (short − long MA); positive expanding histogram raises synapse pulse count/speed in 2D and 3D |
| Ichimoku | Tenkan/kijun cross = knot-crossing node; cloud = tension band; cloud break = fault crack + flash | Cloud = stability zone for r; leaving it = ecosystem collapse, braid unravels into chaotic strands |
