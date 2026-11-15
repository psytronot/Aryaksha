# Arakshya Lab — 20-point pre-launch security review

**Scope:** repository `psytronot/Aryaksha`, branch `security/hardening-20-checklist`. This is a code and configuration review, not a penetration test or cloud-account audit.

**Status meanings:** Implemented = evidenced in this codebase; Partial = some protection exists but a launch gate remains; Not applicable = the feature/data class does not exist in the current app; Blocked = requires hosting/account/operational access.

| # | Control from reference | Status | Evidence / required action |
|---:|---|---|---|
| 1 | Hide API keys | Partial | No API key is required by the current web backend; `OREKIT_SERVICE_URL` is environment configuration. Keep credentials in host secrets, never Vite `VITE_*` variables. Verify deployment environment and secret scanning before launch. |
| 2 | Purge Git secrets | Blocked | `.gitignore` excludes env files, but repository history and host logs must be scanned. If a secret was ever committed, revoke/rotate it first; history rewriting alone is not remediation. |
| 3 | Use public DB key | Not applicable | No database client or database service is present in the inspected application. If one is added, browser clients may use only publishable/anon keys, never service-role credentials. |
| 4 | Enable row-level security | Not applicable | No database tables exist in this app. Any future Supabase/Postgres tables must have RLS enabled and tested for anon, authenticated, and cross-user access. |
| 5 | Encrypt sensitive data | Partial | The current app has no user-data persistence. Production TLS is provided by the hosting edge; HSTS is now emitted only for HTTPS requests. Any future stored personal data needs encryption-at-rest and key-management review. |
| 6 | Enforce server-side auth | Not applicable | No accounts or private user-specific endpoints currently exist; the public orbital-learning API is intentionally unauthenticated. Before adding accounts, enforce authorization on every protected server route. |
| 7 | Lock record access | Not applicable | No user-owned database records or private record APIs currently exist. Future records must be scoped by authenticated subject on the server, not client-supplied owner IDs. |
| 8 | Block field tampering | Implemented / strengthened | Orbit analysis already rejects unknown fields and non-numeric values. Simulation propagation now has an allowlist, strict numeric/time bounds, and strict TLE object validation. |
| 9 | Secure session cookies | Not applicable | No login/session-cookie mechanism exists. If sessions are introduced, use Secure, HttpOnly, SameSite cookies, rotation, expiry, and CSRF protections where appropriate. |
| 10 | Hash passwords | Not applicable | No passwords are collected or stored. If local password auth is introduced, use a modern password-hashing algorithm such as Argon2id via a maintained library; never reversible encryption or plain SHA hashes. |
| 11 | Rate limit login | Not applicable | No login endpoint exists. General API rate limiting is implemented at 60 requests/minute per client; login-specific limits become mandatory if auth is added. |
| 12 | Add bot protection | Partial | API rate limiting exists; there are no public signup/contact forms to protect. Add edge/WAF bot controls or CAPTCHA only if abuse patterns justify them, with accessible alternatives. |
| 13 | Parameterize queries | Not applicable | No SQL/database query layer exists in the inspected app. Use parameterized statements or a safe query builder if persistence is introduced; never concatenate user input into SQL. |
| 14 | Validate all input | Implemented / strengthened | JSON body size is capped at 64 KiB; orbit inputs are strict; simulation input now validates shape, fields, numbers, time bounds, TLE line lengths and optional display name. Continue validating new endpoints at their boundary. |
| 15 | Escape user content | Partial | React's standard text rendering escapes interpolated text; API output is JSON. Do not introduce `dangerouslySetInnerHTML` without a reviewed sanitizer. Verify all future rich-text/report rendering paths. |
| 16 | Restrict file uploads | Not applicable | No file-upload endpoint or upload UI exists. If added, enforce MIME/content inspection, size limits, random object names, private storage, malware scanning where appropriate, and authorization. |
| 17 | Trim API responses | Partial | API responses are structured and API cache is disabled. The Orekit proxy now validates required response fields and emits an explicit allowlist; add a regression test against a mock upstream payload containing extra fields before treating this control as fully verified. |
| 18 | Add security headers | Implemented / partial | Adds nosniff, frame denial, referrer and permissions policy, cross-origin isolation headers, and conditional HSTS. CSP remains Report-Only until all production origins are verified; do not enforce blindly. |
| 19 | Force HTTPS | Partial / hosting-dependent | The deployment runbook relies on the Render TLS edge. HSTS is emitted for HTTPS requests; verify HTTP-to-HTTPS redirects and custom-domain TLS in the live host configuration. |
| 20 | Scan dependencies | Partial | Dependabot and CodeQL are enabled; CI reports all dependency audit findings and now blocks on high/critical production dependency vulnerabilities. The audit itself must complete successfully on this branch and findings must be triaged. |

## Code changes in this branch

- Add HSTS on requests recognised as HTTPS by the trusted hosting proxy.
- Add Cross-Origin-Resource-Policy, Cross-Origin-Opener-Policy and X-Permitted-Cross-Domain-Policies.
- Add `Cache-Control: no-store` to API responses.
- Reject unknown simulation fields, non-number simulation times, times beyond seven days, malformed TLE lines, and unexpected TLE object properties.
- Bound and strip control characters from the optional TLE display name.
- Return a generic internal-server error instead of reflecting unexpected exception messages to clients.
- Add regression tests for the new behavior.

## Release blockers / manual verification

1. Run a separate full-repository history scan (all branches and refs) and inspect deployment configuration for exposed credentials; rotate any discovered secret. The current PR CI scan covers only the pull-request comparison range and does not inspect host-only secrets. Repository rulesets currently return an empty list; branch-protection details could not be read through the connected integration, so configure and verify required pull-request reviews, required CI checks, and force-push restrictions in GitHub settings.
2. Inspect production host settings for HTTPS redirects, TLS, trusted proxy count, environment secrets, and edge/WAF controls.
3. Review the deployed CSP report-only violations and then create an enforceable CSP policy based on actual required origins.
4. Add an integration test proving unexpected upstream Orekit fields are not forwarded.
5. Decide whether authentication, database/RLS, sessions, uploads, and user-record isolation are needed for any new product feature; do not add them to the current public orbital learning app without a real requirement.
6. Run npm audit and the full CI workflow on this branch; resolve critical/high production vulnerabilities before release.

## Important limitations

This review does not prove the absence of vulnerabilities. GitHub source inspection cannot read deployment secrets, hosting dashboard settings, historical secret exposure, production logs, or live edge rules. A separate secret scan, dependency scan, dynamic test, and production configuration review are required before public launch.
