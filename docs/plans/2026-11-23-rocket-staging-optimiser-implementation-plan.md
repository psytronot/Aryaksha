# Rocket Staging Optimiser Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Aryaksha's existing two-stage rocket staging calculator into a deterministic, testable two-to-four-stage engineering optimiser with two objective modes, sensitivity studies and a transparent report.

**Architecture:** Keep all physical calculations and optimisation pure in TypeScript modules under `src/aerospace`, preserving the existing two-stage public API through compatibility adapters. Keep React responsible for input state, navigation, presentation and report export; all displayed results must come from the same validated calculation result. Use bounded deterministic numerical search and independently recompute final mass closure and delta-v before reporting success.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Playwright, existing CSS and Lucide icons. No new runtime or paid dependencies.

## Global Constraints

- Aryaksha is an educational aerospace engineering workstation, not a flight-critical system. Preserve that limitation in user-facing claims and documentation.
- Keep external data provenance, timestamps, source limits and licensing visible. Do not claim live telemetry, continuous ephemeris, high-fidelity force models or verified spacecraft integrations unless the implementation and evidence actually support those claims.
- Work only on `feature/aryaksha-ux-simplification`.
- Keep the current PR draft and its base branch unchanged.
- Do not modify `main`, production Render or AppDeploy.
- Do not change deployment configuration or publish a release.
- Do not add paid services or dependencies without separate approval.
- Commit independently verified tasks to the feature branch.
- Report exact commits, test commands/results, known limitations and anything not verified.
- Preserve existing `RocketStagingInputs`, `calculateStagingPoint` and `optimiseRocketStaging` behavior through compatibility wrappers and regression tests.
- Use SI units and explicit unit labels. Structural fraction means inert mass divided by stage wet mass. Stage inert mass remains attached during its own burn; jettison stages 1 through N-1 before the next stage ignition; final-stage inert mass remains with payload.
- Model ideal Tsiolkovsky delta-v only. Exclude gravity, drag, steering, finite burns, residual propellant, engine transients, thrust-to-weight, timing and separation losses. Do not describe outputs as flight certified.
- Bound all search work. Report evaluation count, tolerance, convergence state and termination reason. Never silently accept an unconverged result or call a sampled solution a proven global optimum.
- Do not show stale results after invalid input. Keep keyboard operation, accessible labels/focus, responsive narrow layouts and reduced-motion behavior.

---

### Task 1: Generalised two-to-four-stage physical model

**Files:**
- Create: `src/aerospace/rocketStagingModel.ts`
- Modify: `src/aerospace/rocketStaging.ts` (compatibility exports and adapter only)
- Test: `tests/rocket-staging-model.test.ts`
- Regression test: `tests/rocket-staging.test.ts`

**Interfaces:**
- Produces `RocketStageParameters`, `RocketVehicleConfiguration`, `RocketStageResult`, `RocketVehicleMassBreakdown`, `validateRocketVehicleConfiguration` and `calculateRocketVehicle`.
- Consumes existing `STANDARD_GRAVITY_M_S2`; legacy exports remain callable with their current signatures.

- [ ] **Step 1: Add focused failing tests**

Add tests for:
1. A hand-calculated two-stage reference case including stage ignition mass, burnout mass, discarded inert mass and per-stage ideal delta-v.
2. Three- and four-stage mass closure: payload plus all propellant and inert masses equals initial wet mass within the stated absolute tolerance.
3. Separation order: each discarded stage inert mass is removed before the next stage ignition; final-stage inert mass remains in final mass.
4. Stage count outside 2–4, non-finite or non-positive masses/Isp, payload not smaller than vehicle mass, structural fraction below zero or at/above 0.5, and non-positive propellant allocations are rejected with actionable errors.
5. Existing two-stage reference result and public legacy exports retain their current behavior.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- tests/rocket-staging-model.test.ts`
Expected: the new model import/behavior assertions fail because the generalised public model does not exist yet; existing test setup must load successfully.

- [ ] **Step 3: Implement the minimum model**

Define a configuration with payload mass and ordered stage entries containing specific impulse, structural fraction and propellant mass. Validate stage count and physical inputs. Compute stage wet/inert/propellant masses, ignition and burnout mass, separation mass and ideal stage delta-v in burn order. Reconcile total initial mass from the full stack and verify closure. Adapt the existing two-stage inputs into this model without changing its public result shape or 91-point sweep.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- tests/rocket-staging-model.test.ts tests/rocket-staging.test.ts`
Expected: all new mass closure, separation and validation tests pass and all legacy two-stage regression tests remain green.

