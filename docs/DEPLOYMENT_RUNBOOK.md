# Deployment and rollback runbook

**Status:** Live release checks passed for main commit `aec4dc2df286bbd5fc6ac4d294eee3bc11de5a60`; rollback drill not yet executed.
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

- Latest web deployment: `dep-dbho9fss728c73d77oc0`, commit `aec4dc2df286bbd5fc6ac4d294eee3bc11de5a60`, status live. It includes the Orekit-only mission-analysis proxy, explicit propagation-time input, state-vector rendering, and report-only CSP/security headers.
- Latest Orekit deployment: `dep-dbho8le1egvs7383488g`, commit `aec4dc2df286bbd5fc6ac4d294eee3bc11de5a60`, status live. It runs Orekit 13.1.9 numerical two-body propagation with Dormand–Prince 8(5,3), Newtonian central gravity only, and stable JSON errors for malformed/null requests.
- Main CI run `40922716728` passed web typecheck/unit/build, Orekit Maven tests, local Playwright, live API/Orekit integration, 600-second epoch advancement, live response/error schema checks, Earth-intersection guardrail, and live deployed UI Playwright smoke. CodeQL run `40922716740` and AppDeploy scenario-contract workflow `40922717020` also passed.
- Previous known-good web deployment before the CSP header: dep-dbhnhrlg1s2s73ahgn5g, commit 15928bc5a5dfa5f5e2a1ff01c2c8ca6f878b2a4b, status deactivated but retained in deployment history.
- Previous known-good Orekit deployment before the error-envelope handler: dep-dbhn311srm7s7388tu00, commit a1adf54f9bdc5b09e9ebc2f5f3e9d857a4d75f71, status deactivated. It uses the same response model and is the compatible rollback target for the current web/API contract.

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
- The Render web service configuration currently reports build command npm install && npm run build, while CI uses npm ci. Update the Render dashboard build command to npm ci && npm run build when the service settings are available; until then, production install reproducibility is not fully aligned.
- Render metrics in the sampled 11-minute window showed roughly 51 MB web memory and 129 MB Orekit memory at the last sample, but HTTP request-count and latency series were empty. This is not a performance benchmark and does not establish latency, FPS or load budgets.
- The last verified Vite build produced a 989.94 kB JavaScript chunk (290.01 kB gzip), above the 500 kB warning threshold. A proposed vendor-chunk split is under CI verification; do not mark the performance issue resolved until the built artifact confirms no oversized chunks and representative-device/WebGL tests are recorded.
- Free-tier cold starts can exceed one minute. The 90-second proxy timeout reduces false failures but does not eliminate first-request latency.
