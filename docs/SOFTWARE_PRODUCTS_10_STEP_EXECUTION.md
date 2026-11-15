# Software Products Hub — 10-Step Execution Ledger

Branch: `feature/software-products-hub`
Pull request: https://github.com/psytronot/Aryaksha/pull/124
Scope: Arakshya only. This workstream is separate from GENSER.

| # | Step | Status | Evidence / remaining gate |
|---|---|---|---|
| 1 | Recheck branch, PR and CI | Complete | PR #124 remains open, draft and unmerged. Latest branch head observed: `d97c4f0a0a5a834d1c43c7b67dad142daf3c84cf`. |
| 2 | Resolve failing or stalled tests | Blocked on verification | Latest observed web build, TypeScript and unit tests passed on the earlier CI head. Browser smoke job remains in progress; connector cannot retrieve live job logs while it runs. New commits made through the GitHub contents API have not yet surfaced as a new PR-triggered workflow run. |
| 3 | Audit product-hub UI | In progress | Reviewed product hub component and responsive CSS. Need fresh browser/accessibility verification against current head. |
| 4 | Build Finder intake | Implemented, verification pending | Required offer, customer and geography fields; trim-aware validation; no-live-search disclosure; brief preview. |
| 5 | Add input validation and safe defaults | Implemented, verification pending | Required-field validation, bounded input lengths, explicit no-live-search state. |
| 6 | Build prospect-results experience | Demo only | Existing report preview is explicitly fictional. Live evidence-backed prospect results require an approved research provider and authentication. |
| 7 | Add report export | Implemented, verification pending | Downloadable Markdown research brief with live-research limitations and launch prerequisites. |
| 8 | Build user-supplied CSV alternative | Implemented, verification pending | Browser-local CSV parsing, supported name columns, optional website/city, duplicate removal, 2 MB cap and cleaned CSV export. No server upload or Maps scraping. |
| 9 | Security, privacy and compliance checks | In progress | Added local-only handling and spreadsheet formula-injection neutralization on CSV export. Need tests/review for malformed CSV, privacy disclosures and upstream provider terms. Google Maps extraction remains blocked. |
| 10 | Final E2E verification and PR update | Pending | Must run fresh build, unit, E2E and security checks against current head; then update PR evidence. Do not merge or deploy without authorization. |

## Release constraints

- Do not enable Google Maps scraping or export Google Maps-derived content until legal/compliance review approves a lawful source and use.
- Do not claim First Customer Finder has run live research or identified verified buyers.
- Do not add automatic outreach, private contact enrichment, or sensitive-trait targeting.
- Do not add payment processing until cost, provider terms, account ownership and reconciliation are approved.
- Do not merge or deploy without explicit authorization.
