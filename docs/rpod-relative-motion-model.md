# RPOD relative-motion model — Phase 02

## Implemented layers

### Analytical LVLH / HCW layer

Implemented in:
- `src/rpod.ts`
- `src/RpodView.tsx`
- `tests/rpod.test.ts`

The target (chief) defines the instantaneous LVLH frame:
- **R**: radial, outward from Earth's centre through the target.
- **T**: along-track, in the target's direction of motion.
- **N**: orbit-normal, along the target's specific angular momentum.

The inertial-to-LVLH velocity transform includes the rotating-frame transport correction:

```text
rho_LVLH = C_LVLH_ECI * (r_chaser - r_target)
v_rel_LVLH = C_LVLH_ECI * ((v_chaser - v_target) - omega_LVLH x (r_chaser - r_target))
```

`propagateCw(state, n, t)` implements closed-form Clohessy–Wiltshire / Hill propagation for a circular chief orbit and constant mean motion. Units are km, km/s, rad/s and seconds.

`sampleCwTrajectory(state, n, duration, intervalCount)` returns uniformly spaced LVLH states including both the initial and final epochs. The RPOD workspace samples the post-departure-burn HCW transfer at 40 intervals and plots radial versus along-track position; the plot is a planar projection, not a 3D approach corridor or safety assessment.\n\nThe UI includes single-impulse position targeting and a two-impulse terminal velocity-matching calculation. The second impulse is applied at the same instant as position coincidence. It is a mathematical boundary-condition solver, not a safe approach or docking guidance law.

### Orekit dual-spacecraft layer

Implemented in:
- `orekit-service/src/main/java/ai/aryaksha/orekit/RpodAnalysisController.java`
- `orekit-service/src/test/java/ai/aryaksha/orekit/RpodAnalysisControllerTest.java`

`POST /api/v1/rpod/relative-state` accepts target and chaser inertial Cartesian states at a shared TAI mission epoch in EME2000. The `epochTai` request field is an explicit ISO-8601 TAI date-time; omission retains J2000 TAI compatibility. It independently propagates both spacecraft using Orekit 13.1.9 numerical propagation with Dormand–Prince 8(5,3) and Newtonian central gravity, then computes the target-centred rotating LVLH relative state. The response includes both propagated inertial states, the LVLH relative state, frame/epoch metadata and explicit model assumptions.

The browser RPOD workspace accepts a strict JSON mission-state import (`docs/examples/rpod-mission-state.example.json`) containing target/chaser EME2000 Cartesian states and an explicit TAI epoch. The parser rejects unsupported frames, malformed epochs, non-finite vectors, Earth-intersecting current positions or osculating periapses, degenerate orbital planes and files over 64 KiB. Imported states are passed through the Express proxy to this endpoint. When imported mission states are used, the UI reports Orekit relative-state results without presenting HCW residuals against an invalid synthetic circular reference. Its default cross-check constructs a synthetic circular equatorial chief orbit in EME2000 at the user-supplied TAI epoch, converts the entered LVLH state into inertial target/chaser states, and compares the independently propagated Orekit relative state with the analytical HCW prediction. This is an initial unburned propagation comparison; it does not apply the calculated rendezvous impulses. A dedicated Orekit controller test currently checks a small-separation circular two-body case against HCW with 10 m position and 10 mm/s velocity bounds. Those are regression-test bounds for that fixture, not universal accuracy guarantees.

## Assumptions and validity

- Circular chief orbit and constant mean motion for HCW.
- Relative separation small compared with orbital radius for the linearized CW model.
- Orekit endpoint currently uses Newtonian central gravity only.
- No J2, atmospheric drag, solar radiation pressure, third-body forces, finite-burn effects, actuator limits, navigation covariance or environmental constraints.
- Input EME2000 states are interpreted at the supplied TAI epoch (or J2000 TAI when omitted). Frame conversion is not yet supported; data in other frames must not be relabelled as EME2000.

These models support preliminary engineering and education, not operational flight dynamics or flight-safety certification.

## Verification coverage

Analytical tests cover:
- Inertial-to-LVLH conversion and rotating-frame velocity correction.
- Independent two-body inertial RK4 propagation, circular-orbit period closure, uniform endpoint-inclusive sampling and invalid-input rejection.
- Zero-state invariance and closed-form CW reference behaviour.
- Independent RK4 integration cross-check of the analytical CW propagator.
- Single-impulse terminal position closure.
- Two-impulse terminal velocity cancellation.
- Piecewise coast propagation with timed instantaneous LVLH impulses, including event ordering and interval validation.
- Sampled pre-terminal keep-out-radius screening, with terminal coincidence explicitly excluded.
- Linear HCW covariance propagation for a symmetric positive-semidefinite 6x6 LVLH state covariance, plus UI 3-sigma axis summaries from independent diagonal position/velocity uncertainty inputs.
- Invalid mean motion, negative time and singular transfer-time rejection.

CI also starts the real Orekit Spring Boot service locally for the RPOD integration smoke test, routes a request through the Express proxy, verifies the returned LVLH state and explicit TAI epoch, and checks malformed-epoch and Earth-intersecting-periapsis rejection. This local test does not depend on or modify the deployed Render services.

