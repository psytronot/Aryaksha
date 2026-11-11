# Engineering fidelity Phase 2 — implementation boundaries and acceptance gates

This phase addresses the five workstreams tracked in issue #111. A UI state or schema is not evidence of a physical model. Every result must carry its model, source, units, frame, epoch and limitations.

## 1. Earth–Moon precision ephemeris

The new `src/engineering/ephemeris.ts` boundary accepts only provenance-complete states from a declared JPL-DE/Orekit-JPL kernel, checks the requested body/frame/time scale/epoch and refuses requests outside kernel coverage. It deliberately has no circular-orbit fallback. The current visual Moon model is still a presentation approximation until a licensed/approved DE kernel is provisioned and an Orekit adapter is connected.

Acceptance: documented kernel version and coverage; UTC/TT/TDB conversion tests; reference comparisons against JPL Horizons or SPICE; error budget declared for the chosen time span.

## 2. Spacecraft geometry and mass properties

`src/engineering/massProperties.ts` computes total mass, body-frame centre of mass and composite inertia tensor using the parallel-axis theorem. Component dimensions/meshes remain separate from mass data: mesh bounds are not mass properties. The current spacecraft JSON Schema is a configuration contract, not a CAD importer. CAD/mesh import must preserve units, axis convention, scale, component transforms and material density before mass properties can be considered geometry-derived.

Acceptance: fixtures for supported glTF/GLB/OBJ/STL inputs; unit/axis conversion; density and hollow/solid volume rules; comparison against an independent CAD mass-properties export.

## 3. Authenticated spacecraft telemetry

`backend/telemetry.mjs` verifies HMAC-SHA256 signatures over `timestamp.rawBody`, rejects stale/replayed timestamps, validates state-vector units/frame and enforces increasing per-spacecraft sequence numbers. The API exposes latest accepted telemetry from a bounded process-memory store only. It is a secure ingestion prototype, not durable telemetry operations: a database/queue, key rotation, per-spacecraft credentials, audit retention and upstream spacecraft/ground-station adapter are still required before operational use.

Acceptance: TLS, per-device secret management/rotation, durable append-only storage, replay/idempotency tests, clock-skew policy, audit trail and source-owner integration test.

## 4. Perturbed Orekit dynamics

The production Orekit endpoint remains explicitly two-body. J2, third-body gravity, atmospheric drag, solar radiation pressure and manoeuvres must be enabled only with validated gravity coefficients, planetary ephemerides, space-weather/atmosphere inputs, spacecraft area/mass/reflectivity and thrust models. Do not add force names to a response unless those models were actually instantiated in the propagator.

Acceptance: one-force-at-a-time differential tests, force parameter provenance, integration tolerance convergence, and benchmark comparisons against GMAT/Orekit reference cases.

## 5. Independent numerical validation

The existing Orekit reference tests cover a known 550 km orbit and state-vector finiteness. Phase 2 adds an independent conservation-based validation suite for two-body propagation. This is a baseline only; it does not validate perturbed dynamics or establish mission-grade accuracy.

Acceptance: reference truth vectors with source/version/epoch/frame, position/velocity residuals, conservation diagnostics, convergence tests and a documented error budget per scenario.

## Operational truth labels

- **Catalog estimate:** TLE/GP + SGP4, not spacecraft telemetry.
- **Authenticated telemetry:** signed external state-vector input, currently process-memory only.
- **Two-body propagation:** Orekit numerical integration with Newtonian central gravity only.
- **Precision ephemeris:** unavailable until a real DE kernel and provider adapter are provisioned.
- **Perturbed propagation:** unavailable until the corresponding force models and environmental inputs are validated.

## Durable telemetry storage adapter

The telemetry store now supports an optional append-only JSONL file when `ARYAKSHA_TELEMETRY_STORE_PATH` points to a persistent mounted volume. It replays sequence state on process startup and reports its storage mode in API responses. Without that environment variable, it remains process-memory only. The current Render web service has no confirmed persistent disk attached, so production durability is **not enabled** by this code change alone. Do not set a path on an ephemeral filesystem and call it durable.

## JPL Horizons lunar state lookup

The API adapter requests a geometric Moon state relative to Earth's centre from JPL Horizons using TDB, ICRF, and km/s source output converted to SI. The Mission Analysis panel exposes a point lookup. It records the kernel ID only if the API response explicitly reports one; otherwise it displays that the kernel is unreported. The service response does not supply formal position uncertainty for this query, so uncertainty is explicitly null. This point lookup is not yet connected to the 3D Moon renderer or a continuous local SPK kernel.
