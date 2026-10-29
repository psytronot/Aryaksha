# Orbit Analysis API — v1

This document defines the current request/response contract for preliminary orbit analysis.

## Endpoints

- `GET /api/v1/health` — service health and engine/version metadata.
- `POST /api/mission-analysis/orbit` — hosted Aryaksha backend proxy for orbit analysis. It calls the separately hosted Orekit service and returns an `orekit-http` adapter marker.
- `POST /api/v1/orbit/analysis` — direct Orekit service endpoint.

The request and successful response use the schemas in `schemas/`. Errors use `api-error.v1.schema.json`.

## Request

All fields are required; additional fields are rejected by schema v1.

| Field | Unit | Constraint |
|---|---|---|
| `altitudeKm` | km above the WGS-84 equatorial radius | 120–100,000 |
| `inclinationDeg` | degrees | 0–180 |
| `eccentricity` | dimensionless | 0 ≤ e < 1 |

Example:

```json
{
  "altitudeKm": 550,
  "inclinationDeg": 97.6,
  "eccentricity": 0.001
}
```

The service also performs a cross-field periapsis check and rejects an orbit that intersects Earth. A schema-valid request can still fail that physical constraint.

## Successful response

- `engine` / `engineVersion`: identify Orekit 13.1.9.
- `fidelity`: currently `Orekit Keplerian propagation (two-body)`; this is not a full perturbation model.
- `orbit`: orbital metrics, in the units expressed by their field names.
- `state`: Cartesian position in km and velocity in km/s, in the `EME2000` frame. The `epoch` string is expressed in `TAI` and the `timeScale` field is authoritative; do not append `Z` or interpret it as UTC.
- `comparison`: confirms the HTTP adapter and whether the external engine was connected.

The current state is evaluated at the J2000 epoch with zero elapsed seconds. The model does not configure J2, atmospheric drag, solar radiation pressure or third-body forces. Do not use this output as a flight-dynamics certification result.

## Errors and compatibility

Error responses contain a non-empty `error` string. Clients should display the message without assuming every failure is a 400; proxy and upstream failures can be 502. Schema changes that alter required fields, units, frames, time scales or model semantics require a new versioned schema and a corresponding test update.

## Verification

`tests/api-contract.test.ts` validates representative requests and responses against these JSON Schemas with Ajv. CI runs this suite alongside the strict TypeScript check, unit tests, production build and Orekit tests.
