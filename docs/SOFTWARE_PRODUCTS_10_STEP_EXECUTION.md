# Software Products Hub — 10-Step Execution Ledger

Branch: `feature/software-products-hub`
Pull request: https://github.com/psytronot/Aryaksha/pull/124
Scope: Arakshya only. This workstream is separate from GENSER.

| # | Step | Status | Evidence / remaining gate |
|---|---|---|---|
| 1 | Recheck branch, PR and CI | Complete | PR #124 remains open, draft and unmerged. Latest code/test commits include `48ca896` (isolated parser + unit tests), `fad7283` (browser resource-limit tests), `e4578ff`/`3a9effa` (CSV template), `b6cb976`/`a700add` (isolated formula-safe serializer), `958a555` (App integration), `c1e0c90` (serializer tests), `eb6515e` (file-input reset assertion), and `e05f7c7` (stale asynchronous read protection). |
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


## Next 10-step hardening cycle — implementation status

The ten engineering tasks below are implemented on this branch. Repository CI is tracked separately as a release-verification gate; queued workflows are not counted as passing tests.

| # | Step | Status | Evidence |
|---|---|---|---|
| 1 | Extract CSV parsing into a focused module | Complete | `src/businessCsv.ts`; imported by the product-hub UI. |
| 2 | Enforce strict CSV quoting rules | Complete | Rejects embedded unquoted quotes, trailing characters after a closing quote and unclosed fields. |
| 3 | Validate CSV structure | Complete | Handles BOM, CRLF, blank lines, quoted commas, escaped quotes and quoted newlines; rejects duplicate headers and inconsistent row widths. |
| 4 | Bound browser-side processing | Complete | 2 MB file cap, 10,000 data rows, 50 columns and 4,096 characters per cell; limits are disclosed in the UI. |
| 5 | Isolate safe CSV serialization | Complete | `serializeBusinessCsv` quotes/escapes every cell and prefixes formula-like values, including whitespace-prefixed values. |
| 6 | Add a blank CSV template | Complete | Downloadable `Company,Website,City` template with CRLF line endings. |
| 7 | Improve upload recovery | Complete | File input resets after selection; prior results clear on a new attempt and the same file can be selected again. |
| 8 | Prevent asynchronous upload races | Complete | Request sequence guard ignores stale file-read completions. |
| 9 | Add focused automated coverage | Complete (tests authored) | Vitest parser/serializer cases and Playwright coverage for malformed files, limits, formula-safe exports, template content and input reset. |
| 10 | Update product documentation and PR evidence | Complete | Product plan, execution ledger and PR #124 description updated. |

## Next hosted-pilot workstream

Created `docs/FIRST_CUSTOMER_FINDER_INFRASTRUCTURE_READINESS.md` after inspecting `README.md`, `SECURITY.md`, the route inventory, deployment runbook and current Express host. It confirms the repository has no auth, account-level authorization, database/job store or queue, and that the current in-memory limiter is not a per-user quota. The document lays out the next ten hosted-pilot steps and the decisions/permissions needed before live endpoints. No external provider or infrastructure was connected.

## Separate release-verification gate

- Current-head Aryaksha CI, CodeQL and AppDeploy acceptance workflows have been created by GitHub but remain queued; no completed current-head result is available yet.
- An isolated local TypeScript transpile and Node harness passed 12 parser cases; a separate local serializer check passed CRLF, escaping and formula-prefix neutralization. These checks do not replace repository Vitest, Playwright, CodeQL or AppDeploy runs.
- PR #124 remains draft and unmerged. Do not merge or deploy without explicit authorization.
- Live First Customer Finder remains blocked on provider permission, authentication, tenant isolation, retention/deletion and legal review. Google Maps extraction remains blocked by the source-terms risk.


## Hosted-pilot progress update — 2026-11-15

The independent design work has advanced on the same feature branch:
- `docs/FIRST_CUSTOMER_FINDER_HOSTED_PILOT_BUILD_SPEC.md` — detailed relational schema, individual/workspace ownership model, role boundaries, API contract, transactional outbox, worker lifecycle, abuse controls, retention/deletion requirements and acceptance-test matrix.
- `docs/FIRST_CUSTOMER_FINDER_INFRASTRUCTURE_READINESS.md` — updated to reflect the design work. The design portions of hosted steps 4, 5 and 9 are documented; implementation still waits for infrastructure and provider decisions.
- `docs/TAVILY_WRITTEN_APPROVAL_REQUEST_DRAFT.md` — complete written-approval request prepared for owner review. It has NOT been sent.
- Recommended rollout: individual accounts first; preserve nullable workspace support for institution-managed accounts later. This is a recommendation pending owner confirmation.
- Queue recommendation for evaluation: PostgreSQL-backed pg-boss. No queue vendor has been selected or deployed.
- No authentication, database, worker, provider key, payments, live endpoint or pilot cohort has been provisioned.

### Current CI snapshot

The latest feature-branch commit at the time of this update is `de6aaeb8`. Aryaksha CI, CodeQL and AppDeploy acceptance runs were queued for earlier recent commits; fresh current-head runs must be checked before claiming release verification. PR #124 remains draft and unmerged.


## CI failure investigation and parser correction — 2026-11-15

A completed Aryaksha CI run on merge commit `659bfa816928b0bbd11a3ac5db8d730ca238c857` (PR head `9b26695018b98fdfc18371d5774864538411be0f`) found a real defect in `src/businessCsv.ts`:
- The parser compared row separators against escaped backslash sequences instead of actual newline characters.
- This caused valid multi-row CSV input to be accumulated as a single field and cascaded into 9 failures in `tests/businessCsv.test.ts`; the other 75 tests in that run passed.
- TypeScript typecheck passed; the failing job was `npm test`. Browser smoke was skipped because the web build/unit job failed.
- Corrected the row-separator checks and CRLF lookahead in commits `becdcb6` and `7c17bb8`.
- Fresh Aryaksha CI, CodeQL and AppDeploy acceptance workflows are queued for corrected branch head `7c17bb856850693d3707fc2470338e0ad4b6bf41`. The fix is not yet verified by completed CI, so do not mark the test suite green.

The failure was fixed in code, not hidden by relaxing assertions. Next verification must confirm the full Vitest suite passes, then the dependent browser smoke job runs.
