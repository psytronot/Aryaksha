# Aryaksha — Space Exploration Lab

Aryaksha is a student-focused aerospace engineering workstation for mission design, orbital mechanics, Earth/satellite visualization, satellite tracking and preliminary spacecraft subsystem analysis.

## Repository layout

- `src/` — React + TypeScript user interface and analysis modules
- `backend/index.ts` — original AppDeploy API adapter used by the existing hosted deployment
- `orekit-service/` — independent Java 21 / Spring Boot / Orekit API service
- `tests/` — day/night unit tests and the nine original end-to-end scenario definitions
- `public/` — static illustrations and site assets

## Existing production deployment

The existing site remains at https://orbital-lab-lq22ug.v2.appdeploy.ai/ while the Git-based workflow is prepared. This repository migration does not change that live deployment.

## Local development

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run build
npm start
# For live UI development, use a second terminal:
# npm run dev
# API routes are proxied to localhost:3000
```

The UI has been migrated away from the AppDeploy-only frontend API client. A standalone Express API host now serves the production-built UI and exposes the mission-analysis, ISS TLE and TLE/SGP4 API routes. The AppDeploy-specific adapter in `backend/index.ts` is retained as a reference for the current live instance. Do not treat a successful source upload as a verified production migration.

## Phase 01 — Orekit service

The independent Java service lives in `orekit-service/`.

```bash
cd orekit-service
mvn test
mvn spring-boot:run
```

Health endpoint: `GET /api/v1/health`

Analysis endpoint: `POST /api/v1/orbit/analysis` with JSON:

```json
{ "altitudeKm": 550, "inclinationDeg": 97.6, "eccentricity": 0.001 }
```

Once deployed, configure `OREKIT_SERVICE_URL` on the Aryaksha API host to the service base URL. Never commit secrets or service credentials to this repository.

**Current fidelity:** Orekit Keplerian/two-body propagation only. J2, drag, solar radiation pressure and third-body forces are not configured. Dependency licence review remains necessary before redistributing a production bundle.

## Verification gate

The nine scenarios in `tests/tests.json` are the original QA scenario definitions; they are not evidence that nine automated tests have passed. Phase 01 is complete only when:
1. Java service builds and tests pass.
2. Frontend and backend build from this repository.
3. The hosted API returns `engine: "Orekit"` through the real Orekit service URL.
4. All nine scenarios are executed and results recorded.
