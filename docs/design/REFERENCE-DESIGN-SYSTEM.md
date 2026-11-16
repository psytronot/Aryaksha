# Reference-led visual system

Status: implementation brief for the active software-products branch. These references inform original layouts; do not copy another site's pixels, copy, branding, or proprietary assets.

## Source galleries

- Scrolltide — scroll-driven sections, templates, components and shader references: https://www.scrolltide.co/
- Supahero — real-world hero composition references (the name is **Supahero**, not Superhero): https://supahero.io/
- Navbar Gallery — navigation patterns: https://www.navbar.gallery/
- Footer Design — footer structure and visual patterns: https://www.footer.design/
- CTA Gallery — calls to action and conversion patterns: https://www.cta.gallery/
- Refero Styles — real product design systems and DESIGN.md references: https://styles.refero.design/
- 3Dicons — 3D icon library: https://3dicons.co/

Use galleries as research, not as an instruction to reproduce a particular site. Scrolltide contains paid templates; use only publicly viewable references or assets the project is licensed to use. Do not scrape or copy premium prompts/source.

## Aryaksha visual direction

Retain the dark aerospace engineering workstation: deep graphite/navy surfaces, restrained cyan instrumentation accent, clear mono numeric readouts, strong readable labels, and functional density. The public-facing software-products hub can be more editorial; the engineering workspace must remain task-first.

| Surface | Pattern to research and adapt | Implementation intent |
|---|---|---|
| Navbar | Navbar Gallery: compact, clear app navigation | Preserve grouped workspace navigation, mobile drawer behavior, keyboard operation and active-view state. Do not add a marketing mega-menu inside the engineering application. |
| Hero / software hub | Supahero + Scrolltide: split hero, clear product proposition and proof | Use for the public software hub only. Keep app workspace header compact and functional. |
| Feature gallery | Refero Styles + Scrolltide section patterns | Use a restrained product gallery to explain Mission Design, Orbit & Maneuver, Simulation, Tracking, Analysis and Reporting. Distinguish available, local-only and experimental functionality truthfully. |
| CTA | CTA Gallery | Use clear actions such as Open workspace / Explore tools / Read documentation. Do not introduce a fake signup, payment or cloud-sync action. |
| Footer | Footer Design | Add a compact product footer for documentation, source, version and educational-use disclosure only where destinations are real and verified. Avoid clutter inside the live engineering workspace. |
| 3D icons | 3Dicons | Optional icons for public feature cards or learning content only. Prefer the existing Lucide icon system inside the workspace; do not replace engineering symbols or telemetry labels with decorative icons. |

## Motion and scientific integrity contract

- Do not apply scroll-linked animation to forms, engineering inputs, telemetry, tables, simulation controls, tracking controls or result values.
- Do not alter orbit propagation, numerical calculations, timestamps, units, validation, simulation playback or scientific visualizations as part of a visual pass.
- Preserve the existing Earth/3D scene and its performance/lifecycle controls; never add a second 3D scene to decorate the same screen.
- Respect `prefers-reduced-motion`, retain native scroll and browser navigation, and keep all controls keyboard accessible.
- Any new motion is optional progressive enhancement, never required to understand or operate the product.
- Lazy-load optional media and avoid large shader/WebGL effects on mobile or low-power devices.

## Reference-derived implementation sequence

1. Inspect App.tsx, index.css, reduced-motion.css, mobile navigation and existing E2E tests before editing.
2. Separate public marketing surfaces from the functional engineering shell.
3. Refine app navigation and shell first; then public software hero, capability gallery, CTA and footer.
4. Verify 390px and 1440px layouts, keyboard/focus, reduced motion, route/view switching, input interaction and no horizontal overflow.
5. Run typecheck, unit tests, production build and Playwright E2E before calling the work complete.

## Attribution and asset provenance

Record the selected gallery entry and asset source beside the implementation. The galleries are references, not sources of automatically reusable code or images. For 3Dicons, verify the individual asset's current license/terms before bundling it. No premium Scrolltide content is assumed to be licensed.
