# Engineering fidelity Phase 2 — implementation boundaries and acceptance gates

This phase addresses the five workstreams tracked in issue #111. A UI state or schema is not evidence of a physical model. Every result must carry its model, source, units, frame, epoch and limitations.

## 1. Earth–Moon precision ephemeris

The `backend/horizonsEphemeris.mjs` adapter now queries JPL Horizons for a geocentric Moon state at a user-supplied TDB epoch. The Mission Analysis panel displays its ICRF position and velocity in SI units and records the API/kernel provenance when exposed. Formal position uncertainty is explicitly unknown when the API does not supply it. The point lookup is not yet connected to the 3D Moon renderer or a continuous local SPK kernel; the visual Moon model remains a presentation approximation.

Acceptance: documented kernel version and coverage; UTC/TT/TDB conversion tests; reference comparisons against JPL Horizons or SPICE; error budget declared for the chosen time span.

## 2. Spacecraft geometry and mass properties

`src/SpacecraftGeometryWorkbench.tsx` imports GLB, self-contained glTF, OBJ and STL meshes for local interactive inspection. It computes bounds only after the user explicitly selects source units; the preview's normalised display scale is never used as engineering dimensions. `src/engineering/massProperties.ts` combines user-entered component masses, centres of mass and diagonal intrinsic inertia values using the parallel-axis theorem. Mesh bounds do not infer density, hollow/solid volume or mass distribution. STEP must be converted to a supported mesh format before import.

Acceptance: fixtures for supported glTF/GLB/OBJ/STL inputs; unit/axis conversion; density and hollow/solid volume rules; comparison against an independent CAD mass-properties export.

## 3. Authenticated spacecraft telemetry

`backend/telemetry.mjs` verifies HMAC-SHA256 signatures over `timestamp.rawBody`, rejects stale/replayed timestamps, validates state-vector units/frame and enforces increasing per-spacecraft sequence numbers. The API exposes latest accepted telemetry from a bounded process-memory store only. It is a secure ingestion prototype, not durable telemetry operations: a database/queue, key rotation, per-spacecraft credentials, audit retention and upstream spacecraft/ground-station adapter are still required before operational use.

Acceptance: TLS, per-device secret management/rotation, durable append-only storage, replay/idempotency tests, clock-skew policy, audit trail and source-owner integration test.

## 4. Perturbed Orekit dynamics

The Orekit endpoint now supports `TWO_BODY` and `J2`. The J2 option instantiates Orekit's `J2OnlyPerturbation` with a constant WGS-84 J2 coefficient and the EME2000 +Z symmetry axis. It is a limited J2-only model: Earth pole motion/EOP, higher harmonics, drag, SRP, third-body gravity and manoeuvres are not included. The independent J2 and third-body reference functions remain separate cross-checks. The API returns the actual active force-model list.

Acceptance: one-force-at-a-time differential tests, force parameter provenance, integration tolerance convergence, and benchmark comparisons against GMAT/Orekit reference cases.

## 5. Independent numerical validation

The Orekit tests cover a known 550 km orbit, two-body energy/angular-momentum conservation and a differential J2 case that must change the propagated state. These are baseline checks, not independent truth-trajectory validation or mission-grade accuracy evidence.

Acceptance: reference truth vectors with source/version/epoch/frame, position/velocity residuals, conservation diagnostics, convergence tests and a documented error budget per scenario.

## Operational truth labels

- **Catalog estimate:** TLE/GP + SGP4, not spacecraft telemetry.
- **Authenticated telemetry:** signed external state-vector input, currently process-memory only.
- **Two-body propagation:** Orekit numerical integration with Newtonian central gravity only.
- **JPL lunar state lookup:** JPL Horizons point query in TDB/ICRF; formal uncertainty may be unknown; not yet connected to 3D scene playback.
- **Perturbed propagation:** J2-only option is active with a fixed-axis approximation; other perturbations remain unavailable until their environmental inputs are validated.

## Durable telemetry storage adapter

The telemetry store now supports an optional append-only JSONL file when `ARYAKSHA_TELEMETRY_STORE_PATH` points to a persistent mounted volume. It replays sequence state on process startup and reports its storage mode in API responses. Without that environment variable, it remains process-memory only. The current Render web service has no confirmed persistent disk attached, so production durability is **not enabled** by this code change alone. Do not set a path on an ephemeral filesystem and call it durable.

## JPL Horizons lunar state lookup

The API adapter requests a geometric Moon state relative to Earth's centre from JPL Horizons using TDB, ICRF, and km/s source output converted to SI. The Mission Analysis panel exposes a point lookup. It records the kernel ID only if the API response explicitly reports one; otherwise it displays that the kernel is unreported. The service response does not supply formal position uncertainty for this query, so uncertainty is explicitly null. This point lookup is not yet connected to the 3D Moon renderer or a continuous local SPK kernel.
