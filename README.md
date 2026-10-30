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

Prerequisites: Node.js 22.12.x and npm 10.9.0. The exact Node runtime is recorded in `.nvmrc`; `package.json` declares the supported Node range and npm package manager, and `.npmrc` enforces the engine range. Use a Node version manager such as nvm (`nvm install && nvm use`) before running npm commands. `package-lock.json` is committed; use `npm ci` rather than `npm install` for reproducible installs.

Run the following commands from the repository root: **npm ci**, **npm run typecheck**, **npm test**, **npm run build**, and **npm start**. To run browser smoke tests, install Chromium with **npx playwright install chromium** and run **npm run test:e2e**. For live UI development, use **npm run dev** in a second terminal. The standalone API host listens on port 3000 by default.

The UI uses the standalone Express API host for mission analysis, ISS TLE and TLE/SGP4 routes. Mission analysis requires the independently hosted Orekit service through `OREKIT_SERVICE_URL`; it returns a clear service error rather than silently substituting the analytical fallback when Orekit is unavailable. The AppDeploy-specific adapter in `backend/index.ts` is retained as a reference for the separate AppDeploy instance. Do not treat a successful source upload as a verified production migration.

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

**Current fidelity:** Orekit numerical propagation using a Dormand–Prince 8(5,3) integrator and Newtonian central gravity only, with a seven-day maximum propagation horizon. J2, drag, solar radiation pressure and third-body forces are not configured. This is numerical two-body propagation, not a high-fidelity force model. Dependency licence review remains necessary before redistributing a production bundle.

## Verification gate

The nine scenarios in tests/tests.json are acceptance definitions, not evidence that all nine have passed. Current CI executes TypeScript checking, unit/API-schema/security tests, a production build, two Playwright browser smoke tests, Orekit Java tests, and post-deployment live checks for health, numerical orbit output, schema conformance, security headers and Earth-intersection rejection. Full nine-scenario browser acceptance, visual regression, WebGL lifecycle/performance, accessibility and a rollback drill remain open.
