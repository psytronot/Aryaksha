# Aryaksha UX Audit and Product Experience Standard

**Scope:** Current React application and the Aerospace Workbench on the isolated UX simplification branch.  
**Baseline:** `feature/aerospace-products-1-2-3` at `bc35c10f25079dbcf275d60c539dcb3e61dbbe14`.  
**Status:** Source-level audit and first navigation remediation; visual QA and browser execution remain release gates.

## 1. Executive finding

Aryaksha already contains several distinct engineering workflows: mission definition, payload design, spacecraft configuration, orbit and manoeuvre design, simulation, satellite tracking, mission analysis, engineering analysis, verification, reporting, learning/reference tools and the Aerospace Workbench. The primary usability risk is not a lack of capability; it is that users are asked to understand too many destinations and overlapping technical labels before they know where to begin.

The application also has a separate Software Products area. General-purpose utilities should remain distinct from aerospace engineering workflows.

## 2. Source-grounded route inventory

| Current destination | User task | Proposed navigation group |
|---|---|---|
| Mission | Define mission objectives and constraints | Plan |
| Payload | Configure payload parameters | Design |
| Spacecraft | Configure spacecraft subsystems | Design |
| Orbit & Maneuver | Define orbit and manoeuvre parameters | Design |
| Simulation | Explore the 3D mission/orbit simulation | Analyse |
| Mission Analysis | Run orbital analysis through the analysis workflow | Analyse |
| Engineering Analysis | Inspect preliminary subsystem calculations | Analyse |
| Verification | Review model checks and margins | Analyse |
| Satellite Tracking | Explore satellite positions and passes | Explore |
| Aerospace Workbench | Open specialist launch and orbital tools | Explore |
| Design Report | Review/export engineering report | Output |
| Instructions & Glossary | Learn workflows and terminology | Learn & Tools |
| Calculator & Reference | Use supporting calculation/reference tools | Learn & Tools |
| Software Products | Discover general-purpose utilities | Learn & Tools |

This is a navigation classification, not a claim that every destination has the same maturity or fidelity.

## 3. Audit findings

### P0 — Navigation discoverability
- The previous desktop sidebar rendered only Design, Run, Output, Learn and Tools groups.
- The Aerospace Workbench was assigned to an Engineering group that was not included in the rendered group list. This made it unreachable from that desktop sidebar even though it existed in the route model and mobile navigation.
- The mobile navigation listed every destination in one flat collection, creating unnecessary scanning and visual density.
- Several labels describe disciplines or internal functions rather than the task users are trying to complete.

**Remediation in this branch:** regroup destinations into Plan, Design, Analyse, Explore, Output and Learn & Tools; use native expandable sections; ensure the Aerospace Workbench is included in the Explore group; apply the same grouping to mobile navigation.

### P1 — Product discovery
- The Aerospace Workbench gives the three new analytical tools their own product overview and workspaces.
- The main platform and specialist workbench should be presented as related destinations, not competing entry points.
- Product cards should explain the engineering question, expected output and model boundary before users launch a tool.

### P1 — Workspace consistency
Every analytical workspace should use a consistent information hierarchy:
1. Purpose and intended user.
2. Inputs, with units, validation and contextual explanations.
3. Primary action to calculate or simulate.
4. Key results and engineering interpretation.
5. Supporting charts, detailed outputs and export.
6. Methodology, assumptions and limitations.

Do not force every tool into identical layouts when its engineering task requires a different visualisation.

### P1 — Progressive disclosure
- Keep essential inputs visible.
- Place advanced or rarely changed parameters in clearly named expandable sections.
- Explain units and terms at the point of use.
- Avoid duplicating the same explanation in multiple panels.
- Preserve direct access to advanced controls for expert users.

### P1 — Results communication
- Lead with a small number of decision-relevant outputs.
- Label every value with units.
- Separate computed values from assumptions, warnings and user inputs.
- Explain what a result means; do not present a chart without a title, axes and context.
- Make model limitations visible before users rely on the output.

### P2 — Visual and interaction discipline
- Use one spacing, typography, border, surface and focus-state system.
- Reserve strong accent treatments for active states and important actions.
- Use consistent control sizes and labels.
- Avoid decorative cards that repeat navigation labels without adding information.
- Respect reduced-motion preferences and keyboard navigation.
- Ensure layouts work at narrow widths without horizontal page overflow.

## 4. Shared design rules

### Information architecture
- **Plan:** mission intent and constraints.
- **Design:** payload, spacecraft and orbit configuration.
- **Analyse:** simulation, mission analysis, engineering analysis and verification.
- **Explore:** satellite tracking and specialist aerospace workbench.
- **Output:** reports and exports.
- **Learn & Tools:** instructions, glossary, calculators and general-purpose software utilities.

