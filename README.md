# Aryaksha — Space Exploration Lab

Aryaksha is a student-focused aerospace engineering workstation for mission design, orbital mechanics, Earth/satellite visualization, satellite tracking and preliminary spacecraft subsystem analysis.

## Repository layout

- `src/` — React + TypeScript user interface and analysis modules
- `backend/index.ts` — original AppDeploy API adapter used by the existing hosted deployment
- `orekit-service/` — independent Java 21 / Spring Boot / Orekit API service
- `schemas/` and `docs/API_CONTRACT.md` — versioned orbit-analysis API contract and JSON Schemas
- `docs/ROUTE_INVENTORY.md` — backend routes, frontend workspaces and external dependencies
- `docs/DEPLOYMENT_RUNBOOK.md` — release checks, live verification and rollback procedure
- `tests/` — day/night unit tests and the nine original end-to-end scenario definitions
- `public/` — static illustrations and site assets

## Current deployments

- GitHub source of truth: https://github.com/psytronot/Aryaksha, branch main.
- Render web/API service: https://aryaksha-web.onrender.com.
- Render Orekit service: https://aryaksha-orekit.onrender.com/api/v1/health.
- Separate AppDeploy instance: https://orbital-lab-lq22ug.v2.appdeploy.ai/. This is a separate deployment path; commits to this repository do not automatically update it.

See docs/DEPLOYMENT_RUNBOOK.md before releasing or rolling back a deployment.

## Local development

Prerequisites: Node.js 22.12+ and npm.

Run the following commands from the repository root: **npm ci**, **npm run typecheck**, **npm test**, **npm run build**, and **npm start**. To run browser smoke tests, install Chromium with **npx playwright install chromium** and run **npm run test:e2e**. For live UI development, use **npm run dev** in a second terminal. The standalone API host listens on port 3000 by default.

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

The nine scenarios in tests/tests.json are acceptance definitions, not evidence that all nine have passed. Current CI executes TypeScript checking, unit/API-schema/security tests, a production build, two Playwright browser smoke tests, Orekit Java tests, and post-deployment live checks for health, numerical orbit output, schema conformance, security headers and Earth-intersection rejection. Full nine-scenario browser acceptance, visual regression, WebGL lifecycle/performance, accessibility and a rollback drill remain open.
