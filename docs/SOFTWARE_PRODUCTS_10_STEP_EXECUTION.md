# Software Products Hub — 10-Step Execution Ledger

Branch: `feature/software-products-hub`
Pull request: https://github.com/psytronot/Aryaksha/pull/124
Scope: Arakshya only. This workstream is separate from GENSER.

| # | Step | Status | Evidence / remaining gate |
|---|---|---|---|
| 1 | Recheck branch, PR and CI | Complete | PR #124 remains open, draft and unmerged. Latest code/test commits include `48ca896` (isolated parser + unit tests), `fad7283` (browser resource-limit tests), `e4578ff`/`3a9effa` (CSV template download), and `106f8dc`/`0065e13` (upload retry + CRLF coverage); current PR head may advance with documentation updates. |
| 2 | Resolve failing or stalled tests | Blocked on verification | Latest completed web build, TypeScript and unit tests passed on an earlier CI head. Earlier browser smoke had two strict-mode locator failures; selectors were narrowed. Strict CSV parsing is isolated in `src/businessCsv.ts`, with Vitest unit tests and Playwright edge-case tests; all current code changes await CI. The completed browser run failed on two strict-mode heading assertions: the Finder heading also matched the report-preview heading. The status and Finder heading locators are now exact-scoped. Fresh CodeQL, Aryaksha CI and AppDeploy acceptance workflows are now queued for the current head; browser smoke will follow the build jobs. |
| 3 | Audit product-hub UI | Complete (static review) | Reviewed navigation, responsive layout, form states and report preview. Fixed the selector collisions found in the earlier browser run; mobile controls have explicit coverage. Current-head runtime verification remains in step 10. |
| 4 | Build Finder intake | Implemented, verification pending | Required offer, customer and geography fields; trim-aware validation; no-live-search disclosure; brief preview. |
| 5 | Add input validation and safe defaults | Implemented, verification pending | Required-field and whitespace validation, bounded input lengths, explicit no-live-search state; browser tests cover whitespace-only submissions and field bounds. |
| 6 | Build prospect-results experience | Blocked pending provider approval | The fictional preview now shows the required source, date, evidence-quality, confidence, fit-rationale and human-next-step fields. Live prospects still require an approved provider, authentication and tenant-owned jobs; do not fake live results. |
| 7 | Add report export | Implemented, verification pending | Downloadable Markdown research brief with live-research limitations and launch prerequisites; object URL lifetime extended to protect browser downloads. |
| 8 | Build user-supplied CSV alternative | Implemented, verification pending | Browser-local strict CSV parser: UTF-8 BOM, quoted commas/escaped quotes, quote-state validation, consistent row widths, duplicate-header rejection, duplicate removal, 2 MB cap, formula-injection-safe export and cleaned CSV download. Added edge-case browser tests. No server upload or Maps scraping. |
| 9 | Security, privacy and compliance checks | Technical review complete; release blocked | Local-only CSV handling, 2 MB/row/column/cell limits, BOM and quoted-field handling, malformed-quote/row-width/duplicate-header rejection, and formula-injection neutralization are implemented. Parser has focused Vitest unit coverage and browser tests; CI is pending. Provider due diligence and a ready-to-send Tavily written-approval request are documented; Tavily requires written customer-facing/multi-tenant approval and data-processing terms. No email has been sent. Authentication, tenant isolation, retention and legal approval remain release blockers. Google Maps extraction remains blocked. |
| 10 | Final E2E verification and PR update | In progress | CI runs are queued for code/test snapshots `740828a`, `227e7b3` and `ef15f65`; latest code/test head `1f521b9` needs its own fresh completed run. Browser smoke, CodeQL, build/unit and AppDeploy acceptance results are not yet confirmed for the strict parser changes. Wait for build/unit results, then browser smoke; update PR evidence after the complete run. Do not merge or deploy without authorization. |

## Release constraints

- Do not enable Google Maps scraping or export Google Maps-derived content until legal/compliance review approves a lawful source and use.
- Do not claim First Customer Finder has run live research or identified verified buyers.
- Do not add automatic outreach, private contact enrichment, or sensitive-trait targeting.
- Do not add payment processing until cost, provider terms, account ownership and reconciliation are approved.
- Do not merge or deploy without explicit authorization.


## Next 10-step hardening cycle (2026-11-15)

This is the active follow-on execution list. Items are not marked complete merely because code was committed; browser/CI evidence is required.

| # | Next task | Status | Completion evidence |
|---|---|---|---|
| 1 | Replace permissive CSV quote toggling with a strict field-state parser | Implemented + unit tested | Extracted to `src/businessCsv.ts`; rejects quote characters in unquoted fields, characters after a closing quote and unclosed quoted fields. |
| 2 | Reject structurally inconsistent CSV data | Implemented + unit tested | Rejects duplicate headers and data rows with a different number of columns from the header. |
| 3 | Verify BOM, quoted commas and escaped quote handling | Unit + browser tests added | Vitest and Playwright cover UTF-8 BOM, comma-containing company names, escaped quotes and quoted line breaks. |
| 4 | Verify malformed quote and unclosed-field rejection | Unit + browser tests added | Vitest and Playwright assert the corresponding parser errors. |
| 5 | Verify formula-injection-safe CSV exports | Browser test added | Playwright reads the downloaded file and checks formula prefixes are neutralized. |
| 6 | Verify upload size boundary and stale-result clearing | Tests added | 2 MB rejection, 10,000-row, 50-column and 4,096-character cell bounds are tested; stale-result clearing and same-file retry are implemented. Need browser run. |
| 7 | Verify research-brief trim validation and bounded fields | Test added | Playwright checks whitespace-only rejection and maxLength values. |
| 8 | Re-review product claims, privacy boundaries and data-source restrictions | Complete (static review) | No live research, data scraping, payments or outreach is represented as active. CSV upload guidance now documents hard processing bounds; file input supports retry. |
| 9 | Update release notes, ledger and PR verification record | In progress | Product plan and execution ledger updated with parser, limits, retry behavior and blank template; PR description needs latest CI results after they arrive. |
| 10 | Complete current-head CI and browser acceptance | Blocked on runners | Current-head run must pass build, typecheck, unit, CodeQL, AppDeploy acceptance and product-hub browser tests. Latest relevant runs remain queued; fix any failures before closing. |
