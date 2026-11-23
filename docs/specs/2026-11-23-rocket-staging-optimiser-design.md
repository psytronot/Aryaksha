# Rocket Staging Optimiser — Design Specification

**Date:** 2026-11-23  
**Repository:** `psytronot/Aryaksha`  
**Target branch:** `feature/aryaksha-ux-simplification`  
**Status:** Approved design direction; implementation not yet started

## 1. Purpose

Extend Aryaksha's existing two-stage rocket staging trade study into a transparent two-to-four-stage educational optimiser. Users should be able to compare stage allocations, maximise ideal velocity increment for a fixed initial vehicle mass, and minimise propellant for a requested ideal delta-v under a defined wet-mass ceiling.

The module remains a preliminary educational tool. It is not flight-certified and must not be used for operational launch vehicle design or flight safety decisions.

## 2. Scope

### Included

- Generalised stage mass accounting for two, three and four stages.
- Stage-specific specific impulse and structural fraction.
- Fixed initial mass / payload constrained maximum ideal delta-v.
- Target delta-v / maximum wet-mass constrained minimum propellant.
- Deterministic, bounded numerical optimisation with explicit convergence metadata.
- Sensitivity studies for Isp, structural fraction, payload, initial mass and stage count.
- Stage-by-stage mass and delta-v budgets.
- Responsive React engineering workspace and downloadable Markdown report.
- Regression preservation for the existing two-stage API and reference scenario.
- Unit, numerical invariant, report and browser acceptance tests.

### Excluded

- Gravity, atmospheric drag, steering, finite-burn, residual-propellant, engine transient, thrust-to-weight, staging event timing and separation-loss modelling.
- Trajectory prediction, guidance, structural loads, engine sizing or flight certification.
- New paid services, external optimisation APIs or new runtime dependencies unless separately approved.
- Production deployment, release configuration changes, PR merge or changes to `main`.

## 3. Physical model and conventions

All masses are in kg, specific impulse in seconds, acceleration in m/s² and velocity increment in m/s.

For stage i, the structural fraction is defined as:

\[
\epsilon_i = \frac{m_{inert,i}}{m_{prop,i}+m_{inert,i}}
\]

Therefore:

\[
m_{inert,i}=m_{prop,i}\frac{\epsilon_i}{1-\epsilon_i}
\]

The total initial mass is:

\[
m_0=m_{payload}+\sum_{i=1}^{N}(m_{prop,i}+m_{inert,i})
\]

For each stage, ignition mass includes all upper stages and payload. Burnout mass is ignition mass minus that stage's propellant. The stage's inert mass remains attached during its burn. After burnout, inert mass is discarded for stages 1 through N-1; final-stage inert mass remains with the payload.

The ideal stage velocity increment is:

\[
\Delta v_i=I_{sp,i}g_0\ln\left(\frac{m_{ignition,i}}{m_{burnout,i}}\right)
\]

where \(g_0=9.80665\,m/s^2\). Total ideal velocity increment is the sum of stage increments.

The calculation must reject non-finite inputs, non-positive payload/propellant, invalid stage count, structural fractions outside [0, 0.5), non-positive specific impulse, invalid mass ordering and any stage configuration that produces a non-positive logarithm argument or non-physical mass ratio.

## 4. Optimisation objectives

### 4.1 Maximum ideal delta-v

- User supplies fixed total initial wet mass, payload mass and stage parameters.
- Solver searches feasible positive propellant allocations across configured stages.
- Stage structural mass follows the structural-fraction definition above.
- Solver performs deterministic global exploration followed by bounded local refinement.
- Return the best feasible solution, objective value, search method, evaluation count, tolerance, convergence state and termination reason.
- Sensitivity curve data must be labelled as sampled candidates, not as proof of a global optimum.

### 4.2 Minimum propellant for target ideal delta-v

- User supplies target ideal delta-v, payload mass, stage parameters and a maximum allowable initial wet mass.
- Solver searches feasible allocations and the propellant quantity required to meet the target.
- A result is successful only when independently recalculated delta-v meets or exceeds the target within the documented tolerance and total initial mass does not exceed the user ceiling.
- If no feasible solution is found, report infeasible only when the bounded search establishes that condition; otherwise report non-convergence or evaluation limit.
- The UI must not conflate a solver failure with physical infeasibility.

