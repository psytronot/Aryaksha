# Fast-track release hardening — 2026-10-30

## Verified production baseline

This section supersedes older baseline statements in `docs/DEPLOYMENT_RUNBOOK.md`.

- Repository: `psytronot/Aryaksha`, branch `main`.
- Verified main commit: `6d8c6490aea794036ae45b85e2ae2dc15f08224a`.
- GitHub Actions run: [41017982200](https://github.com/psytronot/Aryaksha/actions/runs/41017982200) — passed.
- Playwright browser smoke: 20 passed, 0 failed.
- Live deployed UI smoke: 5 passed, 0 failed.
- Live Orekit integration: passed. Orekit 13.1.9 reported healthy; web proxy returned schema-valid numerical two-body results; 600-second propagation advanced the state and epoch; Earth-intersecting orbit was rejected with the expected structured error.
- AppDeploy acceptance-contract workflow: [41017982197](https://github.com/psytronot/Aryaksha/actions/runs/41017982197) — scenario definitions validated. This is not evidence that the nine scenarios were executed inside AppDeploy.

### Live service references

| Component | Render service | Deployment |
|---|---|---|
| Web/API | `srv-dbhm5nks728c73d2f73g` | `dep-dbi43odg1s2s73duij2g`, live |
| Orekit | `srv-dbhm5p942hec73cr4ddg` | `dep-dbhok7qfngtc73c6tlp0`, live |

Web: https://aryaksha-web.onrender.com  
Orekit: https://aryaksha-orekit.onrender.com  
AppDeploy remains a separate deployment: https://orbital-lab-lq22ug.v2.appdeploy.ai/

## Immediate manual configuration item

Render's current web-service build command is `npm install && npm run build`; CI uses `npm ci`. Align it manually in the [Render web service settings](https://dashboard.render.com/web/srv-dbhm5nks728c73d2f73g) to:

```sh
npm ci && npm run build
```

The Render connector does not expose a build-command mutation. Do not claim this is changed until the dashboard shows the new command and a deployment using it succeeds.

## Rollback readiness — not yet rehearsed

A production rollback drill is intentionally not performed automatically: it would alter a live service. Use a maintenance window and an operator with Render dashboard access.

1. Record incident time, failing deployment ID, source commit, affected service, and relevant logs.
2. Freeze merges and further deploys.
3. For the web/API service, identify the last known-good deployment from Render history and confirm its commit and service ID before rollback.
4. For Orekit, independently identify a known-good deployment. If API contracts changed across the pair, roll back both to a compatible pair.
5. Execute the Render rollback/redeploy action from the service's Deploys page.
6. Verify both health endpoints.
7. Run the live Mission Analysis success contract, 600-second propagation, malformed/null-body error contract, Earth-intersection rejection, and browser smoke.
8. Confirm CSP/security headers and inspect logs for startup errors, 5xx responses, and repeated provider failures.
9. Record rollback target IDs, elapsed recovery time, verification output, and any configuration drift in the Notion tracker.

Never use a Git hard reset to recover production. If a source correction is required, use a revert commit.

## Remaining release gates

- [ ] Change Render web build command to `npm ci && npm run build`; confirm successful deploy.
- [ ] Schedule and execute a controlled rollback drill; capture measured recovery time.
- [ ] Test WebGL frame rate, memory, resize, context-loss recovery, and reduced-motion/accessibility on representative physical devices. CI browser tests are not a substitute for device measurements.
- [ ] Review CSP Report-Only violations from representative sessions before considering enforcement. There is currently no report-collection endpoint.
- [ ] Keep orbital-fidelity scope explicit: current service is Orekit 13.1.9 numerical two-body propagation only. J2, drag, solar radiation pressure, and third-body perturbations are not yet configured.

## Evidence boundaries

Automated CI and live smoke are evidence for the exact commit and checks listed above. They do not prove physical-device performance, rollback recovery time, AppDeploy's independent scenario execution, or higher-fidelity force models. Keep those gates open until their own evidence is recorded.
