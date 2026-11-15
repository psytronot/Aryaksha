# Software Products Hub — 10-Step Execution Ledger

Branch: `feature/software-products-hub`
Pull request: https://github.com/psytronot/Aryaksha/pull/124
Scope: Arakshya only. This workstream is separate from GENSER.

| # | Step | Status | Evidence / remaining gate |
|---|---|---|---|
| 1 | Recheck branch, PR and CI | Complete | PR #124 remains open, draft and unmerged. Latest provider-diligence commit: `eb90dc9c048e010352cbf1f51938c0fa52540bcc` (branch head may advance with subsequent commits). |
| 2 | Resolve failing or stalled tests | Blocked on verification | Latest observed web build, TypeScript and unit tests passed on the earlier CI head. Browser smoke job remains in progress on an earlier snapshot. The previous completed browser run failed because the status assertion matched both the badge and disclaimer; the selector is now exact-text scoped. Newer feature commits have not yet been covered by a fresh completed workflow run. |
| 3 | Audit product-hub UI | In progress | Reviewed product hub component and responsive CSS; fixed the status-selector collision and corrected Finder form typography. Existing desktop/mobile navigation tests remain; fresh browser/accessibility verification against current head is outstanding. |
| 4 | Build Finder intake | Implemented, verification pending | Required offer, customer and geography fields; trim-aware validation; no-live-search disclosure; brief preview. |
| 5 | Add input validation and safe defaults | Implemented, verification pending | Required-field validation, bounded input lengths, explicit no-live-search state. |
| 6 | Build prospect-results experience | Blocked pending provider approval | The fictional preview remains clearly labelled. Evidence-backed live prospects require an approved provider, authentication and tenant-owned jobs; do not fake live results. |
| 7 | Add report export | Implemented, verification pending | Downloadable Markdown research brief with live-research limitations and launch prerequisites; object URL lifetime extended to protect browser downloads. |
| 8 | Build user-supplied CSV alternative | Implemented, verification pending | Browser-local CSV parsing, UTF-8 BOM handling, supported name columns, optional website/city, duplicate removal, 2 MB cap, formula-injection neutralization and cleaned CSV export. No server upload or Maps scraping. |
| 9 | Security, privacy and compliance checks | In progress | Added local-only handling and formula-injection neutralization. Added provider due-diligence matrix: Tavily is conditional pending written approval; Exa and Brave are not approved for persistent output/export under default terms. Legal review and provider confirmation remain open. Google Maps extraction remains blocked. |
| 10 | Final E2E verification and PR update | Pending | Must run fresh build, unit, E2E and security checks against current head; then update PR evidence. Do not merge or deploy without authorization. |

## Release constraints

- Do not enable Google Maps scraping or export Google Maps-derived content until legal/compliance review approves a lawful source and use.
- Do not claim First Customer Finder has run live research or identified verified buyers.
- Do not add automatic outreach, private contact enrichment, or sensitive-trait targeting.
- Do not add payment processing until cost, provider terms, account ownership and reconciliation are approved.
- Do not merge or deploy without explicit authorization.