## 5. Numerical solver requirements

- Deterministic output for identical inputs and software version.
- Bounded evaluations and finite iteration limits.
- Explicit objective tolerance, constraint tolerance and termination reason.
- No unbounded loops or silently accepted unconverged results.
- Candidate generation must respect a configurable minimum stage propellant share; default 0.1% of total propellant per stage.
- Local refinement must remain inside the feasible allocation simplex.
- Recompute the final result through the independent mass-accounting function rather than trusting optimiser-internal cached values.
- Report numerical resolution limitations and do not claim mathematical proof of a global optimum unless a proof is implemented.

Initial default relative objective tolerance: 1e-6. The implementation must define absolute tolerance and maximum evaluations explicitly in code and tests.

## 6. Software architecture

Keep pure calculation logic separate from React:

- `src/aerospace/rocketStaging.ts`: existing compatibility exports and two-stage adapter.
- `src/aerospace/rocketStagingModel.ts`: validated inputs, generalised mass accounting and stage results.
- `src/aerospace/rocketStagingOptimiser.ts`: deterministic constrained optimisation and solver metadata.
- `src/aerospace/rocketStagingStudies.ts`: parameter sensitivity and comparison studies.
- `src/aerospace/rocketStagingReport.ts`: Markdown report serialization.
- `src/RocketStagingView.tsx`: interactive engineering workspace.
- `src/aerospace.css`: scoped responsive presentation.
- `tests/rocket-staging-model.test.ts`, `tests/rocket-staging-optimiser.test.ts`, `tests/rocket-staging-target-dv.test.ts`, `tests/rocket-staging-studies.test.ts`, `tests/rocket-staging-report.test.ts`.
- `tests/e2e/rocket-staging.spec.ts`: browser acceptance.

Preserve the existing `RocketStagingInputs`, `calculateStagingPoint` and `optimiseRocketStaging` public behaviour where practical. Any necessary API changes must be additive or adapted through compatibility wrappers and covered by regression tests.

## 7. User experience

The workspace will include:

1. Vehicle configuration: stage count, payload, initial-mass ceiling and stage parameters.
2. Optimisation: objective, target, solver status and feasibility.
3. Engineering outputs: stage mass budget, ignition/burnout/separation masses, stage delta-v and total delta-v.
4. Trade studies: sensitivity to Isp, structural fraction, payload, mass and stage count.
5. Engineering report: downloadable Markdown containing inputs, results, equations, assumptions, solver metadata and limitations.

Inputs must have explicit units and accessible labels. Invalid input must produce an actionable error and must not display stale results as current. Preserve values when users move between workspace sections. The interface must remain usable at narrow mobile widths and support keyboard interaction.

## 8. Testing and acceptance

- Red-green TDD for each externally observable behaviour.
- Existing two-stage regression tests remain unchanged in intent and passing.
- Known-vector / independently hand-calculated cases for stage mass and ideal delta-v.
- Mass closure for two, three and four stages.
- Stage separation ordering and retained final-stage inert mass.
- Objective feasibility, monotonicity, boundary, non-convergence and invalid-input tests.
- Determinism and evaluation-budget tests.
- Report consistency tests.
- Browser acceptance for two-, three- and four-stage workflows, both objectives, sensitivity, validation and report export.
- Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`.
- Visual QA at desktop and mobile widths, including keyboard/focus and overflow checks.

Passing software tests does not independently establish launch vehicle model validity. Numerical reference review and the stated model limitations remain required.

## 9. Delivery and repository safeguards

- Work only on `feature/aryaksha-ux-simplification`.
- Keep the current PR draft and its base branch unchanged.
- Do not modify `main`, production Render or AppDeploy.
- Do not change deployment configuration or publish a release.
- Do not add paid services or dependencies without separate approval.
- Commit independently verified tasks to the feature branch.
- Report exact commits, test commands/results, known limitations and anything not verified.

## 10. Acceptance definition

The work is complete only when all six delivery areas are implemented and independently verified: multistage physical model, maximum-delta-v optimiser, minimum-propellant optimiser, trade studies, engineering workspace/report and browser/integration acceptance. Any unmet gate must be reported as incomplete rather than described as finished.
