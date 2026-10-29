# Earth 3D five-upgrade implementation and QA record

**Branch:** `feat/earth3d-five-upgrade-assets`  
**Base:** `main` at the repository state inspected on 2026-10-29  
**Deployment policy:** no AppDeploy or Render deployment is part of this change. The live AppDeploy snapshot is `1793289717405` and must remain unchanged until all release gates pass.

## Scope implemented in this branch

### 1. Earth 2.0
- Retains the existing procedural surface, cloud texture, atmosphere shells and night-light texture.
- Adds procedural polar ice coloring.
- Adds a Sun-direction uniform to the Earth material shader and masks emissive city lights across a soft day/night terminator. The night-light texture is preserved.
- Caps renderer pixel ratio at 1.25 for viewports at or below 720 px and 1.75 otherwise.

### 2. Moon and physical Earth–Moon view
- Reworks the procedural Moon texture with deterministic crater basins/rims and uses the same texture as a bump map.
- Keeps the mean Earth–Moon centre separation derived from 384,400 km and retains the explicit physical-scale disclosure.
- Derives synchronous Moon yaw from orbital phase so local +Z points toward Earth along the x-z orbit plane.
- Keeps the Moon camera target and orbit line selectable.

### 3. Schematic solar system
- Adds selectable Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune with labels and orbit lines; Saturn has rings.
- The overview is deliberately schematic and is labelled as not physical scale / not ephemeris. It is separate from the physical-ratio Earth–Moon scene.
- A camera-target selector focuses individual bodies or the overall schematic.

### 4. Orbital operations and provenance
- Exposes independent spacecraft-orbit, ground-footprint, velocity/nadir, ECI axes, Earth grid, Moon path and planetary-layer toggles.
- Distinguishes the two-body Kepler simulation from SGP4 propagation. Input source is not asserted when it is not declared.
- Communications/RF status is explicitly marked not modelled/not connected.
- Satellite.js/SGP4 and Kepler propagation source files are not modified by this branch.

### 5. Mission-control UI and touch
- Adds a left mission/vehicle/crew-status panel, right operations/layer and solar/comms panel, and a bottom timeline/playback/event strip.
- Connects the existing simulation play/pause, playback-speed and time-scrub state into the 3D view.
- Supports drag orbit, wheel zoom and two-pointer pinch zoom.
- Adds narrow viewport styling and uses deduplicated geometry/material disposal. The footprint BufferAttribute is allocated once and updated in place.

## Automated tests added/updated
- `tests/earth3dMath.test.ts` covers night-light mask endpoints/midpoint, planetary-body inventory and Saturn rings, deterministic schematic orbit positions, synchronous lunar orientation across phases, and responsive camera-fit arithmetic.
- The existing ninth-or-fewer-test policy is preserved: the existing Earth 3D scenario in `tests/tests.json` was expanded rather than adding a duplicate scenario.
- Existing `tests/daynight.test.ts` remains in place.

## Required release QA — status at authoring

These checks must be run against the branch before merge/release. They are not claimed passed by this document.

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. `npm run test:e2e` where the repository's configured browser runner and fixtures are available.
6. Browser checks at 1536×1024, 768×1024, 390×844 and 320×700: all camera modes; Moon path/scale; each body selector; all layer toggles; wheel/pinch zoom; timeline scrub/playback; no mobile overflow.
7. Visual check of day-side/night-side city lights and terminator at four seasonal epochs, cloud/atmosphere depth ordering, polar ice, crater relief and Saturn ring visibility.
8. Verify camera target changes do not mutate the spacecraft state, orbit samples, telemetry or propagation method.
9. Verify the footprint position BufferAttribute identity remains stable across frames; check scene teardown for duplicate disposal, WebGL warnings and renderer resource growth.
10. Capture before/after screenshots and frame-time/heap measurements on desktop and mobile. Record actual evidence before updating the Notion acceptance status.

## Release hold

Do not deploy from this branch automatically. First inspect CI results and browser evidence, resolve all failures, obtain explicit release authorization, recheck AppDeploy's daily quota/cost headroom and the separate Render deployment state, and prepare a rollback. Monthly credits alone are not proof of daily quota or deployment headroom.
