# Deployment and rollback runbook

**Status:** Main commit `4ba079e27801d5e78377e3328a6e7b9074139612` passed source CI and live checks. Render web deployment `dep-dbi7p24s728c73cj84gg` for that commit is live. Its build succeeded with Node 22.12.0; the dashboard build command is still `npm install && npm run build`, not `npm ci`. The live smoke workflow completed before this deployment, so post-deploy API/UI smoke on this exact deployment remains a follow-up. Rollback drill not yet executed.
**Canonical source:** GitHub repository psytronot/Aryaksha, branch main.

## Production topology

| Component | Service | URL / health | Purpose |
|---|---|---|---|
| Web UI + Express API | Render service aryaksha-web, ID srv-dbhm5nks728c73d2f73g | https://aryaksha-web.onrender.com and /api/v1/health | Serves the Vite build, validates inputs, proxies orbit analysis and exposes the ISS/SGP4 routes. |
| Orekit engine | Render service aryaksha-orekit, ID srv-dbhm5p942hec73cr4ddg | https://aryaksha-orekit.onrender.com/api/v1/health | Java 21 / Spring Boot / Orekit 13.1.9 service. |
| Parallel AppDeploy instance | App ID orbital-lab-lq22ug | https://orbital-lab-lq22ug.v2.appdeploy.ai/ | Separate deployment path; GitHub/Render changes do not automatically update it. |

The web service must have OREKIT_SERVICE_URL set to the Orekit service base URL. The web proxy allows up to 90 seconds because a cold Orekit start has previously taken approximately 67 seconds.

## Pre-release gates

1. Confirm the intended commit is on main and the corresponding GitHub Actions run is green.
2. Confirm CI includes npm ci, strict TypeScript checking, unit/API-schema/security tests, production build, Playwright browser smoke tests, Orekit Maven tests and live integration checks.
3. Confirm the dependency audit reports zero vulnerabilities for all dependencies and for production dependencies.
4. Confirm Render has built the intended commit and deployment status is live.
5. Confirm GET /api/v1/health on both services succeeds.
6. Confirm POST /api/mission-analysis/orbit returns valid=true, engine Orekit, engine version 13.1.9, engineAdapter orekit-http, connected status, TAI epoch, EME2000 frame and three-component state vectors.
7. Confirm the live success response matches schemas/orbit-analysis-response.v1.schema.json and the invalid Earth-intersecting orbit returns HTTP 400 with an error matching schemas/api-error.v1.schema.json.
8. Confirm the live web/API response includes X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin and the report-only CSP with the audited CelesTrak connect-src.
9. Confirm direct POSTs with malformed JSON and JSON null to the Orekit endpoint return HTTP 400 with the stable JSON error envelope.
10. Confirm local Playwright tests pass for desktop navigation, mobile navigation, Mission Analysis success rendering and structured-error recovery.
11. Confirm the main-only live UI smoke passes against the deployed Render URL: app shell, CSP header and Mission Analysis rendering after live API/Orekit checks.
12. Review Render application logs for startup errors, 502 responses, rate-limit spikes and external provider failures. The nine acceptance definitions are covered by the current automated Playwright/unit test suite where browser-testable; AppDeploy's own QA snapshot reports zero frontend/network/backend errors. Preserve the separate distinction between definition validation, automated repository tests, and AppDeploy QA snapshots.

## Current verification baseline

