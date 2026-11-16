---
name: string-tune
description: "Integrate Fiddle Digital StringTune as a modular, client-side motion runtime. Use for scroll-driven progress/parallax, cursor interactions, responsive behavior and motion architecture. Consult before installing or using @fiddle-digital/string-tune."
---

# StringTune Integration Skill

## Source of truth
- Official docs: https://tune.fiddle.digital/docs/overview/
- Installation: https://tune.fiddle.digital/docs/introduction/
- Quick start: https://tune.fiddle.digital/docs/quick-start/
- API: https://tune.fiddle.digital/docs/api/string-tune/
- Built-in module catalogue: https://tune.fiddle.digital/docs/modules/overview/
- Responsive: https://tune.fiddle.digital/docs/modules/responsive/
- Cursor lifecycle: https://tune.fiddle.digital/docs/modules/cursor/
- Package: https://www.npmjs.com/package/@fiddle-digital/string-tune

Use package exports and current official docs as source of truth. Do not rely on undocumented internal runtime fields or stale copied examples.

## Architecture
StringTune is a modular DOM runtime:
1. Create one shared instance with `StringTune.getInstance()`.
2. Register only required built-in modules with `stringTune.use(Module, options?)`.
3. Mark elements with documented `string=` attributes and optional `string-id`.
4. Consume documented CSS variables, classes or events.
5. Start once from a client-only application bootstrap after DOM availability.

Do not create one runtime per component or page. Do not register duplicate instances during React Strict Mode, route transitions or hot reload. Use a single owner and an idempotent bootstrap with teardown/rebuild behavior verified against the current package API.

## Mandatory engineering workflow
- Inspect current animation/motion systems and identify overlap before installing the package. Reuse existing CSS/WAAPI/GSAP/Framer Motion behavior when it already solves the problem.
- Read current package version, exports, peer dependencies, bundle size and license before adding dependency. Pin a deliberate version and update the correct lockfile in the same change.
- Start with the smallest relevant module set; do not register the whole catalogue.
- Keep imports and runtime initialization out of SSR/server components. Use a client-only lifecycle boundary for Next.js and browser-only startup for Vite/React.
- Verify package lifecycle, SPA navigation, dynamic DOM changes, resize and cleanup. Use only documented public APIs.
- Avoid enabling smooth-scroll globally unless explicitly designed and tested; preserve browser-native navigation, anchors, focus, keyboard use and expected scroll behavior.
- Do not use cursor-follow or magnetic interactions as the only way to expose controls. They are optional enhancements and must gracefully disappear on touch/coarse-pointer devices.
- Motion must be progressive enhancement: content remains visible and usable if JavaScript fails or the library is unavailable.
- Respect `prefers-reduced-motion: reduce`. Disable or simplify nonessential motion; do not rely solely on a library default.
- Avoid animating large layout properties; prefer transform/opacity and keep frame work bounded.
- Verify mobile, keyboard, touch, reduced motion, no-JS/fallback, route navigation and performance. Measure bundle impact and long tasks.
- Do not add StringTune-3D or Three.js unless a concrete 3D feature is requested and justified; this package is not required for base StringTune.

## Module selection
- `StringProgress`: scroll progress indicators / CSS progress output.
- `StringParallax`: restrained parallax on decorative or editorial elements only.
- `StringCursor` / `StringMagnetic`: desktop fine-pointer affordances; never required for navigation or core action.
- `StringResponsive`: only when its width-based display toggling is explicitly needed. It writes inline `style.display`; do not use it to replace CSS media queries or responsive layout.
- Other modules only after checking the exact current docs and product need.

## Project-specific guidance

### GENSER
- Use motion to support aerospace editorial storytelling: quiet reveal, progress and diagram emphasis, not a theme-park effect.
- Keep headings, capability content, contact links and technical archive fully readable and usable without motion.
- Do not animate data as though it were live telemetry or a validated engineering simulation.
- Do not compete with the existing `MotionSystem`; decide whether StringTune replaces a specific measured gap or remains unused. No duplicate scroll or cursor engines.
- Preserve the existing visual identity, reduced-motion behavior and preview SEO protections.

### Aryaksha
- Treat the application as an engineering workstation, not a marketing microsite.
- Prioritize stable controls, readable numeric values, chart/scene performance and predictable navigation over decorative motion.
- Do not animate scientific values, orbit geometry or telemetry in ways that imply extra fidelity or alter calculation timing.
- Avoid cursor/magnetic behavior on form controls, navigation, charts and engineering inputs.
- Prefer existing CSS transitions and React state for functional feedback. Add StringTune only to non-critical shell-level progress or subtle orientation cues after profiling.
- Preserve touch operation, reduced motion, keyboard navigation and WebGL resource lifecycle.

## Definition of done
- Dependency and lockfile are consistent.
- Exactly one runtime owner and only necessary modules are registered.
- No SSR errors, duplicate frame loops or navigation leaks.
- Reduced-motion and touch/coarse-pointer behavior verified.
- Keyboard and native browser interactions remain intact.
- Build, typecheck, focused tests and measured performance checks are recorded.
- State explicitly which effects are implemented and which remain recommendations.