Orekit controller tests cover:
- Coincident target/chaser state producing zero LVLH relative state.
- Correct rotating-frame velocity transport at the initial epoch.
- Independent propagation of both spacecraft to a requested epoch.
- HCW-versus-Orekit small-separation circular-orbit comparison with documented regression bounds.
- Invalid elapsed time, malformed state vectors and initial positions inside Earth.

## Remaining engineering work

1. Extend mission-state import to additional validated frames with real Orekit frame transformations. The current JSON importer accepts EME2000 only; non-EME2000 conversion remains outstanding.
2. Add Orekit-vs-HCW residual time-series plots; the Orekit API now returns an optional endpoint-inclusive history (2–101 samples), and the RPOD UI plots signed R/T/N position residuals in metres and velocity residuals in mm/s for the synthetic circular-chief comparison. Imported EME2000 missions display Orekit relative-state history but intentionally omit HCW residuals.
3. Add maneuver-aware Orekit propagation so the numerical comparison can evaluate departure and arrival impulses, rather than only the unburned initial state.
4. Add multi-impulse and finite-burn sequencing with thrust, mass, attitude and actuator constraints; the current maneuver sequence is analytical and impulsive only.
5. Upgrade the sampled pre-terminal keep-out sphere indicator to continuous-time approach-corridor and collision screening; extend the current diagonal-only uncertainty model to correlated covariance, measurement updates and maneuver uncertainty.
6. Add capture/docking terminal constraints and extend the versioned JSON report with review metadata and additional verification provenance.
7. Configure and run a separate staging deployment smoke test; the production-linked live integration job remains skipped on pull requests.
8. Add maneuver-aware Orekit propagation and finite-burn sequencing; the HCW keep-out feature now brackets stationary points of the analytical range function, but remains a numerical model screen rather than collision certification.

Do not describe the current implementation as a complete RPOD simulator or flight-ready rendezvous solution.


## Engineering report export

The RPOD results panel exports a versioned JSON engineering record (`aryaksha.rpod-engineering-report/v1`) using `src/rpodReport.ts`. The report includes the TAI mission epoch, manual LVLH input state, chief-orbit/HCW assumptions, both ideal instantaneous maneuver vectors and magnitudes, total delta-v, all 41 sampled relative trajectory states, sampled pre-terminal keep-out result, diagonal-covariance terminal 3-sigma position bounds, and any Orekit cross-check result available at export time. The schema and serializer are covered by `tests/rpodReport.test.ts`.

The report explicitly records that it is not safe-approach or docking guidance, that terminal velocity matching is an instantaneous burn at the position-coincidence epoch, that keep-out screening is sampled rather than continuous-time, and that the diagonal uncertainty model does not calculate collision probability. Imported EME2000 mission states are used for the Orekit cross-check only; the current two-impulse design solution remains based on the manually entered LVLH state. The export identifies that distinction rather than implying the imported state was used by the HCW solver.


## Inertial trajectory history

`src/rpodInertial.ts` provides a separate Newtonian two-body Cartesian propagator using fixed-step RK4 (maximum integration step 10 s) and endpoint-inclusive uniform sampling. When an EME2000 mission file is imported, the RPOD workspace independently propagates the target and chaser from the imported TAI epoch and displays five checkpoints from each 41-sample history, including inertial orbital radii and mutual separation. This is a visualization/history layer only: it does not apply the planned HCW impulses, does not perform frame transformations, and does not replace the Orekit numerical cross-check. Its point-mass assumptions exclude J2, drag, SRP and third-body perturbations.


## Orekit-versus-HCW time-series comparison

The RPOD browser sends `historySamples: 21` with the initial dual-spacecraft request. The Orekit service returns endpoint-inclusive relative LVLH states at uniformly spaced epochs (history sample counts are constrained to 2–101). The Express proxy validates that the service returned the requested number of samples.

For the synthetic circular-chief case, the UI independently evaluates the closed-form HCW state at each Orekit sample epoch and plots signed radial, along-track and cross-track residual components for position (metres) and velocity (mm/s). The final residual norms are also shown. For imported EME2000 mission states, the Orekit history is still displayed, but HCW residuals are intentionally suppressed because the imported orbit is not assumed to be the same circular-chief reference used by the HCW design inputs.

The engineering report optionally retains each Orekit history sample, residual norms and signed component residuals. The comparison remains an unburned initial-propagation comparison: neither planned departure nor terminal impulses are applied to the Orekit spacecraft.

## HCW separation screening indicator

The RPOD results include the maximum sampled relative separation divided by the chief-orbit radius. A 1% ratio is displayed as a review trigger only. It is a heuristic intended to prompt scrutiny of the small-separation linearization assumption; it is not a universal HCW accuracy boundary, a validated operating envelope or a safety criterion.


## Numerical pre-terminal keep-out search

`screenCwKeepOutContinuous` evaluates the analytical HCW state and brackets stationary points of squared range using the sign change of `rho · rhoDot`. It refines each bracket by bisection, checks pre-terminal endpoints, excludes the forced terminal coincidence, and reports the number of stationary minima found plus whether the 50,000-interval search cap limited resolution. The interval spacing is bounded by both a 10-second maximum and 1/32 of the chief orbital angular half-period scale. This is a numerical stationary-point search over the HCW model, not a formal continuous-time collision certificate; missed brackets, model error and unmodelled forces remain possible.
