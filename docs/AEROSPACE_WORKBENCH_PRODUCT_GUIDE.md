# Aryaksha Aerospace Engineering Workbench — Product Guide

## Product purpose

The Aerospace Engineering Workbench presents three separate analytical tools behind one guided product entry point. Visitors should choose by engineering task rather than by technical vocabulary alone.

## Product navigation

- Product overview: introduces the suite, compares the three modules and asks what problem the visitor is trying to solve.
- Project 01 — Rocket staging optimiser.
- Project 02 — Rocket ascent simulator.
- Project 03 — Satellite orbital transfer designer.

Every module page has four consistent detail tabs:
1. Module overview — purpose, intended outcome and audience.
2. Engineering workspace — interactive model inputs and calculated outputs.
3. Use cases & users — audience-specific scenarios and when to use the tool.
4. Method & limitations — equations, assumptions and explicit boundaries.

Project 03 additionally has its own workflow tabs inside the engineering workspace:
- Overview
- Mission setup
- Transfer analysis
- Methodology

## Project 01 — Rocket staging optimiser

### Intended users
Launch vehicle concept teams, propulsion and aerospace students, educators and early-stage engineering trade studies.

### User need
Explore how a two-stage launch vehicle's propellant allocation and structural fractions affect ideal velocity increment for a fixed initial mass and payload.

### Inputs
- Total initial vehicle mass (kg)
- Payload mass (kg)
- Stage 1 and Stage 2 specific impulse (s)
- Stage 1 and Stage 2 structural fractions

### Outputs
- Best sampled stage-1 propellant fraction
- Stage-by-stage and total ideal delta-v
- Stage mass breakdown
- Sensitivity curve across sampled propellant allocations

### Model boundary
Two-stage ideal Tsiolkovsky calculation with stage inert mass jettisoned before upper-stage burn. Does not include gravity, atmospheric drag, steering, finite-burn losses, residual propellant, engine mass variation or separation losses. It is not a launch trajectory prediction.

## Project 02 — Rocket ascent simulator

### Intended users
Flight dynamics learners, launch vehicle concept teams, guidance and control students and educators.

### User need
Understand how propulsion, mass depletion, drag, gravity and a time-based pitch schedule affect a simplified 2D ascent.

### Inputs
- Initial and dry mass (kg)
- Engine thrust (N) and specific impulse (s)
- Reference area (m²) and drag coefficient
- Pitch schedule start/end times (s) and angles (degrees from local horizontal)
- Integration time step (s) and maximum simulation time (s)

### Outputs
- Altitude and downrange history
- Radial/tangential velocity and total speed
- Vehicle mass, thrust and drag histories
- Dynamic pressure history and maximum-Q value/time
- Burnout time/speed, maximum altitude, final altitude and termination reason
- Altitude vs downrange plot

### Model boundary
Spherical non-rotating Earth, central gravity, exponential atmosphere, constant thrust/Isp until dry mass, ballistic coast, linear pitch schedule and fixed-step RK4. Excludes Earth rotation, winds, layered atmosphere, variable aerodynamic coefficients, engine transients, staging, closed-loop guidance, 3D steering, structural loads and vehicle flexibility.

## Project 03 — Satellite orbital transfer designer

### Intended users
Satellite mission designers, spacecraft propulsion engineers, astrodynamics students and educators.

### User need
Estimate an ideal manoeuvre budget to transfer between circular Earth orbits, including a combined plane change at arrival.

### Inputs
- Initial circular orbit altitude (km)
- Target circular orbit altitude (km)
- Inclination change (degrees)
- Spacecraft mass (kg)
- Engine specific impulse (s)

### Outputs
- Initial and target circular velocities
- Transfer ellipse semi-major axis
- Transfer perigee and apogee velocities
- Departure and combined arrival/plane-change delta-v
- Total delta-v
- Hohmann transfer time
- Initial and target orbital periods
- Ideal propellant estimate and remaining mass
- CSV export of principal results

### Model boundary
Point-mass Earth, two circular orbits, two ideal instantaneous impulses and a plane change combined with the arrival burn. Propellant uses one effective Isp for the total delta-v. Excludes J2/oblateness, drag, third-body effects, finite burn duration, thrust constraints, eclipses, navigation error and operational constraints.

## User journey

1. Start on Product overview.
2. Select one of the three engineering products or choose the closest engineering need.
3. Read the module overview and intended audience.
4. Open Engineering workspace and configure the model.
5. Inspect results and sensitivities.
6. Read Method & limitations before using the output in any engineering decision.
7. Export available results where supported.

## Product safety and trust

All three modules are educational and preliminary trade-study tools. They are not flight-certified, validated for operational mission design, or suitable for flight safety decisions. The UI must retain visible model limitations and must not imply engineering certification.

## Release acceptance

- TypeScript and production build pass.
- All unit tests pass, including numerical reference and sensitivity tests.
- Browser E2E covers product discovery, module navigation and a complete orbital transfer workflow.
- Visual QA on desktop and mobile widths.
- Accessibility check for keyboard navigation, labels, focus states and semantic headings.
- Confirm no production deployment or merge without explicit approval.


## Public showcase and feedback

The public Aryaksha homepage includes an Aerospace Engineering Products section with one card per module, audience-specific positioning and a direct call to action into the workbench. The cards describe the engineering question each product addresses rather than promising certification or operational performance.

Users can start with the default reference scenario in each module:
- Project 01 uses the built-in two-stage reference vehicle and a reset-to-reference control.
- Project 02 uses a built-in ascent reference vehicle and a reset-to-reference control.
- Project 03 opens with a 400 km to 800 km reference orbit transfer, a 500 kg spacecraft and 320 s effective Isp; its mission setup view can be restored to reference values.

Feedback and bug reports are routed to the Aryaksha GitHub issue tracker at https://github.com/psytronot/Aryaksha/issues/new. This is an issue-submission route and requires a GitHub account.

## Demonstration script (5 minutes)

1. Start at the homepage and explain the three user problems represented by the product cards.
2. Ask the visitor which task they need to solve and use the matching product card.
3. Open Module overview and explain intended users and outcomes.
4. Open Engineering workspace and run the default reference scenario before changing one parameter.
5. Compare the updated output and explain the model assumptions.
6. Open Use cases & users to map the module to the visitor's role.
7. Open Method & limitations and explicitly distinguish preliminary estimates from operational engineering analysis.
8. Invite the visitor to submit a bug report or feature request through the issue tracker.

## Feedback to capture during user interviews

- User role and organisation type (student, university, startup, engineering team, research lab).
- The engineering task they were trying to complete.
- Whether they found the correct module without assistance.
- Whether input names, units and validation were clear.
- Whether outputs were understandable and useful.
- Which missing model capability blocks real use in their workflow.
- Whether they would use the tool again and what evidence they would need before trusting it.
