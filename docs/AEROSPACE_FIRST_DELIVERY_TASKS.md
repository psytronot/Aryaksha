# Aerospace Suite — First Delivery: 10-Task Execution Board

Scope: Phase 00 shared application integration + Project 01 rocket staging optimisation. This is the first executable delivery, not a claim that all seven planned simulations are complete.

| # | Task | Acceptance evidence | Status |
|---|---|---|---|
| 01 | Isolate aerospace work on a feature branch | `feature/aerospace-simulation-suite`; production and `main` untouched | DONE |
| 02 | Audit the existing Aryaksha architecture and CI contract | Existing React/Vite/TypeScript shell, engineering modules, tests and GitHub Actions inspected | DONE |
| 03 | Integrate the Aerospace Engineering workspace into the existing navigation | Navigation entry, view type, component import and render route in `src/App.tsx` | DONE |
| 04 | Implement a pure two-stage staging calculation engine | Ideal rocket equation per stage; stage-1 inert mass discarded before stage 2; fixed initial mass and payload | DONE |
| 05 | Add design inputs and engineering outputs | Editable masses, specific impulses and structural fractions; stage mass breakdown and delta-v | DONE |
| 06 | Add staging sensitivity and optimum selection | 91 candidate splits from 5% through 95%; best sampled candidate highlighted | DONE |
| 07 | Add model boundaries and engineering documentation | Assumptions, excluded loss terms, non-flight-certified disclaimer and seven-module roadmap | DONE |
| 08 | Add unit tests for physical invariants and invalid inputs | Mass conservation, candidate count, optimum selection, invalid payload/fractions/non-finite values | DONE |
| 09 | Add browser-level interaction coverage | Playwright test navigates to the workspace, checks reference result, edits Isp and expands assumptions | DONE — CI run pending |
| 10 | Pass the release validation gate and prepare review | TypeScript, Vitest, Vite build, Orekit tests, Playwright; draft PR review; no production merge | IN PROGRESS |

## Reference case

Initial mass 100,000 kg; payload 5,000 kg; Isp 280 s / 340 s; structural fractions 0.08 / 0.10.

A local independent numerical spot-check gives the best sampled split at 77% Stage 1 propellant and ideal total delta-v of 7,464.673 m/s. The calculation closes the total mass budget to 100,000 kg.

## Release boundary

The module is an idealised staging trade study. It excludes gravity, atmospheric drag, steering, finite-burn, residual propellant, engine mass variation and separation losses. Do not use its output as a launch trajectory prediction or flight design approval.

The PR remains a draft against `feature/software-products-hub`. It must not be merged into `main` or deployed without explicit approval and completed CI evidence.

## Seven-module roadmap

1. Rocket staging optimiser — Project 01
2. Rocket ascent trajectory simulator
3. Satellite orbital transfer
4. Atmospheric re-entry simulator
5. Rocket engine nozzle designer
6. UAV conceptual design and sizing
7. Aircraft autopilot simulator

Each subsequent module must have independently validated equations, explicit assumptions/units, unit tests, browser tests and visual QA before approval.
