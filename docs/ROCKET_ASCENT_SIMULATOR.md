# Project 02 — Rocket Ascent Trajectory Simulator

## Objective

Add an interactive educational 2D ascent model that evolves a launch vehicle from rest through powered flight and post-burnout coast. The simulator is separate from the ideal staging optimiser and must not imply that its results are a validated launch-vehicle prediction.

## Model definition

The state is represented in a spherical, planar radial/tangential frame:

- Radius from Earth's centre, angular displacement, radial velocity and horizontal/tangential velocity.
- Downrange distance is Earth reference radius multiplied by angular displacement.
- Central gravity uses the inverse-square relation, g(r) = μ/r².
- Atmospheric density uses a single exponential approximation, ρ(h) = ρ₀ exp(−h/H), with ρ₀ = 1.225 kg/m³ and H = 8,500 m.
- Drag magnitude is D = ½ρv²CdA and acts opposite the velocity vector.
- Propellant mass flow is ṁ = T/(Isp g₀). Constant thrust and specific impulse are applied until dry mass, followed by ballistic coast.
- Pitch is measured from the local horizontal and varies linearly in time between the entered start and end schedule.
- The state equations are integrated with fixed-step fourth-order Runge–Kutta (RK4), splitting a step at the burnout discontinuity.

## Outputs

Time history includes altitude, downrange, radial and horizontal velocity, speed, vehicle mass, thrust, drag, dynamic pressure, local gravity and pitch. Summary outputs include burnout time/speed, maximum dynamic pressure and its time, maximum altitude, final altitude and termination reason.

## Model limitations

This baseline excludes Earth rotation, winds, layered/variable atmospheric composition and temperature, changing aerodynamic coefficients, mass-property variation, engine transients, throttle control, staging, launch-site latitude, 3D steering, closed-loop guidance, structural loads and vehicle flexibility. The exponential atmosphere is not an operational atmosphere model. The results are for education and preliminary trade studies only—not launch prediction, vehicle certification or flight safety decisions.

## Verification requirements

- Input-domain validation and finite-number checks.
- Time ordering and finite-state checks.
- Mass-flow and dry-mass boundary checks.
- Max-Q must match the maximum sampled dynamic pressure.
- Sensitivity checks for propulsion changes.
- Independent numerical spot-check and time-step convergence check before release.
- Browser workflow test and visual QA.
- No merge or deployment without completed CI and explicit approval.
