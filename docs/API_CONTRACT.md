# Orbit Analysis API — v1

This document defines the request/response contracts for preliminary orbit analysis and RPOD relative-state analysis.

## Endpoints

- `GET /api/v1/health` — service health and engine/version metadata.
- `POST /api/mission-analysis/orbit` — hosted Aryaksha backend proxy for orbit analysis.
- `POST /api/v1/orbit/analysis` — direct Orekit orbit-analysis endpoint.
- `POST /api/v1/rpod/relative-state` — independently propagate target and chaser Cartesian states, then compute the target-centred rotating LVLH relative state.

## Orbit analysis request

`altitudeKm`, `inclinationDeg`, and `eccentricity` are required. `elapsedSeconds` is optional and defaults to `0`.

| Field | Unit | Constraint |
|---|---|---|
| `altitudeKm` | km above WGS-84 equatorial radius | 120–100,000 |
| `inclinationDeg` | degrees | 0–180 |
| `eccentricity` | dimensionless | 0 ≤ e < 1 |
| `elapsedSeconds` | seconds from J2000 TAI | 0–604,800 |

Example:

```json
{
  "altitudeKm": 550,
  "inclinationDeg": 97.6,
  "eccentricity": 0.001,
  "elapsedSeconds": 600
}
```

The service rejects orbits whose periapsis intersects Earth.

## RPOD relative-state request

The endpoint accepts two independent inertial Cartesian states in EME2000 at the J2000 TAI epoch. Position is in km and velocity is in km/s. Both spacecraft are numerically propagated independently to the requested epoch before the relative state is formed.

```json
{
  "target": {
    "positionKm": [6928.137, 0, 0],
    "velocityKmS": [0, 7.585, 0]
  },
  "chaser": {
    "positionKm": [6928.237, 0, 0],
    "velocityKmS": [0, 7.585, 0]
  },
  "elapsedSeconds": 600
}
```

Constraints:
- Each position and velocity vector must contain exactly three finite components.
- The target state must define a non-degenerate orbital plane.
- `elapsedSeconds` must be between 0 and 604,800 seconds.
- Input states are interpreted in EME2000 at J2000 TAI. No arbitrary input epoch or frame conversion is currently accepted.

The response includes independently propagated target and chaser Cartesian states and `relativeLvlh`. The LVLH axes are +R radial outward, +T along-track, +N orbit-normal. Relative velocity includes the rotating-frame transport correction:

```text
v_rel_LVLH = C_LVLH_ECI * ((v_chaser - v_target) - omega_LVLH x (r_chaser - r_target))
```

The Orekit endpoint uses Dormand–Prince 8(5,3), a 1 m position tolerance and a 60 s maximum integration step. The configured force model is Newtonian central gravity only; no J2, drag, solar radiation pressure or third-body forces are included.

## Successful response semantics

- `engine` / `engineVersion`: Orekit 13.1.9.
- Orbit-analysis `state`: EME2000 Cartesian position in km and velocity in km/s.
- RPOD `target` and `chaser`: independently propagated EME2000 Cartesian states.
- RPOD `relativeLvlh`: relative position in km and rotating-frame relative velocity in km/s.
- `epoch`: TAI string; do not append `Z` or interpret it as UTC.
- `comparison`: identifies the Orekit HTTP adapter.

These endpoints are engineering analysis foundations, not flight-dynamics certification or operational docking guidance. The RPOD relative-state endpoint does not perform collision screening, keep-out checks, approach-corridor analysis, navigation covariance propagation or maneuver execution.

## Errors and compatibility

Error responses contain a non-empty `error` string. Clients should display the message without assuming every failure is a 400; proxy and upstream failures can be 502. Changes to units, frames, epochs or model semantics require a versioned contract and corresponding tests.

## Verification

CI validates the orbit API schemas and runs TypeScript, unit, production-build and Orekit Maven tests. The RPOD endpoint has dedicated Orekit controller tests for coincident states, rotating-frame velocity, propagation and invalid inputs.
