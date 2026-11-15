# Aryaksha repository working instructions

## Default engineering mode: Ponytail Full

Use the Ponytail engineering method for every change: understand the whole path, then make the smallest complete change. "Smallest" never means removing required validation, scientific correctness, security, accessibility or error handling.

1. **Map before editing.** Read the relevant source, tests, callers, fixtures, schemas, configuration and deployment path. Start with `README.md`, `SECURITY.md`, and the relevant documents in `docs/`. Trace inputs through the frontend, API adapter/host and Orekit service as applicable.
2. **Choose the smallest complete solution.** Reuse the existing React/TypeScript, Express, Orekit/Spring Boot, schema and test patterns. Prefer existing platform APIs and installed dependencies. Do not add packages, layers, wrappers, configuration or speculative options for a small task.
3. **Preserve the safety floor.** Keep trust-boundary validation, authentication/authorization, bounded requests and responses, replay protection, useful error handling, data integrity, security headers and accessibility. Never trade them away to reduce code.
4. **Protect engineering fidelity.** For orbital, attitude, coordinate, time, telemetry or spacecraft calculations, state units, reference frames, epochs, assumptions and model limits. Test known vectors, invariants, boundary/degenerate inputs and failure cases. Do not silently replace a failed authoritative numerical service with a lower-fidelity fallback or describe a simplified model as flight-grade.
5. **Test risky logic.** Branches, loops, parsers, calculations, security rules, data writes and new scripts need focused tests. Update the matching API/schema/browser tests when contracts or user journeys change.
6. **Review the connected change.** Inspect the actual diff plus callers, tests, schemas, API contracts, workflows and deployment configuration. Check correctness, security, data loss, races, unbounded work, expected load, performance and unnecessary code. Every finding must include a concrete scenario, evidence, fix and consequence.
7. **Mark deliberate shortcuts.** Use a code comment in this form: `shortcut: <known limit>, <condition that triggers an upgrade>`. Include a real ceiling and a revisit trigger. A shortcut never excuses missing safety controls or misleading engineering claims.
8. **Report evidence.** State what changed, exact commands/workflows run and their results, what was not checked, assumptions and remaining risks. Do not equate a passing build with scientific validation, deployment verification or release approval.

## Project-specific boundaries

- Aryaksha is an educational aerospace engineering workstation, not a flight-critical system. Preserve that limitation in user-facing claims and documentation.
- Keep the GitHub repository, Render services and separate AppDeploy instance distinct. A Git commit or source upload does not prove that every deployment has updated.
- Read `docs/DEPLOYMENT_RUNBOOK.md`, `docs/ROUTE_INVENTORY.md` and `docs/API_CONTRACT.md` before deployment, route or contract changes.
- Do not deploy, migrate production services, change hosting/service settings, connect new external data sources, rotate or expose credentials, or alter release configuration without explicit authorization.
- Never commit secrets, tokens, private keys, production environment files or personal data. Follow `SECURITY.md`; revoke exposed credentials rather than merely deleting them from the latest commit.
- Keep external data provenance, timestamps, source limits and licensing visible. Do not claim live telemetry, continuous ephemeris, high-fidelity force models or verified spacecraft integrations unless the implementation and evidence actually support those claims.

## Verification commands

Run the narrowest relevant checks first, then the complete required checks for the affected subsystem:

- Frontend/API TypeScript: `npm run typecheck`
- Unit/API/schema/security tests: `npm test`
- Production frontend bundle: `npm run build`
- Browser acceptance: `npm run test:e2e` after installing the pinned Playwright browser where needed
- Orekit service: `cd orekit-service && mvn test`

For UI changes, verify relevant desktop and mobile viewports, keyboard/touch behavior, reduced motion and WebGL resource lifecycle as applicable. For scientific calculations, automated tests are necessary but independent reference-vector/error-budget review may still be required. Report any unavailable check rather than implying it passed.

## Review output

Prioritize findings as **Must fix**, **Should fix**, and **Nice to have**. Explain what the code does, the concrete failure scenario, the smallest fix and the consequence of skipping it. Avoid style-only findings and speculative warnings. End with a Ship / fix-first verdict and explicit "Not checked" items.

Default intensity is **Full**. Use **Lite** only when the user explicitly asks for a narrow pass. Use **Ultra** when the user asks to challenge the requirement or architecture before implementation.

