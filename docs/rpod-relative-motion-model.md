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

The UI includes single-impulse position targeting and a two-impulse terminal velocity-matching calculation. The second impulse is applied at the same instant as position coincidence. It is a mathematical boundary-condition solver, not a safe approach or docking guidance law.

### Orekit dual-spacecraft layer

Implemented in:
- `orekit-service/src/main/java/ai/aryaksha/orekit/RpodAnalysisController.java`
- `orekit-service/src/test/java/ai/aryaksha/orekit/RpodAnalysisControllerTest.java`

`POST /api/v1/rpod/relative-state` accepts target and chaser inertial Cartesian states at J2000 TAI in EME2000. It independently propagates both spacecraft using Orekit 13.1.9 numerical propagation with Dormand–Prince 8(5,3) and Newtonian central gravity, then computes the target-centred rotating LVLH relative state. The response includes both propagated inertial states, the LVLH relative state, frame/epoch metadata and explicit model assumptions.

The endpoint is a comparison foundation. The browser RPOD workspace is not yet wired to this endpoint, and no automated HCW-versus-Orekit error budget or acceptance threshold is yet established.

## Assumptions and validity

- Circular chief orbit and constant mean motion for HCW.
- Relative separation small compared with orbital radius for the linearized CW model.
- Orekit endpoint currently uses Newtonian central gravity only.
- No J2, atmospheric drag, solar radiation pressure, third-body forces, finite-burn effects, actuator limits, navigation covariance or environmental constraints.
- Input EME2000 states are interpreted at J2000 TAI; arbitrary input epochs and frame conversions are not supported by the new endpoint.

These models support preliminary engineering and education, not operational flight dynamics or flight-safety certification.

## Verification coverage

Analytical tests cover:
- Inertial-to-LVLH conversion and rotating-frame velocity correction.
- Zero-state invariance and closed-form CW reference behaviour.
- Independent RK4 integration cross-check of the analytical CW propagator.
- Single-impulse terminal position closure.
- Two-impulse terminal velocity cancellation.
- Invalid mean motion, negative time and singular transfer-time rejection.

Orekit controller tests cover:
- Coincident target/chaser state producing zero LVLH relative state.
- Correct rotating-frame velocity transport at the initial epoch.
- Independent propagation of both spacecraft to a requested epoch.
- Invalid elapsed time and malformed state vectors.

## Remaining engineering work

1. Wire the RPOD workspace to the Orekit relative-state endpoint with explicit frame and epoch inputs.
2. Establish a circular two-body comparison harness between HCW and Orekit, with documented tolerances and relative-state error plots.
3. Add target/chaser trajectory histories and time-series visualisation.
4. Add multi-impulse and finite-burn manoeuvre sequencing with thrust and attitude constraints.
5. Add keep-out sphere, approach corridor, collision screening and navigation uncertainty.
6. Add capture/docking terminal constraints and report export with assumptions, units, tolerances and model fidelity.

Do not describe the current implementation as a complete RPOD simulator or flight-ready rendezvous solution.