- [ ] **Step 5: Run affected integration checks**

Run: `npm run typecheck`
Expected: no TypeScript errors in current callers or the compatibility adapter.

- [ ] **Step 6: Commit the passing deliverable**

`git add src/aerospace/rocketStagingModel.ts src/aerospace/rocketStaging.ts tests/rocket-staging-model.test.ts tests/rocket-staging.test.ts && git commit -m "feat: generalise rocket staging mass model"`

### Task 2: Deterministic maximum ideal delta-v optimiser

**Files:**
- Create: `src/aerospace/rocketStagingOptimiser.ts`
- Test: `tests/rocket-staging-optimiser.test.ts`
- Consume: `src/aerospace/rocketStagingModel.ts`

**Interfaces:**
- Produces `RocketOptimisationObjective`, `RocketOptimisationOptions`, `RocketOptimisationResult`, `RocketSolverStatus` and `optimiseMaximumDeltaV(configuration, options)`.
- Consumes `calculateRocketVehicle` and validated stage parameters.

- [ ] **Step 1: Add focused failing tests**

Assert the solver finds a feasible best candidate for two, three and four stages; each stage's propellant share respects the configurable minimum (default 0.1%); identical inputs yield identical outputs; candidate allocations sum to the available propellant; final result is independently recomputed; evaluation count never exceeds the configured cap; invalid budgets/options reject; and solver status distinguishes converged, evaluation-limit and no-feasible-candidate outcomes.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- tests/rocket-staging-optimiser.test.ts`
Expected: missing optimiser exports or missing required behavior causes assertion failures, not test-runner setup errors.

- [ ] **Step 3: Implement bounded search**

Use deterministic global candidate exploration over the feasible allocation simplex followed by bounded local refinement that remains inside the simplex. Define explicit defaults for relative objective tolerance (1e-6), absolute tolerance, constraint tolerance and maximum evaluations. Retain the best feasible candidate. Recompute the winning allocation with the independent model function. Include search method, evaluations, tolerances, convergence and termination reason in the result. Describe it as the best solution found by the bounded search, not a mathematically proven global optimum.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- tests/rocket-staging-optimiser.test.ts`
Expected: deterministic, bounded, feasible results and all solver status assertions pass.

- [ ] **Step 5: Run affected integration checks**

Run: `npm test -- tests/rocket-staging-model.test.ts tests/rocket-staging-optimiser.test.ts tests/rocket-staging.test.ts && npm run typecheck`
Expected: all model and optimiser tests pass and TypeScript remains clean.

- [ ] **Step 6: Commit the passing deliverable**

`git add src/aerospace/rocketStagingOptimiser.ts tests/rocket-staging-optimiser.test.ts && git commit -m "feat: optimise multistage ideal delta-v"`

### Task 3: Minimum propellant for a target ideal delta-v

**Files:**
- Modify: `src/aerospace/rocketStagingOptimiser.ts`
- Test: `tests/rocket-staging-target-dv.test.ts`

**Interfaces:**
- Produces `optimiseMinimumPropellantForDeltaV(configuration, targetDeltaVMs, maximumInitialMassKg, options)`.
- Returns the same solver metadata contract with required target, achieved delta-v, propellant mass, initial wet mass and a status that distinguishes feasible success, proven infeasibility within the supported search bounds, non-convergence and evaluation limit.

- [ ] **Step 1: Add focused failing tests**

Cover a feasible target that is met after independent recomputation; a target whose best solution violates the maximum wet-mass ceiling; a target above the attainable bounded solution; exact/near-boundary target tolerance; invalid target and mass ceiling; and non-convergence/evaluation-budget reporting. Assert that success is impossible unless achieved delta-v meets the target within the documented tolerance and initial wet mass is at or below the ceiling.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- tests/rocket-staging-target-dv.test.ts`
Expected: the target-objective API and its feasibility semantics fail before implementation.