### Page hierarchy
- One clear page title.
- One sentence explaining the task.
- A single primary action.
- Inputs grouped by engineering concept.
- Key results visually prioritised over secondary details.
- Methodology and limitations available without crowding the main task.

### Form behaviour
- Always show units.
- Use sensible reference values only when they are clearly identified as examples/defaults.
- Validate ranges and explain how to correct invalid inputs.
- Do not silently change user-entered values.
- Preserve user inputs when moving between workspace tabs where technically supported.

### Accessibility
- All controls must have accessible names.
- Inputs must have programmatic labels and visible units.
- Focus states must be visible.
- Expandable navigation must use semantic controls.
- Do not rely on colour alone to communicate status.
- Respect reduced-motion settings.

## 5. Release acceptance checklist

- [ ] Every registered view is reachable from desktop navigation.
- [ ] Every registered view is reachable from mobile navigation.
- [ ] The current destination is clearly indicated.
- [ ] Navigation groups can be expanded and collapsed using keyboard and pointer.
- [ ] The Aerospace Workbench is discoverable from the desktop sidebar.
- [ ] Aerospace engineering tools and general-purpose utilities are not presented as the same product category.
- [ ] Each engineering workspace explains its purpose, inputs, units, outputs and model boundaries.
- [ ] No unlabeled controls or inputs on key workflows.
- [ ] No horizontal overflow at 320 px, 375 px, 768 px and desktop widths.
- [ ] Automated typecheck, unit tests, production build and Playwright E2E pass.
- [ ] Manual visual QA is recorded for desktop and mobile.
- [ ] No production merge or deployment without explicit approval.

## 6. Work completed in the first remediation pass

- Reclassified all existing navigation destinations into six task-oriented groups.
- Added expandable, semantic desktop navigation groups.
- Reused the same group structure in the mobile navigation instead of one flat list.
- Fixed the desktop discoverability defect for Aerospace Workbench.
- Added compact styling for group headers, active destinations and mobile group layout.

## 7. Remaining work and boundaries

This pass does not claim a complete visual redesign of every engineering workspace. The next implementation pass should inspect and improve individual forms, result panels, chart hierarchy, contextual help, error states and narrow-screen layouts. Those changes must be driven by the actual component implementations and protected by workflow-specific tests.

The numerical models remain preliminary educational and trade-study models unless their respective documentation and validation evidence establish otherwise.


## 8. Follow-up implementation and release evidence

### Engineering workspace improvements
- Mission Analysis: explicit label/input associations, busy state semantics, live completion announcement and a visible list of model assumptions returned by the service.
- Satellite Tracking: catalogue refresh and pass-prediction status are announced through polite live regions; prediction action exposes its busy state.
- Orekit proxy: upstream validation detail is sanitized and surfaced in the API response and server logs rather than being hidden behind a generic HTTP 502.
- Regression coverage: a mocked upstream integration test checks numeric request forwarding, propagation-time forwarding, successful Orekit result rendering and sanitized upstream rejection handling.
- Responsive coverage: added a mobile mission-to-verification journey at 375 px and viewport overflow assertions at 320, 375, 768 and 1440 px.

### Production issue discovered during health review
The existing AppDeploy Aryaksha service has repeated backend errors for `POST /api/mission-analysis/orbit`: the proxy reports HTTP 502 after the Orekit service returns HTTP 400. The deployed AppDeploy snapshot is separate from the Git branch source, so the live app has not been changed. The branch now captures the upstream error body in a bounded, sanitized form so the exact validation reason can be diagnosed in the isolated preview.

### Isolated preview
- Render service: `aryaksha-ux-preview`
- Branch: `feature/aryaksha-ux-simplification`
- Auto-deploy: disabled; subsequent commits require an intentional manual deploy.
- Build and service startup: successful.
- Preview URL: https://aryaksha-ux-preview.onrender.com
- Existing AppDeploy app and production Render services were not modified.

### Remaining release gates
- Browser smoke suite on the latest branch head must complete successfully.
- Review the isolated preview at desktop and mobile sizes.
- Submit a real mission-analysis request through the isolated preview and inspect the returned upstream reason before deciding whether the Orekit service itself requires a code or configuration change.
- Do not publish to production until the live numerical-propagation check and the full release acceptance checklist pass.


### Rate-limit handling update
- The Orekit proxy now maps upstream HTTP 429 to HTTP 503 with a clear retry message and forwards `Retry-After` when supplied.
- Regression coverage verifies the 503 mapping and retry header.
- The isolated preview's Render service was manually redeployed with this handling; automatic deploys remain disabled.
- Live Orekit calculations remain blocked by upstream rate limiting / edge challenge responses. No paid-plan upgrade or production service change has been made.
