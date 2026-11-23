# Aryaksha Aerospace Simulation Suite

## Purpose

A set of interactive, educational aerospace engineering studies integrated into the existing Aryaksha React + TypeScript application. The suite reuses the existing application shell and engineering conventions rather than introducing a second frontend.

## Initial module

### Project 01 — Two-stage rocket staging optimisation

- Pure TypeScript calculation engine in `src/aerospace/rocketStaging.ts`.
- Interactive view in `src/RocketStagingView.tsx`.
- 91 candidate stage-1 propellant fractions from 5% through 95%.
- Fixed total initial mass and payload; stage structural fractions define inert mass as a fraction of each stage's wet mass.
- Each stage's ideal velocity increment is computed with the Tsiolkovsky rocket equation.
- Stage 1 inert mass is discarded before stage 2 ignition.
- Unit tests cover mass conservation, candidate count, optimum selection and invalid inputs.

## Model boundary

This is an idealised staging trade study. It excludes gravity and atmospheric drag losses, steering losses, finite burn duration, engine mass variation, residual propellant and separation losses. It must not be presented as a launch trajectory or flight-certified design result.

## Planned modules

1. Rocket staging optimisation
2. Rocket ascent trajectory — 2D radial/tangential point-mass model with central gravity, exponential atmosphere, drag, thrust/mass depletion and RK4 integration
3. Satellite orbital transfer (reuse and extend existing orbital mechanics only where justified)
4. Atmospheric re-entry
5. Rocket engine nozzle
6. UAV conceptual sizing
7. Aircraft autopilot

## Engineering quality gates

- Pure calculation functions separated from UI.
- Explicit units and model assumptions.
- Unit tests for physical invariants and input validation.
- Independent hand calculation or reference-case comparison before release.
- No production deployment or merge without explicit approval.
