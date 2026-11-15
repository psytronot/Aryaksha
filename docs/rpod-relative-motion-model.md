# RPOD relative-motion model — Phase 01

## Scope

Phase 01 provides a standalone, deterministic relative-orbit dynamics foundation for later integration with the Orekit service and the mission-analysis UI.

Implemented in:
- `src/rpod.ts`
- `tests/rpod.test.ts`

## Coordinate convention

The target (chief) spacecraft defines the instantaneous LVLH frame:
- **R**: radial, outward from Earth's centre through the target.
- **T**: along-track, in the target's direction of motion.
- **N**: orbit-normal, along the target's specific angular momentum.

The inertial-to-LVLH state conversion projects the chaser-target position difference onto these axes. Relative velocity is expressed in the rotating frame:

```text
rho_LVLH = C_LVLH_ECI * (r_chaser - r_target)
v_rel_LVLH = C_LVLH_ECI * ((v_chaser - v_target) - omega_LVLH x (r_chaser - r_target))
```

Inputs use km and km/s. The angular velocity is calculated from the target's instantaneous specific angular momentum and radius.

## Clohessy–Wiltshire / Hill propagation

`propagateCw(state, n, t)` implements the closed-form CW equations for a circular chief orbit with constant mean motion `n`. Inputs use km, km/s, rad/s and seconds.

Assumptions:
- Circular reference orbit.
- Constant chief mean motion.
- Relative separation is small compared with orbital radius.
- Linearized relative dynamics.
- No perturbing forces, finite-burn effects, actuator limits, navigation errors or environmental constraints.

The model is appropriate for preliminary analysis and education, not operational flight dynamics or flight safety certification.

## Single-impulse position rendezvous

`solveRendezvousImpulse(state, n, T)` solves the CW position state-transition relation for the post-burn initial velocity that makes the predicted relative position zero at time `T`.

It returns:
- Initial impulse vector in km/s.
- Post-burn initial LVLH velocity in km/s.
- Impulse magnitude in m/s.
- Requested rendezvous time in seconds.

**Important limitation:** this solution constrains terminal relative position only. It does not constrain terminal relative velocity, guarantee a safe approach path, optimize a multi-burn sequence, model finite-duration thrust, or check keep-out zones and collision probability. Singular or ill-conditioned transfer matrices are rejected.

## Two-impulse position and velocity matching\n\n`solveTwoImpulseRendezvous(state, n, T)` extends the position-only solution with an idealized instantaneous terminal impulse at the rendezvous epoch. The first impulse is selected to make relative position zero at `T`; the second cancels the residual relative velocity at that same instant. It reports both impulse vectors, their magnitudes, total ideal impulsive delta-v, and pre-/post-arrival-burn relative states.\n\nThis does not define a safe approach trajectory: it has no keep-out geometry, approach corridor, collision probability, navigation uncertainty, finite-burn execution, or docking capture constraints. The second burn occurs at the terminal position coincidence, so this is a mathematical two-impulse rendezvous boundary condition, not a flight-ready RPOD sequence.\n\n## Verification coverage

The unit tests cover:
- Inertial-to-LVLH conversion, including rotating-frame velocity correction.
- Zero-state invariance under CW propagation.
- A closed-form radial-displacement CW reference case.
- Single-impulse terminal position closure.
- Invalid mean motion, negative elapsed time and singular rendezvous time rejection.

## Next engineering increments

1. Add target/chaser orbit-state adapters to Orekit, with explicit frame and epoch metadata.
2. Cross-check CW results against two independently propagated Orekit spacecraft in a circular two-body reference case.
3. Add finite-burn and multi-impulse maneuver sequencing.
4. Add terminal relative-velocity constraints and maneuver Δv budgeting.
5. Add keep-out sphere, approach corridor and collision-screening logic.
6. Add UI scenario configuration, trajectory visualization and machine-generated design reports.

Do not describe the Phase 01 implementation as a complete RPOD simulator.