- [ ] **Step 3: Implement the constrained objective**

Search over feasible stage allocations and required total propellant under the initial wet-mass ceiling. Use the same bounded deterministic search policy and independent final mass/delta-v recomputation. Return infeasible only when the bounded search has enough evidence to establish no feasible candidate under the defined search domain; otherwise return non-converged or evaluation-limit. Never convert a solver failure into a physical infeasibility claim.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- tests/rocket-staging-target-dv.test.ts`
Expected: feasible, infeasible and inconclusive cases are separately represented and target/ceiling constraints are enforced.

- [ ] **Step 5: Run affected integration checks**

Run: `npm test -- tests/rocket-staging-model.test.ts tests/rocket-staging-optimiser.test.ts tests/rocket-staging-target-dv.test.ts`
Expected: all three calculation suites pass together.

- [ ] **Step 6: Commit the passing deliverable**

`git add src/aerospace/rocketStagingOptimiser.ts tests/rocket-staging-target-dv.test.ts && git commit -m "feat: solve target delta-v propellant objective"`

### Task 4: Parameter sensitivity and comparison studies

**Files:**
- Create: `src/aerospace/rocketStagingStudies.ts`
- Test: `tests/rocket-staging-studies.test.ts`

**Interfaces:**
- Produces typed study inputs/results and `runRocketStagingSensitivityStudy(configuration, variable, samples, objective, options)`.
- Consumes the validated physical model and both optimiser objectives.

- [ ] **Step 1: Add focused failing tests**

Test one-variable sweeps for stage Isp, structural fraction, payload mass and initial mass; comparison across 2, 3 and 4 stages; deterministic sample ordering; preservation of baseline input; invalid sample ranges and non-finite values; and clear per-sample solver status when an optimisation sample does not converge.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- tests/rocket-staging-studies.test.ts`
Expected: missing study API or unsupported study behavior fails focused assertions.

- [ ] **Step 3: Implement studies**

Provide bounded, deterministic sensitivity samples with explicit units and input/output values. Keep sample values separate from mutated baseline configurations. Use the selected objective for every sample and preserve solver metadata for each point. Do not interpolate or label sampled data as continuous physical truth.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- tests/rocket-staging-studies.test.ts`
Expected: all requested variables and stage-count comparisons produce deterministic, correctly labelled samples.

- [ ] **Step 5: Run affected integration checks**

Run: `npm test -- tests/rocket-staging-model.test.ts tests/rocket-staging-optimiser.test.ts tests/rocket-staging-target-dv.test.ts tests/rocket-staging-studies.test.ts`
Expected: model, both objectives and trade-study tests pass together.

- [ ] **Step 6: Commit the passing deliverable**

`git add src/aerospace/rocketStagingStudies.ts tests/rocket-staging-studies.test.ts && git commit -m "feat: add rocket staging trade studies"`

### Task 5: Engineering workspace and transparent Markdown report

**Files:**
- Create: `src/aerospace/rocketStagingReport.ts`
- Modify: `src/RocketStagingView.tsx`
- Modify: `src/aerospace.css`
- Test: `tests/rocket-staging-report.test.ts`
- Regression: `tests/rocket-staging.test.ts`

**Interfaces:**
- Produces `buildRocketStagingMarkdownReport(result, configuration, studies)`.
- React view consumes the model, both optimiser objectives, trade-study results and report serializer.

- [ ] **Step 1: Add focused failing tests**

Report tests assert explicit SI units; inputs; stage ignition, burnout and separation masses; per-stage and total delta-v; objective; solver status/evaluation count/tolerances/termination reason; equations; assumptions; and non-flight-certified limitations. UI acceptance tests assert stage count selection, per-stage Isp/structural fraction editing, objective switching, target and mass ceiling fields, invalid-input messaging with stale results suppressed, sensitivity results, report download, and state persistence while switching workspace sections.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm test -- tests/rocket-staging-report.test.ts`
Expected: missing serializer/report fields fail assertions; UI behavior will be covered by the E2E task in Task 6.

- [ ] **Step 3: Implement the report and workspace**

