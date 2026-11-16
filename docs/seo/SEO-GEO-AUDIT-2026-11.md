# Aryaksha SEO + GEO audit

**Audit date:** 15 November 2026  
**Scope:** source-level audit of the public HTML shell and all important in-app engineering views on `feature/software-products-hub`. This is not a live crawl or rendered-browser audit.  
**Safety boundary:** no production deployment, domain, canonical-host, robots, sitemap, or indexing changes authorized.

## Executive assessment

Aryaksha is a React/Vite single-page engineering workstation. Its source HTML originally exposed a mostly empty `#root` mount point to non-JavaScript consumers. Search engines may render JavaScript, but that does not make an app shell as useful or reliable as crawlable, server-rendered explanatory pages. The application contains meaningful engineering workflows, but most of the detailed content is generated after hydration and the in-app view selector is not a set of independent URL-addressable pages.

## Route/view inventory

The app is a single public route (`/`) with these in-app views, not independently indexable URLs:

| In-app view | Source evidence | SEO + GEO assessment |
|---|---|---|
| Mission | `src/App.tsx`, `missionDefaults` and mission view | Clear mission-definition workflow; explain that results are preliminary. |
| Payload | payload defaults and payload UI | Concrete input fields; describe units and modelling assumptions in user-facing documentation. |
| Spacecraft | spacecraft defaults and subsystem analysis | Good engineering subject coverage; avoid presenting simplified trade studies as certified design. |
| Orbit & Maneuver | `orbit.ts`, orbit controls and maneuver calculations | High-value topical content; document reference frame, epoch, units and assumptions. |
| Simulation | `Earth3DScene`, propagation and playback state | Distinguish visualization from validated flight dynamics or live telemetry. |
| Satellite Tracking | `SatelliteTrackingView`, tracking utilities | State source, update time, TLE epoch and propagation limits wherever live data is shown. |
| Mission Analysis | `MissionAnalysisView` | Strong topic for GEO; clarify what is estimated versus validated. |
| Engineering Analysis | `engineering.ts` subsystem functions | Explain simplified models, assumptions, units and limits for propulsion, power, thermal, communications and ADCS. |
| Verification | `systemVerification` | Do not imply certification or formal compliance; label as preliminary checks. |
| Design Report | report export in `src/App.tsx` | Useful artifact; include model assumptions, units, epoch and educational-use disclaimer. |
| Instructions & Glossary | `src/glossary.ts` and help view | Strong answer-engine content opportunity; glossary terms should be self-contained and linked. |
| Calculator & Reference | `ScientificCalculator` and tools view | Publish a static reference explaining supported calculations and limits. |
| Software Products | software view | Separate product descriptions and links into crawlable public pages when the product catalogue is stable. |

## Conventional SEO findings

### Fixed in this audit
- Corrected the application title and descriptive positioning.
- Aligned Open Graph and Twitter titles/descriptions.
- Corrected the description grammar.
- Added a `SoftwareApplication` JSON-LD entity using only capabilities visible in the repository.
- Added a meaningful `noscript` overview with workflow links represented as content and a clear educational/preliminary boundary.
- Did not change the existing canonical origin or robots indexing directive.

### Remaining validation / structural risks
1. Canonical and Open Graph URLs currently point to an AppDeploy preview hostname. Confirm the intended public hostname before changing them; this audit deliberately leaves them unchanged.
2. `public/robots.txt` allows crawling but no sitemap was found in the inspected public tree. Do not publish a sitemap until the public URL strategy and stable crawlable routes are agreed.
3. The application is a SPA with no independently addressable route metadata for the 13 in-app views.
4. A public marketing/documentation surface should be separated from the interactive engineering workstation, or the app should migrate to an SSR/prerendered architecture if search visibility for each capability is a product requirement.
5. Verify the SVG social preview renders correctly on major social platforms; consider a raster 1200×630 image if platform support is inconsistent.
6. Run a rendered crawl, mobile performance measurement and accessibility test before treating the audit as complete.

## GEO / answer-engine findings

- The product entity should consistently be described as an educational aerospace engineering workstation, not as flight-qualified or certified engineering software.
- The best answer-ready content is the glossary, model assumptions, units, orbital mechanics explanations, subsystem calculation methods and provenance of satellite data.
- Each technical explanation should distinguish inputs, assumptions, calculation method, outputs, validity range and known limitations.
- Satellite tracking pages must expose source attribution, TLE epoch and data freshness; stale orbital elements must not be described as live precision tracking.
- Design reports should preserve epoch, coordinate/reference frame, units and model caveats so that copied excerpts remain interpretable.
- Add FAQs and concise capability summaries only where they answer real user questions and are supported by the implementation.
- Do not add fabricated citations, synthetic benchmarks, unsupported certification claims, keyword stuffing or special GEO markup.

## Highest-impact priority queue

1. **P0 — Public identity:** confirm the canonical production domain and whether the AppDeploy host is temporary.
2. **P1 — Crawlable content:** create public, stable pages for mission design, orbit analysis, satellite tracking, subsystem analysis, glossary and software products.
3. **P1 — Scientific trust:** publish model assumptions, reference frames, units, epoch/data-source details and limitations alongside outputs.
4. **P1 — URL architecture:** give public content stable URLs and metadata; keep interactive state in the app.
5. **P2 — Sitemap and structured data:** add only after canonical host and page inventory are approved.
6. **P2 — Performance/accessibility:** test mobile, reduced motion, keyboard navigation, canvas fallbacks and actual Core Web Vitals.

## Evidence limits

This report is based on source inspection. It does not claim a live crawl, Search Console status, AI citation share, Core Web Vitals measurements, browser accessibility pass, or production-indexing verification. No production indexing or deployment settings were changed.
