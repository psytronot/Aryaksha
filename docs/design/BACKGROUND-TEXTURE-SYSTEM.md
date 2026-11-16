# Background texture library

Product-specific background treatments adapted from the 22 directions in the supplied reference. These are a restrained design vocabulary, not a requirement to use all effects on every page.

## Catalogue and implementation class

| # | Treatment | Best use | Implementation |
|---:|---|---|---|
| 1 | Felt texture | Tactile editorial cards | Optional image asset; not globally applied |
| 2 | Fluted glass | Layered navigation / floating controls | CSS blur + repeated linear gradient; use sparingly |
| 3 | Thermal gradients | Data intensity / heat maps | Data-driven gradient only; never decorative heatmap claims |
| 4 | Water ripples | Flow / fluid / environmental story | SVG or authored image; not used in engineering UI by default |
| 5 | Speckled graphite | Dark technical surfaces | CSS radial speckle; very low contrast |
| 6 | Single-hue landscapes | Large atmospheric hero | Approved photograph/illustration required |
| 7 | Blueprint grids | Technical diagrams / engineering sections | CSS linear gradients |
| 8 | Halftone | Editorial image accents | CSS radial pattern or approved image |
| 9 | Grainy gradients | Large atmospheric surfaces | CSS gradients plus subtle noise asset; avoid filter-heavy noise |
| 10 | Grass texture | Environmental / agriculture content | Approved image asset; not appropriate for either brand's global UI |
| 11 | Dithered images | Retro technical diagrams | Preprocessed image asset / SVG; preserve legibility |
| 12 | Paper texture | Editorial content and documents | CSS layered gradients or optimized subtle texture asset |
| 13 | Contour lines | Terrain / orbital / field visualizations | SVG paths or CSS radial pattern; label illustrative contours accurately |
| 14 | Cloud sky | Aviation / atmosphere editorial | Approved photograph; not a generic dashboard backdrop |
| 15 | Pixel mosaics | Data tiles / discrete samples | CSS grid or authored SVG |
| 16 | Lens distortion | Photography-led campaign moments | Edited/approved photograph; not for text or controls |
| 17 | Stippled gradients | Quiet depth on large surfaces | CSS radial gradients; low contrast |
| 18 | Square-dot grids | Instrument panels / plotted data | CSS radial pattern |
| 19 | Blurred photos | Background behind a legibility overlay | Approved photo + strong contrast overlay |
| 20 | Iridescent shapes | Creative campaign accent | SVG/CSS only when brand-approved; avoid default glassmorphism |
| 21 | Impressionist paintings | Editorial campaign art | Licensed/commissioned artwork |
| 22 | ASCII and pixels | Data visualization / playful technical detail | Text/SVG generated from real data; never fake telemetry |

## Project mapping

### GENSER
- Primary: warm paper grain on editorial/document surfaces.
- Secondary: blueprint grid in technical diagrams and organization/framework illustrations.
- Optional: restrained halftone for approved image captions or archival markers.
- Do not use: grass, water ripples, iridescent blobs, pixel mosaics or generic cloud imagery as site-wide decoration.
- Keep the established warm-paper, graphite, steel and amber identity.

### Aryaksha
- Primary: speckled graphite on dark instrument surfaces.
- Secondary: blueprint grid and contour lines in technical visualization frames; square-dot grids for instrument/data panels.
- Optional: dithered/ASCII treatment only when generated from actual, clearly labeled data.
- Do not use: lens distortion, grass, impressionist art or iridescent blobs in engineering workspaces.
- Keep the dark aerospace-lab identity and preserve scientific units, provenance and status labels.

## Accessibility and performance rules
- Patterns are decorative: use pseudo-elements with `pointer-events:none` and `aria-hidden` only if markup is needed.
- Keep texture contrast extremely low; foreground text contrast must remain WCAG AA.
- Do not use texture as the only means of conveying status or data.
- No animation by default; honor `prefers-reduced-motion`.
- Avoid large raster noise files, SVG filter turbulence and backdrop-filter on scrolling content.
- Verify at 320px, 375px, 768px, 1024px and desktop widths; ensure no horizontal overflow.
- Texture utilities must be opt-in. Never apply all 22 effects to one page.
