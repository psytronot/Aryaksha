# Project 02 — Rocket Ascent Simulator: 10-Task Board

| # | Task | Acceptance evidence | Status |
|---|---|---|---|
| 01 | Isolate Project 02 from the Project 01 draft | feature/rocket-ascent-trajectory branches from the aerospace suite branch; PR #129 remains untouched | DONE |
| 02 | Define the model contract and fidelity boundary | Spherical radial/tangential state, central gravity, exponential atmosphere, drag, thrust/mass flow, pitch schedule, RK4 and limitations documented | DONE |
| 03 | Define behavioral tests before the engine | Unit tests cover SI outputs, time ordering, burnout/dry mass, max-Q, Isp sensitivity and invalid inputs | DONE — CI execution pending |
| 04 | Implement the pure ascent engine | RK4 integration, atmosphere, gravity, drag, pitch and powered/coast phases | DONE — CI execution pending |
| 05 | Add a deterministic reference case | Independent numerical spot-check: 107.496 s burnout, 3,463.862 m/s burnout speed, 82,831.64 m max altitude, 99,207.17 Pa sampled max-Q; 0.5 s vs 0.25 s altitude convergence within 1 m | DONE — CI pending |
| 06 | Build the interactive engineering workspace | Editable vehicle/aero/guidance inputs and live trajectory summary | DONE — CI execution pending |
| 07 | Add trajectory visualisation and max-Q reporting | Altitude/downrange plot, burnout and max-Q metrics | DONE — CI execution pending |
| 08 | Integrate navigation and preserve Project 01 | Existing Aerospace Engineering workspace remains reachable; Rocket Ascent has its own route | DONE — CI execution pending |
| 09 | Add browser-level interaction coverage | Playwright opens Rocket Ascent, checks plot/summary and verifies a thrust change affects output | DONE — CI execution pending |
| 10 | Pass the release validation gate | TypeScript, Vitest, Vite build, Playwright, numerical convergence/independent reference and visual QA | IN PROGRESS |

## Reference inputs

Initial mass 30,000 kg; dry mass 5,000 kg; thrust 650,000 N; specific impulse 285 s; reference area 10 m²; drag coefficient 0.35; pitch from 90° to 5° between 10 s and 90 s; integration step 0.5 s; maximum flight time 600 s.

## Release boundary

This is a preliminary educational point-mass model. Do not merge or deploy based on a successful build alone. Close all verification items and retain the explicit model limitations in the UI and documentation.
