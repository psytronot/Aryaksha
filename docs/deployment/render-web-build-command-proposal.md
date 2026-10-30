# Render web build command — safe configuration proposal

**Status:** Proposal only; not applied to Render.  
**Canonical source reviewed:** `main` at `d7d9b372f9a3f3e72d39fdde0b226972b2b07ca1`.  
**Affected existing service:** `aryaksha-web` (do not create another service).  
**Production change:** None. No Render setting was changed and no deployment was triggered.

## Evidence

- The repository root contains `package-lock.json` with `lockfileVersion: 3`.
- Root `package.json` defines `build: vite build` and `start: node backend/server.mjs`.
- The canonical GitHub CI workflow already installs with `npm ci`, then runs the strict TypeScript check, unit tests and production build.
- Main commit `d7d9b372f9a3f3e72d39fdde0b226972b2b07ca1` has a successful `Aryaksha CI` run (run `41005059407`), including `npm ci`, typecheck, unit tests, build, Playwright browser smoke, Orekit Maven tests, live API integration and deployed-UI smoke.
- The latest controlled Render deployment record (Notion BLD-6, 2026-10-30) last recorded the web build command as `npm install && npm run build`, with start command `npm start`. That is historical configuration evidence, not a fresh dashboard read in this PR.
- A root `render.yaml` is not present on the reviewed `main` branch. Do not add a new Blueprint file merely to express this change: applying a new Blueprint could provision duplicate services.

## Proposed setting — existing service only

In the Render Dashboard, open the already-existing `aryaksha-web` service and, after verifying its service ID, branch and root directory, propose this Build Command:

```sh
npm ci && npm run build
```

Keep the existing Start Command unchanged:

```sh
npm start
```

Do not change the service name, repository, branch, root directory, region, plan, environment variables, health check, or auto-deploy setting as part of this proposal.

## Dashboard-only action

This setting is currently dashboard-managed because the repository has no Render Blueprint. The dashboard action is **not performed by this PR**:

1. Confirm the selected Render workspace and exact existing service ID for `aryaksha-web`.
2. Re-read the service's current Build Command and verify it still matches the recorded value above.
3. In **Settings → Build & Deploy → Build Command**, replace only the install/build command with `npm ci && npm run build`.
4. Leave Start Command as `npm start` and preserve all other settings.
5. Treat Save as potentially deployment-triggering. Do not save until release authorization, the release checklist, and verified quota/cost evidence are present.
6. If approved later, capture the resulting deployment ID and deployed commit SHA, poll to terminal status, inspect build/runtime logs, health/API contracts, browser smoke, frontend/network/backend errors and E2E results.

The Render connector requires an explicitly selected workspace before service metadata can be read. This automation run did not select a workspace or mutate the service, so the current dashboard setting and exact service ID remain to be revalidated before any action.

## Why not add render.yaml?

No Render Blueprint exists at the repository root. Introducing one without first reconciling the existing service's ownership and Blueprint linkage risks creating a second web service instead of updating the production service. This proposal intentionally keeps the configuration change dashboard-only and documents the exact safe edit.

## Rollback / abort

- If the dashboard preflight reveals a different service, repository, branch or root directory, stop; do not create or modify a service.
- If `npm ci` fails in the Render build, retain the failed deployment evidence. Do not silently fall back to `npm install`.
- Any restoration of a prior build command or deployment requires a separately approved, compatibility-checked rollback plan. No rollback is performed by this proposal.

## Acceptance criteria for a later approved change

- [ ] Exact existing Render service ID and current settings reverified.
- [ ] Lockfile present at the configured service root.
- [ ] Render build log shows `npm ci` followed by `npm run build`.
- [ ] Deployment provenance identifies the intended source commit.
- [ ] Health/API, browser smoke and E2E checks pass against that deployment.
- [ ] Daily quota model, current usage, deployment cost and at least 1% headroom are supported by platform evidence before release.
