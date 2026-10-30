# Earth 3D five-upgrade mainline port — QA and release record

**Branch:** `feat/earth3d-mainline-port-20261030`  
**Base source:** `6d8c6490aea794036ae45b85e2ae2dc15f08224a` (current main at rebase start)  
**Prior implementation:** PR #50 / `a5215f11f9ce8a9c4c1f15471dd9e3b2b887debe`  
**Deployment policy:** source-only candidate. No AppDeploy or Render deployment is part of this change.

## Mainline preservation

- `App.tsx` continues to lazy-load Earth3DScene, SatelliteTrackingView, MissionAnalysisView and ScientificCalculator.
- The current Vite vendor chunk split is retained; `vite.config.ts` is intentionally unchanged.
- Satellite.js/SGP4, Kepler propagation, orbit sampling, tracking and Mission Analysis implementation are not changed.
- The current mainline Mission Analysis 503/502 no-fallback contract is preserved in `tests/tests.json`; only the existing Earth 3D scenario is expanded.

## Five-upgrade implementation

1. Earth 2.0: procedural surface and polar ice treatment, cloud layer, atmosphere shells, Sun-direction shader terminator and preserved emissive night-light texture.
2. Moon: deterministic crater relief and bump mapping, physical mean Earth–Moon separation, synchronous Earth-facing orientation, scale disclosure, and viewport-fitted Moon camera.
3. Solar system: selectable Sun and eight planets, Saturn rings, labels/orbits, and explicit schematic/not-ephemeris disclosure.
4. Operations: independent orbit, footprint, velocity/nadir, axes, Earth-grid, lunar and planetary layers; simulated Kepler versus SGP4 provenance; RF/comms not-modelled status.
5. Mission control: left vehicle/crew panel, central globe, right telemetry/facts/layers, bottom ground-track/orbit/mission cards, scene gallery, timeline, playback, camera modes and touch layout.

## Defect corrections in this port

- Moon camera no longer uses a fixed 2.0 scene-unit distance; it fits the lunar disc to the active viewport with a 1.7× sphere-fit margin, leaving visible limb and surrounding space.
- Moon camera fit is recalculated after resize/orientation changes while preserving the user's zoom ratio; sphere fitting uses the sine-based angular-radius relation.
- SYSTEM reset recomputes the Earth–Moon system fit and resets the system zoom ratio.
- Two-pointer pinch and wheel zoom update per-mode zoom ratios so resize refits do not discard the zoom state.
- Camera mode/distance are exposed as lightweight data attributes for deterministic interaction tests.
- The responsive camera-control row is layered above HUD cards; the left HUD now follows the measured topbar height so mobile wrapping cannot intercept camera-button input.
- Resource disposal helper is exported for a unit test that verifies shared geometries/materials are disposed once.
- Spacecraft geometry uses a deterministic display exaggeration that targets a 0.5 scene-unit maximum bus dimension; the HUD shows both the true Earth-diameter/bus ratio and the display exaggeration factor.

## Automated validation

The PR workflow must run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and serial Playwright E2E. It uploads `earth3d-browser-evidence` with Earth desktop/mobile, Moon, and planetary screenshots. The tests cover camera reset, pinch, resize/orientation, lunar framing, camera-target selection, layers, timeline playback, context loss, and renderer mount/unmount.

The WebGL browser rAF sample is explicitly not a renderer FPS benchmark. No FPS or memory measurement is claimed in this change.

## Visual acceptance still required

Inspect the uploaded screenshots at desktop and mobile sizes before acceptance. Confirm the Moon disc is framed rather than filling the canvas as a blurred surface, all panels remain readable without horizontal overflow, the planetary overview is legible, and no WebGL/shader errors are logged. The current Earth texture has polar ice treatment and Sun-driven illumination, but no separate auroral emission layer; keep dedicated aurora/polar glow acceptance open until that visual treatment is added or explicitly excluded.

## Release hold

Do not merge or deploy from this branch automatically. Require green CI/CodeQL/AppDeploy scenario validation, visual screenshot review, quota/cost headroom, Render deployment review, rollback readiness, and explicit release authorization. Monthly AppDeploy credits alone do not establish daily quota or deployment headroom.


## 2026-10-30 current-main rebase

- Rebase target: `6d8c6490aea794036ae45b85e2ae2dc15f08224a`.
- Kept the current-main CSP/accessibility and WebGL benchmark acceptance tests; did not replace `tests/e2e/earth3d-acceptance.spec.ts` with the older branch copy.
- Retained the current-main simulation playback-speed accessible name on the new timeline control.
- Added topbar-height observation and HUD stacking correction after PR #61 browser evidence showed `.earth3d-left-hud` intercepting SYSTEM/EARTH camera-button pointer input.
- Added failure trace/error-context artifact upload for subsequent Playwright triage.
- This is a source-only rebase candidate. No merge, AppDeploy source write or deployment was performed.


## Visual-scale disclosure

The spacecraft model's display scale is computed from the largest configured bus dimension and a 0.5 scene-unit target extent. `spacecraftVisualExaggeration` and `trueEarthDiameterToBusRatio` are pure helpers with unit coverage; the HUD reports the computed linear exaggeration and the true-scale Earth-diameter-to-bus ratio. The 3D geometry remains explicitly not to physical scale.