Serialize the exact validated result to Markdown, with no recalculation or invented performance claims. Rework the current view into configuration, objective/solver, stage mass budget, sensitivity and report sections. Support two-, three- and four-stage configuration, both objectives, explicit units, solver state, mass closure and limitations. Use accessible labels, keyboard-operable controls and responsive layout while preserving the existing aerospace visual language. Invalid input must clear the displayed result and present an actionable error. Keep state in the mounted workspace when users switch its internal sections.

- [ ] **Step 4: Verify the focused pass**

Run: `npm test -- tests/rocket-staging-report.test.ts tests/rocket-staging.test.ts`
Expected: report serialization and legacy model tests pass.

- [ ] **Step 5: Run affected integration checks**

Run: `npm run typecheck && npm run build`
Expected: no TypeScript errors and Vite creates the production bundle.

- [ ] **Step 6: Commit the passing deliverable**

`git add src/aerospace/rocketStagingReport.ts src/RocketStagingView.tsx src/aerospace.css tests/rocket-staging-report.test.ts tests/rocket-staging.test.ts && git commit -m "feat: build multistage rocket staging workspace"`

### Task 6: Browser acceptance, scientific review and release evidence

**Files:**
- Create: `tests/e2e/rocket-staging.spec.ts`
- Modify only if required by test evidence: `src/RocketStagingView.tsx`, `src/aerospace.css`, focused calculation modules/tests.
- Inspect: `src/AerospaceSuiteView.tsx`, `tests/e2e/software-products.spec.ts`, `tests/e2e/acceptance-workflows.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.

**Interfaces:**
- Browser route is the existing Aerospace Engineering Workbench and its Rocket Staging Optimiser workspace; no new route or API contract is required.

- [ ] **Step 1: Add browser acceptance tests**

Verify end-to-end:
1. Open Aerospace Engineering Workbench and enter Rocket Staging Optimiser.
2. Configure two, three and four stages and observe stage-specific result rows.
3. Run maximum ideal delta-v and confirm solver status, mass closure and per-stage delta-v.
4. Run minimum propellant for a target delta-v and confirm target and wet-mass ceiling checks.
5. Change Isp and structural fraction and inspect sensitivity outputs.
6. Enter invalid data and confirm actionable error with no stale result.
7. Download Markdown report and verify meaningful content.
8. At desktop and 390px mobile viewport, check no horizontal overflow, visible focus, keyboard-operable fields and controls.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm run test:e2e -- tests/e2e/rocket-staging.spec.ts`
Expected: new acceptance checks fail only at the not-yet-complete browser behavior; environment/setup failures must be reported separately.

- [ ] **Step 3: Fix only evidence-backed defects**

Correct defects found by acceptance tests and render inspection. Preserve the product's established aerospace design system. Do not add new animation engines or decorative assets. Check focus order, accessible names, contrast, touch targets, responsive reading order and reduced-motion preferences.

- [ ] **Step 4: Verify browser acceptance**

Run: `npm run test:e2e -- tests/e2e/rocket-staging.spec.ts`
Expected: all Rocket Staging Optimiser acceptance scenarios pass at desktop and mobile widths.

- [ ] **Step 5: Run complete verification**

Run:
```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```
Expected: each command exits zero. Also inspect GitHub Actions job results for the final feature-branch commit. Review calculation reference vectors and mass closure independently; passing software tests alone is not scientific validation.

- [ ] **Step 6: Review diff and commit final acceptance evidence**

Inspect the complete branch diff and confirm no deployment configuration, production service, `main`, secrets or unrelated product areas changed. Record any unavailable independent reference review or viewport check explicitly. Commit the acceptance test and any focused fixes only after passing verification:
`git add tests/e2e/rocket-staging.spec.ts [verified focused fixes] && git commit -m "test: verify rocket staging optimiser workflows"`

## Unresolved externally observable decisions

- The specification does not define the exact Markdown report download filename; recommended default: `aryaksha-rocket-staging-study.md`.
- The specification does not prescribe a chart library; recommendation: reuse existing SVG/CSS chart patterns and avoid adding a dependency.
- A bounded numerical search cannot mathematically prove global infeasibility over a continuous domain unless the search method establishes a valid bound; report inconclusive/non-converged whenever that proof is absent.