This file adapts Ponytail's instruction method for repository-aware agents. It does not install Ponytail CLI commands, plugins, lifecycle hooks or benchmark instrumentation. Do not attribute upstream benchmark results to Aryaksha.


## Unslop design-craft method — required for UI work

Use the project-local adaptation at `.agents/skills/unslop/SKILL.md` and its references when auditing or changing user interfaces. The upstream source is https://github.com/heydamir/unslop by Damir Sokolovsky, licensed CC BY 4.0; preserve the attribution in `.agents/skills/unslop/ATTRIBUTION.md`.

1. **Audit before styling.** Inspect the rendered screen at real viewports where possible, then list concrete defects with component/file locations. Distinguish genuine generic UI patterns from intentional brand elements.
2. **Write a product-derived direction.** State product/audience, character, visual world, one or two content-rich moments and one signature detail. Derive this from the actual product, never from trends.
3. **Run the passes in order:** spacing, color, icons, copy, type, layout, details, visuals, motion. Keep section order and product behavior; change presentation only where evidence supports it.
4. **Keep the brand.** Preserve approved identity, semantic tokens, information architecture and useful visual language. Do not replace a distinctive design with a generic monochrome template. Remove decorative gradients/glows, arbitrary spacing, emoji decoration, shouty labels and unnecessary pills only where they harm clarity or consistency.
5. **Keep the content honest.** Never invent product capability, customer proof, technical performance, scientific accuracy, live status, certification or contact information. Use plausible demo data only when clearly identified as illustrative.
6. **Use visuals with purpose.** Prefer the real product, engineering object, diagram or data visualization over generic AI imagery. Do not generate or add paid assets without explicit approval. Optimize image dimensions/formats, alt text, loading priority and layout stability.
7. **Respect accessibility and performance.** Check WCAG AA contrast, focus visibility, keyboard/touch, reduced motion, responsive reading order, image loading, and avoid expensive continuous effects.
8. **Check the result.** Render again, compare with the audit list, run focused tests and inspect the final diff. If a screen is already strong, make no change just to prove activity.

This method is complementary to the existing project design system and Ponytail Full-mode engineering method. Project-specific design and engineering rules take precedence where an upstream generic recommendation conflicts with brand, accuracy, accessibility, performance or safety.

## Background texture system

Before adding or changing decorative backgrounds, read `docs/design/BACKGROUND-TEXTURE-SYSTEM.md`. Treat its 22 treatments as an opt-in library, not a checklist to apply wholesale. Use only textures that reinforce the product-derived visual direction; keep patterns subtle, performant, responsive and subordinate to content. Preserve contrast, keyboard focus, reduced motion and scientific/content accuracy. Prefer CSS patterns for simple grids/dots; use licensed/approved assets for photographic or painterly treatments. Never add an external image asset or generated image as a background without checking rights, purpose, loading cost and user approval where required.

## GEO + SEO workflow

Before changing search visibility, metadata, robots, sitemap, structured data or search-facing content, read `.agents/skills/geo-seo/SKILL.md` and its checklist. GEO means Generative Engine Optimization. Follow deployment-specific indexing protections, preserve preview noindex/disallow behavior, use verified canonical origins only, and never promise rankings or AI citations. Structured data must match visible facts. `llms.txt` is optional and must not be added as a ranking hack. Follow the project-specific scientific, content, privacy and production boundaries in the skill.

## Conventional SEO workflow

Before conventional search optimization work, read `.agents/skills/seo/SKILL.md` and its checklist. This skill owns technical SEO, on-page optimization, indexation, site architecture, content quality, image SEO, performance and search measurement. For AI answer-engine discoverability, also consult `.agents/skills/geo-seo/SKILL.md`. Keep the two workflows distinct but coordinated. Preserve preview noindex/canonical protections and all project-specific factual, scientific, privacy and production boundaries.

## StringTune motion workflow

Before adding Fiddle Digital StringTune or changing motion architecture, read `.agents/skills/string-tune/SKILL.md` and its checklist. Audit existing animation systems first; do not duplicate engines. Keep runtime client-only and singleton-owned, use only documented exports, update package lockfiles with dependencies, preserve reduced-motion/accessibility/touch behavior, and follow project-specific guardrails. Do not add StringTune-3D without a concrete requirement.
