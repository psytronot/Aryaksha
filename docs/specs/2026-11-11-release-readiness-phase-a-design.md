# Orbital Lab Release Readiness — Phase A Design

**Date:** 2026-11-11  
**Scope:** Release safety, engineering regression repair, and verification architecture for Aryaksha Space Exploration Lab.

## Goal

Establish an evidence-backed release process that fixes known regressions in the engineering-fidelity branch, expands tests for critical product workflows, validates engineering outputs against independent references, and protects the currently deployed production baseline.

## Architecture

Work is split into independently reviewable workstreams. The current production branch remains the stable baseline. Engineering-fidelity changes stay isolated until the complete required CI suite passes. Browser tests verify observable workflows; numerical validation compares outputs to versioned reference data; operational checks verify the actual deployed service configuration rather than inferring it from source code.

## Global constraints

- Never merge a branch with failing required checks.
- Never deploy a branch whose exact commit has not passed required checks.
- Never describe catalog-derived SGP4 estimates as live spacecraft telemetry.
- Every engineering result must disclose model, source, units, reference frame, epoch and known limitations.
- Earth–Moon presentation scale must never be used as a numerical engineering input.
- A telemetry file path on ephemeral storage must never be represented as durable storage.
- Live Render configuration, logs, deploy history and persistent-volume state must be verified before production operational claims.
- Mobile CI emulation is not a substitute for physical Android/iOS testing.
- Preserve the current production baseline and define rollback evidence before a release.

## Workstream A — regression repair

Inspect the latest head of PR #114 and the current Playwright output. Reproduce each failure against the exact commit before changing code. Separate application defects from selectors, fixture problems, viewport timing, and asynchronous catalogue-loading races. For each confirmed application defect, add or retain a focused regression assertion, implement the smallest fix, and rerun the focused test followed by the full browser suite. Do not weaken assertions to make the suite green.

Required acceptance:
- TypeScript typecheck, unit tests, web build and Orekit tests pass.
- Every browser test passes without retries masking a flaky failure.
- The satellite catalogue tests assert deterministic loaded/empty/error states.
- Earth 3D controls are pointer- and keyboard-reachable at supported viewport sizes.
- Live integration tests run after the branch is integrated into the production release candidate.

## Workstream B — engineering fidelity

### Earth–Moon reference model
Keep physical constants and presentation transforms separate. Verify body radii and mean-distance scale against published reference values. Precision mode must identify source/kernel, epoch, time scale, origin, frame, units, coverage and interpolation. A single Horizons state lookup must remain explicitly labelled as a point snapshot, not continuous ephemeris playback.

### Spacecraft geometry and mass properties
Test supported GLB, self-contained glTF, OBJ and STL fixtures, explicit source units, axis conventions, bounds, centre of mass and inertia aggregation. Compare computed outputs against independent CAD exports. Never infer density or mass distribution from mesh bounds.

### Orekit propagation
Test two-body and J2 models independently. Record active force models, constants, frames, integrator settings and tolerances. Compare against versioned reference trajectories and include residuals, convergence checks and error budgets. J2-only must not be labelled a complete high-fidelity Earth gravity model.

### Numerical validation
Maintain reference vectors with source/version, epoch, frame and units. Report position/velocity residuals and conservation diagnostics. Tests must fail when tolerances are exceeded.

## Workstream C — product usability

Add end-to-end tests for Coach/Tutor open/close, user prompts, simplified and advanced explanations, error/retry behavior, keyboard access and narrow-screen layout. Cover calculator boundaries, invalid inputs, units, empty results and report exports. Accessibility checks must inspect labels, focus order, contrast and modal behavior.

## Workstream D — operational security and durability

Verify telemetry signature validation, timestamp freshness, replay rejection, sequence ordering, per-spacecraft key isolation and audit behavior. Confirm production uses durable storage before enabling a persistent telemetry claim. Verify key rotation and recovery procedures. Inspect actual deployment settings and logs for secrets exposure, unexpected 4xx/5xx spikes and process restarts.

## Workstream E — release and rollback

For each release candidate, record:
- Git commit SHA and branch.
- CI run URL and job conclusions.
- Browser screenshots/traces for changed visual flows.
- Live API smoke evidence and deployed service identity.
- Production deployment ID and health checks.
- Rollback target and tested rollback procedure.

Release only when all mandatory gates pass. If private Render access is unavailable, mark deployment-specific gates blocked rather than inferred.

## Failure handling

- A failing mandatory test blocks merge and deploy.
- A skipped live test is not a pass.
- A third-party data-source outage is recorded separately from an application regression.
- Numerical reference mismatch blocks engineering-accuracy claims.
- Missing persistent storage blocks durable telemetry claims.
- Physical-device testing remains outstanding until executed on representative hardware.

## Rollout order

1. Resolve and verify Workstream A.
2. Validate Earth–Moon, spacecraft geometry and Orekit outputs in Workstream B.
3. Complete Coach/Tutor and calculator acceptance in Workstream C.
4. Verify production telemetry, storage, secrets and operational recovery in Workstream D.
5. Execute production release and rollback verification in Workstream E.

## Out of scope for automatic release

- Merging PRs or deploying to production with failing or skipped mandatory gates.
- Claiming certification, flight readiness, or operational spacecraft connectivity without external evidence.
- Changing live Render resources until the correct workspace and target services are confirmed.
