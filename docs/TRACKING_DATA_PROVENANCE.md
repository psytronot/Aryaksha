# Satellite tracking data provenance

## Current capability

The tracking workspace obtains public GP two-line element sets from CelesTrak and propagates them using SGP4. This produces a **catalog-derived orbit estimate**. It is not a direct spacecraft telemetry feed, onboard GNSS solution, command link or radio observation.

## Required displayed provenance

- Object name and NORAD catalog number;
- source provider (CelesTrak GP catalogue or manual TLE import);
- TLE epoch (UTC);
- element age relative to the current client clock;
- catalog fetch timestamp (when fetched in this session);
- propagator (SGP4) and output frame (TEME);
- propagation timestamp and output units;
- source outage, stale element and future-epoch warnings.

## Freshness policy in the UI

- More than 72 hours from the TLE epoch: warn that prediction quality may degrade.
- More than 7 days from the TLE epoch: show a prominent stale-element warning and explicitly advise against operational reliance.
- Future TLE epoch: show a clock/source verification warning.
- Manual TLE imports do not have a catalog fetch timestamp; show that fact rather than inventing one.

These are operational warning thresholds for this product, not universal accuracy guarantees. TLE accuracy depends on object, orbit, manoeuvres, source cadence and other factors.

## Future telemetry adapters

A telemetry integration must not be inferred from a public TLE source. It requires a configured authenticated provider or user-supplied feed, documented message schema, timestamp semantics, object identity mapping, quality flags and access controls. Display observations separately from SGP4 propagated states, with clear measurement timestamps and uncertainty/quality metadata.

## Authenticated telemetry prototype

A separate API path accepts user/ground-station supplied state vectors only when HMAC-SHA256 signed with the configured server secret. It enforces a five-minute timestamp window, a documented frame/unit contract and monotonically increasing per-spacecraft sequence numbers. The latest-state read endpoint requires a separate Bearer token. This endpoint is not connected to a spacecraft, ground station, GNSS receiver or commercial tracking provider.

The store reports its persistence mode. It defaults to process memory. If `ARYAKSHA_TELEMETRY_STORE_PATH` points to a persistent mounted volume, it uses an append-only JSONL log and restores sequence state on restart. The current Render web service has no confirmed persistent volume attached, so production durability is not enabled.
