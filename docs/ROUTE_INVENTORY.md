# Route and integration inventory

Source revision: main at the time this inventory was prepared. Re-check when routes or provider integrations change.

## HTTP API — standalone Express host

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | /api/_healthcheck | Legacy health response | Returns service marker. |
| GET | /api/v1/health | Health check used by deploy smoke tests | Returns status ok and service aryaksha-api. |
| POST | /api/mission-analysis/orbit | Validate orbit input and proxy to configured Orekit service | 120–100,000 km altitude, 0–180° inclination, 0 ≤ e < 1; rejects Earth-intersecting periapsis. Returns explicit Orekit engine metadata when upstream is configured; otherwise analytical baseline is returned with a different engine marker. |
| GET | /api/live/iss | Fetch current ISS TLE from CelesTrak | Upstream/network failure returns a visible 502 error. |
| POST | /api/simulation/propagate | Propagate a TLE with SGP4 or use supported state inputs | Input mode and TLE parsing determine response; invalid inputs return structured errors. |

The Express host serves the built SPA from dist and falls back to dist/index.html for client-side routes. JSON request bodies are capped at 64 KiB.

## Orekit service API

| Method | Path | Purpose |
|---|---|---|
| GET | /api/v1/health | Reports service status, Orekit engine and version. |
| POST | /api/v1/orbit/analysis | Computes preliminary two-body Keplerian orbit metrics and an EME2000 state vector with explicit TAI epoch metadata. |

See API_CONTRACT.md and the JSON schemas under schemas/.

## Frontend workspaces

The main React application exposes these navigation workspaces: Mission, Payload, Spacecraft, Orbit & Maneuver, Simulation, Satellite Tracking, Mission Analysis, Engineering Analysis, Verification, Design Report, Instructions & Glossary, and Calculator & Reference.

## External dependencies and boundaries

- Orekit: independently hosted Java service; the web backend proxies mission analysis through OREKIT_SERVICE_URL.
- CelesTrak: live ISS TLE retrieval; availability and freshness are external dependencies.
- satellite.js: in-browser/backend SGP4 calculations for TLE-based tracking and propagation.
- Three.js: 3D scene rendering. The spacecraft is visually exaggerated; do not infer physical scale from the rendered geometry.
- Render: hosts the web/API service and the Orekit service. Free-tier cold starts can make first requests slow; proxy timeout is 90 seconds.

## Security and operational limitations

- Security headers and per-process in-memory rate limiting are applied by the Express host after the API-hardening change.
- Rate limits are a best-effort abuse control, not a distributed quota: the in-memory budget resets on restart and is not shared across multiple instances.
- The app has no authentication or account-based authorization in this version.
- A `Content-Security-Policy-Report-Only` header is enabled. Source audit found local app assets plus the direct browser connection to `https://celestrak.org`; external tracking sites are links opened by the user, not fetch origins. The policy is report-only and does not collect reports server-side. Review browser console violations before considering enforcement.
- The nine original AppDeploy scenarios are acceptance definitions; only tests explicitly run in CI or recorded manual QA count as executed.
