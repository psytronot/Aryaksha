# Earth 3D five-upgrade mainline port — QA and release record

**Branch:** `feat/earth3d-mainline-port-20261030`  
**Base source:** `df08305cb4e6a929efce48f9703b26c324b91c95` (current main at port start)  
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

- Moon camera no longer uses a fixed 2.0 scene-unit distance; it fits the lunar disc to the active viewport.
- Moon camera fit is recalculated after resize/orientation changes while preserving the user's zoom ratio.
- SYSTEM reset recomputes the Earth–Moon system fit and resets the system zoom ratio.
- Two-pointer pinch and wheel zoom update per-mode zoom ratios so resize refits do not discard the zoom state.
- Camera mode/distance are exposed as lightweight data attributes for deterministic interaction tests.
- Resource disposal helper is exported for a unit test that verifies shared geometries/materials are disposed once.

## Automated validation

The PR workflow must run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and serial Playwright E2E. It uploads `earth3d-browser-evidence` with Earth desktop/mobile, Moon, and planetary screenshots. The tests cover camera reset, pinch, resize/orientation, lunar framing, camera-target selection, layers, timeline playback, context loss, and renderer mount/unmount.

The WebGL browser rAF sample is explicitly not a renderer FPS benchmark. No FPS or memory measurement is claimed in this change.

## Visual acceptance still required

Inspect the uploaded screenshots at desktop and mobile sizes before acceptance. Confirm the Moon disc is framed rather than filling the canvas as a blurred surface, all panels remain readable without horizontal overflow, the planetary overview is legible, and no WebGL/shader errors are logged.

## Release hold

Do not merge or deploy from this branch automatically. Require green CI/CodeQL/AppDeploy scenario validation, visual screenshot review, quota/cost headroom, Render deployment review, rollback readiness, and explicit release authorization. Monthly AppDeploy credits alone do not establish daily quota or deployment headroom.
