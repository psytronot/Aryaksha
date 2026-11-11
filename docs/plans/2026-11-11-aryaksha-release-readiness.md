# Aryaksha Release Readiness Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and verify the engineering-fidelity release candidate while protecting production and making every accuracy, usability, and operational claim traceable to evidence.

**Architecture:** Keep production `main` stable and work in focused pull requests based on the approved release-readiness design. Use Playwright for observable browser behavior, Vitest for deterministic web logic, Maven/JUnit for Orekit behavior, and live smoke checks only against explicitly confirmed deployed services. Each workstream has its own acceptance gate; no later workstream can convert a skipped or failed earlier gate into a pass.

**Tech Stack:** TypeScript, React 19, Vite 6, Playwright, Vitest, Java 21, Maven, Orekit 13.1.9, GitHub Actions, Render.

## Global Constraints

- Never merge a branch with failing required checks.
- Never deploy a branch whose exact commit has not passed required checks.
- Never describe catalog-derived SGP4 estimates as live spacecraft telemetry.
- Every engineering result must disclose model, source, units, reference frame, epoch and known limitations.
- Earth–Moon presentation scale must never be used as a numerical engineering input.
- A telemetry file path on ephemeral storage must never be represented as durable storage.
- Live Render configuration, logs, deploy history and persistent-volume state must be verified before production operational claims.
- Mobile CI emulation is not a substitute for physical Android/iOS testing.
- Preserve the current production baseline and define rollback evidence before a release.

---

## Repository observations

