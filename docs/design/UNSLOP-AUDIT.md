# Unslop audit — Aryaksha Orbital Lab

**Method:** adapted from [heydamir/unslop](https://github.com/heydamir/unslop), CC BY 4.0. See `.agents/skills/unslop/ATTRIBUTION.md`.

## Product-derived direction

- **Product:** An educational aerospace engineering workstation for mission design, orbital analysis, spacecraft subsystem studies, satellite tracking and learning.
- **Character:** instrument-like, rigorous, approachable.
- **World:** a spacecraft engineering lab with dark instrument panels, measured data and restrained aerospace-blue/cyan signals.
- **Moments:** the orbit/spacecraft visualisation and the engineering result/verification views.
- **Signature:** a clear, non-glowing status signal paired with traceable engineering values and units.

## Source audit findings

| Area | Observed pattern | Treatment |
|---|---|---|
| Surfaces | Radial color wash, repeated gradient cards and heavy card shadows | Replaced the global page wash and primary card gradient/shadow with quiet neutral surfaces |
| Accent | Cyan applied to many headings, icons, labels and borders | Kept aerospace cyan as the identity accent but softened it and reduced decoration in primary chrome |
| Motion/depth | Glowing status dots and large ambient shadows | Removed status-dot glow and card shadow; retain only functional state changes |
| Typography | 7–9px metadata, 700-weight figures and tightly tracked uppercase labels | Increased key navigation, labels, form controls, helper copy and table text; reduced tracking and emphasis weights |
| Layout | App shell with 230px sidebar and dense instrument content | Preserve full-width application proportions; improve page edge behavior and retain responsive information hierarchy |
| Components | Repeated nested borders and accent-filled callouts | Keep useful boundaries; use neutral surfaces and quiet hairlines |
| Scientific content | Engineering fields, model chain and verification summaries | Preserve units, provenance and educational/not-flight-certified disclosures; do not rewrite technical meaning for style |

## Pass decisions

- **Spacing:** normalize the most-used shell and form gaps while preserving dense engineering workflows.
- **Color:** use neutral graphite surfaces; reserve softened cyan for meaningful active/primary states and data emphasis.
- **Icons:** retain Lucide line icons; no emoji decoration introduced.
- **Copy:** do not invent claims or simplify scientific labels in a way that changes meaning.
- **Type:** improve legibility of key metadata and controls; preserve mono for numeric engineering values.
- **Layout:** preserve the workstation shell and data-rich panels; do not turn the lab into a marketing landing page.
- **Details:** remove ambient glows and oversized card shadows; keep visible focus and semantic status.
- **Visuals:** orbit/spacecraft rendering is the product visual; no generic AI hero art or decorative blobs.
- **Motion:** keep purposeful simulation animation; respect reduced motion and avoid ambient pulsing.

## Verdict

**A focused unslop pass was warranted and applied to the global chrome and high-frequency UI components.** The update preserves the aerospace instrument identity while improving text scale, reducing decorative effects and quieting repeated surfaces.

**Not checked by this source audit:** every application view at every viewport, complete contrast matrix, screen-reader review, and full interaction coverage. Browser evidence and exact-head CI remain required.
