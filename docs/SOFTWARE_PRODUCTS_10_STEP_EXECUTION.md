# Software Products Hub — 10-Step Execution Ledger

Branch: `feature/software-products-hub`
Pull request: https://github.com/psytronot/Aryaksha/pull/124
Scope: Arakshya only. This workstream is separate from GENSER.

| # | Step | Status | Evidence / remaining gate |
|---|---|---|---|
| 1 | Recheck branch, PR and CI | Complete | PR #124 remains open, draft and unmerged. Latest observed branch head: `26e32051c3109c4b6ac1348fa65eba7953a897ea`; most recent queued CI snapshot: `2704bb1`. |
| 2 | Resolve failing or stalled tests | Blocked on verification | Latest observed web build, TypeScript and unit tests passed on the earlier CI head. Browser smoke job remains in progress on an earlier snapshot. The completed browser run failed on two strict-mode heading assertions: the Finder heading also matched the report-preview heading. The status and Finder heading locators are now exact-scoped. Fresh CodeQL, Aryaksha CI and AppDeploy acceptance workflows are now queued for the current head; browser smoke will follow the build jobs. |
| 3 | Audit product-hub UI | Complete (static review) | Reviewed navigation, responsive layout, form states and report preview. Fixed the selector collisions found in the earlier browser run; mobile controls have explicit coverage. Current-head runtime verification remains in step 10. |
| 4 | Build Finder intake | Implemented, verification pending | Required offer, customer and geography fields; trim-aware validation; no-live-search disclosure; brief preview. |
| 5 | Add input validation and safe defaults | Implemented, verification pending | Required-field validation, bounded input lengths, explicit no-live-search state. |
| 6 | Build prospect-results experience | Blocked pending provider approval | The fictional preview now shows the required source, date, evidence-quality, confidence, fit-rationale and human-next-step fields. Live prospects still require an approved provider, authentication and tenant-owned jobs; do not fake live results. |
| 7 | Add report export | Implemented, verification pending | Downloadable Markdown research brief with live-research limitations and launch prerequisites; object URL lifetime extended to protect browser downloads. |
| 8 | Build user-supplied CSV alternative | Implemented, verification pending | Browser-local CSV parsing, UTF-8 BOM handling, supported name columns, optional website/city, duplicate removal, 2 MB cap, formula-injection neutralization and cleaned CSV export. No server upload or Maps scraping. |
| 9 | Security, privacy and compliance checks | Technical review complete; release blocked | Local-only CSV handling, 2 MB limit, BOM handling, malformed-header rejection and formula-injection neutralization are implemented. Provider due diligence and a ready-to-send Tavily written-approval request are documented; Tavily requires written customer-facing/multi-tenant approval and data-processing terms. No email has been sent. Authentication, tenant isolation, retention and legal approval remain release blockers. Google Maps extraction remains blocked. |
| 10 | Final E2E verification and PR update | In progress | CodeQL, Aryaksha CI and AppDeploy acceptance workflows are queued for the earlier code/test snapshot `2704bb1`; later feature commits added the evidence-field preview and need their own fresh verification. Wait for build/unit results, then browser smoke; update PR evidence after the complete run. Do not merge or deploy without authorization. |

## Release constraints

- Do not enable Google Maps scraping or export Google Maps-derived content until legal/compliance review approves a lawful source and use.
- Do not claim First Customer Finder has run live research or identified verified buyers.
- Do not add automatic outreach, private contact enrichment, or sensitive-trait targeting.
- Do not add payment processing until cost, provider terms, account ownership and reconciliation are approved.
- Do not merge or deploy without explicit authorization.