- Observed scripts in `package.json`: `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.
- Observed browser specs: `tests/e2e/acceptance-workflows.spec.ts` and `tests/e2e/earth3d-acceptance.spec.ts`.
- Observed CI workflow: `.github/workflows/ci.yml`; browser smoke is a dedicated job and live integration runs only for main pushes or manual dispatch.
- PR #114 currently contains engineering-fidelity changes in `backend/horizonsEphemeris.mjs`, `backend/telemetry.mjs`, `backend/server.mjs`, `src/Earth3DScene.tsx`, `src/SatelliteTrackingView.tsx`, `src/SpacecraftGeometryWorkbench.tsx`, `src/engineering/*`, Orekit controller/tests and engineering schemas.
- The latest PR browser run was still executing at plan authoring time. Treat the historical four failures as a reproduction list, not as a current failure report, until the latest job completes.

## Task 1: Reproduce and repair PR #114 browser regressions

**Files:**
- Modify if reproduced: `src/SatelliteTrackingView.tsx`
- Modify if reproduced: `src/Earth3DScene.tsx`
- Modify if reproduced: `src/earth3d-upgrade.css`
- Modify tests: `tests/e2e/acceptance-workflows.spec.ts`
- Modify tests: `tests/e2e/earth3d-acceptance.spec.ts`
- Test: existing Playwright suites; add a focused spec only if an existing test cannot express the regression.

**Interfaces:**
- Consumes: visible navigation buttons, catalogue loading state, camera mode controls, Earth 3D canvas, and accessible labels already asserted by the existing Playwright tests.
- Produces: stable catalogue loaded/empty/error states and pointer/keyboard-reachable camera/timeline controls at desktop and mobile viewport sizes.

- [ ] **Step 1: Add or isolate the failing behavior test**

Use the existing catalogue tests for desktop and mobile, and the Earth 3D camera/timeline acceptance tests. If the latest suite does not fail, do not manufacture a red result; preserve the tests and record the prior regression as resolved on the current head.

- [ ] **Step 2: Verify the exact failure on the exact PR head**

Run: `npm run test:e2e -- tests/e2e/acceptance-workflows.spec.ts tests/e2e/earth3d-acceptance.spec.ts`

Expected: a deterministic failing assertion with the observed DOM state, timeout, pointer hit target, or catalogue response captured in Playwright output. A setup error is not an acceptable red result.

- [ ] **Step 3: Implement the smallest source correction**

For catalogue failures, trace fetch completion, selected group, loading state, and the rendered status text; ensure success, empty, and failure are distinguishable and that a stale request cannot overwrite a newer selection. For Earth 3D failures, inspect the actual pointer hit-test, stacking context, scroll position, and control bounds; correct the obstruction or layout at its source. Do not weaken selectors or extend timeouts as a substitute for fixing the defect.

- [ ] **Step 4: Verify the focused pass**

Run the same focused Playwright command. Expected: all targeted desktop/mobile catalogue and Earth 3D tests pass with no assertion removed or weakened.

- [ ] **Step 5: Run all affected integration checks**

Run: `npm run typecheck && npm test && npm run build && npm run test:e2e`

Expected: exit code 0 for all four commands and no browser test silently skipped except an explicitly unsupported browser capability.

- [ ] **Step 6: Commit the passing deliverable**

Commit only the source and test files changed for this task with message `fix: stabilize satellite tracking and Earth 3D controls`.

## Task 2: Validate Earth–Moon reference data and spacecraft mass properties

**Files:**
- Inspect/modify: `src/engineering/ephemeris.ts`
- Inspect/modify: `src/engineering/geometry.ts`
- Inspect/modify: `src/engineering/massProperties.ts`
- Inspect/modify: `backend/horizonsEphemeris.mjs`
- Inspect/modify: `src/Earth3DScene.tsx`
- Inspect/modify: `docs/EARTH_MOON_REFERENCE_MODEL.md`
- Inspect/modify: `docs/SPACECRAFT_CONFIGURATION_MODEL.md`
- Add tests under the observed Vitest test convention for engineering modules.

**Interfaces:**
- Consumes: existing ephemeris source response, geometry import formats and spacecraft mass-property interfaces in `src/engineering/*`.
- Produces: explicitly labelled source/epoch/frame/unit metadata, deterministic reference-model transforms, and tested geometry/mass-property outputs.

- [ ] **Step 1: Add failing reference and geometry tests**

Assert Earth equatorial radius 6378.137 km, Moon mean radius 1737.4 km, and mean separation 384400 km are not conflated with presentation scale. Assert the display transform is not passed into numerical calculations. For geometry, cover explicit units, bounding dimensions, centre of mass and diagonal inertia, and reject unsupported or ambiguous unit metadata.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run`

Expected: new tests fail only where the current production behavior violates the stated reference or geometry contract.

- [ ] **Step 3: Implement minimum corrections**

Keep physical constants in engineering units and isolate display scaling at the rendering boundary. Keep a single-epoch Horizons result labelled as a point snapshot unless a continuous ephemeris source with coverage metadata is available. Do not infer material density, hollow/solid volume or mass distribution from mesh bounds. Preserve the documented zero-products-of-inertia limitation unless a validated full tensor is implemented.

- [ ] **Step 4: Verify focused pass**

Run: `npm test -- --run`

Expected: all engineering reference and geometry tests pass and report deterministic units and metadata.

- [ ] **Step 5: Verify build and browser integration**

Run: `npm run typecheck && npm run build && npm run test:e2e`

Expected: the engineering modules compile and Earth 3D presentation remains functional without numerical use of display scaling.

- [ ] **Step 6: Commit**

Commit the independently passing engineering-reference and mass-property deliverable.

## Task 3: Validate Orekit propagation model and numerical error reporting

**Files:**
- Inspect/modify: `orekit-service/src/main/java/ai/aryaksha/orekit/OrbitAnalysisController.java`
- Inspect/modify: `orekit-service/src/test/java/ai/aryaksha/orekit/OrbitAnalysisControllerTest.java`
- Inspect/modify: `orekit-service/src/test/java/ai/aryaksha/orekit/OrbitNumericalValidationTest.java`
- Inspect/modify: `schemas/orbit-analysis-request.v1.schema.json`
- Inspect/modify: `schemas/orbit-analysis-response.v1.schema.json`
- Inspect/modify: `docs/PERTURBATION_REFERENCE_MODELS.md`

**Interfaces:**
- Consumes: versioned orbit-analysis request/response schema and Orekit propagation controller.
- Produces: explicit model, frame, epoch, time-scale, integrator/tolerance and force-model provenance with numerical diagnostics.

- [ ] **Step 1: Add failing JUnit reference tests**

Cover two-body propagation and J2 separately; test epoch advancement, frame/time-scale metadata, invalid Earth-intersecting orbit rejection, conservation diagnostics, and deterministic comparison against versioned reference vectors. Test that a J2-only result does not claim higher harmonics, drag, SRP, third-body forces or EOP corrections.

- [ ] **Step 2: Verify red**

Run: `mvn -B -f orekit-service/pom.xml test`

Expected: new tests fail on missing or incorrect metadata, unsupported force-model claims, or reference residuals beyond the documented tolerance.

- [ ] **Step 3: Implement minimum behavior**

Keep the J2 axis and frame assumptions explicit. Expose active force models and numerical settings. Add reference residuals and tolerance checks only where a defensible reference source and tolerance are committed alongside the test data.

- [ ] **Step 4: Verify focused pass**

Run: `mvn -B -f orekit-service/pom.xml test`

Expected: all controller and numerical-validation tests pass with no tolerance relaxation that masks a mismatch.

- [ ] **Step 5: Verify API contract and web integration**

Run: `npm test -- --run tests/api-contract.test.ts && npm run build`

Expected: API schemas and web clients accept the versioned response without losing frame, epoch or fidelity metadata.

- [ ] **Step 6: Commit**

Commit the Orekit numerical-validation deliverable independently of UI work.

## Task 4: Verify Coach/Tutor, calculators, accessibility and mobile behavior

**Files:**
- Proposed inspection target: `src/App.tsx` and its imported learning/coach components; resolve the exact component path from the current branch before editing.
- Inspect/modify: `tests/e2e/acceptance-workflows.spec.ts`
- Inspect/modify: `tests/e2e/earth3d-acceptance.spec.ts`
- Create: `tests/e2e/coach-tutor-acceptance.spec.ts`
- Modify only the Coach/Tutor component and state owner identified by repository import/search before editing; the exact component path is not yet verified.
- Modify: `src/ScientificCalculator.tsx` only if calculator behavior is reproduced as defective.
- Modify: `tests/e2e/acceptance-workflows.spec.ts` for report-export acceptance where needed.

**Interfaces:**
- Consumes: existing Coach/Tutor prompt, explanation and panel controls; calculator form inputs; report export actions.
- Produces: accessible, observable prompt/response/error/retry flows and responsive calculator/report behavior.

- [ ] **Step 1: Add failing end-to-end assertions**

Cover opening/closing Coach/Tutor, submitting a simple prompt, switching between simplified and advanced explanation modes if exposed, empty prompt behavior, service failure and retry, keyboard focus, calculator boundary values, invalid units/inputs, and report export.

- [ ] **Step 2: Verify red**

Run: `npm run test:e2e -- tests/e2e/coach-tutor-acceptance.spec.ts`

Expected: failures identify an actual missing or incorrect user-visible behavior, not missing test setup.

- [ ] **Step 3: Implement the smallest user-visible fixes**

Keep explanatory simplification separate from numerical outputs. Do not silently change engineering calculations when rewriting explanations. Ensure failures are visible and retryable; ensure focus and labels remain available at narrow widths.

- [ ] **Step 4: Verify focused pass**

Run the focused Playwright spec. Expected: all prompt, explanation, failure, retry and accessibility assertions pass.

- [ ] **Step 5: Run full web verification**

Run: `npm run typecheck && npm test && npm run build && npm run test:e2e`

Expected: all web checks pass.

- [ ] **Step 6: Commit**

Commit Coach/Tutor and calculator usability changes separately from numerical engine changes.

## Task 5: Verify telemetry security, durability and production release gates

**Files:**
- Inspect/modify: `backend/telemetry.mjs`
- Inspect/modify: `backend/server.mjs`
- Modify: `tests/backend-api.test.mjs` for telemetry route behavior and `tests/security.test.mjs` for signature/replay security behavior.
- Inspect/modify: `.github/workflows/ci.yml`
- Inspect/modify: `docs/ENGINEERING_FIDELITY_PHASE_2.md`
- Inspect/modify: `docs/TRACKING_DATA_PROVENANCE.md`

**Interfaces:**
- Consumes: telemetry ingestion route, HMAC signature validation, timestamp freshness and sequence checks, and current CI/live-smoke workflow.
- Produces: tested authentication/replay behavior, accurate storage durability status, and explicit release evidence.

- [ ] **Step 1: Add failing telemetry security tests**

Cover valid HMAC, invalid signature, stale timestamp, replayed timestamp/sequence, out-of-order sequence, missing key, and isolation between spacecraft keys. Assert the exact HTTP status and response envelope at the API boundary.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run tests/backend-api.test.mjs tests/security.test.mjs`

Expected: the new assertions fail because the required behavior is absent, not because the test runner cannot discover the files.

- [ ] **Step 3: Implement security behavior and state the storage contract**

Retain constant-time signature comparison. Enforce freshness and monotonic sequence per spacecraft key. Distinguish process-memory storage from durable storage. Do not enable or claim append-only durable telemetry until an actual persistent volume or managed durable store is verified and recovery behavior is tested.

- [ ] **Step 4: Verify focused pass**

Run: `npm test -- --run tests/backend-api.test.mjs tests/security.test.mjs`

Expected: all signature, freshness, replay, sequence and isolation cases pass.

- [ ] **Step 5: Verify CI and deployment evidence**

Run: `npm run typecheck && npm test && npm run build && npm run test:e2e && mvn -B -f orekit-service/pom.xml test`

Expected: all code gates pass. Then verify live API smoke, actual Render service identity, deployment commit, logs, persistent storage configuration and health. A skipped live test or unavailable Render workspace leaves the deployment gate blocked.

- [ ] **Step 6: Commit and release only after gate review**

Commit telemetry security changes separately. Merge and deploy only after every mandatory CI check passes and the exact production target is confirmed. Record deployment ID, commit SHA, health result and rollback target.

## Release acceptance matrix

| Gate | Evidence required | Failure result |
|---|---|---|
| Web typecheck, unit tests, build | Successful CI jobs for exact commit | Block merge |
| Browser regression suite | All required Playwright tests pass | Block merge |
| Orekit service | Maven/JUnit pass and reference residuals | Block accuracy claims |
| API contract | Request/response schemas validate | Block integration |
| Live service | Actual health and smoke responses | Block production release |
| Telemetry durability | Verified persistent storage and recovery test | Label telemetry non-durable |
| Mobile usability | CI plus representative physical-device checks | Mark device verification outstanding |
| Rollback | Known-good deployment and tested recovery procedure | Block release |

## Unresolved externally observable decisions

1. Which physical Android and iOS devices and OS versions are the supported minimum for release acceptance?
2. Which independent reference trajectory datasets and numerical error tolerances are approved for mission-analysis accuracy claims?
3. Which durable telemetry backend is approved for production: Render persistent disk, managed database, or an append-only object store?
4. Which named Render workspace and exact web/Orekit services are authorized for inspection and release operations?
5. Is the Coach/Tutor expected to work fully offline, or may it depend on an authenticated network service?