- Canonical source: `psytronot/Aryaksha`, branch `main`, commit `4ba079e27801d5e78377e3328a6e7b9074139612` (Node/npm toolchain metadata follow-up).
- Latest web deployment: `dep-dbi7p24s728c73cj84gg`, commit `4ba079e27801d5e78377e3328a6e7b9074139612`, status live. Render logs confirm Node.js `22.12.0` via `.nvmrc`, `npm install && npm run build`, `npm audit` reported 0 vulnerabilities, Vite production build succeeded, `npm start` started the API, and Render reported the service live.
- Latest Orekit deployment: `dep-dbhok7qfngtc73c6tlp0`, commit `d29e517a7e10775814f284b622b5cdda9286b446`, status live. Service is Orekit 13.1.9 numerical two-body propagation with Dormand–Prince 8(5,3) and Newtonian central gravity only. J2, drag, solar radiation pressure and third-body forces are not configured.
- Main CI run [41046383907](https://github.com/psytronot/Aryaksha/actions/runs/41046383907) completed successfully on `4ba079e`: `npm ci`, typecheck, 37 Vitest tests, production build, Playwright browser smoke, Orekit Maven tests, live Orekit integration and live deployed UI smoke all passed. Dependency audit reported zero vulnerabilities for all and production dependencies. CodeQL run [41046383756](https://github.com/psytronot/Aryaksha/actions/runs/41046383756) and AppDeploy scenario-definition validation [41046383894](https://github.com/psytronot/Aryaksha/actions/runs/41046383894) passed.
- **Evidence timing:** The main live Orekit/UI checks completed before the web deployment `dep-dbi7p24s728c73cj84gg` was promoted. The new web deployment contains no application runtime changes; nevertheless, a fresh post-deploy live API/UI smoke has not been run against this exact deployment. Render logs verify build and process startup, not every endpoint contract.
- Known-good web/Orekit pair immediately before the latest web deploy: web `dep-dbi43odg1s2s73duij2g` (commit `6d8c6490aea794036ae45b85e2ae2dc15f08224a`) and Orekit `dep-dbhok7qfngtc73c6tlp0` (commit `d29e517a7e10775814f284b622b5cdda9286b446`). The previous web deployment remains in Render history and is the conservative web rollback target; keep Orekit at its known-good live version unless a contract-level incident requires a paired rollback.
- AppDeploy remains a separate deployment path: `orbital-lab-lq22ug`. GitHub/Render changes do not automatically update it; no AppDeploy deployment was triggered.

## Release-gate status and known external actions

- Render web service ID: `srv-dbhm5nks728c73d2f73g`; current Build Command remains `npm install && npm run build`, while CI uses `npm ci`. Node is pinned to `22.12.0` by `.nvmrc`, and Render confirmed it used that version. Update the dashboard Build Command to `npm ci && npm run build` and verify a subsequent deployment before marking install-command parity PASS. The connected Render interface exposes inspection/deploy/logs but not build-command mutation.
- GitHub rulesets query returned an empty list; direct branch-protection read was denied to the connected integration (HTTP 403). Required-check branch protection has not been established or verified. Repository owner/admin UI access is required to configure it.
- Rollback runbook exists but a rollback drill has not been executed. Do not rehearse against production; first provide an approved staging/non-production target or schedule an explicit maintenance-window exercise.
- A separate stacked accessibility PR [#74](https://github.com/psytronot/Aryaksha/pull/74) is not merge-ready: axe reported serious color-contrast violations in Home, Simulation/Earth 3D, Satellite Tracking and Mission Analysis, plus one serious prohibited-ARIA-attribute violation in Simulation/Earth 3D. Keep the audit threshold; resolve these defects before merging that stack.
- Physical-device WebGL frame time, memory, resize/context-loss, thermal and touch validation remain open. GitHub Actions Chromium results are not physical-device evidence.

## Rollback procedure

A rollback drill has not been performed. Treat this section as a runbook, not proof that rollback has been tested.

1. Stop further merges and capture the failing commit, Render deployment ID, timestamp and relevant logs.
2. In the Render dashboard, open the affected service's Deploys history and select the last known-good successful deployment. Confirm the commit and service before choosing the rollback/redeploy action.
3. If the web and Orekit contracts changed together, assess both services; roll back both to a compatible pair rather than assuming independent versions are compatible.
4. If a source correction is needed, create a Git revert commit on main. Do not rewrite main history with a hard reset.
5. Trigger the Render deployment manually if the GitHub merge does not start one. In recent runs, Render auto-deploy was configured but manual deployment was required after the GitHub API merge.
6. Repeat all live release gates above, including the CSP report-only header, direct Orekit malformed/null-body contract and live UI smoke. Keep the incident open until these checks pass.
7. Record the rollback target, deploy IDs, elapsed recovery time, checks performed and any data or configuration differences in Notion.

## Known limitations and cautions

- The current Orekit fidelity is numerical two-body propagation with Dormand–Prince 8(5,3) and Newtonian central gravity only. J2, drag, solar radiation pressure and third-body forces are not configured.
- The in-memory rate limiter is per process, resets on restart and is not a distributed quota.
- Authentication/account authorization is not implemented.
- A `Content-Security-Policy-Report-Only` policy now covers local assets and the audited CelesTrak connection. It is diagnostic only and reports violations to browser developer tools; there is no report collection endpoint. Review representative browser sessions before switching to enforcement.
- The Render web service is pinned to Node.js 22.12.0 through `.nvmrc`, but its dashboard build command remains `npm install && npm run build` while CI uses `npm ci`. Production install-command parity remains PARTIAL until the dashboard is updated and verified.
- Render metrics in the sampled 11-minute window showed roughly 51 MB web memory and 129 MB Orekit memory at the last sample, but HTTP request-count and latency series were empty. This is not a performance benchmark and does not establish latency, FPS or load budgets.
- The deployed Vite build now splits the former 989.94 kB JavaScript chunk: largest emitted chunk is `vendor-three` at 483.88 kB (120.82 kB gzip); `vendor-react` is 223.19 kB, and the application entry is 183.28 kB. CI and Render build logs showed no >500 kB chunk warning. Representative-device/WebGL frame-rate, memory, resize/context-loss, and accessibility testing remains open.
- Free-tier cold starts can exceed one minute. The 90-second proxy timeout reduces false failures but does not eliminate first-request latency.
